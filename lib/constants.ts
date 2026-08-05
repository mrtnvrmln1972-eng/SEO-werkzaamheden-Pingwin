// Gedeelde constanten, bruikbaar in zowel Node- als Edge-runtime
// (geen crypto-import, zodat de middleware op de Edge blijft werken).
export const SESSION_COOKIE = "client_session";
export const ADMIN_COOKIE = "admin_session";
// Kijk-als-modus: de eigenaar bekijkt het dashboard tijdelijk als een gast.
export const ADMIN_VIEWAS_COOKIE = "admin_viewas";

// Pseudo-URL waaronder de klant-brede Drive-map wordt opgeslagen in
// page_drive_folders (die tabel heeft altijd een url nodig). Stond eerder los in
// lib/client-profile-gen.ts én nog eens hardgecodeerd in PagesPanel.tsx, met een
// comment dat ze gelijk moesten blijven; dat is precies het soort afspraak dat
// een keer misgaat.
export const CLIENT_FOLDER_KEY = "__client_profile__";

// Vanaf deze score mag een mail als feit genoemd worden bij een pagina; daaronder
// is het een voorstel ("mogelijk relevant"). Staat hier en niet in page-emails.ts
// omdat het scherm hem ook nodig heeft: de kaart mag geen waarschuwing geven over
// mails die de samenvatting per definitie nooit gebruikt. Dat gebeurde wel, en
// leverde een melding op die niet weg te krijgen was.
export const HARD_BEWIJS = 3;
