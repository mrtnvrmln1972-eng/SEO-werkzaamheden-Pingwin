import fs from "node:fs";
import path from "node:path";
import { groepeerKlanten, isKlant, isLead, isEigenKlant, isAfgesloten, faseVan } from "../lib/klant-groepen";

// ═══════════════════════════════════════════════════════════
// "MIJN EIGEN KLANTEN" BLIJFT MIJN EIGEN KLANTEN
// ═══════════════════════════════════════════════════════════
// Waarom deze proef bestaat: op 20-08-2026 stonden er 124 rijen onder "Mijn eigen
// klanten", vol hosting- en websitedeals, allemaal met een "onboarding 2/18"-badge.
// Maartens elf eigen SEO-klanten waren er niet meer in terug te vinden.
//
// De oorzaak was één regel die op vier plekken apart was uitgeschreven: "alles wat
// geen lead is, is een klant". Dat klopte zolang klanten met de hand werden
// aangemaakt. Sinds de HubSpot-koppeling komen deals vanzelf binnen, en een deal
// die niet doorgaat krijgt fase "verloren"; die viel dus uit de leadlijst en kwam
// ómhoog, tussen de echte klanten. De bulk-onboarding rekende ze ook nog mee.
//
// Nu is er één bron (lib/klant-groepen.ts) en deze poort die nakijkt of niemand er
// opnieuw een eigen regel naast zet.

const WORTEL = path.resolve(__dirname, "..");
let fouten = 0;
function check(wat: string, goed: boolean, waarom: string) {
  console.log(`${goed ? "ok " : "FOUT"}  ${wat}`);
  if (!goed) { console.log(`      ${waarom}`); fouten++; }
}

const lees = (p: string) => fs.readFileSync(path.join(WORTEL, p), "utf8");

// ── 1. De regel zelf ─────────────────────────────────────────────────────────

const eigen = { fase: "klant", grp: null };
const mmc = { fase: "klant", grp: "mmc" };
const lead = { fase: "lead", grp: null };
const verloren = { fase: "verloren", grp: null };
const oud = { fase: "oud", grp: null };
const zonderFase = { fase: null, grp: null };

check("een verloren deal is GEEN klant", !isKlant(verloren) && !isEigenKlant(verloren),
  "Dit is de fout van 20-08-2026: 120 verloren deals stonden tussen de lopende klanten.");

check("een verloren deal is ook geen lead", !isLead(verloren),
  "Anders verhuist het probleem alleen naar de leadlijst.");

check("een verloren deal en een oud-klant zijn afgesloten", isAfgesloten(verloren) && isAfgesloten(oud),
  "Die twee horen samen in hun eigen, dichte blok.");

check("een rij zonder fase telt als klant", isKlant(zonderFase) && faseVan(zonderFase) === "klant",
  "Rijen van vóór de HubSpot-koppeling hebben geen fase, en dat zijn stuk voor stuk echte klanten.\n"
  + "       Een klant die uit beeld verdwijnt is onherstelbaar; een rij te veel zie je meteen.");

check("een Multimedia Concepts-klant valt niet onder mijn eigen klanten", isKlant(mmc) && !isEigenKlant(mmc),
  "Die staan in hun eigen blok, dat was al zo.");

const g = groepeerKlanten([eigen, mmc, lead, verloren, oud, zonderFase]);
check("elke rij komt in precies één groep",
  g.eigen.length === 2 && g.mmc.length === 1 && g.leads.length === 1 && g.verloren.length === 1 && g.oud.length === 1,
  `Gevonden: eigen ${g.eigen.length}, mmc ${g.mmc.length}, leads ${g.leads.length}, verloren ${g.verloren.length}, oud ${g.oud.length}.`);

const totaal = g.eigen.length + g.mmc.length + g.leads.length + g.verloren.length + g.oud.length;
check("wat je optelt is het totaal", totaal === 6,
  "Geen rij die twee keer meetelt en geen rij die nergens meer opduikt.");

// ── 2. Niemand schrijft die regel opnieuw uit ────────────────────────────────

// De vier schermen en twee eindpunten die het mis hadden. Ze horen allemaal uit
// lib/klant-groepen.ts te lezen, want dat is wat ze bij elkaar houdt.
const GEBRUIKERS = [
  "app/admin/AdminClient.tsx",
  "app/admin/client/[slug]/KlantKiezer.tsx",
  "app/admin/fundament/FundamentClient.tsx",
  "lib/onboarding-bulk.ts",
  "app/api/admin/klantwaarde/route.ts",
  "app/api/admin/onboarding/route.ts",
];
for (const p of GEBRUIKERS) {
  const code = lees(p);
  const naam = p.split("/").pop();
  check(`${naam} gebruikt de gedeelde indeling`,
    /from "(\.\.\/)*(\.\.\/)?lib\/klant-groepen"|from "\.\/klant-groepen"/.test(code),
    "Importeer uit lib/klant-groepen in plaats van zelf op fase of grp te filteren.");

  check(`${naam} verzint geen eigen klant-regel`,
    !/fase\s*!==\s*["']lead["']/.test(code),
    'Precies deze regel ("alles wat geen lead is, is een klant") zette elke verloren deal\n'
    + "       tussen de lopende klanten. Gebruik isKlant() of groepeerKlanten().");
}

// ── 3. De afgesloten deals hebben hun eigen, dichte plek ─────────────────────

const beheer = lees("app/admin/AdminClient.tsx");
check("de beheerlijst heeft een eigen blok voor niet doorgegaan en oud",
  /titel="Niet doorgegaan en oud"/.test(beheer),
  "Ze mogen blijven bestaan (de mails en dealwaarde zijn de reden dat ze bewaard zijn), maar niet in de klantenlijst.");

check("dat blok staat standaard dicht",
  !/titel="Niet doorgegaan en oud"[\s\S]{0,400}standaardOpen/.test(beheer),
  "Vouwblok is standaard dicht; zet er geen standaardOpen op, dit is naslag.");

check("de klantenkiezer heeft dezelfde groep",
  /"Niet doorgegaan en oud"/.test(lees("app/admin/client/[slug]/KlantKiezer.tsx")),
  "Anders staan ze in de kopbalk alsnog tussen de eigen klanten.");

console.log(fouten === 0 ? "\nDe klantenindeling komt overal uit dezelfde bron." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
