"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// ═══════════════════════════════════════════════════════════
// DOORZETTEN NAAR DE DEVELOPER
// ═══════════════════════════════════════════════════════════
// Doorzetten was één klik en daarmee een gok: de kaarttitel werd de opdracht, de
// bouw-regels werden de opmerking, en er ging geen enkel document mee. De
// sitebouwer las dan "zet de nieuwe copy live" zonder de copy erbij.
//
// Nu kies je eerst wat er meegaat. En dat is een echte keuze, geen formaliteit:
// ligt er een herziene tekst van de klant, dan moet díe de site op en niet onze
// eigen copy uit de blauwdruk. Alleen jij weet welke van de twee het is.
//
// De doorgeefversie staat los van de kaart: je mag de opdracht voor de bouwer
// anders formuleren zonder dat je eigen kaart verandert.
// ═══════════════════════════════════════════════════════════

type Doc = { label: string; url: string };

export default function DevDoorzetten({ slug, id, kaartTitel, onKlaar, onSluit }: {
  slug: string;
  id: number;
  kaartTitel: string;
  onKlaar: (mailen: boolean) => void;
  onSluit: () => void;
}) {
  const [laden, setLaden] = useState(true);
  const [taak, setTaak] = useState("");
  const [toelichting, setToelichting] = useState("");
  const [hintTaak, setHintTaak] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [gekozen, setGekozen] = useState<Record<string, boolean>>({});
  // Wat er straks meetbaar af moet zijn. Dit is het verschil tussen een afspraak
  // en een belofte: hierna kun je met één knop nameten of het gebeurd is.
  const [puntKeuzes, setPuntKeuzes] = useState<{ id: string; label: string }[]>([]);
  const [punten, setPunten] = useState<Record<string, boolean>>({});
  const [url, setUrl] = useState("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  // Ook zónder dat er meteen een mail achteraan gaat wil je soms na een paar
  // dagen zelf checken of de sitebouwer de taak heeft opgepakt. Uit tenzij je
  // hem aanzet; zeven dagen is de gebruikelijke termijn.
  const [herinner, setHerinner] = useState(false);
  const [herinnerDagen, setHerinnerDagen] = useState(7);

  useEffect(() => {
    let off = false;
    fetch(`/api/admin/weekplan/dev?slug=${encodeURIComponent(slug)}&id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        if (!d?.ok) { setFout(d?.error || "Kon de gegevens niet ophalen."); setLaden(false); return; }
        // Leeg beginnen: dit zijn jouw woorden voor de sitebouwer. Laat je ze
        // leeg, dan gaat de kaarttekst mee zoals hij is.
        setTaak(String(d.taak || "").replace(/<[^>]*>/g, "").trim());
        setToelichting(String(d.toelichting || ""));
        setHintTaak(String(d.voorstelTaak || "").replace(/<[^>]*>/g, "").trim());
        setDocs(Array.isArray(d.docs) ? d.docs : []);
        setUrl(String(d.url || ""));
        setPuntKeuzes(Array.isArray(d.puntKeuzes) ? d.puntKeuzes : []);
        const p: Record<string, boolean> = {};
        for (const id of (d.punten || []) as string[]) p[id] = true;
        setPunten(p);
        // De pagina staat standaard aan (daar moet het gebeuren); welke tekst
        // meegaat kies je zelf, want dat is precies de keuze waar dit venster voor is.
        const v: Record<string, boolean> = {};
        for (const u of (d.gekozen || []) as string[]) v[u] = true;
        setGekozen(v);
        setLaden(false);
      })
      .catch(() => { if (!off) { setFout("Kon de gegevens niet ophalen."); setLaden(false); } });
    return () => { off = true; };
  }, [slug, id]);

  // Op een lijst zetten is niet hetzelfde als iemand op de hoogte brengen. Daarom
  // standaard meteen de mail erachteraan; uitzetten kan als je hem later stuurt.
  const [mailErachteraan, setMailErachteraan] = useState(true);

  async function doorzetten() {
    if (bezig) return;
    setBezig(true); setFout("");
    try {
      const d = await fetch("/api/admin/weekplan/dev", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, id, naarDev: true, taak, toelichting, kaartTitel, url,
          docs: docs.filter((x) => gekozen[x.url]),
          punten: puntKeuzes.filter((p) => punten[p.id]).map((p) => p.id),
          herinnerDagen: herinner ? herinnerDagen : 0,
        }),
      }).then((r) => r.json());
      if (d?.ok) onKlaar(mailErachteraan);
      else setFout(d?.error || "Doorzetten mislukte.");
    } catch { setFout("Doorzetten mislukte."); }
    finally { setBezig(false); }
  }

  const aantal = docs.filter((d) => gekozen[d.url]).length;

  // Buiten de kaart om, rechtstreeks in de pagina gehangen. Dit venster hing in de
  // kaart zelf en kroop daardoor net wel, net niet onder de kopbalk vandaan; los
  // van de kaart zweeft het altijd netjes midden op het scherm.
  if (typeof document === "undefined") return null;

  return createPortal(
    <div className="wp-mail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <div className="wp-mail-modal dev-doorzet">
        <div className="wp-mail-head">
          <span className="wp-mail-title">Zet klaar voor de sitebouwer</span>
          <button type="button" className="wp-icon wp-del" title="Sluiten" onClick={onSluit}>×</button>
        </div>
        <div className="wp-mail-sub muted">Over: {kaartTitel}</div>

        {laden ? <div className="muted" style={{ padding: "var(--s-3) 0" }}>Bezig met ophalen…</div> : (
          <>
            <label className="dev-veld">
              <span className="dev-veld-label">Wat moet er gebeuren <span className="muted">(leeg laten = de kaarttekst gaat mee)</span></span>
              <input value={taak} onChange={(e) => setTaak(e.target.value)} placeholder={hintTaak || "De opdracht zoals de sitebouwer hem leest"} />
            </label>

            <label className="dev-veld">
              <span className="dev-veld-label">Opmerkingen voor de developer</span>
              <textarea rows={4} value={toelichting} onChange={(e) => setToelichting(e.target.value)}
                placeholder="Bijvoorbeeld: gebruik de herziene tekst van de klant, niet de copy uit de blauwdruk." />
            </label>

            {puntKeuzes.length > 0 && (
              <div className="dev-veld">
                <span className="dev-veld-label">
                  Wat moet er straks meetbaar af zijn <span className="muted">(hier meet de knop &ldquo;Gedaan?&rdquo; op de kaart later op)</span>
                </span>
                <div className="dev-doc-keuze">
                  {puntKeuzes.map((p) => (
                    <label key={p.id} className="dev-doc-optie">
                      <input type="checkbox" checked={!!punten[p.id]}
                        onChange={(e) => setPunten((v) => ({ ...v, [p.id]: e.target.checked }))} />
                      <span className="dev-doc-naam">{p.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="dev-veld">
              <span className="dev-veld-label">
                Documenten die meegaan {aantal > 0 && <span className="muted">({aantal} gekozen)</span>}
              </span>
              {docs.length === 0
                ? <div className="muted">Er zijn nog geen documenten bij deze pagina.</div>
                : (
                  <div className="dev-doc-keuze">
                    {docs.map((d) => (
                      <label key={d.url} className="dev-doc-optie">
                        <input type="checkbox" checked={!!gekozen[d.url]}
                          onChange={(e) => setGekozen((v) => ({ ...v, [d.url]: e.target.checked }))} />
                        <span className="dev-doc-naam">{d.label}</span>
                        <a href={d.url} target="_blank" rel="noreferrer" className="dev-doc-open" onClick={(e) => e.stopPropagation()}>bekijk</a>
                      </label>
                    ))}
                  </div>
                )}
            </div>

            {fout && <div className="login-error wp-mail-fout">{fout}</div>}

            <div className="wp-mail-foot">
              <label className="wp-mail-herinner" title="Opent meteen de mail aan de sitebouwer, met deze kaart als onderwerp">
                <input type="checkbox" checked={mailErachteraan} onChange={(e) => setMailErachteraan(e.target.checked)} />
                <span>Daarna meteen de sitebouwer mailen</span>
              </label>
              <label className="wp-mail-herinner" title="Op die dag verschijnt er een melding bij het belletje in de kopbalk">
                <input type="checkbox" checked={herinner} onChange={(e) => setHerinner(e.target.checked)} />
                <span>Herinner me over</span>
                <input type="number" min={1} max={90} value={herinnerDagen} disabled={!herinner}
                  onChange={(e) => setHerinnerDagen(Math.min(90, Math.max(1, Number(e.target.value) || 1)))} />
                <span>dagen om te checken</span>
              </label>
              <button type="button" className="btn btn-klein" onClick={onSluit}>Annuleren</button>
              <button type="button" className="btn btn-primary btn-klein" disabled={bezig} onClick={() => void doorzetten()}>
                {bezig ? "Bezig…" : "Zet op de developerlijst"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
