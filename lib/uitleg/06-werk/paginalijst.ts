import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "De paginalijst bouwt op vier bronnen, niet alleen de sitemap",
    kern: "Een live pagina die niet in de sitemap staat, valt niet meer stil weg.",
    tekst:
      "De paginalijst (de spiegel van de live site) bouwde eerst alleen op de sitemap. Daardoor was een " +
      "pagina die live stond maar niet in de sitemap zat, voor het hele dashboard onzichtbaar; bij One Day " +
      "Clinic gold dat voor een pagina die op ruim twintig zoektermen rankte.\n\n" +
      "Bij het inlezen van de website worden nu vier bronnen verenigd: de **sitemap**, de pagina's die " +
      "**Search Console** kent, de **Ahrefs**-toppagina's en de **interne links** die tijdens het scannen op " +
      "de pagina's zelf gevonden worden. Per pagina wordt bewaard waar hij vandaan komt. Een live pagina " +
      "zonder sitemap-vermelding krijgt het label **niet in sitemap**: dat is zelf een bevinding, want zo'n " +
      "pagina bestaat wel maar wordt door de site niet opgegeven, en dat maakt hem voor Google slechter " +
      "vindbaar. Boven de lijst staat hoeveel van zulke pagina's er zijn.\n\n" +
      "Sinds 12 augustus 2026 hoort daar de **sitemap-check** bij (link bij het Overzicht-veld en bij de " +
      "paginalijst): die haalt de sitemap van de klant vers op en laat drie dingen zien: of de sitemap zelf " +
      "bereikbaar is en of robots.txt ernaar verwijst, welke live pagina's erin missen (met hun vertoningen, " +
      "belangrijkste bovenaan), en welke regels erin naar een omgeleide of verdwenen pagina wijzen. Daarmee " +
      "is \"de sitemap is niet actueel\" geen vermoeden meer maar een lijst die je aan de sitebeheerder geeft. " +
      "Het blok **Wat ziet Googlebot?** vraagt het bovendien aan Google zelf (URL-inspectie via Search " +
      "Console): laatste crawl, of het ophalen lukte en of de pagina in de index staat, zodat je weet of een " +
      "blokkade op de site ook Google raakt of alleen meettools.",
  },
  {
    titel: "De sitemap-check is deelbaar met een link, zonder inlog",
    kern: "Eén adres dat precies dit ene overzicht laat zien, en verder niets van het dashboard.",
    tekst:
      "Onder de sitemap-check staat sinds 21 augustus 2026 een knop **Maak een deelbare link**. Wie die link " +
      "krijgt (de sitebeheerder, de webbouwer, de klant zelf) ziet exact dezelfde controle als in de cockpit: " +
      "dezelfde blokken, dezelfde tabellen, dezelfde klikbare pagina's. Inloggen hoeft niet.\n\n" +
      "Wat zo'n bezoeker **niet** kan, en dat is met opzet zo gebouwd en niet alleen zo weergegeven:\n\n" +
      "- **Nergens anders heen.** Op die pagina staat geen menu, geen logo dat naar de voorpagina linkt en " +
      "geen enkele verwijzing naar een ander scherm. De pagina's die er wél in staan zijn de pagina's van de " +
      "site zelf, precies waar het overzicht over gaat.\n" +
      "- **Niets wijzigen.** De publieke route kan alleen lezen; alles wat iets vastlegt of aanzet zit achter " +
      "de beheerroutes, en die weigeren iedereen zonder adminsessie.\n" +
      "- **Geen andere klant zien.** De link bevat een lange, onraadbare code die aan één klant hangt. Wie " +
      "hem verandert, komt nergens binnen.\n" +
      "- **De controle niet opnieuw aanzetten.** De gedeelde pagina toont de **stand van de laatste controle** " +
      "die in de cockpit gedraaid is, met datum en tijd erbij. Zo kan niemand met verversen de server of de " +
      "site van de klant belasten. Klik in de cockpit op \"Opnieuw controleren\" en de gedeelde stand loopt mee.\n\n" +
      "De link bestaat pas als je hem maakt, en met **Trek de link in** bestaat hij weer niet; **Nieuwe link** " +
      "vervangt hem, waarna de oude per direct stopt met werken. Handig als hij bij de verkeerde persoon " +
      "terechtkwam. Hetzelfde balkje zit onder het opruimrapport, en werkt daar precies zo.",
  },
];
