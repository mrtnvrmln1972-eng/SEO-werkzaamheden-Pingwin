import { getWeekplan, addWeekplanTasks, setWeekplanKaart, type WeekplanTask } from "./weekplan";
import { getClientUrls } from "./site-urls";
import { splitsPerPagina, opdrachtZonderPad, kaartTitel } from "./overview-actions";
import { urlKey } from "./url-key";

// ═══════════════════════════════════════════════════════════
// ÉÉN KAART PER PAGINA, OOK MET TERUGWERKENDE KRACHT
// ═══════════════════════════════════════════════════════════
// De splitser werkt bij het AANMAKEN van een kaart. De kaarten die er al stonden
// bleven daardoor zoals ze waren: "Controleer of Pingwin-copy CRP-pagina's live
// staat" hing aan /crp-test/, terwijl het werk over twee pagina's ging, en bij
// /crp-waarde-testen/ stond nergens dat de copy nog live moest.
//
// Deze opruimstap draait bij het openen van de weekplanning en herstelt dat: een
// kaart die over meerdere bekende pagina's gaat wordt de kaart van de eerste
// pagina, en het werk wordt bij de andere pagina's aangevuld (in hun bestaande
// kaart, als die er is). Zo hoeft Maarten niets over te doen.
//
// Idempotent: staat er eenmaal één pad in de titel, dan laat de splitser de kaart
// met rust, dus een tweede ronde verandert niets meer.
// ═══════════════════════════════════════════════════════════

export async function splitsBestaandeKaarten(slug: string): Promise<{ gesplitst: number; toegevoegd: number }> {
  let bekendeUrls: string[] = [];
  try { bekendeUrls = (await getClientUrls(slug)).map((u) => u.url); } catch { return { gesplitst: 0, toegevoegd: 0 }; }
  if (bekendeUrls.length < 2) return { gesplitst: 0, toegevoegd: 0 };

  const kaarten = await getWeekplan(slug);
  let gesplitst = 0, toegevoegd = 0;

  for (const k of kaarten) {
    if (k.status === "klaar") continue;

    // Twee opschoningen op de kaart zoals hij nu is, vóór er iets gesplitst wordt.
    await schoonTitel(slug, k, bekendeUrls);
    await titelUitAchtergrond(slug, k);

    // Bewust ZONDER de achtergrondtekst bij een kaart die al een pagina heeft.
    // Die achtergrond noemt bijna altijd ook de zusterpagina's ("dit hoort bij de
    // aanpak van de CRP-pagina's"), en dan zou een kaart die alleen over deze
    // pagina gaat alsnog uiteenvallen. Bij een bestaande kaart telt dus alleen
    // wat de TITEL zegt: staan daar twee paden in, of een meervoud, dan splitst hij.
    const delen = splitsPerPagina(
      [{ taak: k.taak, toelichting: k.url ? "" : k.toelichting, url: k.url }],
      bekendeUrls,
    );
    if (delen.length < 2) continue;

    // De helft die bij de huidige pagina van deze kaart hoort blijft deze kaart;
    // staat die er niet bij, dan wordt het de eerste. Zo verhuist een kaart nooit
    // ongemerkt naar een andere pagina.
    const eigen = k.url ? delen.find((d) => d.url && urlKey(String(d.url)) === urlKey(k.url)) : undefined;
    const blijft = eigen || delen[0];
    const rest = delen.filter((d) => d !== blijft);

    await setWeekplanKaart(slug, k.id, { taak: String(blijft.taak), url: String(blijft.url || k.url) });
    gesplitst++;

    // Eén voor één, zodat we weten wélke bestaande kaart iets kreeg aangeplakt.
    for (const d of rest) {
      const r = await addWeekplanTasks(slug, k.thread || "", [{
        taak: String(d.taak),
        toelichting: k.toelichting,
        wie: k.wie,
        url: String(d.url || ""),
        taaktype: k.taaktype,
        copyUrl: "",
        bronMail: k.bronMail,
        week: { year: k.weekYear, week: k.weekNo },
      }]);
      toegevoegd += r.added + r.merged;
      // Belandde het werk in een bestaande kaart, dan hoort het ook in de TITEL
      // van die kaart te staan. Anders zie je in het bord niets veranderen: het
      // extra werk zit dan alleen in de achtergrondtekst, die dichtgeklapt is.
      for (const id of r.mergedIds) await vulTitelAan(slug, id, opdrachtZonderPad(String(d.taak)));
    }
  }

  return { gesplitst, toegevoegd };
}

// Een al gesplitste kaart die in zijn titel nog "de CRP-pagina's" zegt, leest als
// een kaart die NIET gesplitst is. Het pad staat er inmiddels voor, dus die
// meervoudsverwijzing kan weg.
async function schoonTitel(slug: string, k: WeekplanTask, bekendeUrls: string[]): Promise<void> {
  const titel = (k.taak || "").trim();
  if (!/^\/[^\s:]*:/.test(titel)) return;                 // nog geen pad-prefix
  if (!/\bpagina'?s\b/i.test(titel)) return;              // niets misleidends
  const pad = titel.slice(0, titel.indexOf(":"));
  if (!bekendeUrls.some((u) => { try { return new URL(u).pathname === pad; } catch { return false; } })) return;
  const nieuw = kaartTitel(titel, pad);
  if (nieuw && nieuw !== titel) { await setWeekplanKaart(slug, k.id, { taak: nieuw }); k.taak = nieuw; }
}

// Werk dat bij het samenvoegen als "- /eigen-pad/: doe dit" in de achtergrond
// belandde, hoort in de titel te staan. Anders zie je in het bord niets van het
// extra werk: de achtergrond is dichtgeklapt.
async function titelUitAchtergrond(slug: string, k: WeekplanTask): Promise<void> {
  if (!k.url || !k.toelichting) return;
  let pad = ""; try { pad = new URL(k.url).pathname; } catch { return; }
  if (pad.length < 2) return;
  for (const raw of k.toelichting.split("\n")) {
    const m = new RegExp(`^\\s*[-*]?\\s*${pad.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*(.+)$`, "i").exec(raw.trim());
    if (!m) continue;
    const opdracht = opdrachtZonderPad(kaartTitel(m[1].trim(), pad));
    if (opdracht) await vulTitelAan(slug, k.id, opdracht);
  }
}

// Plakt het samengevoegde werk achter de bestaande kaarttitel, maar alleen als
// het er nog niet in staat en de titel er niet onleesbaar lang van wordt.
async function vulTitelAan(slug: string, id: number, opdracht: string): Promise<void> {
  const kort = (opdracht || "").trim();
  if (!kort) return;
  const kaarten = await getWeekplan(slug);
  const kaart = kaarten.find((k) => k.id === id);
  if (!kaart) return;
  const huidig = (kaart.taak || "").trim();
  const kern = kort.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
  if (!kern || huidig.toLowerCase().includes(kern)) return;
  const nieuw = `${huidig} + ${kort.charAt(0).toLowerCase() + kort.slice(1)}`;
  if (nieuw.length > 190) return;
  await setWeekplanKaart(slug, id, { taak: nieuw });
}
