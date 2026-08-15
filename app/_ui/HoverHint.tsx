"use client";

import { useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════
// ÉÉN DONKER HOVER-BOLLETJE VOOR DE HELE OMGEVING
// ═══════════════════════════════════════════════════════════
// Elk element met een `title`-attribuut kreeg tot nu toe de trage, wisselende
// tooltip van de browser zelf. Dit component vervangt die door één vaste,
// nette stijl (donkere achtergrond, korte toelichting), overal waar een
// `title` al staat en dus automatisch ook bij alles wat later met een
// `title` gebouwd wordt. Geen los tooltip-component per scherm nodig.
// ═══════════════════════════════════════════════════════════

type Hint = { tekst: string; x: number; y: number; boven: boolean };

export default function HoverHint() {
  const [hint, setHint] = useState<Hint | null>(null);

  useEffect(() => {
    let actief: HTMLElement | null = null;

    function verberg() {
      if (actief) {
        const bewaard = actief.dataset.hhTitel;
        if (bewaard) { actief.setAttribute("title", bewaard); delete actief.dataset.hhTitel; }
      }
      actief = null;
      setHint(null);
    }

    function toon(el: HTMLElement) {
      const tekst = el.getAttribute("title");
      if (!tekst) return;
      if (actief) verberg();
      el.dataset.hhTitel = tekst;
      el.removeAttribute("title");
      actief = el;
      const r = el.getBoundingClientRect();
      const boven = r.top > 60;
      setHint({ tekst, x: r.left + r.width / 2, y: boven ? r.top : r.bottom, boven });
    }

    function overEl(e: Event) {
      const el = (e.target as HTMLElement)?.closest?.("[title]") as HTMLElement | null;
      if (el && el !== actief) toon(el);
    }
    function outEl(e: Event) {
      const naar = (e as MouseEvent).relatedTarget as Node | null;
      if (actief && !(naar && actief.contains(naar))) verberg();
    }
    function focusEl(e: Event) {
      const el = (e.target as HTMLElement)?.closest?.("[title]") as HTMLElement | null;
      if (el) toon(el);
    }

    document.addEventListener("mouseover", overEl);
    document.addEventListener("mouseout", outEl);
    document.addEventListener("focusin", focusEl);
    document.addEventListener("focusout", verberg);
    document.addEventListener("scroll", verberg, true);
    return () => {
      verberg();
      document.removeEventListener("mouseover", overEl);
      document.removeEventListener("mouseout", outEl);
      document.removeEventListener("focusin", focusEl);
      document.removeEventListener("focusout", verberg);
      document.removeEventListener("scroll", verberg, true);
    };
  }, []);

  if (!hint) return null;
  return (
    <div className={"hh-bubble" + (hint.boven ? " hh-boven" : " hh-onder")} style={{ left: hint.x, top: hint.y }}>
      {hint.tekst}
    </div>
  );
}
