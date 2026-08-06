"use client";

import { useCallback, useEffect, useState } from "react";

// ═══════════════════════════════════════════════════════════
// EEN ACHTERGRONDKLUS VOLGEN VANAF EEN SCHERM
// ═══════════════════════════════════════════════════════════
// Elk scherm dat een klus start, volgt hem hiermee. Het belangrijkste zit in de
// eerste regel van de uitwerking: bij het openen wordt meteen gekeken of er al
// iets loopt. Daardoor zie je een scan die je tien minuten geleden startte nog
// steeds draaien, ook als je intussen in een ander tabblad zat of het venster
// sloot. Dat is precies wat er eerder wél gebeurde maar niet te zien was.
// ═══════════════════════════════════════════════════════════

export type Klus = {
  soort: string; naam: string; status: "bezig" | "klaar" | "fout" | "vastgelopen";
  stap: number; stappen: number; label: string; error: string;
  gestart: string | null; bijgewerkt: string | null;
};

export function useKlus(slug: string, soort: string, opKlaar?: () => void) {
  const [klus, setKlus] = useState<Klus | null>(null);

  const haal = useCallback(async (): Promise<Klus | null> => {
    try {
      const d = await fetch(`/api/admin/klussen?slug=${encodeURIComponent(slug)}&alles=1`).then((r) => r.json());
      if (!d?.ok) return null;
      const k = (d.klussen as Klus[]).find((x) => x.soort === soort) || null;
      setKlus(k);
      return k;
    } catch { return null; }
  }, [slug, soort]);

  useEffect(() => { void haal(); }, [haal]);

  // Alleen doortikken zolang hij draait. Een scherm dat eeuwig blijft pollen is
  // net zo verkeerd als een scherm dat niets laat zien.
  useEffect(() => {
    if (klus?.status !== "bezig") return;
    const t = setTimeout(() => {
      void haal().then((verse) => {
        if (verse && verse.status !== "bezig" && verse.status !== "vastgelopen") opKlaar?.();
      });
    }, 5000);
    return () => clearTimeout(t);
    // opKlaar bewust niet in de lijst: die wisselt bij elke render van de ouder.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [klus, haal]);

  const bezig = klus?.status === "bezig";
  return { klus, bezig, ververs: haal, zetBezig: () => setKlus((k) => ({
    soort, naam: k?.naam || "Bezig", status: "bezig", stap: 0, stappen: k?.stappen || 0,
    label: "Aan het starten…", error: "", gestart: new Date().toISOString(), bijgewerkt: null,
  })) };
}

/**
 * Wacht tot een achtergrondklus klaar is. Voor de enkele knop die twee stappen
 * aan elkaar ketent (eerst de sitemap, dan het menu): die volgorde mag niet
 * omvallen doordat de eerste stap nu meteen antwoord geeft.
 * Geeft de eindstand terug, of null als het te lang duurt.
 */
export async function wachtOpKlus(slug: string, soort: string, maxMinuten = 15): Promise<Klus | null> {
  const eind = Date.now() + maxMinuten * 60000;
  while (Date.now() < eind) {
    await new Promise((r) => setTimeout(r, 4000));
    try {
      const d = await fetch(`/api/admin/klussen?slug=${encodeURIComponent(slug)}&alles=1`).then((r) => r.json());
      const k = d?.ok ? (d.klussen as Klus[]).find((x) => x.soort === soort) : null;
      if (k && k.status !== "bezig") return k;
    } catch { /* volgende ronde opnieuw */ }
  }
  return null;
}
