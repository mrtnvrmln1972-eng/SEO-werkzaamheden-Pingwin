"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientConfig } from "../../lib/clients";
import { groepeerKlanten } from "../../lib/klant-groepen";
import { LEAD_STANDAARD_KANS } from "../../lib/prognose-kans";
import OntwikkelMenu from "./OntwikkelMenu";
import Tellers from "./Tellers";
import MeldingenMenu from "./MeldingenMenu";
import BulkOnboarding from "./BulkOnboarding";
import KlantwaardeBulk from "./KlantwaardeBulk";
import Vouwblok from "./Vouwblok";
import KijkSleutel from "./KijkSleutel";
import { Gebouw, Mensen, PijlRechts, Vlag } from "../_ui/Pijl";

type Created = { name: string; loginId: string; password: string; loginUrl: string; shareUrl?: string };

// De stand van één lead in HubSpot, voor de kolommen in de leadlijst.
type HubspotStand = { slug: string; opvolgDatum: string | null; sluitDatum: string | null; faseNaam: string; hubspotUrl: string };

/** Een datum kort en leesbaar: "3 sep". Leeg blijft een streepje. */
function dagKort(iso: string | null | undefined): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return ""; }
}

/** De drie dingen die je per lead in de lijst zelf invult, als tekst in beeld. */
type LeadVeld = { kans: string; maand: string; eenmalig: string };
const LEEG_VELD: LeadVeld = { kans: "", maand: "", eenmalig: "" };

/** Een maand als "2026-10" kort en leesbaar: "okt 2026". */
function maandKort(maand: string | null | undefined): string {
  if (!maand) return "";
  try {
    return new Date(`${maand}-01T00:00:00`).toLocaleDateString("nl-NL", { month: "short", year: "numeric" });
  } catch { return maand; }
}

/** Is dit contactmoment geweest, vandaag, of nog niet? Bepaalt de kleur. */
function opvolgKlasse(datum: string | null | undefined): string {
  if (!datum) return "";
  const vandaag = new Date().toISOString().slice(0, 10);
  if (datum < vandaag) return " lead-datum-verstreken";
  if (datum === vandaag) return " lead-datum-vandaag";
  return "";
}


const EMPTY = {
  name: "",
  loginId: "",
  email: "",
  sheetUrl: "",
  maandbudget: "",
  linkbuilding: "",
  uurtarief: "",
  beschikbareUren: "",
  grp: "",
};

