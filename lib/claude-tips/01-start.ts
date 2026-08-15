import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  titel: "Voor je een nieuwe chat start",
  waarvoor: "Wat je aanhaakt en hoe je een chat opknipt, bepaalt de helft van de snelheid.",
  tips: [
    {
      titel: "Welke repo's aanhaken",
      tekst:
        "pingwin-brein hoort er altijd bij: dat is het geheugen. Daarnaast de repo waar het werk in landt: "
        + "noc-seo-dashboard voor de SEO/AEO-cockpit van Nationaal Oogcentrum, SEO-werkzaamheden-Pingwin voor "
        + "Pingwins eigen beheer (dit scherm, agenda, financiën, klanten), of de repo van een andere klant. "
        + "Twijfel je, laat Claude het zelf opzoeken; nooit gokken op de naam.",
    },
    {
      titel: "Eén onderwerp per chat",
      tekst:
        "Wissel je van onderwerp, begin dan een nieuwe chat, ook als de vorige nog kort is. Oude context maakt "
        + "antwoorden niet beter maar slechter, en kost bij elke vraag opnieuw geld.",
    },
    {
      titel: "Kom je een dag later terug op dezelfde chat?",
      tekst:
        "Begin dan liever een nieuwe. De cache van het gesprek is dan al verlopen en elke vraag betaalt de hele "
        + "geschiedenis opnieuw, zonder dat je dat aan de reactietijd merkt.",
    },
    {
      titel: "Maximaal twee chats tegelijk per repo",
      tekst:
        "Dit is geen kostenregel maar een botsregel. Bijna elk \"dit brak ineens\"-incident kwam doordat er drie "
        + "chats tegelijk in dezelfde bestanden schreven, niet doordat er iets niet begrepen werd.",
    },
  ],
};
