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
  { kop: "Model naar de klus", tekst: "Sonnet voor bouwen, opmaken, teksten en een vaste analyse volgens de methode. Opus voor een afweging die geld of een beslissing kost (cannibalisatie, prioriteit, een roadmapkeuze). Fable alleen als je er zelf om vraagt, dat is ruwweg vijf keer zo duur als Sonnet. Twijfel je? Begin licht: opschalen kost niets, terugdraaien wel." },
  { kop: "Hoe lang een chat openstaat telt niet, hoe lang je pauzeert wel", tekst: "Het venster om goedkoop door te werken is een uur binnen je abonnement en vijf minuten op tegoed. Geen deadline om de chat te sluiten: blijf je aaneengesloten bezig, dan blijft de geschiedenis goedkoop hergebruikt, ook uren lang. Pauzeer je langer dan dat venster, dan is dat voordeel weg en betaalt de eerstvolgende vraag de hele geschiedenis opnieuw, alsof je van nul begint." },
  { kop: "Eén goed uitgewerkte vraag wint van veel losse opmerkingen", tekst: "Losse opmerkingen achter elkaar gooien mag, zolang je aaneengesloten doorwerkt; dat maakt de cache niet stuk. Maar elke beurt stuurt de hele geschiedenis tot dan toe opnieuw mee, dus vijf korte beurten kosten samen altijd meer dan één doordachte prompt die hetzelfde in één keer regelt." },
  { kop: "Nieuwe klus, nieuwe chat", tekst: "Wisselt het onderwerp, of sta je op het dubbele van waar de chat begon? Dan is een nieuwe chat voordeliger dan doorgaan in de oude, ook al voelt de oude nog fris aan." },
  { kop: "Rond af met /bijwerken", tekst: "Klaar met een klus? Typ /bijwerken. Dat legt vast waar je gebleven bent én levert meteen de startprompt voor de volgende chat, zodat je nooit zelf hoeft te onthouden of uit te typen waar het over ging." },
  { kop: "Niet zes chats tegelijk laten sudderen", tekst: "Elke lopende chat draagt zijn eigen geschiedenis mee. Werk je in zes chats door elkaar, dan betaal je zes keer een geschiedenis in plaats van één. Rond af wat af is." },
  { kop: "Zet een uitgavenlimiet", tekst: "Op claude.ai kun je een grens per maand zetten op het tegoed. Dan kan het niet meer stilletjes doorlopen; je krijgt een melding in plaats van een verrassing." },
  { kop: "Vraag gericht", tekst: "\"Kijk de hele site na\" laat alles lezen. \"Kijk deze pagina na op deze drie punten\" kost een fractie en geeft een beter antwoord." },
];
