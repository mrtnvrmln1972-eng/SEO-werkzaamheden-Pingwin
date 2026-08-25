"use client";

import { useCallback, useEffect, useState } from "react";
import HelpHint from "./HelpHint";
import FundamentActieKnop, { type FundamentActieKind } from "./FundamentActieKnop";
import { PijlRechts } from "../../../_ui/Pijl";
import { BLOK_LABEL, type Blok, type Stand, type StapStand } from "../../../../lib/onboarding-stappen";

// ═══════════════════════════════════════════════════════════
// FUNDAMENT: ALLES WAT GEKOPPELD EN INGEVULD MOET ZIJN, ÉÉN OVERZICHT
// ═══════════════════════════════════════════════════════════
// Dit stond eerder op twee plekken (deze kaart met zes chips, en een los
// "Links"-zijpaneel met een accordeon) die elk een eigen, soms afwijkend
// verhaal vertelden over dezelfde koppeling. Nu is er één bron: dezelfde
// live berekening als de Onboarding-tab (lib/onboarding.ts), hier getoond
// als tegels in plaats van een lange lijst met een startknop. Wat hier staat
// is dus nooit anders dan wat Onboarding zegt; alleen de vorm verschilt.
//
// Bewust alleen de blokken "aansluiten" en "kennen": dat is precies "is
// alles gekoppeld en ingevuld". De site-brede scans en de strategie hebben
// al hun eigen tabblad en staan (met dezelfde cijfers) op Onboarding; ze hier
// nog een keer tonen zou dubbelop zijn.
// ═══════════════════════════════════════════════════════════

const STAAT_TEKST: Record<StapStand["staat"], string> = {
  af: "Staat", bezig: "Draait", verouderd: "Loopt achter", open: "Nog te doen",
};

// Alle vier de blokken. Er stonden er hier twee, en de andere twee stonden op
// een eigen tabblad Onboarding, met dezelfde cijfers uit dezelfde bron. Twee
// schermen voor dezelfde vraag betekent dat je altijd de verkeerde openhebt.
const BLOKKEN: Blok[] = ["aansluiten", "kennen", "meten", "werken"];
const BLOK_TITEL: Record<Blok, string> = {
  aansluiten: "Fundament: aansluiten", kennen: "Fundament: wie is de klant",
  meten: "Fundament: meten", werken: "Fundament: aan het werk",
};

// Stappen die het dashboard zelf op gang kan trekken, met dezelfde knop als
// voorheen (de motor achter de "Ontbrekende gegevens ophalen"-knop e.d.).
const ACTIE_VOOR: Partial<Record<string, FundamentActieKind>> = {
  tov: "tov", profiel: "profile", bedrijfsgegevens: "structured",
};
// Deze twee staan zelf verderop op dit tabblad; een anker in plaats van een
// tabwissel die toch niets doet (we zitten al op "klant").
const ANKER_VOOR: Partial<Record<string, string>> = {
  bedrijfsgegevens: "#fund-structured-data", concurrenten: "#fund-concurrenten",
  profiel: "#fund-profiel", tov: "#fund-profiel",
};
// Geen koppeling om naartoe te springen, maar een linkje dat hier zelf
// bewaard wordt (net als het positioneringsadvies altijd al deed).
const LINK_VELDEN = new Set(["positionering", "huisstijl", "adsaccount"]);
const LINK_ACTIE: Record<string, string> = {
  positionering: "positioneringUrl", huisstijl: "huisstijlUrl", adsaccount: "adsAccountUrl",
};
const LINK_PLACEHOLDER: Record<string, string> = {
  positionering: "https://docs.google.com/document/d/...",
  huisstijl: "https://docs.google.com/document/d/... (of de huisstijl-tokens)",
  adsaccount: "https://ads.google.com/aw/overview?ocid=...",
};

function Tegel({ s, onGaNaar, extra, ankerHref }: {
  s: StapStand;
  onGaNaar: (tab: string) => void;
  extra?: React.ReactNode;
  ankerHref?: string;
}) {
  return (
    <div className={`fnd-tegel fnd-staat-${s.staat}`} title={s.waarom}>
      <div className="fnd-tegel-kop">
        <strong>{s.label}</strong>
        <span className={`ob-chip ob-${s.staat}`}>{STAAT_TEKST[s.staat]}</span>
      </div>
      <p className="fnd-tegel-detail">{s.detail}</p>
      {(extra || s.tab) && (
        <div className="fnd-tegel-acties">
          {extra}
          {ankerHref ? (
            <a className="btn btn-ghost btn-klein" href={ankerHref}>{s.staat === "af" ? "Bekijken" : "Openen"} <PijlRechts /></a>
          ) : s.tab ? (
            <button type="button" className="btn btn-ghost btn-klein" onClick={() => onGaNaar(s.tab!)}>
              {s.staat === "af" ? "Bekijken" : "Openen"} <PijlRechts />
            </button>
          ) : null}
        </div>
      )}
    </div>
  );
}

