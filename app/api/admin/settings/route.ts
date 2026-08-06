import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { getSetting, setSetting, SETTING_INVOICE_MAIL, SETTING_OVERVIEW_ZWAAR } from "../../../../lib/settings";

export const runtime = "nodejs";

// App-instellingen (eigenaar-only). Alleen bekende sleutels zijn toegestaan.
const KNOWN_KEYS = [SETTING_INVOICE_MAIL, SETTING_OVERVIEW_ZWAAR];

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  const out: Record<string, string | null> = {};
  for (const k of KNOWN_KEYS) out[k] = await getSetting(k);
  return NextResponse.json({ ok: true, settings: out });
}

export async function PATCH(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const key = String(body.key || "");
  if (!KNOWN_KEYS.includes(key)) return NextResponse.json({ ok: false, error: "Onbekende instelling." }, { status: 400 });
  await setSetting(key, String(body.value ?? ""));
  return NextResponse.json({ ok: true });
}
