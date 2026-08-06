/**
 * WAT ELKE KLANTMAIL MOET WETEN, OP ÉÉN PLEK
 * ══════════════════════════════════════════
 * De mailgenerator kreeg tot nu toe alleen het klantprofiel mee, afgekapt op 1500
 * tekens. Niet de bedrijfsgegevens, niet de propositie, niet de concurrenten, en
 * niets over hoe Pingwin werkt. Daardoor kon een mail nooit iets zeggen dat je
 * alleen weet als je die klant kent, en dat is precies wat een mail persoonlijk
 * maakt in plaats van generiek.
 *
 * Dit bestand verzamelt die kennis één keer en levert hem als tekstblok. Het hangt
 * in `app/api/admin/task/explain/route.ts`, en dat is de generator waar élke mail
 * uit dit dashboard langsloopt: de kansmails, de mails vanaf een weekplanning-kaart,
 * de opruimmails en de mails uit een gesprek.
 *
 * Alles komt uit bronnen die al bestaan. Er wordt niets nieuws over de klant
 * verzonnen en niets overgetypt.
 */

import { getClientBySlug } from "./clients";
import { getOrgData } from "./org-data";
import { getCompetitors } from "./competitors";
import { getPropositie } from "./prioriteiten-scan";
import { PINGWIN_WERKWIJZE } from "./pingwin-methode";

export type MailContext = {
  klantnaam: string;
  /** Het klantprofiel: wie ze zijn, wat hen onderscheidt, hun doelgroep. */
  profiel: string;
  /** De propositie-zin: wat deze klant wél en niet wil zijn. */
  propositie: string;
  /** Harde bedrijfsgegevens: werkgebied, diensten, merken, vestigingen. */
  feiten: string[];
  concurrenten: string[];
};

export async function bouwMailContext(slug: string): Promise<MailContext> {
  const [client, org, concurrenten, propositie] = await Promise.all([
    getClientBySlug(slug).catch(() => null),
    getOrgData(slug).catch(() => null),
    getCompetitors(slug).catch(() => [] as string[]),
    getPropositie(slug).catch(() => ({ zin: "", voorstel: "" })),
  ]);

  const d = org?.data;
  const feiten: string[] = [];
  if (d?.bedrijfstype) feiten.push(`Soort bedrijf: ${d.bedrijfstype}`);
  const plaatsen = [
    ...(d?.plaats ? [d.plaats] : []),
    ...(d?.areaServed || []),
    ...((d?.vestigingen || []).map((v) => v.plaats).filter(Boolean) as string[]),
  ];
  if (plaatsen.length) feiten.push(`Werkgebied: ${[...new Set(plaatsen)].join(", ")}`);
  const diensten = (d?.diensten || []).map((x) => x.naam).filter(Boolean);
  if (diensten.length) feiten.push(`Diensten: ${diensten.slice(0, 12).join(", ")}`);
  if (d?.merken?.length) feiten.push(`Merken waar ze mee werken: ${d.merken.slice(0, 12).join(", ")}`);
  if (d?.oprichtingsjaar) feiten.push(`Bestaat sinds: ${d.oprichtingsjaar}`);

  return {
    klantnaam: client?.name || "",
    // Bewust NIET afgekapt op 1500 tekens zoals eerst. Juist de onderste secties
    // van het profiel (doelgroep, wat hen onderscheidt) vielen daardoor weg, en
    // dat is precies het deel dat een mail persoonlijk maakt.
    profiel: (client?.seoProfile || "").slice(0, 6000),
    propositie: (propositie?.zin || "").trim(),
    feiten,
    concurrenten: (concurrenten || []).slice(0, 4),
  };
}

/** De klantkennis als blok voor de mailopdracht. Leeg als we niets weten. */
export function klantBlok(c: MailContext): string {
  const delen: string[] = [];
  if (c.propositie) delen.push(`Wat deze klant WÉL en NIET wil zijn:\n${c.propositie}`);
  if (c.feiten.length) delen.push(`Harde gegevens over dit bedrijf:\n${c.feiten.map((f) => `- ${f}`).join("\n")}`);
  if (c.profiel) delen.push(`Klantprofiel (wie ze zijn, wat hen onderscheidt, wie hun klanten zijn):\n${c.profiel}`);
  if (c.concurrenten.length) delen.push(`Hun concurrenten in Google: ${c.concurrenten.join(", ")}`);
  if (!delen.length) return "";
  return [
    `WAT WE OVER DEZE KLANT WETEN. Gebruik hier één concreet ding uit dat laat merken dat je hun bedrijf kent (hun werkgebied, een dienst, waarin ze zich onderscheiden). Eén detail, niet een opsomming, en alleen als het echt ergens op slaat. Verzin NOOIT iets bij wat hier niet staat.`,
    ...delen,
  ].join("\n\n");
}

