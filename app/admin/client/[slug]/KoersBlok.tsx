"use client";

// ═══════════════════════════════════════════════════════════
// DE KOERS, bovenaan de takenpagina
// ═══════════════════════════════════════════════════════════
// Eén veld met de grote lijn voor deze klant, in Maartens eigen woorden, en
// eronder de knoppen naar de plekken waar werk klaarligt.
//
// ── Wat hier weg is, en waarom (18 augustus 2026) ──
// Hier stonden drie stroken: de koers, "Wat we nu oppakken", en waar het werk
// vandaan komt. Die middelste is eruit, met alles wat eromheen gebouwd was: de
// knop "Bijwerken" (die een model een nieuw lijstje liet voorstellen), de rode
// seintjes met "hierna is er nog iets bepaald", de knop "Dit klopt al" die een
// streep in de tijd zette, en de bijbehorende routes en opslag.
//
// Dat was vier mechanismen voor één veld dat je toch met de hand bijhoudt, en
// het werkte precies verkeerd om: bij Kamsteeg stond er een strategie in die op
// 5 augustus klopte en op 16 augustus herzien was, met vier rode uitroeptekens
// erboven waarvan er één naar een gesprek wees dat door een later gesprek al
// was ingehaald. Het systeem kon dat niet weten en zette ze allemaal even hard
// neer. Een veld dat je zelf bijhoudt plus een generator plus een
// verouderings-seintje plus een verwerkt-stempel geeft geen overzicht; het geeft
// werk aan het overzicht.
//
// De verdeling is nu drie lagen die elkaar niet overlappen:
//   1. DE KOERS      : de grote lijn. Handwerk, verandert alleen als Maarten
//                      hem verandert. Komt uit een chat of uit "Overzicht",
//                      met knippen en plakken.
//   2. WAAR HET WERK : wat er klaarligt, geteld uit wat al is opgeslagen.
//      VANDAAN KOMT    Doorklikken en van daaruit op de planning zetten.
//   3. DE PLANNING   : wat we deze periode echt doen (eigen blok, links).
//
// De tekst van het oude lijstje is NIET weggegooid: hij staat gewoon nog in de
// opslag en in de versiehistorie op /admin/veld-herstel. Alleen niets leest hem
// nog.
//
// Het veld zelf is `FocusBlock`, hetzelfde component als "Overzicht". Bewust
// geen tweede editor: dat veld heeft al twee keer inhoud gekost en de reparatie
// daarvan (herstelStructuur, opslaan op vier momenten, versiehistorie) zit dáár.

import { useCallback, useEffect, useState } from "react";
import FocusBlock from "./FocusBlock";
import { Signalen } from "../../../_ui/Uitkomst";
import { htmlNaarTekst } from "../../../../lib/veilige-html";

type WerkPost = { sleutel: string; label: string; aantal: number | null; tab: string; uitleg: string };

export default function KoersBlok({ slug, onGaNaarTab }: {
  slug: string;
  /** Binnen de cockpit van tab wisselen zonder de pagina te herladen. */
  onGaNaarTab?: (tab: string) => void;
}) {
  const [koersHtml, setKoersHtml] = useState("");
  const [commentaar, setCommentaar] = useState<string[]>([]);
  const [checkBezig, setCheckBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [posten, setPosten] = useState<WerkPost[] | null>(null);

  useEffect(() => {
    let off = false;
    setPosten(null);
    fetch(`/api/admin/werkvoorraad?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (!off && d.ok) setPosten(d.posten as WerkPost[]); })
      .catch(() => { /* een chip zonder cijfer is geen reden om het blok te verbergen */ });
    return () => { off = true; };
  }, [slug]);

  // Wissel je van klant, dan hoort het commentaar van de vorige klant weg.
  useEffect(() => { setCommentaar([]); setFout(""); }, [slug]);

  const pakKoers = useCallback((h: string) => setKoersHtml(h), []);

  async function checkKoers() {
    if (checkBezig) return;
    setCheckBezig(true); setFout(""); setCommentaar([]);
    try {
      const d = await fetch("/api/admin/koers-check", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      }).then((r) => r.json());
      if (!d.ok) { setFout(d.error || "De controle is niet gelukt."); return; }
      const regels = String(d.commentaar || "").split("\n")
        .map((r: string) => r.replace(/^[-•*\s]+/, "").trim()).filter(Boolean);
      setCommentaar(regels.length ? regels : ["Er is niets gevonden dat tegen je koers in gaat."]);
    } catch {
      setFout("De controle is niet gelukt.");
    } finally {
      setCheckBezig(false);
    }
  }

  const heeftKoers = htmlNaarTekst(koersHtml).trim().length > 0;

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
        <span className="ovc-title">De koers</span>
      </div>

      {/* De koers staat open. Hij stond achter een uitklapper omdat dit blok
          met drie stroken de planning van het scherm af duwde; met één strook
          is dat weg, en een koers die je moet openklikken is een koers die je
          niet leest. */}
      <div className="ov-blok ov-blok-open">
        <div className="pnl-acties-groep">
          <button type="button" className="btn btn-ghost btn-klein"
            disabled={checkBezig || !heeftKoers}
            title={heeftKoers
              ? "Legt je tekst naast wat het dashboard al weet en zegt wat er niet meer klopt. Schrijft nooit in je tekst."
              : "Schrijf eerst in een paar regels waar we naartoe werken."}
            onClick={() => void checkKoers()}>
            {checkBezig ? "Bezig met nakijken…" : "Klopt dit nog?"}
          </button>
        </div>
        <FocusBlock kaal slug={slug} soort="koers" onInhoud={pakKoers} />
        {/* Commentaar staat NAAST de tekst, nooit erin: de koers blijft van
            Maarten. Zodra een model erin mag schrijven, is hij na twee rondes
            niet meer van hem. */}
        <Signalen regels={commentaar} soort="notitie" />
        {fout && <Signalen regels={[fout]} soort="let-op" />}
      </div>

      {/* ── Waar het werk vandaan komt ─────────────────────────
          Geen uitklapper meer maar gewoon een rij knoppen onder de koers: het
          is één regel hoog en het is de weg naar de planning. */}
      <div className="ov-blok ov-blok-open koers-bronnen-blok">
        <div className="koers-bronnen-kop">Waar het werk vandaan komt</div>
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
    </div>
  );
}
