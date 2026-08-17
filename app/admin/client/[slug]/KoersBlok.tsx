"use client";

// ═══════════════════════════════════════════════════════════
// WAAR WE NAARTOE WERKEN, bovenaan de takenpagina
// ═══════════════════════════════════════════════════════════
// Maarten zit hier het grootste deel van de dag, maar de takenpagina vertelde
// hem alleen wat er al op de planning staat, nooit waaróm. De koers en de
// afgesproken landingspagina's stonden een tab verderop, de plekken waar werk
// klaarligt weer twee tabs terug.
//
// Drie stroken, in de volgorde waarin je erover nadenkt:
//   1. De koers        : waar werken we naartoe (Maartens eigen tekst)
//   2. Wat we oppakken : wat is nu aan de beurt (Maartens eigen tekst),
//                        met per regel één klik naar de planning
//   3. Waar het vandaan komt : de plekken met werk, met het aantal dat er ligt
//
// De eerste twee zijn HANDWERK en blijven dat. Dat is de kern van het verzoek:
// geen automatisch samengeraapt lijstje uit vijf motoren, want dan is het na
// twee rondes niet meer van hem. Alleen strook 3 telt, en die telt uitsluitend
// wat er al opgeslagen ligt.
//
// De velden zelf zijn `FocusBlock`, hetzelfde component als "Zoekwoorden &
// links". Bewust geen tweede editor: dit veld heeft al twee keer inhoud gekost
// en de reparatie daarvan (herstelStructuur, opslaan op vier momenten,
// versiehistorie) zit dáár. Een kopie ernaast zou die reparatie missen.

import { useCallback, useEffect, useState } from "react";
import FocusBlock from "./FocusBlock";
import { Signalen } from "../../../_ui/Uitkomst";
import { htmlNaarTekst } from "../../../../lib/veilige-html";

type WerkPost = { sleutel: string; label: string; aantal: number | null; tab: string; uitleg: string };

/** Splitst de opgemaakte tekst in losse regels, zodat je er taken van kunt maken. */
function regelsUit(html: string): string[] {
  return htmlNaarTekst(html)
    .split("\n")
    .map((r) => r.replace(/^[-•*\d.)\s]+/, "").trim())
    .filter((r) => r.length > 2);
}

