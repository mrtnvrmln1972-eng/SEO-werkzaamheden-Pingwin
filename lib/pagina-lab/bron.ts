// ═══════════════════════════════════════════════════════════
// DE BRUG NAAR EEN PAGINA BUITEN DIT DOMEIN (eerste steen van het Pagina-lab)
// ═══════════════════════════════════════════════════════════
// Waarom dit bestaat: de Claude-omgeving mag alleen met dit dashboard praten.
// Elke andere website geeft daar geen verbinding, dus een klantpagina kan van
// daaruit niet gelezen en niet bekeken worden. Precies dezelfde muur stond er
// bij het dashboard zelf, en die is opgelost door het van de andere kant te
// doen: deze server kan wél overal bij, en draait al een browser.
//
// `lib/render-page.ts` haalde die HTML al op voor de metingen, maar alleen
// binnenin. Hier komt daar één ding bij dat het verschil maakt: een FOTO. Een
// oordeel over vormgeving, over wat er boven de vouw staat, over de rust op een
// scherm, kun je niet uit HTML halen. Dat moet je zien.
//
// Deze laag MEET en KIJKT, hij oordeelt niet. Wat hier uitkomt is wat er staat,
// zonder mening erover. Datzelfde onderscheid staat in `lib/site-controle.ts`
// en het is er om dezelfde reden: een model dat een plausibel verhaal kan
// vertellen doet dat ook als de meting ontbreekt.
//
// EN HIJ SCHRIJFT NIETS. Geen tabel, geen taak, geen werklijst. Het Pagina-lab
// leest mee met alles wat er al is en laat het SEO-werk met rust.
//
// De grens die hier hard is: geen enkel adres binnen een netwerk. Deze route
// haalt op verzoek een willekeurige URL op, en zonder die grens zou je hem
// kunnen laten kijken naar wat er náást deze server draait. Daarom wordt elke
// naam eerst opgezocht en elk gevonden adres gecontroleerd, en na afloop nog
// een keer, want een omleiding kan alsnog ergens anders uitkomen.
// ═══════════════════════════════════════════════════════════

import dns from "dns/promises";
import { metBrowser } from "../browser";
import { BEZOEKER_UA } from "../render-page";

export type Apparaat = "mobiel" | "desktop";

const MOBIELE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

// Een gangbaar laptopscherm en een gangbare telefoon. Niet de uitersten: het
// gaat erom wat de meeste bezoekers zien.
//
// Let op wat er NIET staat: `isMobile` en `hasTouch`. Die zetten de volledige
// apparaat-nabootsing van Chromium aan, en daarmee liep elke mobiele foto vast
// tot de server er de stekker uit trok (op deze site vier en een halve minuut,
// zonder foto). Een smalle breedte plus een mobiele user-agent levert hetzelfde
// beeld op, want daar reageert een responsive site op, en het werkt wél.
const APPARATEN: Record<Apparaat, { breedte: number; hoogte: number; ua?: string }> = {
  desktop: { breedte: 1440, hoogte: 900 },
  mobiel: { breedte: 390, hoogte: 844, ua: MOBIELE_UA },
};

