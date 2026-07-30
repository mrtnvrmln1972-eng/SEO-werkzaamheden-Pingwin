"use client";

import { useRef, useState } from "react";

export type Action = {
  id: string; type: string; reason?: string;
  url?: string; title?: string; taak?: string; fase?: string; wie?: string; steps?: string[]; tekst?: string;
  executed?: boolean;
  result?: { ok: boolean; message: string; taskIds?: number[]; runId?: number; link?: string; text?: string };
};

const LABEL: Record<string, string> = {
  pagina_toevoegen: "Pagina aanmaken",
  taak_aanmaken: "Taak aanmaken",
  plan_vastleggen: "Strategie vastleggen",
  pijplijn_starten: "Pijplijn starten",
  structured_data: "Structured data",
  alt_teksten: "Alt-teksten maken",
  meta_verbeteren: "Meta title/description",
  profiel_bijwerken: "Klantprofiel bijwerken",
};

function shortUrl(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}

// Eén goedkeur-kaartje onder een bird's eye-antwoord. Er gebeurt pas iets als
// Maarten op "Goedkeuren" klikt (mens aan het stuur).
export default function ActionCard({ action, slug, thread, onExecuted, onGoToPage, onGoToTask }: {
  action: Action; slug: string; thread: string;
  onExecuted: (id: string, result: NonNullable<Action["result"]>, executed: boolean) => void;
  onGoToPage?: (url: string) => void; onGoToTask?: (taskId: number) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const editRef = useRef<HTMLDivElement>(null);
  const editable = action.type === "profiel_bijwerken";
  const done = !!action.executed;
  const result = action.result;

  async function approve() {
    if (busy || done) return;
    setBusy(true);
    try {
      const edit = editable && editRef.current ? (editRef.current.innerText || "").trim() : undefined;
      const r = await fetch("/api/admin/overview/action", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, actionId: action.id, ...(edit ? { edit } : {}) }) });
      const d = await r.json();
      if (d.result) onExecuted(action.id, d.result, !!d.ok);
      else onExecuted(action.id, { ok: false, message: d.error || "Uitvoeren mislukt." }, false);
    } catch { onExecuted(action.id, { ok: false, message: "Uitvoeren mislukt." }, false); } finally { setBusy(false); }
  }

  function copyText() {
    if (!result?.text) return;
    navigator.clipboard?.writeText(result.text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  }

  // Opent de mailclient met de uitwerking (bijv. alt-teksten of meta-voorstel)
  // voorgevuld, gericht aan de opgeslagen sitebouwer/developer.
  function mailToDev() {
    if (!result?.text) return;
    let to = "";
    try { to = localStorage.getItem("pingwin-dev-email") || ""; } catch { /* geen opslag */ }
    const subject = `${LABEL[action.type] || "SEO"}${action.url ? ` — ${shortUrl(action.url)}` : ""}`;
    const body = `Hoi,\n\nKun je dit doorvoeren op ${action.url || "de pagina"}?\n\n${result.text}\n\nDank!`;
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  return (
    <div className={"act-card" + (done ? " act-done" : "")}>
      <div className="act-head">
        <span className="act-type">{LABEL[action.type] || action.type}</span>
        {action.url && <span className="act-url">{shortUrl(action.url)}</span>}
      </div>
      {action.taak && <div className="act-line"><strong>Taak:</strong> {action.taak}{action.wie ? ` (${action.wie})` : ""}</div>}
      {action.title && <div className="act-line"><strong>Titel:</strong> {action.title}</div>}
      {action.steps && action.steps.length > 0 && <div className="act-line"><strong>Stappen:</strong> {action.steps.join(" → ")}</div>}
      {action.reason && <div className="act-reason">{action.reason}</div>}

      {editable && !done && (
        <>
          <div className="act-edit-label muted">Voorstel (pas gerust aan vóór je goedkeurt):</div>
          <div className="act-edit" contentEditable suppressContentEditableWarning ref={editRef}>{action.tekst}</div>
        </>
      )}

      {!done && (
        <div className="act-actions">
          <button type="button" className={"primary-btn small" + (busy ? " busy" : "")} onClick={approve} disabled={busy}>{busy ? "Bezig…" : "Goedkeuren"}</button>
          {result && !result.ok && <span className="act-err">{result.message}</span>}
        </div>
      )}

      {done && result && (
        <div className="act-result">
          <div className="act-ok">✓ {result.message}</div>
          {result.text && (
            <div className="act-copybox">
              <div className="act-copybox-head">
                <span className="muted" style={{ fontSize: 11 }}>Voor de sitebouwer</span>
                <span style={{ display: "inline-flex", gap: 6 }}>
                  <button type="button" className="ghost-btn small" onClick={copyText}>{copied ? "Gekopieerd ✓" : "Kopieer"}</button>
                  <button type="button" className="ghost-btn small" onClick={mailToDev} title="Open je mail met deze uitwerking voorgevuld, gericht aan je sitebouwer/developer.">Mail naar sitebouwer</button>
                </span>
              </div>
              <pre className="act-pre">{result.text}</pre>
            </div>
          )}
          <div className="act-jump">
            {result.taskIds && result.taskIds.length > 0 && onGoToTask && <button type="button" className="ghost-btn small" onClick={() => onGoToTask(result.taskIds![0])}>Bekijk in Taken →</button>}
            {action.url && onGoToPage && <button type="button" className="ghost-btn small" onClick={() => onGoToPage(action.url!)}>Open pagina →</button>}
          </div>
        </div>
      )}
    </div>
  );
}
