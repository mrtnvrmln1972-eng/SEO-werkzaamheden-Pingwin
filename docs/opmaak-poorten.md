# Opmaak: de regels, de poorten en waarom ze er zijn

Uitwerking bij het blok "Opmaak" in `CLAUDE.md`. Dit stond daar voluit, en dat
bestand wordt bij élke chat voorgelezen voordat Maarten iets typt: ruim
drieduizend woorden bouwgeschiedenis die hij in elke sessie opnieuw betaalde,
ook als de vraag er niet over ging. Verplaatst op 17-09-2026, samen met het
zetten van de omvang-poort in deze repo. Er is niets geschrapt; de regels
hieronder gelden onverkort.

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
- **Een gedeelde bouwsteen ziet er OVERAL hetzelfde uit (vaste regel, 19-08-2026).**
  Het beheerscherm werd verbouwd naar inklapbare blokken met de gedeelde inklapkaart van de
  cockpit (`strategy-card` + `strategy-head`). Precies goed. Maar er ging één regel overheen:
  `.vouwblok .strategy-head { background: var(--dark); color: var(--white); }`, met als reden
  "dezelfde zwarte balk als de tabelkop eronder". Resultaat: zes zwarte balken onder elkaar op
  `/admin`, terwijl diezelfde bouwsteen overal elders een zacht kleurverloop met een oranje
  driehoekje is. Maartens oordeel: "allemaal zwarte balken, ik vind het er niet uitzien."
  **Elke bestaande poort was groen**, en terecht: nette tokens, knoppen op het knopsysteem, geen
  losse pixelwaarden, scherm netjes in het Intern-menu. Geen enkele controle stelde de vraag die
  ertoe deed: ziet deze bouwsteen er hier hetzelfde uit als overal?
  - **Wat mag wél op een gedeelde bouwsteen:** positioneren en ruimte (padding, marge, gap,
    uitlijning, breedte, hoogte). Een blok mag zijn inhoud anders neerzetten, het mag er niet
    anders uitzien. En de varianten die het ontwerp zélf kent (`acc-orange` en familie,
    `btn-primary` en familie): dat is een keuze bínnen het systeem.
  - **Wat niet:** achtergrond, tekstkleur, rand, ronding, schaduw, lettergrootte, letterdikte of
    hoofdletters van `strategy-head`, `strategy-card`, `strategy-body`, `cockpit-card`, `card`,
    `btn`, `chip`, `ovc-icontile` of `ovc-head` vanuit een scherm-eigen klasse. Wil je daar echt
    iets anders, maak er dan een variant van in het ontwerp zelf.
  - **`proeven/bouwstenen.proef.ts` rekent het na en draait vóór élke bouw.** De 14 gevallen van
    vóór deze datum staan in `proeven/bouwstenen-erfenis.json`; die lijst mag alleen korter.
  - **En de tweede helft van dezelfde les:** een scherm dat qua gezicht verandert, laat je eerst
    zien. Dat stond al in 0b-bis en is hier overgeslagen. Bouwen mag zonder te vragen, het gezicht
    van een scherm veranderen niet.
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
