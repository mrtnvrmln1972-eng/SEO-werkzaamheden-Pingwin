"use client";

// De werklijst in beeld, één component met twee gezichten.
//
//  - Sitebouwer (deelpagina, token): kopieren en afvinken.
//  - Pingwin (cockpit, ingelogd): daarbovenop de huidige meta naast het voorstel,
//    de knop "Voer door in de site" per regel en per pagina, en de mogelijkheid
//    om de indeling van een afbeelding om te zetten.
//
// Bewust één bestand voor allebei: eerder waren het twee losse schermen die uit
// elkaar liepen. Wat de een ziet, ziet de ander dus ook, alleen met meer knoppen.
//
// De rij-componenten staan met opzet BUITEN de hoofdfunctie. Stonden ze erbinnen,
// dan is het bij elke toetsaanslag een nieuw componenttype en bouwt React alle
// rijen opnieuw op; de duimnageltjes zouden dan bij elke klik opnieuw laden.

import { useMemo, useState, type ReactNode } from "react";
import { metaPixelInfo } from "../../lib/meta-rules";
import { SOORT_LABEL, normFile, type ImageSoort } from "../../lib/image-classify";

export type Alt = {
  file: string; src: string; alt: string; dubbel: boolean;
  soort: ImageSoort; reden: string; altNodig: boolean;
  paginas: number; paths: string[];
};
export type Pagina = { url: string; path: string; curTitle: string; curDesc: string; newTitle: string; newDesc: string; copyDoc: string; alts: Alt[] };
export type Mark = { done: boolean; doneBy: string; verified: boolean };
export type DubbelItem = { file: string; src: string; paths: string[] };

/** Sleutels moeten exact matchen met de server (lib/dev-worklist.ts). */
const urlKeyOf = (u: string) => { try { const x = new URL(u); return (x.host + x.pathname).replace(/\/+$/, "").toLowerCase(); } catch { return (u || "").toLowerCase(); } };
export const mKey = (url: string, veld: "title" | "desc") => `m|${urlKeyOf(url)}|${veld}`;
export const aKey = (url: string, file: string) => `a|${urlKeyOf(url)}|${normFile(file)}`;

// "pagina" = alles van één pagina in één klik; de cockpit vertaalt dat naar een
// meta-doorvoer plus een alt-doorvoer voor die ene URL.
export type Doorvoer = { wat: "meta" | "alt" | "pagina"; url?: string; file?: string; veld?: "title" | "desc" };

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
  id: string; label: ReactNode; tekst: string; mark?: Mark; blok?: boolean;
  extra?: ReactNode; knop?: ReactNode;
  kopie: string; onKopieer: (tekst: string, id: string) => void;
  onVink: (key: string, done: boolean) => void;
};

