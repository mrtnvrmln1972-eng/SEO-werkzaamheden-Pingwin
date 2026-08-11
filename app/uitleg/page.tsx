import { cookies } from "next/headers";
import type { Metadata } from "next";
import { ADMIN_COOKIE, verifyAdminSession } from "../../lib/admin-auth";
import { mdToHtml } from "../../lib/markdown";
import {
  LAATST_BIJGEWERKT, LEESROUTES, zichtbareHoofdstukken,
  type Uitklapper, type Hoofdstuk,
} from "../../lib/uitleg";
import { alleSchermen } from "../../lib/schermbeeld";
import { nieuwtjes, leesbareDatum } from "../../lib/wat-is-nieuw";

// ═══════════════════════════════════════════════════════════
// /uitleg — HET VERHAAL VAN HET DASHBOARD
// ═══════════════════════════════════════════════════════════
// Openbaar leesbaar (staat niet in de middleware-matcher), zodat de link zonder
// omhaal naar een klant, een lead of een investeerder kan. De hoofdstukken met
// de interne markering verschijnen alleen mét beheerderssessie; zo blijft het
// één document in plaats van twee die uit elkaar lopen.
//
// De inhoud staat volledig in lib/uitleg/ (één bestand per hoofdstuk). Deze
// pagina rendert alleen. Niets
// hier bevat tekst over het dashboard zelf, want dan zou de uitleg op twee
// plekken staan.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zo werkt het Pingwin SEO Dashboard",
  description: "Hoe het dashboard werkt, waar het mee gekoppeld is, hoe de analyses gebeuren en hoe je het gebruikt.",
};

// Uitklapper met eventuele sub-uitklappers. Bewust met <details>: werkt
// server-gerenderd, zonder JavaScript, en blijft open bij zoeken in de pagina.
function Blok({ u, diep = 0 }: { u: Uitklapper; diep?: number }) {
  return (
    <details className={diep === 0 ? "ut-blok" : "ut-blok ut-blok-sub"}>
      <summary>
        <span className="ut-pijl" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>
        </span>
        <span className="ut-blok-kop">
          <span className="ut-blok-titel">{u.titel}</span>
          {u.kern && <span className="ut-blok-kern">{u.kern}</span>}
        </span>
      </summary>
      <div className="ut-blok-body">
        <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(u.tekst) }} />
        {u.sub?.length ? (
          <div className="ut-subs">
            {u.sub.map((s) => <Blok key={s.titel} u={s} diep={diep + 1} />)}
          </div>
        ) : null}
      </div>
    </details>
  );
}

function HoofdstukKaart({ h, nr, beeld }: { h: Hoofdstuk; nr: number; beeld?: { label: string; dataUrl: string } }) {
  return (
    <section id={h.id} className="card ut-hoofdstuk">
      <div className="ut-h-kop">
        <span className="ut-nr">{String(nr).padStart(2, "0")}</span>
        <div className="ut-h-tekst">
          <h2 className="ut-h-titel">
            {h.titel}
            {h.intern && <span className="chip ut-chip-intern">Alleen intern</span>}
          </h2>
          <p className="ut-h-intro">{h.intro}</p>
        </div>
      </div>
      {beeld && (
        <div className="uitleg-hoofdstuk-beeld">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={beeld.dataUrl} alt={beeld.label} loading="lazy" />
        </div>
      )}
      <div className="ut-blokken">
        {h.uitklappers.map((u) => <Blok key={u.titel} u={u} />)}
      </div>
    </section>
  );
}

