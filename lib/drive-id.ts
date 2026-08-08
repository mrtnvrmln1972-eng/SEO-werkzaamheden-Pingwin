// Het bestands-id uit een Drive-link halen. Los bestand zonder server-code,
// zodat ook een scherm in de browser dit kan gebruiken (voor de voorvertoning);
// lib/drive.ts trekt de hele Google-koppeling mee en hoort niet in de browser.

export function driveIdFromUrl(input: string): string {
  const s = (input || "").trim();
  const byPath = s.match(/\/d\/([a-zA-Z0-9_-]{20,})/);
  if (byPath) return byPath[1];
  const byQuery = s.match(/[?&]id=([a-zA-Z0-9_-]{20,})/);
  if (byQuery) return byQuery[1];
  if (/^[a-zA-Z0-9_-]{20,}$/.test(s)) return s;
  return "";
}
