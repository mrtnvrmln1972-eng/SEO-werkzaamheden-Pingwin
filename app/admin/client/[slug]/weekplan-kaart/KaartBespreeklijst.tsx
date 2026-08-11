"use client";

// "Op bespreeklijst": een aanpak-punt van deze kaart naar iemands afvinklijstje.

import { useEffect, useState } from "react";
import { devLabel } from "../../../../../lib/personen";
import type { WpTask } from "./types";

export function useBespreeklijst({ slug, t, open }: { slug: string; t: WpTask; open: boolean }) {
  const [punt, setPunt] = useState("");
  const [msg, setMsg] = useState("");
  const [personen, setPersonen] = useState<string[]>(["Klant", "Dev"]);
  // Developer van DEZE klant; leeg = gewoon "Dev" tonen.
  const [devNaam, setDevNaam] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    fetch(`/api/admin/discuss?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => {
      if (d?.ok) {
        setPersonen([...new Set(["Klant", "Dev", ...(d.items || []).map((i: { persoon: string }) => i.persoon)])] as string[]);
        setDevNaam(d.devName || null);
      }
    }).catch(() => {});
  }, [open, slug]);

  async function zetOpLijst(persoon: string) {
    const tekst = punt;
    setPunt("");
    try {
      const d = await fetch("/api/admin/discuss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "add", slug, persoon, tekst: `${tekst}${t.url ? ` (${t.url})` : ""}` }) }).then((r) => r.json());
      setMsg(d?.ok ? `Op de bespreeklijst van ${persoon === "Dev" ? devLabel(devNaam) : persoon} gezet.` : (d?.error || "Op de lijst zetten mislukte."));
    } catch { setMsg("Op de lijst zetten mislukte."); }
  }

  /** Een punt uit de kaarttekst klaarzetten; de keuzerij verschijnt dan vanzelf. */
  function kies(tekst: string) { setPunt(tekst); setMsg(""); }

  return { punt, msg, personen, devNaam, zetOpLijst, kies, annuleer: () => setPunt("") };
}

export type Bespreeklijst = ReturnType<typeof useBespreeklijst>;

export default function BespreeklijstKeuze({ lijst }: { lijst: Bespreeklijst }) {
  return (
    <>
      {lijst.punt && (
        <div className="ovc-lijstkeuze">
          <span>Op welke bespreeklijst?</span>
          {lijst.personen.map((p) => (
            <button key={p} type="button" className="btn btn-ghost btn-klein" onClick={() => void lijst.zetOpLijst(p)}>{p === "Dev" ? devLabel(lijst.devNaam) : p}</button>
          ))}
          <button type="button" className="wp-icon wp-del" title="Annuleren" onClick={lijst.annuleer}>×</button>
        </div>
      )}
      {lijst.msg && <div className="wp-doc-ok">{lijst.msg}</div>}
    </>
  );
}
