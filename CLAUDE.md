# CLAUDE.md, projectfoundation Pingwin SEO Dashboard

**Dit bestand draagt alleen de regels.** Het wordt bij élke chat voorgelezen voordat Maarten iets
typt, dus elk woord kost hem geld in elke sessie. De uitwerking eronder (welk incident, welke
datum, welke woorden van Maarten) staat in `docs/`, en `.claude/hooks/omvang-poort.py` houdt dit
bestand onder de 4.000 woorden. Sta je iets te bouwen, dan is de regel hier genoeg; zoek je het
waarom, volg de verwijzing.

| Onderwerp | Uitwerking |
|---|---|
| Opmaak: de regels, de poorten en waarom ze er zijn | `docs/opmaak-poorten.md` |
| Deploy, de proeven en het wachten op live | `docs/deploy-en-proeven.md` |

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

**Staat in het brein, niet hier.** Harde top-regels: `pingwin-brein/CLAUDE.md`. Uitwerking
(grondhouding, meedenken als coach, hoe een chat opent en afsluit, bouwen):
`pingwin-brein/brein/11-claude-werkwijze.md`. Het brein laadt elke sessie mee.

Weggehaald op 11-08-2026 omdat acht van de negen kernregels hier én in het brein stonden, plus
een derde kopie op Maartens Mac. Drie kopieën lopen uit elkaar zonder dat iemand het merkt, en
dat is precies de vaste les die hier al stond. Wat alléén hier stond is verhuisd naar het brein,
niet weggegooid, en geldt nu ook in de andere Pingwin-werelden. **Zet werkwijze-regels hier nooit
opnieuw neer; vul ze aan in het brein.** Hieronder staat alleen wat van dit project zelf is.

## 0. OPMAAK, harde regel, altijd

Alles wat Maarten ziet (dashboard, chat, mail, preview, terugkoppeling) is 100%
netjes opgemaakt. Al twintig keer gevraagd, niet onderhandelbaar. **Het waarom,
de voorgeschiedenis en de details staan in `docs/opmaak-poorten.md`; hier staan
alleen de regels.**

- **Nooit ruwe markdown of een kale textarea in beeld.** Lopende tekst gaat door
  `netteHtml` uit `lib/nette-html.ts`; bewerkbare tekst door een gerenderde
  `contentEditable`, nooit een `<textarea>`. Elke URL en elk pad wordt vanzelf
  klikbaar.
- **Bouw met de gedeelde bouwstenen, nooit met eigen `<div>`s en eigen
  afstanden.** Een uitkomst op het scherm: `app/_ui/Uitkomst.tsx`. Een
  beheerscherm: `app/admin/AdminKop.tsx` plus de `pg-`bouwstenen, en een regel
  in `SCHERMEN` in `app/admin/OntwikkelMenu.tsx`.
- **Nooit een hardgecodeerde afstand, lettergrootte, ronding, schaduw of
  kleur.** Alles uit de schalen in `app/globals.css` (`--s-*`, `--fs-*`,
  `--r-*`, `--shadow-*`).
- **Knoppen gaan op het knopsysteem:** `.btn` plus precies één van
  `.btn-primary`, `.btn-ghost`, `.btn-quiet` of `.btn-danger`. Geen emoji in
  een knoplabel.
- **Eén opmaak voor álle lopende tekst, en één plek waar hij staat:** het blok
  bovenaan `app/globals.css` voor `.md`, `.chat-md` en `.focus-rich` samen. Zet
  daarná nooit opnieuw opmaak neer voor een kop, bullet, link, alinea of tabel.
  Wat Maarten zelf typt of plakt is dus nét zo mooi als wat het dashboard
  rendert; bij plakken gaan kleuren en lettertypes eruit, maar blijft de
  structuur staan (`cleanPastedHtml` altijd met `rich: true`).
- **Een gedeelde bouwsteen ziet er overal hetzelfde uit.** Positioneren en
  ruimte mag; achtergrond, kleur, rand, ronding, schaduw of letter niet. Wil je
  echt iets anders, maak er dan een variant van in het ontwerp zelf.
- **E-mail juist simpel:** aanhef, korte alinea's, simpele bullets, afsluiting.
  Geen tabellen, koppen, lijnen of vet-spam.
