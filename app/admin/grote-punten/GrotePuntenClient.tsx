"use client";

// ═══════════════════════════════════════════════════════════
// DE WACHTRIJ VOOR GROTE PUNTEN IN BEELD
// ═══════════════════════════════════════════════════════════
// Vijf vragen die dit scherm beantwoordt, in deze volgorde:
//   1. wat wordt er op dit moment gebouwd, en hoe lang duurt het nog?
//   2. staat er iets klaar dat ík moet bekijken?
//   3. ligt er een plan te wachten op mijn akkoord?
//   4. wat gaat er vannacht gebeuren, en in welke volgorde?
//   5. welke ideeën liggen er nog zonder plan?
//
// Vandaar de volgorde van de blokken. Wat nu loopt staat bovenaan, want dat is
// het enige dat verandert terwijl je kijkt; daaronder staat wat er van Maarten
// gevraagd wordt; en pas daarna wat er nog aankomt.
//
// DE TIJD LOOPT DOOR TUSSEN TWEE VERVERSINGEN. Het scherm haalt elke vijftien
// seconden de stand op, maar telt de resterende minuten zelf af op de klok.
// Zonder dat springt "nog 12 minuten" een kwartier lang niet, en dan gelooft
// niemand meer dat er iets gebeurt.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import AdminKop from "../AdminKop";
import Kopieer from "../Kopieer";
import { mdToHtml } from "../../../lib/markdown";
import type { Punt, Stand, Omvang } from "../../../lib/grote-punten";

type Start = { id: number; begint: string; minuten: number };
type Voortgang = {
  verstreken: number; rest: number; deel: number;
  stapNr: number; stappen: number; stap: string; duurtLang: boolean;
};
export type PuntStandUI = {
  slot: {
    ronde: string | null;
    baan: "tweak" | "punt" | null;
    gestart: string | null;
    /** Gestart, maar heeft zich nog niet gemeld. Duurt normaal een minuut. */
    opstarten: { baan: "tweak" | "punt"; sinds: string } | null;
  };
  /** Wordt er gebouwd, of wordt er een plan geschreven? */
  werk: "bouw" | "plan";
  bezig: Punt | null;
  voortgang: Voortgang | null;
  nacht: boolean;
  volgendVenster: string;
};

const STAND_LABEL: Record<Stand, string> = {
  "idee": "Idee, nog geen plan",
  "plan-maken": "Plan wordt gemaakt",
  "plan-klaar": "Plan klaar, wacht op jou",
  "wachtrij": "In de bouwwachtrij",
  "bouwt": "Wordt nu gebouwd",
  "controleer": "Staat live, klopt het?",
  "klaar": "Klaar",
  "afgewezen": "Afgewezen",
};

const OMVANG_LABEL: Record<Omvang, string> = {
  klein: "klein", middel: "middel", groot: "groot",
};

