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
- **Doe het zelf als het kan.** Kan iets via code, een config-bestand of een API, doe het dan
  zelf in plaats van Maarten klik-instructies te sturen (voorbeeld: Vercel-instelling via
  `vercel.json` i.p.v. een klikroute). Check standaard eerst of jij het kunt doen; alleen wat
  echt niet anders kan (inloggen, betalen, een besluit) komt bij Maarten terecht.
- **Panklare links, nooit terminal-omwegen.** Resultaat altijd als klikbare link of een knop
  waar Maarten al is (dashboard, Drive, chat). Kan iets alleen met server-inloggegevens die
  Claude niet heeft, bouw dan een dashboard-knop; Maarten is daar al ingelogd.
- **Het heet Pingwin.** Nooit "Penguin" of een andere spelling, ook niet in output.
- **Bewijs boven beloftes.** Zeg niet "het werkt", laat het zien (test, output, live URL).
  Kondig je een controle aan, voer die dan ook echt uit.
- **Vaste vorm: "Waar we staan" bovenaan, één opleverblok onderaan, stil ertussenin.** Maarten
  werkt in zes tot acht chats tegelijk. Je eerste antwoord opent met drie regels (onderwerp,
  laatst gedaan, nu open) uit de tabel *Lopende sporen* in `pingwin-brein/brein/08-stand-van-zaken.md`;
  onderweg geen stap-voor-stap met bestandsnamen; je sluit af met maximaal tien regels (Je vroeg,
  Klaar, Kijk hier, Jij doet, en alleen als het speelt: Nog open). De sjablonen staan in
  `pingwin-brein/brein/11-claude-werkwijze.md`; hier geen kopie, anders lopen ze uit elkaar.
- **De link pas als het live staat.** Nooit terugkoppelen op een deploy die nog loopt. Zie
  "Deploy en test" hieronder: na de push draait `scripts/wacht-op-deploy.sh`, en pas als die
  klaar is bekijk je het scherm en geef je de link. Maarten hoort nooit zelf in Vercel te kijken.
- **Mens aan het stuur.** Niets gaat autonoom naar buiten; Maarten keurt goed.
- **Plannen eerst in gewone taal in de chat, en het planbestand is óók gewone taal.** Eerst de
  volledige uitleg begrijpelijk in de chat, vóór elke goedkeuringsvraag. Het planbestand in het
  zijpaneel bevat exact diezelfde begrijpelijke tekst, met hooguit twee regels techniek onderaan
  onder "Technisch voetnootje". Maarten hoeft het zijpaneel nooit te openen.

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
- **Design-fundament (vaste regel, 01-08-2026).** In `app/globals.css` staat naast de kleuren een vast fundament: een spacing-schaal (`--s-1` t/m `--s-12`, veelvouden van 4), een type-schaal (`--fs-xs` t/m `--fs-xl` met bijpassende `--lh-*` regelhoogtes), een radius-schaal (`--r-sm/md/lg/full`) en een shadow-schaal (`--shadow-sm/md/lg`), plus gedeelde bouwstenen `.card`, `.section`, `.row`, `.chip`, `.btn`. **Elke UI-wijziging gebruikt deze schaal-tokens en bouwstenen; nooit hardgecodeerde afstanden, font-sizes, rondingen of schaduwen.** Vóór elke deploy draait de design-checklist uit de proper-design skill (uitlijning, spacing, type-schaal, contrast, consistentie), en het resultaat wordt eerst gecontroleerd op https://pingwin-seo-dashboard.vercel.app. Bestaande schermen migreren batch voor batch naar dit fundament (batch 1: het Bird's eye-blok).
- **De opmaakregels worden nagerekend, niet onthouden (vaste regel, 06-08-2026). Dit is een poort, geen afspraak.**
  Bovenstaande regels stonden er al maanden, en tóch kwamen er op 6 augustus twee schermen langs
  die ze braken: één zonder kopbalk met AI-tekst in een kaal invulvak, en één met tekstmuren, losse
  rode regels en een samenvatting in een smalle kolom. Een regel die alleen in dit document leeft,
  wordt gebroken zodra iemand haast heeft. Daarom nu twee dingen die geheugen vervangen:
  - **Bouw met de gedeelde bouwstenen, nooit met eigen `<div>`s en eigen afstanden.**
    Voor een uitkomst op het scherm: `app/_ui/Uitkomst.tsx` (`Paneel`, `Blok`, `Tekst`,
    `Signaal`/`Signalen`, `Chip`/`Chips`, `Pad`, `Tabel`, `Leeg`). Losse tekst gaat altijd door
    `Tekst`, dus door `mdToHtml`, dus nooit ruwe markdown in beeld; elk pad wordt vanzelf klikbaar;
    een waarschuwing krijgt een eigen vorm in plaats van een rode zin in een muur. Voor een los
    beheerscherm: `app/admin/AdminKop.tsx` plus de `pg-`bouwstenen uit `app/globals.css`, en een
    regel in `SCHERMEN` in `app/admin/OntwikkelMenu.tsx`.
  - **`proeven/opmaak.proef.ts` bewaakt het en draait vóór élke bouw** (`prebuild`, dus ook op
    Vercel; sinds 11-08-2026 via `proeven/alles.mjs`, samen met alle andere proeven). Hij wordt rood als een beheerscherm geen kopbalk heeft, als AI-tekst in een
    `<textarea>` staat in plaats van gerenderd, als een scherm niet in het Intern-menu staat, als
    er losse pixelwaarden in de opmaak sluipen, of als een scherm zijn eigen lettergroottes,
    afstanden, kleuren, rondingen of schaduwen verzint. Dan mislukt de bouw en komt het niet live.
    De 48 schermen van vóór deze datum staan op een erfenis-lijst in dat bestand. **Die lijst mag
    alleen korter worden:** verbouw je een scherm naar de bouwstenen, haal het eraf, en daarna kan
    het niet meer terugvallen. Een nieuw scherm staat er per definitie niet op en moet dus meteen
    goed zijn. Zet die proef nooit uit; breid hem uit zodra er een nieuwe opmaakfout ontstaat, want
    dat is de enige manier waarop zo'n fout niet terugkomt.
