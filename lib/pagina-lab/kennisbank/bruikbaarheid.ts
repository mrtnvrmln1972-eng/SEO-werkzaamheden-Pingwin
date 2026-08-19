// Plank 1, discipline BRUIKBAARHEID: kan iedereen deze pagina gebruiken?
//
// Veel van deze criteria komen uit WCAG 2.2, de toegankelijkheidsnorm van het
// W3C. Dat is bewust: een norm is de hardste bron die er is, hij is na te
// rekenen, en hij veroudert niet per kwartaal. Toegankelijkheid en gewone
// bruikbaarheid lopen hier door elkaar, en dat is geen slordigheid: wat een
// pagina bruikbaar maakt voor iemand met een beperking, maakt hem ook
// bruikbaar voor iemand in de zon, op een telefoon, met haast.

import type { Criterium } from "./types";

const WCAG = (anker: string, naam: string) => ({ naam: `W3C, WCAG 2.2 ${naam}`, url: `https://www.w3.org/TR/WCAG22/#${anker}`, soort: "norm" as const });

const WCAG_CONTRAST_UITLEG = { naam: "W3C, Understanding SC 1.4.3 Contrast (Minimum)", url: "https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum", soort: "norm" } as const;
const BAYMARD_REGELLENGTE = { naam: "Baymard Institute, Readability: The Optimal Line Length", url: "https://baymard.com/blog/line-length-readability", soort: "vakinstituut" } as const;
const NNG_HEURISTIEKEN = { naam: "Nielsen Norman Group, 10 Usability Heuristics", url: "https://www.nngroup.com/articles/ten-usability-heuristics/", soort: "vakinstituut" } as const;
const NNG_OOGMETING = { naam: "Nielsen Norman Group, onderzoek met oogmeting", url: "https://www.nngroup.com/topic/eyetracking/", soort: "onderzoek" } as const;

