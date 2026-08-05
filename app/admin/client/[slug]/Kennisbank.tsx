"use client";

// Structured data-kennisbank: de centrale verzamelbak op de Klant-tab. Maarten
// sleept of plakt hier alles in (documenten, artsen-gegevens, schema-code); het
// dashboard structureert dat tot entiteiten met een voorstel dat hij eerst
// bevestigt. Het rode lijstje toont wat er voor dit soort bedrijf nog mist.

import { useEffect, useRef, useState } from "react";
import { mdToHtml } from "../../../../lib/markdown";

type Entiteit = { id: number; categorie: string; naam: string; velden: Record<string, string>; bron: string; updatedAt: string };
type Voorstel = { id: number; bron: string; samenvatting: string; entiteiten: { categorie: string; naam: string; velden: Record<string, string>; oordeel: string }[] };

const CAT_LABEL: Record<string, string> = { organisatie: "Organisatie", persoon: "Personen", locatie: "Locaties", dienst: "Diensten", overig: "Overig" };
const CAT_VOLGORDE = ["organisatie", "persoon", "locatie", "dienst", "overig"];
const OORDEEL: Record<string, string> = { nieuw: "nieuw", aanvulling: "aanvulling", ouder: "let op: ouder" };

export default function Kennisbank({ slug, onVerwerkt }: { slug: string; onVerwerkt?: () => void }) {
  const [entiteiten, setEntiteiten] = useState<Entiteit[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [voorstellen, setVoorstellen] = useState<Voorstel[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState("");
  const [fout, setFout] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [plakVeld, setPlakVeld] = useState("");
  const [bezigMet, setBezigMet] = useState("");
  const kiesRef = useRef<HTMLInputElement | null>(null);

  async function laad() {
    const d = await fetch(`/api/admin/schema-knowledge?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) { setEntiteiten(d.entities || []); setGaps(d.gaps || []); setVoorstellen(d.proposals || (d.proposal ? [d.proposal] : [])); }
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  async function verstuur(init: RequestInit, foutTekst: string) {
    setBusy("lezen"); setFout(""); setOkMsg("");
    try {
      const d = await fetch("/api/admin/schema-knowledge", init).then((r) => r.json());
      if (d?.ok) {
        setPlakVeld("");
        if (Array.isArray(d.fouten) && d.fouten.length) setFout(`Niet gelukt: ${d.fouten.join(" · ")}`);
        await laad();
      } else setFout(d?.error || foutTekst);
    } catch { setFout(foutTekst); }
    finally { setBusy(""); setBezigMet(""); }
  }

  // Alle bestanden tegelijk, in blokjes: eerder werd bij een stapel alleen het
  // bovenste bestand verwerkt en verdwenen de rest zonder melding.
  async function drop(files: File[]) {
    if (!files.length) return;
    setBusy("lezen"); setFout(""); setOkMsg("");
    const mislukt: string[] = [];
    for (let i = 0; i < files.length; i += 3) {
      const groep = files.slice(i, i + 3);
      setBezigMet(`${Math.min(i + groep.length, files.length)} van ${files.length}: ${groep.map((f) => f.name).join(", ")}`);
      const form = new FormData();
      form.append("slug", slug);
      for (const f of groep) form.append("file", f);
      try {
        const d = await fetch("/api/admin/schema-knowledge", { method: "POST", body: form }).then((r) => r.json());
        if (!d?.ok) mislukt.push(d?.error || groep.map((f) => f.name).join(", "));
        else if (Array.isArray(d.fouten) && d.fouten.length) mislukt.push(...d.fouten);
      } catch { mislukt.push(groep.map((f) => f.name).join(", ")); }
    }
    setBezigMet(""); setBusy("");
    if (mislukt.length) setFout(`Niet gelukt: ${mislukt.join(" · ")}`);
    await laad();
  }
  function plak() {
    const v = plakVeld.trim();
    if (!v) return;
    const isLink = /^https?:\/\//i.test(v) && /drive\.google|docs\.google/.test(v);
    void verstuur({ method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(isLink ? { action: "link", slug, driveLink: v } : { action: "tekst", slug, tekst: v }) }, "Kon dit niet verwerken.");
  }
  function melding(d: { verwerkt?: number; nieuweVestigingen?: number; nieuweArtsen?: number }): string {
    const extra = [
      d.nieuweVestigingen ? `${d.nieuweVestigingen} nieuwe vestiging${d.nieuweVestigingen === 1 ? "" : "en"}` : "",
      d.nieuweArtsen ? `${d.nieuweArtsen} nieuwe arts${d.nieuweArtsen === 1 ? "" : "en"}` : "",
    ].filter(Boolean).join(" en ");
    return `${d.verwerkt || 0} gegevens verwerkt en doorgezet naar de bedrijfsgegevens hierboven${extra ? `, waaronder ${extra}` : ""}. Wat nog ontbreekt staat daar in het rood.`;
  }

  async function besluit(actie: "verwerk" | "negeer", id: number) {
    setBusy(`${actie}-${id}`); setFout("");
    try {
      const d = await fetch("/api/admin/schema-knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: actie, slug, id }) }).then((r) => r.json());
      if (d?.ok) {
        if (actie === "verwerk") { setOkMsg(melding(d)); onVerwerkt?.(); }
        void laad();
      }
      else setFout(d?.error || "Dat lukte niet.");
    } catch { setFout("Dat lukte niet; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  async function verwerkAlles() {
    setBusy("alles"); setFout(""); setOkMsg("");
    try {
      const d = await fetch("/api/admin/schema-knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verwerkAlles", slug }) }).then((r) => r.json());
      if (d?.ok) { setOkMsg(`${d.voorstellen || 0} aanleveringen verwerkt. ${melding(d)}`); onVerwerkt?.(); void laad(); }
      else setFout(d?.error || "Dat lukte niet.");
    } catch { setFout("Dat lukte niet; probeer het nog een keer."); }
    finally { setBusy(""); }
  }
  // Alles wat al in de kennisbank staat alsnog in de bedrijfsgegevens zetten.
  async function zetInVelden() {
    setBusy("velden"); setFout(""); setOkMsg("");
    try {
      const d = await fetch("/api/admin/schema-knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "toepassen", slug }) }).then((r) => r.json());
      if (d?.ok) {
        const extra = [
          d.nieuweVestigingen ? `${d.nieuweVestigingen} vestiging${d.nieuweVestigingen === 1 ? "" : "en"}` : "",
          d.nieuweArtsen ? `${d.nieuweArtsen} arts${d.nieuweArtsen === 1 ? "" : "en"}` : "",
        ].filter(Boolean).join(" en ");
        const schoon = d.opgeruimd ? ` ${d.opgeruimd} dubbele regel${d.opgeruimd === 1 ? "" : "s"} samengevoegd.` : "";
        setOkMsg((d.gevuld
          ? `De bedrijfsgegevens hierboven zijn bijgewerkt${extra ? ` met ${extra}` : ""}. Wat nog ontbreekt staat daar in het rood.`
          : "De bedrijfsgegevens waren al bij (of staan op slot); er viel niets meer te vullen.") + schoon);
        onVerwerkt?.();
        void laad();
      } else setFout(d?.error || "Dat lukte niet.");
    } catch { setFout("Dat lukte niet."); }
    finally { setBusy(""); }
  }

  async function verwijder(id: number, naam: string) {
    if (!window.confirm(`"${naam}" uit de kennisbank halen? Hij verdwijnt uit het overzicht, uit het rode lijstje en uit de structured data.`)) return;
    setBusy(`weg-${id}`); setFout("");
    try {
      const d = await fetch("/api/admin/schema-knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verwijder", slug, id }) }).then((r) => r.json());
      if (d?.ok) void laad(); else setFout(d?.error || "Verwijderen lukte niet.");
    } catch { setFout("Verwijderen lukte niet."); }
    finally { setBusy(""); }
  }

  async function ruimOp() {
    setBusy("opruimen"); setFout(""); setOkMsg("");
    try {
      const d = await fetch("/api/admin/schema-knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "opruimen", slug }) }).then((r) => r.json());
      if (d?.ok) { setOkMsg(d.opgeruimd ? `${d.opgeruimd} dubbele regels samengevoegd.` : "Geen dubbele regels gevonden."); void laad(); }
      else setFout(d?.error || "Opruimen lukte niet.");
    } catch { setFout("Opruimen lukte niet."); }
    finally { setBusy(""); }
  }

  async function maakTaak() {
    setBusy("taak"); setFout("");
    try {
      const d = await fetch("/api/admin/schema-knowledge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "taak", slug }) }).then((r) => r.json());
      if (d?.ok) setOkMsg("Kaart aangemaakt in de weekplanning met het uitvraaglijstje.");
      else setFout(d?.error || "Kon geen kaart maken.");
    } catch { setFout("Kon geen kaart maken."); }
    finally { setBusy(""); }
  }

  // Laatste stand structured data (app-breed, via websearch; maandelijks verversen).
  const [stand, setStand] = useState<{ datum: string; tekst: string; verouderd: boolean } | null>(null);
  const [standOpen, setStandOpen] = useState(false);
  useEffect(() => {
    fetch("/api/admin/schema-actueel").then((r) => r.json()).then((d) => { if (d?.ok) setStand(d.stand || null); }).catch(() => {});
  }, []);
  async function ververStand() {
    setBusy("stand"); setFout("");
    try {
      const d = await fetch("/api/admin/schema-actueel", { method: "POST" }).then((r) => r.json());
      if (d?.ok) { setStand(d.stand); setStandOpen(true); }
      else setFout(d?.error || "Onderzoek mislukte.");
    } catch { setFout("Onderzoek mislukte; probeer het nog een keer."); }
    finally { setBusy(""); }
  }
  const standDatum = stand ? new Date(stand.datum).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "";

  const perCat = CAT_VOLGORDE.map((c) => ({ cat: c, items: entiteiten.filter((e) => e.categorie === c) })).filter((g) => g.items.length);

  return (
    <div className="kb-wrap">
      <div className="org-sitewide-head" style={{ marginTop: 18 }}>
        <strong>Kennisbank structured data</strong>
        <span className="muted">Gooi hier alles in: documenten, artsen-gegevens, schema-code. Verwerken gebeurt pas na jouw akkoord; daarna vult het de velden hierboven vanzelf.</span>
        <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void zetInVelden()}>{busy === "velden" ? "Bezig…" : "Kennisbank in de velden zetten"}</button>
        <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void ruimOp()}>{busy === "opruimen" ? "Bezig…" : "Dubbelen samenvoegen"}</button>
      </div>
      <div className={"wp-docdrop" + (drag ? " wp-docdrop-actief" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void drop(Array.from(e.dataTransfer.files || [])); }}>
        {busy === "lezen" ? <span className="muted">Materiaal lezen en structureren… {bezigMet}</span> : (
          <>
            <input ref={kiesRef} type="file" multiple style={{ display: "none" }}
              onChange={(e) => { void drop(Array.from(e.target.files || [])); e.target.value = ""; }} />
            <span className="wp-docdrop-tekst">
              Sleep hier je bestanden naartoe, meerdere tegelijk mag (pdf, docx, txt, md, json, csv, ook scans en foto&rsquo;s)
              {" "}of <button type="button" className="wp-chat-toggle" onClick={() => kiesRef.current?.click()}>kies ze uit een map</button>
            </span>
            <span className="wp-docdrop-of">of plak tekst of een Drive-link:</span>
            <span className="wp-docdrop-linkrij">
              <input className="wp-docdrop-input" value={plakVeld} placeholder="Tekst of https://docs.google.com/…"
                onChange={(e) => setPlakVeld(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") plak(); }} />
              <button type="button" className="wp-fase-btn" disabled={!plakVeld.trim() || !!busy} onClick={plak}>Lees</button>
            </span>
          </>
        )}
      </div>
      {voorstellen.length > 1 && (
        <div className="kb-voorstel-balk">
          <strong>{voorstellen.length} aanleveringen wachten op je akkoord.</strong>
          <button type="button" className="wp-fase-btn wp-fase-btn-primair" disabled={!!busy} onClick={() => void verwerkAlles()}>
            {busy === "alles" ? "Verwerken…" : `Verwerk alle ${voorstellen.length}`}
          </button>
        </div>
      )}
      {voorstellen.map((voorstel) => (
        <div className="wp-docvoorstel" key={voorstel.id}>
          <div className="wp-docvoorstel-kop">Voorstel uit &ldquo;{voorstel.bron}&rdquo; ({voorstel.entiteiten.length} gegevens)</div>
          <div className="wp-docvoorstel-tekst">{voorstel.samenvatting}</div>
          <ul className="kb-voorstel-lijst">
            {voorstel.entiteiten.map((e, i) => (
              <li key={i}>
                <span className="wp-docversie-kind">{CAT_LABEL[e.categorie] || e.categorie}: {e.naam}</span>
                <span className={"wp-doc-vergelijk" + (e.oordeel === "ouder" ? " wp-doc-ouder" : "")}>{OORDEEL[e.oordeel] || ""}</span>
                <span className="muted kb-velden">{Object.entries(e.velden).map(([k, v]) => `${k}: ${v}`).join(" · ")}</span>
              </li>
            ))}
          </ul>
          <div className="wp-docvoorstel-acties">
            <button type="button" className="wp-fase-btn wp-fase-btn-primair" disabled={!!busy} onClick={() => void besluit("verwerk", voorstel.id)}>{busy === `verwerk-${voorstel.id}` ? "Verwerken…" : "Verwerk in kennisbank"}</button>
            <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void besluit("negeer", voorstel.id)}>Negeer</button>
            <span className="muted">Bestaande gegevens blijven bewaard; nieuwe waarden vullen aan.</span>
          </div>
        </div>
      ))}
      {okMsg && <div className="wp-doc-ok">{okMsg}</div>}
      {fout && <div className="wp-doc-fout">{fout}</div>}
      {gaps.length > 0 && (
        <div className="kb-gaps">
          <div className="kb-gaps-kop">Nog aan te leveren ({gaps.length}) &mdash; dit zijn dezelfde velden die hierboven rood staan</div>
          <ul>{gaps.map((r, i) => <li key={i}>{r}</li>)}</ul>
          <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void maakTaak()}>{busy === "taak" ? "Bezig…" : "Zet als kaart in de weekplanning"}</button>
        </div>
      )}
      <div className="kb-stand">
        <div className="kb-stand-kop">
          <button type="button" className="wp-chat-toggle" onClick={() => setStandOpen(!standOpen)}>
            Laatste stand structured data {stand ? `(${standDatum})` : ""} {standOpen ? "▾" : "▸"}
          </button>
          {stand?.verouderd && <span className="kb-stand-oud">ouder dan een maand</span>}
          <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void ververStand()}>{busy === "stand" ? "Onderzoeken… (kan een minuut duren)" : stand ? "Ververs" : "Onderzoek nu"}</button>
        </div>
        {standOpen && stand && <div className="md kb-stand-tekst" dangerouslySetInnerHTML={{ __html: mdToHtml(stand.tekst) }} />}
        {!stand && <div className="muted">Nog geen onderzoek gedaan; klik op &ldquo;Onderzoek nu&rdquo; voor de actuele richtlijnen (Google en AI) en hoe wij ze toepassen.</div>}
      </div>
      {perCat.length > 0 && (
        <div className="kb-entiteiten">
          {perCat.map((g) => (
            <div key={g.cat} className="kb-cat">
              <div className="kb-cat-kop">{CAT_LABEL[g.cat]} ({g.items.length})</div>
              <ul>
                {g.items.map((e) => (
                  <li key={e.id}>
                    <strong>{e.naam}</strong>
                    {e.categorie === "locatie" && !(/\d/.test(e.velden.adres || "") || (e.velden.postcode || "").trim()) && (
                      <span className="kb-geen-vestiging" title="Zonder bezoekadres tellen we dit niet als vestiging; het vraagt dus ook niet om openingstijden.">geen vestiging</span>
                    )}
                    <span className="muted kb-velden">{Object.entries(e.velden).map(([k, v]) => `${k}: ${v}`).join(" · ") || "(nog geen details)"}</span>
                    <button type="button" className="kb-weg" title="Uit de kennisbank halen" disabled={!!busy}
                      onClick={() => void verwijder(e.id, e.naam)}>&times;</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