- **Met terugwerkende kracht.** Elke opmaakaanpassing geldt automatisch ook voor
  bestaande kaarten, taken en chats, in alle werelden. Bouw dat dus in de
  weergave-laag, niet in de prompt voor nieuwe data.

**Dit wordt nagerekend, niet onthouden.** Zes proeven draaien vóór élke bouw en
maken de bouw rood: `proeven/opmaak.proef.ts`, `huisstijl.proef.ts`,
`geplakte-opmaak.proef.ts`, `nette-html.proef.ts`, `bouwstenen.proef.ts` en
`uitleg.proef.ts`. Zet er nooit een uit. De erfenislijsten ernaast mogen alleen
korter worden, nooit langer. Drie keer is dezelfde regel gebroken terwijl hij
hier gewoon stond; daarom een poort en geen afspraak.

## 0b. De uitlegpagina bijwerken

Bouw je iets noemenswaardigs bij of om, werk dan in dezelfde wijziging de
betreffende uitklapper in `lib/uitleg/` bij én zet één regel bovenaan
`WAT_IS_NIEUW` in `lib/wat-is-nieuw.ts`. Maarten hoeft dit niet te vragen; een
uitbreiding zonder bijgewerkte uitleg is niet af. Schrijf in het bestand van je
eigen onderwerp en nooit in `lib/uitleg/index.ts`, en zet bij het nieuws een
regel erbíj in plaats van een bestaande te herschrijven. Dat is een botsregel,
geen stijlregel. Uitgewerkt in `docs/opmaak-poorten.md`.

## 0b-bis. Opmaakwerk gaat door zonder te vragen, want het wordt gefotografeerd

Strak trekken binnen de bestaande stijl vraagt geen oordeel van Maarten meer:
`scripts/fotoproef.py` meet het. Onder 0,5% kleurverschil doorvoeren zonder
melden, 0,5% tot 3% doorvoeren met een foto erbij, boven 3% eerst laten zien.
Eén opdracht is meerdere rondes in dezelfde sessie, niet elke ronde pushen, en
bij twijfel meten in plaats van vragen. Een nieuw ontwerp of een scherm dat op
de schop gaat blijft wél iets dat hij eerst ziet. Bij opmaakwerk is de
terugkoppeling maximaal vijf regels. Uitgewerkt in `docs/opmaak-poorten.md`.

## 0c. DE ROUTEKAART EN HOE JE EEN ONTWIKKELPUNT OPPAKT (vaste stap, 06-08-2026)

De ontwikkeling van dit dashboard loopt via **losse chats, één ontwikkelpunt per chat**. Maarten
begeleidt en stuurt aan; hij is geen programmeur.

- **De punten staan in `lib/routekaart.ts`** (stand: open, loopt, af) en de volledige beschrijving
  in `lib/uitleg/15-agenda/`, hoofdstuk "Eerlijke agenda en routekaart". Vijftien punten, R1 tot
  R15, in drie golven, met per golf een eigen bestand (`golf-1.ts`, `golf-2.ts`, `golf-3.ts`).
- **Het bedieningspaneel is `/admin/routekaart`**: per punt de stand, waar het van afhangt, en een
  knop die de startregel kopieert.
- **De startregel is `/ontwikkelpunt <code>`.** Die opdracht staat in
  `.claude/commands/ontwikkelpunt.md` en beschrijft de volledige werkwijze. Noemt Maarten een punt
  ("pak R2", "verder met autoriteit per pagina"), volg dan die opdracht, ook zonder slash.
- **Bij de start: stand op `loopt` zetten en meteen pushen.** Dan weet een andere chat dat het
  punt bezet is. Bij het eind: stand op `af` met de datum, en de beschrijving verhuist naar het
  hoofdstuk waar hij thuishoort.

**Terugkoppelen in een ontwikkelchat is vastgelegd, geen voorkeur: maximaal vier regels.** Wat er
nu werkt (in wat Maarten ermee kan), een klikbare link om het te zien, wat er nog open is, en
alleen indien nodig wat je van hem nodig hebt. Geen bestandsnamen, geen techniek, geen verslag van
je overwegingen. Vraagt hij ernaar, dan vertel je het.

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

**Eerste klant:** One Day Clinic, klant-login `onedayclinic`.

**Wachtwoorden en sleutels staan NOOIT in dit bestand.** Deze repo is openbaar; alles wat hier
staat is wereldwijd leesbaar en blijft ook na verwijderen in de git-geschiedenis staan.

