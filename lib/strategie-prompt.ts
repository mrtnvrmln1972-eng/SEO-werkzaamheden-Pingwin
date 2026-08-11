// De kant-en-klare opdracht achter "Vat samen & leg strategie vast". Eén bron
// voor beide plekken waar die knop staat (de pagina-chat in Pagina's en de
// kaart-chat in de planning), zodat de samenvatting overal hetzelfde vraagt.
// Consolideert het hele gesprek tot één definitieve conclusie/strategie, die via
// het bestaande voorstel-mechanisme als plan voor de pagina overgenomen wordt.
export const SUMMARIZE_PROMPT =
  "Vat ons hele gesprek over deze pagina samen tot één definitieve conclusie en strategie, gegrond op wat we hierboven hebben besproken en de live feiten. Dit is de eindconclusie die ik als plan voor deze pagina wil overnemen, dus stel geen nieuwe vragen meer. Geef scherp en uitvoerbaar: de rol en het doel van de pagina in één zin; het primaire en secundaire zoekwoord (met de onderbouwing die we bespraken, zoals volume en zoekintentie); en de concrete acties, elk met de fase (Bouwen/Herbedraden/Opschonen) en of het SEO- of Dev-werk is. Sluit af met de doel-URL.";
