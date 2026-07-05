"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { TeamUser } from "../../../lib/team-users";

type ClientLite = {
  slug: string;
  name: string;
  email: string | null;
  domain: string | null;
  loginEnabled: boolean;
};

export default function BeheerClient({ clients, team }: { clients: ClientLite[]; team: TeamUser[] }) {
  const router = useRouter();
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  function flash(ok: boolean, text: string) {
    setNotice({ ok, text });
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/admin/login");
    router.refresh();
  }

  // ─────────────────────────────── KLANTEN ───────────────────────────────
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [cForm, setCForm] = useState({ name: "", domain: "", email: "", loginEnabled: true });
  const [newPassword, setNewPassword] = useState<{ slug: string; password: string } | null>(null);

  function openClient(c: ClientLite) {
    setEditSlug(c.slug);
    setCForm({ name: c.name, domain: c.domain || "", email: c.email || "", loginEnabled: c.loginEnabled });
    setNewPassword(null);
  }

  async function saveClient(slug: string) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/client-admin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, name: cForm.name, domain: cForm.domain, email: cForm.email, loginEnabled: cForm.loginEnabled }),
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
  const [tForm, setTForm] = useState<{ name: string; loginId: string; allowedSlugs: string[]; canSeeMail: boolean }>({
    name: "",
    loginId: "",
    allowedSlugs: [],
    canSeeMail: false,
  });
  const [created, setCreated] = useState<{ name: string; loginId: string; password: string } | null>(null);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [uForm, setUForm] = useState<{ name: string; allowedSlugs: string[]; canSeeMail: boolean }>({
    name: "",
    allowedSlugs: [],
    canSeeMail: false,
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
        setTForm({ name: "", loginId: "", allowedSlugs: [], canSeeMail: false });
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
    setUForm({ name: u.name || "", allowedSlugs: [...u.allowedSlugs], canSeeMail: u.canSeeMail });
    setUserPassword(null);
  }

  async function saveUser(id: number) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/team", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, name: uForm.name, allowedSlugs: uForm.allowedSlugs, canSeeMail: uForm.canSeeMail }),
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
          <div className={notice.ok ? "saved-msg" : "login-error"} style={{ marginBottom: 16 }}>
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
          Gasten kunnen inloggen op dit adminscherm en zien alleen de klanten die je aanvinkt. Zet &ldquo;mail &amp; status zichtbaar&rdquo; aan als een gast ook de mails en de actuele stand van zaken mag zien.
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
                <th>Mail &amp; status</th>
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
                  <td>{u.role === "owner" || u.canSeeMail ? "Ja" : "Nee"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="mini-btn" onClick={() => openUser(u)}>Bewerken</button>{" "}
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
              <div className="field" style={{ marginBottom: 16 }}>
                <label>Naam</label>
                <input value={uForm.name} onChange={(e) => setUForm({ ...uForm, name: e.target.value })} placeholder="Naam van de gast" />
              </div>
              <ClientPicker
                clients={clients}
                selected={uForm.allowedSlugs}
                onToggle={(slug) => setUForm({ ...uForm, allowedSlugs: toggleSlug(uForm.allowedSlugs, slug) })}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", margin: "16px 0" }}>
                <input type="checkbox" checked={uForm.canSeeMail} onChange={(e) => setUForm({ ...uForm, canSeeMail: e.target.checked })} style={{ width: "auto" }} />
                Mail &amp; actuele stand van zaken zichtbaar voor deze gast
              </label>
              <div style={{ display: "flex", gap: 8 }}>
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
            </div>
            <ClientPicker
              clients={clients}
              selected={tForm.allowedSlugs}
              onToggle={(slug) => setTForm({ ...tForm, allowedSlugs: toggleSlug(tForm.allowedSlugs, slug) })}
            />
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", margin: "16px 0" }}>
              <input type="checkbox" checked={tForm.canSeeMail} onChange={(e) => setTForm({ ...tForm, canSeeMail: e.target.checked })} style={{ width: "auto" }} />
              Mail &amp; actuele stand van zaken zichtbaar voor deze gast
            </label>
            <button type="submit" className="primary-btn" disabled={busy}>{busy ? "Bezig…" : "Gast aanmaken"}</button>
          </form>
        )}

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
}: {
  clients: ClientLite[];
  selected: string[];
  onToggle: (slug: string) => void;
}) {
  return (
    <div className="field-wide">
      <label style={{ fontWeight: 600, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--gray)", marginBottom: 8, display: "block" }}>
        Toegang tot klanten
      </label>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {clients.map((c) => {
          const on = selected.includes(c.slug);
          return (
            <button
              type="button"
              key={c.slug}
              onClick={() => onToggle(c.slug)}
              className={on ? "primary-btn small" : "mini-btn"}
              style={{ padding: "6px 12px" }}
            >
              {on ? "✓ " : ""}{c.name}
            </button>
          );
        })}
        {clients.length === 0 && <span className="muted">Nog geen klanten.</span>}
      </div>
    </div>
  );
}
