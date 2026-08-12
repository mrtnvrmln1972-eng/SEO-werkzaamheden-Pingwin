// Proef op het samenvoeg-briefje (lib/opruim-samenvoegen.ts).
//
// Waarom dit bestand er is. Samenvoegen is content overzetten en dán pas
// redirecten; een 301 naar een doel waar de inhoud niet op staat is voor
// Google een soft 404 en draagt niets over. Het briefje is de poort die dat
// afdwingt, en een poort waarvan het oordeel stilletjes verschuift (een
// drempel, een normalisatie, een stopwoord) is erger dan geen poort: dan
// staat er "niets over te zetten" op een pagina die wél iets waard is, en
// gaat de redirect-knop open op een meetfout.
//
// Wat hier vastligt:
//   - een sectie die het doel mist wordt gezien, en houdt de redirect tegen;
//   - een zoekterm met bezoekers die het doel niet dekt houdt de redirect tegen;
//   - ruis (termen zonder klikken en met een handvol vertoningen) houdt hem
//     NIET tegen: anders komt geen enkele samenvoeging ooit door de poort;
//   - is alles gedekt, dan is het oordeel "meteen";
//   - een pagina die niet gelezen kon worden geeft NOOIT "meteen": het veilige
//     oordeel bij een meetfout is "overzetten", met het voorbehoud erbij;
//   - de instructie voor de sitebouwer bevat de vaste stappen (secties,
//     zoektermen, interne links, redirect als laatste) en de volgorde-regel.
//
// Alles rekent op verzonnen pagina's, zonder netwerk en zonder database.

import { beoordeelSamenvoeging, bouwInstructie, type PaginaFeiten } from "../lib/opruim-samenvoegen";

