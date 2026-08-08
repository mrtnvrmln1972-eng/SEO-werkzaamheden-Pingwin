"use client";

// Structured data-kennisbank: de centrale verzamelbak op de Klant-tab. Maarten
// sleept of plakt hier alles in (documenten, artsen-gegevens, schema-code); het
// dashboard structureert dat tot entiteiten met een voorstel dat hij eerst
// bevestigt. Het rode lijstje toont wat er voor dit soort bedrijf nog mist.

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Entiteit = { id: number; categorie: string; naam: string; velden: Record<string, string>; bron: string; updatedAt: string };
type Voorstel = { id: number; bron: string; samenvatting: string; entiteiten: { categorie: string; naam: string; velden: Record<string, string>; oordeel: string }[] };

const CAT_LABEL: Record<string, string> = { organisatie: "Organisatie", persoon: "Personen", locatie: "Locaties", dienst: "Diensten", overig: "Overig" };
const CAT_VOLGORDE = ["organisatie", "persoon", "locatie", "dienst", "overig"];
const OORDEEL: Record<string, string> = { nieuw: "nieuw", aanvulling: "aanvulling", ouder: "let op: ouder" };

// `actiesSlot`: DOM-knoop uit de knoppenrij van OrgDataPanel (een lege span
// met een ref). De dropzone en de twee knoppen worden daar via een portal in
// gerenderd, zodat ze fysiek in die rij staan terwijl de logica (state, drop-
// afhandeling) hier in Kennisbank blijft, waar hij hoort.
export default function Kennisbank({ slug, onVerwerkt, voorActie, actiesSlot }: { slug: string; onVerwerkt?: () => void; voorActie?: () => Promise<boolean | void>; actiesSlot?: HTMLElement | null }) {
  const [entiteiten, setEntiteiten] = useState<Entiteit[]>([]);
  const [gaps, setGaps] = useState<string[]>([]);
  const [voorstellen, setVoorstellen] = useState<Voorstel[]>([]);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState("");
  const [fout, setFout] = useState("");
  const [okMsg, setOkMsg] = useState("");
  const [plakVeld, setPlakVeld] = useState("");
  const [bezigMet, setBezigMet] = useState("");
  const [dropOpen, setDropOpen] = useState(false);
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
    setDropOpen(true); // ook bij slepen op de kleine dropzone blijft de voortgang zichtbaar
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
    await voorActie?.(); // eerst bewaren wat in het formulier openstaat, anders gaat dat verloren
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
    await voorActie?.(); // eerst bewaren wat in het formulier openstaat, anders gaat dat verloren
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
    await voorActie?.(); // eerst bewaren wat in het formulier openstaat, anders gaat dat verloren
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
          : entiteiten.length === 0
            ? (voorstellen.length
              ? "De kennisbank is nog leeg: de aanlevering hieronder wacht nog op je akkoord. Verwerk die eerst, dan landen de gegevens vanzelf in de velden."
              : "De kennisbank is nog leeg; sleep eerst materiaal in de dropzone.")
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
      if (d?.ok) setOkMsg(d.bijgewerkt ? "De bestaande kaart in de weekplanning is bijgewerkt met de actuele lijst." : "Kaart aangemaakt in de weekplanning met het uitvraaglijstje.");
      else setFout(d?.error || "Kon geen kaart maken.");
    } catch { setFout("Kon geen kaart maken."); }
    finally { setBusy(""); }
  }

  const perCat = CAT_VOLGORDE.map((c) => ({ cat: c, items: entiteiten.filter((e) => e.categorie === c) })).filter((g) => g.items.length);

  // ── Het overzicht: tabjes per categorie, nette kaartjes in plaats van een muur tekst ──
  const [actieveTab, setActieveTab] = useState("");
  const tabCat = perCat.some((g) => g.cat === actieveTab) ? actieveTab : (perCat[0]?.cat || "");
  const [openRest, setOpenRest] = useState(false);
  const [openKaart, setOpenKaart] = useState<Record<number, boolean>>({});
  // Het hele tabjes-blok (organisatie, locaties, diensten, ...) staat default
  // dicht: de kennisbank is ruwe aanlevering met bron per gegeven, de bevestigde
  // bedrijfsgegevens erboven zijn het formulier dat daaruit gevuld wordt. Wie dat
  // detail niet nodig heeft, ziet alleen de dropzone en wat er nog ontbreekt.
  const [detailOpen, setDetailOpen] = useState(false);
  const [gapsOpen, setGapsOpen] = useState(false);
  // Alleen een locatie met huisnummer of postcode is een vestiging.
  const isVestiging = (e: Entiteit) => /\d/.test(e.velden.adres || "") || !!(e.velden.postcode || "").trim();
  // Velden die over onze eigen administratie gaan horen niet in beeld.
  const INTERN = /^(schemaid|bronbestand|bron|opmerking|actie_\d+|id)$/i;
  const LABELS: Record<string, string> = {
    adres: "Adres", postcode: "Postcode", plaats: "Plaats", telefoon: "Telefoon", email: "E-mail",
    openingstijden: "Openingstijden", functie: "Functie", specialisatie: "Specialisatie", big: "BIG-nummer",
    linkedin: "LinkedIn", profielUrl: "Pagina", foto: "Foto", omschrijving: "Omschrijving", kvk: "KVK",
    btw: "BTW-id", logo: "Logo", oprichtingsjaar: "Opgericht", sameAs: "Profielen", mapsUrl: "Google Maps",
    vestigingen: "Werkt bij", priceRange: "Prijsindicatie", areaServed: "Werkgebied", bedrijfstype: "Bedrijfstype",
  };
  const isLink = (v: string) => /^https?:\/\//i.test(v.trim());
  const kaart = (e: Entiteit) => {
    const velden = Object.entries(e.velden).filter(([k, v]) => !INTERN.test(k) && String(v || "").trim());
    const open = !!openKaart[e.id];
    return (
      <div className="kb-kaart" key={e.id}>
        <button type="button" className="kb-kaart-kop" onClick={() => setOpenKaart({ ...openKaart, [e.id]: !open })}>
          <span className="kb-groep-caret">{open ? "▾" : "▸"}</span>
          <strong className="kb-kaart-naam">{e.naam}</strong>
          {e.categorie === "locatie" && !isVestiging(e) && (
            <span className="kb-geen-vestiging" title="Zonder bezoekadres tellen we dit niet als vestiging; het vraagt dus ook niet om openingstijden.">geen vestiging</span>
          )}
          {velden.length > 0 && <span className="kb-groep-aantal">{velden.length}</span>}
          <span className="kb-weg" title="Uit de kennisbank halen"
            onClick={(ev) => { ev.stopPropagation(); if (!busy) void verwijder(e.id, e.naam); }}>&times;</span>
        </button>
        {open && (velden.length ? (
          <dl className="kb-kaart-velden">
            {velden.map(([k, v]) => (
              <div className="kb-veld" key={k}>
                <dt>{LABELS[k] || k}</dt>
                <dd>{isLink(v) ? <a href={v} target="_blank" rel="noreferrer">{v.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "")}</a> : v}</dd>
              </div>
            ))}
          </dl>
        ) : <div className="muted">Nog geen details bekend.</div>)}
      </div>
    );
  };

  // De dropzone + de twee knoppen: fysiek in de knoppenrij van OrgDataPanel
  // via een portal, zolang die rij al gemount is; anders (heel even, of als
  // deze component ergens los gebruikt wordt) gewoon hier inline.
  const acties = (
    <>
      <div className={"kb-dropzone-mini" + (drag ? " kb-dropzone-mini-actief" : "")}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); void drop(Array.from(e.dataTransfer.files || [])); }}
        onClick={() => setDropOpen((v) => !v)}
        title="Sleep hier bestanden op, of klik om te bladeren of tekst/een link te plakken">
        + document
      </div>
      <span className="org-kb-workflow-pijl" aria-hidden="true">→</span>
      <button type="button" className="btn btn-ghost btn-klein" onClick={() => void zetInVelden()}
        disabled={!!busy || entiteiten.length === 0}
        title={entiteiten.length === 0
          ? (voorstellen.length ? "De kennisbank is nog leeg; verwerk eerst de aanlevering hieronder." : "De kennisbank is nog leeg; sleep er eerst materiaal in.")
          : "Zet alles wat in de kennisbank staat in de velden hierboven. Bestaande waarden blijven staan, alleen lege velden worden aangevuld."}>
        {busy === "velden" ? "Bezig…" : "In velden zetten"}
      </button>
      <button type="button" className="btn btn-ghost btn-klein" disabled={!!busy} onClick={() => void ruimOp()}
        title="Voegt dubbele of overlappende regels samen, bijvoorbeeld dezelfde vestiging die uit twee documenten kwam.">
        {busy === "opruimen" ? "Bezig…" : "Ontdubbelen"}
      </button>
    </>
  );

  return (
    <div className="kb-wrap">
      {actiesSlot ? createPortal(acties, actiesSlot) : <div className="kb-head-right">{acties}</div>}
      {dropOpen && (
        <div className="kb-dropzone-pop">
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
                  <button type="button" className="btn btn-ghost btn-klein" disabled={!plakVeld.trim() || !!busy} onClick={plak}>Lees</button>
                </span>
                <button type="button" className="kb-dropzone-sluit" onClick={() => setDropOpen(false)} title="Dropzone weer klein maken">&times;</button>
              </>
            )}
          </div>
        </div>
      )}
      {/* Ook bij één aanlevering: zonder deze stap belandt er niets in de velden,
          en dan lijkt het alsof de knop hierboven stuk is. */}
      {voorstellen.length > 0 && (
        <div className="kb-voorstel-balk">
          <strong>
            {voorstellen.length === 1 ? "1 aanlevering wacht" : `${voorstellen.length} aanleveringen wachten`} op je akkoord.
          </strong>
          <span className="muted">Pas na verwerken komen de gegevens in de velden hierboven.</span>
          <button type="button" className="wp-fase-btn wp-fase-btn-primair" disabled={!!busy} onClick={() => void verwerkAlles()}>
            {busy === "alles" ? "Verwerken…" : voorstellen.length === 1 ? "Verwerk en zet in de velden" : `Verwerk alle ${voorstellen.length} en zet in de velden`}
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
          <button type="button" className="kb-gaps-kop kb-gaps-kop-btn" onClick={() => setGapsOpen((v) => !v)}>
            <span className="kb-groep-caret">{gapsOpen ? "▾" : "▸"}</span>
            <span>Nog aan te leveren ({gaps.length})</span>
          </button>
          {gapsOpen && (
            <>
              <div className="muted" style={{ fontSize: "var(--fs-xs)", marginBottom: "var(--s-1)" }}>Dit is wat er ná het verwerken van al het materiaal hierboven nog steeds ontbreekt; overlapt met wat er nu al rood staat in het formulier, maar is niet exact hetzelfde lijstje.</div>
              <ul>{gaps.map((r, i) => <li key={i}>{r}</li>)}</ul>
              <button type="button" className="wp-fase-btn" disabled={!!busy} onClick={() => void maakTaak()}>{busy === "taak" ? "Bezig…" : "Zet als kaart in de weekplanning"}</button>
            </>
          )}
        </div>
      )}
      {perCat.length > 0 && (
        <section className="org-sec kb-detail-sec">
          <button type="button" className="org-sec-kop" onClick={() => setDetailOpen((v) => !v)}>
            <span className="org-sec-caret">{detailOpen ? "▾" : "▸"}</span>
            <span>Kennisbank per categorie</span>
            <span className="org-sec-aantal">{entiteiten.length}</span>
          </button>
          {detailOpen && (
            <div className="kb-tabs-wrap">
              <div className="kb-tabs" role="tablist">
                {perCat.map((g) => (
                  <button type="button" key={g.cat} role="tab" aria-selected={g.cat === tabCat}
                    className={"kb-tab" + (g.cat === tabCat ? " kb-tab-actief" : "")} onClick={() => setActieveTab(g.cat)}>
                    {CAT_LABEL[g.cat] || g.cat}<span className="kb-tab-aantal">{g.items.length}</span>
                  </button>
                ))}
              </div>
              {perCat.filter((g) => g.cat === tabCat).map((g) => {
                const echt = g.cat === "locatie" ? g.items.filter((e) => isVestiging(e)) : g.items;
                const rest = g.cat === "locatie" ? g.items.filter((e) => !isVestiging(e)) : [];
                return (
                  <div key={g.cat} className="kb-tab-body">
                    {echt.map((e) => kaart(e))}
                    {rest.length > 0 && (
                      <div className="kb-subgroep">
                        <button type="button" className="kb-groep-kop kb-groep-kop-klein" onClick={() => setOpenRest(!openRest)}>
                          <span className="kb-groep-caret">{openRest ? "▾" : "▸"}</span>
                          <span className="kb-groep-titel">Zonder bezoekadres, geen vestiging</span>
                          <span className="kb-groep-aantal">{rest.length}</span>
                        </button>
                        {openRest && <div className="kb-groep-body">{rest.map((e) => kaart(e))}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
