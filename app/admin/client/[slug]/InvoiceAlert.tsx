"use client";

import { useEffect, useRef, useState } from "react";

// Waarschuwingsbalk in de klant-cockpit: verschijnt alleen als deze klant een
// factuur heeft die langer dan 30 dagen na verzending openstaat. De data komt
// uit de eigenaar-only Moneybird-route; gasten krijgen daar 403 en zien dus
// vanzelf niets (geen aparte isOwner-prop nodig).
//
// "Mail naar administratie" opent een mailvenster (zoals bij taken mailen):
// ontvanger vooraf ingevuld met het administratie-adres uit Beheer, een
// bewerkbaar bericht, en de factuurlijst eronder. Pas bij Verstuur gaat hij weg.

type Inv = { id: string; invoiceId: string; totalUnpaid: number; daysOpen: number; over30: boolean; url: string };

function euro(n: number): string {
  return "€ " + n.toLocaleString("nl-NL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function esc(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default function InvoiceAlert({ slug, clientName }: { slug: string; clientName?: string }) {
  const [overdue, setOverdue] = useState<Inv[]>([]);
  const [showCompose, setShowCompose] = useState(false);
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const noteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/moneybird/openstaand");
        if (!res.ok) return; // 401/403 (gast) of 502: geen balk tonen
        const data = await res.json();
        if (!data.ok || !data.configured) return;
        const mine = (data.byClient as { slug: string; invoices: Inv[] }[]).find((c) => c.slug === slug);
        if (alive && mine) setOverdue(mine.invoices.filter((i) => i.over30));
      } catch { /* stil: geen signaal is geen ramp, volgende paginalading opnieuw */ }
    })();
    return () => { alive = false; };
  }, [slug]);

  // Mailvenster openen: administratie-adres uit Beheer voorinvullen en een
  // beleefd standaardbericht klaarzetten (bewerkbaar, gerenderd veld).
  async function openCompose() {
    setMsg("");
    setShowCompose(true);
    if (!to) {
      try {
        const r = await fetch("/api/admin/settings");
        const d = await r.json();
        if (d.ok && d.settings?.invoice_mail_to) setTo(d.settings.invoice_mail_to);
      } catch { /* leeg laten; gebruiker vult zelf in */ }
    }
    setTimeout(() => {
      if (noteRef.current && !noteRef.current.innerHTML.trim()) {
        noteRef.current.innerHTML = "Hoi,<br><br>Willen jullie onderstaande openstaande facturen opvolgen? Via de Moneybird-link bij elke factuur kun je direct een herinnering versturen.<br><br>Groet,<br>Maarten";
      }
      noteRef.current?.focus();
    }, 50);
  }

  async function send() {
    if (!to.trim()) { setMsg("Vul een ontvanger in."); return; }
    const note = noteRef.current?.innerHTML || "";
    const list = overdue.map((i) =>
      `<li style="margin-bottom:6px;">Factuur ${esc(i.invoiceId)}: ${euro(i.totalUnpaid)}, ${i.daysOpen} dagen open &mdash; <a href="${esc(i.url)}">open in Moneybird</a></li>`
    ).join("");
    const html = `<div>${note}</div><p><strong>Openstaande facturen${clientName ? ` van ${esc(clientName)}` : ""}:</strong></p><ul>${list}</ul>`;
    const subject = `Openstaande facturen${clientName ? ` — ${clientName}` : ""} (${overdue.length}, samen ${euro(overdue.reduce((s, i) => s + i.totalUnpaid, 0))})`;
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "compose", to, subject, html }) });
      const data = await res.json();
      if (data.ok) {
        setMsg(`Verstuurd naar ${(data.sentTo || []).join(", ") || to}.`);
        setTimeout(() => setShowCompose(false), 1400);
      } else setMsg(data.error || "Versturen mislukt.");
    } catch { setMsg("Versturen mislukt."); } finally { setBusy(false); }
  }

  if (overdue.length === 0) return null;
  const total = overdue.reduce((s, i) => s + i.totalUnpaid, 0);

  return (
    <div className="invoice-alert" role="alert">
      <span className="invoice-alert-icon">!</span>
      <span>
        {overdue.length === 1
          ? <>Factuur <strong>{overdue[0].invoiceId}</strong> staat al <strong>{overdue[0].daysOpen} dagen</strong> open ({euro(total)}).</>
          : <><strong>{overdue.length} facturen</strong> staan langer dan 30 dagen open (samen {euro(total)}).</>}
      </span>
      <span className="invoice-alert-links">
        {overdue.map((i) => (
          <a key={i.id} href={i.url} target="_blank" rel="noreferrer" title={`${i.daysOpen} dagen open, ${euro(i.totalUnpaid)}`}>
            {i.invoiceId} in Moneybird
          </a>
        ))}
        <button
          type="button"
          className="mini-btn"
          onClick={openCompose}
          title="Opent een mailvenster met de factuurlinks, naar het administratie-adres (instelbaar bij Beheer)"
        >
          Mail naar administratie
        </button>
      </span>

      {showCompose && (
        <div className="compose-overlay">
          <div className="compose-modal" onClick={(e) => e.stopPropagation()}>
            <div className="compose-head"><span>Openstaande facturen naar de administratie</span><button type="button" className="chat-float-close" onClick={() => setShowCompose(false)}>&times;</button></div>
            <div className="compose-body">
              <label className="compose-label">Aan (administratie-adres)</label>
              <input className="compose-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="administratie@bedrijf.nl" autoComplete="off" />
              <label className="compose-label">Bericht (bewerkbaar)</label>
              <div className="compose-rich"><div ref={noteRef} className="mail-edit md" contentEditable suppressContentEditableWarning style={{ minHeight: 110 }} /></div>
              <label className="compose-label">Deze facturen gaan mee</label>
              <div className="compose-list">
                {overdue.map((i) => (
                  <div key={i.id} className="compose-item">
                    <span>Factuur {i.invoiceId} &mdash; {euro(i.totalUnpaid)}, {i.daysOpen} dagen open</span>
                  </div>
                ))}
              </div>
              {msg && <div className={msg.startsWith("Verstuurd") ? "saved-msg" : "login-error"} style={{ marginTop: 8 }}>{msg}</div>}
            </div>
            <div className="compose-foot">
              <button type="button" className="logout-btn" onClick={() => setShowCompose(false)}>Annuleren</button>
              <button type="button" className="primary-btn small" onClick={send} disabled={busy}>{busy ? "Versturen..." : "Verstuur per mail"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
