"use client";

import { useEffect, useState } from "react";

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
  onKlaar: () => void;
  onSluit: () => void;
}) {
  const [laden, setLaden] = useState(true);
  const [taak, setTaak] = useState("");
  const [toelichting, setToelichting] = useState("");
  const [docs, setDocs] = useState<Doc[]>([]);
  const [gekozen, setGekozen] = useState<Record<string, boolean>>({});
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");

  useEffect(() => {
    let off = false;
    fetch(`/api/admin/weekplan/dev?slug=${encodeURIComponent(slug)}&id=${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        if (!d?.ok) { setFout(d?.error || "Kon de gegevens niet ophalen."); setLaden(false); return; }
        setTaak(String(d.taak || "").replace(/<[^>]*>/g, "").trim());
        setToelichting(String(d.toelichting || ""));
        setDocs(Array.isArray(d.docs) ? d.docs : []);
        // Nog nooit doorgezet? Dan staat er niets aangevinkt: kiezen is de hele
        // bedoeling van dit venster, en een standaardvinkje zou die keuze weer
        // uit handen nemen.
        const v: Record<string, boolean> = {};
        for (const u of (d.gekozen || []) as string[]) v[u] = true;
        setGekozen(v);
        setLaden(false);
      })
      .catch(() => { if (!off) { setFout("Kon de gegevens niet ophalen."); setLaden(false); } });
    return () => { off = true; };
  }, [slug, id]);

  async function doorzetten() {
    if (bezig) return;
    setBezig(true); setFout("");
    try {
      const d = await fetch("/api/admin/weekplan/dev", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug, id, naarDev: true, taak, toelichting,
          docs: docs.filter((x) => gekozen[x.url]),
        }),
      }).then((r) => r.json());
      if (d?.ok) onKlaar();
      else setFout(d?.error || "Doorzetten mislukte.");
    } catch { setFout("Doorzetten mislukte."); }
    finally { setBezig(false); }
  }

  const aantal = docs.filter((d) => gekozen[d.url]).length;

  return (
    <div className="wp-mail-overlay" onClick={(e) => { if (e.target === e.currentTarget) onSluit(); }}>
      <div className="wp-mail-modal dev-doorzet">
        <div className="wp-mail-head">
          <span className="wp-mail-title">Naar de developer</span>
          <button type="button" className="wp-icon wp-del" title="Sluiten" onClick={onSluit}>×</button>
        </div>
        <div className="wp-mail-sub muted">Over: {kaartTitel}</div>

        {laden ? <div className="muted" style={{ padding: "12px 0" }}>Bezig met ophalen…</div> : (
          <>
            <label className="dev-veld">
              <span className="dev-veld-label">Wat moet er gebeuren</span>
              <input value={taak} onChange={(e) => setTaak(e.target.value)} placeholder="De opdracht zoals de sitebouwer hem leest" />
            </label>

            <label className="dev-veld">
              <span className="dev-veld-label">Opmerkingen voor de developer</span>
              <textarea rows={4} value={toelichting} onChange={(e) => setToelichting(e.target.value)}
                placeholder="Bijvoorbeeld: gebruik de herziene tekst van de klant, niet de copy uit de blauwdruk." />
            </label>

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
              <button type="button" className="ghost-btn small" onClick={onSluit}>Annuleren</button>
              <button type="button" className="primary-btn small" disabled={bezig || !taak.trim()} onClick={() => void doorzetten()}>
                {bezig ? "Bezig…" : "Zet op de developerlijst"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
