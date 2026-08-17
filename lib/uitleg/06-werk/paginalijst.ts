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
];
