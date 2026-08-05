"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientConfig } from "../../lib/clients";

type Created = { name: string; loginId: string; password: string; loginUrl: string; shareUrl?: string };

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

function KijkSleutel() {
  const [status, setStatus] = useState<KijkStatus | null>(null);
  const [sleutel, setSleutel] = useState("");
  const [bezig, setBezig] = useState(false);
  const [open, setOpen] = useState(false);
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
    if (status?.actief && !window.confirm("Er is al een sleutel. Een nieuwe maken trekt de oude in; Claude komt er dan pas weer bij als je de nieuwe in je Claude-omgeving zet.\n\nDoorgaan?")) return;
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
    "andere-sleutel": "hij gebruikte een oudere sleutel. Maak hieronder een nieuwe en zet die in je Claude-omgeving.",
    leeg: "er kwam geen sleutel mee. Controleer of PINGWIN_KIJK_SLEUTEL in je Claude-omgeving staat.",
  };

  return (
    <div className="kijk-kaart">
      <button type="button" className="kijk-kop" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        <span>{open ? "▾" : "▸"} Claude laten meekijken</span>
        <span className={"kijk-stand" + (status?.actief ? " kijk-stand-aan" : "")}>
          {status === null ? "…" : status.actief ? "staat aan" : "staat uit"}
        </span>
      </button>

      {open && (
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
                className="logout-btn"
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
                <li>Opslaan. Het geldt vanaf je volgende sessie.</li>
              </ol>
            </div>
          )}

          <div className="kijk-knoppen">
            <button type="button" className="logout-btn" disabled={bezig} onClick={() => void maak()}>
              {bezig ? "Bezig…" : status?.actief ? "Nieuwe sleutel maken" : "Zet meekijken aan"}
            </button>
            {status?.actief && (
              <button type="button" className="logout-btn" disabled={bezig} onClick={() => void trekIn()}>Intrekken</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
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

export default function AdminClient({ initialClients, isOwner = true, showGroups = false, showFinance = false }: { initialClients: ClientConfig[]; isOwner?: boolean; showGroups?: boolean; showFinance?: boolean }) {
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

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }

  // Leads staan in een eigen lijst; ze hebben geen inlog, sheet of budget en
  // horen dus niet tussen de klantkolommen. De klantlijsten blijven precies
  // zoals ze waren (eigen klanten en, in de Pingwin-wereld, Multimedia Concepts).
  const leads = clients.filter((c) => c.fase === "lead");
  const klanten = clients.filter((c) => c.fase !== "lead");
  const ownClients = klanten.filter((c) => c.grp !== "mmc");
  const mmcClients = klanten.filter((c) => c.grp === "mmc");

  const leadTable = (
    <div className="task-table-wrap">
      <table>
        <thead>
          <tr><th>Bedrijf</th><th>Website</th><th>E-mail</th><th></th></tr>
        </thead>
        <tbody>
          {leads.length === 0 && (
            <tr><td colSpan={4} style={{ textAlign: "center", padding: 40, color: "var(--gray)" }}>
              Nog geen leads. Maak er een aan met alleen een naam en een website.
            </td></tr>
          )}
          {leads.map((c) => (
            <tr key={c.slug} className="clickable-row" onClick={() => openDashboard(c)} title="Open de leadomgeving">
              <td><strong>{c.name}</strong> <span className="row-arrow">&rarr;</span></td>
              <td>
                {c.domain
                  ? <a href={`https://${c.domain}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>{c.domain}</a>
                  : <span className="muted">&mdash;</span>}
              </td>
              <td>{c.email || <span className="muted">&mdash;</span>}</td>
              <td style={{ whiteSpace: "nowrap" }}>
                {isOwner ? (
                  <>
                    <button className="mini-btn" onClick={(e) => setFase(e, c, "klant", `${c.name} omzetten naar klant? Alles blijft staan; alleen het label verandert.`)}>Maak klant</button>{" "}
                    <button className="mini-btn" onClick={(e) => setFase(e, c, "verloren", `${c.name} op "niet doorgegaan" zetten? Je kunt dat later terugdraaien.`)}>Niet doorgegaan</button>{" "}
                    <button className="mini-btn" onClick={(e) => remove(e, c)}>Verwijder</button>
                  </>
                ) : <span className="muted">&mdash;</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const clientTable = (list: ClientConfig[], emptyText: string) => (
    <div className="task-table-wrap">
      <table>
        <thead>
          <tr>
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
            <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--gray)" }}>{emptyText}</td></tr>
          )}
          {list.map((c) => (
            <Fragment key={c.slug}>
              <tr className="clickable-row" onClick={() => openDashboard(c)} title="Open de cockpit van deze klant">
                <td>
                  <strong>{c.name}</strong>
                  {overdue[c.slug] && (
                    <span
                      className="invoice-badge"
                      title={`${overdue[c.slug].count} factu${overdue[c.slug].count === 1 ? "ur staat" : "ren staan"} langer dan 30 dagen open (€ ${overdue[c.slug].total.toLocaleString("nl-NL", { minimumFractionDigits: 2 })})`}
                    >!</span>
                  )}
                  {" "}<span className="row-arrow">&rarr;</span>
                </td>
                <td>{c.loginEnabled ? c.loginId : <span className="muted">geen login</span>}</td>
                <td>{c.email || <span className="muted">&mdash;</span>}</td>
                <td>&euro;{c.budget.maandbudget.toFixed(0)}{c.budget.linkbuilding ? <span className="muted"> (w.v. &euro;{c.budget.linkbuilding.toFixed(0)} LB)</span> : null}</td>
                <td>&euro;{c.budget.uurtarief.toFixed(0)}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  {isOwner ? (
                    <>
                      <button className="mini-btn" onClick={(e) => openEdit(e, c)}>Budget</button>{" "}
                      <button className="mini-btn" onClick={(e) => resetPw(e, c)}>Nieuw wachtwoord</button>{" "}
                      <button className="mini-btn" onClick={(e) => remove(e, c)}>Verwijder</button>
                    </>
                  ) : (
                    <span className="muted">&mdash;</span>
                  )}
                </td>
              </tr>
              {editSlug === c.slug && (
                <tr onClick={(e) => e.stopPropagation()}>
                  <td colSpan={6} style={{ background: "var(--gray-light)" }}>
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
                      <div className="hint" style={{ marginTop: 8 }}>De beschikbare uren worden per maand berekend uit (maandfee &minus; linkbuilding) / uurtarief. Wil je de linkbuilding voor één specifieke maand afwijkend zetten, doe dat in de Werkzaamheden-tab bij die maand; dan passen alleen de uren van die maand zich aan.</div>
                      <div className="budget-edit-actions">
                        <button className="primary-btn small" onClick={(e) => saveBudget(e, c)} disabled={editBusy}>{editBusy ? "Opslaan…" : "Opslaan"}</button>
                        <button className="ghost-btn small" onClick={(e) => { e.stopPropagation(); setEditSlug(null); }}>Annuleren</button>
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
          {isOwner && (
            <a className="logout-btn" href="/admin/beheer" title="Klanten en teamgebruikers beheren">Beheer</a>
          )}
          {isOwner && (
            <a className="logout-btn" href="/admin/developer" title="Alle developer-taken over alle klanten" style={{ marginLeft: 8 }}>Developer</a>
          )}
          {isOwner && (
            <a className="logout-btn" href="/admin/usage" title="AI-verbruik en kosten per actie en per klant" style={{ marginLeft: 8 }}>Verbruik</a>
          )}
          {/* Financiën is Maartens privé-administratie: alleen tonen in de wereld
              waar Moneybird gekoppeld is (Pingwin), nooit in MMC/NOC. */}
          {isOwner && showFinance && (
            <a className="logout-btn" href="/admin/financien" title="Opbrengsten en kosten uit Moneybird, met openstaande facturen" style={{ marginLeft: 8 }}>Financi&euml;n</a>
          )}
          <button className="logout-btn" onClick={logout} style={{ marginLeft: 8 }}>Uitloggen</button>
        </div>
      </div>

      <div className="container">
        {notice && (
          <div className={notice.ok ? "saved-msg" : "login-error"} style={{ marginBottom: 16 }}>
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
                  <button className="mini-btn" onClick={() => copy(created.shareUrl!)}>Kopieer</button></div>
                <p className="created-hint" style={{ marginTop: 14 }}>
                  Wil de klant tóch met een eigen login werken? Deze gegevens zie je maar één keer:
                </p>
              </>
            ) : (
              <p>Geef deze gegevens aan de klant (het wachtwoord zie je maar één keer). Deze login is alleen voor het klantdashboard.</p>
            )}
            <div className="cred-row"><span>Link</span><code>{created.loginUrl}</code>
              <button className="mini-btn" onClick={() => copy(created.loginUrl)}>Kopieer</button></div>
            <div className="cred-row"><span>Inlognaam</span><code>{created.loginId}</code>
              <button className="mini-btn" onClick={() => copy(created.loginId)}>Kopieer</button></div>
            <div className="cred-row"><span>Wachtwoord</span><code>{created.password}</code>
              <button className="mini-btn" onClick={() => copy(created.password)}>Kopieer</button></div>
            <p className="created-hint">
              Automatisch mailen naar de klant volgt in de volgende stap (Resend + DNS).
            </p>
          </div>
        )}

        {/* Leads: eigen lijst boven de klanten. Een lead is dezelfde soort rij
            als een klant, maar zonder inlog, sheet en budget. */}
        <div className="section-title">Leads ({leads.length})</div>
        {leadTable}
        {isOwner && (
          <div style={{ marginTop: 12 }}>
            <button type="button" className="logout-btn" onClick={() => setShowLeadForm((v) => !v)}>
              {showLeadForm ? "− Formulier sluiten" : "+ Nieuwe lead"}
            </button>
          </div>
        )}
        {isOwner && showLeadForm && (
          <form className="admin-form" style={{ marginTop: 16 }} onSubmit={onSubmitLead}>
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
            <div className="hint" style={{ marginBottom: 12 }}>
              Meer is niet nodig. Een lead krijgt geen inlog, geen Google Sheet en geen budget; dat komt pas als hij klant wordt.
            </div>
            {error && <div className="login-error">{error}</div>}
            <button type="submit" className="primary-btn" disabled={leadBusy}>
              {leadBusy ? "Bezig…" : "Lead aanmaken"}
            </button>
          </form>
        )}

        <div style={{ marginTop: 36 }} />

        {showGroups && mmcClients.length > 0 ? (
          <>
            <div className="section-title">Mijn eigen klanten ({ownClients.length})</div>
            {clientTable(ownClients, "Nog geen klanten.")}
            <div className="section-title" style={{ marginTop: 36 }}>Multimedia Concepts ({mmcClients.length})</div>
            <div className="mmc-list">{clientTable(mmcClients, "Nog geen Multimedia Concepts-klanten.")}</div>
          </>
        ) : (
          <>
            <div className="section-title">Klanten ({klanten.length})</div>
            {clientTable(klanten, "Nog geen klanten.")}
          </>
        )}

        {isOwner && <KijkSleutel />}

        {isOwner && (
        <div style={{ marginTop: 40 }}>
          <button type="button" className="logout-btn" onClick={() => setShowForm((v) => !v)}>
            {showForm ? "− Formulier sluiten" : "+ Nieuwe klant aanmaken"}
          </button>
        </div>
        )}

        {isOwner && showForm && (
        <form className="admin-form" style={{ marginTop: 20 }} onSubmit={onSubmit}>
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

          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? "Bezig..." : "Klant aanmaken + wachtwoord genereren"}
          </button>
        </form>
        )}
      </div>

      <div className="footer">
        Pingwin Online Marketing &middot; Beheer
      </div>
    </>
  );
}
