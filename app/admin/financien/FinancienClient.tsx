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

const card: React.CSSProperties = { border: "1px solid var(--kleur-rand-zacht)", borderRadius: 12, background: "#fff", padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 18 };
const rowBtn: React.CSSProperties = { display: "flex", alignItems: "center", gap: 8, width: "100%", background: "none", border: "none", padding: "9px 4px", cursor: "pointer", fontSize: 14, color: "var(--kleur-kop)", textAlign: "left", borderBottom: "1px solid var(--kleur-rand-zacht)" };
const caret: React.CSSProperties = { width: 14, color: "var(--accent-warm)", flex: "0 0 auto", fontSize: 12 };
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
      <PostSection title="Opbrengsten per post" type="revenue" posts={revenuePosts} period={period} color="var(--good)" />
      <PostSection title="Kosten per post" type="cost" posts={costPosts} period={period} color="var(--bad)" />
      <Abonnementen />
      <FinanceChat />
      <p style={{ color: "var(--label-muted)", fontSize: "var(--fs-sm)", lineHeight: "var(--lh-sm)" }}>
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
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--s-3)", marginBottom: "var(--s-2)" }}>
        <div style={{ fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--label-muted)" }}>{title}</div>
        <div style={{ marginLeft: "auto", fontWeight: 700, color, fontVariantNumeric: "tabular-nums" }}>{euro(total)}</div>
      </div>
      {posts.length === 0 && <div style={{ color: "var(--text-secondary)", fontSize: "var(--fs-base)", padding: "var(--s-2) var(--s-1)" }}>Niets geboekt in deze periode.</div>}
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

  if (error) return <div style={{ color: "var(--bad-deep)", fontSize: "var(--fs-sm)", padding: "var(--s-2) var(--s-6)" }}>{error}</div>;
  if (!contacts) return <div style={{ color: "var(--label-muted)", fontSize: "var(--fs-sm)", padding: "var(--s-2) var(--s-6)" }}>Facturen laden&hellip;</div>;
  if (contacts.length === 0) return <div style={{ color: "var(--text-secondary)", fontSize: "var(--fs-sm)", padding: "var(--s-2) var(--s-6)" }}>Geen facturen op deze post gevonden (mogelijk rechtstreeks geboekt).</div>;

  return (
    <div style={{ padding: "var(--s-1) 0 var(--s-2) var(--s-6)" }}>
      {contacts.map((c) => {
        const key = c.contactId || c.contactName;
        return (
          <div key={key}>
            <button type="button" style={{ ...rowBtn, fontSize: "var(--fs-sm)" }} onClick={() => setOpen((o) => ({ ...o, [key]: !o[key] }))}>
              <span style={caret}>{open[key] ? "▾" : "▸"}</span>
              <span>{c.contactName}</span>
              <span style={{ ...amountRight, color: "var(--text-secondary)" }}>{euro(c.total)}</span>
            </button>
            {open[key] && (
              <div style={{ padding: "var(--s-1) 0 var(--s-2) var(--s-6)" }}>
                {c.invoices.map((inv) => (
                  <div key={inv.id} style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", padding: "var(--s-2) var(--s-1)", fontSize: "var(--fs-sm)", borderBottom: "1px dashed var(--kleur-rand-zacht)" }}>
                    <a href={inv.url} target="_blank" rel="noreferrer" style={{ color: "var(--link)", textDecoration: "underline", textUnderlineOffset: 2 }}>
                      {inv.label}
                    </a>
                    <span style={{ color: "var(--label-muted)" }}>{fmtDate(inv.date)}</span>
                    <span style={{ color: "var(--label-muted)" }}>{STATE_LABEL[inv.state] || inv.state}</span>
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
      <div style={{ display: "flex", alignItems: "baseline", gap: "var(--s-3)", marginBottom: "var(--s-2)" }}>
        <div style={{ fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--label-muted)" }}>Vraag het de cijfers</div>
        <span style={{ color: "var(--text-secondary)", fontSize: "var(--fs-sm)" }}>besparingen, winstpotentieel, prognose einde jaar</span>
        {messages.length > 0 && <button type="button" className="ghost-btn small" style={{ marginLeft: "auto" }} onClick={wis}>Gesprek wissen</button>}
      </div>
      {messages.length > 0 && (
        <div style={{ maxHeight: 420, overflowY: "auto", padding: "var(--s-1) var(--s-1)", marginBottom: "var(--s-3)" }}>
          {messages.map((m, i) => (
            m.role === "user"
              ? <div key={i} style={{ background: "var(--orange-light)", border: "1px solid var(--grad-perzik)", borderRadius: "var(--r-md)", padding: "var(--s-2) var(--s-3)", margin: "var(--s-2) 0 var(--s-2) 15%", fontSize: "var(--fs-base)" }}>{m.content}</div>
              : <div key={i} className="md" style={{ border: "1px solid var(--kleur-rand-zacht)", borderRadius: "var(--r-md)", padding: "var(--s-3) var(--s-4)", margin: "var(--s-2) 15% var(--s-2) 0", fontSize: "var(--fs-base)" }} dangerouslySetInnerHTML={{ __html: mdToHtml(m.content) }} />
          ))}
          {busy && <div style={{ color: "var(--label-muted)", fontSize: "var(--fs-sm)", padding: "var(--s-2) var(--s-1)" }}>Aan het rekenen…</div>}
          <div ref={endRef} />
        </div>
      )}
      {error && <div className="login-error" style={{ marginBottom: "var(--s-3)" }}>{error}</div>}
      <div style={{ display: "flex", gap: "var(--s-2)" }}>
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
      <button type="button" style={{ ...rowBtn, borderBottom: "none", padding: "0 0 var(--s-1)" }} onClick={() => setOpenSection((v) => !v)}>
        <span style={caret}>{openSection ? "▾" : "▸"}</span>
        <span style={{ fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--label-muted)" }}>Terugkerende kosten / abonnementen</span>
      </button>
      <div style={{ color: "var(--text-secondary)", fontSize: "var(--fs-sm)", margin: "0 0 var(--s-2) var(--s-5)" }}>
        Leveranciers waar in minstens 3 opeenvolgende maanden (van de laatste 6) kosten aan zijn geboekt.
        Handig om dubbele of vergeten abonnementen op te sporen.
      </div>
      {openSection && (
        <div style={{ paddingLeft: "var(--s-5)" }}>
          {error && <div style={{ color: "var(--bad-deep)", fontSize: "var(--fs-sm)", padding: "var(--s-2) 0" }}>{error}</div>}
          {!error && rows === null && <div style={{ color: "var(--label-muted)", fontSize: "var(--fs-sm)", padding: "var(--s-2) 0" }}>Laden&hellip;</div>}
          {rows !== null && rows.length === 0 && <div style={{ color: "var(--text-secondary)", fontSize: "var(--fs-sm)", padding: "var(--s-2) 0" }}>Geen terugkerende leveranciers gevonden in de laatste 6 maanden.</div>}
          {rows !== null && rows.map((r) => (
            <div key={r.contactName}>
              <button type="button" style={{ ...rowBtn, fontSize: "var(--fs-sm)" }} onClick={() => setOpenRow((o) => ({ ...o, [r.contactName]: !o[r.contactName] }))}>
                <span style={caret}>{openRow[r.contactName] ? "▾" : "▸"}</span>
                <span>{r.contactName}</span>
                <span style={{ color: "var(--label-muted)", marginLeft: "var(--s-2)" }}>{r.monthsPresent} van 6 maanden</span>
                <span style={{ ...amountRight, color: "var(--bad)" }}>{euro(r.avgPerMonth)}/mnd &nbsp;(&plusmn; {euro(r.perYear)}/jaar)</span>
              </button>
              {openRow[r.contactName] && (
                <div style={{ padding: "var(--s-1) 0 var(--s-2) var(--s-6)", fontSize: "var(--fs-sm)" }}>
                  {r.history.map((h) => (
                    <div key={h.month} style={{ display: "flex", gap: "var(--s-3)", padding: "var(--s-1) var(--s-1)", borderBottom: "1px dashed var(--kleur-rand-zacht)" }}>
                      <span style={{ color: "var(--label-muted)" }}>{MONTH_NAMES[Number(h.month.slice(4, 6)) - 1]} {h.month.slice(0, 4)}</span>
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
