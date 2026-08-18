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
import AdresVeld from "./AdresVeld";
import { openMailProgramma } from "../../../../lib/mailto-openen";

function stripHtml(html: string): string {
  return (html || "").replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

export default function MailPopup({
  open, onClose, titel, aanTo, onderwerp, berichtHtml, extra, onVerstuurd,
}: {
  open: boolean;
  onClose: () => void;
  titel: string;
  aanTo: string;
  onderwerp: string;
  berichtHtml: string;
  // Er is met opzet GEEN "onthoud dit adres"-mogelijkheid meer. Die stond hier
  // als onthoudAls en schreef het laatst gebruikte adres in het browsergeheugen,
  // gedeeld over alle klanten heen; daardoor stond bij de ene klant het adres
  // van de developer van een andere klant al ingevuld. Zie de ADRESVELD-REGEL
  // in MailUitKaart.tsx. Zet hem nooit terug; het veld hoort leeg te beginnen en
  // AdresVeld vult aan uit de eigen contacten.
  /** Extra inhoud boven het bericht: bijvoorbeeld een link met kopieerknop, of een JSON-voorbeeld. */
  extra?: React.ReactNode;
  onVerstuurd?: () => void;
}) {
  const [to, setTo] = useState(aanTo);
  const [connected, setConnected] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLDivElement | null>(null);
  // Een screenshot erbij: slepen of plakken (net als bij de assistent-chat),
  // in de browser verkleind naar max 1400px (JPEG) en pas bij versturen als
  // <img> onderaan het bericht gezet. Los houden van de tekst voorkomt
  // gerommel met de cursorpositie in het bewerkbare vak.
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTo(aanTo); setMsg(""); setPendingImages([]);
    fetch("/api/admin/mail?status=1").then((r) => r.json()).then((d) => setConnected(d.ok ? !!d.connected : false)).catch(() => setConnected(false));
    if (ref.current) ref.current.innerHTML = berichtHtml || "";
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function acceptImageFile(file: File | null | undefined) {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1400;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
        const data = canvas.toDataURL("image/jpeg", 0.85);
        setPendingImages((prev) => (prev.length >= 6 ? prev : [...prev, data]));
      };
      img.src = String(reader.result || "");
    };
    reader.readAsDataURL(file);
  }
  function onPasteImage(e: React.ClipboardEvent) {
    const item = Array.from(e.clipboardData?.items || []).find((i) => i.type.startsWith("image/"));
    if (item) { e.preventDefault(); acceptImageFile(item.getAsFile()); }
  }
  function onDropImage(e: React.DragEvent) {
    if (!e.dataTransfer?.files?.length) return;
    e.preventDefault(); setDragOver(false);
    for (const f of Array.from(e.dataTransfer.files)) acceptImageFile(f);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  function tekst(): string {
    const basis = ref.current?.innerHTML || berichtHtml;
    if (!pendingImages.length) return basis;
    const imgs = pendingImages.map((im) => `<img src="${im}" alt="Bijgevoegde afbeelding" style="max-width:100%;margin-top:8px;display:block;border-radius:8px;">`).join("");
    return `${basis}${imgs}`;
  }

  async function versturen() {
    if (!to.trim()) { setMsg("Vul een ontvanger in."); return; }
    setBusy(true); setMsg("");
    try {
      const res = await fetch("/api/admin/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "compose", to, subject: onderwerp, html: tekst() }) });
      const d = await res.json();
      if (d.ok) {
        setMsg(`Verstuurd naar ${(d.sentTo || []).join(", ") || to}.`);
        onVerstuurd?.();
        setTimeout(onClose, 1400);
      } else setMsg(d.error || "Versturen mislukt.");
    } catch { setMsg("Versturen mislukt."); } finally { setBusy(false); }
  }

  function openMailto() {
    if (!openMailProgramma({ aan: to, onderwerp, tekst: stripHtml(tekst()) })) { setMsg("Vul een ontvanger in."); return; }
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
          {/* Zelfde adresveld als in de andere mailvensters: typ "ma" en Maarten wordt voorgesteld. */}
          <AdresVeld waarde={to} onChange={setTo} className="compose-input" placeholder="naam@bedrijf.nl" />
          {extra && <div style={{ marginTop: "var(--s-3)" }}>{extra}</div>}
          <label className="compose-label">Bericht <span className="muted">(een screenshot erin plakken of slepen mag)</span></label>
          <div className="compose-rich">
            <div
              ref={ref}
              className={"klant-pop-editor focus-rich" + (dragOver ? " chat-dropping" : "")}
              contentEditable
              suppressContentEditableWarning
              onBlur={() => { /* opmaak blijft staan, we lezen pas bij versturen */ }}
              onPaste={onPasteImage}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDropImage}
            />
          </div>
          {pendingImages.length > 0 && (
            <div className="chat-img-preview">
              <span className="chat-img-row">
                {pendingImages.map((im, j) => (
                  <span key={j} className="chat-img-thumb">
                    <img src={im} alt={`Afbeelding ${j + 1} klaar om mee te sturen`} />
                    <button type="button" className="chat-img-thumb-del" title="Deze afbeelding weghalen" onClick={() => setPendingImages((prev) => prev.filter((_, k) => k !== j))}>&times;</button>
                  </span>
                ))}
              </span>
              <span>{pendingImages.length === 1 ? "Gaat onderaan de mail mee." : `${pendingImages.length} afbeeldingen gaan onderaan de mail mee.`} (max 6)</span>
            </div>
          )}
          {connected === false && (
            <div className="muted" style={{ marginTop: "var(--s-2)", fontSize: "var(--fs-sm)" }}>
              In deze omgeving is geen mailkoppeling; de knop opent je eigen mailprogramma met alles voorgevuld.
            </div>
          )}
          {msg && <div className={msg.startsWith("Verstuurd") || msg.startsWith("Geopend") || msg.startsWith("Mailtekst") ? "saved-msg" : "login-error"} style={{ marginTop: "var(--s-2)" }}>{msg}</div>}
        </div>
        <div className="compose-foot">
          <button type="button" className="btn btn-klein" onClick={onClose}>Annuleren</button>
          {connected === false ? (
            <>
              <button type="button" className="btn btn-klein" onClick={() => void copyTekst()}>Kopieer mailtekst</button>
              <button type="button" className="btn btn-primary btn-klein" onClick={openMailto}>Open in mailprogramma</button>
            </>
          ) : (
            <button type="button" className="btn btn-primary btn-klein" onClick={() => void versturen()} disabled={busy}>{busy ? "Versturen…" : "Verstuur per mail"}</button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
