# Nationaal Oogcentrum naar het Pingwin-dashboard

Stappenplan, opgesteld 18 augustus 2026. Akkoord van Maarten op de richting, nog niets gebouwd.

Dit plan vervangt `INTEGRATIE-NOC-PINGWIN.md` (27-06-2026, achterhaald) en gaat vóór de
`WERELD-2-NOC-CHECKLIST.md`, want die gaat nog uit van een eigen, losse database voor NOC.

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

## Stap 1: klaarzetten (er verandert nog niets zichtbaars)

**Wat er gebeurt.** Nationaal Oogcentrum wordt aangemaakt als klant in het Pingwin-dashboard,
met domein `laatjeogenlaseren.nl`. Zonder eigen klantlogin, want NOC hoort in de cockpit en heeft
geen klantdashboard nodig. Daarnaast bouw ik het slot voor de NOC-voordeur: één instelling die
zegt "op dit adres bestaat alleen deze klant", en die dat afdwingt op elk scherm en elke knop,
niet als afspraak maar hard. Er komt meteen een proef bij die de bouw laat mislukken zodra er
ooit een scherm bijkomt dat zich er niet aan houdt.

**Wat jij doet.** Niets, behalve later even kijken of de klantkaart klopt.

**Wat je daarna ziet.** Een lege NOC in je klantenlijst. De NOC-cockpit werkt gewoon door.

**Als het misgaat.** Klant weer weghalen, verder is er niets geraakt.

## Stap 2: de verhuizing, één klik

**Wat er gebeurt.** In de NOC-cockpit komt één knop: "Zet deze klant over naar het
Pingwin-dashboard". Die verzamelt daar alles wat aan NOC hangt en stuurt het rechtstreeks door.
Eerst laat hij zien wat hij gaat meenemen, per soort en met aantallen, zodat je kunt kijken voor
je doorgaat. Daarna zie je dezelfde lijst nog een keer, met wat er is aangekomen ernaast.

Belangrijk: bijna alle gegevens in deze app hangen aan een klantnaam, dus de verhuizing pakt ze
alle vierenzeventig soorten in één keer mee in plaats van een handmatig lijstje. Een handjevol
dingen zit anders in elkaar (de Google-koppeling, redirects, agenda-blokken); die loop ik apart
na en meld ik apart.

**Wat jij doet.** Eén keer op die knop klikken. Ik kan er vanaf mijn kant niet bij, want deze
omgeving mag alleen bij het Pingwin-dashboard.

**Wat je daarna ziet.** Je NOC-werk staat in het Pingwin-dashboard, op de plek waar je Kamsteeg
en Strandtuin ook vindt.

**Als het misgaat.** De knop kan opnieuw. Hij vervangt per soort in plaats van er nog een set
bovenop te zetten, dus twee keer klikken geeft geen dubbele taken. En de NOC-cockpit blijft
intussen gewoon staan zoals hij was.

## Stap 3: de voordeur omzetten

**Wat er gebeurt.** Het NOC-adres gaat aan dezelfde gegevens hangen als het Pingwin-dashboard, en
het slot uit stap 1 gaat daar aan. Vanaf dat moment kijken beide adressen naar dezelfde
werkelijkheid en hoeft er nooit meer iets gesynchroniseerd te worden.

**Wat jij doet.** Eén handeling in Vercel om het NOC-project aan de database van het
Pingwin-dashboard te koppelen. Ik zoek eerst uit of ik dat zelf kan doen; kan het, dan hoef jij
niets. Mogelijk moet de Google-koppeling daar één keer opnieuw gelegd worden.

**Wat je daarna ziet.** Precies hetzelfde scherm als nu, op hetzelfde adres. Twee kleine
verschillen: de doorstapjes naar Pingwin-brede schermen zijn weg (het linkje "alle klanten"
bijvoorbeeld), en wat je in het Pingwin-dashboard aanpast staat hier meteen ook.

**Als het misgaat.** Terug is één instelling omzetten. De oude NOC-database blijft ongemoeid
staan als bevroren reservekopie, dus je kunt altijd terug naar de situatie van vandaag.

## Stap 4: opruimen

**Wat er gebeurt.** De automatische nachtronden draaien nu twee keer, in beide werelden, op werk
dat maar één keer nodig is. Dat wordt één keer. Verder ruimen we op wat door de verhuizing
overbodig is geworden.

**Wat jij doet.** Niets.

**Wat het oplevert.** Je betaalt Ahrefs en Claude niet meer dubbel voor dezelfde ronde.

## Stap 5: iemand anders erbij

**Wat er gebeurt.** De NOC-voordeur krijgt een eigen login voor een tweede persoon. Eerst alleen
meekijken, later ook meewerken. De rechten per klant zitten al in de app, dus dit is aanzetten en
afstellen, geen nieuwbouw.

**Wat jij doet.** Zeggen wie het wordt en of diegene mag wijzigen of alleen kijken.

**Voorwaarde.** Dit gebeurt pas als het slot uit stap 1 er staat en de proef groen is. Zolang jij
de enige bent die inlogt, is het risico klein; zodra er iemand van buiten bij kan, moet die deur
aantoonbaar dicht zijn.

---

## Waar we op letten

1. **Eén waarheid.** Na stap 3 bestaat er geen tweede NOC-administratie meer die kan verouderen.
2. **Elke stap is omkeerbaar.** Tot en met stap 3 kun je terug naar de situatie van vandaag,
   omdat de oude database blijft staan tot jij zegt dat hij weg mag.
3. **De deur wordt nagerekend, niet onthouden.** Een proef bewaakt dat de NOC-voordeur alleen NOC
   toont, zodat een later toegevoegd scherm dat niet stilletjes kan doorbreken.

## Technisch voetnootje

Vierenzeventig van de negenennegentig tabellen zijn klantgebonden via `client_slug`; de
verhuizing is daardoor generiek in plaats van een handmatige lijst, met een aparte pas langs de
tabellen die anders sleutelen (`oauth_tokens`, `page_redirects`, `page_canni_rows`, agenda).
Het slot komt op de bestaande scope-poort (`lib/admin-scope.ts`, `guardSlug`) plus middleware, met
een nieuwe proef in `proeven/`.
