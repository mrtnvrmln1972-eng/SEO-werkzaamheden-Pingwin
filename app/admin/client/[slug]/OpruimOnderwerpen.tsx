"use client";

// ═══════════════════════════════════════════════════════════
// EEN ONDERWERP DAT OVER MEERDERE PAGINA'S LIGT
// ═══════════════════════════════════════════════════════════
// De derde uitkomst, naast omleiden en herontwikkelen. Liggen drie of meer
// pagina's op hetzelfde onderwerp en staat geen van alle in de top 10, dan is
// één omleiding het verkeerde antwoord: dan moet je kiezen welke pagina de
// thuisbasis wordt en de rest daarheen leiden.
//
// Het echte geval: /soa-test-thuis/, /soa-thuistest/ en /anonieme-soa-test/ gaan
// alle drie over thuis testen. Samen ruim 2000 zoekopdrachten per maand, beste
// positie 11. De motor zag daar één losse omleiding in.
// ═══════════════════════════════════════════════════════════

import { useState } from "react";
import MailVenster from "./MailVenster";
import { KansChip, intentieTekst, bedrag, type Haalbaarheid } from "./OpruimOppakken";

export type Onderwerp = {
  sleutel: string;
  paginas: { pad: string; term: string; bestePositie: number | null; vertoningen: number; klikken: number; intentie?: string; volume?: number | null; dekking?: number }[];
  termen: { keyword: string; volume: number | null; positie: number | null }[];
  volumeTotaal: number;
  bestePositie: number | null;
  voorstel: string;
  kamp?: "doen" | "weten" | "merk" | "onbekend";
  haalbaarheid?: Haalbaarheid;
  apartGehouden?: { pad: string; term: string; intentie: string; reden: string }[];
  hoofdterm?: string;
  geenPassendeThuisbasis?: boolean;
  euro?: { perMaand: number; perJaar: number; extraKlikkenPerMaand: number; doelPositie: number; uitleg: string } | null;
};

const KAMP_TEKST: Record<string, string> = {
  doen: "bezoekers die iets willen regelen",
  weten: "bezoekers die eerst iets willen weten",
};

