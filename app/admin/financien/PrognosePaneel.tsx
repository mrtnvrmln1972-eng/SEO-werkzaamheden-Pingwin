"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { PrognoseUitkomst, MaandUitkomst, PrognoseRegel, Post, Bijdrage } from "../../../lib/prognose";
import BoekhoudingVullen from "./BoekhoudingVullen";
import Kostenmodel from "./Kostenmodel";
import type { KostenRegel } from "../../../lib/kostenmodel";

// ═══════════════════════════════════════════════════════════
// DE PROGNOSE OP HET SCHERM
// ═══════════════════════════════════════════════════════════
// Drie vragen, in deze volgorde, want zo kijkt Maarten ernaar:
//
//   1. Waar sta ik nu en hoe ver is het doel? (de vier kaarten bovenaan)
//   2. Hoe loopt dat door de maanden heen? (de maandlijst, klik een maand open
//      en je ziet precies uit welke klanten en leads het resultaat bestaat)
//   3. Wat moet ik bijstellen? (de regels: bedrag, kans, vanaf wanneer)
//
// Alles wat je hier wijzigt gaat meteen naar de server en de hele prognose komt
// herrekend terug. Geen opslaan-knop, geen scherm dat stiekem uit de pas loopt
// met de database.
// ═══════════════════════════════════════════════════════════

function euro(n: number): string {
  const afgerond = Math.round(n);
  return (afgerond < 0 ? "− € " : "€ ") + Math.abs(afgerond).toLocaleString("nl-NL");
}

// Hoe warm is een lead. Bewust drie banden in plaats van een kaal percentage:
// "heet" leest sneller dan "80%", en het cijfer staat er toch naast.
function temperatuur(kans: number): { klasse: string; label: string } {
  if (kans >= 70) return { klasse: "heet", label: "heet" };
  if (kans >= 40) return { klasse: "warm", label: "warm" };
  return { klasse: "koel", label: "koel" };
}

// De prognose komt binnen mét het kostenmodel erbij; het scherm toont dat als
// een eigen paneel, want het is de plek waar de kostenkant vandaan komt.
export type PrognoseData = PrognoseUitkomst & { kostenregels?: KostenRegel[]; kostenMeldingen?: string[] };

type Props = { begin: PrognoseData };

export default function PrognosePaneel({ begin }: Props) {
  const [data, setData] = useState<PrognoseData>(begin);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [openMaand, setOpenMaand] = useState<string | null>(null);

  // Eén weg naar de server: sturen, en de herrekende prognose terugzetten. Zo
  // kan het scherm nooit iets anders tonen dan wat de server heeft gerekend.
  async function stuur(init: RequestInit, url = "/api/admin/prognose") {
    setBezig(true); setFout("");
    try {
      const r = await fetch(url, { headers: { "Content-Type": "application/json" }, ...init });
      const d = await r.json();
      if (!r.ok || !d.ok) { setFout(d.error || "Opslaan mislukt."); return false; }
      setData(d as PrognoseData);
      return true;
    } catch {
      setFout("De server is niet bereikbaar.");
      return false;
    } finally { setBezig(false); }
  }

  const { instelling, maanden, regels, posten, doelMaand, tekortNu, gemiddeldPerKlant } = data;
  const nu = maanden[0];
  const doelWoord = instelling.targetOp === "omzet" ? "omzet" : "netto";
  const klantenTekort = gemiddeldPerKlant > 0 ? Math.ceil(tekortNu / gemiddeldPerKlant) : 0;

  return (
    <>
      <PrognoseKaarten
        nu={nu}
        target={instelling.target}
        doelWoord={doelWoord}
        doelMaand={doelMaand}
        maanden={maanden}
        tekortNu={tekortNu}
        klantenTekort={klantenTekort}
        gemiddeldPerKlant={gemiddeldPerKlant}
      />

      {fout && <div className="login-error">{fout}</div>}

      <Maandlijst
        maanden={maanden}
        target={instelling.target}
        doelWoord={doelWoord}
        open={openMaand}
        zetOpen={setOpenMaand}
      />

      <Kostenmodel
        regels={data.kostenregels || []}
        meldingen={data.kostenMeldingen || []}
        herlaad={(d) => setData(d as PrognoseData)}
      />

      <BoekhoudingVullen herlaad={(d) => setData(d as PrognoseData)} />

      <Regels regels={regels} bezig={bezig} stuur={stuur} />

      <Posten posten={posten} bezig={bezig} stuur={stuur} />

      <Instellingen instelling={instelling} bezig={bezig} stuur={stuur} />
    </>
  );
}

