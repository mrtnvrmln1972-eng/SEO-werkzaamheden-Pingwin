import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { buildItemsFromRows, computeLiveFlags } from "../../../../lib/analysis-import";

export const runtime = "nodejs";
export const maxDuration = 120;

function admin(req: NextRequest): boolean {
  return verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value);
}

// Leest een geüpload xlsx/csv-bestand, kiest een tabblad en geeft de
// voorstellen (plan + taak + live-vlag) per rij terug. Slaat nog niks op.
export async function POST(req: NextRequest) {
  if (!admin(req)) return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ ok: false, error: "Geen bestand ontvangen." }, { status: 400 });

  const slug = String(form.get("slug") || "").trim();
  const cluster = String(form.get("cluster") || "").trim();
  const wantedSheet = String(form.get("sheet") || "").trim();
  const file = form.get("file");
  if (!slug || !(file instanceof File)) return NextResponse.json({ ok: false, error: "Klant en bestand zijn verplicht." }, { status: 400 });

  let wb: XLSX.WorkBook;
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    wb = XLSX.read(buf, { type: "buffer" });
  } catch {
    return NextResponse.json({ ok: false, error: "Kon het bestand niet lezen (xlsx of csv verwacht)." }, { status: 400 });
  }

  const sheets = wb.SheetNames;
  // Kies het tabblad: gevraagd, anders het tabblad met een 'actie'-kolom, anders het eerste.
  let picked = wantedSheet && sheets.includes(wantedSheet) ? wantedSheet : "";
  if (!picked) {
    picked = sheets.find((n) => {
      const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[n], { header: 1, defval: "" });
      const headers = (rows[0] || []).map((h) => String(h).toLowerCase());
      return headers.some((h) => h.includes("actie"));
    }) || sheets[0];
  }

  const rows = XLSX.utils.sheet_to_json<string[]>(wb.Sheets[picked], { header: 1, defval: "" }).map((r) => (r as unknown[]).map((c) => String(c ?? "")));
  const items = await computeLiveFlags(slug, buildItemsFromRows(rows, cluster));

  return NextResponse.json({ ok: true, sheets, picked, cluster, items });
}
