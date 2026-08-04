"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { laatsteDatumInTekst } from "../../../../lib/card-info";

// ═══════════════════════════════════════════════════════════
// HET DOSSIERBLOK OP HET SCHERM
// ═══════════════════════════════════════════════════════════
// Eén component, vier plekken: de bird's eye-chat, de voorgestelde taak, de
// kaart in de weekplanning en de pagina in Pagina's. Ze halen allemaal dezelfde
// opgeslagen alinea op, dus ze kunnen niet uit elkaar gaan lopen.
//
// De HTML komt van de server (lib/dossier-blok.ts), zodat de opmaak op alle
// plekken identiek is en er nooit ruwe Markdown in beeld komt.
// ═══════════════════════════════════════════════════════════

export default function PaginaDossier({ slug, url, compact = false, kaartTekst }: {
  slug: string;
  url: string;
  compact?: boolean;
  /** De geschreven kaarttekst, om te zien of die achterloopt op de mailbox. */
  kaartTekst?: string;
}) {
  const [html, setHtml] = useState("");
  const [staat, setStaat] = useState<"laden" | "klaar" | "leeg" | "fout">("laden");
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");
  // Mails die binnenkwamen ná de laatste datum die in de kaarttekst staat. Zonder
  // dit blijft een kaart zeggen "wacht op antwoord" terwijl het antwoord er al
  // twee mails geleden was: de tekst is geschreven op één moment, de mailbox loopt
  // door, en niets bracht die twee bij elkaar.
  const [nieuwer, setNieuwer] = useState<{ aantal: number; van: string[] }>({ aantal: 0, van: [] });
  const doosRef = useRef<HTMLDivElement>(null);

  const laad = useCallback(async () => {
    if (!url) { setStaat("leeg"); return; }
    try {
      const d = await fetch(`/api/admin/page-dossier?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}${compact ? "&compact=1" : ""}`).then((r) => r.json());
      if (d?.ok && d.html) { setHtml(d.html); setStaat("klaar"); }
      else setStaat(d?.ok ? "leeg" : "fout");
      const grens = kaartTekst ? laatsteDatumInTekst(kaartTekst) : null;
      if (grens) {
        const na = ((d?.mails || []) as { ontvangenOp?: string; vanNaam?: string }[])
          .filter((m) => { const dt = m.ontvangenOp ? new Date(m.ontvangenOp) : null; return dt && !Number.isNaN(dt.getTime()) && dt > grens; });
        const van = Array.from(new Set(na.map((m) => (m.vanNaam || "").split(" ")[0]).filter(Boolean)));
        setNieuwer({ aantal: na.length, van });
      } else setNieuwer({ aantal: 0, van: [] });
    } catch { setStaat("fout"); }
  }, [slug, url, compact, kaartTekst]);

  useEffect(() => { void laad(); }, [laad]);

  // Een mail vastpinnen, losmaken, wegklikken, of de bijlagen eruit halen. De
  // knopjes zitten in de HTML die de server maakt, dus we vangen de klik hier op
  // één plek af.
  async function mailActie(actie: "pin" | "los" | "weg" | "bijlage", id: number) {
    if (bezig) return;
    setBezig(true);
    setMelding("");
    try {
      const d = await fetch("/api/admin/page-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url, actie, id }),
      }).then((r) => r.json());
      if (actie === "bijlage") {
        const gelukt = !!d?.ok;
        setMelding(gelukt
          ? `Klaargezet als klantversie: ${(d.klaar || []).join(", ")}. Je verwerkt hem hieronder bij Documenten.`
          : d?.error || "De bijlagen konden niet ingelezen worden.");
        // Een melding die blijft staan wordt meubilair: hij hoorde bij een handeling
        // die klaar is, maar bleef de rest van de sessie de kaart in beslag nemen.
        // Gelukte melding gaat vanzelf weg; een foutmelding blijft, want daar moet
        // je nog iets mee.
        if (gelukt) setTimeout(() => setMelding(""), 6000);
      }
      if (d?.ok) await laad();
    } catch { setMelding("Dat lukte niet. Probeer het nog een keer."); }
    finally { setBezig(false); }
  }

  async function ververs() {
    if (bezig) return;
    setBezig(true);
    try {
      const d = await fetch("/api/admin/page-dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url }),
      }).then((r) => r.json());
      if (d?.ok && d.html) setHtml(d.html);
    } catch { /* stil */ }
    finally { setBezig(false); }
  }

  if (staat === "laden") return <div className="pd-laden">Dossier ophalen…</div>;
  if (staat === "leeg" || staat === "fout") return null;

  return (
    <div
      className={"pd-wrap" + (bezig ? " pd-bezig" : "")}
      ref={doosRef}
      onClick={(e) => {
        const el = (e.target as HTMLElement).closest?.(".pd-knop") as HTMLElement | null;
        if (!el) return;
        e.preventDefault();
        e.stopPropagation();
        const id = Number(el.dataset.mail || 0);
        if (!id) return;
        const actie = el.classList.contains("pd-pin") ? "pin"
          : el.classList.contains("pd-los") ? "los"
          : el.classList.contains("pd-bijlage") ? "bijlage"
          : "weg";
        void mailActie(actie, id);
      }}
    >
      {/* De kaarttekst is geschreven op één moment; de mailbox loopt door. Kwam er
          daarna nog mail, dan klopt een zin als "wacht op antwoord" niet meer en
          zegt de kaart dat nu zelf, in plaats van je stilletjes te laten wachten. */}
      {nieuwer.aantal > 0 && (
        <div className="pd-achter">
          <strong>Deze kaart loopt achter.</strong>{" "}
          {nieuwer.aantal === 1 ? "Er kwam 1 mail binnen" : `Er kwamen ${nieuwer.aantal} mails binnen`}
          {nieuwer.van.length ? ` (${nieuwer.van.join(", ")})` : ""} na wat er in de kaarttekst staat.
          <button type="button" className="pd-ververs" disabled={bezig} onClick={() => void ververs()}
            title="Lees de nieuwe mail en schrijf de stand van deze pagina opnieuw">
            {bezig ? "Bezig…" : "Werk bij"}
          </button>
        </div>
      )}
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {melding && <div className="pd-melding">{melding}</div>}
      {!compact && (
        <div className="pd-voet">
          <button type="button" className="pd-ververs" disabled={bezig} onClick={() => void ververs()}
            title="Zoek opnieuw naar mail en schrijf de samenvatting opnieuw">
            {bezig ? "Bezig…" : "Ververs"}
          </button>
        </div>
      )}
    </div>
  );
}
