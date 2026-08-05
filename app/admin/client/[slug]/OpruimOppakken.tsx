"use client";

// ═══════════════════════════════════════════════════════════
// OPPAKKEN, NIET WEGHALEN
// ═══════════════════════════════════════════════════════════
// De tegenhanger van de werklijst. Hier staan de pagina's die er in de data
// uitzien als dood gewicht (ze scoren nergens op), maar die op een zoekterm
// zitten met echt zoekvolume die niemand anders op de site bezit.
//
// Waarom dit blok bestaat: /soa-test-kopen/ stond op de omleidlijst met
// /anonieme-soa-test/ als bestemming. "soa test kopen" is 500 zoekopdrachten per
// maand met verkeerspotentie 4700; "anonieme soa test" 250 met potentie 50. Die
// omleiding zou de grootste kans van de site opheffen ten gunste van de kleinste.
// Zulke pagina's hebben geen redirect nodig maar een herontwikkeling, en die
// loopt via de gewone pijplijn: analyse, blauwdruk, copy.
// ═══════════════════════════════════════════════════════════

import { useState } from "react";
import MailVenster from "./MailVenster";

export type Oppakker = {
  pad: string; term: string; volume: number | null; moeilijkheid: number | null;
  huidigePositie: number | null; vertoningen: number; botstMet: string[];
};

