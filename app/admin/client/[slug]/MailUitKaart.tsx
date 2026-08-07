"use client";

// ═══════════════════════════════════════════════════════════
// MAIL VANUIT EEN PROJECTKAART
// ═══════════════════════════════════════════════════════════
// Dit venster hing vast in het weekplanning-blok van het tabblad Taken. Op de
// nieuwe planning deed de Mail-knop van dezelfde kaart daardoor niets: het was
// wél dezelfde kaart, maar het venster stond er niet omheen. Een knop die op het
// ene scherm werkt en op het andere stil niets doet is precies het soort stille
// fout waar we van af willen.
//
// Daarom staat het venster nu op zichzelf en gebruiken beide schermen hem. Wat
// het doet: de ontvanger kiezen (klant, developer of een ander adres), kiezen
// welke documenten meegaan, de assistent laten schrijven of zelf typen, en
// versturen via Microsoft 365. Je concept blijft bewaard als je tussendoor
// sluit.

import { useEffect, useRef, useState } from "react";
import { herzetAanhef } from "../../../../lib/aanhef";
import { mailUitTekst } from "../../../../lib/mail-uit-gesprek";
import { type WpTask, type WpPageInfo } from "./WeekplanCard";

function shortUrl(url: string): string { try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; } }

type Doelgroep = "klant" | "dev" | "anders";
type Concept = { aud: Doelgroep; to: string; onderwerp: string; tekst: string; instr: string; links: Record<string, boolean> };

