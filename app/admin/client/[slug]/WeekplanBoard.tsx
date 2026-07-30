"use client";

import { useEffect, useMemo, useState } from "react";

type Task = { id: number; thread: string; taak: string; toelichting: string; wie: string; url: string; weekYear: number; weekNo: number; status: string; sortOrder: number };
type Current = { year: number; week: number };

const STATUS_NEXT: Record<string, string> = { gepland: "bezig", bezig: "klaar", klaar: "gepland" };
const STATUS_LABEL: Record<string, string> = { gepland: "Gepland", bezig: "Bezig", klaar: "Klaar" };

function shortUrl(url: string): string { try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; } }
const dm = (d: Date) => d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });

// Maandag van een ISO-week (jaar + weeknummer).
function mondayOfISOWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = (jan4.getUTCDay() + 6) % 7;
  const week1Monday = new Date(jan4); week1Monday.setUTCDate(jan4.getUTCDate() - jan4Dow);
  const monday = new Date(week1Monday); monday.setUTCDate(week1Monday.getUTCDate() + (week - 1) * 7);
  return monday;
}
function isoOf(d: Date): Current {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNr = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const fDayNr = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fDayNr + 3);
  const week = 1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return { year: date.getUTCFullYear(), week };
}
const keyOf = (year: number, week: number) => year * 100 + week;

