"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClientConfig } from "../../../../lib/clients";
import type {
  EmailSnapshot, MetricSnapshot, KeywordSnapshot, PageSnapshot, StatusCard,
} from "../../../../lib/snapshots";

type Tab = "overzicht" | "communicatie" | "resultaten";

// Jouw Superhuman-account (Microsoft 365 hangt hieronder).
const SUPERHUMAN_ACCOUNT = "Maarten@pingwin.nl";

type CockpitData = {
  emails: EmailSnapshot[];
  metrics: MetricSnapshot[];
  keywords: KeywordSnapshot[];
  pages: PageSnapshot[];
  lastIngest: string | null;
  statusCards: StatusCard[];
  statusUpdatedAt: string | null;
};

export default function ClientCockpit({
  client, emails, metrics, keywords, pages, lastIngest, statusCards, statusUpdatedAt,
}: { client: ClientConfig } & CockpitData) {
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
  const clientMailQuery = (client.email || client.domain || "").trim();
  const superhumanSearch = clientMailQuery
    ? `https://mail.superhuman.com/${SUPERHUMAN_ACCOUNT}/search/${encodeURIComponent(clientMailQuery)}`
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
          <>
            <div className="cockpit-card">
              <div className="ck-section-head">
                <span>Laatste e-mails</span>
                {lastIngest && <span className="ck-updated">bijgewerkt {fmtDate(lastIngest)}</span>}
              </div>
              {superhumanSearch && (
                <div className="quicklinks" style={{ marginBottom: 14 }}>
                  <a className="ql" href={superhumanSearch} target="_blank" rel="noreferrer">Open alle mails in Superhuman</a>
                  <span className="muted" style={{ fontSize: 12 }}>zoekt op {clientMailQuery}</span>
                </div>
              )}
              {emails.length === 0 ? (
                <div className="phase2-note">
                  Nog geen mails ingeladen. Deze lijst vult zich met de laatste e-mails met deze klant
                  en opent ze rechtstreeks in Superhuman.
                </div>
              ) : (
                <div className="email-list">
                  {emails.map((e) => {
                    const href = e.superhumanLink || e.webLink || "#";
                    return (
                      <a key={e.id} className="email-row" href={href} target="_blank" rel="noreferrer">
                        <div className="email-top">
                          <span className={"email-dir " + (e.direction === "out" ? "out" : "in")}>
                            {e.direction === "out" ? "verzonden" : "ontvangen"}
                          </span>
                          <span className="email-from">{e.fromName || e.fromAddress || "—"}</span>
                          <span className="email-date">{e.receivedAt ? fmtDate(e.receivedAt) : ""}</span>
                        </div>
                        <div className="email-subject">{e.subject || "(geen onderwerp)"}</div>
                        {e.preview && <div className="email-preview">{e.preview}</div>}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            {statusCards.length > 0 && (
              <div className="cockpit-card">
                <div className="ck-section-head">
                  <span>Actuele stand van zaken</span>
                  {statusUpdatedAt && <span className="ck-updated">bijgewerkt {fmtDate(statusUpdatedAt)}</span>}
                </div>
                <div className="status-scroll">
                  {statusCards.map((c, i) => (
                    <div className={"status-card sc-" + (c.color || "gray")} key={i}>
                      <div className="status-card-title">{c.title}</div>
                      <ul className="status-card-list">
                        {c.items.map((it, j) => <li key={j}>{it}</li>)}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {tab === "resultaten" && (
          <>
            {metrics.length === 0 && keywords.length === 0 && pages.length === 0 ? (
              <div className="cockpit-card">
                <div className="phase2-note">
                  Nog geen cijfers ingeladen. Hier komen de echte KPI&rsquo;s uit Search Console, Analytics
                  en Ahrefs voor {client.domain || "deze klant"}: vertoningen, klikken, posities, bezoekers,
                  CTR en de belangrijkste zoekwoorden en pagina&rsquo;s.
                </div>
              </div>
            ) : (
              <>
                {SOURCES.map((src) => {
                  const ms = metrics.filter((m) => m.source === src.key);
                  if (ms.length === 0) return null;
                  return (
                    <div className="cockpit-card" key={src.key}>
                      <div className="ck-section-head">
                        <span>{src.label}</span>
                        {lastIngest && <span className="ck-updated">bijgewerkt {fmtDate(lastIngest)}</span>}
                      </div>
                      <div className="kpi-grid">
                        {ms.map((m) => (
                          <div className="kpi-card" key={m.metric + m.period}>
                            <div className="kpi-value">{fmtMetric(m.metric, m.value)}</div>
                            <div className="kpi-label">{metricLabel(m.metric)}</div>
                            <div className="kpi-period">{periodLabel(m.period)}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {keywords.length > 0 && (
                  <div className="cockpit-card">
                    <div className="ck-section-head"><span>Zoekwoorden ({keywords.length})</span></div>
                    <div className="res-table-wrap">
                      <table className="res-table">
                        <thead><tr><th>Zoekwoord</th><th>Positie</th><th>Verschil</th><th>Volume</th></tr></thead>
                        <tbody>
                          {keywords.map((k) => {
                            const delta = k.prevPosition != null && k.position != null ? k.prevPosition - k.position : null;
                            return (
                              <tr key={k.keyword}>
                                <td>{k.url ? <a href={k.url} target="_blank" rel="noreferrer">{k.keyword}</a> : k.keyword}</td>
                                <td>{k.position != null ? k.position.toFixed(0) : "—"}</td>
                                <td className={delta == null ? "" : delta > 0 ? "pos-up" : delta < 0 ? "pos-down" : ""}>
                                  {delta == null || delta === 0 ? "—" : (delta > 0 ? `▲ ${delta}` : `▼ ${Math.abs(delta)}`)}
                                </td>
                                <td>{k.volume != null ? k.volume.toLocaleString("nl-NL") : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {pages.length > 0 && (
                  <div className="cockpit-card">
                    <div className="ck-section-head"><span>Belangrijkste pagina&rsquo;s</span></div>
                    <div className="res-table-wrap">
                      <table className="res-table">
                        <thead><tr><th>Pagina</th><th>Klikken</th><th>Vertoningen</th><th>Verkeer</th></tr></thead>
                        <tbody>
                          {pages.map((p) => (
                            <tr key={p.url}>
                              <td><a href={p.url} target="_blank" rel="noreferrer">{shortUrl(p.url)}</a></td>
                              <td>{p.clicks != null ? p.clicks.toLocaleString("nl-NL") : "—"}</td>
                              <td>{p.impressions != null ? p.impressions.toLocaleString("nl-NL") : "—"}</td>
                              <td>{p.traffic != null ? p.traffic.toLocaleString("nl-NL") : "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}

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
            </div>
          </>
        )}
      </div>

      <div className="footer">Pingwin Online Marketing &middot; Beheer</div>
    </>
  );
}

const SOURCES = [
  { key: "gsc", label: "Search Console" },
  { key: "ga4", label: "Google Analytics" },
  { key: "ahrefs", label: "Ahrefs" },
];

const METRIC_LABELS: Record<string, string> = {
  clicks: "Klikken",
  impressions: "Vertoningen",
  ctr: "CTR",
  position: "Gem. positie",
  users: "Bezoekers",
  sessions: "Sessies",
  conversions: "Conversies",
  org_traffic: "Organisch verkeer",
  org_keywords: "Organische zoekwoorden",
  domain_rating: "Domain Rating",
};

function metricLabel(metric: string): string {
  return METRIC_LABELS[metric] || metric;
}

function fmtMetric(metric: string, value: number | null): string {
  if (value == null) return "—";
  if (metric === "ctr") return `${value.toFixed(1)}%`;
  if (metric === "position") return value.toFixed(1);
  if (metric === "domain_rating") return value.toFixed(0);
  return value.toLocaleString("nl-NL");
}

function periodLabel(period: string): string {
  if (period === "last28") return "laatste 28 dagen";
  if (period === "last7") return "laatste 7 dagen";
  if (period === "last90") return "laatste 90 dagen";
  if (period === "now") return "nu";
  return period;
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname === "/" ? u.hostname : u.pathname).replace(/\/$/, "") || url;
  } catch {
    return url;
  }
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ck-row">
      <div className="ck-label">{label}</div>
      <div className="ck-value">{children}</div>
    </div>
  );
}
