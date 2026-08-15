// Proef op het kostenmodel: welke kosten horen bij welke omzet.
//
// WAAROM DIT BESTAAT
// ══════════════════
// Dit model bepaalt in één klap de kostenkant van élke klant. Staat er iets
// scheef, dan staat de hele marge scheef, en het valt niet op: de bedragen zijn
// plausibel en ze komen uit de boekhouding. Drie dingen gaan hier gegarandeerd
// een keer mis als niemand ze vastlegt:
//
//  1. DUBBEL TELLEN. Een klant heeft een linkbuildingbedrag in zijn eigen rij
//     staan én valt onder de verdeelregel van de linkbuilder. Tel je allebei,
//     dan betaalt Pingwin die linkbuilding op papier twee keer en lijkt elke
//     eigen SEO-klant de helft minder waard dan hij is.
//  2. EEN VASTE POST DIE PER KLANT MEETELT. Hosting of Ads horen één keer per
//     maand van het totaal af. Ga je dat per klant doen, dan is de winst weg
//     zodra er een klant bijkomt, precies andersom als het hoort.
//  3. EEN PERCENTAGE DAT NIET MEEBEWEEGT. Het hele punt van "70% van wat ik die
//     klant factureer" is dat je het nooit meer hoeft bij te werken. Zodra dat
//     een los ingevuld bedrag wordt, klopt het de dag na een tariefwijziging
//     niet meer.

