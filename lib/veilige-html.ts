// ═══════════════════════════════════════════════════════════
// VEILIGE HTML: opschonen en terugzetten naar leesbare tekst
// ═══════════════════════════════════════════════════════════
// Overal waar Maarten zelf opmaakbare tekst opslaat (Zoekwoorden & links,
// Top Prio's, bespreekpunten) gaat de inhoud door dezelfde poort. Stond eerst
// alleen in lib/focus.ts; nu op één plek zodat er geen tweede, soepelere
// variant naast komt te staan.

// Verwijdert scripts/handlers; laat opmaak- en link-tags staan. De inhoud wordt
// alleen door de beheerder geschreven en getoond, dit is een extra vangnet.
export function sanitizeHtml(html: string): string {
  return (html || "")
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "");
}

// Platte tekst als HTML tonen: tekens die HTML zouden worden onschadelijk maken.
export function escapeHtml(s: string): string {
  return (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Bevat deze tekst echte HTML, of is het gewoon platte tekst? Nodig omdat
// bespreekpunten van vóór de opmaak-versie platte tekst zijn, en punten die
// vanuit een AI-antwoord of een projectkaart binnenkomen dat nog steeds zijn.
export function isHtml(s: string): boolean {
  return /<(\/?)(a|b|i|u|p|br|em|strong|ul|ol|li|div|span|h[1-6]|table|details|summary)\b/i.test(s || "");
}

// HTML terug naar leesbare platte tekst, voor een mailto-link (die kan alleen
// tekst dragen). Bullets worden streepjes, regeleindes blijven regeleindes, en
// een link die ergens anders heen wijst dan zijn eigen tekst krijgt het adres
// erachter, zodat de ontvanger niets misloopt.
export function htmlNaarTekst(html: string): string {
  if (!isHtml(html)) return (html || "").trim();
  let s = html;
  s = s.replace(/<a\b[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, tekst: string) => {
    const kaal = tekst.replace(/<[^>]*>/g, "").trim();
    return kaal && href && kaal !== href ? `${kaal} (${href})` : (kaal || href);
  });
  s = s.replace(/<li\b[^>]*>/gi, "\n- ");
  s = s.replace(/<br\s*\/?>/gi, "\n");
  // Het kopje van een uitklapper is een eigen regel; zonder deze twee plakt de
  // titel aan zijn eigen inhoud vast zodra de tekst naar een mail of naar de
  // assistent gaat.
  s = s.replace(/<\/summary>/gi, "\n");
  s = s.replace(/<\/(p|div|li|ul|ol|h[1-6]|tr|details)>/gi, "\n");
  s = s.replace(/<[^>]*>/g, "");
  s = s.replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');
  return s.replace(/\n{3,}/g, "\n\n").split("\n").map((r) => r.trimEnd()).join("\n").trim();
}
