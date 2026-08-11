// Het bestands-id uit een Drive-link halen. Los bestand zonder server-code,
// zodat ook een scherm in de browser dit kan gebruiken (voor de voorvertoning);
// lib/drive.ts trekt de hele Google-koppeling mee en hoort niet in de browser.

// ═══════════════════════════════════════════════════════════
// EEN DOCUMENT OPENT IN DOCS, NIET IN DE DRIVE-VOORVERTONING
// ═══════════════════════════════════════════════════════════
// Drive geeft bij een geüpload bestand een link naar zijn eigen kijkscherm
// (drive.google.com/file/d/.../view). Dat is alleen kijken: je ziet het document
// als plaatje, met een knop "Openen met" die je er nog een klik bij kost. Google
// Docs opent hetzelfde .docx-bestand rechtstreeks in de bewerkmodus, met behoud
// van de huisstijl-opmaak. Dat is wat je wilt als je een tekst gaat nalezen.
//
// Weergave-laag, dus met terugwerkende kracht: ook links die al maanden in de
// database staan openen zo, zonder dat er iets aan die opslag verandert.
export function docsBewerkLink(input: string): string {
  const s = (input || "").trim();
  if (!s) return "";
  // Al een Docs/Sheets/Slides-link? Laat hem met rust.
  if (/^https?:\/\/(docs|sheets|slides)\.google\.com\//i.test(s)) return s;
  if (!/^https?:\/\/drive\.google\.com\//i.test(s)) return s;
  const id = driveIdFromUrl(s);
  return id ? `https://docs.google.com/document/d/${id}/edit?usp=sharing` : s;
}

export function driveIdFromUrl(input: string): string {
  const s = (input || "").trim();
  const byPath = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (byPath) return byPath[1];
  const byQuery = s.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (byQuery) return byQuery[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return "";
}
