import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

// ── Overzicht van de clusteranalyses die als webpagina klaarstaan ──
//
// De lijst wordt NIET met de hand bijgehouden. Bij elke bouw leest deze pagina
// de map public/share/cluster/<klant>/ uit: elk .html-bestand daarin is een
// cluster, en staat er een gelijknamig bestand in de map intern-9f3a2b, dan is
// dat de interne versie ernaast. Zet je een nieuwe analyse neer, dan staat hij
// er na de eerstvolgende deploy vanzelf bij.
//
// Een lijst in code zou de tweede plek zijn waar hetzelfde staat, en twee
// plekken met dezelfde waarheid lopen uit elkaar zodra iemand haast heeft. Dat
// is in dit project al vaak genoeg misgegaan.

const CLUSTER_MAP = join(process.cwd(), "public", "share", "cluster");
const INTERN_MAP = "intern-9f3a2b";

// Dit is een interne index: hij noemt de interne versie, dus hij hoort niet in
// Google. De klantversie zelf draagt zijn eigen noindex.
export const metadata = { robots: { index: false, follow: false } };

// Alleen klanten die echt een map hebben krijgen een pagina. Daarmee kan er via
// het adres nooit een andere map uitgelezen worden dan deze.
export const dynamicParams = false;

export function generateStaticParams() {
  if (!existsSync(CLUSTER_MAP)) return [];
  return readdirSync(CLUSTER_MAP, { withFileTypes: true })
    .filter((m) => m.isDirectory())
    .map((m) => ({ klant: m.name }));
}

type Cluster = { naam: string; titel: string; klant: string; intern: string | null };

function clustersVan(klant: string): Cluster[] {
  const map = join(CLUSTER_MAP, klant);
  if (!existsSync(map)) return [];

  return readdirSync(map, { withFileTypes: true })
    .filter((b) => b.isFile() && b.name.endsWith(".html"))
    .map((b) => {
      const naam = b.name.replace(/\.html$/, "");
      const internBestand = join(map, INTERN_MAP, b.name);
      return {
        naam,
        titel: naam.charAt(0).toUpperCase() + naam.slice(1).replace(/-/g, " "),
        klant: `/share/cluster/${klant}/${b.name}`,
        // De interne link wijst naar het gelijknamige bestand in intern-9f3a2b.
        // Bestaat dat niet, dan tonen we geen link in plaats van een dode.
        intern: existsSync(internBestand) ? `/share/cluster/${klant}/${INTERN_MAP}/${b.name}` : null,
      };
    })
    .sort((a, b) => a.titel.localeCompare(b.titel, "nl"));
}

export default function ClusterOverzicht({ params }: { params: { klant: string } }) {
  const clusters = clustersVan(params.klant);

  return (
    <div className="cl-page">
      <div className="header">
        <div className="header-left">
          <a href="/" className="logo-link" title="Pingwin SEO Dashboard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
          </a>
          <div className="header-divider" />
          <div>
            <div className="header-title">Clusteranalyses</div>
            <div className="header-client">{params.klant}</div>
          </div>
        </div>
      </div>

      <div className="cl-container">
        <p className="cl-intro">
          Per cluster staan er twee versies klaar. De klantversie kun je doorsturen; de interne versie zit
          achter een wachtwoord en bevat de afwegingen die niet voor de klant bedoeld zijn.
        </p>

        {clusters.length === 0 ? (
          <div className="card">
            <p className="cl-leeg">
              Er staat nog geen clusteranalyse klaar voor deze klant. Zet een bestand in
              public/share/cluster/{params.klant}/ en het staat hier na de volgende deploy.
            </p>
          </div>
        ) : (
          <div className="cl-lijst">
            {clusters.map((c) => (
              <div key={c.naam} className="card cl-kaart">
                <div className="cl-naam">{c.titel}</div>
                <div className="row cl-acties">
                  <a className="btn btn-primary" href={c.klant}>Klantversie</a>
                  {c.intern ? (
                    <a className="btn btn-ghost" href={c.intern}>Intern</a>
                  ) : (
                    <span className="chip">geen interne versie</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
