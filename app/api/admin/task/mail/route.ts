import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../../lib/admin-scope";
import { msSendMail, msStatus } from "../../../../../lib/ms-graph";
import { getClientBySlug } from "../../../../../lib/clients";
import { planOpvolging } from "../../../../../lib/mail-opvolg";

export const runtime = "nodejs";
export const maxDuration = 60;

// Verstuurt de mail vanuit een weekplan-kaart écht, via Microsoft 365.
//
// De knop "Versturen" zette eerder alleen window.location.href op een mailto-link.
// Dat opent hooguit een mailprogramma, en met een lange tekst plus een volledige
// Google Docs-URL wordt die link zo lang dat browsers hem stil laten vallen: je
// klikt en er gebeurt niets. De facturenmail verstuurt al via Graph; dit doet
// hetzelfde.
//
// Mens aan het stuur blijft gelden: er gaat alleen iets weg als Maarten op
// Versturen klikt, met de tekst die hij op dat moment ziet.

// Documentnamen worden echte links. De assistent noemt het document bij naam
// ("het copy-document"); hier hangen we de link eraan, zodat er nooit een kale
// URL van honderd tekens in de mail staat.
// Geeft naast de tekst terug WELKE links er niet in pasten. Die mogen nooit stil
// verdwijnen: op 03-08-2026 stuurde Maarten een mail met "kun je deze tekst op de
// bijgevoegde link plaatsen?" terwijl de aangevinkte link nergens stond. De
// ontvanger verwijst dan naar iets wat er niet is.
function linkify(html: string, links: { label: string; url: string }[]): { html: string; ongeplaatst: { label: string; url: string }[] } {
  let uit = html;
  const ongeplaatst: { label: string; url: string }[] = [];
  for (const l of links) {
    if (!l.url || !l.label) continue;
    // Alleen de eerste vermelding linken: een mail met drie keer dezelfde link
    // erin leest rommelig.
    const woord = l.label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(^|[\\s(>])(${woord})(?=[\\s).,:;!?<]|$)`, "i");
    if (re.test(uit)) {
      uit = uit.replace(re, (_m, pre, tekst) => `${pre}<a href="${l.url}">${tekst}</a>`);
      continue;
    }
    // Staat de naam niet in de tekst, dan een kale URL vervangen door de naam.
    if (uit.includes(l.url)) { uit = uit.split(l.url).join(`<a href="${l.url}">${l.label}</a>`); continue; }
    ongeplaatst.push(l);
  }
  return { html: uit, ongeplaatst };
}

// Wat niet in de lopende tekst paste, komt er onderaan alsnog bij. Simpel, zoals
// een mail hoort: een regel per link, geen tabel en geen kopjes.
function plakOnderaan(html: string, links: { label: string; url: string }[]): string {
  if (!links.length) return html;
  const regels = links.map((l) => `<p><a href="${l.url}">${l.label}</a></p>`).join("\n");
  return `${html}\n${regels}`;
}

// Adressen opschonen. Microsoft weigerde "maarten@pingwin.nl," omdat de komma als
// onderdeel van het adres meeging: "Recipient is not resolved". Splitsen op komma en
// puntkomma lost dat op en maakt meerdere ontvangers meteen mogelijk.
function adressen(ruw: string): string[] {
  return (ruw || "")
    .split(/[,;]+/)
    .map((a) => a.trim().replace(/^[<]|[>]$/g, ""))
    .filter(Boolean);
}
const ADRES_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// Paden naar de live site worden echte links, zodat de sitebouwer overal kan
// doorklikken zonder een URL over te typen.
function linkifyPaden(html: string, domein: string): string {
  const basis = (domein || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  if (!basis) return html;
  const delen = html.split(/(<a\b[^>]*>[\s\S]*?<\/a>|<[^>]+>)/gi);
  return delen.map((seg, i) => {
    if (i % 2 === 1 || !seg) return seg;   // een tag of bestaande link: niet aanraken
    return seg.replace(/(^|[\s(>])(\/[a-z][a-z0-9-]*(?:\/[a-z0-9-]+)*\/?)(?=[\s).,:;!?]|$)/gi,
      (_m, pre, pad) => `${pre}<a href="https://${basis}${pad}">${pad}</a>`);
  }).join("");
}

function naarHtml(tekst: string, links: { label: string; url: string }[]): { html: string; ongeplaatst: { label: string; url: string }[] } {
  const veilig = (tekst || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  // Een enkel vet woord en een genummerd lijstje mogen wel. Dat doet Maarten in
  // zijn eigen mails ook en het leest prettiger; het is iets anders dan een mail
  // volplempen met kopjes en kaders. Sterretjes die niets omsluiten blijven staan
  // zoals ze staan, zodat "5 * 3" geen opmaak wordt.
  const vet = (s: string) => s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, "<strong>$1</strong>");
  const regels = veilig.split("\n").map((r) => r.trimEnd());
  const uit: string[] = [];
  let inLijst: "ul" | "ol" | null = null;
  const sluit = () => { if (inLijst) { uit.push(`</${inLijst}>`); inLijst = null; } };
  for (const r of regels) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(r);
    const genummerd = /^\s*\d+[.)]\s+(.*)$/.exec(r);
    if (bullet || genummerd) {
      const soort = bullet ? "ul" : "ol";
      if (inLijst !== soort) { sluit(); uit.push(`<${soort}>`); inLijst = soort; }
      uit.push(`<li>${vet((bullet || genummerd)![1])}</li>`);
      continue;
    }
    sluit();
    if (!r.trim()) { uit.push(""); continue; }
    uit.push(`<p>${vet(r)}</p>`);
  }
  sluit();
  return linkify(uit.filter((x) => x !== "").join("\n"), links);
}

export async function POST(req: NextRequest) {
  let body: { slug?: string; to?: string; onderwerp?: string; tekst?: string; links?: { label: string; url: string }[];
               herinnerDagen?: number; taak?: string; url?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const ontvangers = adressen(String(body.to || ""));
  const to = ontvangers.join(", ");
  const tekst = String(body.tekst || "").trim();
  const onderwerp = String(body.onderwerp || "").trim();
  if (!ontvangers.length) return NextResponse.json({ ok: false, error: "Vul eerst het e-mailadres van de ontvanger in." }, { status: 400 });
  // Vóór het versturen controleren, zodat je een begrijpelijke melding krijgt in
  // plaats van een afwijzing van Microsoft achteraf.
  const fout = ontvangers.filter((a) => !ADRES_OK.test(a));
  if (fout.length) return NextResponse.json({ ok: false, error: `Dit lijkt geen geldig e-mailadres: ${fout.join(", ")}` }, { status: 400 });
  if (!tekst) return NextResponse.json({ ok: false, error: "De mail is nog leeg." }, { status: 400 });

  const st = await msStatus().catch(() => ({ configured: false, connected: false, account: null }));
  if (!st.connected) {
    // Geen koppeling: eerlijk zeggen wat er aan de hand is en waar het opgelost
    // wordt, in plaats van een knop die stil niets doet.
    return NextResponse.json({
      ok: false,
      koppelingOntbreekt: true,
      error: "Microsoft 365 is niet gekoppeld, dus versturen kan niet vanuit het dashboard. Koppel het op het Klant-tabblad, of gebruik Kopieer en plak de mail in Superhuman.",
    }, { status: 400 });
  }

  const links = (Array.isArray(body.links) ? body.links : []).filter((l) => l && l.url && l.label);
  const klant = await getClientBySlug(slug).catch(() => null);
  const { html: metLinks, ongeplaatst } = naarHtml(tekst, links);
  const html = linkifyPaden(plakOnderaan(metLinks, ongeplaatst), klant?.domain || "");
  const r = await msSendMail(ontvangers, onderwerp || "Bericht van Pingwin", html);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error || "Versturen mislukte." }, { status: 502 });

  // Om een reactie moet je vaak zelf achteraan. Vroeg je om een herinnering, dan
  // verschijnt die op de afgesproken dag bij het belletje in de kopbalk.
  const dagen = Number(body.herinnerDagen || 0);
  let herinnering = "";
  if (dagen > 0) {
    await planOpvolging({
      clientSlug: slug, taak: String(body.taak || ""), onderwerp, naar: to,
      url: String(body.url || ""), dagen,
    }).catch(() => { /* de mail is weg; een mislukte herinnering mag dat niet ongedaan maken */ });
    herinnering = ` Je krijgt over ${Math.round(dagen)} ${Math.round(dagen) === 1 ? "dag" : "dagen"} een herinnering om te checken of er antwoord is.`;
  }
  return NextResponse.json({ ok: true, sentTo: r.sentTo, samenvatting: `Verstuurd naar ${to}.${herinnering}` });
}
