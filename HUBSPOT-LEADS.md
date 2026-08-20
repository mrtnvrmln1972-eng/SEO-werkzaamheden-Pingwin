# HubSpot in het dashboard: van deal naar leadomgeving

Plan, 19 augustus 2026. Geschreven in gewone taal, zodat je het kunt beoordelen zonder de code
te kennen. Onderaan staan twee regels techniek voor de chat die het bouwt.

**Stand: gebouwd op 19 augustus 2026, alle drie de stappen.** Wat hieronder als plan staat, staat
nu in het dashboard. Het enige dat nog moet gebeuren voordat er iets binnenkomt: de sleutel in
Vercel (zie "Wat ik van jou nodig heb") en aanvinken welke pijplijnen als lead tellen, op
`/admin/beheer`. Zolang die sleutel er niet is, doet de koppeling niets en zegt dat ook zo op het
scherm; er gaat niets stuk en er verandert niets aan de bestaande leads.

## Waar dit over gaat

In HubSpot staat je verkoop: welke deals lopen, voor hoeveel, wanneer je ze verwacht binnen te
halen, wanneer je die persoon weer moet spreken, en alles wat je met hem besproken hebt. In het
dashboard staat je werk: de klanten, de prognose, de KPI's, de documenten, de mail. Een lead
bestaat nu in allebei, maar los van elkaar, dus je typt alles twee keer over en de prognose staat
altijd een week achter op de werkelijkheid.

Dit plan haalt de verkoopkant uit HubSpot binnen en zet hem neer op de plek waar hij thuishoort:
in de leadomgeving die er al is. Daarna is HubSpot de plek waar je de deal beheert, en is het
dashboard de plek waar je ziet wat het betekent en waar je hem verder helpt.

## De ene regel die dit simpel houdt

**Elk veld heeft één baas.** Dat klinkt saai, maar het is precies de reden dat dit soort
koppelingen normaal ontsporen: twee systemen die allebei denken dat ze gelijk hebben, en dan is er
geen enkele manier meer om te zien welk bedrag klopt.

| Wat | Wie is de baas | Waarom |
|---|---|---|
| Naam, bedrijf, contactpersoon | HubSpot | daar maak je de deal aan |
| Fase in de pijplijn | HubSpot | daar sleep je hem door |
| Verwachte datum dat hij klant wordt | HubSpot | dat is de sluitingsdatum van de deal |
| Eerstvolgend contactmoment | HubSpot | daar staat je taak of afspraak al |
| Kans dat het doorgaat | HubSpot, jij mag hem overschrijven | de fase geeft een percentage, jouw onderbuik weet het soms beter |
| **Beoogd maandbudget SEO** | **het dashboard** | een deal in HubSpot is meestal een totaalbedrag; de prognose rekent met maandbedragen |
| Alles wat we voor de lead maken (dossier, voorstel, scan) | het dashboard | daar wordt het gemaakt |

Het dashboard schrijft in stap 1 en 2 **niets** terug naar HubSpot. Dat is een bewuste keuze: één
richting is te overzien, twee richtingen betekent dat je bij elk verschil moet uitzoeken wie er
het laatst gelijk had. Terugschrijven staat in stap 3 en alleen voor dingen die maar één kant op
kunnen (een notitie erbij, nooit een veld overschrijven).

## Wat je straks ziet

**In de leadlijst op `/admin`** krijgt elke lead er drie dingen bij, direct zichtbaar zonder
klikken: wanneer je hem weer moet spreken (rood als die datum voorbij is), het beoogde maandbudget,
en de maand waarin je hem verwacht binnen te halen. Zo is de leadlijst in één blik je belactielijst
in plaats van een lijstje namen.

**In de leadomgeving zelf** komt bovenaan een kaart met de stand van de deal: de fase, het bedrag,
de verwachte startdatum, de kans, het eerstvolgende contactmoment, wanneer je voor het laatst
contact had, en een knop "Openen in HubSpot" voor als je daar iets wilt wijzigen. Onder die kaart
staat wat er al is (het gesprek, het dossier, de documentenplank) plus twee nieuwe dingen: de
mailwisseling en de tijdlijn.

**De mailwisseling** werkt precies zoals bij een klant: het vertrouwde mailvenster, de hele
draad, en je kunt er direct vanuit antwoorden of een nieuwe mail sturen. Dat is geen nieuw ding
dat gebouwd moet worden, dat staat er al voor klanten; een lead krijgt het alleen ook.

**De tijdlijn** is één lijst waarin alles op datum onder elkaar staat: de mails, de notities en
gesprekken uit HubSpot, de documenten die we gemaakt hebben, en de metingen die we deden. Dat is
wat je nu mist als je na drie weken een lead opent en je afvraagt waar je gebleven was.

