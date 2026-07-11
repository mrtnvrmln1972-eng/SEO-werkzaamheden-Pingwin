"use client";

import { useCallback, useEffect, useState } from "react";
import HelpHint from "./HelpHint";
import MetaPixelMeter from "./MetaPixelMeter";
import { checkMetaTitle, checkMetaDescription, type MetaCheck } from "../../../../lib/meta-rules";

// Uitklapbare criteria-checklist onder een meta-veld: toont per regel (META-02
// t/m META-15) of de tekst eraan voldoet, met de gemeten waarde erbij.
function MetaChecklist({ kind, text, keyword, other }: { kind: "title" | "desc"; text: string; keyword: string; other: string }) {
  const [open, setOpen] = useState(false);
  const checks: MetaCheck[] = kind === "title"
    ? checkMetaTitle(text, keyword || undefined)
    : checkMetaDescription(text, keyword || undefined, other || undefined);
  const passed = checks.filter((c) => c.pass).length;
  const allOk = passed === checks.length;
  return (
    <div style={{ marginTop: 4 }}>
      <button type="button" onClick={() => setOpen((v) => !v)}
        style={{ border: "none", background: "transparent", cursor: "pointer", padding: 0, font: "inherit", fontSize: 12, color: allOk ? "#2e7d32" : "#b25a00", fontWeight: 600 }}
        title="Bekijk per criterium of deze tekst voldoet (dezelfde regels waarmee de AI schrijft)">
        {open ? "▾" : "▸"} voldoet aan {passed} van {checks.length} criteria
      </button>
      {open && (
        <ul style={{ listStyle: "none", margin: "6px 0 0", padding: 0, display: "grid", gap: 3 }}>
          {checks.map((c) => (
            <li key={c.id} style={{ fontSize: 12.5, display: "flex", gap: 7, alignItems: "baseline" }}>
              <span style={{ color: c.pass ? "#2e7d32" : "#c62828", fontWeight: 700, flex: "0 0 auto" }}>{c.pass ? "✓" : "✗"}</span>
              <span style={{ color: "var(--dark)" }}>{c.label} <span style={{ color: "var(--gray)" }}>({c.waarde})</span></span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// De CTR-machine: werklijst van pagina's waar de meta title/description de
// meeste klikwinst kan opleveren (uit Search Console), met per pagina het
// huidige én het voorgestelde metapaar (metertjes eronder), goedkeuren en
// het gemeten effect zodra de wijziging live staat.

type Effect = { ctrBefore: number; ctrAfter: number; clicksBefore: number; clicksAfter: number; daysAfter: number };
type FieldStatus = "open" | "goedgekeurd" | "afgewezen";
type Proposal = { curTitle: string; curDesc: string; propTitle: string; propDesc: string; status: "open" | "goedgekeurd" | "doorgevoerd" | "afgewezen"; titleStatus: FieldStatus; descStatus: FieldStatus; liveAt: string | null; effect: Effect | null };
type KansRow = { url: string; keyword: string; volume: number | null; clicks: number; impressions: number; ctr: number; expectedCtr: number; position: number; extraClicks: number; proposal: Proposal | null };

function pad(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}

// Beheeromgeving van de website (WordPress-standaard). De login regelt de browser
// van de gebruiker zelf; het dashboard kent geen site-wachtwoorden.
function adminUrl(url: string): string {
  try { return new URL(url).origin + "/wp-admin/"; } catch { return ""; }
}

const STATUS_LABEL: Record<string, { txt: string; bg: string; fg: string }> = {
  open: { txt: "voorstel klaar", bg: "#fff3e6", fg: "#b25a00" },
  goedgekeurd: { txt: "goedgekeurd, wacht op site", bg: "#e8f1fb", fg: "#1a5da6" },
  doorgevoerd: { txt: "live", bg: "#ecf7ee", fg: "#2e7d32" },
  afgewezen: { txt: "afgewezen", bg: "#f2f2f2", fg: "#777" },
};

export default function MetaCtrPanel({ slug, backendUrl, onOpenPage }: { slug: string; backendUrl?: string | null; onOpenPage?: (url: string) => void }) {
  const [rows, setRows] = useState<KansRow[] | null>(null);
  const [error, setError] = useState("");
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  // Inlogpagina van de website-beheeromgeving (per klant instelbaar; leeg = /wp-admin/).
  const [beheerUrl, setBeheerUrl] = useState(backendUrl || "");
  const [beheerEdit, setBeheerEdit] = useState(false);

  async function saveBeheerUrl(value: string) {
    setBeheerUrl(value.trim());
    setBeheerEdit(false);
    await fetch("/api/admin/clients", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, action: "setBackendUrl", backendUrl: value.trim() }),
    }).catch(() => {});
  }

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/admin/meta-ctr?slug=${encodeURIComponent(slug)}`);
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Laden mislukte.");
      setRows(d.rows as KansRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukte.");
      setRows([]);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  async function generate(r: KansRow) {
    setBusy(r.url);
    setError("");
    try {
      const res = await fetch("/api/admin/meta-ctr", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url: r.url, keyword: r.keyword, base: { ctr: r.ctr, position: r.position, impressions: r.impressions } }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Genereren mislukte.");
      setRows((cur) => (cur || []).map((x) => x.url === r.url ? { ...x, proposal: { curTitle: d.curTitle, curDesc: d.curDesc, propTitle: d.propTitle, propDesc: d.propDesc, status: "open", titleStatus: "open", descStatus: "open", liveAt: null, effect: null } } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Genereren mislukte.");
    } finally {
      setBusy(null);
    }
  }

  // Eén veld (titel of beschrijving) opnieuw laten schrijven.
  async function regenField(r: KansRow, field: "title" | "desc") {
    setBusy(`${r.url}|${field}`);
    setError("");
    try {
      const res = await fetch("/api/admin/meta-ctr", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url: r.url, field }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Genereren mislukte.");
      setLocal(r.url, (p) => field === "title"
        ? { ...p, propTitle: d.propTitle, titleStatus: "open" }
        : { ...p, propDesc: d.propDesc, descStatus: "open" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Genereren mislukte.");
    } finally {
      setBusy(null);
    }
  }

  async function patch(url: string, fields: { propTitle?: string; propDesc?: string; status?: Proposal["status"]; titleStatus?: FieldStatus; descStatus?: FieldStatus }) {
    await fetch("/api/admin/meta-ctr", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, url, ...fields }),
    }).catch(() => {});
  }

  // Totaalstatus afleiden uit de twee veld-statussen (zelfde regel als de server):
  // goedgekeurd zodra minstens één veld goedgekeurd is en niets meer open staat.
  function derive(p: Proposal): Proposal {
    if (p.status === "doorgevoerd") return p;
    const t = p.titleStatus, d = p.descStatus;
    const status: Proposal["status"] = t === "afgewezen" && d === "afgewezen" ? "afgewezen"
      : (t === "goedgekeurd" || d === "goedgekeurd") && t !== "open" && d !== "open" ? "goedgekeurd" : "open";
    return { ...p, status };
  }

  function setLocal(url: string, fn: (p: Proposal) => Proposal) {
    setRows((cur) => (cur || []).map((x) => x.url === url && x.proposal ? { ...x, proposal: derive(fn(x.proposal)) } : x));
  }

  // Een veld telt als goedgekeurd zodra het zelf goedgekeurd is, of de hele
  // pagina al live staat (doorgevoerd).
  const fieldOk = (p: Proposal, f: "title" | "desc") => p.status === "doorgevoerd" ? true : (f === "title" ? p.titleStatus : p.descStatus) === "goedgekeurd";

  async function copyApproved() {
    const approved = (rows || []).filter((r) => r.proposal && (fieldOk(r.proposal, "title") || fieldOk(r.proposal, "desc")));
    if (!approved.length) return;
    const text = approved.map((r) => [
      `Pagina: ${r.url}`,
      fieldOk(r.proposal!, "title") ? `Nieuwe paginatitel (meta title): ${r.proposal!.propTitle}` : "",
      fieldOk(r.proposal!, "desc") ? `Nieuwe meta description: ${r.proposal!.propDesc}` : "",
    ].filter(Boolean).join("\n")).join("\n\n");
    await navigator.clipboard.writeText(`Nieuwe meta-teksten (graag 1-op-1 overnemen in de website):\n\n${text}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const approvedCount = (rows || []).filter((r) => r.proposal && (fieldOk(r.proposal, "title") || fieldOk(r.proposal, "desc"))).length;

  return (
    <div className="cockpit-card">
      <div className="wz-title">
        Meta &amp; CTR
        <HelpHint xl title="De CTR-machine: meer klikken zonder hoger te staan" text={"De paginatitel en meta-beschrijving zijn de advertentie van elke pagina in Google: zij bepalen of de zoeker op jouw klant klikt of op de concurrent eronder. Deze machine zoekt de pagina's waar dat mis gaat (**veel vertoond, te weinig geklikt**) en schrijft daar een bewezen betere invulling voor. Dat is de goedkoopste verkeersgroei die er bestaat: de positie hoeft niet te stijgen, alleen de klikkans. En juist nu AI-antwoorden bovenin steeds meer klikken afsnoepen, telt elke resterende vertoning zwaarder; je snippet moet iets bieden dat zo'n samenvatting niet geeft (een prijs, een plaatsnaam, bewijs, actualiteit).\n## Hoe de kansenlijst rekent\n- De basis is **Search Console over 90 dagen**: per pagina de vertoningen, klikken, klikkans (CTR) en gemiddelde positie, plus het beste zoekwoord.\n- Voor elke positie is uit grote klikstudies bekend welke CTR **normaal** is (positie 1 rond 25%, positie 5 rond 5%, positie 10 rond 2%, daarbuiten rap minder). Wij rekenen bewust conservatief, zodat er geen kansen worden verzonnen.\n- **Gemiste klikken** = vertoningen x het gat tussen die verwachte klikkans en de echte. Een pagina met 100.000 vertoningen die 0,4% haalt waar 4% normaal is, laat duizenden bezoekers per kwartaal liggen; die staat dus bovenaan.\n- Pagina's met te weinig vertoningen of een verwaarloosbaar gat blijven buiten de lijst: daar valt niets te winnen.\n## Waarom we pixels meten en geen tekens tellen\nGoogle kapt titels en beschrijvingen niet af op een aantal tekens maar op **beeldbreedte**: een 'W' is ruim vier keer zo breed als een 'i'. Twee titels van precies 60 tekens kunnen dus verschillend afbreken. Daarom rekent het dashboard de breedte exact na in het lettertype van de zoekresultaten (Arial) en toetst tegen de echte grenzen: titel maximaal ~580 pixels, beschrijving maximaal ~920. De metertjes onder elk veld laten dat live zien terwijl je typt: __groen is passend, oranje is krap of onbenut, rood wordt afgekapt__. Mobiel is strenger: daar overleeft van de beschrijving grofweg alleen de eerste 120 tekens, dus daar moet de kern staan.\n## Wat er in een perfecte titel zit (en wat het onderzoek zegt)\n- **Het zoekwoord vooraan**, in de eerste drie à vier woorden. Zo blijft het zichtbaar bij afkappen en herkent de zoeker in één oogopslag dat dit zijn antwoord is.\n- **40 tot 60 tekens.** Titels in die lengte krijgen gemiddeld 8,9% meer klikken (Backlinko, 4 miljoen zoekresultaten) en worden het minst vaak door Google herschreven; boven de 70 tekens wordt vrijwel elke titel (99,9%) aangepast.\n- **Herschrijven is het echte gevaar:** Google herschrijft 62% van alle titels (Zyppy, 81.000 titels). Alles hieronder verkleint die kans, zodat jouw zorgvuldig gekozen tekst ook echt getoond wordt.\n- **Koppelteken in plaats van pijp.** Titels met een pijp (|) worden twee keer zo vaak herschreven als titels met een koppelteken (41% tegenover 19,7%). Daarom eindigen onze titels op '... - Merknaam'.\n- **Aansluiten op de paginakop (H1).** Dit is de sterkste enkele factor tegen herschrijven: als titel en kop dezelfde kernwoorden delen, vertrouwt Google de titel. Woordelijk identiek hoeft niet; de kop mag voluit, de titel compact.\n- **Nooit vierkante haken:** [zo'n toevoeging] wordt in 78% van de gevallen door Google verwijderd of herschreven. (Gewone haakjes) mogen wel, bijvoorbeeld (2026).\n- **Cijfers en jaartallen werken**, mits eerlijk: koppen met een getal halen tot 36% meer klikken, en oneven getallen doen het zo'n 20% beter dan even (HubSpot/Outbrain, 3,3 miljoen koppen). Een jaartal alleen als de inhoud echt actueel wordt gehouden.\n- **Schreeuwwoorden kosten juist klikken:** titels vol termen als 'ultiem' of 'beste ooit' scoren 13,9% sléchter; lezers herkennen clickbait. Een rustige, positieve toon levert daarentegen ~4% extra op ten opzichte van neutraal.\n- **De merknaam achteraan**, en weglaten mag zodra hij niet meer past: Google toont de sitenaam tegenwoordig toch al boven elke titel, dus die pixels kun je beter aan de boodschap besteden.\n## Wat er in een perfecte beschrijving zit\n- Een goed geschreven meta-beschrijving levert gemiddeld **5,8% meer klikken** op dan geen of een slechte; met een duidelijke uitnodiging kan het verschil oplopen tot 20%.\n- **Het zoekwoord er één keer letterlijk in**: Google drukt de zoekterm vet in de beschrijving, en die vetgedrukte woorden trekken het oog. Twee keer mag nog; drie keer leest als spam.\n- **De kern in de eerste 120 tekens**, want daar kapt mobiel af; de meeste zoekers zien de rest nooit.\n- **Eén actieve uitnodiging** (Ontdek, Bekijk, Vergelijk, Plan, Bereken, Vraag aan) plus **minstens één concreet feit**: een getal, prijs, termijn of garantie. 'Binnen 24 uur geregeld' verslaat 'snelle service' elke dag.\n- **Een echte samenvatting van de pagina.** Google vervangt zo'n 63% van de beschrijvingen door eigen fragmenten; hoe beter de tekst de daadwerkelijke inhoud en de zoekvraag dekt, hoe vaker jouw versie blijft staan.\n- Geen letterlijke herhaling van de titel: dat is dubbel vertoonde ruimte die niets toevoegt.\n## Hoe het voorstel tot stand komt\n- De AI leest de **echte pagina** (kop, onderwerpen, huidige meta's) en schrijft het voorstel met alle bovenstaande regels als harde instructie, in de **tone of voice uit het klantprofiel**; het klinkt dus als dit bedrijf, niet als een tekstrobot.\n- Omdat een taalmodel zelf geen pixels kan meten, wordt elk voorstel **na het schrijven nagemeten**. Is het te breed, of staat er toch een pijp of vierkante haak in, dan wordt precies die ene regel gericht herschreven tot hij past; de beste versie wint.\n- Jij houdt de regie: pas de tekst gewoon aan in het veld, de metertjes rekenen live mee, en elke wijziging wordt bewaard.\n## Van goedkeuring tot zwart-op-wit bewijs\n- **Goedkeuren** zet de tekst klaar; met de kopieerknop bovenaan pak je alle goedgekeurde teksten in één keer als nette lijst voor de sitebouwer of de klant.\n- **Live-detectie:** het dashboard leest de pagina's met goedgekeurde teksten periodiek na en ziet vanzelf wanneer de nieuwe tekst op de site staat; de status springt dan op 'live', met datum.\n- **Effectmeting:** vanaf dat moment vergelijkt het dashboard de klikkans in Search Console vóór en ná (de 28 dagen voor de wijziging tegenover alles erna, met een paar dagen marge rond het omzetmoment). Na een week of twee staat er bij de pagina bijvoorbeeld 'klikkans van 0,4% naar 1,1%': hetzelfde aantal vertoningen, bijna drie keer zoveel bezoekers, zonder één positie te stijgen."} />
      </div>
      <p className="wz-item-sub" style={{ maxWidth: 720 }}>
        Pagina&rsquo;s met veel vertoningen maar te weinig klikken voor hun positie (laatste 90 dagen). Betere meta-teksten = direct meer bezoekers.
      </p>
      <div className="org-actions" style={{ margin: "10px 0" }}>
        <button type="button" className="primary-btn small" onClick={copyApproved} disabled={!approvedCount}>
          {copied ? "Gekopieerd!" : `Kopieer goedgekeurde meta's (${approvedCount})`}
        </button>
        <button type="button" className="ghost-btn small" onClick={() => { setRows(null); void load(); }}>Vernieuwen</button>
        {beheerEdit ? (
          <input
            autoFocus
            defaultValue={beheerUrl}
            placeholder="https://voorbeeld.nl/wp-admin/"
            onBlur={(e) => void saveBeheerUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") void saveBeheerUrl((e.target as HTMLInputElement).value); if (e.key === "Escape") setBeheerEdit(false); }}
            style={{ minWidth: 320, padding: "5px 10px", border: "1px solid var(--border)", borderRadius: 8, font: "inherit", fontSize: 12.5 }}
            aria-label="Inlogpagina van de website-beheeromgeving"
          />
        ) : (
          <button type="button" className="ghost-btn small" onClick={() => setBeheerEdit(true)}
            title={beheerUrl ? `Inlogpagina: ${beheerUrl} (klik om te wijzigen)` : "Stel de inlogpagina van de website-beheeromgeving in (voor de 'Open in site'-knop). Leeg = /wp-admin/ achter het domein."}>
            {beheerUrl ? "Inlogpagina ingesteld ✓" : "Inlogpagina instellen"}
          </button>
        )}
      </div>
      {error && <p className="wz-item-sub" style={{ color: "#c62828" }}>{error}</p>}
      {rows === null && <p className="wz-item-sub">Kansen berekenen uit Search Console&hellip;</p>}
      {rows !== null && rows.length === 0 && !error && <p className="wz-item-sub">Geen duidelijke CTR-kansen gevonden (of Search Console heeft nog geen data voor deze klant).</p>}
      <div className="wz-list">
        {(rows || []).map((r) => {
          const open = openUrl === r.url;
          const st = r.proposal ? STATUS_LABEL[r.proposal.status] : null;
          return (
            <div key={r.url} className="wz-item-wrap" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <div role="button" tabIndex={0} className="wz-item" onClick={() => setOpenUrl(open ? null : r.url)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpenUrl(open ? null : r.url); } }}>
                <span style={{ minWidth: 0 }}>
                  {/* De slug is altijd een echte link naar de live pagina. */}
                  <a className="wz-item-title" href={r.url} target="_blank" rel="noreferrer" title="Open de pagina op de website"
                    onClick={(e) => e.stopPropagation()} style={{ color: "var(--orange)", textDecoration: "underline" }}>{pad(r.url)}</a>
                  <span className="wz-item-sub" style={{ display: "block" }}>
                    {r.keyword ? <>zoekwoord &ldquo;{r.keyword}&rdquo;{r.volume !== null ? <> ({r.volume.toLocaleString("nl-NL")} zoekopdrachten p/mnd)</> : null} &middot; </> : null}
                    positie {r.position} &middot; {r.impressions.toLocaleString("nl-NL")} vertoningen &middot; CTR {r.ctr}% (verwacht {r.expectedCtr}%)
                  </span>
                </span>
                <span className="wz-item-date" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {st && <span style={{ background: st.bg, color: st.fg, borderRadius: 20, padding: "2px 10px", fontSize: 11.5, fontWeight: 600 }}>{st.txt}</span>}
                  {r.extraClicks > 0 && <span title="Geschatte extra klikken per 90 dagen bij een normale klikkans">+{r.extraClicks} klikken mogelijk</span>}
                  {onOpenPage && (
                    <button type="button" className="ghost-btn small"
                      title="Open deze pagina in het Pagina's-tabblad (strategie, copy, verbeterstappen)"
                      onClick={(e) => { e.stopPropagation(); onOpenPage(r.url); }}>Open in Pagina&rsquo;s</button>
                  )}
                  {(beheerUrl || adminUrl(r.url)) && (
                    <a className="ghost-btn small" href={beheerUrl || adminUrl(r.url)} target="_blank" rel="noreferrer"
                      title="Open de beheeromgeving van de website (inloggen gaat via je eigen browser)"
                      onClick={(e) => e.stopPropagation()}>Open in site</a>
                  )}
                  <span>{open ? "▾" : "▸"}</span>
                </span>
              </div>
              {open && (
                <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "14px", background: "#fff" }}>
                  {!r.proposal && (
                    <button type="button" className="primary-btn small" onClick={() => void generate(r)} disabled={busy === r.url}>
                      {busy === r.url ? "Voorstel schrijven…" : "Genereer voorstel (AI)"}
                    </button>
                  )}
                  {r.proposal && (
                    <div style={{ display: "grid", gap: 16 }}>
                      <div>
                        <div className="wz-block-head">Huidig op de site</div>
                        <div className="wz-line removed"><span className="wz-line-label">Meta-titel:</span> {r.proposal.curTitle || "(geen paginatitel gevonden)"}<MetaPixelMeter kind="meta_title" text={r.proposal.curTitle} /></div>
                        <div className="wz-line removed"><span className="wz-line-label">Meta-beschrijving:</span> {r.proposal.curDesc || "(geen meta-beschrijving gevonden)"}<MetaPixelMeter kind="meta_description" text={r.proposal.curDesc} /></div>
                      </div>
                      <div>
                        <div className="wz-block-head">Voorstel (aanpasbaar)</div>
                        <div className="wz-line added">
                          <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                            <span className="wz-line-label">
                              Meta-titel:
                              {r.proposal.titleStatus !== "open" && r.proposal.status !== "doorgevoerd" && (
                                <span style={{ marginLeft: 6, background: STATUS_LABEL[r.proposal.titleStatus].bg, color: STATUS_LABEL[r.proposal.titleStatus].fg, borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{r.proposal.titleStatus}</span>
                              )}
                            </span>
                            <input
                              value={r.proposal.propTitle}
                              onChange={(e) => setLocal(r.url, (p) => ({ ...p, propTitle: e.target.value }))}
                              onBlur={(e) => void patch(r.url, { propTitle: e.target.value })}
                              style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", font: "inherit", outline: "none" }}
                              aria-label="Voorgestelde paginatitel"
                            />
                          </div>
                          <MetaPixelMeter kind="meta_title" text={r.proposal.propTitle} />
                          <MetaChecklist kind="title" text={r.proposal.propTitle} keyword={r.keyword} other={r.proposal.propDesc} />
                        </div>
                        {r.proposal.status !== "doorgevoerd" && (
                          <div className="org-actions" style={{ margin: "6px 0 12px" }}>
                            {r.proposal.titleStatus !== "goedgekeurd" ? (
                              <button type="button" className="primary-btn small" onClick={() => { setLocal(r.url, (p) => ({ ...p, titleStatus: "goedgekeurd" })); void patch(r.url, { titleStatus: "goedgekeurd" }); }}>Goedkeuren</button>
                            ) : (
                              <button type="button" className="ghost-btn small" onClick={() => { setLocal(r.url, (p) => ({ ...p, titleStatus: "open" })); void patch(r.url, { titleStatus: "open" }); }}>Goedkeuring intrekken</button>
                            )}
                            <button type="button" className="ghost-btn small" onClick={() => void regenField(r, "title")} disabled={busy === `${r.url}|title`}>{busy === `${r.url}|title` ? "Schrijven…" : "Opnieuw genereren"}</button>
                            {r.proposal.titleStatus !== "afgewezen" && (
                              <button type="button" className="ghost-btn small" onClick={() => { setLocal(r.url, (p) => ({ ...p, titleStatus: "afgewezen" })); void patch(r.url, { titleStatus: "afgewezen" }); }}>Afwijzen</button>
                            )}
                          </div>
                        )}
                        <div className="wz-line added">
                          <div style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
                            <span className="wz-line-label">
                              Meta-beschrijving:
                              {r.proposal.descStatus !== "open" && r.proposal.status !== "doorgevoerd" && (
                                <span style={{ marginLeft: 6, background: STATUS_LABEL[r.proposal.descStatus].bg, color: STATUS_LABEL[r.proposal.descStatus].fg, borderRadius: 20, padding: "1px 8px", fontSize: 11, fontWeight: 600 }}>{r.proposal.descStatus}</span>
                              )}
                            </span>
                            <textarea
                              value={r.proposal.propDesc}
                              onChange={(e) => setLocal(r.url, (p) => ({ ...p, propDesc: e.target.value }))}
                              onBlur={(e) => void patch(r.url, { propDesc: e.target.value })}
                              rows={2}
                              style={{ flex: 1, minWidth: 0, border: "none", background: "transparent", font: "inherit", outline: "none", resize: "vertical" }}
                              aria-label="Voorgestelde meta-beschrijving"
                            />
                          </div>
                          <MetaPixelMeter kind="meta_description" text={r.proposal.propDesc} />
                          <MetaChecklist kind="desc" text={r.proposal.propDesc} keyword={r.keyword} other={r.proposal.propTitle} />
                        </div>
                        {r.proposal.status !== "doorgevoerd" && (
                          <div className="org-actions" style={{ margin: "6px 0 0" }}>
                            {r.proposal.descStatus !== "goedgekeurd" ? (
                              <button type="button" className="primary-btn small" onClick={() => { setLocal(r.url, (p) => ({ ...p, descStatus: "goedgekeurd" })); void patch(r.url, { descStatus: "goedgekeurd" }); }}>Goedkeuren</button>
                            ) : (
                              <button type="button" className="ghost-btn small" onClick={() => { setLocal(r.url, (p) => ({ ...p, descStatus: "open" })); void patch(r.url, { descStatus: "open" }); }}>Goedkeuring intrekken</button>
                            )}
                            <button type="button" className="ghost-btn small" onClick={() => void regenField(r, "desc")} disabled={busy === `${r.url}|desc`}>{busy === `${r.url}|desc` ? "Schrijven…" : "Opnieuw genereren"}</button>
                            {r.proposal.descStatus !== "afgewezen" && (
                              <button type="button" className="ghost-btn small" onClick={() => { setLocal(r.url, (p) => ({ ...p, descStatus: "afgewezen" })); void patch(r.url, { descStatus: "afgewezen" }); }}>Afwijzen</button>
                            )}
                          </div>
                        )}
                      </div>
                      {r.proposal.status === "doorgevoerd" && (
                        <div>
                          <div className="wz-block-head">Effect</div>
                          {r.proposal.effect ? (
                            <p className="wz-item-sub" style={{ color: "var(--dark)" }}>
                              Live sinds {r.proposal.liveAt ? new Date(r.proposal.liveAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long" }) : "?"}:
                              {" "}klikkans van <strong>{r.proposal.effect.ctrBefore}%</strong> naar <strong>{r.proposal.effect.ctrAfter}%</strong>
                              {" "}({r.proposal.effect.clicksBefore} &rarr; {r.proposal.effect.clicksAfter} klikken, gemeten over {r.proposal.effect.daysAfter} dagen).
                            </p>
                          ) : (
                            <p className="wz-item-sub">De nieuwe tekst staat live; het effect wordt gemeten zodra er genoeg dagen Search Console-data zijn (reken op 1 à 2 weken).</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
