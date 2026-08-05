"use client";

import { useEffect, useRef, useState } from "react";
import HelpHint from "./HelpHint";
import Kennisbank from "./Kennisbank";
import { ontbrekendeSleutels, LEGE_VESTIGING, type OrgVestiging } from "../../../../lib/org-vereist";

// ═══════════════════════════════════════════════════════════
// BEDRIJFSGEGEVENS (fundament voor structured data)
// ═══════════════════════════════════════════════════════════
// Cockpit-kaart op het Klant-tabblad: automatisch gevuld formulier met de
// organisatiegegevens, deel-link voor de klant, mail-knop en vergrendeling.
// Het kale formulier (OrgDataForm) wordt hergebruikt op de klant-deelpagina.
// ═══════════════════════════════════════════════════════════

export type OrgArts = { naam: string; functie: string; specialisatie: string; big: string; fotoUrl: string; profielUrl: string };
export type OrgDienst = { naam: string; omschrijving: string };
export type OrgFormData = {
  bedrijfsnaam: string; bedrijfstype: string; rechtsvorm: string; kvk: string; btw: string;
  telefoon: string; email: string; straat: string; postcode: string; plaats: string;
  geenBezoekadres: boolean; openingstijden: string; logoUrl: string; priceRange: string;
  oprichtingsjaar: string; sameAs: string[]; areaServed: string[]; reviewUrl: string;
  reviewGemiddelde: string; reviewAantal: string; notitie: string; vestigingen: OrgVestiging[];
  artsen: OrgArts[]; merken: string[]; retourUrl: string; retourTermijn: string; verzendInfo: string; diensten: OrgDienst[];
};

const TYPES: { v: string; label: string }[] = [
  { v: "", label: "— kies het bedrijfstype —" },
  { v: "kliniek", label: "Kliniek / zorg" },
  { v: "webshop", label: "Webshop" },
  { v: "dienstverlener", label: "Dienstverlener / lead-gen (ook aan huis)" },
  { v: "lokaal", label: "Lokaal bedrijf met bezoekadres" },
  { v: "informatief", label: "Informatieve site / anders" },
];

