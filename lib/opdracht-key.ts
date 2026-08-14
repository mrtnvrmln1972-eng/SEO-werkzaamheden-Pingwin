// Stabiele sleutel voor één losse opdrachtregel binnen "Opdrachten in deze
// kaart". Een opdracht heeft geen eigen id (hij komt uit de vrije kaarttekst),
// dus de tekst zelf is de sleutel. Verandert de tekst, dan verandert de
// sleutel, en begint die regel weer als "open"; dat klopt, want het is dan
// een andere instructie.
//
// Puur en zonder afhankelijkheden: dit bestand draait ook in de browser
// (lib/card-info.ts, dat dit importeert, wordt in "use client"-schermen
// gebruikt), dus geen database-import hier.

export function opdrachtKey(tekst: string): string {
  const norm = (tekst || "").trim().toLowerCase().replace(/\s+/g, " ");
  let h = 5381;
  for (let i = 0; i < norm.length; i++) h = ((h * 33) ^ norm.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export type OpdrachtStatus = "open" | "handmatig" | "automatisch_ok" | "automatisch_niet";

export type OpdrachtMark = { status: OpdrachtStatus; melding: string | null };
