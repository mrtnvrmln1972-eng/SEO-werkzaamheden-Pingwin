"use client";

import { Fragment, useEffect, useState } from "react";
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
import LeadLijst, { MaandStrook, type HubspotStand } from "./LeadLijst";
import { BedragVeld } from "./RijVeld";
import { useExtraRegels, RegelNaam, RegelSoortKeuze, RegelBedrag, RegelWeg } from "./ExtraRegels";
import KijkSleutel from "./KijkSleutel";
import { Gebouw, Kruis, Mensen, PijlRechts, Vlag } from "../_ui/Pijl";

/** De vier soorten waar een regel onder kan vallen. */
type SoortKeuze = "seo" | "ads" | "website" | "overig";
const SOORT_KEUZE: { waarde: SoortKeuze; label: string }[] = [
  { waarde: "seo", label: "SEO" },
  { waarde: "ads", label: "Advertenties" },
  { waarde: "website", label: "Website" },
  { waarde: "overig", label: "Overig" },
];

type Created = { name: string; loginId: string; password: string; loginUrl: string; shareUrl?: string };





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

  // Waar de maandfee van een klant onder valt (SEO, advertenties, website of
  // overig). Staat in de prognose-regel van die klant, want daar rekent de
  // uitsplitsing van de maandstrook mee.
  const [soortVan, setSoortVan] = useState<Record<string, SoortKeuze>>({});

  async function bewaarSoort(slug: string, soort: SoortKeuze) {
    setSoortVan((m) => ({ ...m, [slug]: soort }));
    await fetch(`/api/admin/lead-hubspot?slug=${encodeURIComponent(slug)}`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actie: "prognose", soort }),
    }).catch(() => null);
    setHertel((n) => n + 1);
  }

  // Elke keer dat er een bedrag verandert telt de maandstrook opnieuw. Eén
  // teller, gedeeld door de leadlijst en de klantenlijst, zodat er niet twee
  // manieren ontstaan om hetzelfde te zeggen.
  const [hertel, setHertel] = useState(0);
  const extra = useExtraRegels(isOwner, () => setHertel((n) => n + 1));

  // De soorten van de klantrijen ophalen; het staat bij de prognose-regels.
  useEffect(() => {
    if (!isOwner) return;
    let alive = true;
    (async () => {
      try {
        const d = await fetch("/api/admin/prognose?regels=1").then((r) => r.json());
        if (!d?.ok || !alive || !d.regels) return;
        const map: Record<string, SoortKeuze> = {};
        for (const [slug, r] of Object.entries(d.regels as Record<string, { soort?: SoortKeuze }>)) {
          if (r?.soort) map[slug] = r.soort;
        }
        setSoortVan(map);
      } catch { /* stil: dan staat overal SEO */ }
    })();
    return () => { alive = false; };
  }, [isOwner]);

  /** Eén bedrag uit een klantrij bewaren en de lijst opnieuw laden. */
  async function bewaarBedrag(slug: string, body: Record<string, unknown>) {
    setError("");
    try {
      const d = await fetch("/api/admin/clients", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...body }),
      }).then((r) => r.json());
      if (!d?.ok) setNotice({ ok: false, text: d?.error || "Opslaan lukte niet." });
      else { await refresh(); setHertel((n) => n + 1); }
    } catch { setNotice({ ok: false, text: "Opslaan lukte niet." }); }
  }

  /** Een bedrag zoals het in een lijst hoort: "€ 1.500", nul blijft "€ 0". */
  const euroKort = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;

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
  const clientTable = (list: ClientConfig[], emptyText: string) => (
    <div className="task-table-wrap">
      <table>
        <thead>
          <tr>
            {isOwner && <th></th>}
            <th>Bedrijf</th>
            <th>Soort</th>
            <th>Inlognaam</th>
            <th>Maandfee</th>
            <th>Kosten p/m</th>
            <th>Netto p/m</th>
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
                className={sleep === c.id ? "tw-item-sleept" : undefined}
                onDragOver={isOwner ? (e) => e.preventDefault() : undefined}
                onDrop={isOwner ? (e) => { e.preventDefault(); void sleepVolgorde(list, c.id); } : undefined}
              >
                {isOwner && (
                  <td>
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
                {/* Alleen deze kolom opent de cockpit, niet de hele rij: de rest
                    van de rij is invulvakjes, en daarin klikken hoorde je nooit
                    de pagina uit te sturen (21-08-2026, zelfde regel als bij de
                    leads eronder). */}
                <td className="rij-open-cel" onClick={() => openDashboard(c)} title="Open de cockpit van deze klant">
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
                <td>
                  {isOwner ? (
                    <select
                      className="prog-veld regel-soort-veld"
                      aria-label={`Waar valt de maandfee van ${c.name} onder`}
                      value={soortVan[c.slug] || "seo"}
                      onChange={(e) => bewaarSoort(c.slug, e.target.value as SoortKeuze)}
                    >
                      {SOORT_KEUZE.map((s) => <option key={s.waarde} value={s.waarde}>{s.label}</option>)}
                    </select>
                  ) : <span className="muted">{soortVan[c.slug] || "seo"}</span>}
                </td>
                <td>{c.loginEnabled ? c.loginId : <span className="muted">geen login</span>}</td>
                {/* De maandfee en de kosten vul je hier in de rij in, net als bij
                    de leads; netto rekent zichzelf uit. Het uitklapvak met
                    maandfee, linkbuilding en uurtarief is daarmee weg
                    (20-08-2026), en het uurtarief ook: dat stuurde alleen de
                    berekende uren en Maarten stuurt op geld, niet op uren. */}
                <td>
                  {isOwner ? (
                    <BedragVeld
                      waarde={c.budget.maandbudget}
                      label={`Maandfee van ${c.name}`}
                      opslaan={(n) => bewaarBedrag(c.slug, { action: "setBedragen", maandbudget: n })}
                    />
                  ) : <>&euro;{c.budget.maandbudget.toFixed(0)}</>}
                </td>
                <td>
                  {isOwner ? (
                    <BedragVeld
                      waarde={c.budget.linkbuilding}
                      label={`Kosten per maand voor ${c.name}`}
                      opslaan={(n) => bewaarBedrag(c.slug, { action: "setBedragen", linkbuilding: n })}
                    />
                  ) : <>&euro;{c.budget.linkbuilding.toFixed(0)}</>}
                </td>
                <td>
                  <span className="lead-totaal-bedrag">{euroKort(c.budget.maandbudget - c.budget.linkbuilding)}</span>
                </td>
                <td className="lead-acties">
                  {isOwner ? (
                    <>
                      <button className="btn btn-klein" title="Nog een regel voor dit bedrijf: dezelfde rij, leeg, zodat je er de website of Google Ads van kunt maken"
                        onClick={(e) => { e.stopPropagation(); void extra.voegToe(c.slug); }}>+ regel</button>
                      <button className="lead-kruis" title="Verwijder deze klant"
                        aria-label={`${c.name} verwijderen`} onClick={(e) => remove(e, c)}><Kruis /></button>
                    </>
                  ) : (
                    <span className="muted">&mdash;</span>
                  )}
                </td>
              </tr>
              {/* Wat er bij dit bedrijf nog meer loopt: de website, advertenties,
                  hosting. Eigen bedrag en eigen kosten, en de prognose rekent
                  ermee alsof het een eigen klant is. */}
              {extra.perSlug(c.slug).map((r) => (
                <tr key={`r-${r.id}`} className="regel-rij">
                  {isOwner && <td></td>}
                  <td><RegelNaam naam={c.name} domein={c.domain} /></td>
                  <td><RegelSoortKeuze regel={r} bewaar={extra.bewaar} /></td>
                  <td></td>
                  <td><RegelBedrag regel={r} veld="bedrag" label={`Bedrag per maand van ${r.naam || "deze regel"}`} bewaar={extra.bewaar} /></td>
                  <td><RegelBedrag regel={r} veld="kosten" label={`Kosten per maand van ${r.naam || "deze regel"}`} bewaar={extra.bewaar} /></td>
                  <td><span className="lead-totaal-bedrag">{euroKort(r.bedrag - r.kosten)}</span></td>
                  <td className="lead-acties"><RegelWeg regel={r} verwijder={extra.verwijder} /></td>
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
        {/* Dezelfde optelling als onder de leads: wat komt er per maand binnen,
            wat gaat eraf, en wat blijft er over. */}
        {list.length > 0 && (
          <tfoot>
            <tr className="lead-totaalrij">
              {isOwner && <td></td>}
              <td colSpan={3}>Alles bij elkaar</td>
              {/* De extra regels tellen mee, anders klopt de streep eronder niet. */}
              <td><span className="lead-totaal-bedrag">{euroKort(list.reduce((t, c) => t + (c.budget.maandbudget || 0) + extra.perSlug(c.slug).reduce((n, r) => n + r.bedrag, 0), 0))}</span></td>
              <td><span className="lead-totaal-bedrag">{euroKort(list.reduce((t, c) => t + (c.budget.linkbuilding || 0) + extra.perSlug(c.slug).reduce((n, r) => n + r.kosten, 0), 0))}</span></td>
              <td><span className="lead-totaal-bedrag">{euroKort(list.reduce((t, c) => t + (c.budget.maandbudget || 0) - (c.budget.linkbuilding || 0) + extra.perSlug(c.slug).reduce((n, r) => n + r.bedrag - r.kosten, 0), 0))}</span></td>
              <td></td>
            </tr>
          </tfoot>
        )}
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
        {/* Het formulier staat bóven de lijst: met zestien leads eronder zag je
            hem niet en leek de knop niets te doen (20-08-2026). */}
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
        <LeadLijst
          leads={leads} isOwner={isOwner} hubspot={hubspot}
          sleep={sleep} setSleep={setSleep} sleepVolgorde={sleepVolgorde}
          openDashboard={openDashboard} setFase={setFase} refresh={refresh}
          melden={(m) => setNotice(m)} setHertel={setHertel}
        />
        </Vouwblok>

        <MaandStrook isOwner={isOwner} hertel={`${clients.length}-${hertel}`} />

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
          {isOwner && showForm && klantForm}
          {clientTable(ownClients, "Nog geen klanten.")}
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
