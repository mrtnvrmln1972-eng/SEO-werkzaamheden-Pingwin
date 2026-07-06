# Databronnen: hoe je de vier inputs ophaalt

De methodiek is identiek in elke omgeving; alleen de manier waarop je de data ophaalt verschilt. Haal op wat beschikbaar is, kruis op **URL**, en markeer ontbrekende bronnen in `datakwaliteit`. Deze skill deelt ~80% van zijn datalaag met de cannibalisatie-analyse (GSC, Ahrefs, crawl); hergebruik dezelfde bronnen.

## 1. Crawl (de structurele waarheid: de interne linkgraaf)
Doel: welke pagina linkt naar welke, met welke **ankertekst** en op welke **positie in de content**, plus **intern Link Score / PageRank**, **click depth** en **indexeerbaarheid** per URL.

- **In Cowork:** een Screaming Frog-export.
  - `internal_all` / de "Inlinks" en "Outlinks" exports geven de volledige linkgraaf met bron, doel, ankertekst en linkpositie.
  - Screaming Frog berekent **Link Score** (intern PageRank) per URL, en **Crawl Depth** (click depth). Gebruik die direct.
  - Filter niet-indexeerbare pagina's en redirects eruit als linkdoel.
- **In het Pingwin-dashboard:**
  - De crawl-motor (`fetch_page_content` / `measurePage`) leest per pagina de interne links, ankerteksten en de positie in de content (hoofdcontent vs. footer/sidebar). Bouw hieruit de linkgraaf als datastructuur.
  - `client_urls` bevat de live status en redirects (voor de hygiëne-checks en de cannibalisatie-koppeling).
  - Intern Link Score: er is geen kant-en-klare PageRank-iteratie; **benader** de interne autoriteit via het aantal interne inkomende links per pagina (uit de gebouwde graaf) en markeer in `datakwaliteit` dat dit een benadering is. Click depth benader je via de kortste klik-afstand vanaf de homepage in de graaf.

## 2. Ahrefs (autoriteit + waarde per pagina)
Doel: **URL Rating** per URL (welke pagina's het meeste linkjuice te vergeven hebben), **pages-by-internal-links**, en **organic keywords** per pagina.

- **In Cowork:** Ahrefs MCP.
  - `site-explorer-url-rating-history` voor URL Rating per pagina.
  - `site-explorer-pages-by-internal-links` voor de interne-link-tellingen.
  - `site-explorer-linked-anchors-internal` voor de bestaande interne ankerteksten.
  - `site-explorer-organic-keywords` per URL voor de topische context.
- **In het Pingwin-dashboard:** `lib/ahrefs.ts`.
  - `getUrlOrganicKeywords(url, ...)` en `getSiteOrganicKeywords(domain, ...)` voor de zoekwoorden per URL/domein.
  - URL Rating per pagina is (op moment van schrijven) nog niet als kant-en-klare functie aanwezig; gebruik `ahrefsFetch(path, params)` tegen `site-explorer/url-rating-history` of markeer de externe-autoriteit-weging als ontbrekend (`ahrefsUrlRating: false`) en leun op intern Link Score + GSC-verkeer. Let op de credit-kosten van per-URL-calls; zet dit alleen aan waar het de winnaar-keuze echt beïnvloedt.

## 3. GSC (verkeer, om bronnen te kiezen die bezoekers sturen)
Doel: **klikken, impressies en positie per pagina**, zodat je bronpagina's kiest die sterk én bezocht zijn, en de voortgang van doelpagina's meet.

- **In Cowork:** de GSC-connector / MCP-tools (per pagina klikken/impressies/positie; per doelpagina de positie op het primaire keyword voor de meting).
- **In het Pingwin-dashboard:** `lib/google.ts`.
  - `getGscForClient(domain)` en `getGscQueryPageMatrix(domain, days, limit)` voor klikken/impressies/positie per pagina en per zoekwoord → pagina.
  - Voor de striking-distance-selectie (fase 1) filter je op pagina's die op positie 5-15 staan.

## 4. Content mapping / keywordpaspoort (de hiërarchie + primaire zoekwoorden)
Doel: per doelpagina de **laag** (pillar of dochter), het **cluster/thema**, en het **primaire zoekwoord + varianten** (voor de ankertekst-variatie).

- **In Cowork:** de door de gebruiker aangeleverde content mapping / het keywordpaspoort (spreadsheet of document).
- **In het Pingwin-dashboard:** de klant-cockpit-velden en de pagina-documenten (page docs) bevatten de content mapping en de primaire zoekwoorden per pagina; leid de pillar-dochter-structuur hieruit af, of uit het URL-patroon (een pillar zit hoger in de hiërarchie, dochters eronder).

## Kruisen op URL, en de iteratie
Koppel de vier bronnen op de sleutel **URL**. Zo krijg je per doelpagina: de bestaande inkomende links + ankers (crawl), de autoriteit van elke potentiële bron (Ahrefs URL Rating + intern Link Score), het verkeer per bron (GSC), en de laag in de hiërarchie (content mapping). Bij een **terugkerende run** herbouw je de graaf op verse crawl-data, lees je het opgebouwde ankerprofiel per doelpagina, en weeg je het effect van de vorige ronde (GSC-positie) mee in de prioritering. Dat kruisen én itereren is precies wat losse interne-link-tools missen.
