"use client";

// ═══════════════════════════════════════════════════════════
// HOE DE SITE ERUITZIET ALS DIT ALLEMAAL DOORGEVOERD IS
// ═══════════════════════════════════════════════════════════
// Het sluitstuk van de pagina, en het enige blok dat een resultaat toont in
// plaats van werk. Boven staan vier lijsten met samen honderd beslissingen; hier
// staat wat er dan overblijft: een opgeruimde boom met per tak een hoofdpagina en
// de pagina's die eronder horen.
//
// Dit is ook het blok dat je aan een klant laat zien. "We halen 68 pagina's weg"
// klinkt als verlies; "van 433 losse pagina's naar 340 in twaalf duidelijke
// takken" is hetzelfde besluit, maar dan als resultaat.
// ═══════════════════════════════════════════════════════════

import { useEffect, useState } from "react";

type Rol = "blijft" | "thuisbasis" | "opnieuw opbouwen" | "nieuw";
type EindPagina = { pad: string; rol: Rol; toelichting: string; slokt: string[] };
type Tak = { sleutel: string; pad: string; titel: string; bestaat: boolean; kinderen: EindPagina[] };
export type Eindstructuur = {
  takken: Tak[]; losse: EindPagina[];
  nu: number; straks: number; weg: number; erbij: number; vorm: string; volledig: boolean;
};

const ROL_CHIP: Record<Rol, string> = {
  blijft: "", thuisbasis: "keep", "opnieuw opbouwen": "merge", nieuw: "nodig",
};
const ROL_TEKST: Record<Rol, string> = {
  blijft: "", thuisbasis: "wordt de thuisbasis", "opnieuw opbouwen": "wordt opnieuw opgebouwd", nieuw: "nieuw te maken",
};