// ── 1. De vier kaarten: waar sta ik, waar wil ik heen ───────

function PrognoseKaarten({ nu, target, doelWoord, doelMaand, maanden, tekortNu, klantenTekort, gemiddeldPerKlant }: {
  nu?: MaandUitkomst; target: number; doelWoord: string; doelMaand: string | null;
  maanden: MaandUitkomst[]; tekortNu: number; klantenTekort: number; gemiddeldPerKlant: number;
}) {
  const doelRij = doelMaand ? maanden.find((m) => m.maand === doelMaand) : null;
  const laatste = maanden[maanden.length - 1];
  return (
    <div className="prog-kaarten">
      <div className="prog-kaart">
        <div className="prog-kaart-label">Deze maand ({doelWoord})</div>
        <div className={"prog-kaart-cijfer " + (nu && nu.haaltDoel ? "goed" : "")}>{euro(nu?.opDoel ?? 0)}</div>
        <div className="prog-kaart-onder">
          {nu ? `${euro(nu.omzet)} binnen, ${euro(nu.kosten)} eruit` : "nog niets berekend"}
        </div>
      </div>

      <div className="prog-kaart">
        <div className="prog-kaart-label">Het doel per maand</div>
        <div className="prog-kaart-cijfer accent">{euro(target)}</div>
        <div className="prog-kaart-onder">gemeten op {doelWoord === "omzet" ? "de omzet" : "wat er netto overblijft"}</div>
      </div>

      <div className="prog-kaart">
        <div className="prog-kaart-label">Nog te gaan</div>
        <div className={"prog-kaart-cijfer " + (tekortNu === 0 ? "goed" : "slecht")}>{euro(tekortNu)}</div>
        <div className="prog-kaart-onder">
          {tekortNu === 0
            ? "je zit deze maand al op het doel"
            : klantenTekort > 0
              ? `ongeveer ${klantenTekort} klant${klantenTekort === 1 ? "" : "en"} erbij, van ${euro(gemiddeldPerKlant)} netto per maand`
              : "vul bij een klant een maandbedrag in om dit in klanten uit te drukken"}
        </div>
      </div>

      <div className="prog-kaart">
        <div className="prog-kaart-label">Doel gehaald in</div>
        <div className={"prog-kaart-cijfer " + (doelRij ? "goed" : "slecht")}>{doelRij ? doelRij.label : "nog niet"}</div>
        <div className="prog-kaart-onder">
          {doelRij
            ? `daar staat de teller op ${euro(doelRij.opDoel)}`
            : laatste
              ? `in ${laatste.label} sta je op ${euro(laatste.opDoel)}, dat is nog niet genoeg`
              : ""}
        </div>
      </div>
    </div>
  );
}

// ── 2. De maandlijst, met de opbouw per maand eronder ───────

