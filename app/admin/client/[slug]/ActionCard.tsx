"use client";

import { useEffect, useRef, useState } from "react";
import { urlKey } from "../../../../lib/url-key";
import { splitCardInfo, cardInfoHtml } from "../../../../lib/card-info";
import PaginaDossier from "./PaginaDossier";

export type Action = {
  id: string; type: string; reason?: string;
  url?: string; title?: string; taak?: string; fase?: string; wie?: string; steps?: string[]; tekst?: string;
  taken?: { taak: string; wie?: string; url?: string; week?: number; toelichting?: string; taaktype?: string; bronMail?: string }[];
  executed?: boolean;
  result?: { ok: boolean; message: string; taskIds?: number[]; runId?: number; link?: string; text?: string };
};

const LABEL: Record<string, string> = {
  pagina_toevoegen: "Pagina aanmaken",
  taak_aanmaken: "Taak aanmaken",
  plan_vastleggen: "Strategie vastleggen",
  strategie_bepalen: "Strategie bepalen",
  pijplijn_starten: "Pijplijn starten",
  structured_data: "Structured data",
  alt_teksten: "Alt-teksten maken",
  meta_verbeteren: "Meta title/description",
  profiel_bijwerken: "Klantprofiel bijwerken",
  weekplan_taken: "Taken → weekplanning",
};

function shortUrl(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}

