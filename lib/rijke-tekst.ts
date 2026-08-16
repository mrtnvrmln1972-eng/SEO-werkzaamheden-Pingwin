// ═══════════════════════════════════════════════════════════
// DE STRUCTUUR VAN EEN OPMAAKBAAR TEKSTVELD
// ═══════════════════════════════════════════════════════════
// Alles wat de vorm van de inhoud bewaakt: wat is een uitklapper, wat is een
// vinkpunt, wat mag waar staan, en hoe repareer je het als het scheef staat.
// Bewust LOS van het React-component (`app/_velden/RijkTekstVeld.tsx`): dit
// bestand raakt alleen knopen aan en kent geen muis, geen cursor en geen
// browser. Daardoor kan `proeven/rijk-tekst.proef.ts` het echt natrekken, in
// plaats van dat we op de code kijken en hopen.
//
// ── WAAROM DIT ER IS ──
// Dit veld heeft twee keer inhoud gewist die niet terug te halen was:
//   * 11-08-2026 (Kamsteeg): een sleepactie zette een blok búiten het tekstvak;
//     opslaan bewaart alleen wat ín het vak staat, dus dat deel was weg.
//   * 14-08-2026 (Paul Hoevenaars): slepen ín een open uitklapper pakte alleen
//     de inhoud beet, waardoor "SEO-strategie (Uitgebreid, Ook Oud)" leeg
//     achterbleef.
// Beide keren was de oorzaak dezelfde: er was geen enkele plek die controleerde
// of de vorm na een bewerking nog klopte. Er stond wel een controle IN de
// sleepcode, maar een controle die alleen op één plek staat, dekt alleen dat ene
// pad. `herstelStructuur` hieronder is die ene plek: hij draait na élke
// structuurwijziging, hij repareert in plaats van te weigeren, en hij gooit
// nooit inhoud weg. Staat er iets op een plek waar het niet hoort, dan wordt het
// verplaatst naar de dichtstbijzijnde plek waar het wél hoort.
// ═══════════════════════════════════════════════════════════

export const KL_CHECK_ITEM = "rtv-check-item";
export const KL_CHECK_BOX = "rtv-check-box";
export const KL_CHECK_TEKST = "rtv-check-tekst";
export const KL_CHECK_AF = "rtv-check-af";
export const KL_VOUW = "rtv-vouw";
export const KL_VOUW_BODY = "rtv-vouw-body";
export const KL_SLEEPT = "rtv-blok-sleept";

export const PLACEHOLDER_ONDERWERP = "Onderwerp";
export const PLACEHOLDER_VOUW_BODY = "Zet hier neer wat erbij hoort.";

/** Blokken die je als geheel kunt beetpakken en verslepen. */
const BLOK_TAGS = new Set(["P", "DIV", "DETAILS", "UL", "OL", "H1", "H2", "H3", "H4", "H5", "H6", "BLOCKQUOTE", "TABLE", "PRE", "HR"]);

function isEl(n: Node | null | undefined): n is HTMLElement {
  return !!n && n.nodeType === 1;
}

function heeftKlasse(n: Node | null | undefined, klasse: string): boolean {
  return isEl(n) && n.classList.contains(klasse);
}

/** Directe kinderen die aan een test voldoen. Bewust zonder `:scope`-selector:
    die wordt niet door elke DOM-uitvoering ondersteund, en dit bestand draait
    zowel in de browser als in de proef. */
function kinderen(ouder: HTMLElement, test: (el: HTMLElement) => boolean): HTMLElement[] {
  const uit: HTMLElement[] = [];
  for (let n = ouder.firstElementChild; n; n = n.nextElementSibling) {
    if (isEl(n) && test(n as HTMLElement)) uit.push(n as HTMLElement);
  }
  return uit;
}

/** Klasse weghalen en het lege `class=""` opruimen, zodat de opgeslagen HTML schoon blijft. */
function haalKlasseWeg(el: HTMLElement, klasse: string) {
  el.classList.remove(klasse);
  if (!el.getAttribute("class")) el.removeAttribute("class");
}

