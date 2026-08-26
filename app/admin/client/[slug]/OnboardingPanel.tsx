"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BLOK_LABEL, BLOK_UITLEG, type Blok, type Stand, type StapStand } from "../../../../lib/onboarding-stappen";
import type { RunStand, Regel } from "../../../../lib/onboarding-run";
import Voortgang from "./Voortgang";
import { PijlRechts, Omlaag, Uitklap } from "../../../_ui/Pijl";

// ═══════════════════════════════════════════════════════════
// ONBOARDING: ÉÉN SCHERM MET DE VASTE VOLGORDE
// ═══════════════════════════════════════════════════════════
// Wat er per klant af is, wat er nog moet, en wat er op wie wacht. De volgorde,
// de teksten en de status komen allemaal uit lib/onboarding.ts; dit scherm
// bedenkt niets zelf. Eén knop start alles wat vanzelf kan en slaat over wat al
// staat, dus dezelfde knop werkt voor een nieuwe klant en voor een klant die al
// jaren loopt.
// ═══════════════════════════════════════════════════════════

const BLOKKEN: Blok[] = ["aansluiten", "kennen", "meten", "werken"];

const STAAT_TEKST: Record<StapStand["staat"], string> = {
  af: "Staat",
  bezig: "Draait",
  verouderd: "Loopt achter",
  open: "Nog te doen",
};

function Bolletje({ staat }: { staat: StapStand["staat"] }) {
  return <span className={`ob-bol ob-${staat}`} aria-hidden="true">{staat === "af" ? "✓" : staat === "bezig" ? "◍" : staat === "verouderd" ? "!" : ""}</span>;
}

