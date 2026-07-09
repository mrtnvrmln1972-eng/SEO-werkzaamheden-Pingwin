"use client";

import { useEffect, useRef, useState } from "react";
import type { ProfitLoss, LedgerAccount, PostContact } from "../../../lib/moneybird";
import { mdToHtml } from "../../../lib/markdown";

// Uitklapbare posten op de financiën-pagina (alleen Maarten):
// niveau 1 = post (grootboekrekening), niveau 2 = klant/leverancier,
// niveau 3 = de losse facturen met deeplink naar Moneybird.

const MONTH_NAMES = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function euro(n: number): string {
  return "€ " + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtDate(d: string): string {
  if (!/^\d{4}-\d{2}-\d{2}/.test(d)) return d;
  return `${d.slice(8, 10)}-${d.slice(5, 7)}-${d.slice(0, 4)}`;
}

const STATE_LABEL: Record<string, string> = {
  open: "open", late: "te laat", reminded: "herinnerd", paid: "betaald",
  saved: "geboekt", new: "nieuw", pending_payment: "betaling onderweg", uncollectible: "oninbaar",
};

const card: React.CSSProperties = { border: "1px solid #eadfce", borderRadius: 12, background: "#fff", padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 18 };
const rowBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", padding: "9px 4px", cursor: "pointer", fontSize: 14, color: "#1f2937", textAlign: "left", borderBottom: "1px solid #f1e9db" };
const caret: React.CSSProperties = { width: 14, color: "#d97316", flex: "0 0 auto", fontSize: 12 };
const amountRight: React.CSSProperties = { marginLeft: "auto", fontVariantNumeric: "tabular-nums", fontWeight: 600 };

type Props = {
  months: ProfitLoss[];
  ledger: LedgerAccount[];
  year: number;
  selectedMonth: number | null; // 1-12 of null = heel jaar
};

export default function FinancienClient({ months, ledger, year, selectedMonth }: Props) {
  const ledgerName = (id: string) => ledger.find((l) => l.id === id)?.name || "Onbekende post";
  const period = selectedMonth
    ? `${year}${String(selectedMonth).padStart(2, "0")}`
    : `${year}01..${year}12`;

  // Posten optellen over de gekozen periode.
  const source = selectedMonth ? months.slice(selectedMonth - 1, selectedMonth) : months;
  function aggregate(pick: (m: ProfitLoss) => { ledgerAccountId: string; value: number }[]): { id: string; name: string; value: number }[] {
    const map = new Map<string, number>();
    for (const m of source) for (const r of pick(m)) map.set(r.ledgerAccountId, (map.get(r.ledgerAccountId) || 0) + r.value);
    return [...map.entries()]
      .map(([id, value]) => ({ id, name: ledgerName(id), value }))
      .filter((r) => Math.abs(r.value) >= 0.005)
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value));
  }
  const revenuePosts = aggregate((m) => m.revenueByLedger);
  const costPosts = aggregate((m) => m.costsByLedger);

  return (
    <>
      <PostSection title="Opbrengsten per post" type="revenue" posts={revenuePosts} period={period} color="#2E7D32" />
      <PostSection title="Kosten per post" type="cost" posts={costPosts} period={period} color="#C62828" />
      <Abonnementen />
      <FinanceChat />
      <p style={{ color: "#8a6a3e", fontSize: 12, lineHeight: 1.5 }}>
        De posten komen rechtstreeks uit het winst&amp;verlies-rapport van Moneybird. Bij het openklappen
        zie je de facturen achter een post; boekingen die buiten facturen om lopen (bijvoorbeeld
        rechtstreeks vanaf de bank) kunnen een klein verschil geven met het posttotaal.
      </p>
    </>
  );
}

// ─── Niveau 1: de posten, met per post een uitklap naar contacten/facturen ───

