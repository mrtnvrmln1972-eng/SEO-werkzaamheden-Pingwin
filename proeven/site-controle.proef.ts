// Proef op de oordeelslaag, met een nagebootste site zoals kamsteegtuinen.nl.
// Doel: aantonen dat "staat er niet" en "kon ik niet meten" NIET op hetzelfde
// uitkomen, en dat een menulink niet als contextuele link telt.

import { beoordeelAnker, beoordeelBron, beoordeelCopy, beoordeelInterneLink, beoordeelUitNavigatie, type Sitebeeld } from "../lib/site-controle";
import { vergelijkKoppen } from "../lib/copy-live";

const MENU = [
  { naar: "/", anker: "Home", inTekst: false, beeldlink: false, nofollow: false },
  { naar: "/hovenier", anker: "Hovenier", inTekst: false, beeldlink: false, nofollow: false },
  { naar: "/hovenier/hovenier-etten-leur", anker: "Hovenier Etten-Leur", inTekst: false, beeldlink: false, nofollow: false },
];

function pagina(
  pad: string, titel: string,
  inTekst: { naar: string; anker: string; nofollow?: boolean; beeldlink?: boolean }[],
  metMenu = true, koppen: string[] = [], tekst_ = "",
) {
  const tekst = inTekst.map((l) => ({ naar: l.naar, anker: l.anker, inTekst: true, beeldlink: !!l.beeldlink, nofollow: !!l.nofollow }));
  return {
    pad, url: `https://kamsteegtuinen.nl${pad}`, meetbaar: true, reden: "", status: 200, gerenderd: true,
    alle: [...(metMenu ? MENU : []), ...tekst], inTekst: tekst, titel, koppen, tekst: tekst_,
  };
}

function maakBeeld(paginas: ReturnType<typeof pagina>[], kapot: { pad: string; reden: string }[] = []): Sitebeeld {
  const stuk = kapot.map((k) => ({
    pad: k.pad, url: `https://kamsteegtuinen.nl${k.pad}`, meetbaar: false, reden: k.reden,
    status: null, gerenderd: false, alle: [], inTekst: [], titel: "", koppen: [], tekst: "",
  }));
  const alle = [...paginas, ...stuk];
  const gelukt = paginas.length;
  return { domein: "kamsteegtuinen.nl", paginas: alle, chromeDrempel: Math.max(3, Math.ceil(gelukt * 0.6)), navigatieBetrouwbaar: gelukt >= 3 };
}

const bestaat = { bestaat: true, status: 200, omleiding: "" };
const bestaatNiet = { bestaat: false, status: 404, omleiding: "" };
const onbereikbaar = { bestaat: false, status: null, omleiding: "" };

let fouten = 0;
function checkWaar(naam: string, waar: boolean) {
  if (!waar) fouten++;
  console.log(`${waar ? "OK  " : "FOUT"} | ${naam}`);
}
function check(naam: string, gekregen: string, verwacht: string) {
  const ok = gekregen === verwacht;
  if (!ok) fouten++;
  console.log(`${ok ? "OK  " : "FOUT"} | ${naam}\n       verwacht: ${verwacht} | gekregen: ${gekregen}`);
}

// ── Ankerteksten ──
check("anker 'klik hier' wordt afgekeurd", String(beoordeelAnker("klik hier", "Hovenier Etten-Leur", "/hovenier/hovenier-etten-leur").zinnig), "false");
check("anker 'lees meer' wordt afgekeurd", String(beoordeelAnker("lees meer", "Hovenier Etten-Leur", "/hovenier/hovenier-etten-leur").zinnig), "false");
check("kale URL als anker wordt afgekeurd", String(beoordeelAnker("https://kamsteegtuinen.nl/x", "Hovenier Etten-Leur", "/hovenier/hovenier-etten-leur").zinnig), "false");
check("beschrijvend anker wordt goedgekeurd", String(beoordeelAnker("hovenier in Etten-Leur", "Hovenier Etten-Leur", "/hovenier/hovenier-etten-leur").zinnig), "true");
check("anker over een ander onderwerp wordt afgekeurd", String(beoordeelAnker("bestrating aanleggen", "Hovenier Etten-Leur", "/hovenier/hovenier-etten-leur").zinnig), "false");

