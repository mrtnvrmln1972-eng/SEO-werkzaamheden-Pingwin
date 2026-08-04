"""
scoring.py

Scoring-engine voor de skill `vindbaarheid-prioriteiten-scan`.

Berekent per bevinding:
- Impact (0 tot 100)
- Effort (1 tot 10)
- Time to effect (1 tot 5)
- Confidence (0.3, 0.6, 0.9)
- Relevance_fit (0 tot 1)
- ROI-score
- Tier (1, 2, 3, 4 of SKIP)

CTR-curve: Advanced Web Ranking 2024 organic CTR study (NL desktop).

Geen externe afhankelijkheden buiten de standard library zodat de skill
ook werkt zonder pip install.
"""

from __future__ import annotations

import json
import math
import os
import re
from dataclasses import dataclass, field, asdict
from typing import Optional


# ---------------------------------------------------------------------------
# Gedeelde instellingen
# ---------------------------------------------------------------------------
# Alle getallen (CTR-curve, multipliers, drempels) staan in scoring-config.json,
# naast deze map. De dashboard-motor leest hetzelfde bestand. Zo kan een drempel
# niet op twee plekken stil uit elkaar lopen.

_CONFIG_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scoring-config.json")

with open(_CONFIG_PATH, encoding="utf-8") as _f:
    CONFIG: dict = json.load(_f)


# ---------------------------------------------------------------------------
# CTR-curve, Advanced Web Ranking 2024
# ---------------------------------------------------------------------------

CTR_CURVE: dict[int, float] = {
    int(k): v for k, v in CONFIG["ctr_curve"].items() if k.isdigit()
}

# Posities 11 t/m 20 krijgen een gemiddelde CTR; vanaf 21 een vaste minimumwaarde
CTR_POSITIONS_11_20: float = CONFIG["ctr_curve"]["11_tot_20"]
CTR_POSITION_21_PLUS: float = CONFIG["ctr_curve"]["21_en_verder"]


def ctr_for_position(position: int) -> float:
    """Geeft de verwachte organic CTR voor een gegeven positie.

    Positie 0 (of lager) betekent "rankt hier nog niet op", dus nul klikken.
    Dit gaf eerder de CTR van positie 1 terug, de allerhoogste. Gevolg: bij een
    content gap of een AEO-kans werd de winst berekend als 0.103 min 0.398, dus
    negatief, en dat werd afgekapt op nul. Elke content gap en elke AI-kans kwam
    daardoor uit op ROI 0 en belandde altijd in Skip: twee van de twaalf lenzen
    konden nooit iets opleveren.
    """
    if position < 1:
        return 0.0
    if position in CTR_CURVE:
        return CTR_CURVE[position]
    if 11 <= position <= 20:
        return CTR_POSITIONS_11_20
    return CTR_POSITION_21_PLUS


# ---------------------------------------------------------------------------
# Intentie-multipliers
# ---------------------------------------------------------------------------

INTENT_MULTIPLIER: dict[str, float] = {
    k: v for k, v in CONFIG["intentie_multiplier"].items() if not k.startswith("_")
}
INTENT_MULTIPLIER_ONBEKEND: float = CONFIG["intentie_multiplier"]["_onbekend"]

INTENT_KEYWORDS: dict[str, list[str]] = {
    "transactional": [
        "kopen", "bestellen", "offerte", "abonnement", "prijzen",
        "korting", "sale", "boeken", "afsluiten",
    ],
    "lokaal-commercial": [
        # "in " stond hier ook, als losse marker. Dat matchte op elk zoekwoord met
        # het woordje "in" erin ("cursus in het weekend") en tilde dat naar 0.9.
        # Weg; plaatsnamen en "regio" doen dit werk wel betrouwbaar.
        "in de buurt", "bij mij", "regio", "amsterdam", "rotterdam",
        "utrecht", "den haag", "eindhoven", "groningen", "tilburg",
        "almere", "breda", "nijmegen", "haarlem", "arnhem",
    ],
    "commercial": [
        "beste", "vergelijken", "review", "test", "alternatief", "vs",
        "top 10", "tips", "welke", "advies",
    ],
    "navigational": [
        "login", "inloggen", "contact", "klantenservice",
    ],
    "informational": [
        "wat is", "hoe werkt", "waarom", "uitleg", "betekenis",
        "verschil tussen", "soorten", "voorbeelden",
    ],
}


