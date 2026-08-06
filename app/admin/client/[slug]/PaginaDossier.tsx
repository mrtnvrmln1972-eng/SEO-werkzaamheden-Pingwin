"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { laatsteDatumInTekst } from "../../../../lib/card-info";
import { HARD_BEWIJS } from "../../../../lib/constants";

type MailKeus = { id: string; subject?: string; fromName?: string; fromAddress?: string; receivedAt?: string };

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

type Achterstand = { aantal: number; van: string[] };

// ── Loopt deze kaart achter op de mailbox? ──
//
// Drie dingen gingen hier eerder mis, en samen maakten ze een melding die je niet
// weg kon krijgen. Eén: de meetlat was alleen de laatste datum die IN de
// kaarttekst stond, en die tekst verandert niet als je bijwerkt. Twee: er werd
// geteld over álle gevonden mails, ook de zwakke voorstellen, terwijl de
// samenvatting die per definitie nooit gebruikt; die kon dus nooit "verwerkt"
// raken. Drie: na het bijwerken werd er helemaal niet opnieuw geteld.
//
// Nu is de meetlat de laatste van twee: wat er in de kaarttekst staat, en tot
// welke mail het verhaal gelezen heeft. Dat tweede zet de server bij elke keer
// dat het verhaal geschreven wordt, dus na bijwerken is de melding weg, en komt
// alleen terug als er echt nieuwe mail is.
function telAchterstand(d: { mails?: unknown; bijgewerktTot?: string | null } | null, kaartTekst?: string): Achterstand {
  const leeg: Achterstand = { aantal: 0, van: [] };
  if (!d) return leeg;
  const uitTekst = kaartTekst ? laatsteDatumInTekst(kaartTekst) : null;
  const uitVerhaal = d.bijgewerktTot ? new Date(d.bijgewerktTot) : null;
  const grenzen = [uitTekst, uitVerhaal].filter((x): x is Date => !!x && !Number.isNaN(x.getTime()));
  if (!grenzen.length) return leeg;
  const grens = grenzen.sort((a, b) => b.getTime() - a.getTime())[0];

  const na = ((d.mails || []) as { ontvangenOp?: string; vanNaam?: string; bron?: string; score?: number }[])
    // Alleen mails die ook echt in het verhaal terecht kunnen komen. Een
    // "mogelijk relevant"-treffer mag geen melding veroorzaken die geen enkele
    // verversing kan oplossen.
    .filter((m) => m.bron === "pin" || (m.score || 0) >= HARD_BEWIJS)
    .filter((m) => { const dt = m.ontvangenOp ? new Date(m.ontvangenOp) : null; return dt && !Number.isNaN(dt.getTime()) && dt > grens; });
  return { aantal: na.length, van: Array.from(new Set(na.map((m) => (m.vanNaam || "").split(" ")[0]).filter(Boolean))) };
}

