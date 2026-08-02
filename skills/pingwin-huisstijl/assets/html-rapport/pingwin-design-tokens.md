# Pingwin design tokens (live gemeten op pingwin.nl, augustus 2026)

Bron: stylesheets en inline styles van https://pingwin.nl/, uitgelezen met de
extract-werkwijze van de skill extract-design-tokens. Niets geschat.

## Typografie

| Token | Waarde | Bron |
|---|---|---|
| Font | Montserrat (variabel, 400 tot 800) | Google Fonts-link op de site |
| H1 | 700-800, ~40px, letter-spacing 0.2px | `h1,.wpex-h1` |
| H2 | 700, ~30px, letter-spacing 0.2px | `h2,.wpex-h2` |
| H3 | 700, ~25px, soms in accentkleur | `h3{color:#f15829}` |
| Body-tekstkleur | #111 | `--text-color` |

Het fontbestand `montserrat.woff2` in deze map is het variabele font (400 tot 800)
en wordt als base64 in elk rapport ingesloten, zodat het document zelfstandig is.

## Kleuren

| Token | Waarde | Bron |
|---|---|---|
| Accent (primair oranje-rood) | #F15829 | `--wpex-accent` |
| Accent warm (menu-CTA) | #E7773F | `#menu-item-36` |
| Gradient blauw | #C7E2EB | `.gradient-hero` |
| Gradient perzik | #F8DABC | `.gradient-hero` |
| Achtergrond licht | #F5F6FA | `#site-header-inner` |

De kenmerkende gradient: `linear-gradient(228deg, #C7E2EB 38%, #F8DABC 80%)`,
altijd met grote afgeronde hoeken (30 tot 50px) en eventueel witte randen.

## Vormen

- Veel afgeronde hoeken: pills 30px, grote vlakken 50px.
- Menu en knoppen zijn pill-vormig (border-radius 30px).
- Cards met dunne lichte rand (#F0E7DF) en radius 16 tot 20px.

## Let op

Het oude docx-oranje (#F6712C) wijkt af van de live site (#F15829). De site is
leidend. Bij een restyle van pingwin.nl deze meting opnieuw uitvoeren.
