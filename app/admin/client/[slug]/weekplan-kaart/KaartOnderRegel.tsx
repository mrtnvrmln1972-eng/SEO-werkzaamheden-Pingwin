"use client";

// De onderste regel had zes identieke pilletjes naast elkaar: vier die je ergens
// heen brengen en twee die iets naar buiten sturen. Aan de vorm was dat verschil
// niet te zien, dus stond "Mail" er even onschuldig bij als een link naar de live
// pagina. Nu twee groepjes met een scheiding ertussen: links "waar kan ik heen",
// rechts "wat stuur ik weg".

import { useState } from "react";
import type { WpTask } from "./types";

// Bij welk taaktype hoort welk dashboard-tabblad (voor de deep-link "doe het hier").
const TAB_FOR_TYPE: Record<string, { tab: string; label: string }> = {
  meta: { tab: "meta", label: "Meta & CTR" },
  alt: { tab: "paginas", label: "Pagina's" },
  copy: { tab: "paginas", label: "Pagina's" },
  intern: { tab: "paginas", label: "Pagina's" },
  structured: { tab: "paginas", label: "Pagina's" },
  strategie: { tab: "paginas", label: "Pagina's" },
  pijplijn: { tab: "paginas", label: "Pagina's" },
  overig: { tab: "paginas", label: "Pagina's" },
};

/** Staat deze kaart op de developerpagina? */
export function useNaarDev({ slug, t, setFoutje }: { slug: string; t: WpTask; setFoutje: (v: string) => void }) {
  const [naarDev, setNaarDev] = useState<boolean>(t.naarDev === true);
  const [bezig, setBezig] = useState(false);
  const [venster, setVenster] = useState(false);

  // Doorzetten opent eerst het venster: welke documenten gaan mee, en hoe luidt
  // de opdracht. Eraf halen is één klik, want daar valt niets te kiezen.
  async function zetNaarDev() {
    if (bezig) return;
    if (!naarDev) { setVenster(true); return; }
    setBezig(true);
    try {
      const d = await fetch("/api/admin/weekplan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id: t.id, naarDev: false }),
      }).then((r) => r.json());
      if (d?.ok) setNaarDev(false);
      else setFoutje(d?.error || "Van de developerlijst halen mislukte.");
    } catch { setFoutje("Van de developerlijst halen mislukte."); }
    finally { setBezig(false); }
  }

  return { naarDev, setNaarDev, bezig, venster, setVenster, zetNaarDev };
}

export type NaarDev = ReturnType<typeof useNaarDev>;

export default function KaartOnderRegel({ slug, t, dev, onMail, heeftFases }: {
  slug: string; t: WpTask; dev: NaarDev;
  onMail: (aud: "klant" | "dev") => void;
  /** Heeft deze kaart het fase-blok (dus een pagina)? Dan staan "Naar developer?"
      en "Mail" al in de Implementatie-rij en horen ze hier niet nog een keer.
      Een kaart zónder pagina heeft dat blok niet, en dan is dit de enige plek. */
  heeftFases?: boolean;
}) {
  // Dashboard-deeplinks vanuit een kaart openen in een NIEUW browsertabblad,
  // zodat je het bord niet kwijtraakt terwijl je iets uitzoekt.
  const openTabNieuwTab = (tabNaam: string) => window.open(`/admin/client/${slug}?tab=${tabNaam}${tabNaam === "paginas" && t.url ? `&page=${encodeURIComponent(t.url)}` : ""}`, "_blank");
  const tab0 = TAB_FOR_TYPE[t.taaktype];
  const tab = tab0 && (tab0.tab !== "paginas" || t.url) ? tab0 : undefined;
  const eigenTab = tab && tab.tab !== "paginas" ? tab : undefined;
  // De link naar de live pagina stond hier én bovenaan de kaart (in de titel).
  // Twee keer hetzelfde adres, en de bovenste zie je het eerst; deze is weg.
  // "Pagina's" is verhuisd naar de rij van de chat, waar hij naast "Chat over
  // deze pagina" staat in dezelfde vorm.
  const links = !!(t.copyUrl || t.bronMail || eigenTab);
  const acties = !heeftFases;
  if (!links && !acties) return null;

  return (
    <div className="wp-card-links wp-onder-regel">
      <span className="wp-onder-groep">
        {t.copyUrl && <a className="wp-link" href={t.copyUrl} target="_blank" rel="noreferrer" title="De aangeleverde copy">Copy</a>}
        {t.bronMail && <a className="wp-link" href={t.bronMail} target="_blank" rel="noreferrer" title="De mail waar deze taak uit voortkomt">Bronmail</a>}
        {eigenTab && <button type="button" className="wp-link wp-link-btn" title="Open dit dashboard-onderdeel in een nieuw tabblad" onClick={() => openTabNieuwTab(eigenTab.tab)}>{eigenTab.label}</button>}
      </span>
      {links && acties && <span className="wp-onder-scheiding" aria-hidden="true" />}
      {acties && (
        <span className="wp-onder-groep wp-onder-delen">
          {/* Alleen op een kaart zonder pagina: die heeft geen fase-blok, dus
              zonder deze twee zou je er niets mee kunnen wegsturen. */}
          <button type="button" className={"wp-act" + (dev.naarDev ? " wp-act-aan" : "")} disabled={dev.bezig}
            title={dev.naarDev ? "Staat op de developerlijst. Klik om hem er weer af te halen." : "Zet deze taak klaar voor de developer: de opdracht en de documenten."}
            onClick={() => void dev.zetNaarDev()}>
            {dev.bezig ? "Bezig…" : dev.naarDev ? "Bij developer" : "Naar developer?"}
          </button>
          <button type="button" className="wp-act wp-act-klant" title="Mail over deze kaart; de ontvanger (klant, developer of anders) kies je in het venster." onClick={() => onMail("klant")}>Mail</button>
        </span>
      )}
    </div>
  );
}
