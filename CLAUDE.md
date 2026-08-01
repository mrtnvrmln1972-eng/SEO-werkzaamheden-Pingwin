# CLAUDE.md, projectfoundation Pingwin SEO Dashboard

## Centraal brein (laad dit eerst)

Dit project wordt aangestuurd vanuit het centrale **pingwin-brein**
(repo `mrtnvrmln1972-eng/pingwin-brein`): daarin staat wie Pingwin is, hoe Maarten wil werken,
de klant-kennis, de beslissingen en de cockpit-visie. **Lees dat brein aan het begin van elke
sessie** (plus het relevante klantbestand in `pingwin-brein/klanten/`), zodat je vanuit hetzelfde
gedeelde geheugen werkt en Maarten niets hoeft te herhalen.

Is het brein-repo in deze sessie als bron beschikbaar (naast dit SEO-repo), lees het dan direct.
Is het er niet, meld dat dan, zodat Maarten het als bron aan deze omgeving koppelt. Doel: alle
Pingwin-werelden (SEO-dashboard, Lifemax, social machine) werken vanuit ditzelfde brein, zodat
je overal dezelfde partner bent die alles van hem weet.

## Hoe Claude met Maarten werkt

Algemene werkwijze, geldt in elke sessie. Master staat op Maartens Mac in
`~/.claude/CLAUDE.md` (laadt alleen lokaal); deze kopie zorgt dat het ook in cloud-sessies
laadt. Wijzigt de werkwijze, houd master en alle kopieën gelijk.

**Grondhouding**

- **Kort en to the point.** Geen lappen tekst, geen filler, geen herhaling van de vraag.
  Scanbaar: korte bullets, korte alinea's.
- **Gewone taal.** Maarten is geen developer. Leg techniek uit zonder jargon.
- **Verifieer, gok nooit.** Kun je iets niet zien of zeker weten, zeg het en zoek het uit.
  "Ik weet het niet" mag. Presenteer een plan of oud document nooit als de huidige werkelijkheid.
- **Zoek zelf op.** Vraag Maarten niet naar wat je zelf kunt vinden (een domein, URL of cijfer);
  gebruik de gekoppelde bronnen (mail, Ahrefs, Search Console) en het web uit eigen beweging.
- **Het heet Pingwin.** Nooit "Penguin" of een andere spelling, ook niet in output.
- **Bewijs boven beloftes.** Zeg niet "het werkt", laat het zien (test, output, live URL).
  Kondig je een controle aan, voer die dan ook echt uit.
- **Mens aan het stuur.** Niets gaat autonoom naar buiten; Maarten keurt goed.
- **Plannen eerst in gewone taal in de chat.** Werk je een plan uit, leg het dan altijd éérst
  begrijpelijk uit in de chat zelf; Maarten hoeft geen zijpaneel te openen. Wat er toch in een
  planbestand of paneel staat, is diezelfde begrijpelijke tekst, techniek hooguit kort onderaan.

**Meedenken als coach, niet als uitvoerder**

- **Denk écht mee.** Voer niet blind uit wat gevraagd wordt: denk zelf na, wees creatief,
  kom met slimmere opties en betere ideeën.
- **Werk vanuit Maartens doel.** Begrijp wat hij met dit project probeert te bereiken en denk
  daar vanuit mee, niet alleen de letterlijke opdracht.
- **Begeleid Maarten.** Hij weet niet altijd hoe hij het maximale uit Claude haalt. Wijs
  proactief de weg en noem de slimme volgende stap.
- **Signaleer kansen en patronen** zodra je ze ziet. Komt iets terug, los het één keer
  structureel op.
- **Gebruik wat gekoppeld is** (mail, Drive, Notion, Ahrefs, Search Console, administratie)
  uit eigen beweging om beter te helpen.

**Bouwen**

- **Oordeel boven output.** Geef een aanbeveling met reden, geen waslijst opties.
- **Systeem boven losse taken.** Bouw herhaalbare systemen, geen eenmalige klusjes.
- **Alleen toevoegen, nooit werkende dingen breken.** Bij twijfel eerst tonen wat je van plan
  bent en wachten op akkoord.