// ── Het HTML-blokje van één vinkpunt ──────────────────────────────────────
// `inhoud` is HTML, geen platte tekst: een vinkpunt dat uit een geplakt rijtje
// pagina's komt houdt daardoor zijn klikbare links. Dat ging eerder mis, want
// de regels werden met `innerText` uit de selectie gehaald en dan bleef er van
// een link alleen de tekst over.
export function checklistItemHtml(inhoud = "", af = false): string {
  const klasse = KL_CHECK_ITEM + (af ? ` ${KL_CHECK_AF}` : "");
  const vinkje = af ? " checked" : "";
  return `<div class="${klasse}">`
    + `<label contenteditable="false" class="${KL_CHECK_BOX}"><input type="checkbox"${vinkje}></label>`
    + `<span class="${KL_CHECK_TEKST}">${inhoud.trim() || "<br>"}</span>`
    + `</div>`;
}

/** Het HTML-blokje van één verse uitklapper, met een lege regel erachter om verder te typen. */
export function uitklapperHtml(): string {
  return `<details class="${KL_VOUW}" open><summary>${PLACEHOLDER_ONDERWERP}</summary>`
    + `<div class="${KL_VOUW_BODY}">${PLACEHOLDER_VOUW_BODY}</div></details><p><br></p>`;
}

// ── Welk onderdeel pak je beet? ───────────────────────────────────────────
// Klim vanaf de aangewezen plek omhoog tot het eerste zelfstandige blok: een
// vinkpunt, een lijstregel, een uitklapper, of anders een gewone regel.
//
// Twee dingen zijn hier niet onderhandelbaar, allebei omdat ze een keer echt
// inhoud gekost hebben:
//   1. De knoop moet ÍN het tekstvak zitten. Dit punt komt van `elementFromPoint`
//      en dat geeft net zo goed de knoppenbalk of de kolom ernaast terug. Zonder
//      deze poort klom het door tot buiten het veld en verhuisde een drop de
//      inhoud de pagina in, waar het opslaan hem niet meer ziet.
//   2. De inhoud VAN een uitklapper (`rtv-vouw-body`) is zelf geen onderdeel:
//      hij hoort bij zijn uitklapper en mag er nooit los van komen. Daarom
//      klimmen we daar door naar het omliggende `<details>`.
export function blokVoorSlepen(veld: HTMLElement, node: Node | null): HTMLElement | null {
  if (!veld || !node) return null;
  let n: HTMLElement | null = isEl(node) ? node : (node.parentElement as HTMLElement | null);
  if (!n || n === veld || !veld.contains(n)) return null;
  while (n && n !== veld) {
    if (n.classList.contains(KL_CHECK_ITEM)) return n;
    if (n.tagName === "LI" && n.parentElement && (n.parentElement.tagName === "UL" || n.parentElement.tagName === "OL")) return n;
    // Het kopje van een uitklapper hoort bij de uitklapper zelf, net als de body.
    if (n.tagName === "SUMMARY" || n.classList.contains(KL_VOUW_BODY)) { n = n.parentElement; continue; }
    if (BLOK_TAGS.has(n.tagName)) return n;
    n = n.parentElement;
  }
  return null;
}

/**
 * Mag dit onderdeel bij dat andere onderdeel landen?
 *
 * Nooit in jezelf of in je eigen inhoud (dan verdwijnt het blok samen met zijn
 * eigen landingsplek uit de boom), en een lijstregel blijft bij lijstregels:
 * een alinea midden in andermans genummerde lijst geeft geen geldige HTML meer.
 */
export function magSlepenNaar(sleepBlok: HTMLElement, doelBlok: HTMLElement): boolean {
  if (!sleepBlok || !doelBlok) return false;
  if (sleepBlok === doelBlok || sleepBlok.contains(doelBlok) || doelBlok.contains(sleepBlok)) return false;
  return (sleepBlok.tagName === "LI") === (doelBlok.tagName === "LI");
}

