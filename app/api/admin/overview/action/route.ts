import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { guardSlug } from "../../../../../lib/admin-scope";
import { getChatHistory, replaceChatHistory, type ChatMessage } from "../../../../../lib/chat";
import { executeAction, EDITABLE, type ProposedAction } from "../../../../../lib/overview-actions";

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
  let msgIdx = -1, actIdx = -1;
  for (let i = 0; i < history.length; i++) {
    const acts = history[i].actions;
    if (!acts) continue;
    const j = acts.findIndex((a) => a.id === actionId);
    if (j !== -1) { found = acts[j]; msgIdx = i; actIdx = j; break; }
  }
  if (!found) return NextResponse.json({ ok: false, error: "Actie niet gevonden (mogelijk verlopen uit de historie)." }, { status: 404 });
  if (found.executed) return NextResponse.json({ ok: true, alreadyDone: true, result: found.result });

  // Bewerkbare acties (bv. profiel_bijwerken): gebruik de door Maarten bijgestelde tekst.
  if (EDITABLE.includes(found.type) && typeof body.edit === "string" && body.edit.trim()) {
    found = { ...found, tekst: String(body.edit).slice(0, 4000).trim() };
  }
  const result = await executeAction(slug, found);
  // Markeer de actie in de historie (ook bij mislukken, met het resultaat), zodat
  // de status terugvindbaar blijft. Bij mislukken laten we 'executed' vals zodat
  // opnieuw proberen mogelijk is.
  const acts = history[msgIdx].actions!;
  acts[actIdx] = { ...found, executed: result.ok ? true : false, result };
  await replaceChatHistory(slug, thread, history);

  return NextResponse.json({ ok: result.ok, result });
}
