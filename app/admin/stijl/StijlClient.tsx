"use client";

import { useState } from "react";
import AdminKop from "../AdminKop";
import type { Meting, Soort, Stapel } from "../../../lib/stijl-meting";

// ═══════════════════════════════════════════════════════════
// DE SPIEGEL: WAT DE BEDOELING IS, EN WAT ER STAAT
// ═══════════════════════════════════════════════════════════
// Dit scherm tekent alleen. Alle cijfers zijn bij de bouw gemeten; hier wordt
// niets uitgerekend wat ook meetbaar was, zodat wat je ziet niet kan afwijken
// van wat de proef bewaakt.
// ═══════════════════════════════════════════════════════════

type Props = {
  meting: Meting;
  plafond: Record<string, number>;
  doel: Record<string, number>;
};

/** De zeven meters, in de volgorde waarin ze het meeste zeggen. */
const METERS: { sleutel: string; naam: string; uitleg: string }[] = [
  { sleutel: "kleuren", naam: "Kleuren", uitleg: "Verschillende kleuren die ergens in de opmaak staan." },
  { sleutel: "knopklassen", naam: "Soorten knop", uitleg: "Eigen classnamen voor iets dat een knop is." },
  { sleutel: "schaduwen", naam: "Schaduwen", uitleg: "Verschillende manieren waarop iets van de pagina af komt." },
  { sleutel: "lettergroottes", naam: "Lettergroottes", uitleg: "Verschillende tekstmaten buiten de type-schaal om." },
  { sleutel: "afstanden", naam: "Afstanden", uitleg: "Losse waarden voor ruimte, naast de spacing-schaal." },
  { sleutel: "rondingen", naam: "Rondingen", uitleg: "Verschillende hoekrondingen." },
  { sleutel: "inlineOpmaak", naam: "Opmaak in de code", uitleg: "Opmaak die niet in het stylesheet staat maar los in een scherm, waar geen enkele controle bij kan." },
];

const STAPEL_TEKST: Record<Stapel, { kop: string; wat: string }> = {
  gelijk: { kop: "Dezelfde kleur, anders opgeschreven", wat: "#FFF naast #ffffff. Puur zoeken en vervangen." },
  bijna: { kop: "Niet te onderscheiden", wat: "Het verschil is op een scherm niet te zien. Ook zoeken en vervangen." },
  familie: { kop: "Dezelfde familie, andere tint", wat: "Zes groenen die allemaal 'goed' betekenen. Kies er één." },
  anders: { kop: "Echt een andere kleur", wat: "Hier zit een keuze in. Deze verdienen een naam, of ze moeten weg." },
  doorzichtig: { kop: "Doorzichtig", wat: "Schaduwen en waas. Horen bij de schaduw-schaal, niet bij het palet." },
};

