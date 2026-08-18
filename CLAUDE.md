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

**Staat in het brein, niet hier.** Harde top-regels: `pingwin-brein/CLAUDE.md`. Uitwerking
(grondhouding, meedenken als coach, hoe een chat opent en afsluit, bouwen):
`pingwin-brein/brein/11-claude-werkwijze.md`. Het brein laadt elke sessie mee.

Weggehaald op 11-08-2026 omdat acht van de negen kernregels hier én in het brein stonden, plus
een derde kopie op Maartens Mac. Drie kopieën lopen uit elkaar zonder dat iemand het merkt, en
dat is precies de vaste les die hier al stond. Wat alléén hier stond is verhuisd naar het brein,
niet weggegooid, en geldt nu ook in de andere Pingwin-werelden. **Zet werkwijze-regels hier nooit
opnieuw neer; vul ze aan in het brein.** Hieronder staat alleen wat van dit project zelf is.

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
  `app/admin/client/[slug]/OrgDataPanel.tsx` (de "Bedrijfsgegevens"-toolbar).

  **Sinds 15-08-2026 wordt dit nagerekend in plaats van onthouden: `proeven/huisstijl.proef.ts`.**
  Die proef leest élk `<button>` in `app/` (met een echte parser, want een arrow-functie in de
  open-tag breekt een regex) en wordt rood op twee dingen: een knop die het knopsysteem niet
  gebruikt, en een emoji in een knoplabel. Losse teken-knopjes (een kruisje, een vinkje, een
  pijltje) mogen kaal blijven; dat zijn bedieningstekens, geen knoppen in de huisstijl.

  De vrijstellingen staan in `proeven/huisstijl-erfenis.json` en dat bestand heeft **twee aparte
  lijsten, met opzet**. `knopsysteem` bevat de 57 bestanden van vóór die datum en werkt als een
  ratel: alleen korter, nooit langer, en een bestand dat schoon is geworden moet eraf (de proef
  meldt dat zelf). `emoji` is **leeg en blijft leeg**: die zes gevallen zijn meteen opgeruimd,
  want een regel zonder uitzonderingen is de enige soort die niet langzaam uitholt. Zet daar dus
  nooit een bestand bij, haal de emoji weg.

  Waarom dit er kwam: de regel hierboven stond er al sinds 8 augustus, is gelezen, en werd op
  15 augustus alsnog gebroken op de developer-pagina (drie knoppen onder elkaar, twee
  knopsystemen door elkaar, emoji ervoor) én door een nieuwe knop die bovenop een bestaande knop
  werd gezet. Een regel die alleen in dit document leeft, wordt gebroken zodra iemand haast
  heeft. Dat is inmiddels de derde keer dat die les hier opgeschreven staat; vandaar de poort.
- **Wat Maarten zelf typt of plakt is nét zo mooi opgemaakt als wat het dashboard rendert
  (vaste regel, 17-08-2026).** De opmaakregel hierboven gold in de praktijk alleen voor tekst
  die het dashboard zélf maakt: de chat, een uitkomst, een rapport. Vrije tekstvelden waren de
  uitzondering, en dat is precies waar Maarten de hele dag zit. Plakte hij een uitgewerkte
  strategie uit de chat links naar "De koers" rechts, dan bleef er een muur tekst over: kopjes
  werden gewone letters die aan de volgende zin vastplakten, bullets werden regelafbrekingen,
  lijnen verdwenen, tabellen bleven staan maar zagen er anders uit. Dezelfde tekst, een kolom
  verderop, prachtig. Dat verschil bestaat niet meer, en er is geen veld dat een uitzondering is.
  - **Eén bron voor de opmaak.** `.focus-rich` (elk vrij tekstveld) hangt in `app/globals.css`
    aan exact dezelfde regels als `.md` en `.chat-md`: dezelfde oranje kopjes, dezelfde
    witruimte, dezelfde bullets, dezelfde lijnen, dezelfde tabel (`.paste-table` loopt mee in
    het `.md-table`-blok). **Schrijf voor een tekstveld nooit een eigen setje opmaakregels;
    zet het veld in dat gedeelde blok.** De vorige eigen set was kleiner én werd door een
    `*`-vangnet met `!important` weer platgeslagen, dus een kop was even groot als gewone tekst.
    Een vangnet tegen opmaak van buiten mag daarom nooit `font-size` of `color` platslaan.
  - **Opmaak weggooien is goed, structuur weggooien is fout.** `lib/rich-paste.ts` haalt bij
    plakken lettertypes, kleuren, classes en `<style>`-blokken van buiten weg, maar houdt de
    structuur van de tekst: koppen, bullets, genummerde lijsten, lijnen, citaten, alinea's,
    tabellen, links. Dat is de stand `rich: true`, en die is niet optioneel: **elke aanroep van
    `cleanPastedHtml` gaat met `rich: true`.** Een geplakte h1/h2 wordt een h3, precies zoals
    `mdToHtml` dat doet, zodat geplakte en gerenderde tekst niet uit elkaar lopen.
  - **Platte tekst die markdown is, wordt gerenderd.** Plak je tekst waarin `##`, `- `, `1. `
    of een tabel met pipes staat, dan gaat hij door `mdToHtml` in plaats van letterlijk in beeld
    te komen. Kopiëren uit een AI-chat levert vaak alleen platte tekst op, ook al zag hij er
    opgemaakt uit.
  - **`proeven/geplakte-opmaak.proef.ts` bewaakt alle drie en draait vóór élke bouw.** Hij plakt
    een echt stuk strategie door de opschoner heen (in een echte DOM) en wordt rood als een kop,
    een bullet, een lijn, een link of een tabel sneuvelt, als er een `cleanPastedHtml` zonder
    `rich: true` bijkomt, als een veld zijn eigen opmaakregels krijgt in plaats van het gedeelde
    blok, of als een vangnet de koppen weer platslaat. Zet die proef nooit uit.
