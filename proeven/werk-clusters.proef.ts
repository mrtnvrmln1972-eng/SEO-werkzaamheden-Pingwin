// Proef: de werkplanning groepeert, hij somt niet op.
//
// WAAROM DIT BESTAAT
// ══════════════════
// De werkplanning liet drie lange lijsten zien waar Maarten niets aan had: 38
// redirects onder elkaar, zes mails over dezelfde factuur, twaalf stadspagina's
// die stuk voor stuk hetzelfde verhaal vertelden. Zijn woorden: "een tyfus lange
// lijst waar niet over nagedacht is."
//
// De motor die dat oplost (`lib/werk-clusters.ts`) is stil kapot te maken: één
// woord extra in de vulwoorden-lijst, een strengere lengte-eis, en de steden
// vallen weer uit elkaar in twaalf regels zonder dat een build daarover klaagt.
// Deze proef rekent daarom met echte voorbeelden na dat de vier beloftes staan:
//   1. één actie die zich herhaalt is één regel, geen 38;
//   2. een mailwisseling is één gesprek, ook met "Re:" ervoor;
//   3. administratie zakt naar onderen als ruis;
//   4. de titel beschrijft wat er gebeurd is, hij telt niet alleen.

import {
  clusterActiviteit, clusterSignalen, bepaalFamilies, familieTitel,
  normaliseerOnderwerp, leesMailKop, themaVanOnderwerp, zoekTreffer,
  categorieVanSoort, CATEGORIE_LABEL, CATEGORIE_VOLGORDE,
  type ActRegel, type SigRegel,
} from "../lib/werk-clusters";

let fouten = 0;
function proef(naam: string, goed: boolean, uitleg = "") {
  console.log(`${goed ? "OK  " : "FOUT"} | ${naam}`);
  if (!goed) { if (uitleg) console.log(`     | ${uitleg}`); fouten++; }
}

const STEDEN = [
  "amsterdam", "utrecht", "rotterdam", "den-haag", "eindhoven", "tilburg",
  "groningen", "breda", "nijmegen", "arnhem", "haarlem", "leiden",
];

let volgnummer = 0;
function regel(soort: ActRegel["soort"], url: string | null, intern: string, dag: number): ActRegel {
  volgnummer++;
  return {
    id: volgnummer, soort, url, intern, wie: "Pingwin",
    gebeurdeOp: new Date(Date.UTC(2026, 7, dag, 9, 0, 0)).toISOString(),
  };
}

// ── 1. Eén actie die zich 38 keer herhaalt, is één regel ──
const redirects: ActRegel[] = [];
for (let i = 0; i < 38; i++) {
  const stad = STEDEN[i % STEDEN.length];
  redirects.push(regel("redirect", `/soa-test-${stad}${i >= STEDEN.length ? `-${Math.floor(i / STEDEN.length)}` : ""}/`,
    `Redirect voor /soa-test-${stad}/`, 3 + (i % 3)));
}
const rClusters = clusterActiviteit(redirects);
proef("38 redirects op SOA-test-pagina's worden één cluster",
  rClusters.length === 1 && rClusters[0].items.length === 38,
  `kreeg ${rClusters.length} clusters (${rClusters.map((c) => `${c.titel} [${c.items.length}]`).join(" | ")})`);
proef("de titel zegt wat er gebeurd is, niet alleen hoeveel",
  rClusters[0]?.titel === "38 oude adressen doorgestuurd",
  `titel is "${rClusters[0]?.titel}"`);
proef("de ondertitel noemt de familie, het aantal pagina's en de periode",
  /SOA-test-pagina's/.test(rClusters[0]?.subtitel || "") &&
  /pagina's/.test(rClusters[0]?.subtitel || "") &&
  /aug/.test(rClusters[0]?.subtitel || ""),
  `ondertitel is "${rClusters[0]?.subtitel}"`);

// ── 2. Een mailwisseling is één gesprek, ook met Re: en Fwd: ──
const mails: ActRegel[] = [
  regel("mail", null, "Mail verstuurd: Herstructurering website, oplossen kannibalisatie", 3),
  regel("mail", null, "Mail ontvangen van Tonny Vermeulen: Re: Herstructurering website, oplossen kannibalisatie", 4),
  regel("mail", null, "Mail verstuurd: RE: Herstructurering website, oplossen kannibalisatie", 5),
  regel("mail", null, "Mail ontvangen van Tonny Vermeulen: Fwd: Re: [EXTERN] Herstructurering website, oplossen kannibalisatie", 6),
];
const mClusters = clusterActiviteit(mails);
proef("vier mails in één draad worden één cluster",
  mClusters.length === 1 && mClusters[0].items.length === 4,
  `kreeg ${mClusters.length} clusters (${mClusters.map((c) => c.titel).join(" | ")})`);
