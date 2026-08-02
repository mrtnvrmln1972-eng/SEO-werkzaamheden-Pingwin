// De aanhef van een mail, afgeleid uit het e-mailadres: "Maarten@pingwin.nl"
// wordt "Hoi Maarten,". Bewust hier uitgerekend en niet aan de assistent
// overgelaten, want die gokt anders een naam.
//
// Zowel het scherm als de mail-route gebruiken dit, zodat de aanhef die je in
// beeld ziet dezelfde is als die verstuurd wordt.

/** De voornaam uit een e-mailadres, of leeg als die er niet uit te halen is. */
export function voornaamUitAdres(adres: string): string {
  const lokaal = String(adres || "").trim().split("@")[0].replace(/[._-]+/g, " ").trim();
  if (!lokaal) return "";
  const eerste = lokaal.split(/\s+/)[0];
  // "info", "contact" en dat soort postbussen zijn geen mensen: dan liever geen naam.
  if (/^(info|contact|mail|hallo|hello|admin|team|support|sales|office|no-?reply)$/i.test(eerste)) return "";
  if (/\d/.test(eerste) || eerste.length < 2) return "";
  return eerste.charAt(0).toUpperCase() + eerste.slice(1).toLowerCase();
}

/** "Hoi Maarten," of "Hoi," als er geen naam uit het adres komt. */
export function aanhefVoor(adres: string): string {
  const naam = voornaamUitAdres(adres);
  return naam ? `Hoi ${naam},` : "Hoi,";
}

/**
 * Zet de aanhef in een al geschreven mail goed. Verandert alleen de eerste regel
 * en alleen als die al een aanhef is, zodat de rest van de tekst onaangeroerd
 * blijft. Zo kun je het adres nog wijzigen zonder de mail opnieuw te laten maken.
 */
export function herzetAanhef(tekst: string, adres: string): string {
  const regels = String(tekst || "").split("\n");
  const i = regels.findIndex((r) => r.trim());
  if (i < 0) return tekst;
  if (!/^\s*(hoi|hallo|beste|hey|hi|dag)\b[^\n]*,?\s*$/i.test(regels[i])) return tekst;
  regels[i] = aanhefVoor(adres);
  return regels.join("\n");
}
