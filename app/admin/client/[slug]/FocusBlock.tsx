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
  // Standaard dicht; openklappen via de kop.
  const [open, setOpen] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laatsteHtmlRef = useRef<string | null>(null);
  const bewaardRef = useRef<string | null>(null);

  // Laad de opgeslagen inhoud.
  useEffect(() => {
    let off = false;
    // Eerst leegmaken: dit veld wordt hergebruikt als je van klant of van soort
    // wisselt, en zonder deze regel zou de tekst van de vórige klant nog in het
    // veld gezet worden zodra de nieuwe binnen is.
    laatsteHtmlRef.current = null;
    bewaardRef.current = null;
    setInitialHtml(null);
    fetch(`/api/admin/focus?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        const html = d.ok ? (d.focus?.[veld] || "") : "";
        bewaardRef.current = html;
        setInitialHtml(html);
      })
      .catch(() => { if (!off) { bewaardRef.current = ""; setInitialHtml(""); } });
    return () => { off = true; };
  }, [slug, veld]);

  // ── Waarom het bewaren zo dichtgetimmerd is (16 augustus 2026) ──
  // Er stond alleen een wachtklok van een seconde, en die dekte één geval:
  // doortypen. Wisselde je binnen die seconde van tabblad in de cockpit, dan
  // verdween dit blok van het scherm vóórdat de klok afliep en was wat je net
  // typte weg. En omdat de inhoud die naar het veld ging alleen bij het láden
  // gezet werd, kwam bij terugkomst de oude tekst weer in beeld: typte je daarna
  // één letter, dan ging die oude tekst óók nog eens de opslag in en was het
  // nieuwe werk definitief kwijt.
  //
  // Nu bewaart hij op vier momenten, en het eerste dat aankomt wint: na een
  // korte stilte tijdens het typen, bij het dichtklappen, op het moment dat dit
  // blok verdwijnt, en als het tabblad naar de achtergrond gaat of sluit. De
  // laatste twee gaan met `keepalive` de deur uit, want een gewone fetch wordt
  // door de browser afgebroken zodra het onderdeel of de pagina verdwijnt, en
  // dat is precies het moment waarop het moet lukken. Zelfde aanpak als bij de
  // aantekeningen op een taakkaart (`KaartNotitie.tsx`).
  function bewaarDirect(afscheid = false) {
    const content = laatsteHtmlRef.current;
    if (content === null || content === bewaardRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    bewaardRef.current = content;
    void fetch("/api/admin/focus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, [veld]: content }),
      keepalive: afscheid,
    })
      // Mislukt het bewaren, dan moeten we dat weten: anders denkt de volgende
      // poging dat deze tekst al veilig staat en probeert hij het niet opnieuw.
      .then((r) => { if (!r.ok) bewaardRef.current = null; })
      .catch(() => { bewaardRef.current = null; });
  }

  function triggerSave(html: string) {
    laatsteHtmlRef.current = html;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => bewaarDirect(), 400);
  }

  useEffect(() => {
    const bijAchtergrond = () => { if (document.visibilityState === "hidden") bewaarDirect(true); };
    document.addEventListener("visibilitychange", bijAchtergrond);
    window.addEventListener("pagehide", bijAchtergrond);
    return () => {
      document.removeEventListener("visibilitychange", bijAchtergrond);
      window.removeEventListener("pagehide", bijAchtergrond);
      // Dit blok verdwijnt: je wisselt van tabblad in de cockpit of van klant.
      // Precies het geval waar het eerder misging.
      bewaarDirect(true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, veld]);

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
  // verscheen of wegviel, brak de balk om naar een tweede regel en sprong alles
  // eronder een regel op en neer. Er wordt daarom niets meer getoond: opslaan
  // gebeurt automatisch op de achtergrond, op de vier momenten hierboven.
  //
  // `laatsteHtmlRef` wint van de geladen tekst: klapt het veld tussendoor dicht
  // en weer open, dan wordt dit component opnieuw opgebouwd en moet het jouw
  // laatste versie tonen, niet die van het moment dat het scherm openging.
  const veldBlok = initialHtml === null
    ? <div className="focus-rich focus-loading" />
    : <RijkTekstVeld waarde={laatsteHtmlRef.current ?? initialHtml} onChange={triggerSave} />;

  if (standalone) {
    // Zelfde huisstijl als de andere inklapbare kaarten (Actuele stand van
    // zaken, Laatste mails): strategy-head met caret + titel.
    return (
      <>
        <button type="button" className="strategy-head" onClick={() => { if (open) bewaarDirect(); setOpen((v) => !v); }}>
          <span className="strategy-caret">{open ? "▾" : "▸"}</span>
          <span className="strategy-title">{titel || "Zoekwoorden & links"}</span>
        </button>
        {/* Verborgen in plaats van weggehaald: zo blijft wat je typte staan als je
            het blok even dichtklapt, en gaat er niets verloren tussen twee klikken. */}
        <div className="strategy-body" style={{ display: open ? undefined : "none" }}>
          {veldBlok}
        </div>
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
