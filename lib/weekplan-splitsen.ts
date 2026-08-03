import { getWeekplan, addWeekplanTasks, setWeekplanKaart } from "./weekplan";
import { getClientUrls } from "./site-urls";
import { splitsPerPagina } from "./overview-actions";
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

    const r = await addWeekplanTasks(slug, k.thread || "", rest.map((d) => ({
      taak: String(d.taak),
      toelichting: k.toelichting,
      wie: k.wie,
      url: String(d.url || ""),
      taaktype: k.taaktype,
      copyUrl: "",
      bronMail: k.bronMail,
      week: { year: k.weekYear, week: k.weekNo },
    })));
    toegevoegd += r.added + r.merged;
  }

  return { gesplitst, toegevoegd };
}
