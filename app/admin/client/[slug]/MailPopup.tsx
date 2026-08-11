"use client";

// Eén herbruikbaar mailvenster (developer of klant), zodat "Deel JSON" en
// "Mail naar klant" niet allebei hun eigen mailto-code hoeven te hebben. Is er
// een mailkoppeling (Microsoft 365), dan verstuurt de knop meteen vanuit het
// dashboard; zonder koppeling valt hij terug op het eigen mailprogramma via een
// onzichtbare link (geen window.open: dat laat een leeg tabblad achter) of een
// "kopieer mailtekst"-knop. Zelfde opmaak als het mailvenster in Werkzaamheden
// (compose-overlay/compose-modal), zodat het overal hetzelfde dashboard blijft.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { openMailProgramma } from "../../../../lib/mailto-openen";

function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

export default function MailPopup({
  open, onClose, titel, aanTo, onderwerp, berichtHtml, onthoudAls, extra, onVerstuurd,
}: {
  open: boolean;
  onClose: () => void;
  titel: string;
  aanTo: string;
  onderwerp: string;
  berichtHtml: string;
  /** localStorage-sleutel om het "aan"-adres te onthouden na versturen (alleen voor de developer-mail). */
  onthoudAls?: string;
  /** Extra inhoud boven het bericht: bijvoorbeeld een link met kopieerknop, of een JSON-voorbeeld. */
  extra?: React.ReactNode;
  onVerstuurd?: () => void;
}) {
  const [to, setTo] = useState(aanTo);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setTo(aanTo); setMsg("");
    fetch("/api/admin/mail?status=1").then((r) => r.json()).then((d) => setConnected(d.ok ? !!d.connected : false)).catch(() => setConnected(false));
    if (ref.current) ref.current.innerHTML = berichtHtml || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  function tekst(): string { return ref.current?.innerHTML || berichtHtml; }

  async function versturen() {
    if (!to.trim()) { setMsg("Vul een ontvanger in."); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "compose", to, subject: onderwerp, html: tekst() }) });
      const d = await res.json();
      if (d.ok) {
        if (onthoudAls) { try { localStorage.setItem(onthoudAls, to.trim()); } catch { /* geen opslag */ } }
        setMsg(`Verstuurd naar ${(d.sentTo || []).join(", ") || to}.`);
        onVerstuurd?.();
        setTimeout(onClose, 1400);
      } else setMsg(d.error || "Versturen mislukt.");
    } catch { setMsg("Versturen mislukt."); } finally { setBusy(false); }
  }

  function openMailto() {
    if (!openMailProgramma({ aan: to, onderwerp, tekst: stripHtml(tekst()) })) { setMsg("Vul een ontvanger in."); return; }
    if (onthoudAls) { try { localStorage.setItem(onthoudAls, to.trim()); } catch { /* geen opslag */ } }
    setMsg("Geopend in je mailprogramma; verstuur hem daar. Gebeurt er niets? Gebruik dan ‘Kopieer mailtekst’.");
  }
  async function copyTekst() {
    try {
      await navigator.clipboard.writeText(`Aan: ${to.trim()}\nOnderwerp: ${onderwerp}\n\n${stripHtml(tekst())}`);
      setMsg("Mailtekst gekopieerd; plak hem in een nieuwe mail.");
    } catch { setMsg("Kopiëren mislukt; selecteer en kopieer de tekst zelf."); }
  }

  return createPortal(
    <div className="compose-overlay" onClick={onClose} role="dialog" aria-modal="true">
      <div className="compose-modal" onClick={(e) => e.stopPropagation()}>
        <div className="compose-head"><span>{titel}</span><button type="button" className="chat-float-close" onClick={onClose} aria-label="Sluiten">&times;</button></div>
        <div className="compose-body">
          <label className="compose-label">Aan</label>
          <input className="compose-input" value={to} onChange={(e) => setTo(e.target.value)} placeholder="naam@bedrijf.nl" autoComplete="off" />
          {extra && <div style={{ marginTop: "var(--s-3)" }}>{extra}</div>}
          <label className="compose-label">Bericht</label>
          <div className="compose-rich">
            <div ref={ref} className="klant-pop-editor focus-rich" contentEditable suppressContentEditableWarning onBlur={() => { /* opmaak blijft staan, we lezen pas bij versturen */ }} />
          </div>
          {connected === false && (
            <div className="muted" style={{ marginTop: "var(--s-2)", fontSize: "var(--fs-sm)" }}>
              In deze omgeving is geen mailkoppeling; de knop opent je eigen mailprogramma met alles voorgevuld.
            </div>
          )}
          {msg && <div className={msg.startsWith("Verstuurd") || msg.startsWith("Geopend") || msg.startsWith("Mailtekst") ? "saved-msg" : "login-error"} style={{ marginTop: "var(--s-2)" }}>{msg}</div>}
        </div>
        <div className="compose-foot">
          <button type="button" className="logout-btn" onClick={onClose}>Annuleren</button>
          {connected === false ? (
            <>
              <button type="button" className="ghost-btn small" onClick={() => void copyTekst()}>Kopieer mailtekst</button>
              <button type="button" className="primary-btn small" onClick={openMailto}>Open in mailprogramma</button>
            </>
          ) : (
            <button type="button" className="primary-btn small" onClick={() => void versturen()} disabled={busy}>{busy ? "Versturen…" : "Verstuur per mail"}</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