function klok(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

/** "vannacht om 02:15" of "woensdagnacht om 23:40": altijd te plaatsen zonder rekenen. */
function wanneer(iso: string): string {
  const d = new Date(iso);
  const nu = new Date();
  const zelfdeNacht = d.getTime() - nu.getTime() < 14 * 3600000;
  const dag = zelfdeNacht ? "vannacht" : d.toLocaleDateString("nl-NL", { weekday: "long" }) + "nacht";
  return `${dag} om ${klok(iso)}`;
}

function minuten(n: number): string {
  if (n < 60) return `${n} ${n === 1 ? "minuut" : "minuten"}`;
  const u = Math.floor(n / 60);
  const r = n % 60;
  return r ? `${u} uur en ${r} min` : `${u} uur`;
}

export default function GrotePuntenClient({ begin, beginStand, beginStarts, startregel }: {
  begin: Punt[];
  beginStand: PuntStandUI;
  beginStarts: Start[];
  startregel: string;
}) {
  const [punten, setPunten] = useState<Punt[]>(begin);
  const [stand, setStand] = useState<PuntStandUI>(beginStand);
  const [starts, setStarts] = useState<Start[]>(beginStarts);
  const [toonAf, setToonAf] = useState(false);
  const [tikker, setTikker] = useState(0);
  const [antwoordVoor, setAntwoordVoor] = useState<number | null>(null);
  const [antwoord, setAntwoord] = useState("");
  const [openPlan, setOpenPlan] = useState<number | null>(null);
  const [sleep, setSleep] = useState<number | null>(null);
  const [bericht, setBericht] = useState<{ soort: "ok" | "fout"; tekst: string } | null>(null);
  const [draait, setDraait] = useState(false);
  /** Het punt waarvan het plan nu opgestart wordt; zolang dat loopt geen tweede klik. */
  const [startBezig, setStartBezig] = useState<number | null>(null);
  const [beelden, setBeelden] = useState<Record<number, string>>({});
  const [grootBeeld, setGrootBeeld] = useState<number | null>(null);
  const [nieuwTitel, setNieuwTitel] = useState("");
  const [nieuwOmvang, setNieuwOmvang] = useState<Omvang>("middel");
  const [knopKlaar, setKnopKlaar] = useState<{ klaar: boolean; reden?: string } | null>(null);
  // De verwachte totale bouwtijd op het moment van de laatste verversing. Op
  // basis hiervan telt het scherm zelf af, zonder de server elke seconde lastig
  // te vallen.
  const totaalRef = useRef<number | null>(null);

  const ververs = useCallback(async () => {
    const r = await fetch("/api/admin/punten?alles=1").catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) return;
    setPunten(j.punten as Punt[]);
    setStand(j.stand as PuntStandUI);
    setStarts((j.starts ?? []) as Start[]);
    const v = (j.stand as PuntStandUI).voortgang;
    totaalRef.current = v ? v.verstreken + v.rest : null;
  }, []);

  useEffect(() => {
    fetch("/api/admin/punten/draaien")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) setKnopKlaar({ klaar: Boolean(j.klaar), reden: j.reden }); })
      .catch(() => {});
  }, []);

  // Loopt er iets, dan elke vijftien seconden verversen; anders elke twee
  // minuten. Een scherm dat de hele dag elke seconde vraagt is duur en levert
  // niets op, want dan gebeurt er niets.
  useEffect(() => {
    // Drie tempo's, en het middelste is de reparatie. Tijdens het opstarten
    // gebeurt er elke seconde iets wat je wilt zien (hij meldt zich), dus dan
    // kijken we vaak. Loopt er iets, dan is elke vijftien seconden genoeg. Ligt
    // alles stil, dan is elke twee minuten al royaal.
    const opstart = Boolean(stand.slot.opstarten);
    const bezig = Boolean(stand.slot.ronde);
    const tempo = opstart ? 5000 : bezig ? 15000 : 120000;
    const t = setInterval(() => void ververs(), tempo);
    return () => clearInterval(t);
  }, [stand.slot.ronde, stand.slot.opstarten, ververs]);

  // De seconden-teller voor de aftelling. Draait alleen als er iets loopt.
  useEffect(() => {
    if (!stand.voortgang) return;
    const t = setInterval(() => setTikker((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, [stand.voortgang]);

  const nu = stand.bezig;
  const v = stand.voortgang;
  // De rest-tijd bijgewerkt met de klok sinds de laatste verversing.
  const restNu = (() => {
    if (!v || !nu?.gestart) return null;
    const totaal = totaalRef.current ?? v.verstreken + v.rest;
    const verstreken = (Date.now() - new Date(nu.gestart).getTime()) / 60000;
    return { verstreken: Math.round(verstreken), rest: Math.max(1, Math.round(totaal - verstreken)) };
  })();
  void tikker; // de teller bestaat om te hertekenen, niet om gelezen te worden

  // Hoe lang het opstarten al duurt. Loopt mee op de klok, want stilstaande
  // seconden zijn precies waarom niemand gelooft dat er iets gebeurt.
  const opstartTekst = (() => {
    const o = stand.slot.opstarten;
    if (!o) return "";
    const sec = Math.max(0, Math.round((Date.now() - new Date(o.sinds).getTime()) / 1000));
    if (sec < 90) return `${sec} seconden bezig`;
    return "duurt langer dan gewoonlijk";
  })();

  const opVolgorde = (l: Punt[]) => [...l].sort((a, b) => a.volgorde - b.volgorde || a.id - b.id);
  const per = (s: Stand) => opVolgorde(punten.filter((p) => p.stand === s));
  const controleer = per("controleer");
  const planKlaar = per("plan-klaar");
  const wachtrij = per("wachtrij");
  const planMaken = per("plan-maken");
  const ideeen = per("idee");
  const afgerond = [...punten.filter((p) => p.stand === "klaar" || p.stand === "afgewezen")]
    .sort((a, b) => b.id - a.id);
  const startVan = (id: number) => starts.find((s) => s.id === id) ?? null;

  async function stuur(body: Record<string, unknown>) {
    setBericht(null);
    const r = await fetch("/api/admin/punten", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (!j?.ok) {
      setBericht({ soort: "fout", tekst: j?.error || "Dat lukte niet." });
      return false;
    }
    await ververs();
    return true;
  }

  async function haalBeeld(id: number) {
    if (beelden[id]) { setGrootBeeld(id); return; }
    const j = await fetch(`/api/admin/punten?beeld=${id}`).then((r) => r.json()).catch(() => null);
    if (j?.ok && j.beeld) { setBeelden((b) => ({ ...b, [id]: j.beeld })); setGrootBeeld(id); }
  }

  async function weg(id: number) {
    const r = await fetch(`/api/admin/punten?id=${id}`, { method: "DELETE" });
    if (r.ok) await ververs();
  }

  async function laatVallen(doelId: number) {
    if (sleep === null || sleep === doelId) { setSleep(null); return; }
    const rij = wachtrij.map((p) => p.id).filter((id) => id !== sleep);
    const plek = rij.indexOf(doelId);
    rij.splice(plek < 0 ? rij.length : plek, 0, sleep);
    setSleep(null);
    setPunten((lijst) => lijst.map((p) => {
      const i = rij.indexOf(p.id);
      return i < 0 ? p : { ...p, volgorde: (i + 1) * 10 };
    }));
    const r = await fetch("/api/admin/punten/volgorde", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: rij }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) setStarts((j.starts ?? []) as Start[]);
  }

  /**
   * Een plan laten schrijven begint meteen, op jouw klik.
   *
   * Het stond eerst alleen op "plan wordt gemaakt" en wachtte tot er iets
   * langskwam dat het oppakte. Dat is precies het soort automatisch-elk-uur dat
   * er niet moet zijn: denkwerk kost geld en hoort te beginnen omdat jij het
   * vraagt, niet omdat de klok verspringt.
   *
   * TWEE DINGEN HIER ZIJN EEN REPARATIE VAN 15-08-2026.
   * De melding "ik ga er nu een plan van maken" werd gezet vóórdat het starten
   * gelukt was, en een start die halverwege stukliep (geen antwoord, of een
   * antwoord dat geen JSON was) werd stilzwijgend genegeerd. Je kreeg dus een
   * geruststellende zin te zien terwijl er niets gebeurde. Nu komt de melding
   * pas als het echt gestart is, en zegt hij het als dat niet lukte.
   *
   * En zolang het starten loopt, staat de knop op slot. Zonder dat klik je bij
   * twijfel nog een keer, en dan staan er twee rondes in de rij voor werk dat
   * er maar één keer is; op 15 augustus stonden er zo vier tegelijk.
   */
  async function planNu(id: number) {
    if (startBezig !== null) return;
    setStartBezig(id);
    try {
      const punt = punten.find((x) => x.id === id);
      if (punt?.stand !== "plan-maken" && !(await stuur({ id, stand: "plan-maken" }))) return;
      const r = await fetch("/api/admin/punten/draaien", { method: "POST" }).catch(() => null);
      const j = await r?.json().catch(() => null);
      if (!j?.ok) {
        setBericht({
          soort: "fout",
          tekst: j?.error || "Het plan is niet gestart; er kwam geen antwoord terug. Probeer het zo nog eens.",
        });
        return;
      }
      setBericht({ soort: "ok", tekst: "Ik ga er nu een plan van maken; je ziet hierboven hoe ver het is." });
      setTimeout(() => void ververs(), 8000);
    } finally {
      setStartBezig(null);
    }
  }

  async function draaiNu() {
    setDraait(true);
    setBericht(null);
    try {
      const r = await fetch("/api/admin/punten/draaien", { method: "POST" });
      const j = await r.json().catch(() => null);
      setBericht({
        soort: j?.ok ? "ok" : "fout",
        tekst: (j?.ok ? j.melding : j?.error) || "Starten lukte niet.",
      });
      if (j?.ok) setTimeout(() => void ververs(), 4000);
    } catch {
      setBericht({ soort: "fout", tekst: "Starten lukte niet." });
    } finally {
      setDraait(false);
    }
  }

  async function nieuw() {
    if (!nieuwTitel.trim()) return;
    const r = await fetch("/api/admin/punten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ titel: nieuwTitel.trim(), omvang: nieuwOmvang }),
    }).catch(() => null);
    const j = await r?.json().catch(() => null);
    if (j?.ok) { setNieuwTitel(""); await ververs(); }
    else setBericht({ soort: "fout", tekst: j?.error || "Toevoegen lukte niet." });
  }

  function kaart(p: Punt, opties: {
    controle?: boolean; akkoord?: boolean; sleepbaar?: boolean; idee?: boolean; sparren?: boolean;
  } = {}) {
    const start = startVan(p.id);
    return (
      <li
        key={p.id}
        className={"tw-item" + (p.stand === "klaar" || p.stand === "afgewezen" ? " tw-item-af" : "")
          + (sleep === p.id ? " tw-item-sleept" : "")}
        onDragOver={opties.sleepbaar ? (e) => e.preventDefault() : undefined}
        onDrop={opties.sleepbaar ? (e) => { e.preventDefault(); void laatVallen(p.id); } : undefined}
      >
        <div className="tw-item-kop">
          {opties.sleepbaar && (
            <span
              className="drag-handle tw-greep"
              draggable
              onDragStart={() => setSleep(p.id)}
              onDragEnd={() => setSleep(null)}
              title="Sleep om de volgorde te veranderen"
            >
              ⠿
            </span>
          )}
          <span className="gp-code gp-code-stil">{p.code}</span>
          <div className="tw-tekst md" dangerouslySetInnerHTML={{ __html: mdToHtml(`**${p.titel}**${p.tekst ? `\n\n${p.tekst}` : ""}`) }} />
        </div>

        {p.plan && (opties.akkoord || openPlan === p.id) && (
          <>
            <div className="gp-plan-kop">Het plan</div>
            <div className="gp-plan md" dangerouslySetInnerHTML={{ __html: mdToHtml(p.plan) }} />
          </>
        )}
        {p.plan && !opties.akkoord && (
          <div className="gp-plan-vouw">
            <button type="button" className="btn btn-quiet btn-klein" onClick={() => setOpenPlan(openPlan === p.id ? null : p.id)}>
              {openPlan === p.id ? "Plan dichtklappen" : "Bekijk het plan"}
            </button>
          </div>
        )}

        {p.draad.length > 0 && (
          <ul className="tw-draad">
            {p.draad.map((r, i) => (
              <li key={i} className={r.van === "claude" ? "tw-draad-claude" : "tw-draad-maarten"}>
                <span className="tw-draad-wie">{r.van === "claude" ? "Van mij" : "Van jou"}</span>
                <span className="tw-draad-tekst">{r.tekst}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="tw-meta">
          <span className="tw-stand-chip">{STAND_LABEL[p.stand]}</span>
          <span className="tw-datum">{OMVANG_LABEL[p.omvang]}</span>
          {p.routekaart && <span className="tw-stand-chip tw-chip-punt">{p.routekaart}</span>}
          {/* Waar het over gaat. Zonder dit moest de ronde zelf raden welk scherm
              je bedoelde, en dat kostte bij G1 veertien minuten en een mislukking. */}
          {p.raakt.length > 0 && (
            <span className="tw-stand-chip">Gaat over {p.raakt.join(", ")}</span>
          )}
          {p.goedgekeurd && <span className="tw-stand-chip gp-chip-akkoord">Door jou goedgekeurd</span>}
          {start && <span className="tw-stand-chip gp-tijd">Begint {wanneer(start.begint)}, ongeveer {minuten(start.minuten)}</span>}
          {p.stand === "plan-maken" && !p.ronde && (
            <span className="tw-stand-chip tw-rondes">Nog niet begonnen</span>
          )}
          {p.rondes > 1 && <span className="tw-stand-chip tw-rondes">{p.rondes} bouwrondes</span>}
        </div>

        {antwoordVoor === p.id ? (
          <div className="tw-correctie">
            <textarea
              className="tw-veld tw-veld-klein"
              value={antwoord}
              onChange={(e) => setAntwoord(e.target.value)}
              placeholder="Wat moet er anders? Dit komt onder dit punt te staan, dus het raakt niet kwijt."
              autoFocus
            />
            <div className="tw-item-acties">
              <button
                type="button"
                className="btn btn-primary btn-klein"
                onClick={async () => {
                  if (!antwoord.trim()) return;
                  // Een opmerking, of het nu over het plan gaat of over iets dat
                  // live staat: het punt gaat terug naar "plan wordt gemaakt", met
                  // de opmerking eronder. Zo blijft het één punt met één draadje,
                  // in plaats van een tweede melding die niemand meer koppelt.
                  if (await stuur({ id: p.id, stand: "plan-maken", regel: antwoord.trim() })) {
                    setAntwoordVoor(null); setAntwoord("");
                  }
                }}
              >
                Terug naar de tekentafel
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-klein"
                onClick={async () => {
                  if (!antwoord.trim()) return;
                  if (await stuur({ id: p.id, regel: antwoord.trim() })) { setAntwoordVoor(null); setAntwoord(""); }
                }}
              >
                Alleen een opmerking erbij
              </button>
              <button type="button" className="btn btn-quiet btn-klein" onClick={() => { setAntwoordVoor(null); setAntwoord(""); }}>
                Annuleren
              </button>
            </div>
          </div>
        ) : (
          <div className="tw-item-acties">
            {opties.controle && (
              <div className="pnl-acties-groep">
                <button type="button" className="btn btn-primary btn-klein" onClick={() => void stuur({ id: p.id, stand: "klaar" })}>Klopt</button>
                <button type="button" className="btn btn-ghost btn-klein" onClick={() => setAntwoordVoor(p.id)}>Nog niet goed</button>
              </div>
            )}
            {opties.akkoord && (
              <div className="pnl-acties-groep">
                <button
                  type="button"
                  className="btn btn-primary btn-klein"
                  onClick={() => void stuur({ id: p.id, stand: "wachtrij", keurGoed: true })}
                >
                  Akkoord, in de bouwwachtrij
                </button>
                <button type="button" className="btn btn-ghost btn-klein" onClick={() => setAntwoordVoor(p.id)}>
                  Nog niet, ik heb opmerkingen
                </button>
                <button type="button" className="btn btn-quiet btn-klein" onClick={() => void stuur({ id: p.id, stand: "afgewezen" })}>
                  Toch niet doen
                </button>
              </div>
            )}
            {opties.idee && (
              <div className="pnl-acties-groep">
                <button
                  type="button"
                  className="btn btn-primary btn-klein"
                  onClick={() => void planNu(p.id)}
                  disabled={startBezig !== null}
                >
                  {startBezig === p.id ? "Bezig met starten…" : "Maak er nu een plan van"}
                </button>
                <button type="button" className="btn btn-ghost btn-klein" onClick={() => setAntwoordVoor(p.id)}>
                  Eerst wat meegeven
                </button>
              </div>
            )}
            {opties.sparren && (
              <div className="pnl-acties-groep">
                {/* Een punt op "plan wordt gemaakt" zonder lopende ronde is niet
                    bezig, hij wacht. Dat stond er eerst niet bij, en dan lijkt
                    het of er nagedacht wordt terwijl er niets draait. */}
                {!p.ronde && (
                  <button
                    type="button"
                    className="btn btn-primary btn-klein"
                    onClick={() => void planNu(p.id)}
                    disabled={startBezig !== null}
                  >
                    {startBezig === p.id ? "Bezig met starten…" : "Begin nu met het plan"}
                  </button>
                )}
                <button type="button" className="btn btn-ghost btn-klein" onClick={() => setAntwoordVoor(p.id)}>
                  Iets meegeven voor het plan
                </button>
              </div>
            )}
            {p.stand === "wachtrij" && (
              <button type="button" className="btn btn-ghost btn-klein" onClick={() => void stuur({ id: p.id, stand: "plan-klaar" })}>
                Uit de wachtrij halen
              </button>
            )}
            {(p.stand === "klaar" || p.stand === "afgewezen") && (
              <button type="button" className="btn btn-quiet btn-klein" onClick={() => void stuur({ id: p.id, stand: "idee" })}>
                Terug op de lijst
              </button>
            )}
            {p.heeftBeeld && (
              <button type="button" className="btn btn-quiet btn-klein pnl-acties-info" onClick={() => void haalBeeld(p.id)}>
                Bekijk het beeld
              </button>
            )}
            <button type="button" className="btn btn-danger btn-klein" onClick={() => void weg(p.id)}>Weg</button>
          </div>
        )}
      </li>
    );
  }

  // Alleen de kop met het aantal; de uitleg-alinea's eronder zijn er bewust uit.
  function blok(titel: string, lijst: Punt[], opties: Parameters<typeof kaart>[1] = {}) {
    if (lijst.length === 0) return null;
    return (
      <div className="beheer-blok">
        <h2 className="beheer-h2">{titel} ({lijst.length})</h2>
        <ul className="tw-lijst">{lijst.map((p) => kaart(p, opties))}</ul>
      </div>
    );
  }

  return (
    <>
      <AdminKop titel="Grote punten" />
      <div className="beheer-container">

        {nu && restNu && v ? (
          <div className={"gp-nu" + (v.duurtLang ? " gp-balk-traag" : "")}>
            <div className="gp-nu-kop">
              <span className="gp-nu-label">
                {stand.werk === "plan" ? "Plan wordt geschreven" : "Nu aan het bouwen"}
              </span>
              <span className="gp-code">{nu.code}</span>
              <span className="gp-nu-titel">{nu.titel}</span>
            </div>
            <div className="gp-balk">
              <div className="gp-balk-vul" style={{ width: `${Math.round(Math.max(0.04, v.deel) * 100)}%` }} />
            </div>
            <div className="gp-nu-regel">
              <span className="gp-nu-stap">Stap {Math.max(1, v.stapNr)} van {v.stappen}: {v.stap}</span>
              <span className="gp-nu-tijd">
                {minuten(restNu.verstreken)} bezig, nog ongeveer {minuten(restNu.rest)}
              </span>
            </div>
            {stand.werk === "plan" && (
              <div className="gp-venster">
                Er verandert nu niets aan het dashboard. Zodra het plan er is, verschijnt het
                hieronder voor je akkoord.
              </div>
            )}
            {v.duurtLang && (
              <div className="gp-traag">
                Dit duurt langer dan normaal. Meestal is dat gewoon een taaie klus; blijft hij
                hangen, dan geeft hij de wachtrij vanzelf weer vrij.
              </div>
            )}
          </div>
        ) : nu ? (
          <div className="gp-nu">
            <div className="gp-nu-kop">
              <span className="gp-nu-label">Net begonnen</span>
              <span className="gp-code">{nu.code}</span>
              <span className="gp-nu-titel">{nu.titel}</span>
            </div>
            <p className="gp-venster">
              De ronde is opgestart en heeft zijn eerste stap nog niet gemeld. Dat duurt normaal
              hooguit een minuut; blijft het hier staan, dan is hij niet goed opgekomen en geeft
              hij de wachtrij vanzelf weer vrij.
            </p>
          </div>
        ) : stand.slot.opstarten ? (
          /* ── DE MINUUT TUSSEN JOUW KLIK EN ZIJN EERSTE MELDING ──
             Hier stond "er wordt nu niets gebouwd", en dat was onwaar op precies
             het moment dat je wilt weten of je klik is aangekomen. Een ronde moet
             eerst opgestart worden, de code ophalen en de pakketten installeren;
             dat duurt ongeveer een minuut en daarna meldt hij zich vanzelf. */
          <div className="gp-nu">
            <div className="gp-nu-kop">
              <span className="gp-nu-label">Aan het opstarten</span>
              <span className="gp-nu-titel">
                {stand.slot.opstarten.baan === "tweak" ? "Een tweak-ronde" : "Een grote-puntenronde"} is gestart
              </span>
            </div>
            <div className="gp-balk">
              <div className="gp-balk-vul gp-balk-onbekend" />
            </div>
            <div className="gp-nu-regel">
              <span className="gp-nu-stap">Klaarzetten: code ophalen en pakketten installeren</span>
              <span className="gp-nu-tijd">{opstartTekst}</span>
            </div>
            <div className="gp-venster">
              Dit duurt ongeveer een minuut. Zodra hij zich meldt verschijnt hier de eerste stap met
              een tijdsverwachting. Je hoeft niets te doen en niet nog een keer te drukken.
            </div>
          </div>
        ) : (
          <div className="gp-nu gp-nu-stil">
            <div className="gp-nu-kop">
              <span className="gp-nu-label">Er wordt nu niets gebouwd</span>
            </div>
            <p className="gp-venster">
              {stand.slot.baan === "tweak"
                ? "Er loopt een tweak-ronde. Grote punten wachten daarop; ze bouwen nooit tegelijk."
                : planMaken.some((p) => !p.ronde)
                  ? "Er wacht een plan om geschreven te worden. Druk bij dat punt op \"Begin nu met het plan\"; dat gebeurt niet vanzelf."
                  : wachtrij.length === 0
                    ? "De bouwwachtrij is leeg. Keur een plan goed, dan gaat het vannacht mee."
                    : `${wachtrij.length === 1 ? "Eén punt staat" : `${wachtrij.length} punten staan`} klaar. De eerste begint ${
                      startVan(wachtrij[0].id) ? wanneer(startVan(wachtrij[0].id)!.begint) : "zodra het nacht is"
                    }.`}
            </p>
          </div>
        )}

        <div className="tw-balk">
          <div className="tw-stand">
            <span className="tw-getal">{wachtrij.length}</span>
            <span className="tw-getal-bij">{wachtrij.length === 1 ? "staat in de bouwwachtrij" : "staan in de bouwwachtrij"}</span>
          </div>
          <div className="tw-balk-acties">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void draaiNu()}
              disabled={draait || Boolean(stand.slot.ronde) || (wachtrij.length === 0 && planMaken.length === 0)}
            >
              {draait ? "Bezig met starten…" : "Nu draaien"}
            </button>
            <Kopieer tekst={startregel} label="Startregel kopiëren" />
            <button type="button" className="btn btn-quiet btn-klein" onClick={() => setToonAf(!toonAf)}>
              {toonAf ? "Alleen wat loopt" : `Ook de afgeronde (${afgerond.length})`}
            </button>
            <a className="btn btn-quiet btn-klein pnl-acties-info" href="/admin/tweaks">Tweak-stapel</a>
          </div>
        </div>

        {bericht && <div className={bericht.soort === "ok" ? "tw-ok" : "tw-fout"}>{bericht.tekst}</div>}

        {knopKlaar && !knopKlaar.klaar && (
          <div className="tw-fout">
            <strong>Nu draaien werkt nog niet.</strong> {knopKlaar.reden}
          </div>
        )}

        {blok("Klaar, klopt het?",
          controleer, { controle: true })}

        {blok("Plan klaar, jouw akkoord",
          planKlaar, { akkoord: true })}

        {blok("In de bouwwachtrij",
          wachtrij, { sleepbaar: true })}

        {blok("Plan wordt gemaakt",
          planMaken, { sparren: true })}

        {blok("Ideeën, nog geen plan",
          ideeen, { idee: true })}

        {toonAf && blok("Afgerond",
          afgerond)}

        <div className="beheer-blok">
          <h2 className="beheer-h2">Een groot punt erbij</h2>
          <div className="gp-nieuw">
            <div className="gp-nieuw-rij">
              <input
                className="gp-invoer"
                value={nieuwTitel}
                onChange={(e) => setNieuwTitel(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void nieuw(); }}
                placeholder="Wat zou er anders moeten?"
              />
              <select
                className="gp-keuze"
                value={nieuwOmvang}
                onChange={(e) => setNieuwOmvang(e.target.value as Omvang)}
                aria-label="Hoe groot is dit ongeveer"
              >
                <option value="klein">Klein</option>
                <option value="middel">Middel</option>
                <option value="groot">Groot</option>
              </select>
              <button type="button" className="btn btn-ghost btn-klein" onClick={() => void nieuw()}>
                Toevoegen
              </button>
            </div>
          </div>
        </div>

        {grootBeeld !== null && beelden[grootBeeld] && (
          <div className="tw-overlay">
            <div className="tw-venster tw-venster-beeld" role="dialog" aria-label="Schermafbeelding">
              <div className="tw-kop">
                <div className="tw-titel">Meegestuurd beeld</div>
                <button type="button" className="tw-sluit" onClick={() => setGrootBeeld(null)} aria-label="Sluiten">×</button>
              </div>
              <div className="tw-body tw-body-beeld">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={beelden[grootBeeld]} alt="Meegestuurde schermafbeelding" />
              </div>
            </div>
          </div>
        )}

        {punten.filter((p) => p.stand !== "klaar" && p.stand !== "afgewezen").length === 0 && (
          <div className="tw-leeg">
            Nog geen grote punten. Ze komen hier vanzelf terecht zodra je bij een melding kiest
            voor &quot;dit is groter dan een tweak&quot;, of voeg er hierboven zelf een toe.
          </div>
        )}
      </div>
    </>
  );
}