**In de prognose op `/admin/financien`** vult zich vanzelf wat je nu met de hand invult: de kans
komt uit de dealfase, de startmaand uit de verwachte sluitingsdatum. Alleen het maandbudget zet je
zelf, en dat is precies het veld waar je een oordeel over hebt.

## Wat er automatisch binnenkomt

Elk kwartier kijkt het dashboard bij HubSpot of er iets veranderd is. Deals in de pijplijnen die
jij aanwijst worden een lead in het dashboard: bestaat hij al, dan wordt hij bijgewerkt; bestaat
hij nog niet, dan komt hij erbij als nieuwe lead. Verdwijnt een deal uit de pijplijn (gewonnen of
verloren), dan verandert alleen de fase, er wordt nooit iets weggegooid.

Wat er meekomt: naam, bedrijf, website, contactpersoon en mailadres, de dealfase, het bedrag, de
verwachte sluitingsdatum, de kans die bij die fase hoort, de eerstvolgende openstaande taak of
afspraak met zijn datum, en alle notities, gesprekverslagen en afspraakverslagen.

Die notities en verslagen landen in het dossier dat er al is, met "uit HubSpot" als herkomst. Dat
is belangrijker dan het klinkt: het dossier is wat de leadchat leest. Vanaf dat moment weet de chat
dus wat jij in HubSpot hebt genoteerd, en kan hij daar een voorstel op baseren.

Voor de mail gebruiken we niet HubSpot maar de Microsoft-koppeling die er al is. Reden: die heeft
de volledige draad inclusief wat er niet in HubSpot gelogd is, en je kunt er vanuit antwoorden.
HubSpot bewaart alleen wat er toevallig gelogd werd. Eén bron voor mail, en dat is de mailbox.

## Wat je zelf zet

Twee dingen, allebei in het dashboard:

- **Het beoogde maandbudget** (en linkbuilding apart, net als bij een klant). Staat er in HubSpot
  een bedrag, dan zie je dat ernaast staan met een knopje "overnemen", zodat je niet hoeft te
  rekenen als het toevallig al een maandbedrag is.
- **De kans bijstellen** als je het niet eens bent met wat de dealfase zegt. Doe je dat, dan blijft
  jouw getal staan, ook als HubSpot later iets anders vindt. Het dashboard zegt er dan bij dat jij
  hem hebt gezet.

## Wat je vanuit een lead kunt doen

- Mailen en antwoorden, met de tekst voorgeschreven vanuit het dossier.
- Een opvolging inplannen: "herinner me hier over vijf dagen aan". Komt in hetzelfde belletje in
  de kopbalk als de rest.
- Een voorstel of andere documenten maken; dat werkt al en gebruikt nu ook wat er uit HubSpot komt.
- Een notitie kwijt kunnen zonder naar HubSpot te gaan.
- Hun site laten scannen op vindbaarheid, zodat je met een concrete kansenlijst het gesprek in gaat
  in plaats van met een algemeen verhaal. Dit is het enige onderdeel dat niet uit jouw vraag komt,
  maar het is wel de reden dat een leadomgeving in een SEO-dashboard beter is dan een leadomgeving
  in een CRM: hier ligt de data waarmee je de deal wint.
- Lead wordt klant: één knop. Fase gaat van lead naar klant, alles blijft staan, en het dossier van
  de verkoopfase is meteen het beginpunt van het klantdossier.

## Bouwen in drie stappen

**Stap 1: de koppeling en de vier velden.** Je zet één sleutel klaar (zie hieronder), daarna komen
de deals binnen en zie je de leadkaart, de drie kolommen in de leadlijst, en vult de prognose zich
met kans en startmaand. Het budget zet je zelf. Dit is het grootste deel van je vraag en het staat
op zichzelf: ook als er daarna niets meer bij komt, is dit af en bruikbaar.

**Stap 2: de gesprekshistorie en de mail.** Notities en gesprekken uit HubSpot in het dossier,
mailvenster op de lead, de tijdlijn, mailen en opvolgen vanuit de lead.

**Stap 3: de leadwerkplek.** De scan van hun site, het voorstel dat op alles voortbouwt, de knop
"lead wordt klant", en pas hier de enige stap terug naar HubSpot: als je in het dashboard een
notitie schrijft of een mail stuurt, komt daar een regel over in HubSpot te staan, zodat je
verkoopadministratie klopt zonder dat je hem bijhoudt.

Elke stap is één chat en gaat live zodra hij af is. Je hoeft niet op stap 3 te wachten om iets te
merken.

## Wat ik van jou nodig heb

Eén ding, twee minuten: in HubSpot een service key aanmaken (instellingen, Integraties, Service keys) met
leesrechten op deals, bedrijven, contacten, notities, taken en e-mail, en die sleutel in Vercel zetten.
Private apps heten daar sinds februari 2026 "legacy" en waarschuwen dat ook; een service key is precies
hetzelfde soort sleutel voor precies dit doel, en mist alleen webhooks, die we hier niet gebruiken. Ik kan dat
niet zelf, want ik kan niet in jouw HubSpot en niet in Vercel inloggen. De volledige klikroute
staat in het scherm zelf zodra stap 1 live is, dus je hoeft hem niet ergens op te zoeken.

