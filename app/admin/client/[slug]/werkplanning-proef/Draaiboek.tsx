"use client";

// ═══════════════════════════════════════════════════════════
// HET DRAAIBOEK VAN ÉÉN BLOK WERK, OP HET SCHERM
// ═══════════════════════════════════════════════════════════
// Dertien stappen in de enige volgorde die klopt, met per stap wie er aan zet is
// en of hij al kan. Maartens twee eisen zitten er hard in:
//
//   1. HIJ ZET ELKE STAP ZELF AAN, ook de stappen die het dashboard kan doen.
//      Elke stap staat op "handmatig" tot hij hem zelf op "gaat vanzelf" zet.
//   2. DE COPY BEOORDEELT HIJ ALTIJD. Bij die stap staat geen modus-knop, want
//      die kan niet op automatisch. Dat is geen instelling maar een eigenschap.
//
// Knoppen: hooguit twee per regel, en alleen op de regel die aan de beurt is.
// Een regel die wacht heeft geen enkele knop, wel de reden waarop hij wacht.
// Dertien regels met elk drie knoppen zou precies de knoppenbrij zijn waar deze
// pagina al twee keer aan onderdoor ging.

import { useCallback, useEffect, useState } from "react";
import { netteHtml } from "../../../../../lib/nette-html";
import { Chip, Chips } from "../../../../_ui/Uitkomst";
import {
  bouwDraaiboek, STAND_LABEL, WIE_LABEL,
  type Draaiboek as DraaiboekVorm, type StapSleutel, type StapStand,
} from "../../../../../lib/cluster-draaiboek";
import { bouwAlles, blijvendePaginas } from "../../../../../lib/cluster-uitvoering";
import type { Werkcluster } from "../../../../../lib/werkplan";

/** Welke stappen rekent het dashboard zelf uit, zonder AI en zonder wachten. */
const REKENSTAPPEN: StapSleutel[] = ["termverdeling", "verdict", "linkplan", "bouwpakket"];

function heeftSamenvoeging(c: Werkcluster): boolean {
  return c.paginas.some((p) => p.handeling === "samenvoegen" || p.handeling === "opruimen");
}

/** De voortgangsstreep op de kop van een blok: dertien stipjes, net als de fases op een taak. */
export function Fasestreep({ cluster, standen }: { cluster: Werkcluster; standen: StapStand[] }) {
  const d = bouwDraaiboek(cluster.naam, standen, { heeftSamenvoeging: heeftSamenvoeging(cluster) });
  return (
    <span className="wp-fasestreep" title={`${d.klaar} van de ${d.totaal} stappen klaar`}>
      {d.stappen.filter((s) => !s.nvt).map((s) => (
        <span key={s.sleutel}
          className={"wp-fasestip" + (s.stand === "klaar" || s.stand === "overgeslagen" ? " af" : s.stand === "bezig" ? " bezig" : "")} />
      ))}
      <span className="wp-fasestreep-n">{d.klaar}/{d.totaal}</span>
    </span>
  );
}

