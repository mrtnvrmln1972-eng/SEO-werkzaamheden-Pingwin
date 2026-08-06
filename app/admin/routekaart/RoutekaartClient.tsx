"use client";

import { useState } from "react";
import type { Punt } from "../../../lib/routekaart";
import Kopieer from "../Kopieer";
import OntwikkelMenu from "../OntwikkelMenu";

export type PuntWeergave = Punt & {
  kan: boolean;
  wacht: string[];
  botst: string[];
  prompt: string;
  promptTekst: string;
  /** De volledige beschrijving uit /uitleg, als HTML. null = nog geen tekst. */
  beschrijving: string | null;
};

type Golf = { nummer: 1 | 2 | 3; titel: string; regel: string };

const STAND_LABEL: Record<Punt["stand"], string> = { open: "Open", loopt: "Loopt nu", af: "Af" };
const OMVANG_LABEL: Record<Punt["omvang"], string> = {
  klein: "Klein werk", middel: "Halve dag tot een dag", groot: "Meerdere sessies",
};

function PuntKaart({ p }: { p: PuntWeergave }) {
  const [open, setOpen] = useState(false);
  const [volledig, setVolledig] = useState(false);
  return (
    <div className={"rk-punt rk-punt-" + p.stand}>
      <div className="rk-punt-kop">
        <span className="rk-code">{p.code}</span>
        <div className="rk-punt-tekst">
          <div className="rk-punt-titel">{p.titel}</div>
          <div className="rk-punt-oplevert">{p.oplevert}</div>
        </div>
        <div className="rk-punt-stand">
          <span className={"chip rk-chip-" + p.stand}>{STAND_LABEL[p.stand]}</span>
        </div>
      </div>

      <div className="rk-punt-meta">
        <span className="rk-meta-item">{OMVANG_LABEL[p.omvang]}</span>
        {p.stand === "af" && p.afGekomen && <span className="rk-meta-item">Af op {p.afGekomen}</span>}
        {p.wacht.length > 0 && (
          <span className="rk-meta-item rk-meta-wacht">Wacht op {p.wacht.join(" en ")}</span>
        )}
        <button type="button" className="rk-meer" onClick={() => setOpen((v) => !v)}>
          {open ? "Minder" : "Meer"}
        </button>
      </div>

      {open && (
        <div className="rk-punt-meer">
          <p><strong>Af als:</strong> {p.af}</p>
          <p><strong>Raakt:</strong> {p.raakt.join(", ")}</p>
          {p.botst.length > 0 && (
            <p className="rk-botst">
              <strong>Let op bij twee chats:</strong> {p.botst.join(", ")} {p.botst.length === 1 ? "raakt" : "raken"} hetzelfde
              scherm. Doe die niet gelijktijdig.
            </p>
          )}
          {p.beschrijving ? (
            <>
              <button type="button" className="rk-meer rk-volledig-knop" onClick={() => setVolledig((v) => !v)}>
                {volledig ? "Verberg de volledige beschrijving" : "De volledige beschrijving van dit punt"}
              </button>
              {volledig && (
                <div
                  className="md rk-volledig"
                  // De tekst komt uit lib/uitleg.ts, onze eigen code, en gaat door
                  // dezelfde renderer als de uitlegpagina. Geen invoer van buiten.
                  dangerouslySetInnerHTML={{ __html: p.beschrijving }}
                />
              )}
            </>
          ) : (
            <p className="rk-geen-tekst">
              Voor dit punt staat er nog geen uitgeschreven beschrijving. De chat pakt het op met
              wat hierboven staat.
            </p>
          )}
        </div>
      )}

      {p.stand !== "af" && (
        <div className="rk-punt-start">
          {p.kan ? (
            <>
              <Kopieer tekst={p.prompt} label={`Kopieer startregel voor ${p.code}`} primair />
              <code className="rk-prompt">{p.prompt}</code>
            </>
          ) : (
            <span className="rk-geblokkeerd">
              Kan nog niet beginnen: {p.wacht.length ? `${p.wacht.join(" en ")} moet eerst af zijn.` : "loopt al."}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoutekaartClient({
  punten, golven, voortgang, advies,
}: {
  punten: PuntWeergave[];
  golven: Golf[];
  voortgang: { af: number; loopt: number; open: number; totaal: number };
  advies: { code: string; titel: string; prompt: string } | null;
}) {
  const lopend = punten.filter((p) => p.stand === "loopt");

  return (
    <>
      <div className="header">
        <div className="header-left">
          <a href="/admin" className="logo-link" title="Naar het klantenoverzicht">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
          </a>
          <div className="header-divider" />
          <div>
            <div className="header-title">Pingwin SEO Dashboard</div>
            <div className="header-client">Routekaart</div>
          </div>
        </div>
        <div className="header-right">
          <OntwikkelMenu />
          <a className="logout-btn" href="/uitleg" title="De volledige uitleg van het dashboard">Zo werkt het</a>
          <a className="logout-btn" href="/admin">Naar de klanten</a>
        </div>
      </div>

      <div className="rk-container">

        {/* ── Waar we staan, en wat je nu doet ── */}
        <div className="card rk-top">
          <div className="rk-top-links">
            <h1 className="rk-h1">De ontwikkeling van dit dashboard</h1>
            <p className="rk-uitleg">
              Elk punt hieronder is één werksessie. Je kopieert de startregel, opent een verse chat in Claude Code,
              plakt hem, en je krijgt korte terugkoppeling met een link om te kijken. Meer hoef je niet te doen.
            </p>
            <div className="rk-voortgang">
              <span className="rk-v-af">{voortgang.af} af</span>
              <span className="rk-v-loopt">{voortgang.loopt} loopt</span>
              <span className="rk-v-open">{voortgang.open} open</span>
              <div className="rk-balk">
                <div className="rk-balk-af" style={{ width: `${(voortgang.af / voortgang.totaal) * 100}%` }} />
                <div className="rk-balk-loopt" style={{ width: `${(voortgang.loopt / voortgang.totaal) * 100}%` }} />
              </div>
            </div>
          </div>

          {advies && (
            <div className="rk-advies">
              <div className="rk-advies-label">Begin hier</div>
              <div className="rk-advies-code">{advies.code}</div>
              <div className="rk-advies-titel">{advies.titel}</div>
              <Kopieer tekst={advies.prompt} label="Kopieer de startregel" primair />
            </div>
          )}
        </div>

        {lopend.length > 0 && (
          <div className="card rk-lopend">
            <strong>Bezig in een andere chat:</strong>{" "}
            {lopend.map((p) => `${p.code} (${p.titel.toLowerCase()})`).join(", ")}. Begin daar geen tweede chat voor.
          </div>
        )}

        {/* ── Hoe je dit gebruikt ── */}
        <details className="card rk-hoe">
          <summary>Hoe je dit gebruikt (drie regels)</summary>
          <ol>
            <li>
              <strong>Eén punt per chat.</strong> Kopieer de startregel van dat punt, open een nieuwe chat in Claude
              Code en plak hem. De chat weet dan zelf waar de beschrijving staat en hoe hij moet terugkoppelen.
            </li>
            <li>
              <strong>Zoveel chats open als je wilt.</strong> De grens zit niet in het aantal chats maar in hoeveel
              er op hetzelfde moment aan het bouwen zijn. Twee dingen tellen: laat een chat zijn werk afmaken en
              wegzetten voordat je de volgende aan het werk zet, en start nooit twee punten die hetzelfde scherm
              raken. Onder &ldquo;Meer&rdquo; staat per punt met welk ander punt het botst.
            </li>
            <li>
              <strong>Je krijgt een vast blokje terug:</strong> wat je vroeg, wat er nu werkt, een link om te kijken,
              en wat jij nog moet doen. De link komt pas als het echt live staat, dus je hoeft niet zelf te wachten.
              Wil je de techniek weten, vraag ernaar; anders komt die niet.
            </li>
          </ol>
        </details>

        {/* ── De punten, per golf ── */}
        {golven.map((g) => {
          const lijst = punten.filter((p) => p.golf === g.nummer);
          return (
            <section key={g.nummer} className="card rk-golf">
              <div className="rk-golf-kop">
                <span className="rk-golf-nr">Golf {g.nummer}</span>
                <div>
                  <h2 className="rk-golf-titel">{g.titel}</h2>
                  <p className="rk-golf-regel">{g.regel}</p>
                </div>
              </div>
              <div className="rk-punten">
                {lijst.map((p) => <PuntKaart key={p.code} p={p} />)}
              </div>
            </section>
          );
        })}

        <p className="rk-voet">
          De volledige beschrijving van een punt staat onder &ldquo;Meer&rdquo; bij het punt zelf. De afwegingen en de
          lijst met wat we bewust niet doen staan op <a href="/uitleg#agenda">de uitlegpagina</a>.
        </p>
      </div>
    </>
  );
}
