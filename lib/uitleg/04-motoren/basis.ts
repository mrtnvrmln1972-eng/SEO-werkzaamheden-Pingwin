import type { Uitklapper } from "../types";

// De meetlaag en de paginascore: wat er werkelijk op de pagina staat.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "De meetlaag: staat het er echt op?",
    kern: "Geen model bepaalt of iets gedaan is. Dat wordt gemeten, met bewijs.",
    tekst:
      "Alles begint hier. Van elke pagina wordt uit de live HTML gehaald wat er werkelijk staat, en elke " +
      "uitkomst draagt zijn eigen bewijs mee: de gevonden ankertekst, het gevonden pad, op hoeveel pagina's " +
      "iets voorkomt.\n\n" +
      "Waarom dit zo streng gescheiden is van de AI: een model dat een plausibel verhaal kan vertellen doet " +
      "dat ook als de meting ontbreekt. Wat in de meetlaag staat kan niet liegen. Wat een model ervan vindt " +
      "komt pas daarna, en alleen bovenop die cijfers.\n\n" +
      "Het belangrijkste onderscheid van deze laag: een link in het menu of de footer is iets anders dan een " +
      "link in de lopende tekst. Zonder dat verschil haalt elke pagina automatisch een voldoende op interne " +
      "links, en dat is dan een meting die niets meet.",
  },
  {
    titel: "De paginascore: een thermometer per pagina",
    kern: "Nul tot honderd, puur rekenwerk, elke keer dezelfde uitkomst.",
    tekst:
      "Een score van 0 tot 100 per pagina, gerekend op de gegevens die de wekelijkse scan toch al vastlegt. " +
      "Geen AI, dus gratis, direct klaar en reproduceerbaar.\n\n" +
      "Twee correcties houden de score eerlijk:\n\n" +
      "1. **Menu en footer tellen niet mee.** Die staan op elke pagina, dus zonder correctie scoort iedereen " +
      "hetzelfde op interne links en zakt iedereen op alt-teksten.\n" +
      "2. **Wat niet van toepassing is kost geen punten.** Heeft een pagina geen eigen afbeeldingen, dan " +
      "vervalt dat onderdeel uit de som in plaats van dat de pagina er eeuwig onder blijft hangen.\n\n" +
      "De score is bedoeld om in één oogopslag te zien welke pagina's het meeste werk nodig hebben, niet om " +
      "een analyse te vervangen.\n\n" +
      "**Een score is zo vers als zijn laatste meting** (11 augustus 2026). De score wordt niet live gerekend " +
      "maar op de laatst vastgelegde meting van die pagina, en die meting wordt alleen ververst als een scan " +
      "de pagina echt opnieuw uitleest. Daar zaten twee gaten in, allebei nu gedicht. **Eén:** de knop \"Hele " +
      "site opnieuw scannen\" haalde alleen op wélke pagina's er zijn en hoe het menu loopt, en mat de inhoud " +
      "niet. Wie erop drukte kreeg dus dezelfde oude scores terug, ook nadat er copy was bijgeschreven. Die " +
      "knop doet nu drie stappen achter elkaar: pagina's ophalen, menu uitlezen, en daarna elke pagina meten. " +
      "**Twee:** de wekelijkse scan liep de klanten op naam af en heeft vijf minuten. Bij meerdere klanten van " +
      "tientallen pagina's was de tijd op voordat hij achteraan was, en omdat hij elke week weer vooraan begon " +
      "kreeg de eerste klant altijd een verse meting en de laatste nooit. Hij begint nu bij de klant die het " +
      "langst niet aan de beurt is geweest, zodat iedereen aan de beurt komt. Staat een score toch op een oude " +
      "meting, dan zegt het tekstballonnetje bij het cijfer dat erbij, met de datum.",
  },
];
