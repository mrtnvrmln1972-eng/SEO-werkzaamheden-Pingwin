"use client";

import { useState } from "react";
import type { Punt } from "../../../lib/routekaart";
import type { Uitslag } from "../../../lib/routekaart-bewijs";
import Kopieer from "../Kopieer";
import OntwikkelMenu from "../OntwikkelMenu";
import Tellers from "../Tellers";
import MeldingenMenu from "../MeldingenMenu";

export type PuntWeergave = Punt & {
  kan: boolean;
  wacht: string[];
  botst: string[];
  prompt: string;
  promptTekst: string;
  /** De volledige beschrijving uit /uitleg, als HTML. null = nog geen tekst. */
  beschrijving: string | null;
  /** Punten die nú lopen en hetzelfde scherm raken. Niet tegelijk beginnen. */
  botstLopend: string[];
  /** De gemeten werkelijkheid, uit de draaiende versie. */
  bewijs: Uitslag;
  /** Zit dit punt in de set die nú naast elkaar gestart kan worden? */
  parallel: boolean;
};

type Golf = { nummer: 1 | 2 | 3; titel: string; regel: string };

const OMVANG_LABEL: Record<Punt["omvang"], string> = {
  klein: "Klein werk", middel: "Halve dag tot een dag", groot: "Meerdere sessies",
};

/**
 * Wat er op de chip staat volgt uit de MEETUITSLAG, niet uit het vinkje in de
 * routekaart. "Af" is een bewering van een chat; hier staat wat de draaiende
 * versie er zelf van zegt. Een punt dat af heet maar niet aangetoond is, zegt
 * dat gewoon.
 */
function chipVoor(p: PuntWeergave): { tekst: string; kleur: string; titel: string } {
  if (p.stand === "loopt") {
    return { tekst: "Loopt nu", kleur: "loopt", titel: "Een chat is hier nu mee bezig." };
  }
  if (p.stand === "af") {
    if (p.bewijs.stand === "aangetoond") {
      return { tekst: "Af, gemeten", kleur: "af", titel: "Gecontroleerd in de versie die nu live staat." };
    }
    if (p.bewijs.stand === "half") {
      return {
        tekst: "Af, nog niet gezien",
        kleur: "twijfel",
        titel: "De code staat live, maar het is nog niet één keer in gebruik gemeten.",
      };
    }
    if (p.bewijs.stand === "niet-aangetoond") {
      return {
        tekst: "Zegt af, niet aangetoond",
        kleur: "alarm",
        titel: "De routekaart zegt af, maar de controle vindt het niet in de live versie.",
      };
    }
    return { tekst: "Af, niet gemeten", kleur: "ongemeten", titel: "Voor dit punt is nog geen controle vastgelegd." };
  }
  if (p.parallel) {
    return { tekst: "Kan nu starten", kleur: "kan", titel: "Kan nu in een eigen chat, zonder iets anders te raken." };
  }
  return { tekst: "Open", kleur: "open", titel: "Staat nog open." };
}

