// Plank 1, discipline CONVERSIE: levert de pagina klanten op?
//
// Alles hier is onderbouwd en heeft een bron met een datum. Wat wij vinden
// zonder bron staat in `vakoordeel.ts` en nergens anders. Zie `types.ts` voor
// waarom die scheiding hard is.

import type { Criterium } from "./types";

// De vaste bronnen van deze discipline, één keer benoemd. Twee keer hetzelfde
// adres uitschrijven is twee plekken die uit elkaar gaan lopen.
const BAYMARD_VELDEN = { naam: "Baymard Institute, Checkout Optimization: Minimize Form Fields", url: "https://baymard.com/blog/checkout-flow-average-form-fields", soort: "vakinstituut" } as const;
const BAYMARD_VERPLICHT = { naam: "Baymard Institute, mark required and optional fields", url: "https://baymard.com/blog/required-optional-form-fields", soort: "vakinstituut" } as const;
const BAYMARD_AFHAKEN = { naam: "Baymard Institute, cart abandonment rate statistics", url: "https://baymard.com/lists/cart-abandonment-rate", soort: "vakinstituut" } as const;
const NNG_HEURISTIEKEN = { naam: "Nielsen Norman Group, 10 Usability Heuristics", url: "https://www.nngroup.com/articles/ten-usability-heuristics/", soort: "vakinstituut" } as const;
const NNG_VOUW = { naam: "Nielsen Norman Group, Scrolling and Attention", url: "https://www.nngroup.com/articles/scrolling-and-attention/", soort: "onderzoek" } as const;
const SPIEGEL = { naam: "Medill Spiegel Research Center, How Online Reviews Influence Sales", url: "https://spiegel.medill.northwestern.edu/how-online-reviews-influence-sales/", soort: "onderzoek" } as const;
const DELOITTE = { naam: "Deloitte, Milliseconds Make Millions (via web.dev)", url: "https://web.dev/case-studies/milliseconds-make-millions", soort: "onderzoek" } as const;

