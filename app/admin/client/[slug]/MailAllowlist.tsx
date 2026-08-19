"use client";

import { useEffect, useState } from "react";
import { Omlaag, Uitklap } from "../../../_ui/Pijl";

// Witte lijst per klant: welke afzenders (mailadres of heel domein) bij "Laatste
// mails" mogen verschijnen. Los, zelfstandig blokje in het mail-blok van de cockpit.
export default function MailAllowlist({ slug }: { slug: string }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch(`/api/admin/mail-allowlist?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json()).then((d) => { if (alive && d.ok) { setText(d.allowlist || ""); setLoaded(true); } })
      .catch(() => { if (alive) setLoaded(true); });
    return () => { alive = false; };
  }, [slug]);

  async function save() {
    setSaving(true); setSaved(false);
    try {
      const r = await fetch("/api/admin/mail-allowlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, allowlist: text }) });
      const d = await r.json();
      if (d.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
    } finally { setSaving(false); }
  }

  const count = text.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean).length;

  return (
    <div className="mail-allow">
      <button type="button" className="mail-allow-head" onClick={() => setOpen((v) => !v)}>
        {open ? <Omlaag /> : <Uitklap />} Welke afzenders horen bij deze klant? {count > 0 ? <span className="plan-chip has">{count} ingesteld</span> : <span className="plan-chip">alles</span>}
      </button>
      {open && (
        <div className="mail-allow-body">
          <div className="muted" style={{ fontSize: "var(--fs-sm)", marginBottom: "var(--s-2)" }}>
            Eén per regel: een mailadres (bijv. jan@voorbeeld.nl) of een heel domein (bijv. voorbeeld.nl). Alleen mail van deze afzenders verschijnt bij Laatste mails; jouw eigen verzonden mail blijft altijd staan. Voeg ook je eigen verzenddomein toe (bijv. pingwin.nl). Leeg = alles tonen.
          </div>
          <textarea className="mail-allow-area" value={text} onChange={(e) => setText(e.target.value)} placeholder={"voorbeeld.nl\npingwin.nl\njan@voorbeeld.nl"} disabled={!loaded} />
          <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", marginTop: "var(--s-2)" }}>
            <button type="button" className="btn btn-primary btn-klein" onClick={save} disabled={saving || !loaded}>{saving ? "Opslaan…" : "Opslaan"}</button>
            {saved && <span className="focus-save-status">✓ opgeslagen</span>}
          </div>
        </div>
      )}
    </div>
  );
}
