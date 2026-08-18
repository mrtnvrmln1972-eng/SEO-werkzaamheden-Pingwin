"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import AdresVeld from "./AdresVeld";

// ═══════════════════════════════════════════════════════════
// SELECTIE-ACTIES: selecteer tekst in de cockpit → klein zwevend knopje met
// "Maak taak" (werkzaamheid met de tekst als toelichting) en "Mail" (compose-
// venster met de tekst voorgevuld). Selecties binnen invoervelden en
// bewerkbare teksten doen niets (daar ben je aan het typen, niet aan het
// verzamelen).
// ═══════════════════════════════════════════════════════════


function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function textToHtml(t: string): string {
  return t.split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
}

export default function SelectionActions({ slug, clientName }: { slug: string; clientName: string }) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [selText, setSelText] = useState("");
  const [toast, setToast] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Compose-venster (mail met de geselecteerde tekst voorgevuld).
  const [composeOpen, setComposeOpen] = useState(false);
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const bodyRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function onSelChange() {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const sel = window.getSelection();
        const text = (sel?.toString() || "").trim();
        if (!sel || sel.isCollapsed || text.length < 3) { setPos(null); return; }
        // Niet reageren op selecties binnen invoervelden of bewerkbare teksten.
        const node = sel.anchorNode;
        const el = node instanceof Element ? node : node?.parentElement;
        if (el?.closest("input, textarea, [contenteditable], .compose-modal, .selection-pop")) { setPos(null); return; }
        try {
          const rect = sel.getRangeAt(0).getBoundingClientRect();
          if (!rect || (rect.width === 0 && rect.height === 0)) { setPos(null); return; }
          setSelText(text);
          setPos({ x: Math.max(10, rect.left + rect.width / 2), y: Math.max(10, rect.top - 8) });
        } catch { setPos(null); }
      }, 250);
    }
    document.addEventListener("selectionchange", onSelChange);
    return () => {
      document.removeEventListener("selectionchange", onSelChange);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function flash(t: string) {
    setToast(t);
    setTimeout(() => setToast(""), 4000);
  }

  async function makeTask() {
    const tekst = selText;
    setPos(null);
    try {
      const r = await fetch("/api/admin/tasks/from-selection", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, tekst }) });
      const d = await r.json();
      if (d.ok) flash(`Taak aangemaakt in Werkzaamheden: "${d.title}"`);
      else flash(d.error || "Taak maken mislukt.");
    } catch { flash("Taak maken mislukt."); }
  }

  function openCompose() {
    setPos(null);
    setMsg("");
    setSubject(`Vanuit het dashboard: ${clientName}`);
    setComposeOpen(true);
    // Voorvullen zodra het venster gerenderd is.
    setTimeout(() => { if (bodyRef.current) bodyRef.current.innerHTML = textToHtml(selText); }, 0);
  }

  async function send() {
    const html = (bodyRef.current?.innerHTML || "").trim();
    if (!to.trim() || !html) { setMsg("Ontvanger en bericht zijn verplicht."); return; }
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "compose", to, subject, html }) });
      const d = await r.json();
      if (d.ok) { setComposeOpen(false); flash(`Mail verstuurd naar ${(d.sentTo || []).join(", ")}.`); }
      else setMsg(d.error || "Versturen mislukt.");
    } catch { setMsg("Versturen mislukt."); } finally { setBusy(false); }
  }

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      {pos && (
        <div className="selection-pop" style={{ left: pos.x, top: pos.y }} onMouseDown={(e) => e.preventDefault()}>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={makeTask} title="Maakt een werkzaamheid met deze tekst als toelichting">+ Taak</button>
          <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={openCompose} title="Opent een mailvenster met deze tekst voorgevuld">Mail</button>
        </div>
      )}
      {toast && <div className="selection-toast">{toast}</div>}
      {composeOpen && (
        <div className="compose-overlay">
          <div className="compose-modal">
            <div className="compose-head">
              <div className="compose-title">Geselecteerde tekst mailen</div>
              <button type="button" className="pch-msg-btn" aria-label="Sluiten" onClick={() => setComposeOpen(false)} style={{ fontSize: "var(--fs-lg)" }}>×</button>
            </div>
            <div className="compose-body" style={{ padding: "var(--s-4)", overflowY: "auto" }}>
              <div className="field" style={{ marginBottom: "var(--s-3)", position: "relative" }}>
                <label>Aan</label>
                {/* Zelfde adresveld als in de andere mailvensters: typ "ma" en Maarten wordt voorgesteld. */}
                <AdresVeld waarde={to} onChange={setTo} className="compose-input" placeholder="naam@bedrijf.nl" />
              </div>
              <div className="field" style={{ marginBottom: "var(--s-3)" }}>
                <label>Onderwerp</label>
                <input className="compose-input" value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div className="field">
                <label>Bericht (bewerkbaar)</label>
                <div ref={bodyRef} className="md selection-body" contentEditable suppressContentEditableWarning />
              </div>
              {msg && <div className="login-error" style={{ marginTop: "var(--s-3)" }}>{msg}</div>}
            </div>
            <div className="compose-foot" style={{ display: "flex", justifyContent: "flex-end", gap: "var(--s-2)", padding: "var(--s-3) var(--s-4)", borderTop: "1px solid var(--border)" }}>
              <button type="button" className="btn btn-ghost" onClick={() => setComposeOpen(false)}>Annuleren</button>
              <button type="button" className="btn btn-primary" onClick={send} disabled={busy}>{busy ? "Versturen…" : "Verstuur per mail"}</button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