/**
 * Naar de pagina toe, en niet stukgaan op het wachten.
 *
 * "Alles is stil op het netwerk" is de beste maat voor "de pagina is af", maar
 * op een site met trackers en chatwidgets wordt het nóóit helemaal stil. Dan
 * loopt het wachten tegen zijn limiet aan, gooit puppeteer een fout, en krijg
 * je geen foto terwijl de pagina allang in beeld stond. Precies dat gebeurde op
 * de eerste meting. Dus: wachten tot het stil is, en als dat niet lukt gewoon
 * verder met wat er staat.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function gaNaar(page: any, url: string): Promise<any> {
  try {
    return await page.goto(url, { waitUntil: "networkidle2", timeout: 20000 });
  } catch {
    try {
      return await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
    } catch {
      // Al onderweg naar deze pagina: de tweede goto naar hetzelfde adres kan
      // afketsen terwijl het beeld er wel is. Verder met wat er staat.
      return null;
    }
  }
}

// De vaste knoppen van de gangbare cookiemelders. Op naam, want die zijn
// betrouwbaar; de tekstterugval hieronder is een net minder zeker middel.
const COOKIE_KNOPPEN = [
  "#CybotCookiebotDialogBodyLevelButtonLevelOptinAllowAll",
  "#CybotCookiebotDialogBodyButtonAccept",
  "#onetrust-accept-btn-handler",
  ".cky-btn-accept",
  ".cmplz-accept",
  "#cmpwelcomebtnyes",
  ".cc-allow",
  ".js-cookie-consent-agree",
  "[data-cky-tag=accept-button]",
  "[aria-label='Alles accepteren']",
];

/**
 * De cookiemelding wegklikken vóór de foto.
 *
 * Zonder dit fotografeer je op de meeste sites een cookiemelding in plaats van
 * een pagina. Dat is precies wat er bij de eerste meting gebeurde: het hele
 * eerste scherm van de lensimplantatie-pagina ging schuil achter Cookiebot, en
 * juist dat eerste scherm is waar het oordeel over gaat.
 *
 * Er wordt op "accepteren" geklikt, niet op "weigeren", want dat is wat de
 * meeste bezoekers doen en dus wat de meeste bezoekers zien. Aan de site
 * verandert er niets; het geldt alleen voor deze ene browsersessie.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function klikCookieWeg(page: any): Promise<boolean> {
  const gelukt = await page.evaluate((namen: string[]) => {
    for (const naam of namen) {
      const el = document.querySelector(naam) as HTMLElement | null;
      if (el && el.offsetParent !== null) { el.click(); return true; }
    }
    // Terugval op de tekst, maar alleen binnen iets dat er als een melding
    // uitziet. Anders klik je zo op een "Akkoord"-knop in een formulier.
    const bakken = Array.from(
      document.querySelectorAll('[id*="cookie" i], [class*="cookie" i], [id*="consent" i], [class*="consent" i], [class*="cmp" i], dialog'),
    );
    const woorden = /^(accepteer|accepteren|alles accepteren|alle cookies|akkoord|ok, akkoord|ik ga akkoord|alles toestaan|accept all|accept|allow all|toestaan)$/i;
    for (const bak of bakken) {
      const knoppen = Array.from(bak.querySelectorAll('button, a, input[type=button], input[type=submit], [role=button]'));
      for (const k of knoppen) {
        const tekst = ((k.textContent || (k as HTMLInputElement).value || "").replace(/\s+/g, " ").trim());
        if (woorden.test(tekst) && (k as HTMLElement).offsetParent !== null) { (k as HTMLElement).click(); return true; }
      }
    }
    return false;
  }, COOKIE_KNOPPEN);
  if (gelukt) await new Promise((r) => setTimeout(r, 700));
  return gelukt;
}

export type Kop = { niveau: number; tekst: string; zichtbaar: boolean; y: number };
export type Verwijzing = { pad: string; tekst: string; extern: boolean };
export type Beeld = { bron: string; alt: string; breedte: number; hoogte: number };

export type PaginaBron = {
  url: string;
  eindUrl: string;
  status: number | null;
  titel: string;
  omschrijving: string;
  canoniek: string;
  robots: string;
  taal: string;
  koppen: Kop[];
  tekst: string;
  woorden: number;
  links: Verwijzing[];
  beelden: Beeld[];
  formulierVelden: number;
  knoppen: string[];
  hoogte: number;
};

/** Een adres binnen een netwerk, dus nooit iets om vanaf deze server op te halen. */
function priveAdres(ip: string): boolean {
  const schoon = ip.replace(/^::ffff:/i, "");
  if (/^\d+\.\d+\.\d+\.\d+$/.test(schoon)) {
    const [a, b] = schoon.split(".").map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true; // waar cloud-servers hun eigen gegevens ophalen
    if (a === 100 && b >= 64 && b <= 127) return true;
    return false;
  }
  const laag = schoon.toLowerCase();
  if (laag === "::" || laag === "::1") return true;
  if (/^f[cd]/.test(laag)) return true; // uniek-lokaal
  if (/^fe[89ab]/.test(laag)) return true; // link-lokaal
  return false;
}

