"use client";

import { useEffect, useState } from "react";
import Vouwblok from "./Vouwblok";
import { Oog } from "../_ui/Pijl";

// ── Claude laten meekijken ──
// Maarten wil dat Claude standaard kan meekijken in het dashboard, zonder per
// keer een link te delen. Hier maakt hij daar één keer een sleutel voor aan.
// De uitleg staat er bewust helemaal bij: hij hoeft dan nooit meer te vragen
// hoe het ook alweer zat, en een volgende sessie kan het hier teruglezen.
type KijkStatus = {
  actief: boolean;
  aangemaakt: string | null;
  laatstGebruikt: string | null;
  laatstMislukt: string | null;
  mislukteReden: "geen-sleutel" | "andere-sleutel" | "leeg" | null;
};

export default function KijkSleutel() {
  const [status, setStatus] = useState<KijkStatus | null>(null);
  const [sleutel, setSleutel] = useState("");
  const [bezig, setBezig] = useState(false);
  const [kopie, setKopie] = useState(false);
  // Een mislukte knopdruk moet je kunnen zíen. Eerst gebeurde er bij een fout
  // helemaal niets op het scherm: geen sleutel, geen melding. Dan denk je dat
  // het gelukt is terwijl er niets klaarstaat, en dat kost een hele ronde.
  const [fout, setFout] = useState<string | null>(null);
  const [getest, setGetest] = useState(false);

  async function laad() {
    const d = await fetch("/api/admin/kijk-sleutel").then((r) => r.json()).catch(() => null);
    if (d?.ok) setStatus({
      actief: d.actief,
      aangemaakt: d.aangemaakt,
      laatstGebruikt: d.laatstGebruikt,
      laatstMislukt: d.laatstMislukt ?? null,
      mislukteReden: d.mislukteReden ?? null,
    });
  }
  useEffect(() => { void laad(); }, []);

  async function maak() {
    setBezig(true);
    setFout(null);
    setGetest(false);
    try {
      const d = await fetch("/api/admin/kijk-sleutel", { method: "POST" }).then((r) => r.json());
      if (!d?.ok) { setFout(d?.error || "De sleutel kon niet aangemaakt worden. Probeer het nog een keer."); return; }
      setSleutel(d.sleutel);
      await laad();
      // Zelftest: probeer de verse sleutel meteen uit op de ingang die Claude
      // straks gebruikt. Alleen uitproberen, dus zonder je eigen adminsessie te
      // raken. Pas als die deur echt opengaat mag hier "gelukt" staan; eerder gaf
      // deze knop een sleutel terug die nergens werkte, en dat bleef onzichtbaar.
      const t = await fetch(`/api/kijk?test=1&sleutel=${encodeURIComponent(d.sleutel)}`)
        .then((r) => r.json()).catch(() => null);
      setGetest(t?.ok === true);
      if (!t?.ok) setFout("De sleutel is aangemaakt, maar de ingang accepteert hem nog niet. Druk nog een keer op de knop.");
    } catch {
      setFout("Het dashboard antwoordde niet. Controleer je verbinding en probeer het nog een keer.");
    } finally { setBezig(false); }
  }

  async function trekIn() {
    if (!window.confirm("Claude kan hierna niet meer meekijken. Jouw eigen login verandert niet.\n\nDoorgaan?")) return;
    setBezig(true);
    setFout(null);
    try {
      const d = await fetch("/api/admin/kijk-sleutel", { method: "DELETE" }).then((r) => r.json());
      if (!d?.ok) { setFout(d?.error || "Intrekken is niet gelukt. Probeer het nog een keer."); return; }
      setSleutel(""); await laad();
    } catch {
      setFout("Het dashboard antwoordde niet. Controleer je verbinding en probeer het nog een keer.");
    } finally { setBezig(false); }
  }

  const datum = (s: string | null) => (s ? new Date(s).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "");
  const tijdstip = (s: string | null) =>
    s ? new Date(s).toLocaleString("nl-NL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }) : "";

  // Een mislukte poging is alleen nog nieuws als hij ná het laatste geslaagde
  // bezoek kwam; anders gaat het om een oude poging die allang opgelost is.
  const mislukt = status?.laatstMislukt || null;
  const openstaand =
    mislukt && (!status?.laatstGebruikt || new Date(mislukt) > new Date(status.laatstGebruikt)) ? mislukt : null;
  const waaromNiet: Record<NonNullable<KijkStatus["mislukteReden"]>, string> = {
    "geen-sleutel": "er stond toen geen sleutel klaar. Zet meekijken hieronder aan.",
    "andere-sleutel":
      "hij gebruikte een ingetrokken sleutel. Maak hieronder één nieuwe, zet hem in je Claude-omgeving en open " +
      "daarna een nieuwe chat. Een chat die al openstond blijft dit melden; dat is normaal en geen reden om er " +
      "nóg een te maken.",
    leeg: "er kwam geen sleutel mee. Controleer of PINGWIN_KIJK_SLEUTEL in je Claude-omgeving staat.",
  };

  return (
    <Vouwblok
      titel="Claude laten meekijken"
      icoon={<Oog />}
      actie={
        <span className={"kijk-stand" + (status?.actief ? " kijk-stand-aan" : "")}>
          {status === null ? "…" : status.actief ? "staat aan" : "staat uit"}
        </span>
      }
    >
      {(
        <div className="kijk-body">
          <p>
            Hiermee kan Claude alles in dit dashboard <strong>bekijken</strong>, in elke sessie, zonder dat je een link
            hoeft te delen. Wijzigen kan hij niet: opslaan, doorvoeren en verwijderen worden geweigerd.
          </p>

          {status?.actief && (
            <p className="kijk-meta">
              Sleutel aangemaakt op {datum(status.aangemaakt)}.{" "}
              {status.laatstGebruikt ? `Laatst gebruikt op ${datum(status.laatstGebruikt)}.` : "Nog niet gebruikt."}
            </p>
          )}

          {openstaand && status?.mislukteReden && (
            <p className="kijk-alarm">
              Claude probeerde mee te kijken op {tijdstip(openstaand)} en kwam er niet in:{" "}
              {waaromNiet[status.mislukteReden]}
            </p>
          )}

          {fout && <p className="kijk-alarm">{fout}</p>}

          {sleutel && (
            <div className="kijk-nieuw">
              <p><strong>Dit is je sleutel. Je ziet hem één keer.</strong></p>
              {getest && <p className="kijk-getest">Getest: de ingang laat deze sleutel binnen.</p>}
              <code className="kijk-waarde">PINGWIN_KIJK_SLEUTEL={sleutel}</code>
              <button
                type="button"
                className="btn btn-klein"
                onClick={() => { void navigator.clipboard.writeText(`PINGWIN_KIJK_SLEUTEL=${sleutel}`).then(() => { setKopie(true); setTimeout(() => setKopie(false), 2000); }); }}
              >
                {kopie ? "Gekopieerd ✓" : "Kopieer die hele regel"}
              </button>
              <ol className="kijk-stappen">
                <li>Ga naar <a href="https://claude.ai/code" target="_blank" rel="noreferrer">claude.ai/code</a></li>
                <li>Klik onderin op het wolkje met de naam van je omgeving</li>
                <li>Ga met je muis over die omgeving en klik het tandwieltje</li>
                <li>Plak de regel hierboven in het veld <strong>Environment variables</strong></li>
                <li>Zet <strong>Network access</strong> op <strong>Custom</strong> en voeg <code>pingwin-seo-dashboard.vercel.app</code> toe. Vink ook &ldquo;Also include default list of common package managers&rdquo; aan.</li>
                <li>Opslaan, en dan een <strong>nieuwe</strong> chat openen. Een chat die al openstond blijft de oude waarde gebruiken; dat is normaal, en nooit een reden om nog een sleutel te maken.</li>
              </ol>
            </div>
          )}

          <div className="kijk-knoppen">
            <button type="button" className="btn btn-klein" disabled={bezig} onClick={() => void maak()}>
              {bezig ? "Bezig…" : status?.actief ? "Nieuwe sleutel maken" : "Zet meekijken aan"}
            </button>
            {status?.actief && (
              <button type="button" className="btn btn-klein" disabled={bezig} onClick={() => void trekIn()}>Intrekken</button>
            )}
          </div>
        </div>
      )}
    </Vouwblok>
  );
}
