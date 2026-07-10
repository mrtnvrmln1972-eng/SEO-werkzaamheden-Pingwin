"use client";

import { useCallback, useEffect, useState } from "react";
import HelpHint from "./HelpHint";
import MetaPixelMeter from "./MetaPixelMeter";

// De CTR-machine: werklijst van pagina's waar de meta title/description de
// meeste klikwinst kan opleveren (uit Search Console), met per pagina het
// huidige én het voorgestelde metapaar (metertjes eronder), goedkeuren en
// het gemeten effect zodra de wijziging live staat.

type Effect = { ctrBefore: number; ctrAfter: number; clicksBefore: number; clicksAfter: number; daysAfter: number };
type Proposal = { curTitle: string; curDesc: string; propTitle: string; propDesc: string; status: "open" | "goedgekeurd" | "doorgevoerd" | "afgewezen"; liveAt: string | null; effect: Effect | null };
type KansRow = { url: string; keyword: string; clicks: number; impressions: number; ctr: number; expectedCtr: number; position: number; extraClicks: number; proposal: Proposal | null };

function pad(url: string): string {
  try { const u = new URL(url); return (u.pathname + u.search) || "/"; } catch { return url; }
}

const STATUS_LABEL: Record<string, { txt: string; bg: string; fg: string }> = {
  open: { txt: "voorstel klaar", bg: "#fff3e6", fg: "#b25a00" },
  goedgekeurd: { txt: "goedgekeurd, wacht op site", bg: "#e8f1fb", fg: "#1a5da6" },
  doorgevoerd: { txt: "live", bg: "#ecf7ee", fg: "#2e7d32" },
  afgewezen: { txt: "afgewezen", bg: "#f2f2f2", fg: "#777" },
};