export const CONVERSIE: Criterium[] = [
  {
    id: "CONV-01",
    discipline: "conversie",
    titel: "Eén dominante actie per pagina",
    waarNaarKijken:
      "Welke actie wil deze pagina dat je doet, en is die actie visueel de belangrijkste? " +
      "Meerdere knoppen die om dezelfde aandacht vragen (bellen, aanvragen, offerte, nieuwsbrief, " +
      "downloaden) betekenen dat de pagina zelf niet weet wat hij wil.",
    waarom:
      "Concurrerende acties laten de bezoeker kiezen in plaats van doen. Eén gewenste actie, " +
      "secundaire acties zichtbaar maar ondergeschikt.",
    bewijs: "gemiddeld",
    bronnen: [NNG_HEURISTIEKEN],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "beeld",
    nuance:
      "Een lange pagina mag dezelfde actie herhalen. Dat is geen tweede actie, dat is dezelfde " +
      "actie op het moment dat iemand er klaar voor is.",
  },
  {
    id: "CONV-02",
    discipline: "conversie",
    titel: "De belofte en de actie staan in de eerste schermvulling",
    waarNaarKijken:
      "Staat er zonder scrollen wat je hier kunt krijgen, voor wie het is, en wat de volgende " +
      "stap is? Zowel op desktop als op mobiel, want dat verschilt sterk.",
    waarom:
      "Bezoekers besteden ongeveer 57% van hun kijktijd aan wat er zonder scrollen staat, en 74% " +
      "aan de eerste twee schermvullingen. Wat daar niet staat, wordt door de meesten niet gezien.",
    bewijs: "sterk",
    bronnen: [NNG_VOUW],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "beeld",
    nuance:
      "Niet alles moet boven de vouw. Het gaat om de belofte en de weg vooruit, niet om de hele " +
      "inhoud omhoog duwen.",
  },
  {
    id: "CONV-03",
    discipline: "conversie",
    titel: "Zichtbaar bewijs bij de actie",
    waarNaarKijken:
      "Staan er echte reviews, cases, cijfers of namen in de buurt van de knop, met herkomst? " +
      "Niet onderaan de pagina, maar waar de beslissing valt.",
    waarom:
      "In het onderzoek van Spiegel ligt de koopkans bij een product met vijf reviews 270% hoger " +
      "dan zonder reviews, met de grootste winst bij duurdere aankopen. Na ongeveer vijf reviews " +
      "vlakt de winst af, en een score tussen 4,0 en 4,7 doet het beter dan een perfecte 5,0.",
    bewijs: "sterk",
    bronnen: [SPIEGEL],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "beeld",
    nuance:
      "Het bewijs moet echt en na te trekken zijn. Een citaat zonder naam of bron doet minder dan " +
      "geen citaat, want het roept twijfel op over de rest.",
  },
  {
    id: "CONV-04",
    discipline: "conversie",
    titel: "Zo min mogelijk velden in het formulier",
    waarNaarKijken:
      "Tel de velden die iemand moet invullen. Vraag per veld: gebruiken we dit echt, of vragen " +
      "we het omdat het kan?",
    waarom:
      "Baymard meet gemiddeld 11,3 velden in een afrekenstroom terwijl er voor de meeste sites " +
      "acht genoeg zijn. Wat telt is het aantal velden dat iemand moet overwegen, niet het aantal " +
      "stappen; 22% haakt af op een te ingewikkeld proces.",
    bewijs: "sterk",
    bronnen: [BAYMARD_VELDEN, BAYMARD_AFHAKEN],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "meting",
    nuance:
      "Een extra veld kan de kwaliteit van een aanvraag verhogen. Dat is een afweging tussen " +
      "aantal en kwaliteit, geen vrijbrief.",
  },
  {
    id: "CONV-05",
    discipline: "conversie",
    titel: "Verplicht en optioneel staan er allebei bij",
    waarNaarKijken:
      "Is per veld te zien of het moet of mag? Alleen sterretjes bij de verplichte velden is de " +
      "halve oplossing; wie de legenda mist, weet nog niets.",
    waarom:
      "Baymard vond dat slechts 14% van de onderzochte sites beide markeert. Onduidelijkheid " +
      "hierover kost invulfouten en afhakers precies op het moment dat iemand al wilde.",
    bewijs: "gemiddeld",
    bronnen: [BAYMARD_VERPLICHT],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "meting",
  },
  {
    id: "CONV-06",
    discipline: "conversie",
    titel: "Geen verrassingen vlak voor de finish",
    waarNaarKijken:
      "Komen prijs, verzendkosten, levertijd, voorwaarden of een verplicht account pas in de " +
      "laatste stap in beeld? Bij een dienst: wordt duidelijk wat er ná het aanvragen gebeurt?",
    waarom:
      "Onverwachte extra kosten staan al jaren bovenaan de redenen om een bestelling af te breken. " +
      "Wie eerst investeert en dan pas het volledige plaatje ziet, voelt zich beetgenomen en komt " +
      "niet terug.",
    bewijs: "sterk",
    bronnen: [BAYMARD_AFHAKEN],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "oordeel",
  },
  {
    id: "CONV-07",
    discipline: "conversie",
    titel: "Snelheid is geen techniek maar omzet",
    waarNaarKijken:
      "De gemeten laadtijd van de pagina, en of de bezoeker binnen die tijd al iets zinnigs ziet. " +
      "De cijfers zelf staan in INT-01 tot INT-03.",
    waarom:
      "Deloitte mat over 30 miljoen sessies dat 0,1 seconde sneller op mobiel 8,4% meer conversie " +
      "in retail oplevert en 10,1% in reizen, plus een hogere orderwaarde. Snelheid werkt door in " +
      "elke stap van de reis, niet alleen in de eerste.",
    bewijs: "sterk",
    bronnen: [DELOITTE],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "meting",
    nuance:
      "De gemeten winst komt uit webshops en reisaanbieders. Bij een dienstverlener met weinig " +
      "bezoekers is het effect kleiner en moeilijker aan te tonen, de richting blijft dezelfde.",
  },
];
