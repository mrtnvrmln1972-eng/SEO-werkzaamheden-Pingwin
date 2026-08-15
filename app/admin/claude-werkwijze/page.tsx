import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../lib/admin-auth";
import AdminKop from "../AdminKop";
import { HOOFDSTUKKEN, anker } from "../../../lib/claude-tips";

// ═══════════════════════════════════════════════════════════
// /admin/claude-werkwijze — HOE JE MET CLAUDE WERKT
// ═══════════════════════════════════════════════════════════
// Deze pagina rendert alleen; de inhoud staat in lib/claude-tips/, één bestand
// per hoofdstuk. Dat is met opzet: de tekst stond eerst in dit bestand, en dan
// moet élke chat die een tip toevoegt in de pagina zelf schrijven. Twee chats op
// één dag botsen dan gegarandeerd, in tekst die niets met elkaar te maken heeft.
// Dezelfde les als bij lib/uitleg.ts en LAATST_BIJGEWERKT.
//
// Bewust GEEN database en geen invulscherm: dit groeit doordat Maarten tegen
// Claude zegt "zet dit er ook bij", en Claude er één blok bij zet. De repo is
// het geheugen, niet een UI.
// ═══════════════════════════════════════════════════════════

export const dynamic = "force-dynamic";

/** Een pad wordt vanzelf klikbaar; de vaste opmaakregel geldt ook hier. */
function Waar({ waar }: { waar: string }) {
  if (!waar.startsWith("/")) return <span className="cw-waar">{waar}</span>;
  return <a className="cw-waar" href={waar}>{waar}</a>;
}

export default async function ClaudeWerkwijzePage() {
  if (!cookies().get(ADMIN_COOKIE)?.value) redirect("/admin/login");

  const totaal = HOOFDSTUKKEN.reduce((n, h) => n + h.tips.length, 0);

  return (
    <>
      <AdminKop titel="Claude-werkwijze" />
      <div className="container">
        <div className="cw-wrap">
          <p className="cw-intro">
            Praktische geheugensteun voor het werken met Claude zelf: wat je aanhaakt, welk model en
            welke denkstand, hoe je herkent dat een sessie vastzit in plaats van traag is, en hoe je
            de kosten laag houdt. {totaal} tips in {HOOFDSTUKKEN.length} hoofdstukken. Kom je iets
            tegen dat hier nog niet staat, zeg dan tegen Claude &ldquo;zet dit er ook bij&rdquo;;
            zo groeit deze lijst.
          </p>

          {/* Snelmenu: dit scherm is om te scannen, niet om te lezen. */}
          <nav className="cw-snel" aria-label="Naar een hoofdstuk">
            {HOOFDSTUKKEN.map((h) => (
              <a className="chip cw-chip" key={h.titel} href={`#${anker(h.titel)}`}>
                {h.titel}
              </a>
            ))}
          </nav>

          {HOOFDSTUKKEN.map((h) => (
            <div className="card section cw-kaart" key={h.titel} id={anker(h.titel)}>
              <div className="section-title">{h.titel}</div>
              <p className="cw-waarvoor">{h.waarvoor}</p>
              <ul className="cw-lijst">
                {h.tips.map((tip) => (
                  <li key={tip.titel}>
                    <strong>{tip.titel}.</strong> {tip.tekst}
                    {(tip.waar || tip.geleerd) && (
                      <span className="cw-meta">
                        {tip.waar && <Waar waar={tip.waar} />}
                        {tip.geleerd && <span className="cw-geleerd">geleerd op {tip.geleerd}</span>}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
