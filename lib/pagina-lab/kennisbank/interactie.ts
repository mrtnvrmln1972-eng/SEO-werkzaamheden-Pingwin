// Plank 1, discipline INTERACTIE: hoe gedraagt de pagina zich?
//
// Snelheid, klikken, bewegen en onderbreken. Dit is de discipline met de
// hardste getallen, want de drie Core Web Vitals zijn gewoon te meten en Google
// publiceert de grenzen zelf. Waaróm snelheid geld waard is staat niet hier
// maar bij CONV-07: dat is een conversieargument, dit zijn de meetwaarden.

import type { Criterium } from "./types";

const WEB_VITALS = { naam: "web.dev (Google), Web Vitals", url: "https://web.dev/articles/vitals", soort: "platform" } as const;
const WEB_LCP = { naam: "web.dev (Google), Largest Contentful Paint", url: "https://web.dev/articles/lcp", soort: "platform" } as const;
const WEB_INP = { naam: "web.dev (Google), Interaction to Next Paint", url: "https://web.dev/articles/inp", soort: "platform" } as const;
const WEB_CLS = { naam: "web.dev (Google), Cumulative Layout Shift", url: "https://web.dev/articles/cls", soort: "platform" } as const;
const GOOGLE_ONDERBREKING = { naam: "Google Search Central, Interstitials and dialogs", url: "https://developers.google.com/search/docs/appearance/avoid-intrusive-interstitials", soort: "platform" } as const;
const NNG_HEURISTIEKEN = { naam: "Nielsen Norman Group, 10 Usability Heuristics", url: "https://www.nngroup.com/articles/ten-usability-heuristics/", soort: "vakinstituut" } as const;
const WCAG_DOELMAAT = { naam: "W3C, WCAG 2.2 SC 2.5.8 Target Size (Minimum)", url: "https://www.w3.org/TR/WCAG22/#target-size-minimum", soort: "norm" } as const;
const WCAG_TOETSENBORD = { naam: "W3C, WCAG 2.2 SC 2.1.1 Keyboard", url: "https://www.w3.org/TR/WCAG22/#keyboard", soort: "norm" } as const;
const WCAG_FOCUS = { naam: "W3C, WCAG 2.2 SC 2.4.7 Focus Visible", url: "https://www.w3.org/TR/WCAG22/#focus-visible", soort: "norm" } as const;
const WCAG_BEWEGING = { naam: "W3C, WCAG 2.2 SC 2.2.2 Pause, Stop, Hide", url: "https://www.w3.org/TR/WCAG22/#pause-stop-hide", soort: "norm" } as const;

