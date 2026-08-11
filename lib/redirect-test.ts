// ═══════════════════════════════════════════════════════════
// TEST REDIRECT: WAT ER ÉCHT GEBEURT ALS JE HET OUDE ADRES OPENT
// ═══════════════════════════════════════════════════════════
// "Doorgevoerd" is geen bewijs. Een redirect kan bestaan in de plugin en tóch
// niets doen (een cachelaag ervoor, een andere regel die eerder matcht, een
// pad met of zonder slash). En een redirect die technisch werkt kan alsnog
// waardeloos zijn: naar een 404, naar een pagina op noindex, of via drie
// tussenstappen.
//
// Deze test loopt daarom de hele keten af en oordeelt op de vier regels van
// technische hygiëne:
//   1. één hop, geen ketens en geen lussen
//   2. het eindpunt geeft zelf 200
//   3. het eindpunt is indexeerbaar (geen noindex) en verwijst met zijn
//      canonical naar zichzelf
//   4. het is een 301 (permanent), niet een 302/307 (tijdelijk)
//
// Alles draait op de server van het dashboard, want die kan de klantsite wél
// bereiken. Er wordt uitsluitend gelezen; deze test verandert nooit iets.
// ═══════════════════════════════════════════════════════════

export type Hop = { url: string; status: number };

export type RedirectTest = {
  /** Doet de redirect wat hij moet doen? */
  goed: boolean;
  /** goed | let-op | fout: goed is groen, let-op werkt maar kan beter. */
  oordeel: "goed" | "let-op" | "fout";
  /** De keten, van het oude adres tot het eindpunt. */
  hops: Hop[];
  /** Waar je uiteindelijk uitkomt, en met welke status. */
  eind: string;
  eindStatus: number | null;
  /** Bevindingen in gewone taal, de belangrijkste eerst. */
  meldingen: string[];
  /** Alleen ingevuld als het eindpunt een HTML-pagina is. */
  indexeerbaar: boolean | null;
  canonical: string;
};

const UA = "Mozilla/5.0 (compatible; PingwinBot/1.0; +https://pingwin.nl)";

function padVanUrl(u: string): string {
  try { return new URL(u).pathname.replace(/\/+$/, "").toLowerCase() || "/"; } catch { return (u || "").toLowerCase(); }
}
const normPad = (p: string) => ("/" + (p || "").replace(/^https?:\/\/[^/]+/i, "").replace(/^\/+/, "")).replace(/\/+$/, "") || "/";

async function haal(url: string, methode: "HEAD" | "GET"): Promise<Response | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    return await fetch(url, { method: methode, redirect: "manual", cache: "no-store", headers: { "User-Agent": UA }, signal: ctrl.signal });
  } catch { return null; } finally { clearTimeout(timer); }
}

/** Deugt de doelpagina zelf: bestaat hij, is hij indexeerbaar, wijst zijn
    canonical naar zichzelf? Nuttig vóórdat je de omleiding zet. */
async function keurDoel(basis: string, doelPad: string): Promise<{ melding: string; indexeerbaar: boolean | null; canonical: string }> {
  const url = `${basis}${normPad(doelPad)}/`.replace(/([^:]\/)\/+/g, "$1");
  const res = await haal(url, "GET");
  if (!res) return { melding: `De doelpagina ${normPad(doelPad)} was niet op te vragen.`, indexeerbaar: null, canonical: "" };
  if (res.status !== 200) return { melding: `Let op: de doelpagina ${normPad(doelPad)} geeft zelf status ${res.status}. Zet er dus nog geen omleiding heen.`, indexeerbaar: null, canonical: "" };
  const kop = (await res.text().catch(() => "")).slice(0, 60000);
  const robots = /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i.exec(kop)?.[1] || "";
  const indexeerbaar = !/noindex/i.test(robots);
  const canonical = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(kop)?.[1] || "";
  if (!indexeerbaar) return { melding: `Let op: de doelpagina ${normPad(doelPad)} staat op noindex. Dan komt er niets van de oude pagina terecht.`, indexeerbaar, canonical };
  if (canonical && padVanUrl(canonical) !== padVanUrl(url)) {
    return { melding: `Let op: de doelpagina verwijst met zijn canonical naar ${padVanUrl(canonical)} in plaats van naar zichzelf.`, indexeerbaar, canonical };
  }
  return { melding: `De doelpagina ${normPad(doelPad)} deugt wel: status 200, indexeerbaar, canonical naar zichzelf. Zet de omleiding en test opnieuw.`, indexeerbaar, canonical };
}

