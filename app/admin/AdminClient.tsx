"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientConfig } from "../../lib/clients";

type Created = { name: string; loginId: string; password: string; loginUrl: string };

const EMPTY = {
  name: "",
  loginId: "",
  email: "",
  sheetUrl: "",
  maandbudget: "",
  linkbuilding: "",
  uurtarief: "",
  beschikbareUren: "",
};

export default function AdminClient({ initialClients }: { initialClients: ClientConfig[] }) {
  const router = useRouter();
  const [clients, setClients] = useState<ClientConfig[]>(initialClients);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [created, setCreated] = useState<Created | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
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
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setCreated({
          name: data.client.name,
          loginId: data.client.loginId,
          password: data.password,
          loginUrl: `${window.location.origin}/login`,
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

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.href = "/admin/login";
  }

  async function remove(e: React.MouseEvent, c: ClientConfig) {
    e.stopPropagation();
    if (!window.confirm(`Klant "${c.name}" verwijderen? Hun login werkt daarna niet meer.`)) return;
    await fetch(`/api/admin/clients?slug=${encodeURIComponent(c.slug)}`, { method: "DELETE" });
    await refresh();
  }

  function openDashboard(c: ClientConfig) {
    router.push(`/admin/preview/${c.slug}`);
  }

  function copy(text: string) {
    navigator.clipboard?.writeText(text);
  }

  return (
    <>
      <div className="header">
        <div className="header-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
          <div className="header-divider" />
          <div>
            <div className="header-title">Pingwin SEO Dashboard</div>
            <div className="header-client">Beheer</div>
          </div>
        </div>
        <div className="header-right">
          <button className="logout-btn" onClick={logout}>Uitloggen</button>
        </div>
      </div>

      <div className="container">
        <div className="admin-note">
          Eén vaste link voor alle klanten:{" "}
          <strong>{origin ? `${origin}/login` : "..."}</strong>. Elke klant logt daar in met
          de eigen inlognaam en het wachtwoord dat je hier aanmaakt. Klik hieronder op een klant
          om diens dashboard te bekijken.
        </div>

        {created && (
          <div className="created-box">
            <div className="created-title">Klant aangemaakt: {created.name}</div>
            <p>Geef deze gegevens aan de klant (het wachtwoord zie je maar één keer):</p>
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

        <div className="section-title">Klanten ({clients.length})</div>
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
              {clients.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: "center", padding: 40, color: "var(--gray)" }}>Nog geen klanten.</td></tr>
              )}
              {clients.map((c) => (
                <tr key={c.slug} className="clickable-row" onClick={() => openDashboard(c)} title="Open dashboard van deze klant">
                  <td><strong>{c.name}</strong> <span className="row-arrow">&rarr;</span></td>
                  <td>{c.loginId}</td>
                  <td>{c.email || <span className="muted">&mdash;</span>}</td>
                  <td>&euro;{c.budget.maandbudget.toFixed(0)}</td>
                  <td>&euro;{c.budget.uurtarief.toFixed(0)}</td>
                  <td><button className="mini-btn" onClick={(e) => remove(e, c)}>Verwijder</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="section-title" style={{ marginTop: 40 }}>Nieuwe klant aanmaken</div>
        <form className="admin-form" onSubmit={onSubmit}>
          <div className="form-grid">
            <div className="field">
              <label>Bedrijfsnaam</label>
              <input value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="One Day Clinic" required />
            </div>
            <div className="field">
              <label>Inlognaam (geen spaties)</label>
              <input value={form.loginId} onChange={(e) => set("loginId", e.target.value)} placeholder="onedayclinic" required />
            </div>
            <div className="field">
              <label>E-mailadres klant</label>
              <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@klant.nl" />
            </div>
            <div className="field field-wide">
              <label>Google Sheet-link (van het juiste tabblad)</label>
              <input value={form.sheetUrl} onChange={(e) => set("sheetUrl", e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..." required />
            </div>
            <div className="field">
              <label>Maandfee (&euro;, incl. linkbuilding)</label>
              <input type="number" value={form.maandbudget} onChange={(e) => set("maandbudget", e.target.value)} placeholder="1800" required />
            </div>
            <div className="field">
              <label>Linkbuilding-budget (&euro;)</label>
              <input type="number" value={form.linkbuilding} onChange={(e) => set("linkbuilding", e.target.value)} placeholder="600" required />
            </div>
            <div className="field">
              <label>Uurtarief (&euro;)</label>
              <input type="number" value={form.uurtarief} onChange={(e) => set("uurtarief", e.target.value)} placeholder="100" required />
            </div>
            <div className="field">
              <label>Beschikbare uren per maand</label>
              <input type="number" value={form.beschikbareUren} onChange={(e) => set("beschikbareUren", e.target.value)} placeholder="12" required />
            </div>
          </div>

          {error && <div className="login-error">{error}</div>}

          <button type="submit" className="primary-btn" disabled={busy}>
            {busy ? "Bezig..." : "Klant aanmaken + wachtwoord genereren"}
          </button>
        </form>
      </div>

      <div className="footer">
        Pingwin Online Marketing &middot; Beheer
      </div>
    </>
  );
}