- **Knopconventie in cockpit-panelen (vaste regel, 08-08-2026).** Losse `<button className="...">`
  krijgen niet langer een eigen, ad-hoc naam; ze gaan op het bestaande knopsysteem uit het
  design-fundament: `.btn` altijd als basis, plus precies één van `.btn-primary` (hoofdactie,
  hooguit één per rij), `.btn-ghost` (gewone secundaire actie), `.btn-quiet` (géén actie op de
  data, maar informatief/verwijzend, zoals een "laatste stand"-knopje), of `.btn-danger`
  (onomkeerbaar, zoals verwijderen); `.btn-klein` erbij voor een compacte maat. Nooit meer
  `primary-btn`/`ghost-btn`/`wp-fase-btn` in nieuwe code, dat zijn oudere namen die naar dezelfde
  stijl leiden maar het systeem versplinteren. Knoppen die bij elkaar horen staan in een
  `.pnl-acties-groep`, met een `.pnl-acties-scheiding`-lijntje tussen twee niet-verwante groepen;
  een informatief knopje krijgt `.pnl-acties-info` en staat losgekoppeld (meestal uiterst rechts).
  Bij een `.strategy-card`-paneel (het gangbare inklapbare cockpit-paneel) staat de knoppenrij als
  volle-breedte, links uitgelijnde, omslaande rij direct onder de kop. Referentie-implementatie:
  `app/admin/client/[slug]/OrgDataPanel.tsx` (de "Bedrijfsgegevens"-toolbar). Dit is nu een pilot
  op één paneel; nog niet bewaakt door `proeven/opmaak.proef.ts` (volgt zodra er 2-3 panelen op
  deze manier zijn omgebouwd).
- **Met terugwerkende kracht (vaste regel, 31-07-2026).** Elke opmaak- of dashboardaanpassing geldt automatisch óók voor bestaande kaarten, taken en chats, in alle werelden (Pingwin én NOC). Bouw zulke aanpassingen daarom in de weergave-laag (renderer/parser, zoals `lib/card-info.ts`), niet alleen in de prompt voor nieuwe data. Maarten hoeft dit niet meer per wijziging te vragen.

## 0b. DE UITLEGPAGINA BIJWERKEN (vaste stap, 06-08-2026)

