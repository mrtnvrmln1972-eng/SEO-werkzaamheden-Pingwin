// generate_report.js
//
// Genereert vindbaarheid-prioriteiten-rapport.docx in Pingwin huisstijl.
// Leest een JSON-bestand met de gescoorde bevindingen plus context (klant,
// propositie, modus, top-5, aggregaten) en bouwt het rapport via de centrale
// pingwin-docx-components.js.
//
// Aanroep:
//   node generate_report.js <bevindingen.json> <output.docx>
//
// Invoerformaat (bevindingen.json):
// {
//   "klant":      "Klantnaam",
//   "datum":      "07-05-2026",
//   "modus":      "C",
//   "propositie": "Korte propositie-zin van 1 tot 3 regels.",
//   "ctr_model":  "Advanced Web Ranking 2024",
//   "aggregaat": {
//     "extra_bezoekers_per_maand": 1230,
//     "aantal_items_tier_1": 4, "aantal_items_tier_2": 7,
//     "aantal_items_tier_3": 9, "aantal_items_tier_4": 6,
//     "aantal_items_skip": 5
//   },
//   "scorecard_lenzen": [{"lens": "1 Striking distance", "status": "pass"}, ...],
//   "top_5": [...Bevinding...],
//   "tier_1": [...], "tier_2": [...], "tier_3": [...], "tier_4": [...],
//   "skip":   [...],
//   "ai_prompts": ["...", "..."]
// }
//
// Een Bevinding-object heeft minimaal de velden: bevinding_id, type, titel,
// url, zoekwoord, maandvolume, huidige_positie, target_positie, intentie,
// relevance_fit, effort, time_to_effect, confidence, ctr_uplift, impact,
// roi_score, extra_clicks_per_maand, tier, vervolg_skill, rationale.

const fs   = require("fs");
const path = require("path");
const { Document, Packer, Paragraph, TextRun, AlignmentType } = require("docx");

// Centrale Pingwin huisstijl. Het pad stond hard op /mnt/skills/user/..., dat
// alleen in een specifieke omgeving bestaat; overal elders crashte dit script
// meteen op de require. Nu eerst de kopie naast deze skill in de repo (die reist
// altijd mee), daarna de bekende alternatieven.
const HUISSTIJL_KANDIDATEN = [
  path.resolve(__dirname, "..", "..", "pingwin-huisstijl", "assets"),
  "/mnt/skills/user/pingwin-huisstijl/assets",
  path.join(process.env.HOME || "", ".claude", "skills", "pingwin-huisstijl", "assets"),
];
const HUISSTIJL_DIR = HUISSTIJL_KANDIDATEN.find((d) => fs.existsSync(path.join(d, "pingwin-docx-components.js")));
if (!HUISSTIJL_DIR) {
  throw new Error(
    "Pingwin huisstijl niet gevonden. Gezocht in:\n  " + HUISSTIJL_KANDIDATEN.join("\n  "),
  );
}
const P = require(path.join(HUISSTIJL_DIR, "pingwin-docx-components.js"));
const logoBuffer = fs.readFileSync(path.join(HUISSTIJL_DIR, "Zzz_Pingwin_Logo.jpg"));


function statusKleur(status) {
  // Visuele markering in de scorecard via emoji + label, omdat
  // pingwin-docx-components geen kleur-cell support heeft per cel.
  switch ((status || "").toLowerCase()) {
    case "pass":     return "✅ Pass";
    case "aandacht": return "⚠️ Aandacht";
    case "kritiek":  return "🔴 Kritiek";
    default:         return status || "";
  }
}


function formatBevindingTitle(b) {
  return `${b.bevinding_id}. ${b.titel}`;
}


