# Tweede wereld opzetten (eigen omgeving voor NOC)

> **Let op (18-08-2026): achterhaald op één punt.** Wereld 2 krijgt géén eigen database
> meer, maar wordt een afgeschermde voordeur op het Pingwin-dashboard. Zie
> `NOC-NAAR-PINGWIN.md`. De stappen hieronder blijven staan als geschiedenis van hoe
> wereld 2 is opgezet.

Dit is de enige stap waar jij zelf iets moet doen. Alles hieronder gebeurt in je
eigen Vercel-account en Google Cloud. Reken op 20 tot 30 minuten. Volg de stappen
op volgorde, één voor één.

## Het idee in het kort

- **Zelfde software, aparte omgeving.** Wereld 2 draait exact dezelfde code als je
  huidige Pingwin-dashboard, maar met een **eigen database** en een **eigen adres**.
- **Automatische sync.** Beide omgevingen hangen aan dezelfde GitHub (`main`). Eén
  keer pushen werkt allebei bij. Je hoeft nooit iets te kopiëren.
- **Harde scheiding.** Wereld 2 heeft een eigen, lege database. Er is dus fysiek
  geen andere-klant-data aanwezig. NOC wordt de eerste klant die je erin aanmaakt.

## Stap 1: nieuw Vercel-project aanmaken (zelfde GitHub)

1. Ga naar Vercel, klik **Add New… → Project**.
2. Kies dezelfde GitHub-repo als nu: **`mrtnvrmln1972-eng/SEO-werkzaamheden-Pingwin`**.
3. Geef het project een eigen naam, bijvoorbeeld **`noc-seo-cockpit`**.
4. Production Branch: **`main`** (zodat een push allebei de werelden bijwerkt).
5. Nog **niet** deployen; eerst de database en de sleutels (stap 2 en 3). Als Vercel
   toch meteen bouwt, is dat niet erg, we deployen aan het eind opnieuw.

## Stap 2: eigen database koppelen (Neon)

1. Open het nieuwe project → tab **Storage** → **Create Database** → **Neon** (Postgres).
2. Maak een **nieuwe** database aan (niet de bestaande van Pingwin kiezen). Geef hem
   een eigen naam, bijvoorbeeld `noc-cockpit-db`.
3. Koppel hem aan dit project. Vercel zet dan automatisch de database-sleutels klaar
   (`POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `DATABASE_URL`). Die hoef je niet zelf
   in te typen.
4. De tabellen maakt de app zelf aan bij de eerste keer laden (zelfhelend schema).
   Omdat je `SEED_DEMO_CLIENTS` niet zet (zie stap 3), start deze wereld **leeg**.

## Stap 3: de sleutels (env-variabelen) zetten

Project → **Settings → Environment Variables**. Zet ze op **Production** (en Preview
mag ook). De database-sleutels uit stap 2 staan er al.

**Verplicht (eigen, uniek voor deze wereld):**

| Variabele | Waarde |
|---|---|
| `SESSION_SECRET` | Een nieuwe, lange, willekeurige tekst (eigen voor deze wereld). |
| `ADMIN_PASSWORD` | Een nieuw adminwachtwoord voor jouw inlog op deze wereld. |

**Voor de SEO-motor (zelfde diensten, eigen of gedeelde sleutel):**

| Variabele | Waarvoor |
|---|---|
| `ANTHROPIC_API_KEY` | De AI (chat, analyses, documenten). |
| `AHREFS_API_TOKEN` | Ahrefs (zoekwoorden, SERP, volumes). |
| `GOOGLE_CLIENT_ID` | Google-koppeling (Search Console + Analytics). |
| `GOOGLE_CLIENT_SECRET` | Idem. |
| `GOOGLE_API_KEY` | Google-data ophalen. |

**Optioneel:**

| Variabele | Waarvoor |
|---|---|
| `MS_CLIENT_ID`, `MS_CLIENT_SECRET`, `MS_TENANT_ID` | Microsoft 365 mail in de cockpit. Alleen nodig als je de mailkoppeling ook hier wilt. |
| `PAGESPEED_API_KEY` | PageSpeed-metingen. |
| `CRON_SECRET` | Beveiligt de automatische wekelijkse verversing. |

**Bewust NIET zetten:** `SEED_DEMO_CLIENTS`. Laat die weg, dan blijft de klantenlijst
leeg en verschijnen je Pingwin-demoklanten hier niet.

> Sleutels als `ANTHROPIC_API_KEY` en `AHREFS_API_TOKEN` mag je dezelfde gebruiken
> als in je huidige wereld, of een aparte nemen. Met het verbruik-dashboard zie je
> per wereld wat er verbruikt wordt, dus een aparte sleutel per wereld maakt de
> kosten het duidelijkst te scheiden.

## Stap 4: deployen

1. Project → **Deployments** → **Redeploy** (of push een kleine wijziging; dat
   deployt allebei de werelden).
2. Wacht tot de deploy groen is.
3. **Settings → Deployment Protection → uitschakelen** (jouw vaste check).
4. **Settings → Domains →** controleer het groene vinkje op het `*.vercel.app`-adres.
   Een eigen domein kun je later toevoegen.

## Stap 5: Google (en eventueel Microsoft) koppelen

De Google-koppeling gebruikt een terugkeer-adres (redirect) dat per omgeving anders
is, dus dat moet je één keer toevoegen in Google Cloud.

1. Google Cloud Console → jouw OAuth-client → **Authorized redirect URIs** → voeg toe:
   `https://<jouw-nieuwe-adres>.vercel.app/api/google/auth/callback`
2. Open daarna je nieuwe dashboard, ga naar een klant/pagina en klik de
   **Google koppelen**-knop; log in met het Google-account dat bij NOC hoort.
3. (Optioneel, alleen bij MS-mail) Doe hetzelfde voor Microsoft: in Azure de redirect
   `https://<jouw-nieuwe-adres>.vercel.app/api/ms/auth/callback` toevoegen, daarna in
   het dashboard **Koppel Microsoft**.

## Stap 6: NOC aanmaken en aan de slag

1. Ga naar `https://<jouw-nieuwe-adres>.vercel.app/admin` en log in met het
   `ADMIN_PASSWORD` uit stap 3.
2. Klik **+ Nieuwe klant aanmaken** en maak **Nationaal Oogcentrum** aan (naam,
   inlognaam, domein `laatjeogenlaseren.nl`, eventueel de Sheet-link en budgetten).
3. Lees de website in en draai de gewone cyclus, net als je gewend bent.

## Klaar

Vanaf nu: elke verbetering die ik in de code doe en push, komt automatisch in
**beide** werelden terecht. Jij beheert wereld 2 en kunt daar later klanten van een
collega bij zetten; die krijgen dan hun eigen toegang (dat is de rechten-per-klant
laag, die we bouwen zodra je die stap zet, en die niet nodig is zolang NOC de enige
klant in deze wereld is).
