import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { getUsageSummary, getUsageByAction, getUsageByClientAction, getClaudeKosten, getAhrefsEigenVerbruik, getVerbruikPerKlantPerMaand, ahrefsPrijsPerUnit, type UsageRow, type UsageActionRow, type UsageClientActionRow } from "../../../lib/usage";
import { getAhrefsSubscriptionUsage } from "../../../lib/ahrefs";
import { tellerStand } from "../../../lib/ahrefs-teller";
import { listClients } from "../../../lib/clients";
import AdminKop from "../AdminKop";
import Meters from "./Meters";
import { claudeStand, budgetUitEnv } from "../../../lib/claude-teller";
// Leesbare namen voor de acties: één lijst, gedeeld met de Claude-teller in de kopbalk.
import { ACTION_LABEL, actieLabelMetDienst } from "../../../lib/usage-labels";


export const dynamic = "force-dynamic";

type Period = "day" | "week" | "month" | "all";

const PERIODS: { key: Period; label: string; days: number | null }[] = [
  { key: "day", label: "Vandaag", days: 0 },
  { key: "week", label: "Laatste 7 dagen", days: 7 },
  { key: "month", label: "Laatste 30 dagen", days: 30 },
  { key: "all", label: "Alles", days: null },
];

// Middernacht Nederlandse tijd, omgerekend naar servertijd (Vercel draait op UTC).
// Zo betekent "Vandaag" echt: sinds 00:00 bij Maarten op de klok.
function nlMidnight(): Date {
  const now = new Date();
  const nlClock = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Amsterdam" }));
  const offsetMs = nlClock.getTime() - now.getTime();
  nlClock.setHours(0, 0, 0, 0);
  return new Date(nlClock.getTime() - offsetMs);
}

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
        width: 16, height: 16, borderRadius: "50%", background: "var(--kleur-rand-zacht)",
        color: "var(--label-muted)", fontSize: "var(--fs-xs)", fontWeight: 700, cursor: "help",
        marginLeft: "var(--s-1)", verticalAlign: "text-bottom", flex: "0 0 auto",
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

  const period: Period = searchParams.period === "day" ? "day" : searchParams.period === "week" ? "week" : searchParams.period === "all" ? "all" : "month";
  const days = PERIODS.find((p) => p.key === period)!.days;
  let from = new Date();
  if (period === "day") from = nlMidnight();
  else if (days) from.setDate(from.getDate() - days);
  else from.setFullYear(2000);
  // Leesbare omschrijving van de gekozen periode, zodat "deze periode" nooit vaag is.
  const periodText = period === "day" ? "vandaag, sinds middernacht" : days ? `${dateNl(from)} t/m vandaag` : "alle metingen sinds de start";

  let rows: UsageRow[] = [];
  let actionRows: UsageActionRow[] = [];
  let clientActionRows: UsageClientActionRow[] = [];
  let loadError = "";
  let ahrefsSub: Awaited<ReturnType<typeof getAhrefsSubscriptionUsage>> = null;
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

  // Dezelfde rekenregel als het tellertje in de kopbalk: hoe ver de teller staat
  // tegenover hoe ver de abonnementsmaand is. Eén bron, dus de kopbalk en dit
  // scherm kunnen nooit een ander verhaal vertellen.
  const ahrefsTeller = tellerStand(ahrefsSub);

  // De drie meters bovenaan staan LOS van de periode-keuze eronder: een tegoed en
  // een maandrekening lopen per maand, niet per gekozen venster. Anders zou
  // "Vandaag" aanzetten de indruk wekken dat het tegoed net is bijgevuld.
  const maandStart = new Date();
  maandStart.setDate(1); maandStart.setHours(0, 0, 0, 0);
  const vorigeStart = new Date(maandStart); vorigeStart.setMonth(vorigeStart.getMonth() - 1);
  const [claudeMaand, claudeVorige, ahrefsEigen, verbruikPerKlant, clients] = await Promise.all([
    getClaudeKosten(maandStart.toISOString()).catch(() => null),
    getClaudeKosten(vorigeStart.toISOString(), maandStart.toISOString()).catch(() => null),
    getAhrefsEigenVerbruik(maandStart.toISOString()).catch(() => null),
    getVerbruikPerKlantPerMaand(maandStart.toISOString()).catch(() => []),
    listClients().catch(() => []),
  ]);
  // Prijs per Ahrefs-unit: pas ingesteld (zie lib/usage.ts), dus pas dan heeft de
  // marge per klant echt de Ahrefs-kosten erbij. Zonder prijs blijven Ahrefs-
  // bedragen 0, en dat mag dit scherm niet verbergen alsof het al compleet is.
  const ahrefsPrijsIngesteld = ahrefsPrijsPerUnit() !== null;
  const maandbudgetPerSlug = new Map(clients.map((c) => [c.slug, c.budget.maandbudget]));
  const claudeTeller = claudeStand({
    maandUsd: claudeMaand?.usd ?? 0,
    vorigeMaandUsd: claudeVorige ? claudeVorige.usd : null,
    budgetUsd: budgetUitEnv(process.env.CLAUDE_MAANDBUDGET_USD),
  });

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

  const wrap: React.CSSProperties = { maxWidth: 1320, margin: "0 auto", padding: "var(--s-6) var(--s-6) 60px", fontFamily: "var(--letter)", color: "var(--kleur-kop)" };
  const card: React.CSSProperties = { border: "1px solid var(--kleur-rand-zacht)", borderRadius: "var(--r-md)", background: "#fff", padding: "var(--s-5)", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
  // Let op: de globale stylesheet geeft thead th een donkere achtergrond; de
  // koptekst moet dus wit zijn. Nooit laten omvallen: nowrap op koppen en cijfers.
  const th: React.CSSProperties = { textAlign: "left", padding: "var(--s-2) var(--s-3)", fontSize: "var(--fs-sm)", color: "#fff", fontWeight: 700, whiteSpace: "nowrap" };
  const thNum: React.CSSProperties = { ...th, textAlign: "right" };
  const td: React.CSSProperties = { padding: "var(--s-2) var(--s-3)", borderBottom: "1px solid var(--kleur-rand-zacht)", fontSize: "var(--fs-base)" };
  const tdNowrap: React.CSSProperties = { ...td, whiteSpace: "nowrap" };
  const numTd: React.CSSProperties = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" };
  const tileLabel: React.CSSProperties = { fontSize: "var(--fs-xs)", color: "var(--label-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.4, display: "flex", alignItems: "center" };
  const blockTitle: React.CSSProperties = { fontSize: "var(--fs-md)", fontWeight: 700, color: "var(--kleur-kop)", margin: 0, display: "flex", alignItems: "center" };
  const blockSub: React.CSSProperties = { fontSize: "var(--fs-sm)", color: "var(--text-secondary)", margin: "var(--s-1) 0 var(--s-3)", lineHeight: 1.5 };

  return (
    <>
    {/* Zonder kopbalk zat je op dit scherm vast aan één terug-linkje, en was
        het Intern-menu onbereikbaar. Gevonden door de opmaakproef. */}
    <AdminKop titel="Verbruik" />
    <div style={wrap}>
      {/* Titel, periode-keuze en terug-link op één rij. */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s-3)", flexWrap: "wrap", marginBottom: "var(--s-3)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-4)", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "var(--fs-lg)", margin: "var(--s-0)", color: "var(--accent-warm)" }}>Verbruik</h1>
          <div style={{ display: "flex", gap: "var(--s-2)" }}>
            {PERIODS.map((p) => (
              <Link
                key={p.key}
                href={`/admin/usage?period=${p.key}`}
                style={{
                  padding: "var(--s-1) var(--s-3)", borderRadius: "var(--r-full)", fontSize: "var(--fs-sm)", textDecoration: "none",
                  border: "1px solid " + (p.key === period ? "var(--accent-warm)" : "var(--kleur-rand-zacht)"),
                  background: p.key === period ? "var(--accent-warm)" : "var(--white)",
                  color: p.key === period ? "var(--white)" : "var(--text-secondary)",
                }}
              >
                {p.label}
              </Link>
            ))}
          </div>
        </div>
        <Link href="/admin" style={{ color: "var(--label-muted)", fontSize: "var(--fs-base)", textDecoration: "none" }}>&larr; Terug naar overzicht</Link>
      </div>
      {/* De drie meters naast elkaar, met de tips. Stond eerst als één alinea
          uitleg boven dit scherm, maar drie rekeningen die alle drie "Claude" of
          "tegoed" heten laten zich niet in één alinea uit elkaar houden. */}
      <Meters ahrefs={ahrefsTeller} claude={claudeTeller} ahrefsEigenMaand={ahrefsEigen ? ahrefsEigen.units : null} />

      <p style={{ color: "var(--text-secondary)", maxWidth: 900, lineHeight: "var(--lh-base)", margin: "0 0 var(--s-6)", fontSize: "var(--fs-base)" }}>
        Hieronder de uitsplitsing van wat het dashboard zelf verbruikte in de gekozen periode ({periodText}).
      </p>

      {loadError ? (
        <div style={{ ...card, borderColor: "#f0c8c8", background: "var(--red-light)", color: "var(--bad-deep)" }}>
          Kon het verbruik niet laden: {loadError}
        </div>
      ) : (
        <>
          {/* Bovenaan: de totalen in één rij tegels */}
          <div style={{ display: "flex", gap: "var(--s-4)", flexWrap: "wrap", marginBottom: "var(--s-6)" }}>
            <div style={{ ...card, minWidth: 230, padding: "var(--s-4) var(--s-5)" }}>
              <div style={tileLabel}>
                Totale kosten
                <Hint text={`De opgetelde kosten over de gekozen periode: ${periodText}. ${ahrefsPrijsIngesteld ? "Claude en Ahrefs samen, tegen de ingestelde prijs per Ahrefs-unit." : "Alleen Claude: voor Ahrefs is nog geen prijs per unit ingesteld, dus dat verbruik telt hier nog met €0 mee."}`} />
              </div>
              <div style={{ fontSize: "var(--fs-xl)", fontWeight: 700, color: "var(--accent-warm)", lineHeight: "var(--lh-xl)" }}>{euros(totalCost)}</div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>{periodText} &middot; {num(totalCalls)} aanroepen</div>
            </div>
            {[...byService.entries()].filter(([svc]) => svc !== "ahrefs").map(([svc, v]) => (
              <div key={svc} style={{ ...card, minWidth: 200, padding: "var(--s-4) var(--s-5)" }}>
                <div style={tileLabel}>
                  {SERVICE_LABEL[svc] || svc}
                  {svc === "anthropic" && <Hint text="Alles wat de AI in het dashboard doet: chats, documenten, analyses. Gemeten in tokens (stukjes tekst); de kosten zijn echte dollars op basis van de tokenprijs." />}
                </div>
                <div style={{ fontSize: "var(--fs-lg)", fontWeight: 700, lineHeight: "var(--lh-lg)" }}>{euros(v.cost)}</div>
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>{num(v.calls)} aanroepen</div>
              </div>
            ))}
            <div style={{ ...card, minWidth: 260, padding: "var(--s-4) var(--s-5)" }}>
              <div style={tileLabel}>
                Ahrefs
                <Hint text={ahrefsPrijsIngesteld
                  ? "Zoekwoord-data. Gemeten in units (Ahrefs' eigen tegoed-eenheid) en aanroepen, met een bedrag op basis van de ingestelde prijs per unit. Dat verdeelt het vaste maandabonnement over het echte verbruik; herhaalvragen komen uit de cache en verbruiken niets."
                  : "Zoekwoord-data. Gemeten in units (Ahrefs' eigen tegoed-eenheid) en aanroepen. Er staat geen bedrag bij: er is nog geen prijs per unit ingesteld (env AHREFS_PRIJS_PER_UNIT_USD). Herhaalvragen komen uit de cache en verbruiken niets."} />
              </div>
              <div style={{ fontSize: "var(--fs-lg)", fontWeight: 700, lineHeight: "var(--lh-lg)" }}>
                {ahrefsTotals ? `${num(ahrefsTotals.units)} units` : "geen verbruik"}
                {ahrefsPrijsIngesteld && ahrefsTotals && ahrefsTotals.cost > 0 && (
                  <span style={{ fontSize: "var(--fs-sm)", fontWeight: 600, color: "var(--text-secondary)" }}> &middot; {euros(ahrefsTotals.cost)}</span>
                )}
              </div>
              <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)" }}>
                {ahrefsTotals ? `${num(ahrefsTotals.calls)} aanroepen in deze periode` : "in deze periode"}
              </div>
              {ahrefsSub && ahrefsSub.used !== null && (
                <div style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)", marginTop: "var(--s-2)", borderTop: "1px solid var(--kleur-rand-zacht)", paddingTop: "var(--s-2)", display: "flex", alignItems: "center", flexWrap: "wrap" }}>
                  Abonnement: {num(ahrefsSub.used)}{ahrefsSub.limit !== null ? ` van ${num(ahrefsSub.limit)}` : ""} units gebruikt
                  {ahrefsTeller.dagenTotReset !== null && (
                    <>&nbsp;&middot;&nbsp;{ahrefsTeller.dagenTotReset === 0 ? "gaat vandaag op nul" : `nog ${ahrefsTeller.dagenTotReset} dagen`}</>
                  )}
                  <Hint text={`Rechtstreeks bij Ahrefs opgevraagd: het totale unit-verbruik van je Ahrefs-account in de huidige abonnementsmaand (alles meegeteld, ook gebruik buiten dit dashboard om). ${ahrefsTeller.oordeel}`} />
                </div>
              )}
            </div>
          </div>

          {/* Het echte totaal per klant: AI en Ahrefs samen, altijd deze kalendermaand
              (los van de periode-keuze hierboven, want een marge is een maandcijfer). */}
          <div style={{ ...card, marginBottom: "var(--s-5)" }}>
            <h2 style={blockTitle}>
              Totaal per klant, deze maand
              <Hint text={`Claude en Ahrefs samen, sinds ${dateNl(maandStart)}. ${ahrefsPrijsIngesteld ? "Ahrefs telt mee tegen de ingestelde prijs per unit." : "Ahrefs telt nog met €0 mee: zet AHREFS_PRIJS_PER_UNIT_USD om de echte marge te zien."} Dit is het cijfer waar een licentieprijs op rust.`} />
            </h2>
            <p style={blockSub}>
              De echte kosten per klant deze maand, met de duurste actie erbij. {!ahrefsPrijsIngesteld && "Nog zonder Ahrefs-bedrag: er is geen prijs per unit ingesteld."}
            </p>
            {verbruikPerKlant.length === 0 ? (
              <div style={{ color: "var(--text-secondary)", padding: "var(--s-2) var(--s-1)", fontSize: "var(--fs-base)" }}>
                Nog geen verbruik deze maand.
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: "var(--dark, var(--kleur-kop))" }}>
                      <th style={th}>Klant</th>
                      <th style={thNum}>AI</th>
                      <th style={thNum}>Ahrefs</th>
                      <th style={thNum}>Totaal</th>
                      <th style={th}>Duurste actie</th>
                      <th style={thNum}>T.o.v. maandbudget</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verbruikPerKlant.map((v, i) => {
                      const budget = v.slug ? maandbudgetPerSlug.get(v.slug) : undefined;
                      return (
                        <tr key={i}>
                          <td style={tdNowrap}>{v.naam || v.slug || "Algemeen (geen klant)"}</td>
                          <td style={numTd}>{euros(v.aiUsd)}</td>
                          <td style={numTd}>{ahrefsPrijsIngesteld ? euros(v.ahrefsUsd) : "—"}</td>
                          <td style={{ ...numTd, fontWeight: 600 }}>{euros(v.totaalUsd)}</td>
                          <td style={td}>
                            {v.duursteActie ? `${actieLabelMetDienst(v.duursteActie.service, v.duursteActie.action)} (${euros(v.duursteActie.usd)})` : "—"}
                          </td>
                          <td style={numTd}>
                            {budget ? (
                              <span title="Ruwe vergelijking: kosten in dollar tegenover maandbudget in euro, zonder wisselkoers.">
                                {Math.round((v.totaalUsd / budget) * 100)}% van {"€"}{num(budget)}
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Daaronder de twee overzichten naast elkaar: links per klant, rechts per functie. */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(480px, 1fr))", gap: "var(--s-5)", alignItems: "start" }}>
            {/* Blok 1: per klant. Claude-regels zijn uitklapbaar (details/summary,
                werkt zonder JavaScript): open = de functies waar het bedrag uit
                bestaat. Ahrefs-regels blijven gewone regels. */}
            <div style={card} className="usage-cl">
              <style>{`
                .usage-cl summary { list-style: none; cursor: pointer; }
                .usage-cl summary::-webkit-details-marker { display: none; }
                .usage-cl details[open] .usage-car { transform: rotate(90deg); }
                .usage-cl summary:hover { background: var(--kleur-accent-vlak); }
              `}</style>
              <h2 style={blockTitle}>
                1. Per klant
                <Hint text="Elke regel is één klant + één dienst. Klik op een Claude-regel om te zien welke functies het bedrag veroorzaken. Een klant die zowel de AI als Ahrefs gebruikt, staat er twee keer: één regel voor Claude en één voor Ahrefs." />
              </h2>
              <p style={blockSub}>Wat elke klant deze periode heeft verbruikt, per dienst. Klik op een Claude-regel voor de uitsplitsing per functie.</p>
              {rows.length === 0 ? (
                <div style={{ color: "var(--text-secondary)", padding: "var(--s-2) var(--s-1)", fontSize: "var(--fs-base)" }}>
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
                    <div style={{ ...rowGrid, background: "var(--dark, var(--kleur-kop))", borderRadius: "var(--r-md) var(--r-md) 0 0" }}>
                      <div style={th}>Klant</div>
                      <div style={th}>Dienst</div>
                      <div style={thNum}>Aanroepen</div>
                      <div style={thNum}>Verbruik</div>
                      <div style={thNum}>Kosten</div>
                    </div>
                    {rows.map((r, i) => {
                      const nameCell = cName(r) || (
                        <span style={{ color: "var(--text-secondary)", display: "inline-flex", alignItems: "center" }}>
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
                          <div style={{ ...numTd, fontWeight: 600 }}>{r.service === "ahrefs" && !ahrefsPrijsIngesteld ? "—" : euros(r.cost_usd)}</div>
                        </>
                      );
                      // Ahrefs (of Claude zonder uitsplitsing): gewone regel.
                      const breakdown = r.service === "anthropic" ? (actionsByClient.get(r.client_slug || "") || []) : [];
                      if (breakdown.length === 0) {
                        return (
                          <div key={i} style={rowGrid}>
                            <div style={{ ...td, paddingLeft: "var(--s-6)" }}>{nameCell}</div>
                            {cells}
                          </div>
                        );
                      }
                      return (
                        <details key={i}>
                          <summary style={rowGrid}>
                            <div style={{ ...td, display: "flex", alignItems: "center", gap: "var(--s-2)" }}>
                              <span className="usage-car" style={{ display: "inline-block", transition: "transform 0.15s", color: "var(--accent-warm)", fontSize: "var(--fs-xs)", flex: "0 0 auto" }}>&#9654;</span>
                              {nameCell}
                            </div>
                            {cells}
                          </summary>
                          {/* Uitsplitsing: welke functies veroorzaken dit bedrag. */}
                          <div style={{ background: "var(--orange-light)", borderBottom: "1px solid var(--kleur-rand-zacht)", padding: "var(--s-1) 0 var(--s-2)" }}>
                            {breakdown.map((b, j) => (
                              <div key={j} style={rowGrid}>
                                <div style={{ ...td, borderBottom: "none", paddingLeft: "var(--s-8)", color: "var(--text-secondary)" }}>{b.action ? (ACTION_LABEL[b.action] || b.action) : "onbekend"}</div>
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
                <div style={{ color: "var(--text-secondary)", padding: "var(--s-2) var(--s-1)", fontSize: "var(--fs-base)" }}>
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
    </>
  );
}