Er is één plek waar het hele dashboard in gewone taal wordt uitgelegd: **`/uitleg`**
(https://pingwin-seo-dashboard.vercel.app/uitleg). Openbaar leesbaar, dus deelbaar met klanten,
leads, collega-bureaus en investeerders. De inhoud staat volledig in `lib/uitleg.ts`; de pagina
(`app/uitleg/page.tsx`) rendert alleen.

**Vaste stap: bouw je iets noemenswaardigs bij of om, werk dan in dezelfde wijziging de
betreffende uitklapper in `lib/uitleg.ts` bij en verzet `LAATST_BIJGEWERKT`.** Maarten hoeft dit
niet te vragen. Een uitbreiding zonder bijgewerkte uitleg is niet af.

Twee regels die dat document eerlijk houden:

- **Niets erin wat niet in de code staat.** Geen roadmap-taal die klinkt als werkelijkheid.
- **Hoofdstukken met `intern: true` zijn alleen zichtbaar mét admin-sessie.** Daar staan de
  gaten, de risico's en de verbeterpunten. Zo blijft het één document in plaats van een
  verkoopversie en een interne versie die uit elkaar lopen.

## 0c. DE ROUTEKAART EN HOE JE EEN ONTWIKKELPUNT OPPAKT (vaste stap, 06-08-2026)

De ontwikkeling van dit dashboard loopt via **losse chats, één ontwikkelpunt per chat**. Maarten
begeleidt en stuurt aan; hij is geen programmeur.

- **De punten staan in `lib/routekaart.ts`** (stand: open, loopt, af) en de volledige beschrijving
  in `lib/uitleg.ts`, hoofdstuk "Eerlijke agenda en routekaart". Vijftien punten, R1 tot R15, in
  drie golven.
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
| `andere-sleutel` | jouw sleutel is verouderd; hij staat nog niet in deze omgeving |
| `leeg` | `PINGWIN_KIJK_SLEUTEL` staat niet in deze omgeving |

Let op: een omgevingsvariabele geldt pas vanaf een **nieuwe** chat. Krijg je `andere-sleutel`
vlak nadat Maarten hem heeft geplakt, dan is dit nog de oude sessie; dat lost een nieuwe chat op,
niet een nieuwe sleutel (een nieuwe sleutel maken trekt juist de goede in).

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

Lokaal staan deze in `.env.local` (gitignored). De DB-vars zijn afgeschermd; lokaal draaien tegen de echte DB werkt daardoor niet, test op productie.

## 7. Deploy en test

**Begin élke wijziging met de laatste code, ook als de chat al even openstaat (vaste regel,
11-08-2026).** Een chat krijgt zijn kopie van de repo op het moment dat de chat opengaat, niet op
het moment dat je gaat bouwen. Sta je 's ochtends aan en werk je 's middags door, dan bouw je op
code van vanochtend, ook al liep er niets tegelijk. Dat is de echte reden waarom "ik los A op en B
breekt": je legt je werk over een versie heen die intussen is opgeschoven. Dus vóór je iets
aanraakt, en nog een keer vlak vóór je pusht:

```bash
git fetch origin main && git rebase origin/main
npm run proef
```

Botsen er twee wijzigingen, dan zie je dat nu meteen als een conflict in plaats van later als een
kapot scherm. Dit is geen theorie: tijdens het bouwen van de proeven-poort op 11 augustus schoof
`main` twee keer op onder de sessie door, met een botsing in `package.json` tot gevolg.

```bash
git add . && git commit -m "[beschrijving]" && git push origin main
scripts/wacht-op-deploy.sh
```

**Die tweede regel hoort er altijd bij.** Pushen is niet hetzelfde als live: zonder die stap
koppel je terug op een deploy die nog loopt, en opent Maarten een link die hem het oude scherm
laat zien. `scripts/wacht-op-deploy.sh` pollt `/api/versie` (die geeft de draaiende commit terug)
tot jouw commit er staat, of tot een latere deploy die hem bevat: er wordt uit meerdere chats en
crons naar `main` gepusht, dus dat laatste is normaal. Klaar met code 0 betekent live; dán pas het
scherm bekijken via het meekijk-recept en dán pas terugkoppelen. Code 1 betekent tijdslimiet: niet
melden als live, maar de bouwstatus van die commit opvragen via de GitHub-tools, want een mislukte
build ziet er van buitenaf hetzelfde uit als een trage. Knoppen: `WACHT_INTERVAL_S` en
`WACHT_TIMEOUT_S`.

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