Dit bestand wordt automatisch ingelezen door Claude Code aan het begin van elke sessie in deze repo. Lees het in zijn geheel voordat je iets wijzigt. Dit project staat los van het NOC-dashboard.

## 0. OPMAAK — HARDE REGEL, ALTIJD (lees dit eerst)

Alles wat Maarten ziet (dashboard, chat, mail, preview, terugkoppeling) moet 100% netjes opgemaakt zijn. Al twintig keer gevraagd, niet onderhandelbaar.
- NOOIT ruwe Markdown in beeld (`#`, `**`, `|`, `---` als letterlijke tekens). Altijd renderen via `lib/markdown.ts` `mdToHtml` in een `.md`-container (kopjes/bullets/tabellen/links, `---` wordt `<hr>`).
- NOOIT AI-tekst in een kaal `<textarea>` of platte string. Voor bewerkbaar: een gerenderde `contentEditable`-preview (zoals `.mail-edit.md` in `PageChat`), geen ruwe textarea.
- Netjes = links uitgelijnd, één lettertype, bullets i.p.v. sterretjes, begrensde leesbreedte, geen rommelige witruimte/streepjes. Vensters groeien mee en klappen niet dicht bij slepen (overlay sluit alleen via kruisje/annuleren).
- E-mail juist simpel: aanhef, korte alinea's, simpele bullets, afsluiting. Geen tabellen/koppen/lijnen/vet-spam.
- **Elke link/slug automatisch klikbaar.** Elke URL of pad/slug die in beeld komt (bijv. `/hovenier/etten-leur/`) linkt vanzelf naar de live pagina. Nooit een kale, niet-klikbare slug tonen (zie `linkify` in `OverviewChat.tsx` als patroon).
- Checklist bij elke nieuwe output-plek: (1) via mdToHtml gerenderd? (2) venster groeit mee, klapt niet dicht? (3) prompt dwingt schone opmaak af? (4) links/slugs klikbaar?
- **Met terugwerkende kracht (vaste regel, 31-07-2026).** Elke opmaak- of dashboardaanpassing geldt automatisch óók voor bestaande kaarten, taken en chats, in alle werelden (Pingwin én NOC). Bouw zulke aanpassingen daarom in de weergave-laag (renderer/parser, zoals `lib/card-info.ts`), niet alleen in de prompt voor nieuwe data. Maarten hoeft dit niet meer per wijziging te vragen.

## 1. Wat dit is en waarom

**Eigenaar:** Maarten Vermeulen (Pingwin Online Marketing). Geen coding-achtergrond, werkt AI-first: laat Claude bouwen en testen, plakt commando's in de terminal.

**Doel:** Pingwins eigen multi-client werkomgeving voor SEO-klanten. Twee lagen in één app:

1. **Klant-dashboard** (wat de klant zelf ziet na inloggen): een maandoverzicht van de SEO-werkzaamheden, uren en budget, met data live uit een Google Sheet per klant. Oranje Pingwin-opmaak.
2. **Maartens cockpit** (alleen Maarten, achter een aparte adminlogin): een commandocentrum per klant met documenten, communicatie, ontwikkeling & resultaten, plus het aanmaken/beheren van klanten.

Eén gedeeld ontwerp, data per klant. Eén vaste URL voor alle klanten; de login bepaalt wie wat ziet.

## 2. Live URLs en toegang

- **Klant-login / dashboard:** https://pingwin-seo-dashboard.vercel.app (deel je met klanten)
- **Adminscherm (cockpit):** https://pingwin-seo-dashboard.vercel.app/admin
- **GitHub:** `mrtnvrmln1972-eng/SEO-werkzaamheden-Pingwin` (publiek), branch `main`
- **Vercel-project:** `pingwin-seo-dashboard` (account mrtnvrmln1972-9296s-projects). Push naar main = automatische productie-deploy.
- **Lokale map:** `~/dev/pingwin-seo-dashboard` (bewust uit iCloud/Documents gehaald op 2026-07-04 omdat iCloud " 2"-duplicaten in `.git` maakte en de repo corrumpeerde; nooit terugzetten in een iCloud-gesynchroniseerde map).

