import type { WerkRegel } from "../opruim-werklijst";
import { BESLUITEN as ONE_DAY_CLINIC } from "./one-day-clinic";

// ═══════════════════════════════════════════════════════════
// BESLUITEN UIT EEN CHAT LANDEN OP DE WERKLIJST
// ═══════════════════════════════════════════════════════════
// Een cluster-analyse kan overal ontstaan (Cowork, Claude Code, een gesprek),
// maar het besluit hoort op één plek te landen: de werklijst in de cockpit.
// Blijft een besluit in een chat hangen, dan maakt de volgende chat een tweede,
// nét andere lijst, en dat is precies wat er op 12 augustus 2026 gebeurde met
// het cluster "soa test amsterdam": twee chats, twee lijsten, drie verschillen.
//
// Dit is de brug: een chat legt zijn besluiten vast in een bestand per klant in
// deze map, en de werklijst neemt ze op met herkomst "chat". Ze gedragen zich
// daarna als elke andere regel: doorvoerknop, vinkjes, Naar planning. Een
// chat-besluit is een besluit van Maarten en overruled dus de motor-uitkomst
// voor dezelfde pagina, net zoals de vaste regels dat doen.
//
// Eén bestand per klant, zodat twee chats over verschillende klanten nooit in
// hetzelfde bestand schrijven (dezelfde botsles als bij lib/uitleg/).
// ═══════════════════════════════════════════════════════════

/** Eén besluit uit een chat: dezelfde velden als een werklijst-regel, plus de
    datum waarop het genomen is. Herkomst en vinkjes zet de werklijst er zelf op. */
export type ChatBesluit = Omit<WerkRegel, "herkomst" | "doorgevoerd" | "contentOver"> & { datum: string };

const PER_KLANT: Record<string, ChatBesluit[]> = {
  "one-day-clinic": ONE_DAY_CLINIC,
};

export function chatBesluitenVoor(slug: string): ChatBesluit[] {
  return PER_KLANT[slug] || [];
}
