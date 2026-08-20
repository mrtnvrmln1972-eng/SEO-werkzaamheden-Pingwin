"use client";

import { useEffect, useRef, useState } from "react";
import { leesHintVertraging } from "../../../_ui/hint-vertraging";
import { PijlSchuin } from "../../../_ui/Pijl";

// Bouwt een insluitbare preview-URL voor Google-documenten; anders null.
// De maat van de voorvertoning, gelijk aan .link-preview in app/globals.css.
// Verander je er één, verander ze allebei; proeven/link-preview.proef.ts rekent na
// of ze nog gelijk staan, want anders valt het venster half buiten het scherm.
export const PREVIEW_BREED = 600;
export const PREVIEW_HOOG = 460;

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
//
// Net als het uitleg-bolletje wacht hij tot je even stil blijft hangen
// (--hint-vertraging, zie app/_ui/hint-vertraging.ts). Dat scheelt niet alleen
// geflikker: bij een Google-document werd er meteen een iframe geladen van elke
// link waar je toevallig langs bewoog.
export default function LinkPreview() {
  const [state, setState] = useState<{ url: string; x: number; y: number } | null>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const toonTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const doel = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const vertraging = leesHintVertraging();

    function onOver(e: MouseEvent) {
      const el = e.target as HTMLElement | null;
      const a = el?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!a) return;
      if (!a.closest(".task-table") && !a.closest(".focus-rich") && !a.closest(".task-table-wrap")) return;
      const href = a.getAttribute("href") || "";
      if (!/^https?:/i.test(href)) return;
      if (hideTimer.current) clearTimeout(hideTimer.current);
      if (doel.current === a) return; // al aan het wachten op, of open voor, deze link
      doel.current = a;
      if (toonTimer.current) clearTimeout(toonTimer.current);
      toonTimer.current = setTimeout(() => {
        if (doel.current !== a || !a.isConnected) return;
        const r = a.getBoundingClientRect();
        setState({ url: href, x: r.left, y: r.bottom });
      }, vertraging);
    }
    function onOut(e: MouseEvent) {
      const naar = e.relatedTarget as Node | null;
      if (doel.current && naar && doel.current.contains(naar)) return; // nog binnen dezelfde link
      doel.current = null;
      if (toonTimer.current) clearTimeout(toonTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => setState(null), 250);
    }
    document.addEventListener("mouseover", onOver);
    document.addEventListener("mouseout", onOut);
    return () => {
      if (toonTimer.current) clearTimeout(toonTimer.current);
      if (hideTimer.current) clearTimeout(hideTimer.current);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mouseout", onOut);
    };
  }, []);

  if (!state) return null;
  const gp = googlePreview(state.url);
  const w = typeof window !== "undefined" ? window.innerWidth : 1200;
  const h = typeof window !== "undefined" ? window.innerHeight : 800;
  // Hetzelfde formaat als in app/globals.css (.link-preview). Het venster moet
  // weten hoe groot hij is om hem binnen beeld te houden; staan deze twee niet
  // gelijk, dan valt de voorvertoning half buiten het scherm.
  const breed = Math.min(PREVIEW_BREED, w * 0.92);
  const hoog = gp ? Math.min(PREVIEW_HOOG, h * 0.7) + 20 : 130;
  const left = Math.max(8, Math.min(state.x, w - breed - 8));
  const top = Math.max(8, Math.min(state.y + 6, h - hoog));

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
          <a href={state.url} target="_blank" rel="noreferrer">Openen <PijlSchuin /></a>
        </div>
      )}
    </div>
  );
}
