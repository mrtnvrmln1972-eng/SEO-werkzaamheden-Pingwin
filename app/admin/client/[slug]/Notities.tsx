"use client";

// Notities per klant: losse kladblokjes met een titel, elk een dichtgeklapte
// toggle. Je plakt en typt er vrij in, met dezelfde opmaak als "Zoekwoorden &
// links". Wat hier staat telt mee als kennis over de klant: de tekst gaat als
// achtergrond mee in de chats en de pagina-analyses.

import { useEffect, useRef, useState } from "react";
import { linkifyHtml } from "../../../../lib/linkify";
import RijkTekstVeld from "./RijkTekstVeld";

type Notitie = { id: number; titel: string; inhoud: string; createdAt: string | null; updatedAt: string | null };

export default function Notities({ slug, domain }: { slug: string; domain?: string | null }) {
  const [notities, setNotities] = useState<Notitie[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [titelId, setTitelId] = useState<number | null>(null);
  const [titelTekst, setTitelTekst] = useState("");
  const [wegId, setWegId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const bewaarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const host = (domain || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");

  async function laad() {
    const d = await fetch(`/api/admin/notities?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) setNotities(d.notities || []);
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  async function post(body: Record<string, unknown>, herlaad = true) {
    setBusy(true);
    try {
      const d = await fetch("/api/admin/notities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...body }) }).then((r) => r.json());
      if (herlaad) await laad();
      return d;
    } catch { return null; }
    finally { setBusy(false); }
  }

  async function nieuw() {
    const vandaag = new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
    const d = await post({ action: "add", titel: `Notitie ${vandaag}`, inhoud: "" });
    if (d?.id) { setOpenId(d.id); setTitelId(d.id); setTitelTekst(`Notitie ${vandaag}`); }
  }

  // Bewaart tijdens het typen; geen opslaan-knop.
  function schrijf(id: number, html: string) {
    if (bewaarTimer.current) clearTimeout(bewaarTimer.current);
    bewaarTimer.current = setTimeout(() => {
      setNotities((lijst) => lijst.map((n) => (n.id === id ? { ...n, inhoud: html } : n)));
      void fetch("/api/admin/notities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "edit", id, inhoud: html }) });
    }, 900);
  }

  async function titelKlaar(id: number) {
    const t = titelTekst.trim();
    setTitelId(null);
    setNotities((lijst) => lijst.map((n) => (n.id === id ? { ...n, titel: t } : n)));
    await post({ action: "titel", id, titel: t }, false);
  }

  async function weg(id: number) {
    setWegId(null);
    if (openId === id) setOpenId(null);
    setNotities((lijst) => lijst.filter((n) => n.id !== id));
    await post({ action: "del", id }, false);
  }

  const dd = (d: string | null) => { try { return d ? new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : ""; } catch { return ""; } };

  return (
    <div className="cockpit-card strategy-card">
      <div className="bl-kop">
        <div className="bl-kop-tekst">
          <span className="strategy-title">Notities</span>
          <span className="bl-sub muted">Plak hier wat je wilt onthouden; de assistent neemt het mee als achtergrond over deze klant.</span>
        </div>
        <span className="wp-fase-spacer" />
        <button type="button" className="ghost-btn small" disabled={busy} onClick={() => void nieuw()}>+ notitie</button>
      </div>
      {notities.length === 0 && <div className="muted nt-leeg">Nog geen notities. Klik op &ldquo;+ notitie&rdquo; en plak erin wat je wilt bewaren.</div>}
      {notities.map((n) => {
        const isOpen = openId === n.id;
        return (
          <div key={n.id} className="bl-lijst">
            <div className="strategy-head bl-head nt-head">
              <button type="button" className="nt-vouw" onClick={() => setOpenId(isOpen ? null : n.id)}>
                <span className="strategy-caret">{isOpen ? "▾" : "▸"}</span>
              </button>
              {titelId === n.id ? (
                <input
                  className="wp-docdrop-input nt-titel-input"
                  value={titelTekst}
                  autoFocus
                  onChange={(e) => setTitelTekst(e.target.value)}
                  onBlur={() => void titelKlaar(n.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === "Escape") void titelKlaar(n.id); }}
                />
              ) : (
                <span className="bl-titel nt-titel" title="Klik om de titel aan te passen"
                  onClick={() => { setTitelId(n.id); setTitelTekst(n.titel); }}>
                  {n.titel || "Notitie"}
                </span>
              )}
              <span className="bl-gedeeld muted">{dd(n.updatedAt || n.createdAt)}</span>
              {wegId === n.id ? (
                <span className="nt-weg-vraag">
                  Weggooien?
                  <button type="button" className="wp-weg-ja" onClick={() => void weg(n.id)}>ja</button>
                  <button type="button" className="wp-weg-nee" onClick={() => setWegId(null)}>nee</button>
                </span>
              ) : (
                <button type="button" className="wp-icon wp-del" title="Notitie weggooien" onClick={() => setWegId(n.id)}>×</button>
              )}
            </div>
            {isOpen && (
              <div className="bl-body">
                <RijkTekstVeld
                  waarde={n.inhoud}
                  klasse="nt-veld"
                  placeholder="Typ of plak hier…"
                  onChange={(html) => schrijf(n.id, html)}
                />
              </div>
            )}
            {!isOpen && n.inhoud.trim() && (
              <div className="nt-voorproef md" onClick={() => setOpenId(n.id)}
                dangerouslySetInnerHTML={{ __html: linkifyHtml(n.inhoud, host) }} />
            )}
          </div>
        );
      })}
    </div>
  );
}