export default function OnboardingPanel({ slug, onGaNaar, alleenKop }: { slug: string; onGaNaar: (tab: string) => void;
  /** Alleen de kop tonen: hoe ver deze klant staat, de knop die aanvult wat nog
      ontbreekt, en het verslag van de laatste rit. De stappen zelf staan als
      tegels in FundamentPanel eronder. Zo is er één scherm in plaats van twee
      die dezelfde cijfers uit dezelfde bron halen en toch uit elkaar konden
      lopen. Zelfde aanpak als `alleenProfiel` bij de paginalijst. */
  alleenKop?: boolean }) {
  const [stand, setStand] = useState<Stand | null>(null);
  const [run, setRun] = useState<RunStand | null>(null);
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "13 van 18 af" zegt niets over wát er nog moet; "de vorige rit" is juist
  // vaak al bekend (je hebt hem net zien lopen) en stond toch altijd open.
  // Twee toggles, allebei standaard dicht op wat je net gedraaid hebt. Zie
  // Maartens woorden (25-08-2026): "13 van 18 is leuk, maar wat is er dan
  // nog niet gedaan?"
  const [openLijstOpen, setOpenLijstOpen] = useState(false);
  const [ritOpen, setRitOpen] = useState(false);

  const haal = useCallback(async () => {
    try {
      const d = await fetch(`/api/admin/onboarding?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (!d?.ok) { setFout(d?.error || "Kon de stand niet ophalen."); return; }
      setStand(d.stand); setRun(d.run); setFout("");
    } catch { setFout("Kon de stand niet ophalen."); }
    finally { setLaden(false); }
  }, [slug]);

  useEffect(() => { void haal(); }, [haal]);

  // Zolang de rit loopt of een scan draait: elke tien seconden verversen, en
  // daarna vanzelf stoppen. Geen eeuwig pollend scherm.
  useEffect(() => {
    const draait = run?.status === "running" || stand?.stappen.some((s) => s.staat === "bezig");
    if (!draait) { if (timer.current) clearTimeout(timer.current); return; }
    timer.current = setTimeout(() => { void haal(); }, 10000);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [run, stand, haal]);

  async function start() {
    if (bezig) return;
    setBezig(true);
    try {
      const d = await fetch("/api/admin/onboarding", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      }).then((r) => r.json());
      if (!d?.ok) setFout(d?.error || "Starten mislukte.");
      else { setFout(""); await haal(); }
    } catch { setFout("Starten mislukte."); }
    finally { setBezig(false); }
  }

  if (laden) return <div className="cockpit-card"><p className="muted">Bezig met kijken wat er al staat…</p></div>;
  if (!stand) return <div className="cockpit-card"><p className="ob-fout">{fout || "Geen gegevens."}</p></div>;

  const pct = stand.totaal ? Math.round((stand.af / stand.totaal) * 100) : 0;
  const eersteKeer = stand.af <= 2;
  const draait = run?.status === "running";

  return (
    <div className="ob-panel">
      {/* ── De kop: hoe ver staat deze klant, en de ene knop ── */}
      <div className="cockpit-card acc-orange">
        <div className="ck-section-head"><span>Onboarding</span></div>
        <p className="ob-inleiding">
          De vaste volgorde voor deze klant. Wat hier niet staat, kan niet gemeten worden: geen enkele scan of analyse
          start voordat de inventarisatie erachter klopt. Alles hieronder wordt live afgelezen uit de echte gegevens,
          er wordt niets apart bijgehouden.
        </p>

        <div className="ob-voortgang">
          <div className="ob-balk"><span style={{ width: `${pct}%` }} /></div>
          <strong>{stand.af} van {stand.totaal} af</strong>
          {stand.klaar && <span className="ob-chip ob-af">Alles staat</span>}
        </div>

        {/* Niet meer "Nog open: X, Y en 3 meer": een afgekapte lijst dwong je
            om toch naar Fundament te gaan om te zien wát er nog moest. Nu de
            volledige lijst, dicht bij de balk waar hij bij hoort, standaard
            ingeklapt. */}
        {stand.mist.length > 0 && (
          <div className="ob-open-toggle">
            <button type="button" className="btn btn-quiet btn-klein" onClick={() => setOpenLijstOpen((v) => !v)}>
              {openLijstOpen ? <Omlaag /> : <Uitklap />} Wat staat er nog open? ({stand.mist.length})
            </button>
            {openLijstOpen && (
              <ul className="ob-open-lijst">
                {stand.stappen.filter((s) => !s.optioneel && (s.staat === "open" || s.staat === "verouderd")).map((s) => (
                  <li key={s.key}>
                    <span className={`ob-chip ob-${s.staat}`}>{STAAT_TEKST[s.staat]}</span>
                    <strong>{s.label}</strong> <span className="muted">{s.detail}</span>
                    {s.tab && (
                      <button type="button" className="btn btn-ghost btn-klein" onClick={() => onGaNaar(s.tab!)}>
                        Openen <PijlRechts />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="ob-acties">
          <button type="button" className="btn btn-primary" onClick={start} disabled={bezig || draait}>
            {draait ? "Bezig…" : eersteKeer ? "Start de onboarding" : "Vul aan wat nog ontbreekt"}
          </button>
          <span className="muted">
            Doet alles wat zonder jou kan, in volgorde. Wat al staat wordt overgeslagen, dus je kunt hier altijd op
            klikken, ook bij een klant die al jaren loopt.
          </span>
        </div>

        {fout && <p className="ob-fout">{fout}</p>}

        {draait && (
          <div style={{ marginTop: "var(--s-4)" }}>
            <Voortgang
              titel="Onboarding"
              label={run?.bezigMet || "Aan het werk"}
              stap={run?.regels.length || 0}
              stappen={9}
              sinds={run?.updatedAt}
            />
          </div>
        )}

        {run && run.status !== "idle" && (
          <div className="ob-log">
            {/* Standaard dicht: staat een rit nog te lopen, dan zet dat vanzelf
                open, want dan wil je live meekijken. Is hij klaar, dan is dit
                geschiedenis die je meestal niet meer hoeft te zien (25-08-2026). */}
            <button type="button" className="btn btn-quiet btn-klein ob-log-kop" onClick={() => setRitOpen((v) => !v)}>
              {(ritOpen || run.status === "running") ? <Omlaag /> : <Uitklap />}{" "}
              {run.status === "running" ? "Wat er tot nu toe gedaan is" : run.status === "error" ? "De vorige rit liep vast" : "De vorige rit"}
            </button>
            {(ritOpen || run.status === "running") && (
              <>
                {run.error && <p className="ob-fout">{run.error}</p>}
                <ul className="ob-log-lijst">
                  {run.regels.map((r: Regel, i: number) => (
                    <li key={`${r.key}-${i}`}>
                      <span className={`ob-chip ob-${r.uitkomst}`}>{
                        r.uitkomst === "gedaan" ? "gedaan" : r.uitkomst === "stond-al" ? "stond al" :
                        r.uitkomst === "gestart" ? "gestart" : r.uitkomst === "mislukt" ? "mislukt" : "aan jou"
                      }</span>
                      <strong>{r.label}</strong> <span className="muted">{r.toelichting}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── De vier blokken ── */}
      {!alleenKop && BLOKKEN.map((blok) => {
        const stappen = stand.stappen.filter((s) => s.blok === blok);
        if (!stappen.length) return null;
        return (
          <div className="cockpit-card" key={blok}>
            <div className="ck-section-head"><span>{BLOK_LABEL[blok]}</span></div>
            <p className="ob-blok-uitleg">{BLOK_UITLEG[blok]}</p>
            <ul className="ob-lijst">
              {stappen.map((s) => (
                <li key={s.key} className={`ob-stap ob-staat-${s.staat}`}>
                  <Bolletje staat={s.staat} />
                  <div className="ob-stap-tekst">
                    <div className="ob-stap-kop">
                      <strong>{s.label}</strong>
                      <span className={`ob-chip ob-${s.staat}`}>{STAAT_TEKST[s.staat]}</span>
                      {s.optioneel && <span className="ob-chip ob-optioneel">mag later</span>}
                      {s.staat !== "af" && s.staat !== "bezig" && (
                        <span className="ob-chip ob-wie">{s.door === "jij" ? "jij" : "het dashboard"}</span>
                      )}
                    </div>
                    <p className="ob-detail">{s.detail}</p>
                    <p className="ob-waarom">{s.waarom}</p>
                    {s.wacht.length > 0 && (
                      <p className="ob-wacht">Kan nog niet: eerst {s.wacht.map((w) => w.label.toLowerCase()).join(" en ")}.</p>
                    )}
                  </div>
                  {s.tab && s.staat !== "af" && (
                    <button type="button" className="btn btn-klein" onClick={() => onGaNaar(s.tab!)}>Ga erheen <PijlRechts /></button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
