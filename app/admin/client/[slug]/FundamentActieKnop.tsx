"use client";

import { useEffect, useRef, useState } from "react";

export type FundamentActieKind = "tov" | "profile" | "structured";

const LABEL: Record<FundamentActieKind, { start: string; bezig: string }> = {
  tov: { start: "Tone-of-voice analyse starten", bezig: "Analyseren…" },
  profile: { start: "Klantprofiel opstellen", bezig: "Opstellen…" },
  structured: { start: "Ontbrekende gegevens ophalen", bezig: "Doorzoeken…" },
};

/**
 * Eén knop die een fundament-punt op gang trekt in plaats van er alleen de
 * stand van te tonen: een tone-of-voice- of klantprofiel-analyse uit de live
 * site (dezelfde motor als de knoppen op de Pagina's-tab), of het aanvullen
 * van de structured-data-basis.
 *
 * Zonder `live` (het overzicht met alle klanten naast elkaar) meldt de knop
 * alleen dat de taak gestart is: continu pollen voor negentien rijen tegelijk
 * zou de server onnodig belasten. Mét `live` (de cockpit van één klant) volgt
 * hij het resultaat, precies zoals de generator op de Pagina's-tab al deed,
 * en geeft de verse tekst (tov/profile) of een seintje (structured) door via
 * `onKlaar` zodat het paneel zichzelf kan bijwerken zonder herladen.
 */
export default function FundamentActieKnop({ slug, kind, live, onKlaar }: {
  slug: string;
  kind: FundamentActieKind;
  live?: boolean;
  onKlaar?: (verseProfileTekst?: string) => void;
}) {
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  async function start() {
    if (bezig) return;
    setBezig(true); setMelding("");

    if (kind === "structured") {
      try {
        const r = await fetch("/api/admin/org-data", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug, action: "autofill" }),
        });
        const d = await r.json();
        setBezig(false);
        if (!d.ok) { setMelding(d.error || "Mislukt."); return; }
        setMelding(`${d.gevuld || 0} velden aangevuld.`);
        onKlaar?.();
      } catch { setMelding("Mislukt."); setBezig(false); }
      return;
    }

    try {
      const r = await fetch("/api/admin/client-profile/generate", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, kind, background: true }),
      });
      const d = await r.json();
      if (!d.ok) { setMelding(d.error || "Mislukt."); setBezig(false); return; }
      if (!live) {
        setMelding("Gestart, dit kan een paar minuten duren. Kom straks terug.");
        setBezig(false);
        return;
      }
      setMelding("Draait op de achtergrond…");
      const kop = kind === "tov" ? /##\s*Tone of voice/i : /##\s*Klantprofiel/i;
      let tries = 0;
      pollRef.current = setInterval(async () => {
        tries++;
        try {
          const p = await fetch(`/api/admin/client-profile?slug=${encodeURIComponent(slug)}`).then((x) => x.json()).catch(() => null);
          if (p?.ok && typeof p.profile === "string" && kop.test(p.profile)) {
            setMelding("Klaar."); setBezig(false);
            if (pollRef.current) clearInterval(pollRef.current);
            onKlaar?.(p.profile);
          }
        } catch { /* blijf pollen */ }
        if (tries > 60) {
          setBezig(false); setMelding("Duurt langer dan verwacht; ververs straks de pagina.");
          if (pollRef.current) clearInterval(pollRef.current);
        }
      }, 5000);
    } catch { setMelding("Mislukt."); setBezig(false); }
  }

  return (
    <span className="fund-actie">
      <button type="button" className="btn btn-ghost btn-klein" onClick={() => void start()} disabled={bezig}>
        {bezig ? LABEL[kind].bezig : LABEL[kind].start}
      </button>
      {melding && <span className="fund-actie-melding">{melding}</span>}
    </span>
  );
}
