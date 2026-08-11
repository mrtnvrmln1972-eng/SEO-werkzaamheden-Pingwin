"use client";

// Je eigen aantekeningen bij een taak.
//
// De kaarttekst erboven is geschreven door de assistent en wordt bij elke
// samenvoeging opnieuw bijgewerkt. Dit veld niet: wat je hier typt blijft staan,
// geen enkele automatische stap raakt het aan. Daarom staat het er ook los onder
// en niet ergens tussen de gegenereerde tekst.
//
// Zelfde veld als bij Zoekwoorden & links, zodat vet, bullets en plakken overal
// hetzelfde werken (app/_velden/RijkTekstVeld.tsx).
//
// ── Waarom het bewaren zo dichtgetimmerd is (11 augustus 2026) ──
// Er stond al een wachtklok van 900 ms, maar die dekte maar één geval: doortypen.
// Klapte je de taak meteen dicht, dan verdween dit hele blokje van het scherm
// vóórdat de klok afliep, en was wat je net typte weg. Hetzelfde bij weg-klikken
// naar een ander scherm of het tabblad sluiten. Het veld zelf meldt ook geen
// "klaar" als je erbuiten klikt, dus daar viel niets te vangen.
//
// Nu bewaart hij op vier momenten, en het eerste dat aankomt wint:
//   1. tijdens het typen, na een korte stilte (nu 400 ms in plaats van 900);
//   2. zodra je buiten het blokje klikt;
//   3. op het moment dat de taak dichtklapt of het scherm wisselt (afscheid);
//   4. als het tabblad naar de achtergrond gaat of sluit.
// De laatste twee gaan met `keepalive` de deur uit: een gewone fetch wordt door
// de browser afgebroken zodra het onderdeel of de pagina verdwijnt, en dat is
// precies het moment waarop het moet lukken.

import { useEffect, useRef, useState, type ReactNode } from "react";
import RijkTekstVeld from "../../../_velden/RijkTekstVeld";

const WACHT_MS = 400;

export default function KaartNotitie({ slug, id, start, toolbarExtra }: { slug: string; id: number; start: string; toolbarExtra?: ReactNode }) {
  const [waarde, setWaarde] = useState(start);
  const [stand, setStand] = useState<"" | "bezig" | "bewaard" | "fout">("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laatst = useRef(start);
  // Wat er op dit moment in het veld staat, buiten React om bijgehouden: het
  // afscheid hieronder draait één keer bij het verdwijnen en kijkt dan naar deze
  // ref. Zou hij naar de state kijken, dan zag hij de tekst van het allereerste
  // moment, en bewaarde hij dus niets.
  const nu = useRef(start);

  function stopKlok() {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  }

  // Tijdens het typen niet bij elke toets opslaan, maar wel vanzelf: je hoeft
  // nergens op te klikken en je raakt niets kwijt als je de kaart dichtklapt.
  function bewaarStraks(html: string) {
    nu.current = html;
    setWaarde(html);
    stopKlok();
    timer.current = setTimeout(() => void bewaar(html), WACHT_MS);
  }

  async function bewaar(html: string) {
    stopKlok();
    if (html === laatst.current) return;
    setStand("bezig");
    // Meteen vastleggen wat er onderweg is: typ je door terwijl dit loopt, dan
    // vergelijkt de volgende ronde met de nieuwe tekst en niet met de oude.
    const onderweg = html;
    try {
      const d = await fetch("/api/admin/weekplan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id, notitie: onderweg }),
      }).then((r) => r.json());
      if (d?.ok) { laatst.current = onderweg; setStand("bewaard"); setTimeout(() => setStand(""), 1500); }
      else setStand("fout");
    } catch { setStand("fout"); }
  }

  /** Nu meteen wegschrijven, ook als het scherm eronder verdwijnt. */
  const directGestuurd = useRef<string | null>(null);
  function bewaarDirect() {
    const html = nu.current;
    stopKlok();
    if (html === laatst.current || html === directGestuurd.current) return;
    // Bewust NIET als "bewaard" afvinken: dit verzoek vertrekt op het moment dat
    // alles verdwijnt, dus we horen het antwoord nooit. Eén verzoek te veel is
    // niets (het overschrijft dezelfde tekst), één verzoek te weinig is je werk
    // kwijt. Wel onthouden wát er net weg is, zodat hetzelfde afscheid niet
    // twee keer dezelfde tekst stuurt.
    directGestuurd.current = html;
    // keepalive: de browser maakt dit verzoek af, ook als dit blokje of de hele
    // pagina op datzelfde moment weg is.
    fetch("/api/admin/weekplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, id, notitie: html }),
      keepalive: true,
    }).catch(() => { /* laatste redmiddel; de melding zou toch niemand meer zien */ });
  }

  // Tabblad sluiten of naar de achtergrond: hetzelfde afscheid.
  useEffect(() => {
    const bij = () => bewaarDirect();
    const bijWissel = () => { if (document.visibilityState === "hidden") bewaarDirect(); };
    window.addEventListener("pagehide", bij);
    document.addEventListener("visibilitychange", bijWissel);
    return () => {
      window.removeEventListener("pagehide", bij);
      document.removeEventListener("visibilitychange", bijWissel);
      // Dit blokje verdwijnt: de taak klapt dicht, je gaat naar een ander
      // tabblad in de cockpit, of je klikt door. Precies het geval waar het
      // eerder misging.
      bewaarDirect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, id]);

  return (
    // onBlur op het hele blokje: React laat dit meelopen vanuit het tekstvak en
    // de knoppen, dus één klik buiten de aantekeningen is genoeg om te bewaren.
    <div className="wp-notitie" onBlur={() => void bewaar(nu.current)}>
      <RijkTekstVeld
        waarde={waarde}
        onChange={bewaarStraks}
        onKlaar={() => void bewaar(nu.current)}
        klasse="wp-notitie-veld"
        placeholder="Wat je zelf wilt onthouden bij deze taak: afspraken, aandachtspunten, wat de klant zei."
        compact
        toolbarExtra={toolbarExtra}
        toolbarLabel={
          <>
            Aantekeningen
            {stand === "bezig" && <span className="muted">bewaren…</span>}
            {stand === "bewaard" && <span className="wp-notitie-ok">bewaard</span>}
            {stand === "fout" && <span className="wp-notitie-fout">bewaren mislukte</span>}
          </>
        }
      />
    </div>
  );
}
