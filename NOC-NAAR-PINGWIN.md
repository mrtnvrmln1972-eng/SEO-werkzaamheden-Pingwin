# Nationaal Oogcentrum naar het Pingwin-dashboard

Stappenplan, opgesteld 18 augustus 2026. Akkoord van Maarten op de richting, nog niets gebouwd.

Dit plan vervangt twee oudere documenten die uitgingen van een eigen, losse database voor NOC
(`INTEGRATIE-NOC-PINGWIN.md` en `WERELD-2-NOC-CHECKLIST.md`). Allebei weggehaald in stap 4; wil je
weten hoe wereld 2 destijds is opgezet, dan staat dat in de geschiedenis van deze repo.

## Waar we vandaan komen

Er zijn nu twee dashboards die dezelfde software draaien, maar hun eigen gegevens bijhouden:

- **Het Pingwin SEO-dashboard**, met eenentwintig klanten erin. Hier werkt Maarten normaal.
- **De NOC-cockpit** op een eigen adres, met een eigen database, waarin Nationaal Oogcentrum
  als enige klant staat. Daar is al werk gedaan: chats, taken en pagina's.

Dat betekent nu dubbel huishouden: twee plekken waar iets van NOC kan staan, en Maarten moet
onthouden waar hij zat.

## Waar we naartoe gaan

Eén administratie, twee ingangen.

- **Nationaal Oogcentrum wordt een gewone klant in het Pingwin-dashboard**, tussen Kamsteeg en
  Strandtuin. Daar gebeurt vanaf dan al het werk.
- **Het NOC-adres blijft bestaan en blijft eruitzien zoals nu**, maar wordt een eigen voordeur op
  diezelfde gegevens. Geen tweede administratie meer, dus ook nooit meer twee versies van de
  waarheid.
- **Die voordeur laat alleen NOC door.** Geen klantenlijst, geen andere klanten, geen financiën,
  geen agenda van Pingwin. Zo kan Maarten er zonder nadenken zijn scherm mee delen.
- **Later krijgt iemand anders daar een eigen login**: eerst meekijken, daarna meewerken.

Wat we bewust níet doen: twee dashboards die elkaar bijwerken. Deze app houdt bijna honderd
soorten gegevens per klant bij, en de bestaande koppeling kan er acht doorgeven. De rest zou aan
de andere kant stilletjes verouderen. Kopieën lopen uit elkaar, en dat merk je pas als je in het
verkeerde scherm blijkt te hebben gewerkt.

---

## Stap 1: het slot (klaar, 18-08-2026)

**Wat er gebeurt.** Het slot voor de NOC-voordeur: één instelling die zegt "op dit adres bestaat
alleen deze klant", hard afgedwongen op elk scherm, elke knop en elke schermfoto. Het werkt
omgekeerd aan een lijst met verboden schermen, want zo'n lijst veroudert zodra er een scherm
bijkomt: alles is dicht behalve de cockpit van die ene klant en de inlogschermen. Het zit vóór de
rechten, dus het houdt ook de eigenaar tegen. De automatische nachtronden draaien er niet, zodat
werk niet dubbel gebeurt. Een proef rekent bij elke bouw na dat elke route aan de beheerkant een
poort heeft; een nieuw scherm is daarmee vanzelf dicht op de voordeur.

**Wat er níet meer apart hoeft.** Nationaal Oogcentrum met de hand aanmaken. De klantkaart
ontstaat vanzelf bij de verhuizing in stap 2, met domein `laatjeogenlaseren.nl`, zonder
klantlogin en **zonder budget, uren of facturatie**: dit is Maartens eigen tak, geen betalende
SEO-klant, dus die velden blijven leeg en de klant telt niet mee in de financiën.

**Wat jij doet.** Niets. Zolang de instelling nergens aanstaat verandert er niets aan het
dashboard zoals je het kent.

**Als het misgaat.** De instelling nergens zetten en het slot slaapt.

## Stap 2: de verhuizing, één klik (gebouwd, 18-08-2026)

**Wat er gebeurt.** In de NOC-cockpit komt één knop: "Zet deze klant over naar het
Pingwin-dashboard". Die verzamelt daar alles wat aan NOC hangt en stuurt het rechtstreeks door.
Eerst laat hij zien wat hij gaat meenemen, per soort en met aantallen, zodat je kunt kijken voor
je doorgaat. Daarna zie je dezelfde lijst nog een keer, met wat er is aangekomen ernaast.

Belangrijk: bijna alle gegevens in deze app hangen aan een klantnaam, dus de verhuizing pakt ze
alle vierenzeventig soorten in één keer mee in plaats van een handmatig lijstje. Een handjevol
dingen zit anders in elkaar (de Google-koppeling, redirects, agenda-blokken); die loop ik apart
na en meld ik apart.

