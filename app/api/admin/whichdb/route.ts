import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// TIJDELIJK: geeft ALLEEN de databasehost terug (geen wachtwoord), zodat we
// kunnen zien welke Neon-database dit project gebruikt. Direct verwijderen.

function hostOnly(name: string): string | null {
  const raw = process.env[name];
  if (!raw) return null;
  try {
    const u = new URL(raw);
    // alleen host + het endpoint-deel (bevat meestal de Neon-projectnaam)
    return u.hostname;
  } catch {
    const m = raw.match(/@([^/:?]+)/);
    return m ? m[1] : "onparseerbaar";
  }
}

export async function GET() {
  return NextResponse.json({
    project: process.env.VERCEL_PROJECT_PRODUCTION_URL || null,
    POSTGRES_URL_host: hostOnly("POSTGRES_URL"),
    POSTGRES_PRISMA_URL_host: hostOnly("POSTGRES_PRISMA_URL"),
    POSTGRES_URL_NON_POOLING_host: hostOnly("POSTGRES_URL_NON_POOLING"),
    DATABASE_URL_host: hostOnly("DATABASE_URL"),
  });
}
