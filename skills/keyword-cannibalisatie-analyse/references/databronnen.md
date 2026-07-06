# Databronnen: hoe je de drie inputs ophaalt

De methodiek is identiek; alleen de manier waarop je de data ophaalt verschilt per omgeving. Haal op wat beschikbaar is, en markeer ontbrekende bronnen in `datakwaliteit`.

## 1. Google Search Console (waarheid over Google's gedrag)
Doel: een **zoekwoord → URL-matrix** met impressies, klikken en positie, en waar mogelijk **wekelijkse snapshots over ~90 dagen** voor URL-flip-detectie.

- **In Cowork:** gebruik de GSC-connector / MCP-tools voor Search Console. Vraag per query de bijbehorende pagina's op (dimensions: query + page), over de laatste 90 dagen; herhaal per week (of per beschikbaar tijdvenster) om flips te zien.
- **In het Pingwin-dashboard:** `lib/google.ts`.
  - `getGscQueryPageMatrix(domain, days, limit)` geeft de zoekwoord → pagina-matrix (welke pagina rankt op welk zoekwoord, met positie/klikken/impressies). Dit is de basis voor het clusteren.
  - Voor de tijdreeks (flip-detectie) draai je de matrix over meerdere periodes/weken en vergelijk je welke URL per zoekwoord de rankende is. Ontbreekt een tijdreeks, markeer dat flip-detectie beperkt is en leun zwaarder op positie-plafond + klik-verdeling.

## 2. Ahrefs (SERP-context + waarde)
Doel: **backlinks/verwijzende domeinen per URL** (voor de winnaar-weging), **SERP-positie-historie** per keyword (flip over tijd), en **volume/difficulty** (loont consolidatie?).

- **In Cowork:** Ahrefs MCP.
  - Organische zoekwoorden per URL en per domein (site-explorer organic keywords).
  - Verwijzende domeinen / backlinks per URL (site-explorer refdomains / backlinks-stats).
  - Positie-historie per keyword (rank tracker / keyword history) voor flips.
  - Volume + difficulty per keyword (keywords explorer).
- **In het Pingwin-dashboard:** `lib/ahrefs.ts`.
  - `getSiteOrganicKeywords(domain, ...)` en `getUrlOrganicKeywords(url, ...)` voor de zoekwoorden per domein/URL.
  - `getKeywordsOverview(keywords, ...)` voor volume/difficulty.
  - Per-URL verwijzende domeinen/UR zijn (op moment van schrijven) nog niet als kant-en-klare functie aanwezig; gebruik `ahrefsFetch(path, params)` tegen de juiste site-explorer-endpoints, of markeer backlink-data als ontbrekend en gebruik klikken/impressies als proxy voor waarde.

## 3. Crawl (structuur)
Doel: **interne link-distributie, canonicals, redirects, indexeerbaarheid** per URL.

- **In Cowork:** een Screaming Frog-export (CSV) inladen, of per pagina de HTML uitlezen om interne links + canonical + meta-robots te bepalen.
- **In het Pingwin-dashboard:** `fetch_page_content` / `measurePage` (uit de bestaande motor) om per pagina koppen, interne links en on-page signalen op te halen; `client_urls` bevat de live status/redirects.

## Kruisen op keyword + URL
Koppel de drie bronnen op de sleutel **(zoekwoord, URL)**. Zo krijg je per zoekwoord-cluster: alle rankende URL's (GSC), hun waarde (Ahrefs backlinks + GSC klikken), hun onderlinge link-structuur (crawl) en of Google door de tijd heen wisselt (GSC-tijdreeks / Ahrefs-historie). Dat kruisen is precies wat single-tool-analyses missen.