/**
 * Loopt het oude adres af en vertelt wat er gebeurt. `verwacht` is het doelpad
 * dat je voor ogen had; laat het leeg als je alleen wilt weten wát er gebeurt.
 * `alsGone` betekent: hier hoort helemaal geen redirect te staan maar een 410.
 */
export async function testRedirect(siteUrl: string, van: string, verwacht = "", alsGone = false): Promise<RedirectTest> {
  const basis = (siteUrl || "").trim().replace(/\/+$/, "");
  const meldingen: string[] = [];
  const hops: Hop[] = [];
  if (!basis) {
    return { goed: false, oordeel: "fout", hops, eind: "", eindStatus: null, indexeerbaar: null, canonical: "",
      meldingen: ["Er is geen website-adres bekend voor deze klant, dus er valt niets te testen. Vul het domein in bij de klantgegevens."] };
  }

  let huidig = `${basis}${normPad(van)}/`.replace(/([^:]\/)\/+/g, "$1");
  let status: number | null = null;
  let lus = false;
  const gezien = new Set<string>();

  for (let i = 0; i < 6; i++) {
    // Sommige sites weigeren HEAD; dan alsnog met GET, anders lees je een
    // verzonnen 405 als "geen redirect".
    let res = await haal(huidig, "HEAD");
    if (!res || res.status === 405 || res.status === 501) res = await haal(huidig, "GET");
    if (!res) {
      meldingen.push(`${huidig} was niet op te vragen (geen antwoord binnen twaalf seconden).`);
      break;
    }
    status = res.status;
    hops.push({ url: huidig, status: res.status });
    if (![301, 302, 303, 307, 308].includes(res.status)) break;
    const loc = res.headers.get("location") || "";
    if (!loc) { meldingen.push("De site geeft wel een redirect-status terug, maar zegt er niet bij waarheen."); break; }
    const volgend = new URL(loc, huidig).toString();
    if (gezien.has(volgend)) { lus = true; meldingen.push("Let op: dit is een lus. Het adres verwijst (via een omweg) naar zichzelf terug."); break; }
    gezien.add(volgend);
    huidig = volgend;
  }

  const eind = huidig;
  const eindStatus = status;
  const eindPad = padVanUrl(eind);
  const sprongen = Math.max(0, hops.length - 1);
  const eerste = hops[0]?.status ?? null;

  // ── Het geval "hier hoort een 410 te staan" ──
  if (alsGone) {
    const goed = eerste === 410;
    if (goed) meldingen.unshift("De pagina geeft netjes een 410: bewust weg. Dat is precies wat hier hoort.");
    else if (eerste === 404) meldingen.unshift("De pagina geeft een 404 in plaats van een 410. Dat werkt ook, maar 410 vertelt Google duidelijker dat dit definitief is.");
    else if (eerste === 200) meldingen.unshift("De pagina bestaat nog gewoon (status 200). Er is hier dus nog niets opgeruimd.");
    else meldingen.unshift(`De pagina geeft status ${eerste ?? "onbekend"}, terwijl hier een 410 hoort te staan.`);
    return { goed, oordeel: goed ? "goed" : eerste === 404 ? "let-op" : "fout", hops, eind, eindStatus, indexeerbaar: null, canonical: "", meldingen };
  }

  // ── Het gewone geval: hier hoort een 301 naar het doel te staan ──
  if (eerste == null) {
    return { goed: false, oordeel: "fout", hops, eind, eindStatus, indexeerbaar: null, canonical: "", meldingen };
  }
  if (![301, 302, 303, 307, 308].includes(eerste)) {
    meldingen.unshift(eerste === 200
      ? "Er staat nog geen redirect: het oude adres geeft gewoon een pagina terug (status 200)."
      : `Er staat geen redirect: het oude adres geeft status ${eerste}.`);
    // Staat de omleiding er nog niet, dan is de nuttigste tweede vraag of het
    // doel dat je op het oog hebt wél deugt. Anders kom je daar pas achter
    // nadat je hem hebt gezet.
    if (verwacht) {
      const doel = await keurDoel(basis, verwacht);
      meldingen.push(doel.melding);
      return { goed: false, oordeel: "fout", hops, eind, eindStatus, indexeerbaar: doel.indexeerbaar, canonical: doel.canonical, meldingen };
    }
    return { goed: false, oordeel: "fout", hops, eind, eindStatus, indexeerbaar: null, canonical: "", meldingen };
  }

  const doelPad = verwacht ? normPad(verwacht) : "";
  const klopt = !doelPad || eindPad === normPad(doelPad);
  if (doelPad && !klopt) meldingen.unshift(`De omleiding komt uit op ${eindPad}, terwijl ${normPad(doelPad)} de bedoeling was.`);
  else meldingen.unshift(`Het oude adres leidt door naar ${eindPad}.`);

  if (eerste !== 301) meldingen.push(`De omleiding is een ${eerste} (tijdelijk) in plaats van een 301 (permanent). Google draagt bij een tijdelijke omleiding geen waarde over.`);
  if (sprongen > 1) meldingen.push(`Er zitten ${sprongen} tussenstappen in plaats van één. Herschrijf de eerste regel meteen naar het eindpunt; elke extra hop kost snelheid en een beetje waarde.`);

  // ── Het eindpunt zelf: 200, indexeerbaar, canonical naar zichzelf ──
  let indexeerbaar: boolean | null = null;
  let canonical = "";
  if (eindStatus === 200) {
    const res = await haal(eind, "GET");
    const html = res ? await res.text().catch(() => "") : "";
    if (html) {
      const kop = html.slice(0, 60000);
      const robots = /<meta[^>]+name=["']robots["'][^>]*content=["']([^"']+)["']/i.exec(kop)?.[1] || "";
      indexeerbaar = !/noindex/i.test(robots);
      canonical = /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i.exec(kop)?.[1] || "";
      if (!indexeerbaar) meldingen.push("De doelpagina staat op noindex. Dan komt er niets van de oude pagina terecht; kies een ander doel of haal de noindex eraf.");
      if (canonical && padVanUrl(canonical) !== eindPad) meldingen.push(`De doelpagina verwijst met zijn canonical naar ${padVanUrl(canonical)} in plaats van naar zichzelf. Daarmee gaat de waarde alsnog een stap verder, of nergens heen.`);
    }
  } else if (eindStatus === 404 || eindStatus === 410) {
    meldingen.push(`De omleiding komt uit op een pagina die niet bestaat (status ${eindStatus}). Dat is hetzelfde als geen redirect, en voor de bezoeker slechter.`);
  } else if (eindStatus != null) {
    meldingen.push(`Het eindpunt geeft status ${eindStatus} in plaats van 200.`);
  }

  const fout = lus || !klopt || eindStatus !== 200 || indexeerbaar === false;
  const letOp = !fout && (eerste !== 301 || sprongen > 1 || (!!canonical && padVanUrl(canonical) !== eindPad));
  return {
    goed: !fout && !letOp, oordeel: fout ? "fout" : letOp ? "let-op" : "goed",
    hops, eind, eindStatus, indexeerbaar, canonical, meldingen,
  };
}