export function OrgDataForm({ data, onChange, disabled }: { data: OrgFormData; onChange: (d: OrgFormData) => void; disabled?: boolean }) {
  const set = (patch: Partial<OrgFormData>) => onChange({ ...data, ...patch });
  // Wat nodig is en nog leeg is, komt in het rood in beeld: het veld blijft dus
  // gewoon zichtbaar en invulbaar, met de melding dat het nog ontbreekt.
  const mist = ontbrekendeSleutels({ ...data, vestigingen: data.vestigingen || [] });
  const zetVestiging = (i: number, patch: Partial<OrgVestiging>) =>
    set({ vestigingen: (data.vestigingen || []).map((v, j) => (j === i ? { ...v, ...patch } : v)) });

  // Eén veld. Bewust een gewone functie (geen los component): een component dat
  // binnen de render wordt gemaakt, wordt bij elke toetsaanslag opnieuw gemount
  // en dan springt de cursor uit het veld.
  const veld = (label: string, k: keyof OrgFormData, opties?: { placeholder?: string; hint?: string; sleutel?: string }) => {
    const sleutel = opties?.sleutel || String(k);
    const leegMaarNodig = mist.has(sleutel);
    return (
      <label className={"org-field" + (leegMaarNodig ? " org-mis" : "")} key={sleutel}>
        <span className="org-label">
          {label}{opties?.hint && <HelpHint text={opties.hint} />}
          {leegMaarNodig && <span className="org-mis-vlag">ontbreekt nog</span>}
        </span>
        <input value={String(data[k] ?? "")} placeholder={opties?.placeholder || ""} disabled={disabled}
          onChange={(e) => set({ [k]: e.target.value } as Partial<OrgFormData>)} />
      </label>
    );
  };
  const rijVeld = (waarde: string, plaatshouder: string, sleutel: string, aan: (v: string) => void) => (
    <input className={mist.has(sleutel) ? "org-mis-input" : ""} placeholder={mist.has(sleutel) ? `${plaatshouder} (ontbreekt nog)` : plaatshouder}
      value={waarde} disabled={disabled} onChange={(e) => aan(e.target.value)} />
  );
  const aantalMist = mist.size;

  return (
    <div className="org-form">
      {aantalMist > 0 && (
        <div className="org-mis-balk">
          <strong>{aantalMist} {aantalMist === 1 ? "gegeven ontbreekt" : "gegevens ontbreken"} nog.</strong>
          <span>Ze staan hieronder in het rood. Vul ze aan waar je kunt; de rest vragen we bij de klant op.</span>
        </div>
      )}
      <div className="org-grid">
        {veld("Bedrijfsnaam", "bedrijfsnaam")}
        <label className={"org-field" + (mist.has("bedrijfstype") ? " org-mis" : "")}>
          <span className="org-label">Bedrijfstype<HelpHint text="Bepaalt welk soort structured data we gebruiken: een kliniek krijgt medische schema's, een webshop product-schema's, een dienstverlener service-schema's." />{mist.has("bedrijfstype") && <span className="org-mis-vlag">ontbreekt nog</span>}</span>
          <select value={data.bedrijfstype} disabled={disabled} onChange={(e) => set({ bedrijfstype: e.target.value })}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </label>
        {veld("Rechtsvorm", "rechtsvorm", { placeholder: "bijv. B.V." })}
        {veld("KVK-nummer", "kvk")}
        {veld("BTW-id", "btw")}
        {veld("Telefoon", "telefoon", { placeholder: "bijv. 073 123 45 67" })}
        {veld("E-mail", "email")}
        {veld("Oprichtingsjaar", "oprichtingsjaar")}
        {veld("Straat + huisnummer", "straat", { hint: "Het hoofdadres. Heeft het bedrijf meerdere locaties, vul die dan in bij Vestigingen hieronder; dit veld mag dan leeg blijven." })}
        {veld("Postcode", "postcode")}
        {veld("Plaats", "plaats")}
        <label className="org-field org-check">
          <input type="checkbox" checked={data.geenBezoekadres} disabled={disabled} onChange={(e) => set({ geenBezoekadres: e.target.checked })} />
          <span>Geen bezoekadres (wij komen bij de klant)<HelpHint text="Voor bedrijven zonder bezoeklocatie (bijv. hoveniers) nemen we het adres niet op in de zichtbare bedrijfsvermelding, maar gebruiken we het werkgebied." /></span>
        </label>
        {veld("Openingstijden", "openingstijden", { placeholder: "bijv. ma t/m vr 9:00-17:30", hint: "Bij meerdere vestigingen vul je de tijden per vestiging in; dit veld mag dan leeg blijven." })}
        {veld("Logo-URL", "logoUrl", { placeholder: "https://…/logo.png", hint: "Volledige link naar het logo-bestand op de website." })}
        {veld("Prijsindicatie", "priceRange", { placeholder: "bijv. €€ of vanaf €1.500" })}
        {veld("Reviews-pagina (URL)", "reviewUrl", { hint: "Waar de reviews zichtbaar staan (bijv. Google-reviews of een reviewpagina op de site)." })}
        {veld("Reviewgemiddelde", "reviewGemiddelde", { placeholder: "bijv. 4,8", hint: "Alleen invullen als dit cijfer ook echt zichtbaar is voor bezoekers; verzonnen cijfers zijn tegen de regels van Google." })}
        {veld("Aantal reviews", "reviewAantal", { placeholder: "bijv. 127" })}
      </div>

      <div className="org-typesec">
        <div className="org-typesec-head">
          Vestigingen ({(data.vestigingen || []).length})
          <HelpHint wide text="Elke locatie waar klanten of patiënten terechtkunnen, met eigen adres, telefoonnummer en openingstijden. Google en AI-assistenten maken hier per vestiging een eigen vermelding van, gekoppeld aan het bedrijf; dat is wat lokale zichtbaarheid ('kliniek Utrecht') mogelijk maakt. Zonder adres én openingstijden kan die vermelding niet worden gemaakt, daarom staan die velden rood zolang ze leeg zijn." />
        </div>
        {(data.vestigingen || []).map((v, i) => (
          <div className="org-vest" key={i}>
            <div className="org-vest-kop">
              <input className="org-vest-naam" placeholder="Naam van de vestiging (bijv. Utrecht)" value={v.naam} disabled={disabled}
                onChange={(e) => zetVestiging(i, { naam: e.target.value })} />
              {/* Zonder huisnummer, postcode of openingstijden is dit een genoemde
                  plaats en geen vestiging. Dat zeggen we hier, met de knop erbij,
                  zodat je niet hoeft te zoeken hoe je hem kwijtraakt. */}
              {!/\d/.test(v.straat || "") && !String(v.postcode || "").trim() && !String(v.openingstijden || "").trim() && (
                <span className="org-geen-vest">geen bezoekadres, dus geen vestiging</span>
              )}
              {!disabled && <button type="button" className="ghost-btn small" title="Deze vestiging verwijderen" onClick={() => set({ vestigingen: (data.vestigingen || []).filter((_, j) => j !== i) })}>&times;</button>}
            </div>
            <div className="org-vest-grid">
              {rijVeld(v.straat, "Straat + huisnummer", `vestiging.${i}.straat`, (x) => zetVestiging(i, { straat: x }))}
              {rijVeld(v.postcode, "Postcode", `vestiging.${i}.postcode`, (x) => zetVestiging(i, { postcode: x }))}
              {rijVeld(v.plaats, "Plaats", `vestiging.${i}.plaats`, (x) => zetVestiging(i, { plaats: x }))}
              {rijVeld(v.telefoon, "Telefoon", `vestiging.${i}.telefoon`, (x) => zetVestiging(i, { telefoon: x }))}
              {rijVeld(v.email, "E-mail", `vestiging.${i}.email`, (x) => zetVestiging(i, { email: x }))}
              {rijVeld(v.mapsUrl, "Google Maps-link", `vestiging.${i}.mapsUrl`, (x) => zetVestiging(i, { mapsUrl: x }))}
            </div>
            {rijVeld(v.openingstijden, "Openingstijden, bijv. ma t/m vr 8:30-17:00, za gesloten", `vestiging.${i}.openingstijden`, (x) => zetVestiging(i, { openingstijden: x }))}
          </div>
        ))}
        {!disabled && <button type="button" className="ghost-btn small" onClick={() => set({ vestigingen: [...(data.vestigingen || []), { ...LEGE_VESTIGING }] })}>+ Vestiging toevoegen</button>}
      </div>
      <label className={"org-field" + (mist.has("sameAs") ? " org-mis" : "")}>
        <span className="org-label">Sociale profielen en vermeldingen (één per regel)<HelpHint text="Volledige links naar Facebook, Instagram, LinkedIn, YouTube, de Google Business-vermelding, KVK-pagina, enz. Deze vertellen Google en AI-systemen dat al die profielen bij hetzelfde bedrijf horen." />{mist.has("sameAs") && <span className="org-mis-vlag">ontbreekt nog</span>}</span>
        <textarea rows={3} value={data.sameAs.join("\n")} disabled={disabled} onChange={(e) => set({ sameAs: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
      </label>
      <label className={"org-field" + (mist.has("areaServed") ? " org-mis" : "")}>
        <span className="org-label">Werkgebied (plaatsen/regio&rsquo;s, één per regel)<HelpHint text="De plaatsen of regio's waar jullie werken. Vooral belangrijk voor bedrijven zonder bezoekadres." />{mist.has("areaServed") && <span className="org-mis-vlag">ontbreekt nog</span>}</span>
        <textarea rows={2} value={data.areaServed.join("\n")} disabled={disabled} onChange={(e) => set({ areaServed: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
      </label>
      {/* Secties tonen zodra er inhoud is, ook als het bedrijfstype nog leeg is
          of anders staat: je eigen gegevens horen niet onzichtbaar te worden
          door een keuzelijstje. Het bedrijfstype bepaalt alleen nog welke sectie
          we uit onszelf aanbieden om aan te vullen. */}
      {(data.bedrijfstype === "kliniek" || data.artsen.length > 0) && (
        <div className="org-typesec">
          <div className="org-typesec-head">Artsen en behandelaren ({data.artsen.length})<HelpHint wide text="De artsen/behandelaren die op de website staan. Naam, functie en specialisatie helpen Google en AI-systemen het vertrouwen in medische informatie te bepalen; het BIG-nummer is daarbij het sterkste bewijs (openbaar register). Deze gegevens koppelen we aan de behandelpagina's." /></div>
          {data.artsen.map((a, i) => (
            <div className="org-row" key={i}>
              {rijVeld(a.naam, "Naam", `arts.${i}.naam`, (v) => set({ artsen: data.artsen.map((x, j) => j === i ? { ...x, naam: v } : x) }))}
              {rijVeld(a.functie, "Functie (bijv. oogarts)", `arts.${i}.functie`, (v) => set({ artsen: data.artsen.map((x, j) => j === i ? { ...x, functie: v } : x) }))}
              {rijVeld(a.specialisatie, "Specialisatie", `arts.${i}.specialisatie`, (v) => set({ artsen: data.artsen.map((x, j) => j === i ? { ...x, specialisatie: v } : x) }))}
              {rijVeld(a.big, "BIG-nummer", `arts.${i}.big`, (v) => set({ artsen: data.artsen.map((x, j) => j === i ? { ...x, big: v } : x) }))}
              {rijVeld(a.profielUrl, "Profielpagina-URL", `arts.${i}.profielUrl`, (v) => set({ artsen: data.artsen.map((x, j) => j === i ? { ...x, profielUrl: v } : x) }))}
              {!disabled && <button type="button" className="ghost-btn small" onClick={() => set({ artsen: data.artsen.filter((_, j) => j !== i) })}>&times;</button>}
            </div>
          ))}
          {!disabled && <button type="button" className="ghost-btn small" onClick={() => set({ artsen: [...data.artsen, { naam: "", functie: "", specialisatie: "", big: "", fotoUrl: "", profielUrl: "" }] })}>+ Arts toevoegen</button>}
        </div>
      )}
      {(data.bedrijfstype === "webshop" || data.merken.length > 0 || data.retourUrl || data.retourTermijn || data.verzendInfo) && (
        <div className="org-typesec">
          <div className="org-typesec-head">Webshop-gegevens<HelpHint wide text="Retourbeleid en verzendinformatie zijn vereisten van Google om producten met prijs en voorraad in de zoekresultaten te tonen. Vul alleen in wat ook echt op de site staat." /></div>
          <div className="org-grid">
            <label className="org-field"><span className="org-label">Merk(en), kommagescheiden</span><input value={data.merken.join(", ")} disabled={disabled} onChange={(e) => set({ merken: e.target.value.split(",").map((m) => m.trim()).filter(Boolean) })} /></label>
            <label className="org-field"><span className="org-label">Retourbeleid-URL</span><input value={data.retourUrl} disabled={disabled} onChange={(e) => set({ retourUrl: e.target.value })} /></label>
            <label className="org-field"><span className="org-label">Retourtermijn</span><input placeholder="bijv. 30 dagen" value={data.retourTermijn} disabled={disabled} onChange={(e) => set({ retourTermijn: e.target.value })} /></label>
            <label className="org-field"><span className="org-label">Verzendinformatie</span><input placeholder="bijv. gratis vanaf €50, 1-2 werkdagen" value={data.verzendInfo} disabled={disabled} onChange={(e) => set({ verzendInfo: e.target.value })} /></label>
          </div>
        </div>
      )}
      {(data.bedrijfstype === "dienstverlener" || data.diensten.length > 0) && (
        <div className="org-typesec">
          <div className="org-typesec-head">Diensten en behandelingen ({data.diensten.length})<HelpHint wide text="De hoofddiensten of behandelingen van het bedrijf. Elke dienst wordt in de structured data een eigen vermelding die aan het bedrijf en het werkgebied gekoppeld is." /></div>
          {data.diensten.map((d, i) => (
            <div className="org-row org-row-2" key={i}>
              {rijVeld(d.naam, "Dienst (bijv. zwemvijver aanleggen)", `dienst.${i}.naam`, (v) => set({ diensten: data.diensten.map((x, j) => j === i ? { ...x, naam: v } : x) }))}
              {rijVeld(d.omschrijving, "Korte omschrijving", `dienst.${i}.omschrijving`, (v) => set({ diensten: data.diensten.map((x, j) => j === i ? { ...x, omschrijving: v } : x) }))}
              {!disabled && <button type="button" className="ghost-btn small" onClick={() => set({ diensten: data.diensten.filter((_, j) => j !== i) })}>&times;</button>}
            </div>
          ))}
          {!disabled && <button type="button" className="ghost-btn small" onClick={() => set({ diensten: [...data.diensten, { naam: "", omschrijving: "" }] })}>+ Dienst toevoegen</button>}
        </div>
      )}
      <label className="org-field">
        <span className="org-label">Opmerkingen / nog uit te zoeken</span>
        <textarea rows={2} value={data.notitie} disabled={disabled} onChange={(e) => set({ notitie: e.target.value })} />
      </label>
    </div>
  );
}

export default function OrgDataPanel({ slug, clientEmail }: { slug: string; clientEmail?: string }) {
  const [data, setData] = useState<OrgFormData | null>(null);
  const [locked, setLocked] = useState(false);
  const [shareToken, setShareToken] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [open, setOpen] = useState(false);

  // Wat er in het formulier staat en wat er als laatste bewaard is. Zolang die
  // twee gelijk zijn valt er niets op te slaan; wijkt het af, dan slaan we het
  // vanzelf op. Zo kan een keuze (zoals het bedrijfstype) niet meer verdwijnen
  // doordat het formulier tussendoor opnieuw geladen wordt.
  const bewaard = useRef<string>("");
  const [bewaarStand, setBewaarStand] = useState<"" | "bezig" | "klaar" | "fout">("");

  async function laadOrg() {
    const d = await fetch(`/api/admin/org-data?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) { bewaard.current = JSON.stringify(d.data); setData(d.data); setLocked(!!d.locked); setShareToken(d.shareToken || ""); }
  }
  useEffect(() => { void laadOrg(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/share/org/${shareToken}` : "";

  async function save(stil = false) {
    if (!data) return true;
    const nu = JSON.stringify(data);
    if (nu === bewaard.current) return true; // niets veranderd
    if (!stil) { setBusy("save"); setMsg(""); }
    setBewaarStand("bezig");
    try {
      const d = await fetch("/api/admin/org-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "save", data }) }).then((r) => r.json());
      if (d.ok) { bewaard.current = nu; setBewaarStand("klaar"); if (!stil) setMsg("Opgeslagen."); return true; }
      setBewaarStand("fout"); setMsg(d.error || "Opslaan mislukt."); return false;
    } catch { setBewaarStand("fout"); setMsg("Opslaan mislukt."); return false; }
    finally { if (!stil) setBusy(""); }
  }

  // Automatisch opslaan, kort nadat je stopt met typen of kiezen. Niet tijdens
  // het automatisch vullen of als de gegevens vergrendeld zijn.
  useEffect(() => {
    if (!data || locked || busy === "autofill") return;
    if (JSON.stringify(data) === bewaard.current) return;
    const t = setTimeout(() => { void save(true); }, 1200);
    return () => clearTimeout(t);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [data, locked, busy]);
  async function autofill() {
    if (busy) return;
    setBusy("autofill"); setMsg("");
    try {
      const d = await fetch("/api/admin/org-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "autofill" }) }).then((r) => r.json());
      if (d.ok) { bewaard.current = JSON.stringify(d.data); setData(d.data); setMsg("Automatisch gevuld vanaf de website; loop de velden na en vul aan waar nodig."); }
      else setMsg(d.error || "Automatisch vullen mislukt.");
    } catch { setMsg("Automatisch vullen mislukt."); } finally { setBusy(""); }
  }
  async function toggleLock() {
    if (busy) return;
    const next = !locked;
    if (next && !window.confirm("Vergrendelen? De klant kan de gegevens dan niet meer aanpassen en dit wordt de vaste bron voor alle structured data.")) return;
    setBusy("lock"); setMsg("");
    try {
      const d = await fetch("/api/admin/org-data", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, locked: next }) }).then((r) => r.json());
      if (d.ok) { setLocked(next); setMsg(next ? "Vergrendeld: dit is nu de vaste bron voor de structured data." : "Ontgrendeld: de klant kan weer aanvullen."); }
    } catch { setMsg("Vergrendelen mislukt."); } finally { setBusy(""); }
  }
  const [swJson, setSwJson] = useState("");
  const [swMsg, setSwMsg] = useState("");
  const [swCopied, setSwCopied] = useState(false);
  async function generateSitewide() {
    if (busy) return;
    setBusy("sitewide"); setSwMsg("");
    try {
      const d = await fetch(`/api/admin/org-data/sitewide?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d.ok) { setSwJson(d.jsonld); if (!d.locked) setSwMsg("Let op: de gegevens zijn nog niet vergrendeld; controleer ze eerst met de klant."); }
      else setSwMsg(d.error || "Genereren mislukt.");
    } catch { setSwMsg("Genereren mislukt."); } finally { setBusy(""); }
  }
  async function copySitewide() {
    if (!swJson) return;
    try { await navigator.clipboard.writeText(swJson); setSwCopied(true); setTimeout(() => setSwCopied(false), 2000); } catch { /* handmatig */ }
  }
  async function sitewideTask() {
    if (busy) return;
    setBusy("swtask"); setSwMsg("");
    try {
      const d = await fetch("/api/admin/org-data/sitewide", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).then((r) => r.json());
      setSwMsg(d.ok ? "Dev-taak aangemaakt in Werkzaamheden, met het .json-bestand in Drive." : d.error || "Doorzetten mislukt.");
    } catch { setSwMsg("Doorzetten mislukt."); } finally { setBusy(""); }
  }
  async function copyLink() {
    if (!shareUrl) return;
    try { await navigator.clipboard.writeText(shareUrl); setMsg("Deel-link gekopieerd."); } catch { setMsg("Kopiëren mislukt; selecteer de link zelf."); }
  }
  function mailLink() {
    const to = (clientEmail || "").trim();
    const subject = encodeURIComponent("Bedrijfsgegevens controleren voor jullie vindbaarheid");
    const body = encodeURIComponent(
      `Beste,\n\nVoor de vindbaarheid van jullie website (in Google en in AI-zoekmachines) voeren we structured data door: onzichtbare, gestructureerde bedrijfsinformatie die zoekmachines laat zien wie jullie zijn.\n\nWij hebben alvast zoveel mogelijk ingevuld vanaf jullie website. Willen jullie de gegevens op deze pagina nalopen, corrigeren en aanvullen waar nodig?\n\n${shareUrl}\n\nAlvast bedankt!\n\nMet vriendelijke groet,\nMaarten Vermeulen\nPingwin Online Marketing`,
    );
    window.open(`mailto:${to}?subject=${subject}&body=${body}`, "_blank");
  }

  return (
    <div className="cockpit-card strategy-card">
      <button type="button" className="strategy-head" onClick={() => setOpen((v) => !v)}>
        <span className="strategy-caret">{open ? "▾" : "▸"}</span>
        <span className="strategy-title">Bedrijfsgegevens (voor structured data) <HelpHint xl title="Bedrijfsgegevens: de bron voor alle structured data" text={"De vaste identiteit van dit bedrijf (naam, bedrijfstype, adres, telefoon, openingstijden, logo, sociale profielen, werkgebied): **de enige bron** waaruit alle structured data van de site wordt opgebouwd.\n## Twee lagen: site-breed en per pagina\nStructured data is onzichtbare, machineleesbare informatie in de code die Google en AI-assistenten (ChatGPT, Perplexity, Copilot) vertelt wie dit bedrijf is en wat elke pagina is. Het systeem werkt in twee lagen. __Laag 1, de fundering:__ uit dit formulier wordt het **site-brede identiteitsblok** gebouwd (bedrijf + website) dat op elke pagina hoort te staan; genereren doe je onderaan deze kaart, en de developer plaatst het één keer. __Laag 2, de kamers:__ elke pagina krijgt daarbovenop via de structured data-stap in het Pagina's-tabblad een eigen blok (behandeling, dienst, product, artikel) dat met vaste verwijzingen aan de fundering hangt. Zo ziet Google één samenhangende entiteit in plaats van losse snippers, en dat is precies wat zowel rijkere zoekresultaten als AI-citaties voedt.\n## Waarom dit zo strak geregeld is\nStructured data mag nooit iets beweren dat niet klopt; verzonnen of verouderde gegevens ondermijnen het vertrouwen van Google en kunnen een handmatige actie opleveren. Daarom komt élk gegeven in de schema's aantoonbaar uit dit formulier of van de pagina zelf, nergens anders vandaan.\n## De werkwijze in drie stappen\n- **Automatisch vullen:** het dashboard leest de website (homepage, contact, team/over-ons, bestaande JSON-LD) én zoekt daarnaast op het web: het KVK-register, de Google Business-vermelding met reviewcijfers, sociale profielen en reviewplatforms. Elk gevonden gegeven wordt geverifieerd (zelfde naam, plaats en domein) voordat het wordt ingevuld; bij twijfel blijft het veld leeg met een notitie. Er wordt niets verzonnen.\n- **Laten controleren:** deel de link met de klant (of gebruik de mail-knop); die corrigeert en vult aan wat wij niet kunnen vinden. Niemand kent de openingstijden beter dan de klant zelf.\n- **Vergrendelen:** daarna zet je het slot erop. De klant kan dan niets meer wijzigen en dit is de bevestigde, betrouwbare bron voor de structured data op álle pagina's.\n## Per bedrijfstype een eigen aanvulling\nHet gekozen bedrijfstype bepaalt welke extra sectie in het formulier verschijnt én welke markup de pagina's krijgen:\n- **Kliniek/zorg:** een blok met artsen en behandelaren (naam, functie, specialisatie, **BIG-nummer**, profielpagina). Bij medische onderwerpen weegt Google aantoonbare expertise extra zwaar; de arts wordt in de markup aan de bijbehorende behandelpagina's gekoppeld, met het BIG-nummer als openbaar controleerbaar bewijs.\n- **Webshop:** merken, retourbeleid en verzendinformatie; verplichte onderdelen om producten met prijs en voorraad in de zoekresultaten te mogen tonen. Productmarkup komt alleen op echte productpagina's.\n- **Dienstverlener:** de dienstenlijst plus het werkgebied; elke dienst wordt een eigen vermelding gekoppeld aan het bedrijf. Bij bedrijven zonder bezoekadres (aan-huis) wordt bewust géén adres in de markup gezet, maar het werkgebied.\n- **Lokaal bedrijf:** de volledige vestigingsinformatie met openingstijden en prijsindicatie.\n## De bewaking daarna\nStructured data is geen eenmalig kunstje: veranderen de openingstijden, reviewcijfers of veelgestelde vragen op de site, dan moet de markup mee. Het dashboard let daarop: wijzigt een pagina waar structured data op is doorgevoerd (dat detecteert het Wijzigingen-tabblad automatisch), dan verschijnt bij die pagina een seintje dat de structured data opnieuw bekeken moet worden."} /></span>
        {locked && <span className="strategy-meta-right">🔒 vergrendeld</span>}
      </button>
      {open && (
        <div className="strategy-body">
          <div className="org-actions">
            <button type="button" className="primary-btn small" onClick={autofill} disabled={!!busy}>{busy === "autofill" ? "Website + web doorzoeken… (kan een minuut duren)" : "Automatisch vullen (website + web)"}</button>
            <button type="button" className="ghost-btn small" onClick={() => void save()} disabled={!!busy || !data}>{busy === "save" ? "Opslaan…" : "Opslaan"}</button>
            <button type="button" className="ghost-btn small" onClick={toggleLock} disabled={!!busy}>{locked ? "Ontgrendelen" : "Vergrendelen"}</button>
            {shareUrl && <button type="button" className="ghost-btn small" onClick={copyLink} title={shareUrl}>Deel-link kopiëren</button>}
            {shareUrl && <button type="button" className="ghost-btn small" onClick={mailLink}>Mail naar klant</button>}
            {/* Wat er met je wijziging gebeurt, zonder dat je op Opslaan hoeft te letten. */}
            {bewaarStand && (
              <span className={"org-bewaar" + (bewaarStand === "fout" ? " org-bewaar-fout" : "")}>
                {bewaarStand === "bezig" ? "opslaan…" : bewaarStand === "klaar" ? "✓ opgeslagen" : "opslaan mislukt"}
              </span>
            )}
          </div>
          {msg && <div className="saved-msg" style={{ margin: "8px 0" }}>{msg}</div>}
          {data ? <OrgDataForm data={data} onChange={setData} disabled={busy === "autofill"} /> : <div className="muted">Laden…</div>}
          <div className="org-sitewide">
            <div className="org-sitewide-head">
              <strong>Site-brede structured data</strong>
              <HelpHint xl title="Site-brede structured data: het identiteitsblok" text={"Het **identiteitsblok** van de site: één blok JSON-LD met de organisatie (of LocalBusiness/MedicalClinic, afhankelijk van het bedrijfstype hierboven) en de website, met vaste @id's.\n## Hoe het zich verhoudt tot de per-pagina schema's\nDit blok hoort op de homepage en is het anker van de hele entity graph: de per-pagina schema's uit de structured-data-stap verwijzen er met hun @id's naartoe in plaats van de bedrijfsgegevens overal te herhalen. Eén bron, overal consistent; precies wat zoekmachines en AI-assistenten nodig hebben om het bedrijf als één entiteit te herkennen.\n## Belangrijk om te weten\nDit blok wordt **deterministisch** gebouwd, zonder AI: rechtstreeks uit de bevestigde gegevens hierboven, dus er kan niets bij verzonnen worden.\n## Wat je ermee doet\nGenereer, controleer en kopieer de JSON, of maak er direct een Dev-taak van met het .json-bestand in Drive; de developer plakt hem één keer in de site."} />
              <button type="button" className="ghost-btn small" onClick={generateSitewide} disabled={!!busy}>{busy === "sitewide" ? "Genereren…" : "Genereer site-brede schema"}</button>
              {swJson && <button type="button" className="ghost-btn small" onClick={copySitewide}>{swCopied ? "✓ gekopieerd" : "Kopieer JSON"}</button>}
              {swJson && <button type="button" className="ghost-btn small" onClick={sitewideTask} disabled={!!busy}>{busy === "swtask" ? "Bezig…" : "Als Dev-taak doorzetten"}</button>}
            </div>
            {swMsg && <div className="saved-msg" style={{ marginTop: 6 }}>{swMsg}</div>}
            {swJson && <pre className="sch-json-pre" style={{ marginTop: 8 }}>{swJson}</pre>}
          </div>
          <Kennisbank slug={slug} voorActie={() => save(true)} onVerwerkt={() => { void laadOrg(); }} />
        </div>
      )}
    </div>
  );
}