/**
 * Verplaats een onderdeel naar boven of onder een ander onderdeel.
 *
 * Geeft `true` terug als het echt verplaatst is. Alle sloten zitten hier, op
 * één plek, want dit is het pad waarlangs twee keer inhoud is kwijtgeraakt:
 * beide onderdelen moeten in het veld zitten vóór de verhuizing, het gesleepte
 * onderdeel moet er ná de verhuizing nog steeds in zitten, en daarna wordt de
 * vorm hersteld (een uitklapper die leeg achterblijft krijgt zijn body terug).
 */
export function verplaatsBlok(veld: HTMLElement, sleepBlok: HTMLElement, doelBlok: HTMLElement, boven: boolean): boolean {
  if (!veld || !sleepBlok || !doelBlok) return false;
  if (!magSlepenNaar(sleepBlok, doelBlok)) return false;
  if (!veld.contains(sleepBlok) || !veld.contains(doelBlok)) return false;
  if (boven) doelBlok.before(sleepBlok);
  else doelBlok.after(sleepBlok);
  if (!veld.contains(sleepBlok)) return false;
  herstelStructuur(veld);
  return true;
}

// ═══════════════════════════════════════════════════════════
// HERSTELLEN
// ═══════════════════════════════════════════════════════════
// Loopt het veld na en zet de vorm recht. Gooit nooit iets weg: wat op een
// verkeerde plek staat wordt verplaatst, wat ontbreekt wordt aangevuld. Geeft
// `true` terug als er iets veranderd is, zodat de aanroeper weet dat hij moet
// opslaan.
//
// Draait op drie momenten: bij het openen van het veld (dus oude, scheve inhoud
// heelt vanzelf), na elke structuurwijziging (invoegen, slepen, Enter), en als
// je het veld verlaat.

export function herstelStructuur(veld: HTMLElement): boolean {
  if (!veld) return false;
  const voor = veld.innerHTML;
  ruimSleepRestjesOp(veld);
  herstelUitklappers(veld);
  haalVinkpuntenUitLijsten(veld);
  herstelVinkpunten(veld);
  zorgVoorRandRegels(veld);
  return veld.innerHTML !== voor;
}

/** Een afgebroken sleepactie liet de "ik word gesleept"-klasse in de opgeslagen HTML achter. */
function ruimSleepRestjesOp(veld: HTMLElement) {
  veld.querySelectorAll(`.${KL_SLEEPT}`).forEach((el) => haalKlasseWeg(el as HTMLElement, KL_SLEEPT));
}

// ── Uitklappers ───────────────────────────────────────────────────────────
// Een uitklapper is altijd: één kopje, en daaronder precies één bak met alles
// wat erbij hoort. Raakt die bak zoek (door slepen, plakken of een ongelukkige
// Enter), dan blijft de inhoud gewoon staan en krijgt hij een nieuwe bak. Nooit
// weggooien: dit is precies het geval waarin een uitklapper leeg achterbleef.
function herstelUitklappers(veld: HTMLElement) {
  veld.querySelectorAll("details").forEach((details) => {
    const doc = details.ownerDocument;
    if (!details.classList.contains(KL_VOUW)) details.classList.add(KL_VOUW);

    // Eén kopje, en het staat vooraan.
    const koppen = kinderen(details as HTMLElement, (el) => el.tagName === "SUMMARY");
    let kop = koppen[0];
    if (!kop) {
      kop = doc.createElement("summary");
      kop.textContent = PLACEHOLDER_ONDERWERP;
      details.prepend(kop);
    } else if (details.firstChild !== kop) {
      details.prepend(kop);
    }
    // Een tweede kopje is geen kopje: dat is tekst die per ongeluk in de vorm
    // van een kopje is beland. Als alinea behouden, niet weggooien.
    for (const extra of koppen.slice(1)) {
      const p = doc.createElement("p");
      while (extra.firstChild) p.appendChild(extra.firstChild);
      extra.replaceWith(p);
    }

    // Alles ná het kopje hoort in één body, en wel in dezelfde volgorde als het
    // op het scherm stond. Eerst "de body" pakken en de rest er dan achteraan
    // plakken zou tekst van vóór de body erachter zetten: geen verlies, maar
    // wel een alinea die ineens ergens anders staat, en dat is net zo verwarrend.
    const naKop: Node[] = [];
    let body: HTMLElement | null = null;
    for (let n = kop.nextSibling; n; n = n.nextSibling) {
      if (!body && heeftKlasse(n, KL_VOUW_BODY)) body = n as HTMLElement;
      naKop.push(n);
    }
    if (!body) {
      body = doc.createElement("div");
      body.className = KL_VOUW_BODY;
      kop.after(body);
    }
    // De inhoud van de body zelf telt mee op de plek waar de body stond.
    const opVolgorde: Node[] = [];
    for (const knoop of naKop) {
      if (knoop === body) {
        while (body.firstChild) opVolgorde.push(body.removeChild(body.firstChild));
      } else {
        opVolgorde.push(knoop);
      }
    }
    for (const knoop of opVolgorde) body.appendChild(knoop);

    // Een lege body kun je niet aanklikken; met een regelafbreking wel.
    if (!body.firstChild) body.innerHTML = "<br>";
    // Eindigt de body op een uitklapper, dan is er geen plek meer om eronder te
    // typen. Zelfde reden als de lege regel onderaan het veld.
    if (body.lastElementChild?.tagName === "DETAILS") {
      const p = doc.createElement("p");
      p.innerHTML = "<br>";
      body.appendChild(p);
    }
  });
}

