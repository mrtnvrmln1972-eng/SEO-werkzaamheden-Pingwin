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

TWEE GETALLEN, EN HET TWEEDE IS HET BELANGRIJKSTE
═════════════════════════════════════════════════
"Anders" telt de pixels die niet gelijk zijn. Dat getal is onbruikbaar zodra er
een rij bij komt of afgaat, want dan schuift alles eronder op en is de halve
pagina "anders" zonder dat de opmaak veranderd is. Precies dat gebeurde bij de
eerste meting: de klantenlijst stond op 12% omdat er ondertussen klanten waren
bijgewerkt.

"Kleur" vergelijkt hoevéél van elke kleur er op het scherm staat, niet wáár.
Schuift de inhoud op, dan blijft dat getal gelijk; verandert er een kleur, een
rand of een schaduw, dan beweegt het meteen. Dat is dus het getal dat over de
opmaak gaat, en het getal waarop besloten wordt:

    kleur onder 0,5%   niets aan de hand, doorvoeren zonder iemand lastig te vallen
    kleur 0,5% tot 3%  zichtbaar maar klein; doorvoeren mét een foto erbij
    kleur boven 3%     eerst laten zien, dit verandert het gezicht van een scherm

"Anders" blijft er wél bij staan, als kijkwijzer: het noemt de banden waar het
verschil zit, zodat er naar de juiste plek gekeken wordt in plaats van naar een
hele pagina.

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
        # Een mislukte foto is een foutmelding van een paar tientallen bytes, geen
        # plaatje. Dat mag de hele proef niet laten omvallen: dan verdwijnt ook de
        # uitslag van de negen schermen die wél gelukt zijn.
        try:
            va, vb = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
        except (FileNotFoundError, OSError):
            regels.append((label, None, None, "geen bruikbaar paar foto's"))
            continue
        if va.width != vb.width:
            regels.append((label, None, None, f"andere breedte ({va.width} → {vb.width})"))
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
        extra = f", {hoogteverschil:+d}px" if hoogteverschil else ""
        regels.append((label, kleurverschil(va, vb), pct, f"{plek}{extra}"))

    print(f"\n{'scherm':38} {'kleur':>7} {'anders':>8}   waar")
    print("─" * 84)
    zwaarste = 0.0
    for label, kleur, pct, waar in regels:
        if pct is None:
            print(f"{label:38} {'?':>7} {'?':>8}   {waar}")
            continue
        zwaarste = max(zwaarste, kleur)
        print(f"{label:38} {kleur:6.2f}% {pct:7.2f}%   {waar}")

    print()
    if zwaarste < 0.5:
        print(f"Grootste kleurverschil {zwaarste:.2f}%: niets zichtbaars aan de opmaak. Doorvoeren.")
        return 0
    if zwaarste < 3:
        print(f"Grootste kleurverschil {zwaarste:.2f}%: klein maar zichtbaar. Doorvoeren mét een foto erbij.")
        return 0
    print(f"Grootste kleurverschil {zwaarste:.2f}%: dit verandert het gezicht van een scherm. Eerst laten zien.")
    return 1


def kleurverschil(va: "Image.Image", vb: "Image.Image") -> float:
    """Hoeveel van het scherm heeft een andere kleur gekregen, waar dan ook.

    Vergelijkt hoevéél er van elke kleur op het scherm staat in plaats van waar.
    Daardoor telt een rij die erbij komt niet mee (dezelfde kleuren, alleen meer
    of minder), maar een rand die van beige naar grijs gaat wél. Dat is precies
    het onderscheid tussen "de data is bijgewerkt" en "de opmaak is veranderd".

    De kanalen worden in stapjes van vier bij elkaar geveegd: het verschil tussen
    twee naast elkaar liggende tinten is geen verandering maar de afronding van
    tekstverfijning.
    """
    def verdeling(v):
        h = v.convert("RGB").histogram()
        n = v.width * v.height
        uit = []
        for kanaal in range(3):
            bak = h[kanaal * 256:(kanaal + 1) * 256]
            uit += [sum(bak[i:i + 4]) / n for i in range(0, 256, 4)]
        return uit

    a, b = verdeling(va), verdeling(vb)
    # Gedeeld door 3 (drie kanalen) en door 2 (elk verschil telt aan beide kanten).
    return sum(abs(x - y) for x, y in zip(a, b)) / 6 * 100


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
