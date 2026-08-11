import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE } from "../../../../../lib/admin-auth";
import { ADMIN_VIEWAS_COOKIE } from "../../../../../lib/constants";
import { getScopeFromCookie, canAccessSlug } from "../../../../../lib/admin-scope";
import { getPageDocOutputs } from "../../../../../lib/site-urls";
import { mdToHtml } from "../../../../../lib/markdown";

export const dynamic = "force-dynamic";

// De interne documentweergave: de vastgelegde tekst van één stap (analyse,
// blauwdruk of copy) van één pagina, direct uit de database. Dit is het vangnet
// voor pagina's waar de tekst wél gegenereerd is maar er (nog) geen Drive-map
// gekozen was: zonder deze weergave bestond die tekst wel, maar was er niets om
// aan te klikken. Zelfde toegangsregels als de cockpit.
const KIND_LABEL: Record<string, string> = { analyse: "Analyse", blauwdruk: "Blauwdruk", copy: "Copy", structured: "Structured data" };

export default async function DocumentPage({ params, searchParams }: {
  params: { slug: string };
  searchParams: { url?: string; kind?: string };
}) {
  const scope = await getScopeFromCookie(cookies().get(ADMIN_COOKIE)?.value, cookies().get(ADMIN_VIEWAS_COOKIE)?.value);
  if (!scope) redirect("/admin/login");
  if (!canAccessSlug(scope, params.slug)) redirect("/admin");
  const url = String(searchParams.url || "").trim();
  const kind = String(searchParams.kind || "").trim();
  if (!url || !KIND_LABEL[kind]) redirect(`/admin/client/${params.slug}`);

  const outputs = await getPageDocOutputs(params.slug, url).catch(() => ({} as Record<string, string>));
  const content = (outputs[kind] || "").trim();
  const siteBase = (url.match(/^https?:\/\/[^/]+/i) || [""])[0];
  const pad = (() => { try { return new URL(url).pathname || url; } catch { return url; } })();

  return (
    <div className="ut-page">
      <section className="card ut-hoofdstuk">
        <div className="ut-h-kop">
          <div className="ut-h-tekst">
            <h2 className="ut-h-titel">{KIND_LABEL[kind]} voor {pad}</h2>
            <p className="ut-h-intro">
              Dit is de <strong>ruwe vastgelegde tekst</strong> van deze stap, zoals hij in het dashboard staat.
              Het opgemaakte stuk dat naar de klant gaat, haal je met de knop hieronder.{" "}
              <a href={url} target="_blank" rel="noreferrer">Bekijk de live pagina</a>{" · "}
              <a href={`/admin/client/${params.slug}?tab=paginas&page=${encodeURIComponent(url)}`}>Naar de cockpit</a>
            </p>
          </div>
        </div>
        {content ? (
          <>
            {/* Deze weergave was het vangnet voor pagina's zonder Drive-map, maar
                een klik op een copy-link gaf zo ruwe tekst in plaats van het
                opgemaakte document. Het document wordt nu gewoon gemaakt, met of
                zonder Drive-map. */}
            <p className="row">
              <a className="btn btn-primary" href={`/api/admin/document-docx?slug=${encodeURIComponent(params.slug)}&kind=${encodeURIComponent(kind)}&url=${encodeURIComponent(url)}`}>
                Open als Word-document in de huisstijl
              </a>
            </p>
            <p className="muted">
              Het document wordt op dit moment opgebouwd, dus het downloaden duurt even.
              {kind === "copy" ? " Bij copy krijg je de volledige klant-briefing: omslag, uitleg, de zoekwoorden en de webteksten." : ""}
            </p>
            <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(content, siteBase) }} />
          </>
        ) : (
          <p className="muted">Er is nog geen vastgelegde {KIND_LABEL[kind].toLowerCase()}-tekst voor deze pagina. Start de stap vanuit de projectkaart of de Pagina&rsquo;s-tab.</p>
        )}
      </section>
    </div>
  );
}
