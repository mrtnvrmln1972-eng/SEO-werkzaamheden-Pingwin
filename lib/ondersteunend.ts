import { sql, ensureSchema } from "./db";
import { callClaude } from "./anthropic";
import { getClientBySlug } from "./clients";
import { getGscForPage } from "./google";
import { measurePage } from "./page-measure";
import { buildPingwinDoc, type DocSpec, type DocBlock } from "./pingwin-docx";
import { uploadDocx } from "./drive";
import { getPageDriveFolder } from "./site-urls";
import { registerGeneratedVersion } from "./doc-versions";

// ═══════════════════════════════════════════════════════════
// EEN BLOG ONDERSTEUNEND MAKEN AAN EEN LANDINGSPAGINA
// ═══════════════════════════════════════════════════════════
// Een klant levert een blog of een projectverhaal aan. Dat stuk gaat over
// hetzelfde onderwerp als een landingspagina die het moet hebben van precies dat
// zoekwoord. Publiceer je hem zoals hij is, dan gebeurt er één van twee dingen:
// Google kiest de blog in plaats van de landingspagina (dan verkoop je niets), of
// de twee wisselen elkaar af (dan zakken ze allebei). Dat is cannibalisatie, en
// het is geen randgeval maar de normale uitkomst.
//
// Deze motor lost dat op met de enige verdeling die werkt: één pagina is de baas
// op de commerciële hoofdterm, de ander pakt de informatieve vragen eromheen en
// geeft zijn kracht door met een interne link. Wat hier NIET gebeurt: de tekst
// herschrijven. De inhoud is van de klant en blijft van de klant; alleen de kop,
// de titel, de meta en een paar zinnen eromheen verschuiven, plus de links.
//
// Drie dingen worden hier in CODE nagerekend en niet aan het taalmodel
// overgelaten, want een instructie in een prompt is een verzoek en geen poort:
//   1. de hoofdterm van de landingspagina mag niet in de titel of de H1 van de
//      blog staan;
//   2. er moet vanuit de blog minstens één link naar elke doelpagina lopen;
//   3. de ankertekst van die link moet de hoofdterm bevatten, want dat is het
//      signaal dat je wilt doorgeven.
// Klopt er iets niet, dan komt dat als waarschuwing in beeld én in het document,
// in plaats van dat het stilletjes goed lijkt.
// ═══════════════════════════════════════════════════════════

export type OndersteunendDoel = {
  /** De landingspagina die sterker moet worden. */
  url: string;
  /** De term waarop die pagina de baas is en waar de blog dus vanaf blijft. */
  hoofdterm: string;
  /** Waar de blog zelf op mag mikken: de vragen eromheen. */
  steuntermen: string[];
};

export type OndersteunendeLink = {
  naar: string;
  anker: string;
  /** Waar in de blog die link komt, in gewone taal. */
  plek: string;
};

export type OndersteunendPlan = {
  kop: string;
  doelen: OndersteunendDoel[];
  titel: string;
  metaTitle: string;
  metaDescription: string;
  wijzigingen: string[];
  links: OndersteunendeLink[];
  /** Bestaande pagina's die naar deze blog zouden moeten linken. */
  linksNaarBlog: { van: string; anker: string }[];
  waarschuwingen: string[];
  /** De aangepaste tekst, met ## en ### voor de koppen. */
  tekst: string;
};