// Het weekplanning-bord: taken (uit de bird's eye-onderwerpen) verdeeld over
// weekkolommen. De huidige week is gemarkeerd. Slepen verplaatst een taak naar
// een andere week. Per taak: status, mailen naar je developer, pagina openen.
export default function WeekplanBoard({ slug, onGoToPage }: { slug: string; onGoToPage?: (url: string) => void }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [current, setCurrent] = useState<Current | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropKey, setDropKey] = useState<number | null>(null);
  const [openCard, setOpenCard] = useState<number | null>(null);

  async function load() {
    try {
      const d = await fetch(`/api/admin/weekplan?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d?.ok) { setTasks(d.tasks || []); setCurrent(d.current || null); }
    } catch { /* stil */ } finally { setLoaded(true); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);

  // Zichtbare weekkolommen: van één week terug (of de vroegste taak) t/m acht
  // weken vooruit (of de laatste taak). Plus een "Ongepland"-kolom (week 0).
  const columns = useMemo(() => {
    if (!current) return [] as { key: number; year: number; week: number; monday: Date; sunday: Date; isCurrent: boolean }[];
    const curMon = mondayOfISOWeek(current.year, current.week);
    let startMon = new Date(curMon);
    let endMon = new Date(curMon); endMon.setUTCDate(curMon.getUTCDate() + 7 * 3);
    for (const t of tasks) {
      if (t.weekNo <= 0) continue;
      const m = mondayOfISOWeek(t.weekYear, t.weekNo);
      if (m.getTime() < startMon.getTime()) startMon = m;
      if (m.getTime() > endMon.getTime()) endMon = m;
    }
    const cols: { key: number; year: number; week: number; monday: Date; sunday: Date; isCurrent: boolean }[] = [];
    const d = new Date(startMon);
    while (d.getTime() <= endMon.getTime()) {
      const iso = isoOf(d);
      const sunday = new Date(d); sunday.setUTCDate(d.getUTCDate() + 6);
      cols.push({ key: keyOf(iso.year, iso.week), year: iso.year, week: iso.week, monday: new Date(d), sunday, isCurrent: iso.year === current.year && iso.week === current.week });
      d.setUTCDate(d.getUTCDate() + 7);
    }
    return cols;
  }, [current, tasks]);

  const unplanned = tasks.filter((t) => t.weekNo <= 0);
  const byKey = (key: number) => tasks.filter((t) => t.weekNo > 0 && keyOf(t.weekYear, t.weekNo) === key);

  async function move(id: number, year: number, week: number) {
    setTasks((ts) => ts.map((t) => t.id === id ? { ...t, weekYear: year, weekNo: week } : t));
    await fetch("/api/admin/weekplan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id, weekYear: year, weekNo: week }) }).catch(() => {});
  }
  async function cycleStatus(t: Task) {
    const status = STATUS_NEXT[t.status] || "gepland";
    setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, status } : x));
    await fetch("/api/admin/weekplan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id: t.id, status }) }).catch(() => {});
  }
  async function remove(id: number) {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    await fetch("/api/admin/weekplan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id, delete: true }) }).catch(() => {});
  }
  function mailDev(t: Task) {
    let to = ""; try { to = localStorage.getItem("pingwin-dev-email") || ""; } catch { /* geen opslag */ }
    const subject = `SEO-taak${t.url ? ` — ${shortUrl(t.url)}` : ""}`;
    const body = `Hoi,\n\nKun je dit oppakken?\n\n${t.taak}${t.url ? `\n\nPagina: ${t.url}` : ""}\n\nDank!`;
    window.location.href = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }

  function card(t: Task) {
    const open = openCard === t.id;
    const hasInfo = !!t.toelichting.trim();
    return (
      <div key={t.id} className={"wp-card wp-" + t.status + (open ? " wp-open" : "")} draggable onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setDropKey(null); }}>
        <div className={"wp-card-taak" + (hasInfo ? " wp-clickable" : "")} onClick={() => hasInfo && setOpenCard(open ? null : t.id)} title={hasInfo ? "Klik voor de volledige info" : undefined}>
          {hasInfo && <span className="wp-caret">{open ? "▾" : "▸"}</span>}
          {t.taak}
        </div>
        {open && hasInfo && <div className="wp-card-info">{t.toelichting}</div>}
        {t.url && <a className="wp-card-url" href={t.url} target="_blank" rel="noreferrer">{shortUrl(t.url)}</a>}
        <div className="wp-card-foot">
          <span className={"wp-wie " + (t.wie === "Dev" ? "wie-dev" : "wie-seo")}>{t.wie}</span>
          <button type="button" className={"wp-status wp-status-" + t.status} onClick={() => cycleStatus(t)} title="Klik om de status te wisselen">{STATUS_LABEL[t.status] || t.status}</button>
          <span className="wp-card-actions">
            <button type="button" className="wp-icon" title="Mail naar je developer" onClick={() => mailDev(t)}>✉</button>
            {t.url && onGoToPage && <button type="button" className="wp-icon" title="Open in Pagina's (hier voer je het werk uit)" onClick={() => onGoToPage(t.url)}>↗</button>}
            <button type="button" className="wp-icon wp-del" title="Verwijderen" onClick={() => remove(t.id)}>×</button>
          </span>
        </div>
      </div>
    );
  }

  if (loaded && tasks.length === 0) {
    return (
      <div className="cockpit-card wp-empty">
        <div className="ck-section-head"><span>Weekplanning</span></div>
        <div className="muted ov-hint">Nog geen taken. Vraag de bird&rsquo;s eye in een onderwerp: &ldquo;maak hier taken van&rdquo;, keur ze goed, en ze verschijnen hier per week.</div>
      </div>
    );
  }

  return (
    <div className="cockpit-card wp-wrap">
      <div className="ck-section-head"><span>Weekplanning</span></div>
      <div className="muted ov-hint">Taken uit de onderwerpen, verdeeld over de weken. Sleep een taak naar een andere week.</div>
      <div className="wp-board">
        {unplanned.length > 0 && (
          <div className={"wp-col wp-col-unplanned" + (dropKey === 0 ? " wp-drop" : "")}
            onDragOver={(e) => { e.preventDefault(); if (dragId != null) setDropKey(0); }}
            onDrop={() => { if (dragId != null) move(dragId, 0, 0); setDropKey(null); }}>
            <div className="wp-col-head"><span className="wp-col-wk">Ongepland</span></div>
            <div className="wp-col-body">{unplanned.map(card)}</div>
          </div>
        )}
        {columns.map((c) => (
          <div key={c.key} className={"wp-col" + (c.isCurrent ? " wp-current" : "") + (dropKey === c.key ? " wp-drop" : "")}
            onDragOver={(e) => { e.preventDefault(); if (dragId != null) setDropKey(c.key); }}
            onDrop={() => { if (dragId != null) move(dragId, c.year, c.week); setDropKey(null); }}>
            <div className="wp-col-head">
              <span className="wp-col-wk">wk {c.week}{c.isCurrent ? " · nu" : ""}</span>
              <span className="wp-col-dates">{dm(c.monday)} – {dm(c.sunday)}</span>
            </div>
            <div className="wp-col-body">{byKey(c.key).map(card)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
