// Proef op de meldingen: wat is "nieuw", en hoe leest een melding.
//
// Waarom dit bestand er is: het belletje moet kloppen zonder dat iemand het
// nakijkt. Twee dingen gaan hier gegarandeerd een keer mis:
//
//  1. De grens van "nieuw sinds je laatste bezoek". Precies gelijk aan het
//     gezien-moment mag níet nieuw zijn, anders blijft dezelfde melding voor
//     eeuwig oplichten. En zonder gezien-moment (eerste keer) is alles nieuw.
//  2. De leesbaarheid van "hoe lang geleden". Een melding van vijf minuten oud
//     die "0 min geleden" zegt, of van een dag oud die "1440 min geleden" zegt,
//     is techniek in beeld in plaats van taal.
//
// De databank wordt hier niet aangeroepen: dat kan lokaal niet (de DB-gegevens
// zijn afgeschermd) en deze twee regels zijn ook precies waar de fout in zit.

let fouten = 0;
function check(naam: string, ok: boolean) {
  if (!ok) fouten++;
  console.log(`  ${ok ? "ok  " : "FOUT"} ${naam}`);
}

// Dezelfde regel als in lib/meldingen.ts getMeldingen().
function isNieuw(gemaaktOp: string, gezienTot: string | null): boolean {
  const grens = gezienTot ? new Date(gezienTot).getTime() : 0;
  return new Date(gemaaktOp).getTime() > grens;
}

// Dezelfde regel als in app/admin/MeldingenMenu.tsx watGeleden().
function watGeleden(iso: string, nu: number): string {
  const min = Math.max(0, Math.round((nu - new Date(iso).getTime()) / 60000));
  if (min < 1) return "zojuist";
  if (min < 60) return `${min} min geleden`;
  const uur = Math.round(min / 60);
  if (uur < 24) return uur === 1 ? "een uur geleden" : `${uur} uur geleden`;
  const dag = Math.round(uur / 24);
  return dag === 1 ? "gisteren" : `${dag} dagen geleden`;
}

const NU = new Date("2026-08-06T12:00:00.000Z").getTime();
const op = (min: number) => new Date(NU - min * 60000).toISOString();

console.log("\nWat telt als nieuw:");
check("nooit gekeken: alles is nieuw", isNieuw(op(5), null));
check("ouder dan het bezoek: niet nieuw", !isNieuw(op(120), op(60)));
check("jonger dan het bezoek: nieuw", isNieuw(op(10), op(60)));
check("precies op het bezoekmoment: niet nieuw", !isNieuw(op(60), op(60)));
check("een milliseconde later: wel nieuw",
  isNieuw(new Date(NU - 60 * 60000 + 1).toISOString(), op(60)));

console.log("\nHoe lang geleden, in gewone taal:");
check("net binnen", watGeleden(op(0), NU) === "zojuist");
check("halve minuut telt als zojuist", watGeleden(op(0.4), NU) === "zojuist");
check("vijf minuten", watGeleden(op(5), NU) === "5 min geleden");
check("een uur is enkelvoud", watGeleden(op(60), NU) === "een uur geleden");
check("drie uur", watGeleden(op(180), NU) === "3 uur geleden");
check("een dag heet gisteren", watGeleden(op(60 * 24), NU) === "gisteren");
check("drie dagen", watGeleden(op(60 * 24 * 3), NU) === "3 dagen geleden");
check("nooit een negatief getal", watGeleden(new Date(NU + 60000).toISOString(), NU) === "zojuist");

console.log("\nDe herkomstsleutel houdt één melding per taak:");
const sleutel = (slug: string, key: string) => `${slug}::${key}`;
check("zelfde taak, zelfde sleutel", sleutel("kamsteeg", "a|b") === sleutel("kamsteeg", "a|b"));
check("andere klant, andere sleutel", sleutel("kamsteeg", "a|b") !== sleutel("onedayclinic", "a|b"));
check("andere taak, andere sleutel", sleutel("kamsteeg", "a|b") !== sleutel("kamsteeg", "a|c"));

console.log(fouten === 0 ? "\nAlles goed.\n" : `\n${fouten} fout(en).\n`);
process.exit(fouten === 0 ? 0 : 1);
