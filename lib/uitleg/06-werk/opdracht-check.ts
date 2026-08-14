import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Opdrachten in deze kaart: met één klik checken",
    kern: "Elke losse instructie op een kaart heeft nu een eigen vinkje en, waar mogelijk, een live-check.",
    tekst:
      "Niet elke kaart gaat langs alle zeven fases. Soms staat er gewoon één losse instructie in het blok " +
      "\"Opdrachten in deze kaart\", zoals \"redirect loskoppelen\" of \"bouw /hovenier/ als overkoepelende " +
      "parent-pagina\", vaak doorgezet naar de developer per mail. Tot 14 augustus 2026 kon je zo'n regel " +
      "alleen zelf onthouden of hij was doorgevoerd; er stond geen vinkje bij, alleen bij de zeven fases.\n\n" +
      "**Elke opdrachtregel heeft nu twee knoppen.** \"Check live\" haalt de pagina('s) die in de opdracht " +
      "genoemd worden opnieuw op en meldt of ze bereikbaar zijn, precies zoals \"Controleer live\" dat al deed " +
      "voor structured data. Een vinkje ernaast is er voor de instructies die geen dashboard kan meten (een " +
      "losse mail naar de developer): daar zet je zelf op klaar zodra je het gecontroleerd hebt.\n\n" +
      "**Automatisch checken is eerlijk over wat het wel en niet bewijst.** Staat er een pad in de opdracht " +
      "(\"/hovenier-oss/\"), dan bevestigt de check dat die pagina live en bereikbaar is, niet dat de " +
      "instructie inhoudelijk klopt (bijvoorbeeld dat de parent-structuur goed staat). Staat er geen URL in de " +
      "tekst, dan zegt de melding dat expliciet, in plaats van een vinkje te gokken: \"geen specifieke URL " +
      "gevonden om automatisch te toetsen, bekijk de live pagina zelf.\" Dan blijft het handmatige vinkje over.",
  },
];
