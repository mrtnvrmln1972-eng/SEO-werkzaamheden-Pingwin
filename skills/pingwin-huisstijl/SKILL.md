---
name: pingwin-huisstijl
description: "Centrale Pingwin huisstijl voor alle klantdocumenten. De standaard-oplevering is een bewerkbaar Word-bestand (.docx) in de stijl van pingwin.nl: Montserrat, accent #F15829, omslag met kleurverloop, sectiekoppen met nummer-bolletje, afgeronde kaarten, KPI-kaart met status-pillen en een citaatblok. Het HTML-rapport is de vormgevingsbron en levert desgewenst een PDF. Laad deze skill altijd eerst voordat je een Pingwin-document bouwt."
---

# Pingwin Huisstijl, centrale referentie

Dit is de **single source of truth** voor alle Pingwin-documenten.

**Word is de standaard-oplevering.** Alles wat naar een klant of een sitebouwer gaat,
gaat als bewerkbaar `.docx`: de klant moet de tekst kunnen aanpassen en terugsturen,
en de sitebouwer moet kunnen knippen en plakken zonder rommel mee te nemen. Een PDF
kan ernaast, nooit in plaats daarvan.

1. **Word-document (standaard)**: gebouwd met de bouwstenen hieronder. De werkende
   implementatie staat in het SEO-dashboard onder `lib/huisstijl/` en `lib/pingwin-docx.ts`;
   die is de referentie voor hoe het eruit hoort te zien.
2. **HTML-rapport (`assets/html-rapport/`)**: de vormgevingsbron. Gebruik het om de
   opmaak te ijken en om een PDF te maken als iemand daar expliciet om vraagt.

## Wat Word wel en niet kan

| Onderdeel | In Word |
|---|---|
| Omslag met kleurverloop, fotocollage, rond portret | Als afbeelding, één keer gerenderd met Chromium |
| Afgeronde kaarten, callouts, citaatblok, status-pillen | Als vorm (`roundRect`) met bewerkbare tekst erin |
| Kleurverloop en zachte schaduw op een kader | Ja, via `a:gradFill` en `a:outerShdw` op de vorm |
| Ronde nummer-bolletjes | Kleine afbeeldingen; een vorm mag hier niet (zie hieronder) |
| Afgeronde hoeken op een tabel | Nee. Tabellen blijven recht, net als in het sjabloon |

## Drie regels die je niet mag overtreden

- **Nooit een vorm in een vorm.** Word raakt dan de draad kwijt en laat stilzwijgend
  een deel van het document weg. Een status-pil hoort dus niet binnen een kader-vorm;
  zet de kaart eromheen als tabel neer.
- **Nooit omzetten naar Google Doc.** Die omzetting plet de omslag, de kaders, de
  kleurvlakken en de pillen. Upload het `.docx` en laat het staan.
- **Nooit een kapotte afbeelding.** Lukt het renderen van de omslag of het sfeerbeeld
  niet, val dan terug op de tekst-omslag.

## HTML-rapport (vormgevingsbron en PDF)

In `assets/html-rapport/` staat alles:

- `rapport-template.html`: volledig voorbeeld (Tudor Kozijnen groeiplan) met alle
  componenten: cover met gradient en foto-collage, sectiekoppen met nummer-bolletjes,
  KPI-kaart met status-pills, stappenkaarten, tabellen, callouts, citaatblokken,
  kop- en voetregels per pagina.
- `pingwin-design-tokens.md`: de gemeten design tokens van pingwin.nl. Dit is het
  contract; wijk er niet van af.
- `montserrat.woff2`: het variabele font (400 tot 800), als base64 insluiten.
- `maarten.jpg`: portret van Maarten voor de cover-quote ("Maarten van Pingwin").
- `vul-template.py`: vult placeholders ({{LOGO}}, {{HERO}}, {{MAARTEN}},
  {{SCREENSHOT}}, {{IC_*}}) met base64-beelden en SVG-iconen.
- `genereer-pdf.js`: maakt er een A4-PDF van via Chromium (schaal automatisch).

Werkwijze voor een nieuw klantrapport:

1. Neem `rapport-template.html` als basis en vervang de inhoud; structuur, CSS en
   componenten blijven staan.
2. **Per-klant element**: haal een sfeerbeeld van de website van de klant voor de
   cover (verklein naar ~1200px breed). Portret en quote blijven Maarten.
3. Verdeel de secties zo dat de `.page`-hoogtes elkaar benaderen (meet met
   Chromium; herverdeel secties bij grote verschillen).
4. Feitelijke data (cijfers, statussen, screendumps) altijd letterlijk uit de bron;
   nooit vertalen of aanvullen. Statussen als "Geschikt" letterlijk overnemen.
5. Genereer HTML (python3 vul-template.py) en PDF (node genereer-pdf.js).

---

## Word-documenten (de standaard)

## Gebruik vanuit een andere skill

```js
const path = require("path");
const fs   = require("fs");

// Components (design tokens + herbruikbare blokken)
const P = require(path.join(__dirname, "..", "..", "pingwin-huisstijl", "assets", "pingwin-docx-components.js"));

// Logo (altijd meegeven aan createPageHeader)
const logoBuffer = fs.readFileSync(
  path.join(__dirname, "..", "..", "pingwin-huisstijl", "assets", "Zzz_Pingwin_Logo.jpg")
);
```

