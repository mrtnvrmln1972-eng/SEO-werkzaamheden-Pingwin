import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
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
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  // AI-verbruik (kosten) is uitsluitend voor de eigenaar.
  if (!scope.isOwner) redirect("/admin");

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

  const wrap: React.CSSProperties = { maxWidth: 1200, margin: "0 auto", padding: "22px 20px 50px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1f2937" };
  const card: React.CSSProperties = { border: "1px solid #eadfce", borderRadius: 12, background: "#fff", padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
  // Let op: de globale stylesheet geeft thead th een donkere achtergrond; de
  // koptekst moet dus wit zijn (bruin op donker is onleesbaar).
  const th: React.CSSProperties = { textAlign: "left", padding: "7px 10px", fontSize: 12, color: "#fff", fontWeight: 700 };
  const td: React.CSSProperties = { padding: "7px 10px", borderBottom: "1px solid #f1e9db", fontSize: 13.5 };
  const numTd: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const blockTitle: React.CSSProperties = { fontSize: 15, fontWeight: 700, color: "#33302e", margin: 0 };
  const blockSub: React.CSSProperties = { fontSize: 12.5, color: "#5b6472", margin: "2px 0 10px", lineHeight: 1.45 };

  return (
    <div style={wrap}>
      {/* Titel, periode-keuze en terug-link op één rij: geen scrollen voor de basis. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, margin: 0, color: "#d97316" }}>Verbruik</h1>
          <div style={{ display: "flex", gap: 6 }}>
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/admin/usage?period=${p.key}`}
                style={{
                  padding: "4px 12px", borderRadius: 999, fontSize: 13, textDecoration: "none",
                  border: "1px solid " + (p.key === period ? "#d97316" : "#eadfce"),
                  background: p.key === period ? "#d97316" : "#fff",
                  color: p.key === period ? "#fff" : "#5b6472",
                }}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
        <Link href="/admin" style={{ color: "#8a6a3e", fontSize: 14, textDecoration: "none" }}>&larr; Terug naar overzicht</Link>
      </div>
      <p style={{ color: "#5b6472", maxWidth: 860, lineHeight: 1.45, margin: "0 0 14px", fontSize: 13 }}>
        Wat het dashboard verbruikt aan betaalde diensten. <strong>Claude</strong> = de AI (chats, documenten, analyses),
        gemeten in tokens met echte kosten. <strong>Ahrefs</strong> = zoekwoord-data, gemeten in aanroepen en units,
        zonder bedrag (valt binnen het Ahrefs-abonnement; herhaalvragen komen uit de cache en kosten niets).
      </p>

      {loadError ? (
        <div style={{ ...card, borderColor: "#f0c8c8", background: "#fdf4f4", color: "#a13d3d" }}>
          Kon het verbruik niet laden: {loadError}
        </div>
      ) : (
        <>
          {/* Bovenaan: de totalen in één rij tegels */}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 14 }}>
            <div style={{ ...card, minWidth: 170, padding: "10px 16px" }}>
              <div style={{ fontSize: 11.5, color: "#8a6a3e", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>Totale kosten deze periode</div>
              <div style={{ fontSize: 24, fontWeight: 700, color: "#d97316", lineHeight: 1.3 }}>{euros(totalCost)}</div>
              <div style={{ fontSize: 12, color: "#5b6472" }}>{num(totalCalls)} aanroepen in totaal</div>
            </div>
            {[...byService.entries()].map(([svc, v]) => (
              <div key={svc} style={{ ...card, minWidth: 150, padding: "10px 16px" }}>
                <div style={{ fontSize: 11.5, color: "#8a6a3e", fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.4 }}>{SERVICE_LABEL[svc] || svc}</div>
                <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>{svc === "ahrefs" ? "geen kosten" : euros(v.cost)}</div>
                <div style={{ fontSize: 12, color: "#5b6472" }}>{num(v.calls)} aanroepen{svc === "ahrefs" ? " (binnen abonnement)" : ""}</div>
              </div>
            ))}
          </div>

          {/* Daaronder de twee overzichten naast elkaar: links per klant, rechts per functie. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(430px, 1fr))", gap: 14, alignItems: "start" }}>
            {/* Blok 1: per klant */}
            <div style={card}>
              <h2 style={blockTitle}>1. Per klant</h2>
              <p style={blockSub}>Wat elke klant deze periode heeft verbruikt, uitgesplitst per dienst (Claude en Ahrefs apart).</p>
              {rows.length === 0 ? (
                <div style={{ color: "#5b6472", padding: "8px 4px", fontSize: 13.5 }}>
                  Nog geen verbruik in deze periode.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Klant</th>
                      <th style={th}>Dienst</th>
                      <th style={{ ...th, textAlign: "right" }}>Aanroepen</th>
                      <th style={{ ...th, textAlign: "right" }}>Verbruik</th>
                      <th style={{ ...th, textAlign: "right" }}>Kosten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i}>
                        <td style={td}>{r.client_name || r.client_slug || "(onbekend)"}</td>
                        <td style={td}>{SERVICE_LABEL[r.service] || r.service}</td>
                        <td style={numTd}>{num(r.calls)}</td>
                        {/* Claude: tokens in+uit samengevat; Ahrefs: units. */}
                        <td style={numTd}>{r.service === "ahrefs" ? `${num(r.tokens_in)} units` : `${num(r.tokens_in + r.tokens_out)} tokens`}</td>
                        <td style={{ ...numTd, fontWeight: 600 }}>{r.service === "ahrefs" ? "—" : euros(r.cost_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Blok 2: per functie (alleen Claude; Ahrefs heeft geen kosten per functie) */}
            <div style={card}>
              <h2 style={blockTitle}>2. Per functie (alleen Claude)</h2>
              <p style={blockSub}>Dezelfde Claude-kosten als hiernaast, maar dan per knop of functie in het dashboard: zo zie je wélke functie het geld kost.</p>
              {actionRows.length === 0 ? (
                <div style={{ color: "#5b6472", padding: "8px 4px", fontSize: 13.5 }}>
                  Nog geen Claude-verbruik in deze periode.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Functie</th>
                      <th style={{ ...th, textAlign: "right" }}>Aanroepen</th>
                      <th style={{ ...th, textAlign: "right" }}>Tokens</th>
                      <th style={{ ...th, textAlign: "right" }}>Kosten</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionRows.map((r, i) => (
                      <tr key={i}>
                        <td style={td}>{r.action ? (ACTION_LABEL[r.action] || r.action) : "onbekend"}</td>
                        <td style={numTd}>{num(r.calls)}</td>
                        <td style={numTd}>{num(r.tokens_in + r.tokens_out)}</td>
                        <td style={{ ...numTd, fontWeight: 600 }}>{euros(r.cost_usd)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
