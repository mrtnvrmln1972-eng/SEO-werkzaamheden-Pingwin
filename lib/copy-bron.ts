// ═══════════════════════════════════════════════════════════
// WAAR KOMT DE AANGELEVERDE TEKST VANDAAN?
// ═══════════════════════════════════════════════════════════
// Om te kunnen zeggen of de content op een landingpagina staat, heb je eerst de
// bedoelde content nodig. Die zit op twee mogelijke plekken, en het verschil doet
// ertoe voor hoe hard je uitspraak mag zijn:
//
//  1. Ons eigen copy-document in het dashboard. Bekend formaat, bekende koppen,
//     dus daar mag je hard op meten.
//  2. Een Word-bijlage bij de mail. Dat is hoe het bij Kamsteeg ging: de tekst
//     voor /tuinontwerp/strandtuin/ ging als .docx naar de bouwer en is nooit door
//     het dashboard gegaan. Bruikbaar, maar het KAN ook een briefing zijn in
//     plaats van de definitieve tekst, en dat weet je niet. Daarom telt die als
//     richtinggevend en niet als hard bewijs.
//
// Vinden we niets, dan zwijgen we. Een content-oordeel zonder brontekst is een
// mening met een percentage erbij.
// ═══════════════════════════════════════════════════════════

import { ensureSchema } from "./db";
import { msListAttachments, msGetAttachment, type LiveEmail } from "./ms-graph";
import { kanDirectGelezen, tekstUitLokaalBestand } from "./bestand-tekst";
import { koppenUitCopy } from "./copy-live";
import { haalCopyTekst } from "./copy-tekst";
import { topicTokens, tokenHits } from "./page-internal-links";

export type CopyBron = {
  tekst: string;
  koppen: string[];
  herkomst: "copydoc" | "bijlage";
  naam: string;
  datum: string;
  /** Waarom er niets gevonden is; alleen gevuld als er geen bron is. */
  reden: string;
};

// Grenzen die voorkomen dat één controle een halve mailbox binnenhaalt.
const MAX_MAILS_MET_BIJLAGE = 5;
const MAX_BIJLAGE_BYTES = 8 * 1024 * 1024;

/**
 * Ons eigen copy-document voor deze pagina, als dat er is.
 *
 * Het zoeken zelf staat in copy-tekst.ts, want de knop "Is dit doorgevoerd?" op
 * het weekbord stelt precies dezelfde vraag. Eén zoekweg voor beide: anders zegt
 * de ene plek "geen copydocument" terwijl de andere hem gewoon vindt.
 */
async function uitCopyDoc(slug: string, doelUrl: string): Promise<CopyBron | null> {
  await ensureSchema();
  const bron = await haalCopyTekst(slug, doelUrl).catch(() => null);
  if (!bron?.tekst) return null;
  const koppen = koppenUitCopy(bron.tekst);
  if (!koppen.length) return null;
  return { tekst: bron.tekst, koppen, herkomst: "copydoc", naam: bron.herkomst, datum: "", reden: "" };
}

/**
 * De meest waarschijnlijke bijlage bij deze pagina, uit de mailthread.
 *
 * "Meest waarschijnlijk" is hier een echte afweging: er kunnen meerdere documenten
 * in een thread hangen. We kiezen op inhoudelijke overlap tussen de koppen in het
 * document en het onderwerp van de doelpagina. Levert dat een gelijkspel op, dan
 * kiezen we niet maar vragen we het.
 */
async function uitBijlage(mails: LiveEmail[], doelPad: string, doelTitel: string): Promise<CopyBron | null> {
  const tokens = topicTokens([doelTitel, doelPad.replace(/[/-]/g, " ")]);
  const metBijlage = mails
    .filter((m) => m.hasAttachments)
    .slice()
    .sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || ""))
    .slice(0, MAX_MAILS_MET_BIJLAGE);

  type Kandidaat = { bron: CopyBron; score: number };
  const kandidaten: Kandidaat[] = [];

  for (const m of metBijlage) {
    const lijst = await msListAttachments(m.id).catch(() => null);
    for (const b of lijst || []) {
      if (!kanDirectGelezen(b.naam) || b.grootte > MAX_BIJLAGE_BYTES) continue;
      const bestand = await msGetAttachment(m.id, b.id).catch(() => null);
      if (!bestand) continue;
      const tekst = await tekstUitLokaalBestand(bestand.naam, bestand.buffer).catch(() => "");
      if (!tekst.trim()) continue;
      const koppen = koppenUitCopy(tekst);
      // Geen koppen herkend: dan is dit waarschijnlijk geen copy-document maar
      // een lijstje of een factuur. Overslaan, niet forceren.
      if (koppen.length < 3) continue;
      // Hoeveel raakt dit document het onderwerp van de doelpagina?
      const score = tokens.size ? tokenHits(koppen.join(" ") + " " + bestand.naam, tokens).length : 1;
      kandidaten.push({
        bron: {
          tekst, koppen, herkomst: "bijlage",
          naam: bestand.naam,
          datum: (m.receivedAt || "").slice(0, 10),
          reden: "",
        },
        score,
      });
    }
  }

  if (!kandidaten.length) return null;
  kandidaten.sort((a, b) => b.score - a.score);
  const beste = kandidaten[0];
  if (beste.score === 0) return null;
  // Twee documenten die even goed passen: dan is kiezen gokken.
  if (kandidaten.length > 1 && kandidaten[1].score === beste.score) {
    return {
      tekst: "", koppen: [], herkomst: "bijlage", naam: "", datum: "",
      reden: `er zaten meerdere documenten bij deze mailwisseling die even goed bij ${doelPad} passen (${kandidaten.slice(0, 3).map((k) => k.bron.naam).join(", ")}); zeg even welke erbij hoort`,
    };
  }
  return beste.bron;
}

/** Ons eigen copy-document als dat er is, anders de bijlage uit de mail. */
export async function haalCopyBron(
  slug: string, doelPad: string, doelTitel: string, mails: LiveEmail[],
): Promise<CopyBron> {
  const eigen = await uitCopyDoc(slug, doelPad).catch(() => null);
  if (eigen) return eigen;
  const bijlage = await uitBijlage(mails, doelPad, doelTitel).catch(() => null);
  if (bijlage) return bijlage;
  return {
    tekst: "", koppen: [], herkomst: "bijlage", naam: "", datum: "",
    reden: "ik kon geen aangeleverde tekst vinden: niet in het dashboard en niet als leesbare bijlage in deze mailwisseling",
  };
}
