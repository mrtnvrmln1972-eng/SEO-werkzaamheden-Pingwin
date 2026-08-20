import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../../lib/clients";
import { callClaude } from "../../../../../lib/anthropic";
import { aanhefVoor } from "../../../../../lib/aanhef";
import { striptToeschrijvingen } from "../../../../../lib/herkomst";
import { getEmails } from "../../../../../lib/snapshots";
import { getSchrijfstijl, schrijfstijlBlok } from "../../../../../lib/schrijfstijl";
import { bouwMailContext, klantBlok, kiesWerkwijze, werkwijzeBlok } from "../../../../../lib/mail-context";
import { notitieTekst } from "../../../../../lib/kaart-links";

export const runtime = "nodejs";

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

function stripTags(s: string): string {
  return (s || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

// Maakt van de "waarom" achter een taak (de onderbouwing die de bird's eye bedacht)
// een korte, klantvriendelijke uitleg-mail. Zo laat je de waarde en de moeite zien
// zonder een urenstaat: "dit doen we, dít is waarom, en dit levert het op."
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const taak = stripTags(String(body.taak || ""));
  // De achtergrondtekst kan een persoonsnaam bevatten die daar niet hoort (zie
  // lib/herkomst.ts). Die gaat eruit vóór de assistent hem te zien krijgt, want
  // wat hij niet leest kan hij ook niet in de mail zetten.
  const toelichtingRuw = stripTags(String(body.toelichting || ""));
  const url = String(body.url || "").trim();
  // Mail v2: doelgroep (klant/dev/anders), een vrije instructie en documentlinks
  // die als kale URL in de mail mogen. Zonder deze velden gedraagt de route zich
  // exact als voorheen (klant-mail), dus bestaande aanroepen blijven werken.
  const audience = ["klant", "dev", "anders"].includes(String(body.audience || "")) ? String(body.audience) : "klant";
  const instructie = stripTags(String(body.instructie || "")).slice(0, 1000);
  const ontvanger = stripTags(String(body.ontvanger || "")).slice(0, 120);
  // Soort mail. Leeg = precies zoals deze route zich altijd gedroeg.
  const stijl = String(body.stijl || "").trim();
  // Welke stukken werkwijze deze klant al gehad heeft. Komt van het scherm, dat
  // het logje van eerdere kansmails leest; zo staat er niet elke keer dezelfde
  // alinea over de top 10-analyse in.
  const eerderGebruikt = (Array.isArray(body.eerderGebruikt) ? body.eerderGebruikt : []).map((x) => String(x)).slice(0, 20);
  const links = (Array.isArray(body.links) ? body.links : [])
    .map((l) => ({ label: stripTags(String((l as Record<string, unknown>)?.label || "")).slice(0, 60), url: String((l as Record<string, unknown>)?.url || "").trim().slice(0, 600) }))
    .filter((l) => l.url).slice(0, 6);
  if (!slug || !taak) return NextResponse.json({ ok: false, error: "Klant en taak zijn verplicht." }, { status: 400 });

  const client = await getClientBySlug(slug).catch(() => null);
  const naam = client?.name || "de klant";
  const profiel = (client?.seoProfile || "").slice(0, 1500);

  // Een naam blijft alleen staan als die persoon echt in de mailset van DEZE klant
  // voorkomt. Zo niet, dan is het een naam die de assistent ooit ergens oppikte.
  const post = await getEmails(slug, 80).catch(() => []);
  const bekend = post.flatMap((e) => [e.fromName, e.fromAddress]).filter(Boolean);
  const toelichting = striptToeschrijvingen(toelichtingRuw, {
    bekend, eigen: [client?.name, client?.cockpit?.devName],
  });

  // Aanhef uit het adres: "Tonny@pingwin.nl" wordt "Hoi Tonny,". Zie lib/aanhef.ts;
  // het scherm gebruikt precies dezelfde afleiding.
  const aanhef = aanhefVoor(String(body.to || ""));

  const opmaakRegels = [
    `Harde regels voor de opmaak en lengte (dit is een echte mail, niemand leest een muur van tekst):`,
    `- MAXIMAAL 120 woorden tussen aanhef en afsluiting. Liever korter. Dit is hard.`,
    `- Begin met EXACT deze aanhef op een eigen regel: "${aanhef}". Verzin er zelf geen naam bij.`,
    `- De EERSTE regel van je antwoord is "Onderwerp: ..." met een korte, concrete onderwerpregel; daarna een lege regel en pas dan de aanhef.`,
    `- Noem een document bij zijn NAAM ("het copy-document", "de blauwdruk"), nooit als kale URL. Het dashboard hangt de link automatisch aan die woorden; een URL van honderd tekens in de lopende tekst is onleesbaar.`,
    `- Geen interne meetgegevens in de mail: geen pixelbreedtes, posities, vertoningen of scores. Zeg wat er moet gebeuren en verwijs naar het document voor de tekst.`,
    `- NOOIT verzendgeschiedenis navertellen. Niets over wie wat wanneer naar wie heeft gestuurd of ontvangen ("is op 5 juli meegestuurd aan ..."). Dat is interne herkomst; het hoort niet in een mail naar buiten en is vaak ook nog fout.`,
    `- NOEM GEEN PERSONEN BIJ NAAM, behalve de ontvanger zelf en Maarten. Namen die in de achtergrondtekst opduiken kunnen bij een andere klant horen; laat ze weg.`,
    `- Opbouw: aanhef, één openingszin met de kern, dan de concrete punten als korte '-'-bullets (elk één regel), eventueel één slotzin, afsluiting.`,
    `- Vertel NOOIT het proces na ("voor we aan de slag gingen hebben we uitgebreid gekeken naar..."): alleen wat er gebeurt of gebeurd is en wat het oplevert.`,
    `- Alinea's van hooguit twee zinnen. Geen kopjes, geen tabellen, geen vetgedrukte woorden, geen Markdown-tekens.`,
    `- Gebruik nooit een los liggend streepje als zinsscheiding; gebruik een komma, puntkomma, haakjes of een nieuwe zin.`,
    `- Nederlands. Kort en concreet. Geen loze beloftes.`,
  // Bij een kans-mail gelden vier van deze regels niet; die worden hieronder
  // vervangen door strengere, eigen regels. Ze hier laten staan zou betekenen dat
  // het model twee tegenstrijdige instructies krijgt, en dan is het een gok welke
  // wint. De vierde is "vertel nooit het proces na": bij een kans-mail is één zin
  // over hoe we het aanpakken juist de bedoeling, want dat laat zien dat er een
  // vak achter zit. Wat verboden blijft is het navertellen van wat wíj intern
  // gedaan hebben; dat staat in de kansregels hieronder.
  ].filter((r) => stijl !== "kans" || !/MAXIMAAL 120 woorden|vetgedrukte woorden|^- Opbouw: aanhef|Vertel NOOIT het proces na/.test(r));
  const doelgroep = audience === "dev"
    ? [
        `Je schrijft namens Maarten van Pingwin (SEO-bureau) een korte, directe e-mail aan de developer/sitebouwer van de klant "${naam}".`,
        `Doel: concreet doorgeven wat er op de site moet gebeuren, met de relevante details zodat de developer meteen aan de slag kan. Vakjargon mag.`,
        ...opmaakRegels,
        `- Sluit af met "Groet, Maarten (Pingwin)".`,
      ]
    : audience === "anders"
    ? [
        `Je schrijft namens Maarten van Pingwin (SEO- en online-marketingbureau) een korte, heldere e-mail${ontvanger ? ` aan ${ontvanger}` : ""} over werk voor de klant "${naam}".`,
        `Doel: neutraal en duidelijk uitleggen waar het over gaat en wat er van de ontvanger wordt gevraagd of gemeld.`,
        ...opmaakRegels,
        `- Sluit af met "Met vriendelijke groet, Maarten (Pingwin)".`,
      ]
    : [
        `Je schrijft namens Pingwin (SEO- en online-marketingbureau) een korte, vriendelijke e-mail aan de klant "${naam}".`,
        `Doel: in gewone taal uitleggen wat we (gaan) doen, waarom dat goed is voor hun vindbaarheid, en wat het oplevert. Zo ziet de klant de waarde, zonder een urenverantwoording.`,
        `Gewone taal, geen jargon. Vermijd woorden als "meta", "canonical", "cannibalisatie" of leg ze in één simpele zin uit.`,
        ...opmaakRegels,
        ...(stijl === "kans" ? [] : [`- Sluit af met "Met vriendelijke groet, Pingwin".`]),
      ];

  /**
   * De kans-mail: "ik zag dit, dit wil ik oppakken, ben je het ermee eens?"
   *
   * Waarom apart. Deze mail ging eerst langs de opgemaakte weg, met een oranje
   * kopbalk en vier vaste kaders eronder. Dat las als een reclamemail uit een
   * tool: hetzelfde skelet elke keer, en de afzender leek een knop in plaats van
   * een mens. Terwijl dit juist de mail is die moet laten zien dat er iemand naar
   * hun site heeft zitten kijken.
   *
   * Het antwoord is niet mooiere opmaak maar minder opmaak, plus inhoud die je
   * alleen hebt als je echt gekeken hebt. De VORM verschilt daarom per soort
   * kans: een titel-en-omschrijving-mail is vier zinnen, een nieuwe-pagina-mail
   * mag een lijstje bevatten. Dat is de echte variatie. Zinnen laten rouleren uit
   * een voorraadje zou juist nep aanvoelen.
   */
  const kansRegels = stijl === "kans" ? [
    ``,
    `DIT IS EEN SIGNALEER-MAIL. Maarten heeft de site van deze klant doorgenomen en één ding gevonden dat hij wil oppakken. De mail moet klinken alsof hij hem zelf net heeft getikt, niet alsof een systeem hem heeft gegenereerd.`,
    `- Schrijf in de IK-vorm namens Maarten. Niet "wij van Pingwin", niet "ons systeem", niet "de analyse".`,
    `- Vertel WAT je zag en WAAROM je het wilt oppakken. Eén concreet feit is genoeg (waar wordt op gezocht, wat mist er of wat gaat er mis).`,
    `- Noem waar het kan iets uit hun eigen site, zodat te merken is dat er echt gekeken is (een bestaande pagina, hun plaatsen, hun dienst).`,
    `- Sluit af met de vraag of de klant het ermee eens is, en met wat er dan volgt: de copy of de opzet van de pagina die je ter controle stuurt. Geen huiswerk, geen vragenlijst.`,
    `- Eén onderwerp per mail. Ga NIET over andere pagina's of andere kansen beginnen.`,
    `- Een enkel **vetgedrukt** woord mag, en een kort lijstje ook, als dat de mail leesbaarder maakt. Spaarzaam: hooguit één van de twee per mail, en nooit allebei in dezelfde alinea.`,
    `- GEEN kopjes, geen kaders, geen afsluitende samenvatting, geen "Met vriendelijke groet, Pingwin" als bedrijfsnaam; dit is een mail van Maarten zelf.`,
    `- Noem geen scores, ranglijsten of aantallen kansen. Alleen dít ene ding.`,
    `- Sluit af met "Groet," en op de volgende regel "Maarten".`,
    `- MAXIMAAL 250 woorden tussen aanhef en afsluiting, en dat is een plafond en geen doel.`,
    `- Open NIET elke mail op dezelfde manier. Kies de opening die bij déze kans past en varieer.`,
  ] : [];

  // Zo schrijft Maarten zelf, wat we van deze klant weten, en één stuk werkwijze.
  // Alle drie de blokken zijn leeg zolang er nog niets van bekend is, en dan
  // gedraagt deze route zich exact zoals daarvoor.
  const [stijlProfiel, klant] = await Promise.all([
    audience === "klant" ? getSchrijfstijl().catch(() => null) : Promise.resolve(null),
    audience === "klant" && slug ? bouwMailContext(slug).catch(() => null) : Promise.resolve(null),
  ]);
  const stijlTekst = stijlProfiel ? schrijfstijlBlok(stijlProfiel) : "";
  const klantTekst = klant ? klantBlok(klant) : "";
  const gekozenWerkwijze = stijl === "kans" ? kiesWerkwijze(eerderGebruikt) : null;
  const werkwijze = gekozenWerkwijze ? werkwijzeBlok(gekozenWerkwijze) : "";

  const system = [
    ...doelgroep,
    ...kansRegels,
    // De schrijfstijl staat bewust NA de opdracht en VÓÓR de inhoud: het is de
    // norm waaraan alles daarna moet voldoen, niet een losse suggestie achteraf.
    stijlTekst ? `\n${stijlTekst}` : ``,
    werkwijze ? `\n${werkwijze}` : ``,
    links.length ? `\nDeze documenten en pagina's gaan mee. Noem ELK van deze namen LETTERLIJK in de tekst; de link wordt automatisch aan die exacte woorden gehangen, dus zet zelf NOOIT de URL in de tekst. Schrijf nooit "de bijgevoegde link", "bijgaand" of "in de bijlage" als omschrijving, want dan is er niets om de link aan te hangen en verdwijnt hij:\n${links.map((l) => `- ${l.label}`).join("\n")}` : ``,
    instructie ? `\nEXTRA WENS VAN DE GEBRUIKER (volg dit):\n${instructie}` : ``,
    // Het klantblok vervangt het oude, op 1500 tekens afgekapte profiel. Juist de
    // onderste secties (doelgroep, wat hen onderscheidt) vielen door die afkapping
    // weg, en dat is precies het deel dat een mail persoonlijk maakt.
    klantTekst ? `\n${klantTekst}` : (profiel && audience === "klant" ? `\nContext over de klant (gebruik subtiel om de toon te raken, niet letterlijk overnemen):\n${profiel}` : ``),
  ].filter(Boolean).join("\n");

  // De aantekeningen van de kaart gaan mee. Dat is het veld dat Maarten met de
  // hand vult, en daar staat vaak precies wat de ontvanger nodig heeft om te
  // kunnen beginnen: vijf vestigingen met hun adressen en mailadressen, een
  // verwijzing naar het stappenplan, de bespreekpunten. Zonder dit schreef de
  // assistent "kun jij die vijf vestigingen aanmaken?" en moest de ontvanger de
  // gegevens alsnog opvragen (20-08-2026).
  const notitie = notitieTekst(String(body.notitie || ""), 3000);
  const user = [
    `Taak: ${taak}`,
    url ? `Pagina: ${url}` : ``,
    toelichting ? `Achtergrond en waarom (intern; gebruik wat relevant is voor deze ontvanger):\n${toelichting}` : `Er is nog geen aparte onderbouwing; schrijf op basis van de taak zelf.`,
    notitie ? `Aantekeningen bij deze taak (met de hand geschreven; hierin staan de concrete gegevens. Neem over wat de ontvanger nodig heeft om te kunnen beginnen, zoals adressen, namen en verwijzingen, en verzin er niets bij):\n${notitie}` : ``,
  ].filter(Boolean).join("\n");

  try {
    const text = await callClaude(system, [{ role: "user", content: user }], 700, { slug, action: "taak_uitleg_klant" });
    const clean = (text || "").trim();
    if (!clean) return NextResponse.json({ ok: false, error: "Geen uitleg gegenereerd." }, { status: 502 });
    // De gekozen werkwijze gaat mee terug, zodat het scherm kan onthouden welk stuk
    // deze klant gehad heeft en de volgende mail een ander stuk pakt.
    return NextResponse.json({ ok: true, text: clean, werkwijze: gekozenWerkwijze?.sleutel || "" });
  } catch {
    return NextResponse.json({ ok: false, error: "De assistent is niet bereikbaar." }, { status: 502 });
  }
}
