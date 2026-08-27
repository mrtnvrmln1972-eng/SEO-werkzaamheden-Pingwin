// ═══════════════════════════════════════════════════════════
// HET PROFIELVELD SAMENVOEGEN, ZONDER IETS WEG TE GOOIEN
// ═══════════════════════════════════════════════════════════
// Het klantprofielveld bevat drie dingen: de automatisch gegenereerde
// klantprofiel-sectie, de automatisch gegenereerde tone-of-voice-sectie, en de
// eigen know-how (alles zonder "## "-kop).
//
// Tot 27-08-2026 werkte het samenvoegen zo: zoek de kop, en vervang alles tot de
// VOLGENDE kop. Stond de eigen know-how onder de laatste sectie, en dat deed hij
// altijd, dan was er geen volgende kop en werd hij dus mee vervangen. Zo verdween
// bij Paul Hoevenaars in één misklik de nuancering die hij had aangeleverd.
//
// De reparatie is de volgorde: de eigen know-how staat vanaf nu VOORAAN, vóór de
// twee gegenereerde secties. Dan bestaat "tot het eind van het veld" niet meer
// voor de laatste sectie, en kan een analyseknop per definitie niet meer buiten
// zijn eigen kop komen. Bestaande velden worden bij de eerste samenvoeging
// vanzelf in die volgorde gezet. `proeven/klant-correcties.proef.ts` bewaakt het.
// ═══════════════════════════════════════════════════════════

/**
 * De eigen know-how krijgt vanaf 27-08-2026 een eigen vaste kop. Daarvóór had
 * hij er geen, en juist dat maakte hem onzichtbaar voor de samenvoeging: hij
 * hoorde bij geen enkele sectie en werd dus opgeslokt door de laatste.
 */
export const KNOWHOW_HEADER = "## Jouw know-how over de klant";

export type ProfielDelen = { knowhow: string; secties: { header: string; tekst: string }[] };

/** Knipt de opgeslagen profieltekst in eigen know-how plus de "## "-secties. */
export function knipProfiel(md: string): ProfielDelen {
  const lines = (md || "").split("\n");
  const los: string[] = [];
  const secties: { header: string; tekst: string[] }[] = [];
  for (const l of lines) {
    if (/^##\s/.test(l)) secties.push({ header: l.trim(), tekst: [l] });
    else if (secties.length) secties[secties.length - 1].tekst.push(l);
    else los.push(l);
  }

  const stukken: string[] = [los.join("\n").trim()];
  const uit: { header: string; tekst: string }[] = [];
  for (let i = 0; i < secties.length; i++) {
    const s = secties[i];
    if (s.header === KNOWHOW_HEADER) {
      stukken.push(s.tekst.slice(1).join("\n").trim());
      continue;
    }
    // Erfenis-redding: in oude velden staat de eigen know-how als staart onder de
    // LAATSTE gegenereerde sectie, zonder kop. Beide gegenereerde secties eindigen
    // op een opsomming, dus wat daarna nog aan gewone alinea's volgt is van
    // Maarten. Bij twijfel bewaren we het (het schuift naar het eigen vak), want
    // een regel te veel bewaard is oneindig veel beter dan een regel kwijt.
    if (i === secties.length - 1) {
      const body = s.tekst.slice(1);
      let laatsteLijst = -1;
      for (let j = 0; j < body.length; j++) {
        if (/^\s*([-*|]|\*\*|###)/.test(body[j])) laatsteLijst = j;
      }
      // Geen opsomming in de sectie? Dan is de laatste door een witregel
      // afgescheiden alinea de kandidaat, mits er iets vóór stond.
      let knip = laatsteLijst;
      if (knip === -1) {
        for (let j = 0; j < body.length; j++) if (!body[j].trim()) knip = j;
        if (!body.slice(0, knip).join("").trim()) knip = -1;
      }
      const staart = knip >= 0 ? body.slice(knip + 1).join("\n").trim() : "";
      if (staart) {
        stukken.push(staart);
        uit.push({ header: s.header, tekst: [s.tekst[0], ...body.slice(0, knip + 1)].join("\n").trim() });
        continue;
      }
    }
    uit.push({ header: s.header, tekst: s.tekst.join("\n").trim() });
  }

  return { knowhow: stukken.filter(Boolean).join("\n\n").trim(), secties: uit };
}

/** Zet de delen weer in de vaste volgorde: eigen know-how eerst, dan de secties. */
export function plakProfiel(delen: ProfielDelen): string {
  const eigen = delen.knowhow.trim();
  return [eigen ? `${KNOWHOW_HEADER}\n${eigen}` : "", ...delen.secties.map((s) => s.tekst.trim())]
    .filter(Boolean).join("\n\n");
}

/**
 * Voegt één gegenereerde sectie samen met de bestaande profieltekst: vervangt de
 * sectie met dezelfde kop en laat al het andere ongemoeid, de eigen know-how
 * voorop.
 */
export function voegSectieSamen(current: string, section: string): string {
  const nieuw = (section || "").trim();
  if (!nieuw) return (current || "").trim();
  const header = (nieuw.split("\n")[0] || "").trim();
  const delen = knipProfiel(current || "");

  if (!header.startsWith("##")) {
    // Geen kop: dit is eigen know-how, die wordt aangevuld in plaats van vervangen.
    delen.knowhow = [delen.knowhow, nieuw].filter(Boolean).join("\n\n");
    return plakProfiel(delen);
  }

  const i = delen.secties.findIndex((s) => s.header === header);
  if (i === -1) delen.secties.push({ header, tekst: nieuw });
  else delen.secties[i] = { header, tekst: nieuw };
  return plakProfiel(delen);
}
