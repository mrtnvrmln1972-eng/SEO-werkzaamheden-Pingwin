import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import AdminKop from "../AdminKop";

// ═══════════════════════════════════════════════════════════
// /admin/claude-werkwijze — HOE JE MET CLAUDE WERKT
// ═══════════════════════════════════════════════════════════
// Geen instructie ván Claude aan Claude (dat staat in de CLAUDE.md's), maar het
// spiegelbeeld: waar Maarten zelf op let als hij een sessie start of bijhoudt,
// zodat hij niet elke keer opnieuw hoeft te ontdekken waarom een chat traag,
// duur of onbetrouwbaar aanvoelt. Aanleiding (13 augustus 2026): een simpele
// venstertje-verplaatsing kostte twee sessies en ruim twintig minuten, en de
// oorzaken bleken stuk voor stuk dingen die hier nu als tip staan: een
// verouderde kloon, de denkstand nog op "High", en een sessie die allang
// stilstond op een onbeantwoorde goedkeuringsvraag.
//
// Bewust GEEN database en geen invulscherm: dit groeit doordat Maarten tegen
// Claude zegt "zet dit er ook bij", en Claude dit bestand aanvult. Dezelfde
// werkwijze als de rest van het brein: de repo is het geheugen, niet een UI.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

type Tip = { titel: string; tekst: string };
type Categorie = { titel: string; tips: Tip[] };

