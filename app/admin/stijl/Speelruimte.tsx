"use client";

import { useEffect, useState } from "react";
import {
  BASIS, RICHTINGEN, LETTERTYPES, leesProefstijl, bewaarProefstijl, zelfdeThema, type Thema,
} from "../../../lib/proefstijl";

// ═══════════════════════════════════════════════════════════
// DE SPEELRUIMTE: DRAAIEN AAN HET ONTWERP, EN METEEN ZIEN
// ═══════════════════════════════════════════════════════════
// Dit is waar stap 4 om draaide. De eerste drie stappen veranderden niets aan
// hoe het dashboard eruitziet; ze zorgden ervoor dat álles uit dezelfde handvol
// namen leest. Daardoor kan dit paneel iets wat eerder onmogelijk was: één
// waarde veranderen en het hele dashboard verandert mee, live, zonder bouw.
//
// WAAROM DIT GEEN VOORBEELDBLOKJE IS
// ──────────────────────────────────
// De verleiding is een blokje "voorbeeld" te tekenen waarin je een knop en een
// kaart ziet. Dat is wat elke ontwerptool op internet doet, en het is precies
// wat niet werkt: je moet zien hoe een filterrij met acht velden ademt en hoe
// een tabel met tien kolommen oogt bij minder ruimte. Daarom schrijft dit paneel
// de waarden op de pagina zélf.
//
// EN SINDS 18-08-2026 OOK OP ELK ANDER SCHERM
// ───────────────────────────────────────────
// Maartens vraag was de goede: "als ik hier iets kies, waar zie ik dan hoe dat
// uitpakt?" Het antwoord was toen: nergens, want de stand leefde alleen op deze
// pagina. Nu wordt hij bewaard en op élk beheerscherm toegepast, met een balkje
// bovenin. Je kiest hier, je loopt naar je takenpagina en je klantkaart, en je
// ziet het daar echt. Want daar beoordeel je een ontwerp, niet op de
// instellingenpagina.
//
// Het toepassen zelf staat in lib/proefstijl.ts, want de schil om alle
// beheerschermen doet precies hetzelfde. Twee keer uitschrijven is de fout die
// in dit project al zeven keer is opgeschreven.
// ═══════════════════════════════════════════════════════════

