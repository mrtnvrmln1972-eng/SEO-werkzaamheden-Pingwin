import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { canAccessSlug, getScopeFromCookie } from "../../../lib/admin-scope";
import { listClients } from "../../../lib/clients";
import { getOrgData } from "../../../lib/org-data";
import { getCompetitors } from "../../../lib/competitors";
import { berekenFundament, FUNDAMENT_KOLOMMEN, PUNT_LABEL, fundamentVoortgang, type FundamentStatus } from "../../../lib/fundament";
import AdminKop from "../AdminKop";

// ═══════════════════════════════════════════════════════════
// FUNDAMENT: ALLE KLANTEN IN ÉÉN OOGOPSLAG
// ═══════════════════════════════════════════════════════════
// Maarten vroeg letterlijk om dit als scherm, niet als eenmalig lijstje in een
// chat: "ik neem aan dat dit gebouwd is in het dashboard, want het lijkt me
// het leukst en logisch als we daar per klant ook kunnen zien wat er wel en
// niet ingevuld is". Dit scherm is het overzicht over alle klanten; het
// detail per klant (met de knoppen om het af te maken) staat in de
// cockpit-tab "Klantgegevens" via FundamentPanel.tsx, met dezelfde
// rekenregels uit lib/fundament.ts.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

const KLEUR: Record<string, { bg: string; fg: string }> = {
  klaar: { bg: "var(--good)", fg: "var(--white)" },
  vergrendeld: { bg: "var(--good)", fg: "var(--white)" },
  bezig: { bg: "var(--accent-warm)", fg: "var(--white)" },
  nietbegonnen: { bg: "var(--gray-light)", fg: "var(--text-secondary)" },
};

function Pil({ status }: { status: FundamentStatus[keyof FundamentStatus] & string }) {
  const k = KLEUR[status] || KLEUR.nietbegonnen;
  return (
    <span style={{
      display: "inline-block", fontSize: "var(--fs-xs)", lineHeight: "var(--lh-xs)", fontWeight: 700,
      padding: "var(--s-1) var(--s-2)", borderRadius: "var(--r-full)",
      background: k.bg, color: k.fg, whiteSpace: "nowrap",
    }}>
      {PUNT_LABEL[status]}
    </span>
  );
}

