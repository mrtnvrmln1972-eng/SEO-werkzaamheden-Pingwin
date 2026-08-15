"use client";

// ═══════════════════════════════════════════════════════════
// DE STAPEL IN BEELD
// ═══════════════════════════════════════════════════════════
// Vier vragen die dit scherm beantwoordt, in deze volgorde:
//   1. staat er iets klaar dat ík moet bekijken?
//   2. wat staat er in de wachtrij, en in welke volgorde gebeurt het?
//   3. welke grotere ideeën liggen er nog?
//   4. welke schermen heb ik nog nooit helemaal nagelopen?
//
// Vandaar de volgorde van de blokken hieronder. "Controleer even" staat
// bovenaan, want dat is het enige waar Maarten iets mee moet; de rest is
// informatie. Klopt het niet, dan gaat dezelfde melding terug de wachtrij in
// mét zijn correctie eronder, in plaats van dat er een tweede briefje ontstaat
// dat niemand meer aan het eerste knoopt.
//
// De wachtrij is echt een rij: de volgorde op het scherm is de volgorde waarin
// de eerstvolgende ronde ze doet. Slepen verandert dat, "direct doorvoeren" zet
// er eentje voorop, en "parkeren" haalt er eentje uit zonder hem weg te gooien.
// Zou het scherm iets anders laten zien dan de ronde doet, dan geloof je het
// scherm niet meer, en dan is de hele stapel waardeloos.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from "react";
import AdminKop from "../AdminKop";
import Kopieer from "../Kopieer";
import Nulmeting from "./Nulmeting";
import { mdToHtml } from "../../../lib/markdown";
import type { Tweak, Stand, Prioriteit } from "../../../lib/tweaks";
import type { Nulmeting as NulmetingRij } from "../../../lib/nulmeting";

const STAND_LABEL: Record<Stand, string> = {
  wachtrij: "In de wachtrij",
  bezig: "Wordt nu gebouwd",
  controleer: "Staat live, klopt het?",
  klaar: "Klaar",
  apart: "Apart gezet, te groot voor een ronde",
  routekaart: "Wordt een routekaartpunt",
};

function datum(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
}

