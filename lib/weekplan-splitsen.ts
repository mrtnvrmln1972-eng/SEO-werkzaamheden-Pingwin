import { getWeekplan, addWeekplanTasks, setWeekplanKaart, updateWeekplanToelichting } from "./weekplan";
import { getClientUrls } from "./site-urls";
import { splitsPerPagina, opdrachtZonderPad } from "./overview-actions";
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
      // Belandde het werk in een bestaande kaart, dan komt het er als opdracht bij.
      for (const id of r.mergedIds) await vulOpdrachtAan(slug, id, opdrachtZonderPad(String(d.taak)));
    }
  }

  return { gesplitst, toegevoegd };
}

// ═══════════════════════════════════════════════════════════
// EXTRA WERK KOMT IN DE KAART, NIET IN DE TITEL
// ═══════════════════════════════════════════════════════════
// Dit heette `vulTitelAan` en plakte de opdracht met " + " achter de kaarttitel.
// Dat leek logisch ("anders zie je in het bord niets veranderen"), maar het liet
// titels vanzelf volgroeien tot 190 tekens: de kaart van /hovenier/etten-leur/
// stond op 6 augustus 2026 op 183 tekens en las als een alinea. En omdat deze
// stap bij élke keer laden draait, kwam elke opgeschoonde titel vanzelf terug.
//
// De opdracht landt nu onder het kopje "Opdrachten:" in de kaart zelf. Dat is
// ook waar hij hoort: een titel zegt wáár het over gaat, de kaart zegt wat er
// moet gebeuren. Het bord toont het aantal, dus je ziet nog steeds dat er iets
// bij is gekomen.
const KOP = "Opdrachten:";

async function vulOpdrachtAan(slug: string, id: number, opdracht: string): Promise<void> {
  const kort = (opdracht || "").trim();
  if (!kort) return;
  const kaarten = await getWeekplan(slug);
  const kaart = kaarten.find((k) => k.id === id);
  if (!kaart) return;

  // Dezelfde rem als voorheen: staat de kern er al, in de titel of in de tekst,
  // dan komt hij er niet nog een keer bij.
  const kern = kort.toLowerCase().split(/\s+/).slice(0, 4).join(" ");
  if (!kern) return;
  const heel = (kaart.toelichting || "").trim();
  if ((kaart.taak || "").toLowerCase().includes(kern) || heel.toLowerCase().includes(kern)) return;

  const zin = kort.charAt(0).toUpperCase() + kort.slice(1);
  const regels = heel ? heel.split("\n") : [];
  const kopIndex = regels.findIndex((r) => r.trim().toLowerCase() === KOP.toLowerCase());
  if (kopIndex >= 0) {
    let eind = kopIndex + 1;
    while (eind < regels.length && regels[eind].trim()) eind++;
    regels.splice(eind, 0, `- ${zin}`);
  } else {
    regels.push("", KOP, `- ${zin}`);
  }
  await updateWeekplanToelichting(slug, id, regels.join("\n"));
}