function actionCardChildren(b) {
  // Eén "action card" per bevinding in tier 1 of 2.
  // Pingwin-componenten bieden geen card-component, dus we bouwen het op met
  // sectiekop, korte body en een datatabel met de kerngetallen.
  const out = [];

  out.push(P.createSectionDivider(formatBevindingTitle(b)));

  // Body, korte beschrijving plus rationale
  const wat = b.titel || "";
  const waarom = b.rationale || "Geen aanvullende rationale meegegeven.";
  out.push(P.createBodyText(`Wat: ${wat}`));
  if (b.url) {
    out.push(P.createBodyText(`Waar: ${b.url}`));
  }
  out.push(P.createBodyText(`Waarom: ${waarom}`));

  // Kerngetallen-tabel
  const headers = [
    "Zoekwoord", "Volume", "Huidig", "Target",
    "Impact", "Effort", "TTE", "Conf.", "ROI",
  ];
  const row = [
    b.zoekwoord || "",
    String(b.maandvolume ?? ""),
    String(b.huidige_positie ?? ""),
    String(b.target_positie ?? ""),
    String(b.impact ?? ""),
    String(b.effort ?? ""),
    String(b.time_to_effect ?? ""),
    String(b.confidence ?? ""),
    String(b.roi_score ?? ""),
  ];
  out.push(P.createDataTable(headers, [row]));

  // Verwachte uplift en vervolg-skill
  out.push(P.createHighlightBox(
    `Verwachte extra clicks per maand: ${b.extra_clicks_per_maand ?? "?"}. ` +
    `Vervolg-skill: ${b.vervolg_skill || "(geen vervolg-skill aangewezen)"}.`
  ));

  return out;
}


function roadmapTabel(tier1, tier2, tier3, tier4) {
  // Compacte roadmap, drie tot vijf items per tier.
  const headers = ["Tier", "ID", "Titel", "ROI", "Vervolg-skill"];
  const rows = [];

  function tierRijen(label, items, max) {
    items.slice(0, max).forEach((b, i) => {
      rows.push([
        i === 0 ? label : "",
        b.bevinding_id || "",
        (b.titel || "").slice(0, 60),
        String(b.roi_score ?? ""),
        b.vervolg_skill || "",
      ]);
    });
  }

  tierRijen("Tier 1, deze week",      tier1, 5);
  tierRijen("Tier 2, deze maand",     tier2, 5);
  tierRijen("Tier 3, dit kwartaal",   tier3, 5);
  tierRijen("Tier 4, strategisch",    tier4, 3);

  return P.createDataTable(headers, rows);
}


