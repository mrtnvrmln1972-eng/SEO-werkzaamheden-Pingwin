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
        "context.\n\n" +
        "**Van een mail een taak maken doe je met één knopje (18 augustus 2026).** Naast \"Superhuman\" in de " +
        "mailregel staat \"Taak\". Komt er een mail binnen met werk erin, bijvoorbeeld een foutmelding op een " +
        "pagina, dan maakt die knop er meteen een kaart van in de planning: een korte taaktitel die zegt wat " +
        "er moet gebeuren (niet de onderwerpregel overgetypt), een beschrijving van twee of drie zinnen in het " +
        "veld **Aantekeningen** dat op elke kaart al bestaat, en de link naar de mail eraan vast. Bewust geen " +
        "nieuw veld erbij: dezelfde soort tekst op twee plekken loopt gegarandeerd uit elkaar. Werkt de " +
        "AI-koppeling even niet, dan komt de kaart er gewoon, alleen met de onderwerpregel als titel.\n\n" +
        "**Onderaan de lijst staat \"Meer mails\".** De lijst begint bij de laatste vijftien; elke klik haalt " +
        "er twintig bij, tot de mailbox niets ouders meer teruggeeft. Dan verdwijnt de knop. Voor het volledige " +
        "archief blijft de Superhuman-zoekknop bovenaan de snelste weg.",
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
        "**Het adresveld begint altijd leeg, en dat is een harde regel zonder uitzonderingen.** Het dashboard " +
        "vult nooit zelf een ontvanger in, ook niet het adres van de klant waar je op dat moment in zit. Reden: " +
        "er zat één gedeeld geheugen in de browser met \"het laatst gebruikte adres van de sitebouwer\", en dat " +
        "gold voor álle klanten tegelijk. Wie na een mail over de ene klant een mailvenster van een andere klant " +
        "opende, begon dus met het adres uit de vorige mail. Op 17 augustus 2026 stond daardoor bij de ene klant " +
        "het adres van een bedrijf klaar dat zijn directe concurrent is; één klik op versturen en die twee wisten " +
        "van elkaar dat ze dezelfde SEO-partner hebben. Dat is geen ongemak maar het soort fout dat een klant " +
        "kost, en die kans hoort nul te zijn in plaats van klein. Aanvullen gebeurt daarom alleen terwijl je " +
        "typt, uit je eigen contacten, en een voorstel wordt pas een adres als jij hem aanwijst. Er is bewust " +
        "geen uitzondering voor \"veilige\" adressen: zodra er één bij mag, komt de volgende er ongemerkt bij.\n\n" +
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
