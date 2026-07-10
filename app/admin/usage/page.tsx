import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { getUsageSummary, getUsageByAction, getUsageByClientAction, type UsageRow, type UsageActionRow, type UsageClientActionRow } from "../../../lib/usage";
import { getAhrefsSubscriptionUsage } from "../../../lib/ahrefs";

// Leesbare namen voor de acties (welke knop/functie kost hoeveel).
const ACTION_LABEL: Record<string, string> = {
  doc_analyse: "Analyse-document", doc_analyse_diep: "Analyse-document (diep)",
  doc_blauwdruk: "Blauwdruk-document", doc_blauwdruk_diep: "Blauwdruk-document (diep)",
  doc_copy: "Copy-document", copy_koplabels: "Copy-koplabels",
  klantversie: "Klantversie (los)", strategie: "Strategie vastleggen", strategie_grounding: "Strategie (grounding)",
  strategie_uitleg: "Strategie-uitleg", projectchat: "Projectchat", page_chat: "Pagina-chat",
  voorstel: "Plan-voorstel", cluster_advies: "Cluster-advies", kansen: "Zoekwoord-kansen",
  klantprofiel: "Klantprofiel", page_cannibal: "Cannibalisatie", page_cannibal_apply: "Cannibalisatie overnemen",
  cannibal_redirect: "Cannibalisatie (site)", internal_links: "Interne links",
  org_autofill: "Organisatiegegevens invullen", kpi_toelichting: "KPI-toelichting",
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
function dateNl(d: Date): string {
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

// Klein vraagteken met uitleg (verschijnt als je de muis erop houdt).
function Hint({ text }: { text: string }) {
  return (
    <span
      title={text}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 16, height: 16, borderRadius: "50%", background: "#eadfce",
        color: "#8a6a3e", fontSize: 11, fontWeight: 700, cursor: "help",
        marginLeft: 6, verticalAlign: "text-bottom", flex: "0 0 auto",
      }}
    >
      ?
    </span>
  );
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
  // Leesbare omschrijving van de gekozen periode, zodat "deze periode" nooit vaag is.
  const periodText = days ? `${dateNl(from)} t/m vandaag` : "alle metingen sinds de start";

  let rows: UsageRow[] = [];
  let actionRows: UsageActionRow[] = [];
  let clientActionRows: UsageClientActionRow[] = [];
  let loadError = "";
  let ahrefsSub: { used: number | null; limit: number | null } | null = null;
  try {
    [rows, actionRows, clientActionRows, ahrefsSub] = await Promise.all([
      getUsageSummary(from.toISOString()),
      getUsageByAction(from.toISOString()),
      getUsageByClientAction(from.toISOString()),
      getAhrefsSubscriptionUsage(),
    ]);
  } catch (e) {
    loadError = (e as Error).message;
  }

  // Uitsplitsing per klant: welke functies veroorzaken het bedrag. Gegroepeerd op
  // klant-slug (null = "Algemeen"), binnen een klant gesorteerd op kosten aflopend.
  const actionsByClient = new Map<string, UsageClientActionRow[]>();
  for (const r of clientActionRows) {
    const k = r.client_slug || "";
    const list = actionsByClient.get(k) || [];
    list.push(r);
    actionsByClient.set(k, list);
  }

  const totalCost = rows.reduce((s, r) => s + (r.cost_usd || 0), 0);
  const totalCalls = rows.reduce((s, r) => s + (r.calls || 0), 0);

  // Optelling per dienst (voor de bovenste tegels), incl. units voor Ahrefs.
  const byService = new Map<string, { calls: number; cost: number; units: number }>();
  for (const r of rows) {
    const cur = byService.get(r.service) || { calls: 0, cost: 0, units: 0 };
    cur.calls += r.calls || 0;
    cur.cost += r.cost_usd || 0;
    if (r.service === "ahrefs") cur.units += r.tokens_in || 0;
    byService.set(r.service, cur);
  }
  const ahrefsTotals = byService.get("ahrefs");

  const wrap: React.CSSProperties = { maxWidth: 1320, margin: "0 auto", padding: "26px 24px 60px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1f2937" };
  const card: React.CSSProperties = { border: "1px solid #eadfce", borderRadius: 12, background: "#fff", padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
  // Let op: de globale stylesheet geeft thead th een donkere achtergrond; de
  // koptekst moet dus wit zijn. Nooit laten omvallen: nowrap op koppen en cijfers.
  const th: React.CSSProperties = { textAlign: "left", padding: "8px 12px", fontSize: 12, color: "#fff", fontWeight: 700, whiteSpace: "nowrap" };
  const thNum: React.CSSProperties = { ...th, textAlign: "right" };
  const td: React.CSSProperties = { padding: "8px 12px", borderBottom: "1px solid #f1e9db", fontSize: 13.5 };
  const tdNowrap: React.CSSProperties = { ...td, whiteSpace: "nowrap" };
  const numTd: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const tileLabel: React.CSSProperties = { fontSize: 11.5, color: "#8a6a3e", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, display: "flex", alignItems: "center" };
  const blockTitle: React.CSSProperties = { fontSize: 16, fontWeight: 700, color: "#33302e", margin: 0, display: "flex", alignItems: "center" };
  const blockSub: React.CSSProperties = { fontSize: 13, color: "#5b6472", margin: "4px 0 14px", lineHeight: 1.5 };

  return (
    <div style={wrap}>
      {/* Titel, periode-keuze en terug-link op één rij. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
          <h1 style={{ fontSize: 22, margin: 0, color: "#d97316" }}>Verbruik</h1>
          <div style={{ display: "flex", gap: 6 }}>
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/admin/usage?period=${p.key}`}
                style={{
                  padding: "5px 13px", borderRadius: 999, fontSize: 13, textDecoration: "none",
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
      <p style={{ color: "#5b6472", maxWidth: 900, lineHeight: 1.5, margin: "0 0 22px", fontSize: 13.5 }}>
        Wat het dashboard verbruikt aan betaalde diensten in de gekozen periode ({periodText}).
        <strong> Claude</strong> is de AI (chats, documenten, analyses) en kost geld per gebruik;
        <strong> Ahrefs</strong> levert de zoekwoord-data en verbruikt units binnen het vaste abonnement.
      </p>

      {loadError ? (
        <div style={{ ...card, borderColor: "#f0c8c8", background: "#fdf4f4", color: "#a13d3d" }}>
          Kon het verbruik niet laden: {loadError}
        </div>
      ) : (
        <>
          {/* Bovenaan: de totalen in één rij tegels */}
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 22 }}>
            <div style={{ ...card, minWidth: 230, padding: "14px 20px" }}>
              <div style={tileLabel}>
                Totale kosten
                <Hint text={`De opgetelde Claude-kosten over de gekozen periode: ${periodText}. Ahrefs telt hier niet mee, want dat valt binnen het vaste abonnement.`} />
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "#d97316", lineHeight: 1.35 }}>{euros(totalCost)}</div>
              <div style={{ fontSize: 12.5, color: "#5b6472" }}>{periodText} &middot; {num(totalCalls)} aanroepen</div>
            </div>
            {[...byService.entries()].filter(([svc]) => svc !== "ahrefs").map(([svc, v]) => (
              <div key={svc} style={{ ...card, minWidth: 200, padding: "14px 20px" }}>
                <div style={tileLabel}>
                  {SERVICE_LABEL[svc] || svc}
                  {svc === "anthropic" && <Hint text="Alles wat de AI in het dashboard doet: chats, documenten, analyses. Gemeten in tokens (stukjes tekst); de kosten zijn echte dollars op basis van de tokenprijs." />}
                </div>
                <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35 }}>{euros(v.cost)}</div>
                <div style={{ fontSize: 12.5, color: "#5b6472" }}>{num(v.calls)} aanroepen</div>
              </div>
            ))}
            <div style={{ ...card, minWidth: 260, padding: "14px 20px" }}>
              <div style={tileLabel}>
                Ahrefs
                <Hint text="Zoekwoord-data. Gemeten in units (Ahrefs' eigen tegoed-eenheid) en aanroepen. Er staat geen bedrag bij: het verbruik valt binnen het vaste Ahrefs-abonnement. Herhaalvragen komen uit de cache en verbruiken niets." />
              </div>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35 }}>
                {ahrefsTotals ? `${num(ahrefsTotals.units)} units` : "geen verbruik"}
              </div>
              <div style={{ fontSize: 12.5, color: "#5b6472" }}>
                {ahrefsTotals ? `${num(ahrefsTotals.calls)} aanroepen in deze periode` : "in deze periode"}
              </div>
              {ahrefsSub && ahrefsSub.used !== null && (
                <div style={{ fontSize: 12.5, color: "#5b6472", marginTop: 6, borderTop: "1px solid #f1e9db", paddingTop: 6, display: "flex", alignItems: "center" }}>
                  Abonnement: {num(ahrefsSub.used)}{ahrefsSub.limit !== null ? ` van ${num(ahrefsSub.limit)}` : ""} units gebruikt
                  <Hint text="Rechtstreeks bij Ahrefs opgevraagd: het totale unit-verbruik van je Ahrefs-account in de huidige abonnementsmaand (alles meegeteld, ook gebruik buiten dit dashboard om)." />
                </div>
              )}
            </div>
          </div>

          {/* Daaronder de twee overzichten naast elkaar: links per klant, rechts per functie. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: 18, alignItems: "start" }}>
            {/* Blok 1: per klant. Claude-regels zijn uitklapbaar (details/summary,
                werkt zonder JavaScript): open = de functies waar het bedrag uit
                bestaat. Ahrefs-regels blijven gewone regels. */}
            <div style={card} className="usage-cl">
              <style>{`
                .usage-cl summary { list-style: none; cursor: pointer; }
                .usage-cl summary::-webkit-details-marker { display: none; }
                .usage-cl details[open] .usage-car { transform: rotate(90deg); }
                .usage-cl summary:hover { background: #fdf6ec; }
              `}</style>
              <h2 style={blockTitle}>
                1. Per klant
                <Hint text="Elke regel is één klant + één dienst. Klik op een Claude-regel om te zien welke functies het bedrag veroorzaken. Een klant die zowel de AI als Ahrefs gebruikt, staat er twee keer: één regel voor Claude en één voor Ahrefs." />
              </h2>
              <p style={blockSub}>Wat elke klant deze periode heeft verbruikt, per dienst. Klik op een Claude-regel voor de uitsplitsing per functie.</p>
              {rows.length === 0 ? (
                <div style={{ color: "#5b6472", padding: "8px 4px", fontSize: 13.5 }}>
                  Nog geen verbruik in deze periode.
                </div>
              ) : (() => {
                // Kolommen van de "tabel" (nu een grid, zodat een regel kan uitklappen).
                const cols = "minmax(150px, 1.5fr) 100px 90px 150px 100px";
                const rowGrid: React.CSSProperties = { display: "grid", gridTemplateColumns: cols, alignItems: "center" };
                const cName = (r: UsageRow) => r.client_name || r.client_slug || "";
                return (
                  <div>
                    {/* Kopregel in dezelfde stijl als de tabelkoppen elders. */}
                    <div style={{ ...rowGrid, background: "var(--dark, #33302e)", borderRadius: "8px 8px 0 0" }}>
                      <div style={th}>Klant</div>
                      <div style={th}>Dienst</div>
                      <div style={thNum}>Aanroepen</div>
                      <div style={thNum}>Verbruik</div>
                      <div style={thNum}>Kosten</div>
                    </div>
                    {rows.map((r, i) => {
                      const nameCell = cName(r) || (
                        <span style={{ color: "#5b6472", display: "inline-flex", alignItems: "center" }}>
                          Algemeen (geen klant)
                          <Hint text="Verbruik dat niet aan één klant te koppelen was, bijvoorbeeld algemene functies of oudere metingen van voordat de klant-koppeling bestond. Nieuw verbruik krijgt vrijwel altijd gewoon de klantnaam." />
                        </span>
                      );
                      const cells = (
                        <>
                          <div style={tdNowrap}>{SERVICE_LABEL[r.service] || r.service}</div>
                          <div style={numTd}>{num(r.calls)}</div>
                          {/* Claude: tokens in+uit samengevat; Ahrefs: units. */}
                          <div style={numTd}>{r.service === "ahrefs" ? `${num(r.tokens_in)} units` : `${num(r.tokens_in + r.tokens_out)} tokens`}</div>
                          <div style={{ ...numTd, fontWeight: 600 }}>{r.service === "ahrefs" ? "—" : euros(r.cost_usd)}</div>
                        </>
                      );
                      // Ahrefs (of Claude zonder uitsplitsing): gewone regel.
                      const breakdown = r.service === "anthropic" ? (actionsByClient.get(r.client_slug || "") || []) : [];
                      if (breakdown.length === 0) {
                        return (
                          <div key={i} style={rowGrid}>
                            <div style={{ ...td, paddingLeft: 26 }}>{nameCell}</div>
                            {cells}
                          </div>
                        );
                      }
                      return (
                        <details key={i}>
                          <summary style={rowGrid}>
                            <div style={{ ...td, display: "flex", alignItems: "center", gap: 8 }}>
                              <span className="usage-car" style={{ display: "inline-block", transition: "transform 0.15s", color: "#d97316", fontSize: 11, flex: "0 0 auto" }}>&#9654;</span>
                              {nameCell}
                            </div>
                            {cells}
                          </summary>
                          {/* Uitsplitsing: welke functies veroorzaken dit bedrag. */}
                          <div style={{ background: "#fbf7f0", borderBottom: "1px solid #f1e9db", padding: "4px 0 8px" }}>
                            {breakdown.map((b, j) => (
                              <div key={j} style={rowGrid}>
                                <div style={{ ...td, borderBottom: "none", paddingLeft: 34, color: "#5b6472" }}>{b.action ? (ACTION_LABEL[b.action] || b.action) : "onbekend"}</div>
                                <div style={{ ...tdNowrap, borderBottom: "none" }} />
                                <div style={{ ...numTd, borderBottom: "none" }}>{num(b.calls)}</div>
                                <div style={{ ...numTd, borderBottom: "none" }}>{num(b.tokens_in + b.tokens_out)} tokens</div>
                                <div style={{ ...numTd, borderBottom: "none" }}>{euros(b.cost_usd)}</div>
                              </div>
                            ))}
                          </div>
                        </details>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            {/* Blok 2: per functie (alleen Claude; Ahrefs heeft geen kosten per functie) */}
            <div style={card}>
              <h2 style={blockTitle}>
                2. Per functie (alleen Claude)
                <Hint text="Dit zijn dezelfde Claude-kosten als in blok 1, maar anders gegroepeerd: per knop of functie in plaats van per klant. De totalen van beide blokken zijn dus gelijk." />
              </h2>
              <p style={blockSub}>Welke knop of functie in het dashboard kost het geld.</p>
              {actionRows.length === 0 ? (
                <div style={{ color: "#5b6472", padding: "8px 4px", fontSize: 13.5 }}>
                  Nog geen Claude-verbruik in deze periode.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={th}>Functie</th>
                      <th style={thNum}>Aanroepen</th>
                      <th style={thNum}>Tokens</th>
                      <th style={thNum}>Kosten</th>
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
