"use client";

// Alles wat over deze pagina gaat staat in één blok. Het zaten er eerst drie los
// onder elkaar: "Waarom deze pagina" (het geschreven verhaal), het paginadossier
// (wat er echt gebeurd is) en de documenten. Ze vertelden hetzelfde verhaal
// vanuit drie hoeken, met eigen kopjes en eigen archieven, dus je las hetzelfde
// drie keer en wist niet welke de actuele was.
//
// Sinds 18-08-2026 is de vorm ook één ding: een kop met rechts de verse meting,
// daaronder één rij met drie uitklappers (achtergrond en afspraken, documenten,
// oude versies) waarvan er hooguit één tegelijk openstaat, over de volle breedte
// van de kaart, en daaronder pas je eigen aantekeningen. Daarvóór had elk van de
// drie zijn eigen klepje op zijn eigen plek, met een scheidingslijn ertussen, en
// stond de meting als losse balk boven de tekst.

import { useEffect, useState } from "react";
import { cardInfoHtml, eerdereNotitiesHtml, verhaalAantal, type MailLinks } from "../../../../../lib/card-info";
import DocVersies from "../DocVersies";
import KaartNotitie from "../KaartNotitie";
import type { WpTask, WpPageInfo } from "./types";

const ARCHIEF_LABEL: Record<string, string> = {
  titel: "Eerdere titel",
  notities: "Eerdere kaarttekst",
  overloop: "Weggeschoven omdat de kaart vol was",
};

/** Welke uitklapper staat open; leeg is alle drie dicht. */
type Vouw = "" | "verhaal" | "docs" | "oud";

// De cijferregel op de kaart, opgebouwd uit de meting. Leeg als er niets gemeten is;
// dan tonen we liever niets dan een nul die niets betekent.
export function cijferRegel(p?: { vertoningen?: number; klikken?: number; doorgevoerd?: boolean | null; live?: boolean }): string {
  if (!p) return "";
  const delen: string[] = [];
  if (p.vertoningen) delen.push(`${p.vertoningen.toLocaleString("nl-NL")} vertoningen`);
  if (p.klikken) delen.push(`${p.klikken.toLocaleString("nl-NL")} klikken`);
  if (p.live === false) delen.push("nog niet live");
  if (p.doorgevoerd === true) delen.push("copy staat live");
  else if (p.doorgevoerd === false) delen.push("copy nog niet doorgevoerd");
  return delen.join(" · ");
}

