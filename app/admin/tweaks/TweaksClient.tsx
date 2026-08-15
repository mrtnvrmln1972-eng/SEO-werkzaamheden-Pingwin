"use client";

// ═══════════════════════════════════════════════════════════
// DE STAPEL IN BEELD
// ═══════════════════════════════════════════════════════════
// Drie vragen die dit scherm beantwoordt, in deze volgorde:
//   1. staat er iets klaar dat ík moet bekijken?
//   2. wat staat er in de wachtrij?
//   3. welke grotere ideeën liggen er nog?
//
// Vandaar de volgorde van de blokken hieronder. "Controleer even" staat
// bovenaan, want dat is het enige waar Maarten iets mee moet; de rest is
// informatie. Klopt het niet, dan gaat dezelfde melding terug de wachtrij in
// mét zijn correctie eronder, in plaats van dat er een tweede briefje ontstaat
// dat niemand meer aan het eerste knoopt.
// ═══════════════════════════════════════════════════════════

import { useState } from "react";
import AdminKop from "../AdminKop";
import Kopieer from "../Kopieer";
import { mdToHtml } from "../../../lib/markdown";
import type { Tweak, Stand } from "../../../lib/tweaks";

const STAND_LABEL: Record<Stand, string> = {
  wachtrij: "In de wachtrij",
  bezig: "Wordt nu gebouwd",
  controleer: "Staat live, klopt het?",
  klaar: "Klaar",
  apart: "Apart gezet, te groot voor een ronde",
};

function datum(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
}

export default function TweaksClient({ begin, startregel }: { begin: Tweak[]; startregel: string }) {
  const [tweaks, setTweaks] = useState<Tweak[]>(begin);
  const [toonAf, setToonAf] = useState(false);
  const [beelden, setBeelden] = useState<Record<number, string>>({});
  const [groot, setGroot] = useState<number | null>(null);
  const [correctieVoor, setCorrectieVoor] = useState<number | null>(null);
  const [correctie, setCorrectie] = useState("");

  const controleer = tweaks.filter((t) => t.stand === "controleer");
  const wachtrij = tweaks.filter((t) => (t.stand === "wachtrij" || t.stand === "bezig") && t.soort === "tweak");
  const ideeen = tweaks.filter((t) => (t.stand === "wachtrij" || t.stand === "bezig") && t.soort === "idee");
  const afgerond = tweaks.filter((t) => t.stand === "klaar" || t.stand === "apart");

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

  async function stuurCorrectie(id: number) {
    if (!correctie.trim()) return;
    await zet(id, "wachtrij", correctie.trim());
    setCorrectieVoor(null);
    setCorrectie("");
  }

  function kaart(t: Tweak, metControle: boolean) {
    return (
      <li key={t.id} className={"tw-item" + (t.stand === "klaar" || t.stand === "apart" ? " tw-item-af" : "")}>
        <div className="tw-tekst md" dangerouslySetInnerHTML={{ __html: mdToHtml(t.tekst) }} />

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
            {metControle && (
              <>
                <button type="button" className="btn btn-primary btn-klein" onClick={() => void zet(t.id, "klaar")}>Klopt</button>
                <button type="button" className="btn btn-ghost btn-klein" onClick={() => setCorrectieVoor(t.id)}>Nog niet goed</button>
              </>
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

  function blok(titel: string, uitleg: string, lijst: Tweak[], metControle = false) {
    if (lijst.length === 0) return null;
    return (
      <div className="beheer-blok">
        <h2 className="beheer-h2">{titel} ({lijst.length})</h2>
        <p className="beheer-uitleg">{uitleg}</p>
        <ul className="tw-lijst">{lijst.map((t) => kaart(t, metControle))}</ul>
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
            Eén ronde werkt de hele stapel af: één keer inlezen, één bouw, één keer live. Elk uur
            draait er vanzelf een ronde als er iets klaarstaat, en je kunt hem ook zelf starten.
          </p>
        </div>

        <div className="tw-balk">
          <div className="tw-stand">
            <span className="tw-getal">{wachtrij.length}</span>
            <span className="tw-getal-bij">{wachtrij.length === 1 ? "staat in de wachtrij" : "staan in de wachtrij"}</span>
          </div>
          <div className="tw-balk-acties">
            <Kopieer tekst={startregel} label="Stapel nu afwerken" primair />
            <button type="button" className="btn btn-quiet btn-klein" onClick={() => setToonAf(!toonAf)}>
              {toonAf ? "Alleen wat loopt" : `Ook de afgeronde (${afgerond.length})`}
            </button>
          </div>
        </div>
        <p className="beheer-klein">
          Die knop zet <code>{startregel}</code> op je klembord, voor als je niet tot het volgende
          hele uur wilt wachten.
        </p>

        {blok("Klaar, klopt het?", "Dit staat live. Zeg of het goed is; klopt het niet, dan gaat het met jouw correctie terug de wachtrij in.", controleer, true)}
        {blok("In de wachtrij", "Gaat mee in de eerstvolgende ronde.", wachtrij)}
        {blok("Grotere ideeën", "Wordt niet in een ronde weggewerkt. Hier maak ik eerst een voorstel van.", ideeen)}
        {toonAf && blok("Afgerond", "Klaar of apart gezet.", afgerond)}

        {controleer.length + wachtrij.length + ideeen.length === 0 && (
          <div className="tw-leeg">
            Niets open. Zie je iets dat anders moet, druk dan op het knopje rechtsonder op het
            scherm waar je op dat moment staat.
          </div>
        )}
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
