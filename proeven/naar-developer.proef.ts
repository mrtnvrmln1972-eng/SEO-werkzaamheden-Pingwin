// ═══════════════════════════════════════════════════════════
// EEN DEVELOPER KRIJGT DE LINK EN JOUW ZIN, EN VERDER NIETS
// ═══════════════════════════════════════════════════════════
// Op 25-08-2026 ging de taak met de ondersteunende teksten van GardenSwimm naar
// de developer. In het taakvenster stonden "Aantekeningen bij deze taak" en
// "Links uit deze taak", met daarin twee keer een linkje dat letterlijk "Mail"
// heette. In het mailvenster stonden diezelfde drie vinkjes nog een keer aan, en
// in de mailtekst kwam "mail" zes keer voor. Maartens oordeel: "aan deze twee
// versies heb ik natuurlijk geen klote. Een developer moet niet hoeven nadenken."
//
// De regel staat in lib/naar-developer.ts en geldt overal waar iets naar een
// developer gaat. Deze proef bewaakt hem, want dit is precies het soort ruis dat
// er ongemerkt weer bij sluipt zodra iemand denkt "handig, dat erbij".

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { developerMailHtml, standaardMee } from "../lib/naar-developer";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { fouten++; if (uitleg) console.log(`     | ${uitleg}`); }
}
const lees = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── Wat er standaard aanstaat ───────────────────────────────────────────────
{
  const docs = [
    { url: "https://drive/geldend", ouder: false },
    { url: "https://drive/oud", ouder: true },
    { url: "https://klant.nl/pagina/" },
  ];
  const mee = standaardMee(docs);
  proef("de geldende versie staat aan", mee.includes("https://drive/geldend"));
  proef("een oudere versie staat uit", !mee.includes("https://drive/oud"),
    "Een oude versie meesturen is precies de fout die je niet wilt maken.");
  proef("een document zonder versie-soort staat gewoon aan", mee.includes("https://klant.nl/pagina/"));
  proef("een lege lijst levert niets op", standaardMee([]).length === 0);
}

// ── De mail zelf ────────────────────────────────────────────────────────────
{
  const html = developerMailHtml({
    zin: "Kun je deze aangepaste teksten op de website van GardenSwimm zetten?",
    docs: [{ label: "Strak project in Zaamslag", url: "https://drive/doc" }],
    esc,
  });
  proef("jouw zin staat erin", html.includes("Kun je deze aangepaste teksten"), html);
  proef("de link staat erin", html.includes('href="https://drive/doc"'), html);
  proef("met de naam van het document erop", html.includes(">Strak project in Zaamslag<"), html);

  // Dit is de kern: geen enkele regel context.
  for (const ruis of ["Over deze taak", "Klant:", "Taak:", "Pagina:", "Wat er bij deze taak staat"]) {
    proef(`er staat geen "${ruis}" in`, !html.includes(ruis), html);
  }
  proef("er staat maar één opsomming in", (html.match(/<ul>/g) || []).length <= 1, html);

  // Zonder documenten geen leeg lijstje, en zonder zin geen lege alinea.
  const kaal = developerMailHtml({ zin: "", docs: [], esc });
  proef("zonder inhoud blijft er een leesbare mail over", kaal === "<p>Hoi,</p><p>Groet</p>", kaal);

  // Een document zonder naam valt terug op het adres, en verdwijnt nooit.
  const zonderNaam = developerMailHtml({ zin: "x", docs: [{ label: "", url: "https://drive/z" }], esc });
  proef("een document zonder naam verdwijnt niet", zonderNaam.includes("https://drive/z"), zonderNaam);
}

// ── De schermen houden zich eraan ───────────────────────────────────────────
{
  const dev = lees("app/admin/developer/DeveloperOverview.tsx");
  proef("de mail aan de developer wordt door de gedeelde regel gemaakt",
    /developerMailHtml\(/.test(dev),
    "Schrijf die mail nooit opnieuw uit in een scherm; dan loopt hij weer vol context.");
  proef("het blok 'Aantekeningen bij deze taak' staat er niet meer",
    !dev.includes("Aantekeningen bij deze taak"));
  proef("het blok 'Links uit deze taak' staat er niet meer",
    !dev.includes("Links uit deze taak"));
  proef("de losse links uit de kaart gaan niet meer de mail in",
    !/kaartLinks[^\n]*punten\.push/.test(dev));

  const doorzet = lees("app/admin/client/[slug]/DevDoorzetten.tsx");
  proef("het doorzet-venster laat de links uit de aantekeningen weg",
    /uitAantekening/.test(doorzet),
    "Dit venster zet een taak door naar de developer, dus dezelfde regel geldt.");

  const mail = lees("app/admin/client/[slug]/MailUitKaart.tsx");
  proef("het mailvenster biedt ze bij een developer niet aan",
    /aud === "dev" && d\.uitAantekening/.test(mail));
  proef("en zet bij een developer ook de pagina niet standaard aan",
    /t\.url && aud !== "dev"/.test(mail));
  proef("er staat niets meer standaard aangevinkt buiten de lijst om",
    !/setLinks\(t\.url \? \{ pagina: true \}/.test(mail),
    "Die regel won van de documentenlijst, waardoor juist het document NIET aanstond.");

  const route = lees("app/api/admin/weekplan/dev/route.ts");
  proef("de doorzet-route kiest alleen de geldende documenten",
    /standaardMee\(beschikbaar\)/.test(route));
  proef("en markeert de links uit de aantekeningen",
    /uitAantekening: true/.test(route));

  const schrijf = lees("app/api/admin/task/explain/route.ts");
  proef("een geschreven developer-mail is hooguit twee zinnen",
    /HOOGUIT TWEE ZINNEN/.test(schrijf));
  proef("en krijgt de achtergrond en de aantekeningen niet mee",
    /audience === "dev"\s*\n?\s*\? `Taak: \$\{taak\}`/.test(schrijf),
    "Juist die twee maakten zijn mail onleesbaar.");
}

console.log(fouten === 0 ? "\nAlles goed." : `\n${fouten} fout(en).`);
process.exit(fouten === 0 ? 0 : 1);
