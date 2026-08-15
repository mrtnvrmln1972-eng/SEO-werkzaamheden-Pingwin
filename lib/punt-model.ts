import type { Omvang } from "./grote-punten";
import type { Werk } from "./punt-ronde";

// ═══════════════════════════════════════════════════════════
// WELK MODEL DOET DIT WERK
// ═══════════════════════════════════════════════════════════
// Eén plek die dit bepaalt, want het stond eerst als een vaste regel in de
// werkstroom zelf (`--model claude-opus-5`) en dat betekent: élk plan gaat op
// het zwaarste model, ook een vraag als "kan dit venster niet gewoon weg?".
// Dat is precies wat brein/12-zuinig-werken.md verbiedt: het middelste model
// voor bouwen en gewoon werk, het zwaarste alleen voor strategie en beoordelen.
//
// DE KEUZE HANGT AAN WAT MAARTEN AL INVULT. Bij elk punt kiest hij klein,
// middel of groot. Dat ís de inschatting, en die is gratis. Er komt hier dus
// bewust GEEN aparte AI-stap bij die eerst gaat bedenken welk model past: zo'n
// stap kost zelf een aanroep en een minuut wachten, en betaalt daarmee precies
// de winst terug die hij zou moeten opleveren.
//
// Waarom groot wél zwaar blijft: bij een groot punt gaat het plan over een
// keuze met gevolgen (een structuur, een verbouwing, iets dat meeschaalt), en
// een half doordacht plan kost daar een hele nacht bouwen. Bij klein en middel
// gaat het bijna altijd om uitzoeken hoe iets nu werkt en dat opschrijven, en
// dat is werk waar het snelle model niet voor onderdoet.
// ═══════════════════════════════════════════════════════════

/** Het snelle model: bouwen, en plannen voor klein en middel werk. */
export const MODEL_LICHT = "claude-sonnet-5";

/** Het zware model: alleen een plan voor een groot punt. */
export const MODEL_ZWAAR = "claude-opus-5";

/**
 * Welk model deze ronde gebruikt.
 *
 * Bouwen gaat altijd licht: er ligt dan een goedgekeurd plan, dus het werk is
 * uitvoeren wat er staat en niet opnieuw bedenken wat er moet gebeuren.
 */
export function modelVoor(werk: Werk, omvang: Omvang): string {
  if (werk === "bouwen") return MODEL_LICHT;
  return omvang === "groot" ? MODEL_ZWAAR : MODEL_LICHT;
}

/** In gewone taal, voor op het scherm. Geen modelnamen; die zeggen Maarten niets. */
export function modelUitleg(model: string): string {
  return model === MODEL_ZWAAR ? "het zware model, want dit punt is groot" : "het snelle model";
}
