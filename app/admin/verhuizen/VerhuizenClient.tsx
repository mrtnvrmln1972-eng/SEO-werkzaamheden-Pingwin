"use client";

import { useCallback, useEffect, useState } from "react";
import AdminKop from "../AdminKop";

type Telling = { tabel: string; rijen: number };
type Kaart = { slug: string; naam: string; domein: string; ahrefsProjectId: string; fase: string; seoProfiel: string };
type CodeStand = { actief: boolean; slug: string; vervalt: string | null };
type Regel = { tabel: string; van: number; naar: number; klaar: boolean; fout?: string };

// De tabelnamen uit de database zijn geen taal voor op een scherm. Wat er niet
// bij staat, krijgt zijn eigen naam netjes leesbaar gemaakt, zodat er nooit
// "client_page_schema" in beeld komt.
const NAMEN: Record<string, string> = {
  client_tasks: "Taken",
  client_chat: "Chats bij de klant",
  page_chats: "Chats bij een pagina",
  client_pages: "Pagina's",
  client_focus: "De koers en het overzicht",
  client_focus_historie: "Eerdere versies van die velden",
  client_notes: "Notities",
  client_status: "Stand van zaken",
  client_keywords: "Zoekwoorden",
  client_ahrefs_keywords: "Zoekwoorden uit Ahrefs",
  client_metrics: "Cijfers",
  client_emails: "Mails",
  client_urls: "URL's",
  client_competitors: "Concurrenten",
  client_org_data: "Bedrijfsgegevens",
  client_strategy_sessions: "Strategie-gesprekken",
  client_discuss_items: "Bespreekpunten",
  client_dev_worklist: "Werklijst voor de sitebouwer",
  client_weekplan: "Weekplanning",
  page_plans: "Plannen per pagina",
  page_summaries: "Samenvattingen per pagina",
  page_dossier_summary: "Pagina-dossiers",
  page_doc_runs: "Documentopdrachten",
  page_doc_outputs: "Gemaakte documenten",
  page_content_snapshots: "Momentopnames van pagina's",
};

function leesbaar(tabel: string): string {
  return NAMEN[tabel] || tabel.replace(/^client_/, "").replace(/^page_/, "pagina ").replace(/_/g, " ");
}

function tijd(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("nl-NL", { hour: "2-digit", minute: "2-digit" });
}

