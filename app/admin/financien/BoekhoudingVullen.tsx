"use client";

import { useState } from "react";
import Link from "next/link";
import type { Voorstel, VoorstelRegel } from "../../../lib/prognose-boekhouding";

// ═══════════════════════════════════════════════════════════
// DE PROGNOSE VULLEN VANUIT DE BOEKHOUDING
// ═══════════════════════════════════════════════════════════
// De bedragen staan al in Moneybird, dus overtypen is werk én de garantie dat de
// twee na een paar maanden uit elkaar lopen. Dit paneel leest ze uit.
//
// Bewust in twee stappen. Eerst OPHALEN: dan staat naast elkaar wat het
// dashboard nu zegt en wat de boekhouding zegt, met per regel waaróm. Pas als
// Maarten vinkt en op overnemen drukt, verandert er iets. Een knop die twintig
// bedragen in één klik omzet is precies de knop waarvan je later niet meer weet
// wat hij gedaan heeft.
// ═══════════════════════════════════════════════════════════

function euro(n: number): string {
  const a = Math.round(n);
  return (a < 0 ? "− € " : "€ ") + Math.abs(a).toLocaleString("nl-NL");
}

type Props = { herlaad: (data: unknown) => void };

export default function BoekhoudingVullen({ herlaad }: Props) {
  const [voorstel, zetVoorstel] = useState<Voorstel | null>(null);
  const [gekozen, zetGekozen] = useState<Set<string>>(new Set());
  const [bezig, zetBezig] = useState(false);
  const [fout, zetFout] = useState("");
  const [melding, zetMelding] = useState("");
  const [linkbuilder, zetLinkbuilder] = useState("");
  const [openRegel, zetOpenRegel] = useState<string | null>(null);

  async function ophalen() {
    zetBezig(true); zetFout(""); zetMelding("");
    try {
      const r = await fetch("/api/admin/prognose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actie: "boekhouding-voorstel", ...(linkbuilder ? { linkbuilder } : {}) }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { zetFout(d.error || "Ophalen uit de boekhouding mislukt."); return; }
      const v = d.voorstel as Voorstel;
      zetVoorstel(v);
      if (!linkbuilder) zetLinkbuilder(v.linkbuilderZoekterm);
      // Alles wat verandert staat standaard aan: dat is de bedoeling van de knop.
      // Uitvinken kan per regel, en dat is de rem die telt.
      zetGekozen(new Set(v.regels.filter((x) => x.wijzigt && x.slug).map((x) => x.slug as string)));
    } catch {
      zetFout("De server is niet bereikbaar.");
    } finally { zetBezig(false); }
  }

  async function overnemen() {
    if (gekozen.size === 0) return;
    zetBezig(true); zetFout(""); zetMelding("");
    try {
      const r = await fetch("/api/admin/prognose", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actie: "boekhouding-overnemen", slugs: [...gekozen] }),
      });
      const d = await r.json();
      if (!r.ok || !d.ok) { zetFout(d.error || "Overnemen mislukt."); return; }
      herlaad(d);
      zetMelding(`${d.overgenomen} bedrag${d.overgenomen === 1 ? "" : "en"} overgenomen uit de boekhouding.`);
      zetVoorstel(null); zetGekozen(new Set());
    } catch {
      zetFout("De server is niet bereikbaar.");
    } finally { zetBezig(false); }
  }

  const wijzigend = voorstel ? voorstel.regels.filter((r) => r.wijzigt) : [];
  const gelijk = voorstel ? voorstel.regels.filter((r) => !r.wijzigt) : [];

  return (
    <div className="card">
      <div className="prog-kop">
        <div className="prog-kop-titel">Uit de boekhouding</div>
        <div className="prog-kop-uitleg">
          Haalt per klant op wat er de laatste zes afgesloten maanden werkelijk is gefactureerd, en de
          linkbuilding uit de facturen van je linkbuilder. Je ziet eerst wat er zou veranderen; er
          wordt niets overgenomen tot je erop drukt.
        </div>
        <div className="prog-kop-acties">
          <button type="button" className="btn btn-ghost btn-klein" onClick={ophalen} disabled={bezig}>
            {bezig && !voorstel ? "Bezig met ophalen" : voorstel ? "Opnieuw ophalen" : "Ophalen uit Moneybird"}
          </button>
        </div>
      </div>

      {fout && <div className="login-error">{fout}</div>}
      {melding && <div className="prog-kop-uitleg">{melding}</div>}

      {voorstel && (
        <>
          <div className="prog-instel">
            <div className="prog-instel-veld">
              <label htmlFor="lb-contact">Van welke leverancier komt de linkbuilding</label>
              <input
                id="lb-contact" value={linkbuilder} disabled={bezig}
                onChange={(e) => zetLinkbuilder(e.target.value)}
                placeholder="info@co.vision"
              />
            </div>
            <button type="button" className="btn btn-ghost btn-klein" onClick={ophalen} disabled={bezig}>
              Opnieuw zoeken
            </button>
          </div>

          <div className="prog-kop-uitleg">
            Gekeken van {voorstel.vanMaand} tot en met {voorstel.totMaand}. De lopende maand telt niet mee,
            die is halverwege.{" "}
            {voorstel.linkbuilderGevonden
              ? "De linkbuilder is gevonden; regels waarin een klantnaam of domein staat zijn aan die klant toegewezen."
              : `De linkbuilder (${voorstel.linkbuilderZoekterm}) is niet gevonden in Moneybird, dus de linkbuildingbedragen blijven staan zoals ze stonden.`}
          </div>

          {wijzigend.length === 0 ? (
            <div className="prog-kop-uitleg">
              Alles staat al gelijk aan de boekhouding. Er valt niets over te nemen.
            </div>
          ) : (
            <>
              <div className="prog-boek-kop">
                <span />
                <span>klant</span>
                <span>staat nu</span>
                <span>boekhouding</span>
                <span className="verberg-klein">linkbuilding nu</span>
                <span className="verberg-klein">wordt</span>
              </div>
              {wijzigend.map((r) => (
                <VoorstelRij
                  key={r.slug || r.naam}
                  regel={r}
                  aan={!!r.slug && gekozen.has(r.slug)}
                  open={openRegel === r.slug}
                  zetOpen={() => zetOpenRegel(openRegel === r.slug ? null : r.slug)}
                  wissel={() => {
                    if (!r.slug) return;
                    const n = new Set(gekozen);
                    if (n.has(r.slug)) n.delete(r.slug); else n.add(r.slug);
                    zetGekozen(n);
                  }}
                />
              ))}
              <div className="prog-kop-acties">
                <button type="button" className="btn btn-primary btn-klein" onClick={overnemen} disabled={bezig || gekozen.size === 0}>
                  {bezig ? "Bezig" : `${gekozen.size} regel${gekozen.size === 1 ? "" : "s"} overnemen`}
                </button>
              </div>
            </>
          )}

          {gelijk.length > 0 && (
            <details className="prog-details">
              <summary>{gelijk.length} klant{gelijk.length === 1 ? "" : "en"} waar niets aan verandert</summary>
              {gelijk.map((r) => (
                <div className="prog-post" key={r.slug || r.naam}>
                  <span className="prog-post-naam">
                    {r.slug ? <Link href={`/admin/client/${r.slug}`}>{r.naam}</Link> : <span>{r.naam}</span>}
                  </span>
                  <span className="prog-post-bedrag">{euro(r.bedrag)}</span>
                  <span className="prog-post-bedrag verberg-klein">{euro(r.linkbuilding)}</span>
                  <span className="prog-gat">{r.meldingen[0] || ""}</span>
                </div>
              ))}
            </details>
          )}

          {voorstel.onbekend.length > 0 && (
            <details className="prog-details" open>
              <summary>
                {voorstel.onbekend.length} bedrijf{voorstel.onbekend.length === 1 ? "" : "ven"} factureert wel,
                maar staat niet in het dashboard
              </summary>
              <div className="prog-kop-uitleg">
                Deze contacten sturen facturen maar hebben geen klant of lead in het dashboard, dus ze tellen
                niet mee in de prognose. Maak ze aan op het klantenoverzicht en haal daarna opnieuw op.
              </div>
              {voorstel.onbekend.map((o) => (
                <div className="prog-post" key={o.contactId}>
                  <span className="prog-post-naam">
                    <a href={o.url} target="_blank" rel="noreferrer">{o.naam}</a>
                  </span>
                  <span className="prog-post-bedrag">{o.maanden} van 6 mnd</span>
                  <span className="prog-post-bedrag goed verberg-klein">{euro(o.bedrag)}</span>
                  <span className="prog-post-bedrag">per maand</span>
                </div>
              ))}
            </details>
          )}

          {voorstel.linkbuildingRestant.regels.length > 0 && (
            <details className="prog-details">
              <summary>
                {euro(voorstel.linkbuildingRestant.bedrag)} aan linkbuilding was niet aan een klant toe te wijzen
              </summary>
              <div className="prog-kop-uitleg">
                In deze factuurregels stond geen klantnaam of domein dat het dashboard herkent. Ze zijn bewust
                niet verdeeld over de klanten die wél herkend zijn; dan zou de marge per klant een schatting worden.
              </div>
              {voorstel.linkbuildingRestant.regels.map((r, i) => (
                <div className="prog-post" key={`${r.factuur}-${i}`}>
                  <span className="prog-post-naam">
                    <a href={r.url} target="_blank" rel="noreferrer">{r.omschrijving || r.factuur}</a>
                  </span>
                  <span className="prog-post-bedrag">{r.maand}</span>
                  <span className="prog-post-bedrag verberg-klein" />
                  <span className="prog-post-bedrag slecht">{euro(r.bedrag)}</span>
                </div>
              ))}
            </details>
          )}
        </>
      )}
    </div>
  );
}

