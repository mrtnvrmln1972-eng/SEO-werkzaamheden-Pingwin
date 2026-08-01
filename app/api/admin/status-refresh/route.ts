import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getEmails, ingestStatus, type StatusExchange, type ClientStatus, getStatus } from "../../../../lib/snapshots";
import { getClientBySlug } from "../../../../lib/clients";
import { msStatus, msSearchClientEmails } from "../../../../lib/ms-graph";
import { callClaude, anthropicConfigured } from "../../../../lib/anthropic";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

function stripHtml(s: string): string {
  return (s || "").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

// Vernieuwt de "Actuele stand van zaken" uit de recente mailwisseling (live
// Outlook plus ingelezen mails). Zo loopt de tijdlijn weer bij zodra er nieuwe
// mails zijn, zonder te wachten op de externe data-brug.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  if (!anthropicConfigured()) return NextResponse.json({ ok: false, error: "Hiervoor is een ANTHROPIC_API_KEY nodig in Vercel." }, { status: 400 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const client = await getClientBySlug(slug).catch(() => null);
  if (!client) return NextResponse.json({ ok: false, error: "Klant niet gevonden." }, { status: 404 });

  // Mails verzamelen: live Outlook samengevoegd met de opgeslagen mails, nieuwste eerst.
  let emails = await getEmails(slug, 40).catch(() => []);
  try {
    const ms = await msStatus();
    if (ms.connected) {
      const q = (client.email || client.domain || "").trim();
      if (q) {
        const live = await msSearchClientEmails(q, ms.account || "", 15).catch(() => null);
        if (live && live.length) {
          const seen = new Set(live.map((e) => e.id));
          emails = [...live, ...emails.filter((e) => !seen.has(e.id))];
        }
      }
    }
  } catch { /* dan alleen opgeslagen mails */ }
  emails = emails
    .filter((e) => !/@ahrefs\.com$/i.test((e.fromAddress || "").trim()) && !/postmaster|mailer-daemon|microsoftexchange/i.test((e.fromAddress || "")))
    .sort((a, b) => (b.receivedAt || "").localeCompare(a.receivedAt || ""))
    .slice(0, 15);
  if (!emails.length) return NextResponse.json({ ok: false, error: "Geen mails gevonden om samen te vatten." }, { status: 400 });

  const mailTekst = emails.map((e) => {
    const dir = e.direction === "out" ? "WIJ→klant" : "klant→WIJ";
    const date = (e.receivedAt || "").slice(0, 10);
    const body2 = (stripHtml(e.bodyHtml || "") || e.preview || "").slice(0, 1800);
    const link = ((e as { superhumanLink?: string | null }).superhumanLink || e.webLink || "").trim();
    return `[${dir} | ${date} | onderwerp: ${e.subject || "(geen)"}${link ? ` | link: ${link}` : ""}]\n${body2}`;
  }).join("\n\n---\n\n");

  const system =
    `Je vat de mailwisseling tussen SEO-bureau Pingwin (WIJ) en de klant "${client.name}" samen tot een korte tijdlijn van gesprekspunten. ` +
    `Antwoord met UITSLUITEND geldige JSON, exact dit formaat:\n` +
    `{"exchanges":[{"side":"client|us","text":"één korte regel met de kern","date":"YYYY-MM-DD","status":"open|done","subject":"onderwerp van de bron-mail","mailLink":"de link uit de mailkop of leeg"}]}\n` +
    `Regels: nieuwste bovenaan; per relevant gesprekspunt één regel (bounces en automatische mails overslaan); "side" is client als de klant iets vraagt/meldt, us als wij iets doen/antwoorden; "status" is open als het punt nog opvolging nodig heeft, done als het is afgehandeld of beantwoord; neem "subject" en "mailLink" letterlijk uit de mailkop over. Maximaal 12 punten. Geen tekst buiten de JSON.`;

  try {
    const raw = await callClaude(system, [{ role: "user", content: mailTekst.slice(0, 40000) }], 2500, { slug, action: "status_refresh" });
    const jsonText = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
    const start = jsonText.indexOf("{");
    const end = jsonText.lastIndexOf("}");
    const parsed = JSON.parse(start >= 0 && end > start ? jsonText.slice(start, end + 1) : jsonText) as { exchanges?: StatusExchange[] };
    const exchanges = (Array.isArray(parsed.exchanges) ? parsed.exchanges : [])
      .filter((x) => x && (x.side === "client" || x.side === "us") && String(x.text || "").trim())
      .slice(0, 12)
      .map((x) => ({ side: x.side, text: String(x.text).slice(0, 300), date: x.date || null, status: x.status === "done" ? "done" as const : "open" as const, subject: x.subject || null, mailLink: x.mailLink || null }));
    if (!exchanges.length) return NextResponse.json({ ok: false, error: "Samenvatten leverde geen punten op; er is niets gewijzigd." }, { status: 502 });
    // Taken en mail-acties uit de bestaande status behouden; alleen de tijdlijn vernieuwen.
    const huidig = await getStatus(slug);
    const nieuw: ClientStatus = { exchanges, tasks: huidig.status.tasks, mailActions: huidig.status.mailActions };
    await ingestStatus(slug, nieuw);
    return NextResponse.json({ ok: true, count: exchanges.length });
  } catch {
    return NextResponse.json({ ok: false, error: "De assistent is niet bereikbaar; er is niets gewijzigd." }, { status: 502 });
  }
}