export const INTERACTIE: Criterium[] = [
  {
    id: "INT-01",
    discipline: "interactie",
    titel: "Het grootste element staat er binnen 2,5 seconde",
    waarNaarKijken:
      "De Largest Contentful Paint van de pagina, gemeten bij echte bezoekers. Goed is 2,5 " +
      "seconde of sneller bij 75 van de 100 bezoeken, apart geteld voor mobiel en desktop.",
    waarom:
      "Dit is het moment waarop iemand ziet dat er iets staat in plaats van dat er iets komt. " +
      "Blijft de pagina langer leeg, dan haakt een deel af voordat de inhoud er is.",
    bewijs: "sterk",
    bronnen: [WEB_LCP, WEB_VITALS],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "meting",
    nuance:
      "Meet in het veld, niet alleen in de proefopstelling. Een test op een snelle verbinding " +
      "zegt weinig over een telefoon op 4G.",
  },
  {
    id: "INT-02",
    discipline: "interactie",
    titel: "Een klik of tik geeft binnen 200 milliseconden beeld",
    waarNaarKijken:
      "De Interaction to Next Paint: hoe lang het duurt voordat er iets op het scherm verandert " +
      "nadat je iets aanraakt. Goed is 200 milliseconden of minder.",
    waarom:
      "Onder die grens voelt een pagina als direct. Erboven ga je twijfelen of je klik is " +
      "aangekomen, en dan klikken mensen nog een keer, of ze stoppen.",
    bewijs: "sterk",
    bronnen: [WEB_INP, WEB_VITALS],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "meting",
  },
  {
    id: "INT-03",
    discipline: "interactie",
    titel: "De pagina springt niet onder je vinger weg",
    waarNaarKijken:
      "De Cumulative Layout Shift, goed is 0,1 of lager. In de praktijk: afbeeldingen zonder " +
      "vaste maat, later ingeladen banners, lettertypen die de tekst verspringen, en de " +
      "cookiemelding.",
    waarom:
      "Verschuivende inhoud laat mensen op het verkeerde ding klikken en de plek kwijtraken waar " +
      "ze aan het lezen waren. Het is bovendien de storing die het meest wordt onthouden.",
    bewijs: "sterk",
    bronnen: [WEB_CLS, WEB_VITALS],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "meting",
  },
  {
    id: "INT-04",
    discipline: "interactie",
    titel: "Iets aantikken lukt in één keer",
    waarNaarKijken:
      "De maat van knoppen, links in een menu en pictogrammen: minstens 24 bij 24 pixels, of " +
      "genoeg ruimte eromheen. Vooral rijen kleine icoontjes en links dicht op elkaar vallen hier " +
      "door de mand.",
    waarom:
      "Doelen die te klein of te dicht op elkaar staan, raak je mis. Dat treft iedereen met minder " +
      "fijne motoriek, en iedereen die zijn telefoon met één hand bedient.",
    bewijs: "sterk",
    bronnen: [WCAG_DOELMAAT],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "meting",
    nuance:
      "24 pixels is de ondergrens van de norm, geen streefwaarde. Apple houdt 44 punt aan en " +
      "Google 48 dichtheidspunten; op een echte telefoon voelt dat verschil je meteen.",
  },
  {
    id: "INT-05",
    discipline: "interactie",
    titel: "Geen scherm dat de inhoud afdekt bij binnenkomst",
    waarNaarKijken:
      "Wat er over de pagina heen komt in de eerste seconden: cookiemelding, nieuwsbriefvenster, " +
      "kortingswiel, chatvenster dat vanzelf opengaat, app-banner. Kijk vooral op mobiel, daar " +
      "dekken ze meestal alles af.",
    waarom:
      "Google noemt dit expliciet schadelijk voor zowel bezoeker als vindbaarheid: wie eerst iets " +
      "moet wegklikken, ziet de inhoud niet waarvoor hij kwam. Bij ons eigen meetwerk dekte een " +
      "cookiemelding zelfs de meting af, en dat is precies wat een bezoeker ook overkomt.",
    bewijs: "sterk",
    bronnen: [GOOGLE_ONDERBREKING],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "beeld",
    nuance:
      "Een cookiemelding of leeftijdscontrole die wettelijk moet, mag. De vorm blijft een keuze: " +
      "een balk die niet alles afdekt kan ook.",
  },
  {
    id: "INT-06",
    discipline: "interactie",
    titel: "Alles gaat ook met het toetsenbord, en je ziet waar je bent",
    waarNaarKijken:
      "Loop met de tab-toets door de pagina: kom je bij elke link, knop en veld, kun je een menu " +
      "en een venster openen en sluiten, en is er steeds een duidelijk kader te zien om waar je " +
      "staat?",
    waarom:
      "Wie geen muis kan gebruiken, komt anders nergens. En een onzichtbare focus maakt een " +
      "pagina ook voor snelle toetsenbordgebruikers een gokspel.",
    bewijs: "sterk",
    bronnen: [WCAG_TOETSENBORD, WCAG_FOCUS],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "oordeel",
  },
  {
    id: "INT-07",
    discipline: "interactie",
    titel: "Beweging kun je stoppen",
    waarNaarKijken:
      "Draaiende koppenblokken (sliders), lopende teksten, video die vanzelf start, animaties bij " +
      "het scrollen. Is er een pauzeknop, en respecteert de site de instelling voor minder " +
      "beweging?",
    waarom:
      "Beweging die je niet kunt stoppen, trekt de aandacht weg van de tekst ernaast en maakt " +
      "lezen voor sommige mensen onmogelijk. Bij een draaiende slider ziet bovendien bijna " +
      "niemand de tweede dia.",
    bewijs: "sterk",
    bronnen: [WCAG_BEWEGING],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "oordeel",
  },
  {
    id: "INT-08",
    discipline: "interactie",
    titel: "Na een handeling gebeurt er zichtbaar iets",
    waarNaarKijken:
      "Wat er gebeurt na het versturen van een formulier, het toevoegen aan een winkelmandje of " +
      "het openen van een filter: verschijnt er een bevestiging, een laadteken, een verandering?",
    waarom:
      "De eerste vuistregel van Nielsen: laat zien wat de status is. Zonder terugkoppeling weet " +
      "iemand niet of het gelukt is, en verstuurt hij het formulier nog een keer of gaat hij weg.",
    bewijs: "sterk",
    bronnen: [NNG_HEURISTIEKEN],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "oordeel",
  },
];
