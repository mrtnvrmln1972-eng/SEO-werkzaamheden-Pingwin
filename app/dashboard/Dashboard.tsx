"use client";

import { useEffect, useMemo, useState } from "react";
import type { ClientBudget } from "../../lib/clients";
import {
  parseCSV,
  structureData,
  sheetCsvUrl,
  capitalize,
  type DashboardData,
} from "../../lib/sheet";

type Props = {
  name: string;
  sheetId: string;
  gid: string;
  budget: ClientBudget;
  adminPreview?: boolean;
};

function formatTime(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}u ${m}m` : `${h}u`;
  }
  return `${minutes}m`;
}

export default function Dashboard({ name, sheetId, gid, budget, adminPreview }: Props) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(sheetCsvUrl(sheetId, gid));
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const structured = structureData(parseCSV(text), budget);
        if (cancelled) return;
        if (!structured || structured.tasks.length === 0) {
          setError("geen-data");
          setLoading(false);
          return;
        }
        setData(structured);
        setCurrentMonth((prev) =>
          prev && structured.months.includes(prev)
            ? prev
            : structured.months[structured.months.length - 1] || "",
        );
        setUpdatedAt(
          new Date().toLocaleDateString("nl-NL", {
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
        setError("");
        setLoading(false);
      } catch (err) {
        if (cancelled) return;
        setError((err as Error).message || "laadfout");
        setLoading(false);
      }
    }

    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId, gid]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login";
  }

  const view = useMemo(() => {
    if (!data || !currentMonth) return null;
    const b = data.budget;
    const monthTasks = data.tasks.filter((t) => t.maand === currentMonth);

    const doneTasks = monthTasks.filter((t) => t.status.toLowerCase() === "klaar");
    const bezigTasks = monthTasks.filter((t) => t.status.toLowerCase() === "bezig");
    const geplandTasks = monthTasks.filter((t) => t.status.toLowerCase() === "gepland");

    const totalTasks = monthTasks.length;
    const doneCount = doneTasks.length;
    const bezigCount = bezigTasks.length;
    const geplandCount = geplandTasks.length;

    const doneMinutes = doneTasks.reduce((s, t) => s + (t.standaardTijd || 0), 0);
    const bezigMinutes = bezigTasks.reduce((s, t) => s + (t.standaardTijd || 0), 0);
    const totalHours = (doneMinutes + bezigMinutes) / 60;
    const urenInGeld = totalHours * b.uurtarief;

    const totaalBesteed = urenInGeld + b.linkbuilding;
    const isOverBudget = totaalBesteed > b.maandbudget;

    const alleMinuten = monthTasks.reduce((s, t) => s + (t.standaardTijd || 0), 0);
    const alleUren = alleMinuten / 60;
    const totaalGepland = alleUren * b.uurtarief + b.linkbuilding;
    const isGeplandOverBudget = totaalGepland > b.maandbudget;

    const pct = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

    return {
      b, monthTasks, totalTasks, doneCount, bezigCount, geplandCount,
      totalHours, urenInGeld, totaalBesteed, isOverBudget,
      alleUren, totaalGepland, isGeplandOverBudget, pct,
    };
  }, [data, currentMonth]);

  return (
    <>
      <div className="header">
        <div className="header-left">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="https://pingwin.nl/wp-content/uploads/2016/11/pingwin_logo.png" alt="Pingwin" />
          <div className="header-divider" />
          <div>
            <div className="header-title">Pingwin SEO Dashboard</div>
            <div className="header-client">{name}</div>
          </div>
        </div>
        <div className="header-right">
          <span className="header-updated">
            {updatedAt ? `Laatste update: ${updatedAt}` : "Laden..."}
          </span>
          {adminPreview ? (
            <a className="logout-btn" href="/admin">&larr; Terug naar beheer</a>
          ) : (
            <button className="logout-btn" onClick={logout}>Uitloggen</button>
          )}
        </div>
      </div>

      <div className="container">
        {loading && (
          <div className="loading">
            <div className="spinner" />
            <p>Dashboard wordt geladen...</p>
          </div>
        )}

        {!loading && error === "geen-data" && (
          <div className="error-msg">
            <strong>Geen data gevonden.</strong>
            <br />
            Controleer of het tabblad gepubliceerd is naar het web (Bestand &rarr; Delen &rarr;
            Publiceren naar web).
          </div>
        )}

        {!loading && error && error !== "geen-data" && (
          <div className="error-msg">
            <strong>Kon de Google Sheet niet laden.</strong>
            <br />
            {error}
            <br />
            <br />
            Mogelijk is het tabblad nog niet gepubliceerd naar het web (Bestand &rarr; Delen &rarr;
            Publiceren naar web).
          </div>
        )}

        {!loading && !error && data && view && (
          <>
            <div className="month-nav">
              {data.months.map((m) => (
                <button
                  key={m}
                  className={"month-btn" + (m === currentMonth ? " active" : "")}
                  onClick={() => setCurrentMonth(m)}
                >
                  {capitalize(m)}
                </button>
              ))}
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{view.doneCount}/{view.totalTasks}</div>
                <div className="stat-label">Taken afgerond</div>
                <div className="stat-sub">
                  {view.bezigCount > 0 ? `${view.bezigCount} bezig, ` : ""}
                  {view.geplandCount} gepland
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{view.totalHours.toFixed(1)}u</div>
                <div className="stat-label">Uren besteed</div>
                <div className="stat-sub">
                  &euro;{view.urenInGeld.toFixed(0)} ({view.b.beschikbareUren > 0 ? view.b.beschikbareUren : 12}u beschikbaar)
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-value">&euro;{view.b.linkbuilding.toFixed(0)}</div>
                <div className="stat-label">Linkbuilding</div>
                <div className="stat-sub">Maandelijks budget</div>
              </div>
              <div className={"stat-card" + (view.isOverBudget ? " over-budget" : "")}>
                <div className="stat-value">&euro;{view.totaalBesteed.toFixed(0)}</div>
                <div className="stat-label">Totaal besteed</div>
                <div className="stat-sub">
                  {view.isOverBudget ? "Over budget!" : "Binnen budget"} (max &euro;{view.b.maandbudget.toFixed(0)})
                </div>
              </div>
              <div className={"stat-card" + (view.isGeplandOverBudget ? " over-budget" : "")}>
                <div className="stat-value">&euro;{view.totaalGepland.toFixed(0)}</div>
                <div className="stat-label">Totaal gepland</div>
                <div className="stat-sub">
                  {view.isGeplandOverBudget ? "Over budget!" : "Binnen budget"} ({view.alleUren.toFixed(1)}u &middot; max &euro;{view.b.maandbudget.toFixed(0)})
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-value">&euro;{view.b.maandbudget.toFixed(0)}</div>
                <div className="stat-label">Maandfee</div>
                <div className="stat-sub">Incl. linkbuilding &euro;{view.b.linkbuilding.toFixed(0)}</div>
              </div>
            </div>

            <div className="progress-wrap">
              <div className="progress-header">
                <span className="progress-title">Voortgang taken deze maand</span>
                <span className="progress-pct">{view.pct}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${view.pct}%` }} />
              </div>
            </div>

            <div className="section-title">Werkzaamheden deze maand</div>
            <div className="task-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Taak</th>
                    <th>Toelichting</th>
                    <th>Bestede tijd</th>
                    <th>Status</th>
                    <th>Document</th>
                  </tr>
                </thead>
                <tbody>
                  {view.monthTasks.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", padding: 40, color: "var(--gray)" }}>
                        Geen werkzaamheden gevonden voor deze maand.
                      </td>
                    </tr>
                  )}
                  {renderRows(view.monthTasks)}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div className="footer">
        Pingwin Online Marketing &middot;{" "}
        <a href="https://pingwin.nl" target="_blank" rel="noreferrer">pingwin.nl</a>{" "}
        &middot; info@pingwin.nl
      </div>
    </>
  );
}

