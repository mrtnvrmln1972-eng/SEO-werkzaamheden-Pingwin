// ═══════════════════════════════════════════════════════════
// SLEPEN IN DE WEEKPLANNING: ÉÉN REKENREGEL VOOR TWEE SCHERMEN
// ═══════════════════════════════════════════════════════════
// Het tabblad Taken en het weekbord tonen dezelfde kaarten en laten je allebei
// slepen. De som "waar komt hij te staan en wat wordt de nieuwe volgorde" hoort
// dus maar één keer te bestaan. Stond hij twee keer, dan lopen ze vroeg of laat
// uiteen en zie je op het ene scherm een andere volgorde dan op het andere.
//
// Dit bestand rekent alleen; het praat niet met de server. Het scherm dat de
// functie aanroept zet de uitkomst in zijn eigen state en stuurt de POST's.

export type SleepTaak = { id: number; weekYear: number; weekNo: number; sortOrder: number };

/**
 * De nieuwe volgorde van één week, nadat je een kaart erin hebt losgelaten.
 *
 * `doelId` is de kaart waar hij BOVEN komt; `null` betekent achteraan. Terug
 * komt de hele week op volgorde, elk met een nieuw `sortOrder`. Leeg = er valt
 * niets te verplaatsen (kaart onbekend, of op zichzelf losgelaten).
 *
 * Hernummeren gaat met stappen van tien, zodat een latere invoeging er nog
 * tussen past zonder dat de hele week opnieuw genummerd hoeft te worden.
 */
export function nieuweVolgorde<T extends SleepTaak>(
  taken: T[], id: number, doelId: number | null, jaar: number, week: number,
): T[] {
  if (id === doelId) return [];
  const huidig = taken.find((t) => t.id === id);
  if (!huidig) return [];
  const inWeek = taken
    .filter((t) => t.id !== id && t.weekYear === jaar && t.weekNo === week)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id);
  const plek = doelId == null ? inWeek.length : Math.max(0, inWeek.findIndex((t) => t.id === doelId));
  const verplaatst = { ...huidig, weekYear: jaar, weekNo: week };
  return [...inWeek.slice(0, plek), verplaatst, ...inWeek.slice(plek)]
    .map((t, i) => ({ ...t, sortOrder: (i + 1) * 10 }));
}

/**
 * Dezelfde som, maar voor een lijst die GEEN week is: alles zonder datum.
 *
 * Waarom dit apart moest (18-08-2026): `nieuweVolgorde` hierboven rekent binnen
 * één week, want dat is waar `sort_order` in de database bij hoort. Taken zonder
 * datum hebben geen week die ergens op slaat, dus die vielen buiten de som: je
 * zag bij het slepen wel de streep waar de taak zou komen, maar bij loslaten
 * schoot hij terug naar zijn oude plek. Hier telt alleen de onderlinge volgorde,
 * en de week blijft met rust (die wordt dan ook niet meegestuurd naar de server).
 *
 * `doelId` is de taak waar hij BOVEN komt; `null` betekent onderaan.
 */
export function nieuweVolgordeInLijst<T extends { id: number; sortOrder: number }>(
  lijst: T[], gesleept: T, doelId: number | null,
): T[] {
  if (gesleept.id === doelId) return [];
  const rest = lijst
    .filter((t) => t.id !== gesleept.id)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id);
  const gevonden = doelId == null ? -1 : rest.findIndex((t) => t.id === doelId);
  const plek = doelId == null ? rest.length : (gevonden < 0 ? rest.length : gevonden);
  return [...rest.slice(0, plek), gesleept, ...rest.slice(plek)]
    .map((t, i) => ({ ...t, sortOrder: (i + 1) * 10 }));
}

/** Kaarten binnen een week op de volgorde zetten die je zelf gesleept hebt. */
export function opVolgorde<T extends SleepTaak>(taken: T[]): T[] {
  return [...taken].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id);
}

/**
 * De POST's die bij een nieuwe volgorde horen. Eén per kaart in de week, want
 * de server slaat `sort_order` per rij op.
 */
export async function bewaarVolgorde(slug: string, jaar: number, week: number, genummerd: SleepTaak[]) {
  await Promise.all(genummerd.map((t) =>
    fetch("/api/admin/weekplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, id: t.id, weekYear: jaar, weekNo: week, sortOrder: t.sortOrder }),
    }).catch(() => {})));
}

/**
 * Hetzelfde, maar alleen de volgorde: voor de taken zonder datum, waar de week
 * niets betekent en dus ook niet overschreven mag worden.
 */
export async function bewaarLosseVolgorde(slug: string, genummerd: { id: number; sortOrder: number }[]) {
  await Promise.all(genummerd.map((t) =>
    fetch("/api/admin/weekplan", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, id: t.id, sortOrder: t.sortOrder }),
    }).catch(() => {})));
}
