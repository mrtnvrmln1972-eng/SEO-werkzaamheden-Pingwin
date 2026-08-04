# Scoringsformule, intentie-multipliers en CTR-curves

Volledige uitwerking van de ROI-score zoals gebruikt in de skill. De formule is bewust deterministisch zodat verschillende scans op dezelfde site vergelijkbare uitkomsten geven.

---

## De formule

```
Impact         = log10(maandvolume) × 100 × CTR_uplift × intentie_multiplier × relevance_fit
Effort         = 1 tot 10
Time_to_effect = 1 tot 5
Confidence     = 0.3 | 0.6 | 0.9

ROI_score      = (Impact × Confidence) / (Effort × Time_to_effect)
```

De factor 100 (in plaats van 10 in eerdere ontwerp) zorgt dat realistische cases
(maandvolume 1.000+, CTR-uplift 5 tot 10%) terechtkomen in een interpreteerbare
5 tot 60 range op de Impact-as.

`maandvolume` is het hoogste van Ahrefs-volume of GSC-impressies, omdat GSC vaak underreport voor low-volume keywords en Ahrefs voor branded queries.

---

## CTR_uplift

`CTR_uplift` = `CTR(target_positie) - CTR(huidige_positie)`, beide uit de Advanced Web Ranking 2024 organic CTR study. Bij positiewinst die naar 1 gaat is CTR_uplift positief; bij CTR-onderkans (lens 2) is positie gelijk maar wordt `CTR(benchmark) - CTR(werkelijk)` gebruikt.

### CTR-curve, Advanced Web Ranking 2024 (organic, desktop NL)

Deze waarden zijn gebruikt in `scripts/scoring.py`. Bron: AWR Organic CTR study 2024. Mocht Pingwin later een eigen kalibratie willen toepassen, wijzig de tabel in `scoring.py` en log de bron in het rapport.

| Positie | CTR |
|---|---|
| 1 | 0.398 |
| 2 | 0.187 |
| 3 | 0.103 |
| 4 | 0.067 |
| 5 | 0.049 |
| 6 | 0.037 |
| 7 | 0.029 |
| 8 | 0.024 |
| 9 | 0.020 |
| 10 | 0.017 |
| 11 t/m 20 | 0.011 (gemiddelde) |
| 21+ | 0.005 |

**Voorbeeld.** Striking distance keyword met volume 1000, huidige positie 8, target positie 3:
- CTR(8) = 0.024
- CTR(3) = 0.103
- CTR_uplift = 0.079
- Impact-basis = log10(1000) × 100 = 300
- Bij intentie commercial (0.7) en relevance_fit 0.8: Impact = 300 × 0.079 × 0.7 × 0.8 = 13.3

Voor de uitlegging naar de klant in het rapport berekenen we naast Impact ook
expliciet de absolute uplift:
```
extra_clicks_per_maand = CTR_uplift × maandvolume
```

---

## Intentie-multiplier

| Intentie | Multiplier | Voorbeelden |
|---|---|---|
| Transactional | 1.0 | "kopen", "bestellen", "offerte", "abonnement", "[merk] prijzen" |
| Lokaal-commercial | 0.9 | "[dienst] in [stad]", "[dienst] bij mij in de buurt" |
| Commercial | 0.7 | "beste [product]", "vergelijken", "review", "alternatief voor X" |
| Navigational | 0.5 | "[merk] login", "[merk] contact" |
| Informational | 0.3 | "wat is X", "hoe werkt Y", "tips voor Z" |

Klassificatie via:
1. SERP-pattern uit `serp-overview` (welke paginatypes domineren)
2. Keyword-modifiers uit een vaste lijst per intentie
3. Bij twijfel: lokaal-commercial bovenaan vanwege Pingwin-klantmix

---

## Relevance_fit (gate-criterium)

Schaal van 0 tot 1. Wordt automatisch berekend op basis van klantprofiel + propositie + keyword-context.

| Score | Betekenis |
|---|---|
| 0.9 tot 1.0 | Direct kernpropositie |
| 0.7 tot 0.9 | Sterk verwante dienst, bewezen ICP |
| 0.5 tot 0.7 | Aanverwant, mogelijk relevant maar niet kern |
| 0.3 tot 0.5 | Verwarrend voor merk, slechts deels passend |
| 0.0 tot 0.3 | Off-brand, fit ontbreekt |

**Berekening.**
1. Bepaal automatisch op basis van keyword-string-overlap met klantprofiel-kernwoorden en propositie-kernwoorden.
2. Modifier `prijsvechter` of `goedkoop` zet score automatisch op max 0.4 als de propositie expliciet "geen prijsvechter" zegt.
3. Modifier `premium`, `exclusief`, `luxe` zet score op +0.1 als de propositie "premium" of "luxe" bevat.