export default function Draaiboek({ cluster, slug, domein, opVerandering }: {
  cluster: Werkcluster; slug: string; domein?: string | null; opVerandering: () => void;
}) {
  const [d, setD] = useState<DraaiboekVorm | null>(null);
  const [laden, setLaden] = useState(true);
  const [bezig, setBezig] = useState<StapSleutel | null>(null);
  const [fout, setFout] = useState("");
  const [melding, setMelding] = useState("");
  const [openResultaat, setOpenResultaat] = useState<Record<string, boolean>>({});
  // Standaard dicht. Het zijn elke keer dezelfde dertien stappen, dus als lijst
  // voegt het niets toe; wat je wilt weten (hoever staat het, wat is de volgende
  // stap) staat op de kop. Maartens woorden: "ik zou niet weten waarom ik dat nu
  // elke keer uitgeklapt zou willen zien."
  const [openLijst, setOpenLijst] = useState(false);

  const samen = heeftSamenvoeging(cluster);

  const laad = useCallback(async () => {
    setLaden(true);
    try {
      const r = await fetch(
        `/api/admin/cluster-draaiboek?slug=${encodeURIComponent(slug)}&cluster=${encodeURIComponent(cluster.naam)}&samenvoeging=${samen ? "ja" : "nee"}`,
      ).then((x) => x.json());
      if (r?.ok) setD(r.draaiboek);
      else setFout(r?.error || "Het draaiboek kon niet geladen worden.");
    } catch { setFout("Het draaiboek kon niet geladen worden."); }
    finally { setLaden(false); }
  }, [slug, cluster.naam, samen]);

  useEffect(() => { laad(); }, [laad]);

  async function stuur(stap: StapSleutel, actie: string, extra: Record<string, unknown> = {}) {
    setBezig(stap); setFout(""); setMelding("");
    try {
      const r = await fetch("/api/admin/cluster-draaiboek", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, cluster: cluster.naam, stap, actie, heeftSamenvoeging: samen, ...extra }),
      }).then((x) => x.json());
      if (r?.ok) { setD(r.draaiboek); setMelding(r.melding || ""); opVerandering(); }
      else setFout(r?.error || "Dat lukte niet.");
    } catch { setFout("Dat lukte niet."); }
    finally { setBezig(null); }
  }

  function start(stap: StapSleutel) {
    // Een rekenstap heeft geen motor nodig: het dashboard rekent hem hier uit en
    // stuurt de uitkomst mee, zodat hij meteen klaar is.
    if (REKENSTAPPEN.includes(stap)) {
      const alles = bouwAlles(cluster);
      const resultaat =
        stap === "termverdeling"
          ? alles.termen.map((t) => `- **${t.pad}** (${t.rol})${t.krijgt.length ? `\n  - krijgt: ${t.krijgt.join(", ")}` : ""}${t.staatAf.length ? `\n  - staat af: ${t.staatAf.join(", ")}` : ""}`).join("\n")
        : stap === "verdict"
          ? alles.verdicten.map((v) => `- **${v.pad}**: ${v.verdict}. ${v.waarom}`).join("\n")
        : stap === "linkplan"
          ? ["| Op deze pagina | Link naar | Ankertekst |", "|---|---|---|",
             ...alles.links.map((l) => `| ${l.van} | ${l.naar} | ${l.anker} |`)].join("\n")
          : alles.pakket;
      return stuur(stap, "start", { resultaat });
    }
    // De drie AI-stappen draaien op de documentmotor, één run per blijvende pagina.
    if (stap === "analyse" || stap === "blauwdruk" || stap === "copy") {
      return stuur(stap, "start", { urls: blijvendePaginas(cluster).map((p) => p.pad) });
    }
    return stuur(stap, "start");
  }

  if (laden && !d) return <p className="muted">Draaiboek laden…</p>;
  if (!d) return <p className="muted">{fout || "Geen draaiboek."}</p>;

  // De eerstvolgende stap staat op de kop, zodat je hem ziet zonder open te klappen.
  const volgendeStap = d.stappen.find((s) => !s.nvt && s.sleutel === d.volgende);

  return (
    <div className="wp-draaiboek">
      <div className="kpi-sub-head wp-clus-kop">
        <button type="button" className="deelkop" aria-expanded={openLijst}
          onClick={() => setOpenLijst((v) => !v)}>
          <span className="wp-clus-tekst">
            <span>Draaiboek: {d.klaar} van de {d.totaal} stappen klaar</span>
            <span className="wp-clus-sub">
              {volgendeStap
                ? `volgende stap: ${volgendeStap.nummer}. ${volgendeStap.naam} (${WIE_LABEL[volgendeStap.wie]})`
                : "alle stappen zijn afgerond"}
            </span>
          </span>
        </button>
        {openLijst && (
          <button type="button" className="btn btn-quiet btn-klein wp-linkstijl"
            onClick={() => stuur("inventaris", "opnieuw")}>
            opnieuw beginnen
          </button>
        )}
      </div>

      {fout && <Chips><Chip toon="let-op">{fout}</Chip></Chips>}
      {melding && <Chips><Chip toon="goed">{melding}</Chip></Chips>}

      {openLijst && d.stappen.filter((s) => !s.nvt).map((s) => {
        const werkt = bezig === s.sleutel;
        const resOpen = !!openResultaat[s.sleutel];
        return (
          <div key={s.sleutel} className={`wp-stap ${s.stand}`}>
            <span className="wp-stap-nr">{s.nummer}</span>
            <span className="wp-clus-tekst">
              <span className="wp-stap-naam">{s.naam}</span>
              <span className="wp-clus-sub">
                {WIE_LABEL[s.wie]} · {STAND_LABEL[s.stand]}
                {s.modus === "automatisch" && s.stand !== "klaar" ? " · gaat vanzelf" : ""}
                {s.wachtOp ? ` · ${s.wachtOp}` : ""}
                {s.notitie ? ` · ${s.notitie}` : ""}
              </span>
              <span className="wp-stap-uitleg">{s.uitleg}</span>
              {s.resultaat && (
                <button type="button" className="btn btn-quiet btn-klein wp-linkstijl wp-stap-meer"
                  onClick={() => setOpenResultaat((o) => ({ ...o, [s.sleutel]: !o[s.sleutel] }))}>
                  {resOpen ? "uitkomst verbergen" : "uitkomst bekijken"}
                </button>
              )}
            </span>
            <span className="wp-stap-acties">
              {s.stand === "klaar-om-te-starten" && (
                <>
                  <button type="button" className="btn btn-primary btn-klein" disabled={werkt}
                    onClick={() => start(s.sleutel)}>
                    {werkt ? "Bezig…" : "Start"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-klein" disabled={werkt}
                    onClick={() => stuur(s.sleutel, "overslaan")}>Overslaan</button>
                </>
              )}
              {s.stand === "bezig" && (
                <>
                  <button type="button" className="btn btn-primary btn-klein" disabled={werkt}
                    onClick={() => stuur(s.sleutel, "klaar")}>
                    {werkt ? "Bezig…" : "Afvinken"}
                  </button>
                  <button type="button" className="btn btn-ghost btn-klein" disabled={werkt}
                    onClick={() => stuur(s.sleutel, "terug")}>Terug</button>
                </>
              )}
              {(s.stand === "klaar" || s.stand === "overgeslagen" || s.stand === "mislukt") && (
                <button type="button" className="btn btn-ghost btn-klein" disabled={werkt}
                  onClick={() => stuur(s.sleutel, "terug")}>Opnieuw</button>
              )}
              {/* De modus, alleen waar hij bestaat. Bij het beoordelen van copy en
                  bij de bouwer staat hier niets: die kunnen nooit vanzelf. */}
              {s.magAutomatisch && s.stand !== "klaar" && (
                <button type="button" className="btn btn-quiet btn-klein wp-linkstijl" disabled={werkt}
                  onClick={() => stuur(s.sleutel, "modus", { modus: s.modus === "automatisch" ? "handmatig" : "automatisch" })}>
                  {s.modus === "automatisch" ? "zet ik liever zelf aan" : "laat vanzelf gaan"}
                </button>
              )}
            </span>
            {resOpen && s.resultaat && (
              <div className="wp-stap-uitkomst wp-proza">
                <div className="md" dangerouslySetInnerHTML={{ __html: netteHtml(s.resultaat, { basis: domein || undefined }) }} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