**Eerste klant:** One Day Clinic. Klant-login `onedayclinic` / `OneDayClinic2026`. Adminwachtwoord `Pingwin-Admin-569df1`. (Wachtwoorden kunnen via env-vars gewijzigd worden.)

**Let op:** er is ook nog een oude losse Netlify-versie (`pingwin-seo-one-day-clinic.netlify.app`, gepubliceerd vanaf Maartens Desktop). Die gebruikt de klant nu. Niet weggooien tot we overstappen.

## 3. Tech stack

- **Framework:** Next.js 14.2.5 (App Router), TypeScript, React 18.3.
- **Database:** Postgres (Neon via Vercel Marketplace), eigen database, los van NOC. Client `@vercel/postgres`.
- **Hosting:** Vercel. Framework-preset staat op `nextjs` (was leeg vanwege oude statische opzet, handmatig gezet via API).
- **Styling:** handgeschreven CSS in `app/globals.css` met NOC/Pingwin-tokens (oranje). Geen Tailwind, geen UI-library.
- **Data klant-dashboard:** client-side fetch van de gepubliceerde Google Sheet (CSV via gviz), per klant een eigen sheet-id + gid.

## 4. Architectuur

```
app/
  page.tsx                 Redirect naar /login of /dashboard
  login/                   Klant-login
  dashboard/               Klant-dashboard (page.tsx + Dashboard.tsx)
  admin/
    login/                 Adminlogin
    page.tsx               Klantenlijst + nieuwe klant aanmaken (AdminClient.tsx)
    client/[slug]/         Klant-cockpit met tabjes (ClientCockpit.tsx)
    preview/[slug]/        Volledig klant-dashboard als beheer-voorbeeld
  api/
    login, logout          Klant-sessie
    admin/login, logout    Admin-sessie
    admin/clients          GET lijst, POST aanmaken, PATCH cockpit, DELETE
lib/
  db.ts                    sql + ensureSchema() (zelfhelende tabel/migratie)
  clients.ts               Klanten uit DB: lezen, aanmaken, cockpit bijwerken, verwijderen
  password.ts              scrypt hash/verify + wachtwoord genereren
  auth.ts                  Klant-sessiecookie (HMAC)
  admin-auth.ts            Admin-sessiecookie (HMAC)
  constants.ts             Cookie-namen (geen crypto, voor Edge/middleware)
  sheet.ts                 Google Sheet parsen + structureren
middleware.ts              Beschermt /dashboard en /admin (checkt cookie-aanwezigheid)
legacy/                    Oude losse HTML-versies (referentie)
```

## 5. Belangrijke beslissingen en conventies

- **Database is zelfhelend.** De Neon-integratie-env-vars zijn afgeschermd en NIET lokaal op te halen. Daarom geen los migratiescript: `ensureSchema()` in `lib/db.ts` maakt de tabel + kolommen aan (CREATE TABLE / ALTER TABLE IF NOT EXISTS) en seedt One Day Clinic, op runtime, idempotent. Nieuwe kolom toevoegen = een `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` regel erbij in `init()`.
- **Wachtwoorden nooit plat.** Klantwachtwoorden worden gegenereerd en als scrypt-hash opgeslagen (`lib/password.ts`). Alleen bij aanmaken zie je het platte wachtwoord één keer.
- **Sessies.** Ondertekende cookie (HMAC met `SESSION_SECRET`). De middleware draait op de Edge en mag GEEN Node-crypto importeren; daarom checkt de middleware alleen of de cookie bestaat, en doen de pagina's (Node) de echte handtekening-controle. Houd dit zo.
- **Admin vs klant.** Klant ziet alleen eigen dashboard. Admin (Maarten) komt overal bij via `/admin`, met aparte cookie en wachtwoord (`ADMIN_PASSWORD`).
- **Eén neutrale naam/URL.** Heet overal "Pingwin SEO Dashboard". Niet per klant een aparte URL; de login scheidt klanten.
- **Superhuman: geen API, wél een werkende thread-deeplink.** `superhumanThreadLink` in `lib/ms-graph.ts` bouwt een link die de mail direct in Superhuman opent (opgeslagen als `client_emails.superhuman_link`). Chat en kaarten linken mail-verwijzingen daarheen, met de Outlook-webLink als terugval. Mail-data zelf komt uit Microsoft 365 (Graph); dezelfde mails als in Superhuman.
- **NOC-database nooit aanraken.** Dit project heeft een eigen Postgres. Niets van NOC raken.
- **Direct naar productie.** Geen feature-branches. Afsluiten met commit + push naar main; Vercel deployt automatisch. CLI-deploy `npx vercel --prod --yes` kan als handmatige controle.

