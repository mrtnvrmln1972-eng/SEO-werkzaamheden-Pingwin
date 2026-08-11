import type { Uitklapper } from "../types";

// Structured data.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Structured data",
    kern: "Van bedrijfsgegevens naar geldige schema-blokken, per pagina en site-breed.",
    tekst:
      "Er is één formulier per klant met de bedrijfsgegevens die een schema-blok nodig heeft. Dat wordt " +
      "automatisch gevuld vanaf de website, kan met de klant gedeeld worden via een link zonder inlog om na " +
      "te lopen en aan te vullen, en kan daarna vergrendeld worden.\n\n" +
      "Na die vergrendeling is dit de vaste bron voor alle structured data die het dashboard genereert: het " +
      "site-brede blok én het blok per pagina. Zo staat het adres van de klant op één plek en niet in dertig " +
      "losse stukjes code die uit elkaar gaan lopen.\n\n" +
      "Van elke pagina wordt ook gemeten welke schema-types er nú op staan, waarbij bewust een lijst wordt " +
      "bijgehouden van wat wél meetelt. Een zwarte lijst van hulptypes loopt altijd één stap achter.\n\n" +
      "Het hele formulier (algemene gegevens, vestigingen, bereikbaarheid, artsen, webshop-gegevens, " +
      "diensten, opmerkingen) staat standaard dicht onder één klapkopje 'Verzamelde structured data' " +
      "met het aantal dat nog ontbreekt; zo blijft de kaart compact, ook bij tientallen vestigingen of " +
      "artsen.\n\n" +
      "**Aanvullend op de plugin, niet vervangend.** Staat er al organisatie-schema van een SEO-plugin " +
      "(Yoast, Rank Math, AIOSEO) op de homepage, dan leest het dashboard dat eerst uit en knoopt het " +
      "site-brede blok aan diezelfde @id vast: naam, adres, telefoon en openingstijden blijven van de " +
      "plugin (die ze vanzelf actueel houdt), en Pingwins blok voegt alleen toe wat de plugin niet levert " +
      "(vestigingen, reviewcijfer, KVK/BTW, social-profielen). Zo hoeft de plugin niet aangepast te " +
      "worden en overleeft de aanvulling een plugin-update. Is er geen bestaand schema gevonden, dan " +
      "levert het dashboard het volledige, zelfstandige blok.\n\n" +
      "**Eén compacte knoppenrij bovenaan de kaart**, bewust tot zes knoppen teruggebracht: ontbrekende " +
      "gegevens ophalen, opslaan, vergrendelen, 'Delen met developer', 'Delen met klant', en de laatste " +
      "stand van de schema.org-richtlijnen (achter een 'vraagteken'-knop). 'Genereer site-brede schema' en " +
      "'Deel JSON' waren twee knoppen voor dezelfde stap en zijn samengevoegd tot 'Delen met developer': in " +
      "één klik het site-brede blok bouwen (aanvullend op een eventuele plugin), als .json-bestand naar " +
      "Drive zetten, een Dev-taak aanmaken in Werkzaamheden, en een mailvenster openen met een kant-en-klare " +
      "introductie. De ruwe JSON-code bekijken of los kopiëren kan in dat mailvenster, onder 'Bekijk de " +
      "JSON-code'; die staat standaard dicht. Zo ook 'Link kopiëren' en 'Mail naar klant': dat waren twee " +
      "knoppen voor bijna hetzelfde, nu is dat 'Delen met klant', één mailvenster met de deel-link erin én " +
      "een eigen kopieerknop voor die link.\n\n" +
      "**Geen mailto meer.** Beide mailvensters versturen, als er een Microsoft 365-koppeling is, de mail " +
      "rechtstreeks vanuit het dashboard (zelfde route als de mail-knoppen in Werkzaamheden); zonder " +
      "koppeling opent een knop het eigen mailprogramma via een onzichtbare link (niet via `window.open`, " +
      "dat gaf een leeg tabblad met de kale mailto-URL erin) of kopieert de mailtekst. Beide vensters zijn " +
      "hetzelfde opgemaakte compose-venster als in Werkzaamheden, geen los, onopgemaakt scherm meer.\n\n" +
      "**Kennisbank versus het formulier hierboven.** De kennisbank is de intake: een kleine 'dropzone' " +
      "(in de knoppenrij) waar documenten, foto's, tekst of een Drive-link in gaan; de AI haalt er " +
      "kandidaat-gegevens uit, per bron, en die wachten eerst op een akkoord voordat ze meetellen. Pas de " +
      "knop 'In velden zetten' brengt bevestigde kennisbank-gegevens over naar de echte velden hierboven " +
      "('Verzamelde structured data'), met 'Ontdubbelen' om dubbele aanleveringen samen te voegen. Het " +
      "detailoverzicht ('Kennisbank per categorie', tabjes met elke entiteit als kaartje) en het lijstje " +
      "'Nog aan te leveren' staan allebei standaard dicht onder een klein pijltje, zodat de kaart compact " +
      "blijft en alleen de dropzone en de knoppen meteen in beeld staan. Kortom: de kennisbank is het " +
      "ruwe-materiaal-archief mét herkomst per gegeven, het formulier erboven is de schone, bevestigde bron " +
      "waar de structured data zelf uit gebouwd wordt.",
  },
];
