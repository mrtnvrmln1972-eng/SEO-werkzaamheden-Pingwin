import { maandPlus, maandNu, type Maand } from "./prognose";
import {
  getOmzetPerKlantPerMaand, getLeverancierRegels, getMbContacts,
  type KlantMaandOmzet, type LeverancierRegel,
} from "./moneybird";
import { getSetting, setSetting } from "./settings";

// ═══════════════════════════════════════════════════════════
// DE PROGNOSE VULLEN VANUIT DE BOEKHOUDING
// ═══════════════════════════════════════════════════════════
// De bedragen stonden al in Moneybird. Ze daarna met de hand overtypen in het
// dashboard is niet alleen werk, het is ook de garantie dat de twee na een paar
// maanden niet meer hetzelfde zeggen. Dus: uitlezen.
//
// WAT ER GEBEURT
// ──────────────
//  1. Alle verkoopfacturen van de laatste zes afgesloten maanden, gegroepeerd
//     per klant per maand. Daaruit komt "wat factureert deze klant per maand".
//  2. Alle inkoopregels van de linkbuilder over dezelfde maanden. In de
//     omschrijving van zo'n regel staat meestal de klantnaam of het domein;
//     daarmee valt de linkbuilding per klant toe te wijzen.
//  3. Koppelen aan de klanten en leads in het dashboard, en van alles wat niet
//     te koppelen is eerlijk melden dát het niet gekoppeld is.
//
// DRIE REGELS DIE DIT BETROUWBAAR HOUDEN
// ──────────────────────────────────────
//  - NIETS WORDT AUTOMATISCH OVERSCHREVEN. Dit levert een VOORSTEL. Wat er nu
//    in het dashboard staat en wat de boekhouding zegt staan naast elkaar, en
//    Maarten kiest. Een knop die stilletjes twintig bedragen omzet is precies
//    het soort knop waar je later niet meer van weet wat hij gedaan heeft.
//  - DE HUIDIGE MAAND TELT NIET MEE. Die is halverwege, dus elke klant lijkt
//    daarin goedkoper dan hij is.
//  - WAT NIET TE MATCHEN IS, WORDT GEMELD EN NIET GERADEN. Een factuurregel die
//    bij geen enkele klant hoort komt op een restant-stapel in beeld, niet
//    verdeeld over de klanten die er toevallig wel zijn.
// ═══════════════════════════════════════════════════════════

/** Hoeveel afgesloten maanden er teruggekeken wordt. */
export const VENSTER_MAANDEN = 6;

// Welk Moneybird-contact de linkbuilder is. Instelbaar, want dit is een product
// dat straks bij een ander bureau draait, en die heeft een andere leverancier.
//
// Twee instellingen met opzet, en de eerste wint. Een ZOEKTERM (naam of
// mailadres) is handig om mee te beginnen, maar hij raadt: het mailadres dat je
// kent hoeft niet het mailadres te zijn waaronder de leverancier in de
// boekhouding staat, en dan vindt hij niets zonder te zeggen waarom. Een gekozen
// CONTACT-ID raadt nooit. Vandaar de keuzelijst op het scherm.
export const SETTING_LINKBUILDER = "prognose_linkbuilder_contact";
export const SETTING_LINKBUILDER_ID = "prognose_linkbuilder_contact_id";
const LINKBUILDER_STANDAARD = "info@co.vision";

export async function getLinkbuilderZoekterm(): Promise<string> {
  return (await getSetting(SETTING_LINKBUILDER)) || LINKBUILDER_STANDAARD;
}
export async function setLinkbuilderZoekterm(v: string): Promise<void> {
  await setSetting(SETTING_LINKBUILDER, String(v || "").trim() || LINKBUILDER_STANDAARD);
}
export async function getLinkbuilderId(): Promise<string | null> {
  return (await getSetting(SETTING_LINKBUILDER_ID)) || null;
}
export async function setLinkbuilderId(v: string | null): Promise<void> {
  await setSetting(SETTING_LINKBUILDER_ID, String(v || "").trim() || null);
}

// ── Namen vergelijken ──
// "One Day Clinic B.V." en "onedayclinic" horen bij elkaar. Rechtsvormen,
// leestekens en spaties zeggen niets over wie het is, dus die gaan eruit voor
// het vergelijken. Bewust een korte, voorspelbare lijst: hoe slimmer je dit
// maakt, hoe vaker het twee verschillende klanten op één hoop gooit.
const RECHTSVORMEN = /\b(b\.?v\.?|v\.?o\.?f\.?|n\.?v\.?|c\.?v\.?|holding|group|groep)\b/g;