export default function OpruimEindstructuur({ slug, domain, data }: {
  slug: string; domain: string;
  /** Al opgehaald (de deelpagina levert hem mee en mag de adminroute niet aanroepen). */
  data?: Eindstructuur | null;
}) {
  const [d, setD] = useState<Eindstructuur | null>(data || null);
  const [bezig, setBezig] = useState(!data);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [alles, setAlles] = useState(false);

  useEffect(() => {
    if (data) { setD(data); setBezig(false); return; }
    if (!slug) return;
    let leeft = true;
    fetch(`/api/admin/opruim-eindstructuur?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j) => { if (leeft && j?.ok) setD(j.structuur); })
      .catch(() => { /* stil */ })
      .finally(() => { if (leeft) setBezig(false); });
    return () => { leeft = false; };
  }, [slug, data]);

  const site = (p: string) => `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
  const Link = ({ p }: { p: string }) => <a className="opr-pad" href={site(p)} target="_blank" rel="noreferrer">{p}</a>;

  if (bezig) return <div className="muted opr-str-laden">De opgeruimde structuur wordt bepaald…</div>;
  if (!d || (!d.takken.length && !d.losse.length)) return null;

  const takken = alles ? d.takken : d.takken.slice(0, 12);

  return (
    <div className="opr-kaart opr-str">
      <div className="opr-kop">Zo ziet de site eruit als dit is doorgevoerd</div>
      <div className="opr-kaart-tekst">
        <p>
          Alles hierboven bij elkaar: de omleidingen, de gebundelde onderwerpen, de pagina&rsquo;s die opnieuw worden
          opgebouwd en de pagina&rsquo;s die er nog moeten komen. Dit is wat er dan staat, gegroepeerd per onderwerp met
          de hoofdpagina bovenaan en de pagina&rsquo;s die daaronder horen eronder.
        </p>
        {!d.volledig && (
          <p>
            <strong>Let op:</strong> er is nog geen analyse gedraaid, dus dit is de huidige structuur, niet de
            opgeruimde. Draai de analyse en dit blok laat zien wat het oplevert.
          </p>
        )}
      </div>

      <div className="opr-str-kpi">
        <div><b>{d.nu}</b><span>pagina&rsquo;s nu</span></div>
        <div><b>{d.straks}</b><span>pagina&rsquo;s straks</span></div>
        <div><b>{d.weg}</b><span>verdwijnen (opgaan of opgeruimd)</span></div>
        <div><b>{d.erbij}</b><span>komen erbij</span></div>
        <div><b>{d.takken.length}</b><span>duidelijke takken</span></div>
      </div>

      {d.vorm && (
        <p className="opr-kaart-tekst">
          De vastgelegde URL-vorm is <span className="opr-pad">{d.vorm}</span>. Nieuwe pagina&rsquo;s horen die vorm te
          volgen, zodat er geen negende variant naast de acht bestaande ontstaat.
        </p>
      )}

      <div className="opr-eind-boom">
        {takken.map((t) => (
          <div key={t.sleutel} className="opr-eind-tak">
            <div className="opr-eind-takkop">
              <span className="opr-eind-takttl">{t.titel}</span>
              {t.pad && <Link p={t.pad} />}
              {/* De hoofdpagina telt alleen mee als hij bestaat. Bij een afgeleide
                  tak is er vaak geen overzichtspagina, en dan zou +1 een pagina
                  tellen die er niet is. */}
              <span className="opr-chip">{t.kinderen.length + (t.bestaat ? 1 : 0)} pagina&rsquo;s</span>
              {!t.bestaat && <span className="opr-chip nodig" title="Er is geen overzichtspagina voor deze tak; die zou hem sterker maken.">geen hoofdpagina</span>}
            </div>
            <ul className="opr-eind-kinderen">
              {(open[t.sleutel] ? t.kinderen : t.kinderen.slice(0, 8)).map((k) => (
                <li key={k.pad}>
                  <Link p={k.pad} />
                  {ROL_TEKST[k.rol] && <span className={`opr-chip ${ROL_CHIP[k.rol]}`}>{ROL_TEKST[k.rol]}</span>}
                  {k.slokt.length > 0 && (
                    <span className="opr-eind-slokt" title={k.slokt.join("\n")}>
                      {k.slokt.length} {k.slokt.length === 1 ? "pagina gaat" : "pagina's gaan"} hierin op
                    </span>
                  )}
                </li>
              ))}
            </ul>
            {t.kinderen.length > 8 && (
              <button type="button" className="opr-meer" onClick={() => setOpen((m) => ({ ...m, [t.sleutel]: !m[t.sleutel] }))}>
                {open[t.sleutel] ? "▾ minder" : `▸ nog ${t.kinderen.length - 8} pagina's in deze tak`}
              </button>
            )}
          </div>
        ))}
      </div>

      {d.takken.length > 12 && (
        <button type="button" className="btn btn-klein" onClick={() => setAlles((v) => !v)}>
          {alles ? "Toon alleen de twaalf grootste takken" : `Toon alle ${d.takken.length} takken`}
        </button>
      )}

      {d.losse.length > 0 && (
        <div className="opr-eind-los">
          <div className="opr-kop" style={{ fontSize: "var(--fs-sm)" }}>Staat los ({d.losse.length})</div>
          <p className="opr-kaart-tekst">
            Deze pagina&rsquo;s vallen onder geen enkele tak: er zijn er geen drie die duidelijk hetzelfde onderwerp
            delen. Bij contact en over ons is dat prima. Bij de rest is het juist het signaal:{" "}
            <strong>
              {d.losse.length > d.straks / 4
                ? "dit is een fors deel van de site, dus hier ontbreekt structuur die er hoort te zijn"
                : "staat er iets tussen dat wél bij een onderwerp hoort, dan is die tak nog niet af"}
            </strong>. Dat is de volgende stap na het opruimen: deze pagina&rsquo;s een plek geven in plaats van ze los
            te laten hangen.
          </p>
          <div className="opr-vb">
            {d.losse.slice(0, 30).map((l, i) => <span key={l.pad}>{i > 0 ? ", " : ""}<Link p={l.pad} /></span>)}
            {d.losse.length > 30 ? ` en nog ${d.losse.length - 30} andere` : ""}
          </div>
        </div>
      )}
    </div>
  );
}