function klok(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

export type RondeStand = { ronde: string | null; gestart: string | null; bezig: number };

export default function TweaksClient({ begin, startregel, nulmeting, ronde, voorbeeldSlug }: {
  begin: Tweak[];
  startregel: string;
  nulmeting: NulmetingRij[];
  ronde: RondeStand;
  /** Een bestaande klant, zodat de cockpit-schermen in de nulmeting te openen zijn. */
  voorbeeldSlug: string | null;
}) {
  const [tweaks, setTweaks] = useState<Tweak[]>(begin);
  const [rondeNu, setRondeNu] = useState<RondeStand>(ronde);
  const [toonAf, setToonAf] = useState(false);
  const [beelden, setBeelden] = useState<Record<number, string>>({});
  const [groot, setGroot] = useState<number | null>(null);
  const [correctieVoor, setCorrectieVoor] = useState<number | null>(null);
  const [correctie, setCorrectie] = useState("");
  const [sleep, setSleep] = useState<number | null>(null);
  const [bericht, setBericht] = useState<{ soort: "ok" | "fout"; tekst: string } | null>(null);
  const [draait, setDraait] = useState(false);
  // Werkt de knop, zonder erop te drukken? Anders merk je pas dat een sleutel
  // ontbreekt op het moment dat je hem nodig hebt, en dan werkt hij dus niet.
  const [knopKlaar, setKnopKlaar] = useState<{ klaar: boolean; reden?: string } | null>(null);

  useEffect(() => {
    fetch("/api/admin/tweaks/draaien")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) setKnopKlaar({ klaar: Boolean(j.klaar), reden: j.reden }); })
      .catch(() => {});
  }, []);

  const opVolgorde = (l: Tweak[]) => [...l].sort((a, b) => a.volgorde - b.volgorde || a.id - b.id);
  const lopend = (t: Tweak) => t.stand === "wachtrij" || t.stand === "bezig";

  const controleer = tweaks.filter((t) => t.stand === "controleer");
  const wachtrij = opVolgorde(tweaks.filter((t) => lopend(t) && t.soort === "tweak" && t.prioriteit !== "geparkeerd"));
  const geparkeerd = opVolgorde(tweaks.filter((t) => lopend(t) && t.prioriteit === "geparkeerd"));
  const ideeen = opVolgorde(tweaks.filter((t) => lopend(t) && t.soort === "idee" && t.prioriteit !== "geparkeerd"));
  const naarRoutekaart = tweaks.filter((t) => t.stand === "routekaart");
  const afgerond = [...tweaks.filter((t) => t.stand === "klaar" || t.stand === "apart")].sort((a, b) => b.id - a.id);

  async function haalBeeld(id: number) {
    if (beelden[id]) { setGroot(id); return; }
    const r = await fetch(`/api/admin/tweaks?beeld=${id}`);
    const j = await r.json().catch(() => null);
    if (j?.ok && j.beeld) { setBeelden((b) => ({ ...b, [id]: j.beeld })); setGroot(id); }
  }

  async function weg(id: number) {
    const r = await fetch(`/api/admin/tweaks?id=${id}`, { method: "DELETE" });
    if (r.ok) setTweaks((lijst) => lijst.filter((t) => t.id !== id));
  }

  async function zet(id: number, stand: Stand, reactie = "") {
    const vorige = tweaks.find((t) => t.id === id)?.stand;
    const r = await fetch("/api/admin/tweaks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, stand, reactie, vorige }),
    });
    if (!r.ok) return;
    setTweaks((lijst) => lijst.map((t) => (t.id === id
      ? {
        ...t,
        stand,
        rondes: stand === "wachtrij" && vorige === "controleer" ? t.rondes + 1 : t.rondes,
        reacties: reactie
          ? [...t.reacties, { van: "maarten" as const, tekst: reactie, wanneer: new Date().toISOString() }]
          : t.reacties,
      }
      : t)));
  }

  async function zetVoorrang(id: number, prioriteit: Prioriteit) {
    const r = await fetch("/api/admin/tweaks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, prioriteit }),
    });
    if (!r.ok) return;
    // Voorop betekent ook echt vooraan in de lijst; de server rekent dat zo, dus
    // het scherm hoort dat meteen te laten zien in plaats van na een verversing.
    const laagste = Math.min(...tweaks.filter((t) => t.stand === "wachtrij").map((t) => t.volgorde), 10);
    setTweaks((lijst) => lijst.map((t) => (t.id === id
      ? { ...t, prioriteit, volgorde: prioriteit === "nu" ? laagste - 10 : t.volgorde }
      : t)));
  }

  async function stuurCorrectie(id: number) {
    if (!correctie.trim()) return;
    await zet(id, "wachtrij", correctie.trim());
    setCorrectieVoor(null);
    setCorrectie("");
  }

  /** Slepen: de hele nieuwe volgorde in één keer naar de server, niet één verplaatsing. */
  async function laatVallen(doelId: number) {
    if (sleep === null || sleep === doelId) { setSleep(null); return; }
    const rij = wachtrij.map((t) => t.id).filter((id) => id !== sleep);
    const plek = rij.indexOf(doelId);
    rij.splice(plek < 0 ? rij.length : plek, 0, sleep);
    setSleep(null);
    setTweaks((lijst) => lijst.map((t) => {
      const i = rij.indexOf(t.id);
      return i < 0 ? t : { ...t, volgorde: (i + 1) * 10, prioriteit: t.prioriteit === "nu" ? "gewoon" : t.prioriteit };
    }));
    await fetch("/api/admin/tweaks/volgorde", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: rij }),
    }).catch(() => {});
  }

  async function draaiNu() {
    setDraait(true);
    setBericht(null);
    try {
      const r = await fetch("/api/admin/tweaks/draaien", { method: "POST" });
      const j = await r.json().catch(() => null);
      if (j?.ok) {
        setBericht({ soort: "ok", tekst: j.melding || "De ronde is gestart." });
        setRondeNu({ ronde: "gestart", gestart: new Date().toISOString(), bezig: 0 });
      } else {
        setBericht({ soort: "fout", tekst: j?.error || "Starten lukte niet." });
        if (j?.ronde) setRondeNu(j.ronde);
      }
    } catch {
      setBericht({ soort: "fout", tekst: "Starten lukte niet." });
    } finally {
      setDraait(false);
    }
  }

  function kaart(t: Tweak, opties: { controle?: boolean; sleepbaar?: boolean; voorrang?: boolean; idee?: boolean } = {}) {
    return (
      <li
        key={t.id}
        className={
          "tw-item"
          + (t.stand === "klaar" || t.stand === "apart" ? " tw-item-af" : "")
          + (t.prioriteit === "nu" ? " tw-item-nu" : "")
          + (sleep === t.id ? " tw-item-sleept" : "")
        }
        onDragOver={opties.sleepbaar ? (e) => e.preventDefault() : undefined}
        onDrop={opties.sleepbaar ? (e) => { e.preventDefault(); void laatVallen(t.id); } : undefined}
      >
        <div className="tw-item-kop">
          {opties.sleepbaar && (
            <span
              className="drag-handle tw-greep"
              draggable
              onDragStart={() => setSleep(t.id)}
              onDragEnd={() => setSleep(null)}
              title="Sleep om de volgorde te veranderen"
            >
              ⠿
            </span>
          )}
          <div className="tw-tekst md" dangerouslySetInnerHTML={{ __html: mdToHtml(t.tekst) }} />
        </div>

        {t.reacties.length > 0 && (
          <ul className="tw-draad">
            {t.reacties.map((r, i) => (
              <li key={i} className={r.van === "claude" ? "tw-draad-claude" : "tw-draad-maarten"}>
                <span className="tw-draad-wie">{r.van === "claude" ? "Gebouwd" : "Jouw correctie"}</span>
                <span className="tw-draad-tekst">{r.tekst}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="tw-meta">
          {t.pad ? <a className="tw-scherm" href={t.pad}>{t.scherm || t.pad}</a> : <span className="tw-scherm">{t.scherm}</span>}
          <span className="tw-datum">{datum(t.aangemaakt)}</span>
          <span className="tw-stand-chip">{STAND_LABEL[t.stand]}</span>
          {t.prioriteit === "nu" && <span className="tw-stand-chip tw-chip-nu">Gaat als eerste</span>}
          {t.prioriteit === "geparkeerd" && <span className="tw-stand-chip">Geparkeerd</span>}
          {t.punt && <span className="tw-stand-chip tw-chip-punt">{t.punt}</span>}
          {t.rondes > 1 && <span className="tw-stand-chip tw-rondes">{t.rondes} rondes</span>}
        </div>
        {t.notitie && <div className="tw-notitie">{t.notitie}</div>}

        {correctieVoor === t.id ? (
          <div className="tw-correctie">
            <textarea
              className="tw-veld tw-veld-klein"
              value={correctie}
              onChange={(e) => setCorrectie(e.target.value)}
              placeholder="Wat klopt er nog niet? Dit komt onder dezelfde melding te staan."
              autoFocus
            />
            <div className="tw-item-acties">
              <button type="button" className="btn btn-primary btn-klein" onClick={() => void stuurCorrectie(t.id)}>
                Terug op de stapel
              </button>
              <button type="button" className="btn btn-ghost btn-klein" onClick={() => { setCorrectieVoor(null); setCorrectie(""); }}>
                Annuleren
              </button>
            </div>
          </div>
        ) : (
          <div className="tw-item-acties">
            {opties.controle && (
              <div className="pnl-acties-groep">
                <button type="button" className="btn btn-primary btn-klein" onClick={() => void zet(t.id, "klaar")}>Klopt</button>
                <button type="button" className="btn btn-ghost btn-klein" onClick={() => setCorrectieVoor(t.id)}>Nog niet goed</button>
              </div>
            )}
            {opties.voorrang && (
              <div className="pnl-acties-groep">
                {t.prioriteit === "nu" ? (
                  <button type="button" className="btn btn-ghost btn-klein" onClick={() => void zetVoorrang(t.id, "gewoon")}>
                    Toch gewoon meelopen
                  </button>
                ) : (
                  <button type="button" className="btn btn-ghost btn-klein" onClick={() => void zetVoorrang(t.id, "nu")}>
                    Direct doorvoeren
                  </button>
                )}
                {t.prioriteit === "geparkeerd" ? (
                  <button type="button" className="btn btn-ghost btn-klein" onClick={() => void zetVoorrang(t.id, "gewoon")}>
                    Terug in de wachtrij
                  </button>
                ) : (
                  <button type="button" className="btn btn-ghost btn-klein" onClick={() => void zetVoorrang(t.id, "geparkeerd")}>
                    Parkeren
                  </button>
                )}
              </div>
            )}
            {opties.idee && (
              <button type="button" className="btn btn-primary btn-klein" onClick={() => void zet(t.id, "routekaart")}>
                Wordt een routekaartpunt
              </button>
            )}
            {t.stand === "routekaart" && (
              <button type="button" className="btn btn-ghost btn-klein" onClick={() => void zet(t.id, "wachtrij")}>
                Toch niet, terug op de stapel
              </button>
            )}
            {t.beeld !== null && (
              <button type="button" className="btn btn-ghost btn-klein" onClick={() => void haalBeeld(t.id)}>Bekijk beeld</button>
            )}
            {(t.stand === "klaar" || t.stand === "apart") && (
              <button type="button" className="btn btn-quiet btn-klein" onClick={() => void zet(t.id, "wachtrij")}>Terug op de stapel</button>
            )}
            <button type="button" className="btn btn-danger btn-klein" onClick={() => void weg(t.id)}>Weg</button>
          </div>
        )}
      </li>
    );
  }

  function blok(titel: string, uitleg: string, lijst: Tweak[], opties: Parameters<typeof kaart>[1] = {}) {
    if (lijst.length === 0) return null;
    return (
      <div className="beheer-blok">
        <h2 className="beheer-h2">{titel} ({lijst.length})</h2>
        <p className="beheer-uitleg">{uitleg}</p>
        <ul className="tw-lijst">{lijst.map((t) => kaart(t, opties))}</ul>
      </div>
    );
  }

  return (
    <>
      <AdminKop titel="Tweaks" />
      <div className="beheer-container">
        <div className="beheer-kop">
          <h1 className="beheer-h1">De stapel kleine aanpassingen</h1>
          <p className="beheer-uitleg">
            Alles wat je onderweg meldt met het knopje <strong>Tweak</strong> komt hier terecht.
            Eén ronde werkt de hele stapel af: één keer inlezen, één bouw, één keer live. De
            volgorde hieronder is de volgorde waarin het gebeurt, en er kan er altijd maar één
            ronde tegelijk lopen.
          </p>
        </div>

        <div className="tw-balk">
          <div className="tw-stand">
            <span className="tw-getal">{wachtrij.length}</span>
            <span className="tw-getal-bij">{wachtrij.length === 1 ? "staat in de wachtrij" : "staan in de wachtrij"}</span>
          </div>
          <div className="tw-balk-acties">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void draaiNu()}
              disabled={draait || wachtrij.length === 0 || Boolean(rondeNu.ronde)}
            >
              {draait ? "Bezig met starten…" : "Nu draaien"}
            </button>
            <Kopieer tekst={startregel} label="Startregel kopiëren" />
            <button type="button" className="btn btn-quiet btn-klein pnl-acties-info" onClick={() => setToonAf(!toonAf)}>
              {toonAf ? "Alleen wat loopt" : `Ook de afgeronde (${afgerond.length})`}
            </button>
          </div>
        </div>

        {rondeNu.ronde ? (
          <div className="tw-ronde-loopt">
            Er loopt een ronde{rondeNu.gestart ? `, begonnen om ${klok(rondeNu.gestart)}` : ""}
            {rondeNu.bezig > 0 ? ` met ${rondeNu.bezig} ${rondeNu.bezig === 1 ? "melding" : "meldingen"}` : ""}.
            Een tweede ronde kan er niet naast; die zou in dezelfde bestanden schrijven.
          </div>
        ) : (
          <p className="beheer-klein">
            <strong>Nu draaien</strong> start de ronde zonder chat. Wil je het liever zelf in een
            verse chat doen, dan zet <strong>Startregel kopiëren</strong> <code>{startregel}</code> op
            je klembord. Er draait sowieso elk uur een ronde als er iets klaarstaat.
          </p>
        )}

        {bericht && <div className={bericht.soort === "ok" ? "tw-ok" : "tw-fout"}>{bericht.tekst}</div>}

        {knopKlaar && !knopKlaar.klaar && (
          <div className="tw-fout">
            <strong>Nu draaien werkt nog niet.</strong> {knopKlaar.reden}
          </div>
        )}

        {blok("Klaar, klopt het?", "Dit staat live. Zeg of het goed is; klopt het niet, dan gaat het met jouw correctie terug de wachtrij in.", controleer, { controle: true })}
        {blok("In de wachtrij", "Van boven naar beneden de volgorde waarin de eerstvolgende ronde ze doet. Sleep aan het greepje om die volgorde te veranderen.", wachtrij, { sleepbaar: true, voorrang: true })}
        {blok("Geparkeerd", "Blijft staan, gaat nergens in mee. Terugzetten kan altijd.", geparkeerd, { voorrang: true })}
        {blok("Grotere ideeën", "Wordt niet in een ronde weggewerkt. Hier maak ik eerst een voorstel van; zeg je ja, dan wordt het een punt op de routekaart.", ideeen, { idee: true, voorrang: true })}
        {blok("Wordt een routekaartpunt", "Jij zei ja. Deze komen op de routekaart te staan en worden daar als ontwikkelpunt opgepakt, niet in een tweak-ronde.", naarRoutekaart)}
        {toonAf && blok("Afgerond", "Klaar of apart gezet.", afgerond)}

        {controleer.length + wachtrij.length + ideeen.length + geparkeerd.length === 0 && (
          <div className="tw-leeg">
            Niets open. Zie je iets dat anders moet, druk dan op het knopje rechtsonder op het
            scherm waar je op dat moment staat.
          </div>
        )}

        <Nulmeting begin={nulmeting} voorbeeldSlug={voorbeeldSlug} tweaks={tweaks} />
      </div>

      {groot !== null && beelden[groot] && (
        <div className="tw-overlay">
          <div className="tw-venster tw-venster-beeld" role="dialog" aria-label="Schermafbeelding">
            <div className="tw-kop">
              <div className="tw-titel">Meegestuurd beeld</div>
              <button type="button" className="tw-sluit" onClick={() => setGroot(null)} aria-label="Sluiten">×</button>
            </div>
            <div className="tw-body tw-body-beeld">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={beelden[groot]} alt="Schermafbeelding bij deze melding" />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