export function sleutel(naam: string): string {
  return String(naam || "")
    .toLowerCase()
    .replace(/&/g, " en ")
    .replace(RECHTSVORMEN, " ")
    .replace(/\.(nl|com|be|eu|net)\b/g, " ")
    .replace(/[^a-z0-9]/g, "");
}

/** Komt de naam van een klant voor in een stuk tekst (factuurregel)? */
export function noemtKlant(tekst: string, klantSleutel: string, domeinSleutel: string): boolean {
  if (!klantSleutel && !domeinSleutel) return false;
  const t = sleutel(tekst);
  // Korte sleutels ("bo", "abc") matchen te snel op toeval; onder de vier
  // tekens vertrouwen we het niet en laten we de regel liever ongekoppeld.
  const past = (s: string) => s.length >= 4 && t.includes(s);
  return past(klantSleutel) || past(domeinSleutel);
}

// ── Het voorstel ──

export type VoorstelRegel = {
  /** Gevonden dashboard-klant, of leeg als die er nog niet is. */
  slug: string | null;
  naam: string;
  fase: string | null;
  contactId: string | null;
  contactUrl: string | null;
  /** Wat het dashboard nu zegt. */
  huidigBedrag: number | null;
  huidigLinkbuilding: number | null;
  /** Wat de boekhouding zegt. */
  bedrag: number;
  linkbuilding: number;
  /** In hoeveel van de bekeken maanden is er gefactureerd. */
  maandenGefactureerd: number;
  eersteMaand: string | null;
  laatsteMaand: string | null;
  /** Per maand het gefactureerde bedrag, zodat je de onderbouwing ziet. */
  perMaand: { maand: string; bedrag: number }[];
  /** Waarom dit bedrag zo is, of waarom het onzeker is. Nooit stil geraden. */
  meldingen: string[];
  /** Wijkt het voorstel af van wat er nu staat? Alleen dan valt er iets over te nemen. */
  wijzigt: boolean;
};

export type Voorstel = {
  vanMaand: string;
  totMaand: string;
  regels: VoorstelRegel[];
  /**
   * Linkbuildingregels die bij geen enkele klant te plaatsen waren.
   *
   * Dit is bij Pingwin geen randgeval maar de normale situatie: de facturen van
   * de linkbuilder heten "Linkbuilding februari 2026", zonder klantnaam erin.
   * Daarom staat er naast het totaal ook een maandbedrag: die kosten zijn echt,
   * alleen de verdeling over klanten is onbekend. Als vaste maandpost tellen ze
   * dan gewoon mee in de prognose, in plaats van uit beeld te vallen.
   */
  linkbuildingRestant: {
    bedrag: number;
    /** Gemiddeld per maand over de maanden waarin er gefactureerd is. */
    perMaandGemiddeld: number;
    perMaand: { maand: string; bedrag: number }[];
    regels: LeverancierRegel[];
  };
  linkbuilderGevonden: boolean;
  linkbuilderNaam: string | null;
  linkbuilderZoekterm: string;
  linkbuilderId: string | null;
  /** Facturerende contacten die nog niet als klant of lead in het dashboard staan. */
  onbekend: { contactId: string; naam: string; url: string; bedrag: number; maanden: number }[];
};

type KlantBron = {
  slug: string; name: string; fase: string; domain: string | null;
  moneybirdContactId: string | null;
  budget: { maandbudget: number; linkbuilding: number };
};

/**
 * Bepaalt het maandbedrag uit een reeks factuurmaanden.
 *
 * Twee gevallen, en het onderscheid is belangrijk. Wordt er élke maand
 * gefactureerd, dan is het maandbedrag de mediaan van die maanden: dat is de
 * vaste retainer, en een eenmalige extra factuur trekt hem niet scheef. Wordt er
 * niet elke maand gefactureerd (bijvoorbeeld per kwartaal), dan is het totaal
 * gedeeld door het aantal maanden in het venster de eerlijke maat, want de
 * mediaan zou daar drie keer te hoog uitkomen.
 */
