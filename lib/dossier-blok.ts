import { mdToHtml } from "./markdown";
import { linkifyHtml } from "./linkify";
import { HARD_BEWIJS, type PaginaMail } from "./page-emails";
import type { PageDossier, DossierDoc } from "./page-dossier";

// ═══════════════════════════════════════════════════════════
// HET DOSSIERBLOK: wat je op de kaart ziet
// ═══════════════════════════════════════════════════════════
// Bewust karig. Eén regel met de conclusie, daaronder de stappen als bullets
// met de datum als link naar de mail, dan één regel met de documenten, en de
// rest ingeklapt. De voorraadkast is groot; dit venster is klein. Zou hier alles
// in komen, dan is het middel erger dan de kwaal.
//
// Dit is een pure functie die HTML teruggeeft, zodat exact hetzelfde blok op
// alle plekken gerenderd kan worden: bird's eye-chat, voorgestelde taak,
// weekplankaart en Pagina's.
// ═══════════════════════════════════════════════════════════

const MAX_DOCS = 4;

function esc(s: string): string {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const MAAND = ["januari", "februari", "maart", "april", "mei", "juni", "juli", "augustus", "september", "oktober", "november", "december"];

function mailLink(m: PaginaMail): string {
  return m.superhumanLink || m.webLink || "";
}

// De datum vooraan een stap wordt een echte link naar díe mail, met de knopjes
// er klein achter (vastpinnen, wegklikken, teksten binnenhalen). Kennen we de
// datum niet, dan blijft het gewone tekst: nooit een dode link.
/**
 * Het mailnummer dat het model achter de datum zet, omzetten naar een echte link op
 * die datum. Dit is de exacte weg: geen giswerk meer op de datum, ook niet als er
 * tien mails op één dag staan. Het nummer zelf verdwijnt uit beeld.
 */
function linkifyMailNummers(html: string, mails: PaginaMail[]): { html: string; geraakt: Set<number> } {
  const perId = new Map(mails.map((m) => [m.id, m]));
  const geraakt = new Set<number>();
  const uit = html.replace(
    /(\d{1,2}\s+[a-zà-ÿ]+|\d{1,2}-\d{1,2})?(\s*)\[?\s*mail#(\d+)\s*\]?/gi,
    (heel, datum: string | undefined, _sp: string, nr: string) => {
      const m = perId.get(Number(nr));
      const link = m ? mailLink(m) : "";
      if (!m || !link) return datum || "";          // onbekend nummer: alleen het nummer weg
      geraakt.add(m.id);
      const tekst = datum || "de mail";
      const knopjes = mailKnopjes(m);
      return `<a class="pd-link" href="${esc(link)}" target="_blank" rel="noreferrer" title="${esc(m.onderwerp)}">${tekst}</a>${knopjes}`;
    },
  );
  return { html: uit, geraakt };
}

function linkifyMailDatums(html: string, mails: PaginaMail[], alGeraakt: Set<number> = new Set()): string {
  if (!mails.length) return html;
  // Alle mails van een dag, niet alleen de eerste. Met één mail per datum kwam een
  // regel als "3 augustus: Ahren analyseerde de pagina" uit bij wie die dag toevallig
  // het eerst in de lijst stond. Op drukke dagen (28 juli had er zeven) is dat vrijwel
  // altijd de verkeerde. Welke het is, leiden we af uit de naam in dezelfde regel.
  const perDatum = new Map<string, PaginaMail[]>();
  for (const m of mails) {
    if (!m.ontvangenOp) continue;
    const d = new Date(m.ontvangenOp);
    if (Number.isNaN(d.getTime())) continue;
    const sleutels = [`${d.getDate()} ${MAAND[d.getMonth()]}`, `${d.getDate()}-${d.getMonth() + 1}`];
    for (const s of sleutels) {
      const lijst = perDatum.get(s) || [];
      lijst.push(m);
      perDatum.set(s, lijst);
    }
  }
  if (!perDatum.size) return html;

  // Terugval voor verhalen die nog geen mailnummer hebben. Eerst op naam, dan op
  // inhoud: welke mail gaat het meest over wat er in deze regel staat.
  //
  // Alleen op naam kijken werkte niet, want de tijdlijn schrijft bewust "jij" en "de
  // klant" in plaats van namen. Er viel dus nooit iets te matchen en de link verdween
  // helemaal, wat erger is dan de kwaal: je kunt dan nergens meer heen. Woordoverlap
  // met het onderwerp en de kernzin wijst er in de praktijk wél de goede aan, en is
  // hoe dan ook een betere gok dan "de eerste mail van die dag".
  const kiesUitDag = (kandidaten: PaginaMail[], regel: string): PaginaMail | null => {
    if (!kandidaten.length) return null;
    if (kandidaten.length === 1) return kandidaten[0];
    const kaal = regel.toLowerCase();
    for (const m of kandidaten) {
      const namen = `${m.vanNaam || ""} ${m.vanAdres || ""}`
        .split(/[<>@\s,;.]+/).map((n) => n.replace(/[^a-zà-ÿ-]/gi, "")).filter((n) => n.length > 2);
      if (namen.some((n) => kaal.includes(n.toLowerCase()))) return m;
    }
    // Woorden uit de regel die iets betekenen, tegen onderwerp en kernzin van de mail.
    const woorden = new Set(kaal.split(/[^a-zà-ÿ0-9-]+/).filter((w) => w.length > 4));
    let beste: PaginaMail | null = null;
    let hoogste = 0;
    for (const m of kandidaten) {
      const tekst = `${m.onderwerp || ""} ${m.kern || ""}`.toLowerCase();
      let raak = 0;
      for (const w of woorden) if (tekst.includes(w)) raak++;
      if (raak > hoogste) { hoogste = raak; beste = m; }
    }
    return hoogste > 0 ? beste : kandidaten[0];
  };

  const gebruikt = new Set<number>(alGeraakt);   // knopjes maar één keer per mail
  // Alleen buiten bestaande tags en links vervangen.
  const delen = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/gi);
  return delen.map((seg, i) => {
    if (i % 2 === 1 || !seg) return seg;
    return seg.replace(
      /\b(\d{1,2}\s+(?:januari|februari|maart|april|mei|juni|juli|augustus|september|oktober|november|december)|\d{1,2}-\d{1,2})\b/gi,
      (heel) => {
        const m = kiesUitDag(perDatum.get(heel.toLowerCase()) || [], seg);
        const link = m ? mailLink(m) : "";
        if (!m || !link) return heel;
        // Knopjes maar één keer per mail, achter de eerste vermelding.
        const eersteKeer = !gebruikt.has(m.id);
        gebruikt.add(m.id);
        return `<a class="pd-link" href="${esc(link)}" target="_blank" rel="noreferrer" title="${esc(m.onderwerp)}">${heel}</a>${eersteKeer ? mailKnopjes(m) : ""}`;
      },
    );
  }).join("");
}

// De knopjes bij een mail: klein en grijs, ze lichten pas op als je er met de
// muis overheen gaat. Ze zaten eerst in een omkaderd blokje, en dat maakte een
// rustige regel tekst onnodig druk.
function mailKnopjes(m: PaginaMail): string {
  const vast = m.bron === "pin";
  const zeker = vast || m.score >= HARD_BEWIJS;
  const knoppen: string[] = [];
  if (m.heeftBijlagen) {
    const titel = m.bijlageNamen.length
      ? `Zet deze bijlagen klaar als klantversie: ${m.bijlageNamen.join(", ")}`
      : "Zet de tekstbijlagen uit deze mail klaar als klantversie";
    knoppen.push(`<button type="button" class="pd-knop pd-bijlage" data-mail="${m.id}" title="${esc(titel)}">&#8595;</button>`);
  }
  if (vast) {
    knoppen.push(`<button type="button" class="pd-knop pd-los" data-mail="${m.id}" title="Vastgepind aan deze pagina. Klik om los te maken.">&#9679;</button>`);
  } else {
    knoppen.push(`<button type="button" class="pd-knop pd-pin" data-mail="${m.id}" title="${zeker ? "Vastpinnen aan deze pagina" : `Automatisch gevonden: ${esc(m.reden || "lijkt hierover te gaan")}. Klik om te bevestigen.`}">&#9675;</button>`);
    knoppen.push(`<button type="button" class="pd-knop pd-weg" data-mail="${m.id}" title="Hoort hier niet, en vraag het niet nog eens">&times;</button>`);
  }
  return `<span class="pd-knopjes${zeker ? "" : " pd-onzeker"}">${knoppen.join("")}</span>`;
}

// De statusregel: alleen wat je moet weten om te beslissen wat je nu doet.
// De eerste chip beantwoordt de vraag waarvoor je de kaart opent: kan dit door
// naar de sitebouwer, of wachten we nog op iemand? Die staat in de nu-regel van
// het verhaal, dus lezen we hem daaruit; zo geldt hij ook voor alle kaarten die
// er al stonden.
// `zonderStand`: staat dit blok in een projectkaart, dan staat het fase-blok er
// vlak onder met exact dezelfde vinkjes. Copy klaar, structured data en live zijn
// daar dan een tweede weergave van, opgehaald via een tweede aanvraag, dus ze
// kunnen zelfs iets anders zeggen. Wat hier blijft staan is wat het fase-blok
// NIET kan tonen: waar we op wachten, en wat er van de klant terugkwam.
function statusChips(d: PageDossier, tekst = "", zonderStand = false): string {
  const chips: string[] = [];
  const nu = /(^|\n)\s*[-*]?\s*nu\s*:(.*)$/im.exec(tekst || "");
  const nuRegel = (nu?.[2] || "").toLowerCase();
  if (/kan door naar de sitebouwer|kan naar de sitebouwer|kan door naar de developer/.test(nuRegel)) {
    chips.push('<span class="pd-stat pd-ok" title="Volgens de laatste stand ligt alles er; je kunt deze kaart doorzetten.">Kan door naar de sitebouwer</span>');
  } else if (/wachten op antwoord|wacht(en)? op /.test(nuRegel)) {
    chips.push('<span class="pd-stat pd-let" title="Er staat nog een vraag open; eerst antwoord afwachten.">Wachten op antwoord</span>');
  }
  const s = zonderStand ? null : d.stand;
  if (d.copyLive && d.copyLive.totaal > 0 && !d.copyLive.doorgevoerd && zonderStand) {
    chips.push(`<span class="pd-stat pd-stop" title="${d.copyLive.gevonden} van ${d.copyLive.totaal} koppen gevonden op de pagina">Nog niet live verwerkt</span>`);
  }
  if (s) {
    if (s.copy) chips.push('<span class="pd-stat pd-ok">Copy klaar</span>');
    if (d.copyLive && d.copyLive.totaal > 0 && !d.copyLive.doorgevoerd) {
      chips.push(`<span class="pd-stat pd-stop" title="${d.copyLive.gevonden} van ${d.copyLive.totaal} koppen gevonden op de pagina">Nog niet live verwerkt</span>`);
    }
    if (!s.structured) chips.push('<span class="pd-stat pd-stop">Geen structured data</span>');
    if (!s.live) chips.push('<span class="pd-stat pd-stop">Staat niet live</span>');
  }
  if (d.klantvoorstellen.length) {
    chips.push(`<span class="pd-stat pd-let">${d.klantvoorstellen.length === 1 ? "Klantversie" : `${d.klantvoorstellen.length} klantversies`} klaar om te verwerken</span>`);
  }
  return chips.length ? `<div class="pd-rij pd-statusrij">${chips.join("")}</div>` : "";
}

function tijdlijn(d: PageDossier): string {
  const rijen = d.activiteit.slice(0, 10);
  const extraDocs = d.documenten.slice(MAX_DOCS);
  const aantal = rijen.length + extraDocs.length + d.chats.length;
  if (!aantal) return "";

  const delen: string[] = [];
  if (extraDocs.length) {
    delen.push(`<div class="pd-links">${extraDocs.map((x) => (x.link
      ? `<a class="pd-link" href="${esc(x.link)}" target="_blank" rel="noreferrer">${esc(x.label)}</a>`
      : `<span class="pd-link-uit">${esc(x.label)}</span>`)).join('<span class="pd-scheider">·</span>')}</div>`);
  }
  if (rijen.length) {
    delen.push(`<ul class="pd-tijdlijn">${rijen.map((a) => {
      const datum = new Date(a.gebeurdeOp).toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
      const tekst = esc(a.intern);
      const bewijs = a.bewijs ? ` <a href="${esc(a.bewijs)}" target="_blank" rel="noreferrer">bekijk</a>` : "";
      return `<li><span class="pd-datum">${datum}</span> ${tekst}${bewijs}</li>`;
    }).join("")}</ul>`);
  }
  if (d.chats.length) {
    delen.push(`<div class="pd-chats">${d.chats.map((c) => `<span class="pd-chatregel" data-chat="${c.id}">${esc(c.title.slice(0, 90))}</span>`).join("")}</div>`);
  }
  return `<details class="pd-meer"><summary>Wat er gebeurd is (${aantal})</summary><div class="pd-meer-body">${delen.join("")}</div></details>`;
}

// Eén nette regel met de documenten en de pagina, als gewone oranje links met
// een puntje ertussen. Dit stond eerder als een rij grijze blokjes in beeld, en
// dat vloekte met de rest van het dashboard.
// `zonderStapdocs`: analyse, blauwdruk en copy staan in een projectkaart al bij
// hun eigen fase, precies waar je ze nodig hebt. Hier blijft dan over wat die
// rijen NIET tonen: teruggekregen klantversies, extra documentversies en de
// live pagina zelf.
function linkRegel(d: PageDossier, alGetoond = false, zonderStapdocs = false): string {
  const delen: string[] = [];
  // De teruggekregen teksten staan al achter de "nu:"-regel, precies waar het
  // werk begint. Ze hier nóg een keer neerzetten liet dezelfde pdf twee keer in
  // beeld staan, alsof er twee versies lagen.
  if (!alGetoond) for (const v of d.klantvoorstellen) {
    delen.push(v.link
      ? `<a class="pd-link pd-link-klant" href="${esc(v.link)}" target="_blank" rel="noreferrer" title="Teruggekregen van de klant, nog te verwerken">${esc(v.naam)}</a>`
      : `<span class="pd-link-uit" title="Teruggekregen van de klant, nog te verwerken">${esc(v.naam)}</span>`);
  }
  // Precies de documenten waar de fase-rijen zelf al naartoe linken, en niets
  // meer. Op soort filteren zou ook een geüploade copy-versie verbergen, en die
  // staat juist NIET bij de fases.
  const bijFase = new Set(Object.values(d.stand?.links || {}).filter(Boolean).map(String));
  for (const x of d.documenten.slice(0, MAX_DOCS)) {
    if (zonderStapdocs && x.link && bijFase.has(x.link)) continue;
    delen.push(x.link
      ? `<a class="pd-link" href="${esc(x.link)}" target="_blank" rel="noreferrer" title="Open het document">${esc(x.label)}</a>`
      : `<span class="pd-link-uit" title="Deze tekst bestaat, maar er is geen document van">${esc(x.label)}</span>`);
  }
  if (d.url) {
    delen.push(`<a class="pd-link" href="${esc(d.url)}" target="_blank" rel="noreferrer" title="De live pagina">${esc(d.pad)}</a>`);
  }
  return delen.length ? `<div class="pd-links">${delen.join('<span class="pd-scheider">·</span>')}</div>` : "";
}

// De laatste stap ("nu: de aangepaste teksten moeten op de pagina") eindigde
// zonder iets om aan te klikken, terwijl daar juist het werk begint. Hier komen
// de teruggekregen teksten en de mail waar ze uit komen achter te staan, zodat
// je vanaf die regel direct verder kunt.
function nuRegelLinks(d: PageDossier): string {
  const delen: string[] = [];
  for (const v of d.klantvoorstellen.slice(0, 3)) {
    if (v.link) delen.push(`<a class="pd-link pd-link-klant" href="${esc(v.link)}" target="_blank" rel="noreferrer" title="Teruggekregen van de klant, nog te verwerken">${esc(v.naam)}</a>`);
  }
  // De nieuwste mail met bijlagen: daar kwamen die teksten vandaan.
  const bron = d.mails.find((m) => m.heeftBijlagen && (m.bron === "pin" || m.score >= HARD_BEWIJS));
  const bronLink = bron ? (bron.superhumanLink || bron.webLink) : "";
  if (bron && bronLink) {
    delen.push(`<a class="pd-link" href="${esc(bronLink)}" target="_blank" rel="noreferrer" title="${esc(bron.onderwerp)}">de mail erbij</a>`);
  }
  if (!delen.length) return "";
  return ` <span class="pd-nu-links">${delen.join('<span class="pd-scheider">·</span>')}</span>`;
}

/**
 * Het volledige blok als HTML. `tekst` is de opgeslagen stand van zaken:
 * één regel conclusie plus de stappen als bullets.
 */
export function dossierBlokHtml(d: PageDossier, tekst: string, opts: { compact?: boolean; zonderStand?: boolean } = {}): string {
  const domein = d.domein;
  // Markdown → HTML (de bullets worden een echte lijst), slugs klikbaar, en de
  // datum vooraan elke stap wordt een link naar die mail.
  // Eerst exact op mailnummer. Verhalen van vóór deze wijziging hebben die nummers
  // nog niet; daarvoor blijft de datum-methode als terugval staan, zodat er nooit een
  // regel zonder link overblijft terwijl het verhaal opnieuw geschreven wordt.
  const opNummer = linkifyMailNummers(linkifyHtml(mdToHtml(tekst || ""), domein), d.mails);
  let verhaal = linkifyMailDatums(opNummer.html, d.mails, opNummer.geraakt);
  // Links achter de "nu:"-regel, de stap waar het werk begint.
  const nuLinks = nuRegelLinks(d);
  let voorstellenGetoond = false;
  if (nuLinks) {
    const voor = verhaal;
    verhaal = verhaal.replace(/(<li>\s*nu\s*:[\s\S]*?)(<\/li>)/i, (heel, inhoud, slot) => `${inhoud}${nuLinks}${slot}`);
    voorstellenGetoond = verhaal !== voor && d.klantvoorstellen.some((v) => v.link);
  }

  return [
    '<div class="pd-blok">',
    // Het pad staat in de kop. Onder een chat-antwoord kunnen twee van deze blokken
    // onder elkaar staan (voor twee pagina's die het antwoord noemt), en met alleen
    // "Waar deze pagina staat" boven allebei leek dat dubbelop terwijl het over
    // verschillende pagina's ging.
    `<div class="pd-kop"><span class="pd-koptekst">Waar ${d.pad ? `${esc(d.pad)} ` : "deze pagina "}staat</span></div>`,
    verhaal ? `<div class="pd-verhaal md">${verhaal}</div>` : "",
    linkRegel(d, voorstellenGetoond, opts.zonderStand === true),
    // De doorzet-chip is juist op de compacte kaart het nuttigst; de rest van de
    // statusregel blijft daar weg.
    opts.compact
      ? statusChips({ ...d, stand: null, klantvoorstellen: [] }, tekst)
      : statusChips(d, tekst, opts.zonderStand === true),
    opts.compact ? "" : tijdlijn(d),
    "</div>",
  ].filter(Boolean).join("");
}
