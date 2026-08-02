"use client";

// De afwerkpagina voor de sitebouwer: twee banen die tegelijk lopen.
// Baan 1 (mensenwerk): afbeeldingen uniek maken, met de knop "Alles uniek,
// controleer maar" die het dashboard zelf laat nameten. Baan 2: per pagina de
// kant-en-klare meta's en alt-teksten, met kopieerknop en afvinkvakje per punt.
// Het groene "gecontroleerd door Pingwin"-vinkje zet het dashboard zelf na een
// live-meting; zo hoeft niemand elkaar te mailen of na te lopen.

import { useEffect, useState } from "react";

type Alt = { file: string; alt: string; dubbel: boolean };
type Pagina = { url: string; path: string; curTitle: string; curDesc: string; newTitle: string; newDesc: string; copyDoc: string; alts: Alt[] };
type Mark = { done: boolean; doneBy: string; verified: boolean };

export default function WerklijstShare({ token }: { token: string }) {
  const [pages, setPages] = useState<Pagina[]>([]);
  const [dubbel, setDubbel] = useState<{ file: string; paths: string[] }[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [clientName, setClientName] = useState("");
  const [fout, setFout] = useState("");
  const [laden, setLaden] = useState(true);
  const [naam, setNaam] = useState("");
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");
  const [kopie, setKopie] = useState("");

  // Sleutels moeten exact matchen met de server (lib/dev-worklist.ts).
  const urlKeyOf = (u: string) => { try { const x = new URL(u); return (x.host + x.pathname).replace(/\/+$/, "").toLowerCase(); } catch { return (u || "").toLowerCase(); } };
  const normFile = (f: string) => f.toLowerCase().replace(/-\d+x\d+(?=\.[a-z0-9]+$)/, "");
  const mKey = (url: string, veld: "title" | "desc") => `m|${urlKeyOf(url)}|${veld}`;
  const aKey = (url: string, file: string) => `a|${urlKeyOf(url)}|${normFile(file)}`;

  async function laad() {
    try {
      const d = await fetch(`/api/share/werklijst?token=${encodeURIComponent(token)}`).then((r) => r.json());
      if (d?.ok) { setPages(d.pages || []); setDubbel(d.dubbel || []); setMarks(d.marks || {}); setClientName(d.clientName || ""); }
      else setFout(d?.error || "Kon de werklijst niet laden.");
    } catch { setFout("Kon de werklijst niet laden; ververs de pagina."); }
    finally { setLaden(false); }
  }
  useEffect(() => {
    try { setNaam(window.localStorage.getItem("pingwin-werklijst-naam") || ""); } catch { /* leeg */ }
    void laad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function vink(key: string, done: boolean) {
    setMarks((m) => ({ ...m, [key]: { done, doneBy: naam, verified: m[key]?.verified || false } }));
    try { window.localStorage.setItem("pingwin-werklijst-naam", naam); } catch { /* leeg */ }
    await fetch("/api/share/werklijst", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: "vink", key, done, door: naam }) }).catch(() => {});
  }

  async function kopieer(tekst: string, id: string) {
    try { await navigator.clipboard.writeText(tekst); setKopie(id); setTimeout(() => setKopie(""), 1500); } catch { /* leeg */ }
  }

  async function controle() {
    setCheckBusy(true); setCheckMsg("");
    try {
      const d = await fetch("/api/share/werklijst", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, action: "controle" }) }).then((r) => r.json());
      if (d?.ok) { setCheckMsg(d.samenvatting || "Gecontroleerd."); await laad(); }
      else setCheckMsg(d?.error || "Controleren mislukte; probeer het nog een keer.");
    } catch { setCheckMsg("Controleren mislukte; probeer het nog een keer."); }
    finally { setCheckBusy(false); }
  }

  // Voortgang: alle punten met sleutel.
  const alleKeys: string[] = [];
  for (const p of pages) {
    if (p.newTitle) alleKeys.push(mKey(p.url, "title"));
    if (p.newDesc) alleKeys.push(mKey(p.url, "desc"));
    for (const a of p.alts) alleKeys.push(aKey(p.url, a.file));
  }
  const gedaan = alleKeys.filter((k) => marks[k]?.done || marks[k]?.verified).length;
  const geverifieerd = alleKeys.filter((k) => marks[k]?.verified).length;
  const pct = alleKeys.length ? Math.round((gedaan / alleKeys.length) * 100) : 0;

  const Rij = ({ id, label, tekst, verified }: { id: string; label: string; tekst: string; verified: boolean }) => {
    const m = marks[id];
    return (
      <div className={"wl-rij" + ((m?.done || verified) ? " wl-rij-af" : "")}>
        <label className="wl-check" title="Vink af als je dit hebt doorgevoerd">
          <input type="checkbox" checked={!!m?.done || verified} onChange={(e) => void vink(id, e.target.checked)} />
        </label>
        <div className="wl-rij-body">
          <div className="wl-rij-label">{label}</div>
          <div className="wl-rij-tekst">{tekst}</div>
        </div>
        <button type="button" className="wl-kopieer" onClick={() => void kopieer(tekst, id)}>{kopie === id ? "Gekopieerd ✓" : "Kopieer"}</button>
        {verified && <span className="wl-verified" title="Het dashboard heeft live gecontroleerd dat dit er goed op staat">gecontroleerd</span>}
      </div>
    );
  };

  if (laden) return <div className="wl-wrap"><div className="wl-kaart">Werklijst laden…</div></div>;
  if (fout) return <div className="wl-wrap"><div className="wl-kaart">{fout}</div></div>;

  return (
    <div className="wl-wrap">
      <div className="wl-kop">
        <div className="wl-logo">Pingwin <span>Online Marketing</span></div>
        <h1>Werklijst website{clientName ? ` ${clientName}` : ""}</h1>
        <p className="wl-intro">Alles staat hier kant-en-klaar: kopieer de tekst, zet hem in WordPress en vink af. Het dashboard controleert automatisch of het live staat (het groene &ldquo;gecontroleerd&rdquo;); je hoeft dus niets terug te melden behalve de knop hieronder bij stap 1.</p>
        <div className="wl-voortgang">
          <div className="wl-balk"><div className="wl-balk-vul" style={{ width: `${pct}%` }} /></div>
          <span>{gedaan} van {alleKeys.length} gedaan · {geverifieerd} door Pingwin gecontroleerd</span>
        </div>
        <label className="wl-naam">Je naam (voor de vinkjes): <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bijv. Sander" /></label>
      </div>

      {dubbel.length > 0 && (
        <div className="wl-kaart wl-stap1">
          <h2>Stap 1: maak deze afbeeldingen uniek</h2>
          <p>Deze afbeeldingen staan op meerdere pagina&rsquo;s. Een alt-tekst hangt aan de afbeelding zelf, dus die klopt dan maar op één plek. Vervang ze per pagina door een eigen foto (of hernoem het bestand per pagina), en druk daarna op de knop hieronder.</p>
          <ul className="wl-dubbel">
            {dubbel.map((d, i) => <li key={i}><strong>{d.file}</strong> staat op: {d.paths.join(", ")}</li>)}
          </ul>
          <button type="button" className="wl-knop" disabled={checkBusy} onClick={() => void controle()}>{checkBusy ? "Controleren… (kan een paar minuten duren)" : "Alles uniek, controleer maar"}</button>
          {checkMsg && <p className="wl-checkmsg">{checkMsg}</p>}
        </div>
      )}

      <div className="wl-kaart">
        <h2>{dubbel.length ? "Stap 2: meta's en alt-teksten per pagina" : "Meta's en alt-teksten per pagina"}</h2>
        {pages.map((p) => {
          const items = (p.newTitle ? 1 : 0) + (p.newDesc ? 1 : 0) + p.alts.length;
          const af = [p.newTitle && (marks[mKey(p.url, "title")]?.done || marks[mKey(p.url, "title")]?.verified), p.newDesc && (marks[mKey(p.url, "desc")]?.done || marks[mKey(p.url, "desc")]?.verified), ...p.alts.map((a) => marks[aKey(p.url, a.file)]?.done || marks[aKey(p.url, a.file)]?.verified)].filter(Boolean).length;
          return (
            <div key={p.url} className="wl-pagina">
              <div className="wl-pagina-kop">
                <a href={p.url} target="_blank" rel="noreferrer">{p.path}</a>
                <span className="wl-pagina-teller">{af}/{items}</span>
              </div>
              {p.copyDoc && <p className="wl-copydoc">De meta&rsquo;s van deze pagina staan in het copydocument: <a href={p.copyDoc} target="_blank" rel="noreferrer">open het document</a>.</p>}
              {p.newTitle && <Rij id={mKey(p.url, "title")} label="Nieuwe meta-title" tekst={p.newTitle} verified={!!marks[mKey(p.url, "title")]?.verified} />}
              {p.newDesc && <Rij id={mKey(p.url, "desc")} label="Nieuwe meta-description" tekst={p.newDesc} verified={!!marks[mKey(p.url, "desc")]?.verified} />}
              {p.alts.map((a) => (
                <div key={a.file}>
                  <Rij id={aKey(p.url, a.file)} label={`Alt-tekst voor ${a.file}${a.dubbel ? " (staat op meerdere pagina's, zie stap 1)" : ""}`} tekst={a.alt || "(zelf beschrijven wat erop staat)"} verified={!!marks[aKey(p.url, a.file)]?.verified} />
                </div>
              ))}
            </div>
          );
        })}
        {pages.length === 0 && <p>Er staan geen open punten meer. Mooi werk!</p>}
      </div>
      <p className="wl-voet">Vragen? Mail Maarten (Pingwin Online Marketing). Deze pagina wordt automatisch bijgewerkt.</p>
    </div>
  );
}
