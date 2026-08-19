"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import AgendaPopup from "./AgendaPopup";
import DatumKnop from "./DatumKnop";
import ChecklistEditor from "./ChecklistEditor";
import TaakPopup, { type DagTaakDraft } from "./TaakPopup";
import { mdToHtml } from "../../../lib/markdown";
import {
  type TaakItem, type DagTaak, COLORS, blokKleur, PRIORITEITEN, HERINNERING_MIN_PRESETS,
  shiftDate, toKey, fmtDatumLabel, fmtTaakBadge, geldtOp,
} from "../../../lib/agenda-items";
import { PijlLinks, PijlRechts } from "../../_ui/Pijl";

type Block = {
  id: number;
  title: string;
  color: string;
  start_min: number;
  end_min: number;
  date: string | null;
  weekdays: number[] | null;
  notities: string;
  eind_datum: string | null;
  checklist: TaakItem[];
  subtaken: TaakItem[];
  prioriteit: number;
  lijst: string;
  tags: string[];
  herinneringen_min: number[];
  herhaal_interval: number;
  herhaal_anker_datum: string | null;
};

type Mark = { block_id: number; date: string; status: string };

type Occurrence = { block: Block; dayIdx: number; date: string; done: boolean };

type Herhaal = "geen" | "dag" | "werkdag" | "aangepast";

type Draft = {
  id?: number;
  title: string;
  color: string;
  startMin: number;
  endMin: number;
  herhaal: Herhaal;
  weekdays: number[];
  date: string;
  eindDatum: string;
  notities: string;
  checklist: TaakItem[];
  subtaken: TaakItem[];
  prioriteit: number;
  lijst: string;
  tags: string[];
  herinneringenMin: number[];
  herhaalInterval: number;
  herhaalAnkerDatum: string;
};

function herhaalVan(weekdays: number[] | null): Herhaal {
  if (!weekdays || weekdays.length === 0) return "geen";
  if (weekdays.length === 7) return "dag";
  if (weekdays.length === 5 && [1, 2, 3, 4, 5].every((d) => weekdays.includes(d))) return "werkdag";
  return "aangepast";
}

function weekdaysVan(herhaal: Herhaal, aangepast: number[]): number[] {
  if (herhaal === "geen") return [];
  if (herhaal === "dag") return [1, 2, 3, 4, 5, 6, 7];
  if (herhaal === "werkdag") return [1, 2, 3, 4, 5];
  return aangepast;
}

const DAY_START = 5 * 60;
const DAY_END = 22 * 60;
const SNAP = 15;
const PX_PER_MIN = 0.85;
const DAY_NAMES = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"];

function mondayOf(d: Date): Date {
  const r = new Date(d);
  const wd = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - wd);
  r.setHours(0, 0, 0, 0);
  return r;
}

function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmtBlokBadge(draft: Draft, todayKey: string): string {
  if (draft.herhaal === "dag") return "Elke dag";
  if (draft.herhaal === "werkdag") return "Werkdagen";
  if (draft.herhaal === "aangepast") {
    return draft.weekdays.length ? draft.weekdays.map((w) => DAY_NAMES[w - 1]).join(", ") : "Eigen dagen";
  }
  return fmtDatumLabel(draft.date, todayKey);
}

function parseTime(s: string): number {
  const [h, m] = s.split(":").map(Number);
  return h * 60 + (m || 0);
}

function snap(min: number): number {
  return Math.round(min / SNAP) * SNAP;
}

