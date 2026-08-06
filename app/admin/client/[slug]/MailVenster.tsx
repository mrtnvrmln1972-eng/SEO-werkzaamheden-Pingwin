"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { herzetAanhef } from "../../../../lib/aanhef";
import { mailUitTekst, zonderControleblok } from "../../../../lib/mail-uit-gesprek";
import { analyseNaarMailHtml, htmlNaarMailHtml } from "../../../../lib/mail-opmaak";
import { mdToHtml } from "../../../../lib/markdown";
import { striptVulzinnen } from "../../../../lib/vulzinnen";

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
  slug, titel, onderwerpVan, onderwerpVoorstel, taak, toelichting, mailBron, blokMd, siteUrl, url, bijlagen = [], clientName, clientEmail, standaardAangevinkt = [], onClose,
}: {
  slug: string;
  /** Kop van het venster, bijvoorbeeld "Mail vanuit dit gesprek". */
  titel: string;
  /** De regel "Over: ..." onder de kop. */
  onderwerpVan: string;
  /**
   * Kant-en-klaar onderwerp voor de mail. Wint van het eerste kopje uit het blok.
   * Gebruik dit zodra je iets beters weet dan "Wat we zagen".
   */
  onderwerpVoorstel?: string;
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
  /**
   * Het blok uit het gesprek (ruwe markdown) dat onder jouw intro in de mail komt,
   * netjes opgemaakt met oranje kopjes en kaarten. Leeg = gewoon een mail met
   * alleen jouw eigen tekst, zoals dit venster altijd werkte.
   */
  blokMd?: string;
  /** Domein van de klant, zodat slugs in het blok naar de echte pagina linken. */
  siteUrl?: string;
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
  const concept = useMemo(() => (blokMd ? null : mailUitTekst(mailBron || toelichting || "")), [blokMd, mailBron, toelichting]);
  const [overgenomen, setOvergenomen] = useState(false);

  // Gaat het blok mee? Met blok is dit venster "zet dit blok in een mail": jouw
  // intro bovenin, het blok eronder. Je kunt het blok weglaten als je toch alleen
  // je eigen tekst wilt sturen.
  const [blokAan, setBlokAan] = useState(!!blokMd);
  // Het eerste kopje van het blok als terugval-onderwerp. Dat werkt zolang dat
  // kopje ergens over gaat, maar bij een blok dat opent met "Wat we zagen" komt
  // dát in de onderwerpregel van de klant te staan. Vandaar `onderwerpVoorstel`:
  // een aanroeper die zelf een fatsoenlijk onderwerp kan bedenken, wint.
  const blokKop = useMemo(() => {
    for (const raw of (blokMd || "").split("\n")) {
      const m = /^#{1,3}\s+(.+)$/.exec(raw.trim());
      if (m) return m[1].replace(/[#*]/g, "").trim().slice(0, 120);
    }
    return "";
  }, [blokMd]);
  // Het blok zoals het in de mail komt: bewerkbaar, want de eerste regels van een
  // antwoord zijn vaak intern gepraat dat een klant niet hoeft te lezen. De
  // waarschuwing van de feitencontrole gaat er sowieso af; die is voor Maarten.
  const blokHtml = useMemo(
    () => (blokMd ? mdToHtml(striptVulzinnen(zonderControleblok(blokMd)), siteUrl || "") : ""),
    [blokMd, siteUrl],
  );
  const blokRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (concept && bodyRef.current) {
      bodyRef.current.innerText = concept.body;
      if (concept.onderwerp) setOnderwerp(concept.onderwerp);
      setOvergenomen(true);
    }
    if (onderwerpVoorstel) setOnderwerp(onderwerpVoorstel);
    else if (blokKop) setOnderwerp(blokKop);
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
        // Geen onderwerp in het antwoord? Dan het voorstel terug in plaats van een
        // leeg veld; anders ben je je onderwerp kwijt zodra de assistent schrijft.
        else setOnderwerp(onderwerpVoorstel || "");
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
    const metBlok = !!(blokMd && blokAan);
    if ((!tekst && !metBlok) || verzendt) return;
    const adres = to.trim();
    if (!adres) { setFout("Vul eerst het e-mailadres van de ontvanger in."); return; }
    if (aud === "dev") { try { localStorage.setItem("pingwin-dev-email", adres); } catch { /* geen opslag */ } }
    const links = bijlagen.filter((b) => gekozen[b.key]).map((b) => ({ label: b.label, url: b.url }));
    setVerzendt(true); setFout("");

    // Met blok gaat de mail langs de opgemaakte weg (oranje kopjes, kaarten,
    // nette tabellen), met jouw getypte tekst als intro erboven. Zonder blok
    // blijft alles zoals het was: platte tekst via de bestaande route.
    if (metBlok) {
      try {
        // Wat je in het voorbeeld hebt bijgeschaafd is wat er weggaat.
        const bewerkt = (blokRef.current?.innerHTML || "").trim();
        const opties = {
          intro: tekst || undefined,
          titel: onderwerp.trim() || onderwerpVan.slice(0, 120),
          bron: "Opgesteld in het Pingwin SEO-dashboard.",
          siteUrl: siteUrl || undefined,
          bijlagen: links,
        };
        const html = bewerkt
          ? htmlNaarMailHtml(bewerkt, opties)
          : analyseNaarMailHtml(zonderControleblok(blokMd || ""), opties);
        const d = await fetch("/api/admin/mail", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: "compose", slug, to: adres, subject: onderwerp.trim() || onderwerpVan.slice(0, 120), html }),
        }).then((r) => r.json());
        if (d?.ok) { setKlaar(`Verstuurd naar ${(d.sentTo || []).join(", ") || adres}.`); setTimeout(() => { onClose(); }, 1600); }
        else setFout(d?.error || "Versturen mislukte.");
      } catch { setFout("Versturen mislukte."); }
      finally { setVerzendt(false); }
      return;
    }

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
        {blokMd && blokAan && <div className="wp-mail-bron muted">Jouw tekst komt bovenaan; het blok hieronder gaat er opgemaakt onder.</div>}
        <div
          className="wp-mail-edit"
          contentEditable
          suppressContentEditableWarning
          ref={bodyRef}
          data-placeholder={blokMd && blokAan ? "Typ of dicteer hier je intro, bijvoorbeeld: Beste Paul, we hebben nog eens goed naar de data gekeken…" : "De mail verschijnt hier…"}
          style={{ opacity: busy ? 0.5 : 1 }}
        />
        {blokMd && (
          blokAan ? (
            <div className="wp-mail-blok">
              <div className="wp-mail-blok-kop">
                <span>Dit blok gaat mee &middot; je kunt erin typen en schrappen</span>
                <button type="button" className="wp-mail-leeg" onClick={() => setBlokAan(false)}>blok weglaten</button>
              </div>
              <div
                className="wp-mail-blok-body md"
                contentEditable
                suppressContentEditableWarning
                ref={blokRef}
                dangerouslySetInnerHTML={{ __html: blokHtml }}
              />
            </div>
          ) : (
            <div className="wp-mail-bron muted">
              Het blok gaat niet mee.
              <button type="button" className="wp-mail-leeg" onClick={() => setBlokAan(true)}>toch meesturen</button>
            </div>
          )
        )}
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
