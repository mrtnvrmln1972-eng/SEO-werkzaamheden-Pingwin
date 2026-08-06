"use client";

import { useEffect, useMemo, useState } from "react";
import { urlKey } from "../../../../lib/url-key";
import WeekplanCard, { type WpTask, type WpPageInfo } from "./WeekplanCard";
import MailUitKaart from "./MailUitKaart";
import { useMailDatumLinks } from "./useMailDatumLinks";
import { nieuweVolgorde, bewaarVolgorde } from "../../../../lib/weekplan-slepen";

type Current = { year: number; week: number };

const STATUS_NEXT: Record<string, string> = { gepland: "bezig", bezig: "klaar", klaar: "gepland" };

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

// Het weekplanning-bord: projectkaarten (één per pagina) verdeeld over weekkolommen.
// De huidige week is gemarkeerd. Slepen verplaatst een kaart naar een andere week.
// In de open kaart: de 7 fases (starten, status, afvinken), chat en mailen.
export default function WeekplanBoard({ slug, onGoToPage, onGoToTab, onOpenMailDate, clientName, clientEmail, reloadSignal, kaal }: { slug: string; kaal?: boolean; onGoToPage?: (url: string) => void; onGoToTab?: (tab: string) => void; onOpenMailDate?: (datum: string) => void; clientName?: string; clientEmail?: string; reloadSignal?: number }) {
  const mailDatumLinks = useMailDatumLinks(slug);
  const [tasks, setTasks] = useState<WpTask[]>([]);
  const [pages, setPages] = useState<Record<string, WpPageInfo>>({});
  const [current, setCurrent] = useState<Current | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [dropKey, setDropKey] = useState<number | null>(null);
  // Boven welke kaart komt de gesleepte kaart terecht (herordenen binnen een week).
  const [dropVoor, setDropVoor] = useState<number | null>(null);
  // Zelf een taak toevoegen: in welke weekkolom staat het formuliertje open.
  const [nieuwVoor, setNieuwVoor] = useState<number | null>(null);
  const [nieuwTaak, setNieuwTaak] = useState("");
  const [nieuwUrl, setNieuwUrl] = useState("");
  const [nieuwWie, setNieuwWie] = useState("SEO");
  const [nieuwBezig, setNieuwBezig] = useState(false);
  const [nieuwFout, setNieuwFout] = useState("");
  // De pagina's van deze klant, om uit te kiezen bij een nieuwe taak. Zonder pagina
  // werkt een kaart ook, maar mét pagina krijgt hij de fases, het dossier en de mail
  // erbij; dat is het verschil tussen een geheugensteuntje en een werkende kaart.
  const [paginas, setPaginas] = useState<string[]>([]);
  useEffect(() => {
    let leeft = true;
    fetch(`/api/admin/urls?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (leeft && d?.ok) setPaginas(((d.urls || []) as { url: string }[]).map((u) => u.url).filter(Boolean)); })
      .catch(() => {});
    return () => { leeft = false; };
  }, [slug]);

  async function maakTaak(c: { year: number; week: number; monday: Date }) {
    const taak = nieuwTaak.trim();
    if (!taak || nieuwBezig) return;
    setNieuwBezig(true); setNieuwFout("");
    try {
      // De server rekent in "over hoeveel weken", dus dat leiden we af uit de
      // maandag van deze kolom ten opzichte van die van de huidige week.
      const nuMaandag = current ? mondayOfISOWeek(current.year, current.week) : c.monday;
      const seq = Math.max(1, Math.round((c.monday.getTime() - nuMaandag.getTime()) / (7 * 24 * 3600 * 1000)) + 1);
      const d = await fetch("/api/admin/weekplan/add", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, taak, url: nieuwUrl.trim() || undefined, wie: nieuwWie, week: seq }),
      }).then((r) => r.json());
      if (d?.ok) {
        setNieuwTaak(""); setNieuwUrl(""); setNieuwVoor(null);
        await load();
      } else setNieuwFout(d?.error || "Toevoegen lukte niet.");
    } catch { setNieuwFout("Toevoegen lukte niet."); }
    finally { setNieuwBezig(false); }
  }
  const [openCard, setOpenCard] = useState<number | null>(null);
  // "Mail vanuit de kaart": de AI schrijft een concept uit de kaart-achtergrond;
  // jij kiest de ontvanger, stuurt eventueel een instructie mee en verstuurt zelf.
  // Het venster zelf staat in MailUitKaart, zodat de planning exact hetzelfde
  // venster krijgt bij dezelfde kaart.
  const [mailFor, setMailFor] = useState<{ t: WpTask; aud: "klant" | "dev" } | null>(null);
  // Werklijst sitebouwer: site-brede meta's + alt-teksten als één document + één Dev-kaart.
  const [wlBusy, setWlBusy] = useState(false);
  const [wlMsg, setWlMsg] = useState("");
  const [wlLink, setWlLink] = useState("");
  const [wlFout, setWlFout] = useState(false);
  // Alle kaarten in één keer laten opruimen (dubbelingen uit oude samenvoegingen).
  const [opruimBusy, setOpruimBusy] = useState(false);
  const [opruimMsg, setOpruimMsg] = useState("");
  const [opruimFout, setOpruimFout] = useState(false);

  // Laatste werklijst-stand tonen (link naar het document als die er is).
  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/dev-worklist?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).then((d) => {
      if (!alive || !d?.ok) return;
      if (d.status === "running") { setWlBusy(true); setWlMsg(""); void volgWerklijst(); }
      else if (d.status === "done" && d.docLink) { setWlLink(d.docLink); setWlMsg("Open de werklijst"); }
    }).catch(() => {});
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  async function volgWerklijst() {
    for (let i = 0; i < 70; i++) {
      await new Promise((r) => setTimeout(r, 5000));
      const d = await fetch(`/api/admin/dev-worklist?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
      if (!d?.ok || d.status === "running") continue;
      setWlBusy(false);
      if (d.status === "done") { setWlFout(false); setWlLink(d.docLink || ""); setWlMsg(d.docLink ? "Open de werklijst" : (d.result || "Werklijst klaar.")); void load(); }
      else { setWlFout(true); setWlLink(""); setWlMsg(d.error || "Werklijst maken mislukt."); }
      return;
    }
    setWlBusy(false); setWlFout(true); setWlMsg("Duurde te lang; probeer het nog een keer.");
  }

  async function ruimAllesOp() {
    if (opruimBusy) return;
    setOpruimBusy(true); setOpruimMsg(""); setOpruimFout(false);
    try {
      const d = await fetch("/api/admin/weekplan/tidy", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, all: true }),
      }).then((r) => r.json());
      setOpruimFout(!d?.ok);
      setOpruimMsg(d?.ok ? d.samenvatting : (d?.error || "Opruimen mislukte."));
      if (d?.ok) await load();
    } catch {
      setOpruimFout(true); setOpruimMsg("Opruimen mislukte.");
    } finally { setOpruimBusy(false); }
  }

  async function startWerklijst() {
    if (wlBusy) return;
    setWlBusy(true); setWlMsg(""); setWlLink(""); setWlFout(false);
    fetch("/api/admin/dev-worklist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }).catch(() => {});
    void volgWerklijst();
  }

  async function load() {
    try {
      const d = await fetch(`/api/admin/weekplan?slug=${encodeURIComponent(slug)}`).then((r) => r.json());
      if (d?.ok) { setTasks(d.tasks || []); setCurrent(d.current || null); setPages(d.pages || {}); }
    } catch { /* stil */ } finally { setLoaded(true); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug, reloadSignal]);

  // Zichtbare weekkolommen: vanaf de huidige week (of eerder, als daar nog taken
  // staan) tot en met de laatste week met taken, plus precies één lege week om
  // naartoe te slepen. Er stonden hier standaard drie lege weken achteraan; dat
  // maakte het bord onnodig breed. Eén vooruit is genoeg, de rest gaat weg.
  const columns = useMemo(() => {
    if (!current) return [] as { key: number; year: number; week: number; monday: Date; sunday: Date; isCurrent: boolean }[];
    const curMon = mondayOfISOWeek(current.year, current.week);
    let startMon = new Date(curMon);
    let laatsteMetTaak = new Date(curMon);
    for (const t of tasks) {
      if (t.weekNo <= 0) continue;
      const m = mondayOfISOWeek(t.weekYear, t.weekNo);
      if (m.getTime() < startMon.getTime()) startMon = m;
      if (m.getTime() > laatsteMetTaak.getTime()) laatsteMetTaak = m;
    }
    const endMon = new Date(laatsteMetTaak);
    endMon.setUTCDate(laatsteMetTaak.getUTCDate() + 7);  // de ene lege week vooruit
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
  // Op volgorde, want die kun je nu zelf slepen. Zonder deze sortering kreeg je de
  // volgorde van de database terug en sprong een versleepte kaart weer terug.
  const byKey = (key: number) => tasks
    .filter((t) => t.weekNo > 0 && keyOf(t.weekYear, t.weekNo) === key)
    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.id - b.id);

  async function move(id: number, year: number, week: number) {
    setTasks((ts) => ts.map((t) => t.id === id ? { ...t, weekYear: year, weekNo: week } : t));
    await fetch("/api/admin/weekplan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id, weekYear: year, weekNo: week }) }).catch(() => {});
  }

  // Kaarten binnen een week op volgorde zetten. Je kon een kaart alleen naar een
  // andere week slepen; binnen de week lag de volgorde vast, terwijl juist daar
  // staat wat je maandag als eerste oppakt. Je sleept nu op een kaart en hij komt
  // daarvóór; laat je onderaan de kolom los, dan gaat hij achteraan.
  // De som zelf staat in lib/weekplan-slepen.ts, want het weekbord sleept met
  // dezelfde kaarten en moet exact hetzelfde uitrekenen.
  async function moveVoor(id: number, doelId: number | null, year: number, week: number) {
    const genummerd = nieuweVolgorde(tasks, id, doelId, year, week);
    if (genummerd.length === 0) return;
    const perId = new Map(genummerd.map((t) => [t.id, t]));
    setTasks((ts) => ts.map((t) => perId.get(t.id) || t));
    await bewaarVolgorde(slug, year, week, genummerd);
  }
  async function cycleStatus(t: WpTask) {
    const status = STATUS_NEXT[t.status] || "gepland";
    setTasks((ts) => ts.map((x) => x.id === t.id ? { ...x, status } : x));
    await fetch("/api/admin/weekplan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id: t.id, status }) }).catch(() => {});
  }
  async function remove(id: number) {
    setTasks((ts) => ts.filter((t) => t.id !== id));
    await fetch("/api/admin/weekplan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, id, delete: true }) }).catch(() => {});
  }

  if (loaded && tasks.length === 0) {
    return (
      <div className="cockpit-card wp-empty">
        <div className="ck-section-head"><span>Weekplanning</span></div>
        <div className="muted ov-hint">Nog geen kaarten. Klik op het plusje in een weekkop om er zelf een toe te voegen. Of spar eerst in een onderwerp bij de bird&rsquo;s eye, klik dan op &ldquo;Trek de conclusie&rdquo; en daarna op &ldquo;Welke taken volgen hieruit?&rdquo;; je krijgt dan een voorstel dat je zelf aanvinkt.</div>
      </div>
    );
  }

  // Elke kaart is zelf een doelgebied, zodat je binnen een week de volgorde kunt
  // bepalen. De streep verschijnt boven de kaart waar hij terechtkomt.
  const renderCard = (t: WpTask) => (
    <div key={t.id}
      className={"wp-kaart-doel" + (dropVoor === t.id && dragId !== t.id ? " wp-kaart-doel-aan" : "")}
      onDragOver={(e) => {
        if (dragId == null || dragId === t.id) return;
        e.preventDefault(); e.stopPropagation();
        setDropVoor(t.id); setDropKey(keyOf(t.weekYear, t.weekNo));
      }}
      onDrop={(e) => {
        if (dragId == null) return;
        e.preventDefault(); e.stopPropagation();
        void moveVoor(dragId, t.id, t.weekYear, t.weekNo);
        setDropVoor(null); setDropKey(null);
      }}>
      <WeekplanCard slug={slug} t={t} page={t.url ? pages[urlKey(t.url)] : undefined}
        open={openCard === t.id}
        onToggleOpen={() => setOpenCard(openCard === t.id ? null : t.id)}
        onDragStart={() => setDragId(t.id)} onDragEnd={() => { setDragId(null); setDropKey(null); setDropVoor(null); }}
        onStatus={() => void cycleStatus(t)} onRemove={() => void remove(t.id)}
        onMail={(aud) => setMailFor({ t, aud })} onGoToPage={onGoToPage} onGoToTab={onGoToTab} onOpenMailDate={onOpenMailDate} mailLinks={mailDatumLinks}
        refreshBoard={() => void load()} />
    </div>
  );

  return (
    <div className={kaal ? "wp-wrap wp-kaal" : "cockpit-card wp-wrap"}>
      {/* De pagina's om uit te kiezen bij een nieuwe taak. Typen mag ook; de lijst
          is een hulpmiddel, geen keurslijf. */}
      <datalist id="wp-paginas">{paginas.slice(0, 600).map((u) => <option key={u} value={u} />)}</datalist>
      {/* Zonder eigen kop als dit blok in het Overview-paneel hangt: daar staat de
          titel "Week Planning" al op de toggle erboven. */}
      <div className="wp-intro" style={kaal ? { display: "none" } : undefined}>
        <span className="ovc-icontile" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /><path d="M7 14h2M11 14h2M15 14h2M7 18h2M11 18h2" /></svg>
        </span>
        <div>
          <div className="wp-intro-titel">
            Weekplanning
            {/* Het weekbord is de compacte kijk op ditzelfde werk: één regel per
                kaart met de fase-stand ernaast. Staat er bewust naast zolang we
                uitproberen of die vorm beter werkt. */}
            <a className="wp-bordlink" href={`/admin/client/${slug}/weekbord`}>compact weekbord &rarr;</a>
          </div>
          <div className="muted">Projectkaarten uit de onderwerpen, verdeeld over de weken. Sleep een kaart naar een andere week; klap hem open om de fases te starten en af te vinken.</div>
        </div>
        <div className="wp-intro-acties">
          <button type="button" className="wp-fase-btn" disabled={wlBusy}
            title="Crawlt de live pagina's en maakt één document voor de sitebouwer met kant-en-klare meta's en alt-teksten, plus één Dev-kaart in het bord."
            onClick={() => void startWerklijst()}>{wlBusy ? "Werklijst maken…" : "Werklijst sitebouwer"}</button>
          {wlMsg && (
            wlLink
              ? <a className="wp-link" href={wlLink} target="_blank" rel="noreferrer">{wlMsg}</a>
              : <span className={"ovc-mk-msg" + (wlFout ? " err" : " ok")}>{wlMsg}</span>
          )}
          {/* Kaarten van vóór het automatisch opruimen staan nog vol dubbelingen.
              Eén klik haalt die overal weg; nieuwe samenvoegingen ruimen zichzelf op. */}
          <button type="button" className="wp-fase-btn" disabled={opruimBusy}
            title="Laat de assistent elke kaart één keer netjes herschrijven: dubbelingen eruit, per fase één regel. Er wordt niets inhoudelijks weggegooid."
            onClick={() => void ruimAllesOp()}>{opruimBusy ? "Opruimen…" : "Ruim alle kaarten op"}</button>
          {opruimMsg && <span className={"ovc-mk-msg" + (opruimFout ? " err" : " ok")}>{opruimMsg}</span>}
        </div>
      </div>
      <div className="wp-board">
        {unplanned.length > 0 && (
          <div className={"wp-col wp-col-unplanned" + (dropKey === 0 ? " wp-drop" : "")}
            onDragOver={(e) => { e.preventDefault(); if (dragId != null) setDropKey(0); }}
            onDrop={() => { if (dragId != null) move(dragId, 0, 0); setDropKey(null); }}>
            <div className="wp-col-head"><span className="wp-col-wk">Ongepland</span></div>
            <div className="wp-col-body">{unplanned.map(renderCard)}</div>
          </div>
        )}
        {columns.map((c) => (
          <div key={c.key} className={"wp-col" + (c.isCurrent ? " wp-current" : "") + (dropKey === c.key ? " wp-drop" : "")}
            onDragOver={(e) => { e.preventDefault(); if (dragId != null) { setDropKey(c.key); setDropVoor(null); } }}
            onDrop={() => { if (dragId != null) void moveVoor(dragId, null, c.year, c.week); setDropKey(null); setDropVoor(null); }}>
            <div className="wp-col-head">
              <span className="wp-col-wk">Week {c.week}</span>
              {c.isCurrent && <span className="wp-col-nu">nu</span>}
              <span className="wp-col-dates">{dm(c.monday)} – {dm(c.sunday)}</span>
              {/* Zelf een taak beginnen. Kaarten konden alleen ontstaan uit een
                  bird's eye-gesprek, dus een klus die je gewoon even wilt vastleggen
                  moest je eerst ergens uitpraten. Het plusje staat in de weekkop, dan
                  is de week al gekozen op het moment dat je klikt. */}
              <button type="button" className="wp-col-plus"
                title={`Zelf een taak toevoegen aan week ${c.week}`}
                onClick={() => { setNieuwVoor(nieuwVoor === c.key ? null : c.key); setNieuwFout(""); }}>+</button>
              <svg className="wp-col-icoon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></svg>
            </div>
            {nieuwVoor === c.key && (
              <div className="wp-nieuw">
                <input className="wp-nieuw-taak" value={nieuwTaak} autoFocus
                  placeholder="Wat moet er gebeuren?"
                  onChange={(e) => setNieuwTaak(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && nieuwTaak.trim()) void maakTaak(c); if (e.key === "Escape") setNieuwVoor(null); }} />
                <input className="wp-nieuw-url" value={nieuwUrl} list="wp-paginas"
                  placeholder="Over welke pagina? (mag leeg)"
                  onChange={(e) => setNieuwUrl(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && nieuwTaak.trim()) void maakTaak(c); if (e.key === "Escape") setNieuwVoor(null); }} />
                <div className="wp-nieuw-rij">
                  <select value={nieuwWie} onChange={(e) => setNieuwWie(e.target.value)} title="Wie pakt dit op?">
                    <option value="SEO">SEO</option>
                    <option value="Dev">Sitebouwer</option>
                    <option value="Klant">Klant</option>
                  </select>
                  <span className="wp-fase-spacer" />
                  <button type="button" className="wp-fase-btn" onClick={() => setNieuwVoor(null)}>Annuleren</button>
                  <button type="button" className="wp-fase-btn wp-fase-btn-primair"
                    disabled={!nieuwTaak.trim() || nieuwBezig} onClick={() => void maakTaak(c)}>
                    {nieuwBezig ? "Bezig…" : "Toevoegen"}
                  </button>
                </div>
                {nieuwFout && <div className="wp-doc-fout">{nieuwFout}</div>}
              </div>
            )}
            <div className="wp-col-body">{byKey(c.key).map(renderCard)}</div>
          </div>
        ))}
      </div>

      {mailFor && (
        <MailUitKaart
          slug={slug} t={mailFor.t} page={mailFor.t.url ? pages[urlKey(mailFor.t.url)] : undefined}
          startAud={mailFor.aud} clientName={clientName} clientEmail={clientEmail}
          onClose={() => setMailFor(null)} />
      )}
    </div>
  );
}