**Gate-check.** Als `relevance_fit < 0.4`, het item gaat naar Skip-tier met rationale "off-brand fit, propositie spreekt zich uit tegen dit segment". Geen ROI-overweging meer.

---

## Effort-schaal (1 tot 10)

| Effort | Type werk | Voorbeeld |
|---|---|---|
| 1 | Title- of meta-tweak | CTR-onderkans op één pagina |
| 2 | Korte alinea-aanpassing | Direct-antwoord-blok toevoegen |
| 3 | FAQ-blok of structured data toevoegen | Snippet-kapen |
| 4 | Pagina-refresh (intro plus 1 sectie) | Verouderde topper |
| 5 | Volledige pagina-refresh | Striking distance met grote on-page-issues |
| 6 | Nieuwe pagina van 600 tot 1000 woorden | Content gap, klein |
| 7 | Nieuwe pagina van 1500+ woorden | Content gap, hub-pagina |
| 8 | Pagina-cluster (3 pagina's) | Cannibalisatie-fix met merge |
| 9 | URL-restructure plus redirect-plan | Cannibalisatie groot |
| 10 | Nieuwe contentcluster (5+ pagina's) | Strategische content-uitbreiding |

---

## Time to effect (1 tot 5)

| TTE | Tijdsspanne | Wanneer |
|---|---|---|
| 1 | 1 tot 2 weken | Alleen CTR-uplift via meta, geen positiewinst nodig |
| 2 | 2 tot 6 weken | On-page tweak op pagina die al rankt |
| 3 | 1 tot 3 maanden | Volledige page-refresh of nieuwe FAQ-blokken |
| 4 | 3 tot 6 maanden | Nieuwe pagina, indexatie plus rank-up |
| 5 | 6 maanden of meer | Nieuwe cluster, autoriteit opbouwen |

---

## Confidence (0.3, 0.6 of 0.9)

| Score | Betekenis |
|---|---|
| 0.9 | Datasignaal sterk (impressies, posities, snippet-claim concurrent), patroon vaker bewezen |
| 0.6 | Datasignaal gemiddeld, methode bewezen maar uitkomst niet gegarandeerd |
| 0.3 | Hypothese, weinig data of nieuw thema (typisch lens 5 content gaps zonder bewezen concurrenten en lens 12 AEO) |

Defaults per lens (kunnen handmatig naar boven of beneden worden bijgesteld):

| Lens | Default Confidence |
|---|---|
| 1 Striking distance | 0.9 |
| 2 CTR-onderkans | 0.6 |
| 3 Cannibalisatie | 0.6 |
| 4 Verouderde toppers | 0.9 |
| 5 Content gaps | 0.3 |
| 6 Featured-snippet | 0.6 |
| 7 Site-audit-issues | 0.9 |
| 8 Schema-gaps | 0.6 |
| 9 Interne-link | 0.6 |
| 10 Broken backlinks | 0.9 |
| 11 Lost backlinks | 0.6 |
| 12 AEO | 0.3 |

---

## ROI-score, interpretatie

| ROI-score | Betekenis |
|---|---|
| ≥ 5.0 | Onmiskenbaar prioriteit, vrijwel gegarandeerde uplift |
| 2.0 tot 5.0 | Strong candidate voor tier 1 of 2 |
| 1.0 tot 2.0 | Tier 2 of 3, afhankelijk van overige scores |
| 0.5 tot 1.0 | Tier 3 of 4 |
| < 0.5 | Skip-tier (samen met de gate-check) |

ROI-scores zijn relatieve maten, niet absolute. Vergelijk binnen één scan, niet tussen scans van verschillende sites.

---

## Tier-toewijzing recap

```
if relevance_fit < 0.4 OR ROI_score < 0.5:
    tier = SKIP
elif Confidence >= 0.6 AND Effort <= 3 AND TTE <= 2 AND ROI_score in top 25%:
    tier = 1   # Deze week
elif Confidence >= 0.6 AND Effort <= 6 AND TTE <= 3:
    tier = 2   # Deze maand
elif Effort <= 8 AND TTE <= 4:
    tier = 3   # Dit kwartaal
else:
    tier = 4   # Strategisch
```

Top 25% van ROI binnen de hele bevindingenlijst, niet alleen binnen tier 1-kandidaten.

---

## Verwachte uplift, formule voor het rapport

In de executive summary staat één regel:
```
totale verwachte uplift = sum( extra_clicks_per_maand × Confidence )
                          over alle items in tier 1 + tier 2
```

waarin `extra_clicks_per_maand = CTR_uplift × maandvolume`.

Dit getal is een verwachting, niet een garantie. Markeer dat expliciet in het rapport.
