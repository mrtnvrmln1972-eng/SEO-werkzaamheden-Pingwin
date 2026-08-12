import { bouwWerklijst, type WerkRegel } from "../lib/opruim-werklijst";
import { chatBesluitenVoor } from "../lib/opruim-chat-besluiten";

// ═══════════════════════════════════════════════════════════
// POORT: besluiten uit een chat landen op de werklijst en winnen van de motor
// ═══════════════════════════════════════════════════════════
// Een cluster-analyse kan overal ontstaan, maar het besluit hoort op één plek
// te landen: de werklijst. Deze proef legt twee dingen vast:
//   - een chat-besluit komt in de lijst, ook als de motor de pagina niet kent;
//   - kent de motor de pagina wél, dan wint het chat-besluit (uitkomst en
//     doel), met behoud van de motor-onderbouwing eronder;
//   - de vastgelegde besluiten zelf zijn geldig: pad begint met /, een
//     samenvoeging heeft een doel, en de onderbouwing is niet leeg.
// ═══════════════════════════════════════════════════════════

let fouten = 0;
function eis(naam: string, waar: boolean): void {
  if (!waar) { console.error(`  ✗ ${naam}`); fouten++; }
}

// ── De algemene werking, met een kunstmatig besluit ──
const chat = [{
  pad: "/voorbeeld/", uitkomst: "samenvoegen" as const, naar: "/doel/",
  reden: "Chat-besluit.", onderbouwing: ["Omdat de mens het zegt."],
  term: "voorbeeld", volume: 10, klikken: 0, vertoningen: 0, positie: null,
  groep: "Voorbeeld", datum: "2026-08-12",
}];

const zonderMotor = bouwWerklijst(null, [], chat);
eis("een chat-besluit komt in de lijst, ook zonder motor-uitkomst",
  zonderMotor.some((r) => r.pad === "/voorbeeld/" && r.uitkomst === "samenvoegen" && r.naar === "/doel/"));
eis("de herkomst is chat", zonderMotor.find((r) => r.pad === "/voorbeeld/")?.herkomst.join(",") === "chat");

// Dezelfde pagina ook uit de motor (als cannibalisatie-redirect met een ander
// doel): het chat-besluit moet winnen, de motor-onderbouwing blijft bewaard.
const motorResult = {
  redirectMap: [{ van: "/voorbeeld/", naar: "/motor-doel/", reden: "Motorkeuze." }],
  onderwerpen: [], oppakken: [], gaten: [],
} as unknown as Parameters<typeof bouwWerklijst>[0];
const metMotor = bouwWerklijst(motorResult, [], chat);
const regel = metMotor.find((r) => r.pad === "/voorbeeld/") as WerkRegel;
eis("er is één regel voor de pagina, niet twee", metMotor.filter((r) => r.pad.includes("voorbeeld")).length === 1);
eis("het chat-besluit wint van de motor (doel)", regel?.naar === "/doel/");
eis("de herkomst noemt chat én de motor-bron", !!regel && regel.herkomst.includes("chat") && regel.herkomst.includes("cannibalisatie"));
eis("de motor-onderbouwing blijft bewaard", !!regel && regel.onderbouwing.some((z) => z.includes("Motorkeuze")));

// ── De echte vastgelegde besluiten zijn geldig ──
for (const slug of ["one-day-clinic"]) {
  const besluiten = chatBesluitenVoor(slug);
  eis(`${slug}: er zijn besluiten vastgelegd`, besluiten.length > 0);
  for (const b of besluiten) {
    eis(`${slug} ${b.pad}: pad begint met /`, b.pad.startsWith("/"));
    eis(`${slug} ${b.pad}: reden ingevuld`, b.reden.trim().length > 0);
    eis(`${slug} ${b.pad}: onderbouwing niet leeg`, b.onderbouwing.length > 0);
    eis(`${slug} ${b.pad}: datum in JJJJ-MM-DD`, /^\d{4}-\d{2}-\d{2}$/.test(b.datum));
    if (b.uitkomst === "samenvoegen") eis(`${slug} ${b.pad}: samenvoeging heeft een doel`, b.naar.startsWith("/"));
  }
}
eis("een onbekende klant geeft een lege lijst, geen fout", chatBesluitenVoor("bestaat-niet").length === 0);

if (fouten > 0) {
  console.error(`chat-besluiten.proef: ${fouten} controle(s) mislukt.`);
  process.exit(1);
}
console.log("chat-besluiten.proef: alle controles goed.");