export default async function UitlegPage() {
  const isBeheerder = verifyAdminSession(cookies().get(ADMIN_COOKIE)?.value);
  const hoofdstukken = zichtbareHoofdstukken(isBeheerder);
  const nieuws = nieuwtjes();
  const schermen = await alleSchermen();
  const beelden = new Map(schermen.map((s) => [s.hoofdstuk, { label: s.label, dataUrl: s.dataUrl }]));

  return (
    <div className="ut-page">
      <div className="header">
        <div className="header-left">
          <a href="/uitleg" className="logo-link" title="Zo werkt het dashboard">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
          </a>
          <div className="header-divider" />
          <div>
            <div className="header-title">Pingwin SEO Dashboard</div>
            <div className="header-client">Zo werkt het</div>
          </div>
        </div>
        <div className="header-right">
          <span className="ut-datum">Bijgewerkt {LAATST_BIJGEWERKT}</span>
          {isBeheerder && (
            <a className="logout-btn" href="/admin" style={{ marginLeft: "var(--s-3)" }} title="Terug naar het klantenoverzicht">Naar de cockpit</a>
          )}
        </div>
      </div>

      <div className="ut-container">

        {/* ── Kop ── */}
        <header className="ut-hero">
          <span className="ut-hero-label">De volledige uitleg</span>
          <h1 className="ut-hero-titel">
            Een <span>SEO-consultant</span> die het operationele werk uit handen neemt
          </h1>
          <p className="ut-hero-tekst">
            Dit dashboard leest de bronnen uit die een SEO-traject nodig heeft, meet wat er werkelijk op een site
            staat, bepaalt waar de snelste winst zit, maakt de documenten, voert het goedgekeurde werk door op de
            site en meet daarna of het gewerkt heeft. Alles per klant, met datum, en met het bewijs erbij.
          </p>
          <p className="ut-hero-tekst ut-hero-tekst-2">
            Hieronder staat precies hoe dat gebeurt. Klap open wat je wilt weten; je hoeft niets op volgorde te
            lezen.
          </p>
        </header>

        {/* ── Leesroutes ── */}
        <div className="ut-routes">
          {LEESROUTES.map((r) => (
            <div key={r.label} className="ut-route">
              <div className="ut-route-kop">{r.label}</div>
              <p className="ut-route-regel">{r.regel}</p>
              <div className="ut-route-links">
                {r.hoofdstukken
                  .map((id) => hoofdstukken.find((h) => h.id === id))
                  .filter((h): h is Hoofdstuk => Boolean(h))
                  .map((h) => (
                    <a key={h.id} href={`#${h.id}`} className="ut-route-link">{h.titel}</a>
                  ))}
              </div>
            </div>
          ))}
        </div>

        {/* ── Inhoud ── */}
        <nav className="card ut-inhoud" aria-label="Inhoudsopgave">
          <div className="ut-inhoud-kop">Inhoud</div>
          <ol className="ut-inhoud-lijst">
            {hoofdstukken.map((h, i) => (
              <li key={h.id}>
                <a href={`#${h.id}`}>
                  <span className="ut-inhoud-nr">{String(i + 1).padStart(2, "0")}</span>
                  <span>{h.titel}</span>
                  {h.intern && <span className="chip ut-chip-intern">Intern</span>}
                </a>
              </li>
            ))}
          </ol>
          {!isBeheerder && (
            <p className="ut-inhoud-voet">
              Er is één hoofdstuk met de openstaande punten en de zwakke plekken. Dat staat achter de
              beheerderslogin, zodat deze pagina gedeeld kan worden zonder dat de interne agenda meegaat.
            </p>
          )}
        </nav>

        {/* ── Wat is er nieuw ──
            Stond hier niet: de hele opsomming zat als één zin van vijfduizend
            tekens in de kopbalk geplakt, achter het woord "Bijgewerkt". Nu een
            eigen, ingeklapt blok met een regel per oplevering, nieuwste eerst. */}
        <details className="ut-nieuw">
          <summary className="ut-nieuw-kop">
            Wat is er nieuw <span className="ut-nieuw-aantal">{nieuws.length}</span>
          </summary>
          <ul className="ut-nieuw-lijst">
            {nieuws.map((n, i) => (
              <li key={i} className="ut-nieuw-item">
                <span className="ut-nieuw-datum">{leesbareDatum(n.datum)}</span>
                <span className="ut-nieuw-tekst">{n.tekst}</span>
              </li>
            ))}
          </ul>
        </details>

        {/* ── De hoofdstukken ── */}
        {hoofdstukken.map((h, i) => <HoofdstukKaart key={h.id} h={h} nr={i + 1} beeld={beelden.get(h.id)} />)}

        <footer className="ut-voet">
          <p>
            Pingwin Online Marketing. Deze uitleg wordt bijgewerkt zodra het dashboard verandert; laatste
            bijwerking {LAATST_BIJGEWERKT}.
          </p>
          <a className="btn btn-primary" href="https://pingwin.nl" target="_blank" rel="noreferrer">Naar pingwin.nl</a>
        </footer>
      </div>
    </div>
  );
}
