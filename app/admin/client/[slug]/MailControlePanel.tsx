"use client";

// ═══════════════════════════════════════════════════════════
// "CONTROLEER OF DIT VERWERKT IS" — knop plus uitslag bij een mail
// ═══════════════════════════════════════════════════════════
// Een uitslag met meerdere punten is een SCHERM, geen chatantwoord: per punt een
// kaart met een gekleurd label, het citaat uit de mail, wat de bouwer terugzei en
// wat er live gemeten is, met een klikbare link erbij. Zo kan Maarten elk oordeel
// zelf natrekken zonder ons op ons woord te geloven.
//
// Twee labels per punt, en dat is met opzet: het ene zegt hoe het ervoor staat,
// het andere of het hard gemeten is of een oordeel. Die twee door elkaar halen is
// precies hoe een controle onbetrouwbaar wordt.
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";

type Punt = {
  puntKey: string;
  soort: string;
  hard: boolean;
  titel: string;
  gevraagd: string;
  gevraagdOp: string;
  devClaim: string;
  devClaimOp: string;
  bronPad: string;
  doelPad: string;
  plek: string;
  uitslag: "goed" | "deels" | "niet" | "onmeetbaar" | "vervallen";
  bewijs: string;
  handmatig: "" | "goed" | "niet";
};

type Controle = {
  id: number;
  status: "running" | "done" | "error" | "verstuurd";
  stap: string;
  samenvatting: string;
  conceptOnderwerp: string;
  conceptHtml: string;
  openVragen: string[];
  onduidelijk: { tekst: string; reden: string }[];
  error: string;
  devNaam: string;
  devAdres: string;
  punten: Punt[];
};

const LABEL: Record<string, { tekst: string; kleur: string }> = {
  goed: { tekst: "staat goed", kleur: "#1a7f37" },
  deels: { tekst: "half", kleur: "#b26a00" },
  niet: { tekst: "staat er niet", kleur: "#b42318" },
  onmeetbaar: { tekst: "kon ik niet meten", kleur: "#667085" },
  vervallen: { tekst: "vervallen", kleur: "#3538cd" },
};