export default function Speelruimte() {
  const [thema, setThema] = useState<Thema>(BASIS);
  const [open, setOpen] = useState(false);
  const [vast, setVast] = useState<Thema | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");

  // De opgeslagen stand overnemen bij het openen, zodat dit paneel laat zien
  // wat er werkelijk aanstaat in plaats van de uitgangsstand. En de vastgelegde
  // stijl erbij, zodat de knop kan zeggen of er nog iets te leggen valt.
  useEffect(() => {
    setThema(leesProefstijl() ?? BASIS);
    fetch("/api/admin/huisstijl")
      .then((r) => r.json())
      .then((d) => { if (d?.ok) setVast(d.thema ?? null); })
      .catch(() => {});
  }, []);

  // Vastleggen betekent: dit is vanaf nu gewoon hoe het dashboard eruitziet, ook
  // voor klanten. De proefstand gaat er daarna af (anders zou het balkje boven
  // blijven zeggen dat je naar een proef kijkt terwijl het de echte stijl is) en
  // de pagina wordt opnieuw geladen, want de stijl komt nu uit de server.
  const legVast = async (nieuw: Thema | null) => {
    setBezig(true);
    try {
      const r = await fetch("/api/admin/huisstijl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ thema: nieuw }),
      });
      const d = await r.json();
      if (!d?.ok) { setFout(d?.error || "Vastleggen lukte niet."); setBezig(false); return; }
      bewaarProefstijl(null);
      window.location.reload();
    } catch {
      setFout("Vastleggen lukte niet, de verbinding gaf niets terug.");
      setBezig(false);
    }
  };

  const kies = (t: Thema) => {
    setThema(t);
    bewaarProefstijl(zelfdeThema(t, BASIS) ? null : t);
  };
  const isBasis = zelfdeThema(thema, BASIS);
  // Staat er al precies dit vast? Dan valt er niets te leggen. "Niets vastgelegd"
  // en "de uitgangsstand" zijn hetzelfde, want een vastgelegde uitgangsstand
  // wordt niet bewaard; dat zou een instelling zijn die niets doet.
  const alVast = vast ? zelfdeThema(thema, vast) : isBasis;

  return (
    <div className="card section">
      <h2 className="stijl-h2">Speelruimte</h2>
      <p className="stijl-p">
        Draai hieraan en kijk wat er gebeurt. Alles wat je ziet verandert mee, hier én op elk
        ander beheerscherm: loop naar je takenpagina, je klantkaart of je agenda en je ziet het
        daar echt. Dat is waar de eerste drie stappen voor waren.
      </p>
      <p className="stijl-p stijl-p-klein">
        Draaien legt niets vast. De proef leeft in jouw browser, niemand anders ziet er iets van,
        en met "zet alles terug" is hij weg. Bevalt een richting, dan leg je hem onderaan dit
        paneel vast met één knop; vanaf dat moment is het gewoon hoe het dashboard eruitziet.
      </p>

      <h3 className="stijl-h3">Kies een richting</h3>
      <div className="stijl-richtingen">
        {RICHTINGEN.map((r) => {
          const gekozen = zelfdeThema(thema, r.thema);
          return (
            <button
              key={r.thema.naam}
              type="button"
              className={gekozen ? "btn btn-primary stijl-richting" : "btn btn-ghost stijl-richting"}
              onClick={() => kies(r.thema)}
            >
              <span className="stijl-richting-naam">{r.thema.naam}</span>
              <span className="stijl-richting-wat">{r.wat}</span>
            </button>
          );
        })}
      </div>

      <h3 className="stijl-h3">Zelf bijsturen</h3>
      <div className="stijl-knoppen">
        <label className="stijl-knop">
          <span className="stijl-knop-naam">Accentkleur</span>
          <input
            type="color" className="stijl-kleurkiezer" value={thema.accent}
            onChange={(e) => kies({ ...thema, accent: e.target.value, naam: "Eigen stand" })}
          />
        </label>

        <label className="stijl-knop">
          <span className="stijl-knop-naam">Lettertype</span>
          <select
            className="stijl-keuze" value={thema.letter}
            onChange={(e) => kies({ ...thema, letter: e.target.value, naam: "Eigen stand" })}
          >
            {LETTERTYPES.map((l) => <option key={l.naam} value={l.waarde}>{l.naam}</option>)}
          </select>
        </label>

        <Schuif naam="Ruimte" waarde={thema.ruimte} min={0.7} max={1.4} stap={0.05}
          toon={`${Math.round(thema.ruimte * 100)}%`}
          bij={(v) => kies({ ...thema, ruimte: v, naam: "Eigen stand" })} />
        <Schuif naam="Tekstgrootte" waarde={thema.tekst} min={0.85} max={1.2} stap={0.05}
          toon={`${Math.round(thema.tekst * 100)}%`}
          bij={(v) => kies({ ...thema, tekst: v, naam: "Eigen stand" })} />
        <Schuif naam="Ronding" waarde={thema.ronding[1]} min={0} max={24} stap={1}
          toon={`${thema.ronding[1]}px`}
          bij={(v) => kies({ ...thema, ronding: [Math.round(v * 0.6), v, Math.round(v * 1.4)], naam: "Eigen stand" })} />
        <Schuif naam="Diepte" waarde={thema.diepte} min={0} max={2} stap={0.1}
          toon={thema.diepte === 0 ? "vlak" : `${Math.round(thema.diepte * 100)}%`}
          bij={(v) => kies({ ...thema, diepte: v, naam: "Eigen stand" })} />
      </div>

      <div className="stijl-speel-voet">
        <button type="button" className="btn btn-quiet btn-klein" onClick={() => kies(BASIS)} disabled={isBasis}>
          Zet alles terug
        </button>
        <button type="button" className="btn btn-ghost btn-klein" onClick={() => setOpen(!open)}>
          {open ? "Verberg de waarden" : "Toon de waarden"}
        </button>
      </div>
      <h3 className="stijl-h3">Deze stijl vastleggen</h3>
      <p className="stijl-p stijl-p-klein">
        {vast
          ? `Nu vastgelegd: ${vast.naam}. Dat is wat iedereen ziet, ook je klanten in hun eigen dashboard.`
          : "Er is nog niets vastgelegd; het dashboard staat op zijn eigen opmaak."}
        {" "}Vastleggen geldt meteen voor elk scherm en is met één klik weer ongedaan te maken.
      </p>
      <div className="stijl-speel-voet">
        <button
          type="button" className="btn btn-primary" disabled={bezig || alVast}
          onClick={() => legVast(isBasis ? null : thema)}
        >
          {bezig ? "Bezig…" : alVast ? "Dit staat al vast" : "Leg deze stijl vast voor iedereen"}
        </button>
        {vast && (
          <button type="button" className="btn btn-ghost btn-klein" disabled={bezig} onClick={() => legVast(null)}>
            Terug naar de standaard
          </button>
        )}
      </div>
      {fout && <p className="beheer-fout stijl-fout">{fout}</p>}

      {open && (
        <pre className="stijl-waardenblok">{
`accentkleur   ${thema.accent}
lettertype    ${thema.letter}
ruimte        ${Math.round(thema.ruimte * 100)}%
tekstgrootte  ${Math.round(thema.tekst * 100)}%
ronding       ${thema.ronding.join("px / ")}px
diepte        ${thema.diepte === 0 ? "vlak" : `${Math.round(thema.diepte * 100)}%`}`
        }</pre>
      )}
    </div>
  );
}

/** Eén schuifje met zijn naam en de stand ernaast. */
function Schuif({ naam, waarde, min, max, stap, toon, bij }: {
  naam: string; waarde: number; min: number; max: number; stap: number; toon: string; bij: (v: number) => void;
}) {
  return (
    <label className="stijl-knop">
      <span className="stijl-knop-naam">{naam}<span className="stijl-knop-stand">{toon}</span></span>
      <input
        type="range" className="stijl-schuif"
        min={min} max={max} step={stap} value={waarde}
        onChange={(e) => bij(Number(e.target.value))}
      />
    </label>
  );
}