let fouten = 0;
function check(naam: string, gekregen: unknown, verwacht: unknown) {
  const ok = String(gekregen) === String(verwacht);
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}`);
  if (!ok) console.log(`       verwacht: ${JSON.stringify(verwacht)}\n       gekregen: ${JSON.stringify(gekregen)}`);
}
function checkWaar(naam: string, conditie: boolean, uitleg = "") {
  if (!conditie) fouten++;
  console.log(`${conditie ? "OK  " : "FOUT"} | ${naam}`);
  if (!conditie && uitleg) console.log(`       ${uitleg}`);
}

const pagina = (p: Partial<PaginaFeiten>): PaginaFeiten => ({
  gelezen: true, titel: "", koppen: [], tekst: "", termen: [], ...p,
});

// ── 1. Een sectie die het doel mist houdt de redirect tegen ──
{
  const bron = pagina({
    titel: "SOA test thuis",
    koppen: ["SOA test thuis", "Hoe werkt de thuistest", "Uitslag binnen 48 uur"],
    tekst: "Met een thuistest neem je zelf een monster af.",
  });
  const doel = pagina({
    titel: "Anonieme SOA test",
    koppen: ["Anonieme SOA test", "Uitslag binnen 48 uur"],
    tekst: "Kom langs in een van onze klinieken voor een anonieme test.",
  });
  const b = beoordeelSamenvoeging(bron, doel);
  check("ontbrekende sectie geeft oordeel overzetten", b.oordeel, "overzetten");
  checkWaar("de thuistest-sectie staat in de lijst", b.koppen.some((k) => k.includes("thuistest")),
    `koppen: ${JSON.stringify(b.koppen)}`);
  checkWaar("de gedeelde kop (Uitslag binnen 48 uur) staat er NIET in", !b.koppen.some((k) => k.includes("Uitslag")),
    "een kop die het doel al heeft is geen werk");
}

// ── 2. Een zoekterm met bezoekers die het doel niet dekt houdt tegen ──
{
  const bron = pagina({
    koppen: ["Chlamydia test"],
    termen: [{ keyword: "chlamydia test kopen", klikken: 12, vertoningen: 400, positie: 9 }],
  });
  const doel = pagina({
    titel: "SOA test",
    koppen: ["SOA test", "Chlamydia test"],
    tekst: "Wij testen op chlamydia en gonorroe in de kliniek.",
  });
  const b = beoordeelSamenvoeging(bron, doel);
  check("unieke zoekterm met klikken geeft overzetten", b.oordeel, "overzetten");
  check("de term staat in de lijst", b.termen[0]?.keyword, "chlamydia test kopen");
}

// ── 3. Ruis houdt de poort niet dicht, en dekking telt over de hele pagina ──
{
  const bron = pagina({
    koppen: ["Chlamydia test"],
    termen: [
      { keyword: "chlamydia test", klikken: 0, vertoningen: 80, positie: 40 },   // gedekt door doel
      { keyword: "chlamydia snelt onzin", klikken: 0, vertoningen: 3, positie: 90 }, // ruis: 3 vertoningen
    ],
  });
  const doel = pagina({
    titel: "SOA test",
    koppen: ["SOA test", "Chlamydia test"],
    tekst: "Wij testen op chlamydia in de kliniek. De test is anoniem.",
  });
  const b = beoordeelSamenvoeging(bron, doel);
  check("alles gedekt en alleen ruis over: oordeel meteen", b.oordeel, "meteen");
  check("geen termen in de lijst", b.termen.length, 0);
}

// ── 4. "de soa-test" en "soa test" zijn dezelfde inhoudswoorden ──
{
  const bron = pagina({
    koppen: ["De SOA-test voor thuis"],
    termen: [{ keyword: "de soa-test thuis", klikken: 5, vertoningen: 100, positie: 12 }],
  });
  const doel = pagina({
    titel: "SOA test",
    koppen: ["SOA test bij je thuis"],
    tekst: "Een soa test doe je ook gewoon thuis.",
  });
  const b = beoordeelSamenvoeging(bron, doel);
  check("koppelteken en lidwoord maken geen verschil", b.oordeel, "meteen");
}

// ── 5. Niet kunnen lezen is nooit "meteen" ──
{
  const bron = pagina({ gelezen: false });
  const doel = pagina({ titel: "SOA test", koppen: ["SOA test"], tekst: "Alles over de soa test." });
  const b = beoordeelSamenvoeging(bron, doel);
  check("onleesbare bron geeft overzetten", b.oordeel, "overzetten");
  checkWaar("met een voorbehoud erbij", b.voorbehoud.length > 0);

  const b2 = beoordeelSamenvoeging(pagina({ koppen: ["SOA test"] }), pagina({ gelezen: false }));
  check("onleesbaar doel geeft ook overzetten", b2.oordeel, "overzetten");
}

// ── 6. De instructie bevat de vaste stappen, in gewone taal ──
{
  const kern = {
    van: "/soa-test-thuis/",
    naar: "/soa-thuistest/",
    oordeel: "overzetten" as const,
    redenen: ["Twee secties ontbreken op de doelpagina."],
    koppen: ["Hoe werkt de thuistest"],
    termen: [{ keyword: "soa test thuis bestellen", klikken: 8, vertoningen: 250, positie: 11 }],
    interneLinks: ["/soa-testen/", "/tarieven/"],
    voorbehoud: "",
  };
  const t = bouwInstructie(kern, "https://voorbeeld.nl");
  checkWaar("noemt bron en doel als volledige links", t.includes("https://voorbeeld.nl/soa-test-thuis/") && t.includes("https://voorbeeld.nl/soa-thuistest/"));
  checkWaar("legt de volgorde uit (eerst content, dan pas de 301)", /Pas als dat gebeurd is/.test(t) && t.includes("301"));
  checkWaar("bevat de over te zetten sectie", t.includes("Hoe werkt de thuistest"));
  checkWaar("bevat de zoekterm met zijn cijfers", t.includes("soa test thuis bestellen") && t.includes("250 vertoningen"));
  checkWaar("bevat de interne links die om moeten", t.includes("/soa-testen/") && t.includes("/tarieven/"));
  checkWaar("zegt dat de sitebouwer de redirect NIET zelf zet", /vanuit het dashboard/.test(t));
  checkWaar("waarschuwt tegen dubbel plakken en weghalen op het doel", /geen dubbele blokken/.test(t) && /niets weg/.test(t));

  // Zonder werk is er ook geen stap 1 met secties; de redirect-uitleg blijft.
  const leeg = bouwInstructie({ ...kern, oordeel: "meteen", koppen: [], termen: [], interneLinks: [] }, "https://voorbeeld.nl");
  checkWaar("zonder secties geen sectie-stap, wel de linkscontrole", !leeg.includes("Zet deze secties") && /interne links/.test(leeg));
}

if (fouten) {
  console.error(`\n${fouten} ${fouten === 1 ? "controle" : "controles"} uit de samenvoeg-briefje-proef ${fouten === 1 ? "faalt" : "falen"}.`);
  process.exit(1);
}
console.log("\nAlle samenvoeg-briefje-controles slagen.");