// ── Vinkpunten horen niet in een lijst ────────────────────────────────────
// Stond de cursor in een genummerde lijst toen je op "vinklijst" klikte, dan
// zette de browser de vinkpunten ÍN die lijst. Dat is geen geldige HTML (een
// <div> als kind van een <ol>), en op het scherm is het precies het rare gedrag
// dat Maarten zag: nummers die doorlopen over regels die geen nummer horen te
// hebben, en inspringing die niet klopt.
//
// De lijst wordt hier opgeknipt in plaats van dat de vinkpunten er onderaan bij
// geschoven worden, zodat de volgorde blijft zoals je hem typte.
function haalVinkpuntenUitLijsten(veld: HTMLElement) {
  for (let ronde = 0; ronde < 200; ronde++) {
    const item = veld.querySelector(`ul .${KL_CHECK_ITEM}, ol .${KL_CHECK_ITEM}`) as HTMLElement | null;
    if (!item) return;
    const lijst = item.closest("ul, ol") as HTMLElement | null;
    if (!lijst || !veld.contains(lijst)) return;
    // Zit het in een lijstregel, dan eerst díe doorknippen; daarna staat het
    // vinkpunt tussen de lijstregels en knippen we de lijst zelf door.
    const regel = item.closest("li") as HTMLElement | null;
    knipDoor(item, regel && regel !== item && lijst.contains(regel) ? regel : lijst);
  }
}

/**
 * Haal `item` uit `ouder` en zet het ertussen, met behoud van de volgorde.
 *
 * Wat vóór het item stond blijft in de oude bak, het item komt daar meteen
 * achter, en wat erna stond gaat in een verse bak van dezelfde soort. Dit
 * ging eerder mis: het item werd simpelweg ná de hele bak gezet, waardoor het
 * áchter zijn eigen buren belandde. Chrome stopt bij "maak van deze twee regels
 * een vinklijst" namelijk allebei de vinkpunten in één lijstregel, en dan
 * kwamen ze er in omgekeerde volgorde weer uit.
 */
