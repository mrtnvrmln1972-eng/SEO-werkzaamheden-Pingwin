// ═══════════════════════════════════════════════════════════
// EEN GEPLAKTE GOOGLE-LINK KRIJGT DE NAAM VAN HET DOCUMENT
// ═══════════════════════════════════════════════════════════
// Wat je zag als je een spreadsheet in de aantekeningen plakte:
//
//   https://docs.google.com/spreadsheets/d/1UJc5_O5pfnkA9KnOe8QIcKWPVJTvb56Gw2z
//   bI13lDXE/edit?gid=1138758916#gid=1138758916
//
// Twee regels adres, en je moet hem openen om te weten wát het is. Drive weet
// gewoon hoe het bestand heet, dus die naam hoort er te staan, met de link
// eronder. Precies zoals het elders in het dashboard al gaat: een document heet
// naar zijn naam, niet naar zijn adres.
//
// Dit draait in de browser, ná het plakken: het opzoeken kost een rondje naar
// Drive en dat mag het plakken zelf niet ophouden. Lukt het niet (geen rechten,
// bestand weg, Drive traag), dan blijft de link staan zoals hij was. Een adres
// is lelijk maar werkt; een lege link werkt niet.
// ═══════════════════════════════════════════════════════════

/** Onthouden wat we al opgezocht hebben: dezelfde link twee keer is zonde. */
const gevonden = new Map<string, string>();

function isGoogleLink(href: string): boolean {
  return /^https?:\/\/(docs|sheets|slides|drive)\.google\.com\//i.test(href.trim());
}

/**
 * Is dit een link waarvan de tekst het adres zelf is?
 *
 * Alleen die vervangen we. Heeft iemand er zelf een woord van gemaakt
 * ("de vestigingenlijst"), dan is dat een bewuste keuze en blijft die staan.
 */
function toontZijnEigenAdres(a: HTMLAnchorElement): boolean {
  const tekst = (a.textContent || "").trim();
  if (!tekst) return true;
  const href = (a.getAttribute("href") || "").trim();
  if (tekst === href) return true;
  // Een afgekapte weergave van hetzelfde adres telt ook ("https://docs.goo…").
  return /^https?:\/\//i.test(tekst) && href.startsWith(tekst.replace(/[…\s]+$/, ""));
}

/**
 * Zet in dit stuk scherm de naam van het document op elke Google-link die nu nog
 * zijn eigen adres toont. Geeft terug of er iets veranderd is, zodat de
 * aanroeper kan bewaren.
 */
export async function benoemDriveLinks(root: HTMLElement | null): Promise<boolean> {
  if (!root) return false;
  const ankers = Array.from(root.querySelectorAll("a[href]")) as HTMLAnchorElement[];
  const todo = ankers.filter((a) => isGoogleLink(a.getAttribute("href") || "") && toontZijnEigenAdres(a));
  if (!todo.length) return false;

  const adressen = Array.from(new Set(todo.map((a) => (a.getAttribute("href") || "").trim())));
  await Promise.all(adressen.map(async (href) => {
    if (gevonden.has(href)) return;
    try {
      const d = await fetch(`/api/admin/drive/naam?url=${encodeURIComponent(href)}`).then((r) => r.json());
      if (d?.ok && d.naam) gevonden.set(href, String(d.naam));
    } catch { /* stil: de link blijft staan zoals hij was */ }
  }));

  let veranderd = false;
  for (const a of todo) {
    const naam = gevonden.get((a.getAttribute("href") || "").trim());
    if (!naam) continue;
    a.textContent = naam;
    // De volledige link blijft bereikbaar als tooltip: je moet altijd kunnen
    // zien waar iets echt heen gaat voordat je klikt.
    a.setAttribute("title", (a.getAttribute("href") || "").trim());
    veranderd = true;
  }
  return veranderd;
}