export function maandbedragUit(perMaand: { maand: string; bedrag: number }[], venster: number): { bedrag: number; meldingen: string[] } {
  const meldingen: string[] = [];
  const metFactuur = perMaand.filter((m) => m.bedrag > 0);
  if (metFactuur.length === 0) return { bedrag: 0, meldingen: ["geen facturen in deze periode"] };

  const bedragen = metFactuur.map((m) => m.bedrag).sort((a, b) => a - b);
  const midden = bedragen.length % 2
    ? bedragen[(bedragen.length - 1) / 2]
    : (bedragen[bedragen.length / 2 - 1] + bedragen[bedragen.length / 2]) / 2;
  const totaal = metFactuur.reduce((s, m) => s + m.bedrag, 0);

  // "Elke maand" met één gemiste maand speling: een factuur die op de eerste van
  // de volgende maand valt hoort niet als opzegging te lezen.
  const elkeMaand = metFactuur.length >= Math.min(venster, Math.max(2, venster - 1));
  if (!elkeMaand) {
    meldingen.push(`niet elke maand gefactureerd (${metFactuur.length} van ${venster}), omgerekend naar een maandbedrag`);
    return { bedrag: Math.round(totaal / venster), meldingen };
  }

  const laagste = bedragen[0];
  const hoogste = bedragen[bedragen.length - 1];
  if (midden > 0 && (hoogste - laagste) / midden > 0.25) {
    meldingen.push(`wisselt per maand (${Math.round(laagste)} tot ${Math.round(hoogste)}), het middelste bedrag is aangehouden`);
  }
  return { bedrag: Math.round(midden), meldingen };
}

