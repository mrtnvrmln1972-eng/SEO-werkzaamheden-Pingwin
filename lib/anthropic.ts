// Dunne Claude-client via fetch (geen SDK). Vereist ANTHROPIC_API_KEY in Vercel.

export type ChatMsg = { role: "user" | "assistant"; content: string };

// Verbruik-context: welke klant + welke actie, zodat we het Claude-verbruik per
// klant kunnen optellen. Optioneel: zonder context wordt er niets gemeten.
export type UsageCtx = { slug?: string; action: string };

const MODEL = "claude-sonnet-4-6";
// Goedkoop model (± 3x goedkoper) voor aantoonbaar lichte taken: extractie,
// korte labels, één-regel-correcties. Kernwerk (analyse, copy, chat) blijft op MODEL.
export const LIGHT_MODEL = "claude-haiku-4-5";
// Zwaar model voor het échte denkwerk: de bird's eye-strateeg. Daar is de vraag
// niet "haal dit cijfer op" maar "klopt deze hele opzet wel", en dat is precies
// waar een zwaarder model het verschil maakt. Alleen daar; alle motoren, de
// pagina-chat en het extractiewerk blijven op MODEL, anders loopt het verbruik op
// zonder dat het antwoord er beter van wordt.
export const HEAVY_MODEL = process.env.ANTHROPIC_HEAVY_MODEL || "claude-opus-5";
// Terugvalketen. Kent dit account het bovenste model niet (404 op de modelnaam),
// dan zakt hij een trede in plaats van de chat te laten mislukken. In het
// verbruik-scherm staat welk model er écht geantwoord heeft, dus een stille
// terugval blijft zichtbaar.
const TERUGVAL: Record<string, string> = {
  "claude-opus-5": "claude-opus-4-6",
  "claude-opus-4-6": "claude-opus-4-5",
  "claude-opus-4-5": MODEL,
};

// Prompt-caching: het (vaak enorme) system-prompt gaat als content-blok met een
// cache-markering mee. Bij een vervolg-aanroep binnen 5 minuten leest de API dat
// deel uit de cache tegen 10% van het normale tarief.
type Usage = { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; cache_creation_input_tokens?: number };

function systemBlocks(system: string) {
  return [{ type: "text", text: system, cache_control: { type: "ephemeral" } }];
}

// Meet het tokengebruik van één of meer Claude-antwoorden. Faalt stil: meten mag
// de chat nooit breken (logUsage vangt zelf ook fouten af).
async function logClaudeUsage(ctx: UsageCtx | undefined, usage: Usage | undefined, model = MODEL) {
  if (!ctx) return;
  try {
    const { logUsage } = await import("./usage");
    await logUsage({
      slug: ctx.slug, service: "anthropic", action: ctx.action, model,
      tokensIn: usage?.input_tokens || 0, tokensOut: usage?.output_tokens || 0,
      cacheRead: usage?.cache_read_input_tokens || 0, cacheWrite: usage?.cache_creation_input_tokens || 0,
    });
  } catch { /* stil: meting mag de chat niet breken */ }
}

export function anthropicConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// Zelfde als callClaude, maar met Anthropic's ingebouwde websearch aan: het model
// zoekt zelf gericht op het web (max maxSearches zoekopdrachten, betaald per
// zoekopdracht) en verwerkt de resultaten in het antwoord. Voor taken waar de
// benodigde informatie buiten de eigen site ligt (bijv. bedrijfsgegevens vergaren).
export async function callClaudeWebSearch(system: string, messages: ChatMsg[], maxTokens = 2000, ctx?: UsageCtx, maxSearches = 8): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt (voeg hem toe in Vercel).");
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 300000);
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: MODEL, max_tokens: maxTokens, system: systemBlocks(system), messages,
        tools: [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearches }],
      }),
      signal: ctrl.signal,
    });
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Claude-fout ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  await logClaudeUsage(ctx, j.usage);
  // Het antwoord kan uit meerdere blokken bestaan (zoekresultaten + tekst); wij
  // willen alleen de tekstblokken, samengevoegd.
  const text = Array.isArray(j.content) ? j.content.filter((c: { type?: string }) => c.type === "text").map((c: { text?: string }) => c.text || "").join("") : "";
  return text;
}

