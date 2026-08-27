import { getClientBySlug, saveClientProfile } from "./clients";
import { getSetting, setSetting } from "./settings";
import { scanClientUrls } from "./site-urls";
import { generateProfileSection, mergeProfileSection } from "./client-profile-gen";
import { autofillOrgData } from "./org-data";
import { getCompetitors, setCompetitors } from "./competitors";
import { collectOpportunities } from "./keyword-opportunities";
import { startPrioRun, runPrioriteitenScan } from "./prioriteiten-scan";
import { startCannibalRun, runCannibalRedirect } from "./cannibal-redirect";
import { markInternalLinksRunning, runInternalLinks, suggestTargets } from "./internal-links";
import { getGscQueryPagePairs } from "./google";
import { getSerpOverview, ahrefsConfigured } from "./ahrefs";
import { anthropicConfigured } from "./anthropic";
import { getOnboardingStand, ONBOARDING, wisSignaalCache, type StapKey } from "./onboarding";
import { startKlus, zetStap, klusKlaar, klusFout } from "./klussen";

// ═══════════════════════════════════════════════════════════
// "START ONBOARDING": ALLES WAT VANZELF KAN, IN VOLGORDE
// ═══════════════════════════════════════════════════════════
// Eén knop die de stappen uit lib/onboarding.ts aflopen en alles doet wat zonder
// mens kan. Twee dingen zijn bewust zo:
//
// 1. WAT AL AF IS WORDT OVERGESLAGEN, niet overgedaan. De knop is dus net zo
//    veilig bij een klant die al twee jaar loopt als bij een nieuwe: hij vult
//    alleen de gaten. Dat is precies waarom er geen aparte knop voor bestaande
//    klanten nodig is.
//
// 2. DE KORTE STAPPEN WORDEN AFGEWACHT, DE LANGE SCANS ALLEEN GESTART. De drie
//    site-brede scans draaien in hervatbare stappen met hun eigen cron-vangnet;
//    die hier afwachten zou het venster van de serverless-functie laten
//    aflopen, en dan lijkt de onboarding mislukt terwijl de scan gewoon loopt.
//
// Loopt hij tegen iets aan dat alleen Maarten kan (inloggen bij Search Console,
// de klantwaarde invullen), dan stopt hij daar niet mee, maar slaat hij dat over
// en meldt het aan het eind. Anders zou één ontbrekende inlog de hele rit blokkeren.
// ═══════════════════════════════════════════════════════════

export type Regel = { key: StapKey; label: string; uitkomst: "gedaan" | "stond-al" | "overgeslagen" | "mislukt" | "gestart"; toelichting: string };

export type RunStand = {
  status: "idle" | "running" | "done" | "error";
  bezigMet: string;
  regels: Regel[];
  error: string;
  updatedAt: string | null;
};

const LEEG: RunStand = { status: "idle", bezigMet: "", regels: [], error: "", updatedAt: null };
const sleutel = (slug: string) => `onboarding_run:${slug}`;

export async function getOnboardingRun(slug: string): Promise<RunStand> {
  const ruw = await getSetting(sleutel(slug)).catch(() => null);
  if (!ruw) return LEEG;
  try {
    const d = JSON.parse(ruw) as RunStand;
    // Een run die al een uur "bezig" is, is doodgelopen (serverless-venster weg).
    // Dat eerlijk tonen in plaats van eeuwig een draaiend molentje.
    if (d.status === "running" && d.updatedAt && Date.now() - new Date(d.updatedAt).getTime() > 3600000) {
      return { ...d, status: "error", error: "De vorige start is halverwege afgebroken. Klik opnieuw op starten; wat al gelukt is wordt overgeslagen." };
    }
    return d;
  } catch { return LEEG; }
}

// Het logboek van de rit, én de hartslag voor het klusje in de kop van de
// cockpit. Beide bij elkaar, zodat ze niet uit elkaar kunnen lopen.
const KLUS = "onboarding";
const AUTO_STAPPEN = 9; // het aantal stappen dat de rit zelf kan doen

async function bewaar(slug: string, st: Omit<RunStand, "updatedAt">): Promise<void> {
  await setSetting(sleutel(slug), JSON.stringify({ ...st, updatedAt: new Date().toISOString() })).catch(() => { /* nooit de run laten klappen op het logboek */ });
  try {
    if (st.status === "running") await zetStap(slug, KLUS, st.regels.length, st.bezigMet || "Bezig met de onboarding");
    else if (st.status === "error") await klusFout(slug, KLUS, st.error || "De onboarding liep vast.");
    else if (st.status === "done") await klusKlaar(slug, KLUS, `${st.regels.filter((r) => r.uitkomst === "gedaan" || r.uitkomst === "gestart").length} stappen gedaan`);
  } catch { /* het logboek mag nooit de rit laten klappen */ }
}

