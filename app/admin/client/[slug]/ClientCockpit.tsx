"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ClientConfig } from "../../../../lib/clients";
import type {
  EmailSnapshot, MetricSnapshot, KeywordSnapshot, PageSnapshot, ClientStatus,
} from "../../../../lib/snapshots";
import type { GscData, Ga4Data } from "../../../../lib/google";
import type { TaskRow } from "../../../../lib/tasks";
import ChatPanel from "./ChatPanel";
import TasksEditor from "./TasksEditor";
import FocusBlock from "./FocusBlock";

type Tab = "overzicht" | "werkzaamheden" | "resultaten" | "klant";

// Jouw Superhuman-account (Microsoft 365 hangt hieronder).
const SUPERHUMAN_ACCOUNT = "Maarten@pingwin.nl";

type CockpitData = {
  emails: EmailSnapshot[];
  metrics: MetricSnapshot[];
  keywords: KeywordSnapshot[];
  pages: PageSnapshot[];
  lastIngest: string | null;
  status: ClientStatus;
  statusUpdatedAt: string | null;
  mailLive: boolean;
  msConfigured: boolean;
  msConnected: boolean;
  myEmail: string | null;
  monthTasks: {
    thisMonth: { text: string; link: string; done: boolean; wie: string }[];
    nextMonth: { text: string; link: string; done: boolean; wie: string }[];
    thisLabel: string;
    nextLabel: string;
  };
  allClients: { slug: string; name: string }[];
  gsc: GscData | null;
  ga4: Ga4Data | null;
  googleConfigured: boolean;
  googleConnected: boolean;
  chatConfigured: boolean;
  chatHistory: { role: "user" | "assistant"; content: string }[];
  tasks: TaskRow[];
};