export async function callClaude(system: string, messages: ChatMsg[], maxTokens = 1800, ctx?: UsageCtx, model = MODEL): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt (voeg hem toe in Vercel om de chat te gebruiken).");
  // Harde time-out: hangt de Claude-API, dan gooit dit een fout i.p.v. eindeloos te
  // blijven wachten (voorkomt vastlopende achtergrond-runs).
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 300000);
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: systemBlocks(system), messages }),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Claude reageerde niet binnen de tijdslimiet (time-out).");
    throw e;
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Claude-fout ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  await logClaudeUsage(ctx, j.usage, model);
  return (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
}

// ── Variant met afbeeldingen erbij: Claude kíjkt naar de foto ──
//
// Aanleiding: de alt-teksten in de werklijst werden geschreven op alleen de
// bestandsnaam ("wat staat er waarschijnlijk op"). Dat levert per definitie een
// gok op, en dus vage teksten. Met de foto erbij wordt het een beschrijving.
//
// De API haalt de afbeelding zelf op via de URL. Dat kan mislukken (404, te
// groot, verkeerd formaat) en dan faalt het hele verzoek, niet één afbeelding.
// De aanroeper moet dus een terugval zonder afbeeldingen hebben.

// Een afbeelding komt binnen als URL (een beeld dat al ergens op het web staat)
// of als ruwe bytes (een screenshot die net in de dropzone viel en nog nergens
// publiek staat). Beide gaan naar dezelfde aanroep.
export type VisionImage = { url: string; label: string; base64?: string; mediaType?: string };