/** Bouwt het voorstel. Schrijft niets weg; dat is een aparte, bewuste stap. */
export async function bouwVoorstel(klanten: KlantBron[]): Promise<Voorstel> {
  // Het venster eindigt bij de vorige maand: de lopende maand is halverwege en
  // zou elke klant goedkoper laten lijken dan hij is.
  const tot = maandPlus(maandNu(), -1);
  const van = maandPlus(tot, -(VENSTER_MAANDEN - 1));
  const maanden: Maand[] = Array.from({ length: VENSTER_MAANDEN }, (_, i) => maandPlus(van, i));
  const platteMaand = (m: string) => m.replace("-", "");

  const [zoekterm, gekozenId, omzet, contacten] = await Promise.all([
    getLinkbuilderZoekterm(),
    getLinkbuilderId(),
    getOmzetPerKlantPerMaand(platteMaand(van), platteMaand(tot)),
    getMbContacts().catch(() => []),
  ]);

  // Heeft Maarten de leverancier uit de lijst gekozen, dan is dat het antwoord.
  // Anders zoeken op mailadres of naam, en dat kán mislopen: de linkbuilder die
  // je kent als "info@co.vision" staat in de boekhouding onder de bedrijfsnaam,
  // en dan vindt een zoekterm niets. Vinden we hem niet, dan gaat de rest gewoon
  // door; alleen de linkbuildingkosten blijven dan op wat er stond.
  const zoek = sleutel(zoekterm);
  const linkbuilder = (gekozenId ? contacten.find((c) => c.id === gekozenId) : null)
    || contacten.find(
      (c) => (c.email || "").toLowerCase() === zoekterm.toLowerCase() || (zoek.length >= 4 && sleutel(c.name).includes(zoek)),
    );
  let lbRegels: LeverancierRegel[] = [];
  if (linkbuilder) {
    lbRegels = await getLeverancierRegels(linkbuilder.id, platteMaand(van), platteMaand(tot)).catch(() => []);
  }

  // Klanten opzoekbaar maken: eerst op het gekoppelde Moneybird-contact (dat is
  // een expliciete keuze van Maarten en wint dus altijd), daarna op naam.
  const opContact = new Map<string, KlantBron>();
  const opNaam = new Map<string, KlantBron>();
  for (const k of klanten) {
    if (k.moneybirdContactId) opContact.set(String(k.moneybirdContactId), k);
    const s = sleutel(k.name);
    if (s.length >= 3 && !opNaam.has(s)) opNaam.set(s, k);
  }
  const vindKlant = (c: KlantMaandOmzet): KlantBron | null =>
    opContact.get(c.contactId) || opNaam.get(sleutel(c.contactName)) || null;

  // ── Linkbuilding per klant verdelen ──
  // Elke factuurregel gaat naar de klant die erin genoemd wordt. Wat nergens bij
  // hoort blijft op de restant-stapel staan, zichtbaar, in plaats van uitgesmeerd.
  const lbPerSlug = new Map<string, { maanden: Set<string>; totaal: number }>();
  const restant: LeverancierRegel[] = [];
  for (const r of lbRegels) {
    const klant = klanten.find((k) => noemtKlant(r.omschrijving, sleutel(k.name), sleutel(k.domain || "")));
    if (!klant) { restant.push(r); continue; }
    const cur = lbPerSlug.get(klant.slug) || { maanden: new Set<string>(), totaal: 0 };
    cur.maanden.add(r.maand);
    cur.totaal += r.bedrag;
    lbPerSlug.set(klant.slug, cur);
  }
  const lbMaandbedrag = (slug: string): number => {
    const v = lbPerSlug.get(slug);
    if (!v || v.maanden.size === 0) return 0;
    // Delen door het aantal maanden waarin er íets in rekening is gebracht, niet
    // door het hele venster: een klant die pas twee maanden linkbuilding heeft,
    // heeft geen half maandbedrag.
    return Math.round(v.totaal / v.maanden.size);
  };

  // ── De regels opbouwen ──
  const regels: VoorstelRegel[] = [];
  const onbekend: Voorstel["onbekend"] = [];
  const gezien = new Set<string>();

  for (const c of omzet) {
    const perMaand = maanden.map((m) => ({ maand: m, bedrag: Math.round(c.perMaand[m] || 0) }));
    const { bedrag, meldingen } = maandbedragUit(perMaand, VENSTER_MAANDEN);
    const metFactuur = perMaand.filter((m) => m.bedrag > 0);
    const klant = vindKlant(c);

    if (!klant) {
      if (bedrag > 0) {
        onbekend.push({ contactId: c.contactId, naam: c.contactName, url: c.url, bedrag, maanden: metFactuur.length });
      }
      continue;
    }
    gezien.add(klant.slug);

    const laatste = metFactuur.length ? metFactuur[metFactuur.length - 1].maand : null;
    if (laatste && laatste < maandPlus(tot, -1)) {
      meldingen.push(`laatste factuur was ${laatste}, mogelijk gestopt`);
    }
    const lb = lbMaandbedrag(klant.slug);
    if (lb === 0 && linkbuilder) meldingen.push("geen linkbuildingregel op naam gevonden");

    regels.push({
      slug: klant.slug,
      naam: klant.name,
      fase: klant.fase,
      contactId: c.contactId,
      contactUrl: c.url,
      huidigBedrag: klant.budget.maandbudget,
      huidigLinkbuilding: klant.budget.linkbuilding,
      bedrag,
      // Vindt de boekhouding geen linkbuilding voor deze klant, dan laten we
      // staan wat er stond: nul invullen zou een echte kostenpost wegpoetsen.
      linkbuilding: lb || klant.budget.linkbuilding,
      maandenGefactureerd: metFactuur.length,
      eersteMaand: metFactuur.length ? metFactuur[0].maand : null,
      laatsteMaand: laatste,
      perMaand,
      meldingen,
      wijzigt: Math.round(bedrag) !== Math.round(klant.budget.maandbudget)
        || Math.round(lb || klant.budget.linkbuilding) !== Math.round(klant.budget.linkbuilding),
    });
  }

  // Klanten in het dashboard waar de boekhouding niets over zegt, horen er ook
  // bij te staan: die stilte is zelf informatie ("staat op 1.500, maar er is al
  // een half jaar niets gefactureerd").
  for (const k of klanten) {
    if (gezien.has(k.slug)) continue;
    if (k.fase !== "klant") continue;
    regels.push({
      slug: k.slug, naam: k.name, fase: k.fase,
      contactId: k.moneybirdContactId || null, contactUrl: null,
      huidigBedrag: k.budget.maandbudget, huidigLinkbuilding: k.budget.linkbuilding,
      bedrag: k.budget.maandbudget, linkbuilding: k.budget.linkbuilding,
      maandenGefactureerd: 0, eersteMaand: null, laatsteMaand: null,
      perMaand: maanden.map((m) => ({ maand: m, bedrag: 0 })),
      meldingen: ["geen facturen gevonden in de boekhouding, bedrag ongewijzigd gelaten"],
      wijzigt: false,
    });
  }

  regels.sort((a, b) => (a.wijzigt === b.wijzigt ? b.bedrag - a.bedrag : a.wijzigt ? -1 : 1));
  onbekend.sort((a, b) => b.bedrag - a.bedrag);

  // Het restant per maand, zodat het als vaste maandpost mee kan tellen. Delen
  // door het aantal maanden waarin er íets gefactureerd is en niet door het hele
  // venster: begon de linkbuilding pas twee maanden geleden, dan is het geen
  // derde van een maandbedrag.
  const restantPerMaand = maanden.map((m) => ({
    maand: m,
    bedrag: Math.round(restant.filter((r) => r.maand === m).reduce((s, r) => s + r.bedrag, 0)),
  }));
  const metBedrag = restantPerMaand.filter((m) => m.bedrag > 0);
  const restantTotaal = Math.round(restant.reduce((s, r) => s + r.bedrag, 0));

  return {
    vanMaand: van,
    totMaand: tot,
    regels,
    linkbuildingRestant: {
      bedrag: restantTotaal,
      perMaandGemiddeld: metBedrag.length ? Math.round(restantTotaal / metBedrag.length) : 0,
      perMaand: restantPerMaand,
      regels: restant.slice(0, 40),
    },
    linkbuilderGevonden: !!linkbuilder,
    linkbuilderNaam: linkbuilder?.name || null,
    linkbuilderZoekterm: zoekterm,
    linkbuilderId: linkbuilder?.id || null,
    onbekend,
  };
}

