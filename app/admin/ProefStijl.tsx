"use client";

import { useEffect, useState } from "react";
import {
  leesProefstijl, bewaarProefstijl, pasProefstijlToe, wisProefstijl,
  WIJZIG_EVENT, type Thema,
} from "../../lib/proefstijl";

// Het balkje bovenin dat zegt dat je naar een proefstijl kijkt, plus de motor
// die die stijl op élk beheerscherm toepast.
//
// Hangt in de schil om alle adminpagina's (app/admin/layout.tsx), zodat een
// pagina er niets voor hoeft door te geven. Zelfde plek en zelfde idee als het
// kijk-als-balkje en het Tweak-knopje.
//
// Het balkje is niet optioneel. Zonder zichtbare melding zou je op een dag naar
// een dashboard kijken dat er anders uitziet dan voor iedereen anders, en dat
// niet weten. Een proef die je niet kunt zien lopen is een valstrik.

export default function ProefStijl() {
  const [thema, setThema] = useState<Thema | null>(null);

  useEffect(() => {
    const bij = () => {
      const t = leesProefstijl();
      setThema(t);
      if (t) pasProefstijlToe(t); else wisProefstijl();
    };
    bij();
    window.addEventListener(WIJZIG_EVENT, bij);
    // Een tweede tabblad dat de proef aanzet of uitzet werkt hier ook door.
    window.addEventListener("storage", bij);
    return () => {
      window.removeEventListener(WIJZIG_EVENT, bij);
      window.removeEventListener("storage", bij);
    };
  }, []);

  if (!thema) return null;

  return (
    <div className="proefstijl-balk">
      <span className="proefstijl-tekst">
        Je bekijkt een <strong>proefstijl</strong>: {thema.naam}. Alleen in jouw browser, niemand
        anders ziet dit. Nog niet vastgelegd.
      </span>
      <a className="btn btn-quiet btn-klein proefstijl-knop" href="/admin/stijl">Bijstellen</a>
      <button type="button" className="btn btn-ghost btn-klein" onClick={() => bewaarProefstijl(null)}>
        Zet terug
      </button>
    </div>
  );
}