proef("de titel van een draad is het schoonste onderwerp, zonder Re: of Fwd:",
  mClusters[0]?.titel === "Mailwisseling: Herstructurering website, oplossen kannibalisatie",
  `titel is "${mClusters[0]?.titel}"`);
proef("de ondertitel telt verstuurd en ontvangen apart",
  /2 verstuurd en 2 ontvangen/.test(mClusters[0]?.subtitel || ""),
  `ondertitel is "${mClusters[0]?.subtitel}"`);
proef("mail heeft een eigen soort werk en heet geen Meten meer",
  categorieVanSoort("mail") === "mail" && CATEGORIE_VOLGORDE.includes("mail") && !!CATEGORIE_LABEL.mail);

// ── 3. Administratie wordt samengevoegd én als ruis naar onderen gezet ──
const admin: ActRegel[] = [
  regel("mail", null, "Mail ontvangen van Boekhouding: Factuur 2026-08", 2),
  regel("mail", null, "Mail verstuurd: Re: Factuur 2026-08", 2),
  regel("mail", null, "Mail ontvangen van Boekhouding: Betalingsherinnering augustus", 9),
  regel("mail", null, "Mail verstuurd: Betaling is onderweg", 10),
  regel("mail", null, "Mail ontvangen van Boekhouding: Creditnota 2026-08", 12),
  regel("mail", null, "Mail verstuurd: Re: Creditnota 2026-08", 12),
];
const werkMail = [regel("mail", null, "Mail verstuurd: Second opinion conculega weerleggen", 5)];
const aClusters = clusterActiviteit([...admin, ...werkMail]);
const facturatie = aClusters.filter((c) => c.sleutel === "thema:facturatie");
proef("zes factuurmails met verschillende onderwerpen worden één cluster",
  facturatie.length === 1 && facturatie[0].items.length === 6,
  `kreeg ${facturatie.length} facturatie-clusters met ${facturatie[0]?.items.length} mails`);
proef("facturatie is als ruis gemarkeerd en staat onderaan",
  facturatie[0]?.ruis === true && aClusters[aClusters.length - 1]?.sleutel === "thema:facturatie",
  `ruis=${facturatie[0]?.ruis}, laatste cluster is "${aClusters[aClusters.length - 1]?.sleutel}"`);
proef("een inhoudelijke mail blijft gewoon werk, geen ruis",
  aClusters.some((c) => /Second opinion/i.test(c.titel) && !c.ruis));

// ── 4. Losse pagina's met één handeling slokken elkaar op ──
const losse: ActRegel[] = [
  regel("meta", "/contact/", "Meta-teksten voor /contact/", 4),
  regel("meta", "/openingstijden/", "Meta-teksten voor /openingstijden/", 5),
  regel("meta", "/vergoeding/", "Meta-teksten voor /vergoeding/", 6),
  regel("meta", "/parkeren/", "Meta-teksten voor /parkeren/", 7),
];
const lClusters = clusterActiviteit(losse);
proef("vier losse meta-regels worden één cluster in plaats van vier",
  lClusters.length === 1 && lClusters[0].titel === "4 zoekresultaat-teksten verbeterd",
  `kreeg ${lClusters.length} clusters (${lClusters.map((c) => c.titel).join(" | ")})`);

// ── 5. Eén pagina met een heel verhaal blijft één verhaal ──
const verhaal: ActRegel[] = [
  regel("analyse", "/over-ons/", "Analyse voor /over-ons/", 4),
  regel("blauwdruk", "/over-ons/", "Blauwdruk voor /over-ons/", 6),
  regel("copy-live", "/over-ons/", "Copy live voor /over-ons/", 9),
];
const vClusters = clusterActiviteit(verhaal);
proef("één pagina met drie soorten werk blijft één cluster met de paginanaam",
  vClusters.length === 1 && vClusters[0].titel === "Over ons",
  `kreeg ${vClusters.length} clusters (${vClusters.map((c) => c.titel).join(" | ")})`);
proef("de ondertitel somt op wat er met die pagina gebeurd is",
  /geanalyseerd/.test(vClusters[0]?.subtitel || "") && /live gezet/.test(vClusters[0]?.subtitel || ""),
  `ondertitel is "${vClusters[0]?.subtitel}"`);

