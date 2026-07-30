// ═══════════════════════════════════════════════════════════
// BIRD'S EYE-ACTIES: voorstellen die Maarten met één klik goedkeurt
// ═══════════════════════════════════════════════════════════
// De overzicht-agent stelt concrete acties voor (via het gereedschap
// stel_acties_voor); die worden als kaartjes getoond. Pas als Maarten op
// "goedkeuren" klikt, voert executeAction ze uit via de al bestaande
// lib-functies. Mens aan het stuur: er gebeurt nooit iets autonoom.
// ═══════════════════════════════════════════════════════════

import { getClientBySlug, saveClientProfile } from "./clients";
import { addManualPage, savePagePlan, getClientUrls } from "./site-urls";
import { appendTasks } from "./tasks";
import { createDocRun, runNow } from "./page-doc-run";
import { runPageSchema, applyPageSchema } from "./page-schema";
import { generateMetaProposal } from "./meta-ctr";
import { measurePage } from "./page-measure";
import { callClaude, LIGHT_MODEL } from "./anthropic";
import { sql, ensureSchema } from "./db";

export type ActionType = "pagina_toevoegen" | "taak_aanmaken" | "plan_vastleggen" | "pijplijn_starten" | "structured_data" | "alt_teksten" | "meta_verbeteren" | "profiel_bijwerken";
const VALID: ActionType[] = ["pagina_toevoegen", "taak_aanmaken", "plan_vastleggen", "pijplijn_starten", "structured_data", "alt_teksten", "meta_verbeteren", "profiel_bijwerken"];
// Types waarvan de kaart bewerkbaar is (Maarten kan de tekst bijstellen vóór goedkeuren).
export const EDITABLE: ActionType[] = ["profiel_bijwerken"];

export type ActionResult = { ok: boolean; message: string; taskIds?: number[]; runId?: number; link?: string; text?: string };
export type ProposedAction = {
  id: string; type: ActionType; reason?: string;
  url?: string; title?: string; taak?: string; fase?: string; wie?: string; plan?: string; steps?: string[]; extra?: string; keyword?: string; tekst?: string;
  executed?: boolean; result?: ActionResult;
};

// ── Uitvoerstatus per actie (los van de chat-JSON) ─────────────────────────
// Waarom apart: als Maarten meerdere kaarten snel achter elkaar goedkeurt,
// schreef de oude aanpak telkens de HÉLE chatgeschiedenis terug; gelijktijdige
// goedkeuringen overschreven dan elkaars status ("vielen terug"). Elke status is
// nu een eigen rij (atomair per actie), dus dat kan niet meer gebeuren.
export type StoredStatus = { executed: boolean; result?: ActionResult };

export async function getActionStatus(actionId: string): Promise<StoredStatus | null> {
  await ensureSchema();
  const { rows } = await sql`SELECT executed, result FROM overview_action_status WHERE action_id = ${actionId} LIMIT 1`;
  if (!rows[0]) return null;
  return { executed: !!rows[0].executed, result: (rows[0].result as ActionResult) || undefined };
}

export async function recordActionStatus(slug: string, thread: string, actionId: string, executed: boolean, result: ActionResult): Promise<void> {
  await ensureSchema();
  // Een geslaagde uitvoering nooit terugzetten naar niet-uitgevoerd (OR-logica).
  await sql`
    INSERT INTO overview_action_status (action_id, client_slug, thread, executed, result, updated_at)
    VALUES (${actionId}, ${slug}, ${thread}, ${executed}, ${JSON.stringify(result)}::jsonb, now())
    ON CONFLICT (action_id) DO UPDATE
      SET executed   = overview_action_status.executed OR EXCLUDED.executed,
          result     = EXCLUDED.result,
          thread     = EXCLUDED.thread,
          updated_at = now()`;
}

// Verrijkt geladen berichten met de opgeslagen uitvoerstatus, zodat de kaarten
// na herladen (of op een ander tabblad) hun juiste "✓ gedaan"-stand tonen. De
// status-tabel is de bron van waarheid, niet de chat-JSON.
export async function applyActionStatuses<T extends { actions?: ProposedAction[] }>(slug: string, messages: T[]): Promise<T[]> {
  const hasActions = messages.some((m) => m.actions && m.actions.length > 0);
  if (!hasActions) return messages;
  await ensureSchema();
  const { rows } = await sql`SELECT action_id, executed, result FROM overview_action_status WHERE client_slug = ${slug}`;
  if (!rows.length) return messages;
  const map = new Map<string, StoredStatus>();
  for (const r of rows) map.set(r.action_id as string, { executed: !!r.executed, result: (r.result as ActionResult) || undefined });
  return messages.map((m) => m.actions
    ? { ...m, actions: m.actions.map((a) => { const s = map.get(a.id); return s ? { ...a, executed: s.executed, result: s.result ?? a.result } : a; }) }
    : m);
}

