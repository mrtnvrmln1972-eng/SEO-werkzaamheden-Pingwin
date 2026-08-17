// De vorm van een keten-poort-blokkade, los van de poort zelf.
//
// Bewust een eigen bestandje: de schermen moeten kunnen herkennen dát een run
// op de poort is vastgelopen (om de knop "Toch genereren" erbij te zetten),
// maar lib/keten-poort.ts trekt de Anthropic-client mee. Die hoort niet in een
// browserbundel. Hier staat dus alleen de tekstafspraak, zonder afhankelijkheden.

// Vaste openingszin van een poort-blokkade. Deze tekst is een afspraak tussen
// lib/keten-poort.ts en de schermen; verander hem op één plek en de knop
// "Toch genereren" verdwijnt stilletjes. proeven/keten-poort.proef.ts bewaakt dat.
export const POORT_MARKERING = "Document niet gegenereerd:";

// Is deze foutmelding een blokkade van de keten-poort? De schermen tonen de
// uitwijkknop bij precies deze fout, en niet bij een gewone technische storing.
export function isPoortBlokkade(melding: string): boolean {
  return (melding || "").startsWith(POORT_MARKERING);
}