const SYSTEM = `Je bent een senior SEO-specialist bij bureau Pingwin. Je krijgt een blog of projectverhaal dat op de site van een klant gepubliceerd gaat worden, plus één of twee bestaande landingspagina's die het moeten hebben van hun eigen zoekwoord.

JOUW OPDRACHT: maak dat stuk ONDERSTEUNEND aan die landingspagina('s). Niet concurrerend.

DE VERDELING (dit is de kern, hier hangt alles aan):
- De landingspagina is en blijft de baas op zijn commerciële hoofdterm (de term waarmee iemand een opdracht zoekt, bijvoorbeeld "natuurzwembad aanleggen" of "hovenier Etten-Leur").
- De blog mikt op de informatieve vragen ERNAAST: hoe, wat kost, waarmee, hoe onderhoud je, wat is het verschil, welke soorten, een praktijkverhaal. Long tail, vraagvormen, ervaringen.
- De blog geeft zijn kracht door aan de landingspagina met een interne link waarvan de ankertekst juist WEL de hoofdterm bevat. Dat is precies andersom dan de tekst: de term staat in de link, niet in de kop.

MINIMAAL INGRIJPEN (net zo belangrijk):
- De inhoud is van de klant. Neem de tekst LETTERLIJK over, alinea voor alinea. Herschrijf niets omdat het mooier kan.
- Je past alleen aan wat nodig is om de botsing weg te nemen: de titel, de H1, de koppen die op de hoofdterm zitten, de eerste alinea, en de zinnen waar een interne link in komt. Voeg hooguit één korte afsluitende alinea toe die naar de landingspagina verwijst.
- Elke aanpassing die je doet, benoem je in "wijzigingen". Wat je niet noemt, heb je niet veranderd.

HARDE REGELS:
- De hoofdterm van een landingspagina staat NIET in de titel, NIET in de meta-title en NIET in de H1 van de blog. Ook geen letterlijke variant die er als hetzelfde uitziet voor Google.
- Per landingspagina minstens één, hooguit drie interne links vanuit de blog, met de hoofdterm (of een natuurlijke variant daarvan) als ankertekst. Nooit "lees meer" of "klik hier".
- Zet die links in de lopende tekst waar ze inhoudelijk kloppen, niet allemaal in de eerste alinea.
- Verzin geen feiten, cijfers, plaatsen of diensten die niet in de aangeleverde tekst of de data staan.
- Geen emoji. Geen losse streepjes als zinsscheiding; gebruik een komma, een puntkomma, haakjes of een nieuwe zin.

Antwoord met UITSLUITEND geldige JSON, niets eromheen:
{"kop":"één zin: wat dit stuk nu doet voor de landingspagina('s)",
 "doelen":[{"url":"...","hoofdterm":"de term waarop die pagina de baas is","steuntermen":["waar de blog op mikt","..."]}],
 "titel":"de nieuwe titel van de blog",
 "metaTitle":"maximaal 60 tekens",
 "metaDescription":"maximaal 155 tekens",
 "wijzigingen":["korte regels: wat je hebt aangepast en waarom, maximaal 6"],
 "links":[{"naar":"de doel-URL","anker":"de ankertekst","plek":"in welke alinea, in gewone taal"}],
 "linksNaarBlog":[{"van":"bestaande pagina die naar deze blog zou moeten linken","anker":"voorgestelde ankertekst"}],
 "waarschuwingen":["alleen als er iets is dat Maarten moet weten, anders lege lijst"],
 "tekst":"de volledige aangepaste tekst, met ## voor koppen en ### voor subkoppen, links als [ankertekst](url)"}`;

/** Staat een term (los van hoofdletters en meervoud-s) in deze regel tekst? */
function bevatTerm(tekst: string, term: string): boolean {
  const t = (term || "").trim().toLowerCase();
  if (t.length < 3) return false;
  return (tekst || "").toLowerCase().includes(t);
}