**Wat jij doet.** Drie handelingen, allemaal klikwerk:
1. In het Pingwin-dashboard: Intern, Verhuizen, typ `noc` bij de klant, knop "Verhuiscode maken",
   code kopiëren.
2. In de NOC-cockpit: hetzelfde scherm, kies Nationaal Oogcentrum, plak de code, knop "Verhuizen".
3. Terug in het Pingwin-dashboard: NOC staat in je klantenlijst.

Ik kan die klikken niet zelf doen: deze omgeving mag alleen bij het Pingwin-dashboard, en
meekijken is alleen-lezen.

**Wat je daarna ziet.** Je NOC-werk staat in het Pingwin-dashboard, op de plek waar je Kamsteeg
en Strandtuin ook vindt.

**Als het misgaat.** De knop kan opnieuw. Hij vervangt per soort in plaats van er nog een set
bovenop te zetten, dus twee keer klikken geeft geen dubbele taken. En de NOC-cockpit blijft
intussen gewoon staan zoals hij was.

## Stap 3: de voordeur omzetten (klaar aan mijn kant, 19-08-2026)

**Wat er gebeurt.** Het NOC-adres gaat aan dezelfde gegevens hangen als het Pingwin-dashboard, en
het slot uit stap 1 gaat daar aan. Vanaf dat moment kijken beide adressen naar dezelfde
werkelijkheid en hoeft er nooit meer iets gesynchroniseerd te worden.

**Wat er nu ligt.** De voordeur gedraagt zich als een voordeur zodra het slot erop staat: het
menu "Intern" toont daar alleen nog wat er bestaat in plaats van vijftien links die terugkaatsen,
en de meters over het hele bureau (Ahrefs-tegoed, Claude-kosten, je meldingen) zijn er weg. En er
is een controle bijgekomen, want dit is precies het soort omzetting waarvan je aan het scherm niet
kunt zien of hij gelukt is: een voordeur die nog aan zijn oude database hangt, toont dezelfde
klant met de gegevens van gisteren. Op **Intern, Verhuizen** staat daarom onderaan het blok
"De eigen voordeur van deze klant". Je vult het adres in, drukt op de knop, en het dashboard
vraagt het aan de voordeur zelf: kijkt hij naar dezelfde gegevens, en staat het slot op deze
klant. Groen betekent klaar; anders staat er in gewone taal wat er nog moet.

**Wat jij doet.** Dit stukje kan ik niet zelf doen, want deze omgeving mag alleen bij het
Pingwin-dashboard en niet bij Vercel. In Vercel, project `noc-seo-cockpit`:

1. **Storage:** de eigen NOC-database loskoppelen van dit project, en in plaats daarvan de
   database van `pingwin-seo-dashboard` eraan koppelen. Vercel zet de sleutels dan zelf goed;
   je hoeft niets over te typen. De oude NOC-database blijf je gewoon houden, hij hangt alleen
   nergens meer aan vast.
2. **Settings, Environment Variables:** `WERELD_KLANT` op `noc` (Production).
3. **Redeploy** (of wacht op de eerstvolgende push).

Daarna druk je op die controleknop op `/admin/verhuizen`. Zolang hij niet groen is, is de
omzetting niet af, en zegt hij zelf welk van de twee nog mist.

**Wat je daarna ziet.** Precies hetzelfde scherm als nu, op hetzelfde adres. Twee verschillen: de
doorstapjes naar Pingwin-brede schermen zijn weg, en wat je in het Pingwin-dashboard aanpast staat
hier meteen ook.

**Waar je op moet letten.** Zolang alleen de database om is en het slot nog niet, is de voordeur
het hele dashboard mét alle klanten, en draaien de nachtronden een tweede keer op dezelfde
gegevens. Dat is de enige echt vervelende tussenstand, en dat is precies wat de controleknop
opvangt. Mogelijk moet de Google-koppeling daar één keer opnieuw gelegd worden.

**Als het misgaat.** Terug is de oude database weer aankoppelen. Die blijft ongemoeid staan als
bevroren reservekopie, dus je kunt altijd terug naar de situatie van vandaag.

## Stap 4: opruimen (klaar, 19-08-2026)

**Wat er gebeurt.** De automatische nachtronden draaien nu twee keer, in beide werelden, op werk
dat maar één keer nodig is. Dat wordt één keer. Verder ruimen we op wat door de verhuizing
overbodig is geworden.

