"use client";

import { useEffect, useState } from "react";
import HelpHint from "./HelpHint";

// ═══════════════════════════════════════════════════════════
// BEDRIJFSGEGEVENS (fundament voor structured data)
// ═══════════════════════════════════════════════════════════
// Cockpit-kaart op het Klant-tabblad: automatisch gevuld formulier met de
// organisatiegegevens, deel-link voor de klant, mail-knop en vergrendeling.
// Het kale formulier (OrgDataForm) wordt hergebruikt op de klant-deelpagina.
// ═══════════════════════════════════════════════════════════

export type OrgFormData = {
  bedrijfsnaam: string; bedrijfstype: string; rechtsvorm: string; kvk: string; btw: string;
  telefoon: string; email: string; straat: string; postcode: string; plaats: string;
  geenBezoekadres: boolean; openingstijden: string; logoUrl: string; priceRange: string;
  oprichtingsjaar: string; sameAs: string[]; areaServed: string[]; reviewUrl: string;
  reviewGemiddelde: string; reviewAantal: string; notitie: string;
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
  const F = ({ label, k, placeholder, hint }: { label: string; k: keyof OrgFormData; placeholder?: string; hint?: string }) => (
    <label className="org-field">
      <span className="org-label">{label}{hint && <HelpHint text={hint} />}</span>
      <input value={String(data[k] ?? "")} placeholder={placeholder || ""} disabled={disabled} onChange={(e) => set({ [k]: e.target.value } as Partial<OrgFormData>)} />
    </label>
  );
  return (
    <div className="org-form">
      <div className="org-grid">
        <F label="Bedrijfsnaam" k="bedrijfsnaam" />
        <label className="org-field">
          <span className="org-label">Bedrijfstype<HelpHint text="Bepaalt welk soort structured data we gebruiken: een kliniek krijgt medische schema's, een webshop product-schema's, een dienstverlener service-schema's." /></span>
          <select value={data.bedrijfstype} disabled={disabled} onChange={(e) => set({ bedrijfstype: e.target.value })}>
            {TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
        </label>
        <F label="Rechtsvorm" k="rechtsvorm" placeholder="bijv. B.V." />
        <F label="KVK-nummer" k="kvk" />
        <F label="BTW-id" k="btw" />
        <F label="Telefoon" k="telefoon" placeholder="bijv. 073 123 45 67" />
        <F label="E-mail" k="email" />
        <F label="Oprichtingsjaar" k="oprichtingsjaar" />
        <F label="Straat + huisnummer" k="straat" />
        <F label="Postcode" k="postcode" />
        <F label="Plaats" k="plaats" />
        <label className="org-field org-check">
          <input type="checkbox" checked={data.geenBezoekadres} disabled={disabled} onChange={(e) => set({ geenBezoekadres: e.target.checked })} />
          <span>Geen bezoekadres (wij komen bij de klant)<HelpHint text="Voor bedrijven zonder bezoeklocatie (bijv. hoveniers) nemen we het adres niet op in de zichtbare bedrijfsvermelding, maar gebruiken we het werkgebied." /></span>
        </label>
        <F label="Openingstijden" k="openingstijden" placeholder="bijv. ma t/m vr 9:00-17:30" />
        <F label="Logo-URL" k="logoUrl" placeholder="https://…/logo.png" hint="Volledige link naar het logo-bestand op de website." />
        <F label="Prijsindicatie" k="priceRange" placeholder="bijv. €€ of vanaf €1.500" />
        <F label="Reviews-pagina (URL)" k="reviewUrl" hint="Waar de reviews zichtbaar staan (bijv. Google-reviews of een reviewpagina op de site)." />
        <F label="Reviewgemiddelde" k="reviewGemiddelde" placeholder="bijv. 4,8" hint="Alleen invullen als dit cijfer ook echt zichtbaar is voor bezoekers; verzonnen cijfers zijn tegen de regels van Google." />
        <F label="Aantal reviews" k="reviewAantal" placeholder="bijv. 127" />
      </div>
      <label className="org-field">
        <span className="org-label">Sociale profielen en vermeldingen (één per regel)<HelpHint text="Volledige links naar Facebook, Instagram, LinkedIn, YouTube, de Google Business-vermelding, KVK-pagina, enz. Deze vertellen Google en AI-systemen dat al die profielen bij hetzelfde bedrijf horen." /></span>
        <textarea rows={3} value={data.sameAs.join("\n")} disabled={disabled} onChange={(e) => set({ sameAs: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
      </label>
      <label className="org-field">
        <span className="org-label">Werkgebied (plaatsen/regio&rsquo;s, één per regel)<HelpHint text="De plaatsen of regio's waar jullie werken. Vooral belangrijk voor bedrijven zonder bezoekadres." /></span>
        <textarea rows={2} value={data.areaServed.join("\n")} disabled={disabled} onChange={(e) => set({ areaServed: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })} />
      </label>
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

  useEffect(() => {
    let off = false;
    fetch(`/api/admin/org-data?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (!off && d.ok) { setData(d.data); setLocked(!!d.locked); setShareToken(d.shareToken || ""); } })
      .catch(() => {});
    return () => { off = true; };
  }, [slug]);

  const shareUrl = shareToken && typeof window !== "undefined" ? `${window.location.origin}/share/org/${shareToken}` : "";

  async function save() {
    if (!data || busy) return;
    setBusy("save"); setMsg("");
    try {
      const d = await fetch("/api/admin/org-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "save", data }) }).then((r) => r.json());
      setMsg(d.ok ? "Opgeslagen." : d.error || "Opslaan mislukt.");
    } catch { setMsg("Opslaan mislukt."); } finally { setBusy(""); }
  }
  async function autofill() {
    if (busy) return;
    setBusy("autofill"); setMsg("");
    try {
      const d = await fetch("/api/admin/org-data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "autofill" }) }).then((r) => r.json());
      if (d.ok) { setData(d.data); setMsg("Automatisch gevuld vanaf de website; loop de velden na en vul aan waar nodig."); }
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
        <span className="strategy-title">Bedrijfsgegevens (voor structured data) <HelpHint xl title="Bedrijfsgegevens: de bron voor alle structured data" text={"De vaste identiteit van dit bedrijf (naam, bedrijfstype, adres, telefoon, openingstijden, logo, sociale profielen, werkgebied): **de enige bron** waaruit alle structured data van de site wordt opgebouwd.\n## Waarom dit zo strak geregeld is\nStructured data mag nooit iets beweren dat niet klopt; verzonnen of verouderde gegevens ondermijnen het vertrouwen van Google en kunnen een handmatige actie opleveren. Daarom komt élk gegeven in de schema's aantoonbaar uit dit formulier of van de pagina zelf, nergens anders vandaan.\n## De werkwijze in drie stappen\n- **Automatisch vullen:** het dashboard leest de homepage, contactpagina en bestaande JSON-LD van de site en vult het formulier voor; er wordt niets verzonnen, lege velden blijven leeg.\n- **Laten controleren:** deel de link met de klant zodat die corrigeert en aanvult; niemand kent de openingstijden beter dan de klant zelf.\n- **Vergrendelen:** daarna zet je het slot erop. Vanaf dat moment is dit de bevestigde, betrouwbare bron voor de structured-data-stap op álle pagina's, en weet de AI dat hij hierop mag bouwen."} /></span>
        {locked && <span className="strategy-meta-right">🔒 vergrendeld</span>}
      </button>
      {open && (
        <div className="strategy-body">
          <div className="org-actions">
            <button type="button" className="primary-btn small" onClick={autofill} disabled={!!busy}>{busy === "autofill" ? "Website uitlezen…" : "Automatisch vullen vanaf de website"}</button>
            <button type="button" className="ghost-btn small" onClick={save} disabled={!!busy || !data}>{busy === "save" ? "Opslaan…" : "Opslaan"}</button>
            <button type="button" className="ghost-btn small" onClick={toggleLock} disabled={!!busy}>{locked ? "Ontgrendelen" : "Vergrendelen"}</button>
            {shareUrl && <button type="button" className="ghost-btn small" onClick={copyLink} title={shareUrl}>Deel-link kopiëren</button>}
            {shareUrl && <button type="button" className="ghost-btn small" onClick={mailLink}>Mail naar klant</button>}
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
        </div>
      )}
    </div>
  );
}
