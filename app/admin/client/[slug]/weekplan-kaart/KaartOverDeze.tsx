"use client";

// Alles wat over deze pagina gaat staat in één blok. Het zaten er eerst drie los
// onder elkaar: "Waarom deze pagina" (het geschreven verhaal), het paginadossier
// (wat er echt gebeurd is) en de documenten. Ze vertelden hetzelfde verhaal
// vanuit drie hoeken, met eigen kopjes en eigen archieven, dus je las hetzelfde
// drie keer en wist niet welke de actuele was.

import { useEffect, useState } from "react";
import { cardInfoHtml, eerdereNotitiesHtml, type MailLinks, type OpdrachtMark } from "../../../../../lib/card-info";
import { opdrachtKey } from "../../../../../lib/opdracht-key";
import DocVersies from "../DocVersies";
import KaartNotitie from "../KaartNotitie";
import PaginaDossier from "../PaginaDossier";
import type { WpTask, WpPageInfo } from "./types";

const ARCHIEF_LABEL: Record<string, string> = {
  titel: "Eerdere titel",
  notities: "Eerdere kaarttekst",
  overloop: "Weggeschoven omdat de kaart vol was",
};

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
  // Heeft het levende maildossier (het blok "Waar deze pagina staat") echt iets
  // te vertellen? Zo ja, dan hoeven "Waarom deze pagina" en "Aanpak en
  // afspraken" niet meer: dat is dan hetzelfde verhaal, alleen bevroren. Null
  // zolang het dossier nog laadt; dan blijft de geschreven tekst gewoon staan.
  const [dossierHeeftInhoud, setDossierHeeftInhoud] = useState<boolean | null>(null);
  // Het archief wordt pas opgehaald als je het openklapt: het staat er om iets
  // terug te kunnen zoeken, niet om te lezen.
  const [archief, setArchief] = useState<{ op: string; soort: string; tekst: string }[]>([]);
  const [archiefBezig, setArchiefBezig] = useState(false);

  // Status per opdrachtregel ("Opdrachten in deze kaart"): zelf afgevinkt of
  // automatisch gecheckt tegen de live pagina. Zie lib/opdracht-marks.ts.
  const [opdrachtMarks, setOpdrachtMarks] = useState<Record<string, OpdrachtMark>>({});
  const [opdrachtBezig, setOpdrachtBezig] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let stop = false;
    (async () => {
      try {
        const d = await fetch(`/api/admin/weekplan/opdracht-check?slug=${encodeURIComponent(slug)}&taskId=${t.id}`).then((r) => r.json());
        if (!stop && d?.ok) setOpdrachtMarks(d.marks || {});
      } catch { /* stil; de regels tonen dan gewoon "open" */ }
    })();
    return () => { stop = true; };
  }, [slug, t.id]);

  // Zelf afvinken (of terugzetten). tekst komt uit de <li> zelf, net als bij
  // de bespreeklijst-knop hierboven: er is geen apart id per opdrachtregel.
  async function zetOpdracht(tekst: string, af: boolean) {
    const k = opdrachtKey(tekst);
    setOpdrachtBezig((v) => ({ ...v, [k]: true }));
    try {
      await fetch("/api/admin/weekplan/opdracht-check", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, taskId: t.id, tekst, status: af ? "handmatig" : "open" }) });
      setOpdrachtMarks((v) => ({ ...v, [k]: { status: af ? "handmatig" : "open", melding: null } }));
    } catch { /* stil; opnieuw klikken kan altijd */ }
    finally { setOpdrachtBezig((v) => ({ ...v, [k]: false })); }
  }

  async function checkOpdracht(tekst: string) {
    const k = opdrachtKey(tekst);
    setOpdrachtBezig((v) => ({ ...v, [k]: true }));
    try {
      const d = await fetch("/api/admin/weekplan/opdracht-verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, taskId: t.id, tekst, url: t.url }) }).then((r) => r.json());
      if (d?.ok) setOpdrachtMarks((v) => ({ ...v, [k]: { status: d.gevonden ? "automatisch_ok" : "automatisch_niet", melding: d.melding || null } }));
    } catch { /* stil; opnieuw klikken kan altijd */ }
    finally { setOpdrachtBezig((v) => ({ ...v, [k]: false })); }
  }

  // De oude notities worden apart opgehaald zodat ze onderaan dit blok komen, bij
  // het archief van het dossier, in plaats van als tweede archief midden op de kaart.
  const ouder = hasInfo ? eerdereNotitiesHtml(t.toelichting, t.url, t.taak, mailLinks) : null;
  const eerdereNotities = ouder?.html || "";
  const eerdereAantal = ouder?.aantal || 0;
  const archiefAantal = t.archiefAantal || 0;

  async function laadArchief() {
    if (archief.length || archiefBezig || archiefAantal === 0) return;
    setArchiefBezig(true);
    try {
      const d = await fetch(`/api/admin/weekplan/archief?slug=${encodeURIComponent(slug)}&id=${t.id}`).then((r) => r.json());
      if (d?.ok && Array.isArray(d.items)) setArchief(d.items);
    } catch { /* stil; het blok blijft dan leeg */ }
    finally { setArchiefBezig(false); }
  }

  return (
    <div className="wp-overdeze">
      <div className="wp-overdeze-kop">{t.url ? "Over deze pagina" : "Over deze taak"}</div>
      {hasInfo && (
        <div className="wp-card-info wp-info-net"
          onClick={(e) => {
            const el = (e.target as HTMLElement).closest?.(".wp-maildatum") as HTMLElement | null;
            if (el && onOpenMailDate) { e.stopPropagation(); onOpenMailDate(el.dataset.datum || ""); return; }
            // Opdrachtregel: tekst komt uit de <li> zelf (net als de
            // bespreeklijst-knop), met de »-knop én de vinkje/check-controls
            // eraf, zodat alleen de instructie zelf overblijft.
            const opdrachtEl = (e.target as HTMLElement).closest?.(".wp-opdracht-vink, .wp-opdracht-check") as HTMLElement | null;
            if (opdrachtEl) {
              e.stopPropagation();
              const li = opdrachtEl.closest("li");
              const kloon = li?.cloneNode(true) as HTMLElement | undefined;
              kloon?.querySelectorAll(".wp-info-lijstbtn, .wp-opdracht-controls").forEach((b) => b.remove());
              const tekst = (kloon?.textContent || "").replace(/\s+/g, " ").trim();
              if (!tekst) return;
              if (opdrachtEl.classList.contains("wp-opdracht-vink")) void zetOpdracht(tekst, (opdrachtEl as HTMLInputElement).checked);
              else void checkOpdracht(tekst);
              return;
            }
            const lb = (e.target as HTMLElement).closest?.(".wp-info-lijstbtn") as HTMLElement | null;
            if (lb) {
              e.stopPropagation();
              const li = lb.closest("li");
              const kloon = li?.cloneNode(true) as HTMLElement | undefined;
              kloon?.querySelectorAll(".wp-info-lijstbtn, .wp-opdracht-controls").forEach((b) => b.remove());
              const tekst = (kloon?.textContent || "").replace(/\s+/g, " ").trim();
              if (tekst) onLijstPunt(tekst);
            }
          }}
          dangerouslySetInnerHTML={{ __html: cardInfoHtml(t.toelichting, t.url, t.taak, cijferRegel(page), mailLinks, undefined, true, t.ruw, dossierHeeftInhoud === true, opdrachtMarks, opdrachtBezig) }} />
      )}
      {t.url && <PaginaDossier slug={slug} url={t.url} zonderStand kaartTekst={t.toelichting} kaartTitel={t.taak} onHeeftInhoud={setDossierHeeftInhoud} />}
      {/* Je eigen aantekeningen. Los van de kaarttekst die de assistent
          schreef: geen automatische stap raakt dit veld aan. */}
      <KaartNotitie slug={slug} id={t.id} start={t.notitie || ""}
        toolbarExtra={<span ref={setNotitieDocSlot} />} />
      {/* Documenten hangen aan de pagina als die er is, en anders aan de taak
          zelf. Zo kun je bij élke kaart een document neerleggen, ook bij een
          klus die niet over één pagina gaat (een rapportage, een werklijst).
          Het chipje zelf staat via de portal in de knoppenbalk hierboven; hier
          staat alleen nog het openklapbare blok (als je erop klikt) en de
          lijst met eerder toegevoegde documenten. */}
      <DocVersies slug={slug} url={t.url || `taak:${t.id}`} taakId={t.id} triggerSlot={notitieDocSlot} />
      {/* Het archief. Twee dingen die er bijna hetzelfde uitzagen zijn nu uit
          elkaar getrokken: "Wat er gebeurd is" (mails, documenten, gesprekken,
          in het dossierblok hierboven) en dit, de geschreven tekst die van de
          kaart af is geschoven. Hier landt alles wat wordt weggehaald: een
          oude titel, een oude kaarttekst voordat hij werd herschreven, en
          regels die niet meer pasten. Er wordt nooit iets uit verwijderd. */}
      {(eerdereNotities || archiefAantal > 0) && (
        <details className="wp-info-rest wp-overdeze-archief wp-card-info wp-info-net"
          onToggle={(e) => { if ((e.target as HTMLDetailsElement).open) void laadArchief(); }}>
          <summary>Oude versies van deze kaart ({eerdereAantal + archiefAantal})</summary>
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
        </details>
      )}
    </div>
  );
}