export default function MailUitKaart({
  slug, t, page, startAud, clientName, clientEmail, onClose,
}: {
  slug: string;
  t: WpTask;
  page?: WpPageInfo;
  startAud: Doelgroep;
  clientName?: string;
  clientEmail?: string;
  onClose: () => void;
}) {
  const [aud, setAud] = useState<Doelgroep>(startAud);
  const [to, setTo] = useState("");
  const [instr, setInstr] = useState("");
  const [links, setLinks] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [onderwerp, setOnderwerp] = useState("");
  const [verzendt, setVerzendt] = useState(false);
  const [klaar, setKlaar] = useState("");
  // Herinnering om zelf achter een reactie aan te gaan. Uit tenzij je hem aanzet;
  // zeven dagen is de gebruikelijke termijn en blijft aanpasbaar.
  const [herinner, setHerinner] = useState(false);
  const [herinnerDagen, setHerinnerDagen] = useState(7);
  const ref = useRef<HTMLDivElement>(null);
  // Alle documenten die bij de pagina van deze kaart horen, inclusief de teksten
  // die de klant terugstuurde. De kaart zelf kent alleen analyse, blauwdruk en
  // copy, dus juist de herziene versie kon je anders niet meesturen.
  const [docs, setDocs] = useState<{ label: string; url: string }[]>([]);

  const conceptSleutel = `pingwin-mailconcept-${slug}-${t.id}`;
  function bewaarConcept() {
    try {
      const c: Concept = { aud, to, onderwerp, tekst: ref.current?.innerText || "", instr, links };
      if (!c.tekst.trim() && !c.onderwerp.trim()) return;
      localStorage.setItem(conceptSleutel, JSON.stringify(c));
    } catch { /* zonder opslag is het concept alleen deze sessie */ }
  }
  function wisConcept() {
    try { localStorage.removeItem(conceptSleutel); } catch { /* niets */ }
  }

  // Openen: de documentenlijst ophalen, en beginnen bij het concept dat er nog
  // lag. Was er niets, dan bij de mail die al in de kaarttekst stond, en anders
  // leeg. Geen automatische tekst: Maarten dicteert zijn mails en moest een
  // standaardtekst eerst weggooien.
  useEffect(() => {
    if (t.url) {
      fetch(`/api/admin/weekplan/dev?slug=${encodeURIComponent(slug)}&id=${t.id}`)
        .then((r) => r.json())
        .then((d) => { if (d?.ok && Array.isArray(d.docs)) setDocs(d.docs); })
        .catch(() => {});
    }
    let c: Concept | null = null;
    try { const s = localStorage.getItem(conceptSleutel); c = s ? JSON.parse(s) as Concept : null; } catch { c = null; }
    if (c) {
      setAud(c.aud); setTo(c.to); setOnderwerp(c.onderwerp);
      setInstr(c.instr || ""); setLinks(c.links || {});
      setTimeout(() => { if (ref.current) ref.current.innerText = c!.tekst || ""; }, 0);
      return;
    }
    // De pagina staat standaard aangevinkt: bij elke mail hierover wil je weten
    // om wélke pagina het gaat, en die link overtypen was precies het werk dat
    // dit venster moest wegnemen.
    setLinks(t.url ? { pagina: true } : {});
    let devTo = ""; try { devTo = localStorage.getItem("pingwin-dev-email") || ""; } catch { /* geen opslag */ }
    setTo(startAud === "klant" ? (clientEmail || "") : startAud === "dev" ? devTo : "");
    const concept = mailUitTekst((t.toelichting || "").replace(/<[^>]*>/g, ""));
    if (concept) {
      if (concept.onderwerp) setOnderwerp(concept.onderwerp);
      setTimeout(() => { if (ref.current) ref.current.innerText = concept.body; }, 0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, t.id]);

  // Alles wat je vanuit deze kaart kunt meesturen, inclusief de pagina zelf: de
  // developer moet weten wáár de tekst naartoe moet.
  function docLinks(): { key: string; label: string; url: string }[] {
    const uit: { key: string; label: string; url: string }[] = [];
    const gezien = new Set<string>();
    const voegToe = (key: string, label: string, url: string) => {
      const u = (url || "").trim();
      if (!u || gezien.has(u)) return;
      gezien.add(u);
      uit.push({ key, label, url: u });
    };
    if (t.url) voegToe("pagina", "De pagina", t.url);
    for (const d of docs) voegToe(d.url, d.label, d.url);
    if (page?.links.copy || t.copyUrl) voegToe("copy", "Copy-doc", page?.links.copy || t.copyUrl);
    if (page?.links.blauwdruk) voegToe("blauwdruk", "Blauwdruk-doc", page.links.blauwdruk);
    if (page?.links.analyse) voegToe("analyse", "Analyse-doc", page.links.analyse);
    return uit;
  }

  function sluit() { bewaarConcept(); onClose(); }

  async function schrijf(gekozen: Record<string, boolean>, adres: string) {
    setBusy(true); setErr("");
    if (ref.current) ref.current.innerText = "";
    const mee = docLinks().filter((l) => gekozen[l.key]).map((l) => ({ label: l.label, url: l.url }));
    try {
      const d = await fetch("/api/admin/task/explain", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, taak: t.taak, toelichting: t.toelichting, url: t.url, audience: aud, instructie: instr, links: mee, to: adres }),
      }).then((r) => r.json());
      if (d?.ok && d.text) {
        // De onderwerpregel hoort niet in de body maar in een eigen veld: zo zie
        // je hem meteen en wordt hij ook echt het onderwerp van de mail.
        const regels = String(d.text).split("\n");
        const m = /^\s*onderwerp\s*:\s*(.+)$/i.exec(regels[0] || "");
        if (m) { setOnderwerp(m[1].trim()); regels.shift(); while (regels[0] !== undefined && !regels[0].trim()) regels.shift(); }
        else setOnderwerp("");
        if (ref.current) ref.current.innerText = regels.join("\n").trim();
      } else setErr(d?.error || "Uitleg maken mislukt.");
    } catch { setErr("De assistent is niet bereikbaar."); } finally { setBusy(false); }
  }

  function kopieer() {
    const tekst = (ref.current?.innerText || "").trim();
    if (tekst) navigator.clipboard?.writeText(tekst).catch(() => {});
  }

  // Verstuurt de mail echt, via Microsoft 365. Een mailto-link met een lange
  // tekst plus een volledige Google Docs-URL wordt zo lang dat browsers hem stil
  // laten vallen; dan klik je en gebeurt er niets.
  async function verstuur() {
    const tekst = (ref.current?.innerText || "").trim();
    if (!tekst || verzendt) return;
    const adres = to.trim();
    if (!adres) { setErr("Vul eerst het e-mailadres van de ontvanger in."); return; }
    if (aud === "dev") { try { localStorage.setItem("pingwin-dev-email", adres); } catch { /* geen opslag */ } }
    const ond = onderwerp.trim() || `SEO-taak${t.url ? ` — ${shortUrl(t.url)}` : ""}`;
    const mee = docLinks().filter((l) => links[l.key]).map((l) => ({ label: l.label, url: l.url }));
    setVerzendt(true); setErr("");
    try {
      const d = await fetch("/api/admin/task/mail", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, to: adres, onderwerp: ond, tekst, links: mee, taak: t.taak, url: t.url,
          herinnerDagen: herinner ? herinnerDagen : 0 }),
      }).then((r) => r.json());
      if (d?.ok) { wisConcept(); setKlaar(d.samenvatting || "Verstuurd."); setTimeout(onClose, 1600); }
      else setErr(d?.error || "Versturen mislukte.");
    } catch { setErr("Versturen mislukte."); }
    finally { setVerzendt(false); }
  }

  const lijst = docLinks();

  return (
    <div className="wp-mail-overlay" onClick={(e) => { if (e.target === e.currentTarget) sluit(); }}>
      <div className="wp-mail-modal">
        <div className="wp-mail-head">
          <span className="wp-mail-title">Mail vanuit deze kaart</span>
          <button type="button" className="wp-icon wp-del" title="Sluiten (je concept blijft bewaard)" onClick={sluit}>×</button>
        </div>
        <div className="wp-mail-sub muted">Over: {t.taak.replace(/<[^>]*>/g, "").trim()}</div>
        <div className="wp-mail-aud">
          {([["klant", `Klant${clientName ? ` (${clientName})` : ""}`], ["dev", "Developer"], ["anders", "Anders"]] as const).map(([k, label]) => (
            <button key={k} type="button" className={"wp-aud-pill" + (aud === k ? " wp-aud-actief" : "")}
              onClick={() => {
                setAud(k);
                let devTo = ""; try { devTo = localStorage.getItem("pingwin-dev-email") || ""; } catch { /* geen opslag */ }
                setTo(k === "klant" ? (clientEmail || "") : k === "dev" ? devTo : "");
                // Bewust geen herschrijving: dat zou ingesproken tekst wissen.
              }}>{label}</button>
          ))}
          {/* Typ je zelf een ander adres, dan verandert de aanhef mee zodra je het
              veld verlaat. Zo verstuur je nooit "Hoi," terwijl er een naam bij hoort. */}
          <input className="wp-mail-to" type="email" value={to} placeholder="E-mailadres ontvanger"
            onChange={(e) => setTo(e.target.value)}
            onBlur={(e) => {
              if (!ref.current) return;
              const nieuw = herzetAanhef(ref.current.innerText || "", e.target.value);
              if (nieuw !== ref.current.innerText) ref.current.innerText = nieuw;
            }} />
        </div>
        {lijst.length > 0 && (
          <div className="wp-mail-links">
            <span className="muted">Meesturen:</span>
            {lijst.map((l) => (
              <label key={l.key} className="wp-mail-linkchip">
                <input type="checkbox" checked={!!links[l.key]} onChange={(e) => setLinks({ ...links, [l.key]: e.target.checked })} />
                {l.label}
              </label>
            ))}
          </div>
        )}
        <div className="wp-mail-instrrij">
          <input className="wp-mail-instr" value={instr} onChange={(e) => setInstr(e.target.value)}
            placeholder="Wat moet er in de mail? (optioneel, bijv. 'leg kort uit waar dit vandaan komt')"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void schrijf(links, to); } }} />
          <button type="button" className="ghost-btn small" disabled={busy}
            title="Laat de assistent de mail opnieuw schrijven (je huidige tekst gaat verloren)"
            onClick={() => { wisConcept(); void schrijf(links, to); }}>Laat Claude schrijven</button>
        </div>
        {err && <div className="login-error wp-mail-fout">{err}</div>}
        {klaar && <div className="wp-mail-klaar">{klaar}</div>}
        <label className="wp-mail-onderwerp">
          <span className="wp-mail-onderwerp-label">Onderwerp</span>
          <input value={onderwerp} onChange={(e) => setOnderwerp(e.target.value)} placeholder="Onderwerp van de mail" />
        </label>
        <div className="wp-mail-edit" contentEditable suppressContentEditableWarning ref={ref}
          data-placeholder="De mail verschijnt hier…" style={{ opacity: busy ? 0.5 : 1 }} onBlur={bewaarConcept} />
        {busy && <div className="muted" style={{ marginTop: "var(--s-2)" }}>Mail aan het schrijven…</div>}
        <div className="wp-mail-foot">
          {/* Na het versturen is het stil: kwam er antwoord, en is het ook echt
              gedaan? Dat onthouden is handwerk, en handwerk wordt vergeten. */}
          <label className="wp-mail-herinner" title="Op die dag verschijnt er een melding bij het belletje in de kopbalk">
            <input type="checkbox" checked={herinner} onChange={(e) => setHerinner(e.target.checked)} />
            <span>Herinner me over</span>
            <input type="number" min={1} max={90} value={herinnerDagen} disabled={!herinner}
              onChange={(e) => setHerinnerDagen(Math.min(90, Math.max(1, Number(e.target.value) || 1)))} />
            <span>dagen om te checken</span>
          </label>
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