/** Elke URL en elk pad klikbaar maken; nooit een kale slug in beeld. */
function linkify(tekst: string, domein: string): string {
  const veilig = (tekst || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c] as string));
  const basis = (domein || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");
  return veilig
    .replace(/(https?:\/\/[^\s"'<>)]+)/g, '<a href="$1" target="_blank" rel="noreferrer">$1</a>')
    .replace(/(^|[\s(])(\/[a-z0-9][a-z0-9\-/]*\/?)(?=[\s.,;:)]|$)/gi, (m, voor, pad) =>
      basis ? `${voor}<a href="https://${basis}${pad}" target="_blank" rel="noreferrer">${pad}</a>` : m);
}

export default function MailControlePanel({
  slug, domein, conversationId, messageId, onderwerp,
}: {
  slug: string;
  domein: string;
  conversationId: string;
  messageId: string;
  onderwerp: string;
}) {
  const [vraag, setVraag] = useState("");
  const [controle, setControle] = useState<Controle | null>(null);
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [open, setOpen] = useState(false);
  const [naar, setNaar] = useState("");
  const [verstuurBezig, setVerstuurBezig] = useState(false);
  const [verstuurd, setVerstuurd] = useState("");
  const conceptRef = useRef<HTMLDivElement | null>(null);

  const haal = useCallback(async (id?: number) => {
    const q = id ? `id=${id}` : `conversationId=${encodeURIComponent(conversationId)}`;
    const r = await fetch(`/api/admin/mail-controle?slug=${encodeURIComponent(slug)}&${q}`).then((x) => x.json()).catch(() => null);
    if (r?.ok && r.controle) {
      setControle(r.controle);
      if (!naar && r.controle.devAdres) setNaar(r.controle.devAdres);
      return r.controle as Controle;
    }
    return null;
  }, [slug, conversationId, naar]);

  // Eerdere controle van deze thread meteen terughalen, zodat het scherm niet
  // leeg oogt terwijl er al een uitslag ligt.
  useEffect(() => { if (open && !controle) void haal(); }, [open, controle, haal]);

  // Pollen zolang hij draait. Stopt vanzelf zodra de status verandert.
  useEffect(() => {
    if (!controle || controle.status !== "running") return;
    const t = setInterval(() => { void haal(controle.id); }, 3000);
    return () => clearInterval(t);
  }, [controle, haal]);

  async function start() {
    setBezig(true); setFout(""); setVerstuurd("");
    try {
      const r = await fetch("/api/admin/mail-controle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, conversationId, messageId, onderwerp, vraag }),
      }).then((x) => x.json());
      if (!r.ok) { setFout(r.error || "Starten mislukt."); return; }
      setOpen(true);
      await haal(r.id);
    } catch {
      setFout("Starten mislukt.");
    } finally {
      setBezig(false);
    }
  }

  async function zetOordeel(puntKey: string, waarde: "" | "goed" | "niet") {
    if (!controle) return;
    setControle({ ...controle, punten: controle.punten.map((p) => (p.puntKey === puntKey ? { ...p, handmatig: waarde } : p)) });
    await fetch("/api/admin/mail-controle", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, id: controle.id, puntKey, handmatig: waarde }),
    }).catch(() => null);
  }

  async function verstuur() {
    if (!controle) return;
    const html = conceptRef.current?.innerHTML || controle.conceptHtml;
    if (!html.trim()) { setFout("Er is nog geen bericht om te versturen."); return; }
    setVerstuurBezig(true); setFout("");
    try {
      const r = await fetch("/api/admin/mail-controle/verstuur", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, id: controle.id, html, onderwerp: controle.conceptOnderwerp, to: naar }),
      }).then((x) => x.json());
      if (!r.ok) { setFout(r.error || "Versturen mislukt."); return; }
      setVerstuurd(`Verstuurd naar ${(r.sentTo || []).join(", ")}.`);
      await haal(controle.id);
    } catch {
      setFout("Versturen mislukt.");
    } finally {
      setVerstuurBezig(false);
    }
  }

  const draait = controle?.status === "running";

  return (
    <div className="mc-blok">
      <div className="mc-start">
        <input
          className="mc-vraag"
          value={vraag}
          onChange={(e) => setVraag(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !bezig) void start(); }}
          placeholder="Kun je even controleren of dit op de juiste manier verwerkt is?"
        />
        <button type="button" className="primary-btn small" onClick={() => void start()} disabled={bezig || draait}>
          {bezig || draait ? "Bezig…" : "Controleer of dit verwerkt is"}
        </button>
        {controle && !open && (
          <button type="button" className="ghost-btn small" onClick={() => setOpen(true)}>Toon uitslag</button>
        )}
      </div>
      <div className="mc-uitleg muted">
        Ik lees de hele mailwisseling, meet de live site en zeg per punt wat er staat. Laat het veld leeg om
        alleen op de mail af te gaan.
      </div>

      {fout && <div className="wp-doc-fout" style={{ marginTop: "var(--s-3)" }}>{fout}</div>}

      {open && controle && (
        <div className="mc-uitslag">
          {draait && (
            <div className="mc-bezig">
              <span className="mc-spin" /> {controle.stap || "bezig"}…
            </div>
          )}

          {controle.status === "error" && <div className="wp-doc-fout">{controle.error}</div>}

          {controle.samenvatting && <div className="mc-samenvatting">{controle.samenvatting}</div>}

          {controle.punten.map((p) => {
            const staat = p.handmatig || p.uitslag;
            const label = LABEL[staat] || LABEL.onmeetbaar;
            return (
              <div className="mc-punt card" key={p.puntKey}>
                <div className="mc-punt-kop">
                  <span className="mc-chip" style={{ background: label.kleur }}>{label.tekst}</span>
                  <span className="mc-chip mc-chip-soort">{p.hard ? "hard gemeten" : "richtinggevend"}</span>
                  {p.handmatig && <span className="mc-chip mc-chip-eigen">jouw oordeel</span>}
                  <span className="mc-punt-titel">{p.titel}</span>
                </div>
                <div className="mc-regel">
                  <span className="mc-etiket">gevraagd{p.gevraagdOp ? ` op ${p.gevraagdOp}` : ""}</span>
                  <span className="mc-citaat">&ldquo;{p.gevraagd}&rdquo;</span>
                </div>
                {p.devClaim && (
                  <div className="mc-regel">
                    <span className="mc-etiket">de bouwer zei{p.devClaimOp ? ` op ${p.devClaimOp}` : ""}</span>
                    <span className="mc-citaat">&ldquo;{p.devClaim}&rdquo;</span>
                  </div>
                )}
                <div className="mc-regel">
                  <span className="mc-etiket">gemeten</span>
                  <span className="mc-bewijs" dangerouslySetInnerHTML={{ __html: linkify(p.bewijs, domein) }} />
                </div>
                <div className="mc-knoppen">
                  <button type="button" className="ghost-btn small" onClick={() => void zetOordeel(p.puntKey, p.handmatig === "goed" ? "" : "goed")}>
                    {p.handmatig === "goed" ? "oordeel terugdraaien" : "toch goed"}
                  </button>
                  <button type="button" className="ghost-btn small" onClick={() => void zetOordeel(p.puntKey, p.handmatig === "niet" ? "" : "niet")}>
                    {p.handmatig === "niet" ? "oordeel terugdraaien" : "toch niet goed"}
                  </button>
                </div>
              </div>
            );
          })}

          {controle.onduidelijk.length > 0 && (
            <div className="mc-punt card mc-onduidelijk">
              <div className="mc-punt-kop"><span className="mc-punt-titel">Deze punten kon ik niet aan een pagina koppelen</span></div>
              <ul className="mc-lijst">
                {controle.onduidelijk.map((o, i) => <li key={i}>{o.tekst} <span className="muted">({o.reden})</span></li>)}
              </ul>
            </div>
          )}

          {controle.openVragen.length > 0 && (
            <div className="mc-punt card">
              <div className="mc-punt-kop"><span className="mc-punt-titel">Vragen van de bouwer die nog openstaan</span></div>
              <ul className="mc-lijst">
                {controle.openVragen.map((v, i) => <li key={i}>&ldquo;{v}&rdquo;</li>)}
              </ul>
            </div>
          )}

          {controle.conceptHtml && (
            <div className="mc-concept card">
              <div className="mc-punt-kop"><span className="mc-punt-titel">Concept-antwoord{controle.devNaam ? ` voor ${controle.devNaam}` : ""}</span></div>
              <div className="reply-to-row">
                <label>Aan:</label>
                <input className="reply-to-input" value={naar} onChange={(e) => setNaar(e.target.value)} placeholder="e-mailadres van de websitebouwer" />
              </div>
              <div
                className="mail-edit md"
                contentEditable
                suppressContentEditableWarning
                ref={conceptRef}
                dangerouslySetInnerHTML={{ __html: controle.conceptHtml }}
                /* concept_html komt uit mdToHtml() in lib/mail-controle.ts, al gerenderd bewaard */
              />
              <div className="mc-knoppen">
                <button type="button" className="primary-btn small" onClick={() => void verstuur()} disabled={verstuurBezig || controle.status === "verstuurd"}>
                  {controle.status === "verstuurd" ? "Verstuurd" : verstuurBezig ? "Versturen…" : "Verstuur in deze thread"}
                </button>
                {verstuurd && <span className="mc-verstuurd">{verstuurd}</span>}
              </div>
            </div>
          )}

          <button type="button" className="ghost-btn small" onClick={() => setOpen(false)}>Uitslag verbergen</button>
        </div>
      )}
    </div>
  );
}