function buildDocument(data) {
  const klant     = data.klant     || "Klant";
  const datum     = data.datum     || new Date().toLocaleDateString("nl-NL");
  const propositie = data.propositie || "(geen propositie meegegeven)";
  const aggregaat = data.aggregaat || {};
  const scorecard = data.scorecard_lenzen || [];
  const top5      = data.top_5    || [];
  const tier1     = data.tier_1   || [];
  const tier2     = data.tier_2   || [];
  const tier3     = data.tier_3   || [];
  const tier4     = data.tier_4   || [];
  const skip      = data.skip     || [];
  const aiPrompts = data.ai_prompts || [];
  const ctrModel  = data.ctr_model  || "Advanced Web Ranking 2024";
  const modus     = data.modus      || "C";

  const children = [];

  // 1. Cover
  children.push(...P.createCoverPage(
    "Vindbaarheid Prioriteiten Scan",
    "SEO plus AEO roadmap, gescoord op ROI",
    {
      Klant: klant,
      Datum: datum,
      Modus: modus,
      "CTR-model": ctrModel,
    }
  ));

  // 2. Executive summary
  children.push(P.createSectionDivider("1. Executive summary"));
  children.push(P.createBodyText(
    `Propositie als basis voor relevance-fit: "${propositie}"`
  ));

  const kpis = [
    { label: "Extra bezoekers per maand (verwacht)", value: String(aggregaat.extra_bezoekers_per_maand ?? "?"), change: "tier 1 + tier 2", status: "good" },
    { label: "Items tier 1, deze week",   value: String(aggregaat.aantal_items_tier_1 ?? 0),  change: "", status: "good" },
    { label: "Items tier 2, deze maand",  value: String(aggregaat.aantal_items_tier_2 ?? 0),  change: "", status: "good" },
    { label: "Items tier 3, dit kwartaal", value: String(aggregaat.aantal_items_tier_3 ?? 0), change: "", status: "neutral" },
    { label: "Items tier 4, strategisch", value: String(aggregaat.aantal_items_tier_4 ?? 0), change: "", status: "neutral" },
    { label: "Items SKIP",                value: String(aggregaat.aantal_items_skip ?? 0),    change: "off-brand of lage ROI", status: "warning" },
  ];
  children.push(P.createKPITable(kpis));

  if (top5.length > 0) {
    children.push(P.createBodyText("Top-5 acties (gewogen op ROI plus diversiteit):"));
    const top5Items = top5.map((b, i) =>
      `${i + 1}. ${b.titel} (ROI ${b.roi_score}, ${b.vervolg_skill || "geen vervolg-skill"})`
    );
    children.push(...P.createBulletList(top5Items));
  }

  // 3. Scorecard 12 lenzen
  children.push(P.createSectionDivider("2. Scorecard, 12 lenzen"));
  if (scorecard.length > 0) {
    const headers = ["Lens", "Status", "Korte toelichting"];
    const rows = scorecard.map(s => [
      s.lens || "",
      statusKleur(s.status),
      (s.toelichting || "").slice(0, 80),
    ]);
    children.push(P.createDataTable(headers, rows));
  } else {
    children.push(P.createBodyText("Scorecard niet aangeleverd."));
  }

  // 4. Roadmap-tabel
  children.push(P.createSectionDivider("3. Roadmap, vier tiers"));
  children.push(roadmapTabel(tier1, tier2, tier3, tier4));

  // 5. Action cards voor tier 1 en 2
  children.push(P.createSectionDivider("4. Action cards, tier 1 en 2"));
  if (tier1.length === 0 && tier2.length === 0) {
    children.push(P.createBodyText("Geen tier-1 of tier-2 items in deze scan."));
  } else {
    [...tier1, ...tier2].forEach(b => {
      actionCardChildren(b).forEach(child => children.push(child));
    });
  }

  // 6. Skip-rationale
  children.push(P.createSectionDivider("5. SKIP, niet doen en waarom"));
  if (skip.length === 0) {
    children.push(P.createBodyText("Geen items in Skip-tier."));
  } else {
    const headers = ["ID", "Zoekwoord", "Reden"];
    const rows = skip.slice(0, 25).map(b => [
      b.bevinding_id || "",
      b.zoekwoord || "",
      b.skip_reason || b.rationale || "",
    ]);
    children.push(P.createDataTable(headers, rows));
    if (skip.length > 25) {
      children.push(P.createBodyText(
        `(${skip.length - 25} extra Skip-items, zie tracker.xlsx voor volledige lijst.)`
      ));
    }
  }

  // 7. Methodologie-bijlage
  children.push(P.createSectionDivider("6. Methodologie, bijlage"));
  children.push(P.createBodyText(`CTR-curve-bron: ${ctrModel}.`));
  children.push(P.createBodyText(`Datum scan: ${datum}.`));
  children.push(P.createBodyText(`Input-modus: ${modus} (A auto, B manueel, C combinatie).`));
  children.push(P.createBodyText(`Propositie: "${propositie}"`));

  if (aiPrompts.length > 0) {
    children.push(P.createBodyText("Door de gebruiker goedgekeurde AI-prompts voor lens 12:"));
    children.push(...P.createBulletList(aiPrompts.slice(0, 12)));
  }

  return new Document({
    styles: P.styles,
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1080, right: 1080, bottom: 1080, left: 1080 },
        },
      },
      headers: { default: P.createPageHeader(klant, "Vindbaarheid Prioriteiten Scan", logoBuffer) },
      footers: { default: P.createPageFooter() },
      children,
    }],
  });
}


// CLI
async function main() {
  const [, , inputPath, outputPath] = process.argv;

  if (!inputPath || !outputPath) {
    console.error("Gebruik: node generate_report.js <bevindingen.json> <output.docx>");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const doc = buildDocument(data);
  const buffer = await Packer.toBuffer(doc);
  fs.writeFileSync(outputPath, buffer);
  console.log(`Rapport geschreven: ${outputPath}`);
}

if (require.main === module) {
  main().catch(err => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { buildDocument };
