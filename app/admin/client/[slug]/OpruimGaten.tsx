"use client";

// ═══════════════════════════════════════════════════════════
// DE ONTBREKENDE PAGINA'S
// ═══════════════════════════════════════════════════════════
// De vierde lijst, en de enige die niet over bestaande pagina's gaat. Opruimen
// maakt een site schoon; dit laat hem groeien. Een zoekterm van 800 per maand
// waar geen enkele pagina op mikt is een groter gemis dan drie dode pagina's
// samen, en hij stond nergens omdat er niets was om naar te kijken.
// ═══════════════════════════════════════════════════════════

import React, { useState } from "react";
import MailVenster from "./MailVenster";
import { KansChip, intentieTekst, type Haalbaarheid } from "./OpruimOppakken";

export type Gat = {
  term: string; volume: number; moeilijkheid: number | null; intentie?: string;
  haalbaarheid: Haalbaarheid; thema: string; dichtbij: string[];
  voorstelPad: string; soort: "nieuwe pagina" | "uitbreiden";
  euro?: { perMaand: number; perJaar: number; extraKlikkenPerMaand: number; doelPositie: number; uitleg: string } | null;
};

const bedrag = (n: number) => `€ ${Math.round(n).toLocaleString("nl-NL")}`;

export default function OpruimGaten({ slug, domain, rijen, clientName, clientEmail, alleenLezen = false }: {
  slug: string; domain: string; rijen: Gat[]; clientName?: string; clientEmail?: string; alleenLezen?: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [bezig, setBezig] = useState("");
  const [klaar, setKlaar] = useState<Record<string, string>>({});
  const [mailVoor, setMailVoor] = useState<Gat | null>(null);

  const site = (p: string) => `https://${(domain || "").replace(/^https?:\/\//, "").replace(/\/$/, "")}${p.startsWith("/") ? p : `/${p}`}`;
  const Link = ({ p }: { p: string }) => <a className="opr-pad" href={site(p)} target="_blank" rel="noreferrer">{p}</a>;

  async function naarWeekplan(g: Gat) {
    if (bezig) return;
    setBezig(g.term);
    try {
      const pad = g.voorstelPad.split("  (")[0];
      const d = await fetch("/api/admin/weekplan/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, week: 1, wie: "SEO", url: site(pad),
          taak: g.soort === "nieuwe pagina" ? `Nieuwe pagina voor "${g.term}"` : `${g.dichtbij[0]} uitbreiden met "${g.term}"`,
          toelichting: [
            `Er wordt ongeveer ${g.volume} keer per maand gezocht op "${g.term}", en geen enkele pagina van de site mikt daarop.`,
            g.soort === "uitbreiden" ? `Er staat al een pagina dichtbij (${g.dichtbij[0]}); dit hoort daarbij in plaats van op een aparte pagina.` : `Voorstel voor de URL: ${g.voorstelPad}.`,
            g.haalbaarheid?.uitleg || "",
            g.intentie ? `De bezoeker die dit intypt ${intentieTekst(g.intentie)}; daar moet de pagina op aansluiten.` : "",
            g.euro ? `Geschatte opbrengst: ${bedrag(g.euro.perMaand)} per maand.` : "",
            "Route: blauwdruk op basis van de top 10, daarna de copy.",
          ].filter(Boolean).join(" "),
        }),
      }).then((r) => r.json());
      setKlaar((m) => ({ ...m, [g.term]: d?.ok ? `Staat in week ${d.week}.` : (d?.error || "Toevoegen mislukte.") }));
    } catch { setKlaar((m) => ({ ...m, [g.term]: "Toevoegen mislukte." })); }
    finally { setBezig(""); }
  }

  function mailBlok(g: Gat): string {
    return [
      `## Er wordt gezocht op "${g.term}", maar de website heeft er geen pagina voor`,
      "",
      `Er wordt ongeveer **${g.volume} keer per maand** gezocht op "${g.term}"${g.intentie ? `, door iemand die ${intentieTekst(g.intentie)}` : ""}. Op de website staat op dit moment geen enkele pagina die daarover gaat, dus die bezoekers komen bij een concurrent terecht.`,
      "",
      g.soort === "uitbreiden"
        ? `Er staat wel een pagina in de buurt: ${g.dichtbij[0]}. Het onderwerp hoort daarbij, dus we breiden die pagina uit in plaats van er een nieuwe naast te zetten. Twee pagina's over bijna hetzelfde zouden elkaar weer in de weg gaan zitten.`
        : `Voorstel: een nieuwe pagina op ${g.voorstelPad.split("  (")[0]}.`,
      "",
      `**Is het haalbaar?** ${g.haalbaarheid?.uitleg || "Daar is op dit moment niets over te zeggen."}`,
      ...(g.euro ? ["", `**Wat het naar schatting oplevert:** ${g.euro.uitleg}`] : []),
      "",
      "De stappen: eerst kijken hoe de best scorende pagina's op deze zoekopdracht zijn opgebouwd, dan een opzet maken, dan de tekst schrijven.",
    ].join("\n");
  }

  if (!rijen.length) return null;

  const totaal = rijen.reduce((n, g) => n + (g.euro?.perMaand || 0), 0);
  const kansrijk = rijen.filter((g) => g.haalbaarheid?.oordeel === "kansrijk").length;

  return (
    <div className="opr-kaart">
      <div className="opr-kop">Wat er ontbreekt: pagina&rsquo;s die er nog niet zijn ({rijen.length})</div>
      <div className="opr-kaart-tekst">
        <p>
          De andere lijsten gaan over pagina&rsquo;s die er zijn. Deze gaat over de pagina&rsquo;s die er <strong>niet</strong> zijn.
          Hier wordt maandelijks op gezocht, in onderwerpen waar deze website al geloofwaardig in is, terwijl geen enkele
          pagina erop mikt. Die bezoekers komen nu bij een ander terecht.
        </p>
        <p>
          {kansrijk > 0 ? <>Daarvan {kansrijk === 1 ? "is er 1" : `zijn er ${kansrijk}`} <strong>kansrijk</strong>: de zoekterm is niet zwaarder dan wat deze website aankan. </> : null}
          {totaal > 0 ? <>Bij elkaar naar schatting <strong>{bedrag(totaal)} per maand</strong> aan gemiste omzet. Het aantal bezoekers is het harde deel van die som; het bedrag leunt op een geschatte conversie.</> : null}
        </p>
      </div>

      <div className="opr-scroll">
        <table className="opr-tabel">
          <thead>
            <tr>
              <th>Waar op gezocht wordt</th>
              <th>Per maand</th>
              <th>Kans</th>
              <th>Bezoeker</th>
              <th>Wat er moet gebeuren</th>
              {totaal > 0 && <th>Waarde</th>}
              {!alleenLezen && <th>Actie</th>}
              <th>Waarom</th>
            </tr>
          </thead>
          <tbody>
            {rijen.map((g) => (
              <React.Fragment key={g.term}>
              <tr>
                <td><strong>{g.term}</strong></td>
                <td>{g.volume}x</td>
                <td><KansChip h={g.haalbaarheid} /></td>
                <td>{intentieTekst(g.intentie) || <span className="opr-leeg">&mdash;</span>}</td>
                <td>
                  {g.soort === "uitbreiden"
                    ? <>uitbreiden: <Link p={g.dichtbij[0]} /></>
                    : <><span className="opr-chip merge">nieuwe pagina</span> <span className="opr-pad">{g.voorstelPad.split("  (")[0]}</span></>}
                </td>
                {totaal > 0 && (
                  <td>
                    {g.euro ? (
                      <span title={g.euro.uitleg}>
                        <strong>{bedrag(g.euro.perMaand)}</strong>
                        <span className="opr-eind-slokt" style={{ display: "block" }}>{g.euro.extraKlikkenPerMaand} bezoekers/mnd</span>
                      </span>
                    ) : <span className="opr-leeg">&mdash;</span>}
                  </td>
                )}
                {!alleenLezen && (
                  <td>
                    <button type="button" className="btn btn-klein opr-btn" disabled={!!bezig} onClick={() => void naarWeekplan(g)}
                      title="Zet dit als taak op de weekplanning: blauwdruk en copy.">
                      {bezig === g.term ? "Bezig…" : "Zet op de weekplanning"}
                    </button>
                    <button type="button" className="btn btn-klein opr-btn" onClick={() => setMailVoor(g)}>Mail naar klant</button>
                    {klaar[g.term] && <div className="opr-melding" style={{ marginTop: "var(--s-1)" }}>{klaar[g.term]}</div>}
                  </td>
                )}
                <td className="opr-reden">
                  <button type="button" className="btn btn-quiet btn-klein" onClick={() => setOpen((m) => ({ ...m, [g.term]: !m[g.term] }))}>
                    {open[g.term] ? "▾ minder" : "▸ reden"}
                  </button>
                </td>
              </tr>
              {/* De onderbouwing als eigen rij over alle kolommen. */}
              {open[g.term] && (
                <tr className="opr-redenrij">
                  <td colSpan={9}>
                    <div className="opr-uitleg">
                      <div className="opr-bewijs">
                        <p>
                          Deze zoekterm kwam boven vanuit <strong>&ldquo;{g.thema}&rdquo;</strong>, een onderwerp waarop deze
                          website al meedoet in Google. Daar wordt omheen gezocht op &ldquo;{g.term}&rdquo;,
                          ongeveer {g.volume} keer per maand, en daar heeft de site niets voor.
                        </p>
                        {g.dichtbij.length > 0 && (
                          <p>
                            Het dichtst in de buurt {g.dichtbij.length === 1 ? "komt" : "komen"}{" "}
                            {g.dichtbij.map((p, k) => <span key={p}>{k > 0 ? ", " : ""}<Link p={p} /></span>)}.
                            {g.soort === "uitbreiden"
                              ? " Dat ligt zo dicht bij dit onderwerp dat een aparte pagina ze allebei zou verzwakken; dit hoort daar gewoon bij."
                              : " Die gaan er nét niet over, dus een eigen pagina is hier op zijn plaats."}
                          </p>
                        )}
                        {g.haalbaarheid && g.haalbaarheid.oordeel !== "onbekend" && (
                          <p><strong>Is het te winnen?</strong> {g.haalbaarheid.uitleg}</p>
                        )}
                        {g.euro && <p><strong>Wat het waard is:</strong> {g.euro.uitleg}</p>}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {!alleenLezen && mailVoor && (
        <MailVenster
          slug={slug}
          titel="Mail dit voorstel naar de klant"
          onderwerpVan={`Gemiste kans: "${mailVoor.term}"`}
          taak={`Uitleg aan de klant: er wordt gezocht op "${mailVoor.term}" en de website heeft er geen pagina voor.`}
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
