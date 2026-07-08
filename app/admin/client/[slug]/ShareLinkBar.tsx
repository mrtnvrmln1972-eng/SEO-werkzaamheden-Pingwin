"use client";

import React, { useEffect, useState } from "react";

// Balkje met de loginvrije deel-link van deze klant: makkelijk kopiëren en
// (bij een lek) vernieuwen. De link zelf wordt automatisch aangemaakt.
export default function ShareLinkBar({ slug }: { slug: string }) {
  const [url, setUrl] = useState<string>("");
  const [msg, setMsg] = useState<string>("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    fetch(`/api/admin/share-link?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (!off && d.ok) setUrl(d.url); })
      .catch(() => {});
    return () => { off = true; };
  }, [slug]);

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMsg("✓ gekopieerd");
      setTimeout(() => setMsg(""), 2000);
    } catch { setMsg("Kopiëren mislukt, selecteer de link zelf."); }
  }

  async function renew() {
    if (!window.confirm("Nieuwe link maken? De oude link stopt dan meteen met werken; stuur de nieuwe daarna naar de klant.")) return;
    setBusy(true); setMsg("");
    try {
      const r = await fetch("/api/admin/share-link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) });
      const d = await r.json();
      if (d.ok) { setUrl(d.url); setMsg("✓ nieuwe link gemaakt"); setTimeout(() => setMsg(""), 2500); }
      else setMsg(d.error || "Vernieuwen mislukt.");
    } catch { setMsg("Vernieuwen mislukt."); } finally { setBusy(false); }
  }

  return (
    <div className="share-link-bar">
      <span className="share-link-label">Loginvrije link voor de klant:</span>
      <input className="share-link-input" value={url || "Laden..."} readOnly onFocus={(e) => e.target.select()} />
      <button type="button" className="primary-btn small" onClick={copy} disabled={!url}>Kopieer</button>
      <button type="button" className="ghost-btn small" onClick={renew} disabled={busy || !url}>{busy ? "Bezig..." : "Nieuwe link"}</button>
      {msg && <span className="focus-save-status">{msg}</span>}
    </div>
  );
}
