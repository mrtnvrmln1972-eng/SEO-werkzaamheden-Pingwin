"use client";

import React, { useEffect, useRef, useState } from "react";
import RijkTekstVeld from "../../../_velden/RijkTekstVeld";

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
  const [, setSaving] = useState<"idle" | "saving" | "saved">("idle");
  // Standaard dicht; openklappen via de kop.
  const [open, setOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laatsteHtmlRef = useRef("");

  // Laad de opgeslagen inhoud.
  useEffect(() => {
    let off = false;
    fetch(`/api/admin/focus?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        setInitialHtml(d.ok ? (d.focus?.[veld] || "") : "");
      })
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

  // Het veld zelf (knoppenbalk + bewerkbaar vlak) is gedeeld met de
  // bespreekpunten; hier blijft alleen het laden en opslaan over.
  //
  // Er zat een deksel op met "toon alles" eronder: het veld werd op 240 pixels
  // afgekapt omdat de stand van zes landingpagina's anders de hele tab wegduwde.
  // Dat deksel is weg (6 augustus 2026). Het hoeft niet meer, en het werkte
  // tegen: het blok zit in een zijpaneel dat je nu zelf breder en groter kunt
  // maken, en in de kaart heeft het al een eigen inklap via de kop. Twee dingen
  // die hetzelfde probleem oplossen betekent dat je altijd de verkeerde te pakken
  // hebt. Je ziet nu gewoon alles wat er staat.
  //
  // Het "Opslaan..."/"Opgeslagen"-label stond in de knoppenbalk; zodra het
  // verscheen of wegviel, brak de balk om naar een tweede regel en sprong al
  // het eronder een regel op en neer. Niet meer tonen: opslaan gebeurt gewoon
  // automatisch op de achtergrond, `saving` blijft alleen intern bijgehouden.
  const veldBlok = initialHtml === null
    ? <div className="focus-rich focus-loading" />
    : <RijkTekstVeld waarde={initialHtml} onChange={triggerSave} />;

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

  // Geen rechterkolom met snelle links meer en geen dubbele titel (die staat
  // al op de kop van de uitklapper eromheen): het veld gebruikt de volle
  // breedte van de uitklapper. Alleen bij "focus" blijven de twee navigatielinks
  // staan; "Top Prio's" heeft die niet.
  const inhoud = (
    <div className="sov-tasks">
      {soort === "focus" && (
        <div className="sov-tasks-head focus-head focus-head-links-only">
          <a className="focus-nav-link" href={`/admin/client/${slug}/navigatie`} target="_blank" rel="noreferrer" title="De hele sitestructuur (huidig én beoogd) met voortgang per pagina">Navigatie-roadmap &rarr;</a>
          <a className="focus-nav-link" href={`/admin/client/${slug}/sitemap`} target="_blank" rel="noreferrer" title="De sitemap vers opgehaald en naast de echte site gelegd: is hij bereikbaar, welke live pagina's missen erin, en welke regels kloppen niet meer">Sitemap-check &rarr;</a>
        </div>
      )}
      {veldBlok}
    </div>
  );

  return inhoud;
}