function renderRows(monthTasks: DashboardData["tasks"]) {
  const rows: React.ReactNode[] = [];
  let lastCat = "";
  monthTasks.forEach((task, i) => {
    if (task.categorie && task.categorie !== lastCat) {
      lastCat = task.categorie;
      rows.push(
        <tr className="cat-row" key={`cat-${i}`}>
          <td colSpan={5}>{task.categorie}</td>
        </tr>,
      );
    }

    const minutes = task.standaardTijd || 0;
    const statusLower = task.status.toLowerCase();
    const badgeClass =
      statusLower === "klaar" ? "klaar" : statusLower === "bezig" ? "bezig" : "gepland";
    const badgeLabel =
      statusLower === "klaar" ? "Klaar" : statusLower === "bezig" ? "Bezig" : "Gepland";

    const isUrl = task.link && /^https?:\/\//i.test(task.link.trim());

    rows.push(
      <tr key={`task-${i}`}>
        <td><strong>{task.taak}</strong></td>
        <td><span className="task-desc">{task.toelichting}</span></td>
        <td>{minutes > 0 ? formatTime(minutes) : <span className="muted">&mdash;</span>}</td>
        <td><span className={`badge-done ${badgeClass}`}>{badgeLabel}</span></td>
        <td>
          {isUrl ? (
            <a href={task.link.trim()} target="_blank" rel="noreferrer" className="doc-link">
              Bekijk &rarr;
            </a>
          ) : (
            <span className="muted">&mdash;</span>
          )}
        </td>
      </tr>,
    );
  });
  return rows;
}