const CATEGORIEEN: Categorie[] = [
  {
    titel: "1. Voor je een nieuwe chat start",
    tips: [
      {
        titel: "Welke repo's aanhaken",
        tekst:
          "pingwin-brein hoort er altijd bij: dat is het geheugen. Daarnaast de repo waar het werk in landt: noc-seo-dashboard voor de SEO/AEO-cockpit van Nationaal Oogcentrum, SEO-werkzaamheden-Pingwin voor Pingwins eigen beheer (dit scherm, agenda, financiën, klanten), of de repo van een andere klant. Twijfel je, laat Claude het zelf opzoeken (list_repos); nooit gokken op de naam.",
      },
      {
        titel: "Eén onderwerp per chat",
        tekst:
          "Wissel je van onderwerp, begin dan een nieuwe chat, ook als de vorige nog kort is. Oude context maakt antwoorden niet beter maar slechter, en kost bij elke vraag opnieuw geld.",
      },
      {
        titel: "Kom je een dag later terug op dezelfde chat?",
        tekst:
          "Begin dan liever een nieuwe. De cache van het gesprek is dan al verlopen (vijf minuten stilte op tegoed, een uur binnen het abonnement) en elke vraag betaalt de hele geschiedenis opnieuw, zonder dat je dat aan de reactietijd merkt.",
      },
    ],
  },
  {
    titel: "2. Model en denkstand: twee aparte knoppen",
    tips: [
      {
        titel: "Model naar de klus",
        tekst:
          "Sonnet voor bouwen, opmaken, teksten en ander mechanisch werk: de aanpak staat al vast, het is uitvoeren. Opus voor strategie, architectuur en een lastige analyse waarbij een verkeerde afweging geld of een verkeerde beslissing kost. Fable alleen als je er zelf expliciet om vraagt.",
      },
      {
        titel: "Denkstand (reasoning effort) staat er los naast",
        tekst:
          "Dit is een tweede instelling naast het model, rechtsonder in de chatbalk. \"High\" laat zelfs Sonnet extra lang nadenken over elke stap, ook over iets simpels. Voor een bouwklusje zet je hem op Medium of Low; bewaar High voor het zwaarste denkwerk. Een modelwissel alleen is niet genoeg als de denkstand op High blijft staan (gebeurde letterlijk op 13 augustus 2026).",
      },
    ],
  },
  {
    titel: "3. Voelt een sessie traag? Check dit eerst",
    tips: [
      {
        titel: "Staat er een goedkeuringsvraag open?",
        tekst:
          "Een sessie die \"al tien minuten bezig is\" kan gewoon stilstaan, wachtend op een klik op een permission-prompt (bijvoorbeeld voor een tool-aanroep). Dat is geen denktijd van het model. Open de sessie en kijk of er iets op goedkeuring wacht voordat je concludeert dat Claude traag is.",
      },
      {
        titel: "Verse container, verse kloon",
        tekst:
          "De eerste minuut van een nieuwe sessie gaat op aan het klaarzetten van de omgeving (repo's klonen, skills synchroniseren). Bij een grote repo kan dat oplopen. De starthook zorgt er sinds 13 augustus 2026 voor dat elke sessie automatisch op de laatste code begint, zodat dat niet ook nog eens een zoekronde kost.",
      },
      {
        titel: "Is dit al de tweede poging?",
        tekst:
          "Een eerdere sessie met dezelfde naam die met een fout stopte, is geen goed teken voor de herstart. Check de sessielijst (in de app, of laat Claude het zelf opzoeken) voordat je aanneemt dat het aan het model ligt.",
      },
    ],
  },
  {
    titel: "4. Voorkom dat Claude gaat gokken",
    tips: [
      {
        titel: "Vraag om de bron, niet om het antwoord",
        tekst:
          "Klinkt een bewering stellig zonder dat erbij staat waar hij vandaan komt (de live site, Ahrefs, Search Console, een mail), vraag dan door. \"Verifieer, gok nooit\" is de vaste regel, maar een korte controlevraag van jouw kant vangt de keer dat het toch misgaat.",
      },
      {
        titel: "Een plan of oud document is niet de werkelijkheid",
        tekst:
          "Een zoekwoordenplan of een eerder rapport kan maanden oud zijn. Vraag bij twijfel expliciet: is dit net gecontroleerd, of komt dit uit een ouder bestand?",
      },
    ],
  },
  {
    titel: "5. Kosten laag houden",
    tips: [
      {
        titel: "Drie meters, en ze tellen niet bij elkaar op",
        tekst:
          "Ahrefs-units, wat het dashboard zelf aan AI-denkwerk verbruikt, en je eigen Claude-abonnement zijn drie losse potjes. Het abonnement is het enige dat je niet kunt aflezen in dit dashboard; check dat op claude.ai/settings/usage.",
      },
      {
        titel: "Connectors en skills die je niet gebruikt: uit",
        tekst:
          "Elke gekoppelde dienst (claude.ai → Settings → Connectors) en elke skill (→ Settings → Skills) brengt zijn hele gereedschapslijst mee bij élke vraag, ook als je hem nooit aanraakt. Vraagt er eentje ongevraagd om toestemming, keur dat niet zomaar goed.",
      },
      {
        titel: "Geen agents of workflows tenzij je erom vraagt",
        tekst:
          "Meerdere agents tegelijk of een workflow kost een veelvoud van een gewone vraag. Prima als de klus dat waard is, maar dat is een bewuste keuze, geen automatisme.",
      },
    ],
  },
  {
    titel: "6. Onderhoud: wekelijks en maandelijks",
    tips: [
      {
        titel: "Wekelijks: het weekverbruik checken",
        tekst:
          "Met /usage in Claude Code zie je of de weeklimiet van je abonnement vol raakt. Staat hij op 100%, dan is al het werk tot de reset betaald werk; kan iets wachten, wacht dan.",
      },
      {
        titel: "Wekelijks: sessies opruimen",
        tekst:
          "Een sessie die vastzit op een goedkeuringsvraag of met een fout stopte, blijft anders onopgemerkt liggen. Loop de sessielijst kort langs en sluit af wat klaar is.",
      },
      {
        titel: "Maandelijks: connectors en skills nakijken",
        tekst:
          "Dook er een nieuwe connector op die je niet hebt aangezet? Staat er nog een oude skill dubbel op claude.ai naast de repo-versie (die wint dan ten onrechte)? Zie brein/06-beslissingen-log.md voor waarom dat een keer misging.",
      },
      {
        titel: "Maandelijks: dit lijstje zelf",
        tekst:
          "Loop je tegen iets aan dat hier nog niet in staat, zeg dan tegen Claude: \"zet dit er ook bij\". Dat is precies hoe dit scherm groeit.",
      },
    ],
  },
];

export default async function ClaudeWerkwijzePage() {
  if (!cookies().get(ADMIN_COOKIE)?.value) redirect("/admin/login");

  return (
    <>
      <AdminKop titel="Claude-werkwijze" />
      <div className="container">
        <div className="cw-wrap">
          <p className="cw-intro">
            Praktische geheugensteun voor het werken met Claude zelf: wat aanhaken, welk model
            en welke denkstand, hoe je herkent dat een sessie vastzit in plaats van traag is, en
            hoe je kosten en betrouwbaarheid laag en hoog houdt. Groeit mee zodra we iets nieuws
            tegenkomen.
          </p>
          {CATEGORIEEN.map((cat) => (
            <div className="card section cw-kaart" key={cat.titel}>
              <div className="section-title">{cat.titel}</div>
              <ul className="cw-lijst">
                {cat.tips.map((tip) => (
                  <li key={tip.titel}>
                    <strong>{tip.titel}.</strong> {tip.tekst}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
