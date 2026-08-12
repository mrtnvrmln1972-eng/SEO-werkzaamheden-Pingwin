// Gedeelde types van het chatscherm van de paginakaart. Doorgegeven vanuit
// PageChat.tsx (het karkas); elk stap-blok woont in zijn eigen bestand hier.
import type { Bron } from "../Bronnenstrip";

export type Msg = { role: "user" | "assistant"; content: string; bronnen?: Bron[] };
export type Task = { taak: string; fase?: string; wie?: string };
export type Proposal = { plan?: string; tasks?: Task[] };
export type ChatSummary = { id: number; title: string; updatedAt: string; count: number };
// Achtergrond-run (analyse -> blauwdruk -> copy los van de browser).
export type DocRun = { id: number; status: string; steps: Record<string, string>; links: Record<string, string>; error: string; updatedAt?: string | null };
export type DriveFolder = { id: string; name: string; path: string };
