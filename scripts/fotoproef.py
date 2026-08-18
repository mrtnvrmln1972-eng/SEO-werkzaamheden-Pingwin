#!/usr/bin/env python3
"""De fotoproef: kijkt zelf of een opmaakronde iets zichtbaars heeft gedaan.

GEBRUIK
═══════
    python3 scripts/fotoproef.py voor      (nulmeting, vóór je iets aanraakt)
    ... werk ...  push ...  scripts/wacht-op-deploy.sh
    python3 scripts/fotoproef.py na        (nieuwe foto's + het verschil)

WAAROM DIT ER IS
════════════════
Het strak trekken van de opmaak duurde te lang, en de reden was niet het werk
maar de werkwijze: na élke ronde moest Maarten kijken of het er nog goed uitzag,
want dat kon niemand anders vaststellen. Daardoor was elke ronde een halve dag
wachten op een oordeel dat in negen van de tien gevallen "ja hoor" was.

Dit script neemt dat oordeel over voor het deel dat te meten is. Het fotografeert
een vaste set schermen via /api/admin/kijkbeeld (dezelfde acht die het dashboard
zelf al gebruikt, plus de stijlpagina), en vergelijkt de nieuwe foto's met de
oude, pixel voor pixel. De uitkomst is een percentage per scherm plus de banden
waar het verschil zit, zodat er niet naar "voelt anders" hoeft te worden gegist.

WAT DE UITSLAG BETEKENT
═══════════════════════
    onder 0,5%   niets aan de hand, dit gaat door zonder iemand lastig te vallen
    0,5% tot 5%  zichtbaar maar klein; gaat door mét een foto in de terugkoppeling
    boven 5%     eerst laten zien, dit verandert het gezicht van een scherm

Let op wat het NIET is: een oordeel over of iets mooier is geworden. Het meet
alleen of er iets veranderd is en hoeveel. Mooi blijft mensenwerk.

De foto's staan in .fotoproef/ en gaan niet mee de repo in; het zijn megabytes
en ze zijn morgen weer anders.
"""

import json
import os
import re
import subprocess
import sys
from pathlib import Path

try:
    from PIL import Image, ImageChops
except ImportError:
    sys.exit("Deze proef heeft Pillow nodig: pip install --quiet Pillow")

WORTEL = Path(__file__).resolve().parent.parent
MAP = WORTEL / ".fotoproef"
SITE = "https://pingwin-seo-dashboard.vercel.app"
KOEKJE = "/tmp/kijk-fotoproef.txt"

# Twee kleuren tellen als verschillend vanaf dit verschil per kanaal. Onder de
# drempel zit het ruis van tekstverfijning en van een schaduw die een honderdste
# doorzichtiger is; precies wat we juist NIET als verandering willen tellen.
DREMPEL = 12


def schermen():
    """De vaste lijst uit lib/schermbeeld.ts, plus de stijlpagina zelf.

    Bewust uit dat bestand gelezen en niet hier overgetypt: het dashboard
    fotografeert zichzelf al met die lijst, en twee lijsten lopen uit elkaar.
    """
    bron = (WORTEL / "lib" / "schermbeeld.ts").read_text()
    slug = re.search(r'BRON_SLUG\s*=\s*"([^"]+)"', bron).group(1)
    uit = []
    for m in re.finditer(r'label:\s*"([^"]+)",\s*pad:\s*[`"]([^`"]+)[`"]', bron):
        uit.append((m.group(1), m.group(2).replace("${BRON_SLUG}", slug)))
    uit.append(("Het scherm Stijl", "/admin/stijl"))
    uit.append(("Het fundament", "/admin/fundament"))
    return uit


def sessie():
    sleutel = os.environ.get("PINGWIN_KIJK_SLEUTEL", "")
    if not sleutel:
        sys.exit("PINGWIN_KIJK_SLEUTEL staat niet in deze omgeving; meekijken kan niet.")
    uit = subprocess.run(
        ["curl", "-s", "-c", KOEKJE, f"{SITE}/api/kijk?sleutel={sleutel}"],
        capture_output=True, text=True).stdout
    if '"ok":true' not in uit:
        sys.exit(f"Meekijken lukte niet: {uit[:200]}")