### Hoe Maarten inlogt (en wat hij moet onthouden)

**In de praktijk: niets.** Zijn ingang is een bookmark. Alles hieronder is er voor als die
bookmark ooit kwijt is.

| Sleutel | Waarvoor | Waar hij leeft | Onthouden? |
|---|---|---|---|
| `ADMIN_MAGIC_KEY` | zit in de bookmark `/admin/enter?key=…`, één klik en je bent binnen | Vercel-env | nee, de browser onthoudt de link |
| `ADMIN_PASSWORD` | reserve-ingang, intypen op `/admin/login` | Vercel-env | ja, in de wachtwoordmanager |
| Klantlogins | de klant in zijn eigen dashboard | scrypt-hash in de database | kan niemand lezen, ook Maarten niet |

Wijzigen gaat voor alle env-sleutels hetzelfde: Vercel → project `pingwin-seo-dashboard` →
Settings → Environment Variables → aanpassen → één keer opnieuw deployen. Klantwachtwoord kwijt?
Genereer een nieuw via het adminscherm; het platte wachtwoord zie je één keer.

### Meekijken: doe dit meteen, zonder eerst rond te zoeken

Vraagt Maarten om mee te kijken, dan is dat één handeling. Niet gaan zoeken, niet eerst de
code lezen, niet aan hem vragen: dit is het recept.

```bash
curl -s -c /tmp/kijk.txt "https://pingwin-seo-dashboard.vercel.app/api/kijk?sleutel=$PINGWIN_KIJK_SLEUTEL"
```

Daarna elke pagina met `-b /tmp/kijk.txt` ophalen. De sleutel staat als `PINGWIN_KIJK_SLEUTEL`
in de Claude-omgeving (nooit in een bestand). Je krijgt een alleen-lezen sessie: je ziet alles
wat Maarten ziet, wijzigen wordt geweigerd. Wat het antwoord betekent:

| Antwoord | Wat er aan de hand is |
|---|---|
| `ok: true` | binnen, ga verder |
| `geen-sleutel` | meekijken staat uit; Maarten zet het aan op `/admin` |
| `andere-sleutel` | die sleutel is met de hand ingetrokken; maak er ÉÉN nieuwe en open daarna een nieuwe chat |
| `leeg` | `PINGWIN_KIJK_SLEUTEL` staat niet in deze omgeving |

**Vraag Maarten NOOIT om nog een sleutel te maken omdat deze chat er niet in komt.** Een
omgevingsvariabele geldt pas vanaf een **nieuwe** chat, dus een lopende chat houdt altijd de oude
waarde vast. Dat lost een nieuwe chat op, nooit een nieuwe sleutel. Op 15-08-2026 heeft dat hem
zesendertig plakrondes gekost, omdat elke nieuwe sleutel de vorige introk en de foutmelding
precies dát aanraadde. Sinds die dag vervalt een sleutel niet meer vanzelf en opent élke geldige
sleutel de deur; komt een chat er tóch niet in, dan is de enige juiste boodschap: "deze chat heeft
een oude waarde, in een nieuwe chat werkt het". Kun je niet meekijken, doe dan gewoon je werk
zonder mee te kijken en zeg dat erbij.

### Waarom `/admin/enter` een sleutel MOET hebben

Die route deelt een volledige adminsessie uit. Het slot stond eerst standaard uit, waardoor
iedereen die het adres intikte binnen was; het adres staat in deze openbare repo, dus dat was
te vinden. Live aangetroffen en dichtgezet op 02-08-2026.

De code is daarna omgedraaid: **geen `ADMIN_MAGIC_KEY` ingesteld = de ingang bestaat niet.**
Nooit terugdraaien naar "standaard open". Beveiliging hoort niet iets te zijn dat je aan moet
zetten. Dezelfde regel geldt voor elke nieuwe Pingwin-wereld die deze code overneemt.

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
- **Alle proeven zijn de poort, en er is geen lijst meer (11-08-2026).** `proeven/alles.mjs` leest
  de map `proeven/` en draait élk bestand dat op `.proef.ts` eindigt, acht tegelijk. Dat is zowel
  `npm run proef` als `prebuild`, dus het draait ook op Vercel en een rode proef betekent: de bouw
  mislukt en het komt niet live. **Een nieuwe proef hoef je nergens aan te melden**, hij bewaakt
  vanaf zijn eerste commit; noem hem `<onderwerp>.proef.ts` en laat hem eindigen met
  `process.exit(1)` als er iets niet klopt. Waarom dit zo moest: de lijst stond met de hand in
  package.json bij zowel `proef` als `prebuild`, en die twee liepen uit elkaar tot er 22 proeven
  bestonden waarvan er bij een bouw 5 draaiden. De andere 17 bewaakten precies de dingen die
  stilletjes breken als er vanuit een andere chat iets naast je verandert. Dit is dezelfde vaste
  les als altijd: dezelfde regel op twee plekken uitschrijven loopt uit elkaar zonder dat iemand
  het merkt, dus één bron en de rest leest daaruit. Zet deze poort nooit uit en zet nooit een
  handmatige lijst terug.