def classify_intent(keyword: str, default: str = "lokaal-commercial") -> str:
    """Classificeert keyword-intentie op basis van modifiers.

    Bij twijfel valt hij terug op lokaal-commercial want de Pingwin-klantmix
    leunt sterk op die intentie.
    """
    kw = keyword.lower()
    for intent in ["transactional", "lokaal-commercial", "commercial",
                   "navigational", "informational"]:
        for marker in INTENT_KEYWORDS[intent]:
            # Op hele woorden matchen, niet op losse letters. Anders maakt "vs"
            # van "advies" een vergelijkings-zoekwoord en "test" van "protest".
            if re.search(r"\b" + re.escape(marker.strip()) + r"\b", kw):
                return intent
    return default


# ---------------------------------------------------------------------------
# Relevance-fit
# ---------------------------------------------------------------------------

PROPOSITION_NEGATIVE_MARKERS: list[str] = [
    "geen prijsvechter", "niet goedkoop", "niet de goedkoopste",
    "niet budget", "geen budget",
]

PROPOSITION_PREMIUM_MARKERS: list[str] = [
    "premium", "luxe", "exclusief", "topkwaliteit", "hoogwaardig",
]

# Stammen, geen hele woorden. "goedkoop" alleen miste "goedkope kozijnen", en dat
# is nu juist de meest voorkomende vorm in het Nederlands; het meest off-brand
# zoekwoord glipte er dus altijd doorheen.
KEYWORD_BUDGET_MARKERS: list[str] = [
    "goedkop", "goedkoop", "voordelig", "budget", "lage prijs", "laagste prijs",
    "discount", "aanbieding", "afgeprijsd", "korting",
]

KEYWORD_PREMIUM_MARKERS: list[str] = [
    "premium", "luxe", "exclusief", "high-end", "topkwaliteit",
]


def compute_relevance_fit(
    keyword: str,
    klant_kernwoorden: list[str],
    propositie: str,
) -> float:
    """Berekent relevance_fit (0 tot 1).

    Logica:
    1. Begin met overlap-score op basis van klantprofiel-kernwoorden.
    2. Pas modifiers toe vanuit de propositie (negatief, premium).
    3. Klem naar [0, 1].
    """
    kw = keyword.lower()
    propositie_l = propositie.lower()
    cfg = CONFIG["relevance_fit"]

    # Stap 1, overlap met klantprofiel
    overlap = 0
    for kernwoord in klant_kernwoorden:
        if kernwoord.lower() in kw:
            overlap += 1
    base = min(cfg["basis_start"] + cfg["per_overlap"] * overlap, cfg["basis_max"])

    # Stap 2a, propositie spreekt zich uit tegen budget en keyword is budget.
    # Dit gaf eerder exact 0.4 terug, terwijl de skip-poort op KLEINER DAN 0.4
    # test. Gevolg: de poort ging nooit dicht en er belandde nooit iets in Skip,
    # precies bij de zoekwoorden waar hij voor bedoeld was. Nu 0.25 (off-brand).
    if any(m in propositie_l for m in PROPOSITION_NEGATIVE_MARKERS):
        if any(b in kw for b in KEYWORD_BUDGET_MARKERS):
            return round(min(base, cfg["off_brand_budget"]), 2)

    # Stap 2b, propositie is premium en keyword is premium
    if any(p in propositie_l for p in PROPOSITION_PREMIUM_MARKERS):
        if any(pm in kw for pm in KEYWORD_PREMIUM_MARKERS):
            base = min(base + cfg["premium_bonus"], 1.0)

    # Stap 2c, geen overlap met klant en geen propositie-trigger: lage default.
    # Bewust NIET onder de skip-grens: de overlap-test kijkt letterlijk of een
    # kernwoord in het zoekwoord voorkomt, en veel terechte zoekwoorden doen dat
    # niet. Onder de grens zetten zou het merendeel ten onrechte wegfilteren.
    if overlap == 0 and not any(p in propositie_l for p in PROPOSITION_PREMIUM_MARKERS):
        base = min(base, cfg["geen_overlap_max"])

    return round(max(0.0, min(1.0, base)), 2)


