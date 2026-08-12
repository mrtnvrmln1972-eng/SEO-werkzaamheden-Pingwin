"use client";

// De achtergrond-run van stap 3 (analyse -> blauwdruk -> copy, server-side los
// van de browser): laden, pollen zolang hij loopt, starten, en het per stap
// groen houden van de knoppen (stepsDone leeft in PageChat.tsx, want de
// stand-effect daar vult hem óók).
import { useEffect, useState } from "react";
import type { DocRun, DriveFolder } from "./types";

export function useDocumentenRun({ slug, url, driveFolder, nuance, setErr, setStepsDone }: {
  slug: string; url: string; driveFolder: DriveFolder | null; nuance: string;
  setErr: (v: string) => void;
  setStepsDone: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
}) {
  const [run, setRun] = useState<DocRun | null>(null);
  const [runBusy, setRunBusy] = useState(false);
  // Meest recente documentlink per stap over ALLE runs (zodat een overgeslagen
  // stap in de statusregel toch zijn document uit een eerdere run toont).
  const [everLinks, setEverLinks] = useState<Record<"analyse" | "blauwdruk" | "copy", string>>({ analyse: "", blauwdruk: "", copy: "" });

  // Laatste achtergrond-run ophalen bij openen (toont een lopende of net afgeronde run).
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/page-doc/run?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`)
      .then((r) => r.json()).then((d) => {
        if (!alive || !d.ok) return;
        setRun(d.run);
        if (d.everLinks) setEverLinks(d.everLinks);
        // Retroactief groen: stappen die in ÉÉN van de runs ooit klaar zijn.
        if (d.everDone) {
          const upd: Record<string, boolean> = {};
          (["analyse", "blauwdruk", "copy"] as const).forEach((k) => { if (d.everDone[k]) { upd[k] = true; try { localStorage.setItem(`pw_stepdone_${slug}_${url}_${k}`, "1"); } catch { /* geen opslag */ } } });
          if (Object.keys(upd).length) setStepsDone((s) => ({ ...s, ...upd }));
        }
      })
      .catch(() => { /* niet kritisch */ });
    return () => { alive = false; };
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [slug, url]);

  // Zodra een stap "done" is in de run: onthoud dat per pagina (knop blijft groen).
  useEffect(() => {
    if (!run) return;
    const upd: Record<string, boolean> = {};
    (["analyse", "blauwdruk", "copy"] as const).forEach((k) => {
      if (run.steps[k] === "done") { upd[k] = true; try { localStorage.setItem(`pw_stepdone_${slug}_${url}_${k}`, "1"); } catch { /* geen opslag */ } }
    });
    if (Object.keys(upd).length) setStepsDone((s) => ({ ...s, ...upd }));
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [run, slug, url]);

  // Zolang een run loopt: elke 5s de status verversen (stopt vanzelf bij klaar/fout).
  useEffect(() => {
    if (!run || run.status !== "running") return;
    const t = setInterval(async () => {
      try {
        const r = await fetch(`/api/admin/page-doc/run?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`);
        const d = await r.json();
        if (d.ok) { setRun(d.run); if (d.everLinks) setEverLinks(d.everLinks); }
      } catch { /* stil */ }
    }, 5000);
    return () => clearInterval(t); /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [run?.status, run?.id, slug, url]);

  // Start de achtergrond-run: de drie stappen draaien server-side door; wegklikken mag.
  async function startBackgroundRun(steps: string[], folderIdOverride?: string, audience: "intern" | "klant" = "klant") {
    if (runBusy) return;
    setRunBusy(true); setErr("");
    try {
      const fid = folderIdOverride ?? driveFolder?.id;
      const r = await fetch("/api/admin/page-doc/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url, steps, extra: nuance.trim() || undefined, folderId: fid || undefined, audience }) });
      const d = await r.json();
      if (!d.ok) { setErr(d.error || "Achtergrond-run starten mislukt."); return; }
      const s = await fetch(`/api/admin/page-doc/run?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(url)}`).then((x) => x.json()).catch(() => null);
      if (s?.ok) setRun(s.run);
    } catch { setErr("Achtergrond-run starten mislukt."); } finally { setRunBusy(false); }
  }

  return { run, setRun, runBusy, everLinks, startBackgroundRun };
}
