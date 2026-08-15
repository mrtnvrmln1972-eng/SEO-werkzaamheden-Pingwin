import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "communicatie",
  titel: "Communicatie met de klant",
  intro:
    "Mail is geen bijzaak in een SEO-traject, het is waar de helft van de afspraken staat. Daarom zit het in " +
    "het dashboard en niet ernaast.",
  uitklappers: [
    {
      titel: "De correspondentie per klant",
      kern: "Alle mail rond deze klant op één plek, doorzoekbaar op onderwerp.",
      tekst:
        "Per klant staan de recente mails in de cockpit, met de mogelijkheid om te zoeken op onderwerp " +
        "('alles over de nieuwe stedenpagina's binnen deze klant') in plaats van alleen op afzender. Een " +
        "mailverwijzing opent het gesprek rechtstreeks in de mailclient.\n\n" +
        "Uit die mails wordt ook een tijdlijn van de stand van zaken samengevat, die stil op de achtergrond " +
        "wordt bijgewerkt als hij meer dan twee dagen achterloopt. Je opent een klant dus nooit met verouderde " +
        "context.",
    },
    {
      titel: "Mailcontroles",
      kern: "Uitgaande mail wordt eerst getoetst aan de afspraken.",
      tekst:
        "Voordat een mail de deur uit gaat wordt hij nagelopen: klopt de aanhef, staan de afspraken erin, " +
        "wordt er niets beloofd dat niet is gedaan, en is de opmaak simpel genoeg voor mail (aanhef, korte " +
        "alinea's, simpele bullets, afsluiting, geen tabellen en geen vet-spam).\n\n" +
        "Deze controles draaien ook periodiek op de achtergrond, zodat een openstaand punt niet blijft liggen " +
        "tot iemand er weer aan denkt.",
    },
    {
      titel: "Wat de klant zelf ziet",
      kern: "Een eigen dashboard, in gewone taal, zonder ruwe data.",
      tekst:
        "De klant logt in en ziet zijn maandoverzicht: welke werkzaamheden er zijn gedaan, hoeveel uren en " +
        "welk budget daarbij hoort, en de documenten die voor hem klaarstaan. Alleen de regels die " +
        "klant-zichtbaar zijn gemarkeerd komen daarin terecht.\n\n" +
        "Het bureau kan van elke klant een voorbeeldweergave openen en zo precies zien wat de klant ziet, " +
        "voordat hij de link verstuurt.",
    },
    {
      titel: "Mailen naar de sitebouwer",
      kern: "Een screenshot van het probleem erbij, en meteen zien of het al klopt.",
      tekst:
        "In het Developer-tabblad staat bij elke taak een mailknop met alles al ingevuld: klant, taak, de " +
        "pagina en de documenten als klikbare links. In dat berichtvak kun je nu ook een screenshot plakken of " +
        "erin slepen, bijvoorbeeld om aan te wijzen welk blok nog fout staat; hij gaat als afbeelding onderaan " +
        "de mail mee. Ditzelfde geldt overal in het dashboard waar dit mailvenster verschijnt, niet alleen bij " +
        "de sitebouwer. Het andere mailvenster, \"Mail vanuit deze kaart\" (de Mail-knop op een projectkaart in " +
        "de weekplanning), is een los scherm en heeft dezelfde plak-of-sleep-knop nu ook.\n\n" +
        "Wat je aanvinkt bij \"Meesturen\" (de pagina, de copy, de blauwdruk) staat meteen als klikbare link in " +
        "de mail, met de naam van het document erop, niet met een Google Docs-adres van honderd tekens. Noemt " +
        "de tekst die naam al, dan wordt díe naam de link; anders komt er onderaan een regel bij. Wat je in het " +
        "schrijfvenster ziet is dus precies wat de ontvanger krijgt, en klikken op zo'n link opent het document " +
        "zodat je nog even kunt controleren of het de goede tekst is. Vink je iets uit, dan verdwijnt de link " +
        "weer. Vroeger werden die links pas bij het versturen onzichtbaar aangeplakt, dus je kon ze niet zien " +
        "en niet in een zin verwerken.\n\n" +
        "Het adresveld stelt namen voor uit je eigen contacten: typ \"ma\" en Maarten wordt voorgesteld, kiezen " +
        "met de pijltjes of een klik. Dat zat alleen in het mailvenster van het Werkzaamheden-tabblad; het is nu " +
        "één veld dat elk mailvenster gebruikt.\n\n" +
        "Daarnaast staat er bij een taak die van een projectkaart komt de knop \"Is dit doorgevoerd?\": dezelfde " +
        "meting als op de kaart zelf, maar dan met één klik vanuit de lijst, zodat je bij een terugkoppeling van " +
        "de sitebouwer niet eerst de kaart hoeft op te zoeken.",
    },
    {
      titel: "Delen zonder inlog",
      kern: "Lange, onraadbare links voor precies één ding.",
      tekst:
        "Voor onderdelen die met iemand buiten het bureau gedeeld moeten worden zijn er links zonder inlog: " +
        "de werklijst voor de sitebouwer, de bedrijfsgegevens die de klant moet nalopen, en het opruimvoorstel. " +
        "Elke link geeft toegang tot dat ene onderdeel en niets anders, en kan vernieuwd worden waarmee de " +
        "oude link direct dood is.\n\n" +
        "Er is ook een loginvrije link naar het klantdashboard zelf voor klanten die geen wachtwoord willen " +
        "onthouden. Staat de login van die klant uit, dan werkt die link ook niet: dezelfde spelregel, geen " +
        "achterdeur.",
    },
  ],
};
