"use client";

import { useEffect, useState } from "react";
import AdminKop from "../AdminKop";
import { sanitizeHtml } from "../../../lib/veilige-html";

type Versie = { id: number; veld: string; html: string; bewaardOp: string };

type VeldSleutel = "html" | "prioHtml" | "koersHtml";
const VELDEN: VeldSleutel[] = ["html", "prioHtml", "koersHtml"];
const VELDNAAM: Record<string, string> = { html: "Overzicht", prioHtml: "Wat we nu oppakken", koersHtml: "De koers" };

// Een korte, leesbare samenvatting van wat er in zo'n bewaarde versie zit, zodat
// je de juiste kunt herkennen zonder alles open te klappen.
function samenvatting(html: string): string {
  const tekst = html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
  return tekst.length > 140 ? `${tekst.slice(0, 140)}…` : tekst || "(leeg)";
}

function wanneer(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function VeldHerstelClient({ klanten }: { klanten: { slug: string; name: string }[] }) {
  const [slug, setSlug] = useState("");
  const [versies, setVersies] = useState<Versie[] | null>(null);
  const [laden, setLaden] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");
  const [fout, setFout] = useState("");
  const [bekijk, setBekijk] = useState<number | null>(null);
  // Voor inhoud die verloren ging vóór er versies bewaard werden: plak hier de
  // teruggevonden tekst. Eenmalig bedoeld, daarom staat het onderaan.
  const [plakVeld, setPlakVeld] = useState<VeldSleutel>("html");
  const [plakTekst, setPlakTekst] = useState("");

  useEffect(() => {
    if (!slug) { setVersies(null); return; }
    let levend = true;
    setLaden(true);
    setMelding("");
    setFout("");
    fetch(`/api/admin/focus-historie?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (levend) setVersies(d?.ok ? (d.versies as Versie[]) : []); })
      .catch(() => { if (levend) setFout("Ophalen van de versies mislukte."); })
      .finally(() => { if (levend) setLaden(false); });
    return () => { levend = false; };
  }, [slug]);

  async function zetTerug(id: number) {
    if (!window.confirm("Deze versie terugzetten? De inhoud die er nu staat wordt zelf ook bewaard, dus je kunt dit weer ongedaan maken.")) return;
    setBezig(true);
    setMelding("");
    setFout("");
    try {
      const d = await fetch("/api/admin/focus-historie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id }),
      }).then((r) => r.json());
      if (d?.ok) {
        setMelding("Teruggezet. Open het veld bij de klant om het te bekijken.");
        const verse = await fetch(`/api/admin/focus-historie?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
        if (verse?.ok) setVersies(verse.versies as Versie[]);
      } else setFout(d?.error || "Terugzetten mislukte.");
    } catch { setFout("Terugzetten mislukte."); }
    finally { setBezig(false); }
  }

  async function zetGeplakteTerug() {
    if (!plakTekst.trim()) return;
    if (!window.confirm("Deze tekst bovenaan het veld zetten? Alles wat er nu staat blijft gewoon staan, eronder.")) return;
    setBezig(true);
    setMelding("");
    setFout("");
    try {
      const d = await fetch("/api/admin/focus-historie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, veld: plakVeld, html: plakTekst }),
      }).then((r) => r.json());
      if (d?.ok) {
        setMelding("Teruggezet. Open het veld bij de klant om het te bekijken.");
        setPlakTekst("");
        const verse = await fetch(`/api/admin/focus-historie?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
        if (verse?.ok) setVersies(verse.versies as Versie[]);
      } else setFout(d?.error || "Terugzetten mislukte.");
    } catch { setFout("Terugzetten mislukte."); }
    finally { setBezig(false); }
  }

  return (
    <>
      <AdminKop titel="Veld terugzetten" />
      <div className="beheer-container">
        <div className="beheer-kop">
          <h1 className="beheer-h1">Een tekstveld terugzetten</h1>
          <p className="beheer-uitleg">
            De velden <strong>Overzicht</strong>, <strong>Wat we nu oppakken</strong> en
            <strong> De koers</strong> slaan tijdens het typen vanzelf op. Sinds 11 augustus 2026 bewaart elke opslag eerst wat er stond, zodat een ongeluk
            nooit meer definitief is. Kies een klant en zet een eerdere versie terug.
          </p>
          <p className="beheer-uitleg">
            Terugzetten bewaart de huidige inhoud óók, dus kies je de verkeerde versie, dan draai je dat gewoon
            weer terug.
          </p>
        </div>

        <div className="beheer-blok">
          <h2 className="beheer-h2">Klant</h2>
          <select className="wp-docdrop-input" value={slug} onChange={(e) => { setSlug(e.target.value); setBekijk(null); }}>
            <option value="">Kies een klant…</option>
            {klanten.map((k) => <option key={k.slug} value={k.slug}>{k.name}</option>)}
          </select>
        </div>

        {fout && <div className="beheer-fout">{fout}</div>}
        {melding && <div className="beheer-ok">{melding}</div>}

        {slug && (
          <div className="beheer-blok">
            <h2 className="beheer-h2">Bewaarde versies</h2>
            {laden && <p className="beheer-uitleg">Bezig met ophalen…</p>}
            {!laden && versies && versies.length === 0 && (
              <p className="beheer-uitleg">
                Nog geen bewaarde versies voor deze klant. Er wordt er één bewaard zodra het veld de eerstvolgende
                keer wijzigt.
              </p>
            )}
            {!laden && versies && versies.length > 0 && (
              <ul className="beheer-lijst">
                {versies.map((v) => (
                  <li key={v.id}>
                    <div className="beheer-veld-kop">
                      <span>
                        <strong>{VELDNAAM[v.veld] || v.veld}</strong>, bewaard op {wanneer(v.bewaardOp)}
                      </span>
                      <span className="pnl-acties-groep">
                        <button type="button" className="btn btn-quiet btn-klein"
                          onClick={() => setBekijk(bekijk === v.id ? null : v.id)}>
                          {bekijk === v.id ? "Verberg" : "Bekijk"}
                        </button>
                        <button type="button" className="btn btn-primary btn-klein" disabled={bezig}
                          onClick={() => void zetTerug(v.id)}>
                          Zet terug
                        </button>
                      </span>
                    </div>
                    <div className="beheer-klein">{samenvatting(v.html)}</div>
                    {bekijk === v.id && (
                      <div className="beheer-lees focus-rich"
                        dangerouslySetInnerHTML={{ __html: sanitizeHtml(v.html) }} />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {slug && (
          <div className="beheer-blok">
            <h2 className="beheer-h2">Zelf een tekst terugzetten</h2>
            <p className="beheer-uitleg">
              Voor inhoud die verdween vóórdat er versies bewaard werden. De geplakte tekst komt <strong>bovenaan
              het veld</strong> te staan; alles wat er nu staat blijft gewoon staan, eronder. Deze handeling kan
              dus zelf nooit iets wissen.
            </p>
            <select className="wp-docdrop-input" value={plakVeld}
              onChange={(e) => setPlakVeld(VELDEN.includes(e.target.value as VeldSleutel) ? (e.target.value as VeldSleutel) : "html")}>
              <option value="html">Overzicht</option>
              <option value="prioHtml">Wat we nu oppakken</option>
              <option value="koersHtml">De koers</option>
            </select>
            <textarea className="beheer-bewerk" rows={6} value={plakTekst} spellCheck={false}
              placeholder="Plak hier de teruggevonden tekst…"
              onChange={(e) => setPlakTekst(e.target.value)} />
            <div className="beheer-knoppen">
              <button type="button" className="btn btn-primary" disabled={bezig || !plakTekst.trim()}
                onClick={() => void zetGeplakteTerug()}>
                {bezig ? "Bezig…" : "Zet deze tekst bovenaan het veld"}
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
