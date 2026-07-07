import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ADMIN_COOKIE, verifyAdminSession } from "../../../lib/admin-auth";
import { getUsageSummary, getUsageByAction, type UsageRow, type UsageActionRow } from "../../../lib/usage";

// Leesbare namen voor de acties (welke knop/functie kost hoeveel).
const ACTION_LABEL: Record<string, string> = {
  doc_analyse: "Analyse-document", doc_blauwdruk: "Blauwdruk-document", doc_copy: "Copy-document",
  klantversie: "Klantversie (los)", strategie: "Strategie vastleggen", strategie_grounding: "Strategie (grounding)",
  strategie_uitleg: "Strategie-uitleg", projectchat: "Projectchat", page_chat: "Pagina-chat",
  voorstel: "Plan-voorstel", cluster_advies: "Cluster-advies", kansen: "Zoekwoord-kansen",
  klantprofiel: "Klantprofiel", page_cannibal: "Cannibalisatie", page_cannibal_apply: "Cannibalisatie overnemen",
  cannibal_redirect: "Cannibalisatie (site)", internal_links: "Interne links",
};

export const dynamic = "force-dynamic";

type Period = "week" | "month" | "all";

const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: "week", label: "Laatste 7 dagen", days: 7 },
  { key: "month", label: "Laatste 30 dagen", days: 30 },
  { key: "all", label: "Alles", days: null },
];

const SERVICE_LABEL: Record<string, string> = {
  anthropic: "Claude (AI)",
  ahrefs: "Ahrefs",
  google: "Google",
};

function euros(n: number): string {
  // Verbruik wordt in USD berekend (tokenprijs is in USD). Toon met genoeg cijfers
  // voor kleine bedragen zodat een enkele chat niet als "$0,00" wegvalt.
  return "$ " + n.toFixed(n < 1 ? 4 : 2);
}
function num(n: number): string {
  return n.toLocaleString("nl-NL");
}