function LinkTegel({ slug, s, waarde, onOpgeslagen }: {
  slug: string;
  s: StapStand;
  waarde: string;
  onOpgeslagen: () => void;
}) {
  const [veld, setVeld] = useState(waarde);
  const [bezig, setBezig] = useState(false);
  const [gemeld, setGemeld] = useState("");
  useEffect(() => setVeld(waarde), [waarde]);

  async function bewaar() {
    setBezig(true); setGemeld("");
    const actie = LINK_ACTIE[s.key];
    try {
      const r = await fetch("/api/admin/clients", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action: actie, [actie]: veld }),
      });
      const d = await r.json();
      setGemeld(d.ok ? "Bewaard." : (d.error || "Opslaan mislukt."));
      if (d.ok) onOpgeslagen();
    } catch { setGemeld("Opslaan mislukt."); } finally { setBezig(false); }
  }

  return (
    <div className={`fnd-tegel fnd-staat-${s.staat}`} title={s.waarom}>
      <div className="fnd-tegel-kop">
        <strong>{s.label}</strong>
        <span className={`ob-chip ob-${s.staat}`}>{STAAT_TEKST[s.staat]}</span>
      </div>
      <div className="fnd-link-row">
        <input
          className="compose-input"
          value={veld}
          placeholder={LINK_PLACEHOLDER[s.key]}
          onChange={(e) => setVeld(e.target.value)}
        />
        {veld.trim() && <a className="btn btn-quiet btn-klein" href={veld.trim()} target="_blank" rel="noreferrer">Open</a>}
        <button type="button" className="btn btn-ghost btn-klein" onClick={() => void bewaar()} disabled={bezig}>
          {bezig ? "Opslaan…" : "Bewaren"}
        </button>
        {gemeld && <span className="saved-msg">{gemeld}</span>}
      </div>
    </div>
  );
}

export default function FundamentPanel({ slug, positioneringUrl, huisstijlUrl, adsAccountUrl, onGaNaar }: {
  slug: string;
  positioneringUrl: string;
  huisstijlUrl: string;
  adsAccountUrl: string;
  onGaNaar?: (tab: string) => void;
}) {
  const [stand, setStand] = useState<Stand | null>(null);
  const [fout, setFout] = useState("");

  const haal = useCallback(() => {
    fetch(`/api/admin/onboarding?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) { setStand(d.stand); setFout(""); } else setFout(d.error || "Kon de stand niet ophalen."); })
      .catch(() => setFout("Kon de stand niet ophalen."));
  }, [slug]);

  useEffect(() => { haal(); }, [haal]);

  const gaNaar = (tab: string) => onGaNaar?.(tab);
  const waardeVoor = (key: string) => (key === "positionering" ? positioneringUrl : key === "huisstijl" ? huisstijlUrl : adsAccountUrl) || "";

  if (!stand) {
    return (
      <div className="cockpit-card acc-orange">
        <div className="ck-section-head"><span>Fundament</span></div>
        <p className="muted">{fout || "Bezig met kijken wat er al staat…"}</p>
      </div>
    );
  }

  return (
    <>
      {BLOKKEN.map((blok) => {
        const stappen = stand.stappen.filter((s) => s.blok === blok);
        if (!stappen.length) return null;
        return (
          <div className="cockpit-card acc-orange" key={blok}>
            <div className="ck-section-head">
              <span>
                {BLOK_TITEL[blok]}{" "}
                {blok === "aansluiten" && (
                  <HelpHint
                    title="Het fundament van deze klant"
                    text={"In één oogopslag wat er staat en wat nog moet, live afgelezen uit de echte gegevens: er wordt niets apart bijgehouden, dus dit kan nooit een ander verhaal vertellen dan de rest van het dashboard.\n\n**Aansluiten** zijn de koppelingen waar alle data vandaan komt. **" + BLOK_LABEL.kennen + "** is wie de klant is: profiel, tone of voice, bedrijfsgegevens, concurrenten, positionering en huisstijl.\n\nDe volledige checklist (ook de site-brede scans en de strategie) staat op het tabblad Onboarding, met dezelfde cijfers."}
                  />
                )}
              </span>
            </div>
            <div className="fnd-grid">
              {stappen.map((s) => {
                if (LINK_VELDEN.has(s.key)) {
                  return <LinkTegel key={s.key} slug={slug} s={s} waarde={waardeVoor(s.key)} onOpgeslagen={haal} />;
                }
                const actieKind = ACTIE_VOOR[s.key];
                const extra = actieKind && s.staat !== "af"
                  ? <FundamentActieKnop slug={slug} kind={actieKind} live onKlaar={() => haal()} />
                  : undefined;
                return <Tegel key={s.key} s={s} onGaNaar={gaNaar} extra={extra} ankerHref={ANKER_VOOR[s.key]} />;
              })}
            </div>
          </div>
        );
      })}
    </>
  );
}