/** De eerste kop uit de aangepaste tekst; dat is de H1 van de blog. */
function eersteKop(tekst: string): string {
  for (const regel of (tekst || "").split("\n")) {
    const m = regel.match(/^#{1,3}\s+(.*)$/);
    if (m) return m[1].trim();
  }
  return "";
}

/**
 * De poort. Wat het taalmodel belooft is niet hetzelfde als wat het levert, dus
 * de drie dingen waar het echt om draait worden hier nagerekend en als
 * waarschuwing teruggegeven. Er wordt niets stilgehouden en niets geweigerd:
 * Maarten ziet wat er niet klopt en beslist zelf.
 */
export function controleerPlan(plan: OndersteunendPlan): string[] {
  const uit: string[] = [];
  const kop = eersteKop(plan.tekst);
  for (const doel of plan.doelen || []) {
    const term = (doel.hoofdterm || "").trim();
    if (!term) continue;
    if (bevatTerm(plan.titel, term) || bevatTerm(plan.metaTitle, term) || bevatTerm(kop, term)) {
      uit.push(`De hoofdterm "${term}" staat nog in de titel of de kop van dit stuk. Zo blijft het concurreren met ${doel.url}; haal hem daar weg en laat hem alleen in de linktekst staan.`);
    }
    const naarDoel = (plan.links || []).filter((l) => (l.naar || "").includes(doel.url) || doel.url.includes(l.naar || ""));
    if (!naarDoel.length) {
      uit.push(`Er loopt geen enkele link naar ${doel.url}. Zonder die link ondersteunt dit stuk niets; het staat er dan alleen maar naast.`);
    } else if (!naarDoel.some((l) => bevatTerm(l.anker, term))) {
      uit.push(`De link naar ${doel.url} heeft de hoofdterm "${term}" niet in de linktekst. Juist dáár hoort hij te staan, want dat is het signaal dat je doorgeeft.`);
    }
    if (naarDoel.length > 3) {
      uit.push(`Er staan ${naarDoel.length} links naar ${doel.url}. Meer dan drie in één stuk leest als opgevuld; houd de sterkste over.`);
    }
  }
  return uit;
}

/** Regels met ## en ### omzetten naar de blokken van een Pingwin-document. */
function tekstNaarBlokken(tekst: string): DocBlock[] {
  const blokken: DocBlock[] = [];
  let bullets: string[] = [];
  const legen = () => {
    if (bullets.length) { blokken.push({ type: "bullets", items: bullets }); bullets = []; }
  };
  for (const ruw of (tekst || "").split("\n")) {
    const regel = ruw.trim();
    if (!regel) { legen(); continue; }
    const kop = regel.match(/^#{1,6}\s+(.*)$/);
    if (kop) { legen(); blokken.push({ type: "subheading", text: kop[1].trim() }); continue; }
    const punt = regel.match(/^[-*]\s+(.*)$/);
    if (punt) { bullets.push(punt[1].trim()); continue; }
    legen();
    blokken.push({ type: "paragraph", text: regel });
  }
  legen();
  return blokken;
}

/** Wat we van een doelpagina weten: waar hij nu op gevonden wordt en wat erop staat. */
async function doelBeeld(domain: string, url: string): Promise<string> {
  const [meting, gsc] = await Promise.all([
    measurePage(url).catch(() => null),
    domain ? getGscForPage(domain, url, 90).catch(() => []) : Promise.resolve([]),
  ]);
  const regels: string[] = [`PAGINA: ${url}`];
  if (meting?.ok) {
    regels.push(`Titel: ${meting.metaTitle || "(geen)"}`);
    if (meting.h1?.length) regels.push(`H1: ${meting.h1.join(" | ")}`);
    if (meting.h2?.length) regels.push(`Koppen: ${meting.h2.slice(0, 12).join(" | ")}`);
  } else {
    regels.push("Deze pagina kon niet gelezen worden (bestaat hij al?); ga uit van de zoekwoorden en de URL.");
  }
  const top = (gsc || []).sort((a, b) => b.impressions - a.impressions).slice(0, 12);
  if (top.length) {
    regels.push("Waar deze pagina nu op gevonden wordt (Search Console, 90 dagen):");
    for (const k of top) regels.push(`  ${k.keyword} (positie ${k.position.toFixed(1)}, ${k.impressions} vertoningen, ${k.clicks} klikken)`);
  } else {
    regels.push("Nog geen Search Console-cijfers voor deze pagina.");
  }
  return regels.join("\n");
}

export async function maakOndersteunend(opts: {
  slug: string;
  versieId: number;
  doelUrls: string[];
  zoekwoorden?: string;
  folderId?: string;
}): Promise<{ ok: boolean; error?: string; plan?: OndersteunendPlan; link?: string; naam?: string }> {
  const { slug, versieId } = opts;
  const doelUrls = (opts.doelUrls || []).map((u) => u.trim()).filter(Boolean).slice(0, 2);
  if (!doelUrls.length) return { ok: false, error: "Kies eerst de landingspagina die dit stuk moet ondersteunen." };

  await ensureSchema();
  const { rows } = await sql`
    SELECT url, kind, naam, tekst FROM page_doc_versions WHERE client_slug = ${slug} AND id = ${versieId} LIMIT 1`;
  const versie = rows[0];
  if (!versie) return { ok: false, error: "Dit document staat niet meer in de lijst." };
  const bron = String(versie.tekst || "").trim();
  if (!bron) return { ok: false, error: "Van dit document is geen leesbare tekst bewaard, dus er valt niets aan te passen." };

  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  const beelden = await Promise.all(doelUrls.map((u) => doelBeeld(domain, u)));

  const user = `KLANT: ${client?.name || slug}${domain ? ` (${domain})` : ""}

DE LANDINGSPAGINA('S) DIE STERKER MOETEN WORDEN:
${beelden.join("\n\n")}
${opts.zoekwoorden?.trim() ? `\nMaarten geeft deze zoekwoorden mee als de termen waarop die pagina('s) moeten winnen: ${opts.zoekwoorden.trim()}\n` : ""}
HET AANGELEVERDE STUK (${versie.naam || "zonder naam"}):
${bron.slice(0, 16000)}`;

  let plan: OndersteunendPlan;
  try {
    const raw = await callClaude(SYSTEM, [{ role: "user", content: user }], 8192, { slug, action: "ondersteunend-maken" });
    const schoon = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const p = JSON.parse(schoon.slice(schoon.indexOf("{"), schoon.lastIndexOf("}") + 1)) as Partial<OndersteunendPlan>;
    plan = {
      kop: String(p.kop || "").trim() || "Dit stuk is ondersteunend gemaakt.",
      doelen: (Array.isArray(p.doelen) ? p.doelen : []).map((d) => ({
        url: String(d?.url || "").trim(),
        hoofdterm: String(d?.hoofdterm || "").trim(),
        steuntermen: (Array.isArray(d?.steuntermen) ? d.steuntermen : []).map(String).slice(0, 8),
      })).filter((d) => d.url),
      titel: String(p.titel || "").trim() || String(versie.naam || "Aangepast stuk"),
      metaTitle: String(p.metaTitle || "").trim(),
      metaDescription: String(p.metaDescription || "").trim(),
      wijzigingen: (Array.isArray(p.wijzigingen) ? p.wijzigingen : []).map(String).slice(0, 6),
      links: (Array.isArray(p.links) ? p.links : []).map((l) => ({
        naar: String(l?.naar || "").trim(), anker: String(l?.anker || "").trim(), plek: String(l?.plek || "").trim(),
      })).filter((l) => l.naar),
      linksNaarBlog: (Array.isArray(p.linksNaarBlog) ? p.linksNaarBlog : []).map((l) => ({
        van: String(l?.van || "").trim(), anker: String(l?.anker || "").trim(),
      })).filter((l) => l.van).slice(0, 5),
      waarschuwingen: (Array.isArray(p.waarschuwingen) ? p.waarschuwingen : []).map(String).slice(0, 5),
      tekst: String(p.tekst || "").trim(),
    };
  } catch (e) {
    return { ok: false, error: "Het aanpassen lukte niet: " + (e instanceof Error ? e.message : "onbekende fout") };
  }
  if (!plan.tekst) return { ok: false, error: "Er kwam geen aangepaste tekst terug; probeer het nog een keer." };

  // Geen doelen teruggekregen? Dan valt er ook niets na te rekenen, dus vullen we
  // ze aan met wat Maarten koos. Zonder dit zou de poort stilzwijgend niets doen.
  if (!plan.doelen.length) plan.doelen = doelUrls.map((u) => ({ url: u, hoofdterm: "", steuntermen: [] }));
  plan.waarschuwingen = [...plan.waarschuwingen, ...controleerPlan(plan)];

  // Het document: eerst wat er veranderd is en wat de sitebouwer moet doen, dan
  // pas de tekst zelf. Andersom scrolt niemand tot de instructie.
  const spec: DocSpec = {
    klant: client?.name || slug,
    rapporttype: "Ondersteunende publicatie",
    titel: plan.titel,
    ondertitel: `Ondersteunend aan ${doelUrls.join(" en ")}`,
    meta: { Klant: client?.name || slug, Ondersteunt: doelUrls.join(", ") },
    stijl: "werkdocument",
    sections: [
      {
        heading: "Wat dit stuk doet",
        blocks: [
          { type: "highlight", text: plan.kop },
          ...(plan.doelen.length ? [{
            type: "table" as const,
            headers: ["Landingspagina", "Blijft de baas op", "Dit stuk mikt op"],
            rows: plan.doelen.map((d) => [d.url, d.hoofdterm || "(niet bepaald)", d.steuntermen.join(", ") || "(niet bepaald)"]),
          }] : []),
          ...(plan.wijzigingen.length ? [{ type: "subheading" as const, text: "Wat er is aangepast" }, { type: "bullets" as const, items: plan.wijzigingen }] : []),
          ...(plan.waarschuwingen.length ? [{ type: "subheading" as const, text: "Let op" }, { type: "bullets" as const, items: plan.waarschuwingen }] : []),
        ],
      },
      {
        heading: "Voor de sitebouwer",
        blocks: [
          { type: "table", headers: ["Veld", "Waarde"], rows: [
            ["Paginatitel (meta-title)", plan.metaTitle || "(niet ingevuld)"],
            ["Meta-description", plan.metaDescription || "(niet ingevuld)"],
          ] },
          ...(plan.links.length ? [
            { type: "subheading" as const, text: "Links vanuit dit stuk" },
            { type: "table" as const, headers: ["Naar", "Linktekst", "Waar"], rows: plan.links.map((l) => [l.naar, l.anker, l.plek]) },
          ] : []),
          ...(plan.linksNaarBlog.length ? [
            { type: "subheading" as const, text: "Pagina's die naar dit stuk mogen linken" },
            { type: "table" as const, headers: ["Vanaf", "Linktekst"], rows: plan.linksNaarBlog.map((l) => [l.van, l.anker]) },
          ] : []),
        ],
      },
      { heading: "De aangepaste tekst", blocks: tekstNaarBlokken(plan.tekst) },
    ],
  };

  let buffer: Buffer;
  try {
    buffer = await buildPingwinDoc(spec);
  } catch (e) {
    return { ok: false, error: "Het document kon niet opgemaakt worden: " + (e instanceof Error ? e.message : "onbekende fout") };
  }

  // De map: wat Maarten in het venster koos, en anders de map die al bij deze
  // pagina of taak hoort. Zonder map geen bestand, en dat zeggen we ook.
  let folderId = (opts.folderId || "").trim();
  if (!folderId) {
    const opgeslagen = await getPageDriveFolder(slug, String(versie.url)).catch(() => null);
    folderId = opgeslagen?.folderId || "";
  }
  if (!folderId) {
    return { ok: false, error: "Er is nog geen Drive-map gekozen om dit in op te slaan. Kies er een bij \"Opslaan in\" en start opnieuw." };
  }

  const bestandsnaam = `${(client?.name || slug).replace(/[^\w\s-]/g, "").trim()}-ondersteunend-${plan.titel.replace(/[^\w\s-]/g, "").trim().slice(0, 60)}.docx`;
  let link = "";
  try {
    ({ link } = await uploadDocx(folderId, bestandsnaam, buffer));
  } catch (e) {
    return { ok: false, error: "Document gemaakt, maar het opslaan in Drive mislukte: " + (e instanceof Error ? e.message : "onbekende fout") };
  }

  // Als nieuw document in dezelfde taak, mét de doelpagina in de naam. Het
  // aangeleverde stuk blijft gewoon staan: er wordt nooit iets overschreven.
  const naam = `${plan.titel} (ondersteunend aan ${doelUrls.map(pad).join(" en ")})`;
  await registerGeneratedVersion(slug, String(versie.url), String(versie.kind || "copy"), naam, link, plan.tekst, plan.kop)
    .catch(() => { /* het bestand staat er; de lijst vult zich bij de volgende ronde */ });

  return { ok: true, plan, link, naam };
}

/** Alleen het pad, want een hele URL in een documentnaam leest niet. */
function pad(u: string): string {
  try { return new URL(u).pathname; } catch { return u; }
}
