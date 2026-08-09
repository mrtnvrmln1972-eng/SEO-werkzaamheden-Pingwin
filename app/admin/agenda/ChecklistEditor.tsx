"use client";

import { useState } from "react";
import type { TaakItem } from "../../../lib/agenda-items";

// Checklist en subtaken delen dit editor-patroon: rij per item (vinkje + tekst
// + verwijderen), plus een invoerveld om een nieuw item toe te voegen.
export default function ChecklistEditor({
  label, items, onChange, placeholder,
}: {
  label: string;
  items: TaakItem[];
  onChange: (items: TaakItem[]) => void;
  placeholder: string;
}) {
  const [nieuw, setNieuw] = useState("");
  function voegToe() {
    if (!nieuw.trim()) return;
    onChange([...items, { id: crypto.randomUUID(), tekst: nieuw.trim(), done: false }]);
    setNieuw("");
  }
  return (
    <div className="ag-field">
      <span>{label}</span>
      {items.map((it) => (
        <label key={it.id} className="ag-field ag-checkbox-field ag-checklist-item">
          <input type="checkbox" checked={it.done}
            onChange={() => onChange(items.map((x) => (x.id === it.id ? { ...x, done: !x.done } : x)))} />
          <span className={it.done ? "ag-done" : ""}>{it.tekst}</span>
          <button type="button" className="ag-delete-btn" aria-label="Verwijderen"
            onClick={() => onChange(items.filter((x) => x.id !== it.id))}>✕</button>
        </label>
      ))}
      <div className="ag-field-row">
        <input type="text" value={nieuw} placeholder={placeholder}
          onChange={(e) => setNieuw(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); voegToe(); } }} />
        <button type="button" className="btn btn-ghost btn-klein" onClick={voegToe}>+ Toevoegen</button>
      </div>
    </div>
  );
}
