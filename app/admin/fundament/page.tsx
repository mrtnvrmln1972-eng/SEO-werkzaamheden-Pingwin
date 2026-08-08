import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../lib/constants";
import { canAccessSlug, getScopeFromCookie } from "../../../lib/admin-scope";
import { listClients } from "../../../lib/clients";
import { getOrgData } from "../../../lib/org-data";
import { getCompetitors } from "../../../lib/competitors";
import { berekenFundament, FUNDAMENT_KOLOMMEN } from "../../../lib/fundament";
import AdminKop from "../AdminKop";
import FundamentClient, { type FundamentRij } from "./FundamentClient";

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
//
// De data komt hier vandaan (server, één keer per bezoek); de indeling in
// groepen, het open/dichtklappen en de actieknoppen zijn interactie en staan
// daarom in FundamentClient.tsx.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export default async function FundamentPage() {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");

  const all = await listClients();
  const clients = all.filter((c) => canAccessSlug(scope, c.slug));

  // Per klant de twee losse bronnen erbij halen: org-data (structured data) en
  // de concurrentenlijst. seoProfile en de positioneringslink staan al op de
  // klant zelf. Eén rekenregel (berekenFundament) zet dat om in de zes statussen.
  const rijen: FundamentRij[] = await Promise.all(clients.map(async (c) => {
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
    return { slug: c.slug, name: c.name, fase: c.fase, domain: c.domain, grp: c.grp, status };
  }));

  const totaal = rijen.length;
  const perKolom = FUNDAMENT_KOLOMMEN.map((k) => ({
    ...k,
    af: rijen.filter((r) => r.status[k.key] !== "nietbegonnen").length,
  }));

  const wrap: React.CSSProperties = { maxWidth: 1320, margin: "0 auto", padding: "var(--s-6) var(--s-5) var(--s-12)" };
  const card: React.CSSProperties = { border: "1px solid var(--card-border)", borderRadius: "var(--r-lg)", background: "var(--white)", boxShadow: "var(--shadow-sm)" };

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
          daaruit. Staat een punt nog op &ldquo;nog niet&rdquo;, dan staat er een knopje bij om het
          meteen te starten.
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

        <FundamentClient rijen={rijen} />
      </div>
    </>
  );
}
