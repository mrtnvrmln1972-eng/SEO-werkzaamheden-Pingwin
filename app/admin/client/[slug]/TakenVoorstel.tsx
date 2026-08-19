"use client";

// Het takenvoorstel uit de oogst-stap van de bird's eye.
//
// Waarom dit bestaat: de knopjes hingen vroeger aan ELKE bullet in een antwoord, en
// een regex moest per regel raden of het werk was. Dat ging mis bij constateringen
// ("Foto's met locatiecontext versterken dit") en het gebeurde midden in een gesprek
// waarin nog gedacht werd. Nu weegt de assistent het HELE gesprek in één bewuste
// stap en levert hij een VOORSTEL: Maarten vinkt aan wat er echt in de weekplanning
// hoort. Wat bewust géén taak is staat er grijs onder, zodat zichtbaar blijft dat
// het is meegewogen en er niets stilletjes wegvalt.

import { useState } from "react";
import { linkifyHtml as linkify } from "../../../../lib/linkify";
import { devLabel } from "../../../../lib/personen";
import { Omlaag, Uitklap } from "../../../_ui/Pijl";

export type OogstTaak = {
  taak: string; waarom: string; info?: string; url?: string; taaktype?: string;
  week?: number; wie?: string; zekerheid: "hoog" | "middel" | "laag";
};
export type Oogst = { taken: OogstTaak[]; geenTaak: string[]; verwerkt?: boolean };

const ZEKER_LABEL: Record<string, string> = { hoog: "duidelijk", middel: "waarschijnlijk", laag: "suggestie" };

