"use client";

import { useEffect, useState } from "react";
import HelpHint from "./HelpHint";
import { berekenFundament, FUNDAMENT_KOLOMMEN, type FundamentPunt, type FundamentStatus } from "../../../../lib/fundament";

// ═══════════════════════════════════════════════════════════
// FUNDAMENT VAN DEZE KLANT: IN ÉÉN OOGOPSLAG WAT ER STAAT EN WAT NOG MOET
// ═══════════════════════════════════════════════════════════
// Bovenaan de klant-tab, vóór de bedrijfsgegevens en de concurrentenlijst die
// hieronder al staan: tone of voice en bedrijfsprofiel komen uit het
// klantprofiel (Pagina's-tab), structured data en concurrenten uit de panelen
// hieronder, positionering is de enige echt nieuwe invoer hier (een
// Drive-link). Concurrentieanalyse heeft geen eigen knop: die status volgt uit
// of het positioneringsadvies er is, want die skill benchmarkt daar al in mee.
//
// Dezelfde rekenregel (lib/fundament.ts) als het klantenoverzicht op
// /admin/fundament, zodat die twee schermen nooit een ander verhaal vertellen.
// ═══════════════════════════════════════════════════════════

type OrgSlice = { data?: { bedrijfsnaam?: string }; locked?: boolean };

const CHIP_KLASSE: Record<FundamentPunt, string> = {
  klaar: "plan-chip has",
  vergrendeld: "plan-chip has",
  bezig: "plan-chip half",
  nietbegonnen: "plan-chip",
};
const CHIP_LABEL: Record<FundamentPunt, string> = {
  klaar: "klaar", vergrendeld: "vergrendeld", bezig: "bezig", nietbegonnen: "nog niet",
};

export default function FundamentPanel({ slug, seoProfile, positioneringUrl, onGaNaar }: {
  slug: string;
  seoProfile: string;
  positioneringUrl: string;
  /** Naar de Pagina's-tab springen voor het klantprofiel/tone of voice. */
  onGaNaar?: (tab: string) => void;
}) {
  const [org, setOrg] = useState<OrgSlice | null>(null);
  const [competitorCount, setCompetitorCount] = useState<number | null>(null);
  const [urlVeld, setUrlVeld] = useState(positioneringUrl || "");
  const [bezig, setBezig] = useState(false);
  const [gemeld, setGemeld] = useState("");

  useEffect(() => {
    fetch(`/api/admin/org-data?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => { if (d.ok) setOrg(d); }).catch(() => {});
    fetch(`/api/admin/competitors?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => { if (d.ok) setCompetitorCount((d.competitors || []).length); }).catch(() => {});
  }, [slug]);

  useEffect(() => { setUrlVeld(positioneringUrl || ""); }, [positioneringUrl]);

  const status: FundamentStatus = berekenFundament({
    seoProfile,
    orgFilled: !!org?.data?.bedrijfsnaam?.trim(),
    orgLocked: !!org?.locked,
    competitorCount: competitorCount ?? 0,
    positioneringUrl: positioneringUrl || null,
  });

  const bewaarUrl = async () => {
    setBezig(true); setGemeld("");
    try {
      const r = await fetch("/api/admin/clients", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action: "positioneringUrl", positioneringUrl: urlVeld }),
      });
      const d = await r.json();
      setGemeld(d.ok ? "Bewaard." : (d.error || "Opslaan mislukt."));
    } catch { setGemeld("Opslaan mislukt."); } finally { setBezig(false); }
  };

  const laden = org === null || competitorCount === null;

  return (
    <div className="cockpit-card acc-orange">
      <div className="ck-section-head">
        <span>
          Fundament{" "}
          <HelpHint
            title="Het fundament van deze klant"
            text={"Wat er al staat en wat nog moet, voordat copy en structured data écht op maat kunnen. Zes punten:\n- **Tone of voice** en **bedrijfsprofiel**: het klantprofiel op de Pagina's-tab, boven aan het scherm.\n- **Structured data**: de bedrijfsgegevens hieronder, tot en met vergrendelen.\n- **Concurrenten**: de lijst hieronder.\n- **Concurrentieanalyse**: geen los document. De positionering-skill benchmarkt altijd al tegen de concurrenten, dus deze status volgt uit positionering.\n- **Positionering**: het afgeronde positioneringsadvies, als Drive-link hieronder."}
          />
        </span>
      </div>

      <div className="fund-rij">
        {FUNDAMENT_KOLOMMEN.map((k) => (
          <div key={k.key} className="fund-punt" title={k.hint}>
            <span className={CHIP_KLASSE[status[k.key]]}>{CHIP_LABEL[status[k.key]]}</span>
            <span className="fund-punt-label">{k.label}</span>
          </div>
        ))}
      </div>

      {laden && <div className="muted" style={{ fontSize: "var(--fs-xs)", marginTop: "var(--s-2)" }}>Structured data en concurrenten worden geladen…</div>}

      <div className="fund-uitleg">
        {status.toneOfVoice === "nietbegonnen" || status.bedrijfsprofiel === "nietbegonnen" ? (
          <div className="muted">
            Tone of voice en bedrijfsprofiel: nog niet opgesteld. Ga naar{" "}
            {onGaNaar ? <button type="button" className="fund-link" onClick={() => onGaNaar("paginas")}>Pagina&rsquo;s</button> : "Pagina's"}
            {" "}en open bovenaan &ldquo;Klantprofiel&rdquo;.
          </div>
        ) : null}
        {status.positionering === "nietbegonnen" && (
          <div className="muted">Positioneringsadvies: nog niet afgerond. Plak de Drive-link hieronder zodra hij er is.</div>
        )}
      </div>

      <div className="fund-positionering">
        <label className="fund-positionering-label" htmlFor={`fund-pos-${slug}`}>Positioneringsadvies (Drive-link)</label>
        <div className="fund-positionering-row">
          <input
            id={`fund-pos-${slug}`}
            className="compose-input"
            value={urlVeld}
            placeholder="https://docs.google.com/document/d/..."
            onChange={(e) => setUrlVeld(e.target.value)}
          />
          {urlVeld.trim() && <a className="ghost-btn small" href={urlVeld.trim()} target="_blank" rel="noreferrer">Open</a>}
          <button type="button" className="ghost-btn small" onClick={() => void bewaarUrl()} disabled={bezig}>
            {bezig ? "Opslaan…" : "Bewaren"}
          </button>
          {gemeld && <span className="saved-msg">{gemeld}</span>}
        </div>
      </div>
    </div>
  );
}
