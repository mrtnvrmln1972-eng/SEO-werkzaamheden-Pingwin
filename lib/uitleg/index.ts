// ═══════════════════════════════════════════════════════════
// HET VERHAAL VAN HET DASHBOARD (levend document)
// ═══════════════════════════════════════════════════════════
// Deze map IS de uitleg. Eén bron, drie doelgroepen: klanten die willen weten
// wat ze kopen, bureaus die het willen gebruiken, en investeerders die willen
// weten wat hier eigenlijk gebouwd is. De pagina eromheen (app/uitleg/page.tsx)
// doet niets anders dan dit renderen als hoofdstukken met uitklappers.
//
// WAAR SCHRIJF JE? Eén hoofdstuk is één bestand hiernaast, genummerd in de
// volgorde waarin ze op het scherm staan. Bouw je iets aan de opruim-motor,
// dan werk je `04-motoren/opruimen.ts` bij en verder niets. Twee hoofdstukken
// zijn zo groot dat ze een eigen map hebben met een bestand per onderwerp:
// `04-motoren/` (een bestand per motor) en `15-agenda/` (een bestand per golf).
//
// WAAROM OPGEKNIPT (11-08-2026): dit stond als 2.629 regels in één
// `lib/uitleg.ts`. Elke chat die iets opleverde moest daar dus in schrijven, en
// twee chats op één dag botsten altijd, in tekst die niets met elkaar te maken
// had. Nu raakt een chat alleen het bestand van zijn eigen onderwerp aan.
// Dezelfde vaste les als bij `lib/wat-is-nieuw.ts`: botsingen los je op met de
// vorm, niet met een afspraak. `proeven/uitleg.proef.ts` bewaakt het.
//
// Twee regels houden dit document eerlijk:
//
//  1. NIETS ERIN WAT NIET IN DE CODE STAAT. Geen roadmap-taal die klinkt als
//     werkelijkheid. Wat nog niet werkt hoort in het hoofdstuk "Eerlijke
//     agenda", niet weggelaten en niet mooier gemaakt.
//  2. HOOFDSTUKKEN MET `intern: true` ZIJN ALLEEN VOOR INGELOGDE OGEN. De
//     gaten en de zwakke plekken staan er dus wél in, maar een klant of een
//     lead die de link krijgt ziet ze niet. Zo kan dit één document blijven in
//     plaats van twee versies die uit elkaar gaan lopen.
//
// Bijwerken: na elke noemenswaardige uitbreiding van het dashboard hier de
// betreffende uitklapper aanvullen, en ÉÉN regel bovenaan `WAT_IS_NIEUW` in
// lib/wat-is-nieuw.ts zetten. Herschrijf daar nooit een bestaande regel; dat
// bestand groeit alleen, juist omdat er uit meerdere chats tegelijk in wordt
// geschreven.
// ═══════════════════════════════════════════════════════════

import { leesbareDatum, nieuwtjes } from "../wat-is-nieuw";
import type { Hoofdstuk } from "./types";

import { HOOFDSTUK as waarom } from "./01-waarom";
import { HOOFDSTUK as opzet } from "./02-opzet";
import { HOOFDSTUK as koppelingen } from "./03-koppelingen";
import { HOOFDSTUK as motoren } from "./04-motoren";
import { HOOFDSTUK as documenten } from "./05-documenten";
import { HOOFDSTUK as werk } from "./06-werk";
import { HOOFDSTUK as assistent } from "./07-assistent";
import { HOOFDSTUK as communicatie } from "./08-communicatie";
import { HOOFDSTUK as leads } from "./09-leads";
import { HOOFDSTUK as bedrijfsvoering } from "./10-bedrijfsvoering";
import { HOOFDSTUK as zelfstandig } from "./11-zelfstandig";
import { HOOFDSTUK as veiligheid } from "./12-veiligheid";
import { HOOFDSTUK as gebruik } from "./13-gebruik";
import { HOOFDSTUK as onderscheid } from "./14-onderscheid";
import { HOOFDSTUK as agenda } from "./15-agenda";
import { HOOFDSTUK as vervolg } from "./16-vervolg";

export type { Uitklapper, Hoofdstuk } from "./types";

// De datum komt uit lib/wat-is-nieuw.ts, waar elke oplevering ÉÉN regel bijzet.
// Hier stond die hele opsomming vroeger als één zin van vijfduizend tekens, die
// bij elke oplevering opnieuw werd geschreven; dat botste tussen chats en stond
// bovendien voluit in de kopbalk van /uitleg waar alleen een datum hoort.
export const LAATST_BIJGEWERKT = leesbareDatum(nieuwtjes()[0]?.datum || "") || "nog niets vastgelegd";

// Drie leesroutes bovenaan. Bewust vier hoofdstukken per route en niet alles wat
// enigszins past: een route die bijna de hele inhoudsopgave herhaalt filtert
// niets en helpt dus niemand. De volledige lijst staat eronder.
export const LEESROUTES: { label: string; regel: string; hoofdstukken: string[] }[] = [
  {
    label: "Ik ben klant",
    regel: "Wat er voor mijn site gebeurt, en wat ik ervan zie.",
    hoofdstukken: ["waarom", "koppelingen", "documenten", "werk"],
  },
  {
    label: "Ik ben bureau",
    regel: "Hoe ik dit voor mijn eigen klanten zou gebruiken.",
    hoofdstukken: ["gebruik", "motoren", "opzet", "veiligheid"],
  },
  {
    label: "Ik kijk zakelijk",
    regel: "Wat hier gebouwd is, en waarom dat moeilijk na te maken is.",
    hoofdstukken: ["onderscheid", "motoren", "opzet", "bedrijfsvoering"],
  },
];

// De volgorde hier is de volgorde op het scherm, en die is dezelfde als de
// nummers in de bestandsnamen. Een hoofdstuk verplaatsen doe je dus op één plek.
export const HOOFDSTUKKEN: Hoofdstuk[] = [
  waarom,
  opzet,
  koppelingen,
  motoren,
  documenten,
  werk,
  assistent,
  communicatie,
  leads,
  bedrijfsvoering,
  zelfstandig,
  veiligheid,
  gebruik,
  onderscheid,
  agenda,
  vervolg,
];

/** De hoofdstukken die een bepaalde bezoeker mag zien. */
export function zichtbareHoofdstukken(isBeheerder: boolean): Hoofdstuk[] {
  return HOOFDSTUKKEN.filter((h) => isBeheerder || !h.intern);
}
