"use client";

import { useCallback, useEffect, useState } from "react";
import RijkTekstVeld from "../../../_velden/RijkTekstVeld";
import HelpHint from "./HelpHint";
import { Omlaag, Uitklap } from "../../../_ui/Pijl";
import { netteHtml } from "../../../../lib/nette-html";
import { CATEGORIEEN, CATEGORIE_LABEL, bronLabel, type Categorie } from "../../../../lib/klant-correcties";

// ═══════════════════════════════════════════════════════════
// WAT DE KLANT ZELF ZEGT
// ═══════════════════════════════════════════════════════════
// Eén plakvak per klant. Je plakt een mail (of een appje, of een aantekening uit
// een gesprek), drukt op Verwerken, en het dashboard maakt er korte regels van in
// drie bakjes. Die regels gaan daarna automatisch mee in élke opdracht aan de AI,
// bovenaan, met de mededeling dat ze vóór de site-analyse gaan.
//
// Waarom dit blok bóven het klantprofiel staat: het is de enige laag die van
// Maarten en zijn klant is. De twee blokken eronder worden bij elke druk op de
// knop opnieuw uit de live site afgeleid. Dit niet, en dat is precies het punt.
// ═══════════════════════════════════════════════════════════

type Regel = {
  id: number;
  correctieId: number | null;
  categorie: Categorie;
  regel: string;
  bron: string;
  datum: string | null;
  vervallenDoor: number | null;
};
type Correctie = { id: number; bron: string; datum: string | null; ruw: string; regels: Regel[] };
type OrgVoorstel = { veld: string; waarde: string };
type Mail = { id: string; onderwerp: string; van: string; datum: string | null; aanhef: string; link: string; verwerkt: boolean };

const ORG_LABEL: Record<string, string> = {
  plaats: "Plaats", straat: "Straat", postcode: "Postcode", telefoon: "Telefoon", email: "E-mail",
  oprichtingsjaar: "Oprichtingsjaar", areaServed: "Werkgebied", openingstijden: "Openingstijden",
  priceRange: "Prijsindicatie", kvk: "KvK-nummer", btw: "BTW-nummer",
};

const UITLEG = "Hier plak je alles wat de klant zelf aanlevert: een mail met correcties, een aantekening uit een gesprek, een appje. Het dashboard maakt er korte werkregels van in drie bakjes (feiten, wat we wel en niet doen, woorden en toon).\nWaarom dit blok apart staat: deze regels gaan VOOR alles wat uit de website-analyse komt. Zegt het automatische klantprofiel dat het bedrijf in Uden zit en zegt de klant dat het Vorstenbosch is, dan wint de klant, overal: in de strategie-chat, de analyse, de blauwdruk, de copy, de meta-motor en de mails.\nEn ze kunnen niet meer kwijtraken. De knoppen 'Klantprofiel opstellen' en 'Tone-of-voice analyse' schrijven alleen in hun eigen blok hieronder; aan dit blok kunnen ze niet komen. Spreekt een nieuwe regel een oude tegen, dan vervalt de oude, maar hij blijft zichtbaar onder 'Eerder gezegd'.";