// ── Hoe wij werken ────────────────────────────────────────────────────────
/**
 * Uit de werkwijze wordt per mail ÉÉN stuk gekozen, niet het hele verhaal. Anders
 * staat er elke keer dezelfde alinea over de top 10-analyse en is dat binnen drie
 * mails behang.
 *
 * De teksten zijn de klantvriendelijke formuleringen die al in het copy-document
 * staan en door Maarten zijn goedgekeurd; hier ingekort tot wat je in een mail
 * kwijt kunt.
 */
export const WERKWIJZE_STUKKEN: { sleutel: string; tekst: string }[] = [
  { sleutel: "zoekintentie", tekst: "We kijken eerst wat iemand die deze zoekterm intikt eigenlijk wil: informatie, een prijs, of een bedrijf om te bellen. Die zoekintentie bepaalt de hele opzet van de pagina." },
  { sleutel: "top10", tekst: "We analyseren de tien pagina's die nu bovenaan staan in Google, en voegen bewust onderwerpen toe die zij nog niet behandelen. Dat is voor Google de reden om onze pagina toe te voegen en hoog te zetten." },
  { sleutel: "behouden", tekst: "Wat er al op de pagina staat is waardevol, want Google kent die pagina al. We behouden daarom zoveel mogelijk van de bestaande inhoud en bouwen daaromheen." },
  { sleutel: "blauwdruk", tekst: "Voordat er een woord geschreven wordt maken we een blauwdruk: welke koppen, welke vragen, welke onderwerpen. Pas als die klopt gaat de tekst erin." },
  { sleutel: "tov", tekst: "De tekst schrijven we in jullie eigen toon, op basis van hoe er nu op de site geschreven wordt. Het moet klinken als jullie en niet als een tekstfabriek." },
  { sleutel: "doorlooptijd", tekst: "Google heeft tijd nodig om een wijziging op te pikken. Reken op een week of zes voor kleine aanpassingen en op een paar maanden voor een nieuwe pagina." },
  { sleutel: "eigen-hand", tekst: "Je krijgt de tekst eerst ter controle. Jij weet meer van je vak dan wij, dus wat jij aanpast gaat mee de site in." },
];

/**
 * Kiest een stuk werkwijze dat nog niet aan de beurt is geweest. Deterministisch:
 * dezelfde geschiedenis geeft dezelfde keuze, dus de uitkomst is te testen.
 */
export function kiesWerkwijze(alGebruikt: string[]): { sleutel: string; tekst: string } {
  const gebruikt = new Set(alGebruikt.filter(Boolean));
  const vrij = WERKWIJZE_STUKKEN.filter((w) => !gebruikt.has(w.sleutel));
  // Alles een keer gehad? Dan begint de ronde opnieuw, te beginnen bij het stuk
  // dat het langst geleden is (dat staat achteraan in de geschiedenis).
  if (!vrij.length) {
    const oudsteEerst = [...WERKWIJZE_STUKKEN].sort(
      (a, b) => alGebruikt.lastIndexOf(a.sleutel) - alGebruikt.lastIndexOf(b.sleutel),
    );
    return oudsteEerst[0];
  }
  return vrij[0];
}

/** Het blok over de werkwijze, met precies één stuk erin. */
export function werkwijzeBlok(stuk: { sleutel: string; tekst: string }): string {
  return [
    `HOE WIJ WERKEN. Verwerk hiervan ÉÉN gedachte in de mail, in je eigen woorden, zodat de klant merkt dat er een aanpak achter zit en niet een ingeving. Niet letterlijk overnemen, niet meer dan twee zinnen, en niet als los blokje maar in de lopende tekst:`,
    stuk.tekst,
  ].join("\n\n");
}

/** De volledige werkwijze, voor als een mail echt over het traject zelf gaat. */
export const VOLLEDIGE_WERKWIJZE = PINGWIN_WERKWIJZE;
