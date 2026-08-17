"use client";

// De werklijst in beeld, één component met twee gezichten.
//
//  - Sitebouwer (deelpagina, token): de alt-teksten en de suggesties over beeld.
//  - Pingwin (cockpit, ingelogd): hetzelfde, plus de knoppen om een alt-tekst
//    direct in de mediabibliotheek te zetten en de indeling van een foto om te
//    zetten.
//
// De meta's stonden hier ook, als eigen blok met eigen doorvoerknoppen. Weg op
// 18-08-2026: die ontstaan en worden goedgekeurd in Meta & CTR, en dáár staat
// ook de knop "Doorvoeren op de site". Dezelfde goedkeuring op twee schermen
// met twee knoppen betekent dat je nooit weet welke telt.
//
// Waarom de indeling zo is:
//
// Eerst stond alles per pagina onder elkaar, uitgeklapt, en was vrijwel elke
// regel rood (geblokkeerd tot iemand een foto verving). Dat werd een muur van
// tientallen schermen hoog waar niemand aan begon. Twee dingen zijn veranderd:
//
//  1. Alt-teksten staan per AFBEELDING, niet per pagina. WordPress bewaart één
//     alt-tekst per afbeelding, dus een logo op veertig pagina's is één regel
//     werk. Dat scheelt honderden regels.
//  2. Er wordt niets meer geblokkeerd. De alt-tekst beschrijft wat er op de foto
//     staat, dus hij klopt op elke pagina waar die foto voorkomt.
//
// En alles begint dichtgeklapt, met bovenaan één samenvattende regel.
//
// De rij-componenten staan met opzet BUITEN de hoofdfunctie. Stonden ze erbinnen,
// dan is het bij elke toetsaanslag een nieuw componenttype en bouwt React alle
// rijen opnieuw op; de duimnageltjes zouden dan bij elke klik opnieuw laden.

import { useMemo, useState, type ReactNode } from "react";
import { SOORT_LABEL, normFile, type ImageSoort } from "../../lib/image-classify";

export type Alt = {
  file: string; src: string; alt: string; dubbel: boolean;
  soort: ImageSoort; reden: string; altNodig: boolean;
  paginas: number; paths: string[];
  gezien?: boolean; onderwerp?: string;
};
export type Pagina = {
  url: string; path: string;
  beeldTotaal?: number; beeldRaak?: number; beeldOnderwerp?: string;
  alts?: Alt[];
};
export type Mark = { done: boolean; doneBy: string; verified: boolean };
export type DubbelItem = { file: string; src: string; paths: string[] };
export type Overslag = { altBeeld: number; paginas: number; perPagina: number };

/** Sleutels moeten exact matchen met de server (lib/dev-worklist.ts). */
/** Per bestand, niet per pagina: zo bewaart WordPress de alt-tekst ook. */
export const aKey = (file: string) => `a|${normFile(file)}`;

// Bewust géén bulk-optie: elk punt gaat per stuk de site op, met een mens die
// er eerst naar kijkt.
export type Doorvoer = { wat: "alt"; url?: string; file?: string };

