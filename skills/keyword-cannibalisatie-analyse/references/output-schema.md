# Output-schema (machine-leesbaar)

Lever naast het leesbare rapport ook exact deze JSON, zodat het Pingwin-dashboard de uitkomst kan renderen (clusters, redirectmap, interne-link-lijst). Geef UITSLUITEND geldige JSON in het JSON-deel, geen tekst eromheen, geen emoji. Verzin geen data; wat je niet uit de bronnen kon halen, laat je leeg of markeer je in `datakwaliteit`.

```json
{
  "datakwaliteit": {
    "gsc": true,
    "gscTijdreeks": false,
    "ahrefsBacklinks": true,
    "crawl": false,
    "opmerking": "Korte, eerlijke notitie: welke bronnen ontbraken en welke conclusie daardoor minder hard is (bijv. flip-detectie beperkt zonder wekelijkse GSC-snapshots)."
  },
  "samenvatting": "2 tot 4 zinnen kernconclusie: hoeveel echte cannibalisatie-clusters, en het belangrijkste patroon.",
  "clusters": [
    {
      "keyword": "primair zoekwoord van dit cluster",
      "volume": 1234,
      "score": "hoog | midden | laag",
      "signalen": {
        "urlFlip": true,
        "flipsIn90d": 3,
        "positiePlafond": true,
        "klikVerdeling": true
      },
      "intentie": "zelfde | verschillend | ambigu",
      "urls": [
        {
          "url": "/pad/",
          "rol": "winnaar | verliezer | andere-intentie | duplicaat",
          "positie": 7.2,
          "klikken": 12,
          "impressies": 300,
          "verwijzendeDomeinen": 0,
          "intentie": "transactioneel | informatief | navigational | ..."
        }
      ],
      "winnaar": "/pad-van-de-winnaar/",
      "actie": "niets doen | interne links | content differentieren | canonical | merge+301 | noindex",
      "onderbouwing": "Waarom deze winnaar en deze actie: noem de doorslaggevende factor (backlinks, klikken, businesswaarde) en het signaal (flip/positie).",
      "verwachteImpact": "Wat je na 4-8 weken verwacht (bijv. winnaar naar top-3, gecombineerde klikken +X%)."
    }
  ],
  "redirectMap": [
    {
      "van": "/verliezer/",
      "naar": "/winnaar/",
      "type": "301",
      "mergeContent": true,
      "reden": "Korte reden; noem als backlink-verificatie de keuze nog zou aanscherpen."
    }
  ],
  "interneLinks": [
    {
      "vanaf": "/bronpagina/",
      "naar": "/winnaar/",
      "ankertekst": "voorgestelde ankertekst",
      "reden": "Waarom deze link Google's keuze richting de winnaar duwt."
    }
  ]
}
```

## Veldregels
- Neem in `clusters` alleen ECHTE cannibalisatie op (minstens één hard signaal + overlappende intentie). False positives horen hier niet; benoem ze hooguit kort in de samenvatting als "geen actie".
- `winnaar` is altijd één van de `urls` in het cluster; de eerste `url` in de lijst is bij voorkeur de winnaar.
- `redirectMap` bevat alleen de clusters waarvan de actie `merge+301` is.
- `interneLinks` bevat de concrete anker-herverdelingen (actie `interne links`, maar ook aanvullend bij een merge+301).
- Getallen zijn getallen (geen tekst). Ontbrekende waarden: laat het veld weg of gebruik `null`.
