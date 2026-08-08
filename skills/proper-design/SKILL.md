---
name: proper-design
description: >-
  Algemene, merk-neutrale designprincipes plus een pre-oplever kwaliteitschecklist voor proper
  design, én interactie-/werkstroomprincipes voor hoe een scherm zich gedraagt (knopvolgorde,
  één bron van waarheid per status, groepering naar taak). Gebruik deze skill ALTIJD wanneer je
  iets vormgeeft of bouwt dat een mens te zien krijgt of mee werkt: een dashboard, webpagina,
  landingspagina, rapport, e-mail, formulier, UI-component, grafiek, tabel, slide, of welke
  visuele of interactieve output dan ook, ook als de gebruiker niet expliciet om "design" of
  "usability" vraagt. Triggert op: dashboard bouwen, pagina of component maken, layout, opmaak,
  "maak dit mooier", vormgeving, UI, data visualiseren, "het staat rommelig", "het voelt niet
  intuïtief", te veel knoppen, uitlijning, spacing, lettertypes. De skill borgt uitlijning,
  consistente afstanden, een vaste type-schaal, leesbare hiërarchie, voldoende contrast én
  duidelijke, niet-overlappende interactiepatronen, zodat het proper is zonder dat de gebruiker
  het per keer hoeft uit te leggen. Merk-neutraal: past bovenop een bestaande huisstijl of
  tokens, en vervangt die nooit.
---

# Proper design

Deze skill geeft je de vakkennis van een goede designer, gedistilleerd tot toepasbare regels,
plus een checklist die je vóór oplevering doorloopt. Doel: de gebruiker (vaak niet-technisch)
hoeft nooit meer uit te leggen dat dingen uitgelijnd moeten zijn, dat afstanden consistent
moeten zijn, of dat er niet drie lettertypes door elkaar mogen lopen. Dat borg jij nu zelf.

## Wanneer en hoe je deze skill gebruikt

Zodra je iets bouwt of vormgeeft dat iemand ziet of mee werkt, werk je in vier stappen:

1. **Lees `DESIGN-PRINCIPES.md`** voordat je de eerste regel opmaak of layout schrijft. Dat
   zijn de fundamentals: uitlijning, ritme, typografie, kleur, hiërarchie, consistentie.
2. **Lees `INTERACTIE-PRINCIPES.md`** zodra er meer dan één actie, status of knop op het scherm
   staat. Dat gaat over gedrag en organisatie: één bron van waarheid per status, volgtijdelijke
   acties als fase in plaats van gelijkwaardige knoppenrij, geen knop als een compensatie voor
   een trage automatische stap, groepering naar taak in plaats van naar objecttype.
3. **Bouw volgens die principes.** Kies bewust, gok niet. Elke afstand komt van één schaal,
   elke tekstgrootte van één type-schaal, elke knoppenrij is een bewuste indeling.
4. **Loop vóór oplevering `DESIGN-CHECKLIST.md` af.** Lever pas op als die slaagt. Faalt een
   punt, herstel het eerst. Dit is de motor: kwaliteit wordt afgedwongen, niet alleen
   geadviseerd. Toon de gebruiker kort dat je de checklist hebt gedraaid.

## Belangrijke uitgangspunten

- **Merk-neutraal, respecteer wat er is.** Bestaat er al een huisstijl, tokens-bestand of
  design-systeem (bijv. een `:root` met CSS-variabelen, een Tailwind-config, een tokens.md)?
  Gebruik die waarden. Deze skill gaat over vakmanschap (hoe je iets opbouwt), niet over
  merkkeuzes (welke kleur het merk heeft). De volgorde is: de woorden van de gebruiker, dan
  het bestaande systeem van het project, dan pas jouw eigen keuzes.
- **Vult de ingebouwde `artifact-design` skill aan, spreekt die niet tegen.** Bouw je een
  Artifact-pagina, gebruik beide: `artifact-design` voor de editorial afweging, deze skill
  voor de fundamentals en de harde checklist.
- **Consistentie boven originaliteit.** Eén patroon dat overal terugkomt oogt professioneler
  dan tien mooie losse ideeën. Verzin geen nieuwe variant van iets dat al bestaat.

## Inspiratie en voorbeelden

`voorbeelden/` bevat een groeiende, geannoteerde bibliotheek van goed design plus links naar
betrouwbare bronnen. Raadpleeg die als je vastzit of inspiratie zoekt, en als je een sterk
voorbeeld tegenkomt, voeg het toe (zie `voorbeelden/README.md`). Zo wordt de kennisbasis met
de tijd rijker.

## De gouden regel

Als iets "rommelig" oogt, ligt het bijna altijd aan één van deze drie: dingen staan niet
uitgelijnd, de afstanden zijn ongelijk, of er lopen te veel tekstgroottes en lettertypes door
elkaar. Fix die drie eerst; ze lossen het merendeel van alle "het ziet er niet uit"-gevoel op.
