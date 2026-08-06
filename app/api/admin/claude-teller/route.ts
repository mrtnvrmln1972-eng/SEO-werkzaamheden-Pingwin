import { NextRequest, NextResponse } from "next/server";
import { guardOwner } from "../../../../lib/admin-scope";
import { getClaudeKosten } from "../../../../lib/usage";
import { actieLabel } from "../../../../lib/usage-labels";
import { claudeStand, budgetUitEnv } from "../../../../lib/claude-teller";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// ═══════════════════════════════════════════════════════════
// WAT KOST HET DENKWERK DEZE MAAND?
// ═══════════════════════════════════════════════════════════
// Voedt de Claude-teller in de kopbalk van elk beheerscherm. Drie metingen uit de
// eigen verbruiktabel: deze kalendermaand, de vorige (als ijkpunt) en de laatste
// zeven dagen, met de duurste actie en de duurste klant erbij.
//
// Belangrijk om te weten bij het lezen van die cijfers: dit is uitsluitend wat het
// DASHBOARD verstookt via zijn eigen API-sleutel. Het chatten in Claude Code of op
// claude.ai loopt over een abonnement en staat op een andere rekening; daar is geen
// koppeling voor, en het paneel zegt dat er dan ook bij in plaats van te doen alsof
// dit bedrag het hele plaatje is.
//
// Achter guardOwner en niet guardDev: dit zijn kosten, en die zijn voor de eigenaar.
// Een teamgebruiker krijgt een foutcode en het tellertje tekent niets.
// ═══════════════════════════════════════════════════════════

/** Begin van een kalendermaand naar Nederlandse klok, omgerekend naar servertijd (Vercel draait op UTC). */
function maandStart(maandenTerug: number): Date {
  const nu = new Date();
  const nl = new Date(nu.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  const offset = nl.getTime() - nu.getTime();
  const start = new Date(nl.getFullYear(), nl.getMonth() - maandenTerug, 1, 0, 0, 0, 0);
  return new Date(start.getTime() - offset);
}

export async function GET(req: NextRequest) {
  const g = await guardOwner(req); if (!g.ok) return g.res;

  const dezeMaand = maandStart(0);
  const vorigeMaand = maandStart(1);
  const week = new Date();
  week.setDate(week.getDate() - 7);

  const [maand, vorig, laatsteWeek] = await Promise.all([
    getClaudeKosten(dezeMaand.toISOString()).catch(() => null),
    getClaudeKosten(vorigeMaand.toISOString(), dezeMaand.toISOString()).catch(() => null),
    getClaudeKosten(week.toISOString()).catch(() => null),
  ]);

  if (!maand) return NextResponse.json({ ok: true, stand: null });

  const stand = claudeStand(
    {
      maandUsd: maand.usd,
      vorigeMaandUsd: vorig ? vorig.usd : null,
      budgetUsd: budgetUitEnv(process.env.CLAUDE_MAANDBUDGET_USD),
    },
    new Date(),
  );

  return NextResponse.json({
    ok: true,
    stand,
    maand: {
      calls: maand.calls,
      topActie: maand.topActie ? { label: actieLabel(maand.topActie.action), usd: maand.topActie.usd } : null,
      topKlant: maand.topKlant,
    },
    week: laatsteWeek ? { usd: laatsteWeek.usd, calls: laatsteWeek.calls } : null,
  });
}