// Eén goedkeur-kaartje onder een bird's eye-antwoord. Er gebeurt pas iets als
// Maarten op "Goedkeuren" klikt (mens aan het stuur).
export default function ActionCard({ action, slug, thread, onExecuted, onGoToPage, onGoToTask, onWeekplanChanged }: {
  action: Action; slug: string; thread: string;
  onExecuted: (id: string, result: NonNullable<Action["result"]>, executed: boolean) => void;
  onGoToPage?: (url: string) => void; onGoToTask?: (taskId: number) => void;
  onWeekplanChanged?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addedSet, setAddedSet] = useState<Set<number>>(new Set()); // welke voorstel-taken al toegevoegd zijn
  const [addBusy, setAddBusy] = useState<number | null>(null);
  const [addErr, setAddErr] = useState<number | null>(null); // welke taak faalde bij toevoegen
  const editRef = useRef<HTMLDivElement>(null);
  const isWeekplan = action.type === "weekplan_taken";

  // Wat staat er AL in de weekplanning? Bewust afgeleid uit het bord zelf en niet
  // uit een vinkje in dit scherm: dat vinkje leefde alleen in deze sessie, dus na
  // een herlaadbeurt zag alles er weer onaangeraakt uit en zette je dingen dubbel
  // door. Bij Paul Hoevenaars bleven de twee belangrijkste week 1-kaarten zo
  // ongemerkt liggen terwijl week 3 en 4 er wel in stonden.
  const [inBord, setInBord] = useState<{ urls: Set<string>; titels: Set<string> } | null>(null);

  // Datum → mail-link, zodat "mail van 22 juli" in de achtergrond een echte link
  // wordt. Zelfde bron en zelfde sleutels als het weekplan-bord.
  const [mailLinks, setMailLinks] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!isWeekplan) return;
    let leeft = true;
    fetch(`/api/admin/mail?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!leeft || !d?.ok) return;
        const map: Record<string, string> = {};
        for (const e of (d.emails || []) as { receivedAt?: string; webLink?: string; superhumanLink?: string }[]) {
          const link = e.superhumanLink || e.webLink || "";
          if (!link || !e.receivedAt) continue;
          const dt = new Date(e.receivedAt);
          if (Number.isNaN(dt.getTime())) continue;
          const dm = `${dt.getDate()}-${dt.getMonth() + 1}`;
          if (!map[dm]) map[dm] = link;
          const dmj = `${dm}-${dt.getFullYear()}`;
          if (!map[dmj]) map[dmj] = link;
        }
        setMailLinks(map);
      })
      .catch(() => { /* dan blijft een maildatum gewone tekst, geen dode link */ });
    return () => { leeft = false; };
  }, [slug, isWeekplan]);

  useEffect(() => {
    if (!isWeekplan) return;
    let leeft = true;
    fetch(`/api/admin/weekplan?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!leeft || !d?.ok) return;
        const urls = new Set<string>(), titels = new Set<string>();
        for (const t of (d.tasks || []) as { url?: string; taak?: string }[]) {
          if (t.url) urls.add(urlKey(t.url));
          if (t.taak) titels.add(t.taak.trim().toLowerCase());
        }
        setInBord({ urls, titels });
      })
      .catch(() => {});
    return () => { leeft = false; };
  }, [slug, isWeekplan]);

  // Een voorgestelde taak staat er al als er een kaart voor dezelfde pagina is
  // (kaarten zijn per pagina) of, zonder pagina, met dezelfde titel.
  function staatErAl(t: NonNullable<Action["taken"]>[number], i: number): boolean {
    if (addedSet.has(i)) return true;
    if (!inBord) return false;
    if (t.url && inBord.urls.has(urlKey(t.url))) return true;
    return !t.url && !!t.taak && inBord.titels.has(t.taak.trim().toLowerCase());
  }

  // Voeg één voorgestelde taak toe aan de weekplanning (per taak, niet in bulk).
  async function addOne(i: number, t: NonNullable<Action["taken"]>[number]) {
    if (addBusy !== null || addedSet.has(i)) return;
    setAddBusy(i); setAddErr(null);
    try {
      const r = await fetch("/api/admin/weekplan/add", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread, taak: t.taak, toelichting: t.toelichting, wie: t.wie, url: t.url, week: t.week, taaktype: t.taaktype, bronMail: t.bronMail }) });
      const d = await r.json();
      if (d.ok) { setAddedSet((s) => new Set(s).add(i)); onWeekplanChanged?.(); }
      else setAddErr(i);
    } catch { setAddErr(i); } finally { setAddBusy(null); }
  }
  const editable = action.type === "profiel_bijwerken" || action.type === "strategie_bepalen";
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
      {action.taken && action.taken.length > 0 && (() => {
        // Per taak een net kaartje, gegroepeerd per week; met een pilletje
        // "→ Weekplanning" kopieer je de taak naar de weekplanning en ga je ermee
        // aan de slag. De achtergrond (waarom) staat meteen in de kaart.
        const groups = new Map<number, number[]>();
        action.taken!.forEach((t, i) => {
          const w = Math.max(1, Number(t.week) || 1);
          if (!groups.has(w)) groups.set(w, []);
          groups.get(w)!.push(i);
        });
        const weeks = Array.from(groups.keys()).sort((a, b) => a - b);
        const open = action.taken!.map((t, i) => ({ t, i })).filter(({ t, i }) => !staatErAl(t, i));
        return (
          <div className="tvk-weeks">
            {/* Zonder deze regel is niet te zien dat er nog kaarten klaarstaan: bij
                Paul Hoevenaars bleven de twee belangrijkste week 1-taken liggen
                terwijl week 3 en 4 er wel in stonden, en dat zag er hetzelfde uit. */}
            {inBord && (
              <div className="tvk-stand">
                {open.length === 0
                  ? <span className="tvk-stand-klaar">Alle {action.taken!.length} taken staan in de weekplanning.</span>
                  : <>
                      <span>{open.length} van de {action.taken!.length} {open.length === 1 ? "taak staat" : "taken staan"} nog niet in de weekplanning.</span>
                      <button type="button" className="tvk-pill" disabled={addBusy !== null}
                        title="Zet in één keer alle taken door die er nog niet in staan"
                        onClick={async () => { for (const { t, i } of open) await addOne(i, t); }}>
                        Zet de rest erin
                      </button>
                    </>}
              </div>
            )}
            {weeks.map((w) => (
              <div key={w} className="tvk-week-group">
                <div className="tvk-week-head">Week {w}</div>
                {groups.get(w)!.map((i) => {
                  const t = action.taken![i];
                  const added = staatErAl(t, i);
                  const b = addBusy === i;
                  return (
                    <div key={i} className={"tvk-card" + (added ? " tvk-added" : "")}>
                      <div className="tvk-top">
                        <span className={"tvk-wie " + (t.wie === "Dev" ? "wie-dev" : "wie-seo")}>{t.wie || "SEO"}</span>
                        <span className="tvk-taak">{t.taak}</span>
                        <button type="button" className={"tvk-pill" + (added ? " tvk-pill-done" : "") + (b ? " busy" : "") + (addErr === i ? " tvk-pill-err" : "")} disabled={b || added} onClick={() => addOne(i, t)} title={added ? "Er staat al een kaart voor deze pagina in het bord" : addErr === i ? "Toevoegen mislukt, klik om opnieuw te proberen" : "Kopieer deze taak naar de weekplanning"}>
                          {added ? "✓ Staat in de weekplanning" : b ? "…" : addErr === i ? "Mislukt, opnieuw" : "→ Weekplanning"}
                        </button>
                      </div>
                      <div className="tvk-links">
                        {t.url && <a className="tvk-url" href={t.url} target="_blank" rel="noreferrer">{shortUrl(t.url)}</a>}
                        {t.bronMail && <a className="tvk-url" href={t.bronMail} target="_blank" rel="noreferrer">✉ bronmail</a>}
                      </div>
                      {/* De toelichting werd hier als ruwe tekst in een div gezet.
                          De regeleindes vallen dan weg in HTML, dus alles plakte aan
                          elkaar tot één onleesbare regel met puntjes ertussen, terwijl
                          de assistent hem juist netjes in secties had geschreven.
                          Nu door dezelfde parser als de kaart zelf: Doel, Afspraken en
                          per fase. Standaard ingeklapt, want in een voorstel wil je
                          eerst zien wát er wordt voorgesteld, niet alle achtergrond. */}
                      {t.toelichting && <VoorstelToelichting tekst={t.toelichting} pageUrl={t.url} taak={t.taak} mailLinks={mailLinks} /> }
                      {/* Hetzelfde dossierblok als op de kaart in de weekplanning:
                          de mails, documenten en stand van deze pagina. Zo weet je
                          al vóór het doorzetten wat er speelt. */}
                      {t.url && <PaginaDossier slug={slug} url={t.url} compact />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        );
      })()}
      {action.title && <div className="act-line"><strong>Titel:</strong> {action.title}</div>}
      {action.steps && action.steps.length > 0 && <div className="act-line"><strong>Stappen:</strong> {action.steps.join(" → ")}</div>}
      {action.reason && <div className="act-reason">{action.reason}</div>}

      {editable && !done && (
        <>
          <div className="act-edit-label muted">Voorstel (pas gerust aan vóór je goedkeurt):</div>
          <div className="act-edit" contentEditable suppressContentEditableWarning ref={editRef}>{action.tekst}</div>
        </>
      )}

      {!done && !isWeekplan && (
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

// De achtergrond bij een voorgestelde taak, in dezelfde opmaak als de kaart waar
// hij straks terechtkomt. Ingeklapt tot één samenvattende regel: bij een voorstel
// wil je eerst zien wát er wordt voorgesteld. Eén klik toont het hele verhaal, dus
// er gaat niets verloren dat je voor een blauwdruk nodig hebt.
function VoorstelToelichting({ tekst, pageUrl, taak, mailLinks }: { tekst: string; pageUrl?: string; taak?: string; mailLinks?: Record<string, string> }) {
  const [open, setOpen] = useState(false);
  const info = splitCardInfo(tekst, taak);
  const fases = Object.keys(info.perFase).length;
  const punten = info.achtergrond.length + info.overig.length + info.afspraken.length;
  const delen: string[] = [];
  if (punten) delen.push(`${punten} ${punten === 1 ? "punt" : "punten"} achtergrond`);
  if (fases) delen.push(`${fases} ${fases === 1 ? "fase" : "fases"}`);

  return (
    <div className="tvk-why">
      <button type="button" className="tvk-why-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? "Verberg achtergrond ▴" : `Toon achtergrond ▾${delen.length ? ` (${delen.join(", ")})` : ""}`}
      </button>
      {/* De maildatums werden hier NIET klikbaar gemaakt: de kaart in de
          weekplanning gaf de mail-map wel mee, dit voorstel niet. Daardoor liep
          "mail van 22 juli" hier altijd dood. Nu gelijkgetrokken. */}
      {open && <div className="tvk-why-inhoud" dangerouslySetInnerHTML={{ __html: cardInfoHtml(tekst, pageUrl, taak, undefined, mailLinks) }} />}
    </div>
  );
}
