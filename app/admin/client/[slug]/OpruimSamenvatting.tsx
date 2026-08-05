"use client";

// ═══════════════════════════════════════════════════════════
// SAMENGEVAT: WAT DEZE ANALYSE HEEFT OPGELEVERD
// ═══════════════════════════════════════════════════════════
// Eén component voor de cockpit én voor de deellink naar de klant. Stond eerst
// twee keer los, waardoor de klantversie de oude lap tekst bleef tonen terwijl
// de cockpit al een net verhaal had. Nu kan dat niet meer uit elkaar lopen.
//
// De tekst van de analyse zelf is telegramstijl met puntkomma's en genummerde
// patronen tussen haakjes. Die wordt hier uit elkaar gehaald in losse punten,
// zodat er een leesbare opsomming staat in plaats van een muur.
// ═══════════════════════════════════════════════════════════

import { mdToHtml } from "../../../../lib/markdown";
import { linkifyHtml } from "../../../../lib/linkify";

/**
 * De AI-samenvatting leesbaar maken. Twee patronen komen vast terug:
 * "(1) … ; (2) … ; (3) …" en gewone zinnen achter elkaar. Allebei worden ze
 * losse punten; wat al bullets heeft blijft ongemoeid.
 */
export function alsPunten(tekst: string): string {
  const t = (tekst || "").trim();
  if (!t || /^\s*[-*]\s/m.test(t)) return t;

  // Genummerde patronen: knip vóór elke "(2)", "(3)" enzovoort.
  if (/\(\s*\d\s*\)/.test(t)) {
    const kop = t.split(/\(\s*1\s*\)/)[0].trim().replace(/[:,]$/, "");
    const rest = t.slice(t.indexOf(kop) + kop.length);
    const stukken = rest.split(/\(\s*\d+\s*\)/).map((z) => z.trim().replace(/^[:;,]\s*/, "").replace(/[;,]$/, "")).filter((z) => z.length > 3);
    if (stukken.length > 1) return [kop ? `${kop}:` : "", ...stukken.map((z) => `- ${z.charAt(0).toUpperCase()}${z.slice(1)}`)].filter(Boolean).join("\n");
  }

  const zinnen = t.split(/(?<=[.!?])\s+(?=[A-Z/])/).map((z) => z.trim()).filter(Boolean);
  return zinnen.length < 2 ? t : zinnen.map((z) => `- ${z}`).join("\n");
}

export default function OpruimSamenvatting({
  domain, samenvatting, clusters, regels, oppakken, blijftStaan, interneLinks,
}: {
  domain: string; samenvatting?: string;
  clusters: number; regels: number; oppakken: number; blijftStaan: number; interneLinks: number;
}) {
  return (
    <div className="opr-kaart">
      <div className="opr-kop">Samengevat: wat deze analyse heeft opgeleverd</div>
      <div className="opr-kaart-tekst">
        <p>
          Onderzocht zijn <strong>{clusters} {clusters === 1 ? "zoekwoord" : "zoekwoorden"}</strong> waarop meerdere
          pagina&rsquo;s van deze website tegelijk in Google verschijnen, plus alle pagina&rsquo;s die op geen enkel
          eigen zoekwoord scoren. De basis daarvoor zijn de vertoningen en posities uit Search Console, het verloop
          daarvan door de tijd, en het zoekvolume per zoekwoord.
        </p>
        <p>Dat leidt tot drie soorten uitkomsten:</p>
        <ul className="opr-punten">
          <li>
            <strong>{regels} {regels === 1 ? "pagina wordt doorverwezen" : "pagina&rsquo;s worden doorverwezen"}.</strong>{" "}
            Die vechten met een sterkere pagina om dezelfde bezoeker. Door ze samen te voegen hoeft Google niet meer te
            kiezen en komt alle kracht op één plek terecht.
          </li>
          {oppakken > 0 && (
            <li>
              <strong>{oppakken} {oppakken === 1 ? "pagina wordt opnieuw opgebouwd" : "pagina&rsquo;s worden opnieuw opgebouwd"}.</strong>{" "}
              Die leveren nu niets op, maar zitten wél op een zoekterm waar echt op gezocht wordt. Weghalen zou een
              kans weggooien, dus krijgen ze een nieuwe invulling.
            </li>
          )}
          {blijftStaan > 0 && (
            <li>
              <strong>{blijftStaan} {blijftStaan === 1 ? "pagina blijft" : "pagina&rsquo;s blijven"} onaangeroerd.</strong>{" "}
              Die kwamen in de analyse voorbij, maar winnen op hun eigen onderwerp. Daar is dus geen reden om iets aan
              te veranderen.
            </li>
          )}
        </ul>
        <p>
          Het doel is steeds hetzelfde: <strong>per onderwerp één duidelijke pagina</strong>, die daardoor sterker staat
          dan twee halve.{" "}
          {interneLinks > 0
            ? "Na het doorvoeren worden de interne links bijgewerkt, zodat die ene pagina ook vanuit de website zelf de duidelijkste is."
            : ""}
        </p>
      </div>
      {samenvatting && (
        <details className="opr-details">
          <summary>De uitgebreide bevindingen per zoekwoord</summary>
          <div className="cannibal-summary md" dangerouslySetInnerHTML={{ __html: linkifyHtml(mdToHtml(alsPunten(samenvatting)), domain) }} />
        </details>
      )}
    </div>
  );
}