- **Er is ÉÉN opmaak en ÉÉN poort, voor álles wat het dashboard op het scherm zet
  (vaste regel, 17-08-2026).** De regel hierboven ging over geplakte tekst. Diezelfde dag bleek
  dat het probleem twee lagen dieper zat: er waren vier uiterlijken voor dezelfde soort tekst en
  negenentwintig plekken die zelf beslisten hoe tekst HTML werd. Maarten wees de opmaak van een
  chat-antwoord aan als de juiste. Die is nu de enige.
  - **Op het scherm: één blok in `app/globals.css`,** helemaal bovenaan, voor `.md` (gerenderde
    tekst), `.chat-md` (chat) en `.focus-rich` (elk veld waar je zelf in typt) tegelijk. Oranje
    kopjes met een lijntje eronder, oranje pijltjes als opsommingsteken, oranje onderstreepte
    links, en één tabel: licht-oranje kop, rustig raster, om-en-om een grijze rij.
    `.md-table`, `.chat-table` en `.paste-table` staan in dezelfde regel, want dat waren drie
    van de vier uiterlijken. **Zet ná dat blok nooit opnieuw opmaak neer voor een kop, bullet,
    link, alinea of tabel binnen `.md`/`.chat-md`/`.focus-rich`**; dat wint stilletijds en dan
    lopen ze weer uit elkaar. Werktabellen (`.task-table`, `.kpi-table`, `.opr-tabel`) horen hier
    niet bij: die gaan niet over lopende tekst.
  - **In de code: `netteHtml` uit `lib/nette-html.ts`.** Die neemt één beslissing (is dit al
    HTML, of markdown/platte tekst?), rendert met `mdToHtml` en maakt daarna elke URL en elk pad
    klikbaar. **Schrijf die beslissing nooit opnieuw uit in een scherm.** Precies dat gebeurde:
    twee bestanden hadden dezelfde regel woordelijk staan, en de bespreekpunten, de
    aantekeningen en de sturing op een taakkaart deden iets zwakkers, waardoor `## Kopje` daar
    letterlijk in beeld kwam.
  - **`proeven/nette-html.proef.ts` bewaakt allebei en draait vóór élke bouw.** Hij rendert een
    echt stuk strategie en kijkt of kop, vet, opsomming, tabel en klikbaar pad eruit komen, hij
    leest élke CSS-regel ná het gedeelde blok en wordt rood zodra iemand er weer een eigen setje
    bijzet, en hij controleert dat de omgezette schermen via de poort renderen. Zet die proef
    nooit uit.
- **Met terugwerkende kracht (vaste regel, 31-07-2026).** Elke opmaak- of dashboardaanpassing geldt automatisch óók voor bestaande kaarten, taken en chats, in alle werelden (Pingwin én NOC). Bouw zulke aanpassingen daarom in de weergave-laag (renderer/parser, zoals `lib/card-info.ts`), niet alleen in de prompt voor nieuwe data. Maarten hoeft dit niet meer per wijziging te vragen.

## 0b. DE UITLEGPAGINA BIJWERKEN (vaste stap, 06-08-2026)

