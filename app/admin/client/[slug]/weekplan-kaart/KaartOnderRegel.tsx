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

function shortUrl(url: string): string { try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; } }

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

  // Alleen de vlag omzetten, zonder het doorzet-venster. Voor het vinkje "ligt
  // bij dev" in de Implementatie-rij: dat zegt "hij ligt daar", het stuurt niets
  // door. Zelfde vlag als de knop hierboven, dus de kaart, de fase-chip en de
  // developerlijst blijven één stand tonen in plaats van twee die uit elkaar
  // kunnen lopen.
  async function markeerNaarDev(aan: boolean) {
    if (bezig) return;
    setBezig(true);
    try {
      const d = await fetch("/api/admin/weekplan", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id: t.id, naarDev: aan }),
      }).then((r) => r.json());
      if (d?.ok) setNaarDev(aan);
      else setFoutje(d?.error || "De stand bij de developer bijwerken mislukte.");
    } catch { setFoutje("De stand bij de developer bijwerken mislukte."); }
    finally { setBezig(false); }
  }

  return { naarDev, setNaarDev, bezig, venster, setVenster, zetNaarDev, markeerNaarDev };
}

export type NaarDev = ReturnType<typeof useNaarDev>;

export default function KaartOnderRegel({ slug, t, dev, onMail }: {
  slug: string; t: WpTask; dev: NaarDev;
  onMail: (aud: "klant" | "dev") => void;
}) {
  // Dashboard-deeplinks vanuit een kaart openen in een NIEUW browsertabblad,
  // zodat je het bord niet kwijtraakt terwijl je iets uitzoekt.
  const openPaginaNieuwTab = () => window.open(`/admin/client/${slug}?tab=paginas&page=${encodeURIComponent(t.url)}`, "_blank");
  const openTabNieuwTab = (tabNaam: string) => window.open(`/admin/client/${slug}?tab=${tabNaam}${tabNaam === "paginas" && t.url ? `&page=${encodeURIComponent(t.url)}` : ""}`, "_blank");
  const tab0 = TAB_FOR_TYPE[t.taaktype];
  const tab = tab0 && (tab0.tab !== "paginas" || t.url) ? tab0 : undefined;

  return (
    <div className="wp-card-links wp-onder-regel">
      <span className="wp-onder-groep">
        {t.url && <a className="wp-link" href={t.url} target="_blank" rel="noreferrer" title="De live pagina">{shortUrl(t.url)}</a>}
        {t.copyUrl && <a className="wp-link" href={t.copyUrl} target="_blank" rel="noreferrer" title="De aangeleverde copy">Copy</a>}
        {t.bronMail && <a className="wp-link" href={t.bronMail} target="_blank" rel="noreferrer" title="De mail waar deze taak uit voortkomt">Bronmail</a>}
        {/* Geen dubbele knop: bij paginakaarten dekt de Pagina's-knop hieronder het al. */}
        {tab && tab.tab !== "paginas" && <button type="button" className="wp-link wp-link-btn" title="Open dit dashboard-onderdeel in een nieuw tabblad" onClick={() => openTabNieuwTab(tab.tab)}>{tab.label}</button>}
        {t.url && <button type="button" className="wp-link wp-link-btn" title="Open de pagina in Pagina's (nieuw tabblad)" onClick={openPaginaNieuwTab}>Pagina&rsquo;s</button>}
      </span>
      <span className="wp-onder-scheiding" aria-hidden="true" />
      <span className="wp-onder-groep wp-onder-delen">
        {/* Doorzetten naar de developer stond bovenin de kaart, naast Opschonen
            en Is dit doorgevoerd?. Dat is geen meting of controle, maar iets
            wegsturen, dus hij hoort bij Mail in dit groepje rechtsonder. */}
        <button type="button" className={"wp-act" + (dev.naarDev ? " wp-act-aan" : "")} disabled={dev.bezig}
          title={dev.naarDev ? "Staat op de developerlijst. Klik om hem er weer af te halen." : "Zet deze kaart klaar voor de developer: de opdracht, de pagina en de documenten."}
          onClick={() => void dev.zetNaarDev()}>
          {dev.bezig ? "Bezig…" : dev.naarDev ? "✓ Bij de developer" : "Developer"}
        </button>
        <button type="button" className="wp-act wp-act-klant" title="Mail over deze kaart; de ontvanger (klant, developer of anders) kies je in het venster." onClick={() => onMail("klant")}>Mail</button>
      </span>
    </div>
  );
}
