"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { herzetAanhef } from "../../../../lib/aanhef";
import { mailUitTekst } from "../../../../lib/mail-uit-gesprek";

// ═══════════════════════════════════════════════════════════
// HET MAILVENSTER
// ═══════════════════════════════════════════════════════════
// Hetzelfde venster dat je vanaf een weekplan-kaart kent, maar losgetrokken van
// de kaart. Het weet niets van taken of pagina's: je geeft het een onderwerp en
// een achtergrondtekst, en het schrijft daar een mail bij. Zo kan het ook onder
// een bird's eye-antwoord hangen, waar geen kaart is.
//
// De opmaak (contentEditable in plaats van een kale textarea) en de endpoints
// zijn bewust gelijk aan die van de kaart: één mailvenster in het dashboard.
// ═══════════════════════════════════════════════════════════

export type MailBijlage = { key: string; label: string; url: string };

export default function MailVenster({
  slug, titel, onderwerpVan, taak, toelichting, mailBron, url, bijlagen = [], clientName, clientEmail, standaardAangevinkt = [], onClose,
}: {
  slug: string;
  /** Kop van het venster, bijvoorbeeld "Mail vanuit dit gesprek". */
  titel: string;
  /** De regel "Over: ..." onder de kop. */
  onderwerpVan: string;
  /** Waar de mail over gaat (gaat als "taak" naar de assistent). */
  taak: string;
  /** De achtergrond waar de assistent uit put (het gesprek, de analyse). */
  toelichting: string;
  /**
   * De volledige gesprekstekst waarin een al geschreven mail kan staan. Los van
   * `toelichting`, want die is soms ingekort tot alleen de conclusie en juist dan
   * valt de geschreven mail eruit. Leeg = we kijken in `toelichting`.
   */
  mailBron?: string;
  url?: string;
  bijlagen?: MailBijlage[];
  clientName?: string;
  clientEmail?: string;
  /** Welke bijlagen meteen aangevinkt staan (bijvoorbeeld een net gemaakt document). */
  standaardAangevinkt?: string[];
  onClose: () => void;
}) {
  const [aud, setAud] = useState<"klant" | "dev" | "anders">("klant");
  const [to, setTo] = useState(clientEmail || "");
  const [instr, setInstr] = useState("");
  const [gekozen, setGekozen] = useState<Record<string, boolean>>(() => {
    const v: Record<string, boolean> = {};
    for (const k of standaardAangevinkt) v[k] = true;
    return v;
  });
  const [busy, setBusy] = useState(false);
  const [fout, setFout] = useState("");
  const [onderwerp, setOnderwerp] = useState("");
  const [verzendt, setVerzendt] = useState(false);
  const [klaar, setKlaar] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  // Staat er in het gesprek al een geschreven mail, dan begint het venster dáármee.
  // Niet opnieuw geschreven: letterlijk zijn eigen tekst. Herkent hij geen mail
  // (een analyse, een lijstje), dan blijft het vak leeg zoals het was: Maarten
  // dicteert met Wispr Flow en wil geen voorzet die hij eerst moet weggooien.
  const concept = useMemo(() => mailUitTekst(mailBron || toelichting || ""), [mailBron, toelichting]);
  const [overgenomen, setOvergenomen] = useState(false);
  useEffect(() => {
    if (concept && bodyRef.current) {
      bodyRef.current.innerText = concept.body;
      if (concept.onderwerp) setOnderwerp(concept.onderwerp);
      setOvergenomen(true);
    }
    bodyRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function leegmaken() {
    if (bodyRef.current) bodyRef.current.innerText = "";
    setOvergenomen(false);
    bodyRef.current?.focus();
  }

  async function schrijf(
    doelgroep: "klant" | "dev" | "anders",
    instructie: string,
    keuze: Record<string, boolean>,
    adres?: string,
  ) {
    setBusy(true); setFout(""); setOvergenomen(false);
    if (bodyRef.current) bodyRef.current.innerText = "";
    const links = bijlagen.filter((b) => keuze[b.key]).map((b) => ({ label: b.label, url: b.url }));
    try {
      const d = await fetch("/api/admin/task/explain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, taak, toelichting, url, audience: doelgroep, instructie, links, to: adres !== undefined ? adres : to }),
      }).then((r) => r.json());
      if (d?.ok && d.text) {
        // Het onderwerp komt als eerste regel terug; dat hoort in een eigen veld.
        const regels = String(d.text).split("\n");
        const m = /^\s*onderwerp\s*:\s*(.+)$/i.exec(regels[0] || "");
        if (m) { setOnderwerp(m[1].trim()); regels.shift(); while (regels[0] !== undefined && !regels[0].trim()) regels.shift(); }
        else setOnderwerp("");
        if (bodyRef.current) bodyRef.current.innerText = regels.join("\n").trim();
      } else setFout(d?.error || "Mail schrijven mislukt.");
    } catch { setFout("De assistent is niet bereikbaar."); }
    finally { setBusy(false); }
  }

  function kopieer() {
    const t = (bodyRef.current?.innerText || "").trim();
    if (t) navigator.clipboard?.writeText(t).catch(() => {});
  }

  async function verstuur() {
    const tekst = (bodyRef.current?.innerText || "").trim();
    if (!tekst || verzendt) return;
    const adres = to.trim();
    if (!adres) { setFout("Vul eerst het e-mailadres van de ontvanger in."); return; }
    if (aud === "dev") { try { localStorage.setItem("pingwin-dev-email", adres); } catch { /* geen opslag */ } }
    const links = bijlagen.filter((b) => gekozen[b.key]).map((b) => ({ label: b.label, url: b.url }));
    setVerzendt(true); setFout("");
    try {
      const d = await fetch("/api/admin/task/mail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, to: adres, onderwerp: onderwerp.trim() || onderwerpVan.slice(0, 120), tekst, links }),
      }).then((r) => r.json());
      if (d?.ok) { setKlaar(d.samenvatting || "Verstuurd."); setTimeout(() => { onClose(); }, 1600); }
      else setFout(d?.error || "Versturen mislukte.");
    } catch { setFout("Versturen mislukte."); }
    finally { setVerzendt(false); }
  }

  return (
    <div className="wp-mail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="wp-mail-modal">
        <div className="wp-mail-head">
          <span className="wp-mail-title">{titel}</span>
          <button type="button" className="wp-icon wp-del" title="Sluiten" onClick={onClose}>×</button>
        </div>
        <div className="wp-mail-sub muted">Over: {onderwerpVan}</div>
        <div className="wp-mail-aud">
          {([["klant", `Klant${clientName ? ` (${clientName})` : ""}`], ["dev", "Developer"], ["anders", "Anders"]] as const).map(([a, label]) => (
            <button key={a} type="button" className={"wp-aud-pill" + (aud === a ? " wp-aud-actief" : "")}
              onClick={() => {
                setAud(a);
                let devTo = ""; try { devTo = localStorage.getItem("pingwin-dev-email") || ""; } catch { /* geen opslag */ }
                const adres = a === "klant" ? (clientEmail || "") : a === "dev" ? devTo : "";
                setTo(adres);
                // Bewust geen herschrijving: dat zou ingesproken tekst wissen.
              }}>{label}</button>
          ))}
          <input className="wp-mail-to" type="email" value={to} placeholder="E-mailadres ontvanger"
            onChange={(e) => setTo(e.target.value)}
            onBlur={(e) => {
              if (!bodyRef.current) return;
              const nieuw = herzetAanhef(bodyRef.current.innerText || "", e.target.value);
              if (nieuw !== bodyRef.current.innerText) bodyRef.current.innerText = nieuw;
            }} />
        </div>
        {bijlagen.length > 0 && (
          <div className="wp-mail-links">
            <span className="muted">Meesturen:</span>
            {bijlagen.map((b) => (
              <label key={b.key} className="wp-mail-linkchip">
                <input type="checkbox" checked={!!gekozen[b.key]}
                  onChange={(e) => setGekozen({ ...gekozen, [b.key]: e.target.checked })} />
                {b.label}
              </label>
            ))}
          </div>
        )}
        <div className="wp-mail-instrrij">
          <input className="wp-mail-instr" value={instr} onChange={(e) => setInstr(e.target.value)}
            placeholder="Wat moet er in de mail? (optioneel, bijv. 'leg kort uit waarom dit nu belangrijk is')"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void schrijf(aud, instr, gekozen); } }} />
          <button type="button" className="ghost-btn small" disabled={busy} onClick={() => void schrijf(aud, instr, gekozen)}>Laat Claude schrijven</button>
        </div>
        {fout && <div className="login-error wp-mail-fout">{fout}</div>}
        {klaar && <div className="wp-mail-klaar">{klaar}</div>}
        <label className="wp-mail-onderwerp">
          <span className="wp-mail-onderwerp-label">Onderwerp</span>
          <input value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} placeholder="Onderwerp van de mail" />
        </label>
        {overgenomen && (
          <div className="wp-mail-bron muted">
            Overgenomen uit het gesprek
            <button type="button" className="wp-mail-leeg" onClick={leegmaken}>leegmaken</button>
          </div>
        )}
        <div className="wp-mail-edit" contentEditable suppressContentEditableWarning ref={bodyRef} data-placeholder="De mail verschijnt hier…" style={{ opacity: busy ? 0.5 : 1 }} />
        {busy && <div className="muted" style={{ marginTop: 6 }}>Mail aan het schrijven…</div>}
        <div className="wp-mail-foot">
          <button type="button" className="ghost-btn small" onClick={kopieer} disabled={busy}>Kopieer</button>
          <button type="button" className="primary-btn small" onClick={() => void verstuur()} disabled={busy || verzendt}
            title={to ? `Verstuurt de mail nu naar ${to}` : "Vul eerst het e-mailadres van de ontvanger in"}>
            {verzendt ? "Versturen…" : "Versturen"}
          </button>
        </div>
      </div>
    </div>
  );
}
