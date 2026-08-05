"use client";

import { useEffect, useState } from "react";
import { OrgDataForm, type OrgFormData } from "../../../admin/client/[slug]/OrgDataPanel";

// De klantkant van de bedrijfsgegevens-pagina: intro (wat/waarom/wat we nodig
// hebben), daarna het formulier. Bewerken kan zolang de gegevens niet vergrendeld
// zijn; daarna alleen-lezen.
export default function OrgShareClient({ token }: { token: string }) {
  const [data, setData] = useState<OrgFormData | null>(null);
  const [locked, setLocked] = useState(false);
  const [clientName, setClientName] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let off = false;
    fetch(`/api/share/org?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((d) => {
        if (off) return;
        if (d.ok) { setData(d.data); setLocked(!!d.locked); setClientName(d.clientName || ""); }
        else setErr(d.error || "Deze link is niet (meer) geldig.");
      })
      .catch(() => { if (!off) setErr("De pagina kon niet geladen worden."); });
    return () => { off = true; };
  }, [token]);

  async function save() {
    if (!data || busy || locked) return;
    setBusy(true); setMsg("");
    try {
      const d = await fetch("/api/share/org", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, data }) }).then((r) => r.json());
      setMsg(d.ok ? "Bedankt! De gegevens zijn opgeslagen. Je mag de pagina sluiten of nog verder aanvullen." : d.error || "Opslaan mislukt.");
    } catch { setMsg("Opslaan mislukt; probeer het nog eens."); } finally { setBusy(false); }
  }

  return (
    <div className="org-share-page">
      <div className="org-share-inner">
        <div className="org-share-brand">Pingwin Online Marketing</div>
        <h1>Bedrijfsgegevens{clientName ? ` van ${clientName}` : ""}</h1>

        <div className="org-share-intro">
          <h2>Waar is dit voor?</h2>
          <p>
            Wij werken aan de vindbaarheid van jullie website. Een belangrijk onderdeel daarvan is
            <strong> structured data</strong>: onzichtbare, gestructureerde informatie in de code van de site
            die zoekmachines en AI-assistenten (zoals Google, ChatGPT en Perplexity) precies vertelt wie
            jullie zijn, wat jullie doen, waar jullie zitten en hoe jullie bereikbaar zijn.
          </p>
          <h2>Waarom is dit belangrijk?</h2>
          <ul>
            <li>Google kan jullie bedrijf beter tonen: met adres, openingstijden, reviews en logo direct in de zoekresultaten.</li>
            <li>AI-zoekmachines begrijpen beter wie jullie zijn, waardoor jullie vaker als bron worden genoemd in AI-antwoorden.</li>
            <li>Alle vermeldingen (website, Google, sociale media) worden aan elkaar geknoopt tot één herkenbaar geheel.</li>
          </ul>
          <h2>Wat vragen we van jullie?</h2>
          <p>
            Wij hebben hieronder alvast zoveel mogelijk ingevuld op basis van jullie website en openbare bronnen
            (zoals het KVK-register en jullie Google-vermelding). Sommige dingen kunnen wij niet zelf vinden of controleren. Loop de velden na, corrigeer wat niet klopt en vul aan wat ontbreekt.
            De velden die wij nog nodig hebben en die nog leeg zijn, staan <strong>in het rood</strong> met de melding
            &ldquo;ontbreekt nog&rdquo;; die zijn dus het belangrijkst. Hebben jullie meerdere vestigingen, vul dan per
            vestiging het adres, telefoonnummer en de openingstijden in.
            Klik daarna op <strong>Opslaan</strong>. Wij verwerken het vervolgens in de site: eerst site-breed
            (de vaste bedrijfsinformatie op elke pagina) en daarna per pagina (bijvoorbeeld dienst-, product- of
            behandelinformatie).
          </p>
          <p className="org-share-note">
            Belangrijk: vul alleen gegevens in die kloppen en die ook zichtbaar (mogen) zijn voor bezoekers.
            Zoekmachines controleren of deze informatie overeenkomt met wat er op de site staat.
          </p>
        </div>

        {err && <div className="org-share-error">{err}</div>}
        {locked && !err && (
          <div className="org-share-locked">Deze gegevens zijn inmiddels bevestigd en vergrendeld. Klopt er toch iets niet meer? Neem dan contact op met Pingwin.</div>
        )}
        {data && (
          <>
            <OrgDataForm data={data} onChange={setData} disabled={locked || busy} />
            {!locked && (
              <div className="org-share-save">
                <button type="button" className="primary-btn" onClick={save} disabled={busy}>{busy ? "Opslaan…" : "Opslaan"}</button>
                {msg && <span className="saved-msg">{msg}</span>}
              </div>
            )}
          </>
        )}
        {!data && !err && <div className="muted">Laden…</div>}
      </div>
    </div>
  );
}