export default function VerhuizenClient({ klanten }: { klanten: { slug: string; name: string }[] }) {
  const [slug, setSlug] = useState("");
  const [telling, setTelling] = useState<Telling[] | null>(null);
  const [kaart, setKaart] = useState<Kaart | null>(null);
  const [codeStand, setCodeStand] = useState<CodeStand | null>(null);
  const [nieuweCode, setNieuweCode] = useState("");
  const [doel, setDoel] = useState("https://pingwin-seo-dashboard.vercel.app");
  const [code, setCode] = useState("");
  const [laden, setLaden] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [regels, setRegels] = useState<Regel[]>([]);
  const [melding, setMelding] = useState("");
  const [fout, setFout] = useState("");

  const haalOp = useCallback(async (s: string) => {
    setLaden(true); setFout(""); setMelding("");
    try {
      const d = await fetch(`/api/admin/verhuizing?slug=${encodeURIComponent(s)}`).then((r) => r.json());
      if (d?.ok) { setTelling(d.telling as Telling[]); setKaart(d.kaart as Kaart); setCodeStand(d.code as CodeStand); }
      else setFout(d?.error || "Ophalen mislukte.");
    } catch { setFout("Ophalen mislukte."); }
    finally { setLaden(false); }
  }, []);

  useEffect(() => {
    if (!slug) { setTelling(null); setKaart(null); setCodeStand(null); return; }
    setNieuweCode(""); setRegels([]);
    void haalOp(slug);
  }, [slug, haalOp]);

  async function stuur(body: Record<string, unknown>) {
    const d = await fetch("/api/admin/verhuizing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, ...body }),
    }).then((r) => r.json());
    if (!d?.ok) throw new Error(d?.error || "Er ging iets mis.");
    return d as Record<string, unknown>;
  }

  async function maakCode() {
    setBezig(true); setFout(""); setMelding("");
    try {
      const d = await stuur({ actie: "code" });
      setNieuweCode(String(d.code || ""));
      setCodeStand(d.stand as CodeStand);
      setMelding("Code gemaakt. Hij is een uur geldig en staat hieronder, één keer.");
    } catch (e) { setFout((e as Error).message); }
    finally { setBezig(false); }
  }

  async function trekIn() {
    setBezig(true); setFout(""); setMelding("");
    try {
      const d = await stuur({ actie: "intrekken" });
      setNieuweCode("");
      setCodeStand(d.stand as CodeStand);
      setMelding("De code is ingetrokken. De verhuisdeur is weer dicht.");
    } catch (e) { setFout((e as Error).message); }
    finally { setBezig(false); }
  }

  // De hele verhuizing, hap voor hap, met de voortgang op het scherm.
  async function verhuis() {
    if (!telling) return;
    if (!window.confirm(`Alles van deze klant naar ${doel} sturen? Wat daar al van deze klant stond, wordt vervangen.`)) return;
    setBezig(true); setFout(""); setMelding("");
    const start: Regel[] = telling.map((t) => ({ tabel: t.tabel, van: t.rijen, naar: 0, klaar: false }));
    setRegels(start);
    try {
      await stuur({ actie: "stuur", doel, code });
      for (const t of telling) {
        let na = 0;
        let meer = true;
        while (meer) {
          const d = await stuur({ actie: "stuur", doel, code, tabel: t.tabel, na });
          na = Number(d.volgende) || na;
          meer = Boolean(d.meer);
          setRegels((r) => r.map((x) => (x.tabel === t.tabel ? { ...x, naar: na, klaar: !meer } : x)));
        }
      }
      setMelding("Klaar. Alles staat nu ook in de andere omgeving; hieronder zie je per soort hoeveel er mee is gegaan.");
    } catch (e) {
      setFout((e as Error).message);
    } finally { setBezig(false); }
  }

  const totaal = (telling || []).reduce((n, t) => n + t.rijen, 0);

  return (
    <>
      <AdminKop titel="Verhuizen" />
      <div className="beheer-container">
        <div className="beheer-kop">
          <h1 className="beheer-h1">Een klant naar een andere omgeving verhuizen</h1>
          <p className="beheer-uitleg">
            Draait een klant nog in een eigen, losse omgeving, dan haal je hem hiermee in één keer over:
            taken, chats, pagina&apos;s en alles wat er verder aan die klant hangt. Er wordt niets gekopieerd
            wat je daarna moet bijhouden; dit is een eenmalige verhuizing.
          </p>
          <p className="beheer-uitleg">
            Het gaat in twee stappen, en je hebt beide omgevingen even nodig. <strong>Waar de klant naartoe
            gaat</strong> maak je een verhuiscode. <strong>Waar de klant nu staat</strong> vul je die code in,
            samen met het adres, en druk je op verhuizen.
          </p>
        </div>

        <div className="beheer-blok">
          <h2 className="beheer-h2">Klant</h2>
          <select className="wp-docdrop-input" value={klanten.some((k) => k.slug === slug) ? slug : ""} onChange={(e) => setSlug(e.target.value)}>
            <option value="">Kies een klant…</option>
            {klanten.map((k) => <option key={k.slug} value={k.slug}>{k.name}</option>)}
          </select>
          <p className="beheer-klein">
            Staat de klant hier nog niet, omdat hij nog moet komen? Typ dan zijn korte naam, precies zoals hij
            in de andere omgeving heet (bijvoorbeeld <code>noc</code>).
          </p>
          <input
            className="wp-docdrop-input"
            value={slug}
            onChange={(e) => setSlug(e.target.value.trim().toLowerCase())}
            placeholder="korte naam van de klant"
          />
        </div>

        {fout && <div className="beheer-fout">{fout}</div>}
        {melding && <div className="beheer-ok">{melding}</div>}

        {slug && (
          <div className="beheer-blok">
            <div className="beheer-veld-kop">
              <h2 className="beheer-h2">Wat staat hier van deze klant</h2>
              <button type="button" className="btn btn-quiet btn-klein" onClick={() => void haalOp(slug)} disabled={laden || bezig}>
                Opnieuw tellen
              </button>
            </div>
            {laden && <p className="beheer-uitleg">Bezig met tellen…</p>}
            {!laden && telling && telling.length === 0 && (
              <p className="beheer-uitleg">Van deze klant staat hier nog niets. Er valt dus ook niets te verhuizen.</p>
            )}
            {!laden && telling && telling.length > 0 && (
              <>
                <p className="beheer-uitleg">
                  {totaal} onderdelen, verdeeld over {telling.length} soorten. De klantkaart zelf gaat mee
                  {kaart?.domein ? ` (${kaart.naam}, ${kaart.domein})` : ""}, zonder inlog en zonder bedragen.
                </p>
                <ul className="beheer-lijst">
                  {telling.map((t) => (
                    <li key={t.tabel}>
                      <div className="beheer-veld-kop">
                        <span><strong>{leesbaar(t.tabel)}</strong></span>
                        <span>{t.rijen}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}

        {slug && (
          <div className="beheer-blok">
            <h2 className="beheer-h2">Deze omgeving ontvangt de klant</h2>
            <p className="beheer-uitleg">
              Maak hier een verhuiscode en neem hem mee naar de omgeving waar de klant nu staat. De code is een
              uur geldig, hoort bij deze ene klant, en je kunt hem altijd intrekken.
            </p>
            <div className="pnl-acties-groep">
              <button type="button" className="btn btn-primary btn-klein" onClick={maakCode} disabled={bezig}>
                Verhuiscode maken
              </button>
              {codeStand?.actief && (
                <button type="button" className="btn btn-danger btn-klein" onClick={trekIn} disabled={bezig}>
                  Code intrekken
                </button>
              )}
            </div>
            {nieuweCode && (
              <p className="beheer-uitleg">
                <strong>Je code:</strong> <code>{nieuweCode}</code><br />
                Kopieer hem nu; hij is hierna niet meer terug te lezen.
              </p>
            )}
            {!nieuweCode && codeStand?.actief && (
              <p className="beheer-uitleg">Er staat een code open, geldig tot {tijd(codeStand.vervalt)}.</p>
            )}
            {!nieuweCode && codeStand && !codeStand.actief && (
              <p className="beheer-uitleg">Er staat geen code open, dus de verhuisdeur is dicht.</p>
            )}
          </div>
        )}

        {slug && (
          <div className="beheer-blok">
            <h2 className="beheer-h2">Deze omgeving stuurt de klant weg</h2>
            <p className="beheer-uitleg">
              Vul het adres van de ontvangende omgeving in en de code die je daar hebt gemaakt. Wat daar al van
              deze klant stond, wordt vervangen, dus je kunt dit gerust nog een keer doen.
            </p>
            <p className="beheer-klein">Adres van de andere omgeving</p>
            <input
              id="verhuis-doel"
              className="wp-docdrop-input"
              value={doel}
              onChange={(e) => setDoel(e.target.value)}
              placeholder="https://pingwin-seo-dashboard.vercel.app"
            />
            <p className="beheer-klein">Verhuiscode</p>
            <input
              id="verhuis-code"
              className="wp-docdrop-input"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Plak hier de code van de andere omgeving"
            />
            <div className="pnl-acties-groep">
              <button
                type="button"
                className="btn btn-primary btn-klein"
                onClick={verhuis}
                disabled={bezig || !telling || telling.length === 0 || !code.trim()}
              >
                {bezig ? "Bezig met verhuizen…" : "Verhuizen"}
              </button>
            </div>
            {regels.length > 0 && (
              <ul className="beheer-lijst">
                {regels.map((r) => (
                  <li key={r.tabel}>
                    <div className="beheer-veld-kop">
                      <span><strong>{leesbaar(r.tabel)}</strong></span>
                      <span>{r.klaar ? `${r.naar} van ${r.van}, klaar` : `${r.naar} van ${r.van}…`}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </>
  );
}