Er is één plek waar het hele dashboard in gewone taal wordt uitgelegd: **`/uitleg`**
(https://pingwin-seo-dashboard.vercel.app/uitleg). Openbaar leesbaar, dus deelbaar met klanten,
leads, collega-bureaus en investeerders. De inhoud staat volledig in `lib/uitleg/`; de pagina
(`app/uitleg/page.tsx`) rendert alleen.

**Vaste stap: bouw je iets noemenswaardigs bij of om, werk dan in dezelfde wijziging de
betreffende uitklapper in `lib/uitleg/` bij én zet ÉÉN regel bovenaan `WAT_IS_NIEUW` in
`lib/wat-is-nieuw.ts`.** Maarten hoeft dit niet te vragen. Een uitbreiding zonder bijgewerkte
uitleg is niet af.

**Eén hoofdstuk is één bestand, en dat is een botsmaatregel (vaste regel, 11-08-2026).** Dit
stond als 2.629 regels in één `lib/uitleg.ts`, en dat was precies dezelfde fout als bij
`LAATST_BIJGEWERKT` hieronder: élke chat die iets opleverde moest in dat ene bestand schrijven,
dus twee chats op één dag botsten altijd, in tekst die niets met elkaar te maken had.

- **Schrijf in het bestand van je eigen onderwerp, verder nergens.** `lib/uitleg/01-waarom.ts`
  tot `16-vervolg.ts`, genummerd in de volgorde waarin ze op het scherm staan. Twee hoofdstukken
  waren zelf te groot en hebben een eigen map: `04-motoren/` (een bestand per motor, dus
  `opruimen.ts`, `meta-ctr.ts`, `interne-links.ts`, enzovoort) en `15-agenda/` (een bestand per
  golf: `golf-1.ts`, `golf-2.ts`, `golf-3.ts`, plus `werkwijze.ts` en `kaders.ts`).
- **`lib/uitleg/index.ts` is alleen de volgorde en de leesroutes.** Raak hem niet aan om tekst te
  wijzigen; dat is weer één gedeelde plek. Alleen een nieuw hoofdstuk komt daar bij.
- **`proeven/uitleg.proef.ts` bewaakt het en draait vóór élke bouw.** Rood als een bestand boven
  de 250 regels komt, als een hoofdstuk losraakt van de index (dan verdwijnt het stilletjes van
  de pagina), of als een leesroute naar een hoofdstuk wijst dat niet bestaat. **Word je rood op
  de maat, verhoog hem dan niet:** geef dat hoofdstuk een eigen map met een bestand per
  onderwerp, precies zoals de motoren en de agenda.

**Botsen tussen chats is opgelost door de vorm, niet door afspraken (vaste regel, 11-08-2026).**
Het nieuws stond als één zin van vijfduizend tekens op één regel (`LAATST_BIJGEWERKT`), en elke
chat die iets opleverde herschreef precies díe regel. Twee chats op één dag botsten dus altijd, en
die dag zijn de conflictmarkeringen twee keer meegecommit: de bouw mislukte, de site bleef twee
opleveringen lang op oude code staan, en niemand zag het. Wat er nu ligt:

- **Eén oplevering is één regel, en je zet hem erbij.** Nooit een bestaande regel herschrijven.
  De vorm is vast: `{ datum: "JJJJ-MM-DD", tekst: "..." },` op één regel, nieuwste bovenaan.
- **`.gitattributes` zet `lib/wat-is-nieuw.ts` op `merge=union`.** Schrijven twee chats toch op
  dezelfde plek, dan houdt git ze allebei in plaats van er een conflict van te maken. Dat kán
  alleen doordat elke regel op zichzelf klopt; `proeven/wat-is-nieuw.proef.ts` bewaakt die vorm.
- **`proeven/geen-conflict.proef.ts` is het vangnet voor élk ander bestand.** Staat er ergens nog
  een `<<<<<<<` of `>>>>>>>`, dan mislukt de bouw met een leesbare melding (bestand plus regel) in
  plaats van een onbegrijpelijke TypeScript-fout.
- **`LAATST_BIJGEWERKT` is afgeleid** (de datum van de bovenste regel) en wordt niet meer met de
  hand gezet. Zet er nooit weer een geschreven zin in.

Zet `merge=union` alleen op een bestand dat uitsluitend groeit en waarvan elke regel losstaat.
Op gewone code is het gevaarlijk, want git kijkt daarbij niet naar de inhoud.

Twee regels die dat document eerlijk houden:

- **Niets erin wat niet in de code staat.** Geen roadmap-taal die klinkt als werkelijkheid.
- **Hoofdstukken met `intern: true` zijn alleen zichtbaar mét admin-sessie.** Daar staan de
  gaten, de risico's en de verbeterpunten. Zo blijft het één document in plaats van een
  verkoopversie en een interne versie die uit elkaar lopen.

## 0b-bis. OPMAAKWERK GAAT DOOR ZONDER TE VRAGEN, WANT HET WORDT GEFOTOGRAFEERD (vaste regel, 18-08-2026)

Het strak trekken van de opmaak duurde te lang, en de oorzaak was niet het werk maar de
werkwijze: na élke ronde moest Maarten kijken of het er nog goed uitzag, want dat kon niemand
anders vaststellen. Elke ronde was daardoor een halve dag wachten op een oordeel dat vrijwel
altijd "ja hoor" was. Zijn woorden op 18-08-2026: "ik zie niks gebeuren, het duurt veel te lang
en ik ben er een beetje klaar mee". Terecht, en het is opgelost door de sluis weg te halen, niet
door harder te werken.

**`scripts/fotoproef.py` vervangt dat oordeel voor het deel dat te meten is.** Hij fotografeert
tien schermen via `/api/admin/kijkbeeld` en vergelijkt ze met de vorige set:

```bash
python3 scripts/fotoproef.py voor     # nulmeting, vóór je iets aanraakt
# ... werken, pushen, scripts/wacht-op-deploy.sh ...
python3 scripts/fotoproef.py na       # nieuwe foto's plus het verschil
```

Hij geeft twee getallen en het tweede is het belangrijkste. **"Anders"** telt de pixels die niet
gelijk zijn, en dat getal is onbruikbaar zodra er data bij komt of afgaat: dan schuift alles op en
staat een scherm op 12% zonder dat de opmaak veranderd is (dat gebeurde meteen bij de eerste
meting, op de klantenlijst). **"Kleur"** vergelijkt hoevéél van elke kleur er staat, niet wáár, en
is daardoor blind voor verschoven inhoud maar gevoelig voor een rand, een schaduw of een tint die
verandert. Dus:

| Kleurverschil | Wat er gebeurt |
|---|---|
| onder 0,5% | doorvoeren, niet melden onderweg, geen vraag |
| 0,5% tot 3% | doorvoeren mét een foto in de terugkoppeling |
| boven 3% | eerst laten zien, dit verandert het gezicht van een scherm |

**Wat dit voor de werkwijze betekent, en dit is de kern:**

- **Eén opdracht is meerdere rondes, niet één.** Kleuren, schaduwen, inline opmaak en knopnamen
  gaan achter elkaar door in dezelfde sessie. Niet terugkoppelen tussendoor; één terugkoppeling
  aan het eind, over het geheel.
- **Niet elke ronde pushen.** Wachten op een deploy kost drie tot vijf minuten en dat is per ronde
  meer dan het werk zelf. Werk lokaal door, push als het blok af is.
- **Bij twijfel niet vragen maar meten.** De fotoproef is er om een oordeel te geven, dus een
  ronde overslaan "omdat je niet zeker weet of het opvalt" is geen voorzichtigheid meer maar
  uitstel. Meet het.
- **`scripts/zelfde-uitkomst.ts` blijft ernaast staan** voor wijzigingen die per definitie niets
  mogen veranderen (een naam die een andere naam wordt). Die is exact en heeft geen deploy nodig;
  de fotoproef is voor wijzigingen die wél iets doen.

Wat NIET verandert: een nieuw ontwerp, een andere indeling of een scherm dat op de schop gaat,
blijft iets dat Maarten eerst ziet. Deze regel gaat over strak trekken binnen de stijl die er is,
niet over het gezicht van het dashboard.

**En de terugkoppeling is hier maximaal vijf regels, geen tien (18-08-2026).** Zijn woorden:
"ik heb veel te veel tekst waar ik doorheen moet lezen om jouw terugkoppeling te controleren".
Bij opmaakwerk hoort dus alleen: wat je nu ziet dat er eerst niet was, de link, en wat er nog
open staat. Geen uitleg van de oorzaak, geen verantwoording van de methode, geen opsomming van
tellers die van X naar Y gingen. Wil hij weten waaróm iets kapot was, dan vraagt hij het.

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
- `WERELD_KLANT` (optioneel, **alleen op een klantvoordeur, nooit op het Pingwin-project**): de slug
  van de enige klant die die omgeving mag tonen. Staat hij aan, dan bestaat er daar geen andere
  klant, geen klantenlijst, geen financiën, prognose, agenda, verbruik of teambeheer, kan een
  schermfoto niet buiten die klant kijken en draaien de nachtronden er niet mee. Het slot zit vóór
  de rechten, dus het houdt ook de eigenaar tegen. Uitleg in `lib/klantvenster.ts`, bewaakt door
  `proeven/klantvenster.proef.ts`, plan in `NOC-NAAR-PINGWIN.md`.

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