## 6. Environment-variabelen (Vercel)

- `SESSION_SECRET` (ondertekenen cookies)
- `ADMIN_PASSWORD` (toegang adminscherm)
- Neon/Postgres-vars (auto door integratie: `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`, `DATABASE_URL`, etc.)
- `ONE_DAY_CLINIC_PASSWORD` bestaat nog maar is ONGEBRUIKT (klant zit nu in DB).
- `AHREFS_PRIJS_PER_UNIT_USD` (optioneel): prijs per Ahrefs-unit in dollar, voor de echte marge per klant op `/admin/usage`. Zet hem op (je maandbedrag bij Ahrefs) gedeeld door (units in je abonnement). Niet ingesteld = Ahrefs telt nog met €0 mee in de marge.
- `CLAUDE_MAANDBUDGET_USD` (optioneel): maandbudget voor de Claude-teller in de kopbalk.
- `HUBSPOT_TOKEN` (optioneel): een **service key** uit HubSpot (instellingen, Integraties, Service keys),
  met leesrechten op deals, bedrijven, contacten, taken, notities en e-mail. Private apps zijn daar sinds
  februari 2026 "legacy"; een service key is dezelfde Bearer-sleutel met dezelfde scopes en kan alleen geen
  webhooks, en die gebruiken we hier niet (het dashboard kijkt zelf elk kwartier). Staat hij er, dan komen de deals elk kwartier
  binnen als lead (`/api/cron/hubspot`); staat hij er niet, dan doet die ronde niets en zegt dat ook.
  De koppeling leest; de enige schrijfactie is een notitie bij een deal, en die staat standaard uit.
  Instellen op `/admin/beheer`, uitleg in `HUBSPOT-LEADS.md`, bewaakt door `proeven/hubspot.proef.ts`.
- `WERELD_KLANT` (optioneel, **alleen op een klantvoordeur, nooit op het Pingwin-project**): de slug
  van de enige klant die die omgeving mag tonen. Staat hij aan, dan bestaat er daar geen andere
  klant, geen klantenlijst, geen financiën, prognose, agenda, verbruik of teambeheer, kan een
  schermfoto niet buiten die klant kijken en draaien de nachtronden er niet mee. Het slot zit vóór
  de rechten, dus het houdt ook de eigenaar tegen. Uitleg in `lib/klantvenster.ts`, bewaakt door
  `proeven/klantvenster.proef.ts`, plan in `NOC-NAAR-PINGWIN.md`.

Lokaal staan deze in `.env.local` (gitignored). De DB-vars zijn afgeschermd; lokaal draaien tegen de echte DB werkt daardoor niet, test op productie.

## 7. Deploy en test

Twee regels, allebei niet onderhandelbaar. Het waarom staat in
`docs/deploy-en-proeven.md`.

**Begin élke wijziging met de laatste code**, ook als de chat al even openstaat,
en nog een keer vlak vóór je pusht:

```bash
git fetch origin main && git rebase origin/main
npm run proef
```

**Pushen is niet hetzelfde als live.** Wacht de deploy af vóór je het scherm
bekijkt en vóór je terugkoppelt:

```bash
git add . && git commit -m "[beschrijving]" && git push origin main
scripts/wacht-op-deploy.sh
```

Code 0 betekent live, code 1 betekent tijdslimiet (dan de bouwstatus opvragen,
niet als live melden). Pushen naar main is genoeg; draai er nooit
`npx vercel --prod --yes` achteraan, dat geeft dubbele deployments en breekt
lopende achtergrondtaken af. Testen gebeurt op de live URL, want de database
staat alleen op de server.

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
