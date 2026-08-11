// ═══════════════════════════════════════════════════════════
// VOORAF OPHALEN: de data onderweg terwijl de pagina nog laadt
// ═══════════════════════════════════════════════════════════
// Een paneel in de cockpit haalt zijn eigen data op met een `fetch` in een
// `useEffect`. Dat gebeurt pas als de browser álle JavaScript heeft gedownload
// én uitgevoerd. Voor de Planning betekende dat: HTML wachten, dan honderden
// kilobytes JavaScript wachten, en dán pas begon het verzoek waar je eigenlijk
// op zat te wachten. Drie dingen achter elkaar die net zo goed tegelijk kunnen.
//
// Dit lost dat op. De server zet een piepklein regeltje in de pagina dat het
// verzoek meteen start; het paneel pikt de uitkomst later op in plaats van
// opnieuw te vragen. Zo loopt het ophalen van data gelijk op met het laden van
// de pagina zelf.
//
// Bewust géén cache: het is exact hetzelfde verzoek, alleen eerder gestart. Is
// er niets voorgestart (ander tabblad, oude pagina), dan haalt het paneel het
// gewoon zelf op.
// ═══════════════════════════════════════════════════════════

type Voorraad = Record<string, Promise<unknown> | undefined>;

declare global {
  // eslint-disable-next-line no-var
  var __pingwinVooraf: Voorraad | undefined;
}

/**
 * Het regeltje dat de server in de pagina zet. Start het verzoek en bewaart de
 * belofte onder `sleutel`.
 */
export function voorafScript(sleutel: string, url: string): string {
  // JSON.stringify dekt aanhalingstekens af; `</script>` wordt onschadelijk
  // gemaakt zodat een gekke slug het script niet kan afbreken.
  const veilig = (s: string) => JSON.stringify(s).replace(/</g, "\\u003c");
  return `window.__pingwinVooraf=window.__pingwinVooraf||{};` +
    `try{window.__pingwinVooraf[${veilig(sleutel)}]=` +
    `fetch(${veilig(url)},{credentials:"same-origin"}).then(function(r){return r.json()})` +
    `.catch(function(){return null})}catch(e){}`;
}

/**
 * Haalt de vooraf gestarte uitkomst op, of doet het verzoek alsnog zelf.
 * De voorraad wordt na gebruik geleegd, zodat een verversing verse data haalt.
 */
export async function haalVooraf<T>(sleutel: string, url: string): Promise<T> {
  const voorraad = typeof window === "undefined" ? undefined : window.__pingwinVooraf;
  const klaar = voorraad?.[sleutel];
  if (klaar) {
    delete voorraad![sleutel];
    const d = (await klaar) as T | null;
    if (d) return d;   // niets terug (netwerkfout): hieronder gewoon opnieuw
  }
  return (await fetch(url, { credentials: "same-origin" }).then((r) => r.json())) as T;
}
