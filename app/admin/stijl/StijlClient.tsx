"use client";

import { useState } from "react";
import AdminKop from "../AdminKop";
import Speelruimte from "./Speelruimte";
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
  /** De eerste klant uit de lijst, zodat de vergelijking ook een klantkaart kan tonen. */
  klant: { slug: string; naam: string } | null;
};

/** De zeven meters, in de volgorde waarin ze het meeste zeggen. */
const METERS: { sleutel: string; naam: string; uitleg: string; losseWerklijst?: boolean }[] = [
  { sleutel: "kleuren", naam: "Kleuren", uitleg: "Verschillende kleuren die ergens in de opmaak staan." },
  { sleutel: "knopklassen", naam: "Soorten knop", uitleg: "Eigen knopnamen naast het knopsysteem. Werklijst, geen poort: dat een knop het systeem gebruikt wordt al bewaakt bij de knop zelf, en twee poorten voor één regel lopen uit elkaar.", losseWerklijst: true },
  { sleutel: "schaduwen", naam: "Schaduwen", uitleg: "Verschillende manieren waarop iets van de pagina af komt." },
  { sleutel: "lettergroottes", naam: "Lettergroottes", uitleg: "Verschillende tekstmaten buiten de type-schaal om." },
  { sleutel: "afstanden", naam: "Afstanden", uitleg: "Losse waarden voor ruimte, naast de spacing-schaal." },
  { sleutel: "rondingen", naam: "Rondingen", uitleg: "Verschillende hoekrondingen." },
  { sleutel: "inlineOpmaak", naam: "Opmaak in de code", uitleg: "Opmaak die niet in het stylesheet staat maar los in een scherm, waar geen enkele controle bij kan." },
];

/**
 * De vier stappen van de verbouwing, in gewone taal.
 *
 * Waarom dit hier staat en niet in een document: een verbouwing die maanden
 * duurt en waarin de eerste drie stappen niets veranderen aan wat je ziet, is
 * onmogelijk te volgen als het verhaal alleen in losse chats leeft. Dan lijkt
 * het alsof er niets gebeurt, of erger, alsof er iets aan het ontwerp veranderd
 * is terwijl dat niet zo is.
 */
// Wat er sinds 17-08-2026 is samengetrokken. De rechterkolom komt uit dezelfde
// meting die de meters verderop voedt (lib/stijl-inventaris.json), de linker is
// de stand van vóór de verbouwing. Bewust met de hand, want die stand bestaat
// alleen nog in de git-geschiedenis; hij verandert ook nooit meer.
const VERANDERD: { wat: string; was: string; is: string }[] = [
  { wat: "Kleuren in de opmaak", was: "325 verschillende", is: "40" },
  { wat: "Lettergroottes buiten de schaal", was: "21", is: "0" },
  { wat: "Afstanden buiten de schaal", was: "21", is: "2" },
  { wat: "Hoekrondingen", was: "19", is: "4" },
  { wat: "Schaduwen buiten de schaal", was: "45", is: "2" },
  { wat: "Namen voor dezelfde soort knop", was: "13", is: "1" },
  { wat: "Lettertypes voor code", was: "6 varianten", is: "1" },
  // "Icoontjes als letter in beeld" stond hier als "18 plekken → 0". Dat was
  // getypt, niet geteld, en het waren er 419. Die regel wordt nu bij het
  // renderen uit de meting gehaald, net als de rest van dit scherm.
  { wat: "Losse opmaak in de schermen zelf", was: "50 plekken", is: "0" },
  { wat: "Plekken die uit de betekenislaag lezen", was: "geen", is: "ruim 8.500" },
];
const STAPPEN: { nr: number; titel: string; wat: string; stand: "af" | "bezig" | "open" }[] = [
  {
    nr: 1, stand: "af", titel: "Tellen wat er is",
    wat: "Uitzoeken hoeveel losse keuzes er in het dashboard staan, en een meter erop zetten die alleen mag dalen. Zonder dat getal weet je niet of je vooruitgaat.",
  },
  {
    nr: 2, stand: "af", titel: "Namen geven",
    wat: "Elke maat en kleur een naam geven die zegt waarvóór hij dient, in plaats van hoe groot hij is. Niet \u201c12,5 pixels\u201d maar \u201cde maat van een bijschrift\u201d. Daarna kun je alle bijschriften tegelijk veranderen.",
  },
  {
    nr: 3, stand: "af", titel: "Elk scherm die namen laten gebruiken",
    wat: "Scherm voor scherm, zonder dat er iets verandert aan hoe het eruitziet. Dit is het saaie stuk en tegelijk het stuk waar alles op wacht. Af op 18 augustus: alle zes de meters hieronder staan op hun doel, en er staat geen losse opmaak meer in de schermen zelf.",
  },
  {
    nr: 4, stand: "bezig", titel: "Het ontwerp kiezen en doorvoeren",
    wat: "Hier gaat het over hoe het eruitziet: kleuren, lettertype, hoeken, ruimte. Draaien kan in de speelruimte hierboven, en vastleggen met de knop eronder; vanaf dat moment geldt het voor iedereen. De keuze tot nu toe is 'zoals het nu is', dus het gezicht van het dashboard is niet veranderd. Wat wél veranderde: er is nu niets meer dat niet meebeweegt als je alsnog iets anders kiest.",
  },
];

