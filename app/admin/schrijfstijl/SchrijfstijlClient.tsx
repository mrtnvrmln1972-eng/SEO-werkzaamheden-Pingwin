"use client";

import { useState } from "react";
import type { Schrijfstijl } from "../../../lib/schrijfstijl";

function datum(s: string): string {
  if (!s) return "nog nooit";
  return new Date(s).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

export default function SchrijfstijlClient({ start }: { start: Schrijfstijl | null }) {
  const [stijl, setStijl] = useState<Schrijfstijl | null>(start);
  const [profiel, setProfiel] = useState(start?.profiel || "");
  const [bezig, setBezig] = useState(false);
  const [msg, setMsg] = useState("");
  const [fout, setFout] = useState("");

  async function opnieuw() {
    setBezig(true); setFout(""); setMsg("");
    try {
      const d = await fetch("/api/admin/schrijfstijl", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opnieuw: true }),
      }).then((r) => r.json());
      if (d?.ok) {
        setStijl(d.stijl); setProfiel(d.stijl?.profiel || "");
        setMsg(`Opnieuw afgeleid uit ${d.stijl?.aantalMails || 0} van je eigen mails.`);
      } else setFout(d?.error || "Afleiden mislukte.");
    } catch { setFout("De assistent is niet bereikbaar."); }
    finally { setBezig(false); }
  }

  async function bewaar() {
    setBezig(true); setFout(""); setMsg("");
    try {
      const d = await fetch("/api/admin/schrijfstijl", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profiel, voorbeelden: stijl?.voorbeelden || [] }),
      }).then((r) => r.json());
      if (d?.ok) { setStijl(d.stijl); setMsg("Bewaard. De maandelijkse ronde laat jouw versie voortaan met rust."); }
      else setFout(d?.error || "Bewaren mislukte.");
    } catch { setFout("Bewaren mislukte."); }
    finally { setBezig(false); }
  }

  return (
    <div className="section stijl-wrap">
      <div className="ck-section-head">Hoe jij schrijft</div>
      <p className="muted stijl-intro">
        Dit profiel gaat mee in élke mail die het dashboard aan een klant voorstelt, zodat een concept
        klinkt als een mail van jou en niet als algemeen net Nederlands. Het is afgeleid uit je eigen
        verzonden mails aan klanten. Mails aan collega&rsquo;s en partners tellen niet mee, want dat is
        een andere toon, en mails die dit dashboard zelf heeft verstuurd ook niet, want dat is
        AI-tekst en daarvan leren maakt het profiel elke ronde een beetje minder jou.
      </p>

      <div className="stijl-balk">
        <span className="muted">
          Laatst afgeleid: <strong>{datum(stijl?.gemaaktOp || "")}</strong>
          {stijl?.aantalMails ? `, uit ${stijl.aantalMails} mails` : ""}
          {stijl?.handmatig ? " · door jou aangepast" : ""}
        </span>
        <button type="button" className="ghost-btn small" disabled={bezig} onClick={opnieuw}>
          {bezig ? "Bezig…" : "Opnieuw afleiden uit mijn mails"}
        </button>
      </div>

      {fout && <div className="stijl-fout">{fout}</div>}
      {msg && <div className="stijl-ok">{msg}</div>}

      <label className="stijl-veld">
        <span className="stijl-label">Het profiel</span>
        <textarea
          value={profiel}
          onChange={(e) => setProfiel(e.target.value)}
          rows={14}
          placeholder="Nog niet afgeleid. Klik op “Opnieuw afleiden uit mijn mails”."
        />
      </label>

      {!!stijl?.voorbeelden?.length && (
        <div className="stijl-voorbeelden">
          <span className="stijl-label">Zinnen van jou, als ijkpunt voor de toon</span>
          <ul>{stijl.voorbeelden.map((v, i) => <li key={i}>{v}</li>)}</ul>
          <p className="muted stijl-klein">
            Voorbeelden sturen beter dan bijvoeglijke naamwoorden: &ldquo;direct en warm&rdquo; kan alle
            kanten op, een echte zin van jou niet.
          </p>
        </div>
      )}

      <div className="stijl-knoppen">
        <button type="button" className="btn" disabled={bezig} onClick={bewaar}>Bewaren</button>
      </div>
    </div>
  );
}
