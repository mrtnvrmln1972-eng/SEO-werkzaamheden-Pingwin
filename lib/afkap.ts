// ═══════════════════════════════════════════════════════════
// AFKAPPEN VOOR DE SERVER HET DOET
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: een chat-vraag mag op Vercel 300 seconden duren. Loopt hij
// daaroverheen, dan hakt het platform de functie om en krijgt de browser geen
// JSON maar een foutpagina terug. In het dashboard klapte `r.json()` daar stil op
// stuk: geen antwoord, geen melding, alsof de vraag genegeerd werd. Dat is op
// 11 augustus 2026 in beeld gekomen bij een kaart-chat van One Day Clinic.
//
// De oplossing is dat wíj afkappen, net iets eerder dan het platform. Dan is het
// laatste woord van dit dashboard altijd een net antwoord in JSON, ook als het
// een teleurstellend antwoord is. Een uitleg die je kunt lezen is beter dan een
// scherm dat niets doet.
//
// Let op: het werk dat te lang duurt gaat op de achtergrond gewoon door tot de
// functie eindigt. We wachten er alleen niet meer op.

export async function metAfkap<T>(werk: Promise<T>, ms: number, bijAfkap: T): Promise<T> {
  let klok: ReturnType<typeof setTimeout> | undefined;
  const wekker = new Promise<T>((res) => { klok = setTimeout(() => res(bijAfkap), ms); });
  try {
    return await Promise.race([werk, wekker]);
  } finally {
    if (klok) clearTimeout(klok);
  }
}

// De grens die alle chat-eindpunten aanhouden: ruim binnen de 300 seconden die de
// route mag duren, met genoeg lucht om het antwoord nog te versturen.
export const CHAT_AFKAP_MS = 280_000;

export const CHAT_AFKAP_TEKST =
  "Deze vraag duurde te lang en is na bijna vijf minuten afgebroken. Dat ligt niet aan je vraag zelf, maar aan hoeveel er voor beantwoording opgezocht moest worden. Splits hem in twee kleinere vragen of maak hem gerichter (één pagina of één keuze tegelijk) en stel hem opnieuw.";
