"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientConfig } from "../../../../lib/clients";

type Tab = "overzicht" | "communicatie" | "resultaten";

export default function ClientCockpit({ client }: { client: ClientConfig }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("overzicht");
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const [f, setF] = useState({
    status: client.cockpit.status || "",
    lastContact: client.cockpit.lastContact || "",
    emailDomain: client.cockpit.emailDomain || "",
    workDocUrl: client.cockpit.workDocUrl || "",
    resultsUrl: client.cockpit.resultsUrl || "",
    notes: client.cockpit.notes || "",
    email: client.email || "",
    sheetUrl: client.sheetId
      ? `https://docs.google.com/spreadsheets/d/${client.sheetId}/edit#gid=${client.gid}`
      : "",
    maandbudget: client.budget.maandbudget ? String(client.budget.maandbudget) : "",
    linkbuilding: client.budget.linkbuilding ? String(client.budget.linkbuilding) : "",
    uurtarief: client.budget.uurtarief ? String(client.budget.uurtarief) : "",
    beschikbareUren: client.budget.beschikbareUren ? String(client.budget.beschikbareUren) : "",
  });

  const hasSheet = !!client.sheetId;
  const sheetUrl = hasSheet
    ? `https://docs.google.com/spreadsheets/d/${client.sheetId}/edit#gid=${client.gid}`
    : "";
  const dashboardUrl = `/admin/preview/${client.slug}`;
  const outlookSearch = f.emailDomain
    ? `https://outlook.office.com/mail/search/${encodeURIComponent(f.emailDomain)}`
    : "";

  function set(k: keyof typeof f, v: string) {
    setF((p) => ({ ...p, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: client.slug, ...f }),
      });
      const data = await res.json();
      if (data.ok) {
        setSaved(true);
        setEditing(false);
        router.refresh();
      }
    } finally {
      setBusy(false);
    }
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
            <div className="header-title">{client.name}</div>
            <div className="header-client">Klant-cockpit</div>
          </div>
        </div>
        <div className="header-right">
          <a className="logout-btn" href="/admin">&larr; Alle klanten</a>
          {editing ? (
            <button className="primary-btn small" onClick={save} disabled={busy}>
              {busy ? "Opslaan..." : "Opslaan"}
            </button>
          ) : (
            <button className="logout-btn" onClick={() => setEditing(true)}>Bewerken</button>
          )}
        </div>
      </div>

      <div className="container">
        <div className="tabs">
          <button className={"tab" + (tab === "overzicht" ? " active" : "")} onClick={() => setTab("overzicht")}>Overzicht</button>
          <button className={"tab" + (tab === "communicatie" ? " active" : "")} onClick={() => setTab("communicatie")}>Communicatie</button>
          <button className={"tab" + (tab === "resultaten" ? " active" : "")} onClick={() => setTab("resultaten")}>Ontwikkeling &amp; resultaten</button>
        </div>

        {saved && <div className="saved-msg">Opgeslagen.</div>}

        {tab === "overzicht" && (
          <div className="cockpit-card">
            <Row label="Status">
              {editing
                ? <input value={f.status} onChange={(e) => set("status", e.target.value)} placeholder="Actief" />
                : <span>{f.status || <span className="muted">&mdash;</span>}</span>}
            </Row>
            <Row label="E-mailadres klant">
              {editing
                ? <input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="contact@klant.nl" />
                : <span>{f.email || <span className="muted">&mdash;</span>}</span>}
            </Row>
            <Row label="Maandfee">
              {editing ? (
                <div className="quicklinks">
                  <input type="number" value={f.maandbudget} onChange={(e) => set("maandbudget", e.target.value)} placeholder="Maandfee (€)" style={{ width: 140 }} />
                  <input type="number" value={f.linkbuilding} onChange={(e) => set("linkbuilding", e.target.value)} placeholder="w.v. linkbuilding (€)" style={{ width: 180 }} />
                </div>
              ) : (
                client.budget.maandbudget
                  ? <span>&euro;{client.budget.maandbudget.toFixed(0)} (incl. linkbuilding &euro;{client.budget.linkbuilding.toFixed(0)})</span>
                  : <span className="muted">&mdash;</span>
              )}
            </Row>
            {editing && (
              <Row label="Uurtarief / uren p.m.">
                <div className="quicklinks">
                  <input type="number" value={f.uurtarief} onChange={(e) => set("uurtarief", e.target.value)} placeholder="Uurtarief (€)" style={{ width: 140 }} />
                  <input type="number" value={f.beschikbareUren} onChange={(e) => set("beschikbareUren", e.target.value)} placeholder="Uren per maand" style={{ width: 140 }} />
                </div>
              </Row>
            )}
            <Row label="Laatste contact">
              {editing
                ? <input type="date" value={f.lastContact} onChange={(e) => set("lastContact", e.target.value)} />
                : <span>{f.lastContact || <span className="muted">&mdash;</span>}</span>}
            </Row>
            <Row label="Inlognaam klant"><span>{client.loginId}</span></Row>
            <Row label="Snelkoppelingen">
              <div className="quicklinks">
                <a className="ql" href={dashboardUrl}>Klant-dashboard</a>
                {hasSheet && <a className="ql" href={sheetUrl} target="_blank" rel="noreferrer">Google Sheet</a>}
                {f.workDocUrl && <a className="ql" href={f.workDocUrl} target="_blank" rel="noreferrer">Werkdocument</a>}
                {f.resultsUrl && <a className="ql" href={f.resultsUrl} target="_blank" rel="noreferrer">Resultaten</a>}
              </div>
            </Row>
            {editing && (
              <Row label="Google Sheet-link">
                <input value={f.sheetUrl} onChange={(e) => set("sheetUrl", e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..." />
              </Row>
            )}
            {editing && (
              <Row label="Werkdocument-link">
                <input value={f.workDocUrl} onChange={(e) => set("workDocUrl", e.target.value)} placeholder="https://docs.google.com/... (waar alles per klant verzameld is)" />
              </Row>
            )}
            <Row label="Notities">
              {editing
                ? <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={4} placeholder="Vrije notities over deze klant..." />
                : <span className="prewrap">{f.notes || <span className="muted">&mdash;</span>}</span>}
            </Row>
          </div>
        )}

        {tab === "communicatie" && (
          <div className="cockpit-card">
            <Row label="E-maildomein klant">
              {editing
                ? <input value={f.emailDomain} onChange={(e) => set("emailDomain", e.target.value)} placeholder="klant.nl" />
                : <span>{f.emailDomain || <span className="muted">&mdash;</span>}</span>}
            </Row>
            <Row label="Snel zoeken">
              {f.emailDomain ? (
                <div className="quicklinks">
                  <a className="ql" href={outlookSearch} target="_blank" rel="noreferrer">Zoek in Outlook</a>
                  <button className="ql ql-btn" onClick={() => navigator.clipboard?.writeText(f.emailDomain)}>Kopieer zoekterm (voor Superhuman)</button>
                </div>
              ) : <span className="muted">Vul eerst een e-maildomein in.</span>}
            </Row>
            <div className="phase2-note">
              Binnenkort: de laatste e-mails met deze klant automatisch hier, rechtstreeks uit je
              Outlook (maarten@pingwin.nl), met een doorzoekbare chat. Dat is een aparte koppeling
              die we samen aanzetten.
            </div>
          </div>
        )}

        {tab === "resultaten" && (
          <div className="cockpit-card">
            <Row label="Resultaten-document">
              {editing
                ? <input value={f.resultsUrl} onChange={(e) => set("resultsUrl", e.target.value)} placeholder="https://... (rapportage)" />
                : (f.resultsUrl ? <a href={f.resultsUrl} target="_blank" rel="noreferrer" className="doc-link">{f.resultsUrl}</a> : <span className="muted">Nog geen link</span>)}
            </Row>
            <Row label="Voortgang / mijlpalen">
              {editing
                ? <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={5} placeholder="Korte log van resultaten en mijlpalen..." />
                : <span className="prewrap">{f.notes || <span className="muted">&mdash;</span>}</span>}
            </Row>
            <div className="phase2-note">
              Binnenkort: de echte ontwikkeling (zoekverkeer, posities, conversies) automatisch uit
              Search Console, GA en Ahrefs per klant.
            </div>
          </div>
        )}
      </div>

      <div className="footer">Pingwin Online Marketing &middot; Beheer</div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ck-row">
      <div className="ck-label">{label}</div>
      <div className="ck-value">{children}</div>
    </div>
  );
}