// ── Wat een leverancier per maand kost ──
// Het kostenmodel werkt met leveranciersnamen (Win Win, Greenbug, Gladior,
// Multimedia Concepts). Deze functie zoekt ze op in de boekhouding en telt op
// wat er per maand aan ze betaald is, zodat niemand een bedrag hoeft te typen
// dat Moneybird al weet.

export type LeverancierBedrag = {
  naam: string;
  gevonden: boolean;
  contactNaam: string | null;
  perMaandGemiddeld: number;
  perMaand: { maand: string; bedrag: number }[];
  maandenMetFactuur: number;
};

export async function leverancierMaandbedragen(namen: string[]): Promise<LeverancierBedrag[]> {
  const tot = maandPlus(maandNu(), -1);
  const van = maandPlus(tot, -(VENSTER_MAANDEN - 1));
  const maanden: Maand[] = Array.from({ length: VENSTER_MAANDEN }, (_, i) => maandPlus(van, i));
  const plat = (m: string) => m.replace("-", "");
  const contacten = await getMbContacts().catch(() => []);

  const uit: LeverancierBedrag[] = [];
  for (const naam of namen) {
    const s = sleutel(naam);
    const contact = contacten.find(
      (c) => (c.email || "").toLowerCase() === naam.toLowerCase() || (s.length >= 4 && sleutel(c.name).includes(s)),
    );
    if (!contact) {
      uit.push({ naam, gevonden: false, contactNaam: null, perMaandGemiddeld: 0, perMaand: [], maandenMetFactuur: 0 });
      continue;
    }
    const regels = await getLeverancierRegels(contact.id, plat(van), plat(tot)).catch(() => [] as LeverancierRegel[]);
    const perMaand = maanden.map((m) => ({
      maand: m,
      bedrag: Math.round(regels.filter((r) => r.maand === m).reduce((sum, r) => sum + r.bedrag, 0)),
    }));
    const metFactuur = perMaand.filter((m) => m.bedrag > 0);
    const totaal = perMaand.reduce((sum, m) => sum + m.bedrag, 0);
    uit.push({
      naam,
      gevonden: true,
      contactNaam: contact.name,
      // Delen door de maanden waarin er iets gefactureerd is, niet door het hele
      // venster: een leverancier die pas twee maanden meedraait heeft geen half
      // maandbedrag.
      perMaandGemiddeld: metFactuur.length ? Math.round(totaal / metFactuur.length) : 0,
      perMaand,
      maandenMetFactuur: metFactuur.length,
    });
  }
  return uit;
}

/** De naam van de vaste maandpost voor niet-toewijsbare linkbuilding. */
export function linkbuildingPostNaam(leverancier: string | null): string {
  return `Linkbuilding (${(leverancier || "leverancier").trim()})`;
}