function VoorstelRij({ regel, aan, open, zetOpen, wissel }: {
  regel: VoorstelRegel; aan: boolean; open: boolean; zetOpen: () => void; wissel: () => void;
}) {
  const verschil = regel.bedrag - (regel.huidigBedrag ?? 0);
  return (
    <>
      <div className="prog-boek">
        <input
          type="checkbox"
          checked={aan}
          onChange={wissel}
          aria-label={`${regel.naam} overnemen uit de boekhouding`}
        />
        <span className="prog-post-naam">
          {regel.slug
            ? <Link href={`/admin/client/${regel.slug}`}>{regel.naam}</Link>
            : <span>{regel.naam}</span>}
          <button type="button" className="btn btn-quiet btn-klein" onClick={zetOpen}>
            {open ? "verberg maanden" : "toon maanden"}
          </button>
        </span>
        <span className="prog-post-bedrag">{regel.huidigBedrag === null ? "" : euro(regel.huidigBedrag)}</span>
        <span className={"prog-post-bedrag " + (verschil >= 0 ? "goed" : "slecht")}>{euro(regel.bedrag)}</span>
        <span className="prog-post-bedrag verberg-klein">{regel.huidigLinkbuilding === null ? "" : euro(regel.huidigLinkbuilding)}</span>
        <span className="prog-post-bedrag verberg-klein">{euro(regel.linkbuilding)}</span>
      </div>
      {regel.meldingen.length > 0 && (
        <div className="prog-boek-melding">
          {regel.meldingen.map((m, i) => <span className="prog-gat" key={i}>{m}</span>)}
        </div>
      )}
      {open && (
        <div className="prog-boek-maanden">
          {regel.perMaand.map((m) => (
            <span key={m.maand} className="prog-chip post">{m.maand}: {euro(m.bedrag)}</span>
          ))}
        </div>
      )}
    </>
  );
}