/** De reden dat deze URL niet opgehaald mag worden, of null als hij mag. */
export async function waaromNiet(ruw: string): Promise<string | null> {
  let u: URL;
  try {
    u = new URL(ruw);
  } catch {
    return "Dat is geen geldig webadres. Begin met https://";
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return "Alleen een http- of https-adres.";
  const host = u.hostname.toLowerCase().replace(/\.$/, "");
  if (!host) return "Er staat geen domein in dat adres.";
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) {
    return "Een adres binnen een netwerk kan niet opgehaald worden.";
  }
  let adressen: { address: string }[];
  try {
    adressen = await dns.lookup(host, { all: true });
  } catch {
    return "Dat domein bestaat niet, of is nu niet bereikbaar.";
  }
  if (!adressen.length) return "Dat domein levert geen adres op.";
  if (adressen.some((a) => priveAdres(a.address))) {
    return "Een adres binnen een netwerk kan niet opgehaald worden.";
  }
  return null;
}

/**
 * Wat er op die pagina staat: de tekst, de structuur, de links, de beelden.
 * Met een echte browser, dus inclusief alles wat JavaScript nabezorgt, want dat
 * is ook wat een bezoeker ziet.
 */
export async function leesPagina(url: string, apparaat: Apparaat = "desktop"): Promise<PaginaBron | null> {
  const scherm = APPARATEN[apparaat];
  return await metBrowser(async (page) => {
    await page.setViewport({ width: scherm.breedte, height: scherm.hoogte });
    await page.setUserAgent(scherm.ua || BEZOEKER_UA);
    const resp = await gaNaar(page, url);
    await new Promise((r) => setTimeout(r, 900));
    const eindUrl: string = page.url();
    const fout = await waaromNiet(eindUrl);
    if (fout) throw new Error(`De pagina stuurde door naar een adres dat niet opgehaald mag worden.`);
    // Ook bij het lézen moet de cookiemelding weg. Anders begint de tekst van
    // elke pagina met "Deze website maakt gebruik van cookies", staan de knoppen
    // van de cookiemelder tussen de knoppen van de pagina, en telt zijn kop mee
    // in de koppenstructuur. Dat vervuilt elk oordeel dat erop volgt.
    await klikCookieWeg(page);
    const gelezen = await page.evaluate(() => {
      const tekstVan = (el: Element | null): string => (el?.textContent || "").replace(/\s+/g, " ").trim();
      const meta = (naam: string): string =>
        (document.querySelector(`meta[name="${naam}"]`) as HTMLMetaElement | null)?.content?.trim() || "";
      // Zichtbaar en waar op de pagina. Beide zijn nodig om niet te gokken: een
      // site zet vaak een tweede kop klaar voor mobiel die op desktop verborgen
      // is, en dan lijkt het op twee H1's terwijl een bezoeker er één ziet.
      const koppen = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6"))
        .map((h) => {
          const el = h as HTMLElement;
          const vak = el.getBoundingClientRect();
          const zichtbaar = el.offsetParent !== null && vak.width > 0 && vak.height > 0;
          return {
            niveau: Number(h.tagName.slice(1)),
            tekst: tekstVan(h),
            zichtbaar,
            y: Math.round(vak.top + window.scrollY),
          };
        })
        .filter((k) => k.tekst.length > 0);
      const hier = location.origin;
      const links = Array.from(document.querySelectorAll("a[href]"))
        .map((a) => {
          const el = a as HTMLAnchorElement;
          const href = el.href || "";
          let pad = href;
          let extern = true;
          try {
            const u = new URL(href);
            extern = u.origin !== hier;
            pad = extern ? href : u.pathname + u.search;
          } catch { /* mailto, tel, javascript: blijven zoals ze zijn */ }
          return { pad, tekst: tekstVan(el), extern };
        })
        .filter((l) => l.pad && !l.pad.startsWith("javascript:"));
      const beelden = Array.from(document.querySelectorAll("img")).map((i) => {
        const el = i as HTMLImageElement;
        return { bron: el.currentSrc || el.src || "", alt: el.getAttribute("alt") ?? "", breedte: el.naturalWidth || 0, hoogte: el.naturalHeight || 0 };
      });
      const knoppen = Array.from(document.querySelectorAll("button, a.button, a.btn, [role=button], input[type=submit]"))
        .map((b) => tekstVan(b) || (b as HTMLInputElement).value || "")
        .filter((t) => t.length > 0);
      const velden = document.querySelectorAll("form input:not([type=hidden]):not([type=submit]), form select, form textarea").length;
      const body = document.body ? (document.body.innerText || "") : "";
      return {
        titel: document.title || "",
        omschrijving: meta("description"),
        canoniek: (document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null)?.href || "",
        robots: meta("robots"),
        taal: document.documentElement.getAttribute("lang") || "",
        koppen,
        tekst: body.replace(/\n{3,}/g, "\n\n").trim(),
        links,
        beelden,
        knoppen,
        formulierVelden: velden,
        hoogte: Math.round(document.documentElement.scrollHeight || 0),
      };
    });
    return {
      url,
      eindUrl,
      status: resp ? resp.status() : null,
      ...gelezen,
      woorden: gelezen.tekst.split(/\s+/).filter(Boolean).length,
    } as PaginaBron;
  });
}