function knipDoor(item: HTMLElement, ouder: HTMLElement) {
  const doc = ouder.ownerDocument;
  const staart = doc.createElement(ouder.tagName.toLowerCase()) as HTMLElement;
  const klasse = ouder.getAttribute("class");
  if (klasse) staart.setAttribute("class", klasse);
  // Een genummerde lijst telt door in plaats van weer bij 1 te beginnen.
  if (ouder.tagName === "OL") {
    let ervoor = 0;
    for (let n = ouder.firstElementChild; n && n !== item; n = n.nextElementSibling) {
      if (n.tagName === "LI") ervoor++;
    }
    const begin = Number(ouder.getAttribute("start") || 1) + ervoor;
    if (begin > 1) staart.setAttribute("start", String(begin));
  }
  for (let n = item.nextSibling; n;) {
    const volgende = n.nextSibling;
    staart.appendChild(n);
    n = volgende;
  }
  ouder.after(item);
  if (staart.childNodes.length) item.after(staart);
  if (!ouder.childNodes.length) ouder.remove();
}

// ── Vinkpunten ────────────────────────────────────────────────────────────
// Eén vinkpunt is altijd: een vakje dat niet bewerkbaar is, en daarnaast één
// tekstvak. Verdwijnt het vakje (met Backspace vooraan is dat zo gebeurd), dan
// stond er een halve regel die zich nergens meer naar gedroeg. Hier wordt hij
// weer heel gemaakt, met de tekst die er stond.
function herstelVinkpunten(veld: HTMLElement) {
  veld.querySelectorAll(`.${KL_CHECK_ITEM}`).forEach((el) => {
    const item = el as HTMLElement;
    const doc = item.ownerDocument;

    // Een vinkpunt in een vinkpunt: naar buiten halen, niets kwijt.
    item.querySelectorAll(`.${KL_CHECK_ITEM}`).forEach((binnen) => item.after(binnen));

    let vakje = item.querySelector("input[type=checkbox]") as HTMLInputElement | null;
    const afgevinkt = !!vakje && (vakje.hasAttribute("checked") || vakje.checked === true);

    let doos = kinderen(item, (el) => el.tagName === "LABEL" && el.classList.contains(KL_CHECK_BOX))[0] || null;
    if (!doos) {
      doos = doc.createElement("label");
      doos.className = KL_CHECK_BOX;
      item.prepend(doos);
    } else if (item.firstChild !== doos) {
      item.prepend(doos);
    }
    doos.setAttribute("contenteditable", "false");
    if (!vakje || vakje.parentElement !== doos) {
      if (!vakje) {
        vakje = doc.createElement("input") as HTMLInputElement;
        vakje.setAttribute("type", "checkbox");
      }
      doos.innerHTML = "";
      doos.appendChild(vakje);
    }

    // Eén tekstvak, met alles erin wat naast het vakje stond. Wat vóór het
    // tekstvak staat blijft ook vóór staan: anders draait de regel om zodra er
    // twee losse stukjes naast het vakje beland zijn.
    let tekst = kinderen(item, (el) => el.tagName === "SPAN" && el.classList.contains(KL_CHECK_TEKST))[0] || null;
    if (!tekst) {
      tekst = doc.createElement("span");
      tekst.className = KL_CHECK_TEKST;
      doos.after(tekst);
    }
    const ervoor: Node[] = [];
    const erna: Node[] = [];
    let gezien = false;
    for (let n: Node | null = doos.nextSibling; n; n = n.nextSibling) {
      if (n === tekst) { gezien = true; continue; }
      (gezien ? erna : ervoor).push(n);
    }
    for (const los of ervoor.reverse()) tekst.insertBefore(los, tekst.firstChild);
    for (const los of erna) {
      if (heeftKlasse(los, KL_CHECK_TEKST)) {
        while (los.firstChild) tekst.appendChild(los.firstChild);
        (los as HTMLElement).remove();
      } else {
        tekst.appendChild(los);
      }
    }
    if (!tekst.firstChild) tekst.innerHTML = "<br>";

    // De doorstreping en het vinkje moeten hetzelfde zeggen. Liepen die uit
    // elkaar, dan stond een regel doorgestreept met een leeg vakje ernaast.
    if (afgevinkt) {
      vakje.setAttribute("checked", "");
      item.classList.add(KL_CHECK_AF);
    } else {
      vakje.removeAttribute("checked");
      item.classList.remove(KL_CHECK_AF);
    }
    if (!item.classList.contains(KL_CHECK_ITEM)) item.classList.add(KL_CHECK_ITEM);
  });
}

