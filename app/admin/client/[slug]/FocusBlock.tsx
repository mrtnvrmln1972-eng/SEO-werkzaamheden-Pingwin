"use client";

import React, { useEffect, useRef, useState } from "react";
import RijkTekstVeld from "../../../_velden/RijkTekstVeld";
import type { FocusLink } from "../../../../lib/focus";

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

  // De rechterkolom met snelle links (alleen bij "focus"): een eigen lijstje in
  // dezelfde database-rij, apart van het vrije tekstveld ernaast.
  const [links, setLinks] = useState<FocusLink[]>([]);
  // Welke link je aan het bewerken bent (twee invulvelden); alle andere links
  // staan als schone, klikbare regel, net als in het tekstveld links.
  const [bewerkIdx, setBewerkIdx] = useState<number | null>(null);
  const linksSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Laad de opgeslagen inhoud.
  useEffect(() => {
    let off = false;
    fetch(`/api/admin/focus?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        setInitialHtml(d.ok ? (d.focus?.[veld] || "") : "");
        if (soort === "focus") setLinks(d.ok && Array.isArray(d.focus?.links) ? d.focus.links : []);
      })
      .catch(() => { if (!off) setInitialHtml(""); });
    return () => { off = true; };
  }, [slug, veld, soort]);

  function bewaarLinks(volgende: FocusLink[]) {
    setLinks(volgende);
    if (linksSaveTimer.current) clearTimeout(linksSaveTimer.current);
    linksSaveTimer.current = setTimeout(() => {
      void fetch("/api/admin/focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, links: volgende }),
      });
    }, 700);
  }
  function linkWijzig(i: number, patch: Partial<FocusLink>) {
    bewaarLinks(links.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function linkVerwijder(i: number) {
    bewaarLinks(links.filter((_, idx) => idx !== i));
    setBewerkIdx(null);
  }
  function linkHandmatigToevoegen() {
    setBewerkIdx(links.length);
    bewaarLinks([...links, { label: "", url: "" }]);
  }

  // Een link die je uit het tekstveld links (of van een andere pagina)
  // hierheen sleept of plakt, wordt automatisch een schone link: geen
  // handmatig knippen en plakken van een lange, soms gecodeerde URL nodig.
  // text/html eerst (heeft de naam van de link), anders de kale URL met de
  // domeinnaam als naam.
  function linkUitTransfer(dt: DataTransfer | null): FocusLink | null {
    if (!dt) return null;
    const html = dt.getData("text/html");
    if (html) {
      const m = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/i.exec(html);
      if (m) {
        const url = m[1].trim();
        const label = m[2].replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
        if (url) return { label: label.slice(0, 120), url: url.slice(0, 500) };
      }
    }
    const raw = (dt.getData("text/uri-list") || dt.getData("text/plain") || "")
      .split("\n").map((s) => s.trim()).find((s) => s && !s.startsWith("#"));
    if (raw && /^https?:\/\//i.test(raw)) {
      let label = raw;
      try { const u = new URL(raw); label = u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : ""); } catch { /* url zelf blijft dan het label */ }
      return { label: label.slice(0, 120), url: raw.slice(0, 500) };
    }
    return null;
  }
  const [slepenBoven, setSlepenBoven] = useState(false);
  function linkDrop(e: React.DragEvent) {
    e.preventDefault();
    setSlepenBoven(false);
    const l = linkUitTransfer(e.dataTransfer);
    if (l) bewaarLinks([...links, l]);
  }
  function linkPlak(e: React.ClipboardEvent) {
    const l = linkUitTransfer(e.clipboardData);
    if (l) { e.preventDefault(); bewaarLinks([...links, l]); }
  }
  function hrefVan(url: string): string {
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }
  function korteUrl(url: string): string {
    try { const u = new URL(hrefVan(url)); return u.hostname.replace(/^www\./, "") + (u.pathname !== "/" ? u.pathname : ""); }
    catch { return url; }
  }

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

  const linkenBlok = (
    <div className="focus-linkcol">
      <div className="focus-linkcol-kop">Snelle links</div>
      {links.length === 0 && <div className="muted focus-linkcol-leeg">Nog geen links; sleep of plak er een vanuit het veld hiernaast.</div>}
      {links.map((l, i) => (
        <div className="focus-linkrij" key={i}>
          {bewerkIdx === i ? (
            <>
              <input
                className="wp-docdrop-input focus-linkveld"
                placeholder="naam"
                value={l.label}
                autoFocus
                onChange={(e) => linkWijzig(i, { label: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") setBewerkIdx(null); }}
              />
              <input
                className="wp-docdrop-input focus-linkveld"
                placeholder="https://..."
                value={l.url}
                onChange={(e) => linkWijzig(i, { url: e.target.value })}
                onKeyDown={(e) => { if (e.key === "Enter") setBewerkIdx(null); }}
              />
              <button type="button" className="wp-icon" title="Klaar" onClick={() => setBewerkIdx(null)}>&#10003;</button>
            </>
          ) : (
            <>
              {l.url.trim()
                ? <a className="focus-linkclean" href={hrefVan(l.url)} target="_blank" rel="noreferrer" title={l.url}>{l.label.trim() || korteUrl(l.url)}</a>
                : <span className="muted focus-linkclean-leeg" onClick={() => setBewerkIdx(i)}>(nog geen link, klik om in te vullen)</span>}
              <button type="button" className="wp-icon" title="Naam of link aanpassen" onClick={() => setBewerkIdx(i)}>&#9998;</button>
            </>
          )}
          <button type="button" className="wp-icon wp-del" title="Link verwijderen" onClick={() => linkVerwijder(i)}>×</button>
        </div>
      ))}
      <div
        className={"focus-linkdrop" + (slepenBoven ? " focus-linkdrop-boven" : "")}
        tabIndex={0}
        onDragOver={(e) => { e.preventDefault(); setSlepenBoven(true); }}
        onDragLeave={() => setSlepenBoven(false)}
        onDrop={linkDrop}
        onPaste={linkPlak}
      >
        Sleep hier een link uit het veld hiernaast, of klik en plak (Cmd/Ctrl+V)
      </div>
      <button type="button" className="ghost-btn small" onClick={linkHandmatigToevoegen}>+ handmatig</button>
    </div>
  );

  // In de rechterkolom van de stand van zaken: gewoon altijd open (zoals in de
  // Pingwin-wereld); de toggle is alleen voor het losse blok (standalone).
  const inhoud = (
    <div className="sov-tasks">
      <div className="sov-tasks-head focus-head">
        <span>{titel || "Zoekwoorden & links"}</span>
        {soort === "focus" && <a className="focus-nav-link" href={`/admin/client/${slug}/navigatie`} target="_blank" rel="noreferrer" title="De hele sitestructuur (huidig én beoogd) met voortgang per pagina">Navigatie-roadmap &rarr;</a>}
      </div>
      {veldBlok}
    </div>
  );

  // Alleen het blok "Zoekwoorden & links" krijgt de rechterkolom met snelle
  // links; "Top Prio's" gebruikt hetzelfde component maar blijft één kolom.
  if (soort !== "focus") return inhoud;
  return (
    <div className="focus-2col">
      {inhoud}
      {linkenBlok}
    </div>
  );
}