export default function AdminClient({ initialClients, isOwner = true, canDev = false, showGroups = false, showFinance = false }: { initialClients: ClientConfig[]; isOwner?: boolean; canDev?: boolean; showGroups?: boolean; showFinance?: boolean }) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientConfig[]>(initialClients);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [origin, setOrigin] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  // Nieuwe lead: alleen een naam en een website (geen inlog, sheet of budget).
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", domain: "", email: "" });
  const [leadBusy, setLeadBusy] = useState(false);
  // Budget bewerken per klant (maandfee, linkbuilding, uurtarief, uren)
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ maandbudget: "", linkbuilding: "", uurtarief: "" });
  const [editBusy, setEditBusy] = useState(false);
  // Facturen-signaal per klant (uit Moneybird): aantal + bedrag >30 dagen open.
  const [overdue, setOverdue] = useState<Record<string, { count: number; total: number }>>({});
  // Onboarding-signaal per klant: hoeveel stappen staan er, en wat loopt achter.
  // Wordt ná het tonen van de lijst opgehaald, dus het scherm wacht er nooit op.
  const [onb, setOnb] = useState<Record<string, { af: number; totaal: number; mist: string[]; klaar: boolean }>>({});
  // Welke rij wordt op dit moment gesleept, voor de eigen volgorde van de lijst.
  const [sleep, setSleep] = useState<number | null>(null);
  // Per lead de stand van zijn HubSpot-deal (opvolgdatum, verwachte startdatum).
  const [hubspot, setHubspot] = useState<Record<string, HubspotStand>>({});
  // Bedrijven die een ophaalronde heeft aangemaakt en waar niets mee gedaan is.
  // De knop staat hier en niet alleen op Beheer: je ziet de rommel in deze lijst,
  // dus hier hoort ook de bezem te staan.
  const [opruimen, setOpruimen] = useState<string[]>([]);
  const [opruimBezig, setOpruimBezig] = useState(false);
  // Wat je per lead zelf invult en wat niet in de klantrij past: de kans dat het
  // doorgaat, de maand waarin hij naar verwachting start, en een eenmalig bedrag
  // (meestal een website). Alle drie staan ze in het dashboard en niet in
  // HubSpot, want daar werkt Maarten er niet mee. Ze staan hier in de lijst
  // omdat één rij per lead precies het moment is waarop je erover nadenkt.
  const [leadVeld, setLeadVeld] = useState<Record<string, LeadVeld>>({});
  // Wat er van elke lead al bewaard is. Een maandveld verandert al terwijl je
  // hem aan het kiezen bent, dus zonder dit zou elke klik in zo'n veld een keer
  // opslaan; nu gebeurt dat alleen als de waarde echt anders is.
  const bewaardVeld = useRef<Record<string, LeadVeld>>({});
  const zetLeadVeld = (slug: string, deel: Partial<LeadVeld>) =>
    setLeadVeld((v) => ({ ...v, [slug]: { ...LEEG_VELD, ...v[slug], ...deel } }));
  // Welke cel op dit moment wordt weggeschreven, zodat een rij niet twee keer
  // tegelijk opslaat en je ziet dat er iets gebeurt.
  const [celBezig, setCelBezig] = useState<string>("");

  /** Eén veld van één lead bewaren en de lijst daarna opnieuw laden. */
  async function bewaarLead(slug: string, veld: string, body: Record<string, unknown>) {
    setCelBezig(`${slug}:${veld}`);
    try {
      const d = await fetch(`/api/admin/lead-hubspot?slug=${encodeURIComponent(slug)}`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      }).then((r) => r.json());
      if (!d?.ok) setNotice({ ok: false, text: d?.error || "Opslaan lukte niet." });
      else if (veld === "budget") await refresh();
    } catch { setNotice({ ok: false, text: "Opslaan lukte niet." }); }
    finally { setCelBezig(""); }
  }

  async function ruimOp() {
    if (!window.confirm(
      `${opruimen.length} bedrijven verwijderen die uit een ophaalronde kwamen en waar niets mee gedaan is?\n\n`
      + "Je eigen klanten en alles waar je aan gewerkt hebt blijven staan. Dit kan niet ongedaan gemaakt worden.",
    )) return;
    setOpruimBezig(true);
    try {
      const d = await fetch("/api/admin/hubspot", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actie: "opruimen" }),
      }).then((r) => r.json());
      if (d?.ok) { setNotice({ ok: true, text: `${d.verwijderd} bedrijven opgeruimd.` }); setOpruimen([]); await refresh(); }
      else setNotice({ ok: false, text: d?.error || "Opruimen lukte niet." });
    } catch { setNotice({ ok: false, text: "Opruimen lukte niet." }); }
    finally { setOpruimBezig(false); }
  }

  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/moneybird/openstaand");
        if (!res.ok) return;
        const data = await res.json();
        if (!data.ok || !data.configured || !alive) return;
        const map: Record<string, { count: number; total: number }> = {};
        for (const c of data.byClient as { slug: string; overdueCount: number; overdueTotal: number }[]) {
          if (c.overdueCount > 0) map[c.slug] = { count: c.overdueCount, total: c.overdueTotal };
        }
        setOverdue(map);
      } catch { /* stil: geen signaal, volgende paginalading opnieuw */ }
    })();
    return () => { alive = false; };
  }, [isOwner]);

  // De stand uit HubSpot per lead: wanneer je hem weer moet spreken en wanneer
  // hij naar verwachting klant wordt. Wordt ná de lijst opgehaald, dus het
  // scherm wacht er nooit op; lukt het niet (geen HubSpot, geen eigenaar), dan
  // blijven die kolommen gewoon leeg.
  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    (async () => {
      try {
        const d = await fetch("/api/admin/hubspot").then((r) => r.json());
        if (!d?.ok || !alive || !Array.isArray(d.leads)) return;
        const map: Record<string, HubspotStand> = {};
        for (const l of d.leads as HubspotStand[]) map[l.slug] = l;
        setHubspot(map);
        setOpruimen(Array.isArray(d.opruimen) ? (d.opruimen as string[]) : []);
      } catch { /* stil: geen stand, volgende paginalading opnieuw */ }
    })();
    return () => { alive = false; };
  }, [isOwner]);

  // De kans, de startmaand en het eenmalige bedrag die je zelf hebt ingevuld.
  // Aparte, lichte route: alleen de regels, geen doorgerekende prognose.
  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    (async () => {
      try {
        const d = await fetch("/api/admin/prognose?regels=1").then((r) => r.json());
        if (!d?.ok || !alive || !d.regels) return;
        const rijen = d.regels as Record<string, { kans: number; startMaand: string | null; eenmaligOmzet: number }>;
        const map: Record<string, LeadVeld> = {};
        for (const [slug, r] of Object.entries(rijen)) {
          map[slug] = {
            kans: r?.kans === undefined || r?.kans === null ? "" : String(r.kans),
            maand: r?.startMaand || "",
            eenmalig: r?.eenmaligOmzet ? String(Math.round(r.eenmaligOmzet)) : "",
          };
        }
        bewaardVeld.current = JSON.parse(JSON.stringify(map)) as Record<string, LeadVeld>;
        setLeadVeld(map);
      } catch { /* stil: dan blijven die kolommen leeg */ }
    })();
    return () => { alive = false; };
  }, [isOwner]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const d = await fetch("/api/admin/onboarding?alle=1").then((r) => r.json());
        if (!d?.ok || !alive) return;
        const map: Record<string, { af: number; totaal: number; mist: string[]; klaar: boolean }> = {};
        for (const s of d.signalen as { slug: string; af: number; totaal: number; mist: string[]; klaar: boolean }[]) map[s.slug] = s;
        setOnb(map);
      } catch { /* stil: geen signaal, volgende paginalading opnieuw */ }
    })();
    return () => { alive = false; };
  }, []);

  function openEdit(e: React.MouseEvent, c: ClientConfig) {
    e.stopPropagation();
    setEditSlug(c.slug);
    setEditForm({
      maandbudget: String(c.budget.maandbudget),
      linkbuilding: String(c.budget.linkbuilding),
      uurtarief: String(c.budget.uurtarief),
    });
  }
  async function saveBudget(e: React.MouseEvent, c: ClientConfig) {
    e.stopPropagation();
    setEditBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/clients", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: c.slug, action: "setBudget",
          maandbudget: Number(editForm.maandbudget) || 0,
          linkbuilding: Number(editForm.linkbuilding) || 0,
          uurtarief: Number(editForm.uurtarief) || 0,
          // Beschikbare uren zijn afgeleid (maandbudget − linkbuilding) / uurtarief.
          beschikbareUren: Number(editForm.uurtarief) > 0
            ? Math.round(((Number(editForm.maandbudget) || 0) - (Number(editForm.linkbuilding) || 0)) / Number(editForm.uurtarief))
            : 0,
        }),
      });
      const data = await res.json();
      if (data.ok) { setEditSlug(null); await refresh(); setNotice({ ok: true, text: `Budget bijgewerkt voor ${c.name}.` }); }
      else setError(data.error || "Budget bijwerken mislukt.");
    } catch { setError("Budget bijwerken mislukt."); } finally { setEditBusy(false); }
  }
  function editSet(field: keyof typeof editForm, value: string) {
    setEditForm((f) => ({ ...f, [field]: value }));
  }

  useEffect(() => {
    setOrigin(window.location.origin);
    const p = new URLSearchParams(window.location.search);
    const g = p.get("google");
    const m = p.get("ms");
    if (g === "ok") setNotice({ ok: true, text: "Google is gekoppeld." });
    else if (g === "error") setNotice({ ok: false, text: "Google koppelen mislukt: " + (p.get("msg") || "onbekende fout") });
    else if (g === "notconfigured") setNotice({ ok: false, text: "Google-sleutels (GOOGLE_CLIENT_ID/SECRET) ontbreken in Vercel of de deploy is nog niet actief." });
    else if (m === "ok") setNotice({ ok: true, text: "Microsoft is gekoppeld." });
    else if (m === "error") setNotice({ ok: false, text: "Microsoft koppelen mislukt: " + (p.get("msg") || "onbekende fout") });
  }, []);

  function set(field: keyof typeof EMPTY, value: string) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function refresh() {
    const res = await fetch("/api/admin/clients");
    const data = await res.json();
    if (data.ok) setClients(data.clients);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setCreated(null);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          loginId: form.loginId,
          email: form.email,
          sheetUrl: form.sheetUrl,
          maandbudget: Number(form.maandbudget),
          linkbuilding: Number(form.linkbuilding),
          uurtarief: Number(form.uurtarief),
          beschikbareUren: Number(form.beschikbareUren),
          grp: form.grp,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCreated({
          name: data.client.name,
          loginId: data.client.loginId,
          password: data.password,
          loginUrl: `${window.location.origin}/login`,
          shareUrl: data.shareToken ? `${window.location.origin}/k/${data.shareToken}` : undefined,
        });
        setForm({ ...EMPTY });
        await refresh();
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(data.error || "Aanmaken mislukt.");
      }
    } catch {
      setError("Aanmaken mislukt. Probeer het opnieuw.");
    }
    setBusy(false);
  }

  // Lead aanmaken: naam + website is genoeg. De rest (inlog, sheet, budget)
  // hoort bij een klant en komt pas als de lead er een wordt.
  async function onSubmitLead(e: React.FormEvent) {
    e.preventDefault();
    setLeadBusy(true); setError("");
    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "lead", name: leadForm.name, domain: leadForm.domain, email: leadForm.email }),
      });
      const data = await res.json();
      if (data.ok) {
        setLeadForm({ name: "", domain: "", email: "" });
        setShowLeadForm(false);
        await refresh();
        setNotice({ ok: true, text: `Lead "${data.client.name}" aangemaakt. Open hem om te beginnen.` });
      } else setError(data.error || "Lead aanmaken mislukt.");
    } catch { setError("Lead aanmaken mislukt."); } finally { setLeadBusy(false); }
  }

  // Fase omzetten. Alles wat aan het bedrijf hangt (chat, dossier, documenten)
  // blijft staan; alleen het label verandert.
  async function setFase(e: React.MouseEvent, c: ClientConfig, fase: string, vraag: string) {
    e.stopPropagation();
    if (!window.confirm(vraag)) return;
    try {
      const res = await fetch("/api/admin/clients", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: c.slug, action: "setFase", fase }),
      });
      const data = await res.json();
      if (data.ok) { await refresh(); setNotice({ ok: true, text: `${c.name} staat nu op ${fase}.` }); }
      else setError(data.error || "Fase omzetten mislukt.");
    } catch { setError("Fase omzetten mislukt."); }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  // Genereert een nieuw wachtwoord voor een klant (om te mailen); toont het één keer.
  async function resetPw(e: React.MouseEvent, c: ClientConfig) {
    e.stopPropagation();
    if (!window.confirm(`Nieuw wachtwoord voor ${c.name}? Het oude werkt daarna niet meer.`)) return;
    try {
      const res = await fetch("/api/admin/clients", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug: c.slug, action: "resetPassword" }) });
      const data = await res.json();
      if (data.ok) {
        setCreated({ name: c.name, loginId: c.loginId, password: data.password, loginUrl: `${window.location.origin}/login` });
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else setError(data.error || "Wachtwoord genereren mislukt.");
    } catch { setError("Wachtwoord genereren mislukt."); }
  }

  async function remove(e: React.MouseEvent, c: ClientConfig) {
    e.stopPropagation();
    const vraag = c.fase === "lead"
      ? `Lead "${c.name}" verwijderen? Het gesprek, het dossier en de documenten gaan mee weg.`
      : `Klant "${c.name}" verwijderen? Hun login werkt daarna niet meer.`;
    if (!window.confirm(vraag)) return;
    await fetch(`/api/admin/clients?slug=${encodeURIComponent(c.slug)}`, { method: "DELETE" });
    await refresh();
  }

  function openDashboard(c: ClientConfig) {
    router.push(`/admin/client/${c.slug}`);
  }

  // Slepen: de hele nieuwe volgorde van deze lijst (leads, of klanten) in één
  // keer naar de server, niet één verplaatsing. Zelfde patroon als de
  // tweak-wachtrij (TweaksClient.laatVallen).
  async function sleepVolgorde(lijst: ClientConfig[], doelId: number) {
    if (sleep === null || sleep === doelId) { setSleep(null); return; }
    const ids = lijst.map((c) => c.id);
    if (!ids.includes(sleep)) { setSleep(null); return; }
    const zonder = ids.filter((id) => id !== sleep);
    const plek = zonder.indexOf(doelId);
    zonder.splice(plek < 0 ? zonder.length : plek, 0, sleep);
    setSleep(null);
    setClients((all) => {
      const idSet = new Set(ids);
      const plekken = all.map((c, i) => (idSet.has(c.id) ? i : -1)).filter((i) => i >= 0);
      const nieuw = [...all];
      zonder.forEach((id, i) => { nieuw[plekken[i]] = all.find((c) => c.id === id)!; });
      return nieuw;
    });
    await fetch("/api/admin/clients/volgorde", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: zonder }),
    }).catch(() => {});
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }

  // De indeling komt uit lib/klant-groepen.ts, want vier schermen beantwoordden
  // deze vraag zelf en allemaal met "alles wat geen lead is, is een klant". Sinds
  // HubSpot deals aanlevert klopt dat niet meer: een deal die niet doorgaat wordt
  // "verloren", viel dus uit de leadlijst en kwam tussen de echte klanten te
  // staan. Zo groeide "Mijn eigen klanten" naar 124 rijen vol hosting- en
  // websitedeals (20-08-2026).
  const groepen = groepeerKlanten(clients);
  const leads = groepen.leads;
  const ownClients = groepen.eigen;
  const mmcClients = groepen.mmc;
  // De afgesloten deals en oud-klanten die groepeerKlanten teruggeeft worden hier
  // bewust NIET getoond: ze horen niet in een lijst waar je je werk van vandaag
  // zoekt, en ook niet in een dichtgeklapt blok eronder.

  // De optelling onder de leadlijst. Twee getallen per kolom, want ze zeggen
  // iets anders: opgeteld is wat het wordt als alles doorgaat, gewogen is wat je
  // er nuchter van mag verwachten (elk bedrag maal de kans van die lead).
  const kansVan = (slug: string) => {
    const t = (leadVeld[slug]?.kans ?? "").trim();
    const n = Number(t.replace(/[^\d]/g, ""));
    return t && Number.isFinite(n) ? Math.min(100, Math.max(0, n)) : LEAD_STANDAARD_KANS;
  };
  const eenmaligVan = (slug: string) => {
    const n = Number(String(leadVeld[slug]?.eenmalig ?? "").replace(/[^\d]/g, ""));
    return Number.isFinite(n) ? n : 0;
  };
  const totalen = leads.reduce(
    (t, c) => {
      const maand = Math.round(c.budget.maandbudget || 0);
      const eens = eenmaligVan(c.slug);
      const w = kansVan(c.slug) / 100;
      return {
        maand: t.maand + maand, maandGewogen: t.maandGewogen + maand * w,
        eens: t.eens + eens, eensGewogen: t.eensGewogen + eens * w,
      };
    },
    { maand: 0, maandGewogen: 0, eens: 0, eensGewogen: 0 },
  );
  const euro = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;

  const leadTable = (
    <div className="task-table-wrap">
      <table>
        <thead>
          <tr>
            {isOwner && <th></th>}<th>Bedrijf</th><th>Website</th>
            <th>Opvolgen</th><th>Kans</th><th>Budget p/m</th><th>Eenmalig</th><th>Verwacht klant</th><th></th>
          </tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr><td colSpan={isOwner ? 9 : 8} style={{ textAlign: "center", padding: "var(--s-10)", color: "var(--gray)" }}>
              Nog geen leads. Maak er een aan met alleen een naam en een website.
            </td></tr>
          )}
          {leads.map((c) => (
            <tr
              key={c.slug}
              className={"clickable-row" + (sleep === c.id ? " tw-item-sleept" : "")}
              onClick={() => openDashboard(c)}
              title="Open de leadomgeving"
              onDragOver={isOwner ? (e) => e.preventDefault() : undefined}
              onDrop={isOwner ? (e) => { e.preventDefault(); void sleepVolgorde(leads, c.id); } : undefined}
            >
              {isOwner && (
                <td onClick={(e) => e.stopPropagation()}>
                  <span
                    className="drag-handle tw-greep"
                    draggable
                    onDragStart={() => setSleep(c.id)}
                    onDragEnd={() => setSleep(null)}
                    title="Sleep om de volgorde te veranderen"
                  >
                    ⠿
                  </span>
                </td>
              )}
              <td><strong>{c.name}</strong> <span className="row-arrow"><PijlRechts /></span></td>
              <td>
                {c.domain
                  ? <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{c.domain}</a>
                  : <span className="muted">&mdash;</span>}
              </td>
              {/* Wanneer je hem weer moet spreken. Dat is het enige dat uit
                  HubSpot komt; de kolom die daar "zelf gemaakt" of de leadstatus
                  liet zien is eruit (20-08-2026), want die stond op elke rij
                  hetzelfde en zei dus niets. */}
              <td className={"lead-kolom-datum" + opvolgKlasse(hubspot[c.slug]?.opvolgDatum)}>
                {hubspot[c.slug]?.opvolgDatum
                  ? dagKort(hubspot[c.slug]?.opvolgDatum)
                  : <span className="muted">&mdash;</span>}
              </td>
              {/* Kans, maandbedrag, eenmalig bedrag en startmaand: alle vier van
                  jou, alle vier hier in te vullen. De rij zelf opent de
                  leadomgeving, dus elke klik in een veld moet daar stoppen. */}
              <td onClick={(e) => e.stopPropagation()}>
                {isOwner ? (
                  <span className="lead-kans-veld">
                    <input
                      className="prog-veld lead-veld-kans"
                      inputMode="numeric"
                      aria-label={`Hoe kansrijk is ${c.name}`}
                      value={leadVeld[c.slug]?.kans ?? ""}
                      placeholder={String(LEAD_STANDAARD_KANS)}
                      disabled={celBezig === `${c.slug}:kans`}
                      onChange={(e) => zetLeadVeld(c.slug, { kans: e.target.value.replace(/[^\d]/g, "").slice(0, 3) })}
                      onBlur={(e) => {
                        const n = Math.min(100, Math.max(0, Number(e.target.value.replace(/[^\d]/g, "")) || 0));
                        const tekst = e.target.value.trim() ? String(n) : "";
                        zetLeadVeld(c.slug, { kans: tekst });
                        if (tekst === "" || tekst === (bewaardVeld.current[c.slug]?.kans ?? "")) return;
                        bewaardVeld.current[c.slug] = { ...bewaardVeld.current[c.slug], kans: tekst };
                        void bewaarLead(c.slug, "kans", { actie: "prognose", kans: n });
                      }}
                    />
                    <span className="lead-kans-teken">%</span>
                  </span>
                ) : <span className="muted">{leadVeld[c.slug]?.kans || LEAD_STANDAARD_KANS}%</span>}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                {isOwner ? (
                  <input
                    className="prog-veld lead-veld-geld"
                    inputMode="numeric"
                    aria-label={`Beoogd maandbedrag van ${c.name}`}
                    defaultValue={c.budget.maandbudget ? String(Math.round(c.budget.maandbudget)) : ""}
                    placeholder="€"
                    disabled={celBezig === `${c.slug}:budget`}
                    onBlur={(e) => {
                      const nieuw = Math.max(0, Math.round(Number(e.target.value.replace(/[^\d]/g, "")) || 0));
                      if (nieuw === Math.round(c.budget.maandbudget || 0)) return;
                      void bewaarLead(c.slug, "budget", {
                        actie: "budget", maandbudget: nieuw, linkbuilding: c.budget.linkbuilding || 0,
                      });
                    }}
                  />
                ) : c.budget.maandbudget
                  ? euro(c.budget.maandbudget)
                  : <span className="muted">&mdash;</span>}
              </td>
              {/* Het eenmalige bedrag (meestal een website). Telt in de prognose
                  één keer mee, in de maand hiernaast. */}
              <td onClick={(e) => e.stopPropagation()}>
                {isOwner ? (
                  <input
                    className="prog-veld lead-veld-geld"
                    inputMode="numeric"
                    aria-label={`Eenmalig bedrag van ${c.name}`}
                    value={leadVeld[c.slug]?.eenmalig ?? ""}
                    placeholder="€"
                    disabled={celBezig === `${c.slug}:eenmalig`}
                    onChange={(e) => zetLeadVeld(c.slug, { eenmalig: e.target.value.replace(/[^\d]/g, "").slice(0, 7) })}
                    onBlur={(e) => {
                      const tekst = e.target.value.replace(/[^\d]/g, "");
                      if (tekst === (bewaardVeld.current[c.slug]?.eenmalig ?? "")) return;
                      bewaardVeld.current[c.slug] = { ...bewaardVeld.current[c.slug], eenmalig: tekst };
                      void bewaarLead(c.slug, "eenmalig", { actie: "prognose", eenmalig: Number(tekst) || 0 });
                    }}
                  />
                ) : eenmaligVan(c.slug)
                  ? euro(eenmaligVan(c.slug))
                  : <span className="muted">&mdash;</span>}
              </td>
              <td onClick={(e) => e.stopPropagation()}>
                {isOwner ? (
                  <input
                    className="prog-veld lead-veld-maand"
                    type="month"
                    aria-label={`Vanaf welke maand telt ${c.name} mee`}
                    value={leadVeld[c.slug]?.maand ?? ""}
                    disabled={celBezig === `${c.slug}:maand`}
                    onChange={(e) => zetLeadVeld(c.slug, { maand: e.target.value })}
                    onBlur={(e) => {
                      const nieuw = e.target.value || "";
                      if (nieuw === (bewaardVeld.current[c.slug]?.maand ?? "")) return;
                      bewaardVeld.current[c.slug] = { ...bewaardVeld.current[c.slug], maand: nieuw };
                      void bewaarLead(c.slug, "maand", { actie: "prognose", startMaand: nieuw });
                    }}
                  />
                ) : leadVeld[c.slug]?.maand
                  ? maandKort(leadVeld[c.slug]?.maand)
                  : <span className="muted">&mdash;</span>}
              </td>
              {/* Één knop om hem weg te zetten, niet twee. "Niet doorgegaan" en
                  "Verwijder" deden voor Maarten hetzelfde; de eerste blijft, want
                  die is terug te draaien en houdt de mailwisseling en het dossier
                  staan. Echt weggooien staat nu in de leadomgeving zelf, onderaan
                  de leadkaart: zeldzaam en onomkeerbaar, dus een klik dieper. */}
              <td style={{ whiteSpace: "nowrap" }}>
                {isOwner ? (
                  <>
                    <button className="btn btn-klein" onClick={(e) => setFase(e, c, "klant", `${c.name} omzetten naar klant? Alles blijft staan; alleen het label verandert.`)}>Maak klant</button>{" "}
                    <button className="btn btn-klein" onClick={(e) => setFase(e, c, "verloren", `${c.name} op "niet doorgegaan" zetten? Je kunt dat later terugdraaien.`)}>Niet doorgegaan</button>
                  </>
                ) : <span className="muted">&mdash;</span>}
              </td>
            </tr>
          ))}
        </tbody>
        {leads.length > 0 && (
          <tfoot>
            <tr className="lead-totaalrij">
              {isOwner && <td></td>}
              <td colSpan={3}>Alles bij elkaar</td>
              <td className="lead-totaal-kans">gewogen</td>
              <td>
                {euro(totalen.maand)}
                <span className="lead-totaal-gewogen">{euro(totalen.maandGewogen)} p/m</span>
              </td>
              <td>
                {euro(totalen.eens)}
                <span className="lead-totaal-gewogen">{euro(totalen.eensGewogen)} eenmalig</span>
              </td>
              <td colSpan={2}></td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );

  const clientTable = (list: ClientConfig[], emptyText: string) => (
    <div className="task-table-wrap">
      <table>
        <thead>
          <tr>
            {isOwner && <th></th>}
            <th>Bedrijf</th>
            <th>Inlognaam</th>
            <th>E-mail</th>
            <th>Maandfee</th>
            <th>Uurtarief</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {list.length === 0 && (
            <tr><td colSpan={isOwner ? 8 : 7} style={{ textAlign: "center", padding: "var(--s-10)", color: "var(--gray)" }}>{emptyText}</td></tr>
          )}
          {list.map((c) => (
            <Fragment key={c.slug}>
              <tr
                className={"clickable-row" + (sleep === c.id ? " tw-item-sleept" : "")}
                onClick={() => openDashboard(c)}
                title="Open de cockpit van deze klant"
                onDragOver={isOwner ? (e) => e.preventDefault() : undefined}
                onDrop={isOwner ? (e) => { e.preventDefault(); void sleepVolgorde(list, c.id); } : undefined}
              >
                {isOwner && (
                  <td onClick={(e) => e.stopPropagation()}>
                    <span
                      className="drag-handle tw-greep"
                      draggable
                      onDragStart={() => setSleep(c.id)}
                      onDragEnd={() => setSleep(null)}
                      title="Sleep om de volgorde te veranderen"
                    >
                      ⠿
                    </span>
                  </td>
                )}
                <td>
                  <strong>{c.name}</strong>
                  {overdue[c.slug] && (
                    <span
                      className="invoice-badge"
                      title={`${overdue[c.slug].count} factu${overdue[c.slug].count === 1 ? "ur staat" : "ren staan"} langer dan 30 dagen open (€ ${overdue[c.slug].total.toLocaleString("nl-NL", { minimumFractionDigits: 2 })})`}
                    >!</span>
                  )}
                  {onb[c.slug] && onb[c.slug].totaal > 0 && (
                    <>
                      {" "}
                      <span
                        className={"ob-signaal" + (onb[c.slug].klaar ? " ob-signaal-klaar" : "")}
                        title={onb[c.slug].klaar
                          ? "De onboarding is compleet."
                          : `Nog te doen: ${onb[c.slug].mist.join(", ")}.`}
                      >{onb[c.slug].klaar ? "onboarding compleet" : `onboarding ${onb[c.slug].af}/${onb[c.slug].totaal}`}</span>
                    </>
                  )}
                  {" "}<span className="row-arrow"><PijlRechts /></span>
                </td>
                <td>{c.loginEnabled ? c.loginId : <span className="muted">geen login</span>}</td>
                <td>{c.email || <span className="muted">&mdash;</span>}</td>
                <td>&euro;{c.budget.maandbudget.toFixed(0)}{c.budget.linkbuilding ? <span className="muted"> (w.v. &euro;{c.budget.linkbuilding.toFixed(0)} LB)</span> : null}</td>
                <td>&euro;{c.budget.uurtarief.toFixed(0)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {isOwner ? (
                    <>
                      <button className="btn btn-klein" onClick={(e) => openEdit(e, c)}>Budget</button>{" "}
                      <button className="btn btn-klein" onClick={(e) => resetPw(e, c)}>Nieuw wachtwoord</button>{" "}
                      <button className="btn btn-klein" onClick={(e) => remove(e, c)}>Verwijder</button>
                    </>
                  ) : (
                    <span className="muted">&mdash;</span>
                  )}
                </td>
              </tr>
              {editSlug === c.slug && (
                <tr onClick={(e) => e.stopPropagation()}>
                  <td colSpan={7} style={{ background: "var(--gray-light)" }}>
                    <div className="budget-edit">
                      <div className="budget-edit-title">Budget aanpassen voor {c.name}</div>
                      <div className="budget-edit-grid">
                        <label>Maandfee (&euro;, incl. linkbuilding)
                          <input type="number" value={editForm.maandbudget} onChange={(e) => editSet("maandbudget", e.target.value)} />
                        </label>
                        <label>Standaard linkbuilding per maand (&euro;)
                          <input type="number" value={editForm.linkbuilding} onChange={(e) => editSet("linkbuilding", e.target.value)} />
                        </label>
                        <label>Uurtarief (&euro;)
                          <input type="number" value={editForm.uurtarief} onChange={(e) => editSet("uurtarief", e.target.value)} />
                        </label>
                      </div>
                      <div className="hint" style={{ marginTop: "var(--s-2)" }}>De beschikbare uren worden per maand berekend uit (maandfee &minus; linkbuilding) / uurtarief. Wil je de linkbuilding voor één specifieke maand afwijkend zetten, doe dat in de Werkzaamheden-tab bij die maand; dan passen alleen de uren van die maand zich aan.</div>
                      <div className="budget-edit-actions">
                        <button className="btn btn-primary btn-klein" onClick={(e) => saveBudget(e, c)} disabled={editBusy}>{editBusy ? "Opslaan…" : "Opslaan"}</button>
                        <button className="btn btn-klein" onClick={(e) => { e.stopPropagation(); setEditSlug(null); }}>Annuleren</button>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );

  // Het formulier voor een nieuwe klant hoort bij de klantenlijst, dus het
  // staat in dát blok. Hier alleen opgeschreven; hierboven wordt het getoond.
  const klantForm = (
          <form className="admin-form" onSubmit={onSubmit}>
            <div className="form-grid">
              <div className="field">
                <label>Bedrijfsnaam</label>
                <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Bedrijfsnaam van de klant" required />
              </div>
              <div className="field">
                <label>Inlognaam (geen spaties)</label>
                <input value={form.loginId} onChange={(e) => set("loginId", e.target.value)} placeholder="inlognaam-zonder-spaties" required />
              </div>
              <div className="field">
                <label>E-mailadres klant</label>
                <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@klant.nl" />
              </div>
              {showGroups && (
                <div className="field">
                  <label>Groep</label>
                  <select className="compose-input" value={form.grp} onChange={(e) => set("grp", e.target.value)}>
                    <option value="">Mijn eigen klanten</option>
                    <option value="mmc">Multimedia Concepts (cockpit-only, geen login)</option>
                  </select>
                </div>
              )}
              <div className="field field-wide">
                <label>Google Sheet-link (optioneel; alleen voor oude klanten met een Sheet, nieuwe klanten werken met taken)</label>
                <input value={form.sheetUrl} onChange={(e) => set("sheetUrl", e.target.value)} placeholder="Leeg laten bij de taken-werkwijze" />
              </div>
              <div className="field">
                <label>Maandfee (&euro;, incl. linkbuilding)</label>
                <input type="number" value={form.maandbudget} onChange={(e) => set("maandbudget", e.target.value)} placeholder="1800" required={form.grp !== "mmc"} />
              </div>
              <div className="field">
                <label>Linkbuilding-budget (&euro;)</label>
                <input type="number" value={form.linkbuilding} onChange={(e) => set("linkbuilding", e.target.value)} placeholder="600" required={form.grp !== "mmc"} />
              </div>
              <div className="field">
                <label>Uurtarief (&euro;)</label>
                <input type="number" value={form.uurtarief} onChange={(e) => set("uurtarief", e.target.value)} placeholder="100" required={form.grp !== "mmc"} />
              </div>
              <div className="field">
                <label>Beschikbare uren per maand</label>
                <input type="number" value={form.beschikbareUren} onChange={(e) => set("beschikbareUren", e.target.value)} placeholder="12" required={form.grp !== "mmc"} />
              </div>
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="btn btn-primary" disabled={busy}>
              {busy ? "Bezig..." : "Klant aanmaken + wachtwoord genereren"}
            </button>
          </form>
  );

  return (
    <>
      <div className="header">
        <div className="header-left">
          <a href="/admin" className="logo-link" title="Naar het klantenoverzicht">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
          </a>
          <div className="header-divider" />
          <div>
            <div className="header-title">Pingwin SEO Dashboard</div>
            <div className="header-client">Beheer</div>
          </div>
        </div>
        <div className="header-right">
          {/* De losse Routekaart-knop stond hier alleen op dit scherm. Hij zit nu in
              het ontwikkelmenu, dat op élk adminscherm staat en de eerstvolgende taak
              meteen bij de hand heeft. Twee ingangen naar hetzelfde scherm is een
              keuze die niemand hoeft te maken. */}
          <MeldingenMenu />
          <Tellers />
        <OntwikkelMenu />
          {isOwner && (
            <a className="btn btn-klein" href="/admin/beheer" title="Klanten en teamgebruikers beheren" style={{ marginLeft: "var(--s-2)" }}>Beheer</a>
          )}
          {(isOwner || canDev) && (
            <a className="btn btn-klein" href="/admin/developer" title="Alle developer-taken over alle klanten" style={{ marginLeft: "var(--s-2)" }}>Developer</a>
          )}
          {isOwner && (
            <a className="btn btn-klein" href="/admin/usage" title="AI-verbruik en kosten per actie en per klant" style={{ marginLeft: "var(--s-2)" }}>Verbruik</a>
          )}
          {isOwner && (
            <a className="btn btn-klein" href="/admin/claude-werkwijze" title="Geheugensteun voor het werken met Claude zelf" style={{ marginLeft: "var(--s-2)" }}>Claude-werkwijze</a>
          )}
          {/* Financiën is Maartens privé-administratie: alleen tonen in de wereld
              waar Moneybird gekoppeld is (Pingwin), nooit in MMC/NOC. */}
          {isOwner && showFinance && (
            <a className="btn btn-klein" href="/admin/financien" title="Opbrengsten en kosten uit Moneybird, met openstaande facturen" style={{ marginLeft: "var(--s-2)" }}>Financi&euml;n</a>
          )}
          <button className="btn btn-klein" onClick={logout} style={{ marginLeft: "var(--s-2)" }}>Uitloggen</button>
        </div>
      </div>

      <div className="container">
        {notice && (
          <div className={notice.ok ? "saved-msg" : "login-error"} style={{ marginBottom: "var(--s-4)" }}>
            {notice.text}
          </div>
        )}

        {created && (
          <div className="created-box">
            <div className="created-title">Toegang voor {created.name}</div>
            {created.shareUrl ? (
              <>
                <p>Stuur de klant deze deelbare link: die opent het dashboard direct, zonder inloggen. Dit is de standaard werkwijze.</p>
                <div className="cred-row"><span>Deelbare link</span><code>{created.shareUrl}</code>
                  <button className="btn btn-klein" onClick={() => copy(created.shareUrl!)}>Kopieer</button></div>
                <p className="created-hint" style={{ marginTop: "var(--s-4)" }}>
                  Wil de klant tóch met een eigen login werken? Deze gegevens zie je maar één keer:
                </p>
              </>
            ) : (
              <p>Geef deze gegevens aan de klant (het wachtwoord zie je maar één keer). Deze login is alleen voor het klantdashboard.</p>
            )}
            <div className="cred-row"><span>Link</span><code>{created.loginUrl}</code>
              <button className="btn btn-klein" onClick={() => copy(created.loginUrl)}>Kopieer</button></div>
            <div className="cred-row"><span>Inlognaam</span><code>{created.loginId}</code>
              <button className="btn btn-klein" onClick={() => copy(created.loginId)}>Kopieer</button></div>
            <div className="cred-row"><span>Wachtwoord</span><code>{created.password}</code>
              <button className="btn btn-klein" onClick={() => copy(created.password)}>Kopieer</button></div>
            <p className="created-hint">
              Automatisch mailen naar de klant volgt in de volgende stap (Resend + DNS).
            </p>
          </div>
        )}

        {/* Leads: eigen lijst boven de klanten. Een lead is dezelfde soort rij
            als een klant, maar zonder inlog, sheet en budget.
            Dit blok en de klantenlijst staan open zodra het scherm laadt
            (20-08-2026). Ze waren dicht om de pagina rustig te houden, maar dit
            zijn precies de twee lijsten waarvoor je hier komt, en in de leadlijst
            vul je nu ook bedragen en startmaanden in; dan is elke keer twee keer
            klikken voordat je iets ziet geen rust maar een drempel. De blokken
            eronder (Multimedia Concepts, onboarding, klantwaarde, meekijken)
            blijven wél dicht. */}
        <Vouwblok
          titel="Leads"
          icoon={<Vlag />}
          aantal={leads.length}
          standaardOpen
          actie={isOwner ? (openen) => (
            <button type="button" className="btn btn-klein" onClick={() => { openen(); setShowLeadForm((v) => !v); }}>
              {showLeadForm ? "− Formulier sluiten" : "+ Nieuwe lead"}
            </button>
          ) : undefined}
        >
        {isOwner && opruimen.length > 0 && (
          <div className="lead-opruimbalk">
            <span>
              <strong>{opruimen.length} bedrijven</strong> hieronder komen uit een oude ophaalronde op je deals en horen
              hier niet: er is niets mee gedaan en er staat geen bedrag bij.
            </span>
            <button type="button" className="btn btn-danger btn-klein" disabled={opruimBezig} onClick={ruimOp}>
              {opruimBezig ? "Bezig met opruimen…" : `Opruimen (${opruimen.length})`}
            </button>
          </div>
        )}
        {leadTable}
        {isOwner && showLeadForm && (
          <form className="admin-form" style={{ marginTop: "var(--s-4)" }} onSubmit={onSubmitLead}>
            <div className="form-grid">
              <div className="field">
                <label>Bedrijfsnaam</label>
                <input value={leadForm.name} onChange={(e) => setLeadForm((f) => ({ ...f, name: e.target.value }))} placeholder="Tudor Kozijnen" required />
              </div>
              <div className="field">
                <label>Website</label>
                <input value={leadForm.domain} onChange={(e) => setLeadForm((f) => ({ ...f, domain: e.target.value }))} placeholder="tudorkozijnen.nl" />
              </div>
              <div className="field">
                <label>E-mailadres (optioneel)</label>
                <input type="email" value={leadForm.email} onChange={(e) => setLeadForm((f) => ({ ...f, email: e.target.value }))} placeholder="contact@bedrijf.nl" />
              </div>
            </div>
            <div className="hint" style={{ marginBottom: "var(--s-3)" }}>
              Meer is niet nodig. Een lead krijgt geen inlog, geen Google Sheet en geen budget; dat komt pas als hij klant wordt.
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="btn btn-primary" disabled={leadBusy}>
              {leadBusy ? "Bezig…" : "Lead aanmaken"}
            </button>
          </form>
        )}
        </Vouwblok>

        {/* De knop "Nieuwe klant aanmaken" hoort bij de klantenlijst en staat dus
            rechts in de kopbalk van dát blok, niet los onderaan de pagina. */}
        <Vouwblok
          titel={showGroups && mmcClients.length > 0 ? "Mijn eigen klanten" : "Klanten"}
          icoon={<Mensen />}
          aantal={ownClients.length}
          standaardOpen
          actie={isOwner ? (openen) => (
            <button type="button" className="btn btn-klein" onClick={() => { openen(); setShowForm((v) => !v); }}>
              {showForm ? "− Formulier sluiten" : "+ Nieuwe klant"}
            </button>
          ) : undefined}
        >
          {clientTable(ownClients, "Nog geen klanten.")}
          {isOwner && showForm && klantForm}
        </Vouwblok>

        {showGroups && mmcClients.length > 0 && (
          <Vouwblok titel="Multimedia Concepts" aantal={mmcClients.length} icoon={<Gebouw />}>
            <div className="mmc-list">{clientTable(mmcClients, "Nog geen Multimedia Concepts-klanten.")}</div>
          </Vouwblok>
        )}

        {/* Hier stond even een dichtgeklapt blok met de afgesloten deals en
            oud-klanten erin. Dat is er weer uit (20-08-2026): "ik heb niks aan
            oude klanten, ik heb niks aan deals die door HubSpot aangeleverd
            worden." Een blok dat je nooit opent is geen naslag maar een regel
            ruis op je startscherm.
            Ze zijn niet weg uit de database; opruimen kan met de knop op
            /admin/beheer, die precies de leads weghaalt waar niets mee gedaan
            is. En de kraan zelf staat nu dicht: de HubSpot-ronde levert geen
            deals meer aan (zie lib/hubspot-leads.ts). */}

        {isOwner && <BulkOnboarding />}

        {isOwner && <KlantwaardeBulk />}

        {isOwner && <KijkSleutel />}

      </div>

      <div className="footer">
        Pingwin Online Marketing &middot; Beheer
      </div>
    </>
  );
}