export default function TakenVoorstel({ slug, thread, index, oogst, domain = "", onWeekplanChanged, onVerwerkt }: {
  slug: string;
  thread: string;
  index: number;              // plek van dit voorstel in de gespreksgeschiedenis
  oogst: Oogst;
  domain?: string;
  onWeekplanChanged?: () => void;
  onVerwerkt?: () => void;
}) {
  // Een suggestie ("laag") staat bewust uit: die kiest Maarten zelf bij, in plaats van
  // dat hij hem moet wegklikken. Wat duidelijk uit het gesprek volgt staat aan.
  const [aan, setAan] = useState<boolean[]>(() => oogst.taken.map((t) => t.zekerheid !== "laag"));
  const [titels, setTitels] = useState<string[]>(() => oogst.taken.map((t) => t.taak));
  const [busy, setBusy] = useState(false);
  const [melding, setMelding] = useState("");
  const [fout, setFout] = useState("");
  const [klaar, setKlaar] = useState(!!oogst.verwerkt);
  const [toonGeen, setToonGeen] = useState(false);

  // Bespreeklijst per taak: hetzelfde menuutje als bij de projectkaarten.
  const [lijstVoor, setLijstVoor] = useState<number | null>(null);
  const [personen, setPersonen] = useState<string[]>(["Klant", "Dev"]);
  const [devNaam, setDevNaam] = useState<string | null>(null);

  async function laadPersonen() {
    try {
      const d = await fetch(`/api/admin/discuss?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d?.ok) {
        setPersonen([...new Set(["Klant", "Dev", ...(d.items || []).map((i: { persoon: string }) => i.persoon)])] as string[]);
        setDevNaam(d.devName || null);
      }
    } catch { /* dan de standaardkeuzes */ }
  }

  async function opLijst(i: number, persoon: string) {
    setLijstVoor(null);
    const t = oogst.taken[i];
    const tekst = `${titels[i] || t.taak}${t.waarom ? ` (${t.waarom})` : ""}`;
    try {
      const d = await fetch("/api/admin/discuss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", slug, persoon, tekst }) }).then((r) => r.json());
      if (d?.ok) {
        setAan((v) => v.map((x, j) => (j === i ? false : x)));   // staat nu ergens anders, niet meer in dit voorstel
        setMelding(`Op de bespreeklijst van ${persoon === "Dev" ? devLabel(devNaam) : persoon} gezet.`);
      } else setFout(d?.error || "Op de lijst zetten mislukte.");
    } catch { setFout("Op de lijst zetten mislukte."); }
  }

  const aantalAan = aan.filter(Boolean).length;

  async function wegzetten() {
    if (busy || !aantalAan) return;
    setBusy(true); setMelding(""); setFout("");
    try {
      const gekozen = oogst.taken.map((t, i) => ({ ...t, taak: (titels[i] || t.taak).trim() })).filter((_, i) => aan[i]);
      const r = await fetch("/api/admin/overview/oogst", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, thread, stap: "wegzetten", index, taken: gekozen }),
      });
      const d = await r.json();
      if (d?.ok && (d.added || d.merged)) {
        const delen: string[] = [];
        if (d.added) delen.push(`${d.added} ${d.added === 1 ? "nieuwe kaart" : "nieuwe kaarten"}`);
        if (d.merged) delen.push(`${d.merged} bestaande ${d.merged === 1 ? "paginakaart" : "paginakaarten"} aangevuld`);
        setMelding(`${delen.join(" en ")} in de weekplanning.`);
        setKlaar(true);
        onWeekplanChanged?.();
        onVerwerkt?.();
      } else setFout(d?.error || `Kon de kaarten niet maken (server gaf status ${r.status}). Probeer het nog een keer.`);
    } catch { setFout("Kon de kaarten niet maken. Probeer het nog een keer."); }
    finally { setBusy(false); }
  }

  const pad = (u?: string) => {
    if (!u) return "";
    try { return new URL(u).pathname; } catch { return u; }
  };

  return (
    <div className="tv-blok">
      <div className="tv-kop">
        <span className="tv-koptitel">Wat volgt hieruit</span>
        <span className="tv-kopmeta">
          {oogst.taken.length === 0
            ? "geen werk gevonden"
            : `${oogst.taken.length} ${oogst.taken.length === 1 ? "voorstel" : "voorstellen"}, ${aantalAan} aangevinkt`}
        </span>
      </div>

      {oogst.taken.length === 0 && (
        <p className="tv-leeg">Uit dit gesprek volgt geen concreet werk. Wat er besproken is staat hieronder.</p>
      )}

      {oogst.taken.map((t, i) => (
        <div key={i} className={"tv-rij" + (aan[i] ? " aan" : "")}>
          <input
            type="checkbox"
            className="tv-vink"
            checked={!!aan[i]}
            disabled={klaar}
            onChange={(e) => setAan((v) => v.map((x, j) => (j === i ? e.target.checked : x)))}
            title="Neem deze taak mee naar de weekplanning"
          />
          <div className="tv-tekst">
            <input
              className="tv-titel"
              value={titels[i]}
              disabled={klaar}
              onChange={(e) => setTitels((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
              placeholder="Taakomschrijving"
              maxLength={200}
            />
            {t.waarom && <span className="tv-waarom">{t.waarom}</span>}
            <div className="tv-meta">
              <span className={"tv-chip tv-zeker-" + t.zekerheid}>{ZEKER_LABEL[t.zekerheid] || t.zekerheid}</span>
              {t.week ? <span className="tv-chip">week {t.week}</span> : null}
              {t.wie ? <span className="tv-chip">{t.wie === "Dev" ? devLabel(devNaam) : t.wie}</span> : null}
              {t.url ? <span className="tv-pad" dangerouslySetInnerHTML={{ __html: linkify(pad(t.url), domain) }} /> : null}
            </div>
          </div>
          {!klaar && (
            <div className="tv-rij-acties">
              <button type="button" className="tv-lijst-btn" title="Zet dit op een bespreeklijst in plaats van in de weekplanning"
                onClick={() => { setLijstVoor(lijstVoor === i ? null : i); void laadPersonen(); }}>&raquo;</button>
              {lijstVoor === i && (
                <div className="tv-lijstpop">
                  {personen.map((p) => (
                    <button key={p} type="button" onClick={() => void opLijst(i, p)}>{p === "Dev" ? devLabel(devNaam) : p}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {oogst.geenTaak.length > 0 && (
        <div className="tv-geen">
          <button type="button" className="tv-geen-kop" onClick={() => setToonGeen((v) => !v)}>
            <span className="tv-geen-pijl">{toonGeen ? <Omlaag /> : <Uitklap />}</span>
            Besproken, maar bewust geen taak ({oogst.geenTaak.length})
          </button>
          {toonGeen && (
            <ul className="tv-geen-lijst">
              {oogst.geenTaak.map((r, i) => <li key={i} dangerouslySetInnerHTML={{ __html: linkify(r, domain) }} />)}
            </ul>
          )}
        </div>
      )}

      {!klaar && oogst.taken.length > 0 && (
        <div className="tv-voet">
          <button type="button" className="btn btn-primary btn-klein" disabled={busy || !aantalAan} onClick={() => void wegzetten()}>
            {busy ? "Bezig…" : `Zet ${aantalAan} ${aantalAan === 1 ? "taak" : "taken"} in de weekplanning`}
          </button>
        </div>
      )}
      {klaar && <div className="tv-klaar">Dit voorstel is verwerkt.</div>}
      {melding && !fout && <div className="tv-melding ok">{melding}</div>}
      {fout && <div className="tv-melding err">{fout}</div>}
    </div>
  );
}
