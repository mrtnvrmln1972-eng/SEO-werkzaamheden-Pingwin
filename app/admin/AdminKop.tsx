"use client";

// ═══════════════════════════════════════════════════════════
// DE KOPBALK VAN ELK BEHEERSCHERM
// ═══════════════════════════════════════════════════════════
// Er was geen gedeelde kopbalk: negen schermen schreven elk hun eigen versie van
// hetzelfde blok (logo, titel, het Intern-menu, een terugweg). Dat werkt zolang
// je eraan denkt, en op 6 augustus 2026 dacht ik er niet aan. Het schrijfstijl-
// scherm kwam live zonder kop, zonder menu en zonder terugweg: je landde op een
// kale pagina zonder uitweg.
//
// Een regel in een document lost dat niet op, want die regel stónd er al. Wat het
// wel oplost is dit: één bouwsteen die de kopbalk ÍS. Wie een beheerscherm maakt
// gebruikt hem, en `proeven/opmaak.proef.ts` wordt rood als een scherm hem mist.
// Zo is het niet meer iets om te onthouden.
//
// De bestaande schermen tekenen hun eigen kopbalk nog; die migreren stuk voor
// stuk. De proef kent die lijst en let erop dat hij korter wordt en nooit langer.
// ═══════════════════════════════════════════════════════════

import OntwikkelMenu from "./OntwikkelMenu";

export default function AdminKop({ titel, terug = "/admin", terugLabel = "Naar de klanten" }: {
  /** Waar je bent, bijvoorbeeld "Routekaart" of "Hoe jij schrijft". */
  titel: string;
  terug?: string;
  terugLabel?: string;
}) {
  return (
    <div className="header">
      <div className="header-left">
        <a href="/admin" className="logo-link" title="Naar het klantenoverzicht">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
        </a>
        <div className="header-divider" />
        <div>
          <div className="header-title">Pingwin SEO Dashboard</div>
          <div className="header-client">{titel}</div>
        </div>
      </div>
      <div className="header-right">
        <OntwikkelMenu />
        <a className="logout-btn" href={terug}>{terugLabel}</a>
      </div>
    </div>
  );
}
