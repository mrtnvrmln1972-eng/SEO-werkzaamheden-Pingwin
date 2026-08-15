import type { Hoofdstuk } from "./types";

export const HOOFDSTUK: Hoofdstuk = {
  titel: "Hoe je een opdracht scherp krijgt",
  waarvoor: "Het grootste tijdverlies is Claude die moet raden waar je het over hebt.",
  tips: [
    {
      titel: "Zeg in welk scherm het staat, altijd",
      tekst:
        "\"Dat venster waar Hovenier Ude staat\" kost een kwartier zoeken; \"het blok Over deze pagina op de "
        + "paginakaart\" kost nul. Eén regel erbij scheelt meer dan welke instelling ook.",
      geleerd: "15 augustus 2026",
    },
    {
      titel: "Een schermafbeelding is de snelste aanwijzing die er is",
      tekst:
        "Plak of sleep een knip van het scherm in het Tweak-venster. Dat beeld gaat mee naar het punt, dus de ronde "
        + "ziet precies wat jij ziet. Let op: een afbeelding die je in een chat plakt komt bij die chat terecht, niet "
        + "bij het punt; gebruik dus het Tweak-venster als het over een punt gaat.",
      waar: "/admin/tweaks",
      geleerd: "15 augustus 2026",
    },
    {
      titel: "Vraag om de bron, niet om het antwoord",
      tekst:
        "Klinkt een bewering stellig zonder dat erbij staat waar hij vandaan komt (de live site, Ahrefs, Search "
        + "Console, een mail), vraag dan door. \"Verifieer, gok nooit\" is de vaste regel, maar een korte "
        + "controlevraag van jouw kant vangt de keer dat het toch misgaat.",
    },
    {
      titel: "Een plan of oud document is niet de werkelijkheid",
      tekst:
        "Een zoekwoordenplan of een eerder rapport kan maanden oud zijn. Vraag bij twijfel expliciet: is dit net "
        + "gecontroleerd, of komt dit uit een ouder bestand?",
    },
  ],
};
