// ═══════════════════════════════════════════════════════════
// DE DRIE METERS NAAST ELKAAR, MET DE TIPS ERONDER
// ═══════════════════════════════════════════════════════════
// Er lopen drie rekeningen door elkaar heen en ze heten alle drie ongeveer
// hetzelfde ("Claude", "credits", "tegoed"). Dat is precies waarom een oplopend
// bedrag geen betekenis had: je weet niet welke van de drie je ziet, waar hij
// vandaan komt, en of jij er iets aan kunt doen.
//
// Dus staan ze hier naast elkaar, elk met twee regels: wat het is, en waar het
// vandaan komt. Daaronder de tips, per meter, want een tip die niet bij een
// bepaalde rekening hoort is een algemeenheid en daar wordt niemand zuiniger van.
//
// Twee bewuste keuzes:
//  - De derde meter (het eigen Claude-abonnement) heeft geen cijfer. Dat saldo is
//    op een persoonlijk abonnement niet op te halen. Liever een lege plek met een
//    reden en een knop ernaartoe dan een getal dat het niet is.
//  - De tips staan in de code van dit scherm en niet in een document ernaast,
//    zodat ze meegroeien met wat er echt in het dashboard zit.
// ═══════════════════════════════════════════════════════════

import type { TellerStand } from "../../../lib/ahrefs-teller";
import { usd, type ClaudeStand } from "../../../lib/claude-teller";
import { SEIN_KLEUR } from "../../../lib/sein";

function num(n: number): string {
  return n.toLocaleString("nl-NL");
}

type Tip = { kop: string; tekst: string };

const TIPS: { meter: string; tips: Tip[] }[] = [
  {
    meter: "Ahrefs",
    tips: [
      { kop: "Dezelfde vraag kost één keer", tekst: "Zoekvolumes en top-10's worden bewaard (een maand, een kwartaal). Een analyse opnieuw openen kost dus niets; een nieuwe scan starten wel." },
      { kop: "Nieuwe klanten in golven", tekst: "Een hele site in één keer inlezen is de duurste knop die er is. De bulk-onboarding doet het daarom in golven; laat die volgorde staan." },
      { kop: "Kijk wie de teller laat lopen", tekst: "Werk je zelf in Ahrefs, dan telt dat op dezelfde meter. Staat het dashboard laag en de meter hoog, dan helpt afremmen hier niets." },
    ],
  },
  {
    meter: "Claude via het dashboard",
    tips: [
      { kop: "Diepe documenten doseren", tekst: "Een diepe analyse of blauwdruk is tien tot twintig keer een gewone vraag. Prima voor een pagina die ertoe doet, zonde voor een verkenning." },
      { kop: "Licht werk gaat al naar een licht model", tekst: "Labels, korte extracties en losse correcties draaien op het goedkope model. Ga daar niet omheen door alles via de chat te vragen." },
      { kop: "Eén onderwerp per gesprek", tekst: "Een gesprek draagt zijn hele geschiedenis mee bij elke vraag. Een nieuwe chat voor een nieuw onderwerp is goedkoper dan doorgaan in een lange." },
    ],
  },
  {
    meter: "Je Claude-abonnement",
    tips: [
      { kop: "Kijk eerst wélke meter vol is", tekst: "In Claude Code toont /usage twee dingen: je plan-limiet (per vijf uur en per week) en je tegoed. Staat de weeklimiet op 100%, dan betaal je álles tot de reset uit je tegoed, ook werk dat gisteren gratis was. Dat verklaart een bedrag dat plots hard oploopt zonder dat je meer doet." },
      { kop: "Kies het model naar de klus", tekst: "Het zwaarste model kost een veelvoud van het middelste. Voor bouwen, opmaken, teksten en lijstjes is dat middelste model genoeg; het zware is voor strategie en beoordelen. Dit is de grootste knop die er is, groter dan alle andere tips bij elkaar." },
      { kop: "Nieuwe klus, nieuwe chat", tekst: "Zodra je op tegoed werkt, wordt het geheugen van een gesprek na vijf minuten stilte niet meer goedkoop hergebruikt (op je abonnement is dat een uur). Elke vraag daarna betaalt de hele geschiedenis opnieuw. Een verse chat met drie regels startprompt begint bij bijna nul." },
      { kop: "Niet zes chats tegelijk laten sudderen", tekst: "Elke lopende chat draagt zijn eigen geschiedenis mee. Werk je in zes chats door elkaar, dan betaal je zes keer een geschiedenis in plaats van één. Rond af wat af is." },
      { kop: "Zet een uitgavenlimiet", tekst: "Op claude.ai kun je een grens per maand zetten op het tegoed. Dan kan het niet meer stilletjes doorlopen; je krijgt een melding in plaats van een verrassing." },
      { kop: "Vraag gericht", tekst: "\"Kijk de hele site na\" laat alles lezen. \"Kijk deze pagina na op deze drie punten\" kost een fractie en geeft een beter antwoord." },
    ],
  },
];

