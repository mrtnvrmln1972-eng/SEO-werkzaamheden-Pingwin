// Status per opdrachtregel op een projectkaart ("Opdrachten in deze kaart").
// Los van de zeven fases (lib/phase-marks.ts): een opdracht hoort bij één
// kaart (task_id), niet per se bij één pagina, want een taak kan over een
// pagina gaan die nog niet eens bestaat of over iets dat geen pagina is
// (bijv. "redirect loskoppelen"). Zelfde patroon: een handmatige of
// automatische status wint van "open", beide kanten op.

import { sql, ensureSchema } from "./db";
import { opdrachtKey, type OpdrachtStatus, type OpdrachtMark } from "./opdracht-key";

export type { OpdrachtStatus, OpdrachtMark } from "./opdracht-key";

export async function getOpdrachtMarks(taskId: number): Promise<Record<string, OpdrachtMark>> {
  await ensureSchema();
  const { rows } = await sql`SELECT opdracht_key, status, melding FROM weekplan_opdracht_marks WHERE task_id = ${taskId}`;
  const out: Record<string, OpdrachtMark> = {};
  for (const r of rows) out[String(r.opdracht_key)] = { status: r.status as OpdrachtStatus, melding: r.melding ? String(r.melding) : null };
  return out;
}

export async function setOpdrachtMark(taskId: number, tekst: string, status: OpdrachtStatus, melding?: string): Promise<void> {
  await ensureSchema();
  const k = opdrachtKey(tekst);
  if (status === "open") {
    await sql`DELETE FROM weekplan_opdracht_marks WHERE task_id = ${taskId} AND opdracht_key = ${k}`;
    return;
  }
  await sql`
    INSERT INTO weekplan_opdracht_marks (task_id, opdracht_key, status, melding)
    VALUES (${taskId}, ${k}, ${status}, ${melding || null})
    ON CONFLICT (task_id, opdracht_key)
    DO UPDATE SET status = ${status}, melding = ${melding || null}, updated_at = now()`;
}
