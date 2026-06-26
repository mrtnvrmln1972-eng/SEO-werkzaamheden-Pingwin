"use client";

import { useState } from "react";
import type { ClientConfig } from "../../../../lib/clients";

type Tab = "overzicht" | "documenten" | "communicatie" | "resultaten";

export default function ClientCockpit({ client }: { client: ClientConfig }) {
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
  });

  const sheetUrl = `https://docs.google.com/spreadsheets/d/${client.sheetId}/edit#gid=${client.gid}`;
  const dashboardUrl = `/admin/preview/${client.slug}`;
  const gmailSearch = f.emailDomain
    ? `https://mail.google.com/mail/u/0/#search/${encodeURIComponent(f.emailDomain)}`
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
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="header">
        <div className="header-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
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
          <button className={"tab" + (tab === "documenten" ? " active" : "")} onClick={() => setTab("documenten")}>Documenten</button>
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
            <Row label="Maandfee">
              <span>&euro;{client.budget.maandbudget.toFixed(0)} (incl. linkbuilding &euro;{client.budget.linkbuilding.toFixed(0)})</span>
            </Row>
            <Row label="Laatste contact">
              {editing
                ? <input type="date" value={f.lastContact} onChange={(e) => set("lastContact", e.target.value)} />
                : <span>{f.lastContact || <span className="muted">&mdash;</span>}</span>}
            </Row>
            <Row label="Inlognaam klant"><span>{client.loginId}</span></Row>
            <Row label="Snelkoppelingen">
              <div className="quicklinks">
                <a className="ql" href={dashboardUrl}>Klant-dashboard</a>
                <a className="ql" href={sheetUrl} target="_blank" rel="noreferrer">Google Sheet</a>
                {f.workDocUrl && <a className="ql" href={f.workDocUrl} target="_blank" rel="noreferrer">Werkdocument</a>}
                {f.resultsUrl && <a className="ql" href={f.resultsUrl} target="_blank" rel="noreferrer">Resultaten</a>}
              </div>
            </Row>
            <Row label="Notities">
              {editing
                ? <textarea value={f.notes} onChange={(e) => set("notes", e.target.value)} rows={4} placeholder="Vrije notities over deze klant..." />
                : <span className="prewrap">{f.notes || <span className="muted">&mdash;</span>}</span>}
            </Row>
          </div>
        )}

        {tab === "documenten" && (
          <div className="cockpit-card">
            <Row label="Werkdocument">
              {editing
                ? <input value={f.workDocUrl} onChange={(e) => set("workDocUrl", e.target.value)} placeholder="https://docs.google.com/... (waar alles per klant verzameld is)" />
                : (f.workDocUrl ? <a href={f.workDocUrl} target="_blank" rel="noreferrer" className="doc-link">{f.workDocUrl}</a> : <span className="muted">Nog geen link</span>)}
            </Row>
            <Row label="Resultaten-document">
              {editing
                ? <input value={f.resultsUrl} onChange={(e) => set("resultsUrl", e.target.value)} placeholder="https://... (rapportage / resultaten)" />
                : (f.resultsUrl ? <a href={f.resultsUrl} target="_blank" rel="noreferrer" className="doc-link">{f.resultsUrl}</a> : <span className="muted">Nog geen link</span>)}
            </Row>
            <Row label="Google Sheet (taken)">
              <a href={sheetUrl} target="_blank" rel="noreferrer" className="doc-link">Open de werkzaamheden-sheet</a>
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
                  <a className="ql" href={gmailSearch} target="_blank" rel="noreferrer">Zoek in Gmail</a>
                  <button className="ql ql-btn" onClick={() => navigator.clipboard?.writeText(f.emailDomain)}>Kopieer zoekterm (voor Superhuman)</button>
                </div>
              ) : <span className="muted">Vul eerst een e-maildomein in.</span>}
            </Row>
            <div className="phase2-note">
              Binnenkort: de laatste e-mails met deze klant automatisch hier, rechtstreeks uit je
              Gmail of Outlook (dezelfde mails die je in Superhuman ziet). Dat is een aparte koppeling
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