function Maandlijst({ maanden, target, doelWoord, open, zetOpen }: {
  maanden: MaandUitkomst[]; target: number; doelWoord: string;
  open: string | null; zetOpen: (m: string | null) => void;
}) {
  return (
    <div className="card">
      <div className="prog-kop">
        <div className="prog-kop-titel">Maand voor maand</div>
        <div className="prog-kop-uitleg">
          Klik een maand open om te zien waar het resultaat uit is opgebouwd. De balk laat zien hoe
          ver die maand van het doel af staat; het donkere deel is wat er nu al zeker binnenkomt.
        </div>
      </div>

      <div className="prog-maand-kop">
        <span />
        <span>maand</span>
        <span>richting {euro(target)} {doelWoord}</span>
        <span>omzet</span>
        <span className="verberg-klein">kosten</span>
        <span>netto</span>
      </div>

      <div className="prog-maanden">
        {maanden.map((m, i) => {
          const isOpen = open === m.maand;
          const deel = target > 0 ? Math.min(100, Math.max(0, (m.opDoel / target) * 100)) : 0;
          const zekerDeel = target > 0
            ? Math.min(deel, Math.max(0, ((m.zekerOmzet - m.zekerKosten - m.vasteLasten) / target) * 100))
            : 0;
          return (
            <div key={m.maand}>
              <button
                type="button"
                className={"prog-maand" + (i === 0 ? " nu" : "")}
                onClick={() => zetOpen(isOpen ? null : m.maand)}
                aria-expanded={isOpen}
              >
                <span className="prog-maand-pijl">{isOpen ? "▾" : "▸"}</span>
                <span className="prog-maand-naam">{m.label}</span>
                <span className="prog-balk" title={`${Math.round(deel)}% van het doel`}>
                  <span className={"prog-balk-vul" + (m.haaltDoel ? " gehaald" : "")} style={{ width: `${deel}%` }} />
                  <span className="prog-balk-vul zeker" style={{ width: `${Math.max(0, zekerDeel)}%` }} />
                </span>
                <span className="prog-maand-bedrag">{euro(m.omzet)}</span>
                <span className="prog-maand-bedrag verberg-klein">{euro(m.kosten)}</span>
                <span className={"prog-maand-bedrag netto " + (m.netto >= 0 ? "goed" : "slecht")}>{euro(m.netto)}</span>
              </button>
              {isOpen && <MaandOpbouw maand={m} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MaandOpbouw({ maand }: { maand: MaandUitkomst }) {
  const klanten = maand.bijdragen.filter((b) => b.soort === "klant");
  const leads = maand.bijdragen.filter((b) => b.soort === "lead");
  const losse = maand.bijdragen.filter((b) => b.soort === "post");
  return (
    <div className="prog-opbouw">
      <div className="prog-post">
        <span className="prog-post-naam"><strong>Waar komt {maand.label} vandaan</strong></span>
        <span className="prog-post-bedrag">kans</span>
        <span className="prog-post-bedrag">omzet</span>
        <span className="prog-post-bedrag verberg-klein">kosten</span>
        <span className="prog-post-bedrag">netto</span>
      </div>

      <OpbouwGroep titel="Lopende klanten" regels={klanten} />
      <OpbouwGroep titel="Leads, naar kans gerekend" regels={leads} />
      <OpbouwGroep titel="Losse posten" regels={losse} />

      {(maand.modelVast || []).filter((v) => v.bedrag > 0).length > 0 && (
        <div className="prog-opbouw-titel">Kosten die niet aan een klant hangen</div>
      )}
      {(maand.modelVast || []).filter((v) => v.bedrag > 0).map((v) => (
        <div className="prog-post" key={v.naam}>
          <span className="prog-post-naam">{v.naam}</span>
          <span className="prog-post-bedrag" />
          <span className="prog-post-bedrag" />
          <span className="prog-post-bedrag slecht verberg-klein">{euro(v.bedrag)}</span>
          <span className="prog-post-bedrag slecht">{euro(-v.bedrag)}</span>
        </div>
      ))}

      {maand.vasteLasten > 0 && (
        <div className="prog-post">
          <span className="prog-post-naam">Eigen vaste lasten</span>
          <span className="prog-post-bedrag" />
          <span className="prog-post-bedrag" />
          <span className="prog-post-bedrag slecht verberg-klein">{euro(maand.vasteLasten)}</span>
          <span className="prog-post-bedrag slecht">{euro(-maand.vasteLasten)}</span>
        </div>
      )}

      <div className="prog-post prog-post-totaal">
        <span className="prog-post-naam">Samen in {maand.label}</span>
        <span className="prog-post-bedrag" />
        <span className="prog-post-bedrag">{euro(maand.omzet)}</span>
        <span className="prog-post-bedrag verberg-klein">{euro(maand.kosten)}</span>
        <span className={"prog-post-bedrag " + (maand.netto >= 0 ? "goed" : "slecht")}>{euro(maand.netto)}</span>
      </div>
    </div>
  );
}

function OpbouwGroep({ titel, regels }: { titel: string; regels: Bijdrage[] }) {
  if (regels.length === 0) return null;
  return (
    <>
      <div className="prog-opbouw-titel">{titel}</div>
      {regels.map((b) => {
        const temp = temperatuur(b.kans);
        return (
          <div className="prog-post" key={b.slug}>
            <span className="prog-post-naam">
              {b.soort === "post"
                ? <span className="prog-chip post">los</span>
                : b.soort === "klant"
                  ? <span className="prog-chip klant">klant</span>
                  : <span className={"prog-chip " + temp.klasse}>{temp.label}</span>}
              {b.soort === "post"
                ? <span>{b.naam}</span>
                : <Link href={`/admin/client/${b.slug}`}>{b.naam}</Link>}
            </span>
            <span className="prog-post-bedrag">{b.soort === "klant" ? "zeker" : `${b.kans}%`}</span>
            <span className="prog-post-bedrag">{b.omzet > 0 ? euro(b.omzet) : ""}</span>
            <span className="prog-post-bedrag slecht verberg-klein">{b.kosten > 0 ? euro(b.kosten) : ""}</span>
            <span className={"prog-post-bedrag " + (b.netto >= 0 ? "goed" : "slecht")}>{euro(b.netto)}</span>
          </div>
        );
      })}
    </>
  );
}

// ── 3. De regels bijstellen: bedrag, kans, vanaf wanneer ────

type Stuur = (init: RequestInit, url?: string) => Promise<boolean>;

function Regels({ regels, bezig, stuur }: { regels: PrognoseRegel[]; bezig: boolean; stuur: Stuur }) {
  const klanten = regels.filter((r) => r.fase === "klant");
  const leads = regels.filter((r) => r.fase === "lead");
  return (
    <div className="card">
      <div className="prog-kop">
        <div className="prog-kop-titel">Klanten en leads</div>
        <div className="prog-kop-uitleg">
          Het maandbedrag en de linkbuilding zijn dezelfde cijfers als in de cockpit van die klant;
          wijzig je ze hier, dan wijzigen ze daar mee. De kans geldt alleen voor leads: 80 betekent
          dat de lead voor tachtig procent van zijn bedrag meetelt in de prognose.
        </div>
      </div>

      <div className="prog-regel-kop">
        <span>naam</span>
        <span>vanaf</span>
        <span>kans</span>
        <span>per maand</span>
        <span className="verberg-klein">linkbuilding</span>
        <span className="verberg-klein">overige kosten</span>
      </div>

      <div className="prog-regels">
        {klanten.map((r) => <RegelRij key={r.slug} regel={r} bezig={bezig} stuur={stuur} />)}
        {leads.length > 0 && <div className="prog-opbouw-titel">Leads</div>}
        {leads.map((r) => <RegelRij key={r.slug} regel={r} bezig={bezig} stuur={stuur} />)}
        {regels.length === 0 && (
          <div className="prog-kop-uitleg">
            Er staan nog geen klanten of leads in het dashboard. Maak er een aan op het klantenoverzicht,
            dan verschijnt hij hier vanzelf.
          </div>
        )}
      </div>
    </div>
  );
}

function RegelRij({ regel, bezig, stuur }: { regel: PrognoseRegel; bezig: boolean; stuur: Stuur }) {
  // De velden staan lokaal terwijl je typt en gaan pas weg bij verlaten van het
  // veld. Bij elke toetsaanslag opslaan zou de hele prognose per letter
  // herrekenen, en dan springt het scherm onder je handen weg.
  const [v, zetV] = useState({
    kans: String(regel.kans),
    start: regel.startMaand || "",
    bedrag: String(Math.round(regel.bedrag)),
    linkbuilding: String(Math.round(regel.linkbuilding)),
    extra: String(Math.round(regel.extraKosten)),
  });
  useEffect(() => {
    zetV({
      kans: String(regel.kans),
      start: regel.startMaand || "",
      bedrag: String(Math.round(regel.bedrag)),
      linkbuilding: String(Math.round(regel.linkbuilding)),
      extra: String(Math.round(regel.extraKosten)),
    });
  }, [regel.kans, regel.startMaand, regel.bedrag, regel.linkbuilding, regel.extraKosten]);

  const isLead = regel.fase === "lead";
  const temp = temperatuur(regel.kans);
  const getal = (s: string) => { const n = Number(String(s).replace(/[^\d,.-]/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };

  function bewaar(velden: Record<string, unknown>) {
    return stuur({ method: "PATCH", body: JSON.stringify({ regel: { slug: regel.slug, ...velden } }) });
  }

  return (
    <div className="prog-regel">
      <span className="prog-regel-naam">
        {isLead
          ? <span className={"prog-chip " + temp.klasse}>{temp.label}</span>
          : <span className="prog-chip klant">klant</span>}
        <Link href={`/admin/client/${regel.slug}`}>{regel.naam}</Link>
        {regel.gat && <span className="prog-gat">{regel.gat}</span>}
      </span>

      <input
        className="prog-veld"
        type="month"
        value={v.start}
        disabled={bezig}
        aria-label={`Vanaf welke maand telt ${regel.naam} mee`}
        onChange={(e) => zetV({ ...v, start: e.target.value })}
        onBlur={() => { if ((regel.startMaand || "") !== v.start) bewaar({ startMaand: v.start || null }); }}
      />

      {isLead ? (
        <input
          className="prog-veld"
          inputMode="numeric"
          value={v.kans}
          disabled={bezig}
          aria-label={`Kans dat ${regel.naam} doorgaat, in procenten`}
          onChange={(e) => zetV({ ...v, kans: e.target.value })}
          onBlur={() => { const n = getal(v.kans); if (n !== regel.kans) bewaar({ kans: n }); }}
        />
      ) : (
        <input className="prog-veld vast" value="zeker" readOnly tabIndex={-1} aria-label="Loopt al" />
      )}

      <input
        className="prog-veld"
        inputMode="numeric"
        value={v.bedrag}
        disabled={bezig}
        aria-label={`Maandbedrag van ${regel.naam}`}
        onChange={(e) => zetV({ ...v, bedrag: e.target.value })}
        onBlur={() => { const n = getal(v.bedrag); if (n !== regel.bedrag) bewaar({ bedrag: n }); }}
      />

      <input
        className="prog-veld verberg-klein"
        inputMode="numeric"
        value={v.linkbuilding}
        disabled={bezig}
        aria-label={`Linkbuildingkosten van ${regel.naam} per maand`}
        onChange={(e) => zetV({ ...v, linkbuilding: e.target.value })}
        onBlur={() => { const n = getal(v.linkbuilding); if (n !== regel.linkbuilding) bewaar({ linkbuilding: n }); }}
      />

      <input
        className="prog-veld verberg-klein"
        inputMode="numeric"
        value={v.extra}
        disabled={bezig}
        aria-label={`Overige maandkosten van ${regel.naam}`}
        onChange={(e) => zetV({ ...v, extra: e.target.value })}
        onBlur={() => { const n = getal(v.extra); if (n !== regel.extraKosten) bewaar({ extraKosten: n }); }}
      />
    </div>
  );
}

// ── 4. Losse posten die niet aan een klant hangen ───────────

function Posten({ posten, bezig, stuur }: { posten: Post[]; bezig: boolean; stuur: Stuur }) {
  const [open, zetOpen] = useState(false);
  const [nieuw, zetNieuw] = useState({ naam: "", soort: "omzet", maand: "", bedrag: "", kans: "100", herhaalt: false });

  async function voegToe() {
    if (!nieuw.naam.trim()) return;
    const gelukt = await stuur({
      method: "POST",
      body: JSON.stringify({
        post: {
          naam: nieuw.naam,
          soort: nieuw.soort,
          maand: nieuw.maand,
          bedrag: Number(nieuw.bedrag.replace(",", ".")) || 0,
          kans: Number(nieuw.kans) || 100,
          herhaalt: nieuw.herhaalt,
        },
      }),
    });
    if (gelukt) zetNieuw({ naam: "", soort: "omzet", maand: "", bedrag: "", kans: "100", herhaalt: false });
  }

  return (
    <div className="card">
      <div className="prog-kop">
        <div className="prog-kop-titel">Losse posten</div>
        <div className="prog-kop-uitleg">
          Alles wat niet aan een vaste klant hangt: een website die in oktober wordt opgeleverd, een
          tool die vanaf januari geld kost. Eenmalig telt hij in die ene maand mee, terugkerend vanaf
          die maand elke maand.
        </div>
        <div className="prog-kop-acties">
          <button type="button" className="btn btn-ghost btn-klein" onClick={() => zetOpen(!open)}>
            {open ? "Sluiten" : "Post toevoegen"}
          </button>
        </div>
      </div>

      {open && (
        <div className="prog-instel">
          <div className="prog-instel-veld">
            <label htmlFor="post-naam">Waar gaat het over</label>
            <input id="post-naam" value={nieuw.naam} disabled={bezig} onChange={(e) => zetNieuw({ ...nieuw, naam: e.target.value })} placeholder="Website Tudor Kozijnen" />
          </div>
          <div className="prog-instel-veld">
            <label htmlFor="post-soort">Soort</label>
            <select id="post-soort" value={nieuw.soort} disabled={bezig} onChange={(e) => zetNieuw({ ...nieuw, soort: e.target.value })}>
              <option value="omzet">Opbrengst</option>
              <option value="kosten">Kosten</option>
            </select>
          </div>
          <div className="prog-instel-veld">
            <label htmlFor="post-maand">In welke maand</label>
            <input id="post-maand" type="month" value={nieuw.maand} disabled={bezig} onChange={(e) => zetNieuw({ ...nieuw, maand: e.target.value })} />
          </div>
          <div className="prog-instel-veld">
            <label htmlFor="post-bedrag">Bedrag</label>
            <input id="post-bedrag" inputMode="numeric" value={nieuw.bedrag} disabled={bezig} onChange={(e) => zetNieuw({ ...nieuw, bedrag: e.target.value })} placeholder="2500" />
          </div>
          <div className="prog-instel-veld">
            <label htmlFor="post-kans">Kans in %</label>
            <input id="post-kans" inputMode="numeric" value={nieuw.kans} disabled={bezig} onChange={(e) => zetNieuw({ ...nieuw, kans: e.target.value })} />
          </div>
          <div className="prog-instel-veld">
            <label htmlFor="post-herhaalt">Elke maand</label>
            <select id="post-herhaalt" value={nieuw.herhaalt ? "ja" : "nee"} disabled={bezig} onChange={(e) => zetNieuw({ ...nieuw, herhaalt: e.target.value === "ja" })}>
              <option value="nee">Eenmalig</option>
              <option value="ja">Elke maand vanaf dan</option>
            </select>
          </div>
          <button type="button" className="btn btn-primary btn-klein" onClick={voegToe} disabled={bezig || !nieuw.naam.trim()}>
            Toevoegen
          </button>
        </div>
      )}

      {posten.length === 0 ? (
        <div className="prog-kop-uitleg">Nog geen losse posten. De prognose rekent nu alleen met klanten en leads.</div>
      ) : (
        <div className="prog-regels">
          {posten.map((p) => (
            <div className="prog-post" key={p.id}>
              <span className="prog-post-naam">
                <span className="prog-chip post">{p.soort === "omzet" ? "opbrengst" : "kosten"}</span>
                <span>{p.naam}</span>
              </span>
              <span className="prog-post-bedrag">{p.kans}%</span>
              <span className="prog-post-bedrag">{p.maand}{p.herhaalt ? " en verder" : ""}</span>
              <span className={"prog-post-bedrag verberg-klein " + (p.soort === "omzet" ? "goed" : "slecht")}>{euro(p.bedrag)}</span>
              <span className="prog-post-bedrag">
                <button
                  type="button"
                  className="btn btn-danger btn-klein"
                  disabled={bezig}
                  onClick={() => stuur({ method: "DELETE" }, `/api/admin/prognose?post=${p.id}`)}
                >
                  Weg
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── 5. Instellingen: het doel en de vaste lasten ────────────

function Instellingen({ instelling, bezig, stuur }: {
  instelling: { target: number; targetOp: "netto" | "omzet"; vasteLasten: number; horizon: number };
  bezig: boolean; stuur: Stuur;
}) {
  const [v, zetV] = useState({
    target: String(instelling.target),
    targetOp: instelling.targetOp,
    vasteLasten: String(instelling.vasteLasten),
    horizon: String(instelling.horizon),
  });
  useEffect(() => {
    zetV({
      target: String(instelling.target),
      targetOp: instelling.targetOp,
      vasteLasten: String(instelling.vasteLasten),
      horizon: String(instelling.horizon),
    });
  }, [instelling.target, instelling.targetOp, instelling.vasteLasten, instelling.horizon]);

  const getal = (s: string) => { const n = Number(String(s).replace(/[^\d,.-]/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
  const bewaar = (velden: Record<string, unknown>) => stuur({ method: "PATCH", body: JSON.stringify({ instelling: velden }) });

  return (
    <div className="card">
      <div className="prog-kop">
        <div className="prog-kop-titel">Het doel en de vaste lasten</div>
        <div className="prog-kop-uitleg">
          De vaste lasten zijn je eigen kosten die niet aan een klant hangen (kantoor, tools,
          verzekeringen). Laat ze vullen vanuit de boekhouding en je hoeft niet te schatten: dat is
          het gemiddelde van de laatste drie afgesloten maanden uit Moneybird.
        </div>
      </div>

      <div className="prog-instel">
        <div className="prog-instel-veld">
          <label htmlFor="instel-target">Doel per maand</label>
          <input
            id="instel-target" inputMode="numeric" value={v.target} disabled={bezig}
            onChange={(e) => zetV({ ...v, target: e.target.value })}
            onBlur={() => { const n = getal(v.target); if (n !== instelling.target) bewaar({ target: n }); }}
          />
        </div>

        <div className="prog-instel-veld">
          <label htmlFor="instel-op">Gemeten op</label>
          <select
            id="instel-op" value={v.targetOp} disabled={bezig}
            onChange={(e) => { const w = e.target.value === "omzet" ? "omzet" : "netto"; zetV({ ...v, targetOp: w }); bewaar({ targetOp: w }); }}
          >
            <option value="netto">Wat er netto overblijft</option>
            <option value="omzet">De omzet</option>
          </select>
        </div>

        <div className="prog-instel-veld">
          <label htmlFor="instel-lasten">Eigen vaste lasten per maand</label>
          <input
            id="instel-lasten" inputMode="numeric" value={v.vasteLasten} disabled={bezig}
            onChange={(e) => zetV({ ...v, vasteLasten: e.target.value })}
            onBlur={() => { const n = getal(v.vasteLasten); if (n !== instelling.vasteLasten) bewaar({ vasteLasten: n }); }}
          />
        </div>

        <div className="prog-instel-veld">
          <label htmlFor="instel-horizon">Hoeveel maanden vooruit</label>
          <input
            id="instel-horizon" inputMode="numeric" value={v.horizon} disabled={bezig}
            onChange={(e) => zetV({ ...v, horizon: e.target.value })}
            onBlur={() => { const n = getal(v.horizon); if (n !== instelling.horizon) bewaar({ horizon: n }); }}
          />
        </div>

        <button
          type="button"
          className="btn btn-ghost btn-klein"
          disabled={bezig}
          onClick={() => stuur({ method: "POST", body: JSON.stringify({ actie: "vaste-lasten-uit-boekhouding" }) })}
        >
          Vullen uit de boekhouding
        </button>
      </div>
    </div>
  );
}
