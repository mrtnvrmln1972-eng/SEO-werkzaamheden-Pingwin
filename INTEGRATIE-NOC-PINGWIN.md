# Integratieplan: NOC-dashboard en Pingwin SEO-dashboard

Datum: 2026-06-27
Status: voorstel, nog niets gebouwd. Bedoeld om rustig te bekijken en te beslissen waar we beginnen.

## Het doel in één zin

De SEO-analyse die we in het NOC-dashboard per pagina doen (wat kan beter, wat moet er gebeuren) moet automatisch werkzaamheden worden in de planning van het Pingwin-dashboard, die je daarna kunt doorzetten naar de developer en kunt tonen in het klant-dashboard. En dat voor meerdere klanten, niet alleen NOC.

## Hoe het er nu bij staat

**NOC-dashboard** (single-client, alleen NOC):
- De *motor*. Per pagina: mapping, blauwdruk, copy, grounding op live data.
- Per-pagina SEO-chat, gegrond in echte data (live HTTP-status, live titel, GSC-rankings, Ahrefs top-10, site-context, bestaande acties).
- Helikopteranalyse: site-brede rol en advies per pagina, cannibalisatie-signalen, typed cross-page acties.
- Wat er nog niet is: één centrale "vraag-me-alles"-chat per klant, en multi-client met login.

**Pingwin SEO-dashboard** (multi-client, met login):
- De *cockpit*. Per klant: Overzicht (mail + stand van zaken), Werkzaamheden (planning per maand, SEO en developer gescheiden, uren en budget), KPI's, Klant-dashboard.
- Mailkoppeling (Microsoft 365), project-chat per klant, data-brug (ingest-deur) die snapshots in de database zet.
- Werkzaamheden staan in de database (tabel `client_tasks`), niet meer in Google Sheets.

Kortom: NOC is sterk in *analyse*, Pingwin is sterk in *planning en uitvoering*. Ze vullen elkaar aan.

## Het uitgangspunt: veiligste pad

Niet samenvoegen tot één codebase, niet één database er bovenop dwingen, niets migreren wat werkt. We koppelen in plaats van te verbouwen. Elke stap is additief (voegt iets toe, breekt niets), omkeerbaar, en heeft op zichzelf al waarde. De zware stap (NOC multi-client maken) doen we pas als de lichte koppeling zich bewezen heeft.

---

## Fase 1: dunne eenrichtings-brug (analyse → werkzaamheid)

**Wat:** in de NOC-pagina-cockpit komt één knop, bijvoorbeeld "Zet door als werkzaamheid". Die stuurt de gevonden actie (titel, toelichting, betrokken URL, type) naar de Werkzaamheden van de juiste klant in het Pingwin-dashboard, via de ingest-deur die er al is.

**Waarom dit eerst:** het is de kleinste mogelijke stap met de grootste leerwaarde. We verplaatsen geen data, we zetten alleen een actie door. Aan NOC verandert niets behalve dat ene knopje.

**Keuzes in deze fase:**
- Koppelen we per losse actie (één knop per advies) of per pagina in bulk (alle acties van een pagina tegelijk)? Voorstel: beginnen met per losse actie, dat is het meest controleerbaar.
- Welke klant hoort bij welke NOC-pagina? In fase 1 is dat simpel: NOC is de enige klant, dus alles gaat naar de Pingwin-klant "NOC". Pas in fase 3 wordt dit echt meerdere klanten.
- Standaard zichtbaarheid van de doorgezette taak: voorstel SEO-taak (klant-zichtbaar mag, developer-taak intern).

**Risico:** zeer laag. Puur toevoegen.

---

## Fase 2: centrale chat per klant die de analyse meeleest

**Wat:** de project-chat die in het Pingwin-dashboard al per klant bestaat, laten we ook de NOC-analyse meelezen (de helikopter-rol, de per-pagina-conclusies, de cannibalisatie-signalen). Dan kun je daar overkoepelend vragen stellen ("hebben we alle steden en landingpagina's gehad, structured data klaar, wat is de eerstvolgende actie, hoe zit de cannibalisatie op zoekterm X") en het antwoord meteen als werkzaamheid doorzetten naar de planning.

**Waarom hier:** dit is de "centrale chat" die je wilt, maar opgebouwd uit wat er al is. We hoeven geen nieuwe motor te bouwen, alleen de bestaande chat meer context te geven.

**Keuzes in deze fase:**
- Leest de chat de NOC-analyse live in (altijd actueel, maar afhankelijk van een koppeling) of uit een snapshot via de ingest-deur (eenvoudiger, iets minder vers)? Voorstel: snapshot via de bestaande data-brug, net als nu met mail en GSC.
- Mag de chat zelf werkzaamheden aanmaken, of alleen voorstellen die jij met een knop overneemt? Voorstel: voorstellen met overnemen-knop, net als de cross-page acties in NOC. Geen acties zonder jouw akkoord.

**Risico:** laag. De chat bestaat al, we breiden alleen de context uit.

---

## Fase 3: NOC multi-client maken (de zware stap)

**Wat:** het NOC-dashboard geschikt maken voor meerdere klanten: `client_id` overal mee, een login, en een klant-keuze net als in het Pingwin-dashboard. Dan kun je de hele SEO-cyclus (mapping, helikopter, chat) voor elke klant draaien, niet alleen NOC.

**Waarom als laatste:** dit is het grootste werk en raakt het meeste aan. We doen het pas als fase 1 en 2 bewezen hebben dat de koppeling klopt en bruikbaar is. De bestaande NOC-data blijft ongemoeid (NOC wordt gewoon de eerste klant in het multi-client model).

**Keuzes in deze fase:**
- Welk dashboard wordt uiteindelijk de voordeur? Optie A: Pingwin blijft de cockpit met login en NOC wordt daar als motor achter gehangen. Optie B: alles verhuist naar één nieuw, hernoemd dashboard. Voorstel: A, want dan houden we de werkende login en multi-client structuur die er al is.
- Doen we de NOC-tabellen om naar `client_id`, of draaien we per klant een eigen set? Voorstel: `client_id` toevoegen (additief), zoals in CLAUDE.md al als principe staat.
- Wat gebeurt er met de losse NOC-deployment? Voorstel: laten draaien tot de multi-client versie volledig overgenomen heeft, daarna pas uitfaseren.

**Risico:** hoog als we het in één keer doen, laag als we het strikt additief en gefaseerd doen. Daarom apart plannen wanneer het zover is.

---

## Wat ik adviseer als startpunt

Beginnen met **fase 1**: de ene knop "Zet door als werkzaamheid" in de NOC-pagina-cockpit, die naar de Pingwin-werkzaamheden schrijft. Klein, veilig, en je ziet meteen of de flow (analyse leidt tot een concrete taak in de planning) prettig werkt. Op basis daarvan beslissen we over fase 2.

## Wat ik nu NIET doe

Niets bouwen aan deze integratie tot jij zegt: begin bij fase X. Dit document is alleen om op te beslissen.
