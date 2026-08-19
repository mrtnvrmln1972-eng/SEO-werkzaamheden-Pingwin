"use client";

import { useId } from "react";
import AgendaPopup from "./AgendaPopup";
import DatumKnop from "./DatumKnop";
import ChecklistEditor from "./ChecklistEditor";
import { mdToHtml } from "../../../lib/markdown";
import {
  COLORS, PRIORITEITEN, HERINNERING_DAGEN_PRESETS, blokKleur, fmtTaakBadge, shiftDate,
  type TaakItem,
} from "../../../lib/agenda-items";

export type DagTaakDraft = {
  id?: number;
  titel: string;
  kleur: string;
  datum: string;
  eindDatum: string;
  done: boolean;
  notities: string;
  checklist: TaakItem[];
  subtaken: TaakItem[];
  prioriteit: number;
  lijst: string;
  tags: string[];
  herinneringenDagen: number[];
};

// Volledige bewerk-pop-up voor een hele-dag-taak.
export default function TaakPopup({
  draft, setDraft, anchor, todayKey, lijsten, saving,
  onClose, onSave, onDelete, onDuplicate, onToggleDone,
}: {
  draft: DagTaakDraft;
  setDraft: (d: DagTaakDraft) => void;
  anchor: { x: number; y: number };
  todayKey: string;
  lijsten: string[];
  saving: boolean;
  onClose: () => void;
  onSave: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onToggleDone: () => void;
}) {
  const lijstenId = `taakpopup-lijsten-${useId()}`;

  return (
    <AgendaPopup x={anchor.x} y={anchor.y} onClose={onClose}>
      <div className="ag-modal-head">
        <h2>{draft.id ? "Taak bewerken" : "Nieuwe taak"}</h2>
        <button className="ag-delete-btn" onClick={onClose} aria-label="Sluiten">✕</button>
      </div>
      <label className="ag-field">
        <span>Titel</span>
        <input autoFocus type="text" value={draft.titel}
          onChange={(e) => setDraft({ ...draft, titel: e.target.value })}
          placeholder="Bijv. Debiteuren bellen" />
      </label>
      <label className="ag-field ag-checkbox-field">
        <input type="checkbox" checked={draft.done} onChange={onToggleDone} />
        <span>Afgehandeld</span>
      </label>
      <DatumKnop
        label={fmtTaakBadge(draft.datum, draft.eindDatum, todayKey)}
        datumSlot={
          <>
            <div className="ag-field">
              <span>Snel instellen</span>
              <div className="ag-weekday-row">
                <button type="button" className="schakel-knop" onClick={() => setDraft({ ...draft, datum: todayKey, eindDatum: "" })}>Vandaag</button>
                <button type="button" className="schakel-knop" onClick={() => setDraft({ ...draft, datum: shiftDate(todayKey, 1), eindDatum: "" })}>Morgen</button>
                <button type="button" className="schakel-knop" onClick={() => setDraft({ ...draft, datum: shiftDate(todayKey, 7), eindDatum: "" })}>Volgende week</button>
              </div>
            </div>
            <label className="ag-field">
              <span>Datum</span>
              <input type="date" value={draft.datum} onChange={(e) => setDraft({ ...draft, datum: e.target.value })} />
            </label>
          </>
        }
        duurSlot={
          <label className="ag-field">
            <span>Tot (leeg = eendaags)</span>
            <input type="date" value={draft.eindDatum} min={draft.datum}
              onChange={(e) => setDraft({ ...draft, eindDatum: e.target.value })} />
          </label>
        }
        reminderSlot={
          <div className="ag-weekday-row">
            {HERINNERING_DAGEN_PRESETS.map(([val, label]) => (
              <button key={val} type="button"
                className={`schakel-knop${draft.herinneringenDagen.includes(val) ? " aan" : ""}`}
                onClick={() => setDraft({
                  ...draft,
                  herinneringenDagen: draft.herinneringenDagen.includes(val)
                    ? draft.herinneringenDagen.filter((v) => v !== val)
                    : [...draft.herinneringenDagen, val].sort((a, c) => a - c),
                })}>
                {label}
              </button>
            ))}
          </div>
        }
        herhaalSlot={<span className="ag-note">Nog niet beschikbaar voor taken.</span>}
      />
      <label className="ag-field">
        <span>Notities</span>
        <textarea rows={4} value={draft.notities}
          placeholder={"Bijv.\n- Contact opnemen met TP\n- https://mail.superhuman.com/…"}
          onChange={(e) => setDraft({ ...draft, notities: e.target.value })} />
      </label>
      {draft.notities.trim() && (
        <div className="ag-field">
          <span>Voorbeeld</span>
          <div className="ag-md-preview md" dangerouslySetInnerHTML={{ __html: mdToHtml(draft.notities) }} />
        </div>
      )}
      <div className="ag-field">
        <span>Kleur</span>
        <div className="ag-color-row">
          {COLORS.map((c) => (
            <button key={c} className={`ag-color-dot${blokKleur(draft.kleur) === c ? " selected" : ""}`}
              style={{ background: c }} onClick={() => setDraft({ ...draft, kleur: c })} aria-label={c} />
          ))}
        </div>
      </div>
      <div className="ag-field-row">
        <div className="ag-field">
          <span>Prioriteit</span>
          <div className="ag-weekday-row">
            {PRIORITEITEN.map(([val, label]) => (
              <button key={val} type="button" className={`schakel-knop${draft.prioriteit === val ? " aan" : ""}`}
                onClick={() => setDraft({ ...draft, prioriteit: val })}>{label}</button>
            ))}
          </div>
        </div>
        <label className="ag-field">
          <span>Lijst</span>
          <input type="text" list={lijstenId} value={draft.lijst}
            onChange={(e) => setDraft({ ...draft, lijst: e.target.value })} placeholder="Bijv. Privé" />
          <datalist id={lijstenId}>{lijsten.map((l) => <option key={l} value={l} />)}</datalist>
        </label>
      </div>
      <label className="ag-field">
        <span>Tags (komma&apos;s)</span>
        <input type="text" value={draft.tags.join(", ")}
          onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })}
          placeholder="Bijv. urgent, privé" />
      </label>
      <ChecklistEditor label="Checklist" items={draft.checklist}
        onChange={(checklist) => setDraft({ ...draft, checklist })} placeholder="+ item toevoegen" />
      <ChecklistEditor label="Subtaken" items={draft.subtaken}
        onChange={(subtaken) => setDraft({ ...draft, subtaken })} placeholder="+ subtaak toevoegen" />
      <div className="ag-modal-actions">
        {draft.id && <button className="btn btn-danger btn-klein" onClick={onDelete} disabled={saving}>Verwijderen</button>}
        {draft.id && <button className="btn btn-ghost btn-klein" onClick={onDuplicate} disabled={saving}>Dupliceer</button>}
        <span className="ag-modal-actions-spacer" />
        <button className="btn btn-ghost btn-klein" onClick={onClose}>Annuleren</button>
        <button className="btn btn-primary btn-klein" onClick={onSave} disabled={saving || !draft.titel.trim()}>
          {saving ? "Opslaan…" : "Opslaan"}
        </button>
      </div>
    </AgendaPopup>
  );
}
