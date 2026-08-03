import { urlKey } from "./url-key";
import { getClientBySlug } from "./clients";
import { getWeekplanPages, type WeekplanPageInfo } from "./overview";
import { getCopyLiveAll, type CopyLiveRij } from "./copy-live";
import { getPagePlan, getPageSummary, getPageDocOutputs, getOutgoingClusterAdvice, type PageSummary } from "./site-urls";
import { listVersionsForKey, KIND_LABEL, type DocVersion } from "./doc-versions";
import { getStepLinks } from "./page-doc-run";
import { getActiviteit, SOORT_LABEL, type Activiteit } from "./activiteit";
import { listChatsForKey, type ChatSummary } from "./page-chats";
import { getPaginaMails, zoekMailsIndienNodig, HARD_BEWIJS, type PaginaMail } from "./page-emails";

// ═══════════════════════════════════════════════════════════
// HET PAGINADOSSIER
// ═══════════════════════════════════════════════════════════
// Alles wat we over één pagina weten, op één plek, met klikbare links erbij.
// Dit is de VOORRAADKAST, niet het scherm: hij wordt nooit in zijn geheel
// getoond. De samenvatting (page-dossier-tekst.ts) kiest hieruit wat er voor
// déze taak toe doet, en het blok toont alleen dat.
//
// Alle bronnen bestonden al; hier worden ze samengevoegd. Er wordt niets
// opnieuw gemeten en niets nieuws bedacht.
//
// VALKUIL: in de codebase leven vier manieren om URL's te vergelijken. Dit
// bestand gebruikt er precies één, urlKey(), en matcht in JS, nooit in SQL.
// Anders mis je willekeurig een document of een gesprek door een www'tje.
// ═══════════════════════════════════════════════════════════

export type DossierDoc = { kind: string; label: string; naam: string; link: string; datum: string; bron: "pingwin" | "klant"; status: string; id?: number };

export type PageDossier = {
  url: string;
  pad: string;
  domein: string;
  klantNaam: string;
  stand: WeekplanPageInfo | null;
  copyLive: CopyLiveRij | null;
  plan: string;
  samenvatting: PageSummary | null;
  documenten: DossierDoc[];
  klantvoorstellen: DossierDoc[];   // teruggekregen teksten die nog verwerkt moeten worden
  mails: PaginaMail[];
  chats: ChatSummary[];
  activiteit: Activiteit[];
  gelieerde: { url: string; advies: string }[];
};

function padVan(u: string): string {
  try { return new URL(u).pathname.replace(/\/+$/, "") || "/"; } catch { return u; }
}

function versieToDoc(v: DocVersion): DossierDoc {
  return {
    kind: v.kind,
    label: KIND_LABEL[v.kind] || v.kind,
    naam: v.naam || KIND_LABEL[v.kind] || v.kind,
    link: v.driveLink || "",
    datum: v.createdAt,
    bron: v.source,
    status: v.status,
    id: v.id,
  };
}

/**
 * Verzamelt het volledige dossier van één pagina.
 * Doet standaard GEEN netwerkverkeer naar Outlook; met `verseMail` wordt er
 * hooguit één keer per week opnieuw naar bijpassende mail gezocht.
 */