Verder wil ik van je weten: welke pijplijn (of pijplijnen) tellen als lead, en vanaf welke fase.
Alles binnenhalen betekent dat elk half koud contact als lead in je dashboard staat en in je
prognose meetelt, en dan wordt het lijstje even onbruikbaar als een lijst die je niet bijhoudt.
Als je het niet weet, begin ik met alleen de deals die een sluitingsdatum hebben.

## Drie dingen waar ik op let

1. **Het bedrag in HubSpot is bijna nooit een maandbedrag.** Nemen we dat klakkeloos over, dan
   staat er straks een prognose van veertigduizend euro per maand die nergens op slaat, en dan
   vertrouw je het scherm niet meer. Daarom zet jij het maandbudget, en is HubSpot hooguit een
   suggestie ernaast. Wil je het toch automatisch, dan is de nette oplossing een eigen veld
   "maandbudget SEO" in HubSpot; dat kun je daar in vijf minuten aanmaken en dan klopt het altijd.
2. **Twee systemen die allebei mogen schrijven, worden twee waarheden.** Daarom eerst één
   richting. Merk je na een maand dat je dingen dubbel doet, dan breiden we het gericht uit, per
   veld, met een reden.
3. **Bouw geen tweede CRM.** De verleiding is groot om hier ook fases, taken en pijplijnen te gaan
   beheren, en dan heb je twee halve CRM's. Het dashboard voegt iets toe wat HubSpot niet kan: het
   weet hoe hun site ervoor staat, wat we kunnen leveren en wat dat oplevert. Dáár moet de
   leadomgeving over gaan.

## Wat er nu precies staat (gebouwd)

- **De koppeling.** Elk kwartier haalt het dashboard op wat er in HubSpot gewijzigd is. Alleen
  wat gewijzigd is, dus dat zijn een paar verzoeken. Op `/admin/beheer` staat een blok HubSpot
  met de verbinding, wanneer er voor het laatst opgehaald is, welke pijplijnen als lead tellen,
  twee schakelaars (mag een onbekende deal vanzelf een lead worden, en mag een notitie terug naar
  HubSpot) en twee knoppen: nu ophalen, en alles opnieuw ophalen.
- **De leadkaart** bovenaan elke lead: eerstvolgend contact (rood als die dag geweest is), verwachte
  startdatum, kans, het bedrag zoals het in HubSpot staat, laatste contact en de contactpersoon.
  Daaronder vier velden die jij zet (maandbudget, waarvan linkbuilding, kans, vanaf welke maand) en
  knoppen: bewaren, het HubSpot-bedrag overnemen, een notitie toevoegen, jezelf over vijf dagen
  laten herinneren, een snelle blik op hun site, en lead wordt klant.
- **De leadlijst** op `/admin` heeft er drie kolommen bij: opvolgen, budget per maand, verwacht klant.
- **De mailwisseling** onder elke lead, met dezelfde mailknop als bij een klant.
- **De tijdlijn**: mails, notities uit HubSpot, documenten en metingen op datum onder elkaar.
- **De prognose** vult zich met de kans uit de dealfase en de startmaand uit de sluitingsdatum. Zet
  je er zelf iets, dan wordt dat als "handmatig" gemerkt en komt de koppeling er nooit meer overheen.
- **Een poort** (`proeven/hubspot.proef.ts`) die de bouw laat mislukken zodra iemand er een tweede
  schrijfrichting bij bouwt, of zodra een koppeling een handmatige waarde zou kunnen overschrijven.

Twee dingen die de koppeling zelf doet en die je moet weten: een deal die in HubSpot als verloren
wordt afgesloten zet de lead hier op "niet doorgegaan" (een klant blijft altijd klant), en een deal
zonder bekend bedrijf in het dashboard wordt vanzelf een nieuwe lead, tenzij je dat op Beheer uitzet.

## Technisch voetnootje

Nieuw: `lib/hubspot.ts` (alleen-lezen, zelfde opzet als `lib/moneybird.ts`, sleutel als
`HUBSPOT_TOKEN` in Vercel), `lib/hubspot-sync.ts` plus een cron, een kolom `hubspot_deal_id` en
een opvolgdatum op de klantrij, en de HubSpot-koppeling erbij in `lib/bron-gezondheid.ts`.
Bestaand en hergebruikt: `lib/lead-dossier.ts`, `lib/prognose.ts` (kans en startmaand),
`lib/ms-graph.ts` met `MailVenster.tsx` voor de mail, `lib/mail-opvolg.ts` en `lib/meldingen.ts`
voor de opvolging, `app/admin/client/[slug]/LeadTab.tsx` voor het scherm.