export type FotoOpties = {
  apparaat?: Apparaat;
  /** De hele pagina van boven tot onder, in plaats van alleen het eerste scherm. */
  heel?: boolean;
  /** Een strook uit een lange pagina: vanaf deze hoogte, zoveel pixels hoog. */
  vanaf?: number;
  hoogte?: number;
  /** Extra wachttijd ná het laden, voor pagina's die hun beeld nabezorgen. */
  wachtMs?: number;
  /** De cookiemelding laten staan, bijvoorbeeld om die zélf te beoordelen. */
  laatCookies?: boolean;
};

/** Een foto van die pagina, zoals een bezoeker hem ziet. */
export async function fotografeerPagina(url: string, opties: FotoOpties = {}): Promise<Buffer | null> {
  const scherm = APPARATEN[opties.apparaat || "desktop"];
  const wacht = Math.max(0, Math.min(20000, opties.wachtMs ?? 1200));
  return await metBrowser(async (page) => {
    await page.setViewport({ width: scherm.breedte, height: scherm.hoogte });
    await page.setUserAgent(scherm.ua || BEZOEKER_UA);
    await gaNaar(page, url);
    const fout = await waaromNiet(page.url());
    if (fout) throw new Error("De pagina stuurde door naar een adres dat niet opgehaald mag worden.");
    if (!opties.laatCookies) await klikCookieWeg(page);
    // Eerst helemaal naar beneden en terug: anders staat alles wat pas bij het
    // scrollen inlaadt nog als leeg vlak op de foto, en dat is precies het soort
    // vals oordeel dat we hier niet willen. Wel begrensd: een pagina van twintig
    // schermen lang zou anders in zijn eentje de hele tijd opsouperen, en dan
    // krijg je geen foto maar een tijdslimiet.
    await page.evaluate(async () => {
      const stap = window.innerHeight;
      const eind = document.body ? document.body.scrollHeight : 0;
      const stappen = Math.min(30, Math.ceil(eind / Math.max(1, stap)));
      for (let i = 0; i < stappen; i++) {
        window.scrollTo(0, i * stap);
        await new Promise((r) => setTimeout(r, 90));
      }
      window.scrollTo(0, 0);
    });
    await new Promise((r) => setTimeout(r, wacht));
    if (opties.vanaf !== undefined || opties.hoogte !== undefined) {
      const vanaf = Math.max(0, opties.vanaf || 0);
      const hoog = Math.max(50, Math.min(4000, opties.hoogte || scherm.hoogte));
      const shot = await page.screenshot({ type: "png", captureBeyondViewport: true, clip: { x: 0, y: vanaf, width: scherm.breedte, height: hoog } });
      return shot as Buffer;
    }
    const shot = await page.screenshot({ type: "png", fullPage: !!opties.heel });
    return shot as Buffer;
  });
}
