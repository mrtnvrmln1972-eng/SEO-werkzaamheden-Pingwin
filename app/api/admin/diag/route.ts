import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TIJDELIJK diagnose-endpoint om de echte oorzaak van de /admin-500 te vinden.
// Draait de bouwstenen van de adminpagina los en geeft de ECHTE foutmelding
// terug (niet alleen de Vercel-digest). Verwijderen zodra de oorzaak bekend is.

function envState(name: string): string {
  const v = process.env[name];
  if (!v) return "MISSING";
  return `set(len=${v.length})`;
}

async function probe(label: string, fn: () => Promise<unknown>) {
  try {
    const value = await fn();
    let note = "";
    if (Array.isArray(value)) note = `array(${value.length})`;
    else if (value && typeof value === "object") note = "object";
    else note = String(value);
    return { label, ok: true, note };
  } catch (e: unknown) {
    const err = e as { message?: string; stack?: string; code?: string; name?: string };
    return {
      label,
      ok: false,
      name: err?.name || null,
      code: err?.code || null,
      message: err?.message || String(e),
      stack: (err?.stack || "").split("\n").slice(0, 6).join("\n"),
    };
  }
}

export async function GET() {
  const env = {
    SESSION_SECRET: envState("SESSION_SECRET"),
    ADMIN_PASSWORD: envState("ADMIN_PASSWORD"),
    POSTGRES_URL: envState("POSTGRES_URL"),
    POSTGRES_PRISMA_URL: envState("POSTGRES_PRISMA_URL"),
    POSTGRES_URL_NON_POOLING: envState("POSTGRES_URL_NON_POOLING"),
    DATABASE_URL: envState("DATABASE_URL"),
    MONEYBIRD_API_TOKEN: envState("MONEYBIRD_API_TOKEN"),
    MONEYBIRD_ADMINISTRATION_ID: envState("MONEYBIRD_ADMINISTRATION_ID"),
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
  };

  const probes = [];
  probes.push(
    await probe("sql select 1", async () => {
      const { sql } = await import("@vercel/postgres");
      const r = await sql`select 1 as x`;
      return r.rows?.[0]?.x;
    }),
  );
  probes.push(
    await probe("ensureSchema", async () => {
      const { ensureSchema } = await import("../../../../lib/db");
      await ensureSchema();
      return "ok";
    }),
  );
  probes.push(
    await probe("listClients", async () => {
      const { listClients } = await import("../../../../lib/clients");
      return await listClients();
    }),
  );
  probes.push(
    await probe("moneybirdConfigured", async () => {
      const { moneybirdConfigured } = await import("../../../../lib/moneybird");
      return moneybirdConfigured();
    }),
  );

  return NextResponse.json({ env, probes }, { status: 200 });
}