// Maartens persoonlijke weekagenda: tijdblokken (eenmalig of herhalend) plus
// hele-dag-taken erboven, in een sleepbaar weekrooster. Poort van LifeMax'
// Weekplanner, zonder de activiteit-tracking/timer (die hoort bij een los
// trackertje op de Mac dat dit dashboard niet heeft).
export default function AgendaClient() {
  const [weekStart, setWeekStart] = useState<Date | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [marks, setMarks] = useState<Mark[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [popupAnchor, setPopupAnchor] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  const [dagTaken, setDagTaken] = useState<DagTaak[]>([]);
  const [taakDraft, setTaakDraft] = useState<DagTaakDraft | null>(null);
  const [taakPopupAnchor, setTaakPopupAnchor] = useState<{ x: number; y: number } | null>(null);
  const [lijsten, setLijsten] = useState<string[]>([]);
  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{
    id: number | "__create__";
    mode: "move" | "resize" | "create";
    startY: number; startX: number;
    origStart: number; origEnd: number; origDay: number;
    moved: boolean; dayIdx: number; curStart: number; curEnd: number;
  } | null>(null);
  const createColRectRef = useRef<DOMRect | null>(null);
  const taakDragRef = useRef<{
    id: number; startX: number; startY: number; origDay: number; dayIdx: number; dx: number; moved: boolean;
  } | null>(null);
  const [, forceRender] = useState(0);
  const suppressClickRef = useRef(false);
  const [isMobile, setIsMobile] = useState(false);
  const [mobileDay, setMobileDay] = useState((new Date().getDay() + 6) % 7);

  useEffect(() => {
    setWeekStart(mondayOf(new Date()));
    const mq = window.matchMedia("(max-width: 768px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const dates: string[] = [];
  if (weekStart) {
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      dates.push(toKey(d));
    }
  }

  const load = useCallback(async () => {
    if (!weekStart) return;
    setLoading(true);
    const weekEindKey = toKey(new Date(weekStart.getTime() + 6 * 86400000));
    const [res, takenRes] = await Promise.all([
      fetch(`/api/admin/agenda?start=${toKey(weekStart)}`),
      fetch(`/api/admin/agenda/taken?start=${toKey(weekStart)}&eind=${weekEindKey}`),
    ]);
    const data = await res.json();
    const taken = await takenRes.json();
    setBlocks(data.blocks || []);
    setMarks(data.marks || []);
    setDagTaken(taken.taken || []);
    setLijsten(Array.from(new Set([...(data.lijsten || []), ...(taken.lijsten || [])])).sort());
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!weekStart) return;
    const timer = setTimeout(() => {
      const grid = gridRef.current;
      if (!grid || grid.scrollWidth <= grid.clientWidth) return;
      const todayIdx = Math.floor((new Date().setHours(0, 0, 0, 0) - weekStart.getTime()) / 86400000);
      if (todayIdx < 0 || todayIdx > 6) return;
      const colWidth = (grid.scrollWidth - 52) / 7;
      grid.scrollLeft = Math.max(0, 52 + todayIdx * colWidth - 16);
    }, 150);
    return () => clearTimeout(timer);
  }, [weekStart]);

  if (!weekStart) return null;

  const todayKey = toKey(new Date());
  const markMap = new Map(marks.map((m) => [`${m.block_id}|${m.date}`, m.status]));

  const occurrences: Occurrence[] = [];
  for (const b of blocks) {
    if (b.weekdays && b.weekdays.length > 0) {
      for (let i = 0; i < 7; i++) {
        if (!geldtOp(b, dates[i])) continue;
        if (markMap.get(`${b.id}|${dates[i]}`) === "skipped") continue;
        occurrences.push({ block: b, dayIdx: i, date: dates[i], done: markMap.get(`${b.id}|${dates[i]}`) === "done" });
      }
    } else if (b.date) {
      const idx = dates.indexOf(b.date);
      if (idx >= 0) occurrences.push({ block: b, dayIdx: idx, date: b.date, done: markMap.get(`${b.id}|${b.date}`) === "done" });
    }
  }

  function shiftWeek(delta: number) {
    const next = new Date(weekStart!);
    next.setDate(next.getDate() + delta * 7);
    setWeekStart(next);
  }

  function openCreate(dayIdx: number, startMin: number, endMin?: number) {
    setDraft({
      title: "", color: COLORS[9], startMin, endMin: endMin ?? Math.min(startMin + 60, DAY_END),
      herhaal: "geen", weekdays: [dayIdx + 1], date: dates[dayIdx], eindDatum: "", notities: "",
      checklist: [], subtaken: [], prioriteit: 0, lijst: "", tags: [], herinneringenMin: [10, 0],
      herhaalInterval: 1, herhaalAnkerDatum: dates[dayIdx],
    });
  }

  function closeDraft() { setDraft(null); setPopupAnchor(null); }
  function closeTaakDraft() { setTaakDraft(null); setTaakPopupAnchor(null); }

  function openNieuweTaak(datum: string, anchor: { x: number; y: number }) {
    setTaakDraft({
      titel: "", kleur: COLORS[9], datum, eindDatum: "", done: false, notities: "",
      checklist: [], subtaken: [], prioriteit: 0, lijst: "", tags: [], herinneringenDagen: [],
    });
    setTaakPopupAnchor(anchor);
  }

  function openEditTaak(taak: DagTaak, anchor: { x: number; y: number }) {
    setTaakDraft({
      id: taak.id, titel: taak.titel, kleur: taak.kleur, datum: taak.datum,
      eindDatum: taak.eind_datum || "", done: taak.done, notities: taak.notities,
      checklist: taak.checklist || [], subtaken: taak.subtaken || [],
      prioriteit: taak.prioriteit || 0, lijst: taak.lijst || "", tags: taak.tags || [],
      herinneringenDagen: taak.herinneringen_dagen || [],
    });
    setTaakPopupAnchor(anchor);
  }

  async function saveTaakDraft() {
    if (!taakDraft || !taakDraft.titel.trim() || saving) return;
    setSaving(true);
    const payload = {
      titel: taakDraft.titel.trim(), kleur: taakDraft.kleur, datum: taakDraft.datum,
      eind_datum: taakDraft.eindDatum || null, checklist: taakDraft.checklist, subtaken: taakDraft.subtaken,
      prioriteit: taakDraft.prioriteit, lijst: taakDraft.lijst, tags: taakDraft.tags,
      herinneringen_dagen: taakDraft.herinneringenDagen,
    };
    if (taakDraft.id) {
      await fetch("/api/admin/agenda/taken", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taakDraft.id, done: taakDraft.done, notities: taakDraft.notities, ...payload }),
      });
    } else {
      await fetch("/api/admin/agenda/taken", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    closeTaakDraft();
    load();
  }

  async function duplicateTaakDraft() {
    if (!taakDraft || !taakDraft.titel.trim() || saving) return;
    setSaving(true);
    await fetch("/api/admin/agenda/taken", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titel: taakDraft.titel.trim(), kleur: taakDraft.kleur, datum: taakDraft.datum,
        eind_datum: taakDraft.eindDatum || null, checklist: taakDraft.checklist, subtaken: taakDraft.subtaken,
        prioriteit: taakDraft.prioriteit, lijst: taakDraft.lijst, tags: taakDraft.tags,
        herinneringen_dagen: taakDraft.herinneringenDagen,
      }),
    });
    setSaving(false);
    closeTaakDraft();
    load();
  }

  async function deleteTaakDraft() {
    if (!taakDraft?.id || saving) return;
    setSaving(true);
    await fetch(`/api/admin/agenda/taken?id=${taakDraft.id}`, { method: "DELETE" });
    setSaving(false);
    closeTaakDraft();
    load();
  }

  async function toggleTaakDone(taak: DagTaak) {
    setDagTaken((prev) => prev.map((t) => (t.id === taak.id ? { ...t, done: !t.done } : t)));
    setTaakDraft((prev) => (prev?.id === taak.id ? { ...prev, done: !taak.done } : prev));
    await fetch("/api/admin/agenda/taken", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: taak.id, done: !taak.done }),
    });
  }

  function openEdit(b: Block, date: string) {
    setDraft({
      id: b.id, title: b.title, color: b.color, startMin: b.start_min, endMin: b.end_min,
      herhaal: herhaalVan(b.weekdays),
      weekdays: b.weekdays && b.weekdays.length ? b.weekdays : [dates.indexOf(date) + 1],
      date: b.date || date, eindDatum: b.eind_datum || "", notities: b.notities || "",
      checklist: b.checklist || [], subtaken: b.subtaken || [], prioriteit: b.prioriteit || 0,
      lijst: b.lijst || "", tags: b.tags || [],
      herinneringenMin: b.herinneringen_min && b.herinneringen_min.length ? b.herinneringen_min : [10, 0],
      herhaalInterval: b.herhaal_interval || 1, herhaalAnkerDatum: b.herhaal_anker_datum || date,
    });
  }

  async function saveDraft() {
    if (!draft || !draft.title.trim() || saving) return;
    setSaving(true);
    const weekdays = weekdaysVan(draft.herhaal, draft.weekdays);
    const payload = {
      id: draft.id, title: draft.title.trim(), color: draft.color, start_min: draft.startMin,
      end_min: Math.max(draft.endMin, draft.startMin + SNAP), weekdays,
      date: weekdays.length > 0 ? null : draft.date,
      eind_datum: weekdays.length > 0 && draft.eindDatum ? draft.eindDatum : null,
      notities: draft.notities, checklist: draft.checklist, subtaken: draft.subtaken,
      prioriteit: draft.prioriteit, lijst: draft.lijst, tags: draft.tags,
      herinneringen_min: draft.herinneringenMin,
      herhaal_interval: draft.herhaal === "aangepast" ? draft.herhaalInterval : 1,
      herhaal_anker_datum: draft.herhaalAnkerDatum || null,
    };
    await fetch("/api/admin/agenda", {
      method: draft.id ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    setSaving(false);
    closeDraft();
    load();
  }

  async function deleteDraft() {
    if (!draft?.id || saving) return;
    setSaving(true);
    await fetch(`/api/admin/agenda?id=${draft.id}`, { method: "DELETE" });
    setSaving(false);
    closeDraft();
    load();
  }

  async function toggleDone(occ: Occurrence) {
    const status = occ.done ? null : "done";
    setMarks((prev) => {
      const rest = prev.filter((m) => !(m.block_id === occ.block.id && m.date === occ.date));
      return status ? [...rest, { block_id: occ.block.id, date: occ.date, status }] : rest;
    });
    await fetch("/api/admin/agenda/mark", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ blockId: occ.block.id, date: occ.date, status }),
    });
  }

  function onBlockPointerDown(e: React.PointerEvent, occ: Occurrence, mode: "move" | "resize") {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      id: occ.block.id, mode, startY: e.clientY, startX: e.clientX,
      origStart: occ.block.start_min, origEnd: occ.block.end_min, origDay: occ.dayIdx,
      moved: false, dayIdx: occ.dayIdx, curStart: occ.block.start_min, curEnd: occ.block.end_min,
    };
  }

  function onTaakPointerDown(e: React.PointerEvent, taak: DagTaak, dayIdx: number) {
    e.preventDefault();
    e.stopPropagation();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    taakDragRef.current = { id: taak.id, startX: e.clientX, startY: e.clientY, origDay: dayIdx, dayIdx, dx: 0, moved: false };
  }

  function onPointerMove(e: React.PointerEvent) {
    const t = taakDragRef.current;
    if (t) {
      const dx = e.clientX - t.startX;
      const dy = e.clientY - t.startY;
      if (!t.moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
      t.moved = true;
      t.dx = dx;
      if (!isMobile && gridRef.current) {
        const colWidth = (gridRef.current.getBoundingClientRect().width - 52) / 7;
        const dDay = Math.round(dx / colWidth);
        t.dayIdx = Math.max(0, Math.min(6, t.origDay + dDay));
      }
      forceRender((n) => n + 1);
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    const dx = e.clientX - d.startX;
    if (!d.moved && Math.abs(dy) < 5 && Math.abs(dx) < 5) return;
    d.moved = true;
    const dMin = snap(dy / PX_PER_MIN);
    if (d.mode === "create") {
      const currentMin = snap(d.origStart + dMin);
      d.curStart = Math.max(DAY_START, Math.min(d.origStart, currentMin));
      d.curEnd = Math.min(DAY_END, Math.max(d.origStart, currentMin));
      if (d.curEnd - d.curStart < SNAP) d.curEnd = d.curStart + SNAP;
      forceRender((n) => n + 1);
      return;
    }
    const block = blocks.find((b) => b.id === d.id);
    if (!block) return;
    const dur = d.origEnd - d.origStart;
    if (d.mode === "move") {
      let ns = d.origStart + dMin;
      ns = Math.max(DAY_START, Math.min(ns, DAY_END - dur));
      d.curStart = ns;
      d.curEnd = ns + dur;
      if (!isMobile && gridRef.current) {
        const colWidth = (gridRef.current.getBoundingClientRect().width - 52) / 7;
        const dDay = Math.round(dx / colWidth);
        d.dayIdx = Math.max(0, Math.min(6, d.origDay + dDay));
      }
    } else {
      let ne = snap(d.origEnd + dMin);
      ne = Math.max(d.origStart + SNAP, Math.min(ne, DAY_END));
      d.curEnd = ne;
    }
    forceRender((n) => n + 1);
  }

  async function onPointerUp(e: React.PointerEvent) {
    const t = taakDragRef.current;
    if (t) {
      taakDragRef.current = null;
      if (!t.moved) { forceRender((n) => n + 1); return; }
      e.preventDefault();
      suppressClickRef.current = true;
      setTimeout(() => { suppressClickRef.current = false; }, 250);
      if (t.dayIdx !== t.origDay) {
        const delta = t.dayIdx - t.origDay;
        const taak = dagTaken.find((x) => x.id === t.id);
        const newDate = shiftDate(taak?.datum ?? dates[t.origDay], delta);
        const newEindDatum = taak?.eind_datum ? shiftDate(taak.eind_datum, delta) : null;
        setDagTaken((prev) => prev.map((x) => (x.id === t.id ? { ...x, datum: newDate, eind_datum: newEindDatum } : x)));
        await fetch("/api/admin/agenda/taken", {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: t.id, datum: newDate, eind_datum: newEindDatum }),
        });
      } else {
        forceRender((n) => n + 1);
      }
      return;
    }
    const d = dragRef.current;
    if (!d) return;
    dragRef.current = null;
    if (d.mode === "create") {
      const startMin = d.moved ? d.curStart : d.origStart;
      const endMin = d.moved ? Math.max(d.curEnd, d.curStart + SNAP) : Math.min(d.origStart + 60, DAY_END);
      const rect = createColRectRef.current;
      openCreate(d.dayIdx, startMin, endMin);
      setPopupAnchor(rect ? { x: rect.right + 10, y: rect.top + (startMin - DAY_START) * PX_PER_MIN } : { x: e.clientX, y: e.clientY });
      forceRender((n) => n + 1);
      return;
    }
    const block = blocks.find((b) => b.id === d.id);
    if (!block) return;
    if (!d.moved) { forceRender((n) => n + 1); return; }
    e.preventDefault();
    suppressClickRef.current = true;
    setTimeout(() => { suppressClickRef.current = false; }, 250);
    if (block.weekdays && block.weekdays.length > 0) {
      const origDate = dates[d.origDay];
      const newDate = dates[d.dayIdx];
      await fetch("/api/admin/agenda", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: block.title, color: block.color, start_min: d.curStart, end_min: d.curEnd,
          date: newDate, weekdays: [], notities: block.notities,
        }),
      });
      await fetch("/api/admin/agenda/mark", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockId: block.id, date: origDate, status: "skipped" }),
      });
      load();
      return;
    }
    const newDate = dates[d.dayIdx];
    setBlocks((prev) => prev.map((b) => (b.id === d.id ? { ...b, start_min: d.curStart, end_min: d.curEnd, date: newDate } : b)));
    await fetch("/api/admin/agenda", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: block.id, title: block.title, color: block.color, start_min: d.curStart, end_min: d.curEnd,
        weekdays: [], date: newDate, eind_datum: block.eind_datum,
      }),
    });
    load();
  }

  function onColumnPointerDown(e: React.PointerEvent, dayIdx: number) {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const startMin = snap(DAY_START + (e.clientY - rect.top) / PX_PER_MIN);
    const clamped = Math.max(DAY_START, Math.min(startMin, DAY_END - SNAP));
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    createColRectRef.current = rect;
    dragRef.current = {
      id: "__create__", mode: "create", startY: e.clientY, startX: e.clientX,
      origStart: clamped, origEnd: 0, origDay: dayIdx, moved: false, dayIdx, curStart: clamped, curEnd: clamped,
    };
  }

  const gridHeight = (DAY_END - DAY_START) * PX_PER_MIN;
  const hours: number[] = [];
  for (let h = DAY_START / 60; h <= DAY_END / 60; h++) hours.push(h);

  const weekLabel = weekStart.toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric" });
  const drag = dragRef.current;
  const dayIdxs = isMobile ? [mobileDay] : [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="ag-wrap">
      <div className="ag-toolbar">
        <div className="ag-weekbar">
          <button className="btn btn-ghost btn-klein" onClick={() => shiftWeek(-1)} aria-label="Vorige week"><PijlLinks /></button>
          <span className="ag-weekbar-label">{weekLabel}</span>
          <button className="btn btn-ghost btn-klein" onClick={() => shiftWeek(1)} aria-label="Volgende week"><PijlRechts /></button>
          <button className="btn btn-ghost btn-klein" onClick={() => { setWeekStart(mondayOf(new Date())); setMobileDay((new Date().getDay() + 6) % 7); }}>
            {isMobile ? "Vandaag" : "Deze week"}
          </button>
        </div>
      </div>

      {isMobile && (
        <div className="ag-day-selector">
          {dates.map((date, i) => (
            <button key={date} className={`ag-day-selector-btn${i === mobileDay ? " active" : ""}${date === todayKey ? " today" : ""}`} onClick={() => setMobileDay(i)}>
              <span className="ag-day-selector-name">{DAY_NAMES[i]}</span>
              <span className="ag-day-selector-num">{Number(date.slice(8))}</span>
            </button>
          ))}
        </div>
      )}

      <div className={`ag-week-grid card${isMobile ? " day-view" : ""}`} ref={gridRef} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
        <div className="ag-week-header">
          <div className="ag-time-gutter" />
          {dayIdxs.map((i) => (
            <div key={dates[i]} className={`ag-day-head${dates[i] === todayKey ? " today" : ""}`}>
              <span className="ag-day-name">{isMobile ? new Date(dates[i]).toLocaleDateString("nl-NL", { weekday: "long" }) : DAY_NAMES[i]}</span>{" "}
              <span className="ag-day-num">{Number(dates[i].slice(8))}</span>
            </div>
          ))}
        </div>
        <div className="ag-week-alldag">
          <div className="ag-time-gutter" />
          {dayIdxs.map((dayIdx) => {
            const isTarget = !!(taakDragRef.current?.moved && taakDragRef.current.dayIdx === dayIdx);
            return (
              <div key={dates[dayIdx]}
                className={`ag-alldag-col${dates[dayIdx] === todayKey ? " today" : ""}${isTarget ? " ag-alldag-col-target" : ""}`}
                onClick={(e) => {
                  if (suppressClickRef.current) return;
                  const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  openNieuweTaak(dates[dayIdx], { x: r.right + 10, y: r.top });
                }}>
                {dagTaken
                  .filter((t) => dates[dayIdx] >= t.datum && dates[dayIdx] <= (t.eind_datum || t.datum))
                  .map((taak) => {
                    const dragging = taakDragRef.current?.id === taak.id && taakDragRef.current.moved;
                    const isStart = dates[dayIdx] === taak.datum;
                    const isEnd = dates[dayIdx] === (taak.eind_datum || taak.datum);
                    const spanClass = isStart && isEnd ? "" : isStart ? " ag-alldag-taak-start" : isEnd ? " ag-alldag-taak-eind" : " ag-alldag-taak-midden";
                    return (
                      <div key={taak.id}
                        className={`ag-alldag-taak${spanClass}${taak.done ? " done" : ""}${dragging ? " dragging" : ""}`}
                        style={{ background: blokKleur(taak.kleur), transform: dragging ? `translateX(${taakDragRef.current!.dx}px)` : undefined }}
                        onPointerDown={(e) => onTaakPointerDown(e, taak, dayIdx)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (suppressClickRef.current) return;
                          const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                          openEditTaak(taak, { x: r.right + 10, y: r.top });
                        }}>
                        {isStart && (
                          <button className="ag-alldag-check" onPointerDown={(e) => e.stopPropagation()}
                            onClick={(e) => { e.stopPropagation(); toggleTaakDone(taak); }}>
                            {taak.done ? "✓" : "○"}
                          </button>
                        )}
                        {isStart && <span className="ag-alldag-taak-titel">{taak.titel}</span>}
                      </div>
                    );
                  })}
              </div>
            );
          })}
        </div>
        <div className="ag-week-body" style={{ height: gridHeight }}>
          <div className="ag-time-gutter">
            {hours.map((h) => (
              <div key={h} className="ag-hour-label" style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }}>{String(h).padStart(2, "0")}:00</div>
            ))}
          </div>
          {dayIdxs.map((dayIdx) => (
            <div key={dates[dayIdx]} className={`ag-day-col${dates[dayIdx] === todayKey ? " today" : ""}`} onPointerDown={(e) => onColumnPointerDown(e, dayIdx)}>
              {hours.slice(1).map((h) => (
                <div key={h} className="ag-hour-line" style={{ top: (h * 60 - DAY_START) * PX_PER_MIN }} />
              ))}
              {occurrences
                .filter((o) => {
                  const isDraggedOcc = drag && drag.id === o.block.id && drag.moved && (!o.block.weekdays || o.dayIdx === drag.origDay);
                  const oDay = isDraggedOcc ? drag!.dayIdx : o.dayIdx;
                  return oDay === dayIdx;
                })
                .map((occ) => {
                  const isDragging = drag && drag.id === occ.block.id && drag.moved && (!occ.block.weekdays || occ.dayIdx === drag.origDay);
                  const s = isDragging ? drag.curStart : occ.block.start_min;
                  const en = isDragging ? drag.curEnd : occ.block.end_min;
                  return (
                    <div key={`${occ.block.id}-${occ.date}`}
                      className={`ag-block${occ.done ? " done" : ""}${isDragging ? " dragging" : ""}`}
                      style={{ top: (s - DAY_START) * PX_PER_MIN + 1.5, height: Math.max((en - s) * PX_PER_MIN - 3, 18), background: blokKleur(occ.block.color) }}
                      onPointerDown={(e) => onBlockPointerDown(e, occ, "move")}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (suppressClickRef.current) return;
                        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                        openEdit(occ.block, occ.date);
                        setPopupAnchor({ x: r.right + 10, y: r.top });
                      }}>
                      <button className="ag-block-check" title={occ.done ? "Afvinken ongedaan maken" : "Afvinken"}
                        onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); toggleDone(occ); }}>
                        {occ.done ? "✓" : "○"}
                      </button>
                      <div className="ag-block-title">{occ.block.notities && <span title="Heeft notities">✎ </span>}{occ.block.title}</div>
                      <div className="ag-block-time">{fmtTime(s)} – {fmtTime(en)}</div>
                      <div className="ag-block-resize" onPointerDown={(e) => onBlockPointerDown(e, occ, "resize")} onClick={(e) => e.stopPropagation()} />
                    </div>
                  );
                })}
              {drag && drag.mode === "create" && drag.moved && drag.dayIdx === dayIdx && (
                <div className="ag-block ag-block-ghost" style={{ top: (drag.curStart - DAY_START) * PX_PER_MIN + 1.5, height: Math.max((drag.curEnd - drag.curStart) * PX_PER_MIN - 3, 18) }}>
                  <div className="ag-block-time">{fmtTime(drag.curStart)} – {fmtTime(drag.curEnd)}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {loading && <p className="ag-note">Laden…</p>}
      <p className="ag-note">
        Sleep in het raster voor een nieuw blok met de gewenste duur (of klik kort voor 60 min),
        sleep een blok om het te verplaatsen, sleep de onderrand om de duur aan te passen en klik
        op een blok om het te bewerken.
      </p>

      {draft && popupAnchor && (
        <AgendaPopup x={popupAnchor.x} y={popupAnchor.y} onClose={closeDraft} onEnter={saveDraft}>
          <div className="ag-modal-head">
            <div className="ag-modal-head-titel">
              <h2>{draft.id ? "Blok bewerken" : "Nieuw blok"}</h2>
              <DatumKnop
                subtiel
                label={fmtBlokBadge(draft, todayKey)}
                datumSlot={
              <>
                <div className="ag-field">
                  <span>Herhalen</span>
                  <div className="ag-weekday-row">
                    {([["geen", "Niet herhalen"], ["dag", "Elke dag"], ["werkdag", "Werkdagen"], ["aangepast", "Eigen dagen"]] as [Herhaal, string][]).map(([key, label]) => (
                      <button key={key} className={`ag-toggle${draft.herhaal === key ? " on" : ""}`} onClick={() => setDraft({ ...draft, herhaal: key })}>{label}</button>
                    ))}
                  </div>
                </div>
                {draft.herhaal === "aangepast" && (
                  <div className="ag-field">
                    <span>Op deze dagen</span>
                    <div className="ag-weekday-row">
                      {DAY_NAMES.map((name, i) => (
                        <button key={name} className={`ag-toggle${draft.weekdays.includes(i + 1) ? " on" : ""}`}
                          onClick={() => setDraft({ ...draft, weekdays: draft.weekdays.includes(i + 1) ? draft.weekdays.filter((w) => w !== i + 1) : [...draft.weekdays, i + 1].sort() })}>
                          {name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {draft.herhaal === "aangepast" && (
                  <label className="ag-field">
                    <span>Elke hoeveel weken</span>
                    <input type="number" min={1} max={12} value={draft.herhaalInterval}
                      onChange={(e) => setDraft({ ...draft, herhaalInterval: Math.max(1, Number(e.target.value) || 1) })} />
                  </label>
                )}
                {draft.herhaal === "geen" ? (
                  <>
                    <div className="ag-field">
                      <span>Snel instellen</span>
                      <div className="ag-weekday-row">
                        <button type="button" className="ag-toggle" onClick={() => setDraft({ ...draft, date: todayKey })}>Vandaag</button>
                        <button type="button" className="ag-toggle" onClick={() => setDraft({ ...draft, date: shiftDate(todayKey, 1) })}>Morgen</button>
                        <button type="button" className="ag-toggle" onClick={() => setDraft({ ...draft, date: shiftDate(todayKey, 7) })}>Volgende week</button>
                      </div>
                    </div>
                    <label className="ag-field">
                      <span>Datum</span>
                      <input type="date" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} />
                    </label>
                  </>
                ) : (
                  <label className="ag-field">
                    <span>Herhaling eindigt op (leeg = oneindig)</span>
                    <input type="date" value={draft.eindDatum} onChange={(e) => setDraft({ ...draft, eindDatum: e.target.value })} />
                  </label>
                )}
              </>
            }
            duurSlot={
              <div className="ag-field-row">
                <label className="ag-field">
                  <span>Van</span>
                  <input type="time" step={900} value={fmtTime(draft.startMin)} onChange={(e) => setDraft({ ...draft, startMin: parseTime(e.target.value) })} />
                </label>
                <label className="ag-field">
                  <span>Tot</span>
                  <input type="time" step={900} value={fmtTime(draft.endMin)} onChange={(e) => setDraft({ ...draft, endMin: parseTime(e.target.value) })} />
                </label>
              </div>
            }
            reminderSlot={
              <div className="ag-weekday-row">
                {HERINNERING_MIN_PRESETS.map(([val, label]) => (
                  <button key={val} type="button" className={`ag-toggle${draft.herinneringenMin.includes(val) ? " on" : ""}`}
                    onClick={() => setDraft({ ...draft, herinneringenMin: draft.herinneringenMin.includes(val) ? draft.herinneringenMin.filter((v) => v !== val) : [...draft.herinneringenMin, val].sort((a, c) => a - c) })}>
                    {label}
                  </button>
                ))}
              </div>
            }
          />
            </div>
            <button className="ag-delete-btn" onClick={closeDraft} aria-label="Sluiten">✕</button>
          </div>
          <label className="ag-field">
            <span>Titel</span>
            <input autoFocus type="text" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder="Bijv. Facturen bijwerken" />
          </label>
          <label className="ag-field">
            <span>Notities</span>
            <textarea rows={4} value={draft.notities} placeholder={"Bijv.\n- **Mail beantwoorden**\n- https://mail.superhuman.com/…"} onChange={(e) => setDraft({ ...draft, notities: e.target.value })} />
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
                <button key={c} className={`ag-color-dot${blokKleur(draft.color) === c ? " selected" : ""}`} style={{ background: c }} onClick={() => setDraft({ ...draft, color: c })} aria-label={c} />
              ))}
            </div>
          </div>
          <div className="ag-field-row">
            <div className="ag-field">
              <span>Prioriteit</span>
              <div className="ag-weekday-row">
                {PRIORITEITEN.map(([val, label]) => (
                  <button key={val} type="button" className={`ag-toggle${draft.prioriteit === val ? " on" : ""}`} onClick={() => setDraft({ ...draft, prioriteit: val })}>{label}</button>
                ))}
              </div>
            </div>
            <label className="ag-field">
              <span>Lijst</span>
              <input type="text" list="ag-lijsten-suggesties" value={draft.lijst} onChange={(e) => setDraft({ ...draft, lijst: e.target.value })} placeholder="Bijv. Privé" />
            </label>
          </div>
          <label className="ag-field">
            <span>Tags (komma&apos;s)</span>
            <input type="text" value={draft.tags.join(", ")} onChange={(e) => setDraft({ ...draft, tags: e.target.value.split(",").map((t) => t.trim()).filter(Boolean) })} placeholder="Bijv. urgent, privé" />
          </label>
          <ChecklistEditor label="Checklist" items={draft.checklist} onChange={(checklist) => setDraft({ ...draft, checklist })} placeholder="+ item toevoegen" />
          <ChecklistEditor label="Subtaken" items={draft.subtaken} onChange={(subtaken) => setDraft({ ...draft, subtaken })} placeholder="+ subtaak toevoegen" />
          <div className="ag-modal-actions">
            {draft.id && <button className="btn btn-danger btn-klein" onClick={deleteDraft} disabled={saving}>Verwijderen</button>}
            <span className="ag-modal-actions-spacer" />
            <button className="btn btn-ghost btn-klein" onClick={closeDraft}>Annuleren</button>
            <button className="btn btn-primary btn-klein" onClick={saveDraft} disabled={saving || !draft.title.trim()}>{saving ? "Opslaan…" : "Opslaan"}</button>
          </div>
        </AgendaPopup>
      )}

      {taakDraft && taakPopupAnchor && (
        <TaakPopup
          draft={taakDraft} setDraft={setTaakDraft} anchor={taakPopupAnchor} todayKey={todayKey}
          lijsten={lijsten} saving={saving} onClose={closeTaakDraft} onSave={saveTaakDraft}
          onDelete={deleteTaakDraft} onDuplicate={duplicateTaakDraft}
          onToggleDone={() => {
            if (!taakDraft.id) return;
            toggleTaakDone({ ...taakDraft, id: taakDraft.id, eind_datum: taakDraft.eindDatum || null, herinneringen_dagen: taakDraft.herinneringenDagen });
            setTaakDraft({ ...taakDraft, done: !taakDraft.done });
          }}
        />
      )}
      <datalist id="ag-lijsten-suggesties">{lijsten.map((l) => <option key={l} value={l} />)}</datalist>
    </div>
  );
}
