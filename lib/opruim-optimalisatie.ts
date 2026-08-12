import { getCannibalAnalysis, zorgVoorPlaatsen } from "./cannibal-redirect";
import { getClientBySlug } from "./clients";
import { bouwWerklijst } from "./opruim-werklijst";
import { chatBesluitenVoor } from "./opruim-chat-besluiten";
import { getOpruimRegels } from "./opruim-regels";
import { addWeekplanTasks, isoWeek } from "./weekplan";
import { getSetting, setSetting } from "./settings";

// ═══════════════════════════════════════════════════════════
// HET SEINTJE: DOELPAGINA COMPLEET, OPTIMALISATIE KAN STARTEN
// ═══════════════════════════════════════════════════════════
// Bij samenvoegen is de volgorde: eerst alle content naar de doelpagina, dan de
// redirects, en pas dáárna de doelpagina volledig optimaliseren (analyse,
// blauwdruk, copy). Eerder optimaliseren is dubbel werk: je maakt een blauwdruk
// van een halve pagina en mag de copy opnieuw zodra de rest erin komt.
//
// Maarten hoort dat moment niet zelf te bewaken. Zodra de láátste samenvoeging
// naar een doelpagina is doorgevoerd, zet dit bestand automatisch één
// optimalisatietaak voor die doelpagina op de weekplanning. Eén keer: een
// marker in de instellingen voorkomt dat elke herhaalde doorvoer een nieuwe
// taak aanmaakt.
// ═══════════════════════════════════════════════════════════

const norm = (u: string) => {
  let p = u || "";
  try { p = new URL(u).pathname; } catch { /* al een pad */ }
  return p.replace(/\/+$/, "").toLowerCase() || "/";
};

const markerKey = (slug: string, doel: string) => `opt_taak:${slug}:${norm(doel)}`;

/**
 * Wordt aangeroepen ná een geslaagde doorvoer van `van`. Kijkt of daarmee álle
 * samenvoegingen naar hetzelfde doel op de site staan; zo ja, dan gaat er één
 * optimalisatietaak voor de doelpagina op de planning. Geeft de melding voor op
 * het scherm terug, of een lege tekst als er niets te melden is.
 */
export async function meldDoelpaginaCompleet(slug: string, van: string): Promise<string> {
  const domain = (await getClientBySlug(slug).catch(() => null))?.domain || "";
  if (!domain) return "";

  const [st, plaatsen, vaste] = await Promise.all([
    getCannibalAnalysis(slug),
    zorgVoorPlaatsen(slug, domain).catch(() => null),
    getOpruimRegels(slug).catch(() => []),
  ]);
  const regels = bouwWerklijst(st.result, plaatsen?.adviezen || [], chatBesluitenVoor(slug));

  // Alleen een samenvoeging kan een doelpagina "compleet" maken; een gewone
  // opruim-redirect brengt geen content mee en is dus geen aanleiding om de
  // doelpagina te verbouwen.
  const dit = regels.find((r) => r.uitkomst === "samenvoegen" && norm(r.pad) === norm(van));
  if (!dit || !dit.naar) return "";
  const doel = dit.naar;

  const groep = regels.filter((r) => r.uitkomst === "samenvoegen" && norm(r.naar) === norm(doel));
  const doorgevoerd = new Set(vaste.filter((r) => r.doorgevoerd).map((r) => norm(r.van)));
  doorgevoerd.add(norm(van)); // de doorvoer van zojuist telt mee, ook als de rij nog onderweg is
  const open = groep.filter((r) => !doorgevoerd.has(norm(r.pad)));
  if (open.length > 0) return "";

  // Compleet. Eén keer een taak, daarna alleen nog de melding dat hij er staat.
  const key = markerKey(slug, doel);
  if (await getSetting(key).catch(() => null)) {
    return "";
  }

  const site = `https://${domain.replace(/^https?:\/\//, "").replace(/\/$/, "")}`;
  const paden = groep.map((r) => r.pad);
  await addWeekplanTasks(slug, "opruimen", [{
    taak: `Optimaliseer ${doel} nu alle samenvoegingen erin zitten`,
    toelichting: [
      `De laatste samenvoeging naar deze pagina is doorgevoerd. Erin opgegaan: ${paden.join(", ")}.`,
      `Doorloop nu de volledige optimalisatie (analyse, blauwdruk, copy), zodat de pagina de binnengekomen content en zoektermen echt benut.`,
      `Dit is bewust ná de samenvoegingen gepland: eerder optimaliseren was dubbel werk geweest.`,
    ].join(" "),
    wie: "SEO",
    url: `${site}${doel.startsWith("/") ? doel : `/${doel}`}`,
    week: isoWeek(new Date()),
  }]);
  await setSetting(key, new Date().toISOString());

  return `Alle ${groep.length} samenvoegingen naar ${doel} staan op de site. Er staat nu een optimalisatietaak voor die pagina op de planning.`;
}
