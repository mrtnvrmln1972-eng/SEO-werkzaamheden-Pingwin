// Bewaakt het blok opmaak dat een vastgelegde stijl in de kop van elke pagina zet.
//
// WAAROM DIT NAGEREKEND WORDT
// ═══════════════════════════
// Dit stukje is het enige in het dashboard dat opmaak sámenstelt in plaats van
// hem op te schrijven, en het komt op élke pagina terecht, ook bij klanten. Eén
// fout erin (een haakje kwijt, een waarde zonder eenheid, een aanhalingsteken uit
// een lettertypenaam) maakt niet één scherm stuk maar alle schermen tegelijk, en
// het is precies het soort fout dat je pas ziet als het live staat.
//
// De vier richtingen worden daarom doorgerekend en de uitkomst wordt nagekeken:
// klopt de vorm, staat er bij elke maat een eenheid, en verandert er werkelijk
// iets ten opzichte van de uitgangsstand.

import { RICHTINGEN, BASIS, themaNaarCss, themaTokens, type Thema } from "../lib/proefstijl";
import BASISMATEN from "../lib/stijl-basis.json";

let fouten = 0;
function check(naam: string, waar: boolean, toelichting = "") {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}${waar || !toelichting ? "" : `\n       ${toelichting}`}`);
}

const maten = BASISMATEN as Record<string, number>;

for (const { thema } of RICHTINGEN) {
  const css = themaNaarCss(thema);

  // Twee keer :root, want de opmaak zet dezelfde tokens ook op :root en dan
  // beslist anders de volgorde in de kop wie wint.
  check(`${thema.naam}: het blok staat op :root:root`, css.startsWith(":root:root{") && css.endsWith("}"));
  check(`${thema.naam}: het blok is in balans`,
    (css.match(/\{/g) || []).length === (css.match(/\}/g) || []).length,
    "Een blok dat niet sluit, sloopt de opmaak van élke pagina.");
  check(`${thema.naam}: er lekt geen tag of commentaar in`, !/<|\/\*/.test(css),
    "Alles hierin komt in een <style> in de kop terecht.");

  const tokens = themaTokens(thema, (n) => maten[n] ?? 0);
  const zonderEenheid = Object.entries(tokens)
    .filter(([naam]) => /^--(s|fs|lh|r)-/.test(naam))
    .filter(([, waarde]) => !/^-?[\d.]+px$/.test(waarde));
  check(`${thema.naam}: elke maat heeft een eenheid`, zonderEenheid.length === 0,
    zonderEenheid.map(([n, w]) => `${n}: ${w}`).join(", "));

  const kleuren = Object.entries(tokens)
    .filter(([naam]) => naam.includes("orange") || naam === "--accent")
    .filter(([, waarde]) => !/^#[0-9a-f]{6}$/i.test(waarde));
  check(`${thema.naam}: elke afgeleide kleur is een geldige kleur`, kleuren.length === 0,
    kleuren.map(([n, w]) => `${n}: ${w}`).join(", "));
}

// De uitgangsstand mag geen verschil maken; anders zou "niets vastgelegd" en
// "de standaard vastgelegd" er verschillend uitzien en is de knop een valstrik.
const basisTokens = themaTokens(BASIS, (n) => maten[n] ?? 0);
const verschillen = Object.entries(basisTokens)
  .filter(([naam]) => naam in maten)
  .filter(([naam, waarde]) => waarde !== `${maten[naam]}px`);
check("de uitgangsstand levert exact de maten uit de opmaak op", verschillen.length === 0,
  verschillen.map(([n, w]) => `${n}: ${w} in plaats van ${maten[n]}px`).join(", "));

// En een andere richting moet wél verschil maken, anders rekent de som nergens mee.
const strak = RICHTINGEN.find((r) => r.thema.naam === "Strak en zakelijk")?.thema as Thema;
const strakTokens = themaTokens(strak, (n) => maten[n] ?? 0);
check("een andere richting verandert de maten echt",
  strakTokens["--s-4"] !== basisTokens["--s-4"] && strakTokens["--r-md"] !== basisTokens["--r-md"]);

console.log(fouten ? `\n${fouten} fout(en).` : "\nDe vastgelegde huisstijl rekent goed door.");
if (fouten) process.exit(1);
