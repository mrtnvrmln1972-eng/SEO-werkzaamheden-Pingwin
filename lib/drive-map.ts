import { CLIENT_FOLDER_KEY } from "./constants";
import { getClientBySlug } from "./clients";
import { getPageDriveFolder, savePageDriveFolder } from "./site-urls";
import { createFolder, folderName } from "./drive";

// ═══════════════════════════════════════════════════════════
// DE DRIVE-BOOM VAN EEN KLANT
// ═══════════════════════════════════════════════════════════
// Eén map per klant, met daaronder een map per pagina. Beide worden voortaan
// automatisch aangemaakt.
//
// Dat was nodig omdat het handwerk was: per pagina moest je zelf door je Drive
// bladeren en een map kiezen, en zonder die klik weigerde de dropzone elk
// Word-bestand met "deze pagina heeft nog geen Drive-map". Ondertussen greep de
// kennisbank bij gebrek aan beter naar "de map van de pagina met de kortste
// URL", en anders naar de hoofdmap van Drive; zo kon een klantdocument in een
// willekeurige paginamap belanden.
//
// De opslag blijft `page_drive_folders`. De klantmap staat daar onder de
// pseudo-URL CLIENT_FOLDER_KEY, want die tabel wil altijd een url hebben.
// ═══════════════════════════════════════════════════════════

function mapNaamVoorPad(url: string): string {
  try {
    const p = new URL(url).pathname.replace(/^\/+|\/+$/g, "");
    return p ? p.replace(/\//g, " - ") : "home";
  } catch {
    return (url || "pagina").replace(/^\/+|\/+$/g, "").replace(/\//g, " - ") || "pagina";
  }
}

/**
 * De klantmap; maakt hem aan als hij er nog niet is.
 * Geeft null als Drive niet gekoppeld is; de aanroeper moet dat kunnen dragen.
 */
export async function ensureClientFolder(slug: string): Promise<string | null> {
  const bestaand = await getPageDriveFolder(slug, CLIENT_FOLDER_KEY).catch(() => null);
  if (bestaand?.folderId) return bestaand.folderId;

  const client = await getClientBySlug(slug).catch(() => null);
  const naam = (client?.name || slug).trim() || slug;
  try {
    const map = await createFolder("root", naam);
    await savePageDriveFolder(slug, CLIENT_FOLDER_KEY, map.id, naam, naam);
    return map.id;
  } catch {
    return null;
  }
}

/**
 * De map van één pagina; maakt hem aan onder de klantmap als hij er nog niet is.
 * Lukt dat niet, dan valt hij terug op de klantmap zelf: liever een bestand in
 * de klantmap dan een mislukte upload.
 */
export async function ensurePageFolder(slug: string, url: string): Promise<string | null> {
  const bestaand = await getPageDriveFolder(slug, url).catch(() => null);
  if (bestaand?.folderId) return bestaand.folderId;

  const klantMap = await ensureClientFolder(slug);
  if (!klantMap) return null;

  const naam = mapNaamVoorPad(url);
  try {
    const map = await createFolder(klantMap, naam);
    const pad = await folderName(klantMap).then((k) => `${k} / ${naam}`).catch(() => naam);
    await savePageDriveFolder(slug, url, map.id, naam, pad);
    return map.id;
  } catch {
    return klantMap;
  }
}

/**
 * Eén ingang voor alles wat iets in Drive wil zetten: met een pagina de
 * paginamap, zonder pagina de klantmap.
 */
export async function ensureFolderFor(slug: string, url?: string | null): Promise<string | null> {
  return url ? ensurePageFolder(slug, url) : ensureClientFolder(slug);
}