import { pasKostenmodelToe, inDoelgroep, type KostenRegel } from "../lib/kostenmodel";
import { berekenPrognose, type RegelExtra, type PrognoseInstelling } from "../lib/prognose";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}${ok ? "" : `\n       gekregen ${gekregen}, verwacht ${verwacht}`}`);
}

const klant = (slug: string, maandbudget: number, linkbuilding = 0, grp: string | null = null) =>
  ({ slug, name: slug, fase: "klant", grp, budget: { maandbudget, linkbuilding } });
const lead = (slug: string, maandbudget: number) =>
  ({ slug, name: slug, fase: "lead", grp: null, budget: { maandbudget, linkbuilding: 0 } });

const regel = (p: Partial<KostenRegel>): KostenRegel => ({
  id: 1, naam: "regel", soort: "vast", leverancier: "X",
  percentage: 0, bedrag: 0, doelgroep: "", actief: true, bron: "", ...p,
});

const totaal = (m: Map<string, { naam: string; bedrag: number }[]>, slug: string) =>
  (m.get(slug) || []).reduce((s, r) => s + r.bedrag, 0);

// ── 1. Doelgroepen ──
check("eigen klant valt onder 'eigen'", inDoelgroep(klant("a", 0), "eigen"), "true");
check("een MMC-klant niet", inDoelgroep(klant("a", 0, 0, "mmc"), "eigen"), "false");
check("een MMC-klant valt onder 'mmc'", inDoelgroep(klant("a", 0, 0, "mmc"), "mmc"), "true");
check("'alle' pakt iedereen", inDoelgroep(klant("a", 0, 0, "mmc"), "alle"), "true");
check("een lege doelgroep pakt niemand", inDoelgroep(klant("a", 0), ""), "false");
{
  const bogard = { slug: "bogard", name: "Bogard Tuinen", fase: "klant", grp: null, budget: { maandbudget: 0, linkbuilding: 0 } };
  check("op naam gekozen klanten worden gevonden", inDoelgroep(bogard, "namen:bogard,gardenswimm"), "true");
  check("en de rest niet", inDoelgroep(klant("kamsteeg", 0), "namen:bogard,gardenswimm"), "false");
}

// ── 2. Een percentage van de omzet ──
{
  const klanten = [klant("mmc1", 1000, 0, "mmc"), klant("mmc2", 2000, 0, "mmc"), klant("eigen", 1500, 300)];
  const model = pasKostenmodelToe(klanten, [regel({ soort: "percentage", percentage: 70, doelgroep: "mmc" })]);
  check("70% van duizend is zevenhonderd", totaal(model.perKlant, "mmc1"), 700);
  check("70% van tweeduizend is veertienhonderd", totaal(model.perKlant, "mmc2"), 1400);
  check("een eigen klant blijft erbuiten", totaal(model.perKlant, "eigen"), 0);
  // Het hele punt: de kosten bewegen mee met het tarief, zonder dat er iemand
  // een bedrag hoeft bij te werken.
  const naVerhoging = pasKostenmodelToe(
    [klant("mmc1", 2000, 0, "mmc")],
    [regel({ soort: "percentage", percentage: 70, doelgroep: "mmc" })],
  );
  check("verdubbel je het tarief, dan verdubbelen de kosten mee", totaal(naVerhoging.perKlant, "mmc1"), 1400);
}

// ── 3. Een leveranciersfactuur verdelen ──
{
  const klanten = [klant("a", 1500, 300), klant("b", 1000, 100), klant("mmc1", 900, 0, "mmc")];
  const model = pasKostenmodelToe(klanten, [regel({ soort: "verdeel", bedrag: 800, doelgroep: "eigen" })]);
  // 300 van de 400 is driekwart, dus 600 van de 800.
  check("verdeeld naar rato van het linkbuildingbudget (a)", totaal(model.perKlant, "a"), 600);
  check("verdeeld naar rato van het linkbuildingbudget (b)", totaal(model.perKlant, "b"), 200);
  check("een MMC-klant krijgt geen linkbuilding", totaal(model.perKlant, "mmc1"), 0);
  const som = ["a", "b"].reduce((s, k) => s + totaal(model.perKlant, k), 0);
  check("samen is het precies de factuur, niet meer en niet minder", som, 800);
}

// ── 4. Verdelen zonder verdeelsleutel ──
// Staat er nergens een linkbuildingbedrag, dan is gelijk verdelen de eerlijkste
// aanname. Maar het moet wél gezegd worden, anders lijkt het een meting.
{
  const model = pasKostenmodelToe(
    [klant("a", 1000), klant("b", 1000)],
    [regel({ naam: "Linkbuilding", soort: "verdeel", bedrag: 900, doelgroep: "eigen" })],
  );
  check("gelijk verdeeld als er geen sleutel is", totaal(model.perKlant, "a"), 450);
  check("en dat wordt gemeld", /gelijk verdeeld/.test(model.meldingen.join(" ")), "true");
}

// ── 5. Een vaste post hangt aan de maand, niet aan de klant ──
{
  const model = pasKostenmodelToe(
    [klant("a", 1000), klant("b", 1000), klant("c", 1000)],
    [regel({ naam: "Hosting", soort: "vast", bedrag: 500 })],
  );
  check("een vaste post landt bij geen enkele klant", model.perKlant.size, 0);
  check("hij staat één keer in de vaste lijst", model.vast.length, 1);
  check("met het hele bedrag", model.vast[0].bedrag, 500);
}

// ── 6. Leads krijgen geen kosten uit het model ──
// Een lead heeft nog geen leverancier die factureert, en zijn kosten worden in
// de prognose al met zijn kans gewogen. Die twee door elkaar halen geeft een
// getal dat niemand kan navertellen.
{
  const model = pasKostenmodelToe(
    [klant("a", 1000, 0, "mmc"), lead("l", 1000)],
    [regel({ soort: "percentage", percentage: 70, doelgroep: "alle" })],
  );
  check("de klant krijgt zijn percentage", totaal(model.perKlant, "a"), 700);
  check("de lead niet", totaal(model.perKlant, "l"), 0);
}

// ── 7. Een uitgezette regel doet niets ──
{
  const model = pasKostenmodelToe(
    [klant("a", 1000, 0, "mmc")],
    [regel({ soort: "percentage", percentage: 70, doelgroep: "mmc", actief: false })],
  );
  check("een uitgezette regel telt niet mee", totaal(model.perKlant, "a"), 0);
}

// ── 8. Nooit dubbel tellen in de prognose zelf ──
// Dit is de belangrijkste van dit bestand. Een klant met een eigen
// linkbuildingbedrag ÉN een verdeelregel mag die kosten maar één keer dragen.
{
  const INSTELLING: PrognoseInstelling = { target: 0, targetOp: "netto", vasteLasten: 0, horizon: 1 };
  const leeg = new Map<string, RegelExtra>();
  // Namen van drie letters of langer: een doelgroep op naam koppelt bewust niet
  // op een losse letter, want dan zou hij op van alles matchen.
  const klanten = [klant("alpha", 1000, 300), klant("zonder", 1000, 250)];

  const model = pasKostenmodelToe(klanten, [
    regel({ id: 1, naam: "Linkbuilding", soort: "verdeel", bedrag: 400, doelgroep: "namen:alpha" }),
    regel({ id: 2, naam: "Hosting", soort: "vast", bedrag: 100 }),
  ]);
  const u = berekenPrognose(klanten, leeg, [], INSTELLING, "2026-08", model);
  const m = u.maanden[0];

  const a = m.bijdragen.find((b) => b.slug === "alpha");
  check("de klant met een regel gebruikt de regel", a?.kosten, 400);
  check("en niet ook nog zijn eigen 300", a?.netto, 600);

  const zonder = m.bijdragen.find((b) => b.slug === "zonder");
  check("de klant zonder regel gebruikt zijn eigen bedrag", zonder?.kosten, 250);

  check("de vaste post telt één keer bij de maand", m.kosten, 400 + 250 + 100);
  check("en het netto klopt", m.netto, 2000 - 750);
}

// ── 9. Twee klanten erbij maken de vaste post niet duurder ──
{
  const INSTELLING: PrognoseInstelling = { target: 0, targetOp: "netto", vasteLasten: 0, horizon: 1 };
  const leeg = new Map<string, RegelExtra>();
  const regels = [regel({ naam: "Ads", soort: "vast", bedrag: 900 })];
  const een = berekenPrognose([klant("a", 1000)], leeg, [], INSTELLING, "2026-08",
    pasKostenmodelToe([klant("a", 1000)], regels));
  const drie = [klant("a", 1000), klant("b", 1000), klant("c", 1000)];
  const veel = berekenPrognose(drie, leeg, [], INSTELLING, "2026-08", pasKostenmodelToe(drie, regels));
  check("met één klant gaat er 900 af", een.maanden[0].netto, 100);
  check("met drie klanten nog steeds 900", veel.maanden[0].netto, 3000 - 900);
}

console.log(fouten === 0 ? "\nHet kostenmodel klopt.\n" : `\n${fouten} fout(en) in het kostenmodel.\n`);
process.exit(fouten === 0 ? 0 : 1);