> **Pad-notitie:** bovenstaand pad gaat vanuit `/mnt/skills/user/<skill-naam>/` twee niveaus omhoog naar `/mnt/skills/user/`, en dan naar `pingwin-huisstijl/assets/`.

---

## Document opbouw (ALTIJD via createPingwinDocument)

Gebruik **altijd** `P.createPingwinDocument`. Die regelt A4, marges, header, footer
en styles, en haalt de children door een vangnet (`flattenChildren`) dat geneste
arrays automatisch platslaat. Daardoor kan een vergeten spread (`...`) nooit meer
een corrupt bestand opleveren dat Word niet kan openen.

```js
const { Packer } = require("docx");

const doc = P.createPingwinDocument({
  klant: "Klantnaam",
  rapporttype: "Rapporttype",
  logoBuffer,
  children: [
    P.createCoverPage("Titel", "Ondertitel", { Klant: "X", Datum: "15-04-2026" }),
    P.createSectionDivider("1. Sectienaam"),
    P.createBodyText("Bodytekst hier."),
    P.createHighlightBox("Callout tekst hier."),
    P.createStepBlock(1, "Stap titel", "Stap omschrijving."),
    P.createDataTable(["Kolom 1", "Kolom 2"], [["Rij 1a", "Rij 1b"]]),
    P.createKPITable([{ label: "KPI", value: "100", change: "+10%", status: "good" }]),
    P.createBulletList(["Punt 1", "Punt 2"]),
  ],
});

Packer.toBuffer(doc).then(buf => fs.writeFileSync("output.docx", buf));
```

> **Waarom dit verplicht is:** `createCoverPage`, `createSectionDivider`,
> `createHighlightBox` en `createBulletList` retourneren een **array** van
> elementen. Wie zo'n array zonder spread rechtstreeks in een handmatige
> `new Document({ children: [...] })` zet, krijgt ongeldige XML (`<0/>`) en een
> .docx die **Word weigert te openen**. `createPingwinDocument` vangt dit
> automatisch af. Bouw je tóch handmatig een `Document`, haal je children dan
> altijd door `P.flattenChildren([...])`.

---

## Design Tokens (snel overzicht)

| Token | Waarde |
|---|---|
| Font | Montserrat |
| Primair oranje | `#F15829` (gemeten op pingwin.nl; het oude `#F6712C` is vervallen) |
| Rood accent | `#A22F3B` |
| Blauw accent | `#0E7E9A` |
| Bruin neutraal | `#84796B` |
| Zwart (tekst/heading) | `#2F2A2A` |
| Achtergrond licht | `#F7F7F7` |
| Contentbreedte | `9746 DXA` (A4, 1080 DXA marges) |

---

## Vaste regels (nooit van afwijken)

- **ALTIJD `P.createPingwinDocument` gebruiken** (of minimaal `P.flattenChildren` op de children). Een array-component zonder spread in een kale `new Document` maakt een bestand dat Word niet kan openen.
- **NOOIT `WidthType.PERCENTAGE`** in tabellen — Google Docs rendert dit kapot. Altijd `WidthType.DXA` met expliciete `columnWidths`.
- **Header en footer zijn altijd één `Paragraph`** met `TabStopType.RIGHT` op positie `9746` — nooit een tabel.
- **Logo altijd rechtsboven** in de header via `createPageHeader(..., logoBuffer)`. Logo-bestand: `Zzz_Pingwin_Logo.jpg` in deze assets-map.
- **`columnWidths` moeten altijd optellen tot `CONTENT_WIDTH` (9746)**. De `createDataTable` functie corrigeert afrondingsverschillen automatisch op de laatste kolom.

---

## Beschikbare componenten (uit `pingwin-docx-components.js`)

| Functie | Waarde |
|---|---|
| `P.createPageHeader(klant, type, logoBuffer)` | Header met logo rechtsboven |
| `P.createPageFooter()` | Footer met pingwin.nl + paginanummer |
| `P.createCoverPage(titel, ondertitel, meta)` | Titelpagina (retourneert array) |
| `P.createSectionDivider(label)` | Oranje sectiekop-balk |
| `P.createHighlightBox(tekst)` | Lichtoranje callout met oranje linkerbalk |
| `P.createStepBlock(nr, titel, tekst)` | Genummerd stap-blok |
| `P.createDataTable(headers, rows, colWidths?)` | Datatabel met donkere headerrij |
| `P.createKPITable(metrics)` | KPI-tabel met status-kleuren |
| `P.createBulletList(items)` | Bulletlijst (retourneert array) |
| `P.createBodyText(tekst, opts?)` | Alinea bodytekst |
| `P.createImageBlock(buffer, {widthPx, heightPx, caption?, type?})` | Afbeelding op contentbreedte met bijschrift |
| `P.createPingwinDocument({klant, rapporttype, logoBuffer, children})` | **Aanbevolen**: compleet Document met vangnet |
| `P.flattenChildren(children)` | Vangnet: flattent arrays, weert ongeldige elementen |
| `P.styles` | Document-stijlen (altijd meegeven aan `new Document`) |
| `P.CONTENT_WIDTH` | `9746` (DXA, contentbreedte A4) |

---

## Assets in deze skill

- `assets/pingwin-docx-components.js` — alle componenten + design tokens
- `assets/Zzz_Pingwin_Logo.jpg` — Pingwin logo (573×134 px, JPEG)
