"use client";

// ═══════════════════════════════════════════════════════════
// DE STAPEL IN BEELD
// ═══════════════════════════════════════════════════════════
// Eén scherm met één vraag: staat er genoeg klaar om een ronde te draaien? Dus
// bovenaan het aantal en de startregel, daaronder de meldingen zelf.
//
// Er is bewust geen drempel ("vanaf tien"): wanneer een stapel groot genoeg is
// hangt af van waar Maarten mee bezig is, niet van een getal. Het scherm toont
// de stand, hij drukt wanneer het hem uitkomt.
// ═══════════════════════════════════════════════════════════

import { useState } from "react";
import AdminKop from "../AdminKop";
import Kopieer from "../Kopieer";
import { mdToHtml } from "../../../lib/markdown";
import type { Tweak, Stand } from "../../../lib/tweaks";

const STAND_LABEL: Record<Stand, string> = {
  open: "Staat klaar",
  gedaan: "Doorgevoerd",
  apart: "Apart gezet, te groot voor een tweak",
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

  const open = tweaks.filter((t) => t.stand === "open");
  const afgerond = tweaks.filter((t) => t.stand !== "open");
  const zichtbaar = toonAf ? tweaks : open;

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

  async function zet(id: number, stand: Stand) {
    const r = await fetch("/api/admin/tweaks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, stand }),
    });
    if (r.ok) setTweaks((lijst) => lijst.map((t) => (t.id === id ? { ...t, stand } : t)));
  }

  return (
    <>
      <AdminKop titel="Tweaks" />
      <div className="beheer-container">
        <div className="beheer-kop">
          <h1 className="beheer-h1">De stapel kleine aanpassingen</h1>
          <p className="beheer-uitleg">
            Alles wat je onderweg meldt met het knopje <strong>Tweak</strong> komt hier terecht.
            Eén ronde werkt de hele stapel af: één keer inlezen, één bouw, één keer live. Dat is de
            reden dat losse tweaks samen minder kosten dan los van elkaar.
          </p>
        </div>

        <div className="tw-balk">
          <div className="tw-stand">
            <span className="tw-getal">{open.length}</span>
            <span className="tw-getal-bij">{open.length === 1 ? "melding staat klaar" : "meldingen staan klaar"}</span>
          </div>
          <div className="tw-balk-acties">
            <Kopieer tekst={startregel} label="Stapel afwerken" primair />
            <button type="button" className="btn btn-quiet btn-klein" onClick={() => setToonAf(!toonAf)}>
              {toonAf ? "Alleen de stapel" : `Ook de afgeronde (${afgerond.length})`}
            </button>
          </div>
        </div>
        <p className="beheer-klein">
          Die knop zet <code>{startregel}</code> op je klembord. Plak hem in een verse chat, dan
          worden ze in één ronde doorgevoerd.
        </p>

        {zichtbaar.length === 0 ? (
          <div className="tw-leeg">
            Nog niets gemeld. Zie je iets dat anders moet, druk dan op het knopje rechtsonder op
            het scherm waar je op dat moment staat.
          </div>
        ) : (
          <ul className="tw-lijst">
            {zichtbaar.map((t) => (
              <li key={t.id} className={"tw-item" + (t.stand === "open" ? "" : " tw-item-af")}>
                <div
                  className="tw-tekst md"
                  dangerouslySetInnerHTML={{ __html: mdToHtml(t.tekst) }}
                />
                <div className="tw-meta">
                  {t.pad ? <a className="tw-scherm" href={t.pad}>{t.scherm || t.pad}</a> : <span className="tw-scherm">{t.scherm}</span>}
                  <span className="tw-datum">{datum(t.aangemaakt)}</span>
                  {t.stand !== "open" && <span className="tw-stand-chip">{STAND_LABEL[t.stand]}</span>}
                </div>
                {t.notitie && <div className="tw-notitie">{t.notitie}</div>}
                <div className="tw-item-acties">
                  {t.beeld !== null && (
                    <button type="button" className="btn btn-ghost btn-klein" onClick={() => void haalBeeld(t.id)}>
                      Bekijk beeld
                    </button>
                  )}
                  {t.stand === "open" ? (
                    <button type="button" className="btn btn-quiet btn-klein" onClick={() => void zet(t.id, "gedaan")}>
                      Afvinken
                    </button>
                  ) : (
                    <button type="button" className="btn btn-quiet btn-klein" onClick={() => void zet(t.id, "open")}>
                      Terug op de stapel
                    </button>
                  )}
                  <button type="button" className="btn btn-danger btn-klein" onClick={() => void weg(t.id)}>Weg</button>
                </div>
              </li>
            ))}
          </ul>
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
