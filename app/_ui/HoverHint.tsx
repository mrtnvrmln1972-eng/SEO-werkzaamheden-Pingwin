"use client";

import { useEffect, useState } from "react";
import { leesHintVertraging } from "./hint-vertraging";

// ═══════════════════════════════════════════════════════════
// ÉÉN DONKER HOVER-BOLLETJE VOOR DE HELE OMGEVING
// ═══════════════════════════════════════════════════════════
// Elk element met een `title`-attribuut kreeg tot nu toe de trage, wisselende
// tooltip van de browser zelf. Dit component vervangt die door één vaste,
// nette stijl (donkere achtergrond, korte toelichting), overal waar een
// `title` al staat en dus automatisch ook bij alles wat later met een
// `title` gebouwd wordt. Geen los tooltip-component per scherm nodig.
//
// Hij verschijnt pas als je even stil blijft hangen (--hint-vertraging in
// globals.css, standaard 700ms). Daarvóór flikkerde er een bolletje langs élk
// knopje dat je onderweg passeerde, en dat is precies waarom niemand ze las.
// Twee dingen die daarbij horen:
//  - de `title` gaat er meteen af, ook al tonen we nog niets, anders komt de
//    tooltip van de browser zelf er tijdens het wachten alsnog overheen;
//  - beweeg je binnen hetzelfde element, dan gebeurt er niets meer. Eerder
//    vond de code dan de kaart eronder (die óók een title heeft, want die van
//    het knopje was net weggehaald) en wisselde het bolletje van tekst.
// Toetsenbord (focus) en aanklikken zijn de uitzonderingen: focus toont direct,
// een muisklik laat de uitleg vallen.
// ═══════════════════════════════════════════════════════════

type Hint = { tekst: string; x: number; y: number; boven: boolean };

export default function HoverHint() {
  const [hint, setHint] = useState<Hint | null>(null);

  useEffect(() => {
    let actief: HTMLElement | null = null;
    let wachter: ReturnType<typeof setTimeout> | null = null;
    const vertraging = leesHintVertraging();

    function stopWachter() {
      if (wachter) { clearTimeout(wachter); wachter = null; }
    }

    function verberg() {
      stopWachter();
      if (actief) {
        const bewaard = actief.dataset.hhTitel;
        if (bewaard) { actief.setAttribute("title", bewaard); delete actief.dataset.hhTitel; }
      }
      actief = null;
      setHint(null);
    }

    function toon(el: HTMLElement, direct: boolean) {
      const tekst = el.getAttribute("title");
      if (!tekst) return;
      if (actief) verberg();
      el.dataset.hhTitel = tekst;
      el.removeAttribute("title");
      actief = el;
      setHint(null);

      const tonen = () => {
        wachter = null;
        if (actief !== el || !el.isConnected) return;
        const r = el.getBoundingClientRect();
        const boven = r.top > 60;
        setHint({ tekst, x: r.left + r.width / 2, y: boven ? r.top : r.bottom, boven });
      };
      if (direct || vertraging <= 0) tonen();
      else wachter = setTimeout(tonen, vertraging);
    }

    function overEl(e: Event) {
      const doel = e.target as HTMLElement | null;
      if (actief && doel && actief.contains(doel)) return; // nog binnen hetzelfde element
      const el = doel?.closest?.("[title]") as HTMLElement | null;
      if (el && el !== actief) toon(el, false);
    }
    function outEl(e: Event) {
      const naar = (e as MouseEvent).relatedTarget as Node | null;
      if (actief && !(naar && actief.contains(naar))) verberg();
    }
    function focusEl(e: Event) {
      const el = (e.target as HTMLElement)?.closest?.("[title]") as HTMLElement | null;
      if (el) toon(el, true);
    }

    document.addEventListener("mouseover", overEl);
    document.addEventListener("mouseout", outEl);
    document.addEventListener("focusin", focusEl);
    document.addEventListener("focusout", verberg);
    document.addEventListener("scroll", verberg, true);
    document.addEventListener("mousedown", verberg, true);
    return () => {
      verberg();
      document.removeEventListener("mouseover", overEl);
      document.removeEventListener("mouseout", outEl);
      document.removeEventListener("focusin", focusEl);
      document.removeEventListener("focusout", verberg);
      document.removeEventListener("scroll", verberg, true);
      document.removeEventListener("mousedown", verberg, true);
    };
  }, []);

  if (!hint) return null;
  return (
    <div className={"hh-bubble" + (hint.boven ? " hh-boven" : " hh-onder")} style={{ left: hint.x, top: hint.y }}>
      {hint.tekst}
    </div>
  );
}