export default function OpruimOnderwerpen({ slug, domain, rijen, clientName, clientEmail, alleenLezen = false }: {
  slug: string; domain: string; rijen: Onderwerp[]; clientName?: string; clientEmail?: string;
  alleenLezen?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [bezig, setBezig] = useState("");
  const [klaar, setKlaar] = useState<Record<string, string>>({});
  const [mailVoor, setMailVoor] = useState<Onderwerp | null>(null);

  const site = (p: string) => `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
  const Link = ({ p }: { p: string }) => <a className="opr-pad" href={site(p)} target="_blank" rel="noreferrer">{p}</a>;
  const titel = (o: Onderwerp) => o.termen[0]?.keyword || o.sleutel;

  async function naarWeekplan(o: Onderwerp) {
    if (bezig) return;
    setBezig(o.sleutel);
    try {
      const d = await fetch("/api/admin/weekplan/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, week: 1, wie: "SEO", url: site(o.voorstel),
          taak: `Bundel het onderwerp "${titel(o)}" op één pagina`,
          toelichting: [
            `Dit onderwerp ligt verspreid over ${o.paginas.length} pagina's: ${o.paginas.map((p) => p.pad).join(", ")}.`,
            `Samen goed voor ongeveer ${o.volumeTotaal} zoekopdrachten per maand, terwijl de beste positie ${o.bestePositie != null ? o.bestePositie : "buiten beeld"} is.`,
            `Voorstel: ${o.voorstel} wordt de thuisbasis, de rest wordt daarheen geleid of erin samengevoegd.`,
            "Route: eerst de sterkste pagina analyseren, dan een blauwdruk op basis van de top 10, dan de copy, en tot slot de omleidingen.",
          ].join(" "),
        }),
      }).then((r) => r.json());
      setKlaar((m) => ({ ...m, [o.sleutel]: d?.ok ? `Staat in week ${d.week}.` : (d?.error || "Toevoegen mislukte.") }));
    } catch { setKlaar((m) => ({ ...m, [o.sleutel]: "Toevoegen mislukte." })); }
    finally { setBezig(""); }
  }

  function mailBlok(o: Onderwerp): string {
    return [
      `## Het onderwerp "${titel(o)}" ligt verspreid over ${o.paginas.length} pagina's`,
      "",
      `Op de website staan meerdere pagina's die over hetzelfde gaan: ${o.paginas.map((p) => p.pad).join(", ")}. Bij elkaar zoeken mensen ongeveer **${o.volumeTotaal} keer per maand** op dit onderwerp${o.bestePositie != null ? `, maar de beste plek die we ermee halen is ${Math.round(o.bestePositie)}` : ", maar geen van deze pagina's komt in de resultaten voor"}.`,
      "",
      "Dat is precies het patroon waar losse pagina's elkaar in de weg zitten: Google ziet drie halve antwoorden op dezelfde vraag en kiest er geen van, terwijl één goede pagina wel zou meedoen.",
      "",
      ...(o.haalbaarheid && o.haalbaarheid.oordeel !== "onbekend" ? ["", `**Is dit haalbaar?** ${o.haalbaarheid.uitleg}`] : []),
      ...(o.apartGehouden && o.apartGehouden.length
        ? ["", `Wat we er bewust buiten laten: ${o.apartGehouden.map((a) => a.pad).join(", ")}. Die pagina's gaan over dezelfde woorden, maar de bezoeker wil er iets anders (${o.apartGehouden.map((a) => intentieTekst(a.intentie)).filter(Boolean).join(", ") || "een andere zoekintentie"}). Die samenvoegen zou juist bezoekers kosten.`]
        : []),
      "",
      ...(o.geenPassendeThuisbasis
        ? ["", `Wat hier opvalt: **geen van deze pagina's gaat echt over "${o.hoofdterm || titel(o)}"**. ${o.voorstel} komt er van dit rijtje het dichtst bij, maar mikt op een smaller onderwerp. Alles daarin laten opgaan zou een pagina opleveren met een naam die niet klopt bij waar mensen op zoeken. We kiezen daarom een inhoudelijk passende pagina als vaste plek en gebruiken deze pagina's als bouwmateriaal.`]
        : []),
      "",
      `Ons voorstel: **${o.voorstel}** wordt de vaste pagina voor dit onderwerp. De andere pagina's worden daarin samengevoegd en gaan er vervolgens naartoe verwijzen, zodat alle opgebouwde waarde op één plek terechtkomt.`,
      "",
      "De stappen:",
      "",
      "- de sterkste pagina analyseren en bepalen wat er nu ontbreekt;",
      `- een opzet maken op basis van de best scorende pagina's voor "${titel(o)}";`,
      "- de tekst schrijven en de andere pagina's daarheen laten verwijzen.",
    ].join("\n");
  }

  if (!rijen.length) return null;

  return (
    <div className="opr-kaart">
      <div className="opr-kop">Onderwerpen die over meerdere pagina&rsquo;s liggen ({rijen.length})</div>
      <div className="opr-kaart-tekst">
        <p>
          Hier gaan <strong>drie of meer pagina&rsquo;s over hetzelfde onderwerp</strong>, en staat geen van alle in de
          top 10. Eén pagina doorverwijzen lost dat niet op: dan blijven de andere twee elkaar in de weg zitten.
          De vraag is welke pagina de <strong>thuisbasis</strong> wordt voor dit onderwerp, en wat er met de rest gebeurt.
        </p>
        <p>Dit is de grootste van de drie lijsten qua opbrengst, want hier ligt gemist verkeer, geen opruimwerk.</p>
      </div>

      {rijen.map((o) => (
        <div key={o.sleutel} className="opr-onderwerp">
          <div className="opr-onderwerp-kop">
            <span className="opr-onderwerp-titel">{titel(o)}</span>
            <span className="opr-chip merge">{o.volumeTotaal}x per maand</span>
            <span className="opr-chip">{o.paginas.length} pagina&rsquo;s</span>
            <span className="opr-chip">beste plek {o.bestePositie != null ? Math.round(o.bestePositie) : "geen"}</span>
            <KansChip h={o.haalbaarheid} />
            {o.euro && <span className="opr-chip merge" title={o.euro.uitleg}>{bedrag(o.euro.perMaand)} per maand ({o.euro.extraKlikkenPerMaand} bezoekers)</span>}
            {o.kamp && KAMP_TEKST[o.kamp] && <span className="opr-chip">{KAMP_TEKST[o.kamp]}</span>}
            {!alleenLezen && (
              <span className="opr-kaart-acties">
                <button type="button" className="btn btn-klein opr-btn" disabled={!!bezig} onClick={() => void naarWeekplan(o)}
                  title="Zet dit onderwerp als taak op de weekplanning, met de thuisbasis als doelpagina.">
                  {bezig === o.sleutel ? "Bezig…" : "Zet op de weekplanning"}
                </button>
                <button type="button" className="btn btn-klein opr-btn" onClick={() => setMailVoor(o)}>Mail naar klant</button>
              </span>
            )}
          </div>
          {klaar[o.sleutel] && <div className="opr-melding">{klaar[o.sleutel]}</div>}

          <table className="opr-tabel opr-onderwerp-tabel">
            <thead>
              <tr><th>Pagina</th><th>Mikt op</th><th>Per maand</th><th>Beste plek</th><th>Vertoningen</th><th>Klikken</th><th>Rol</th></tr>
            </thead>
            <tbody>
              {o.paginas.map((p) => (
                <tr key={p.pad}>
                  <td><Link p={p.pad} /></td>
                  <td>{p.term || "—"}</td>
                  {/* Het zoekvolume van de term waar deze pagina op mikt. Zonder dat
                      getal is niet te zien dat de sterkste pagina van het rijtje soms
                      over een veel kleiner onderwerp gaat dan het cluster zelf. */}
                  <td>{p.volume != null ? `${p.volume}x` : <span className="opr-leeg">&mdash;</span>}</td>
                  <td>{p.bestePositie != null ? Math.round(p.bestePositie) : "—"}</td>
                  <td>{p.vertoningen || 0}</td>
                  {/* Klikken erbij: vertoningen zeggen dat Google hem toont, klikken
                      zeggen of iemand hem kiest. Dat verschil bepaalt of een pagina
                      een kansprobleem heeft of een tekstprobleem. */}
                  <td>{p.klikken ? <strong>{p.klikken}</strong> : <span className="opr-leeg">0</span>}</td>
                  <td>
                    {p.pad === o.voorstel
                      ? <span className={`opr-chip ${o.geenPassendeThuisbasis ? "nodig" : "keep"}`}>
                          {o.geenPassendeThuisbasis ? "beste van dit rijtje" : "voorstel: thuisbasis"}
                        </span>
                      : <span className="opr-leeg">gaat hierin op</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Past geen van de pagina's bij het onderwerp, dan is "kies de sterkste
              van dit rijtje" het verkeerde antwoord, en dat hoort er te staan
              vóórdat iemand het doorvoert. */}
          {o.geenPassendeThuisbasis && (
            <div className="opr-uitleg" style={{ marginTop: "var(--s-2)" }}>
              <p style={{ margin: "var(--s-0)" }}>
                <strong>Let op: geen van deze pagina&rsquo;s gaat echt over &ldquo;{o.hoofdterm || titel(o)}&rdquo;.</strong>{" "}
                De pagina hierboven staat er van dit rijtje het beste voor, maar hij mikt op een smaller of ander
                onderwerp. Alles hierin laten opgaan levert een pagina op met een naam die niet klopt bij waar mensen
                op zoeken. Kies hier dus een <strong>inhoudelijk passende pagina</strong> als bestemming (een bestaande
                elders op de site, of een nieuwe), en gebruik deze vijf als bouwmateriaal.
              </p>
            </div>
          )}

          {/* De intentie-rem, zichtbaar. Een pagina die stilletjes uit een cluster
              verdwijnt is niet te controleren; hier staat hij, met de reden erbij. */}
          {o.apartGehouden && o.apartGehouden.length > 0 && (
            <div className="opr-uitleg" style={{ marginTop: "var(--s-2)" }}>
              <p style={{ margin: "var(--s-0)" }}>
                <strong>Blijft er bewust buiten:</strong>{" "}
                {o.apartGehouden.map((a, k) => (
                  <span key={a.pad}>{k > 0 ? ", " : ""}<Link p={a.pad} /> ({intentieTekst(a.intentie) || "andere zoekintentie"})</span>
                ))}
                . Deze pagina&rsquo;s gaan over dezelfde woorden, maar de bezoeker wil er iets anders.
                Samenvoegen zou daar één van de twee groepen kosten.
              </p>
            </div>
          )}

          <button type="button" className="btn btn-quiet btn-klein" onClick={() => setOpen((m) => ({ ...m, [o.sleutel]: !m[o.sleutel] }))}>
            {open[o.sleutel] ? "▾ minder" : "▸ waarom dit één pagina moet worden"}
          </button>
          {open[o.sleutel] && (
            <div className="opr-uitleg">
              <div className="opr-bewijs">
                <p>
                  Deze {o.paginas.length} pagina&rsquo;s gaan alle drie over hetzelfde: mensen die zoeken op
                  {o.termen.slice(0, 3).map((t, k) => (
                    <span key={k}>{k > 0 ? ", " : " "}<strong>&ldquo;{t.keyword}&rdquo;</strong>{t.volume ? ` (${t.volume} per maand)` : ""}</span>
                  ))} komen bij een van deze pagina&rsquo;s terecht, of bij geen enkele.
                  Bij elkaar is dit onderwerp <strong>ongeveer {o.volumeTotaal} zoekopdrachten per maand</strong> waard.
                </p>
                <p>
                  {o.bestePositie != null
                    ? <>De beste plek die de site hierop haalt is <strong>plek {Math.round(o.bestePositie)}</strong>. Dat is buiten de eerste pagina van Google, dus er komt vrijwel niemand op af. Niet omdat het onderwerp te moeilijk is, maar omdat de aandacht over {o.paginas.length} pagina&rsquo;s verdeeld is: elk daarvan is een half antwoord.</>
                    : <>Geen van deze pagina&rsquo;s komt op dit moment in de resultaten voor. De aandacht is verdeeld over {o.paginas.length} pagina&rsquo;s die geen van alle af zijn.</>}
                </p>
                {o.haalbaarheid && o.haalbaarheid.oordeel !== "onbekend" && (
                  <p><strong>Is dit te winnen?</strong> {o.haalbaarheid.uitleg}</p>
                )}
                {o.euro && <p><strong>Wat het waard is:</strong> {o.euro.uitleg}</p>}
                <p>
                  <strong>Wat we doen:</strong> één pagina wordt de vaste pagina voor dit onderwerp, en de andere gaan
                  daarin op. Het voorstel is <Link p={o.voorstel} />
                  {o.geenPassendeThuisbasis
                    ? <>, maar alleen omdat die van dit rijtje het dichtst in de buurt komt. Hij gaat eigenlijk over
                      iets anders dan &ldquo;{o.hoofdterm || titel(o)}&rdquo;, dus een inhoudelijk passende pagina
                      elders op de site is hier de betere bestemming.</>
                    : <>, omdat die het onderwerp het beste dekt én er het beste voor staat. Niet alleen op verkeer
                      gekozen: de pagina met de meeste vertoningen gaat soms over een veel kleiner onderwerp, en dan
                      krijg je een pagina met een naam die niet klopt bij waar mensen op zoeken.</>}
                  {" "}Dat is een voorstel, geen besluit: een andere keuze kan prima, zolang het er maar één wordt.
                </p>
              </div>
            </div>
          )}
        </div>
      ))}

      {!alleenLezen && mailVoor && (
        <MailVenster
          slug={slug}
          titel="Mail dit voorstel naar de klant"
          onderwerpVan={`Het onderwerp "${titel(mailVoor)}" bundelen`}
          taak={`Uitleg aan de klant: waarom de pagina's over "${titel(mailVoor)}" tot één pagina worden gebundeld.`}
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