// ── Interne links ──
const beeld = maakBeeld([
  pagina("/", "Kamsteeg Tuinen", [{ naar: "/hovenier/hovenier-etten-leur", anker: "hovenier in Etten-Leur" }]),
  pagina("/hovenier", "Hovenier", [{ naar: "/hovenier/hovenier-etten-leur", anker: "klik hier" }]),
  pagina("/tuinontwerp", "Tuinontwerp", []),
  pagina("/contact", "Contact", []),
]);

check(
  "goede link in de lopende tekst",
  beoordeelInterneLink(beeld, "/", "/hovenier/hovenier-etten-leur", "Hovenier Etten-Leur", bestaat).uitslag,
  "goed",
);
check(
  "link met waardeloze ankertekst is half",
  beoordeelInterneLink(beeld, "/hovenier", "/hovenier/hovenier-etten-leur", "Hovenier Etten-Leur", bestaat).uitslag,
  "deels",
);
check(
  "helemaal geen link is 'niet'",
  beoordeelInterneLink(beeld, "/contact", "/hovenier/hovenier-etten-leur", "Hovenier Etten-Leur", bestaat).uitslag,
  "niet",
);
check(
  "alleen in het site-brede menu -> niet (geen half punt)",
  beoordeelInterneLink(beeld, "/tuinontwerp", "/hovenier/hovenier-etten-leur", "Hovenier Etten-Leur", bestaat).uitslag,
  "niet",
);
check(
  "link naar een 404 is half, niet goed",
  beoordeelInterneLink(beeld, "/", "/hovenier/hovenier-etten-leur", "Hovenier Etten-Leur", bestaatNiet).uitslag,
  "deels",
);

// DE KERNPROEF: onleesbaar mag NOOIT hetzelfde opleveren als ontbrekend.
const metKapot = maakBeeld(
  [pagina("/", "Kamsteeg Tuinen", []), pagina("/hovenier", "Hovenier", []), pagina("/contact", "Contact", [])],
  [{ pad: "/geblokkeerd", reden: "de site weigerde ons te lezen (403)" }],
);
const ontbreekt = beoordeelInterneLink(metKapot, "/contact", "/hovenier/hovenier-etten-leur", "Hovenier Etten-Leur", bestaat);
const geblokkeerd = beoordeelInterneLink(metKapot, "/geblokkeerd", "/hovenier/hovenier-etten-leur", "Hovenier Etten-Leur", bestaat);
check("ontbrekende link -> niet", ontbreekt.uitslag, "niet");
check("geblokkeerde bronpagina -> onmeetbaar", geblokkeerd.uitslag, "onmeetbaar");
check("die twee zijn NIET hetzelfde", String(ontbreekt.uitslag !== geblokkeerd.uitslag), "true");
check("onbereikbare doelpagina maakt het niet 'goed'", beoordeelInterneLink(beeld, "/", "/hovenier/hovenier-etten-leur", "Hovenier Etten-Leur", onbereikbaar).uitslag, "deels");

// ── Uit menu en footer gehaald? ──
const nogInMenu = maakBeeld([
  pagina("/", "Home", []), pagina("/hovenier", "Hovenier", []),
  pagina("/tuinontwerp", "Tuinontwerp", []), pagina("/contact", "Contact", []),
]);
check(
  "staat nog site-breed in het menu -> niet",
  beoordeelUitNavigatie(nogInMenu, "/hovenier/hovenier-etten-leur").uitslag,
  "niet",
);

