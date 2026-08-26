import type { Uitklapper } from "../types";

export const BLOKKEN: Uitklapper[] = [
  {
    titel: "Wat we gedaan hebben",
    kern: "Per maand een compleet overzicht van het uitgevoerde werk.",
    tekst:
      "Alles wat er voor een klant is uitgevoerd staat per maand op één plek: copy, meta's, alt-teksten, " +
      "structured data en redirects. Dat is niet alleen verantwoording naar de klant, het is ook het antwoord " +
      "op 'wat hebben we hier vorig jaar eigenlijk gedaan' als er iemand anders op het account komt.\n\n" +
      "**De correspondentie staat er sinds 18 augustus 2026 bij.** Een mailwisseling is werk: wat wij sturen " +
      "(een analyse, een contentplan, instructies voor de sitebouwer) en wat er binnenkomt bepalen samen wat " +
      "er die week gebeurt, en de datum erbij zegt wannéér. Dat las alleen mee uit mail die ooit was " +
      "opgeslagen, en de live koppeling met de mailbox slaat niets op, dus juist de recente maanden " +
      "ontbraken. Nu wordt de mailbox zelf uitgelezen, door dezelfde zeef als \"Laatste mails\": de " +
      "afzenderlijst van de klant en de ruisfilter op automatische meldingen, zodat er geen nieuwsbrieven " +
      "tussen komen. Mails staan standaard op **intern**; met de knop \"delen\" zet je er een klaar voor de " +
      "klant.\n\n" +
      "**Een afgevinkte taak uit de planning komt hier ook terecht.** Vink je op de takenlijst een regel af " +
      "(het vinkje links op de regel), dan verdwijnt hij uit \"wat er nog moet\" en verschijnt hij hier met de " +
      "datum van het afvinken. Daarvoor was afvinken het einde van het spoor: de taak was van het scherm en " +
      "nergens stond nog dat hij gebeurd was. Taken die eerder al op klaar stonden zijn met terugwerkende " +
      "kracht toegevoegd.",
  },
  {
    titel: "Elke afgeronde taak heeft een knop \"effect?\"",
    kern: "Direct van een taak naar wat hij heeft opgeleverd, ook zonder eigen pagina.",
    tekst:
      "Bij elke taak die op klaar staat, hier en in de planning, staat sinds 26 augustus 2026 een klein " +
      "knopje **effect?**. Een klik springt naar de Wijzigingen-tab en opent meteen de klikken, vertoningen " +
      "en posities van vóór en ná die taak, dezelfde vergelijking die daar al voor pagina-wijzigingen " +
      "bestond.\n\n" +
      "Hangt de taak aan een pagina, dan is dat het vertrouwde meetmoment van die pagina: bestaat het al " +
      "(bijvoorbeeld omdat de taak al eerder als optimalisatie is gevolgd), dan opent dat; bestaat het nog " +
      "niet, dan wordt het op de taakdatum vastgelegd.\n\n" +
      "**Nieuw is dat het ook werkt voor een taak zonder eigen pagina**, zoals \"startdata toevoegen\" of " +
      "een technische klus die de hele site raakt. Daar is geen pagina om een meetmoment aan te hangen, dus " +
      "toont de knop het effect op de hele site sinds de datum van de taak: dezelfde grafieken en dezelfde " +
      "zoekwoordentabel, maar dan sitebreed. Search Console bewaart de geschiedenis zelf, dus daarvoor hoeft " +
      "niets apart te worden opgeslagen; het scherm rekent het live uit vanaf de taakdatum.",
  },
];
