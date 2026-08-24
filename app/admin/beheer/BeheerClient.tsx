"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamUser } from "../../../lib/team-users";
import OntwikkelMenu from "../OntwikkelMenu";
import Tellers from "../Tellers";
import MeldingenMenu from "../MeldingenMenu";
import Vouwblok from "../Vouwblok";
import HubSpotBlok from "./HubSpotBlok";
import { Ketting, Mensen, Munt, Slot } from "../../_ui/Pijl";

type ClientLite = {
  /** Het nummer uit de database; nodig om de volgorde te kunnen slepen. */
  id: number;
  slug: string;
  name: string;
  email: string | null;
  domain: string | null;
  loginEnabled: boolean;
  // Label van de Ahrefs-sleutel (env AHREFS_API_TOKEN_<LABEL>); leeg = hoofdaccount.
  ahrefsKeyRef: string | null;
  // Het eigen adres van deze klant, als hij er een heeft. Bepaalt waar een gast
  // die alleen deze klant mag zien, inlogt.
  voordeurUrl: string | null;
};

export default function BeheerClient({ clients, team, showFinance = false }: { clients: ClientLite[]; team: TeamUser[]; showFinance?: boolean }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // ── App-instellingen (administratie-e-mail voor de factuur-mail) ──
  const [invoiceMail, setInvoiceMail] = useState("");
  const [settingsBusy, setSettingsBusy] = useState(false);

  // ── Google-koppelingen (data en Drive, bewust gescheiden) ──
  type LinkStatus = { connected: boolean; account: string | null };
  const [gLinks, setGLinks] = useState<{ data: LinkStatus; drive: LinkStatus } | null>(null);
  useEffect(() => {
    fetch("/api/admin/google-links").then((r) => r.json())
      .then((d) => { if (d.ok) setGLinks({ data: d.data, drive: d.drive }); })
      .catch(() => { /* stil */ });
  }, []);
  async function disconnectDrive() {
    if (!confirm("Google Drive ontkoppelen? Documenten komen daarna als download tot er opnieuw een Drive is gekoppeld.")) return;
    try {
      const res = await fetch("/api/admin/google-links", { method: "DELETE" });
      const d = await res.json();
      if (d.ok) {
        setGLinks((g) => (g ? { ...g, drive: { connected: false, account: null } } : g));
        flash(true, "Google Drive ontkoppeld.");
      } else flash(false, d.error || "Ontkoppelen mislukt.");
    } catch { flash(false, "Ontkoppelen mislukt."); }
  }
  useEffect(() => {
    fetch("/api/admin/settings").then((r) => r.json())
      .then((d) => { if (d.ok && d.settings?.invoice_mail_to) setInvoiceMail(d.settings.invoice_mail_to); })
      .catch(() => { /* stil */ });
  }, []);
  async function saveInvoiceMail() {
    setSettingsBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "invoice_mail_to", value: invoiceMail }),
      });
      const data = await res.json();
      if (data.ok) flash(true, "Instelling opgeslagen.");
      else flash(false, data.error || "Opslaan mislukt.");
    } catch {
      flash(false, "Opslaan mislukt.");
    } finally {
      setSettingsBusy(false);
    }
  }

  // De melding stond bovenaan de pagina. Werk je onderin in het teamformulier,
  // dan gebeurde er in beeld dus niets en leek de knop kapot. Daarom scrollen we
  // de melding altijd in beeld, en staat een fout uit het teamformulier ook
  // direct bij de knop zelf.
  function flash(ok: boolean, text: string) {
    setNotice({ ok, text });
    setTimeout(() => {
      document.getElementById("beheer-melding")?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 50);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  // ─────────────────────────────── KLANTEN ───────────────────────────────
  // De volgorde van deze lijst kun je slepen, dus hij leeft hier in de staat en
  // niet alleen in wat de server meestuurt. Komt er een verse lading van de
  // server (na opslaan of verwijderen), dan wint die weer: daar staat de
  // opgeslagen volgorde in.
  const [rijen, setRijen] = useState<ClientLite[]>(clients);
  useEffect(() => { setRijen(clients); }, [clients]);
  // Welke rij op dit moment gesleept wordt. Zelfde patroon als de klantenlijst
  // op /admin (AdminClient.sleepVolgorde) en de tweak-wachtrij: de héle nieuwe
  // volgorde gaat in één keer naar de server, niet één verplaatsing.
  const [sleep, setSleep] = useState<number | null>(null);

  async function laatVallen(doelId: number) {
    if (sleep === null || sleep === doelId) { setSleep(null); return; }
    const ids = rijen.map((c) => c.id);
    if (!ids.includes(sleep)) { setSleep(null); return; }
    const zonder = ids.filter((id) => id !== sleep);
    const plek = zonder.indexOf(doelId);
    zonder.splice(plek < 0 ? zonder.length : plek, 0, sleep);
    setSleep(null);
    setRijen(zonder.map((id) => rijen.find((c) => c.id === id)!));
    await fetch("/api/admin/clients/volgorde", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: zonder }),
    }).catch(() => { /* stil: de volgorde staat dan nog op de oude stand */ });
  }

  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [cForm, setCForm] = useState({ name: "", domain: "", email: "", loginEnabled: true, ahrefsKeyRef: "" });
  const [newPassword, setNewPassword] = useState<{ slug: string; password: string } | null>(null);

  function openClient(c: ClientLite) {
    setEditSlug(c.slug);
    setCForm({ name: c.name, domain: c.domain || "", email: c.email || "", loginEnabled: c.loginEnabled, ahrefsKeyRef: c.ahrefsKeyRef || "" });
    setNewPassword(null);
  }

  async function saveClient(slug: string) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/client-admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name: cForm.name, domain: cForm.domain, email: cForm.email, loginEnabled: cForm.loginEnabled, ahrefsKeyRef: cForm.ahrefsKeyRef }),
      });
      const data = await res.json();
      if (data.ok) {
        flash(true, "Klantgegevens opgeslagen.");
        setEditSlug(null);
        router.refresh();
      } else flash(false, data.error || "Opslaan mislukt.");
    } catch {
      flash(false, "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function resetClientPw(slug: string) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/client-admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action: "resetPassword" }),
      });
      const data = await res.json();
      if (data.ok && data.password) setNewPassword({ slug, password: data.password });
      else flash(false, data.error || "Wachtwoord genereren mislukt.");
    } catch {
      flash(false, "Wachtwoord genereren mislukt.");
    } finally {
      setBusy(false);
    }
  }

  // ──────────────────────────────── TEAM ─────────────────────────────────
  const [showTeamForm, setShowTeamForm] = useState(false);
  const [tForm, setTForm] = useState<{ name: string; loginId: string; email: string; allowedSlugs: string[]; canSeeMail: boolean; canEdit: boolean; editSlugs: string[]; canDev: boolean }>({
    name: "",
    loginId: "",
    email: "",
    allowedSlugs: [],
    canSeeMail: false,
    canEdit: false,
    editSlugs: [],
    canDev: false,
  });
  const [created, setCreated] = useState<{ name: string; loginId: string; password: string; inlogPlek: string } | null>(null);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [uForm, setUForm] = useState<{ name: string; email: string; allowedSlugs: string[]; canSeeMail: boolean; canEdit: boolean; editSlugs: string[]; canDev: boolean }>({
    name: "",
    email: "",
    allowedSlugs: [],
    canSeeMail: false,
    canEdit: false,
    editSlugs: [],
    canDev: false,
  });
  const [userPassword, setUserPassword] = useState<{ id: number; password: string } | null>(null);

  function toggleSlug(list: string[], slug: string): string[] {
    return list.includes(slug) ? list.filter((s) => s !== slug) : [...list, slug];
  }

  async function createGuest(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice(null);
    setCreated(null);
    try {
      const res = await fetch("/api/admin/team", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tForm),
      });
      const data = await res.json();
      if (data.ok) {
        setCreated({ name: tForm.name || tForm.loginId, loginId: data.user.loginId, password: data.password, inlogPlek: inlogPlek(tForm.allowedSlugs) });
        setTForm({ name: "", loginId: "", email: "", allowedSlugs: [], canSeeMail: false, canEdit: false, editSlugs: [], canDev: false });
        setShowTeamForm(false);
        router.refresh();
      } else flash(false, data.error || "Aanmaken mislukt.");
    } catch {
      flash(false, "Aanmaken mislukt.");
    } finally {
      setBusy(false);
    }
  }

  function openUser(u: TeamUser) {
    setEditUserId(u.id);
    setUForm({ name: u.name || "", email: u.email || "", allowedSlugs: [...u.allowedSlugs], canSeeMail: u.canSeeMail, canEdit: u.canEdit, editSlugs: [...(u.editSlugs || [])], canDev: !!u.canDev });
    setUserPassword(null);
  }

  async function saveUser(id: number) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: uForm.name, email: uForm.email, allowedSlugs: uForm.allowedSlugs, canSeeMail: uForm.canSeeMail, canEdit: uForm.canEdit, editSlugs: uForm.editSlugs, canDev: uForm.canDev }),
      });
      const data = await res.json();
      if (data.ok) {
        flash(true, "Rechten opgeslagen.");
        setEditUserId(null);
        router.refresh();
      } else flash(false, data.error || "Opslaan mislukt.");
    } catch {
      flash(false, "Opslaan mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function resetUserPw(id: number) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "resetPassword" }),
      });
      const data = await res.json();
      if (data.ok && data.password) setUserPassword({ id, password: data.password });
      else flash(false, data.error || "Wachtwoord genereren mislukt.");
    } catch {
      flash(false, "Wachtwoord genereren mislukt.");
    } finally {
      setBusy(false);
    }
  }

  async function removeUser(id: number, label: string) {
    if (!confirm(`Teamgebruiker "${label}" verwijderen? Deze kan daarna niet meer inloggen.`)) return;
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/team?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.ok) {
        flash(true, "Teamgebruiker verwijderd.");
        router.refresh();
      } else flash(false, data.error || "Verwijderen mislukt.");
    } catch {
      flash(false, "Verwijderen mislukt.");
    } finally {
      setBusy(false);
    }
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }

  // Mail de inloggegevens: genereert server-side een NIEUW wachtwoord en stuurt
  // dat met de login-URL naar het e-mailadres van het teamlid.
  const [mailBusyId, setMailBusyId] = useState<number | null>(null);
  async function mailLogin(u: TeamUser) {
    if (mailBusyId !== null) return;
    if (!window.confirm(`Inloggegevens mailen naar ${u.email || u.name || u.loginId}? Er wordt een nieuw wachtwoord gegenereerd; het oude vervalt.`)) return;
    setMailBusyId(u.id);
    setNotice(null);
    setUserPassword(null);
    try {
      const res = await fetch("/api/admin/team/mail-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: u.id }),
      });
      const data = await res.json();
      if (data.ok) flash(true, `Inloggegevens gemaild naar ${data.sentTo}.`);
      else {
        flash(false, data.error || "Mailen mislukt.");
        if (data.password) setUserPassword({ id: u.id, password: data.password });
      }
    } catch {
      flash(false, "Mailen mislukt.");
    } finally {
      setMailBusyId(null);
    }
  }

  // Kijk-als-modus: zet de cookie en open het adminscherm in een nieuw tabblad,
  // zodat je precies ziet wat deze gast ziet. Terugkeren kan via het balkje bovenin.
  async function viewAs(id: number) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/view-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      const data = await res.json();
      if (data.ok) window.open("/admin", "_blank");
      else flash(false, data.error || "Kijk-als-modus starten mislukt.");
    } catch {
      flash(false, "Kijk-als-modus starten mislukt.");
    } finally {
      setBusy(false);
    }
  }

  function slugsLabel(slugs: string[]): string {
    if (slugs.length === 0) return "geen klanten";
    return slugs
      .map((s) => clients.find((c) => c.slug === s)?.name || s)
      .join(", ");
  }

  // Waar logt deze gast in? Eén klant met een eigen adres = daar; anders hier.
  // Dezelfde regel als aan de serverkant (voordeurVoorBereik in lib/clients.ts),
  // die bepaalt waar de mail met inloggegevens naartoe wijst.
  function inlogPlek(slugs: string[]): string {
    if (slugs.length !== 1) return "";
    return (clients.find((c) => c.slug === slugs[0])?.voordeurUrl || "").trim();
  }

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
            <div className="header-client">Beheer &middot; klanten &amp; team</div>
          </div>
        </div>
        <div className="header-right">
          <MeldingenMenu />
          <Tellers />
        <OntwikkelMenu />
          <a className="btn btn-klein" href="/admin" title="Terug naar het klantenoverzicht">Klanten</a>
          <button className="btn btn-klein" onClick={logout} style={{ marginLeft: "var(--s-2)" }}>Uitloggen</button>
        </div>
      </div>

      <div className="container">
        {notice && (
          <div id="beheer-melding" className={notice.ok ? "saved-msg" : "login-error"} style={{ marginBottom: "var(--s-4)" }}>
            {notice.text}
          </div>
        )}

        {/* ─────────────── KLANTEN ─────────────── */}
        {/* Bovenaan en open; de blokken eronder staan dicht (24-08-2026, op
            verzoek). De klantenlijst is waarvoor je hier komt, de rest zoek je
            op het moment dat je hem nodig hebt. */}
        <Vouwblok titel="Klanten" icoon={<Mensen />} aantal={rijen.length} standaardOpen>
        <p className="muted">
          Naam, website, e-mail en of de klant-login openstaat. Budget en Google Sheet blijven in de cockpit.
          Alleen lopende klanten: leads en afgesloten deals hebben hun eigen blok op <a href="/admin">het klantenoverzicht</a>.
          Sleep aan het greepje links om de volgorde te veranderen; die geldt meteen ook in de klantenlijst op <a href="/admin">het overzicht</a>.
        </p>

        <div className="task-table-wrap">
          <table>
            <thead>
              <tr>
                <th></th>
                <th>Klant</th>
                <th>Website</th>
                <th>E-mail</th>
                <th>Klant-login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((c) => (
                <tr
                  key={c.slug}
                  className={sleep === c.id ? "tw-item-sleept" : undefined}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => { e.preventDefault(); void laatVallen(c.id); }}
                >
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
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.domain || <span className="muted">&mdash;</span>}</td>
                  <td>{c.email || <span className="muted">&mdash;</span>}</td>
                  <td>{c.loginEnabled ? "Aan" : <span style={{ color: "var(--danger)" }}>Uit</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-klein" onClick={() => openClient(c)}>Bewerken</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {editSlug && (() => {
          const c = clients.find((x) => x.slug === editSlug);
          if (!c) return null;
          return (
            <form className="admin-form" style={{ marginTop: "var(--s-5)" }} onSubmit={(e) => { e.preventDefault(); saveClient(c.slug); }}>
              <div className="created-title" style={{ marginBottom: "var(--s-3)", fontWeight: 700 }}>Klant bewerken: {c.name}</div>
              <div className="form-grid">
                <div className="field">
                  <label>Bedrijfsnaam</label>
                  <input value={cForm.name} onChange={(e) => setCForm({ ...cForm, name: e.target.value })} />
                </div>
                <div className="field">
                  <label>Website-domein</label>
                  <input value={cForm.domain} onChange={(e) => setCForm({ ...cForm, domain: e.target.value })} placeholder="voorbeeld.nl" />
                </div>
                <div className="field">
                  <label>Klant-e-mail (of e-maildomein)</label>
                  <input value={cForm.email} onChange={(e) => setCForm({ ...cForm, email: e.target.value })} placeholder="naam@voorbeeld.nl" />
                </div>
                <div className="field">
                  <label>Ahrefs-sleutel-label (leeg = hoofdaccount)</label>
                  <input
                    value={cForm.ahrefsKeyRef}
                    onChange={(e) => setCForm({ ...cForm, ahrefsKeyRef: e.target.value })}
                    placeholder="bijv. COLLEGA1"
                    autoCapitalize="characters"
                    spellCheck={false}
                  />
                  <span className="muted" style={{ fontSize: "var(--fs-sm)", marginTop: "var(--s-1)" }}>
                    De sleutel zelf zet je in Vercel als env-var AHREFS_API_TOKEN_&lt;LABEL&gt;; hier staat alleen het label.
                  </span>
                </div>
                <div className="field" style={{ justifyContent: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={cForm.loginEnabled}
                      onChange={(e) => setCForm({ ...cForm, loginEnabled: e.target.checked })}
                      style={{ width: "auto" }}
                    />
                    Klant-login staat open (uit = de klant kan niet inloggen)
                  </label>
                </div>
              </div>
              <div style={{ display: "flex", gap: "var(--s-2)", alignItems: "center", flexWrap: "wrap" }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Opslaan…" : "Opslaan"}</button>
                <button type="button" className="btn btn-klein" onClick={() => setEditSlug(null)}>Sluiten</button>
                <button type="button" className="btn btn-klein" onClick={() => resetClientPw(c.slug)} disabled={busy}>Nieuw klant-wachtwoord</button>
              </div>
              {newPassword && newPassword.slug === c.slug && (
                <div className="created-box" style={{ marginTop: "var(--s-4)" }}>
                  <div className="created-title">Nieuw wachtwoord voor {c.name}</div>
                  <p>Geef dit aan de klant. Je ziet het maar één keer.</p>
                  <div className="cred-row"><span>Wachtwoord</span><code>{newPassword.password}</code>
                    <button className="btn btn-klein" type="button" onClick={() => copy(newPassword.password)}>Kopieer</button></div>
                </div>
              )}
            </form>
          );
        })()}

        </Vouwblok>

        {/* ─────────────── TEAM ─────────────── */}
        <Vouwblok
          titel="Team"
          icoon={<Slot />}
          aantal={team.length}
          actie={(openen) => (
            <button type="button" className="btn btn-klein" onClick={() => { openen(); setShowTeamForm((v) => !v); setCreated(null); }}>
              {showTeamForm ? "− Formulier sluiten" : "+ Gast toevoegen"}
            </button>
          )}
        >
        <p className="muted">
          Gasten kunnen inloggen op dit adminscherm en zien alleen de klanten die je aanvinkt. Standaard is een gast alleen-lezen: rondkijken en openklappen mag, maar geen stappen draaien of iets opslaan. Vink &ldquo;mag wijzigen en uitvoeren&rdquo; aan om dat wel toe te staan.
          Vink je precies één klant aan en heeft die klant een eigen adres, dan logt de gast dáár in; op dat adres bestaat geen andere klant, ook niet als zijn rechten later verruimd worden.
        </p>

        {created && (
          <div className="created-box" style={{ marginBottom: "var(--s-5)" }}>
            <div className="created-title">Inloggegevens voor {created.name}</div>
            <p>
              Geef deze gegevens aan de gast. Het wachtwoord zie je maar één keer.
              {created.inlogPlek
                ? ` Deze gast logt in op ${created.inlogPlek}/admin; daar bestaat geen andere klant.`
                : " Inloggen via het adminscherm met deze inlognaam."}
            </p>
            <div className="cred-row"><span>Inlognaam</span><code>{created.loginId}</code>
              <button className="btn btn-klein" type="button" onClick={() => copy(created.loginId)}>Kopieer</button></div>
            <div className="cred-row"><span>Wachtwoord</span><code>{created.password}</code>
              <button className="btn btn-klein" type="button" onClick={() => copy(created.password)}>Kopieer</button></div>
          </div>
        )}

        <div className="task-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Naam</th>
                <th>Inlognaam</th>
                <th>Klanten</th>
                <th>Rechten</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {team.length === 0 && (
                <tr><td colSpan={5} className="muted">Nog geen teamgebruikers. Alleen jij (de eigenaar) hebt toegang.</td></tr>
              )}
              {team.map((u) => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name || <span className="muted">&mdash;</span>}</td>
                  <td>{u.loginId}</td>
                  <td>
                    {u.role === "owner" ? "alles (eigenaar)" : slugsLabel(u.allowedSlugs)}
                    {/* Mag deze gast maar één klant zien en heeft die klant een
                        eigen adres, dan logt hij daar in en niet hier. Zonder dit
                        zie je nergens waar iemand eigenlijk terechtkomt. */}
                    {inlogPlek(u.allowedSlugs) && (
                      <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>
                        logt in op {inlogPlek(u.allowedSlugs)}
                      </div>
                    )}
                  </td>
                  <td>
                    {u.role === "owner" ? "alles" : u.canEdit ? "Mag overal wijzigen" : (u.editSlugs || []).length > 0 ? `Bewerken: ${(u.editSlugs || []).length} van ${u.allowedSlugs.length} klanten` : "Alleen lezen"}
                    {u.canDev && <div className="muted" style={{ fontSize: "var(--fs-sm)" }}>+ developer-taken</div>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn btn-klein" onClick={() => openUser(u)}>Bewerken</button>{" "}
                    <button className="btn btn-klein" onClick={() => viewAs(u.id)} disabled={busy} title="Open in een nieuw tabblad precies wat deze gast ziet">Bekijk als</button>{" "}
                    <button className="btn btn-klein" onClick={() => mailLogin(u)} disabled={busy || mailBusyId !== null} title={u.email ? `Mailt een nieuw wachtwoord + de login-URL naar ${u.email}` : "Vul eerst een e-mailadres in (Bewerken)"}>{mailBusyId === u.id ? "Mailen…" : "Mail inloggegevens"}</button>{" "}
                    <button className="btn btn-klein" onClick={() => resetUserPw(u.id)} disabled={busy}>Nieuw wachtwoord</button>{" "}
                    <button className="btn btn-klein" onClick={() => removeUser(u.id, u.name || u.loginId)} disabled={busy}>Verwijder</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {userPassword && (() => {
          const u = team.find((x) => x.id === userPassword.id);
          return (
            <div className="created-box" style={{ marginTop: "var(--s-4)" }}>
              <div className="created-title">Nieuw wachtwoord voor {u?.name || u?.loginId || "gast"}</div>
              <p>Geef dit aan de gast. Je ziet het maar één keer.</p>
              <div className="cred-row"><span>Wachtwoord</span><code>{userPassword.password}</code>
                <button className="btn btn-klein" type="button" onClick={() => copy(userPassword.password)}>Kopieer</button></div>
            </div>
          );
        })()}

        {editUserId !== null && (() => {
          const u = team.find((x) => x.id === editUserId);
          if (!u) return null;
          return (
            <form className="admin-form" style={{ marginTop: "var(--s-5)" }} onSubmit={(e) => { e.preventDefault(); saveUser(u.id); }}>
              <div className="created-title" style={{ marginBottom: "var(--s-3)", fontWeight: 700 }}>Gast bewerken: {u.loginId}</div>
              <div className="form-grid" style={{ marginBottom: "var(--s-4)" }}>
                <div className="field">
                  <label>Naam</label>
                  <input value={uForm.name} onChange={(e) => setUForm({ ...uForm, name: e.target.value })} placeholder="Naam van de gast" />
                </div>
                <div className="field">
                  <label>E-mailadres (voor het mailen van de inloggegevens)</label>
                  <input type="email" value={uForm.email} onChange={(e) => setUForm({ ...uForm, email: e.target.value })} placeholder="naam@bedrijf.nl" />
                </div>
              </div>
              <ClientPicker
                clients={clients}
                selected={uForm.allowedSlugs}
                onToggle={(slug) => setUForm({
                  ...uForm,
                  allowedSlugs: toggleSlug(uForm.allowedSlugs, slug),
                  // Klant uitvinken haalt ook het bewerken-recht op die klant weg.
                  editSlugs: uForm.allowedSlugs.includes(slug) ? uForm.editSlugs.filter((s) => s !== slug) : uForm.editSlugs,
                })}
                editSelected={uForm.editSlugs}
                onToggleEdit={(slug) => setUForm({ ...uForm, editSlugs: toggleSlug(uForm.editSlugs, slug) })}
                editAll={uForm.canEdit}
              />
              <div className="field" style={{ marginTop: "var(--s-4)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={uForm.canEdit}
                    onChange={(e) => setUForm({ ...uForm, canEdit: e.target.checked })}
                    style={{ width: "auto" }}
                  />
                  Mag overal bewerken en uitvoeren (uit = per klant instellen met de knopjes hierboven)
                </label>
              </div>
              <div className="field" style={{ marginTop: "var(--s-3)" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={uForm.canDev}
                    onChange={(e) => setUForm({ ...uForm, canDev: e.target.checked })}
                    style={{ width: "auto" }}
                  />
                  Developer-taken (alle klanten): eigen scherm met de taken die naar Dev staan, afvinken en terugkoppelen
                </label>
              </div>
              <div style={{ display: "flex", gap: "var(--s-2)", marginTop: "var(--s-4)" }}>
                <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? "Opslaan…" : "Opslaan"}</button>
                <button type="button" className="btn btn-klein" onClick={() => setEditUserId(null)}>Sluiten</button>
              </div>
            </form>
          );
        })()}

        {/* De knop "+ Gast toevoegen" stond hier los onder de tabel; hij hoort bij
            dit blok en staat nu rechts in de kopbalk ervan, net als "+ Nieuwe
            klant" op het overzicht. */}
        {showTeamForm && (
          <form className="admin-form" style={{ marginTop: "var(--s-5)" }} onSubmit={createGuest}>
            <div className="form-grid">
              <div className="field">
                <label>Naam</label>
                <input value={tForm.name} onChange={(e) => setTForm({ ...tForm, name: e.target.value })} placeholder="Naam van de gast" />
              </div>
              <div className="field">
                <label>Inlognaam</label>
                <input
                  value={tForm.loginId}
                  onChange={(e) => setTForm({ ...tForm, loginId: e.target.value })}
                  placeholder="bijv. jan (geen spaties)"
                  autoCapitalize="none"
                  spellCheck={false}
                  required
                />
              </div>
              <div className="field">
                <label>E-mailadres (voor het mailen van de inloggegevens)</label>
                <input type="email" value={tForm.email} onChange={(e) => setTForm({ ...tForm, email: e.target.value })} placeholder="naam@bedrijf.nl" />
              </div>
            </div>
            <ClientPicker
              clients={clients}
              selected={tForm.allowedSlugs}
              onToggle={(slug) => setTForm({
                ...tForm,
                allowedSlugs: toggleSlug(tForm.allowedSlugs, slug),
                editSlugs: tForm.allowedSlugs.includes(slug) ? tForm.editSlugs.filter((s) => s !== slug) : tForm.editSlugs,
              })}
              editSelected={tForm.editSlugs}
              onToggleEdit={(slug) => setTForm({ ...tForm, editSlugs: toggleSlug(tForm.editSlugs, slug) })}
              editAll={tForm.canEdit}
            />
            <div className="field" style={{ marginTop: "var(--s-4)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={tForm.canEdit}
                  onChange={(e) => setTForm({ ...tForm, canEdit: e.target.checked })}
                  style={{ width: "auto" }}
                />
                Mag overal bewerken en uitvoeren (uit = per klant instellen met de knopjes hierboven)
              </label>
            </div>
              <div className="field" style={{ marginTop: "var(--s-3)" }}>
              <label style={{ display: "flex", alignItems: "center", gap: "var(--s-2)", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={tForm.canDev}
                  onChange={(e) => setTForm({ ...tForm, canDev: e.target.checked })}
                  style={{ width: "auto" }}
                />
                Developer-taken (alle klanten): eigen scherm met de taken die naar Dev staan, afvinken en terugkoppelen
              </label>
            </div>
            <button type="submit" className="btn btn-primary" style={{ marginTop: "var(--s-4)" }} disabled={busy}>{busy ? "Bezig…" : "Gast aanmaken"}</button>
            {notice && !notice.ok && (
              <div className="login-error" style={{ marginTop: "var(--s-3)" }}>{notice.text}</div>
            )}
          </form>
        )}

        </Vouwblok>

        {/* ─────────────── INSTELLINGEN (alleen met Moneybird-koppeling) ─────────────── */}
        {showFinance && (
          <Vouwblok titel="Instellingen" icoon={<Munt />}>
            <p className="muted">
              Het e-mailadres van degene die de administratie bijhoudt. De knop &ldquo;Mail naar administratie&rdquo; bij een openstaande-factuursignaal stuurt de factuurlinks naar dit adres.
            </p>
            <form className="admin-form" onSubmit={(e) => { e.preventDefault(); saveInvoiceMail(); }}>
              <div className="form-grid">
                <div className="field">
                  <label>Administratie-e-mail (factuur-signalen)</label>
                  <input type="email" value={invoiceMail} onChange={(e) => setInvoiceMail(e.target.value)} placeholder="administratie@bedrijf.nl" />
                </div>
                <div className="field" style={{ justifyContent: "flex-end" }}>
                  <button type="submit" className="btn btn-primary" disabled={settingsBusy} style={{ alignSelf: "flex-start" }}>{settingsBusy ? "Opslaan…" : "Opslaan"}</button>
                </div>
              </div>
            </form>
          </Vouwblok>
        )}

        {/* ─────────────── GOOGLE-KOPPELINGEN ─────────────── */}
        <Vouwblok titel="Google-koppelingen" icoon={<Ketting />}>
        <p className="muted">
          Twee losse koppelingen, bewust gescheiden: de <strong>data-koppeling</strong> bepaalt wiens Google-account de
          Search Console- en Analytics-cijfers levert; de <strong>Drive-koppeling</strong> bepaalt in wiens Google Drive
          de documenten landen. Data koppelen geeft dus nooit toegang tot iemands Drive.
        </p>
        <div className="task-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Koppeling</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style={{ fontWeight: 600 }}>Search Console + Analytics (data)</td>
                <td>{!gLinks ? "…" : gLinks.data.connected ? `Gekoppeld${gLinks.data.account ? ` als ${gLinks.data.account}` : ""}` : <span style={{ color: "var(--danger)" }}>Niet gekoppeld</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <a className="btn btn-klein" href="/api/google/auth/start">{gLinks?.data.connected ? "Opnieuw koppelen" : "Koppelen"}</a>
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Google Drive (documenten-opslag)</td>
                <td>{!gLinks ? "…" : gLinks.drive.connected ? `Gekoppeld${gLinks.drive.account ? ` als ${gLinks.drive.account}` : ""}` : <span style={{ color: "var(--danger)" }}>Niet gekoppeld (documenten komen als download)</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <a className="btn btn-klein" href="/api/google/auth/start?purpose=drive">{gLinks?.drive.connected ? "Opnieuw koppelen" : "Drive koppelen"}</a>{" "}
                  {gLinks?.drive.connected && <button className="btn btn-klein" onClick={disconnectDrive}>Ontkoppelen</button>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        </Vouwblok>

        {/* ─────────────── HUBSPOT ─────────────── */}
        {/* Dit blok zet zijn eigen inklapkaart neer (standaard dicht). */}
        <HubSpotBlok />

        <div className="admin-footer" style={{ marginTop: "var(--s-10)", color: "var(--gray)", fontSize: "var(--fs-sm)" }}>
          Pingwin Online Marketing &middot; Beheer
        </div>
      </div>
    </>
  );
}

function ClientPicker({
  clients,
  selected,
  onToggle,
  editSelected,
  onToggleEdit,
  editAll,
}: {
  clients: ClientLite[];
  selected: string[];
  onToggle: (slug: string) => void;
  // Per-klant schrijfrecht: welke van de geselecteerde klanten mag deze gast bewerken.
  editSelected: string[];
  onToggleEdit: (slug: string) => void;
  // Staat het globale "mag overal bewerken" aan, dan tonen we de vinkjes als aan + uitgeschakeld.
  editAll: boolean;
}) {
  return (
    <div className="field-wide">
      <label style={{ fontWeight: 600, fontSize: "var(--fs-sm)", textTransform: "uppercase", letterSpacing: "var(--spatie-label)", color: "var(--gray)", marginBottom: "var(--s-2)", display: "block" }}>
        Toegang tot klanten
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--s-2)" }}>
        {clients.map((c) => {
          const on = selected.includes(c.slug);
          const editOn = editAll || editSelected.includes(c.slug);
          return (
            <span key={c.slug} style={{ display: "inline-flex", alignItems: "center", gap: "var(--s-1)" }}>
              <button
                type="button"
                onClick={() => onToggle(c.slug)}
                className={on ? "btn btn-primary btn-klein" : "btn btn-klein"}
                style={{ padding: "var(--s-2) var(--s-3)" }}
              >
                {on ? "✓ " : ""}{c.name}
              </button>
              {on && (
                <button
                  type="button"
                  onClick={() => onToggleEdit(c.slug)}
                  disabled={editAll}
                  className={editOn ? "btn btn-primary btn-klein" : "btn btn-klein"}
                  style={{ padding: "var(--s-2) var(--s-3)", opacity: editAll ? 0.6 : 1 }}
                  title={editAll ? "Mag al overal bewerken (globaal vinkje staat aan)" : editOn ? "Mag deze klant bewerken; klik om alleen-lezen te maken" : "Alleen lezen; klik om bewerken toe te staan"}
                >
                  {editOn ? "✎ bewerken" : "alleen lezen"}
                </button>
              )}
            </span>
          );
        })}
        {clients.length === 0 && <span className="muted">Nog geen klanten.</span>}
      </div>
      <p className="muted" style={{ marginTop: "var(--s-2)", fontSize: "var(--fs-sm)" }}>
        Per aangevinkte klant kies je of de gast er ook mag bewerken en uitvoeren, of alleen mag lezen.
      </p>
    </div>
  );
}
