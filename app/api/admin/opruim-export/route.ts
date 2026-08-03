import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../../lib/admin-auth";
import { guardSlug } from "../../../../lib/admin-scope";
import { getClientBySlug } from "../../../../lib/clients";
import { getCannibalAnalysis } from "../../../../lib/cannibal-redirect";
import { getOpruimRegels } from "../../../../lib/opruim-regels";

export const runtime = "nodejs";

// De werklijst als CSV: dubbelklikken opent hem in Excel, of importeren in Google
// Sheets. Maartens Excel is de norm voor een werklijst (platte rijen, duidelijke
// van/naar-kolommen, geen proza vooraf), dus dat is precies wat hier uit komt.

function veld(v: unknown): string {
  const s = v == null ? "" : String(v);
  // Puntkomma als scheidingsteken: dat opent in Nederlandse Excel meteen in kolommen.
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(req: NextRequest) {
  if (!verifyAdminSession(req.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.json({ ok: false, error: "Geen toegang." }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug") || "";
  if (!slug) return NextResponse.json({ ok: false, error: "Geen klant opgegeven." }, { status: 400 });
  const g = await guardSlug(req, slug); if (!g.ok) return g.res;

  const [st, client, regels] = await Promise.all([
    getCannibalAnalysis(slug),
    getClientBySlug(slug),
    getOpruimRegels(slug).catch(() => []),
  ]);
  const rijen = st.result?.redirectMap || [];
  if (!rijen.length) return NextResponse.json({ ok: false, error: "Er is nog geen werklijst. Draai eerst de analyse." }, { status: 400 });

  const domein = (client?.domain || "").replace(/\/+$/, "");
  const vol = (p: string) => (!p ? "" : p.startsWith("http") ? p : `https://${domein.replace(/^https?:\/\//, "")}${p.startsWith("/") ? "" : "/"}${p}`);
  // Besluiten die Maarten al nam, zodat hij in Excel ziet wat hij eerder vond.
  const besluit = new Map(regels.map((r) => [r.van, r]));

  const kop = ["Van (pad)", "Naar (pad)", "Van (volledige URL)", "Naar (volledige URL)", "Type", "Actie", "Content samenvoegen", "Reden", "Eerder besluit", "Status"];
  const lijnen = [kop.map(veld).join(";")];
  for (const m of rijen) {
    const b = besluit.get(m.van);
    lijnen.push([
      m.van, m.naar, vol(m.van), vol(m.naar),
      m.type || "301",
      m.verhuizen ? "verhuizen (content naar de nieuwe URL)" : "omleiden",
      m.mergeContent ? "ja" : "nee",
      m.reden || "",
      b ? (b.besluit === "houden" ? "houden: niet omleiden" : b.besluit === "genegeerd" ? "genegeerd" : b.naar ? `ander doel gekozen: ${b.naar}` : "") : "",
      b?.doorgevoerd ? "doorgevoerd" : "nog te doen",
    ].map(veld).join(";"));
  }

  const datum = (st.result?.generatedAt || new Date().toISOString()).slice(0, 10);
  const naam = `opruimlijst-${slug}-${datum}.csv`;
  // BOM vooraan, anders maakt Excel er "Ã«" van bij accenten in de reden-kolom.
  return new NextResponse("﻿" + lijnen.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${naam}"`,
      "Cache-Control": "no-store",
    },
  });
}