/** Formaten die de API aankan. SVG valt hier bewust buiten (niet ondersteund). */
const BEELD_OK = /\.(jpe?g|png|gif|webp)(\?|#|$)/i;

/** Filtert de afbeeldingen die we überhaupt mogen meesturen. */
export function beeldGeschikt(url: string): boolean {
  return !!url && /^https?:\/\//i.test(url) && BEELD_OK.test(url);
}

export async function callClaudeImages(system: string, tekst: string, images: VisionImage[], maxTokens = 1500, ctx?: UsageCtx, model = MODEL): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt (voeg hem toe in Vercel).");
  const bruikbaar = images.filter((i) => (i.base64 && i.mediaType) || beeldGeschikt(i.url));
  if (!bruikbaar.length) throw new Error("Geen bruikbare afbeeldingen om te tonen.");

  // Per afbeelding eerst het label (zodat het model weet welke naam erbij hoort),
  // dan de afbeelding zelf. De opdracht komt achteraan, na alle beelden.
  const content: Record<string, unknown>[] = [];
  for (const i of bruikbaar) {
    content.push({ type: "text", text: i.label });
    content.push(i.base64 && i.mediaType
      ? { type: "image", source: { type: "base64", media_type: i.mediaType, data: i.base64 } }
      : { type: "image", source: { type: "url", url: i.url } });
  }
  content.push({ type: "text", text: tekst });

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 300000);
  let res: Response;
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: maxTokens, system: systemBlocks(system), messages: [{ role: "user", content }] }),
      signal: ctrl.signal,
    });
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("Claude reageerde niet binnen de tijdslimiet (time-out).");
    throw e;
  } finally { clearTimeout(timer); }
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Claude-fout ${res.status}: ${t.slice(0, 300)}`);
  }
  const j = await res.json();
  await logClaudeUsage(ctx, j.usage, model);
  return (j.content || []).filter((c: { type: string }) => c.type === "text").map((c: { text: string }) => c.text).join("");
}

// ── Agentische variant: Claude mag tools aanroepen (bv. Ahrefs) ──
export type ToolDef = { name: string; description: string; input_schema: Record<string, unknown> };
export type ToolRunner = (name: string, input: Record<string, unknown>) => Promise<string>;

type Block = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };

// deadlineMs: absoluut tijdstip (Date.now()-schaal) waarna de agent geen nieuwe
// onderzoeksronde meer begint en afrondt met wat hij heeft. Nodig voor werk dat in
// een serverless-venster moet passen: zonder klok loopt de agent door tot het
// venster hem afkapt en is ALLES weg (zo strandde de opruim-analyse op 03-08-2026
// na 800 seconden, midden in het onderzoek). Halve bevindingen zijn bruikbaar,
// afgekapte niet. Laat leeg voor een gesprek dat gewoon mag doorlopen.
//
// model: laat leeg voor het standaardmodel. Een zwaardere keuze mag hier meegegeven
// worden voor de strategische gesprekken; kent de API het model niet, dan valt hij
// automatisch terug op het standaardmodel in plaats van de chat te laten mislukken.
// Wat er terugkomt als er na alle rondes én de afrondingspogingen geen tekst is.
// Het staat hier als constante zodat de aanroeper hem kan HERKENNEN. Dat is nodig:
// een vervolgronde die hierop uitkomt mag nooit een goed antwoord overschrijven,
// en dat gebeurde wel (de feitencontrole verving de tekst onvoorwaardelijk).
export const GEEN_ANTWOORD = "Ik heb de analyse gedaan, maar kon het antwoord niet netjes afronden (waarschijnlijk was de vraag in \u00e9\u00e9n keer te breed). Stel hem iets gerichter, bijvoorbeeld \u00e9\u00e9n doel of \u00e9\u00e9n set pagina's, dan pak ik het meteen goed op.";

export async function callClaudeAgentic(system: string, messages: ChatMsg[], tools: ToolDef[], run: ToolRunner, maxRounds = 6, maxTokens = 2200, ctx?: UsageCtx, deadlineMs?: number, model?: string): Promise<string> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt (voeg hem toe in Vercel).");
  let actiefModel = model || MODEL;
  const apiMessages: { role: string; content: unknown }[] = messages.map((m) => ({ role: m.role, content: m.content }));
  const u: Usage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }; // optellen over alle rondes

  // Cache-markering op de laatste tool-definitie: tools + system vormen samen het
  // vaste begin van elke ronde en worden zo maar één keer vol betaald.
  const cachedTools = tools.map((t, i) => (i === tools.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t));

  // Verplaats de cache-markering naar het laatste blok van het laatste bericht,
  // zodat elke ronde de complete gespreksgeschiedenis van de vorige ronde hergebruikt.
  // Oude markeringen eerst weghalen (maximaal 4 per verzoek toegestaan).
  function markLastMessage() {
    for (const m of apiMessages) {
      if (Array.isArray(m.content)) for (const b of m.content as Record<string, unknown>[]) delete b.cache_control;
    }
    const last = apiMessages[apiMessages.length - 1];
    if (!last) return;
    if (typeof last.content === "string") last.content = [{ type: "text", text: last.content }];
    const blocks = last.content as Record<string, unknown>[];
    if (blocks.length) blocks[blocks.length - 1].cache_control = { type: "ephemeral" };
  }

  async function call(withTools: boolean) {
    markLastMessage();
    const verstuur = async () => fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key as string, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: actiefModel, max_tokens: maxTokens, system: systemBlocks(system), messages: apiMessages, ...(withTools && tools.length ? { tools: cachedTools } : {}) }),
    });
    let res = await verstuur();
    // Onbekend of niet-vrijgegeven model? Val terug op het standaardmodel in plaats
    // van de hele chat te laten mislukken. Eén keer, daarna blijft de terugval staan.
    // Meerdere treden: opus-5 → opus-4-6 → opus-4-5 → het standaardmodel.
    let stappen = 0;
    while (!res.ok && res.status === 404 && actiefModel !== MODEL && stappen++ < 4) {
      actiefModel = TERUGVAL[actiefModel] || MODEL;
      res = await verstuur();
    }
    if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Claude-fout ${res.status}: ${t.slice(0, 300)}`); }
    return res.json();
  }

  function addUsage(usage: Usage | undefined) {
    u.input_tokens! += usage?.input_tokens || 0;
    u.output_tokens! += usage?.output_tokens || 0;
    u.cache_read_input_tokens! += usage?.cache_read_input_tokens || 0;
    u.cache_creation_input_tokens! += usage?.cache_creation_input_tokens || 0;
  }

  const textOf = (j: { content?: Block[] }) => ((j.content || []) as Block[]).filter((c) => c.type === "text").map((c) => c.text || "").join("");
  let uitTijd = false;
  for (let round = 0; round < maxRounds; round++) {
    // Tijd op? Niet aan een nieuwe ronde beginnen; hieronder volgt de afronding.
    if (deadlineMs && Date.now() > deadlineMs) { uitTijd = true; break; }
    const j = await call(true);
    addUsage(j.usage);
    const content: Block[] = j.content || [];
    const toolUses = content.filter((c) => c.type === "tool_use");
    if (j.stop_reason !== "tool_use" || toolUses.length === 0) {
      const text = textOf(j);
      if (text.trim()) { await logClaudeUsage(ctx, u, actiefModel); return text; }
      // Klaar maar zonder tekst? Val door naar de geforceerde afronding hieronder.
      apiMessages.push({ role: "assistant", content: content.length ? content : [{ type: "text", text: "…" }] });
      break;
    }
    apiMessages.push({ role: "assistant", content });
    // Tools binnen deze ronde parallel uitvoeren (scheelt veel wachttijd).
    const results = await Promise.all(toolUses.map(async (tu) => {
      let out: string;
      try { out = await run(tu.name || "", tu.input || {}); } catch (e) { out = "Fout: " + (e as Error).message; }
      return { type: "tool_result", tool_use_id: tu.id, content: out.slice(0, 6000) };
    }));
    apiMessages.push({ role: "user", content: results });
  }
  // Rondes op (of leeg antwoord): forceer afronding. Eerst ÉÉN ronde MÉT tools, zodat
  // de agent alsnog de actie-kaart kan aanmaken (stel_acties_voor) als Maarten om taken
  // of om iets in de weekplanning vroeg. Daarna een tekst-afronding zonder tools.
  apiMessages.push({ role: "user", content: uitTijd
    ? "De tijd voor onderzoek is op. Rond NU af in gewone tekst met wat je tot nu toe hebt gevonden; roep geen gereedschap meer aan. Een onvolledige bevinding is prima, zeg er dan bij wat je niet meer hebt kunnen nakijken."
    : "Rond nu af. Vroeg Maarten om taken, om kaarten of om iets in de weekplanning te zetten, roep dan NU het gereedschap aan om die acties écht voor te stellen (beschrijf ze niet alleen). Geef daarna je antwoord in gewone tekst." });
  let text = "";
  // Uit de tijd gelopen? Dan geen ronde mét tools meer, want die kan opnieuw
  // minutenlang gereedschap aanroepen en juist de afronding onmogelijk maken.
  if (!uitTijd) {
    const j = await call(true);
    addUsage(j.usage);
    const content: Block[] = j.content || [];
    const toolUses = content.filter((c) => c.type === "tool_use");
    if (toolUses.length) {
      apiMessages.push({ role: "assistant", content });
      const results = await Promise.all(toolUses.map(async (tu) => {
        let out: string;
        try { out = await run(tu.name || "", tu.input || {}); } catch (e) { out = "Fout: " + (e as Error).message; }
        return { type: "tool_result", tool_use_id: tu.id, content: out.slice(0, 6000) };
      }));
      apiMessages.push({ role: "user", content: results });
    } else {
      text = textOf(j);
    }
  }
  // Definitieve tekst zonder tools (twee pogingen); anders een nette melding.
  for (let attempt = 0; attempt < 2 && !text.trim(); attempt++) {
    const j = await call(false);
    addUsage(j.usage);
    text = textOf(j);
  }
  await logClaudeUsage(ctx, u, actiefModel);
  return text.trim() || GEEN_ANTWOORD;
}

// Forceert ÉÉN specifieke tool-aanroep (tool_choice) en geeft de ruwe input (JSON)
// terug. Zo hangt een gegarandeerde, gestructureerde uitkomst (bijv. de weektaken)
// niet af van of het model uit zichzelf de tool aanroept. Geen agentische loop.
export async function callClaudeForcedTool(
  system: string,
  messages: ChatMsg[],
  tool: ToolDef,
  ctx?: UsageCtx,
  maxTokens = 3000,
): Promise<Record<string, unknown> | null> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY ontbreekt (voeg hem toe in Vercel).");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemBlocks(system),
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      tools: [tool],
      tool_choice: { type: "tool", name: tool.name },
    }),
  });
  if (!res.ok) { const t = await res.text().catch(() => ""); throw new Error(`Claude-fout ${res.status}: ${t.slice(0, 300)}`); }
  const j = await res.json();
  await logClaudeUsage(ctx, j.usage);
  const content: Block[] = j.content || [];
  const tu = content.find((c) => c.type === "tool_use" && c.name === tool.name);
  return tu?.input || null;
}