export default function MetaCtrPanel({ slug }: { slug: string }) {
  const [rows, setRows] = useState<KansRow[] | null>(null);
  const [error, setError] = useState("");
  const [openUrl, setOpenUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/admin/meta-ctr?slug=${encodeURIComponent(slug)}`);
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Laden mislukte.");
      setRows(d.rows as KansRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Laden mislukte.");
      setRows([]);
    }
  }, [slug]);

  useEffect(() => { void load(); }, [load]);

  async function generate(r: KansRow) {
    setBusy(r.url);
    setError("");
    try {
      const res = await fetch("/api/admin/meta-ctr", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, url: r.url, keyword: r.keyword, base: { ctr: r.ctr, position: r.position, impressions: r.impressions } }),
      });
      const d = await res.json();
      if (!d.ok) throw new Error(d.error || "Genereren mislukte.");
      setRows((cur) => (cur || []).map((x) => x.url === r.url ? { ...x, proposal: { curTitle: d.curTitle, curDesc: d.curDesc, propTitle: d.propTitle, propDesc: d.propDesc, status: "open", liveAt: null, effect: null } } : x));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Genereren mislukte.");
    } finally {
      setBusy(null);
    }
  }

  async function patch(url: string, fields: { propTitle?: string; propDesc?: string; status?: Proposal["status"] }) {
    await fetch("/api/admin/meta-ctr", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, url, ...fields }),
    }).catch(() => {});
  }

  function setLocal(url: string, fn: (p: Proposal) => Proposal) {
    setRows((cur) => (cur || []).map((x) => x.url === url && x.proposal ? { ...x, proposal: fn(x.proposal) } : x));
  }

  async function copyApproved() {
    const approved = (rows || []).filter((r) => r.proposal && (r.proposal.status === "goedgekeurd" || r.proposal.status === "doorgevoerd"));
    if (!approved.length) return;
    const text = approved.map((r) => [
      `Pagina: ${r.url}`,
      `Nieuwe paginatitel (meta title): ${r.proposal!.propTitle}`,
      `Nieuwe meta description: ${r.proposal!.propDesc}`,
    ].join("\n")).join("\n\n");
    await navigator.clipboard.writeText(`Nieuwe meta-teksten (graag 1-op-1 overnemen in de website):\n\n${text}`).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  const approvedCount = (rows || []).filter((r) => r.proposal && (r.proposal.status === "goedgekeurd" || r.proposal.status === "doorgevoerd")).length;

  return (
    <div className="cockpit-card">
      <div className="wz-title">
        Meta &amp; CTR
        <HelpHint xl title="De CTR-machine: meer klikken zonder hoger te staan" text={"Deze lijst zoekt in Search Console de pagina's die **veel vertoond** worden maar **te weinig geklikt** voor de positie waarop ze staan. Precies daar levert een betere paginatitel en meta-beschrijving direct meer bezoekers op, zonder dat de positie hoeft te stijgen.\n## Hoe je de lijst leest\n- **Gemiste klikken**: het geschatte aantal extra klikken per 90 dagen als de pagina de normale klikkans voor zijn positie haalt.\n- **CTR nu vs verwacht**: de echte klikkans naast wat gebruikelijk is op die positie.\n## De werkwijze\n- **Genereer voorstel**: de AI schrijft een titel en beschrijving volgens alle bewezen klik-regels (zoekwoord vooraan, juiste lengte in pixels, actieve uitnodiging, concreet feit) en het profiel van de klant. Pas ze gerust aan; de metertjes laten live zien of het past.\n- **Goedkeuren**: de tekst is klaar om doorgevoerd te worden. Met de kopieerknop bovenaan pak je alle goedgekeurde teksten in één keer, klaar om te mailen naar de sitebouwer of klant.\n- **Live-detectie**: het dashboard ziet vanzelf wanneer de nieuwe tekst op de site staat en meet daarna de klikkans vóór en ná, zwart-op-wit bewijs voor de klant."} />
      </div>
      <p className="wz-item-sub" style={{ maxWidth: 720 }}>
        Pagina&rsquo;s met veel vertoningen maar te weinig klikken voor hun positie (laatste 90 dagen). Betere meta-teksten = direct meer bezoekers.
      </p>
      <div className="org-actions" style={{ margin: "10px 0" }}>
        <button type="button" className="primary-btn small" onClick={copyApproved} disabled={!approvedCount}>
          {copied ? "Gekopieerd!" : `Kopieer goedgekeurde meta's (${approvedCount})`}
        </button>
        <button type="button" className="ghost-btn small" onClick={() => { setRows(null); void load(); }}>Vernieuwen</button>
      </div>
      {error && <p className="wz-item-sub" style={{ color: "#c62828" }}>{error}</p>}
      {rows === null && <p className="wz-item-sub">Kansen berekenen uit Search Console&hellip;</p>}
      {rows !== null && rows.length === 0 && !error && <p className="wz-item-sub">Geen duidelijke CTR-kansen gevonden (of Search Console heeft nog geen data voor deze klant).</p>}
      <div className="wz-list">
        {(rows || []).map((r) => {
          const open = openUrl === r.url;
          const st = r.proposal ? STATUS_LABEL[r.proposal.status] : null;
          return (
            <div key={r.url} className="wz-item-wrap" style={{ flexDirection: "column", alignItems: "stretch" }}>
              <button type="button" className="wz-item" onClick={() => setOpenUrl(open ? null : r.url)}>
                <span style={{ minWidth: 0 }}>
                  <span className="wz-item-title">{pad(r.url)}</span>
                  <span className="wz-item-sub" style={{ display: "block" }}>
                    {r.keyword ? <>zoekwoord &ldquo;{r.keyword}&rdquo; &middot; </> : null}
                    positie {r.position} &middot; {r.impressions.toLocaleString("nl-NL")} vertoningen &middot; CTR {r.ctr}% (verwacht {r.expectedCtr}%)
                  </span>
                </span>
                <span className="wz-item-date" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {st && <span style={{ background: st.bg, color: st.fg, borderRadius: 20, padding: "2px 10px", fontSize: 11.5, fontWeight: 600 }}>{st.txt}</span>}
                  {r.extraClicks > 0 && <span title="Geschatte extra klikken per 90 dagen bij een normale klikkans">+{r.extraClicks} klikken mogelijk</span>}
                  <span>{open ? "▾" : "▸"}</span>
                </span>
              </button>
              {open && (
                <div style={{ border: "1px solid var(--border)", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "14px", background: "#fff" }}>
                  {!r.proposal && (
                    <button type="button" className="primary-btn small" onClick={() => void generate(r)} disabled={busy === r.url}>
                      {busy === r.url ? "Voorstel schrijven…" : "Genereer voorstel (AI)"}
                    </button>
                  )}
                  {r.proposal && (
                    <div style={{ display: "grid", gap: 16 }}>
                      <div>
                        <div className="wz-block-head">Huidig op de site</div>
                        <div className="wz-line removed">{r.proposal.curTitle || "(geen paginatitel gevonden)"}<MetaPixelMeter kind="meta_title" text={r.proposal.curTitle} /></div>
                        <div className="wz-line removed">{r.proposal.curDesc || "(geen meta-beschrijving gevonden)"}<MetaPixelMeter kind="meta_description" text={r.proposal.curDesc} /></div>
                      </div>
                      <div>
                        <div className="wz-block-head">Voorstel (aanpasbaar)</div>
                        <div className="wz-line added">
                          <input
                            value={r.proposal.propTitle}
                            onChange={(e) => setLocal(r.url, (p) => ({ ...p, propTitle: e.target.value }))}
                            onBlur={(e) => void patch(r.url, { propTitle: e.target.value })}
                            style={{ width: "100%", border: "none", background: "transparent", font: "inherit", outline: "none" }}
                            aria-label="Voorgestelde paginatitel"
                          />
                          <MetaPixelMeter kind="meta_title" text={r.proposal.propTitle} />
                        </div>
                        <div className="wz-line added">
                          <textarea
                            value={r.proposal.propDesc}
                            onChange={(e) => setLocal(r.url, (p) => ({ ...p, propDesc: e.target.value }))}
                            onBlur={(e) => void patch(r.url, { propDesc: e.target.value })}
                            rows={2}
                            style={{ width: "100%", border: "none", background: "transparent", font: "inherit", outline: "none", resize: "vertical" }}
                            aria-label="Voorgestelde meta-beschrijving"
                          />
                          <MetaPixelMeter kind="meta_description" text={r.proposal.propDesc} />
                        </div>
                        <div className="org-actions" style={{ marginTop: 8 }}>
                          {r.proposal.status !== "goedgekeurd" && r.proposal.status !== "doorgevoerd" && (
                            <button type="button" className="primary-btn small" onClick={() => { setLocal(r.url, (p) => ({ ...p, status: "goedgekeurd" })); void patch(r.url, { status: "goedgekeurd" }); }}>Goedkeuren</button>
                          )}
                          {r.proposal.status === "goedgekeurd" && (
                            <button type="button" className="ghost-btn small" onClick={() => { setLocal(r.url, (p) => ({ ...p, status: "open" })); void patch(r.url, { status: "open" }); }}>Goedkeuring intrekken</button>
                          )}
                          <button type="button" className="ghost-btn small" onClick={() => void generate(r)} disabled={busy === r.url}>{busy === r.url ? "Schrijven…" : "Opnieuw genereren"}</button>
                          {r.proposal.status !== "afgewezen" && r.proposal.status !== "doorgevoerd" && (
                            <button type="button" className="ghost-btn small" onClick={() => { setLocal(r.url, (p) => ({ ...p, status: "afgewezen" })); void patch(r.url, { status: "afgewezen" }); }}>Afwijzen</button>
                          )}
                        </div>
                      </div>
                      {r.proposal.status === "doorgevoerd" && (
                        <div>
                          <div className="wz-block-head">Effect</div>
                          {r.proposal.effect ? (
                            <p className="wz-item-sub" style={{ color: "var(--dark)" }}>
                              Live sinds {r.proposal.liveAt ? new Date(r.proposal.liveAt).toLocaleDateString("nl-NL", { day: "numeric", month: "long" }) : "?"}:
                              {" "}klikkans van <strong>{r.proposal.effect.ctrBefore}%</strong> naar <strong>{r.proposal.effect.ctrAfter}%</strong>
                              {" "}({r.proposal.effect.clicksBefore} &rarr; {r.proposal.effect.clicksAfter} klikken, gemeten over {r.proposal.effect.daysAfter} dagen).
                            </p>
                          ) : (
                            <p className="wz-item-sub">De nieuwe tekst staat live; het effect wordt gemeten zodra er genoeg dagen Search Console-data zijn (reken op 1 à 2 weken).</p>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