function Rij({ id, label, tekst, mark, blok, extra, knop, kopie, onKopieer, onVink }: RijProps) {
  const verified = !!mark?.verified;
  const af = !!mark?.done || verified;
  return (
    <div className={"wl-rij" + (af ? " wl-rij-af" : "") + (blok ? " wl-rij-blok" : "")}>
      <label className="wl-check" title={blok ? "Deze foto moet eerst uniek gemaakt worden" : "Vink af als je dit hebt doorgevoerd"}>
        <input type="checkbox" checked={af} onChange={(e) => onVink(id, e.target.checked)} />
      </label>
      {extra}
      <div className="wl-rij-body">
        <div className="wl-rij-label">{label}</div>
        <div className="wl-rij-tekst">{tekst}</div>
      </div>
      <div className="wl-rij-knoppen">
        <button type="button" className="wl-kopieer" onClick={() => onKopieer(tekst, id)}>{kopie === id ? "Gekopieerd ✓" : "Kopieer"}</button>
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

type Props = {
  pages: Pagina[];
  dubbel: DubbelItem[];
  marks: Record<string, Mark>;
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
  const { pages, dubbel, marks, admin = false, siteUrl = "" } = p;
  const [kopie, setKopie] = useState("");
  const [openDeco, setOpenDeco] = useState<Record<string, boolean>>({});
  const doorvoer = admin ? p.onDoorvoer : undefined;

  async function kopieer(tekst: string, id: string) {
    try { await navigator.clipboard.writeText(tekst); setKopie(id); setTimeout(() => setKopie(""), 1500); } catch { /* leeg */ }
  }

  const alleKeys = useMemo(() => {
    const k: string[] = [];
    for (const pg of pages) {
      if (pg.newTitle) k.push(mKey(pg.url, "title"));
      if (pg.newDesc) k.push(mKey(pg.url, "desc"));
      for (const a of pg.alts) k.push(aKey(pg.url, a.file));
    }
    return k;
  }, [pages]);
  const gedaan = alleKeys.filter((k) => marks[k]?.done || marks[k]?.verified).length;
  const geverifieerd = alleKeys.filter((k) => marks[k]?.verified).length;
  const pct = alleKeys.length ? Math.round((gedaan / alleKeys.length) * 100) : 0;

  const metaRij = (pg: Pagina, veld: "title" | "desc") => {
    const nieuw = veld === "title" ? pg.newTitle : pg.newDesc;
    const huidig = veld === "title" ? pg.curTitle : pg.curDesc;
    if (!nieuw) return null;
    const id = mKey(pg.url, veld);
    const px = metaPixelInfo(veld === "title" ? "meta_title" : "meta_description", nieuw);
    return (
      <div className="wl-meta">
        {admin && (
          <div className="wl-huidig">
            <span className="wl-huidig-label">Nu op de site</span>
            <span className="wl-huidig-tekst">{huidig || "(staat er nog niet)"}</span>
          </div>
        )}
        <Rij
          id={id}
          label={<>{admin ? "Ons voorstel" : "Nieuwe"} {veld === "title" ? "meta-title" : "meta-description"} <span className={`wl-px wl-px-${px.status}`}>{px.chars} tekens, {px.px} px</span></>}
          tekst={nieuw}
          mark={marks[id]}
          kopie={kopie}
          onKopieer={kopieer}
          onVink={p.onVink}
          knop={<Doorvoerknop opdracht={{ wat: "meta", url: pg.url, veld }} id={id} titel="Zet deze tekst direct op de live site" bezig={p.bezig} onDoorvoer={doorvoer} />}
        />
      </div>
    );
  };

  const altRij = (pg: Pagina, a: Alt) => {
    const id = aKey(pg.url, a.file);
    const blok = a.dubbel;
    return (
      <Rij
        key={a.file}
        id={id}
        mark={marks[id]}
        blok={blok}
        kopie={kopie}
        onKopieer={kopieer}
        onVink={p.onVink}
        extra={<Duim src={a.src} file={a.file} />}
        tekst={a.altNodig === false ? "(laat het alt-veld leeg, dit is versiering)" : (a.alt || "(zelf beschrijven wat erop staat)")}
        label={
          <>
            <span className="wl-bestand">{a.src ? <a href={a.src} target="_blank" rel="noreferrer">{a.file}</a> : a.file}</span>
            <span className={`wl-soort wl-soort-${a.soort}`}>{SOORT_LABEL[a.soort]}</span>
            <span className="wl-muted">{a.reden}</span>
            {admin && p.onSoort && (
              <button
                type="button"
                className="wl-omzet"
                title={blok ? "Toch een vast onderdeel: hoeft niet uniek te zijn" : "Toch een contentfoto: moet per pagina uniek worden"}
                onClick={() => p.onSoort?.(a.file, blok ? "sitebreed" : "gedeeld")}
              >
                {blok ? "hoeft niet uniek" : "moet wel uniek"}
              </button>
            )}
          </>
        }
        knop={blok
          ? <span className="wl-slot" title="Deze foto staat op meerdere pagina's; de alt-tekst zou dan op de verkeerde pagina kloppen">eerst uniek maken</span>
          : <Doorvoerknop opdracht={{ wat: "alt", url: pg.url, file: a.file }} id={id} titel="Zet deze alt-tekst direct op de afbeelding in WordPress" bezig={p.bezig} onDoorvoer={doorvoer} />}
      />
    );
  };

  return (
    <>
      <div className="wl-voortgang">
        <div className="wl-balk"><div className="wl-balk-vul" style={{ width: `${pct}%` }} /></div>
        <span>{gedaan} van {alleKeys.length} gedaan · {geverifieerd} door Pingwin gecontroleerd</span>
      </div>

      {dubbel.length > 0 && (
        <div className="wl-kaart wl-stap1">
          <h2>Stap 1: maak deze foto&rsquo;s uniek</h2>
          <p>Dit zijn contentfoto&rsquo;s die op meerdere pagina&rsquo;s staan. Een alt-tekst hangt aan de foto zelf, dus die klopt dan maar op één plek. Vervang ze per pagina door een eigen foto en druk daarna op de knop hieronder. Vaste onderdelen zoals het logo, de header en icoontjes staan hier bewust niet bij: die horen juist overal hetzelfde te zijn.</p>
          <ul className="wl-dubbel">
            {dubbel.map((d) => (
              <li key={d.file}>
                <Duim src={d.src} file={d.file} />
                <div className="wl-dubbel-body">
                  <div className="wl-bestand">{d.src ? <a href={d.src} target="_blank" rel="noreferrer">{d.file}</a> : d.file}</div>
                  <div className="wl-muted">staat op {d.paths.length} pagina&rsquo;s: <Paden paths={d.paths} paginas={d.paths.length} siteUrl={siteUrl} /></div>
                </div>
                {admin && p.onSoort && (
                  <button type="button" className="wl-omzet" title="Toch een vast onderdeel van de site" onClick={() => p.onSoort?.(d.file, "sitebreed")}>hoeft niet uniek</button>
                )}
              </li>
            ))}
          </ul>
          <button type="button" className="wl-knop" disabled={!!p.checkBusy} onClick={() => p.onControle()}>{p.checkBusy ? "Controleren… (kan een paar minuten duren)" : "Alles uniek, controleer maar"}</button>
          {p.checkMsg && <p className="wl-checkmsg">{p.checkMsg}</p>}
        </div>
      )}

      <div className="wl-kaart">
        <h2>{dubbel.length ? "Stap 2: meta's en alt-teksten per pagina" : "Meta's en alt-teksten per pagina"}</h2>
        {pages.map((pg) => {
          const items = (pg.newTitle ? 1 : 0) + (pg.newDesc ? 1 : 0) + pg.alts.length;
          const af = [
            pg.newTitle && (marks[mKey(pg.url, "title")]?.done || marks[mKey(pg.url, "title")]?.verified),
            pg.newDesc && (marks[mKey(pg.url, "desc")]?.done || marks[mKey(pg.url, "desc")]?.verified),
            ...pg.alts.map((a) => marks[aKey(pg.url, a.file)]?.done || marks[aKey(pg.url, a.file)]?.verified),
          ].filter(Boolean).length;
          const gewoon = pg.alts.filter((a) => a.altNodig !== false && !a.dubbel);
          const geblokkeerd = pg.alts.filter((a) => a.altNodig !== false && a.dubbel);
          const decoratief = pg.alts.filter((a) => a.altNodig === false);
          const decoOpen = !!openDeco[pg.url];
          return (
            <div key={pg.url} className="wl-pagina">
              <div className="wl-pagina-kop">
                <a href={pg.url} target="_blank" rel="noreferrer">{pg.path}</a>
                <span className="wl-pagina-teller">{af}/{items}</span>
                {doorvoer && (
                  <button type="button" className="wl-doorvoer wl-doorvoer-pagina" disabled={!!p.bezig} title="Zet alle meta's en vrijgegeven alt-teksten van deze pagina direct op de live site" onClick={() => doorvoer({ wat: "pagina", url: pg.url })}>
                    {p.bezig === `pagina|${pg.url}` ? "Bezig…" : "Voer deze pagina door"}
                  </button>
                )}
              </div>
              {pg.copyDoc && <p className="wl-copydoc">De meta&rsquo;s van deze pagina staan in het copydocument: <a href={pg.copyDoc} target="_blank" rel="noreferrer">open het document</a>.</p>}
              {metaRij(pg, "title")}
              {metaRij(pg, "desc")}
              {gewoon.map((a) => altRij(pg, a))}
              {geblokkeerd.map((a) => altRij(pg, a))}
              {decoratief.length > 0 && (
                <div className="wl-deco">
                  <button type="button" className="wl-deco-kop" onClick={() => setOpenDeco((s) => ({ ...s, [pg.url]: !s[pg.url] }))}>
                    {decoOpen ? "▾" : "▸"} {decoratief.length} decoratieve afbeeldingen (leeg alt-veld is hier juist goed)
                  </button>
                  {decoOpen && decoratief.map((a) => altRij(pg, a))}
                </div>
              )}
            </div>
          );
        })}
        {pages.length === 0 && <p>Er staan geen open punten meer. Mooi werk!</p>}
      </div>
    </>
  );
}