# ---------------------------------------------------------------------------
# Impact, ROI, Tier
# ---------------------------------------------------------------------------

@dataclass
class Bevinding:
    """Eén bevinding uit een lens. Vul de velden in en roep .score() aan."""

    bevinding_id: str
    type: str                    # bv. "striking_distance", "ctr_underperform", "aeo_opportunity"
    titel: str
    url: str
    zoekwoord: str
    maandvolume: int             # max van Ahrefs volume of GSC impressies
    huidige_positie: int
    target_positie: int
    intentie: str = "lokaal-commercial"
    relevance_fit: float = 0.7
    effort: int = 5              # 1 tot 10
    time_to_effect: int = 3      # 1 tot 5
    confidence: float = 0.6      # 0.3, 0.6 of 0.9
    ctr_actueel: Optional[float] = None      # alleen voor lens 2 (CTR-onderkans)
    benchmark_ctr_voor_positie: Optional[float] = None  # idem
    rationale: str = ""
    vervolg_skill: str = ""

    # Berekend
    ctr_uplift: float = field(default=0.0, init=False)
    impact: float = field(default=0.0, init=False)
    roi_score: float = field(default=0.0, init=False)
    extra_clicks_per_maand: float = field(default=0.0, init=False)
    tier: str = field(default="", init=False)
    skip_reason: str = field(default="", init=False)

    def _ctr_uplift(self) -> float:
        """CTR-uplift hangt af van het type bevinding."""
        if self.type == "ctr_underperform":
            # Lens 2: positie is gelijk, alleen CTR-uplift telt
            if self.ctr_actueel is None or self.benchmark_ctr_voor_positie is None:
                return 0.0
            return max(0.0, self.benchmark_ctr_voor_positie - self.ctr_actueel)
        # Standaard: positiewinst
        ctr_now = ctr_for_position(self.huidige_positie)
        ctr_target = ctr_for_position(self.target_positie)
        return max(0.0, ctr_target - ctr_now)

    def _impact(self) -> float:
        """Impact op schaal 0 tot ~100, voor de scoringsformule.

        Formule: log10(volume) * 100 * CTR_uplift * intent_mul * relevance_fit
        De factor 100 zorgt dat realistische cases (volume 1k+, CTR-uplift 5-10%)
        terechtkomen in een interpreteerbare 5 tot 60 range.
        """
        volume = max(1, self.maandvolume)
        base = math.log10(volume) * float(CONFIG["impact"]["factor"])
        intent_mul = INTENT_MULTIPLIER.get(self.intentie, INTENT_MULTIPLIER_ONBEKEND)
        return round(base * self.ctr_uplift * intent_mul * self.relevance_fit, 2)

    def score(self) -> "Bevinding":
        """Voert de volledige scoring uit en zet alle berekende velden."""
        self.ctr_uplift = round(self._ctr_uplift(), 4)
        self.impact = self._impact()
        self.extra_clicks_per_maand = round(self.ctr_uplift * self.maandvolume, 1)

        denominator = max(1, self.effort) * max(1, self.time_to_effect)
        self.roi_score = round((self.impact * self.confidence) / denominator, 3)
        return self


