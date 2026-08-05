"use client";

import React, { useEffect, useRef, useState } from "react";
import RijkTekstVeld from "./RijkTekstVeld";

/**
 * Eén vrij opmaakbaar tekstveld per klant, met knoppenbalk en automatisch opslaan.
 *
 * Twee soorten, allebei van dezelfde makelij: "focus" is het blok Zoekwoorden &
 * links, "prio" is Top Prio's. Bewust hetzelfde component, zodat er geen tweede
 * half-werkende editor naast komt te staan met een eigen plakgedrag en een eigen
 * opmaak. Ze delen één rij in de database, elk met een eigen sleutel.
 */
export default function FocusBlock({ slug, standalone, soort = "focus", titel }: {
  slug: string;
  standalone?: boolean;
  soort?: "focus" | "prio";
  titel?: string;
}) {
  const veld = soort === "prio" ? "prioHtml" : "html";
  const [initialHtml, setInitialHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  // Standaard dicht; openklappen via de kop.
  const [open, setOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laatsteHtmlRef = useRef("");

  // Laad de opgeslagen inhoud.
  useEffect(() => {
    let off = false;
    fetch(`/api/admin/focus?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (!off) setInitialHtml(d.ok ? (d.focus?.[veld] || "") : ""); })
      .catch(() => { if (!off) setInitialHtml(""); });
    return () => { off = true; };
  }, [slug, veld]);

  function triggerSave(html: string) {
    laatsteHtmlRef.current = html;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSaving("idle");
    saveTimerRef.current = setTimeout(async () => {
      const content = laatsteHtmlRef.current;
      setSaving("saving");
      try {
        const res = await fetch("/api/admin/focus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, [veld]: content }),
        });
        const d = await res.json();
        if (d.ok) { setSaving("saved"); setTimeout(() => setSaving("idle"), 2500); }
        else setSaving("idle");
      } catch { setSaving("idle"); }
    }, 1000);
  }

  const saveLabel = saving === "saving" ? "Opslaan..." : saving === "saved" ? "✓ Opgeslagen" : "";

  // Het veld zelf (knoppenbalk + bewerkbaar vlak) is gedeeld met de
  // bespreekpunten; hier blijft alleen het laden en opslaan over.
  const veldBlok = initialHtml === null
    ? <div className="focus-rich focus-loading" />
    : <RijkTekstVeld
        waarde={initialHtml}
        onChange={triggerSave}
        toolbarExtra={saveLabel ? <span className="focus-save-status">{saveLabel}</span> : null}
      />;

  if (standalone) {
    // Zelfde huisstijl als de andere inklapbare kaarten (Actuele stand van
    // zaken, Laatste mails): strategy-head met caret + titel.
    return (
      <>
        <button type="button" className="strategy-head" onClick={() => setOpen((v) => !v)}>
          <span className="strategy-caret">{open ? "▾" : "▸"}</span>
          <span className="strategy-title">{titel || "Zoekwoorden & links"}</span>
        </button>
        {open && (
          <div className="strategy-body">
            {veldBlok}
          </div>
        )}
      </>
    );
  }

  // In de rechterkolom van de stand van zaken: gewoon altijd open (zoals in de
  // Pingwin-wereld); de toggle is alleen voor het losse blok (standalone).
  return (
    <div className="sov-tasks">
      <div className="sov-tasks-head focus-head">
        <span>{titel || "Zoekwoorden & links"}</span>
        {soort === "focus" && <a className="focus-nav-link" href={`/admin/client/${slug}/navigatie`} target="_blank" rel="noreferrer" title="De hele sitestructuur (huidig én beoogd) met voortgang per pagina">Navigatie-roadmap &rarr;</a>}
      </div>
      {veldBlok}
    </div>
  );
}