// ═══════════════════════════════════════════════════════════
// CONCURRENTEN VOORSTELLEN UIT DE ECHTE ZOEKRESULTATEN
// ═══════════════════════════════════════════════════════════
// Niet gevraagd aan een model ("wie zijn de concurrenten van deze kliniek"),
// maar opgezocht: neem de zoekwoorden waar de klant het meest op vertoond wordt,
// haal daarvan de top 10 op, en tel welke domeinen daar het vaakst in staan.
// Wie het vaakst náást je staat in de zoekresultaten ís je concurrent; dat is
// een meting en geen aanname.

const GEEN_CONCURRENT = /^(google|youtube|facebook|instagram|linkedin|wikipedia|marktplaats|bol|amazon|nu|rtl|ad|telegraaf|nos|reddit|pinterest|tiktok|x|twitter|thuisarts|zorgkaartnederland|kvk|indeed)\./i;

export async function voorstelConcurrenten(slug: string, domain: string): Promise<string[]> {
  if (!domain || !ahrefsConfigured()) return [];
  const eigen = domain.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/.*$/, "").toLowerCase();

  const paren = await getGscQueryPagePairs(domain, 90).catch(() => []);
  const perTerm = new Map<string, number>();
  for (const p of paren) perTerm.set(p.keyword, (perTerm.get(p.keyword) || 0) + p.impressions);
  const top = [...perTerm.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k);
  if (!top.length) return [];

  const tel = new Map<string, number>();
  for (const term of top) {
    const serp = await getSerpOverview(term).catch(() => []);
    for (const rij of serp) {
      let host = "";
      try { host = new URL(rij.url).hostname.replace(/^www\./, "").toLowerCase(); } catch { continue; }
      if (!host || host === eigen || host.endsWith(`.${eigen}`)) continue;
      if (GEEN_CONCURRENT.test(host)) continue;
      // Hoger in de top 10 telt zwaarder: nummer 1 is een echtere concurrent dan nummer 10.
      tel.set(host, (tel.get(host) || 0) + Math.max(1, 11 - (rij.position || 10)));
    }
  }
  return [...tel.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([h]) => h);
}

// ═══════════════════════════════════════════════════════════
// DE RIT
// ═══════════════════════════════════════════════════════════

export async function startOnboardingRun(slug: string): Promise<void> {
  await startKlus(slug, KLUS, "Onboarding", AUTO_STAPPEN, "Kijken wat er al staat").catch(() => { /* niet blokkerend */ });
  await bewaar(slug, { status: "running", bezigMet: "Kijken wat er al staat", regels: [], error: "" });
}

/**
 * `alleen` beperkt de rit tot een deel van de stappen. De knop op het klantscherm
 * geeft niets mee en doet dus alles, zoals altijd. De bulkrij geeft wél een lijst
 * mee, omdat de golven daar op prijs gesorteerd zijn: golf 1 mag de dure
 * site-brede scans juist niet starten.
 */