export default function KoersBlok({ slug, onWeekplanChanged, onGaNaarTab }: {
  slug: string;
  /** De planning op ditzelfde scherm bijwerken zodra er een kaart bij komt. */
  onWeekplanChanged?: () => void;
  /** Binnen de cockpit van tab wisselen zonder de pagina te herladen. */
  onGaNaarTab?: (tab: string) => void;
}) {
  // Alle drie beginnen dicht. Ze stonden open, en dan duwt dit blok de planning
  // en de chats van het scherm af terwijl je meestal komt voor het werk eronder.
  // Eén regel per strook, jij kiest wat je openzet, en die keuze blijft staan.
  const [open, setOpen] = useState({ koers: false, oppak: false, bronnen: false });
  // Onthouden per klant, net als bij de Overview-blokken ernaast: klap je de
  // koers open, dan staat hij morgen nog open, en alleen bij deze klant.
  const sleutelOpen = `pingwin-koers-open:${slug}`;
  useEffect(() => {
    try {
      const s = localStorage.getItem(sleutelOpen);
      setOpen(s ? JSON.parse(s) as typeof open : { koers: false, oppak: false, bronnen: false });
    } catch { /* geen opslag, dan gewoon dicht */ }
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [sleutelOpen]);
  function klap(sleutel: "koers" | "oppak" | "bronnen") {
    setOpen((v) => {
      const n = { ...v, [sleutel]: !v[sleutel] };
      try { localStorage.setItem(sleutelOpen, JSON.stringify(n)); } catch { /* geen opslag */ }
      return n;
    });
  }
  const [koersHtml, setKoersHtml] = useState("");
  const [prioHtml, setPrioHtml] = useState("");
  const [commentaar, setCommentaar] = useState<string[]>([]);
  const [checkBezig, setCheckBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [posten, setPosten] = useState<WerkPost[] | null>(null);
  const [toonRegels, setToonRegels] = useState(false);
  const [gezet, setGezet] = useState<Set<string>>(new Set());
  const [bezigRegel, setBezigRegel] = useState("");

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
  useEffect(() => { setCommentaar([]); setFout(""); setGezet(new Set()); setToonRegels(false); }, [slug]);

  const pakKoers = useCallback((h: string) => setKoersHtml(h), []);
  const pakPrio = useCallback((h: string) => setPrioHtml(h), []);

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

  async function naarPlanning(regel: string) {
    if (bezigRegel) return;
    setBezigRegel(regel); setFout("");
    try {
      const d = await fetch("/api/admin/weekplan/quick-task", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, taak: regel.slice(0, 200) }),
      }).then((r) => r.json());
      if (!d.ok) { setFout(d.error || "Op de planning zetten is niet gelukt."); return; }
      setGezet((s) => new Set(s).add(regel));
      onWeekplanChanged?.();
    } catch {
      setFout("Op de planning zetten is niet gelukt.");
    } finally {
      setBezigRegel("");
    }
  }

  const oppakRegels = regelsUit(prioHtml);
  const heeftKoers = htmlNaarTekst(koersHtml).trim().length > 0;

  const kop = (sleutel: keyof typeof open, titel: string, extra?: string) => (
    <button type="button" className="strategy-head" onClick={() => klap(sleutel)}>
      <span className="strategy-caret">{open[sleutel] ? "▾" : "▸"}</span>
      <span className="strategy-title">{titel}</span>
      {extra && <span className="strategy-meta-right">{extra}</span>}
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
          </div>
        )}
      </div>

      {/* ── 2. Wat we nu oppakken ─────────────────────────────── */}
      <div className="ov-blok">
        {kop("oppak", "Wat we nu oppakken")}
        {open.oppak && (
          <div className="strategy-body">
            <div className="pnl-acties-groep">
              <button type="button" className="btn btn-ghost btn-klein"
                disabled={!oppakRegels.length}
                title={oppakRegels.length
                  ? "Kies per regel of hij als kaart op de planning moet"
                  : "Schrijf hierboven eerst op wat je wilt oppakken."}
                onClick={() => setToonRegels((v) => !v)}>
                {toonRegels ? "Lijstje verbergen" : "Op de planning zetten"}
              </button>
            </div>
            <FocusBlock kaal slug={slug} soort="prio" onInhoud={pakPrio} />
            {/* Bewust een apart lijstje en geen knopje in het veld zelf: in een
                veld dat je zelf herschikt zijn zwevende knopjes precies het soort
                constructie dat hier al twee keer inhoud heeft gekost. */}
            {toonRegels && (
              <div className="koers-regels">
                {oppakRegels.map((r) => (
                  <div className="koers-regel" key={r}>
                    <span className="koers-regel-tekst">{r}</span>
                    {gezet.has(r)
                      ? <span className="koers-regel-klaar">staat op de planning</span>
                      : <button type="button" className="btn btn-ghost btn-klein"
                          disabled={!!bezigRegel} onClick={() => void naarPlanning(r)}>
                          {bezigRegel === r ? "Bezig…" : "Naar planning"}
                        </button>}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── 3. Waar het werk vandaan komt ─────────────────────── */}
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
              <a className="btn btn-quiet btn-klein koers-bron" href={`/admin/client/${slug}?tab=klant`}
                title="De afgesproken zoekwoorden en landingspagina's staan in het dossier van deze klant"
                onClick={(e) => {
                  if (!onGaNaarTab || e.metaKey || e.ctrlKey || e.shiftKey) return;
                  e.preventDefault(); onGaNaarTab("klant");
                }}>
                Zoekwoorden &amp; links staan in het Dossier
              </a>
            </div>
            {posten === null && <div className="koers-bronnen-laden">Bezig met tellen…</div>}
          </div>
        )}
      </div>

      {fout && <div className="ov-blok"><div className="strategy-body"><Signalen regels={[fout]} soort="let-op" /></div></div>}
    </div>
  );
}
