"use client";

// De Pingwin-versie van de afwerkpagina. Zelfde lijst als de sitebouwer ziet
// (hetzelfde component), maar met drie dingen erbij:
//   1. de huidige meta boven ons voorstel, zodat je ziet wat er verandert;
//   2. de knop "Voer door in de site", per regel, per pagina en voor alles;
//   3. per afbeelding de indeling omzetten (moet wel of niet uniek zijn).
// Doorvoeren doet Pingwin, niet de sitebouwer; die knoppen staan hier dus wel
// en op de deelpagina niet.

import { useEffect, useState } from "react";
import Link from "next/link";
import WerklijstLijst, { mKey, aKey, type Pagina, type Alt, type Mark, type DubbelItem, type Doorvoer, type Overslag } from "../../../../_werklijst/WerklijstLijst";
import type { ImageSoort } from "../../../../../lib/image-classify";

export default function WerklijstAdmin({ slug }: { slug: string }) {
  const [pages, setPages] = useState<Pagina[]>([]);
  const [images, setImages] = useState<Alt[]>([]);
  const [overslag, setOverslag] = useState<Overslag>({ altBeeld: 0, paginas: 0, perPagina: 0 });
  const [dubbel, setDubbel] = useState<DubbelItem[]>([]);
  const [marks, setMarks] = useState<Record<string, Mark>>({});
  const [clientName, setClientName] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [laden, setLaden] = useState(true);
  const [fout, setFout] = useState("");
  const [bezig, setBezig] = useState("");
  const [melding, setMelding] = useState("");
  const [checkBusy, setCheckBusy] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");

  async function laad() {
    try {
      const d = await fetch(`/api/admin/dev-worklist?slug=${encodeURIComponent(slug)}&vol=1`).then((r) => r.json());
      if (d?.ok) {
        setPages(d.pages || []); setImages(d.images || []); setDubbel(d.dubbel || []);
        setOverslag(d.overslag || { altBeeld: 0, paginas: 0, perPagina: 0 });
        setMarks(d.marks || {}); setClientName(d.clientName || ""); setShareToken(d.shareToken || "");
      }
      else setFout(d?.error || "Kon de werklijst niet laden.");
    } catch { setFout("Kon de werklijst niet laden; ververs de pagina."); }
    finally { setLaden(false); }
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  async function vink(key: string, done: boolean) {
    setMarks((m) => ({ ...m, [key]: { done, doneBy: "Pingwin", verified: m[key]?.verified || false } }));
    await fetch("/api/admin/dev-worklist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "vink", key, done, door: "Pingwin" }) }).catch(() => {});
  }

  async function zetSoort(file: string, soort: ImageSoort) {
    await fetch("/api/admin/dev-worklist", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "soort", file, soort }) }).catch(() => {});
    await laad();
  }

  /** Eén doorvoer-aanroep, met de melding die de server teruggeeft. */
  async function push(payload: Record<string, unknown>): Promise<string> {
    const d = await fetch("/api/admin/dev-worklist/push", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...payload }) }).then((r) => r.json()).catch(() => null);
    return d?.ok ? (d.melding || "Doorgevoerd.") : (d?.error || "Doorvoeren mislukte.");
  }

  /** Hoeveel staat er klaar om door te voeren? Voor de bevestigingstekst. */
  function klaarstaand() {
    const metas = pages.filter((p) => p.newTitle || p.newDesc).length;
    const alts = images.filter((a) => a.altNodig !== false && a.alt.trim()).length;
    const zonderTekst = images.filter((a) => a.altNodig !== false && !a.alt.trim()).length;
    return { metas, alts, zonderTekst };
  }

  async function doorvoer(o: Doorvoer) {
    // De twee bulkknoppen zitten in de blokken zelf; ze vragen eerst om een
    // bevestiging, want dit gaat direct de live site van de klant op.
    if (o.wat === "alle-meta" || o.wat === "alle-alt") {
      const { metas, alts, zonderTekst } = klaarstaand();
      const tekst = o.wat === "alle-meta"
        ? `Hiermee zetten we de meta's van ${metas} pagina's direct op de live site van ${clientName || slug}.\n\nDoorgaan?`
        : `Hiermee zetten we ${alts} alt-teksten direct op de live site van ${clientName || slug}.`
          + (zonderTekst ? ` ${zonderTekst} afbeeldingen blijven staan omdat daar nog geen tekst voor geschreven is.` : "")
          + "\n\nDoorgaan?";
      if (!window.confirm(tekst)) return;
      setBezig(o.wat); setMelding("");
      try {
        setMelding(await push({ wat: o.wat === "alle-meta" ? "meta" : "alt" }));
        await laad();
      } finally { setBezig(""); }
      return;
    }

    const id = o.wat === "pagina" ? `pagina|${o.url}` : o.wat === "alt" ? aKey(o.file || "") : mKey(o.url || "", o.veld || "title");
    setBezig(id); setMelding("");
    try {
      // "Deze pagina" gaat alleen nog over de meta's: alt-teksten hangen aan de
      // afbeelding, niet aan de pagina, en staan in hun eigen blok.
      setMelding(await push({ wat: o.wat === "pagina" ? "meta" : o.wat, url: o.url, file: o.file, veld: o.veld }));
      await laad();
    } finally { setBezig(""); }
  }

  /** Alles in één keer, met een bevestiging in gewone taal. */
  async function allesDoorvoeren() {
    const { metas, alts, zonderTekst } = klaarstaand();
    const tekst = `Hiermee zetten we ${metas} pagina's met meta's en ${alts} alt-teksten direct op de live site van ${clientName || slug}.`
      + (zonderTekst ? ` ${zonderTekst} alt-teksten blijven staan omdat daar nog geen tekst voor geschreven is.` : "")
      + "\n\nDoorgaan?";
    if (!window.confirm(tekst)) return;
    setBezig("alles"); setMelding("");
    try {
      const m1 = await push({ wat: "meta" });
      const m2 = await push({ wat: "alt" });
      setMelding(`${m1} · ${m2}`);
      await laad();
    } finally { setBezig(""); }
  }

  async function controle() {
    setCheckBusy(true); setCheckMsg("");
    try {
      const d = await fetch("/api/admin/dev-worklist/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).then((r) => r.json());
      if (d?.ok) { setCheckMsg(d.samenvatting || "Gecontroleerd."); await laad(); }
      else setCheckMsg(d?.error || "Controleren mislukte; probeer het nog een keer.");
    } catch { setCheckMsg("Controleren mislukte; probeer het nog een keer."); }
    finally { setCheckBusy(false); }
  }

  if (laden) return <div className="wl-wrap"><div className="wl-kaart">Werklijst laden…</div></div>;
  if (fout) return <div className="wl-wrap"><div className="wl-kaart">{fout}</div></div>;

  const siteUrl = pages[0]?.url || "";

  return (
    <div className="wl-wrap">
      <div className="wl-kop">
        <div className="wl-logo">Pingwin <span>Online Marketing</span></div>
        <h1>Werklijst website{clientName ? ` ${clientName}` : ""}</h1>
        <p className="wl-intro">Dit is de Pingwin-versie: je ziet per pagina wat er nu staat én ons voorstel, en je kunt het met één klik doorvoeren in de site. De sitebouwer ziet dezelfde lijst zonder deze knoppen.</p>
        <div className="wl-adminbalk">
          <Link className="wl-terug" href={`/admin/client/${slug}`}>← terug naar de cockpit</Link>
          {shareToken && <a className="wl-terug" href={`/share/werklijst/${shareToken}`} target="_blank" rel="noreferrer">bekijk de versie van de sitebouwer</a>}
          <button type="button" className="wl-knop" disabled={!!bezig} onClick={() => void allesDoorvoeren()}>
            {bezig === "alles" ? "Bezig met doorvoeren…" : "Voer alles door wat kan"}
          </button>
          <button type="button" className="wl-kopieer" disabled={checkBusy} onClick={() => void controle()}>{checkBusy ? "Controleren…" : "Controleer live"}</button>
        </div>
        <p className="wl-let-op">Let op: doorvoeren zet de tekst meteen op de live site van de klant.</p>
        {melding && <p className="wl-checkmsg">{melding}</p>}
        {checkMsg && <p className="wl-checkmsg">{checkMsg}</p>}
      </div>

      <WerklijstLijst
        pages={pages}
        images={images}
        overslag={overslag}
        dubbel={dubbel}
        marks={marks}
        admin
        siteUrl={siteUrl}
        onVink={(k, d) => void vink(k, d)}
        onControle={() => void controle()}
        checkBusy={checkBusy}
        checkMsg={checkMsg}
        onDoorvoer={(o) => void doorvoer(o)}
        bezig={bezig}
        onSoort={(f, s) => void zetSoort(f, s)}
      />
    </div>
  );
}