export default function StijlClient({ meting, plafond, doel }: Props) {
  const [alleKleuren, setAlleKleuren] = useState(false);
  const [openStapel, setOpenStapel] = useState<Stapel | null>(null);
  const [openFamilie, setOpenFamilie] = useState<string | null>(null);

  const nu: Record<string, number> = {
    kleuren: meting.kleuren.verschillend,
    lettergroottes: meting.lettergroottes.verschillend,
    rondingen: meting.rondingen.verschillend,
    schaduwen: meting.schaduwen.verschillend,
    afstanden: meting.afstanden.verschillend,
    knopklassen: meting.families.find((f) => f.naam === "Knoppen")?.aantal ?? 0,
    inlineOpmaak: meting.inline.metVasteWaarde,
  };

  // Kleurtokens uit :root, voor de "bedoeling"-helft. Alleen de dekkende
  // kleuren; een gradient is geen staaltje.
  const kleurTokens = meting.tokens.filter((t) => /^#[0-9a-fA-F]{3,8}$/.test(t.waarde.trim()));
  const typeTokens = meting.tokens.filter((t) => t.naam.startsWith("--fs-"));
  const ruimteTokens = meting.tokens.filter((t) => t.naam.startsWith("--s-") && t.waarde !== "0px");
  const rondingTokens = meting.tokens.filter((t) => t.naam.startsWith("--r-"));
  const schaduwTokens = meting.tokens.filter((t) => t.naam.startsWith("--shadow-"));

  const stapels: Stapel[] = ["gelijk", "bijna", "familie", "anders", "doorzichtig"];
  const perStapel = (s: Stapel) => meting.kleurNaastToken.filter((k) => k.stapel === s);
  const opTeRuimen = meting.kleurNaastToken.filter((k) => k.stapel !== "anders" && k.stapel !== "doorzichtig");
  const opTeRuimenPlekken = opTeRuimen.reduce((a, b) => a + b.aantal, 0);

  // De betekenislaag. Het aandeel is met opzet klein aan het begin: de laag is
  // net gelegd en alleen de gedeelde bouwstenen staan erop. Het getal eerlijk
  // tonen is het punt, want een laag die niemand gebruikt is geen fundament.
  const betekenis = meting.betekenis;
  const totaalGebruik = betekenis.gebruik + betekenis.schaalGebruik;
  const aandeelBreedte = `${Math.max(1, Math.round((betekenis.gebruik / Math.max(totaalGebruik, 1)) * 100))}%`;
  const groepen = [...new Set(betekenis.namen.map((n) => n.groep))];

  const zichtbareKleuren = alleKleuren ? meting.kleuren.los : meting.kleuren.los.slice(0, 72);

  return (
    <>
      <AdminKop titel="Stijl" />
      <div className="stijl-pagina">

        {/* ── Waarom je hier kijkt ── */}
        <div className="card section">
          <h2 className="stijl-h2">Wat dit scherm is</h2>
          <p className="stijl-p">
            Links staat hoe weinig keuzes dit dashboard zou moeten hebben: één schaal voor tekst,
            één voor ruimte, één set kleuren, één knop. Rechts staat hoeveel keuzes er werkelijk
            in de code staan. Het verschil tussen die twee is de werklijst, en de meters hieronder
            mogen alleen dalen. Zodra ze laag genoeg staan is een ander ontwerp kiezen niet meer
            dan die schalen veranderen, en zie je hier meteen wat dat overal tegelijk doet.
          </p>
        </div>

        {/* ── De meters ── */}
        <div className="card section">
          <h2 className="stijl-h2">De meters</h2>
          <p className="stijl-p stijl-p-klein">
            Elke balk loopt van het doel (links) naar wat er nu is (rechts). Een bouw wordt rood
            zodra een getal stijgt, dus het kan alleen nog de goede kant op.
          </p>
          <div className="stijl-meters">
            {METERS.map((m) => {
              const huidig = nu[m.sleutel] ?? 0;
              const wil = doel[m.sleutel] ?? 0;
              const max = Math.max(plafond[m.sleutel] ?? huidig, huidig, 1);
              const vulling = `${Math.round((huidig / max) * 100)}%`;
              const doelPunt = `${Math.round((wil / max) * 100)}%`;
              const klaar = huidig <= wil;
              return (
                <div key={m.sleutel} className="stijl-meter">
                  <div className="stijl-meter-kop">
                    <span className="stijl-meter-naam">{m.naam}</span>
                    <span className={klaar ? "stijl-meter-cijfer stijl-goed" : "stijl-meter-cijfer"}>
                      {huidig}<span className="stijl-meter-doel"> / doel {wil}</span>
                    </span>
                  </div>
                  <div className="stijl-balk">
                    <div className={klaar ? "stijl-balk-vul stijl-balk-klaar" : "stijl-balk-vul"} style={{ width: vulling }} />
                    <div className="stijl-balk-doel" style={{ left: doelPunt }} />
                  </div>
                  <div className="stijl-meter-uitleg">{m.uitleg}</div>
                </div>
              );
            })}
          </div>
          <div className="stijl-voet">
            {meting.css.regels.toLocaleString("nl-NL")} regels opmaak, {meting.css.stijlregels.toLocaleString("nl-NL")} stijlregels,
            {" "}{meting.css.classnamen.toLocaleString("nl-NL")} eigen classnamen, {meting.inline.totaal} losse opmaakregels in schermen.
          </div>
        </div>

        {/* ── Kleuren, uit elkaar getrokken ── */}
        <div className="card section">
          <h2 className="stijl-h2">De {meting.kleuren.verschillend} kleuren, uit elkaar getrokken</h2>
          <p className="stijl-p">
            Het getal alleen zegt niets, want het klinkt als ontwerpwerk. Dat is het grotendeels
            niet. Elke losse kleur is hieronder naast de kleur gelegd die er al een naam heeft.{" "}
            <strong>{opTeRuimen.length} van de {meting.kleuren.verschillend}</strong> zijn een kleur
            die al bestaat, samen goed voor <strong>{opTeRuimenPlekken.toLocaleString("nl-NL")} plekken</strong> in de code.
            Dat is zoeken en vervangen, geen smaak. Er blijven{" "}
            {perStapel("anders").length} kleuren over waar echt een keuze in zit.
          </p>
          <div className="stijl-stapels">
            {stapels.map((s) => {
              const groep = perStapel(s);
              const open = openStapel === s;
              return (
                <div key={s} className={open ? "stijl-stapel stijl-stapel-open" : "stijl-stapel"}>
                  <button
                    type="button"
                    className="btn btn-quiet btn-klein"
                    onClick={() => setOpenStapel(open ? null : s)}
                  >
                    <span className="stijl-stapel-aantal">{groep.length}</span>
                    <span className="stijl-stapel-kop">{STAPEL_TEKST[s].kop}</span>
                  </button>
                  <div className="stijl-stapel-wat">{STAPEL_TEKST[s].wat}</div>
                  <div className="stijl-stapel-voorproef">
                    {groep.slice(0, 14).map((k) => (
                      <span key={k.waarde} className="stijl-stip" style={{ background: k.waarde }} title={k.waarde} />
                    ))}
                  </div>
                  {open && (
                    <div className="stijl-stapel-lijst">
                      {groep.map((k) => (
                        <div key={k.waarde} className="stijl-kleurregel">
                          <span className="stijl-stip stijl-stip-groot" style={{ background: k.waarde }} />
                          <code className="stijl-code">{k.waarde}</code>
                          <span className="stijl-kleurregel-aantal">{k.aantal}×</span>
                          {k.dichtst && (
                            <span className="stijl-kleurregel-naar">
                              wordt <code className="stijl-code">var({k.dichtst})</code>
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── De betekenislaag ── */}
        <div className="card section">
          <h2 className="stijl-h2">De betekenislaag: waar een waarde voor dient</h2>
          <p className="stijl-p">
            De schaal hieronder zegt hoe groot iets is en welke kleur het heeft. Dat is genoeg om
            consequent te zijn, en te weinig om iets te kunnen veranderen: wil je alle bijschriften
            een tikje groter, dan moet je weten wélke van de honderden gebruiken een bijschrift is,
            en dat staat nergens. Deze {betekenis.namen.length} namen zeggen dat wel. Vanaf hier is
            een ontwerpwijziging één regel in plaats van een zoektocht.
          </p>
          <div className="stijl-aandeel">
            <div className="stijl-aandeel-kop">
              <span className="stijl-meter-naam">Hoeveel van de opmaak hem al gebruikt</span>
              <span className="stijl-meter-cijfer">{betekenis.gebruik}<span className="stijl-meter-doel"> van {(betekenis.gebruik + betekenis.schaalGebruik).toLocaleString("nl-NL")} plekken</span></span>
            </div>
            <div className="stijl-balk">
              <div className="stijl-balk-vul" style={{ width: aandeelBreedte }} />
            </div>
            <div className="stijl-meter-uitleg">
              Dit getal mag alleen stijgen; zakt het, dan stopt de bouw. De gedeelde bouwstenen
              (kaart, knop, label, rij) staan er al op, dus elk scherm dat die gebruikt erft de
              betekenis mee zonder zelf verbouwd te worden. De rest volgt scherm voor scherm.
            </div>
          </div>
          {groepen.map((groep) => (
            <div key={groep}>
              <h3 className="stijl-h3">{groep}</h3>
              <div className="stijl-betekenis">
                {betekenis.namen.filter((n) => n.groep === groep).map((n) => {
                  const vlak = `var(${n.naam})`;
                  return (
                    <div key={n.naam} className="stijl-betekenisregel">
                      {groep === "Kleur" && <span className="stijl-stip" style={{ background: vlak }} />}
                      <code className="stijl-code">{n.naam}</code>
                      <span className="stijl-betekenis-pijl">wordt</span>
                      <code className="stijl-code">{n.wijstNaar}</code>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* ── De bedoeling ── */}
        <div className="card section">
          <h2 className="stijl-h2">De bedoeling</h2>
          <p className="stijl-p stijl-p-klein">
            Dit is het volledige fundament zoals het nu in <code className="stijl-code">:root</code> staat.
            Alles wat het dashboard tekent zou hieruit moeten komen, en verder nergens vandaan.
          </p>

          <h3 className="stijl-h3">Kleuren met een naam ({kleurTokens.length})</h3>
          <div className="stijl-palet">
            {kleurTokens.map((t) => (
              <div key={t.naam} className="stijl-swatch">
                <div className="stijl-swatch-vlak" style={{ background: t.waarde }} />
                <div className="stijl-swatch-naam">{t.naam.replace("--", "")}</div>
                <div className="stijl-swatch-waarde">{t.waarde}</div>
              </div>
            ))}
          </div>

          <h3 className="stijl-h3">Type-schaal ({typeTokens.length})</h3>
          <div className="stijl-type">
            {typeTokens.map((t) => (
              <div key={t.naam} className="stijl-type-regel">
                <span className="stijl-type-naam">{t.naam.replace("--fs-", "")}</span>
                <span className="stijl-type-maat">{t.waarde}</span>
                <span className="stijl-type-proef" style={{ fontSize: t.waarde }}>
                  Pingwin zorgt dat een bedrijf gevonden én gekozen wordt
                </span>
              </div>
            ))}
          </div>

          <h3 className="stijl-h3">Ruimte ({ruimteTokens.length})</h3>
          <div className="stijl-ruimte">
            {ruimteTokens.map((t) => (
              <div key={t.naam} className="stijl-ruimte-regel">
                <span className="stijl-ruimte-naam">{t.naam.replace("--", "")}</span>
                <span className="stijl-ruimte-blok" style={{ width: t.waarde }} />
                <span className="stijl-ruimte-maat">{t.waarde}</span>
              </div>
            ))}
          </div>

          <h3 className="stijl-h3">Rondingen en schaduwen</h3>
          <div className="stijl-vormen">
            {rondingTokens.map((t) => (
              <div key={t.naam} className="stijl-vorm">
                <div className="stijl-vorm-blok" style={{ borderRadius: t.waarde }} />
                <div className="stijl-vorm-naam">{t.naam.replace("--", "")}</div>
              </div>
            ))}
            {schaduwTokens.map((t) => (
              <div key={t.naam} className="stijl-vorm">
                <div className="stijl-vorm-blok stijl-vorm-schaduw" style={{ boxShadow: t.waarde }} />
                <div className="stijl-vorm-naam">{t.naam.replace("--", "")}</div>
              </div>
            ))}
          </div>

          <h3 className="stijl-h3">De bouwstenen</h3>
          <div className="stijl-bouwstenen">
            <button type="button" className="btn btn-primary">Hoofdactie</button>
            <button type="button" className="btn btn-ghost">Secundair</button>
            <button type="button" className="btn btn-quiet">Informatief</button>
            <button type="button" className="btn btn-danger">Verwijderen</button>
            <button type="button" className="btn btn-klein">Klein</button>
            <span className="chip">Label</span>
          </div>
        </div>

        {/* ── De werkelijkheid, per soort ── */}
        <div className="card section">
          <h2 className="stijl-h2">De werkelijkheid</h2>
          <p className="stijl-p stijl-p-klein">
            Dezelfde soorten, maar dan wat er echt in de code staat. De getallen achter een waarde
            zijn het aantal plekken; wat vaak voorkomt is het meeste werk maar levert ook het
            meeste op.
          </p>

          <h3 className="stijl-h3">
            Alle kleuren die er zijn ({meting.kleuren.verschillend} tegenover {meting.kleuren.benoemd} met een naam)
          </h3>
          <div className="stijl-raster">
            {zichtbareKleuren.map((k) => (
              <span key={k.waarde} className="stijl-tegel" style={{ background: k.waarde }} title={`${k.waarde} — ${k.aantal}×`} />
            ))}
          </div>
          {meting.kleuren.los.length > 72 && (
            <button type="button" className="btn btn-ghost btn-klein stijl-meer" onClick={() => setAlleKleuren(!alleKleuren)}>
              {alleKleuren ? "Toon alleen de meest gebruikte" : `Toon alle ${meting.kleuren.los.length}`}
            </button>
          )}

          <SoortLijst kop="Lettergroottes buiten de schaal" soort={meting.lettergroottes} eenheid="" />
          <SoortLijst kop="Afstanden buiten de schaal" soort={meting.afstanden} eenheid="" />
          <SoortLijst kop="Rondingen" soort={meting.rondingen} eenheid="" />

          {/* Schaduwen als tekst waren een muur van afgekapte code: 45 regels
              monospace waar je niets uit opmaakt. Een schaduw is iets dat je
              ziet, dus toon je hem. Zo valt in één blik op dat het merendeel
              hetzelfde bedoelt en alleen anders is opgeschreven, en dat is
              precies de vraag die dit scherm moet beantwoorden. */}
          <h3 className="stijl-h3">
            Schaduwen ({meting.schaduwen.verschillend} tegenover {meting.schaduwen.benoemd} in de schaal)
          </h3>
          <div className="stijl-schaduwen">
            {meting.schaduwen.los.map((s) => (
              <div key={s.waarde} className="stijl-schaduwtegel" style={{ boxShadow: s.waarde }} title={`${s.waarde} — ${s.aantal}×`}>
                {s.aantal}
              </div>
            ))}
          </div>

          <h3 className="stijl-h3">Hoe vaak hetzelfde onderdeel opnieuw is uitgevonden</h3>
          <p className="stijl-p stijl-p-klein">
            Elk getal is het aantal eigen classnamen voor dat onderdeel. Klik om te zien welke.
          </p>
          <div className="stijl-families">
            {meting.families.map((f) => (
              <div key={f.naam} className="stijl-familie">
                <button
                  type="button"
                  className="btn btn-ghost btn-klein"
                  onClick={() => setOpenFamilie(openFamilie === f.naam ? null : f.naam)}
                >
                  <span className="stijl-familie-aantal">{f.aantal}</span>
                  <span>{f.naam}</span>
                </button>
                {openFamilie === f.naam && (
                  <div className="stijl-familie-namen">
                    {f.namen.map((n) => <code key={n} className="stijl-code">.{n}</code>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── De werklijst ── */}
        <div className="card section">
          <h2 className="stijl-h2">Waar we beginnen</h2>
          <p className="stijl-p">
            Opmaak die los in een scherm staat in plaats van in het stylesheet is het enige soort
            dat geen enkele controle ziet. Elke regel die we in de opmaak strak trekken, geldt daar
            niet. Deze {meting.inline.metVasteWaarde} plekken gaan dus als eerste mee, scherm voor scherm.
          </p>
          <div className="stijl-werklijst">
            {meting.inline.perBestand.map((b) => (
              <div key={b.bestand} className="stijl-werkregel">
                <span className="stijl-werkregel-aantal">{b.aantal}</span>
                <code className="stijl-code stijl-werkregel-pad">{b.bestand}</code>
              </div>
            ))}
          </div>
        </div>

      </div>
    </>
  );
}

/** Eén soort waarde als lijst: wat er is, hoe vaak, en hoeveel er zouden moeten zijn. */
function SoortLijst({ kop, soort, eenheid }: { kop: string; soort: Soort; eenheid: string }) {
  return (
    <>
      <h3 className="stijl-h3">{kop} ({soort.verschillend} tegenover {soort.benoemd} in de schaal)</h3>
      <div className="stijl-waarden">
        {soort.los.map((w) => (
          <span key={w.waarde} className="stijl-waarde" title={`${w.aantal} plekken`}>
            <code className="stijl-code">{w.waarde}{eenheid}</code>
            <span className="stijl-waarde-aantal">{w.aantal}</span>
          </span>
        ))}
      </div>
    </>
  );
}
