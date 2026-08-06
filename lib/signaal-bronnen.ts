import { registreerBron, type SignaalPunt } from "./signaal-taak";
import { getGmbStand } from "./gmb";
import { CHECK, SUGGESTIES } from "./gmb-kennis";

// ═══════════════════════════════════════════════════════════
// WELKE SCHERMEN HUN SIGNALEN OP DE PLANNING KUNNEN ZETTEN
// ═══════════════════════════════════════════════════════════
// Eén bestand met alle aansluitingen, zodat je in één blik ziet welke schermen
// al meedoen en welke nog niet. Een scherm aansluiten is een blok van vijftien
// regels hieronder: zeg waar de punten vandaan komen, en de gedeelde laag
// (lib/signaal-taak.ts) regelt de kaartopmaak, de terugweg-link en het
// samenvoegen met bestaande kaarten.
//
// Aangesloten: het Google-bedrijfsprofiel (bevindingen, suggesties, de
// beheer-uitnodiging).
//
// Nog niet aangesloten, en dat is bewust nog niet gedaan in plaats van half:
// de prioriteitenscan, Meta & CTR, Opruimen en de interne links. Die hebben elk
// al hun eigen weg naar een taak, uit de tijd dat er nog geen gedeelde laag was.
// Die migreren betekent hun bestaande knoppen omleggen, en dat doen we per
// scherm zodat er nooit een moment is waarop er twee manieren naast elkaar staan.
// ═══════════════════════════════════════════════════════════

// ── Google-bedrijfsprofiel ──────────────────────────────────

const GMB_TAB = "google-profiel";

/** De vestiging waar het om gaat; leeg = de eerste (bij één locatie is dat hem). */
async function gmbLocatie(slug: string, sleutel: string) {
  const stand = await getGmbStand(slug);
  const locaties = stand.result?.locaties || [];
  return locaties.find((l) => l.sleutel === sleutel) || locaties[0] || null;
}

function profielLinks(mapsUrl?: string): { label: string; url: string }[] {
  return mapsUrl ? [{ label: "Het profiel", url: mapsUrl }] : [];
}

registreerBron("gmb-bevinding", {
  label: "Google-bedrijfsprofiel",
  tab: GMB_TAB,
  thread: "google-profiel",
  taaktype: "gmb",
  resolver: async (slug, keys, ctx) => {
    const loc = await gmbLocatie(slug, ctx.sleutel || "");
    if (!loc) return [];
    const waar = loc.vestiging ? ` (${loc.vestiging})` : "";
    const uit: SignaalPunt[] = [];
    for (const k of keys) {
      const c = CHECK.get(k);
      if (!c) continue;
      // Alleen punten die de laatste meting ook echt gevonden heeft. Zo kan er
      // geen kaart ontstaan voor iets dat al opgelost is.
      const bev = loc.bevindingen.find((b) => b.key === k);
      if (!bev) continue;
      uit.push({
        key: k,
        titel: `Google-profiel${waar}: ${c.label.toLowerCase()}`,
        actie: c.actie,
        waarom: c.waarom,
        bewijs: bev.bewijs,
        links: profielLinks(loc.profiel?.mapsUrl),
        anker: `gmb-${loc.sleutel}-${k}`,
      });
    }
    return uit;
  },
});

registreerBron("gmb-suggestie", {
  label: "Google-bedrijfsprofiel",
  tab: GMB_TAB,
  thread: "google-profiel",
  taaktype: "gmb",
  resolver: async (slug, keys, ctx) => {
    const loc = await gmbLocatie(slug, ctx.sleutel || "");
    const waar = loc?.vestiging ? ` (${loc.vestiging})` : "";
    const uit: SignaalPunt[] = [];
    for (const k of keys) {
      const s = SUGGESTIES.find((x) => x.key === k);
      if (!s) continue;
      uit.push({
        key: k,
        titel: `Google-profiel${waar}: ${s.titel.toLowerCase()}`,
        actie: s.wat,
        waarom: s.waarom,
        ritme: s.ritme,
        links: profielLinks(loc?.profiel?.mapsUrl),
        anker: `gmb-suggestie-${k}`,
      });
    }
    return uit;
  },
});

registreerBron("gmb-beheer", {
  label: "Google-bedrijfsprofiel",
  tab: GMB_TAB,
  thread: "google-profiel",
  taaktype: "gmb",
  // Deze staat los van de metingen: bij een nieuwe klant is toegang vragen
  // meestal de allereerste stap, en zonder toegang blijft de helft ongemeten.
  resolver: async (slug, _keys, ctx) => {
    const loc = await gmbLocatie(slug, ctx.sleutel || "");
    const waar = loc?.vestiging ? ` (${loc.vestiging})` : "";
    return [{
      key: "beheer",
      titel: `Google-profiel${waar}: beheertoegang aanvragen bij de klant`,
      actie: "Mail de klant met het verzoek om Pingwin als beheerder toe te voegen aan het Google-bedrijfsprofiel. De kant-en-klare tekst staat op het profielscherm, met het juiste Google-adres er al in.",
      waarom: "Met beheertoegang zien we hoe vaak het profiel gezien wordt, hoe vaak er gebeld wordt en hoeveel routes er opgevraagd worden. Dat is de voor-en-na waarmee je kunt laten zien wat het werk oplevert; zonder toegang meten we alleen de buitenkant.",
      links: profielLinks(loc?.profiel?.mapsUrl),
      anker: "gmb-beheer",
    }];
  },
});