// De sectie in het klantprofiel die automatisch uit de mail wordt bijgehouden.
const PROFIEL_SECTIE = "## Uit klantcommunicatie (bijgehouden uit mail)";
function mergeProfielSectie(current: string, tekst: string): string {
  const body = (tekst || "").trim();
  const cur = (current || "").trim();
  const lines = cur.split("\n");
  const start = lines.findIndex((l) => l.trim() === PROFIEL_SECTIE);
  if (start === -1) return (cur ? cur + "\n\n" : "") + PROFIEL_SECTIE + "\n" + body;
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) { if (/^##\s/.test(lines[i])) { end = i; break; } }
  const before = lines.slice(0, start).join("\n").trim();
  const after = lines.slice(end).join("\n").trim();
  return [before, PROFIEL_SECTIE + "\n" + body, after].filter(Boolean).join("\n\n");
}

function toFullUrl(u: string, domain: string): string {
  const t = (u || "").trim();
  if (!t) return "";
  if (/^https?:\/\//i.test(t)) return t;
  const base = (domain || "").replace(/^https?:\/\//i, "").replace(/\/$/, "");
  if (!base) return t;
  return `https://${base}${t.startsWith("/") ? t : `/${t}`}`;
}
const sameUrl = (a: string, b: string) => (a || "").replace(/\/+$/, "") === (b || "").replace(/\/+$/, "");

// Valideert + normaliseert één voorgestelde actie uit het model. null = ongeldig
// (onbekend type of ontbrekend verplicht veld), die wordt niet getoond.
export function validateAction(raw: Record<string, unknown>, domain: string, id: string): ProposedAction | null {
  const type = String(raw.type || "") as ActionType;
  if (!VALID.includes(type)) return null;
  const reason = String(raw.reason || "").slice(0, 300).trim();
  const url = toFullUrl(String(raw.url || ""), domain);
  const base = { id, type, reason };
  switch (type) {
    case "pagina_toevoegen":
      if (!url) return null;
      return { ...base, url, title: String(raw.title || "").slice(0, 160).trim() };
    case "taak_aanmaken": {
      const taak = String(raw.taak || "").slice(0, 400).trim();
      if (!taak) return null;
      return { ...base, taak, url: url || undefined, fase: String(raw.fase || "Bouwen"), wie: /dev/i.test(String(raw.wie || "")) ? "Dev" : "SEO" };
    }
    case "plan_vastleggen": {
      const plan = String(raw.plan || "").trim();
      if (!url || !plan) return null;
      return { ...base, url, plan: plan.slice(0, 6000) };
    }
    case "pijplijn_starten": {
      if (!url) return null;
      const allowed = ["analyse", "blauwdruk", "copy"];
      let steps = Array.isArray(raw.steps) ? raw.steps.map(String).filter((s) => allowed.includes(s)) : [];
      if (!steps.length) steps = ["analyse", "blauwdruk", "copy"];
      return { ...base, url, steps, extra: String(raw.extra || "").slice(0, 500) };
    }
    case "meta_verbeteren":
      if (!url) return null;
      return { ...base, url, keyword: String(raw.keyword || "").slice(0, 120).trim() };
    case "profiel_bijwerken": {
      const tekst = String(raw.tekst || "").trim();
      if (!tekst) return null;
      return { ...base, tekst: tekst.slice(0, 4000) };
    }
    case "structured_data":
    case "alt_teksten":
      if (!url) return null;
      return { ...base, url };
  }
  return null;
}

export async function executeAction(slug: string, action: ProposedAction): Promise<ActionResult> {
  const client = await getClientBySlug(slug);
  const domain = client?.domain || "";
  const url = toFullUrl(action.url || "", domain);
  switch (action.type) {
    case "pagina_toevoegen": {
      const r = await addManualPage(slug, url, action.title || "");
      return r.ok ? { ok: true, message: `Pagina toegevoegd: ${r.url || url}. Je kunt er nu een plan, blauwdruk en copy voor maken.`, link: r.url || url } : { ok: false, message: r.error || "Toevoegen mislukt." };
    }
    case "taak_aanmaken": {
      const ids = await appendTasks(slug, [{ taak: action.taak, wie: action.wie || "SEO", fase: action.fase || "Bouwen", status: "Gepland", pageUrl: url || undefined, klantZichtbaar: false }]);
      return ids.length ? { ok: true, message: "Taak aangemaakt in Taken.", taskIds: ids } : { ok: false, message: "Taak aanmaken mislukt." };
    }
    case "plan_vastleggen": {
      await savePagePlan(slug, url, action.plan || "");
      return { ok: true, message: "Strategie vastgelegd bij de pagina.", link: url };
    }
    case "pijplijn_starten": {
      let steps = (action.steps && action.steps.length ? action.steps : ["analyse", "blauwdruk", "copy"]) as ("analyse" | "blauwdruk" | "copy")[];
      // Niet-live pagina: analyse overslaan (er is nog niets om te analyseren).
      try { const urls = await getClientUrls(slug); const u = urls.find((x) => sameUrl(x.url, url)); if (u && u.status !== 200) steps = steps.filter((s) => s !== "analyse"); } catch { /* status onbekend, laat staan */ }
      if (!steps.length) steps = ["blauwdruk", "copy"];
      const runId = await createDocRun(slug, url, action.extra || "", "", steps, "klant");
      runNow(runId).catch(() => {});
      return { ok: true, message: `Pijplijn gestart (${steps.join(" → ")}). Volg de voortgang in de Pagina's-tab.`, runId };
    }
    case "profiel_bijwerken": {
      const merged = mergeProfielSectie(client?.seoProfile || "", action.tekst || "");
      await saveClientProfile(slug, merged);
      return { ok: true, message: "Klantprofiel bijgewerkt uit de mail. Copy, meta en strategie gebruiken deze nuance vanaf nu automatisch.", text: action.tekst };
    }
    case "meta_verbeteren": {
      try {
        const p = await generateMetaProposal(slug, url, action.keyword || "");
        const text = `Title: ${p.propTitle}\n\nDescription: ${p.propDesc}`;
        return { ok: true, message: "Nieuwe meta-title en description gegenereerd met de geavanceerde regels (pixelbreedte en criteria). Ze staan klaar in de Meta & CTR-tab om door te zetten naar WordPress.", text, link: url };
      } catch (e) { return { ok: false, message: "Meta-voorstel mislukt: " + (e as Error).message }; }
    }
    case "structured_data": {
      await runPageSchema(slug, url);
      const r = await applyPageSchema(slug, url);
      return r.ok ? { ok: true, message: "Structured data gegenereerd en als taak vastgelegd.", link: r.docLink, taskIds: r.taskId != null ? [r.taskId] : undefined } : { ok: false, message: r.error || "Structured data mislukt." };
    }
    case "alt_teksten": {
      const m = await measurePage(url, { staticOnly: true });
      if (!m.ok) return { ok: false, message: `Pagina niet leesbaar (status ${m.status ?? "?"}).` };
      const missing = m.images.filter((i) => !i.hasAlt || !i.alt.trim());
      if (!missing.length) return { ok: true, message: "Alle afbeeldingen op deze pagina hebben al een alt-tekst." };
      const list = missing.slice(0, 40).map((i) => i.file).join("\n");
      const sys = "Je bent SEO-copywriter. Schrijf per afbeeldingsbestandsnaam een korte, natuurlijke Nederlandse alt-tekst (maximaal ongeveer 12 woorden) die beschrijft wat er waarschijnlijk op staat, passend bij de pagina. Geen keyword-stuffing, begin niet met 'afbeelding van'. Geef PRECIES per regel: bestandsnaam => alt-tekst. Geef niets anders terug, geen inleiding.";
      const user = `Pagina: ${url}\nTitel: ${m.metaTitle}\nH1: ${m.h1.join(" | ")}\nOnderwerpen (H2): ${m.h2.slice(0, 10).join(" | ")}\n\nAfbeeldingen zonder alt-tekst:\n${list}`;
      let text = "";
      try { text = await callClaude(sys, [{ role: "user", content: user }], 1500, { slug, action: "alt-teksten" }, LIGHT_MODEL); } catch (e) { return { ok: false, message: "Alt-teksten genereren mislukt: " + (e as Error).message }; }
      const toel = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br>");
      const ids = await appendTasks(slug, [{ taak: `Alt-teksten toevoegen op ${url}`, wie: "Dev", fase: "Opschonen", status: "Gepland", pageUrl: url, toelichting: toel, klantZichtbaar: false }]).catch(() => [] as number[]);
      return { ok: true, message: `${missing.length} alt-teksten gegenereerd (kopieer hieronder, ook als Dev-taak gezet).`, text, taskIds: ids };
    }
  }
  return { ok: false, message: "Onbekende actie." };
}
