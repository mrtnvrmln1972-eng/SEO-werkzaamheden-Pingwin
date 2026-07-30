import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getChatHistory, type ChatMessage } from "../../../../../lib/chat";
import { executeAction, EDITABLE, getActionStatus, recordActionStatus, type ProposedAction } from "../../../../../lib/overview-actions";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Voert één voorgestelde bird's eye-actie uit die Maarten goedkeurt. De actie
// wordt uit de OPGESLAGEN historie gelezen (bron van waarheid, niet uit de client),
// en na uitvoeren als 'executed' gemarkeerd zodat dubbel klikken niets extra doet.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "Ongeldige aanvraag." }, { status: 400 }); }
  const slug = String(body.slug || "").trim();
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;
  const thread = String(body.thread || "overzicht").trim() || "overzicht";
  const actionId = String(body.actionId || "").trim();
  if (!slug || !actionId) return NextResponse.json({ ok: false, error: "Klant en actie zijn verplicht." }, { status: 400 });

  const history = await getChatHistory(slug, thread) as ChatMessage[];
  let found: ProposedAction | undefined;
  for (const m of history) {
    const a = m.actions?.find((x) => x.id === actionId);
    if (a) { found = a; break; }
  }
  if (!found) return NextResponse.json({ ok: false, error: "Actie niet gevonden (mogelijk verlopen uit de historie)." }, { status: 404 });

  // Al uitgevoerd? Niets opnieuw doen. De status-tabel is de bron van waarheid
  // (niet de chat-JSON), zodat gelijktijdige goedkeuringen elkaar niet raken.
  const prior = await getActionStatus(actionId);
  if (prior?.executed) return NextResponse.json({ ok: true, alreadyDone: true, result: prior.result });

  // Bewerkbare acties (bv. profiel_bijwerken): gebruik de door Maarten bijgestelde tekst.
  if (EDITABLE.includes(found.type) && typeof body.edit === "string" && body.edit.trim()) {
    found = { ...found, tekst: String(body.edit).slice(0, 4000).trim() };
  }
  const result = await executeAction(slug, found);
  // Status atomisch als eigen rij wegschrijven (ook bij mislukken, met het
  // resultaat). Bij mislukken blijft 'executed' vals zodat opnieuw proberen kan.
  await recordActionStatus(slug, thread, actionId, result.ok, result);

  return NextResponse.json({ ok: result.ok, result });
}
