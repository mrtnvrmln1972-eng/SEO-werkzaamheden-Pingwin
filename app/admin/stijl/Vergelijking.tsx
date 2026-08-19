"use client";

import { useEffect, useRef, useState } from "react";
import { BASIS, zelfdeThema, type Thema } from "../../../lib/proefstijl";

// ═══════════════════════════════════════════════════════════
// TWEE STANDEN NAAST ELKAAR, OP EEN SCHERM WAAR JE ECHT ZIT
// ═══════════════════════════════════════════════════════════
// De speelruimte kon al één ding heel goed: een richting aanzetten en die op élk
// beheerscherm laten doorwerken. Wat er niet kon, is het enige waar een keuze
// werkelijk op rust: twee richtingen tegelijk zien. Een proefstijl leeft in de
// browser, dus er staat er altijd precies één aan; je klikt heen en weer en
// vergelijkt uit je hoofd. Zo kiest niemand iets.
//
// Daarom laat dit blok de server het werk doen. Die draait al een browser voor
// de schermafbeeldingen, en die kan hetzelfde scherm twee keer fotograferen: één
// keer zoals het nu is, één keer in de richting die je hierboven koos. Wat je
// dan ziet is niet een voorbeeldblokje maar je eigen klantenlijst, je eigen
// takenpagina, met je eigen data erin.
//
// De foto in de richting is precies wat "vastleggen" zou opleveren: hij gebruikt
// dezelfde som als de vastgelegde huisstijl (themaNaarCss), niet een tweede
// berekening ernaast.
// ═══════════════════════════════════════════════════════════

export type Scherm = { naam: string; pad: string; wacht?: number };

type Stel = { richting: string; nu: string; nieuw: string };

/** Eén foto ophalen; geeft een adres terug dat direct in een <img> past. */
async function haalFoto(pad: string, wacht: number, stijl?: string): Promise<string> {
  const vraag = new URLSearchParams({ pad, wacht: String(wacht) });
  if (stijl) vraag.set("stijl", stijl);
  const r = await fetch(`/api/admin/kijkbeeld?${vraag.toString()}`);
  if (!r.ok) {
    let melding = "De foto maken lukte niet.";
    try {
      const d = await r.json();
      if (d?.error) melding = d.error;
    } catch {
      // Geen JSON terug: dan blijft de algemene melding staan.
    }
    throw new Error(melding);
  }
  return URL.createObjectURL(await r.blob());
}

export default function Vergelijking({ thema, schermen }: { thema: Thema; schermen: Scherm[] }) {
  const [pad, setPad] = useState(schermen[0]?.pad ?? "/admin");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [stel, setStel] = useState<Stel | null>(null);

  // De foto's leven als tijdelijk adres in de browser. Zonder opruimen houdt elke
  // vergelijking zijn beeld vast tot de pagina ververst, en dat zijn megabytes
  // per ronde.
  const vorige = useRef<string[]>([]);
  const ruimOp = () => {
    for (const adres of vorige.current) URL.revokeObjectURL(adres);
    vorige.current = [];
  };
  useEffect(() => ruimOp, []);

  const isBasis = zelfdeThema(thema, BASIS);
  const scherm = schermen.find((s) => s.pad === pad) ?? schermen[0];

  const maak = async () => {
    if (!scherm) return;
    setBezig(true);
    setFout("");
    try {
      const wacht = scherm.wacht ?? 2500;
      // Twee losse verzoeken tegelijk: elk maakt zijn eigen foto op de server, en
      // achter elkaar wachten zou de tijd verdubbelen voor iets waar je al even
      // op zit te kijken.
      const [nu, nieuw] = await Promise.all([
        haalFoto(scherm.pad, wacht),
        haalFoto(scherm.pad, wacht, thema.naam),
      ]);
      ruimOp();
      vorige.current = [nu, nieuw];
      setStel({ richting: thema.naam, nu, nieuw });
    } catch (e) {
      setFout((e as Error).message || "De foto maken lukte niet.");
    }
    setBezig(false);
  };

  return (
    <>
      <h3 className="stijl-h3">Naast elkaar op je eigen scherm</h3>
      <p className="stijl-p">
        Kiezen doe je door te vergelijken, en in je browser kan er maar één richting tegelijk
        aanstaan. Kies hier een scherm waar je veel zit; het dashboard fotografeert het twee keer,
        zoals het nu is en in de richting hierboven. Dat duurt ongeveer een halve minuut.
      </p>

      <div className="stijl-vergelijk-bediening">
        <label className="stijl-knop">
          <span className="stijl-knop-naam">Scherm</span>
          <select className="stijl-keuze" value={pad} onChange={(e) => setPad(e.target.value)}>
            {schermen.map((s) => <option key={s.pad} value={s.pad}>{s.naam}</option>)}
          </select>
        </label>
        <button type="button" className="btn btn-ghost" disabled={bezig || isBasis} onClick={maak}>
          {bezig ? "Bezig met fotograferen…" : "Leg ze naast elkaar"}
        </button>
        <a className="btn btn-quiet btn-klein" href={scherm?.pad ?? "/admin"} target="_blank" rel="noreferrer">
          Open dit scherm zelf
        </a>
      </div>

      {isBasis && (
        <p className="stijl-p stijl-p-klein">
          Kies eerst een andere richting hierboven. Naast de huidige stand leggen heeft pas zin als
          er iets te vergelijken valt.
        </p>
      )}
      {fout && <p className="beheer-fout stijl-fout">{fout}</p>}

      {stel && (
        <div className="stijl-vergelijk">
          <figure className="stijl-vergelijk-vak">
            <figcaption className="stijl-vergelijk-naam">Zoals het nu is</figcaption>
            <div className="stijl-vergelijk-beeld">
              <img src={stel.nu} alt="Het scherm zoals het er nu uitziet" />
            </div>
          </figure>
          <figure className="stijl-vergelijk-vak">
            <figcaption className="stijl-vergelijk-naam">{stel.richting}</figcaption>
            <div className="stijl-vergelijk-beeld">
              <img src={stel.nieuw} alt={`Hetzelfde scherm in de richting ${stel.richting}`} />
            </div>
          </figure>
        </div>
      )}
    </>
  );
}
