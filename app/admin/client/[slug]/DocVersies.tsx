"use client";

// De documenten bij een taak of pagina.
//
// Zelf beheren in plaats van automatisch samenvoegen. Elk document dat je hier
// neerlegt, plakt of vanuit een mail naartoe sleept wordt gewoon een versie in de
// lijst: nieuwste bovenaan, met de datum en van wie het komt. Jij bepaalt met één
// vinkje welke versie geldt; die gaat standaard mee in een mail en naar de
// sitebouwer, en is de tekst waar de rest van het dashboard mee rekent.
//
// Wat hier vroeger stond: elke klantversie werd een voorstel met een AI-vergelijking,
// en na "Verwerk" werd er een samengevoegd document gemaakt. Dat leverde per ronde
// twee versies en een extra Drive-bestand op, ook als er niets veranderd was.
//
// Spatiebalk opent de voorvertoning van de geselecteerde regel, zoals in Finder.

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { mdToHtml } from "../../../../lib/markdown";
import { driveIdFromUrl, docsBewerkLink } from "../../../../lib/drive-id";

type Toets = { oordeel: "goed" | "let-op" | "niet-goed"; kop: string; behouden: string[]; verdwenen: string[]; advies: string };
type Versie = {
  id: number; kind: string; source: "pingwin" | "klant"; naam: string; driveLink: string;
  samenvatting: string; vergelijking: string; status: string; createdAt: string; goedgekeurd: boolean;
  /** Van wanneer de inhoud zelf is (uit het document), tegenover createdAt: het
      moment waarop het bestand hier binnenkwam. Twee documenten die je op één
      ochtend toevoegt hebben dezelfde createdAt en zeggen dan niets. */
  inhoudDatum: string; datumBron: string; datumUitleg: string;
};

const DATUM_BRON: Record<string, string> = {
  document: "staat in het document zelf", bestand: "datum van het bestand", drive: "laatst gewijzigd in Drive",
  geplakt: "door jou geplakt", opgehaald: "door ons opgehaald", mail: "datum van de mail", onbekend: "datum onbekend",
};

