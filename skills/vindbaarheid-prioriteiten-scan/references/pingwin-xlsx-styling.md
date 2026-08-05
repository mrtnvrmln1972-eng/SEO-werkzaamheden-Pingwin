# Pingwin xlsx-styling voor de tracker

Vaste regels zodat de tracker er overal hetzelfde uitziet als Pingwin-deliverables.

---

## Workbook-naam

`vindbaarheid-prioriteiten-tracker.xlsx`

Eén werkblad genaamd `Bevindingen`. Optioneel een tweede werkblad `Methodologie` met de gebruikte CTR-curve, intentie-multipliers, datum en propositie-zin.

---

## Kolomvolgorde (verplicht, niet aanpassen)

```
ID | Type | Titel | URL | Zoekwoord | Volume | Huidige positie | Target-positie | Impact | Effort | TTE | Confidence | ROI-score | Tier | Vervolg-skill | Status | Owner | Datum
```

---

## Headers

- Achtergrond: `#222222`
- Tekstkleur: `#FFFFFF`
- Font: Montserrat Bold (val terug op Calibri Bold als Montserrat ontbreekt op het systeem)
- Tekst: UPPERCASE
- Border: geen
- Hoogte: 28pt

---

## Body-rijen

- Font: Montserrat Regular 10pt (fallback Calibri 10pt)
- Tekstkleur: `#181818`
- Alternating rows:
  - Even (rij 2, 4, 6...): `#FFFFFF`
  - Oneven (rij 3, 5, 7...): `#F7F7F7`
- Border: lichte grijze gridlines `#EEEEEE`
- Vertical alignment: top
- Wrap text: aan voor de kolommen `Titel` en `Zoekwoord`

---

## Conditional formatting

### Tier-kolom
- Tier 1, achtergrond `#F15829` met witte tekst, bold
- Tier 2, achtergrond `#E7773F` met witte tekst
- Tier 3, achtergrond `#FFE5D6`
- Tier 4, achtergrond `#F7F7F7`
- Skip, achtergrond `#EEEEEE`, tekstkleur `#888888`, italic

### ROI-score-kolom
- ≥ 5.0, vetgedrukt, kleur `#F15829`
- 2.0 tot 5.0, vetgedrukt, kleur `#181818`
- 0.5 tot 2.0, normaal
- < 0.5, kleur `#888888`, italic

### Status-kolom
- `open`, geen styling
- `in progress`, achtergrond `#FFE5D6`
- `done`, achtergrond `#D6F0D6` met doorhalen-stijl op tekst

---

## Kolombreedtes (in karakters)

| Kolom | Breedte |
|---|---|
| ID | 6 |
| Type | 18 |
| Titel | 35 |
| URL | 30 |
| Zoekwoord | 22 |
| Volume | 9 |
| Huidige positie | 9 |
| Target-positie | 9 |
| Impact | 8 |
| Effort | 7 |
| TTE | 6 |
| Confidence | 10 |
| ROI-score | 10 |
| Tier | 14 |
| Vervolg-skill | 25 |
| Status | 12 |
| Owner | 14 |
| Datum | 12 |

---

## Filter en sortering

- Auto-filter op de header-rij over de hele kolomstructuur
- Default sortering: Tier oplopend, dan ROI-score aflopend
- Bevries top-rij (`freeze panes` op rij 2)

---

## Top-3-highlight

De top 3 van de hele lijst (ROI-score) krijgt een dunne accentbalk links: de cel in de ID-kolom krijgt een linkerrand van 4pt in `#F15829`. Dit moet snel zien wat de absolute hoogste prioriteit heeft, ook als je niet op tier filtert.

---

## Methodologie-werkblad (optioneel maar aanbevolen)

Als tweede tab. Bevat:
- Klantnaam
- Datum scan
- Propositie-zin
- Modus (A, B of C)
- CTR-curve-bron (Advanced Web Ranking 2024)
- Aantal bevindingen totaal en per tier
- Gebruikte AI-prompts (lens 12), inclusief goedkeuringsstatus

Opmaak: zelfde header- en body-stijl als hoofdtabel, met `key | value` lay-out (twee kolommen, breedte 30 / 60).

---

## Implementatienotitie

In `scripts/generate_tracker.py` is dit alles geïmplementeerd via `openpyxl`. Het is geen aparte template, maar programmatisch styling, zodat ook een lege tabel (alleen Skip-tier) er goed uitziet.
