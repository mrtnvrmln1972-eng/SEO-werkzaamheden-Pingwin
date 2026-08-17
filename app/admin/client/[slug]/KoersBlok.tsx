"use client";

// ═══════════════════════════════════════════════════════════
// WAAR WE NAARTOE WERKEN, bovenaan de takenpagina
// ═══════════════════════════════════════════════════════════
// Eén kaart met twee uitklappers, allebei dicht tot je ze opent:
//   1. De koers               : de grote lijn, Maartens eigen tekst
//   2. Waar het werk vandaan komt : de plekken met werkvoorraad, met het
//                                   aantal dat er ligt, om door te klikken
//
// ── Wat hier weg is, en waarom ──
// 18-08-2026, ronde 1. Hier zat een derde strook, "Wat we nu oppakken": een
// vrij tekstveld met een generator, een verouderings-seintje en een
// streep-in-de-tijd eromheen. Vier mechanismen voor één veld dat je toch met de
// hand bijhoudt, en de uitkomst was dat er bij Kamsteeg een strategie stond die
// op 5 augustus klopte en op 16 augustus herzien was, met vier rode
// uitroeptekens erboven waarvan er één naar precies dat ingehaalde gesprek wees.
// Het systeem kon niet weten dat het ene gesprek het andere overrulet.
//
// 18-08-2026, ronde 2. Ook de knop "Klopt dit nog?" is eruit. Die legde de koers
// naast wat het dashboard al wist en zette het commentaar ernaast. Bij Kamsteeg
// leverde één klik vijf opmerkingen op die nergens over gingen. Een controle die
// je moet wegdenken is erger dan geen controle: hij kost aandacht en geeft niets
// terug. De route `/api/admin/koers-check` is mee weggehaald, want een knop
// weghalen en de motor laten staan is precies hoe er dode code blijft liggen.
//
// De verdeling is nu drie lagen die elkaar niet overlappen: de koers is de grote
// lijn, de knoppenrij is waar werk klaarligt, en de planning (eigen blok) is wat
// we deze periode doen.
//
// Het veld zelf is `FocusBlock`, hetzelfde component als "Overzicht". Bewust
// geen tweede editor: dat veld heeft al twee keer inhoud gekost en de reparatie
// daarvan (herstelStructuur, opslaan op vier momenten, versiehistorie) zit dáár.

import { useEffect, useState } from "react";
import FocusBlock from "./FocusBlock";

type WerkPost = { sleutel: string; label: string; aantal: number | null; tab: string; uitleg: string };

export default function KoersBlok({ slug, onGaNaarTab }: {
  slug: string;
  /** Binnen de cockpit van tab wisselen zonder de pagina te herladen. */
  onGaNaarTab?: (tab: string) => void;
}) {
  // Allebei dicht. Ze duwen anders de planning en de chats van het scherm af,
  // terwijl je hier meestal komt voor het werk eronder. Wat je openzet, blijft
  // per klant onthouden.
  const [open, setOpen] = useState({ koers: false, bronnen: false });
  const sleutelOpen = `pingwin-koers-open:${slug}`;
  useEffect(() => {
    try {
      const s = localStorage.getItem(sleutelOpen);
      const v = s ? JSON.parse(s) as Partial<typeof open> : null;
      setOpen({ koers: !!v?.koers, bronnen: !!v?.bronnen });
    } catch { /* geen opslag, dan gewoon dicht */ }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sleutelOpen]);
  function klap(sleutel: "koers" | "bronnen") {
    setOpen((v) => {
      const n = { ...v, [sleutel]: !v[sleutel] };
      try { localStorage.setItem(sleutelOpen, JSON.stringify(n)); } catch { /* geen opslag */ }
      return n;
    });
  }

  const [posten, setPosten] = useState<WerkPost[] | null>(null);

  // Pas tellen als je de strook openzet. Het is een goedkope leesopdracht, maar
  // hij hoeft niet te draaien voor een blok dat dicht is.
  useEffect(() => {
    if (!open.bronnen || posten !== null) return;
    let off = false;
    fetch(`/api/admin/werkvoorraad?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (!off && d.ok) setPosten(d.posten as WerkPost[]); })
      .catch(() => { /* een chip zonder cijfer is geen reden om het blok te verbergen */ });
    return () => { off = true; };
  }, [slug, open.bronnen, posten]);

  useEffect(() => { setPosten(null); }, [slug]);

  const kop = (sleutel: "koers" | "bronnen", titel: string) => (
    <button type="button" className="strategy-head" onClick={() => klap(sleutel)}>
      <span className="strategy-caret">{open[sleutel] ? "▾" : "▸"}</span>
      <span className="strategy-title">{titel}</span>
    </button>
  );

  return (
    <div className="cockpit-card ovc-card koers-card">
      <div className="ovc-head">
        <span className="ovc-icontile" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 21V9" strokeLinecap="round" />
            <path d="M12 4.5 20 8l-8 3.5z" strokeLinejoin="round" />
            <path d="M6 21h12" strokeLinecap="round" />
          </svg>
        </span>
        <span className="ovc-title">Waar we naartoe werken</span>
      </div>

      {/* ── 1. De koers ───────────────────────────────────────── */}
      <div className="ov-blok">
        {kop("koers", "De koers")}
        {open.koers && (
          <div className="strategy-body">
            <FocusBlock kaal slug={slug} soort="koers" />
          </div>
        )}
      </div>

      {/* ── 2. Waar het werk vandaan komt ─────────────────────── */}
      <div className="ov-blok">
        {kop("bronnen", "Waar het werk vandaan komt")}
        {open.bronnen && (
          <div className="strategy-body">
            <div className="koers-bronnen">
              {(posten || []).map((p) => {
                const href = p.tab
                  ? `/admin/client/${slug}?tab=${p.tab}`
                  : `/admin/client/${slug}/navigatie`;
                // "Nog niet gedraaid" en "0" betekenen iets heel anders. Een 0 die
                // eigenlijk onbekend is, is precies het cijfer waarop je iets ten
                // onrechte laat liggen.
                const cijfer = p.aantal === null ? "nog niet gedraaid" : String(p.aantal);
                return (
                  <a key={p.sleutel} className="btn btn-ghost btn-klein koers-bron"
                    href={href} title={p.uitleg}
                    onClick={(e) => {
                      if (!onGaNaarTab || !p.tab || e.metaKey || e.ctrlKey || e.shiftKey) return;
                      e.preventDefault(); onGaNaarTab(p.tab);
                    }}>
                    <span>{p.label}</span>
                    <span className={"koers-bron-telling" + (p.aantal ? " vol" : "")}>{cijfer}</span>
                  </a>
                );
              })}
            </div>
            {posten === null && <div className="koers-bronnen-laden">Bezig met tellen…</div>}
          </div>
        )}
      </div>
    </div>
  );
}