export default function OpruimOppakken({ slug, domain, rijen, clientName, clientEmail, alleenLezen = false }: {
  slug: string; domain: string; rijen: Oppakker[]; clientName?: string; clientEmail?: string;
  /** Leesmodus voor de deellink: wel de uitleg en de uitklappers, geen knoppen. */
  alleenLezen?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [mailVoor, setMailVoor] = useState<Oppakker | null>(null);
  const [bezig, setBezig] = useState("");
  const [klaar, setKlaar] = useState<Record<string, string>>({});

  const site = (p: string) => `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
  const Link = ({ p }: { p: string }) => <a className="opr-pad" href={site(p)} target="_blank" rel="noreferrer">{p}</a>;

  // Doorzetten naar de weekplanning. Daar krijgt de pagina automatisch zijn
  // fases (analyse, blauwdruk, copy), dus we hoeven die hier niet na te bouwen.
  async function naarWeekplan(o: Oppakker) {
    if (bezig) return;
    setBezig(o.pad);
    try {
      const d = await fetch("/api/admin/weekplan/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, week: 1, wie: "SEO", url: site(o.pad),
          taak: `Herontwikkel ${o.pad} voor "${o.term}"`,
          toelichting: [
            `Deze pagina haalt nu niets uit Google op zijn eigen onderwerp, maar de zoekterm "${o.term}" is ${o.volume} zoekopdrachten per maand waard${o.moeilijkheid != null ? ` (moeilijkheid ${o.moeilijkheid})` : ""}.`,
            o.huidigePositie != null ? `Hij doet al mee op plek ${o.huidigePositie}, dus er is iets om op voort te bouwen.` : "Hij doet op die term nog niet mee in de resultaten.",
            "Geen omleiding dus, maar de gewone route: analyse van de huidige pagina, blauwdruk op basis van de top 10, en daarna de copy.",
          ].join(" "),
        }),
      }).then((r) => r.json());
      setKlaar((m) => ({ ...m, [o.pad]: d?.ok ? `Staat in week ${d.week}.` : (d?.error || "Toevoegen mislukte.") }));
    } catch { setKlaar((m) => ({ ...m, [o.pad]: "Toevoegen mislukte." })); }
    finally { setBezig(""); }
  }

  // Precies dezelfde onderbouwing als in de uitklap, maar als tekst voor de klant:
  // wat we zagen, waarom we de pagina niet weghalen, en wat we ermee gaan doen.
  function mailBlok(o: Oppakker): string {
    return [
      `## ${o.pad}: opnieuw opbouwen in plaats van weghalen`,
      "",
      `Bij het opruimen van de website kwam deze pagina naar voren als kandidaat om te verwijderen: hij levert op dit moment geen bezoekers op uit Google${o.vertoningen ? `, terwijl hij daar wel ${o.vertoningen} keer is getoond` : ""}${o.botstMet.length ? `, en hij overlapt met ${o.botstMet.join(", ")}` : ""}.`,
      "",
      `Toch halen we hem niet weg. De zoekterm die bij deze pagina hoort is **"${o.term}"**, en daar wordt ${o.volume != null ? `ongeveer ${o.volume} keer per maand` : "regelmatig"} op gezocht${o.moeilijkheid != null ? `, bij een concurrentie van ${o.moeilijkheid} op 100` : ""}. Geen andere pagina van de website richt zich op die term.${o.huidigePositie != null ? ` Deze pagina doet er zelf al aan mee, rond plek ${o.huidigePositie}.` : ""}`,
      "",
      "Dat betekent dat het probleem niet de pagina is, maar de invulling ervan. Daarom pakken we hem op in plaats van op te ruimen:",
      "",
      "- eerst analyseren wat de pagina nu doet en waar hij tekortschiet;",
      `- daarna een blauwdruk maken op basis van de best scorende pagina's voor "${o.term}";`,
      "- en tot slot de tekst herschrijven volgens die blauwdruk.",
      "",
      "Zo houden we de kans op deze zoekterm vast in plaats van hem weg te geven.",
    ].join("\n");
  }

  if (!rijen.length) return null;

  return (
    <div className="opr-kaart">
      <div className="opr-kop">Oppakken, niet weghalen ({rijen.length})</div>
      <p className="opr-kaart-tekst">
        Deze pagina&rsquo;s kwamen als opruimkandidaat uit de analyse: ze scoren op dit moment nergens op.
        Maar de zoekterm die bij ze hoort <strong>heeft wél zoekvolume</strong>, en geen andere pagina van deze site
        bezit hem. Ze omleiden zou dus een kans weggooien in plaats van rommel opruimen. Ze horen niet in de
        werklijst thuis maar in de planning: <strong>opnieuw opbouwen voor de term die ze verdienen</strong>.
      </p>

      <div className="opr-scroll">
        <table className="opr-tabel">
          <thead>
            <tr>
              <th>Deze pagina</th>
              <th>Kansrijk op</th>
              <th>Per maand</th>
              <th>Moeilijkheid</th>
              {!alleenLezen && <th>Actie</th>}
              <th>Waarom</th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((o) => (
              <tr key={o.pad}>
                <td><Link p={o.pad} /></td>
                <td><strong>{o.term}</strong></td>
                <td>{o.volume != null ? `${o.volume}x` : "—"}</td>
                <td>{o.moeilijkheid != null ? o.moeilijkheid : "—"}</td>
                {!alleenLezen && <td>
                  <button type="button" className="opr-btn" disabled={!!bezig} onClick={() => void naarWeekplan(o)}
                    title="Zet deze pagina als taak op de weekplanning. Daar krijgt hij zijn fases: analyse, blauwdruk, copy.">
                    {bezig === o.pad ? "Bezig…" : "Zet op de weekplanning"}
                  </button>
                  <button type="button" className="opr-btn" onClick={() => setMailVoor(o)}
                    title="Mail de klant wat we met deze pagina gaan doen, met de onderbouwing erbij.">
                    Mail naar klant
                  </button>
                  {klaar[o.pad] && <div className="opr-melding" style={{ marginTop: 4 }}>{klaar[o.pad]}</div>}
                </td>}
                <td className="opr-reden">
                  <button type="button" className="opr-meer" onClick={() => setOpen((m) => ({ ...m, [o.pad]: !m[o.pad] }))}>
                    {open[o.pad] ? "▾ minder" : "▸ reden"}
                  </button>
                  {open[o.pad] && (
                    <div className="opr-uitleg">
                      <div className="opr-bewijs">
                        <p>
                          Deze pagina <strong>overlapt inderdaad</strong> met andere pagina&rsquo;s van de site
                          {o.botstMet.length ? <>, namelijk met {o.botstMet.map((b, k) => <span key={k}>{k > 0 ? ", " : ""}<Link p={b} /></span>)}</> : ""}
                          , en op dit moment levert hij zelf niets op
                          {o.vertoningen ? ` (wel ${o.vertoningen} keer getoond in Google, maar zonder resultaat)` : ""}.
                          Op grond daarvan kwam hij als opruimkandidaat uit de analyse.
                        </p>
                        <p>
                          <strong>Toch gaat hij niet weg.</strong> De zoekterm die bij deze pagina hoort is
                          &ldquo;{o.term}&rdquo;, en daar zoeken mensen {o.volume != null ? `${o.volume} keer per maand` : "regelmatig"} op
                          {o.moeilijkheid != null ? `, bij een moeilijkheid van ${o.moeilijkheid} op 100` : ""}. Geen andere pagina van
                          deze site bezit die term.
                          {o.huidigePositie != null
                            ? ` Deze pagina doet er zelf al aan mee, op plek ${o.huidigePositie}, dus de basis ligt er.`
                            : ""}
                        </p>
                        <p>
                          <strong>Wat we doen:</strong> niet omleiden, maar opnieuw opbouwen. De pagina blijft staan en gaat de gewone
                          route in: eerst de huidige pagina analyseren, dan een blauwdruk op basis van de top 10 voor
                          &ldquo;{o.term}&rdquo;, en daarna de copy. Met de knop hiernaast komt hij als taak op de weekplanning te staan,
                          met zijn fases erbij. Pas als blijkt dat die term toch niets waard is, is opruimen alsnog aan de orde.
                        </p>
                      </div>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!alleenLezen && mailVoor && (
        <MailVenster
          slug={slug}
          titel="Mail dit voorstel naar de klant"
          onderwerpVan={`${mailVoor.pad} opnieuw opbouwen`}
          taak={`Uitleg aan de klant: waarom ${mailVoor.pad} niet wordt opgeruimd maar opnieuw wordt opgebouwd voor "${mailVoor.term}".`}
          toelichting={mailBlok(mailVoor)}
          blokMd={mailBlok(mailVoor)}
          siteUrl={domain}
          clientName={clientName}
          clientEmail={clientEmail}
          onClose={() => setMailVoor(null)}
        />
      )}
    </div>
  );
}