function PuntKaart({ p }: { p: PuntWeergave }) {
  const [open, setOpen] = useState(false);
  const chip = chipVoor(p);
  // Een punt dat af heet maar niet aangetoond is, is de enige situatie die een
  // rand verdient: dan klopt het overzicht niet en moet je het zien zonder klikken.
  const alarm = p.stand === "af" && p.bewijs.stand === "niet-aangetoond";
  return (
    <div
      id={"punt-" + p.code}
      className={
        "rk-punt rk-punt-" + p.stand +
        (p.parallel ? " rk-punt-kan" : "") +
        (alarm ? " rk-punt-alarm" : "")
      }
    >
      <div className="rk-punt-kop">
        <span className="rk-code">{p.code}</span>
        <div className="rk-punt-tekst">
          <div className="rk-punt-titel">{p.titel}</div>
          <div className="rk-punt-oplevert">{p.oplevert}</div>
        </div>
        <div className="rk-punt-stand">
          <span className={"chip rk-chip-" + chip.kleur} title={chip.titel}>{chip.tekst}</span>
        </div>
      </div>

      {alarm && (
        <div className="rk-punt-alarmregel">
          Dit punt staat als af in de routekaart, maar de controle vindt het niet terug in de versie die nu live
          staat. Onder &ldquo;Wat gaan we hier bouwen?&rdquo; staat wat er ontbreekt.
        </div>
      )}

      <div className="rk-punt-meta">
        <span className="rk-meta-item">{OMVANG_LABEL[p.omvang]}</span>
        {p.stand === "af" && p.afGekomen && <span className="rk-meta-item">Af op {p.afGekomen}</span>}
        {p.wacht.length > 0 && (
          <span className="rk-meta-item rk-meta-wacht">Wacht op {p.wacht.join(" en ")}</span>
        )}
        {/* Eén klik, niet twee. Maarten wil bij "Meer" meteen zien wat er speelt en
            wat we gaan bouwen; een tweede knop naar dezelfde tekst is een extra stap
            zonder doel. */}
        <button type="button" className="rk-meer" onClick={() => setOpen((v) => !v)}>
          {open ? "Minder" : "Wat gaan we hier bouwen?"}
        </button>
      </div>

      {open && (
        <div className="rk-punt-meer">
          {p.beschrijving ? (
            <div
              className="md rk-volledig"
              // De brontekst staat in lib/uitleg/15-agenda/; beschrijvingVoor() in
              // lib/routekaart-tekst.ts zet 'm om, dezelfde renderer als de
              // uitlegpagina. Geen invoer van buiten.
              dangerouslySetInnerHTML={{ __html: p.beschrijving }}
              /* mdToHtml (lib/routekaart-tekst.ts) rendert dit al */
            />
          ) : (
            <>
              <p><strong>Af als:</strong> {p.af}</p>
              <p><strong>Raakt:</strong> {p.raakt.join(", ")}</p>
              <p className="rk-geen-tekst">
                Voor dit punt staat er nog geen uitgeschreven beschrijving. De chat pakt het op met
                wat hierboven staat.
              </p>
            </>
          )}
          {p.botst.length > 0 && (
            <p className="rk-botst">
              <strong>Let op bij twee chats:</strong> {p.botst.join(", ")} {p.botst.length === 1 ? "raakt" : "raken"} hetzelfde
              scherm. Doe die niet gelijktijdig.
            </p>
          )}

          {/* De meting, niet de bewering. Hier staat waarop "af" rust. */}
          <div className="rk-bewijs">
            <div className="rk-bewijs-kop">Wat de live versie er zelf van zegt</div>
            {p.bewijs.regels.length === 0 ? (
              <p className="rk-bewijs-geen">
                Voor dit punt is nog geen controle vastgelegd. Dat gebeurt bij het oppakken: de chat legt dan vast
                waaraan te meten valt dat het echt werkt.
              </p>
            ) : (
              <ul className="rk-bewijs-lijst">
                {p.bewijs.regels.map((r) => (
                  <li key={r.wat} className={r.ok ? "rk-b-ok" : "rk-b-nee"}>
                    <span className="rk-b-teken" aria-hidden="true">{r.ok ? "✓" : "✗"}</span>
                    {r.wat}
                    {r.toelichting && <span className="rk-b-toel"> ({r.toelichting})</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {p.stand !== "af" && p.botstLopend.length > 0 && (
        <div className="rk-punt-botst-nu">
          Nu even niet: {p.botstLopend.join(" en ")} {p.botstLopend.length === 1 ? "loopt" : "lopen"} en {p.botstLopend.length === 1 ? "raakt" : "raken"}{" "}
          hetzelfde scherm. Wacht tot die chat klaar is.
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
              {p.stand === "loopt"
                ? "Loopt al in een andere chat."
                : p.botstLopend.length > 0
                ? `Nu niet starten: raakt hetzelfde scherm als ${p.botstLopend.join(" en ")}, dat nu loopt.`
                : `Kan nog niet beginnen: ${p.wacht.join(" en ")} moet eerst af zijn.`}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export default function RoutekaartClient({
  punten, golven, voortgang, advies, reden, parallel, ideeen,
}: {
  punten: PuntWeergave[];
  golven: Golf[];
  voortgang: { af: number; loopt: number; open: number; totaal: number };
  advies: { code: string; titel: string; prompt: string } | null;
  reden: "leeg" | "botst" | null;
  parallel: { code: string; titel: string; prompt: string }[];
  /** Ideeën van de tweak-stapel waar Maarten ja tegen zei; nog zonder R-nummer. */
  ideeen: { id: number; tekst: string; punt: string | null }[];
}) {
  const lopend = punten.filter((p) => p.stand === "loopt");
  const twijfel = punten.filter((p) => p.stand === "af" && p.bewijs.stand === "niet-aangetoond");
  // De rest naast het aangeraden punt: dat kun je er nú bij starten.
  const erbij = parallel.filter((p) => p.code !== advies?.code);

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
          <MeldingenMenu />
          <Tellers />
        <OntwikkelMenu />
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

          {advies ? (
            <div className="rk-advies">
              <div className="rk-advies-label">Begin hier</div>
              <div className="rk-advies-code">{advies.code}</div>
              <div className="rk-advies-titel">{advies.titel}</div>
              <Kopieer tekst={advies.prompt} label="Kopieer de startregel" primair />
            </div>
          ) : (
            <div className="rk-advies">
              <div className="rk-advies-label">Even niets beginnen</div>
              <p className="rk-advies-uitleg">
                {reden === "botst"
                  ? "Alles wat nu zou kunnen beginnen raakt een scherm waar al aan gewerkt wordt. Laat die chat eerst afmaken en pushen; daarna verschijnt hier vanzelf het volgende punt."
                  : "Er staat niets open dat nu kan beginnen. Hieronder zie je per punt waar het op wacht."}
              </p>
            </div>
          )}
        </div>

        {/* ── Wat kun je er nú naast zetten? ── */}
        {erbij.length > 0 && (
          <div className="card rk-parallel">
            <div className="rk-parallel-kop">
              Dit kun je er nu naast starten, in eigen chats
            </div>
            <p className="rk-parallel-uitleg">
              Deze punten raken elkaar niet en raken ook niet wat er nu loopt. Je kunt ze dus tegelijk aanzetten
              zonder dat twee chats in hetzelfde scherm gaan schrijven.
            </p>
            <div className="rk-parallel-rij">
              {erbij.map((p) => (
                <div key={p.code} className="rk-parallel-kaart">
                  <div className="rk-parallel-code">{p.code}</div>
                  <div className="rk-parallel-titel">{p.titel}</div>
                  <div className="rk-parallel-acties">
                    <Kopieer tekst={p.prompt} label="Kopieer startregel" />
                    {/* Kleine sprong naar het punt zelf, zodat je eerst kunt lezen
                        wat er gaat gebeuren zonder de hele pagina af te zoeken. */}
                    <a className="rk-parallel-link" href={`#punt-${p.code}`}>Wat is dit?</a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Klopt het overzicht nog? ── */}
        {twijfel.length > 0 && (
          <div className="card rk-twijfel">
            <strong>Let op:</strong> {twijfel.map((p) => p.code).join(", ")} {twijfel.length === 1 ? "staat" : "staan"} als
            af in de routekaart, maar {twijfel.length === 1 ? "is" : "zijn"} niet terug te vinden in de versie die nu
            live staat. Dat betekent dat de chat het vinkje te vroeg zette, of dat het werk nog niet gedeployd is.
          </div>
        )}

        {lopend.length > 0 && (
          <div className="card rk-lopend">
            <strong>Bezig in een andere chat:</strong>{" "}
            {lopend.map((p) => `${p.code} (${p.titel.toLowerCase()})`).join(", ")}. Begin daar geen tweede chat voor.
          </div>
        )}

        {/* ── Uit de ideeënstapel ──
            De brug tussen het Tweak-knopje en het grotere werk. Een idee dat te
            groot is voor een ronde en waar Maarten ja tegen zei, hoort hier te
            landen; anders blijft het op de tweak-stapel staan tussen dingen van
            twee minuten en verdwijnt het uit beeld.

            Sinds er een wachtrij voor grote punten bestaat (/admin/grote-punten)
            gaat zo'n idee daarheen en krijgt het meteen een G-nummer: daar wordt
            er eerst een plan van gemaakt, keurt Maarten dat goed, en wordt het
            's nachts gebouwd. Dit blok is dan de verwijzing, niet de wachtkamer.
            Een idee zónder nummer (van vóór die wachtrij) hoort nog steeds hier
            en kan alsnog een R-punt worden; de punten hierboven staan in de code
            (lib/routekaart.ts) en dat blijft de ene waarheid. */}
        {ideeen.length > 0 && (
          <section className="card rk-ideeen">
            <h2 className="rk-golf-titel">Uit de ideeënstapel ({ideeen.length})</h2>
            <p className="rk-golf-regel">
              Hier zei je ja tegen. Staat er een G-nummer bij, dan ligt het in de{" "}
              <a className="rk-parallel-link" href="/admin/grote-punten">wachtrij voor grote punten</a>;
              daar zie je het plan en geef je akkoord. Staat er geen nummer bij, kopieer dan de regel
              en plak hem in een verse chat; dan wordt het een echt punt hierboven, met een
              beschrijving en een plek in een golf.
            </p>
            <div className="rk-punten">
              {ideeen.map((i) => (
                <div key={i.id} className="rk-idee">
                  <div className="rk-idee-tekst">{i.tekst}</div>
                  <div className="rk-idee-acties">
                    {i.punt
                      ? <span className="rk-code">{i.punt}</span>
                      : <Kopieer klein tekst={`Maak van idee ${i.id} op /admin/tweaks een punt op de routekaart.`} label="Kopieer startregel" />}
                    <a className="rk-parallel-link" href={i.punt?.startsWith("G") ? "/admin/grote-punten" : "/admin/tweaks"}>
                      {i.punt?.startsWith("G") ? "Naar de grote punten" : "Naar de stapel"}
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
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
