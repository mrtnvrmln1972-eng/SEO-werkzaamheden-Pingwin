"use client";

import { useEffect, useRef, useState } from "react";

// Bouwt een insluitbare preview-URL voor Google-documenten; anders null.
function googlePreview(url: string): string | null {
  let m = url.match(/docs\.google\.com\/(document|spreadsheets|presentation)\/d\/([A-Za-z0-9_-]+)/);
  if (m) return `https://docs.google.com/${m[1]}/d/${m[2]}/preview`;
  m = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/);
  if (m) return `https://drive.google.com/file/d/${m[1]}/preview`;
  return null;
}

function hostOf(url: string): string {
  try { return new URL(url).host; } catch { return url; }
}

// Toont een zwevende preview bij hover op een link in de werk-tabel of het
// focus-blok. Google-documenten als echte preview (jij bent ingelogd), andere
// links als net kaartje (websites blokkeren insluiten meestal).
export default function LinkPreview() {
  const [state, setState] = useState<{ url: string; x: number; y: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    function onOver(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      const a = el?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      if (!a.closest(".task-table") && !a.closest(".focus-rich") && !a.closest(".task-table-wrap")) return;
      const href = a.getAttribute("href") || "";
      if (!/^https?:/i.test(href)) return;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      const r = a.getBoundingClientRect();
      setState({ url: href, x: r.left, y: r.bottom });
    }
    function onOut() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setState(null), 250);
    }
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => { document.removeEventListener("mouseover", onOver); document.removeEventListener("mouseout", onOut); };
  }, []);

  if (!state) return null;
  const gp = googlePreview(state.url);
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  const left = Math.max(8, Math.min(state.x, w - 392));
  const top = Math.min(state.y + 6, h - (gp ? 320 : 130));

  return (
    <div
      className="link-preview"
      style={{ left, top }}
      onMouseEnter={() => { if (hideTimer.current) clearTimeout(hideTimer.current); }}
      onMouseLeave={() => setState(null)}
    >
      {gp ? (
        <iframe src={gp} title="Documentvoorbeeld" />
      ) : (
        <div className="link-preview-card">
          <div className="lp-host">{hostOf(state.url)}</div>
          <div className="lp-url">{state.url}</div>
          <a href={state.url} target="_blank" rel="noreferrer">Openen &#8599;</a>
        </div>
      )}
    </div>
  );
}
