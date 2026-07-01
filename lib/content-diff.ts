/**
 * Content-diff: vergelijkt twee pagina-snapshots en geeft terug wat er
 * precies veranderd is. Het resultaat is een gestructureerd object dat
 * opgeslagen wordt in page_change_events.diff (JSONB).
 *
 * Velden:
 *   - Enkelvoudig (meta_title, meta_description, h1): { before, after }
 *   - Lijsten (h2s, h3s, schema_types): { added: [], removed: [] }
 *   - Alt-teksten: { added, removed, changed } (match op src/bestandsnaam)
 *   - Interne links: { added, removed } (match op href)
 *   - Woordenaantal: { before, after, delta }
 *
 * Alleen gevulde velden staan in het diff-object (lege arrays weggefilterd).
 */

export type FieldChange = { before: string; after: string };
export type ArrayDiff = { added: string[]; removed: string[] };
export type AltTagChange = { src: string; before: string; after: string };
export type AltTagDiff = {
  added: { src: string; alt: string }[];
  removed: { src: string; alt: string }[];
  changed: AltTagChange[];
};
export type LinkDiff = {
  added: { href: string; text: string }[];
  removed: { href: string; text: string }[];
};

export type ContentDiff = {
  meta_title?: FieldChange;
  meta_description?: FieldChange;
  h1?: FieldChange;
  h2s?: ArrayDiff;
  h3s?: ArrayDiff;
  alt_tags?: AltTagDiff;
  internal_links?: LinkDiff;
  word_count?: { before: number; after: number; delta: number };
  schema_types?: ArrayDiff;
};

export type SnapshotForDiff = {
  meta_title: string;
  meta_description: string;
  h1: string;
  h2s: string[];
  h3s: string[];
  alt_tags: { src: string; alt: string }[];
  internal_links: { href: string; text: string }[];
  word_count: number;
  schema_types: string[];
};

export function diffSnapshots(
  before: SnapshotForDiff,
  after: SnapshotForDiff,
): ContentDiff {
  const diff: ContentDiff = {};

  if (before.meta_title !== after.meta_title) {
    diff.meta_title = { before: before.meta_title, after: after.meta_title };
  }
  if (before.meta_description !== after.meta_description) {
    diff.meta_description = {
      before: before.meta_description,
      after: after.meta_description,
    };
  }
  if (before.h1 !== after.h1) {
    diff.h1 = { before: before.h1, after: after.h1 };
  }

  const h2d = arrayDiff(before.h2s, after.h2s);
  if (h2d.added.length || h2d.removed.length) diff.h2s = h2d;

  const h3d = arrayDiff(before.h3s, after.h3s);
  if (h3d.added.length || h3d.removed.length) diff.h3s = h3d;

  const schemaD = arrayDiff(before.schema_types, after.schema_types);
  if (schemaD.added.length || schemaD.removed.length) diff.schema_types = schemaD;

  if (before.word_count !== after.word_count) {
    diff.word_count = {
      before: before.word_count,
      after: after.word_count,
      delta: after.word_count - before.word_count,
    };
  }

  const altD = diffAltTags(before.alt_tags, after.alt_tags);
  if (altD.added.length || altD.removed.length || altD.changed.length) {
    diff.alt_tags = altD;
  }

  const linkD = diffLinks(before.internal_links, after.internal_links);
  if (linkD.added.length || linkD.removed.length) diff.internal_links = linkD;

  return diff;
}

function arrayDiff(before: string[], after: string[]): ArrayDiff {
  const bs = new Set(before);
  const as = new Set(after);
  return {
    added: after.filter((x) => !bs.has(x)),
    removed: before.filter((x) => !as.has(x)),
  };
}

function diffAltTags(
  before: { src: string; alt: string }[],
  after: { src: string; alt: string }[],
): AltTagDiff {
  const bm = new Map(before.map((a) => [a.src, a.alt]));
  const am = new Map(after.map((a) => [a.src, a.alt]));

  const added: { src: string; alt: string }[] = [];
  const removed: { src: string; alt: string }[] = [];
  const changed: AltTagChange[] = [];

  for (const [src, alt] of am) {
    if (!bm.has(src)) {
      added.push({ src, alt });
    } else if (bm.get(src) !== alt) {
      changed.push({ src, before: bm.get(src)!, after: alt });
    }
  }
  for (const [src, alt] of bm) {
    if (!am.has(src)) removed.push({ src, alt });
  }

  return { added, removed, changed };
}

function diffLinks(
  before: { href: string; text: string }[],
  after: { href: string; text: string }[],
): LinkDiff {
  const bm = new Map(before.map((l) => [l.href, l.text]));
  const am = new Map(after.map((l) => [l.href, l.text]));
  return {
    added: after.filter((l) => !bm.has(l.href)),
    removed: before.filter((l) => !am.has(l.href)),
  };
}

export function isDiffEmpty(diff: ContentDiff): boolean {
  return (
    !diff.meta_title &&
    !diff.meta_description &&
    !diff.h1 &&
    !diff.word_count &&
    (!diff.h2s || (!diff.h2s.added.length && !diff.h2s.removed.length)) &&
    (!diff.h3s || (!diff.h3s.added.length && !diff.h3s.removed.length)) &&
    (!diff.schema_types ||
      (!diff.schema_types.added.length && !diff.schema_types.removed.length)) &&
    (!diff.alt_tags ||
      (!diff.alt_tags.added.length &&
        !diff.alt_tags.removed.length &&
        !diff.alt_tags.changed.length)) &&
    (!diff.internal_links ||
      (!diff.internal_links.added.length && !diff.internal_links.removed.length))
  );
}

/** Korte samenvatting voor de change_summary kolom. */
export function diffSummary(diff: ContentDiff): string {
  const parts: string[] = [];
  if (diff.meta_title) parts.push("paginatitel");
  if (diff.meta_description) parts.push("meta-beschrijving");
  if (diff.h1) parts.push("H1");
  if (diff.h2s?.added.length || diff.h2s?.removed.length) parts.push("H2-koppen");
  if (diff.h3s?.added.length || diff.h3s?.removed.length) parts.push("H3-koppen");
  if (
    diff.alt_tags?.added.length ||
    diff.alt_tags?.removed.length ||
    diff.alt_tags?.changed.length
  )
    parts.push("alt-teksten");
  if (diff.internal_links?.added.length || diff.internal_links?.removed.length)
    parts.push("interne links");
  if (diff.word_count) parts.push(`woordenaantal (${diff.word_count.delta > 0 ? "+" : ""}${diff.word_count.delta})`);
  if (diff.schema_types?.added.length || diff.schema_types?.removed.length)
    parts.push("schema-types");
  return parts.length ? parts.join(", ") : "geen relevante wijzigingen";
}

/** Totaal aantal gewijzigde onderdelen (voor sortering/prioriteit). */
export function diffScore(diff: ContentDiff): number {
  let score = 0;
  if (diff.meta_title) score += 3;
  if (diff.meta_description) score += 2;
  if (diff.h1) score += 3;
  if (diff.h2s) score += diff.h2s.added.length + diff.h2s.removed.length;
  if (diff.h3s) score += diff.h3s.added.length + diff.h3s.removed.length;
  if (diff.alt_tags)
    score +=
      diff.alt_tags.added.length +
      diff.alt_tags.removed.length +
      diff.alt_tags.changed.length;
  if (diff.internal_links)
    score += diff.internal_links.added.length + diff.internal_links.removed.length;
  if (diff.schema_types)
    score += diff.schema_types.added.length + diff.schema_types.removed.length;
  if (diff.word_count) score += 1;
  return score;
}