// ── Een gewone regel boven en onder ───────────────────────────────────────
// Begint of eindigt het veld met een uitklapper of een vinkpunt, dan is er geen
// plek om de cursor neer te zetten: klikken in de ruimte erboven springt in het
// kopje van dat blok, en eronder kun je niets meer beginnen. Eén lege regel aan
// elke kant lost dat op.
function zorgVoorRandRegels(veld: HTMLElement) {
  const doc = veld.ownerDocument;
  const leegP = () => {
    const p = doc.createElement("p");
    p.innerHTML = "<br>";
    return p;
  };
  const eerste = veld.firstElementChild;
  if (eerste && (eerste.tagName === "DETAILS" || eerste.classList.contains(KL_CHECK_ITEM))) {
    veld.insertBefore(leegP(), eerste);
  }
  const laatste = veld.lastElementChild;
  if (laatste && laatste.tagName === "DETAILS") veld.appendChild(leegP());
}

// ═══════════════════════════════════════════════════════════
// REGELS UIT EEN STUK HTML HALEN (met opmaak, dus mét links)
// ═══════════════════════════════════════════════════════════
// Voor de knop "vinklijst": staat er een rijtje pagina's geselecteerd, dan wordt
// elke regel een eigen vinkpunt. Dat ging eerder via `innerText`, en dan hield
// je van `/hovenier/breda/` alleen de tekst over, zonder link. Nu knippen we op
// blokgrenzen en `<br>`, en houden we de opmaak binnen een regel intact.

/** Tekst die als HTML gebruikt gaat worden: tekens onschadelijk maken. Zonder
    dit maakt een titel met een "<" of een "&" erin de rest van de regel stuk. */
function ontsnap(t: string): string {
  return t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const INLINE_TAGS = new Set(["A", "B", "STRONG", "I", "EM", "U", "S", "SPAN", "CODE", "SMALL", "SUB", "SUP", "MARK", "FONT", "LABEL"]);

export function regelsUitFragment(fragment: DocumentFragment | HTMLElement): string[] {
  const regels: string[] = [];
  let huidig = "";

  function klaar() {
    const schoon = huidig
      .replace(/^(?:\s|&nbsp;|<br\s*\/?>)+/gi, "")
      .replace(/(?:\s|&nbsp;|<br\s*\/?>)+$/gi, "")
      .trim();
    if (schoon) regels.push(schoon);
    huidig = "";
  }

  function tekstVan(el: HTMLElement): string {
    const bewaar = huidig;
    huidig = "";
    loop(el);
    const uit = huidig;
    huidig = bewaar;
    return uit;
  }

  function loop(knoop: Node) {
    knoop.childNodes.forEach((kind) => {
      if (kind.nodeType === 3) { huidig += ontsnap((kind.textContent || "").replace(/\u00a0/g, " ")); return; }
      if (!isEl(kind)) return;
      const el = kind as HTMLElement;
      if (el.tagName === "BR") { klaar(); return; }
      // Het vakje van een bestaand vinkpunt mag niet als tekst meekomen.
      if (el.classList.contains(KL_CHECK_BOX)) return;
      if (INLINE_TAGS.has(el.tagName)) {
        if (el.tagName === "A") {
          const href = el.getAttribute("href") || "";
          const binnen = tekstVan(el);
          huidig += href && !/^javascript:/i.test(href)
            ? `<a href="${href.replace(/"/g, "&quot;")}" target="_blank" rel="noreferrer">${binnen}</a>`
            : binnen;
          return;
        }
        const tag = el.tagName === "B" ? "strong" : el.tagName === "I" ? "em" : el.tagName.toLowerCase();
        if (tag === "strong" || tag === "em" || tag === "u") { huidig += `<${tag}>${tekstVan(el)}</${tag}>`; return; }
        loop(el);
        return;
      }
      // Blokelement: dat is per definitie een nieuwe regel.
      klaar();
      loop(el);
      klaar();
    });
  }

  loop(fragment);
  klaar();
  return regels;
}