const uitMenu = maakBeeld([
  pagina("/", "Home", [], false), pagina("/hovenier", "Hovenier", [{ naar: "/hovenier/hovenier-etten-leur", anker: "hovenier in Etten-Leur" }], false),
  pagina("/tuinontwerp", "Tuinontwerp", [], false), pagina("/contact", "Contact", [], false),
]);
const uit = beoordeelUitNavigatie(uitMenu, "/hovenier/hovenier-etten-leur");
check("uit het menu, wel in de tekst -> goed", uit.uitslag, "goed");
check("bewijs noemt de link in de lopende tekst", String(uit.bewijs.includes("lopende tekst")), "true");

// Gevonden op de echte site: een pagina die NIET BESTAAT stond nergens in het
// menu en kreeg daarom een groen "staat goed". Dat leest als "de bouwer heeft
// hem netjes weggehaald", terwijl de pagina simpelweg weg is. Een verzonnen pad
// kreeg zo een vinkje. Nooit meer.
const doelWeg = maakBeeld(
  [pagina("/", "Home", []), pagina("/hovenier", "Hovenier", []), pagina("/contact", "Contact", []), pagina("/tuinontwerp", "Tuinontwerp", [])],
  [{ pad: "/bestaat-niet", reden: "de pagina antwoordde met 404" }],
);
// De nagebootste kapotte pagina heeft status null; die telt als onmeetbaar.
// Met een echte 404 wordt het "vervallen". Beide mogen NOOIT "goed" zijn.
const wegOordeel = beoordeelUitNavigatie(doelWeg, "/bestaat-niet");
check("niet-bestaande pagina krijgt GEEN groen vinkje", String(wegOordeel.uitslag !== "goed"), "true");
check("niet-bestaande pagina -> onmeetbaar of vervallen", String(["onmeetbaar", "vervallen"].includes(wegOordeel.uitslag)), "true");

// ── Kan het verzoek nog wel? ──
// /hovenier/hovenier-breda/ op de echte site is een 301 geworden. Een link vanaf
// een pagina die niet meer bestaat is niet "vergeten", die is onmogelijk. Zonder
// dit onderscheid krijgt de bouwer een verwijt voor iets dat hij niet kón doen.
check("bronpagina met een 404 -> vervallen", String(beoordeelBron("/hovenier/hovenier-breda", bestaatNiet)?.uitslag), "vervallen");
const omgeleid = beoordeelBron("/hovenier/hovenier-breda", { bestaat: true, status: 200, omleiding: "/hovenier" });
check("omgeleide bronpagina -> vervallen", String(omgeleid?.uitslag), "vervallen");
checkWaar("het bewijs noemt waar de omleiding heen gaat", String(omgeleid?.bewijs).includes("/hovenier"));
check("gewone bronpagina -> geen bezwaar, gewoon doormeten", String(beoordeelBron("/hovenier", bestaat)), "null");
check("onbereikbare bronpagina -> geen vals 'vervallen'", String(beoordeelBron("/hovenier", onbereikbaar)), "null");
check("geen bronpagina opgegeven -> geen bezwaar", String(beoordeelBron("", bestaatNiet)), "null");

// ── Staat de aangeleverde content op de pagina? ──
// Alleen koppen worden vergeleken; een sitebouwer mag alinea's herschikken zonder
// dat de content daarmee "niet doorgevoerd" is. Daarom staat dat voorbehoud ook in
// élke bewijsregel.
const DOC_KOPPEN = ["Strandtuin aanleggen", "Wat is een strandtuin", "Beplanting voor een strandtuin",
  "Onderhoud van uw strandtuin", "Wat kost een strandtuin", "Onze werkwijze", "Veelgestelde vragen",
  "Strandtuin laten ontwerpen", "Contact opnemen"];
const DOC_TEKST = "Een strandtuin is een tuin met een duinachtige uitstraling die je het hele jaar door kunt gebruiken. ".repeat(4);
const bronDoc = (koppen: string[]) => ({ koppen, tekst: DOC_TEKST, naam: "Strandtuin-copy.docx", datum: "2026-07-07", herkomst: "bijlage" });

