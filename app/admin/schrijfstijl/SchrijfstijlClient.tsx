"use client";

import { useState } from "react";
import AdminKop from "../AdminKop";
import { mdToHtml } from "../../../lib/markdown";
import type { Schrijfstijl } from "../../../lib/schrijfstijl";

function datum(s: string): string {
  if (!s) return "nog nooit";
  return new Date(s).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
}

export default function SchrijfstijlClient({ start }: { start: Schrijfstijl | null }) {
  const [stijl, setStijl] = useState<Schrijfstijl | null>(start);
  const [profiel, setProfiel] = useState(start?.profiel || "");
  const [bewerkt, setBewerkt] = useState(false);
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
        setStijl(d.stijl); setProfiel(d.stijl?.profiel || ""); setBewerkt(false);
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
      if (d?.ok) { setStijl(d.stijl); setBewerkt(false); setMsg("Bewaard. De maandelijkse ronde laat jouw versie voortaan met rust."); }
      else setFout(d?.error || "Bewaren mislukte.");
    } catch { setFout("Bewaren mislukte."); }
    finally { setBezig(false); }
  }

  return (
    <>
      <AdminKop titel="Hoe jij schrijft" />

      <div className="beheer-container">
        <div className="card beheer-kop">
          <h1 className="beheer-h1">Hoe jij schrijft</h1>
          <p className="beheer-uitleg">
            Dit profiel gaat mee in <strong>elke mail</strong> die het dashboard aan een klant voorstelt, zodat
            een concept klinkt als een mail van jou en niet als algemeen net Nederlands.
          </p>
          <ul className="beheer-lijst">
            <li><strong>Afgeleid uit je eigen verzonden mails aan klanten.</strong> Mails aan collega&rsquo;s en
              partnerbureaus tellen niet mee, want daar heb je een andere toon.</li>
            <li><strong>Niet uit mails die dit dashboard zelf verstuurde.</strong> Dat is AI-tekst, en daarvan
              leren maakt het profiel elke ronde een beetje minder jou.</li>
            <li><strong>Wat jij hier aanpast blijft staan.</strong> Zodra je bewaart, laat de maandelijkse ronde
              jouw versie met rust.</li>
          </ul>
        </div>

        <div className="card beheer-blok">
          <div className="beheer-balk">
            <span className="muted">
              Laatst afgeleid: <strong>{datum(stijl?.gemaaktOp || "")}</strong>
              {stijl?.aantalMails ? `, uit ${stijl.aantalMails} mails` : ""}
              {stijl?.handmatig ? " · door jou aangepast" : ""}
            </span>
            <button type="button" className="ghost-btn small" disabled={bezig} onClick={opnieuw}>
              {bezig ? "Bezig…" : "Opnieuw afleiden uit mijn mails"}
            </button>
          </div>

          {fout && <div className="beheer-fout">{fout}</div>}
          {msg && <div className="beheer-ok">{msg}</div>}

          <div className="beheer-veld-kop">
            <h2 className="beheer-h2">Het profiel</h2>
            <button type="button" className="beheer-schakel" onClick={() => setBewerkt((v) => !v)}>
              {bewerkt ? "▾ klaar met aanpassen" : "▸ aanpassen"}
            </button>
          </div>

          {/*
            Nooit een kaal invulvak voor tekst die de assistent geschreven heeft: dat
            staat als harde regel in het projectgeheugen, en op 6 augustus stond deze
            tekst er tóch in. Gerenderd tonen is de norm; wil je bijschaven, dan is
            het veld bewerkbaar én blijft het gerenderd, hetzelfde patroon als in het
            mailvenster.
          */}
          {bewerkt ? (
            <div
              className="beheer-bewerk md"
              contentEditable
              suppressContentEditableWarning
              onBlur={(e) => setProfiel((e.target as HTMLDivElement).innerText)}
              dangerouslySetInnerHTML={{ __html: mdToHtml(profiel) }}
            />
          ) : profiel ? (
            <div className="beheer-lees md" dangerouslySetInnerHTML={{ __html: mdToHtml(profiel) }} />
          ) : (
            <p className="muted">Nog niet afgeleid. Klik op &ldquo;Opnieuw afleiden uit mijn mails&rdquo;.</p>
          )}

          {!!stijl?.voorbeelden?.length && (
            <>
              <h2 className="beheer-h2">Zinnen van jou, als ijkpunt voor de toon</h2>
              <ul className="beheer-citaten">{stijl.voorbeelden.map((v, i) => <li key={i}>{v}</li>)}</ul>
              <p className="muted beheer-klein">
                Voorbeelden sturen beter dan bijvoeglijke naamwoorden: &ldquo;direct en warm&rdquo; kan alle kanten
                op, een echte zin van jou niet.
              </p>
            </>
          )}

          <div className="beheer-knoppen">
            <button type="button" className="btn" disabled={bezig} onClick={bewaar}>Bewaren</button>
          </div>
        </div>
      </div>
    </>
  );
}