function PostSection({ title, type, posts, period, color }: {
  title: string; type: "revenue" | "cost";
  posts: { id: string; name: string; value: number }[];
  period: string; color: string;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const total = posts.reduce((s, p) => s + p.value, 0);

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#8a6a3e" }}>{title}</div>
        <div style={{ marginLeft: "auto", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{euro(total)}</div>
      </div>
      {posts.length === 0 && <div style={{ color: "#5b6472", fontSize: 14, padding: "6px 4px" }}>Niets geboekt in deze periode.</div>}
      {posts.map((p) => (
        <div key={p.id}>
          <button type="button" style={rowBtn} onClick={() => setOpen((o) => ({ ...o, [p.id]: !o[p.id] }))}>
            <span style={caret}>{open[p.id] ? "▾" : "▸"}</span>
            <span>{p.name}</span>
            <span style={{ ...amountRight, color }}>{euro(p.value)}</span>
          </button>
          {open[p.id] && <PostDetail type={type} ledgerId={p.id} period={period} />}
        </div>
      ))}
    </div>
  );
}

// ─── Niveau 2 en 3: contacten binnen een post, en hun facturen ───

function PostDetail({ type, ledgerId, period }: { type: "revenue" | "cost"; ledgerId: string; period: string }) {
  const [contacts, setContacts] = useState<PostContact[] | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let alive = true;
    setContacts(null); setError("");
    (async () => {
      try {
        const res = await fetch(`/api/admin/moneybird/financien?level=post&type=${type}&ledgerId=${ledgerId}&period=${encodeURIComponent(period)}`);
        const data = await res.json();
        if (!alive) return;
        if (!res.ok || !data.ok) setError(data.error || "Details ophalen mislukt.");
        else setContacts(data.contacts);
      } catch { if (alive) setError("Details ophalen mislukt."); }
    })();
    return () => { alive = false; };
  }, [type, ledgerId, period]);

  if (error) return <div style={{ color: "#a13d3d", fontSize: 13, padding: "8px 26px" }}>{error}</div>;
  if (!contacts) return <div style={{ color: "#8a6a3e", fontSize: 13, padding: "8px 26px" }}>Facturen laden&hellip;</div>;
  if (contacts.length === 0) return <div style={{ color: "#5b6472", fontSize: 13, padding: "8px 26px" }}>Geen facturen op deze post gevonden (mogelijk rechtstreeks geboekt).</div>;

  return (
    <div style={{ padding: "2px 0 8px 26px" }}>
      {contacts.map((c) => {
        const key = c.contactId || c.contactName;
        return (
          <div key={key}>
            <button type="button" style={{ ...rowBtn, fontSize: 13 }} onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}>
              <span style={caret}>{open[key] ? "▾" : "▸"}</span>
              <span>{c.contactName}</span>
              <span style={{ ...amountRight, color: "#5b6472" }}>{euro(c.total)}</span>
            </button>
            {open[key] && (
              <div style={{ padding: "2px 0 6px 26px" }}>
                {c.invoices.map((inv) => (
                  <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 4px", fontSize: 13, borderBottom: "1px dashed #f1e9db" }}>
                    <a href={inv.url} target="_blank" rel="noreferrer" style={{ color: "#1a6dd6", textDecoration: "underline", textUnderlineOffset: 2 }}>
                      {inv.label}
                    </a>
                    <span style={{ color: "#8a6a3e" }}>{fmtDate(inv.date)}</span>
                    <span style={{ color: "#8a6a3e" }}>{STATE_LABEL[inv.state] || inv.state}</span>
                    <span style={{ ...amountRight, fontWeight: 500 }}>{euro(inv.amount)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Financiën-chat: vragen over de cijfers (besparingen, winst, prognose) ───

type FinMsg = { role: "user" | "assistant"; content: string };

function FinanceChat() {
  const [messages, setMessages] = useState<FinMsg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/admin/finance-chat").then((r) => r.json())
      .then((d) => { if (d.ok && Array.isArray(d.messages)) setMessages(d.messages); })
      .catch(() => { /* stil */ });
  }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [messages, busy]);

  async function send() {
    const t = input.trim();
    if (!t || busy) return;
    setError("");
    const next = [...messages, { role: "user" as const, content: t }];
    setMessages(next); setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/admin/finance-chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const d = await r.json();
      if (d.ok) setMessages((m) => [...m, { role: "assistant", content: d.answer }]);
      else setError(d.error || "Er ging iets mis.");
    } catch { setError("De adviseur is niet bereikbaar."); } finally { setBusy(false); }
  }

  async function wis() {
    if (!window.confirm("Dit gesprek wissen?")) return;
    setMessages([]); setError("");
    await fetch("/api/admin/finance-chat", { method: "DELETE" }).catch(() => {});
  }

  return (
    <div style={card}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#8a6a3e" }}>Vraag het de cijfers</div>
        <span style={{ color: "#5b6472", fontSize: 13 }}>besparingen, winstpotentieel, prognose einde jaar</span>
        {messages.length > 0 && <button type="button" className="ghost-btn small" style={{ marginLeft: "auto" }} onClick={wis}>Gesprek wissen</button>}
      </div>
      {messages.length > 0 && (
        <div style={{ maxHeight: 420, overflowY: "auto", padding: "4px 2px", marginBottom: 10 }}>
          {messages.map((m, i) => (
            m.role === "user"
              ? <div key={i} style={{ background: "#FFF4EE", border: "1px solid #f0d9c8", borderRadius: 10, padding: "8px 12px", margin: "8px 0 8px 15%", fontSize: 14 }}>{m.content}</div>
              : <div key={i} className="md" style={{ border: "1px solid #f1e9db", borderRadius: 10, padding: "10px 14px", margin: "8px 15% 8px 0", fontSize: 14 }} dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
          ))}
          {busy && <div style={{ color: "#8a6a3e", fontSize: 13, padding: "6px 2px" }}>Aan het rekenen…</div>}
          <div ref={endRef} />
        </div>
      )}
      {error && <div className="login-error" style={{ marginBottom: 10 }}>{error}</div>}
      <div style={{ display: "flex", gap: 8 }}>
        <input
          className="compose-input"
          style={{ flex: 1 }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          placeholder="Bijv. Waar kan ik kosten besparen? Wat is de prognose voor het einde van het jaar?"
          disabled={busy}
        />
        <button type="button" className="primary-btn small" onClick={send} disabled={busy || !input.trim()}>{busy ? "Bezig…" : "Vraag"}</button>
      </div>
    </div>
  );
}

// ─── Terugkerende kosten / abonnementen ───

type Recurring = {
  contactName: string;
  monthsPresent: number;
  avgPerMonth: number;
  perYear: number;
  history: { month: string; value: number }[];
};

function Abonnementen() {
  const [openSection, setOpenSection] = useState(false);
  const [rows, setRows] = useState<Recurring[] | null>(null);
  const [error, setError] = useState("");
  const [openRow, setOpenRow] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!openSection || rows !== null) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/moneybird/financien?level=abonnementen&months=6");
        const data = await res.json();
        if (!alive) return;
        if (!res.ok || !data.ok) { setError(data.error || "Ophalen mislukt."); return; }
        // perMonth[0] = huidige maand, [1] = vorige maand, ...
        const months: string[] = data.months;
        const perMonth: { contactId: string; contactName: string; value: number }[][] = data.perMonth;
        const byContact = new Map<string, Recurring & { set: Set<number> }>();
        perMonth.forEach((list, mi) => {
          for (const c of list) {
            const cur = byContact.get(c.contactId) || { contactName: c.contactName, monthsPresent: 0, avgPerMonth: 0, perYear: 0, history: [], set: new Set<number>() };
            cur.contactName = cur.contactName || c.contactName;
            cur.set.add(mi);
            cur.history.push({ month: months[mi], value: c.value });
            byContact.set(c.contactId, cur);
          }
        });
        // Terugkerend = in minstens 3 opeenvolgende maanden kosten bij dezelfde leverancier.
        const result: Recurring[] = [];
        for (const r of byContact.values()) {
          let run = 0, best = 0;
          for (let i = 0; i < months.length; i++) { run = r.set.has(i) ? run + 1 : 0; best = Math.max(best, run); }
          if (best < 3) continue;
          const totalVal = r.history.reduce((s, h) => s + h.value, 0);
          const avg = totalVal / r.set.size;
          result.push({
            contactName: r.contactName || "Onbekende leverancier",
            monthsPresent: r.set.size,
            avgPerMonth: avg,
            perYear: avg * 12,
            history: r.history.sort((a, b) => a.month.localeCompare(b.month)),
          });
        }
        result.sort((a, b) => b.avgPerMonth - a.avgPerMonth);
        setRows(result);
      } catch { if (alive) setError("Ophalen mislukt."); }
    })();
    return () => { alive = false; };
  }, [openSection, rows]);

  return (
    <div style={card}>
      <button type="button" style={{ ...rowBtn, borderBottom: "none", padding: "0 0 4px" }} onClick={() => setOpenSection((v) => !v)}>
        <span style={caret}>{openSection ? "▾" : "▸"}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: "#8a6a3e" }}>Terugkerende kosten / abonnementen</span>
      </button>
      <div style={{ color: "#5b6472", fontSize: 13, margin: "0 0 6px 22px" }}>
        Leveranciers waar in minstens 3 opeenvolgende maanden (van de laatste 6) kosten aan zijn geboekt.
        Handig om dubbele of vergeten abonnementen op te sporen.
      </div>
      {openSection && (
        <div style={{ paddingLeft: 22 }}>
          {error && <div style={{ color: "#a13d3d", fontSize: 13, padding: "6px 0" }}>{error}</div>}
          {!error && rows === null && <div style={{ color: "#8a6a3e", fontSize: 13, padding: "6px 0" }}>Laden&hellip;</div>}
          {rows !== null && rows.length === 0 && <div style={{ color: "#5b6472", fontSize: 13, padding: "6px 0" }}>Geen terugkerende leveranciers gevonden in de laatste 6 maanden.</div>}
          {rows !== null && rows.map((r) => (
            <div key={r.contactName}>
              <button type="button" style={{ ...rowBtn, fontSize: 13 }} onClick={() => setOpenRow((o) => ({ ...o, [r.contactName]: !o[r.contactName] }))}>
                <span style={caret}>{openRow[r.contactName] ? "▾" : "▸"}</span>
                <span>{r.contactName}</span>
                <span style={{ color: "#8a6a3e", marginLeft: 8 }}>{r.monthsPresent} van 6 maanden</span>
                <span style={{ ...amountRight, color: "#C62828" }}>{euro(r.avgPerMonth)}/mnd &nbsp;(&plusmn; {euro(r.perYear)}/jaar)</span>
              </button>
              {openRow[r.contactName] && (
                <div style={{ padding: "2px 0 6px 26px", fontSize: 13 }}>
                  {r.history.map((h) => (
                    <div key={h.month} style={{ display: "flex", gap: 10, padding: "4px 4px", borderBottom: "1px dashed #f1e9db" }}>
                      <span style={{ color: "#8a6a3e" }}>{MONTH_NAMES[Number(h.month.slice(4, 6)) - 1]} {h.month.slice(0, 4)}</span>
                      <span style={{ ...amountRight, fontWeight: 500 }}>{euro(h.value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