export default function KlantCorrectiesPanel({ slug }: { slug: string }) {
  const [open, setOpen] = useState(true);
  const [correcties, setCorrecties] = useState<Correctie[] | null>(null);
  const [ruw, setRuw] = useState("");
  const [bron, setBron] = useState("");
  const [datum, setDatum] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [melding, setMelding] = useState("");
  const [voorstellen, setVoorstellen] = useState<OrgVoorstel[]>([]);
  const [gezet, setGezet] = useState<string[]>([]);
  const [plakOpen, setPlakOpen] = useState(false);
  const [bronOpen, setBronOpen] = useState<number | null>(null);
  const [veldStempel, setVeldStempel] = useState(0);
  const [mails, setMails] = useState<Mail[]>([]);
  // Elk blok staat standaard dicht; `false` betekent open.
  const [dicht, setDicht] = useState<Record<string, boolean>>({});
  // Stand per mail, niet één stand voor het hele blok. Met alleen een globale
  // "bezig" stonden alle knoppen uit zonder dat je zag waarom, en een tweede
  // klik verdween in het niets: op 27-08-2026 dacht Maarten daardoor dat de
  // knop stuk was, terwijl de eerste mail gewoon aan het verwerken was.
  const [mailStand, setMailStand] = useState<Record<string, "bezig" | "klaar" | "fout">>({});

  const laden = useCallback(async () => {
    try {
      const r = await fetch(`/api/admin/klant-correcties?slug=${encodeURIComponent(slug)}`);
      const j = await r.json();
      if (j.ok) { setCorrecties(j.correcties as Correctie[]); setMails((j.mails || []) as Mail[]); }
    } catch { /* stil: het blok is dan gewoon leeg */ }
  }, [slug]);

  useEffect(() => { laden(); }, [laden]);

  const regels: Regel[] = (correcties || []).flatMap((c) => c.regels);
  const geldig = regels.filter((r) => r.vervallenDoor === null);
  const vervallen = regels.filter((r) => r.vervallenDoor !== null);

  async function verwerk() {
    if (!ruw.trim()) { setFout("Plak eerst de tekst van de klant in het vak."); return; }
    setBezig(true); setFout(""); setMelding(""); setVoorstellen([]); setGezet([]);
    try {
      const r = await fetch("/api/admin/klant-correcties", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, ruw, bron, datum }),
      });
      const j = await r.json();
      if (j.correcties) setCorrecties(j.correcties as Correctie[]);
      if (j.mails) setMails(j.mails as Mail[]);
      if (!j.ok) { setFout(j.error || "Het verwerken mislukte."); return; }
      setRuw(""); setBron(""); setDatum(""); setVeldStempel((n) => n + 1); setPlakOpen(false);
      setVoorstellen((j.orgVoorstellen || []) as OrgVoorstel[]);
      const v = Number(j.vervallen || 0);
      setMelding(`${j.aantal || 0} regel${Number(j.aantal) === 1 ? "" : "s"} toegevoegd${v ? `, ${v} eerdere regel${v === 1 ? "" : "s"} vervallen` : ""}. Ze gaan vanaf nu automatisch mee in alles wat we voor deze klant schrijven.`);
    } catch (e) {
      setFout((e as Error).message);
    } finally { setBezig(false); }
  }

  async function doeMail(messageId: string) {
    if (mailStand[messageId] === "bezig" || mailStand[messageId] === "klaar") return;
    setMailStand((s) => ({ ...s, [messageId]: "bezig" }));
    setFout(""); setMelding(""); setVoorstellen([]); setGezet([]);
    try {
      const r = await fetch("/api/admin/klant-correcties", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, wat: "mail", messageId }),
      });
      const j = await r.json();
      if (j.correcties) setCorrecties(j.correcties as Correctie[]);
      if (!j.ok) {
        setMailStand((s) => ({ ...s, [messageId]: "fout" }));
        setFout(j.error || "Deze mail verwerken lukte niet.");
        return;
      }
      // De lijst bewust NIET vervangen: de verwerkte mail zou er dan uit
      // springen terwijl je er net op klikte. Hij blijft staan met "Verwerkt"
      // erachter en is bij de volgende keer openen vanzelf weg.
      setMailStand((s) => ({ ...s, [messageId]: "klaar" }));
      const v = Number(j.vervallen || 0);
      setMelding(`${j.aantal || 0} regel${Number(j.aantal) === 1 ? "" : "s"} uit deze mail gehaald${v ? `, ${v} eerdere regel${v === 1 ? "" : "s"} vervallen` : ""}.`);
      setVoorstellen((j.orgVoorstellen || []) as OrgVoorstel[]);
    } catch (e) {
      setMailStand((s) => ({ ...s, [messageId]: "fout" }));
      setFout((e as Error).message);
    }
  }

  async function doeActie(body: Record<string, unknown>) {
    setBezig(true); setFout("");
    try {
      const r = await fetch("/api/admin/klant-correcties", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ slug, ...body }),
      });
      const j = await r.json();
      if (j.correcties) setCorrecties(j.correcties as Correctie[]);
      if (j.mails) setMails(j.mails as Mail[]);
      if (!j.ok) setFout(j.error || "Dat lukte niet.");
    } catch (e) { setFout((e as Error).message); } finally { setBezig(false); }
  }

  async function verwijder(id: number) {
    setBezig(true); setFout("");
    try {
      const r = await fetch(`/api/admin/klant-correcties?slug=${encodeURIComponent(slug)}&id=${id}`, { method: "DELETE" });
      const j = await r.json();
      if (j.correcties) setCorrecties(j.correcties as Correctie[]);
      if (j.mails) setMails(j.mails as Mail[]);
    } catch (e) { setFout((e as Error).message); } finally { setBezig(false); }
  }

  async function zetVeld(v: OrgVoorstel) {
    setBezig(true); setFout("");
    try {
      const r = await fetch("/api/admin/klant-correcties", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ slug, wat: "bedrijfsgegeven", veld: v.veld, waarde: v.waarde }),
      });
      const j = await r.json();
      if (j.ok) setGezet((g) => [...g, v.veld]); else setFout(j.error || "Doorvoeren mislukte.");
    } catch (e) { setFout((e as Error).message); } finally { setBezig(false); }
  }

  // Eén patroon voor élk blok hieronder: `deelkop`, de gedeelde inklapkop van
  // niveau 2 die de cockpit overal gebruikt, met het aantal stil rechts in
  // `deelkop-meta`. Alles staat standaard dicht. Geen eigen koppen, geen eigen
  // knopvormen: dat is precies waar dit paneel de eerste ronde de mist in ging
  // (twee gecentreerde knoppen die nergens anders zo staan).
  const Blok = ({ id, titel, meta, children }: { id: string; titel: string; meta?: string; children: React.ReactNode }) => (
    <div className="kc-blok">
      <button type="button" className="deelkop" aria-expanded={dicht[id] === false}
        onClick={() => setDicht((d) => ({ ...d, [id]: !(d[id] === false) }))}>
        {titel}
        {meta && <span className="deelkop-meta">{meta}</span>}
      </button>
      {dicht[id] === false && <div className="kc-blok-body">{children}</div>}
    </div>
  );

  return (
    <div className="cockpit-card acc-orange" id="fund-correcties">
      <button type="button" className="client-profile-toggle" onClick={() => setOpen((v) => !v)}>
        <span className="cpt-titel">{open ? <Omlaag /> : <Uitklap />} Wat de klant zelf zegt</span>
        <span className="cpt-rechts">
          <span className="cpt-stand">
            Regels die gelden <span className={`ob-chip ob-${geldig.length ? "af" : "open"}`}>{geldig.length || "geen"}</span>
          </span>
        </span>
      </button>

      {open && (
        <div className="client-profile-body">
          <div className="kc-uitleg">
            <span>Deze regels gaan vóór het klantprofiel en de tone-of-voice hieronder, en gaan automatisch mee in élke tekst, analyse en mail voor deze klant.</span>
            <HelpHint xl title="Wat is dit blok en waarom gaat het voor?" text={UITLEG} />
          </div>

          <div className="pnl-acties-groep">
            <button type="button" className="btn btn-klein btn-primary" onClick={() => setPlakOpen((v) => !v)} disabled={bezig}>
              {plakOpen ? "Plakvak sluiten" : "Tekst van de klant toevoegen"}
            </button>
          </div>

          {plakOpen && (
            <div className="kc-plak">
              <RijkTekstVeld
                key={veldStempel}
                waarde={ruw}
                onChange={setRuw}
                placeholder="Plak hier de mail of aantekening van de klant. Kopjes, opsommingen en tabellen blijven staan."
              />
              <div className="kc-plak-rij">
                <label className="org-field">
                  <span className="org-label">Van wie en waaruit</span>
                  <input value={bron} onChange={(e) => setBron(e.target.value)} placeholder="bijv. mail Paul" />
                </label>
                <label className="org-field">
                  <span className="org-label">Datum</span>
                  <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
                </label>
                <button type="button" className={"btn btn-klein btn-primary" + (bezig ? " busy" : "")} onClick={verwerk} disabled={bezig}>
                  {bezig ? "Verwerken…" : "Verwerken"}
                </button>
              </div>
              <span className="muted kc-klein">Laat je de twee velden leeg, dan haalt het dashboard ze zelf uit de tekst.</span>
            </div>
          )}

          {fout && <div className="login-error kc-marge">{fout}</div>}
          {melding && <div className="saved-msg kc-marge">{melding}</div>}

          {voorstellen.length > 0 && (
            <div className="kc-blok-body">
              <div className="kc-labeltje">Dit hoort ook in de bedrijfsgegevens</div>
              <ul className="kc-lijst kc-lijst-org">
                {voorstellen.map((v) => (
                  <li key={v.veld}>
                    <span className="kc-eerste"><strong>{ORG_LABEL[v.veld] || v.veld}</strong> {v.waarde}</span>
                    <span className="kc-tweede" />
                    <span className="kc-derde">
                      {gezet.includes(v.veld)
                        ? <span className="ob-chip ob-af">Doorgevoerd</span>
                        : <button type="button" className="btn btn-klein btn-ghost" onClick={() => zetVeld(v)} disabled={bezig}>Doorvoeren</button>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {correcties === null && <div className="muted kc-klein">Bezig met ophalen…</div>}

          {mails.length > 0 && (
            <Blok id="mails" titel="Mails van deze klant" meta={`${mails.filter((m) => !m.verwerkt && mailStand[m.id] !== "klaar").length} nog te doen`}>
              <ul className="kc-lijst">
                {mails.map((m) => {
                  const klaar = m.verwerkt || mailStand[m.id] === "klaar";
                  const stand = mailStand[m.id];
                  return (
                    <li key={m.id}>
                      <span className="kc-eerste">
                        <strong>{m.onderwerp}</strong>
                        {m.aanhef && <span className="kc-aanhef">{m.aanhef}</span>}
                      </span>
                      <span className="kc-tweede">
                        {[m.van, m.datum ? m.datum.split("-").reverse().join("-") : ""].filter(Boolean).join(", ")}
                        {m.link && <><br /><a href={m.link} target="_blank" rel="noreferrer">mail openen</a></>}
                      </span>
                      <span className="kc-derde">
                        {klaar
                          ? <span className="ob-chip ob-af">Verwerkt</span>
                          : (
                            <button
                              type="button"
                              className={"btn btn-klein" + (stand === "bezig" ? " btn-ghost busy" : stand === "fout" ? " btn-danger" : " btn-ghost")}
                              onClick={() => doeMail(m.id)}
                              disabled={stand === "bezig"}
                            >
                              {stand === "bezig" ? "Bezig, even geduld…" : stand === "fout" ? "Opnieuw proberen" : "Verwerken"}
                            </button>
                          )}
                      </span>
                    </li>
                  );
                })}
              </ul>
              <span className="muted kc-klein">Alleen binnengekomen mail van deze klant. Verwerken duurt ongeveer een halve minuut per mail; je kunt er meerdere tegelijk aanzetten.</span>
            </Blok>
          )}

          {correcties !== null && geldig.length === 0 && (
            <div className="muted kc-klein">
              Nog niets aangeleverd. Zodra een klant iets rechtzet of aanvult, plak je die tekst hier of haal je hem uit een mail; dan telt het overal mee.
            </div>
          )}

          {geldig.length > 0 && (
            <Blok id="regels" titel="Regels die nu gelden" meta={String(geldig.length)}>
              {CATEGORIEEN.map((cat) => {
                const van = geldig.filter((r) => r.categorie === cat);
                if (!van.length) return null;
                return (
                  <div className="kc-groep" key={cat}>
                    <div className="kc-labeltje">{CATEGORIE_LABEL[cat]}</div>
                    <ul className="kc-lijst">
                      {van.map((r) => (
                        <li key={r.id}>
                          <span className="kc-eerste">{r.regel}</span>
                          <span className="kc-tweede">{bronLabel(r.bron, r.datum)}</span>
                          <span className="kc-derde">
                            <button type="button" className="kc-weg" title="Deze regel weghalen"
                              onClick={() => doeActie({ wat: "regel", regelId: r.id, tekst: "" })} disabled={bezig}>&times;</button>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </Blok>
          )}

          {vervallen.length > 0 && (
            <Blok id="vervallen" titel="Eerder gezegd, inmiddels achterhaald" meta={String(vervallen.length)}>
              <ul className="kc-lijst kc-vervallen">
                {vervallen.map((r) => (
                  <li key={r.id}>
                    <span className="kc-eerste">{r.regel}</span>
                    <span className="kc-tweede">{bronLabel(r.bron, r.datum)}</span>
                    <span className="kc-derde" />
                  </li>
                ))}
              </ul>
            </Blok>
          )}

          {(correcties || []).length > 0 && (
            <Blok id="bronnen" titel="De aangeleverde teksten zelf" meta={String((correcties || []).length)}>
              <ul className="kc-lijst">
                {(correcties || []).map((c) => (
                  <li key={c.id}>
                    <span className="kc-eerste">
                      <strong>{bronLabel(c.bron, c.datum) || "zonder bron"}</strong>
                      <span className="kc-aanhef">{c.regels.length} regel{c.regels.length === 1 ? "" : "s"} hieruit gehaald</span>
                      {bronOpen === c.id && <span className="md kc-ruw" dangerouslySetInnerHTML={{ __html: netteHtml(c.ruw) }} />}
                    </span>
                    <span className="kc-tweede" />
                    <span className="kc-derde kc-derde-groep">
                      <button type="button" className="btn btn-klein btn-quiet" onClick={() => setBronOpen(bronOpen === c.id ? null : c.id)}>
                        {bronOpen === c.id ? "Tekst verbergen" : "Tekst bekijken"}
                      </button>
                      <button type="button" className="btn btn-klein btn-ghost" onClick={() => doeActie({ wat: "opnieuw", correctieId: c.id })} disabled={bezig}>Opnieuw uitwerken</button>
                      <button type="button" className="btn btn-klein btn-danger" onClick={() => verwijder(c.id)} disabled={bezig}>Verwijderen</button>
                    </span>
                  </li>
                ))}
              </ul>
            </Blok>
          )}
        </div>
      )}
    </div>
  );
}