export default function KaartOverDeze({ slug, t, page, mailLinks, onOpenMailDate, onLijstPunt }: {
  slug: string; t: WpTask; page?: WpPageInfo; mailLinks?: MailLinks;
  onOpenMailDate?: (datum: string) => void;
  /** Een aanpak-punt uit de kaarttekst doorgeven aan de bespreeklijst. */
  onLijstPunt: (tekst: string) => void;
}) {
  const hasInfo = !!t.toelichting.trim();
  // Plek in de knoppenbalk van de aantekeningen waar het "document toevoegen"-
  // chipje van DocVersies via een portal in terechtkomt, zodat het daar fysiek
  // in die strip staat i.p.v. als eigen, altijd-open blok verderop.
  const [notitieDocSlot, setNotitieDocSlot] = useState<HTMLSpanElement | null>(null);
  // Het archief wordt pas opgehaald als je het openklapt: het staat er om iets
  // terug te kunnen zoeken, niet om te lezen.
  const [archief, setArchief] = useState<{ op: string; soort: string; tekst: string }[]>([]);
  const [archiefBezig, setArchiefBezig] = useState(false);
  const [vouw, setVouw] = useState<Vouw>("");
  // Wat er in het documentenblok ligt; dat blok weet dat zelf, de knop ervoor
  // staat hier. Eén keer doorgeven is genoeg om ze gelijk te houden.
  const [docStand, setDocStand] = useState<{ aantal: number; moetKiezen: boolean }>({ aantal: 0, moetKiezen: false });
  // Ligt er een keuze open (twee versies van hetzelfde soort, geen aangewezen),
  // dan gaat dat blok vanzelf open: daar wachten de mail en de sitebouwer op.
  const [keuzeGedaan, setKeuzeGedaan] = useState(false);
  useEffect(() => {
    if (docStand.moetKiezen && !keuzeGedaan) { setVouw("docs"); setKeuzeGedaan(true); }
  }, [docStand.moetKiezen, keuzeGedaan]);

  // De oude notities worden apart opgehaald zodat ze onderaan dit blok komen,
  // in plaats van als tweede archief midden op de kaart.
  const ouder = hasInfo ? eerdereNotitiesHtml(t.toelichting, t.url, t.taak, mailLinks) : null;
  const eerdereNotities = ouder?.html || "";
  const eerdereAantal = ouder?.aantal || 0;
  const archiefAantal = t.archiefAantal || 0;
  const oudAantal = eerdereAantal + archiefAantal;
  const cijfers = cijferRegel(page);
  // De twee vakken zelf; de cijfers en de eerdere notities komen hier bewust
  // niet in mee, die hebben allebei hun eigen plek in dit blok.
  const verhaalHtml = hasInfo ? cardInfoHtml(t.toelichting, t.url, t.taak, undefined, mailLinks, undefined, true, t.ruw) : "";
  const verhaalN = hasInfo && !t.ruw ? verhaalAantal(t.toelichting, t.taak) : 0;

  async function laadArchief() {
    if (archief.length || archiefBezig || archiefAantal === 0) return;
    setArchiefBezig(true);
    try {
      const d = await fetch(`/api/admin/weekplan/archief?slug=${encodeURIComponent(slug)}&id=${t.id}`).then((r) => r.json());
      if (d?.ok && Array.isArray(d.items)) setArchief(d.items);
    } catch { /* stil; het blok blijft dan leeg */ }
    finally { setArchiefBezig(false); }
  }

  function klap(welke: Vouw) {
    setVouw((v) => (v === welke ? "" : welke));
    if (welke === "oud") void laadArchief();
  }

  /** Eén knop in de uitklapper-rij: pijltje, naam, aantal. */
  function VouwKnop({ welke, naam, aantal, extra }: { welke: Vouw; naam: string; aantal?: number; extra?: string }) {
    const aan = vouw === welke;
    return (
      <button type="button" className={"btn btn-quiet btn-klein wp-vouwknop" + (aan ? " wp-vouwknop-aan" : "")}
        onClick={() => klap(welke)}>
        <span className="wp-vouwknop-pijl">{aan ? "▾" : "▸"}</span>
        {naam}{aantal !== undefined ? ` (${aantal})` : ""}
        {extra && <span className="wp-doc-vouw-let">{extra}</span>}
      </button>
    );
  }

  return (
    <div className="wp-overdeze">
      <div className="wp-overdeze-kop">
        <span>{t.url ? "Over deze pagina" : "Over deze taak"}</span>
        {/* De verse meting hoort op de kopregel, rechts: het is de stand van
            dit moment, niet nog een blok tekst. Hij stond als losse grijze balk
            boven het verhaal, waar hij als eerste de aandacht pakte. */}
        {cijfers && (
          <span className="wp-info-cijfers"><span className="wp-cijfer-nu-lab">Nu gemeten</span>{cijfers}</span>
        )}
      </div>

      {/* Eén rij, hooguit één open. Alle drie gaan over "wat is er over deze
          pagina bewaard", dus ze hoorden nooit drie losse klepjes op drie
          plekken te zijn. */}
      {(verhaalHtml || docStand.aantal > 0 || oudAantal > 0) && (
        <div className="wp-vouwrij">
          {verhaalHtml && <VouwKnop welke="verhaal" naam={t.ruw ? "Inhoud" : "Achtergrond en afspraken"} aantal={t.ruw ? undefined : verhaalN} />}
          {docStand.aantal > 0 && <VouwKnop welke="docs" naam="Documenten" aantal={docStand.aantal} extra={docStand.moetKiezen ? "kies welke versie geldt" : undefined} />}
          {oudAantal > 0 && <VouwKnop welke="oud" naam="Oude versies van deze kaart" aantal={oudAantal} />}
        </div>
      )}

      {verhaalHtml && vouw === "verhaal" && (
        <div className="wp-card-info wp-info-net wp-vouwpaneel"
          onClick={(e) => {
            const el = (e.target as HTMLElement).closest?.(".wp-maildatum") as HTMLElement | null;
            if (el && onOpenMailDate) { e.stopPropagation(); onOpenMailDate(el.dataset.datum || ""); return; }
            const lb = (e.target as HTMLElement).closest?.(".wp-info-lijstbtn") as HTMLElement | null;
            if (lb) {
              e.stopPropagation();
              const li = lb.closest("li");
              const kloon = li?.cloneNode(true) as HTMLElement | undefined;
              kloon?.querySelectorAll(".wp-info-lijstbtn").forEach((b) => b.remove());
              const tekst = (kloon?.textContent || "").replace(/\s+/g, " ").trim();
              if (tekst) onLijstPunt(tekst);
            }
          }}
          dangerouslySetInnerHTML={{ __html: verhaalHtml }} />
      )}

      {/* Documenten hangen aan de pagina als die er is, en anders aan de taak
          zelf. Zo kun je bij élke kaart een document neerleggen, ook bij een
          klus die niet over één pagina gaat (een rapportage, een werklijst).
          Het chipje "+ document" staat via een portal in de knoppenbalk van de
          aantekeningen hieronder; de lijst zelf hoort bij de knop hierboven. */}
      <DocVersies slug={slug} url={t.url || `taak:${t.id}`} taakId={t.id} triggerSlot={notitieDocSlot}
        open={vouw === "docs"} onStand={setDocStand} />

      {/* Het archief: de geschreven tekst die van de kaart af is geschoven.
          Hier landt alles wat wordt weggehaald: een oude titel, een oude
          kaarttekst voordat hij werd herschreven, en regels die niet meer
          pasten. Er wordt nooit iets uit verwijderd. */}
      {oudAantal > 0 && vouw === "oud" && (
        <div className="wp-card-info wp-info-net wp-vouwpaneel">
          {/* Zonder deze regel las het als aantekeningen die nog gelden. Het is
              het tegenovergestelde: dit is precies de tekst die van de kaart af
              is gehaald omdat hij niet meer klopte. */}
          <p className="wp-archief-uitleg">Tekst zoals hij eerder op deze kaart stond, bewaard om iets te kunnen terugzoeken. <strong>Niet actueel:</strong> wat er nu geldt staat hierboven en in de fases.</p>
          {eerdereNotities && <div dangerouslySetInnerHTML={{ __html: eerdereNotities }} />}
          {/* eerdereNotities komt uit eerdereNotitiesHtml() in lib/card-info.ts, dat linkifyHtml gebruikt. */}
          {archief.length > 0 && (
            <ul className="wp-archief">
              {archief.map((a, i) => (
                <li key={i}>
                  <span className="wp-archief-kop">
                    <span className="wp-archief-datum">{new Date(a.op).toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" })}</span>
                    <span className="wp-archief-soort">{ARCHIEF_LABEL[a.soort] || a.soort}</span>
                  </span>
                  <span className="wp-archief-tekst">{a.tekst}</span>
                </li>
              ))}
            </ul>
          )}
          {archiefBezig && <div className="muted">Archief ophalen…</div>}
        </div>
      )}

      {/* Je eigen aantekeningen. Los van de kaarttekst die de assistent
          schreef: geen automatische stap raakt dit veld aan. */}
      <KaartNotitie slug={slug} id={t.id} start={t.notitie || ""}
        toolbarExtra={<span ref={setNotitieDocSlot} />} />
    </div>
  );
}