export default async function UsagePage({ searchParams }: { searchParams: { period?: string } }) {
  if (!verifyAdminSession(cookies().get(ADMIN_COOKIE)?.value)) redirect("/admin/login");

  const period: Period = searchParams.period === "week" ? "week" : searchParams.period === "all" ? "all" : "month";
  const days = PERIODS.find((p) => p.key === period)!.days;
  const from = new Date();
  if (days) from.setDate(from.getDate() - days);
  else from.setFullYear(2000);

  let rows: UsageRow[] = [];
  let actionRows: UsageActionRow[] = [];
  let loadError = "";
  try {
    rows = await getUsageSummary(from.toISOString());
    actionRows = await getUsageByAction(from.toISOString());
  } catch (e) {
    loadError = (e as Error).message;
  }

  const totalCost = rows.reduce((s, r) => s + (r.cost_usd || 0), 0);
  const totalCalls = rows.reduce((s, r) => s + (r.calls || 0), 0);

  // Optelling per dienst (voor de bovenste samenvatting).
  const byService = new Map<string, { calls: number; cost: number }>();
  for (const r of rows) {
    const cur = byService.get(r.service) || { calls: 0, cost: 0 };
    cur.calls += r.calls || 0;
    cur.cost += r.cost_usd || 0;
    byService.set(r.service, cur);
  }

  const wrap: React.CSSProperties = { maxWidth: 980, margin: "0 auto", padding: "28px 20px 60px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1f2937" };
  const card: React.CSSProperties = { border: "1px solid #eadfce", borderRadius: 12, background: "#fff", padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #eadfce", fontSize: 13, color: "#8a6a3e", fontWeight: 600 };
  const td: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #f1e9db", fontSize: 14 };
  const numTd: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, margin: 0, color: "#d97316" }}>Verbruik</h1>
        <Link href="/admin" style={{ color: "#8a6a3e", fontSize: 14, textDecoration: "none" }}>&larr; Terug naar overzicht</Link>
      </div>
      <p style={{ color: "#5b6472", maxWidth: 620, lineHeight: 1.5, marginTop: 8 }}>
        Wat er wordt uitgegeven aan betaalde diensten, per klant en per periode. Nu gemeten:
        het Claude-verbruik van dit dashboard (echte tokens per chat). Ahrefs-credits en de
        totalen rechtstreeks bij de aanbieders volgen in een volgende stap.
      </p>

      {/* Periode-schakelaar */}
      <div style={{ display: "flex", gap: 8, margin: "14px 0 20px" }}>
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/admin/usage?period=${p.key}`}
            style={{
              padding: "6px 14px", borderRadius: 999, fontSize: 14, textDecoration: "none",
              border: "1px solid " + (p.key === period ? "#d97316" : "#eadfce"),
              background: p.key === period ? "#d97316" : "#fff",
              color: p.key === period ? "#fff" : "#5b6472",
            }}
          >
            {p.label}
          </Link>
        ))}
      </div>

      {loadError ? (
        <div style={{ ...card, borderColor: "#f0c8c8", background: "#fdf4f4", color: "#a13d3d" }}>
          Kon het verbruik niet laden: {loadError}
        </div>
      ) : (
        <>
          {/* Samenvatting */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ ...card, minWidth: 160 }}>
              <div style={{ fontSize: 12, color: "#8a6a3e" }}>Totaal deze periode</div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#d97316" }}>{euros(totalCost)}</div>
              <div style={{ fontSize: 12, color: "#8a6a3e" }}>{num(totalCalls)} aanroepen</div>
            </div>
            {[...byService.entries()].map(([svc, v]) => (
              <div key={svc} style={{ ...card, minWidth: 150 }}>
                <div style={{ fontSize: 12, color: "#8a6a3e" }}>{SERVICE_LABEL[svc] || svc}</div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>{euros(v.cost)}</div>
                <div style={{ fontSize: 12, color: "#8a6a3e" }}>{num(v.calls)} aanroepen</div>
              </div>
            ))}
          </div>

          {/* Uitsplitsing per actie: welke functie/knop kost hoeveel */}
          {actionRows.length > 0 && (
            <div style={{ ...card, marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: "#8a6a3e" }}>Per actie (Claude): waar gaat het naartoe?</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Actie</th>
                    <th style={{ ...th, textAlign: "right" }}>Aanroepen</th>
                    <th style={{ ...th, textAlign: "right" }}>Tokens in</th>
                    <th style={{ ...th, textAlign: "right" }}>Tokens uit</th>
                    <th style={{ ...th, textAlign: "right" }}>Kosten</th>
                  </tr>
                </thead>
                <tbody>
                  {actionRows.map((r, i) => (
                    <tr key={i}>
                      <td style={td}>{r.action ? (ACTION_LABEL[r.action] || r.action) : "onbekend"}</td>
                      <td style={numTd}>{num(r.calls)}</td>
                      <td style={numTd}>{num(r.tokens_in)}</td>
                      <td style={numTd}>{num(r.tokens_out)}</td>
                      <td style={numTd}>{euros(r.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detailtabel per klant en dienst */}
          <div style={card}>
            {rows.length === 0 ? (
              <div style={{ color: "#5b6472", padding: "8px 4px" }}>
                Nog geen verbruik in deze periode. Zodra je de pagina-chat gebruikt, verschijnt het hier.
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={th}>Klant</th>
                    <th style={th}>Dienst</th>
                    <th style={{ ...th, textAlign: "right" }}>Aanroepen</th>
                    <th style={{ ...th, textAlign: "right" }}>Tokens in</th>
                    <th style={{ ...th, textAlign: "right" }}>Tokens uit</th>
                    <th style={{ ...th, textAlign: "right" }}>Kosten</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td style={td}>{r.client_name || r.client_slug || "(onbekend)"}</td>
                      <td style={td}>{SERVICE_LABEL[r.service] || r.service}</td>
                      <td style={numTd}>{num(r.calls)}</td>
                      <td style={numTd}>{num(r.tokens_in)}</td>
                      <td style={numTd}>{num(r.tokens_out)}</td>
                      <td style={{ ...numTd, fontWeight: 600 }}>{euros(r.cost_usd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