export const BRUIKBAARHEID: Criterium[] = [
  {
    id: "BRUIK-01",
    discipline: "bruikbaarheid",
    titel: "Tekst heeft genoeg contrast met zijn achtergrond",
    waarNaarKijken:
      "De verhouding tussen tekstkleur en achtergrond: minstens 4,5 op 1 voor gewone tekst, en " +
      "3 op 1 voor grote tekst (vanaf 18 punt, of 14 punt vet). Let vooral op lichtgrijze tekst, " +
      "tekst over een foto, en tekst in een gekleurde knop.",
    waarom:
      "Onder die verhouding wordt tekst onleesbaar voor mensen met matig slecht zicht, en lastig " +
      "voor iedereen op een telefoon in de zon. Het is bovendien de meest gemaakte fout die met " +
      "een meting is aan te tonen.",
    bewijs: "sterk",
    bronnen: [WCAG_CONTRAST_UITLEG, WCAG("contrast-minimum", "SC 1.4.3")],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "meting",
    nuance:
      "Een logo en tekst in een uitgeschakelde knop vallen buiten de eis. Dat is een uitzondering " +
      "in de norm, geen reden om de rest te laten lopen.",
  },
  {
    id: "BRUIK-02",
    discipline: "bruikbaarheid",
    titel: "Leesbare regellengte en tekstgrootte",
    waarNaarKijken:
      "Hoeveel tekens er op een regel lopende tekst staan (streef naar 50 tot 75, en blijf onder " +
      "de 80) en hoe groot de lichaamstekst is (16 pixels of meer).",
    waarom:
      "Te lange regels maken het moeilijk om de volgende regel terug te vinden, te korte regels " +
      "breken het leesritme. Beide kosten leestempo en begrip, en op een breed scherm zonder " +
      "maximale leesbreedte gebeurt het eerste vanzelf.",
    bewijs: "gemiddeld",
    bronnen: [BAYMARD_REGELLENGTE],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "meting",
  },
  {
    id: "BRUIK-03",
    discipline: "bruikbaarheid",
    titel: "De pagina is te scannen: koppen dekken wat eronder staat",
    waarNaarKijken:
      "Kun je alleen de koppen lezen en dan weten waar de pagina over gaat? Slaan de koppen op de " +
      "tekst eronder, of zijn het slogans? Staan de alinea's in korte blokken?",
    waarom:
      "Mensen lezen een webpagina niet van boven naar beneden, ze scannen hem in een grillig " +
      "patroon en pikken de vetgedrukte woorden en koppen eruit. Een pagina die alleen werkt als " +
      "je hem helemaal leest, werkt voor bijna niemand.",
    bewijs: "sterk",
    bronnen: [NNG_OOGMETING, NNG_HEURISTIEKEN],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "oordeel",
  },
  {
    id: "BRUIK-04",
    discipline: "bruikbaarheid",
    titel: "Elk invulveld heeft een zichtbaar label",
    waarNaarKijken:
      "Staat er boven of naast het veld wat er in moet, en blijft dat staan tijdens het typen? " +
      "Een grijze tekst ín het veld (een placeholder) telt niet als label.",
    waarom:
      "Een placeholder verdwijnt zodra je begint te typen. Wie dan wordt afgeleid, weet niet meer " +
      "wat het veld was, en bij een foutmelding is er niets meer om naar terug te kijken.",
    bewijs: "sterk",
    bronnen: [WCAG("labels-or-instructions", "SC 3.3.2 Labels or Instructions"), NNG_HEURISTIEKEN],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "meting",
  },
  {
    id: "BRUIK-05",
    discipline: "bruikbaarheid",
    titel: "Foutmeldingen zeggen wat er mis is en hoe je het oplost",
    waarNaarKijken:
      "Wat gebeurt er bij een leeg verplicht veld of een verkeerd formaat? Wijst de melding het " +
      "veld aan, staat hij er in gewone taal bij, en zegt hij wat er wél moet?",
    waarom:
      "Een rode rand zonder tekst laat iemand raden. Een melding die het probleem benoemt én de " +
      "oplossing geeft, is het verschil tussen een correctie en een afhaker.",
    bewijs: "sterk",
    bronnen: [
      WCAG("error-identification", "SC 3.3.1 Error Identification"),
      WCAG("error-suggestion", "SC 3.3.3 Error Suggestion"),
      NNG_HEURISTIEKEN,
    ],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "oordeel",
  },
  {
    id: "BRUIK-06",
    discipline: "bruikbaarheid",
    titel: "De pagina past op een smal scherm zonder heen en weer schuiven",
    waarNaarKijken:
      "Blijft alles leesbaar en bedienbaar op een breedte van 320 pixels, zonder horizontaal te " +
      "moeten schuiven? Let op brede tabellen, vaste breedtes en grote afbeeldingen.",
    waarom:
      "Horizontaal schuiven om een zin uit te lezen is voor de meeste mensen genoeg reden om weg " +
      "te gaan, en het treft juist het verkeer dat het grootst is: telefoons.",
    bewijs: "sterk",
    bronnen: [WCAG("reflow", "SC 1.4.10 Reflow")],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "hoog",
    vaststellen: "beeld",
    nuance:
      "De norm laat twee richtingen toe voor inhoud die dat echt nodig heeft, zoals een landkaart " +
      "of een grote tabel.",
  },
  {
    id: "BRUIK-07",
    discipline: "bruikbaarheid",
    titel: "Tekst blijft werken als iemand hem groter zet",
    waarNaarKijken:
      "Zet de tekst op 200% en kijk of er iets wegvalt, over elkaar heen komt of onbereikbaar " +
      "wordt. Vaste hoogtes en tekst in knoppen breken hier het eerst.",
    waarom:
      "Vergroten is voor slechtziende bezoekers de gewone manier van lezen. Breekt de pagina " +
      "daarbij, dan is hij voor die groep niet stuk gegaan maar nooit bruikbaar geweest.",
    bewijs: "sterk",
    bronnen: [WCAG("resize-text", "SC 1.4.4 Resize Text")],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "meting",
  },
  {
    id: "BRUIK-08",
    discipline: "bruikbaarheid",
    titel: "Een link zegt zelf waar hij heen gaat",
    waarNaarKijken:
      "Losse teksten als 'lees meer', 'klik hier' en 'meer informatie'. Snap je uit de link alleen " +
      "waar je terechtkomt?",
    waarom:
      "Wie scant, leest de links en niet de zin eromheen; wie een schermlezer gebruikt, krijgt " +
      "vaak een lijst van alleen de links. Tien keer 'lees meer' is dan tien keer niets.",
    bewijs: "sterk",
    bronnen: [WCAG("link-purpose-in-context", "SC 2.4.4 Link Purpose (In Context)"), NNG_HEURISTIEKEN],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "meting",
  },
  {
    id: "BRUIK-09",
    discipline: "bruikbaarheid",
    titel: "Velden met persoonsgegevens laten zich automatisch invullen",
    waarNaarKijken:
      "Hebben naam, adres, mailadres en telefoonnummer het juiste doel meegekregen in de code " +
      "(het autocomplete-kenmerk), zodat de browser ze zelf kan invullen?",
    waarom:
      "Automatisch invullen scheelt tikwerk en fouten, en het is voor mensen met een motorische " +
      "of cognitieve beperking het verschil tussen een formulier dat lukt en een dat niet lukt.",
    bewijs: "sterk",
    bronnen: [WCAG("identify-input-purpose", "SC 1.3.5 Identify Input Purpose")],
    gecheckt: "2026-08-19",
    stand: "actueel",
    weegt: "midden",
    vaststellen: "meting",
  },
];