## 6. Environment-variabelen (Vercel)

- `SESSION_SECRET` (ondertekenen cookies)
- `ADMIN_PASSWORD` (toegang adminscherm)
- Neon/Postgres-vars (auto door integratie: `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `DATABASE_URL`, etc.)
- `ONE_DAY_CLINIC_PASSWORD` bestaat nog maar is ONGEBRUIKT (klant zit nu in DB).

Lokaal staan deze in `.env.local` (gitignored). De DB-vars zijn afgeschermd; lokaal draaien tegen de echte DB werkt daardoor niet, test op productie.

## 7. Deploy en test

```bash
git add . && git commit -m "[beschrijving]" && git push origin main
```
Pushen naar main is genoeg: de GitHub-koppeling deployt automatisch naar productie (geldt voor Pingwin én de NOC-cockpit, zelfde repo). Draai NIET ook nog `npx vercel --prod --yes` na een push: dat geeft dubbele deployments en elke extra deploy breekt lopende achtergrondtaken (doc-generaties) een keer extra af. Gebruik dat commando alleen om te deployen ZONDER code-wijziging (bijv. een nieuwe env-var activeren). Testen gebeurt op de live URL (DB alleen op de server). Rooktest met curl op de login- en admin-endpoints werkt goed.

## 8. Huidige stand (juni 2026)

Werkend en live:
- Klant-dashboard met login, data uit Google Sheet, multi-client.
- Adminscherm: klanten lijst (bovenaan), nieuwe klant aanmaken (eronder) met automatisch gegenereerd wachtwoord, verwijderen.
- Klant-cockpit per klant met tabjes: Overzicht, Documenten, Communicatie, Ontwikkeling & resultaten. Bewerkbare velden (status, laatste contact, e-maildomein, werkdocument, resultaten, notities).

## 9. Roadmap / openstaand

1. **Wachtwoord mailen naar klant** (B2): knop "genereer + mail". Vereist Resend-account (API-key) + DNS-records op pingwin.nl, versturen vanaf een @pingwin.nl-adres.
2. **Cockpit fase 2, live data:** echte laatste-e-mails uit Gmail/Outlook (OAuth) en echte resultaten uit Search Console/GA/Ahrefs per klant. Eerst uitvragen: Gmail of Outlook/M365.
3. **Alle klanten laden:** Maarten wil al zijn huidige SEO-klanten in de cockpit. Per klant nodig: Sheet + bedragen (als ze een inlog-dashboard krijgen) of alleen naam (cockpit-only). **Cockpit-only klanten zijn nog niet mogelijk:** login/sheet/wachtwoord moeten optioneel worden (kolommen nullable + `login_enabled`-vlag).
4. **Overstap van Netlify:** als de Vercel-versie alles dekt, klant overzetten en Netlify uitfaseren.

## 10. Werkwijze (Maartens voorkeuren)

- Nederlands, gewone taal, geen jargon. Korte directe antwoorden, stap voor stap, één plakbaar commando per actie.
- Geen em-dash/en-dash als zinsscheiding; gebruik komma, puntkomma, haakjes of nieuwe zin.
- Denk eerst, bij twijfel vragen. Eenvoud eerst, chirurgische wijzigingen, breek nooit bestaande functionaliteit.
- Geen secrets in de chat; wachtwoorden via terminal of Vercel-UI.
- Na een wijziging: commit + push, meld de live URL.
