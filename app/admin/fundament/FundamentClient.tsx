"use client";

import { useMemo, useState } from "react";
import FundamentActieKnop, { type FundamentActieKind } from "../client/[slug]/FundamentActieKnop";
import { FUNDAMENT_KOLOMMEN, PUNT_LABEL, fundamentVoortgang, type FundamentStatus } from "../../../lib/fundament";

// ═══════════════════════════════════════════════════════════
// DE KLANTEN GEGROEPEERD: EIGEN, LEADS, MULTIMEDIA CONCEPTS
// ═══════════════════════════════════════════════════════════
// Zelfde driedeling als de klantenkiezer in de cockpit (KlantKiezer.tsx), maar
// met eigen regels voor wat standaard open staat: hier is er geen "huidige
// klant" om rekening mee te houden, dus vaste regel. Multimedia Concepts is
// verreweg de langste lijst en meestal niet waar Maarten voor komt, dus dicht.
// Eigen klanten én leads wil hij wél meteen zien, dus allebei open.
// ═══════════════════════════════════════════════════════════

export type FundamentRij = {
  slug: string; name: string; fase: string; domain: string | null; grp: string | null;
  status: FundamentStatus;
};

const KLEUR: Record<string, { bg: string; fg: string }> = {
  klaar: { bg: "var(--good)", fg: "var(--white)" },
  vergrendeld: { bg: "var(--good)", fg: "var(--white)" },
  bezig: { bg: "var(--accent-warm)", fg: "var(--white)" },
  nietbegonnen: { bg: "var(--gray-light)", fg: "var(--text-secondary)" },
};

function Pil({ status }: { status: keyof typeof KLEUR }) {
  const k = KLEUR[status] || KLEUR.nietbegonnen;
  return (
    <span style={{
      display: "inline-block", fontSize: "var(--fs-xs)", lineHeight: "var(--lh-xs)", fontWeight: 700,
      padding: "var(--s-1) var(--s-2)", borderRadius: "var(--r-full)",
      background: k.bg, color: k.fg, whiteSpace: "nowrap",
    }}>
      {PUNT_LABEL[status as keyof typeof PUNT_LABEL]}
    </span>
  );
}

// Welk fundament-punt een knop krijgt op dit overzicht, en wanneer die zin heeft.
const ACTIE_VOOR: Partial<Record<keyof FundamentStatus, FundamentActieKind>> = {
  toneOfVoice: "tov", bedrijfsprofiel: "profile", structuredData: "structured",
};
function magActie(key: keyof FundamentStatus, status: string): boolean {
  if (key === "structuredData") return status !== "vergrendeld";
  return status === "nietbegonnen";
}

type Groep = { sleutel: string; label: string; rijen: FundamentRij[]; standaardOpen: boolean };

export default function FundamentClient({ rijen }: { rijen: FundamentRij[] }) {
  const groepen = useMemo<Groep[]>(() => {
    const isLead = (r: FundamentRij) => r.fase === "lead";
    const isMmc = (r: FundamentRij) => r.grp === "mmc";
    return [
      { sleutel: "eigen", label: "Mijn eigen klanten", rijen: rijen.filter((r) => !isLead(r) && !isMmc(r)), standaardOpen: true },
      { sleutel: "leads", label: "Leads", rijen: rijen.filter((r) => isLead(r) && !isMmc(r)), standaardOpen: true },
      { sleutel: "mmc", label: "Multimedia Concepts", rijen: rijen.filter(isMmc), standaardOpen: false },
    ].filter((g) => g.rijen.length > 0);
  }, [rijen]);

  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (g: Groep) => open[g.sleutel] ?? g.standaardOpen;

  const th: React.CSSProperties = { textAlign: "left", padding: "var(--s-2) var(--s-3)", fontSize: "var(--fs-xs)", color: "var(--white)", fontWeight: 700, whiteSpace: "nowrap", textTransform: "uppercase", letterSpacing: "0.03em" };
  const td: React.CSSProperties = { padding: "var(--s-2) var(--s-3)", borderBottom: "1px solid var(--gray-light)", fontSize: "var(--fs-sm)", verticalAlign: "top" };

  return (
    <div>
      {groepen.map((g) => {
        const opengeklapt = isOpen(g);
        return (
          <div className="fund-groep" key={g.sleutel}>
            <button
              type="button"
              className="fund-groep-kop"
              aria-expanded={opengeklapt}
              onClick={() => setOpen((v) => ({ ...v, [g.sleutel]: !opengeklapt }))}
            >
              <svg className="fund-groep-caret" width="10" height="10" viewBox="0 0 10 6" aria-hidden="true">
                <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="fund-groep-titel">{g.label}</span>
              <span className="fund-groep-aantal">{g.rijen.length}</span>
            </button>

            {opengeklapt && (
              <div style={{ border: "1px solid var(--card-border)", borderRadius: "var(--r-lg)", background: "var(--white)", boxShadow: "var(--shadow-sm)", overflow: "hidden" }}>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
                    <thead>
                      <tr style={{ background: "var(--dark)" }}>
                        <th style={{ ...th, position: "sticky", left: 0, background: "var(--dark)" }}>Klant</th>
                        {FUNDAMENT_KOLOMMEN.map((k) => <th key={k.key} style={th} title={k.hint}>{k.label}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {g.rijen.map((r) => {
                        const voortgang = fundamentVoortgang(r.status);
                        return (
                          <tr key={r.slug}>
                            <td style={{ ...td, position: "sticky", left: 0, background: "var(--white)", borderRight: "1px solid var(--gray-light)" }}>
                              <a href={`/admin/client/${r.slug}?tab=klant`} style={{ color: "var(--dark)", fontWeight: 700, textDecoration: "none", fontSize: "var(--fs-base)" }}>{r.name}</a>
                              <div style={{ fontSize: "var(--fs-xs)", color: "var(--text-secondary)", marginTop: "var(--s-1)" }}>
                                {r.domain || "geen domein"} &middot; {voortgang.af}/{voortgang.totaal}
                              </div>
                            </td>
                            {FUNDAMENT_KOLOMMEN.map((k) => {
                              const puntStatus = r.status[k.key] as string;
                              const actieKind = ACTIE_VOOR[k.key];
                              return (
                                <td key={k.key} style={td}>
                                  <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-1)", alignItems: "flex-start" }}>
                                    <Pil status={puntStatus} />
                                    {k.key === "concurrenten" && r.status.concurrentenAantal > 0 && (
                                      <span style={{ fontSize: "var(--fs-xs)", color: "var(--text-secondary)" }}>{r.status.concurrentenAantal} domeinen</span>
                                    )}
                                    {actieKind && magActie(k.key, puntStatus) && (
                                      <FundamentActieKnop slug={r.slug} kind={actieKind} />
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
