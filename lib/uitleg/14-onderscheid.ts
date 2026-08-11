import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "onderscheid",
  titel: "Wat dit onderscheidt",
  intro:
    "De eerlijke vraag is niet of dit knap is, maar waarom een concurrent het niet in een kwartaal namaakt. " +
    "Dit zijn de antwoorden waar we voor durven staan.",
  uitklappers: [
    {
      titel: "Meten en oordelen zijn gescheiden",
      tekst:
        "Vrijwel elke AI-SEO-tool laat het model concluderen of iets in orde is. Dat levert antwoorden op die " +
        "goed klinken en soms niet waar zijn, en dat is precies het soort fout dat een klant een jaar later " +
        "ontdekt. Hier komt elk feit uit een meting met bewijs, en mag de AI er daarna iets van vinden. Die " +
        "scheiding kun je niet later inbouwen; die moet vanaf het begin in de architectuur zitten.",
    },
    {
      titel: "De keten is af",
      tekst:
        "Signaal, oordeel, rangorde, document, goedkeuring, doorvoeren op de site, terugcontrole, nameten. " +
        "Er zijn tools voor elk van die stappen. Er is bijna niets dat de hele keten in één geheugen houdt, en " +
        "dat is precies waar de uren in een bureau verdwijnen.",
    },
    {
      titel: "Het wordt beter door gebruik",
      tekst:
        "Correcties van de gebruiker worden vaste regels voor de volgende analyse. De opgebouwde regels, de " +
        "momentopnames en de historie per klant zijn niet mee te nemen naar een andere tool. Dat is geen " +
        "opsluiting, dat is opgebouwde waarde.",
    },
    {
      titel: "Het is gebouwd door de gebruiker",
      tekst:
        "Dit is geen tool die is bedacht op basis van interviews met SEO-specialisten. Elke keuze erin komt uit " +
        "een echt irritatiemoment in echt klantwerk, en dat is te zien: de weglatingen zijn even doelbewust " +
        "als de toevoegingen. Elf tabjes werden zes knoppen. Een muur van geblokkeerde regels werd een " +
        "werkbare lijst. Het planningsbord werd expres een signaalscherm en geen bedieningspaneel.",
    },
    {
      titel: "Het is al meervoudig in gebruik",
      tekst:
        "Dezelfde codebase draait onder meerdere merken met eigen databases en eigen sleutels. De " +
        "meertenant-vraag is dus niet theoretisch getest maar in productie beantwoord.",
    },
  ],
};
