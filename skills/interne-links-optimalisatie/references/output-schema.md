# Output-schema (machine-leesbaar)

Lever naast het leesbare rapport ook exact deze JSON, zodat het Pingwin-dashboard de uitkomst kan renderen (doelpagina's, voorgestelde links, ankerprofiel, gaten). Geef UITSLUITEND geldige JSON in het JSON-deel, geen tekst eromheen, geen emoji. Verzin geen data; wat je niet uit de bronnen kon halen, laat je leeg of markeer je in `datakwaliteit`.

```json
{
  "datakwaliteit": {
    "crawl": true,
    "gsc": true,
    "ahrefsUrlRating": false,
    "contentMapping": true,
    "opmerking": "Korte, eerlijke notitie: welke bronnen ontbraken en welke conclusie daardoor minder hard is (bijv. autoriteit-weging beperkt zonder Ahrefs URL Rating; intern Link Score benaderd via aantal inkomende links i.p.v. echte PageRank-iteratie)."
  },
  "samenvatting": "2 tot 4 zinnen kernconclusie: hoeveel doelpagina's, het belangrijkste patroon (bijv. zwakke pillar-concentratie, veel wees-pagina's), en de grootste winkans.",
  "doelpaginas": [
    {
      "url": "/pad-van-de-doelpagina/",
      "laag": "pillar | dochter | standalone",
      "cluster": "naam van het thema/cluster",
      "primairZoekwoord": "...",
      "huidigePositie": 8.0,
      "doel": "top 3",
      "baselineInterneLinks": 3,
      "score": "hoog | midden | laag",
      "voorgesteldeLinks": [
        {
          "bronUrl": "/bronpagina/",
          "relevantie": 82,
          "autoriteit": "hoog | midden | laag",
          "verkeer": 120,
          "linkbudget": "ruim | krap",
          "score": "hoog | midden | laag",
          "passage": "De bestaande of licht aan te passen zin waar de link natuurlijk in past.",
          "nieuweZin": false,
          "ankertekst": "voorgestelde ankertekst",
          "ankertype": "exact | partial | variant | beschrijvend",
          "positie": "hoofdcontent-boven | hoofdcontent | onderaan",
          "verwachteImpact": "Wat je na 4-8 weken verwacht (bijv. doelpagina van pos 8 naar top 5)."
        }
      ],
      "ankerprofiel": [
        { "anker": "...", "type": "exact | partial | variant | beschrijvend", "aantal": 2, "status": "bestaand | voorgesteld" }
      ],
      "gaten": [
        "dochter zonder terug-link naar de pillar",
        "pillar linkt niet naar deze dochter"
      ],
      "waarschuwingen": [
        "doelpagina ligt op click depth 4 (te diep)",
        "voorgestelde bron heeft al veel uitgaande links (krap linkbudget)"
      ]
    }
  ],
  "structuur": {
    "wezen": ["/pad-van-een-wees-pagina/"],
    "pillarGaten": ["pillar /thema/ linkt niet naar dochter /thema/subonderwerp/"],
    "clusterNotities": "Korte observatie over de clusterstructuur als geheel."
  }
}
```

## Veldregels
- `voorgesteldeLinks` is per doelpagina gerangschikt op `score` (hoogste eerst). Neem alleen bronnen op die nog NIET naar de doelpagina linken en die thematisch relevant zijn; een sterke maar off-topic link hoort er niet in.
- `relevantie` is een getal 0-100 uit de semantische match tussen bron- en doelcontent (het lezen van beide pagina's), niet uit keyword-overlap alleen.
- `ankertype` bewaakt het profiel: varieer over exact / partial / variant / beschrijvend. Als het bestaande profiel al veel exact-match bevat, kies dan bewust een ander type en licht dat toe in `verwachteImpact` of de passage.
- `ankerprofiel` bevat zowel de bestaande ankers (`status: "bestaand"`) als de nieuw voorgestelde (`status: "voorgesteld"`), zodat over-optimalisatie zichtbaar is.
- `laag` volgt uit de content mapping / het keywordpaspoort. Bij een pillar prioriteer je inkomende links vanuit dochters; bij een dochter bewaak je de terug-link naar de pillar.
- `gaten` bevat de structurele hiaten per doelpagina; `structuur.wezen` en `structuur.pillarGaten` bevatten de site-brede hiaten.
- Link nooit naar een niet-indexeerbare of te-redirecten pagina (koppeling met de cannibalisatie-analyse: link naar de winnaar). Als een voorgestelde doel- of bron-URL geraakt wordt door een geplande redirect, benoem dat in `waarschuwingen`.
- Getallen zijn getallen (geen tekst). Ontbrekende waarden: laat het veld weg of gebruik `null`.