export default function PaginaDossier({ slug, url, compact = false, zonderStand = false, kaartTekst, kaartTitel }: {
  slug: string;
  url: string;
  compact?: boolean;
  /** Staat dit blok in een projectkaart? Dan toont het fase-blok eronder dezelfde
      vinkjes en dezelfde documenten, en blijven die hier weg. */
  zonderStand?: boolean;
  /** De geschreven kaarttekst, om te zien of die achterloopt op de mailbox. */
  kaartTekst?: string;
  /**
   * De titel van de kaart. Staat die er, dan gaat het verhaal over DEZE klus en
   * niet over alles wat er ooit over de pagina gemaild is. Een pagina kan meer
   * dan één traject dragen; zonder titel wint het traject dat het meest gemaild
   * is, ook als de kaart over iets heel anders gaat.
   */
  kaartTitel?: string;
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
  // Zelf een mail koppelen: de lijst met mails van deze klant om uit te kiezen.
  const [kiesOpen, setKiesOpen] = useState(false);
  const [mailKeuze, setMailKeuze] = useState<MailKeus[] | null>(null);
  const doosRef = useRef<HTMLDivElement>(null);

  // De focus gaat mee naar de server, zodat het verhaal over deze klus gaat.
  const focusQuery = kaartTitel
    ? `&taak=${encodeURIComponent(kaartTitel.replace(/<[^>]*>/g, " ").slice(0, 300))}&kaart=${encodeURIComponent((kaartTekst || "").slice(0, 1500))}`
    : "";
  async function haalMailKeuze() {
    setMailKeuze(null);
    try {
      const d = await fetch(`/api/admin/mail?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      setMailKeuze(d?.ok ? ((d.emails || []) as MailKeus[]) : []);
    } catch { setMailKeuze([]); }
  }

  async function koppel(messageId: string) {
    if (bezig) return;
    setBezig(true); setMelding("");
    try {
      const d = await fetch("/api/admin/page-emails", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url, actie: "koppel", messageId }),
      }).then((r) => r.json());
      if (d?.ok) {
        setKiesOpen(false);
        setMelding("Gekoppeld. Klik op Ververs om de stand opnieuw te laten schrijven.");
        setTimeout(() => setMelding(""), 8000);
        await laad();
      } else setMelding(d?.error || "Koppelen lukte niet.");
    } catch { setMelding("Koppelen lukte niet."); }
    finally { setBezig(false); }
  }

  const laad = useCallback(async () => {
    if (!url) { setStaat("leeg"); return; }
    try {
      const d = await fetch(`/api/admin/page-dossier?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}${compact ? "&compact=1" : ""}${zonderStand ? "&zonderstand=1" : ""}${focusQuery}`).then((r) => r.json());
      if (d?.ok && d.html) { setHtml(d.html); setStaat("klaar"); }
      else setStaat(d?.ok ? "leeg" : "fout");
      setNieuwer(telAchterstand(d, kaartTekst));
    } catch { setStaat("fout"); }
  }, [slug, url, compact, zonderStand, kaartTekst, focusQuery]);

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

  // Bijwerken: nieuwe zoekronde door de mailbox, het verhaal opnieuw geschreven,
  // en daarna de stand van de melding opnieuw bepalen. Dat laatste ontbrak, dus
  // wie op de knop drukte zag drie keer achter elkaar niets veranderen.
  async function ververs() {
    if (bezig) return;
    const waren = nieuwer.aantal;
    setBezig(true);
    setMelding("");
    try {
      const d = await fetch("/api/admin/page-dossier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url, taak: kaartTitel || "", kaart: kaartTekst || "" }),
      }).then((r) => r.json());
      if (d?.ok) {
        if (d.html) { setHtml(d.html); setStaat("klaar"); }
        const stand = telAchterstand(d, kaartTekst);
        setNieuwer(stand);
        const verwerkt = Math.max(0, waren - stand.aantal);
        setMelding(verwerkt
          ? `Bijgewerkt, ${verwerkt === 1 ? "1 nieuwe mail" : `${verwerkt} nieuwe mails`} verwerkt.`
          : "Bijgewerkt. Er was niets nieuws te verwerken.");
        setTimeout(() => setMelding(""), 6000);
      } else {
        setMelding(d?.error || "Bijwerken lukte niet. Probeer het nog een keer.");
      }
    } catch { setMelding("Bijwerken lukte niet. Probeer het nog een keer."); }
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
      {/* Zelf een mail erbij hangen. Je kon een mail wél wegklikken maar niet
          toevoegen, dus een mail die de automaat miste was definitief weg uit het
          dossier. Nu is een misser nooit meer een probleem. */}
      {!compact && kiesOpen && (
        <div className="pd-koppel">
          <div className="pd-koppel-kop">Welke mail hoort hier ook bij?</div>
          {mailKeuze === null ? <div className="muted">Mails ophalen…</div> : mailKeuze.length === 0 ? (
            <div className="muted">Geen mails gevonden voor deze klant.</div>
          ) : (
            <ul className="pd-koppel-lijst">
              {mailKeuze.map((m) => (
                <li key={m.id}>
                  <button type="button" disabled={bezig} onClick={() => void koppel(m.id)} title="Hang deze mail aan deze pagina">
                    <span className="pd-koppel-van">{m.fromName || m.fromAddress || "onbekend"}</span>
                    <span className="pd-koppel-onderwerp">{m.subject || "(geen onderwerp)"}</span>
                    <span className="pd-koppel-datum">{m.receivedAt ? new Date(m.receivedAt).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : ""}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {!compact && (
        <div className="pd-voet">
          <button type="button" className="pd-ververs" disabled={bezig}
            onClick={() => { setKiesOpen((o) => !o); if (!kiesOpen) void haalMailKeuze(); }}
            title="Hang zelf een mail aan deze pagina, als de automaat hem niet gevonden heeft">
            {kiesOpen ? "Annuleren" : "Mail erbij zoeken"}
          </button>
          <button type="button" className="pd-ververs" disabled={bezig} onClick={() => void ververs()}
            title="Zoek opnieuw naar mail en schrijf de samenvatting opnieuw">
            {bezig ? "Bezig…" : "Ververs"}
          </button>
        </div>
      )}
    </div>
  );
}