**Wat er nu ligt.** Het dubbele nachtwerk stopt vanzelf zodra het slot uit stap 3 aanstaat: een
omgeving met een klantvenster slaat élke automatische ronde over, en een proef rekent dat bij elke
bouw na. Er is dus niets aan te zetten en niets om te onthouden. De twee documenten die nog
uitgingen van een losse NOC-database zijn weg, zodat niemand er later per ongeluk naar werkt.

**Wat jij doet.** Niets. De oude NOC-database mag pas weg als jij zegt dat het goed is; zolang hij
staat, is de situatie van vandaag altijd terug te halen.

**Wat het oplevert.** Je betaalt Ahrefs en Claude niet meer dubbel voor dezelfde ronde.

## Stap 5: iemand anders erbij (klaar, 19-08-2026)

**Wat er gebeurt.** De NOC-voordeur krijgt een eigen login voor een tweede persoon. Eerst alleen
meekijken, later ook meewerken. De rechten per klant zaten al in de app, dus dit was aanzetten en
afstellen, geen nieuwbouw.

**Wat er nu ligt.** Vink je bij een gast precies één klant aan en heeft die klant een eigen adres,
dan wijst alles vanzelf daarheen: de mail met inloggegevens stuurt hem naar die voordeur in plaats
van naar het dashboard met al je klanten, en in het overzicht staat per gast waar hij inlogt. Dat
is niet alleen netter maar ook veiliger, want op dat adres bestaat er geen andere klant, ook niet
als zijn rechten later verruimd worden.

**Wat jij doet.** Op Beheer een gast toevoegen, alleen Nationaal Oogcentrum aanvinken, en op
"Mail inloggegevens" drukken. Laat "mag wijzigen en uitvoeren" uit als hij eerst alleen mag
meekijken; dat vinkje kun je later aanzetten.

**Voorwaarde.** Werkt pas echt zodra stap 3 gedaan is: tot die tijd heeft de voordeur zijn eigen
database en staat jouw gast daar niet in.

---

## Waar we op letten

1. **Eén waarheid.** Na stap 3 bestaat er geen tweede NOC-administratie meer die kan verouderen.
2. **Elke stap is omkeerbaar.** Tot en met stap 3 kun je terug naar de situatie van vandaag,
   omdat de oude database blijft staan tot jij zegt dat hij weg mag.
3. **De deur wordt nagerekend, niet onthouden.** Een proef bewaakt dat de NOC-voordeur alleen NOC
   toont, zodat een later toegevoegd scherm dat niet stilletjes kan doorbreken.

## Stand

- Stap 1: klaar op 18-08-2026. Het slot staat in de code en slaapt tot het ergens aangezet wordt.
- Stap 2: klaar op 18-08-2026. Nationaal Oogcentrum staat als klant `noc` in het Pingwin-dashboard.
- Stap 3: gebouwd op 19-08-2026. De voordeur gedraagt zich als voordeur en het dashboard kan hem
  zelf controleren; wat er nog moet gebeuren is de omzetting in Vercel hierboven.
- Stap 4: klaar op 19-08-2026.
- Stap 5: klaar op 19-08-2026. Werkt zodra stap 3 gedaan is.

**Alles bij elkaar staat of valt met die ene omzetting in Vercel bij stap 3.** Zolang die niet
gedaan is, heeft de voordeur zijn eigen database: veilig om te delen (er staat alleen NOC in),
maar het is niet hetzelfde werk als in je dashboard, en een gast die je hier aanmaakt kan daar
niet inloggen.

## Technisch voetnootje

Vierenzeventig van de negenennegentig tabellen zijn klantgebonden via `client_slug`; de
verhuizing is daardoor generiek in plaats van een handmatige lijst, met een aparte pas langs de
tabellen die anders sleutelen (`oauth_tokens`, `page_redirects`, `page_canni_rows`, agenda).
Het slot is `WERELD_KLANT` in `lib/klantvenster.ts`, aangehaakt op de bestaande scope-poort
(`lib/admin-scope.ts`) plus de middleware, en bewaakt door `proeven/klantvenster.proef.ts`. De
padregel zelf staat importvrij in `lib/venster-pad.ts`, zodat de kopbalk in de browser hem kan
stellen zonder een tweede kopie. De controle loopt via `lib/omgeving.ts` (venster plus een gehashte
vingerafdruk van de database, uitgeserveerd op `/api/versie`) en `/api/admin/voordeur`; het adres
per klant staat in `clients.voordeur_url`.
De verhuizing zit in `lib/verhuizing.ts` (tabellen uit `information_schema`), `lib/verhuis-code.ts`,
`/admin/verhuizen` en `/api/verhuis-inlaad`, bewaakt door `proeven/verhuizing.proef.ts`.