const STAPEL_TEKST: Record<Stapel, { kop: string; wat: string }> = {
  gelijk: { kop: "Dezelfde kleur, anders opgeschreven", wat: "#FFF naast #ffffff. Puur zoeken en vervangen." },
  bijna: { kop: "Niet te onderscheiden", wat: "Het verschil is op een scherm niet te zien. Ook zoeken en vervangen." },
  familie: { kop: "Dezelfde familie, andere tint", wat: "Zes groenen die allemaal 'goed' betekenen. Kies er één." },
  anders: { kop: "Echt een andere kleur", wat: "Hier zit een keuze in. Deze verdienen een naam, of ze moeten weg." },
  doorzichtig: { kop: "Doorzichtig", wat: "Schaduwen en waas. Horen bij de schaduw-schaal, niet bij het palet." },
};

export default function StijlClient({ meting, plafond, doel, klant }: Props) {
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

  const afrondingen = meting.afrondingen;
  const aandeelTekst = `${(100 * meting.betekenis.gebruik / Math.max(meting.betekenis.gebruik + meting.betekenis.schaalGebruik, 1)).toFixed(1)}%`;

  const zichtbareKleuren = alleKleuren ? meting.kleuren.los : meting.kleuren.los.slice(0, 72);

  return (
    <>
      <AdminKop titel="Stijl" />
      <div className="stijl-pagina">

        {/* ── Waar we staan in het traject ── */}
        {/* Dit blok staat er omdat Maarten op 18-08-2026 zei: "ik ben het spoor
            een beetje kwijt". Terecht. Het verhaal van de verbouwing leefde
            alleen in de chat, en een chat scroll je kwijt. Nu staat het op het
            scherm waar het over gaat, dus hoeft hij er nooit meer naar te vragen. */}
        <div className="card section">
          <h2 className="stijl-h2">Waar we staan</h2>
          <p className="stijl-p">
            Het doel is één samenhangend ontwerp over het hele dashboard, dat je daarna met een
            paar knoppen kunt veranderen. Dat kan pas als alles uit dezelfde bron leest. Vandaar
            deze vier stappen; de eerste drie veranderen niets aan hoe het eruitziet, ze maken
            alleen mogelijk dat de vierde in één keer kan.
          </p>
          <ol className="stijl-stappen">
            {STAPPEN.map((st) => (
              <li key={st.nr} className={`stijl-stap stijl-stap-${st.stand}`}>
                <span className="stijl-stap-nr">{st.nr}</span>
                <span className="stijl-stap-tekst">
                  <span className="stijl-stap-titel">
                    {st.titel}
                    <span className="chip">{st.stand === "af" ? "klaar" : st.stand === "bezig" ? "hier zijn we" : "nog niet"}</span>
                  </span>
                  <span className="stijl-stap-wat">{st.wat}</span>
                  {st.nr === 3 && (
                    <span className="stijl-stap-wat">
                      Nu op {aandeelTekst} van de opmaak. Elk scherm dat om is, is hierboven
                      terug te zien als een lager getal.
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>

        {/* ── Wat er is veranderd, in beeld ── */}
        {/* Erbij gezet op 18-08-2026, na: "ik heb geen beeld van wat er precies
            gebeurt achter de schermen". De meters hieronder tellen wél, maar een
            getal dat van 325 naar 129 gaat laat niet zien hoe iets eruitziet.
            Deze foto wel. Links is de opmaak van 17 augustus, rechts die van nu,
            met exact dezelfde onderdelen ernaast gelegd. */}
        <div className="card section">
          <h2 className="stijl-h2">Wat er is veranderd</h2>
          <p className="stijl-p">
            Dezelfde vijf knoppen, dezelfde kaart, dezelfde tabel: links zoals ze eruitzagen
            vóór de verbouwing, rechts zoals ze er nu uitzien. Het verschil zit vooral in de
            knoppen. Die hadden vier verschillende hoogtes, vier tekstgroottes en drie soorten
            afronding, want er waren vier knopnamen naast elkaar gegroeid. Nu is er één.
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="stijl-voorna" src="/stijl-voor-na.png" alt="De opmaak van 17 augustus naast die van vandaag" />
          <table className="stijl-tabel">
            <thead><tr><th>Wat</th><th>Was</th><th>Is</th></tr></thead>
            <tbody>
              {VERANDERD.map((r) => (
                <tr key={r.wat}>
                  <td>{r.wat}</td>
                  <td className="stijl-tabel-was">{r.was}</td>
                  <td className="stijl-tabel-is">{r.is}</td>
                </tr>
              ))}
              {/* Deze regel komt uit de meting zelf. Hij stond hier tot 19-08-2026
                  als een getypte "0" terwijl er 419 tekens in beeld stonden en er
                  vierentwintig als leeg vierkantje werden getekend. */}
              <tr>
                <td>Icoontjes als letter in beeld</td>
                <td className="stijl-tabel-was">419, waarvan 24 onleesbaar</td>
                <td className="stijl-tabel-is">
                  {meting.icoontekens.totaal}, waarvan {meting.icoontekens.nietTeTekenen} onleesbaar
                </td>
              </tr>
            </tbody>
          </table>
          <p className="stijl-p stijl-p-klein">
            Elk van die getallen wordt bij elke bouw opnieuw geteld en mag alleen dalen; komt er
            een kleur, maat of schaduw bij die niet uit de schaal komt, dan mislukt de bouw en
            komt het niet live.
          </p>
        </div>

        <Speelruimte klant={klant} />

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
                    {/* Een grijze balk betekent: wel gemeten, geen poort. Dat verschil
                        moet zichtbaar zijn, anders lijkt een werklijst een garantie. */}
                    <div
                      className={m.losseWerklijst ? "stijl-balk-vul stijl-balk-stil" : klaar ? "stijl-balk-vul stijl-balk-klaar" : "stijl-balk-vul"}
                      style={{ width: vulling }}
                    />
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

        {/* ── Wat niet op de schaal past ── */}
        <div className="card section">
          <h2 className="stijl-h2">Wat nog niet past, en wat dat kost</h2>
          <p className="stijl-p">
            Alles hierboven kan onzichtbaar: een kleur die al een naam heeft krijgt die naam, en
            er verandert niets. Dit stuk kan dat niet. Een tekst van 13 pixels bestaat niet in de
            schaal, dus die wordt 12,5 of hij blijft 13. Dat is een keuze, geen rekensom, en
            daarom staat hij hier in plaats van dat ik hem voor je maak.{" "}
            <strong>{afrondingen.length} maten</strong> passen niet, samen{" "}
            <strong>{afrondingen.reduce((n, a) => n + a.aantal, 0)} plekken</strong>.
          </p>

          {[
            { kop: "Dit zie je", drempel: 1, wat: "Een verschil van een hele pixel of meer. Kijk hier per regel naar; een afwijkende maat mag blijven, als het een besluit is en geen restje." },
            { kop: "Dit ziet niemand", drempel: 0, wat: "Een halve pixel. Deze kan ik gewoon doen, tenzij je het anders wilt." },
          ].map(({ kop, drempel, wat }) => {
            const groep = afrondingen.filter((a) => (drempel >= 1 ? a.verschil >= 1 : a.verschil < 1));
            if (!groep.length) return null;
            return (
              <div key={kop}>
                <h3 className="stijl-h3">{kop} ({groep.reduce((n, a) => n + a.aantal, 0)} plekken)</h3>
                <p className="stijl-p stijl-p-klein">{wat}</p>
                <div className="stijl-afrond">
                  {groep.map((a) => (
                    <div key={a.soort + a.waarde} className="stijl-afrondregel">
                      <span className="stijl-afrond-soort">{a.soort}</span>
                      <span className="stijl-afrond-proef">
                        <AfrondProef soort={a.soort} maat={a.waarde} />
                        <span className="stijl-afrond-pijl">wordt</span>
                        <AfrondProef soort={a.soort} maat={a.naar} />
                      </span>
                      <code className="stijl-code">{a.waarde} → {a.naar}</code>
                      <span className="stijl-afrond-aantal">{a.aantal}×</span>
                      <span className="stijl-afrond-waar">{a.selectors.slice(0, 3).join(", ") || "\u2014"}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
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

/**
 * Tekent één maat zoals hij eruitziet: een tekstmaat als tekst, een ronding als
 * een hoekje, een ruimte als een balkje. Zonder dit is "13px wordt 12,5px" een
 * getal waar je niets aan hebt; mét dit zie je meteen of het uitmaakt.
 */
function AfrondProef({ soort, maat }: { soort: string; maat: string }) {
  if (soort === "Tekstmaat") return <span className="stijl-afrond-tekst" style={{ fontSize: maat }}>Taken</span>;
  if (soort === "Ronding") return <span className="stijl-afrond-hoek" style={{ borderRadius: maat }} />;
  return <span className="stijl-afrond-balk" style={{ width: maat }} />;
}
