import type { Uitklapper } from "../types";

// Wat we bewust niet doen, de risico's, en hoe dit document wordt bijgehouden.

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Wat we bewust níet doen (en waarom)",
    kern: "Een routekaart zonder afvallers is een wensenlijst.",
    tekst:
      "Dit is de spiegel van het bakje \"niet doen\" in de prioriteitenscan. Deze vijf komen regelmatig " +
      "langs en zijn met reden afgewezen. Verandert de reden, dan verandert het besluit.\n\n" +
      "- **Een eigen volwaardige site-audit bouwen** (alle technische controles, foutcodes, " +
      "duplicaatdetectie). Ahrefs doet dat al beter dan wij het gaan doen, en de koppeling ligt er. Wij " +
      "voegen waarde toe in het oordeel, niet in het crawlen.\n" +
      "- **Een eigen zoekwoorddatabase opbouwen** om Ahrefs-credits te sparen. De cache doet dit al waar het " +
      "nut heeft. Eigen volumes zouden verouderen en dan hebben we twee cijfers die elkaar tegenspreken, " +
      "precies de fout die we overal uitsluiten.\n" +
      "- **Een mobiele app.** Het werk in dit dashboard is bureauwerk met twee kolommen en veel tekst. Een " +
      "app zou een uitgeklede versie zijn en dus een tweede weg naar hetzelfde resultaat.\n" +
      "- **Meertaligheid.** Alles is Nederlands, en dat past bij de klanten. Dit komt pas in beeld bij een " +
      "bureau buiten Nederland, en dan is het een echt project en geen vertaalslag.\n" +
      "- **De assistent zelfstandig laten uitvoeren** zonder goedkeuring. Technisch kan het vandaag al. Het " +
      "is een ontwerpbesluit dat het niet gebeurt: een systeem dat autonoom naar buiten mag, kun je niet " +
      "vertrouwen op het moment dat het één keer misgaat.",
  },

  // ── Risico's ──
  {
    titel: "Risico's om in de gaten te houden",
    kern: "Niet op te lossen met een punt op de lijst, maar met een gewoonte.",
    tekst:
      "- **Groei van het oppervlak.** Het dashboard is groot. Elke nieuwe motor is ook een nieuwe plek waar " +
      "een cijfer anders kan gaan staan. De regel dat lenzen elkaar uitvragen in plaats van opnieuw ophalen " +
      "is daarom geen stijlvoorkeur maar een noodzaak. Bij elk punt hierboven staat daarom \"wat het raakt\".\n" +
      "- **Twee wegen naar hetzelfde resultaat.** Dit is de fout die telkens terugkomt: twee knoppen die " +
      "allebei een kaart maken. Bij elke uitbreiding is dit de eerste vraag.\n" +
      "- **Serverless tijdsvensters.** Opgelost met hervatbare runs, maar elke nieuwe zware analyse moet die " +
      "vorm bewust aanhouden. Wie dat vergeet bouwt de oude fout opnieuw (een analyse die veertig minuten op " +
      "\"bezig\" staat en niets oplevert).\n" +
      "- **Prijzen die verouderen.** De modelprijzen staan als schatting in de code. Historische kosten " +
      "blijven kloppen (die zijn vastgelegd), maar de tabel moet bij na een tariefwijziging. R4 zet die " +
      "prijzen op één plek.\n" +
      "- **Documentatie die achterloopt op de code.** Deze pagina zelf is daar het risico. Vandaar dat het " +
      "onderhoud eronder een vaste stap is en geen goede bedoeling.",
  },

  {
    titel: "Hoe dit document wordt bijgehouden",
    tekst:
      "De uitleg is geen apart document maar een map in de code van het dashboard zelf " +
      "(`lib/uitleg/`, één bestand per hoofdstuk). Dat is bewust: wie het dashboard uitbreidt heeft de uitleg " +
      "in dezelfde map open staan, en een uitbreiding zonder bijgewerkte uitleg valt op in de wijziging. Eén " +
      "bestand per hoofdstuk is er om een tweede reden: er wordt uit meerdere sessies tegelijk aan gewerkt, en " +
      "twee sessies die aan verschillende onderwerpen schrijven horen elkaar niet in de weg te zitten.\n\n" +
      "Vaste stap na een noemenswaardige uitbreiding: het hoofdstuk aanvullen, het bijbehorende punt in deze " +
      "routekaart afvinken of aanpassen, en de datum bovenaan verzetten. Hoofdstukken met de interne " +
      "markering blijven achter de beheerderslogin, dus de gaten hoeven niet te worden weggeschreven om de " +
      "pagina deelbaar te houden.\n\n" +
      "Een afgerond punt verdwijnt niet uit dit hoofdstuk, het verhuist: de beschrijving gaat naar het " +
      "hoofdstuk waar het thuishoort (dan is het werkelijkheid), en hier blijft één regel staan met de datum " +
      "waarop het klaar kwam. Zo blijft zichtbaar wat er in welk tempo gebeurd is, en dat is precies wat je " +
      "later in een licentie- of investeerdersgesprek nodig hebt.",
  },
];
