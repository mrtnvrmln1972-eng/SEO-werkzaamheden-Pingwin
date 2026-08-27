import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import {
  alleCorrecties, verwerkPlaksel, opnieuwUitwerken, verwijderCorrectie, wijzigRegel,
  mailsOmTeVerwerken, verwerkMail,
} from "../../../../lib/klant-correcties";
import { getOrgData, saveOrgData, type OrgData } from "../../../../lib/org-data";

export const runtime = "nodejs";
// Het uitwerken naar regels is één Claude-ronde op een hele mail; ruim de tijd.
export const maxDuration = 300;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// GET: alles wat de klant zelf heeft aangeleverd, met de regels eruit.
export async function GET(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const [correcties, mails] = await Promise.all([alleCorrecties(slug), mailsOmTeVerwerken(slug).catch(() => [])]);
  return NextResponse.json({ ok: true, correcties, mails });
}

// POST: een geplakt stuk tekst verwerken, of een eerdere ronde opnieuw uitwerken,
// of een voorgesteld bedrijfsgegeven doorvoeren.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const wat = String(body.wat || "verwerken");

  if (wat === "opnieuw") {
    const id = Number(body.correctieId || 0);
    if (!id) return NextResponse.json({ ok: false, error: "Geen tekst opgegeven." }, { status: 400 });
    const res = await opnieuwUitwerken(slug, id);
    return NextResponse.json({ ...res, correcties: await alleCorrecties(slug) });
  }

  if (wat === "mail") {
    const id = String(body.messageId || "").trim();
    if (!id) return NextResponse.json({ ok: false, error: "Geen mail opgegeven." }, { status: 400 });
    const res = await verwerkMail(slug, id);
    return NextResponse.json({ ...res, correcties: await alleCorrecties(slug), mails: await mailsOmTeVerwerken(slug).catch(() => []) });
  }

  if (wat === "regel") {
    const id = Number(body.regelId || 0);
    if (!id) return NextResponse.json({ ok: false, error: "Geen regel opgegeven." }, { status: 400 });
    await wijzigRegel(slug, id, String(body.tekst ?? ""));
    return NextResponse.json({ ok: true, correcties: await alleCorrecties(slug) });
  }

  if (wat === "bedrijfsgegeven") {
    const veld = String(body.veld || "").trim();
    const waarde = String(body.waarde || "").trim();
    const res = await zetBedrijfsgegeven(slug, veld, waarde);
    return NextResponse.json(res);
  }

  const res = await verwerkPlaksel(slug, String(body.ruw || ""), {
    bron: String(body.bron || ""),
    datum: String(body.datum || "") || null,
  });
  return NextResponse.json({ ...res, correcties: await alleCorrecties(slug) });
}

// DELETE: een geplakt stuk tekst met zijn regels weghalen.
export async function DELETE(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const slug = req.nextUrl.searchParams.get("slug") || "";
  const id = Number(req.nextUrl.searchParams.get("id") || 0);
  if (!slug || !id) return NextResponse.json({ ok: false, error: "Onvolledige aanvraag." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  await verwijderCorrectie(slug, id);
  return NextResponse.json({ ok: true, correcties: await alleCorrecties(slug) });
}

// Eén voorgesteld gegeven doorzetten naar de structured data. Alleen de velden
// die de AI ook mag voorstellen; werkgebied is een lijst (puntkomma-gescheiden).
async function zetBedrijfsgegeven(slug: string, veld: string, waarde: string): Promise<{ ok: boolean; error?: string }> {
  if (!veld || !waarde) return { ok: false, error: "Onvolledig voorstel." };
  const rec = await getOrgData(slug);
  const data: OrgData = { ...rec.data };
  if (veld === "areaServed") {
    data.areaServed = waarde.split(/[;\n]/).map((s) => s.trim()).filter(Boolean);
  } else if (["plaats", "straat", "postcode", "telefoon", "email", "oprichtingsjaar", "openingstijden", "priceRange", "kvk", "btw"].includes(veld)) {
    (data as unknown as Record<string, string>)[veld] = waarde;
  } else {
    return { ok: false, error: "Dit veld kan hier niet gezet worden." };
  }
  const res = await saveOrgData(slug, data, "admin");
  return res.ok ? { ok: true } : { ok: false, error: res.error || "Opslaan mislukte." };
}