function copyBeeld(paginaKoppen: string[]) {
  return maakBeeld([
    pagina("/tuinontwerp/strandtuin", "Strandtuin", [], true, paginaKoppen, DOC_TEKST),
    pagina("/", "Home", [], true, ["Welkom"], ""),
    pagina("/hovenier", "Hovenier", [], true, ["Hovenier"], ""),
  ]);
}

const bijna = beoordeelCopy(copyBeeld(DOC_KOPPEN.slice(0, 8)), "/tuinontwerp/strandtuin", bronDoc(DOC_KOPPEN), vergelijkKoppen);
check("8 van de 9 koppen gevonden -> goed", bijna.uitslag, "goed");
checkWaar("het bewijs zegt dat alleen koppen vergeleken zijn", bijna.bewijs.includes("alleen de koppen"));

const half = beoordeelCopy(copyBeeld(DOC_KOPPEN.slice(0, 5)), "/tuinontwerp/strandtuin", bronDoc(DOC_KOPPEN), vergelijkKoppen);
check("5 van de 9 koppen gevonden -> deels", half.uitslag, "deels");
// De eerste vijf koppen staan er wél; het bewijs moet dus de zesde noemen en niet
// de vijfde. Zo weet je zeker dat de lijst met ontbrekende koppen echt klopt en
// niet toevallig iets opsomt.
checkWaar("het bewijs noemt welke koppen ontbreken", half.bewijs.includes("Onze werkwijze"));
checkWaar("en noemt géén kop die er wél staat", !half.bewijs.includes('"Wat kost een strandtuin"'));

check("1 van de 9 koppen gevonden -> niet",
  beoordeelCopy(copyBeeld(DOC_KOPPEN.slice(0, 1)), "/tuinontwerp/strandtuin", bronDoc(DOC_KOPPEN), vergelijkKoppen).uitslag, "niet");

// Te weinig koppen in het brondocument: geen oordeel. Twee koppen is een muntworp.
check("brondocument met 2 koppen -> onmeetbaar",
  beoordeelCopy(copyBeeld(DOC_KOPPEN), "/tuinontwerp/strandtuin", bronDoc(DOC_KOPPEN.slice(0, 2)), vergelijkKoppen).uitslag, "onmeetbaar");

// Pagina onleesbaar mag NOOIT "niet doorgevoerd" opleveren.
const copyKapot = maakBeeld(
  [pagina("/", "Home", [], true, ["Welkom"], ""), pagina("/hovenier", "Hovenier", [], true, ["Hovenier"], ""), pagina("/contact", "Contact", [], true, ["Contact"], "")],
  [{ pad: "/tuinontwerp/strandtuin", reden: "de site weigerde ons te lezen (403)" }],
);
const copyOnleesbaar = beoordeelCopy(copyKapot, "/tuinontwerp/strandtuin", bronDoc(DOC_KOPPEN), vergelijkKoppen);
check("onleesbare pagina -> onmeetbaar, niet 'niet'", copyOnleesbaar.uitslag, "onmeetbaar");
checkWaar("en het bewijs noemt de reden", copyOnleesbaar.bewijs.includes("403"));

// Een kop die alleen in het menu staat mag niet meetellen als "content staat erop":
// de koppen op een GelezenPagina komen uit de lopende tekst, niet uit de navigatie.
const alleenMenu = beoordeelCopy(copyBeeld([]), "/tuinontwerp/strandtuin", bronDoc(DOC_KOPPEN), vergelijkKoppen);
check("pagina zonder koppen in de lopende tekst -> onmeetbaar", alleenMenu.uitslag, "onmeetbaar");

const teWeinig = maakBeeld([pagina("/", "Home", [])]);
check(
  "te weinig pagina's -> geen oordeel over het menu",
  beoordeelUitNavigatie(teWeinig, "/hovenier/hovenier-etten-leur").uitslag,
  "onmeetbaar",
);

console.log(`\n${fouten === 0 ? "ALLES GOED" : `${fouten} PROEVEN MISLUKT`}`);
process.exit(fouten === 0 ? 0 : 1);
