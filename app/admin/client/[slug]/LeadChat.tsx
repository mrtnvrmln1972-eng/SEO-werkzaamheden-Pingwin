"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { mdToHtml } from "../../../../lib/markdown";

type Msg = { role: "user" | "assistant"; content: string };

// De chat van de leadomgeving. Bewust één doorlopend gesprek zonder onderwerpen:
// bij een lead voer je één gesprek over dat bedrijf. Alles wat je hier typt kent
// de chat al (het dossier reist als inhoudsopgave mee), dus je hoeft nooit uit te
// leggen over wie het gaat.
export default function LeadChat({
  slug, naam, domain, onVeranderd,
}: {
  slug: string;
  naam: string;
  domain: string;
  // Wordt aangeroepen als er iets gemaakt of bewaard kan zijn, zodat het
  // dossier en de plank ernaast zich verversen.
  onVeranderd?: () => void;
}) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [vraag, setVraag] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [geladen, setGeladen] = useState(false);
  const bodemRef = useRef<HTMLDivElement | null>(null);
  const veldRef = useRef<HTMLTextAreaElement | null>(null);

  const laad = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=lead&nothreads=1`);
      const data = await res.json();
      if (data.ok) setMessages((data.messages || []) as Msg[]);
    } catch { /* stil: lege chat is ook een geldige start */ }
    setGeladen(true);
  }, [slug]);

  useEffect(() => { laad(); }, [laad]);

  useEffect(() => {
    if (!geladen) return;
    bodemRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, geladen]);

  // Tekstveld groeit mee met de inhoud (nooit een klein hokje bij een lange dump).
  useEffect(() => {
    const el = veldRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 320) + "px";
  }, [vraag]);

  async function verstuur() {
    const tekst = vraag.trim();
    if (!tekst || busy) return;
    setError("");
    const nieuw: Msg[] = [...messages, { role: "user", content: tekst }];
    setMessages(nieuw);
    setVraag("");
    setBusy(true);
    try {
      const res = await fetch("/api/admin/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, thread: "lead", messages: nieuw }),
      });
      const data = await res.json();
      if (data.ok) {
        setMessages([...nieuw, { role: "assistant", content: data.answer || "" }]);
        onVeranderd?.();
      } else {
        setError(data.error || "Er ging iets mis.");
        setMessages(nieuw);
      }
    } catch {
      setError("Er ging iets mis bij het versturen.");
    } finally {
      setBusy(false);
    }
  }

  async function wis() {
    if (!window.confirm("Dit gesprek wissen? Het dossier en de documenten blijven staan.")) return;
    await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=lead`, { method: "DELETE" });
    setMessages([]);
  }

  const base = domain ? `https://${domain}` : "";

  return (
    <div className="card lead-chat">
      <div className="lead-chat-kop">
        <div>
          <div className="lead-chat-titel">Gesprek over {naam}</div>
          <div className="lead-chat-sub">Vertel gewoon wat je wilt. De chat kent het dossier en kan zelf meten.</div>
        </div>
        {messages.length > 0 && (
          <button className="btn btn-klein" onClick={wis} title="Begin een nieuw gesprek">Wis gesprek</button>
        )}
      </div>

      <div className="lead-chat-verloop">
        {!geladen && <div className="muted">Bezig met laden…</div>}
        {geladen && messages.length === 0 && (
          <div className="lead-chat-leeg">
            <p>Nog geen gesprek. Je kunt hier zo losjes typen als je wilt, bijvoorbeeld:</p>
            <ul>
              <li>Kijk eens hoe deze website ervoor staat, en wat er te winnen valt.</li>
              <li>Hoe staat de pagina /diensten/ ervoor ten opzichte van de concurrentie?</li>
              <li>Maak een SEO-voorstel. Budget mag 1500 per maand, ze hechten aan duurzaamheid.</li>
              <li>Hier is een Ads-analyse van een collega, maak er een Pingwin-document van.</li>
            </ul>
            <p className="muted">Wat blijvend geldt voor dit bedrijf bewaart de chat zelf in het dossier hiernaast.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={"lead-bericht " + (m.role === "user" ? "van-mij" : "van-ai")}>
            {m.role === "assistant"
              ? <div className="md" dangerouslySetInnerHTML={{ __html: mdToHtml(m.content, base) }} />
              : <div className="lead-bericht-tekst">{m.content}</div>}
          </div>
        ))}
        {busy && <div className="lead-bericht van-ai"><span className="muted">Bezig… meten en nadenken kan even duren.</span></div>}
        <div ref={bodemRef} />
      </div>

      {error && <div className="login-error" style={{ marginTop: "var(--s-3)" }}>{error}</div>}

      <div className="lead-chat-invoer">
        <textarea
          ref={veldRef}
          value={vraag}
          onChange={(e) => setVraag(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); verstuur(); } }}
          placeholder="Typ of plak wat je kwijt wilt. Cmd/Ctrl + Enter verstuurt."
          rows={3}
        />
        <button className="btn btn-primary" onClick={verstuur} disabled={busy || !vraag.trim()}>
          {busy ? "Bezig…" : "Versturen"}
        </button>
      </div>
    </div>
  );
}