const KIND_LABEL: Record<string, string> = { analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy", structured: "Structured data", overig: "Overig" };
const OORDEEL_KLEUR: Record<Toets["oordeel"], string> = { "goed": "wp-toets-goed", "let-op": "wp-toets-letop", "niet-goed": "wp-toets-fout" };

export default function DocVersies({ slug, url, taakId, triggerSlot, open, onStand }: { slug: string; url: string; taakId?: number;
  /** DOM-knoop uit de knoppenbalk van de aantekeningen (via een portal), zodat
      het "document toevoegen"-chipje daar fysiek in staat i.p.v. als eigen,
      altijd-open blok. Geen knoop (nog niet gemount) = gewoon hier inline. */
  triggerSlot?: HTMLElement | null;
  /** Staat de lijst open? De knop ervoor staat niet hier maar in de rij met
      uitklappers bovenaan de kaart ("Achtergrond en afspraken", "Documenten",
      "Oude versies"), want daar hoort maar één van de drie tegelijk open te
      staan. Dit blok had zijn eigen open-of-dicht-klepje, en dan heb je twee
      dingen die hetzelfde regelen. */
  open?: boolean;
  /** Hoeveel documenten er liggen en of er nog een keuze openstaat. De knop
      hierboven toont dat, en die staat in het andere bestand. */
  onStand?: (s: { aantal: number; moetKiezen: boolean }) => void }) {
  const [versies, setVersies] = useState<Versie[]>([]);
  const [drag, setDrag] = useState(false);
  // Het "voeg een document toe"-blok stond hier altijd volledig open, ook als er
  // niets te doen was: drie regels uitleg en een invoerveld voor iets dat je maar
  // af en toe gebruikt. Nu een klein, gekleurd chipje (net als in de kennisbank)
  // dat pas opengaat als je erop klikt; slepen werkt ook al op het dichte chipje.
  const [dropOpen, setDropOpen] = useState(false);
  const bestandRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState("");
  const [fout, setFout] = useState("");
  const [linkVeld, setLinkVeld] = useState("");
  const [gekozen, setGekozen] = useState<number | null>(null);
  const [preview, setPreview] = useState<Versie | null>(null);
  const [hernoem, setHernoem] = useState<{ id: number; naam: string } | null>(null);
  const [toets, setToets] = useState<{ id: number; uitkomst: Toets } | null>(null);

  // Aantal versies per soort. Eén copy betekent: die geldt, punt. Twee betekent:
  // jij moet kiezen, en dan pas verschijnt het vinkje.
  const aantalPerSoort: Record<string, number> = {};
  for (const v of versies) aantalPerSoort[v.kind] = (aantalPerSoort[v.kind] || 0) + 1;
  // Ligt er van een soort meer dan één versie zonder dat er één is aangewezen?
  // Dan wacht de mail en de sitebouwer op jouw keuze, en gaat het blok open.
  // Structured data telt hier niet in mee: daarvoor is de kennisbank de plek waar
  // per gegeven vastligt wat geldt, dus er valt op deze kaart niets te kiezen.
  const moetKiezen = Object.keys(aantalPerSoort).some((kind) =>
    kind !== "structured" && aantalPerSoort[kind] > 1 && !versies.some((v) => v.kind === kind && v.goedgekeurd));

  // De kaart tekent de knop voor dit blok, dus die moet weten wat erin zit.
  useEffect(() => { onStand?.({ aantal: versies.length, moetKiezen }); }, [versies.length, moetKiezen, onStand]);

  const laad = useCallback(async () => {
    const d = await fetch(`/api/admin/page-doc/upload?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json()).catch(() => null);
    if (d?.ok) setVersies(d.versions || []);
  }, [slug, url]);
  useEffect(() => { void laad(); }, [laad]);

  // Spatiebalk = voorvertoning, zoals in Finder. Alleen als er een regel gekozen
  // is en je niet in een invoerveld staat, anders kun je nergens meer spaties typen.
  useEffect(() => {
    function toets(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (e.key === "Escape" && preview) { setPreview(null); return; }
      if (e.key !== " " || gekozen === null) return;
      e.preventDefault();                       // anders scrollt de pagina mee
      if (preview) { setPreview(null); return; }
      const v = versies.find((x) => x.id === gekozen);
      if (v) setPreview(v);
    }
    window.addEventListener("keydown", toets);
    return () => window.removeEventListener("keydown", toets);
  }, [gekozen, preview, versies]);

  async function stuur(payload: Record<string, unknown>, wat: string) {
    setBusy(wat); setFout("");
    try {
      const d = await fetch("/api/admin/page-doc/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url, ...payload }),
      }).then((r) => r.json());
      if (d?.ok) { if (Array.isArray(d.versions)) setVersies(d.versions); return d; }
      setFout(d?.error || "Dat lukte niet; probeer het nog een keer.");
      return null;
    } catch { setFout("Dat lukte niet; probeer het nog een keer."); return null; }
    finally { setBusy(""); }
  }

  async function drop(file: File) {
    setBusy("lezen"); setFout("");
    try {
      const form = new FormData();
      form.append("file", file); form.append("slug", slug); form.append("url", url);
      // Wanneer dit bestand voor het laatst is gewijzigd. Gaat niet vanzelf mee
      // bij een upload, en zonder die datum kan het dashboard niet bepalen of dit
      // nieuwer is dan wat er al ligt (zie lib/bron-datum.ts).
      form.append("gewijzigd", String(file.lastModified || 0));
      const d = await fetch("/api/admin/page-doc/upload", { method: "POST", body: form }).then((r) => r.json());
      if (d?.ok) { if (Array.isArray(d.versions)) setVersies(d.versions); else void laad(); }
      else setFout(d?.error || "Kon het bestand niet verwerken.");
    } catch { setFout("Uploaden mislukte; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  // Een bijlage die uit het paneel Laatste mails hierheen gesleept wordt. Het
  // dashboard haalt hem zelf bij Microsoft op; downloaden en opnieuw uploaden
  // hoeft dus niet.
  async function uitMail(data: { messageId: string; attachmentId: string; naam: string; mailDatum?: string }) {
    setBusy("lezen"); setFout("");
    try {
      const d = await fetch("/api/admin/page-doc/upload", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "uit-mail", slug, url, ...data }),
      }).then((r) => r.json());
      if (d?.ok) { if (Array.isArray(d.versions)) setVersies(d.versions); else void laad(); }
      else setFout(d?.error || "Kon de bijlage niet ophalen.");
    } catch { setFout("Ophalen mislukte; probeer het nog een keer."); }
    finally { setBusy(""); }
  }

  const dd = (d: string) => {
    try { return new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }); } catch { return ""; }
  };
  // Het tijdstip erbij, maar alleen waar het iets oplost: liggen er meerdere
  // documenten van hetzelfde soort, dan stonden ze er alle drie als "Copy,
  // 11 aug, copy (gegenereerd)". Precies gelijk, dus je kon niet zien welke
  // welke was terwijl je er wel één moest aanwijzen als de geldende.
  const tt = (d: string) => {
    try { return new Date(d).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
  };
  const previewUrl = (v: Versie) => {
    const id = driveIdFromUrl(v.driveLink);
    return id ? `https://drive.google.com/file/d/${id}/preview` : "";
  };

  // Dit chipje mag ook een bestand rechtstreeks aannemen (slepen zonder eerst te
  // klikken); klikken opent daarnaast het volledige blok voor bladeren of een link.
  const chip = (
    <button type="button" className={"wp-docchip" + (drag ? " wp-docchip-actief" : "")}
      disabled={busy === "lezen"}
      onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={(e) => {
        e.preventDefault(); setDrag(false);
        const bijlage = e.dataTransfer.getData("application/pingwin-bijlage");
        if (bijlage) { try { void uitMail(JSON.parse(bijlage)); } catch { /* geen geldige bijlage */ } return; }
        const f = e.dataTransfer.files?.[0]; if (f) void drop(f);
      }}
      onClick={() => setDropOpen((v) => !v)}
      title="Document toevoegen: klik, sleep een bestand hierheen, of sleep een bijlage uit een mail">
      {busy === "lezen" ? "Bezig…" : "+ document"}
    </button>
  );

  return (
    <div className="wp-docs">
      {triggerSlot ? createPortal(chip, triggerSlot) : chip}
      {dropOpen && (
        <div className={"wp-docdrop" + (drag ? " wp-docdrop-actief" : "")}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault(); setDrag(false);
            const bijlage = e.dataTransfer.getData("application/pingwin-bijlage");
            if (bijlage) { try { void uitMail(JSON.parse(bijlage)); } catch { /* geen geldige bijlage */ } return; }
            const f = e.dataTransfer.files?.[0]; if (f) void drop(f);
          }}>
          {busy === "lezen" ? (
            <span className="muted">Document inlezen…</span>
          ) : (
            <>
              <span className="wp-docdrop-tekst">
                <button type="button" className="wp-docdrop-kies" disabled={!!busy}
                  onClick={() => bestandRef.current?.click()}>kies een bestand</button>{" "}
                sleep een bijlage uit een mail hierheen, of plak een Drive-link:
              </span>
              <input ref={bestandRef} type="file" className="wp-docdrop-verborgen"
                accept=".docx,.pdf,.txt,.md,.json,.csv,.xlsx"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void drop(f); e.target.value = ""; }} />
              <span className="wp-docdrop-linkrij">
                <input className="wp-docdrop-input" value={linkVeld} placeholder="https://docs.google.com/…"
                  onChange={(e) => setLinkVeld(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && linkVeld.trim()) { void stuur({ action: "link", driveLink: linkVeld.trim() }, "lezen"); setLinkVeld(""); } }} />
                <button type="button" className="btn btn-ghost btn-klein" disabled={!linkVeld.trim() || !!busy}
                  onClick={() => { void stuur({ action: "link", driveLink: linkVeld.trim() }, "lezen"); setLinkVeld(""); }}>Lees</button>
              </span>
              <button type="button" className="wp-icon wp-del" title="Sluiten" onClick={() => setDropOpen(false)}>×</button>
            </>
          )}
        </div>
      )}

      {fout && <div className="wp-doc-fout">{fout}</div>}

      {/* Dicht, tenzij je hem opendoet. De documenten zelf bereik je al via de
          fase-rijen eronder (die linken naar de analyse, de blauwdruk en de
          copy), dus als vaste, altijd-open lijst was dit vier regels die je op
          elke kaart voorbij scrolt. Hier binnen kun je ze wél hernoemen,
          voorvertonen, weggooien en aanwijzen welke versie geldt; daarom blijft
          de lijst compleet in plaats van dat er regels uit verdwijnen.

          De knop staat niet meer hier maar in de rij uitklappers bovenaan de
          kaart, samen met "Achtergrond en afspraken" en "Oude versies": daar is
          er precies één tegelijk open. Liggen er meerdere versies van hetzelfde
          soort zonder dat je hebt aangewezen welke geldt, dan zet die rij dit
          blok vanzelf open; dat is een keuze waar de mail en de sitebouwer op
          wachten en die hoort niet achter een dicht klepje te verdwijnen. */}
      {versies.length > 0 && open && (
        <ul className="wp-doclijst">
          {/* Leesvolgorde = proces-volgorde (analyse, blauwdruk, copy), binnen een
              stap nieuwste eerst. Puur op datum stond copy bovenaan en las de
              lijst als een omgekeerd proces. */}
          {/* Hoeveel versies liggen er per soort? Bepaalt of het vinkje "geldt" een
              echte keuze is of alleen een klusje (zie de rij hieronder). */}
          {[...versies].sort((a, b) => {
            const rang: Record<string, number> = { analyse: 1, blauwdruk: 2, copy: 3, structured: 4 };
            const va = rang[a.kind] || 9, vb = rang[b.kind] || 9;
            return va !== vb ? va - vb : (a.createdAt < b.createdAt ? 1 : -1);
          }).map((v) => (
            <li key={v.id}
              className={"wp-docrij" + (gekozen === v.id ? " wp-docrij-aan" : "") + (v.goedgekeurd ? " wp-docrij-geldt" : "")}
              tabIndex={0}
              onClick={() => setGekozen(gekozen === v.id ? null : v.id)}
              onDoubleClick={() => setPreview(v)}
              title="Klik om te kiezen, spatiebalk voor een voorvertoning">
              {/* De datum van het document zelf als we die kennen, anders het
                  moment van binnenkomst. Dat verschil is precies waarom twee
                  documenten van dezelfde ochtend niet uit elkaar te houden waren. */}
              <span className="wp-docrij-datum"
                title={v.inhoudDatum
                  ? `${v.datumUitleg}. Hier binnengekomen op ${dd(v.createdAt)} ${tt(v.createdAt)}.`
                  : `Van dit document is geen eigen datum te vinden; dit is het moment waarop het hier binnenkwam (${dd(v.createdAt)} ${tt(v.createdAt)}).`}>
                {v.inhoudDatum ? dd(v.inhoudDatum) : dd(v.createdAt)}
                {!v.inhoudDatum && aantalPerSoort[v.kind] > 1 ? ` ${tt(v.createdAt)}` : ""}
              </span>
              <span className={"wp-docversie-bron " + (v.source === "klant" ? "wp-bron-klant" : "wp-bron-pingwin")}>
                {v.source === "klant" ? "Klant" : "Pingwin"}
              </span>
              <span className="wp-docrij-kind">{KIND_LABEL[v.kind] || v.kind}</span>

              {hernoem?.id === v.id ? (
                <input className="wp-docrij-naaminvoer" autoFocus value={hernoem.naam}
                  onClick={(e) => e.stopPropagation()}
                  onChange={(e) => setHernoem({ id: v.id, naam: e.target.value })}
                  onBlur={() => { void stuur({ action: "hernoem", id: v.id, naam: hernoem.naam }, "hernoem"); setHernoem(null); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { void stuur({ action: "hernoem", id: v.id, naam: hernoem.naam }, "hernoem"); setHernoem(null); }
                    if (e.key === "Escape") setHernoem(null);
                  }} />
              ) : (
                <button type="button" className="wp-docrij-naam"
                  onClick={(e) => { e.stopPropagation(); setHernoem({ id: v.id, naam: v.naam || "" }); }}
                  title="Klik om de naam aan te passen">{v.naam || "document"}</button>
              )}

              <span className="wp-docrij-acties" onClick={(e) => e.stopPropagation()}>
                {/* Het vinkje beantwoordt één vraag: welke van deze copy-versies is
                    DE copy? Dat is pas een vraag als er meer dan één ligt (bijvoorbeeld
                    nadat de klant een versie terugstuurde). Ligt er maar één, dan geldt
                    hij vanzelf en zou het vinkje alleen een klusje zijn dat je kunt
                    vergeten, met een stilgevallen mail en werklijst als gevolg. */}
                {/* Structured data kent geen keuze op deze kaart. Het document is
                    daar een doorgeefluik: wat erin staat is per gegeven verwerkt in
                    de kennisbank van de klant, en dáár staat wat geldt, met per
                    gegeven een datum. Een vinkje "welke versie geldt" zou een
                    tweede waarheid maken naast die kennisbank. */}
                {v.kind === "structured" ? (
                  <a className="wp-docrij-kennisbank" href={`/admin/client/${slug}?tab=klant`}
                    title="Wat hierin stond is per gegeven verwerkt in de kennisbank van deze klant. Daar staat welke waarde geldt en van wanneer die is; dit bestand is het archief.">
                    in de kennisbank
                  </a>
                ) : aantalPerSoort[v.kind] > 1 ? (
                  <label className="wp-docrij-geldt-vink" title={`Er liggen ${aantalPerSoort[v.kind]} versies van dit soort. Vink aan welke er geldt: die gaat mee in een mail en naar de sitebouwer, en is de tekst waar de rest mee rekent.`}>
                    <input type="checkbox" checked={v.goedgekeurd} disabled={!!busy}
                      onChange={(e) => void stuur({ action: "goedkeur", id: v.id, aan: e.target.checked }, "goedkeur")} />
                    <span>geldt</span>
                  </label>
                ) : v.goedgekeurd ? (
                  <span className="wp-docrij-geldt-vast" title="Het enige document van dit soort, dus dit is de versie waar de mail, de sitebouwer en de rest van het dashboard mee rekenen.">geldt</span>
                ) : null}
                {v.source === "klant" && (
                  <button type="button" className="btn btn-ghost btn-klein" disabled={!!busy}
                    title="Kijk of deze teruggekregen versie nog aan de SEO-criteria voldoet"
                    onClick={async () => {
                      const d = await stuur({ action: "toets", id: v.id }, "toets");
                      if (d?.toets) setToets({ id: v.id, uitkomst: d.toets as Toets });
                    }}>{busy === "toets" ? "Toetsen…" : "Toets aan de criteria"}</button>
                )}
                {/* Een Word-document opent rechtstreeks in Docs; een pdf, plaatje
                    of ander bestand houdt de gewone Drive-link, want die kan Docs
                    niet openen. Vandaar de bestandsnaam als scheidsrechter. */}
                {v.driveLink && <a className="wp-link" href={/\.(docx?|)$/i.test(v.naam || "") ? docsBewerkLink(v.driveLink) : v.driveLink} target="_blank" rel="noreferrer">openen</a>}
                <button type="button" className="wp-icon wp-del" title="Van de lijst halen (het bestand blijft in Drive)"
                  onClick={() => void stuur({ action: "negeer", id: v.id }, "weg")}>×</button>
              </span>

              {/* Wat dit document is en wat er anders in staat. Stond al in de
                  database maar kwam nooit in beeld, waardoor je twee regels zag
                  waarvan je niet kon zien welke welke was. Alleen bij de regel
                  die je aanklikt, anders wordt de lijst een muur tekst. */}
              {gekozen === v.id && (v.samenvatting || v.datumUitleg) && (
                <div className="wp-docrij-uitleg">
                  {v.samenvatting && <span>{v.samenvatting}</span>}
                  <span className="muted">
                    {v.inhoudDatum ? `${DATUM_BRON[v.datumBron] || v.datumBron}: ${dd(v.inhoudDatum)}` : "Geen eigen datum in dit document gevonden."}
                    {" · "}hier binnengekomen {dd(v.createdAt)} {tt(v.createdAt)}
                    {" · "}dubbelklik voor een voorvertoning
                  </span>
                </div>
              )}
              {toets?.id === v.id && (
                <div className={"wp-toets " + OORDEEL_KLEUR[toets.uitkomst.oordeel]}>
                  <strong>{toets.uitkomst.kop}</strong>
                  {toets.uitkomst.verdwenen.length > 0 && (
                    <ul>{toets.uitkomst.verdwenen.map((r, i) => <li key={i}>{r}</li>)}</ul>
                  )}
                  <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(toets.uitkomst.advies) }} />
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Hier stond de knop "Zet copy als concept in de site". Die staat sinds
          17-08-2026 in de Implementatie-rij van de fases, want dat is de stap
          waar hij bij hoort; hier stond hij onderaan een documentenlijst, ver
          van het moment waarop je hem nodig hebt. Eén knop, één plek. */}

      {preview && (
        <div className="wp-mail-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPreview(null); }}>
          <div className="wp-mail-modal wp-preview">
            <div className="wp-mail-head">
              <span className="wp-mail-title">{preview.naam || "document"}</span>
              <button type="button" className="wp-icon wp-del" title="Sluiten (Escape)" onClick={() => setPreview(null)}>×</button>
            </div>
            {previewUrl(preview) ? (
              <iframe className="wp-preview-frame" src={previewUrl(preview)} title={preview.naam || "voorvertoning"} />
            ) : (
              <div className="wp-preview-leeg">
                <p>Van dit document is geen bestand in Drive bewaard, dus er valt niets te tonen.</p>
                {preview.samenvatting && <p className="muted">{preview.samenvatting}</p>}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
