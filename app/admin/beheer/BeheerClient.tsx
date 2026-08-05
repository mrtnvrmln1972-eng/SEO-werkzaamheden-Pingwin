"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamUser } from "../../../lib/team-users";

type ClientLite = {
  slug: string;
  name: string;
  email: string | null;
  domain: string | null;
  loginEnabled: boolean;
  // Label van de Ahrefs-sleutel (env AHREFS_API_TOKEN_<LABEL>); leeg = hoofdaccount.
  ahrefsKeyRef: string | null;
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
  const [created, setCreated] = useState<{ name: string; loginId: string; password: string } | null>(null);
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
        setCreated({ name: tForm.name || tForm.loginId, loginId: data.user.loginId, password: data.password });
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
          <a className="logout-btn" href="/admin" title="Terug naar het klantenoverzicht">Klanten</a>
          <button className="logout-btn" onClick={logout} style={{ marginLeft: 8 }}>Uitloggen</button>
        </div>
      </div>

      <div className="container">
        {notice && (
          <div id="beheer-melding" className={notice.ok ? "saved-msg" : "login-error"} style={{ marginBottom: 16 }}>
            {notice.text}
          </div>
        )}

        {/* ─────────────── KLANTEN ─────────────── */}
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "8px 0 6px" }}>Klanten</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Naam, website, e-mail en of de klant-login openstaat. Budget en Google Sheet blijven in de cockpit.
        </p>

        <div className="task-table-wrap">
          <table>
            <thead>
              <tr>
                <th>Klant</th>
                <th>Website</th>
                <th>E-mail</th>
                <th>Klant-login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.slug}>
                  <td style={{ fontWeight: 600 }}>{c.name}</td>
                  <td>{c.domain || <span className="muted">&mdash;</span>}</td>
                  <td>{c.email || <span className="muted">&mdash;</span>}</td>
                  <td>{c.loginEnabled ? "Aan" : <span style={{ color: "#c0392b" }}>Uit</span>}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="mini-btn" onClick={() => openClient(c)}>Bewerken</button>
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
            <form className="admin-form" style={{ marginTop: 20 }} onSubmit={(e) => { e.preventDefault(); saveClient(c.slug); }}>
              <div className="created-title" style={{ marginBottom: 12, fontWeight: 700 }}>Klant bewerken: {c.name}</div>
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
                  <span className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    De sleutel zelf zet je in Vercel als env-var AHREFS_API_TOKEN_&lt;LABEL&gt;; hier staat alleen het label.
                  </span>
                </div>
                <div className="field" style={{ justifyContent: "flex-end" }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
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
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <button type="submit" className="primary-btn" disabled={busy}>{busy ? "Opslaan…" : "Opslaan"}</button>
                <button type="button" className="logout-btn" onClick={() => setEditSlug(null)}>Sluiten</button>
                <button type="button" className="mini-btn" onClick={() => resetClientPw(c.slug)} disabled={busy}>Nieuw klant-wachtwoord</button>
              </div>
              {newPassword && newPassword.slug === c.slug && (
                <div className="created-box" style={{ marginTop: 16 }}>
                  <div className="created-title">Nieuw wachtwoord voor {c.name}</div>
                  <p>Geef dit aan de klant. Je ziet het maar één keer.</p>
                  <div className="cred-row"><span>Wachtwoord</span><code>{newPassword.password}</code>
                    <button className="mini-btn" type="button" onClick={() => copy(newPassword.password)}>Kopieer</button></div>
                </div>
              )}
            </form>
          );
        })()}

        {/* ─────────────── TEAM ─────────────── */}
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "44px 0 6px" }}>Team</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
          Gasten kunnen inloggen op dit adminscherm en zien alleen de klanten die je aanvinkt. Standaard is een gast alleen-lezen: rondkijken en openklappen mag, maar geen stappen draaien of iets opslaan. Vink &ldquo;mag wijzigen en uitvoeren&rdquo; aan om dat wel toe te staan.
        </p>

        {created && (
          <div className="created-box" style={{ marginBottom: 20 }}>
            <div className="created-title">Inloggegevens voor {created.name}</div>
            <p>Geef deze gegevens aan de gast. Het wachtwoord zie je maar één keer. Inloggen via het adminscherm met deze inlognaam.</p>
            <div className="cred-row"><span>Inlognaam</span><code>{created.loginId}</code>
              <button className="mini-btn" type="button" onClick={() => copy(created.loginId)}>Kopieer</button></div>
            <div className="cred-row"><span>Wachtwoord</span><code>{created.password}</code>
              <button className="mini-btn" type="button" onClick={() => copy(created.password)}>Kopieer</button></div>
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
                  <td>{u.role === "owner" ? "alles (eigenaar)" : slugsLabel(u.allowedSlugs)}</td>
                  <td>
                    {u.role === "owner" ? "alles" : u.canEdit ? "Mag overal wijzigen" : (u.editSlugs || []).length > 0 ? `Bewerken: ${(u.editSlugs || []).length} van ${u.allowedSlugs.length} klanten` : "Alleen lezen"}
                    {u.canDev && <div className="muted" style={{ fontSize: 12 }}>+ developer-taken</div>}
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="mini-btn" onClick={() => openUser(u)}>Bewerken</button>{" "}
                    <button className="mini-btn" onClick={() => viewAs(u.id)} disabled={busy} title="Open in een nieuw tabblad precies wat deze gast ziet">Bekijk als</button>{" "}
                    <button className="mini-btn" onClick={() => mailLogin(u)} disabled={busy || mailBusyId !== null} title={u.email ? `Mailt een nieuw wachtwoord + de login-URL naar ${u.email}` : "Vul eerst een e-mailadres in (Bewerken)"}>{mailBusyId === u.id ? "Mailen…" : "Mail inloggegevens"}</button>{" "}
                    <button className="mini-btn" onClick={() => resetUserPw(u.id)} disabled={busy}>Nieuw wachtwoord</button>{" "}
                    <button className="mini-btn" onClick={() => removeUser(u.id, u.name || u.loginId)} disabled={busy}>Verwijder</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {userPassword && (() => {
          const u = team.find((x) => x.id === userPassword.id);
          return (
            <div className="created-box" style={{ marginTop: 16 }}>
              <div className="created-title">Nieuw wachtwoord voor {u?.name || u?.loginId || "gast"}</div>
              <p>Geef dit aan de gast. Je ziet het maar één keer.</p>
              <div className="cred-row"><span>Wachtwoord</span><code>{userPassword.password}</code>
                <button className="mini-btn" type="button" onClick={() => copy(userPassword.password)}>Kopieer</button></div>
            </div>
          );
        })()}

        {editUserId !== null && (() => {
          const u = team.find((x) => x.id === editUserId);
          if (!u) return null;
          return (
            <form className="admin-form" style={{ marginTop: 20 }} onSubmit={(e) => { e.preventDefault(); saveUser(u.id); }}>
              <div className="created-title" style={{ marginBottom: 12, fontWeight: 700 }}>Gast bewerken: {u.loginId}</div>
              <div className="form-grid" style={{ marginBottom: 16 }}>
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
              <div className="field" style={{ marginTop: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={uForm.canEdit}
                    onChange={(e) => setUForm({ ...uForm, canEdit: e.target.checked })}
                    style={{ width: "auto" }}
                  />
                  Mag overal bewerken en uitvoeren (uit = per klant instellen met de knopjes hierboven)
                </label>
              </div>
              <div className="field" style={{ marginTop: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={uForm.canDev}
                    onChange={(e) => setUForm({ ...uForm, canDev: e.target.checked })}
                    style={{ width: "auto" }}
                  />
                  Developer-taken (alle klanten): eigen scherm met de taken die naar Dev staan, afvinken en terugkoppelen
                </label>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                <button type="submit" className="primary-btn" disabled={busy}>{busy ? "Opslaan…" : "Opslaan"}</button>
                <button type="button" className="logout-btn" onClick={() => setEditUserId(null)}>Sluiten</button>
              </div>
            </form>
          );
        })()}

        <div style={{ marginTop: 24 }}>
          <button type="button" className="logout-btn" onClick={() => { setShowTeamForm((v) => !v); setCreated(null); }}>
            {showTeamForm ? "− Formulier sluiten" : "+ Gast toevoegen"}
          </button>
        </div>

        {showTeamForm && (
          <form className="admin-form" style={{ marginTop: 20 }} onSubmit={createGuest}>
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
            <div className="field" style={{ marginTop: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={tForm.canEdit}
                  onChange={(e) => setTForm({ ...tForm, canEdit: e.target.checked })}
                  style={{ width: "auto" }}
                />
                Mag overal bewerken en uitvoeren (uit = per klant instellen met de knopjes hierboven)
              </label>
            </div>
              <div className="field" style={{ marginTop: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={tForm.canDev}
                  onChange={(e) => setTForm({ ...tForm, canDev: e.target.checked })}
                  style={{ width: "auto" }}
                />
                Developer-taken (alle klanten): eigen scherm met de taken die naar Dev staan, afvinken en terugkoppelen
              </label>
            </div>
            <button type="submit" className="primary-btn" style={{ marginTop: 16 }} disabled={busy}>{busy ? "Bezig…" : "Gast aanmaken"}</button>
            {notice && !notice.ok && (
              <div className="login-error" style={{ marginTop: 12 }}>{notice.text}</div>
            )}
          </form>
        )}

        {/* ─────────────── INSTELLINGEN (alleen met Moneybird-koppeling) ─────────────── */}
        {showFinance && (
          <>
            <h2 style={{ fontSize: 20, fontWeight: 700, margin: "44px 0 6px" }}>Instellingen</h2>
            <p className="muted" style={{ marginBottom: 16 }}>
              Het e-mailadres van degene die de administratie bijhoudt. De knop &ldquo;Mail naar administratie&rdquo; bij een openstaande-factuursignaal stuurt de factuurlinks naar dit adres.
            </p>
            <form className="admin-form" onSubmit={(e) => { e.preventDefault(); saveInvoiceMail(); }}>
              <div className="form-grid">
                <div className="field">
                  <label>Administratie-e-mail (factuur-signalen)</label>
                  <input type="email" value={invoiceMail} onChange={(e) => setInvoiceMail(e.target.value)} placeholder="administratie@bedrijf.nl" />
                </div>
                <div className="field" style={{ justifyContent: "flex-end" }}>
                  <button type="submit" className="primary-btn" disabled={settingsBusy} style={{ alignSelf: "flex-start" }}>{settingsBusy ? "Opslaan…" : "Opslaan"}</button>
                </div>
              </div>
            </form>
          </>
        )}

        {/* ─────────────── GOOGLE-KOPPELINGEN ─────────────── */}
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: "44px 0 6px" }}>Google-koppelingen</h2>
        <p className="muted" style={{ marginBottom: 16 }}>
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
                <td>{!gLinks ? "…" : gLinks.data.connected ? `Gekoppeld${gLinks.data.account ? ` als ${gLinks.data.account}` : ""}` : <span style={{ color: "#c0392b" }}>Niet gekoppeld</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <a className="mini-btn" href="/api/google/auth/start">{gLinks?.data.connected ? "Opnieuw koppelen" : "Koppelen"}</a>
                </td>
              </tr>
              <tr>
                <td style={{ fontWeight: 600 }}>Google Drive (documenten-opslag)</td>
                <td>{!gLinks ? "…" : gLinks.drive.connected ? `Gekoppeld${gLinks.drive.account ? ` als ${gLinks.drive.account}` : ""}` : <span style={{ color: "#c0392b" }}>Niet gekoppeld (documenten komen als download)</span>}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <a className="mini-btn" href="/api/google/auth/start?purpose=drive">{gLinks?.drive.connected ? "Opnieuw koppelen" : "Drive koppelen"}</a>{" "}
                  {gLinks?.drive.connected && <button className="mini-btn" onClick={disconnectDrive}>Ontkoppelen</button>}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="admin-footer" style={{ marginTop: 40, color: "var(--gray)", fontSize: 12 }}>
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
      <label style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--gray)", marginBottom: 8, display: "block" }}>
        Toegang tot klanten
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {clients.map((c) => {
          const on = selected.includes(c.slug);
          const editOn = editAll || editSelected.includes(c.slug);
          return (
            <span key={c.slug} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <button
                type="button"
                onClick={() => onToggle(c.slug)}
                className={on ? "primary-btn small" : "mini-btn"}
                style={{ padding: "6px 12px" }}
              >
                {on ? "✓ " : ""}{c.name}
              </button>
              {on && (
                <button
                  type="button"
                  onClick={() => onToggleEdit(c.slug)}
                  disabled={editAll}
                  className={editOn ? "primary-btn small" : "mini-btn"}
                  style={{ padding: "6px 10px", opacity: editAll ? 0.6 : 1 }}
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
      <p className="muted" style={{ marginTop: 6, fontSize: 12 }}>
        Per aangevinkte klant kies je of de gast er ook mag bewerken en uitvoeren, of alleen mag lezen.
      </p>
    </div>
  );
}