# ---------------------------------------------------------------------------
# Tier-toewijzing
# ---------------------------------------------------------------------------

def _percentile(values: list[float], p: float) -> float:
    """Eenvoudige percentiel-berekening, p = 0..1."""
    if not values:
        return 0.0
    sorted_values = sorted(values)
    idx = int(p * (len(sorted_values) - 1))
    return sorted_values[idx]


def assign_tiers(bevindingen: list[Bevinding]) -> list[Bevinding]:
    """Wijst aan elke bevinding een tier toe volgens de regels uit SKILL.md.

    Volgorde:
    1. SKIP als relevance_fit < 0.4 of roi_score < 0.5
    2. Tier 1, 2, 3, 4 op basis van Effort, TTE, Confidence, ROI-percentiel
    """
    if not bevindingen:
        return bevindingen

    t = CONFIG["tiers"]
    fit_grens = t["skip_relevance_fit_onder"]
    roi_grens = t["skip_roi_onder"]

    # Bewust alleen de niet-geskipte ROI's: anders drukt een berg lage scores de
    # drempel voor "deze week" kunstmatig omlaag.
    rois = [b.roi_score for b in bevindingen if b.roi_score >= roi_grens]
    top25_threshold = _percentile(rois, t["top25_percentiel"]) if rois else 0.0

    for b in bevindingen:
        # Gate-check
        if b.relevance_fit < fit_grens:
            b.tier = "SKIP"
            b.skip_reason = "off-brand fit, propositie spreekt zich uit tegen dit segment"
            continue
        if b.roi_score < roi_grens:
            b.tier = "SKIP"
            b.skip_reason = f"ROI-score {b.roi_score} onder drempel {roi_grens}"
            continue

        # Tiering
        if (
            b.confidence >= t["tier1"]["confidence_min"]
            and b.effort <= t["tier1"]["effort_max"]
            and b.time_to_effect <= t["tier1"]["tte_max"]
            and b.roi_score >= top25_threshold
        ):
            b.tier = "1"  # Deze week
        elif (
            b.confidence >= t["tier2"]["confidence_min"]
            and b.effort <= t["tier2"]["effort_max"]
            and b.time_to_effect <= t["tier2"]["tte_max"]
        ):
            b.tier = "2"  # Deze maand
        elif b.effort <= t["tier3"]["effort_max"] and b.time_to_effect <= t["tier3"]["tte_max"]:
            b.tier = "3"  # Dit kwartaal
        else:
            b.tier = "4"  # Strategisch

    return bevindingen


# ---------------------------------------------------------------------------
# Aggregatie voor het rapport
# ---------------------------------------------------------------------------

def totale_verwachte_uplift(bevindingen: list[Bevinding]) -> dict:
    """Geeft de geaggregeerde uplift voor de executive summary.

    Som van extra_clicks_per_maand x confidence over tier 1 en tier 2.
    """
    relevant = [b for b in bevindingen if b.tier in ("1", "2")]
    expected = sum(b.extra_clicks_per_maand * b.confidence for b in relevant)
    return {
        "extra_bezoekers_per_maand": round(expected),
        "aantal_items_tier_1": sum(1 for b in bevindingen if b.tier == "1"),
        "aantal_items_tier_2": sum(1 for b in bevindingen if b.tier == "2"),
        "aantal_items_tier_3": sum(1 for b in bevindingen if b.tier == "3"),
        "aantal_items_tier_4": sum(1 for b in bevindingen if b.tier == "4"),
        "aantal_items_skip": sum(1 for b in bevindingen if b.tier == "SKIP"),
    }


