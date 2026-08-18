"use client";

import { useEffect, useState } from "react";
import HelpHint from "./HelpHint";

// ── De concurrenten van deze klant: één component, twee plekken ──
//
// Deze lijst stond verstopt achter een knopje in het Kansen-blok van het
// KPI's-tabje. Wie hem niet toevallig kende, vond hem niet, en dat is precies wat
// er gebeurde. Hij hoort thuis bij de klantgegevens, want het is klantkennis en
// geen scanuitkomst: wie jij als de concurrentie ziet, is een oordeel.
//
// Bewust één component en geen tweede invulveld. Twee plekken die hetzelfde
// bewaren lopen uit elkaar zodra iemand er één aanpast; dat is hier al vaker
// misgegaan. Het KPI's-tabje gebruikt dezelfde component.
//
// De lijst voedt: de kansenlijst (waar scoren zij en wij niet), de
// prioriteitenscan, de Google-profiel-motor en het Overview-gesprek.

export default function Concurrenten({ slug, compact = false, onOpgeslagen }: { slug: string; compact?: boolean; onOpgeslagen?: (domeinen: string[]) => void }) {
  const [velden, setVelden] = useState<string[]>(["", "", "", ""]);
  const [bezig, setBezig] = useState(false);
  const [gemeld, setGemeld] = useState("");

  const vul = (lijst: string[]) => setVelden([...lijst, "", "", "", ""].slice(0, 4));

  useEffect(() => {
    fetch(`/api/admin/competitors?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (d.ok) vul(d.competitors || []); })
      .catch(() => { /* leeg laten staan */ });
  }, [slug]);

  const bewaar = async () => {
    setBezig(true); setGemeld("");
    try {
      const r = await fetch("/api/admin/competitors", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, domains: velden }),
      });
      const d = await r.json();
      if (d.ok) { vul(d.competitors || []); setGemeld(`${(d.competitors || []).length} concurrenten bewaard.`); onOpgeslagen?.(d.competitors || []); }
      else setGemeld(d.error || "Opslaan mislukt.");
    } catch { setGemeld("Opslaan mislukt."); } finally { setBezig(false); }
  };

  const invoer = (
    <>
      <div className="muted comp-uitleg">
        Twee tot vier domeinen van de bedrijven waar deze klant het tegen opneemt. Alleen het domein,
        bijvoorbeeld voorbeeld.nl.
      </div>
      <div className="comp-inputs">
        {velden.map((v, i) => (
          <input key={i} className="compose-input" value={v} placeholder={`concurrent ${i + 1} (domein)`}
            onChange={(e) => setVelden((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))} />
        ))}
      </div>
      <div className="comp-acties">
        <button type="button" className="btn btn-klein" onClick={() => void bewaar()} disabled={bezig}>
          {bezig ? "Opslaan…" : "Concurrenten opslaan"}
        </button>
        {gemeld && <span className="saved-msg">{gemeld}</span>}
      </div>
    </>
  );

  if (compact) return <div className="comp-edit">{invoer}</div>;

  return (
    <div className="cockpit-card" id="fund-concurrenten">
      <div className="ck-section-head">
        <span>
          Concurrenten{" "}
          <HelpHint
            title="Concurrenten: wie jij als de concurrentie ziet"
            text={"Twee tot vier domeinen. Dit is klantkennis, geen scanuitkomst: de top 10 van Google laat zien wie er op één zoekterm staat, deze lijst zegt wie er in dit vak echt tegenover je staat.\n## Waar het voor gebruikt wordt\n- **Kansen:** waar scoren zij wel en wij niet (de gap).\n- **Prioriteitenscan:** zonder deze lijst blijft de kansenlijst leeg.\n- **Google-bedrijfsprofiel:** vergelijking van profiel en reviews.\n- **Overview:** het strategiegesprek weegt ze mee en kan opzoeken waar zij verkeer halen.\n## Hoe je ze kiest\nNiet de grootste namen van het land, maar de partijen die op dezelfde zoektermen en in hetzelfde werkgebied staan, met een vergelijkbare autoriteit. Een landelijke marktplaats die overal bovenaan staat is geen concurrent maar een gegeven."}
          />
        </span>
      </div>
      {invoer}
    </div>
  );
}
