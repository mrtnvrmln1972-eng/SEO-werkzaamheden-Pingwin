// Eén bron voor de tips om het verbruik strak te houden, per meter. Zonder deze
// ene lijst zouden het verbruikscherm en de drie tellers in de kopbalk elk hun
// eigen versie krijgen, en dat loopt gegarandeerd uit elkaar (zie de les over
// botsende chats in globals.css).
export type VerbruikTip = { kop: string; tekst: string };

export const AHREFS_TIPS: VerbruikTip[] = [
  { kop: "Dezelfde vraag kost één keer", tekst: "Zoekvolumes en top-10's worden bewaard (een maand, een kwartaal). Een analyse opnieuw openen kost dus niets; een nieuwe scan starten wel." },
  { kop: "Nieuwe klanten in golven", tekst: "Een hele site in één keer inlezen is de duurste knop die er is. De bulk-onboarding doet het daarom in golven; laat die volgorde staan." },
  { kop: "Kijk wie de teller laat lopen", tekst: "Werk je zelf in Ahrefs, dan telt dat op dezelfde meter. Staat het dashboard laag en de meter hoog, dan helpt afremmen hier niets." },
];

export const DASHBOARD_TIPS: VerbruikTip[] = [
  { kop: "Diepe documenten doseren", tekst: "Een diepe analyse of blauwdruk is tien tot twintig keer een gewone vraag. Prima voor een pagina die ertoe doet, zonde voor een verkenning." },
  { kop: "Licht werk gaat al naar een licht model", tekst: "Labels, korte extracties en losse correcties draaien op het goedkope model. Ga daar niet omheen door alles via de chat te vragen." },
  { kop: "Eén onderwerp per gesprek", tekst: "Een gesprek draagt zijn hele geschiedenis mee bij elke vraag. Een nieuwe chat voor een nieuw onderwerp is goedkoper dan doorgaan in een lange." },
];

export const ABO_TIPS: VerbruikTip[] = [
  { kop: "Kijk eerst wélke meter vol is", tekst: "In Claude Code toont /usage twee dingen: je plan-limiet (per vijf uur en per week) en je tegoed. Staat de weeklimiet op 100%, dan betaal je álles tot de reset uit je tegoed, ook werk dat gisteren gratis was." },
  { kop: "Bouwvraag of strategievraag", tekst: "Staat de aanpak al vast en is het uitvoeren (bouwen, opmaken, een vaste analyse volgens de methode), dan Sonnet. Moet er een afweging gemaakt worden die geld of een beslissing kost (cannibalisatie, prioriteit, een roadmapkeuze), dan Opus. Dit is de grootste knop die er is." },
  { kop: "Nieuwe klus, nieuwe chat", tekst: "Zodra je op tegoed werkt, wordt het geheugen van een gesprek na vijf minuten stilte niet meer goedkoop hergebruikt (op je abonnement is dat een uur). Elke vraag daarna betaalt de hele geschiedenis opnieuw." },
  { kop: "Niet zes chats tegelijk laten sudderen", tekst: "Elke lopende chat draagt zijn eigen geschiedenis mee. Werk je in zes chats door elkaar, dan betaal je zes keer een geschiedenis in plaats van één. Rond af wat af is." },
  { kop: "Zet een uitgavenlimiet", tekst: "Op claude.ai kun je een grens per maand zetten op het tegoed. Dan kan het niet meer stilletjes doorlopen; je krijgt een melding in plaats van een verrassing." },
  { kop: "Vraag gericht", tekst: "\"Kijk de hele site na\" laat alles lezen. \"Kijk deze pagina na op deze drie punten\" kost een fractie en geeft een beter antwoord." },
];