export default async function FundamentPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");

  const all = await listClients();
  const clients = all.filter((c) => canAccessSlug(scope, c.slug));

  // Per klant de twee losse bronnen erbij halen: org-data (structured data) en
  // de concurrentenlijst. seoProfile en de positioneringslink staan al op de
  // klant zelf. Eén rekenregel (berekenFundament) zet dat om in de zes statussen.
  const rijen = await Promise.all(clients.map(async (c) => {
    const [org, competitors] = await Promise.all([
      getOrgData(c.slug).catch(() => null),
      getCompetitors(c.slug).catch(() => [] as string[]),
    ]);
    const status = berekenFundament({
      seoProfile: c.seoProfile,
      orgFilled: !!org?.data?.bedrijfsnaam?.trim(),
      orgLocked: !!org?.locked,
      competitorCount: competitors.length,
      positioneringUrl: c.cockpit.positioneringUrl,
    });
    return { client: c, status };
  }));

  const totaal = rijen.length;
  const perKolom = FUNDAMENT_KOLOMMEN.map((k) => ({
    ...k,
    af: rijen.filter((r) => r.status[k.key] !== "nietbegonnen").length,
  }));

  const wrap: React.CSSProperties = { maxWidth: 1320, margin: "0 auto", padding: "var(--s-6) var(--s-5) var(--s-12)" };
  const card: React.CSSProperties = { border: "1px solid var(--card-border)", borderRadius: "var(--r-lg)", background: "var(--white)", boxShadow: "var(--shadow-sm)" };
  const th: React.CSSProperties = { textAlign: "left", padding: "var(--s-2) var(--s-3)", fontSize: "var(--fs-xs)", color: "var(--white)", fontWeight: 700, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.03em" };
  const td: React.CSSProperties = { padding: "var(--s-2) var(--s-3)", borderBottom: "1px solid var(--gray-light)", fontSize: "var(--fs-sm)", verticalAlign: "top" };

  return (
    <>
      <AdminKop titel="Fundament" />
      <div style={wrap}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "var(--s-3)", flexWrap: "wrap", marginBottom: "var(--s-2)" }}>
          <h1 style={{ fontSize: "var(--fs-lg)", lineHeight: "var(--lh-lg)", margin: "var(--s-0)", color: "var(--accent-warm)" }}>Fundament per klant</h1>
        </div>
        <p style={{ color: "var(--text-secondary)", maxWidth: 820, lineHeight: "var(--lh-base)", fontSize: "var(--fs-base)", margin: "0 0 var(--s-5)" }}>
          Wat er per klant al staat en wat nog gemaakt moet worden: tone of voice, bedrijfsprofiel,
          structured data, concurrenten en positionering. Concurrentieanalyse heeft geen eigen kolom
          met een los document: die zit altijd al in het positioneringsadvies, dus die status volgt
          daaruit.
        </p>

        {/* Zes tegels: per punt hoeveel van de klanten al iets hebben staan. */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "var(--s-3)", marginBottom: "var(--s-6)" }}>
          {perKolom.map((k) => (
            <div key={k.key} style={{ ...card, padding: "var(--s-3) var(--s-4)" }} title={k.hint}>
              <div style={{ fontSize: "var(--fs-xl)", lineHeight: "var(--lh-xl)", fontWeight: 700, color: "var(--dark)", fontVariantNumeric: "tabular-nums" }}>
                {k.af} <span style={{ fontSize: "var(--fs-sm)", color: "var(--text-secondary)", fontWeight: 500 }}>/ {totaal}</span>
              </div>
              <div style={{ fontSize: "var(--fs-xs)", lineHeight: "var(--lh-xs)", color: "var(--label-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.03em" }}>{k.label}</div>
            </div>
          ))}
        </div>

        <div style={{ ...card, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
              <thead>
                <tr style={{ background: "var(--dark)" }}>
                  <th style={{ ...th, position: "sticky", left: 0, background: "var(--dark)" }}>Klant</th>
                  {FUNDAMENT_KOLOMMEN.map((k) => <th key={k.key} style={th} title={k.hint}>{k.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {rijen.map(({ client: c, status: s }) => {
                  const voortgang = fundamentVoortgang(s);
                  return (
                    <tr key={c.slug}>
                      <td style={{ ...td, position: "sticky", left: 0, background: "var(--white)", borderRight: "1px solid var(--gray-light)" }}>
                        <a href={`/admin/client/${c.slug}?tab=klant`} style={{ color: "var(--dark)", fontWeight: 700, textDecoration: "none", fontSize: "var(--fs-base)" }}>{c.name}</a>
                        <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-secondary)", marginTop: "var(--s-1)" }}>
                          {c.fase === "lead" && <span style={{ color: "var(--accent-warm)", fontWeight: 700, textTransform: "uppercase", marginRight: "var(--s-2)" }}>Lead</span>}
                          {c.domain || "geen domein"} &middot; {voortgang.af}/{voortgang.totaal}
                        </div>
                      </td>
                      <td style={td}><Pil status={s.toneOfVoice} /></td>
                      <td style={td}><Pil status={s.bedrijfsprofiel} /></td>
                      <td style={td}><Pil status={s.structuredData} /></td>
                      <td style={td}>
                        <Pil status={s.concurrenten} />
                        {s.concurrentenAantal > 0 && <span style={{ marginLeft: "var(--s-2)", fontSize: "var(--fs-xs)", color: "var(--text-secondary)" }}>{s.concurrentenAantal} domeinen</span>}
                      </td>
                      <td style={td}><Pil status={s.concurrentieanalyse} /></td>
                      <td style={td}><Pil status={s.positionering} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