// ── 6. Pagina-families: steden bij elkaar, ongelijksoortige pagina's niet ──
const fam = bepaalFamilies([
  "/soa-test-amsterdam/", "/soa-test-amsterdam-centrum/", "/soa-test-utrecht/",
  "/over-ons/", "/over-onze-werkwijze/", "/contact/",
]);
proef("drie SOA-test-pagina's vallen onder dezelfde familie, ook de langere",
  fam.get("/soa-test-amsterdam/") === "soa-test" &&
  fam.get("/soa-test-amsterdam-centrum/") === "soa-test" &&
  fam.get("/soa-test-utrecht/") === "soa-test",
  [...fam.entries()].map(([u, f]) => `${u}=${f || "-"}`).join(" "));
proef("een te kort of te vaag gedeeld woord maakt geen familie",
  !fam.get("/over-ons/") && !fam.get("/over-onze-werkwijze/") && !fam.get("/contact/"),
  "over/ (4 letters) is te weinig om pagina's op samen te voegen");
proef("/soa-test/amsterdam/ en /soa-test-amsterdam/ tellen als dezelfde familie",
  bepaalFamilies(["/soa-test/amsterdam/", "/soa-test-utrecht/"]).get("/soa-test/amsterdam/") === "soa-test");
proef("een afkorting in de familienaam blijft een afkorting",
  familieTitel("soa-test") === "SOA-test" && familieTitel("hovenier") === "Hovenier",
  `kreeg "${familieTitel("soa-test")}" en "${familieTitel("hovenier")}"`);

// ── 7. Onderwerp- en mailkop-lezing ──
proef("Re:, Fwd: en [EXTERN] verdwijnen uit het onderwerp",
  normaliseerOnderwerp("Re: Fwd: [EXTERN] Werkzaamheden ") === "werkzaamheden",
  `kreeg "${normaliseerOnderwerp("Re: Fwd: [EXTERN] Werkzaamheden ")}"`);
proef("de richting en de afzender komen uit de logregel",
  leesMailKop("Mail ontvangen van Tonny Vermeulen: Over ons")?.richting === "in" &&
  leesMailKop("Mail ontvangen van Tonny Vermeulen: Over ons")?.wie === "Tonny Vermeulen" &&
  leesMailKop("Mail verstuurd: Over ons")?.richting === "uit" &&
  leesMailKop("Redirect voor /x/") === null);
proef("alleen echte administratie valt onder een ruis-thema",
  !!themaVanOnderwerp("Factuur 2026-08") && !!themaVanOnderwerp("Belafspraak donderdag") &&
  !themaVanOnderwerp("Herstructurering website, oplossen kannibalisatie"));

// ── 8. Signalen worden opdrachten, niet labels ──
const signalen: SigRegel[] = STEDEN.slice(0, 6).map((stad) => ({
  pad: `/soa-test-${stad}/`, uitkomst: "samenvoegen", naar: "/soa-test/",
  reden: "Concurreert met de hoofdpagina",
  onderbouwing: ["Deze pagina's ranken op dezelfde term.", `Positie wisselt op ${stad}.`],
  volume: 100, positie: 8, groep: "De zes vestigingssteden", bron: "opruim",
}));
const sClusters = clusterSignalen(signalen);
proef("zes signalen met dezelfde handeling worden één opdracht",
  sClusters.length === 1 && sClusters[0].items.length === 6,
  `kreeg ${sClusters.length} clusters`);
proef("de titel is een opdracht met een aantal, geen los label",
  sClusters[0]?.titel === "6 pagina's samenvoegen",
  `titel is "${sClusters[0]?.titel}"`);
proef("de ondertitel noemt het onderwerp, de bestemming en het zoekvolume",
  /De zes vestigingssteden/.test(sClusters[0]?.subtitel || "") &&
  /naar \/soa-test\//.test(sClusters[0]?.subtitel || "") &&
  /600 zoekopdrachten per maand/.test(sClusters[0]?.subtitel || ""),
  `ondertitel is "${sClusters[0]?.subtitel}"`);
proef("de onderbouwing die alle pagina's delen staat één keer op het cluster",
  sClusters[0]?.gedeeld.length === 1 && sClusters[0].gedeeld[0] === "Deze pagina's ranken op dezelfde term.",
  `gedeeld: ${JSON.stringify(sClusters[0]?.gedeeld)}`);

// ── 9. Zoeken doet aan alle woorden tegelijk ──
proef("zoeken vraagt om álle woorden, niet om één ervan",
  zoekTreffer("soa amsterdam", "SOA-test", "/soa-test-amsterdam/") &&
  !zoekTreffer("soa rotterdam", "SOA-test", "/soa-test-amsterdam/") &&
  zoekTreffer("", "wat dan ook"));

console.log(fouten === 0 ? "\nAlles klopt: de werkplanning groepeert." : `\n${fouten} fout(en).`);
if (fouten > 0) process.exit(1);