def top_n_voor_summary(
    bevindingen: list[Bevinding], n: int = 5
) -> list[Bevinding]:
    """Selecteert de top-N met diversiteit naar type.

    Strategie:
    1. Sorteer op ROI-score aflopend.
    2. Loop door en voeg toe; sla over als hetzelfde type al 2 keer in de lijst zit.
    """
    sorted_by_roi = sorted(
        [b for b in bevindingen if b.tier in ("1", "2")],
        key=lambda b: b.roi_score,
        reverse=True,
    )
    selected: list[Bevinding] = []
    type_count: dict[str, int] = {}
    for b in sorted_by_roi:
        if type_count.get(b.type, 0) >= 2:
            continue
        selected.append(b)
        type_count[b.type] = type_count.get(b.type, 0) + 1
        if len(selected) >= n:
            break
    return selected


# ---------------------------------------------------------------------------
# Helpers voor JSON in/out, zodat generators eenvoudig kunnen importeren
# ---------------------------------------------------------------------------

def to_dict(b: Bevinding) -> dict:
    return asdict(b)


def from_dict(d: dict) -> Bevinding:
    valid_fields = {f for f in Bevinding.__dataclass_fields__}
    init_keys = {k: v for k, v in d.items() if k in valid_fields and k not in {
        "ctr_uplift", "impact", "roi_score",
        "extra_clicks_per_maand", "tier", "skip_reason",
    }}
    b = Bevinding(**init_keys)
    return b


# ---------------------------------------------------------------------------
# Smoke-test (uitvoerbaar als CLI)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    voorbeeld = [
        Bevinding(
            bevinding_id="L1-001",
            type="striking_distance",
            titel="Pagina 'kozijnen op maat' staat op 8 voor hoofdkw",
            url="https://example.nl/kozijnen-op-maat",
            zoekwoord="kozijnen op maat",
            maandvolume=1900,
            huidige_positie=8,
            target_positie=3,
            intentie="commercial",
            relevance_fit=0.85,
            effort=3,
            time_to_effect=2,
            confidence=0.9,
            rationale="Pagina rankt al, on-page tweaks plus 1 nieuw FAQ-blok",
            vervolg_skill="seo-analyse-landingpage + seo-copywriting",
        ),
        Bevinding(
            bevinding_id="L2-001",
            type="ctr_underperform",
            titel="Pagina 'houten kozijnen' onder benchmark CTR op pos 4",
            url="https://example.nl/houten-kozijnen",
            zoekwoord="houten kozijnen",
            maandvolume=2400,
            huidige_positie=4,
            target_positie=4,
            intentie="commercial",
            relevance_fit=0.9,
            effort=1,
            time_to_effect=1,
            confidence=0.6,
            ctr_actueel=0.038,
            benchmark_ctr_voor_positie=0.067,
            vervolg_skill="seo-copywriting (alleen meta)",
        ),
        Bevinding(
            bevinding_id="L5-007",
            type="content_gap",
            titel="Geen pagina voor 'goedkope kunststof kozijnen'",
            url="",
            zoekwoord="goedkope kunststof kozijnen",
            maandvolume=880,
            huidige_positie=99,
            target_positie=5,
            intentie="commercial",
            relevance_fit=0.2,  # propositie zegt geen prijsvechter
            effort=7,
            time_to_effect=4,
            confidence=0.3,
            rationale="Past niet bij propositie 'geen prijsvechter'",
            vervolg_skill="(skip, off-brand)",
        ),
    ]

    for b in voorbeeld:
        b.score()

    assign_tiers(voorbeeld)

    print("Bevindingen na scoring en tiering:")
    print(f"{'ID':<8} {'Type':<22} {'Impact':>7} {'ROI':>6} {'Tier':<6} Extra/m")
    for b in voorbeeld:
        print(
            f"{b.bevinding_id:<8} {b.type:<22} "
            f"{b.impact:>7} {b.roi_score:>6} {b.tier:<6} {b.extra_clicks_per_maand}"
        )

    print()
    print("Aggregaat:")
    print(totale_verwachte_uplift(voorbeeld))

    print()
    print("Top voor summary:")
    for b in top_n_voor_summary(voorbeeld):
        print(f"- {b.bevinding_id} {b.titel}")