export async function getPageDossier(slug: string, url: string, opts: { verseMail?: boolean } = {}): Promise<PageDossier> {
  const k = urlKey(url);
  if (opts.verseMail) await zoekMailsIndienNodig(slug, url).catch(() => { /* nooit blokkerend */ });

  const [client, pages, copyLiveAll, plan, samenvatting, outputs, versies, stepLinks, activiteit, chats, mails, uitgaand] =
    await Promise.all([
      getClientBySlug(slug).catch(() => null),
      getWeekplanPages(slug, new Set([k])).catch(() => ({} as Record<string, WeekplanPageInfo>)),
      getCopyLiveAll(slug).catch(() => ({} as Record<string, CopyLiveRij>)),
      getPagePlan(slug, url).catch(() => ""),
      getPageSummary(slug, url).catch(() => null),
      getPageDocOutputs(slug, url).catch(() => ({} as Record<string, string>)),
      listVersionsForKey(slug, url).catch(() => [] as DocVersion[]),
      getStepLinks(slug, url).catch(() => ({ analyse: "", blauwdruk: "", copy: "" } as Record<string, string>)),
      getActiviteit(slug).catch(() => [] as Activiteit[]),
      listChatsForKey(slug, url).catch(() => [] as ChatSummary[]),
      getPaginaMails(slug, url).catch(() => [] as PaginaMail[]),
      getOutgoingClusterAdvice(slug, url).catch(() => [] as { url: string; advice: string }[]),
    ]);

  const stand = pages[k] || null;

  // Documenten: de vaste stap-links (analyse/blauwdruk/copy) plus alles uit het
  // versie-archief. Ontdubbeld op link, want dezelfde Drive-link staat vaak in
  // allebei.
  const docs: DossierDoc[] = [];
  const gezien = new Set<string>();
  const push = (d: DossierDoc) => {
    const sleutel = d.link || `${d.kind}:${d.naam}`;
    if (gezien.has(sleutel)) return;
    gezien.add(sleutel);
    docs.push(d);
  };
  for (const [kind, link] of Object.entries(stepLinks)) {
    if (link) push({ kind, label: KIND_LABEL[kind] || kind, naam: KIND_LABEL[kind] || kind, link, datum: "", bron: "pingwin", status: "verwerkt" });
  }
  for (const v of versies) {
    if (v.status === "voorstel") continue;   // die staan apart, als klantvoorstel
    push(versieToDoc(v));
  }
  // Een geldende tekst zonder eigen document is er wel, maar heeft geen link.
  for (const kind of Object.keys(outputs)) {
    if (!docs.some((d) => d.kind === kind)) {
      push({ kind, label: KIND_LABEL[kind] || kind, naam: KIND_LABEL[kind] || kind, link: "", datum: "", bron: "pingwin", status: "verwerkt" });
    }
  }

  const klantvoorstellen = versies.filter((v) => v.status === "voorstel").map(versieToDoc);

  return {
    url,
    pad: padVan(url),
    domein: (client?.domain || "").replace(/^https?:\/\//, "").replace(/\/+$/, ""),
    klantNaam: client?.name || slug,
    stand,
    copyLive: copyLiveAll[k] || null,
    plan: plan || "",
    samenvatting: samenvatting || null,
    documenten: docs,
    klantvoorstellen,
    mails,
    chats: chats.slice(0, 5),
    activiteit: activiteit.filter((a) => a.url && urlKey(a.url) === k).slice(0, 15),
    gelieerde: uitgaand.map((u) => ({ url: u.url, advies: u.advice })),
  };
}

// ── Het dossier als tekst ──
// Voor de prompt van de samenvatting én als bronmateriaal voor de feitencontrole.
// Alleen wat bewijsbaar is; geen interpretatie.
export function dossierToText(d: PageDossier): string {
  const r: string[] = [];
  r.push(`PAGINA: ${d.pad} (${d.url}) van ${d.klantNaam}`);

  if (d.stand) {
    const s = d.stand;
    r.push(`STATUS: ${s.live ? "staat live" : "staat nog niet live"}, ${Math.round(s.vertoningen)} vertoningen, ${Math.round(s.klikken)} klikken.`);
    const af = (["strategie", "gelieerde", "analyse", "blauwdruk", "copy", "bouw", "structured"] as const)
      .filter((f) => s[f]);
    const open = (["strategie", "gelieerde", "analyse", "blauwdruk", "copy", "bouw", "structured"] as const)
      .filter((f) => !s[f]);
    if (af.length) r.push(`AF: ${af.join(", ")}.`);
    if (open.length) r.push(`NOG NIET AF: ${open.join(", ")}.`);
    if (s.next) r.push(`VOLGENDE STAP VOLGENS HET DASHBOARD: ${s.next}.`);
  }
  if (d.copyLive) {
    const c = d.copyLive;
    r.push(c.doorgevoerd
      ? `COPY LIVE: onze geschreven koppen staan op de pagina (${c.gevonden} van ${c.totaal}).`
      : `COPY NOG NIET LIVE VERWERKT: ${c.gevonden} van ${c.totaal} van onze koppen staan op de pagina.`);
  }
  if (d.plan) r.push(`STRATEGIE: ${d.plan.replace(/\s+/g, " ").slice(0, 600)}`);
  if (d.samenvatting?.doel) r.push(`DOEL VAN DE PAGINA: ${d.samenvatting.doel}`);

  if (d.mails.length) {
    r.push("MAILS DIE OVER DEZE PAGINA GAAN (nieuwste eerst):");
    for (const m of d.mails) {
      const datum = m.ontvangenOp ? new Date(m.ontvangenOp).toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" }) : "";
      const zeker = m.bron === "pin" ? "VASTGEPIND" : m.score >= HARD_BEWIJS ? "HARD BEWIJS" : "mogelijk relevant";
      r.push(`- [${zeker}] ${datum}, van ${m.vanNaam || m.vanAdres}: "${m.onderwerp}"${m.heeftBijlagen ? " (met bijlagen)" : ""}. ${m.preview.slice(0, 220)}`);
    }
  }
  if (d.klantvoorstellen.length) {
    r.push("TERUGGEKREGEN VAN DE KLANT, NOG NIET VERWERKT:");
    for (const v of d.klantvoorstellen) r.push(`- ${v.naam} (${v.label})`);
  }
  if (d.documenten.length) {
    r.push("DOCUMENTEN: " + d.documenten.map((x) => x.label + (x.link ? "" : " (zonder link)")).join(", "));
  }
  if (d.gelieerde.length) {
    r.push("GELIEERDE PAGINA'S: " + d.gelieerde.map((g) => padVan(g.url)).join(", "));
  }
  if (d.activiteit.length) {
    r.push("WAT ER MET DEZE PAGINA IS GEBEURD (nieuwste eerst):");
    for (const a of d.activiteit.slice(0, 8)) {
      const datum = new Date(a.gebeurdeOp).toLocaleDateString("nl-NL", { day: "numeric", month: "long" });
      r.push(`- ${datum}: ${SOORT_LABEL[a.soort]} (${a.wie}). ${a.intern}`);
    }
  }
  return r.join("\n");
}

/** De paden die in een samenvatting genoemd mogen worden (voor de feitencontrole). */
export function dossierPaden(d: PageDossier): string[] {
  return [d.pad, ...d.gelieerde.map((g) => padVan(g.url))];
}
