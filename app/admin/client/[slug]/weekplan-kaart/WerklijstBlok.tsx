"use client";

// Blok op de werklijst-sitebouwer-kaart, de enige kaart zonder pagina die zelf
// werk doet in plaats van ernaar te verwijzen.

import { useEffect, useState } from "react";

// Blok op de werklijst-sitebouwer-kaart: maak of ververs de site-brede werklijst
// (alt-teksten kant-en-klaar plus de goedgekeurde meta's) en toon de status en het
// document. De motor zet na afloop zelf de doc-link en samenvatting op de kaart.
export default function WerklijstBlok({ slug, refreshBoard }: { slug: string; refreshBoard: () => void }) {
  const [status, setStatus] = useState<string>("idle");
  const [docLink, setDocLink] = useState("");
  const [resultaat, setResultaat] = useState("");
  const [fout, setFout] = useState("");
  const [shareToken, setShareToken] = useState("");
  const [teller, setTeller] = useState<{ totaal: number; gedaan: number; geverifieerd: number } | null>(null);
  const [actieBusy, setActieBusy] = useState("");
  const [actieMsg, setActieMsg] = useState("");

  async function haal(): Promise<string> {
    const d = await fetch(`/api/admin/dev-worklist?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) {
      setStatus(d.status || "idle"); setDocLink(d.docLink || ""); setResultaat(d.result || "");
      setShareToken(d.shareToken || "");
      setTeller(d.totaal ? { totaal: d.totaal, gedaan: d.gedaan || 0, geverifieerd: d.geverifieerd || 0 } : null);
      if (d.status === "error") setFout(d.error || "");
    }
    return d?.status || "idle";
  }

  // Alleen nog de live-controle vanaf de kaart. De knop "Voer door in de site"
  // stond hier ook, en die zette alle meta's en alt-teksten in één klik op de
  // site. Dat is precies de bulkactie die we van de werklijst zelf hebben
  // gehaald: doorvoeren gaat per stuk, met een mens die er eerst naar kijkt.
  // Een controle verandert niets aan de site, dus die mag hier blijven.
  async function actie(soort: "verify") {
    if (actieBusy) return;
    setActieBusy(soort); setActieMsg("");
    try {
      const d = await fetch("/api/admin/dev-worklist/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).then((r) => r.json());
      setActieMsg(d?.ok ? (d.samenvatting || d.melding || "Klaar.") : (d?.error || "Dat lukte niet; probeer het nog een keer."));
      void haal();
    } catch { setActieMsg("Dat lukte niet; probeer het nog een keer."); }
    finally { setActieBusy(""); }
  }
  useEffect(() => {
    void haal().then((s) => { if (s === "running") void volg(); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function volg() {
    for (let i = 0; i < 70; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const s = await haal();
      if (s === "done" || s === "error") { if (s === "done") refreshBoard(); return; }
    }
  }
  function start() {
    setStatus("running"); setFout(""); setResultaat("");
    fetch("/api/admin/dev-worklist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).catch(() => {});
    void volg();
  }

  // Er is pas iets te bekijken of door te voeren als de werklijst een keer gedraaid
  // heeft. Vroeger verdwenen die knoppen dan gewoon, waardoor de rij van vier naar
  // zeven sprong en het scherm onder je handen veranderde. Nu staan ze er altijd,
  // uitgeschakeld, en vertellen ze zelf wat er eerst moet gebeuren.
  const klaar = !!shareToken;
  const nogNiet = "Maak eerst de werklijst; dan valt er pas iets te bekijken.";

  return (
    <div className="wp-werklijst">
      {/* Bekijken: veilig, verandert niets aan de site. */}
      <div className="wp-werklijst-rij">
        <span className="wp-sectie-label" style={{ margin: "var(--s-0)" }}>Werklijst voor de sitebouwer</span>
        {teller && <span className="wp-werklijst-teller">{teller.gedaan}/{teller.totaal} gedaan · {teller.geverifieerd} gecontroleerd</span>}
        <span className="wp-fase-spacer" />
        <a className={"btn btn-primary btn-klein" + (klaar ? "" : " btn-uit")} href={klaar ? `/admin/client/${slug}/werklijst` : undefined} target="_blank" rel="noreferrer"
          title={klaar ? "Onze eigen versie: de huidige meta naast de goedgekeurde tekst, met de knop Voer door in de site" : nogNiet}>Onze werklijst</a>
        <a className={"btn btn-ghost btn-klein" + (klaar ? "" : " btn-uit")} href={klaar ? `/share/werklijst/${shareToken}` : undefined} target="_blank" rel="noreferrer"
          title={klaar ? "De klikbare afwerkpagina om te delen met de sitebouwer (geen inlog nodig)" : nogNiet}>Voor de sitebouwer</a>
      </div>
      {/* Doen: deze drie veranderen wel iets, of kosten tijd. */}
      <div className="wp-werklijst-rij wp-werklijst-doen">
        <span className="wp-werklijst-groep">Doen</span>
        <button type="button" className="btn btn-ghost btn-klein" disabled={status === "running" || !!actieBusy}
          title="Meet alle live pagina's opnieuw, schrijft de alt-teksten en haalt de goedgekeurde meta's uit Meta & CTR op; duurt een paar minuten" onClick={start}>
          {status === "running" ? "Bezig… (paar minuten)" : klaar ? "Ververs werklijst" : "Maak de werklijst"}
        </button>
        <button type="button" className="btn btn-ghost btn-klein" disabled={!klaar || !!actieBusy || status === "running"}
          title={klaar ? "Meet de live pagina's en zet groene gecontroleerd-vinkjes op alles wat er echt goed op staat" : nogNiet}
          onClick={() => void actie("verify")}>{actieBusy === "verify" ? "Controleren…" : "Controleer live"}</button>
      </div>
      {actieMsg && <div className="wp-werklijst-sam">{actieMsg}</div>}
      {status === "running" && <div className="muted">De pagina's worden gemeten en de alt-teksten geschreven; dit duurt een paar minuten. Je kunt intussen gewoon verder.</div>}
      {resultaat && status === "done" && !actieMsg && <div className="wp-werklijst-sam">{resultaat}</div>}
      {fout && <div className="wp-doc-fout">{fout}</div>}
      {!docLink && !shareToken && status !== "running" && !resultaat && (
        <div className="muted">Nog geen werklijst gemaakt. De werklijst meet alle live pagina&rsquo;s en zet per pagina de nieuwe meta&rsquo;s en alt-teksten klaar op een klikbare afwerkpagina voor de sitebouwer.</div>
      )}
    </div>
  );
}