def fotografeer(doelmap: Path):
    doelmap.mkdir(parents=True, exist_ok=True)
    for label, pad in schermen():
        naam = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
        scheiding = "&" if "?" in pad else "?"
        url = f"{SITE}/api/admin/kijkbeeld?pad={pad}{scheiding}wacht=6000"
        # Drie pogingen: de foto wordt door een echte browser op de server gemaakt
        # en die start soms niet op ("De browser kon niet starten"). Dat is geen
        # eigenschap van het scherm maar van het moment; één keer opnieuw vragen
        # lost het bijna altijd op, en een ontbrekende foto is een blinde vlek.
        grootte = 0
        for poging in range(3):
            subprocess.run(
                ["curl", "-s", "-b", KOEKJE, "--max-time", "180", url, "-o", str(doelmap / f"{naam}.png")],
                capture_output=True)
            bestand = doelmap / f"{naam}.png"
            grootte = bestand.stat().st_size if bestand.exists() else 0
            if grootte > 5000:
                break
        print(f"  {label:38} {grootte // 1024:>6} kB" + ("" if grootte > 5000 else "   LET OP: geen foto"))


def vergelijk():
    """Per scherm: hoeveel is er anders, en waar zit het."""
    regels = []
    for label, _pad in schermen():
        naam = re.sub(r"[^a-z0-9]+", "-", label.lower()).strip("-")
        a, b = MAP / "voor" / f"{naam}.png", MAP / "na" / f"{naam}.png"
        if not a.exists() or not b.exists():
            regels.append((label, None, "geen paar foto's"))
            continue
        va, vb = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
        if va.width != vb.width:
            regels.append((label, None, f"andere breedte ({va.width} → {vb.width})"))
            continue

        hoogteverschil = vb.height - va.height
        h = min(va.height, vb.height)
        verschil = ImageChops.difference(va.crop((0, 0, va.width, h)), vb.crop((0, 0, vb.width, h)))
        # Per pixel het grootste kanaalverschil, daarna alles onder de drempel weg.
        grijs = verschil.convert("L").point(lambda p: 255 if p >= DREMPEL else 0)
        anders = sum(grijs.histogram()[1:])
        totaal = va.width * h
        pct = anders / totaal * 100

        # Waar zit het? De hoogste banden van 100 pixels, zodat er een plek bij staat
        # in plaats van alleen een getal.
        banden = []
        for y in range(0, h, 100):
            strook = grijs.crop((0, y, va.width, min(y + 100, h)))
            n = sum(strook.histogram()[1:])
            if n:
                banden.append((n, y))
        banden.sort(reverse=True)
        plek = ", ".join(f"y{y}-{y + 100}" for _n, y in banden[:3]) if banden else "nergens"
        extra = f", {hoogteverschil:+d}px hoger" if hoogteverschil else ""
        regels.append((label, pct, f"{plek}{extra}"))

    print(f"\n{'scherm':40} {'anders':>8}   waar")
    print("─" * 78)
    zwaarste = 0.0
    for label, pct, waar in regels:
        if pct is None:
            print(f"{label:40} {'?':>8}   {waar}")
            continue
        zwaarste = max(zwaarste, pct)
        print(f"{label:40} {pct:7.2f}%   {waar}")

    print()
    if zwaarste < 0.5:
        print(f"Grootste verschil {zwaarste:.2f}%: niets zichtbaars. Doorvoeren.")
        return 0
    if zwaarste < 5:
        print(f"Grootste verschil {zwaarste:.2f}%: klein maar zichtbaar. Doorvoeren mét een foto erbij.")
        return 0
    print(f"Grootste verschil {zwaarste:.2f}%: dit verandert het gezicht van een scherm. Eerst laten zien.")
    return 1


if __name__ == "__main__":
    wat = sys.argv[1] if len(sys.argv) > 1 else ""
    if wat not in ("voor", "na"):
        sys.exit(__doc__)
    sessie()
    print(f"Foto's maken ({wat}):")
    fotografeer(MAP / wat)
    if wat == "voor":
        print("\nNulmeting staat klaar. Ga aan het werk; draai daarna 'na'.")
    else:
        sys.exit(vergelijk())
