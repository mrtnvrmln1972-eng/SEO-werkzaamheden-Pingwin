"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { ClientBudget } from "../../lib/clients";
import {
  parseCSV,
  structureData,
  sheetCsvUrl,
  capitalize,
  type DashboardData,
} from "../../lib/sheet";
import LinkPreview from "../admin/client/[slug]/LinkPreview";
import { Paneel, Blok, Tekst, Signalen, Chip } from "../_ui/Uitkomst";
import type { OntwikkelingDezeMaand } from "../../lib/ontwikkeling";
import { PijlLinks } from "../_ui/Pijl";

// "?"-uitleg bij een taak: klik opent een nette gecentreerde popup (zelfde
// opmaak als de uitleg-popups in de cockpit), sluiten via kruisje/buiten/Escape.
function TaskHelp({ html }: { html: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  return (
    <span className="task-help-wrap">
      <span className="task-help has" tabIndex={0} role="button" aria-label="Toelichting" title="Klik voor toelichting"
        onClick={(e) => { e.stopPropagation(); setOpen(true); }}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}>?</span>
      {open && typeof document !== "undefined" && createPortal(
        <div className="hh-overlay" onClick={(e) => { e.stopPropagation(); setOpen(false); }} role="dialog" aria-modal="true">
          <div className="hh-modal" style={{ maxWidth: 520 }} onClick={(e) => e.stopPropagation()}>
            <div className="hh-modal-top">
              <span className="hh-label"><span className="hh-label-dot">?</span> Toelichting</span>
              <button type="button" className="hh-modal-close" aria-label="Sluiten" onClick={() => setOpen(false)}>&times;</button>
            </div>
            <div className="hh-modal-body md" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>,
        document.body,
      )}
    </span>
  );
}



type Props = {
  name: string;
  sheetId: string;
  gid: string;
  budget: ClientBudget;
  adminPreview?: boolean;
  initialData?: DashboardData | null;
  // R9: het blok "Ontwikkeling deze maand". slug/toonOntwikkeling zijn alleen
  // nodig zodat de voorbeeldweergave het blok kan aan/uitzetten voor de klant.
  slug?: string;
  ontwikkeling?: OntwikkelingDezeMaand | null;
  toonOntwikkeling?: boolean;
};

// Eén regel over hoe lang geleden een wijziging is doorgevoerd, in klanttaal.
function geledenTekst(iso: string): string {
  const dagen = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  if (dagen <= 0) return "vandaag";
  if (dagen === 1) return "gisteren";
  if (dagen < 14) return `${dagen} dagen geleden`;
  const weken = Math.round(dagen / 7);
  return `${weken} weken geleden`;
}

// Het narratieve blok "Ontwikkeling deze maand" (R9): hoe staat de klant er nu
// voor, wat veranderde er, en wat leverde dat op. In de voorbeeldweergave altijd
// zichtbaar (met de aan/uit-knop erbij); op het echte klantdashboard alleen als
// Maarten hem heeft aangezet.
function OntwikkelingBlok({ data, adminPreview, slug, toonOntwikkeling }: {
  data: OntwikkelingDezeMaand; adminPreview?: boolean; slug?: string; toonOntwikkeling?: boolean;
}) {
  const [aan, setAan] = useState(!!toonOntwikkeling);
  const [busy, setBusy] = useState(false);

  if (!adminPreview && !toonOntwikkeling) return null;

  async function zetAan(nieuw: boolean) {
    if (!slug || busy) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/clients", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action: "toonOntwikkeling", aan: nieuw }),
      });
      if ((await res.json()).ok) setAan(nieuw);
    } catch { /* de knop blijft dan gewoon op de oude stand staan */ }
    setBusy(false);
  }

  return (
    <Paneel
      titel="Ontwikkeling deze maand"
      knoppen={adminPreview ? (
        <button
          type="button"
          className={"btn btn-klein " + (aan ? "btn-primary" : "btn-ghost")}
          disabled={busy}
          onClick={() => zetAan(!aan)}
        >
          {aan ? "Zichtbaar voor de klant – zet uit" : "Verborgen voor de klant – zet aan"}
        </button>
      ) : undefined}
    >
      {adminPreview && !aan && (
        <Tekst klein>
          Dit blok staat nu nog uit. Alleen jij ziet het hier in de voorbeeldweergave; de klant ziet
          het pas zodra je hem aanzet.
        </Tekst>
      )}
      <Blok titel={data.kop} meta={data.isGoed ? <Chip toon="goed">Mooie ontwikkeling</Chip> : undefined}>
        <Signalen regels={data.regels} soort="notitie" />
      </Blok>
      {data.laatsteWijzigingen.length > 0 && (
        <Blok titel="Wat er is aangepast">
          <Signalen
            soort="goed"
            regels={data.laatsteWijzigingen.map(
              (w) => `${w.url} – ${w.samenvatting} (${geledenTekst(w.datum)})`,
            )}
          />
        </Blok>
      )}
    </Paneel>
  );
}