export async function draaiOnboardingRun(slug: string, alleen?: StapKey[]): Promise<void> {
  const magStap = (k: StapKey) => !alleen || alleen.includes(k);
  const regels: Regel[] = [];
  const noteer = async (r: Regel, volgende = "") => {
    regels.push(r);
    await bewaar(slug, { status: "running", bezigMet: volgende, regels, error: "" });
  };

  try {
    const client = await getClientBySlug(slug);
    if (!client) { await bewaar(slug, { status: "error", bezigMet: "", regels, error: "Deze klant bestaat niet." }); return; }

    const stand = await getOnboardingStand(slug);
    const staatVan = (k: StapKey) => stand.stappen.find((s) => s.key === k)?.staat;
    const nodigNog = (k: StapKey) => staatVan(k) === "open" || staatVan(k) === "verouderd";
    const label = (k: StapKey) => ONBOARDING.find((s) => s.key === k)!.label;
    const domain = (client.domain || "").trim();

    // ── Zonder website-adres kan hier niets ──
    if (!domain) {
      await bewaar(slug, {
        status: "done", bezigMet: "",
        regels: [{ key: "domein", label: label("domein"), uitkomst: "overgeslagen", toelichting: "Er is nog geen website-adres. Vul dat eerst in; daarna kan de rest vanzelf." }],
        error: "",
      });
      wisSignaalCache();
      return;
    }

    // ── 1. De pagina's van de site inlezen ──
    if (!magStap("urls")) { /* niet in deze golf */ }
    else if (nodigNog("urls")) {
      await bewaar(slug, { status: "running", bezigMet: "De pagina's van de site inlezen", regels, error: "" });
      try {
        const { scanned } = await scanClientUrls(slug, domain);
        await noteer({ key: "urls", label: label("urls"), uitkomst: scanned > 0 ? "gedaan" : "mislukt", toelichting: scanned > 0 ? `${scanned} pagina's ingelezen.` : "Er kwamen geen pagina's terug; controleer of de sitemap bereikbaar is." });
      } catch (e) {
        await noteer({ key: "urls", label: label("urls"), uitkomst: "mislukt", toelichting: (e as Error).message });
      }
    } else await noteer({ key: "urls", label: label("urls"), uitkomst: "stond-al", toelichting: "De pagina's stonden al ingelezen." });

    // ── 2. Klantprofiel en tone of voice uit de live site ──
    for (const [key, kind] of [["profiel", "profile"], ["tov", "tov"]] as const) {
      if (!magStap(key)) continue;
      if (!nodigNog(key)) { await noteer({ key, label: label(key), uitkomst: "stond-al", toelichting: "Stond er al." }); continue; }
      if (!anthropicConfigured()) { await noteer({ key, label: label(key), uitkomst: "overgeslagen", toelichting: "Hiervoor is een Claude-sleutel nodig in deze omgeving." }); continue; }
      await bewaar(slug, { status: "running", bezigMet: key === "profiel" ? "Het klantprofiel schrijven uit de live site" : "De tone of voice analyseren", regels, error: "" });
      try {
        const res = await generateProfileSection(slug, kind);
        if (!res.ok) { await noteer({ key, label: label(key), uitkomst: "mislukt", toelichting: res.error }); continue; }
        // Steeds opnieuw ophalen: de vorige stap heeft het profielveld net gewijzigd.
        const vers = await getClientBySlug(slug);
        await saveClientProfile(slug, mergeProfileSection(vers?.seoProfileRuw || "", res.section));
        await noteer({ key, label: label(key), uitkomst: "gedaan", toelichting: "Gemaakt op basis van de echte pagina's van de site." });
      } catch (e) {
        await noteer({ key, label: label(key), uitkomst: "mislukt", toelichting: (e as Error).message });
      }
    }

    // ── 3. Bedrijfsgegevens voorvullen uit de site ──
    // Blijft een stap van Maarten (KvK, openingstijden), maar wat de site zelf
    // prijsgeeft hoeft hij niet over te typen.
    if (!magStap("bedrijfsgegevens")) { /* niet in deze golf */ }
    else if (nodigNog("bedrijfsgegevens")) {
      await bewaar(slug, { status: "running", bezigMet: "De bedrijfsgegevens van de site uitlezen", regels, error: "" });
      try {
        const res = await autofillOrgData(slug);
        await noteer({
          key: "bedrijfsgegevens", label: label("bedrijfsgegevens"),
          uitkomst: res.ok ? "gedaan" : "mislukt",
          toelichting: res.ok ? `${res.gevuld || 0} velden uit de site gehaald. Loop ze na en vul aan wat de site niet toont.` : (res.error || "Uitlezen mislukte."),
        });
      } catch (e) {
        await noteer({ key: "bedrijfsgegevens", label: label("bedrijfsgegevens"), uitkomst: "mislukt", toelichting: (e as Error).message });
      }
    } else await noteer({ key: "bedrijfsgegevens", label: label("bedrijfsgegevens"), uitkomst: "stond-al", toelichting: "De bedrijfsgegevens waren al compleet." });

    // ── 4. Concurrenten opzoeken in de echte zoekresultaten ──
    if (!magStap("concurrenten")) { /* niet in deze golf */ }
    else if (nodigNog("concurrenten")) {
      await bewaar(slug, { status: "running", bezigMet: "Concurrenten opzoeken in de zoekresultaten", regels, error: "" });
      try {
        const voorstel = await voorstelConcurrenten(slug, domain);
        if (voorstel.length) {
          const bestaand = await getCompetitors(slug);
          const nieuw = await setCompetitors(slug, [...new Set([...bestaand, ...voorstel])]);
          await noteer({ key: "concurrenten", label: label("concurrenten"), uitkomst: "gedaan", toelichting: `Gevonden op basis van wie er het vaakst naast de klant staat: ${nieuw.join(", ")}. Pas ze gerust aan.` });
        } else {
          await noteer({ key: "concurrenten", label: label("concurrenten"), uitkomst: "overgeslagen", toelichting: "Er was nog te weinig zoekdata om concurrenten uit af te leiden; vul ze zelf in." });
        }
      } catch (e) {
        await noteer({ key: "concurrenten", label: label("concurrenten"), uitkomst: "mislukt", toelichting: (e as Error).message });
      }
    } else await noteer({ key: "concurrenten", label: label("concurrenten"), uitkomst: "stond-al", toelichting: "De concurrenten stonden er al." });

    // ── 5. Zoekwoordkansen verzamelen (heeft de concurrenten van net nodig) ──
    if (!magStap("zoekwoorden")) { /* niet in deze golf */ }
    else if (nodigNog("zoekwoorden")) {
      await bewaar(slug, { status: "running", bezigMet: "Zoekwoordkansen verzamelen", regels, error: "" });
      try {
        const res = await collectOpportunities(slug);
        await noteer({
          key: "zoekwoorden", label: label("zoekwoorden"),
          uitkomst: res.ok ? "gedaan" : "mislukt",
          toelichting: res.ok ? `${res.total || 0} kansen verzameld.` : (res.error || "Verzamelen mislukte."),
        });
      } catch (e) {
        await noteer({ key: "zoekwoorden", label: label("zoekwoorden"), uitkomst: "mislukt", toelichting: (e as Error).message });
      }
    } else await noteer({ key: "zoekwoorden", label: label("zoekwoorden"), uitkomst: "stond-al", toelichting: "De kansen waren al verzameld." });

    // ── 6. De drie site-brede scans: starten, niet afwachten ──
    // Vanaf hier telt de poort weer: de scans mogen alleen als hun voorwaarden nu
    // écht staan. We lezen de stand opnieuw, want de stappen hierboven hebben hem
    // net veranderd.
    const na = await getOnboardingStand(slug);
    const mag = (k: StapKey) => {
      const s = na.stappen.find((x) => x.key === k);
      return !!s && !s.wacht.length;
    };
    const alGedaan = (k: StapKey) => {
      const s = na.stappen.find((x) => x.key === k);
      return s?.staat === "af" || s?.staat === "bezig";
    };
    const wachtOp = (k: StapKey) => (na.stappen.find((x) => x.key === k)?.wacht || []).map((w) => w.label.toLowerCase()).join(" en ");

    for (const key of (["prioriteiten", "opruimen", "internelinks"] as StapKey[]).filter(magStap)) {
      if (alGedaan(key)) { await noteer({ key, label: label(key), uitkomst: "stond-al", toelichting: "Was al gedraaid of draait nu." }); continue; }
      if (!mag(key)) { await noteer({ key, label: label(key), uitkomst: "overgeslagen", toelichting: `Kan nog niet: eerst ${wachtOp(key)}.` }); continue; }
      try {
        if (key === "prioriteiten") {
          await startPrioRun(slug);
          void runPrioriteitenScan(slug).catch(() => { /* het cron-vangnet pakt hem op */ });
        } else if (key === "opruimen") {
          await startCannibalRun(slug);
          void runCannibalRedirect(slug).catch(() => { /* idem */ });
        } else {
          const doelen = await suggestTargets(slug).then((s) => s.slice(0, 5).map((t) => t.url)).catch(() => [] as string[]);
          if (!doelen.length) { await noteer({ key, label: label(key), uitkomst: "overgeslagen", toelichting: "Er zijn nog geen doelpagina's om door te meten." }); continue; }
          await markInternalLinksRunning(slug, doelen);
          void runInternalLinks(slug, doelen).catch(() => { /* idem */ });
        }
        await noteer({ key, label: label(key), uitkomst: "gestart", toelichting: "Draait op de achtergrond; je kunt dit scherm sluiten." });
      } catch (e) {
        await noteer({ key, label: label(key), uitkomst: "mislukt", toelichting: (e as Error).message });
      }
    }

    // ── 7. Wat alleen Maarten kan ──
    const eind = await getOnboardingStand(slug);
    for (const s of eind.stappen) {
      if (s.optioneel || s.door !== "jij" || s.staat === "af" || s.staat === "bezig") continue;
      if (!magStap(s.key)) continue;
      if (regels.some((r) => r.key === s.key)) continue;
      await noteer({ key: s.key, label: s.label, uitkomst: "overgeslagen", toelichting: `Dit kan alleen jij: ${s.detail}` });
    }

    await bewaar(slug, { status: "done", bezigMet: "", regels, error: "" });
    wisSignaalCache();
  } catch (e) {
    await bewaar(slug, { status: "error", bezigMet: "", regels, error: (e as Error).message });
  }
}
