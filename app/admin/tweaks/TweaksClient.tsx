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

import { useCallback, useEffect, useState } from "react";
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

export type RondeStand = {
  ronde: string | null; gestart: string | null; bezig: number;
  baan?: "tweak" | "punt" | null;
  /** Hoeveel meldingen van deze ronde al doorgevoerd zijn, en hoeveel er in totaal in zitten. */
  klaar?: number; totaal?: number;
};

/**
 * Hoeveel minuten één tweak ongeveer kost, zolang deze ronde er nog geen enkele
 * heeft afgerond. Zodra er één klaar is rekent het scherm met het echte tempo
 * van déze ronde, dus dit getal telt alleen de eerste paar minuten mee.
 */
const MINUTEN_PER_TWEAK = 6;

function minuten(n: number): string {
  if (n < 60) return `${n} ${n === 1 ? "minuut" : "minuten"}`;
  const u = Math.floor(n / 60);
  const r = n % 60;
  return r ? `${u} uur en ${r} min` : `${u} uur`;
}

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
  const [tikker, setTikker] = useState(0);

  useEffect(() => {
    fetch("/api/admin/tweaks/draaien")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) setKnopKlaar({ klaar: Boolean(j.klaar), reden: j.reden }); })
      .catch(() => {});
  }, []);

  const ververs = useCallback(async () => {
    const r = await fetch("/api/admin/tweaks?alles=1").catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) return;
    setTweaks(j.tweaks as Tweak[]);
    setRondeNu(j.ronde as RondeStand);
  }, []);

  // HET SCHERM KIJKT ZELF, IN PLAATS VAN TE BLIJVEN ZEGGEN WAT HET DACHT.
  // Na een druk op "Nu draaien" zette dit scherm zichzelf op "er loopt een
  // ronde" en keek daarna nooit meer. Op 15-08-2026 stond die zin daardoor een
  // uur lang in beeld terwijl de ronde al na negentien seconden gestopt was
  // zonder iets te doen. Een scherm dat blijft herhalen wat het ooit dacht, is
  // erger dan een scherm dat niets zegt.
  useEffect(() => {
    const bezig = Boolean(rondeNu.ronde);
    const t = setInterval(() => void ververs(), bezig ? 15000 : 120000);
    return () => clearInterval(t);
  }, [rondeNu.ronde, ververs]);

  // De klok loopt door tussen twee verversingen, zodat "nog ongeveer acht
  // minuten" ook echt afloopt in plaats van elke kwartier een sprong te maken.
  useEffect(() => {
    if (!rondeNu.ronde) return;
    const t = setInterval(() => setTikker((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, [rondeNu.ronde]);
  void tikker;

  /**
   * Hoe ver is deze ronde, en hoe lang duurt hij nog?
   *
   * De balk loopt op het aantal meldingen dat écht doorgevoerd is, niet op de
   * klok: een balk op tijd staat stil zodra iets langer duurt dan verwacht, en
   * dat is precies het moment waarop je wilt zien dat er nog iets gebeurt. De
   * tijdsverwachting komt uit het tempo van déze ronde zelf zodra er één melding
   * klaar is; daarvoor uit een startwaarde.
   */
  const voortgang = (() => {
    if (!rondeNu.ronde || !rondeNu.gestart) return null;
    const totaal = rondeNu.totaal ?? rondeNu.bezig;
    const klaar = rondeNu.klaar ?? 0;
    const over = Math.max(0, totaal - klaar);
    const verstreken = Math.max(0, (Date.now() - new Date(rondeNu.gestart).getTime()) / 60000);
    const perStuk = klaar > 0 ? verstreken / klaar : MINUTEN_PER_TWEAK;
    return {
      totaal, klaar, over,
      verstreken: Math.round(verstreken),
      rest: Math.max(1, Math.round(perStuk * over)),
      deel: totaal > 0 ? klaar / totaal : 0,
      // Twee keer zo lang als verwacht en nog niets afgerond: dan is er iets mis
      // en hoort het scherm dat te zeggen in plaats van te blijven draaien.
      traag: klaar === 0 && verstreken > MINUTEN_PER_TWEAK * 2,
    };
  })();

  const opVolgorde = (l: Tweak[]) => [...l].sort((a, b) => a.volgorde - b.volgorde || a.id - b.id);
  const lopend = (t: Tweak) => t.stand === "wachtrij" || t.stand === "bezig";

  const controleer = tweaks.filter((t) => t.stand === "controleer");
  const wachtrij = opVolgorde(tweaks.filter((t) => lopend(t) && t.soort === "tweak" && t.prioriteit !== "geparkeerd"));
  const geparkeerd = opVolgorde(tweaks.filter((t) => lopend(t) && t.prioriteit === "geparkeerd"));
  const ideeen = opVolgorde(tweaks.filter((t) => lopend(t) && t.soort === "idee" && t.prioriteit !== "geparkeerd"));
  // "Apart gezet" hoorde bij de afgeronde en zat dus achter een schakelaar. Dat
  // was fout: een melding die te groot bleek is niet klaar, hij wacht op een
  // beslissing van Maarten. Op 15-08 verdwenen er zo drie meldingen uit beeld en
  // leek het of ze weg waren. Ze staan nu gewoon in het zicht.
  const apart = [...tweaks.filter((t) => t.stand === "apart")].sort((a, b) => b.id - a.id);
  const afgerond = [...tweaks.filter((t) => t.stand === "klaar")].sort((a, b) => b.id - a.id);

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

  /**
   * Een idee is te groot voor een ronde: het verhuist naar de wachtrij voor
   * grote punten. Daar krijgt het eerst een plan, dan Maartens akkoord, en pas
   * daarna wordt het 's nachts gebouwd.
   *
   * De server zet de melding hier meteen van de stapel af, mét het G-nummer, in
   * dezelfde handeling. Zonder dat staat hetzelfde onderwerp op twee lijsten en
   * gaat er één van beide zwerven.
   */
  async function naarGrootPunt(t: Tweak) {
    const eersteRegel = t.tekst.split("\n")[0].trim().slice(0, 200);
    const r = await fetch("/api/admin/punten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titel: eersteRegel || t.tekst.slice(0, 200), tekst: t.tekst, bronTweak: t.id }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) {
      setBericht({ soort: "fout", tekst: j?.error || "Dat lukte niet." });
      return;
    }
    setTweaks((lijst) => lijst.map((x) => (x.id === t.id
      ? { ...x, stand: "routekaart" as Stand, punt: j.punt.code, notitie: `Staat als ${j.punt.code} in de wachtrij voor grote punten.` }
      : x)));
    setBericht({ soort: "ok", tekst: `Staat nu als ${j.punt.code} bij de grote punten. Daar maak ik er eerst een plan van.` });
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

  /**
   * De noodrem. Een ronde die aantoonbaar dood is hield de wachtrij anders drie
   * kwartier dicht, en dan sta je op een klok te wachten terwijl je weet dat er
   * niets meer komt. De meldingen gaan gewoon terug de rij in, niets raakt weg.
   */
  async function breekAf() {
    const r = await fetch("/api/admin/tweaks/ronde", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ actie: "afbreken" }),
    });
    const j = await r.json().catch(() => null);
    if (!j?.ok) { setBericht({ soort: "fout", tekst: j?.error || "Afbreken lukte niet." }); return; }
    setRondeNu(j.ronde);
    setTweaks((lijst) => lijst.map((t) => (t.stand === "bezig" ? { ...t, stand: "wachtrij" as Stand } : t)));
    setBericht({
      soort: "ok",
      tekst: j.terug > 0
        ? `De ronde is afgebroken. ${j.terug === 1 ? "Eén melding staat" : `${j.terug} meldingen staan`} weer in de wachtrij; je kunt meteen opnieuw draaien.`
        : "De ronde is afgebroken. De wachtrij is weer vrij.",
    });
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
        // Even later zelf nakijken of hij ook echt draait, in plaats van dat
        // aan te nemen. De verversing hierboven neemt het daarna over.
        setTimeout(() => void ververs(), 20000);
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

  function kaart(t: Tweak, opties: { controle?: boolean; sleepbaar?: boolean; voorrang?: boolean; idee?: boolean; terugKnop?: boolean } = {}) {
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
              <button type="button" className="btn btn-primary btn-klein" onClick={() => void naarGrootPunt(t)}>
                Wordt een groot punt
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

  // Alleen de kop met het aantal. De uitleg eronder is er bewust uit: dit scherm
  // gebruik je elke dag, en dan is een alinea per blok geen hulp maar ruis.
  /** Alles in één keer terug de wachtrij in; bij drie meldingen is drie keer klikken onzin. */
  async function allesTerug(lijst: Tweak[]) {
    for (const t of lijst) await zet(t.id, "wachtrij");
    setBericht({ soort: "ok", tekst: `${lijst.length} terug in de wachtrij. Druk op Nu draaien.` });
  }

  function blok(titel: string, lijst: Tweak[], opties: Parameters<typeof kaart>[1] = {}) {
    if (lijst.length === 0) return null;
    return (
      <div className="beheer-blok">
        <h2 className="beheer-h2">{titel} ({lijst.length})</h2>
        {opties.terugKnop && (
          <button type="button" className="btn btn-primary btn-klein" onClick={() => void allesTerug(lijst)}>
            Allemaal terug in de wachtrij
          </button>
        )}
        <ul className="tw-lijst">{lijst.map((t) => kaart(t, opties))}</ul>
      </div>
    );
  }

  return (
    <>
      <AdminKop titel="Tweaks" />
      <div className="beheer-container">

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
            <button type="button" className="btn btn-quiet btn-klein" onClick={() => setToonAf(!toonAf)}>
              {toonAf ? "Alleen wat loopt" : `Ook de afgeronde (${afgerond.length})`}
            </button>
            <a className="btn btn-quiet btn-klein pnl-acties-info" href="/admin/grote-punten">Grote punten</a>
          </div>
        </div>

        {rondeNu.ronde && voortgang ? (
          <div className={"gp-nu" + (voortgang.traag ? " gp-balk-traag" : "")}>
            <div className="gp-nu-kop">
              <span className="gp-nu-label">
                {rondeNu.baan === "punt" ? "Er wordt een groot punt gebouwd" : "Ronde bezig"}
              </span>
              <span className="gp-nu-titel">
                {rondeNu.baan === "punt"
                  ? "Tweaks wachten daarop; ze bouwen nooit tegelijk"
                  : `${voortgang.klaar} van ${voortgang.totaal} doorgevoerd`}
              </span>
            </div>
            {rondeNu.baan !== "punt" && (
              <>
                <div className="gp-balk">
                  <div className="gp-balk-vul" style={{ width: `${Math.round(Math.max(0.04, voortgang.deel) * 100)}%` }} />
                </div>
                <div className="gp-nu-regel">
                  <span className="gp-nu-stap">
                    {voortgang.over === 0
                      ? "Alles doorgevoerd, bezig met live zetten"
                      : `Nog ${voortgang.over} te gaan`}
                  </span>
                  <span className="gp-nu-tijd">
                    Begonnen om {klok(rondeNu.gestart)}, {minuten(voortgang.verstreken)} bezig
                    {voortgang.over > 0 ? `, nog ongeveer ${minuten(voortgang.rest)}` : ""}
                  </span>
                </div>
              </>
            )}
            {voortgang.traag && (
              <div className="gp-traag">
                Er is nog niets doorgevoerd en het duurt al langer dan gewoonlijk. Meestal is dat
                een taaie aanpassing; blijft het hangen, dan kun je de ronde hieronder afbreken.
              </div>
            )}
            <p className="gp-venster">
              Een tweede ronde kan er niet naast; die zou in dezelfde bestanden schrijven. Dit
              scherm kijkt elke vijftien seconden zelf of hij nog loopt.
            </p>
          </div>
        ) : rondeNu.ronde ? (
          <div className="tw-ronde-loopt">
            <span>
              Er loopt een ronde{rondeNu.gestart ? `, begonnen om ${klok(rondeNu.gestart)}` : ""}
              {rondeNu.bezig > 0 ? ` met ${rondeNu.bezig} ${rondeNu.bezig === 1 ? "melding" : "meldingen"}` : ""}.
              Een tweede ronde kan er niet naast; die zou in dezelfde bestanden schrijven. Is hij
              vastgelopen, breek hem dan af in plaats van te wachten.
            </span>
            <button type="button" className="btn btn-ghost btn-klein" onClick={() => void breekAf()}>
              Ronde afbreken
            </button>
          </div>
        ) : (
          <div className="gp-nu gp-nu-stil">
            <div className="gp-nu-kop">
              <span className="gp-nu-label">Er loopt geen ronde</span>
            </div>
            <p className="gp-venster">
              {wachtrij.length === 0 && controleer.length === 0 && apart.length === 0
                ? "Niets open. Zie je iets dat anders moet, druk dan op het Tweak-knopje rechtsonder."
                : [
                  wachtrij.length > 0 ? `${wachtrij.length} ${wachtrij.length === 1 ? "staat" : "staan"} in de wachtrij` : "",
                  controleer.length > 0 ? `${controleer.length} ${controleer.length === 1 ? "wacht" : "wachten"} op je oordeel` : "",
                  apart.length > 0 ? `${apart.length} ${apart.length === 1 ? "bleek" : "bleken"} te groot voor een ronde` : "",
                ].filter(Boolean).join(", ") + ". Er start niets vanzelf; druk op Nu draaien."}
            </p>
          </div>
        )}

        {bericht && <div className={bericht.soort === "ok" ? "tw-ok" : "tw-fout"}>{bericht.tekst}</div>}

        {knopKlaar && !knopKlaar.klaar && (
          <div className="tw-fout">
            <strong>Nu draaien werkt nog niet.</strong> {knopKlaar.reden}
          </div>
        )}

        {blok("Klaar, klopt het?", controleer, { controle: true })}
        {blok("In de wachtrij", wachtrij, { sleepbaar: true, voorrang: true })}
        {blok("Geparkeerd", geparkeerd, { voorrang: true })}
        {/* Bewust géén voorrang-knoppen bij een idee. "Direct doorvoeren" en
            "parkeren" gaan over de volgorde van de eerstvolgende ronde, en een
            idee gaat nooit mee in een ronde. Ze stonden er wél, en dan lijkt het
            of je een idee vandaag nog kunt laten bouwen; dat kan niet, en het
            maakte de kaart bovendien onnodig druk. */}
        {blok("Te groot gebleken, wat wil je ermee?", apart, { idee: true, terugKnop: true })}
        {blok("Grotere ideeën", ideeen, { idee: true })}
        {toonAf && blok("Afgerond", afgerond)}

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
