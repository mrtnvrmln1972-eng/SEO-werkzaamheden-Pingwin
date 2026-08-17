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
import { netteHtml } from "../../../../lib/nette-html";

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
  onderwerpen = 0, gaten = 0, euroPerMaand = 0,
}: {
  domain: string; samenvatting?: string;
  clusters: number; regels: number; oppakken: number; blijftStaan: number; interneLinks: number;
  /** De lijsten die er later bij kwamen. Standaard 0, zodat een oudere aanroep
      gewoon blijft werken en er niets stuk kan gaan aan de klantkant. */
  onderwerpen?: number; gaten?: number; euroPerMaand?: number;
}) {
  const bedrag = (n: number) => `\u20ac ${Math.round(n).toLocaleString("nl-NL")}`;
  return (
    <div className="opr-kaart">
      <div className="opr-kop">Samengevat: wat deze analyse heeft opgeleverd</div>
      <div className="opr-kaart-tekst">
        <p>
          Onderzocht zijn <strong>{clusters} {clusters === 1 ? "zoekwoord" : "zoekwoorden"}</strong> waarop meerdere
          pagina&rsquo;s van deze website tegelijk in Google verschijnen, plus alle pagina&rsquo;s die op geen enkel
          eigen zoekwoord scoren, plus de zoekopdrachten waar deze website nog helemaal geen pagina voor heeft. De basis
          daarvoor zijn de vertoningen en posities uit Search Console, het verloop daarvan door de tijd, het zoekvolume
          en de moeilijkheid per zoekwoord, en wat iemand met zo&rsquo;n zoekopdracht bedoelt.
        </p>
        <p>Dat leidt tot deze uitkomsten:</p>
        <ul className="opr-punten">
          {onderwerpen > 0 && (
            <li>
              <strong>{onderwerpen} {onderwerpen === 1 ? "onderwerp wordt gebundeld" : "onderwerpen worden gebundeld"}.</strong>{" "}
              Daar liggen drie of meer pagina&rsquo;s op hetzelfde onderwerp zonder dat er één van in de top 10 staat.
              Eén pagina wordt de vaste plek, de rest gaat daarin op.
            </li>
          )}
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
          {gaten > 0 && (
            <li>
              <strong>{gaten} {gaten === 1 ? "zoekopdracht heeft" : "zoekopdrachten hebben"} nog geen pagina.</strong>{" "}
              Daar wordt maandelijks op gezocht in onderwerpen waar deze website al meedoet, terwijl er niets voor
              bestaat. Dat is het enige deel dat over groeien gaat in plaats van over opruimen.
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
          Wat er <strong>niet</strong> gebeurt is net zo belangrijk. Pagina&rsquo;s die over dezelfde woorden gaan maar
          over een andere vraag blijven bewust apart staan; die samenvoegen zou bezoekers kosten. En zoektermen die te
          zwaar zijn voor wat deze website nu aankan, staan wel in de lijst maar onderaan, met de reden erbij.
        </p>
        {euroPerMaand > 0 && (
          <p>
            Bij elkaar gaat het naar schatting om <strong>{bedrag(euroPerMaand)} per maand</strong> aan omzet die nu
            blijft liggen. Dat is een berekening op basis van zoekvolume en gemiddelde klikcijfers, geen belofte; de
            waarde ervan zit vooral in de <strong>volgorde</strong>, dus welk werk het eerst aan de beurt is.
          </p>
        )}
        <p>
          Het doel is steeds hetzelfde: <strong>per onderwerp één duidelijke pagina</strong>, die daardoor sterker staat
          dan twee halve.{" "}
          {interneLinks > 0
            ? "Na het doorvoeren worden de interne links bijgewerkt, zodat die ene pagina ook vanuit de website zelf de duidelijkste is."
            : ""}{" "}
          Van elke doorgevoerde doorverwijzing wordt na 30 en 90 dagen nagemeten of de overgebleven pagina er
          daadwerkelijk sterker van is geworden.
        </p>
      </div>
      {samenvatting && (
        <details className="opr-details">
          <summary>De uitgebreide bevindingen per zoekwoord</summary>
          <div className="cannibal-summary md" dangerouslySetInnerHTML={{ __html: netteHtml(alsPunten(samenvatting), { basis: domain }) }} />
        </details>
      )}
    </div>
  );
}
