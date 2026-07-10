import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { getScopeFromCookie } from "../../../lib/admin-scope";
import { moneybirdConfigured, getProfitLoss, getLedgerAccounts, type ProfitLoss, type LedgerAccount } from "../../../lib/moneybird";
import FinancienClient from "./FinancienClient";

export const dynamic = "force-dynamic";

// Begrotingspagina (alleen Maarten): helikopterview van alle opbrengsten en
// kosten uit Moneybird, per jaar en per maand, met uitklapbare posten.

const MONTH_NAMES = ["jan", "feb", "mrt", "apr", "mei", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

function euro(n: number): string {
  return "€ " + n.toLocaleString("nl-NL", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export default async function FinancienPage({ searchParams }: { searchParams: { periode?: string } }) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!scope.isOwner) redirect("/admin");
  // Zonder Moneybird-koppeling bestaat deze pagina niet: Maartens privé-
  // administratie hoort alleen in de wereld waar de sleutel staat (Pingwin).
  if (!moneybirdConfigured()) redirect("/admin");

  const now = new Date();
  const thisYear = now.getFullYear();

  // Periode-parameter: "jaar" (standaard), "vorigjaar" of een maand "YYYYMM".
  const p = (searchParams.periode || "jaar").trim();
  const isMonth = /^\d{6}$/.test(p);
  const year = isMonth ? Number(p.slice(0, 4)) : p === "vorigjaar" ? thisYear - 1 : thisYear;
  const lastMonth = year < thisYear ? 12 : now.getMonth() + 1;

  let months: ProfitLoss[] = [];
  let ledger: LedgerAccount[] = [];
  let loadError = "";
  const configured = moneybirdConfigured();
  if (configured) {
    try {
      // Eén rapport per maand (gecachet, 6 uur). De jaartotalen zijn de som van
      // de maanden; zo is de maandtabel altijd consistent met de kaarten.
      months = await Promise.all(
        Array.from({ length: lastMonth }, (_, i) => getProfitLoss(`${year}${String(i + 1).padStart(2, "0")}`))
      );
      ledger = await getLedgerAccounts();
    } catch (e) {
      loadError = (e as Error).message;
    }
  }

  const selected = isMonth
    ? months[Number(p.slice(4, 6)) - 1] || null
    : null;
  const sum = (f: (m: ProfitLoss) => number) => months.reduce((s, m) => s + f(m), 0);
  const totals = selected
    ? { revenue: selected.totalRevenue, expenses: selected.totalExpenses, net: selected.netProfit }
    : { revenue: sum((m) => m.totalRevenue), expenses: sum((m) => m.totalExpenses), net: sum((m) => m.netProfit) };

  const periodLabel = selected
    ? `${MONTH_NAMES[Number(p.slice(4, 6)) - 1]} ${year}`
    : `heel ${year}`;

  const wrap: React.CSSProperties = { maxWidth: 1080, margin: "0 auto", padding: "28px 20px 60px", fontFamily: "system-ui, -apple-system, sans-serif", color: "#1f2937" };
  const card: React.CSSProperties = { border: "1px solid #eadfce", borderRadius: 12, background: "#fff", padding: 18, boxShadow: "0 1px 3px rgba(0,0,0,0.04)" };
  const pill = (active: boolean): React.CSSProperties => ({
    padding: "6px 14px", borderRadius: 999, fontSize: 14, textDecoration: "none",
    border: "1px solid " + (active ? "#d97316" : "#eadfce"),
    background: active ? "#d97316" : "#fff",
    color: active ? "#fff" : "#5b6472",
  });
  const th: React.CSSProperties = { textAlign: "right", padding: "8px 10px", borderBottom: "2px solid #eadfce", fontSize: 13, color: "#8a6a3e", fontWeight: 600 };
  const td: React.CSSProperties = { padding: "8px 10px", borderBottom: "1px solid #f1e9db", fontSize: 14, textAlign: "right", fontVariantNumeric: "tabular-nums" };

  return (
    <div style={wrap}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 24, margin: 0, color: "#d97316" }}>Financi&euml;n</h1>
        <Link href="/admin" style={{ color: "#8a6a3e", fontSize: 14, textDecoration: "none" }}>&larr; Terug naar overzicht</Link>
      </div>
      <p style={{ color: "#5b6472", maxWidth: 640, lineHeight: 1.5, marginTop: 8 }}>
        Alle opbrengsten en kosten, live uit Moneybird. Klik een post open om te zien waar het
        geld vandaan komt of naartoe gaat, tot en met de losse facturen. Alles is alleen-lezen:
        er verandert hier nooit iets in de boekhouding.
      </p>

      {!configured ? (
        <div style={{ ...card, borderColor: "#f0c8c8", background: "#fdf4f4", color: "#a13d3d" }}>
          Moneybird is nog niet gekoppeld (MONEYBIRD_API_TOKEN / MONEYBIRD_ADMINISTRATION_ID ontbreken).
        </div>
      ) : loadError ? (
        <div style={{ ...card, borderColor: "#f0c8c8", background: "#fdf4f4", color: "#a13d3d" }}>
          Kon de cijfers niet laden: {loadError}
        </div>
      ) : (
        <>
          {/* Periode-schakelaar: jaar + losse maanden */}
          <div style={{ display: "flex", gap: 8, margin: "14px 0 8px", flexWrap: "wrap" }}>
            <Link href="/admin/financien?periode=jaar" style={pill(!isMonth && p !== "vorigjaar")}>Dit jaar ({thisYear})</Link>
            <Link href="/admin/financien?periode=vorigjaar" style={pill(p === "vorigjaar")}>Vorig jaar ({thisYear - 1})</Link>
          </div>
          <div style={{ display: "flex", gap: 6, margin: "0 0 20px", flexWrap: "wrap" }}>
            {Array.from({ length: lastMonth }, (_, i) => {
              const key = `${year}${String(i + 1).padStart(2, "0")}`;
              return (
                <Link key={key} href={`/admin/financien?periode=${key}`} style={{ ...pill(p === key), padding: "4px 10px", fontSize: 13 }}>
                  {MONTH_NAMES[i]}
                </Link>
              );
            })}
          </div>

          {/* Helikopterview: drie kaarten voor de gekozen periode */}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 18 }}>
            <div style={{ ...card, minWidth: 200, flex: "1 1 200px" }}>
              <div style={{ fontSize: 12, color: "#8a6a3e" }}>Opbrengsten ({periodLabel})</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#2E7D32" }}>{euro(totals.revenue)}</div>
            </div>
            <div style={{ ...card, minWidth: 200, flex: "1 1 200px" }}>
              <div style={{ fontSize: 12, color: "#8a6a3e" }}>Kosten ({periodLabel})</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: "#C62828" }}>{euro(totals.expenses)}</div>
            </div>
            <div style={{ ...card, minWidth: 200, flex: "1 1 200px" }}>
              <div style={{ fontSize: 12, color: "#8a6a3e" }}>Resultaat ({periodLabel})</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: totals.net >= 0 ? "#d97316" : "#C62828" }}>{euro(totals.net)}</div>
            </div>
          </div>

          {/* Ontwikkeling per maand */}
          <div style={{ ...card, marginBottom: 18, overflowX: "auto" }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 10, color: "#8a6a3e" }}>Ontwikkeling per maand ({year})</div>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: "left" }}></th>
                  {months.map((_, i) => (
                    <th key={i} style={th}>
                      <Link href={`/admin/financien?periode=${year}${String(i + 1).padStart(2, "0")}`} style={{ color: "#8a6a3e", textDecoration: "none" }}>
                        {MONTH_NAMES[i]}
                      </Link>
                    </th>
                  ))}
                  <th style={{ ...th, borderLeft: "2px solid #eadfce" }}>totaal</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>Opbrengsten</td>
                  {months.map((m, i) => <td key={i} style={td}>{euro(m.totalRevenue)}</td>)}
                  <td style={{ ...td, fontWeight: 700, borderLeft: "2px solid #eadfce" }}>{euro(sum((m) => m.totalRevenue))}</td>
                </tr>
                <tr>
                  <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>Kosten</td>
                  {months.map((m, i) => <td key={i} style={td}>{euro(m.totalExpenses)}</td>)}
                  <td style={{ ...td, fontWeight: 700, borderLeft: "2px solid #eadfce" }}>{euro(sum((m) => m.totalExpenses))}</td>
                </tr>
                <tr>
                  <td style={{ ...td, textAlign: "left", fontWeight: 600 }}>Resultaat</td>
                  {months.map((m, i) => (
                    <td key={i} style={{ ...td, color: m.netProfit >= 0 ? "#2E7D32" : "#C62828", fontWeight: 600 }}>{euro(m.netProfit)}</td>
                  ))}
                  <td style={{ ...td, fontWeight: 700, borderLeft: "2px solid #eadfce", color: sum((m) => m.netProfit) >= 0 ? "#2E7D32" : "#C62828" }}>{euro(sum((m) => m.netProfit))}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Uitklapbare posten (opbrengsten en kosten per grootboekrekening) */}
          <FinancienClient
            months={months}
            ledger={ledger}
            year={year}
            selectedMonth={isMonth ? Number(p.slice(4, 6)) : null}
          />
        </>
      )}
    </div>
  );
}
