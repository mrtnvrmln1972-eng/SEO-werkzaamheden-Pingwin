import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../../lib/admin-auth";
import { fileName } from "../../../../../lib/drive";
import { driveIdFromUrl } from "../../../../../lib/drive-id";
import { vensterPoort } from "../../../../../lib/klantvenster";

export const runtime = "nodejs";

// ═══════════════════════════════════════════════════════════
// HOE HEET DIT DOCUMENT?
// ═══════════════════════════════════════════════════════════
// Plak je een Google-link in een tekstveld, dan stond er een adres van honderd
// tekens in beeld: "https://docs.google.com/spreadsheets/d/1UJc5_O5pfnkA9KnOe8Q
// IcKWPVJTvb56Gw2zbI13lDXE/edit?gid=1138758916#gid=1138758916". Onleesbaar, en
// je moet hem openen om te weten wat het is.
//
// Drive weet gewoon hoe het bestand heet. Dit eindpunt vraagt het op, zodat het
// veld de naam kan tonen met de link eronder. Meer doet het niet: alleen lezen,
// alleen de naam, en alleen voor wie al is ingelogd.
export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  // Op een klantvoordeur bestaat dit niet: daar zou je met een gokje de namen
  // van bestanden uit de Drive van Pingwin kunnen aflezen. Deze route hoort bij
  // één klant noch bij een lijst, dus er is geen slug om op te toetsen; het
  // venster zelf is de poort.
  const weg = vensterPoort(); if (weg) return weg;
  const url = req.nextUrl.searchParams.get("url") || "";
  if (!driveIdFromUrl(url)) {
    // Geen Google-link: geen fout, gewoon niets te halen. Het veld laat de link
    // dan staan zoals hij is.
    return NextResponse.json({ ok: true, naam: "" });
  }
  const naam = await fileName(url).catch(() => "");
  return NextResponse.json({ ok: true, naam });
}