export default function Meters({ ahrefs, claude, ahrefsEigenMaand }: {
  ahrefs: TellerStand;
  claude: ClaudeStand;
  /** Units die dit dashboard zelf verbruikte deze abonnementsmaand. */
  ahrefsEigenMaand: number | null;
}) {
  const ahrefsPct = ahrefs.deel === null ? null : Math.round(ahrefs.deel * 100);

  return (
    <div className="vm">
      <p className="vm-intro">
        Er lopen drie rekeningen door elkaar en ze heten alle drie ongeveer hetzelfde. Hieronder staan ze
        naast elkaar: wat het is, waar het vandaan komt, en hoe het ervoor staat.
      </p>

      <div className="vm-rij">
        {/* 1. Ahrefs: een tegoed dat op kan raken. */}
        <div className="vm-kaart">
          <div className="vm-kop">
            <span className="vm-stip" style={{ background: SEIN_KLEUR[ahrefs.sein] }} aria-hidden="true" />
            Ahrefs
          </div>
          <div className="vm-groot" style={{ color: SEIN_KLEUR[ahrefs.sein] }}>
            {ahrefs.used === null ? "geen cijfer" : ahrefsPct !== null ? `${ahrefsPct}%` : num(ahrefs.used)}
            {ahrefs.limit !== null && <span className="vm-bij">van {num(ahrefs.limit)} units op</span>}
          </div>
          <div className="vm-wat"><strong>Wat het is:</strong> de zoekwoord- en concurrentiedata. Een tegoed aan units dat elke maand op nul gaat; raakt het op, dan valt de data stil.</div>
          <div className="vm-wat"><strong>Waar het vandaan komt:</strong> je Ahrefs-abonnement, het hele account. Werk je zelf in Ahrefs, dan telt dat op dezelfde meter mee.</div>
          {ahrefsEigenMaand !== null && (
            <div className="vm-regel"><span>Waarvan via dit dashboard</span><span>{num(ahrefsEigenMaand)} units</span></div>
          )}
          <div className="vm-regel"><span>Betaal je</span><span>vast per maand</span></div>
        </div>

        {/* 2. Claude via de sleutel van het dashboard: een rekening die doorloopt. */}
        <div className="vm-kaart">
          <div className="vm-kop">
            <span className="vm-stip" style={{ background: SEIN_KLEUR[claude.sein] }} aria-hidden="true" />
            Claude via het dashboard
          </div>
          <div className="vm-groot" style={{ color: SEIN_KLEUR[claude.sein] }}>
            {usd(claude.maandUsd)}
            <span className="vm-bij">deze maand</span>
          </div>
          <div className="vm-wat"><strong>Wat het is:</strong> al het denkwerk dat het dashboard zelf doet: analyses, documenten, de chats in de cockpit, de nachtelijke motoren.</div>
          <div className="vm-wat"><strong>Waar het vandaan komt:</strong> een eigen sleutel bij Anthropic, met een eigen rekening. Dit staat los van je Claude-abonnement.</div>
          {claude.vorigeMaandUsd !== null && (
            <div className="vm-regel"><span>Vorige maand</span><span>{usd(claude.vorigeMaandUsd)}</span></div>
          )}
          {claude.prognose !== null && (
            <div className="vm-regel"><span>Op dit tempo</span><span>{usd(claude.prognose)}</span></div>
          )}
          <div className="vm-regel"><span>Betaal je</span><span>per gebruik, achteraf</span></div>
        </div>

        {/* 3. Het eigen abonnement: de meter die we niet kunnen lezen. */}
        <div className="vm-kaart vm-kaart-abo">
          <div className="vm-kop">
            <span className="vm-stip vm-stip-leeg" aria-hidden="true" />
            Je Claude-abonnement
          </div>
          <div className="vm-groot vm-groot-leeg">niet op te halen</div>
          <div className="vm-wat"><strong>Wat het is:</strong> jouw eigen gesprekken: chatten op claude.ai en het bouwen in Claude Code. Dit is het potje waar die honderd euro in zit.</div>
          <div className="vm-wat"><strong>Waar het vandaan komt:</strong> je abonnement. Is de limiet daarvan op, dan werkt Claude door op <strong>usage credits</strong>: tegoed dat je vooruit koopt en dat per gebruik leegloopt tegen de normale tarieven.</div>
          <div className="vm-regel"><span>Betaal je</span><span>vooruit, van je tegoed af</span></div>
          <div className="vm-knoppen">
            <a className="btn vm-btn" href="https://claude.ai/settings/usage" target="_blank" rel="noreferrer">Bekijk je tegoed</a>
            <a className="btn vm-btn" href="https://claude.ai/settings/billing" target="_blank" rel="noreferrer">Bijvullen instellen</a>
          </div>
          <div className="vm-voet">Er is voor een persoonlijk abonnement geen koppeling om dit saldo op te halen; daarom een knop in plaats van een cijfer.</div>
        </div>
      </div>

      {/* De tips. Per meter, want een tip zonder rekening eronder is een algemeenheid. */}
      <div className="vm-tips">
        <div className="vm-tips-kop">Zo houd je het strak</div>
        <div className="vm-rij">
          {TIPS.map((groep) => (
            <div className="vm-kaart vm-kaart-tips" key={groep.meter}>
              <div className="vm-kop">{groep.meter}</div>
              <ul className="vm-tip-lijst">
                {groep.tips.map((t) => (
                  <li className="vm-tip" key={t.kop}>
                    <span className="vm-tip-kop">{t.kop}</span>
                    <span className="vm-tip-tekst">{t.tekst}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