// Laat opmaak/links staan, verwijdert scripts, handlers en inline font/kleur-stijlen
// zodat het klant-dashboard altijd dezelfde typografie toont als de rest van de pagina.
function safeHtml(html: string): string {
  return (html || "")
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\son\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/\s*(?:color|font-size|font-family|background(?:-color)?)\s*:[^;"]+;?/gi, "")
    .replace(/\s*style=""\s*/gi, " ");
}

// Titel voor het klantdashboard: link naar de KLANTVERSIE (begrijpelijk document),
// niet naar de technische versie. De technische doc-link uit de taaktitel wordt
// eruit gehaald; is er een klantversie, dan wordt de titel daarnaar gelinkt.
function clientTaskTitle(task: { taak: string; clientDocLink?: string }): string {
  // Toon de klant alleen de titel, gelinkt aan de klantversie. Verwijder eerst de
  // "(intern)"/"(klantversie)"-linkjes (die zijn voor onze eigen backend), en strip
  // dan alle tags zodat de kale titel overblijft (werkt voor beide opmaakvormen:
  // "Titel (intern) (klantversie)" en de enkel-gelinkte "Strategie: /pad/").
  const stripped = task.taak.replace(/\s*\(\s*<a\b[^>]*>[\s\S]*?<\/a>\s*\)/gi, "");
  const title = safeHtml(stripped).replace(/<[^>]+>/g, "").trim();
  // Klantversie-link: uit het veld, of (voor oudere taken waar dat veld leegliep)
  // terugvallen op de "(klantversie)"-link die nog in de taaktitel zit.
  let link = task.clientDocLink || "";
  if (!link) {
    const kv = task.taak.match(/<a\b[^>]*href=["']([^"']+)["'][^>]*>\s*klantversie\s*<\/a>/i);
    if (kv) {
      link = kv[1];
    } else if (!/\(\s*<a\b[^>]*>\s*intern\s*<\/a>\s*\)/i.test(task.taak)) {
      // Geen dual-versie (geen "(intern)"-link), dus de titel is één klant-geschikt
      // document (bijv. "Strategie: /pad/"): gebruik die enkele link.
      const single = task.taak.match(/<a\b[^>]*href=["']([^"']+)["']/i);
      if (single) link = single[1];
    }
  }
  // Zelfde weergave als in de cockpit: de kale titel, met daarachter "(link)" naar de
  // klantversie, i.p.v. de titel zelf als link.
  if (link) return `${title} (<a href="${link}" target="_blank" rel="noreferrer">link</a>)`;
  return title;
}

function formatTime(minutes: number): string {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}u ${m}m` : `${h}u`;
  }
  return `${minutes}m`;
}

export default function Dashboard({ name, sheetId, gid, budget, adminPreview, initialData, slug, ontwikkeling, toonOntwikkeling }: Props) {
  const [data, setData] = useState<DashboardData | null>(initialData ?? null);
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState<string>("");
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    // Nieuwe bron: taken komen rechtstreeks uit het dashboard (database).
    // Dan geen Google Sheet ophalen.
    if (initialData) {
      setData(initialData);
      setCurrentMonth((prev) =>
        prev && initialData.months.includes(prev)
          ? prev
          : initialData.months[initialData.months.length - 1] || "",
      );
      setUpdatedAt(new Date().toLocaleDateString("nl-NL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }));
      setError(initialData.tasks.length === 0 ? "geen-data" : "");
      setLoading(false);
      return () => { cancelled = true; };
    }

    async function load() {
      // Klanten zonder Google Sheet (taken-werkwijze): niets op te halen. Toon
      // een nette melding in plaats van een laadfout of Sheet-instructies.
      if (!sheetId) {
        setError("geen-taken");
        setLoading(false);
        return;
      }
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
            <a className="logout-btn" href="/admin"><PijlLinks /> Terug naar beheer</a>
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

        {!loading && error === "geen-taken" && (
          <div className="error-msg">
            <strong>Nog geen werkzaamheden ingevuld.</strong>
            <br />
            Zodra de eerste werkzaamheden zijn vastgelegd, verschijnen ze hier vanzelf.
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

        {!loading && error && error !== "geen-data" && error !== "geen-taken" && (
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

            {ontwikkeling && (
              <OntwikkelingBlok
                data={ontwikkeling}
                adminPreview={adminPreview}
                slug={slug}
                toonOntwikkeling={toonOntwikkeling}
              />
            )}

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
            <div className="dashboard-tasks">
            <div className="task-table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Taak</th>
                    <th className="cell-time">Uren</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {view.monthTasks.length === 0 && (
                    <tr>
                      <td colSpan={3} style={{ textAlign: "center", padding: "var(--s-10)", color: "var(--gray)" }}>
                        Geen werkzaamheden gevonden voor deze maand.
                      </td>
                    </tr>
                  )}
                  {renderRows(view.monthTasks)}
                </tbody>
                {view.monthTasks.length > 0 && (
                  <tfoot>
                    <tr className="task-total-row">
                      <td>Totaal</td>
                      <td className="cell-time">{formatTime(view.monthTasks.reduce((s, t) => s + (t.standaardTijd || 0), 0))}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            </div>
          </>
        )}
      </div>

      <div className="footer">
        Pingwin Online Marketing &middot;{" "}
        <a href="https://pingwin.nl" target="_blank" rel="noreferrer">pingwin.nl</a>{" "}
        &middot; info@pingwin.nl
      </div>

      <LinkPreview />
    </>
  );
}

function renderRows(monthTasks: DashboardData["tasks"]) {
  const rows: React.ReactNode[] = [];
  let lastCat = "";
  // Taken blijven in de vastgestelde volgorde staan, ongeacht of ze klaar zijn.
  const isDone = (s: string) => /klaar|afgerond|gereed|done|voltooid/i.test(s || "");
  monthTasks.forEach((task, i) => {
    if (task.categorie && task.categorie !== lastCat) {
      lastCat = task.categorie;
      rows.push(
        <tr className="cat-row" key={`cat-${i}`}>
          <td colSpan={3}>{task.categorie}</td>
        </tr>,
      );
    }

    const minutes = task.standaardTijd || 0;
    const statusLower = task.status.toLowerCase();
    const done = isDone(statusLower);
    const badgeClass =
      statusLower === "klaar" ? "klaar" : statusLower === "bezig" ? "bezig" : "gepland";
    const badgeLabel =
      statusLower === "klaar" ? "Klaar" : statusLower === "bezig" ? "Bezig" : "Gepland";

    const uitleg = (task.klantToelichting || "").trim();
    const hasUitleg = uitleg.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim().length > 0;
    rows.push(
      <tr key={`task-${i}`} className={done ? "row-done" : "row-open"}>
        <td>
          <span className="task-name">
            <span className="task-name-text" dangerouslySetInnerHTML={{ __html: clientTaskTitle(task) }} />
            {/* clientTaskTitle ontsnapt eerst via safeHtml en bouwt daarna zelf de link. */}
            {done && <span className="task-check-dash" title="Klaar">✓</span>}
            {hasUitleg && <TaskHelp html={safeHtml(uitleg)} />}
          </span>
        </td>
        <td className="cell-time">{minutes > 0 ? formatTime(minutes) : <span className="muted">&mdash;</span>}</td>
        <td><span className={`badge-done ${badgeClass}`}>{badgeLabel}</span></td>
      </tr>,
    );
  });
  return rows;
}