export default function ClientCockpit({
  client, emails, metrics, keywords, pages, lastIngest, status, statusUpdatedAt,
  mailLive, msConfigured, msConnected, myEmail, monthTasks, allClients,
  gsc, ga4, googleConfigured, googleConnected, chatConfigured, chatHistory, tasks, initialTab, highlight,
}: { client: ClientConfig; initialTab?: string; highlight?: string } & CockpitData) {
  const router = useRouter();
  const validTab = (t?: string): Tab => (t === "werkzaamheden" || t === "resultaten" || t === "klant" || t === "overzicht") ? t : "overzicht";
  const [tab, setTab] = useState<Tab>(validTab(initialTab));
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [shQuery, setShQuery] = useState("");
  const [openEmail, setOpenEmail] = useState<string | null>(null);
  const replyRef = useRef<HTMLDivElement>(null);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyMsg, setReplyMsg] = useState("");
  const [replyToAddr, setReplyToAddr] = useState("");

  function fmt(cmd: string) {
    document.execCommand(cmd, false);
    replyRef.current?.focus();
  }
  function addLink() {
    const url = window.prompt("Link-adres (URL):", "https://");
    if (url) document.execCommand("createLink", false, url);
  }

  const [statusBusy, setStatusBusy] = useState(false);
  const [showNext, setShowNext] = useState(false);

  async function toggleStatus(index: number, done: boolean) {
    setStatusBusy(true);
    try {
      await fetch("/api/admin/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: client.slug, index, status: done ? "done" : "open" }),
      });
      router.refresh();
    } finally {
      setStatusBusy(false);
    }
  }

  // Naar wie het antwoord gaat: deelnemers van de mail (afzender + to) minus jezelf.
  const myLow = (myEmail || "").toLowerCase();
  function recipientsFor(e: EmailSnapshot): string[] {
    const all = [e.fromAddress || "", ...(e.toAddresses || [])];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const a of all) {
      const low = a.toLowerCase();
      if (!a || low === myLow || seen.has(low)) continue;
      seen.add(low);
      out.push(a);
    }
    return out;
  }

  // Meest voorkomende klant-adres in de mails (niet jezelf, niet @pingwin.nl):
  // dient als terugval als de geopende mail zelf geen klant-ontvanger heeft.
  const addrCount = new Map<string, number>();
  for (const e of emails) {
    for (const a of [e.fromAddress || "", ...(e.toAddresses || [])]) {
      const low = a.toLowerCase();
      if (!a || low === myLow || low.endsWith("@pingwin.nl")) continue;
      addrCount.set(a, (addrCount.get(a) || 0) + 1);
    }
  }
  let primaryClientAddress = client.email || "";
  let bestCount = 0;
  for (const [a, c] of addrCount) if (c > bestCount) { bestCount = c; primaryClientAddress = a; }

  function defaultRecipient(e: EmailSnapshot): string {
    const r = recipientsFor(e).filter((a) => !a.toLowerCase().endsWith("@pingwin.nl"));
    return (r.length > 0 ? r.join(", ") : primaryClientAddress) || "";
  }

  function openMail(e: EmailSnapshot, isOpen: boolean) {
    setOpenEmail(isOpen ? null : e.id);
    setReplyMsg("");
    setReplyToAddr(isOpen ? "" : defaultRecipient(e));
  }

  async function sendReply(id: string) {
    const html = cleanReplyHtml(replyRef.current?.innerHTML || "");
    const text = (replyRef.current?.innerText || "").trim();
    if (!text) return;
    setReplyBusy(true);
    setReplyMsg("");
    try {
      const res = await fetch("/api/admin/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, html, to: replyToAddr }),
      });
      const data = await res.json();
      if (data.ok) {
        const naar = Array.isArray(data.sentTo) && data.sentTo.length > 0 ? data.sentTo.join(", ") : "de klant";
        setReplyMsg(`Verstuurd naar ${naar}.`);
        if (replyRef.current) replyRef.current.innerHTML = "";
      } else setReplyMsg(data.error || "Versturen mislukt.");
    } catch {
      setReplyMsg("Versturen mislukt.");
    } finally {
      setReplyBusy(false);
    }
  }

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
  const lastMailDate = emails.find((e) => e.receivedAt)?.receivedAt || null;

  // Map onderwerp → de exacte mail in de lijst (voor zowel de Superhuman-link
  // als "hier openen" binnen het dashboard).
  const emailMatch = new Map<string, { id: string; idx: number; superhumanLink: string | null }>();
  emails.forEach((e, idx) => {
    if (e.subject) {
      const k = normSubject(e.subject);
      if (!emailMatch.has(k)) emailMatch.set(k, { id: e.id, idx, superhumanLink: e.superhumanLink });
    }
  });

  function openInDashboard(id: string, idx: number) {
    setTab("overzicht");
    setOpenEmail(id);
    setReplyMsg("");
    const target = emails.find((x) => x.id === id);
    setReplyToAddr(target ? defaultRecipient(target) : "");
    setTimeout(() => {
      document.getElementById(`mail-${idx}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 60);
  }

  function openSuperhuman() {
    if (!clientMailQuery) return;
    const q = [clientMailQuery, shQuery.trim()].filter(Boolean).join(" ");
    window.open(`https://mail.superhuman.com/${SUPERHUMAN_ACCOUNT}/search/${encodeURIComponent(q)}`, "_blank");
  }

  function set(k: keyof typeof f, v: string) {
    setF((p) => ({ ...p, [k]: v }));
    setSaved(false);
  }

  async function save() {
    setBusy(true);
    setSaveError("");
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
      } else {
        setSaveError(data.error || "Opslaan mislukt. Log opnieuw in en probeer het nog eens.");
      }
    } catch {
      setSaveError("Opslaan mislukt (geen verbinding). Probeer het nog eens.");
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
          <select
            className="client-switch"
            value={client.slug}
            onChange={(e) => router.push(`/admin/client/${e.target.value}`)}
            title="Wissel van klant"
          >
            {allClients.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name}</option>
            ))}
          </select>
          <nav className="header-tabs">
            <button className={"tab" + (tab === "overzicht" ? " active" : "")} onClick={() => setTab("overzicht")}>Overzicht</button>
            <button className={"tab" + (tab === "werkzaamheden" ? " active" : "")} onClick={() => setTab("werkzaamheden")}>Werkzaamheden</button>
            <button className={"tab" + (tab === "resultaten" ? " active" : "")} onClick={() => setTab("resultaten")}>KPI&rsquo;s</button>
            <button className={"tab" + (tab === "klant" ? " active" : "")} onClick={() => setTab("klant")}>Klant-dashboard</button>
          </nav>
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
        {saved && <div className="saved-msg">Opgeslagen.</div>}
        {saveError && <div className="login-error">{saveError}</div>}

        {tab === "overzicht" && (
          <>
            <div className="cockpit-card">
              <div className="ov-top">
                <div className="ov-contact">
                  <span className="ov-label">Laatste contact</span>
                  {lastMailDate ? (
                    <span>{fmtDate(lastMailDate)} <span className={"contact-badge " + contactColor(lastMailDate)}>{daysAgoLabel(lastMailDate)}</span></span>
                  ) : <span className="muted">Nog geen mail</span>}
                </div>
                <div className="quicklinks">
                  <a className="ql" href={dashboardUrl}>Klant-dashboard</a>
                  {hasSheet && <a className="ql" href={sheetUrl} target="_blank" rel="noreferrer">Google Sheet</a>}
                  {f.workDocUrl && <a className="ql" href={f.workDocUrl} target="_blank" rel="noreferrer">Werkdocument</a>}
                  {f.resultsUrl && <a className="ql" href={f.resultsUrl} target="_blank" rel="noreferrer">Resultaten</a>}
                </div>
              </div>
              {editing && (
                <>
                  <Row label="Google Sheet-link">
                    <input value={f.sheetUrl} onChange={(e) => set("sheetUrl", e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/.../edit#gid=..." />
                  </Row>
                  <Row label="Werkdocument-link">
                    <input value={f.workDocUrl} onChange={(e) => set("workDocUrl", e.target.value)} placeholder="https://docs.google.com/..." />
                  </Row>
                </>
              )}
            </div>

            {(status.exchanges.length > 0 || monthTasks.thisMonth.length > 0 || monthTasks.nextMonth.length > 0 || status.mailActions.length > 0) && (
              <div className="cockpit-card">
                <div className="ck-section-head">
                  <span>Actuele stand van zaken</span>
                  {statusUpdatedAt && <span className="ck-updated">bijgewerkt {fmtDate(statusUpdatedAt)}</span>}
                </div>
                <div className="sov-layout">
                  <div className="sov-thread">
                    <div className="sov-legend">
                      <span><span className="sov-dot client" /> Klant</span>
                      <span><span className="sov-dot us" /> Wij</span>
                      <span className="sov-legend-status"><span className="sov-pill open">open</span><span className="sov-pill done">afgehandeld</span></span>
                    </div>
                    {status.exchanges
                      .map((ex, i) => ({ ex, i }))
                      .sort((a, b) => (b.ex.date || "").localeCompare(a.ex.date || ""))
                      .map(({ ex, i }) => {
                      const isClient = ex.side === "client";
                      const done = ex.status === "done";
                      const cls = "sov-row " + (isClient ? "left" : "right") + " " + (done ? "done" : "open");
                      const m = ex.subject ? emailMatch.get(normSubject(ex.subject)) : undefined;
                      const exLink = m?.superhumanLink || ex.mailLink || null;
                      return (
                        <div className={cls} key={i}>
                          <div className="sov-bubble">
                            <div className="sov-bubble-top">
                              <span className="sov-who">{isClient ? (client.name || "Klant") : "Pingwin"}</span>
                              {ex.date && <span className="sov-date">{fmtDate(ex.date)}</span>}
                              <label className="sov-check" title="Markeer als afgehandeld">
                                <input type="checkbox" checked={done} disabled={statusBusy} onChange={(e) => toggleStatus(i, e.target.checked)} />
                                afgerond
                              </label>
                            </div>
                            <div className="sov-text">{ex.text}</div>
                            <div className="sov-links">
                              {m
                                ? <button type="button" className="sov-maillink as-btn" onClick={() => openInDashboard(m.id, m.idx)}>mail openen &darr;</button>
                                : exLink && <a className="sov-maillink" href={exLink} target="_blank" rel="noreferrer">mail openen (Superhuman) &rarr;</a>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                    {status.exchanges.length === 0 && <div className="muted">Nog geen correspondentie samengevat.</div>}
                  </div>

                  <div className="sov-side">
                    <div className="sov-tasks">
                      <div className="sov-tasks-head">Lopende werkzaamheden</div>
                      <div className="task-month">Deze maand <span className="sov-sub">{monthTasks.thisLabel}</span></div>
                      {monthTasks.thisMonth.length === 0 ? (
                        <div className="muted" style={{ fontSize: 13 }}>Geen taken deze maand.</div>
                      ) : (
                        <ul className="sov-tasks-list">
                          {monthTasks.thisMonth.map((t, i) => (
                            <li key={i} className={t.done ? "task-done" : ""}>
                              {t.wie && <span className={"wie-badge " + (/dev/i.test(t.wie) ? "dev" : "seo")}>{t.wie}</span>}
                              <a href={t.link} target="_blank" rel="noreferrer">{t.text}</a>
                            </li>
                          ))}
                        </ul>
                      )}
                      <button type="button" className="task-toggle" onClick={() => setShowNext((v) => !v)}>
                        {showNext ? "▾" : "▸"} Volgende maand <span className="sov-sub">{monthTasks.nextLabel} ({monthTasks.nextMonth.length})</span>
                      </button>
                      {showNext && (monthTasks.nextMonth.length === 0 ? (
                        <div className="muted" style={{ fontSize: 13 }}>Geen taken volgende maand.</div>
                      ) : (
                        <ul className="sov-tasks-list">
                          {monthTasks.nextMonth.map((t, i) => (
                            <li key={i}>
                              {t.wie && <span className={"wie-badge " + (/dev/i.test(t.wie) ? "dev" : "seo")}>{t.wie}</span>}
                              <a href={t.link} target="_blank" rel="noreferrer">{t.text}</a>
                            </li>
                          ))}
                        </ul>
                      ))}
                    </div>

                    <div className="sov-tasks">
                      <div className="sov-tasks-head">Open punten uit mail</div>
                      {status.mailActions.length === 0 ? (
                        <div className="muted" style={{ fontSize: 13 }}>Nog geen punten uit mails.</div>
                      ) : (
                        <ul className="sov-tasks-list">
                          {status.mailActions.map((a, i) => {
                            const am = a.subject ? emailMatch.get(normSubject(a.subject)) : undefined;
                            return (
                              <li key={i}>
                                {am
                                  ? <button type="button" className="task-link-btn" onClick={() => openInDashboard(am.id, am.idx)}>{a.text}</button>
                                  : a.text}
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>

                    <FocusBlock slug={client.slug} />
                  </div>
                </div>
              </div>
            )}

            <div className="cockpit-card">
              <div className="ck-section-head">
                <span>Laatste e-mails</span>
                <div className="sh-search">
                  <input
                    value={shQuery}
                    onChange={(e) => setShQuery(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") openSuperhuman(); }}
                    placeholder="Zoek bij deze klant, bijv. reviewsterren..."
                  />
                  <button type="button" className="primary-btn small" onClick={openSuperhuman} disabled={!clientMailQuery}>
                    Zoek in Superhuman
                  </button>
                </div>
              </div>
              {lastIngest && <div className="ck-updated" style={{ marginBottom: 12 }}>bijgewerkt {fmtDate(lastIngest)}</div>}
              {mailLive && (
                <div className="mail-live-badge">
                  ● Live uit Microsoft 365
                  <a className="mail-reconnect" href="/api/ms/auth/start">opnieuw koppelen</a>
                </div>
              )}
              {msConfigured && !msConnected && (
                <div className="mail-connect">
                  Koppel Microsoft 365 om de volledige mails te zien en vanuit het dashboard te beantwoorden.{" "}
                  <a className="primary-btn small" href="/api/ms/auth/start">Koppel Microsoft</a>
                </div>
              )}
              {emails.length === 0 ? (
                <div className="phase2-note">
                  Nog geen mails ingeladen. Deze lijst vult zich met de laatste e-mails met deze klant
                  en opent ze rechtstreeks in Superhuman.
                </div>
              ) : (
                <div className="email-list">
                  {emails.map((e, idx) => {
                    const open = openEmail === e.id;
                    const shLink = e.superhumanLink || e.webLink || "";
                    return (
                      <div className={"email-row" + (open ? " open" : "")} key={e.id} id={`mail-${idx}`}>
                        <div className="email-head" onClick={() => openMail(e, open)}>
                          <div className="email-head-main">
                            <div className="email-top">
                              <span className={"email-dir " + (e.direction === "out" ? "out" : "in")}>
                                {e.direction === "out" ? "verzonden" : "ontvangen"}
                              </span>
                              <span className="email-from">{e.fromName || e.fromAddress || "—"}</span>
                              <span className="email-date">{e.receivedAt ? fmtDateTime(e.receivedAt) : ""}</span>
                            </div>
                            <div className="email-subject">{e.subject || "(geen onderwerp)"}</div>
                            {!open && e.preview && <div className="email-preview">{e.preview}</div>}
                          </div>
                          <div className="email-head-actions">
                            {shLink && (
                              <a className="ql ql-mini" href={shLink} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()}>Superhuman</a>
                            )}
                            <span className="email-caret">{open ? "▲" : "▼"}</span>
                          </div>
                        </div>
                        {open && (
                          <div className="email-body">
                            <div className="email-actions">
                              {shLink && <a className="ql" href={shLink} target="_blank" rel="noreferrer">Open in Superhuman</a>}
                              {shLink && <a className="ql" href={shLink} target="_blank" rel="noreferrer">Beantwoorden in Superhuman</a>}
                            </div>
                            {e.bodyHtml ? (
                              <div className="email-html" dangerouslySetInnerHTML={{ __html: sanitizeEmail(e.bodyHtml) }} />
                            ) : (
                              <div className="email-preview-full">
                                {e.preview}
                                <div className="muted" style={{ marginTop: 8 }}>Volledige tekst nog niet ingeladen, open de mail in Superhuman.</div>
                              </div>
                            )}
                            {mailLive && (
                              <div className="email-reply">
                                <div className="reply-target">
                                  <div>Je beantwoordt: <strong>{e.subject || "(geen onderwerp)"}</strong>{e.receivedAt && <> &middot; {fmtDateTime(e.receivedAt)}</>}</div>
                                  <div className="reply-to-row">
                                    <label>Aan:</label>
                                    <input
                                      className="reply-to-input"
                                      value={replyToAddr}
                                      onChange={(ev) => setReplyToAddr(ev.target.value)}
                                      placeholder="e-mailadres van de klant"
                                    />
                                  </div>
                                </div>
                                <div className="rt-toolbar">
                                  <button type="button" title="Vet" onMouseDown={(ev) => { ev.preventDefault(); fmt("bold"); }}><b>B</b></button>
                                  <button type="button" title="Cursief" onMouseDown={(ev) => { ev.preventDefault(); fmt("italic"); }}><i>I</i></button>
                                  <button type="button" title="Opsomming (bullets)" onMouseDown={(ev) => { ev.preventDefault(); fmt("insertUnorderedList"); }}>&bull; Lijst</button>
                                  <button type="button" title="Selecteer eerst tekst, dan link toevoegen" onMouseDown={(ev) => { ev.preventDefault(); addLink(); }}>Link</button>
                                </div>
                                <div
                                  className="rt-editor"
                                  contentEditable
                                  suppressContentEditableWarning
                                  ref={replyRef}
                                  data-placeholder="Typ je antwoord, met opmaak..."
                                />
                                <div className="email-reply-bar">
                                  <button type="button" className="primary-btn small" onClick={() => sendReply(e.id)} disabled={replyBusy || !replyToAddr.trim()}>
                                    {replyBusy ? "Versturen..." : "Verstuur antwoord"}
                                  </button>
                                  {replyMsg && <span className={"reply-msg" + (replyMsg.startsWith("Verstuurd") ? " ok" : " err")}>{replyMsg}</span>}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </>
        )}

        {tab === "werkzaamheden" && (
          <TasksEditor slug={client.slug} initialTasks={tasks} budget={client.budget} clientName={client.name} highlight={highlight} />
        )}

        {tab === "resultaten" && (
          <>
            {googleConfigured && !googleConnected && (
              <div className="cockpit-card">
                <div className="mail-connect">
                  Koppel Google om Search Console en Analytics te tonen (vertoningen, klikken, CTR, posities, bezoekers).{" "}
                  <a className="primary-btn small" href="/api/google/auth/start">Koppel Google</a>
                </div>
              </div>
            )}

            {gsc && (gsc.metrics.length > 0 || gsc.keywords.length > 0) && (
              <>
                <div className="cockpit-card">
                  <div className="ck-section-head">
                    <span>Search Console</span>
                    <span className="ck-updated">laatste 28 dagen</span>
                  </div>
                  {gsc.metrics.length > 0 && (
                    <div className="kpi-grid">
                      {gsc.metrics.map((m) => (
                        <div className="kpi-card" key={m.metric}>
                          <div className="kpi-value">{fmtMetric(m.metric, m.value)}</div>
                          <div className="kpi-label">{metricLabel(m.metric)}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {gsc.keywords.length > 0 && (
                  <div className="cockpit-card">
                    <div className="ck-section-head"><span>Zoekwoorden uit Search Console ({gsc.keywords.length})</span></div>
                    <div className="res-table-wrap">
                      <table className="res-table">
                        <thead><tr><th>Zoekwoord</th><th>Positie</th><th>Klikken</th><th>Vertoningen</th><th>CTR</th></tr></thead>
                        <tbody>
                          {gsc.keywords.map((k) => (
                            <tr key={k.keyword}>
                              <td>{k.keyword}</td>
                              <td>{k.position.toFixed(1)}</td>
                              <td>{k.clicks.toLocaleString("nl-NL")}</td>
                              <td>{k.impressions.toLocaleString("nl-NL")}</td>
                              <td>{k.ctr.toFixed(1)}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
            {gsc && gsc.connected && gsc.site === null && (
              <div className="cockpit-card"><div className="phase2-note">Google is gekoppeld, maar er is nog geen Search Console-property gevonden voor {client.domain || "deze klant"}.</div></div>
            )}

            {ga4 && ga4.metrics.length > 0 && (
              <div className="cockpit-card">
                <div className="ck-section-head">
                  <span>Google Analytics</span>
                  <span className="ck-updated">laatste 28 dagen</span>
                </div>
                <div className="kpi-grid">
                  {ga4.metrics.map((m) => (
                    <div className="kpi-card" key={m.metric}>
                      <div className="kpi-value">{m.value.toLocaleString("nl-NL")}</div>
                      <div className="kpi-label">{metricLabel(m.metric)}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {ga4 && ga4.connected && ga4.propertyId === null && (
              <div className="cockpit-card"><div className="phase2-note">Google is gekoppeld, maar er is nog geen GA4-property gevonden voor {client.domain || "deze klant"} (controleer of dit account toegang heeft tot de Analytics-property).</div></div>
            )}

            {metrics.length === 0 && keywords.length === 0 && pages.length === 0 && !(gsc && gsc.keywords.length > 0) ? (
              <div className="cockpit-card">
                <div className="phase2-note">
                  Nog geen Ahrefs-cijfers ingeladen voor {client.domain || "deze klant"}.
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

            {gsc && gsc.pages.length > 0 && (
              <div className="cockpit-card">
                <div className="ck-section-head"><span>Pagina&rsquo;s uit Search Console</span></div>
                <div className="res-table-wrap">
                  <table className="res-table">
                    <thead><tr><th>Pagina</th><th>Klikken</th><th>Vertoningen</th></tr></thead>
                    <tbody>
                      {gsc.pages.map((p) => (
                        <tr key={p.url}>
                          <td><a href={p.url} target="_blank" rel="noreferrer">{shortUrl(p.url)}</a></td>
                          <td>{p.clicks.toLocaleString("nl-NL")}</td>
                          <td>{p.impressions.toLocaleString("nl-NL")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {tab === "klant" && (
          <div className="cockpit-card client-frame-card">
            <div className="ck-section-head"><span>Klant-dashboard (zo ziet de klant het)</span>
              <a className="logout-btn" href={`/admin/preview/${client.slug}`} target="_blank" rel="noreferrer">Openen in nieuw tabblad ↗</a>
            </div>
            <iframe src={`/admin/preview/${client.slug}`} className="client-frame" title="Klant-dashboard" />
          </div>
        )}
      </div>

      <div className="footer">Pingwin Online Marketing &middot; Beheer</div>

      <ChatPanel slug={client.slug} configured={chatConfigured} initialMessages={chatHistory} />
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
  totalUsers: "Bezoekers",
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

// Lichte opschoning van mail-HTML voor weergave in het dashboard:
// scripts/styles/event-handlers en javascript-links eruit.
function sanitizeEmail(html: string): string {
  return html
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*style[\s\S]*?<\s*\/\s*style\s*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

function normSubject(s: string): string {
  return s.replace(/^((re|fw|fwd):\s*)+/i, "").trim().toLowerCase();
}

// Schoont de HTML uit de editor op: paragrafen/divs naar gewone regels (zonder
// de grote standaard-marges van <p>), hoogstens één witregel, en getypte
// **vet** wordt echt vet. Lijsten (ul/li) blijven intact.
function cleanReplyHtml(html: string): string {
  return html
    // lege blokken (alleen een regeleinde) volledig weg
    .replace(/<(p|div)[^>]*>\s*(<br\s*\/?>)?\s*<\/(p|div)>/gi, "")
    // grens tussen twee paragrafen → één witregel
    .replace(/<\/(p|div)>\s*<(p|div)[^>]*>/gi, "<br><br>")
    // overige blok-tags weghalen (marges veroorzaken de grote witgaten)
    .replace(/<\/?(p|div)[^>]*>/gi, "")
    // getypte markdown-vet omzetten
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // nooit meer dan één witregel
    .replace(/(<br\s*\/?>\s*){3,}/gi, "<br><br>")
    .replace(/^(\s*<br\s*\/?>)+/i, "")
    .replace(/(<br\s*\/?>\s*)+$/i, "")
    .trim();
}

function daysSince(iso: string): number | null {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  const ms = Date.now() - d.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function daysAgoLabel(iso: string): string {
  const n = daysSince(iso);
  if (n == null) return "";
  if (n <= 0) return "vandaag";
  if (n === 1) return "1 dag geleden";
  return `${n} dagen geleden`;
}

function contactColor(iso: string): string {
  const n = daysSince(iso);
  if (n == null) return "gray";
  if (n < 7) return "green";
  if (n < 14) return "orange";
  return "red";
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" }) +
    ", " + d.toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
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
