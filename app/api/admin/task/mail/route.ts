import { NextRequest, NextResponse } from "next/server";
import { guardSlug } from "../../../../../lib/admin-scope";
import { msSendMail, msStatus } from "../../../../../lib/ms-graph";

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
function linkify(html: string, links: { label: string; url: string }[]): string {
  let uit = html;
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
    if (uit.includes(l.url)) uit = uit.split(l.url).join(`<a href="${l.url}">${l.label}</a>`);
  }
  return uit;
}

function naarHtml(tekst: string, links: { label: string; url: string }[]): string {
  const veilig = (tekst || "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const regels = veilig.split("\n").map((r) => r.trimEnd());
  const uit: string[] = [];
  let inLijst = false;
  for (const r of regels) {
    const bullet = /^\s*[-*]\s+(.*)$/.exec(r);
    if (bullet) {
      if (!inLijst) { uit.push("<ul>"); inLijst = true; }
      uit.push(`<li>${bullet[1]}</li>`);
      continue;
    }
    if (inLijst) { uit.push("</ul>"); inLijst = false; }
    if (!r.trim()) { uit.push(""); continue; }
    uit.push(`<p>${r}</p>`);
  }
  if (inLijst) uit.push("</ul>");
  return linkify(uit.filter((x) => x !== "").join("\n"), links);
}

export async function POST(req: NextRequest) {
  let body: { slug?: string; to?: string; onderwerp?: string; tekst?: string; links?: { label: string; url: string }[] };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Klant verplicht." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const to = String(body.to || "").trim();
  const tekst = String(body.tekst || "").trim();
  const onderwerp = String(body.onderwerp || "").trim();
  if (!to) return NextResponse.json({ ok: false, error: "Vul eerst het e-mailadres van de ontvanger in." }, { status: 400 });
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
  const html = naarHtml(tekst, links);
  const r = await msSendMail([to], onderwerp || "Bericht van Pingwin", html);
  if (!r.ok) return NextResponse.json({ ok: false, error: r.error || "Versturen mislukte." }, { status: 502 });
  return NextResponse.json({ ok: true, sentTo: r.sentTo, samenvatting: `Verstuurd naar ${to}.` });
}
