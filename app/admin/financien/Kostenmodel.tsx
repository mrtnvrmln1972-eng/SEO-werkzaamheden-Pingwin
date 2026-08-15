"use client";

import { useState } from "react";
import type { KostenRegel } from "../../../lib/kostenmodel";

// ═══════════════════════════════════════════════════════════
// HET KOSTENMODEL OP HET SCHERM
// ═══════════════════════════════════════════════════════════
// Pingwin heeft geen kostenpost per klant maar drie soorten regels, en die
// passen zichzelf toe. Dit paneel laat in gewone taal zien wat er gebeurt, en
// heeft precies één knop: de bedragen vullen uit de boekhouding.
//
// Waarom regels en geen invulvelden per klant: een bedrag dat je per klant met
// de hand invult, is de dag nadat je een tarief wijzigt alweer verkeerd, en dat
// merkt niemand. "70% van wat ik die klant factureer" blijft kloppen.
// ═══════════════════════════════════════════════════════════

function euro(n: number): string {
  const a = Math.round(n);
  return (a < 0 ? "− € " : "€ ") + Math.abs(a).toLocaleString("nl-NL");
}

const SOORT_UITLEG: Record<string, string> = {
  percentage: "een deel van wat jij die klanten factureert",
  verdeel: "de maandfactuur verdeeld over die klanten",
  vast: "een vaste maandpost, niet toegerekend aan een klant",
};

type Props = {
  regels: KostenRegel[];
  meldingen: string[];
  herlaad: (data: unknown) => void;
};

export default function Kostenmodel({ regels, meldingen, herlaad }: Props) {
  const [bezig, zetBezig] = useState(false);
  const [fout, zetFout] = useState("");
  const [melding, zetMelding] = useState("");

  async function stuur(body: unknown) {
    zetBezig(true); zetFout("");
    try {
      const r = await fetch("/api/admin/prognose", {
        method: body && (body as { actie?: string }).actie ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { zetFout(d.error || "Opslaan mislukt."); return null; }
      herlaad(d);
      return d;
    } catch { zetFout("De server is niet bereikbaar."); return null; } finally { zetBezig(false); }
  }

  async function vullen() {
    zetMelding("");
    const d = await stuur({ actie: "kostenmodel-vullen" });
    if (!d) return;
    const gevonden: string[] = d.gevonden || [];
    const gemist: string[] = d.gemist || [];
    zetMelding(
      [
        gevonden.length ? `Opgehaald: ${gevonden.join("; ")}.` : "",
        gemist.length ? `Niet gevonden in de boekhouding: ${gemist.join(", ")}. Pas de leveranciersnaam hieronder aan.` : "",
      ].filter(Boolean).join(" "),
    );
  }

  return (
    <div className="card">
      <div className="prog-kop">
        <div className="prog-kop-titel">Kostenmodel</div>
        <div className="prog-kop-uitleg">
          Je kosten zitten niet per klant vast maar volgen regels, en die passen zichzelf toe. Wijzig je
          het maandbedrag van een klant, dan beweegt de kostenkant mee. Er valt hier niets aan te vinken;
          één knop haalt de bedragen uit de boekhouding.
        </div>
        <div className="prog-kop-acties">
          <button type="button" className="btn btn-primary btn-klein" onClick={vullen} disabled={bezig}>
            {bezig ? "Bezig" : "Bedragen ophalen uit Moneybird"}
          </button>
        </div>
      </div>

      {fout && <div className="login-error">{fout}</div>}
      {melding && <div className="prog-kop-uitleg">{melding}</div>}

      {regels.map((r) => (
        <div className="prog-kostenregel" key={r.id}>
          <div className="prog-kostenregel-kop">
            <span className={"prog-chip " + (r.actief ? "klant" : "koel")}>{r.actief ? "aan" : "uit"}</span>
            <strong>{r.naam}</strong>
            <span className="prog-gat">{SOORT_UITLEG[r.soort]}</span>
            <button
              type="button"
              className="btn btn-quiet btn-klein prog-kostenregel-uit"
              disabled={bezig}
              onClick={() => stuur({ kostenregel: { id: r.id, actief: !r.actief } })}
            >
              {r.actief ? "uitzetten" : "aanzetten"}
            </button>
          </div>

          <div className="prog-kop-uitleg">{r.bron}</div>

          <div className="prog-instel">
            <div className="prog-instel-veld">
              <label htmlFor={`lev-${r.id}`}>Leverancier in de boekhouding</label>
              <input
                id={`lev-${r.id}`} defaultValue={r.leverancier} disabled={bezig}
                onBlur={(e) => { if (e.target.value.trim() !== r.leverancier) stuur({ kostenregel: { id: r.id, leverancier: e.target.value } }); }}
              />
            </div>

            {r.soort === "percentage" ? (
              <div className="prog-instel-veld">
                <label htmlFor={`pct-${r.id}`}>Percentage van de omzet</label>
                <input
                  id={`pct-${r.id}`} inputMode="numeric" defaultValue={String(r.percentage)} disabled={bezig}
                  onBlur={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(n) && n !== r.percentage) stuur({ kostenregel: { id: r.id, percentage: n } });
                  }}
                />
              </div>
            ) : (
              <div className="prog-instel-veld">
                <label htmlFor={`bed-${r.id}`}>Bedrag per maand</label>
                <input
                  id={`bed-${r.id}`} inputMode="numeric" defaultValue={String(Math.round(r.bedrag))} disabled={bezig}
                  onBlur={(e) => {
                    const n = Number(e.target.value.replace(",", "."));
                    if (Number.isFinite(n) && Math.round(n) !== Math.round(r.bedrag)) stuur({ kostenregel: { id: r.id, bedrag: n } });
                  }}
                />
              </div>
            )}

            {r.soort === "percentage" && r.bedrag > 0 && (
              <div className="prog-instel-veld">
                <label>Werkelijk gefactureerd</label>
                <span className="prog-kostenregel-check">{euro(r.bedrag)} per maand</span>
              </div>
            )}
          </div>
        </div>
      ))}

      {meldingen.length > 0 && (
        <div className="prog-boek-melding">
          {meldingen.map((m, i) => <span className="prog-gat" key={i}>{m}</span>)}
        </div>
      )}

      <div className="prog-kop-uitleg">
        Een klant die onder een regel valt, gebruikt die regel; een klant zonder regel gebruikt zijn eigen
        linkbuildingbedrag. Nooit allebei, dus er wordt nergens dubbel geteld.
      </div>
    </div>
  );
}