/** Duimnageltje dat zelf de link naar de afbeelding op ware grootte is. */
function Duim({ src, file }: { src: string; file: string }) {
  if (!src) return <span className="wl-duim wl-duim-leeg" title="Geen voorbeeld beschikbaar" />;
  return (
    <a className="wl-duim" href={src} target="_blank" rel="noreferrer" title={`Bekijk ${file}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" loading="lazy" />
    </a>
  );
}

/** Waar staat deze afbeelding? Hooguit vijf paden, dan "en nog N". */
function Paden({ paths, paginas, siteUrl }: { paths: string[]; paginas: number; siteUrl: string }) {
  const toon = paths.slice(0, 5);
  const rest = Math.max(0, paginas - toon.length);
  if (!toon.length) return null;
  const link = (pad: string) => { if (!siteUrl) return pad; try { return new URL(pad, siteUrl).toString(); } catch { return pad; } };
  return (
    <span className="wl-paden">
      {toon.map((pad, i) => (
        <span key={pad}>{i > 0 ? ", " : ""}<a href={link(pad)} target="_blank" rel="noreferrer">{pad}</a></span>
      ))}
      {rest > 0 && <span className="wl-muted">, en nog {rest}</span>}
    </span>
  );
}

type RijProps = {
  id: string; label: ReactNode; tekst: string; mark?: Mark;
  extra?: ReactNode; knop?: ReactNode; stil?: boolean;
  kopie: string; onKopieer: (tekst: string, id: string) => void;
  onVink: (key: string, done: boolean) => void;
};

function Rij({ id, label, tekst, mark, extra, knop, stil, kopie, onKopieer, onVink }: RijProps) {
  const verified = !!mark?.verified;
  const af = !!mark?.done || verified;
  return (
    <div className={"wl-rij" + (af ? " wl-rij-af" : "") + (stil ? " wl-rij-stil" : "")}>
      <label className="wl-check" title="Vink af als je dit hebt doorgevoerd">
        <input type="checkbox" checked={af} onChange={(e) => onVink(id, e.target.checked)} />
      </label>
      {extra}
      <div className="wl-rij-body">
        <div className="wl-rij-label">{label}</div>
        <div className="wl-rij-tekst">{tekst}</div>
      </div>
      <div className="wl-rij-knoppen">
        {!stil && <button type="button" className="wl-kopieer" onClick={() => onKopieer(tekst, id)}>{kopie === id ? "Gekopieerd ✓" : "Kopieer"}</button>}
        {knop}
      </div>
      {verified && <span className="wl-verified" title="Het dashboard heeft live gecontroleerd dat dit er goed op staat">gecontroleerd</span>}
    </div>
  );
}

/** Knop "Voer door in de site", alleen in de Pingwin-versie. */
function Doorvoerknop({ opdracht, id, titel, bezig, onDoorvoer }: { opdracht: Doorvoer; id: string; titel: string; bezig?: string; onDoorvoer?: (o: Doorvoer) => void }) {
  if (!onDoorvoer) return null;
  return (
    <button type="button" className="wl-doorvoer" disabled={!!bezig} title={titel} onClick={() => onDoorvoer(opdracht)}>
      {bezig === id ? "Bezig…" : "Voer door in de site"}
    </button>
  );
}

/** Een blok dat standaard dicht staat, met een teller en een bulkknop. */
function Blok({ titel, uitleg, aantal, gedaan, open, onToggle, knop, children }: {
  titel: string; uitleg: string; aantal: number; gedaan: number;
  open: boolean; onToggle: () => void; knop?: ReactNode; children: ReactNode;
}) {
  const pct = aantal ? Math.round((gedaan / aantal) * 100) : 0;
  return (
    <div className="wl-kaart wl-blok">
      <div className="wl-blok-kop">
        <button type="button" className="wl-blok-titel" onClick={onToggle} aria-expanded={open}>
          <span className="wl-blok-pijl">{open ? "▾" : "▸"}</span>
          <span>{titel}</span>
          <span className="wl-blok-teller">{gedaan} van {aantal} gedaan</span>
        </button>
        {knop}
      </div>
      <div className="wl-blok-balk"><div className="wl-balk-vul" style={{ width: `${pct}%` }} /></div>
      <p className="wl-blok-uitleg">{uitleg}</p>
      {open && <div className="wl-blok-body">{children}</div>}
    </div>
  );
}

export type PaginaKlus = {
  id: number; url: string; pad: string; taak: string; toelichting: string;
  docs: { label: string; url: string }[]; punten: string[];
};

type Props = {
  pages: Pagina[];
  /** Doorgezette paginakaarten: het echte paginawerk, naast de alt-teksten. */
  paginaklussen?: PaginaKlus[];
  images: Alt[];
  dubbel: DubbelItem[];
  marks: Record<string, Mark>;
  overslag?: Overslag;
  /** Pingwin-versie: huidige meta erbij plus doorvoerknoppen. */
  admin?: boolean;
  /** Basis van de site, om paden klikbaar te maken. */
  siteUrl?: string;
  onVink: (key: string, done: boolean) => void;
  onControle: () => void;
  checkBusy?: boolean;
  checkMsg?: string;
  /** Alleen admin. */
  onDoorvoer?: (opdracht: Doorvoer) => void;
  bezig?: string;
  onSoort?: (file: string, soort: ImageSoort) => void;
};

export default function WerklijstLijst(p: Props) {
  const { pages, images, dubbel, marks, admin = false, siteUrl = "", overslag } = p;
  const paginaklussen = p.paginaklussen || [];
  const [openKlus, setOpenKlus] = useState(true);
  const [kopie, setKopie] = useState("");
  const [openBeeld, setOpenBeeld] = useState(false);
  const [openAlt, setOpenAlt] = useState(false);
  const [openSug, setOpenSug] = useState(false);
  const [openPagina, setOpenPagina] = useState<Record<string, boolean>>({});
  const [toonAf, setToonAf] = useState(false);
  const doorvoer = admin ? p.onDoorvoer : undefined;

  async function kopieer(tekst: string, id: string) {
    try { await navigator.clipboard.writeText(tekst); setKopie(id); setTimeout(() => setKopie(""), 1500); } catch { /* leeg */ }
  }

  const af = (key: string) => !!(marks[key]?.done || marks[key]?.verified);

  // Eén teller: alt-teksten, per afbeelding.
  const telling = useMemo(() => {
    const altKeys = images.filter((a) => a.altNodig !== false).map((a) => aKey(a.file));
    return {
      altTotaal: altKeys.length,
      altGedaan: altKeys.filter(af).length,
      zonderTekst: images.filter((a) => a.altNodig !== false && !a.alt.trim()).length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [images, marks]);

  const altRij = (a: Alt) => {
    const id = aKey(a.file);
    const leeg = a.altNodig !== false && !a.alt.trim();
    return (
      <Rij
        key={a.file}
        id={id}
        mark={marks[id]}
        stil={leeg}
        kopie={kopie}
        onKopieer={kopieer}
        onVink={p.onVink}
        extra={<Duim src={a.src} file={a.file} />}
        tekst={
          a.altNodig === false ? "(laat het alt-veld leeg, dit is versiering)"
            : leeg ? "Nog geen alt-tekst geschreven; zie de melding onderaan dit blok."
            : a.alt
        }
        label={
          <>
            <span className="wl-bestand">{a.src ? <a href={a.src} target="_blank" rel="noreferrer">{a.file}</a> : a.file}</span>
            <span className={`wl-soort wl-soort-${a.soort}`}>{SOORT_LABEL[a.soort]}</span>
            {a.paginas > 1 && (
              <span className="wl-muted">staat op {a.paginas} pagina&rsquo;s: <Paden paths={a.paths} paginas={a.paginas} siteUrl={siteUrl} /></span>
            )}
            {a.paginas <= 1 && <span className="wl-muted">{a.reden}</span>}
            {a.alt.trim() && a.gezien === false && (
              <span className="wl-gok" title="De foto zelf kon niet bekeken worden; deze tekst is afgeleid uit de bestandsnaam en de pagina">uit bestandsnaam</span>
            )}
            {admin && p.onSoort && (
              <button
                type="button"
                className="wl-omzet"
                title="Toch versiering: dan hoort er juist een leeg alt-veld"
                onClick={() => p.onSoort?.(a.file, a.altNodig === false ? "uniek" : "decoratief")}
              >
                {a.altNodig === false ? "toch een echte foto" : "toch versiering"}
              </button>
            )}
          </>
        }
        knop={leeg ? undefined : <Doorvoerknop opdracht={{ wat: "alt", file: a.file }} id={id} titel="Zet deze alt-tekst direct op de afbeelding in WordPress" bezig={p.bezig} onDoorvoer={doorvoer} />}
      />
    );
  };

  // ── Eén lijst, in blokken ──
  //
  // Dezelfde blokken voor ons en voor de bouwer. Vroeger waren dit twee heel
  // verschillende schermen: wij zagen alles, de bouwer alleen een suggestielijst
  // over foto's. Daardoor kreeg hij zijn eigenlijke werk (de teksten die de site
  // in moeten) per mail, los van deze pagina, en raakte het zoek.
  //
  // Nu is deze pagina het ene adres: elk blok is een soort werk. Het paginawerk,
  // de alt-teksten en de suggesties over beeld; de blokken die later volgen
  // (nieuwe paginateksten, structured data, interne links) passen er zonder
  // verbouwing bij. Het verschil tussen ons en de bouwer is alleen wat er aan
  // knoppen bij staat: doorvoeren en de indeling van een foto omzetten doen wij.
  const totaal = telling.altTotaal;
  const gedaanTotaal = telling.altGedaan;
  const zichtbareImages = toonAf ? images : images.filter((a) => !af(aKey(a.file)));
  // Ruw signaal per pagina: passen de foto's bij het onderwerp. Stond in de kop
  // van het meta-blok, en dat blok is weg; het gaat over beeld, dus het blijft.
  const beeldPaginas = pages.filter((pg) => (pg.beeldTotaal || 0) > 0);

  return (
    <>
      <div className="wl-sam">
        <div className="wl-balk"><div className="wl-balk-vul" style={{ width: `${totaal ? Math.round((gedaanTotaal / totaal) * 100) : 0}%` }} /></div>
        <span>
          <strong>{telling.altTotaal} alt-teksten</strong>, één per afbeelding. {gedaanTotaal} van {totaal} gedaan.
          {admin ? " Elk punt voer je zelf per stuk door, zodat je er eerst naar kijkt." : " Werk af wat je kunt en vink af; het hoeft niet in één keer."}
        </span>
      </div>

      {paginaklussen.length > 0 && (
        <Blok
          titel="Paginawerk"
          uitleg="Hele pagina's die live moeten, met de teksten erbij. Dit is het grootste werk op deze lijst; de meta- en alt-teksten hieronder zijn losse velden."
          aantal={paginaklussen.length}
          gedaan={paginaklussen.filter((k) => af(`p|${k.id}`)).length}
          open={openKlus}
          onToggle={() => setOpenKlus((s) => !s)}
        >
        {paginaklussen.map((k) => (
            <div key={k.id} className={"wl-klus" + (af(`p|${k.id}`) ? " wl-klus-af" : "")}>
              <label className="wl-klus-kop">
                <input type="checkbox" checked={af(`p|${k.id}`)} onChange={(e) => p.onVink(`p|${k.id}`, e.target.checked)} />
                <a href={k.url} target="_blank" rel="noreferrer" className="wl-klus-pad">{k.pad}</a>
              </label>
              <div className="wl-klus-taak">{k.taak}</div>
              {k.toelichting && <div className="wl-klus-toel">{k.toelichting}</div>}
              {k.docs.length > 0 && (
                <div className="wl-klus-docs">
                  <span className="wl-klus-lab">Teksten en documenten:</span>
                  {k.docs.map((d) => (
                    <a key={d.url} href={d.url} target="_blank" rel="noreferrer">{d.label}</a>
                  ))}
                </div>
              )}
              {k.punten.length > 0 && (
                <div className="wl-klus-punten">
                  <span className="wl-klus-lab">Klaar als:</span>
                  <ul>{k.punten.map((t, i) => <li key={i}>{t}</li>)}</ul>
                </div>
              )}
            </div>
          ))}
        </Blok>
      )}

      {admin && beeldPaginas.length > 0 && (
        <Blok
          titel="Passen de foto&rsquo;s bij de pagina?"
          uitleg="Ruw signaal: hoeveel foto&rsquo;s op een pagina laten het onderwerp van die pagina zien. Bedoeld om naar te kijken, geen oordeel. Een pagina zonder één rake foto staat bovenaan."
          aantal={beeldPaginas.length}
          gedaan={beeldPaginas.filter((pg) => (pg.beeldRaak || 0) > 0).length}
          open={openBeeld}
          onToggle={() => setOpenBeeld((z) => !z)}
        >
          {[...beeldPaginas]
            .sort((a, b) => (a.beeldRaak || 0) - (b.beeldRaak || 0) || (b.beeldTotaal || 0) - (a.beeldTotaal || 0))
            .map((pg) => (
              <div key={pg.url} className="wl-pagina">
                <div className="wl-pagina-kop">
                  <a href={pg.url} target="_blank" rel="noreferrer">{pg.path}</a>
                  <span className={"wl-beeld" + (pg.beeldRaak === 0 ? " wl-beeld-nul" : "")}>
                    {pg.beeldTotaal} foto&rsquo;s, waarvan {pg.beeldRaak ?? 0} over {pg.beeldOnderwerp || "dit onderwerp"}
                  </span>
                </div>
              </div>
            ))}
        </Blok>
      )}

      {telling.altTotaal > 0 && (
        <Blok
          titel="Alt-teksten, per afbeelding"
          uitleg="Elke afbeelding staat hier precies één keer, want WordPress bewaart één alt-tekst per afbeelding. De tekst beschrijft wat er op de foto te zien is, dus hij klopt op elke pagina waar die foto voorkomt."
          aantal={telling.altTotaal}
          gedaan={telling.altGedaan}
          open={openAlt}
          onToggle={() => setOpenAlt((s) => !s)}
        >
          <label className="wl-schakel">
            <input type="checkbox" checked={toonAf} onChange={(e) => setToonAf(e.target.checked)} />
            <span>toon ook de afgeronde afbeeldingen</span>
          </label>
          {zichtbareImages.map(altRij)}
          {zichtbareImages.length === 0 && <p className="wl-muted">Alle alt-teksten zijn gedaan. Zet het vinkje hierboven om ze terug te zien.</p>}
          {telling.zonderTekst > 0 && admin && (
            <p className="wl-melding">
              Voor {telling.zonderTekst} afbeeldingen is nog geen alt-tekst geschreven. Dat is een grens in ons eigen
              dashboard, geen oordeel over die foto&rsquo;s: we schrijven er een vast aantal per ronde en beginnen bij de
              pagina&rsquo;s die het meeste bezoek trekken. Wil je de rest ook? Voer eerst de geschreven alt-teksten
              hierboven door en maak daarna de werklijst opnieuw aan in de cockpit; de volgende ronde pakt dan
              precies deze {telling.zonderTekst} op.
            </p>
          )}
          {admin && overslag && overslag.paginas > 0 && (
            <p className="wl-melding">Er zijn {overslag.paginas} pagina&rsquo;s niet gemeten; de sitescan pakt er maximaal 60 per ronde.</p>
          )}
        </Blok>
      )}

      <div className="wl-kaart wl-blok">
        <div className="wl-blok-kop">
          <button type="button" className="wl-blok-titel" onClick={() => setOpenSug((s) => !s)} aria-expanded={openSug}>
            <span className="wl-blok-pijl">{openSug ? "▾" : "▸"}</span>
            <span>Foto&rsquo;s die beter een eigen foto konden zijn</span>
            <span className="wl-blok-teller">{dubbel.length} foto&rsquo;s</span>
          </button>
          {admin && (
            <button type="button" className="wl-kopieer" disabled={!!p.checkBusy} onClick={() => p.onControle()}>
              {p.checkBusy ? "Controleren…" : "Controleer live"}
            </button>
          )}
        </div>
        <p className="wl-blok-uitleg">
          Foto&rsquo;s die op meerdere pagina&rsquo;s terugkomen. Dit blokkeert niets: de alt-teksten hierboven kloppen er
          gewoon op. Een eigen foto per pagina werkt alleen beter, voor de bezoeker en voor Google. Zie het als een
          suggestie; wat blijft staan, blijft gewoon werken.
        </p>
        {openSug && (
          <div className="wl-blok-body">
            <ul className="wl-dubbel">
              {dubbel.map((d) => {
                const id = `sug|${normFile(d.file)}`;
                const gedaan = af(id);
                return (
                  <li key={d.file} className={gedaan ? "wl-sug-af" : ""}>
                    <label className="wl-check" title="Vink af als je deze foto vervangen hebt">
                      <input type="checkbox" checked={gedaan} onChange={(e) => p.onVink(id, e.target.checked)} />
                    </label>
                    <Duim src={d.src} file={d.file} />
                    <div className="wl-dubbel-body">
                      <div className="wl-bestand">{d.src ? <a href={d.src} target="_blank" rel="noreferrer">{d.file}</a> : d.file}</div>
                      <div className="wl-muted">staat op {d.paths.length} pagina&rsquo;s: <Paden paths={d.paths} paginas={d.paths.length} siteUrl={siteUrl} /></div>
                    </div>
                    {p.onSoort && (
                      <button type="button" className="wl-omzet" title="Toch een vast onderdeel van de site" onClick={() => p.onSoort?.(d.file, "sitebreed")}>hoeft niet uniek</button>
                    )}
                  </li>
                );
              })}
            </ul>
            {dubbel.length === 0 && <p className="wl-muted">Geen suggesties; elke contentfoto staat maar op één pagina.</p>}
            {!admin && dubbel.length > 0 && (
              <button type="button" className="wl-knop" disabled={!!p.checkBusy} onClick={() => p.onControle()}>
                {p.checkBusy ? "Controleren… (kan een paar minuten duren)" : "Klaar, controleer maar"}
              </button>
            )}
          </div>
        )}
        {p.checkMsg && <p className="wl-checkmsg">{p.checkMsg}</p>}
      </div>

      {totaal === 0 && dubbel.length === 0 && (
        <div className="wl-kaart"><p className="wl-muted">Er staat op dit moment niets klaar. Zodra er werk is, verschijnt het hier vanzelf.</p></div>
      )}
    </>
  );
}
