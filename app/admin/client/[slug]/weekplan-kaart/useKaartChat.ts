"use client";

// Het gesprek achter een projectkaart. Met pagina is dat exact dezelfde chat als
// in Pagina's (één geheugen per pagina); zonder pagina krijgt de kaart een eigen
// bird's eye-gesprek met de volledige site-context.
//
// Alleen de logica staat hier; het scherm eromheen is KaartChat.tsx. Reden voor
// die knip: het afronden (samenvatten, strategie vastleggen, document maken) en
// het ophalen van de laatste conclusie worden ook buiten de chat gebruikt, door
// het fase-blok.

import { useEffect, useRef, useState } from "react";
import { SUMMARIZE_PROMPT } from "../../../../../lib/strategie-prompt";
import type { DriveMap } from "../DriveMapKiezer";
import type { WpTask } from "./types";

export type ChatMsg = { role: "user" | "assistant"; content: string };

export function useKaartChat({ slug, t, hasInfo, driveMap, refreshBoard, setFoutje, setMelding }: {
  slug: string; t: WpTask; hasInfo: boolean;
  driveMap: DriveMap | null; refreshBoard: () => void;
  setFoutje: (v: string) => void; setMelding: (v: string) => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMsg[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  // Van wanneer is het gesprek dat hier open staat? De kaart toont altijd het
  // meest recente gesprek over deze pagina, maar "meest recent" zegt niets over
  // hoe oud het is: dat kan van vanochtend zijn of van vijf weken terug, en dat
  // verschil bepaalt of de conclusie erin nog geldt. Leeg = nog geen gesprek.
  const [chatDatum, setChatDatum] = useState<{ laatste: string; gestart: string }>({ laatste: "", gestart: "" });
  // Een mislukte vraag krijgt zijn eigen melding, IN de chat. Dat was het echte
  // probleem op 11 augustus: de foutmelding van de chat ging naar `foutje`, en
  // dat blok staat in de fase-lijst. Een kaart zonder pagina heeft geen fase-lijst,
  // dus die melding werd nergens getekend: de vraag verdween en er kwam niets,
  // ook geen uitleg. Dan lijkt het alsof de assistent je vraag negeert.
  const [chatFout, setChatFout] = useState<string>("");
  // Welke eerdere antwoorden je zelf hebt opengeklapt. Standaard staat alleen het
  // LAATSTE antwoord open; alles daarvoor vouwt samen tot zijn eigen kopje. Zonder
  // dit stond hier een muur van tekst, want elk antwoord bleef volledig staan.
  const [openBericht, setOpenBericht] = useState<Record<number, boolean>>({});
  // Bevestigen gebeurt in de rij zelf: het nummer van het bericht dat weg mag,
  // of "chat" voor het hele gesprek.
  const [wegVraag, setWegVraag] = useState<number | "chat" | null>(null);
  const [input, setInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const msgsRef = useRef<HTMLDivElement>(null);
  // Afronden vanaf de kaart, met dezelfde keten als de pagina-chat in Pagina's:
  // samenvatten, de conclusie als vastgelegde strategie, en het document.
  const [vatFase, setVatFase] = useState<"" | "samenvatten" | "vastleggen" | "document">("");

  const laatsteAntwoord = msgs.map((m) => m.role).lastIndexOf("assistant");

  useEffect(() => { msgsRef.current?.scrollTo({ top: msgsRef.current.scrollHeight }); }, [msgs, chatBusy]);

  // Een kaart zonder pagina krijgt een eigen bird's eye-gesprek (volledige
  // site-context en tools), gekoppeld aan deze kaart via een vaste thread.
  const kaartThread = `overzicht:kaart:${t.id}`;

  // De kaart-achtergrond reist als los context-bericht mee (niet opgeslagen,
  // dus de chat-titel blijft de echte vraag en de context is altijd actueel).
  const achtergrond = (): ChatMsg | null => hasInfo
    ? { role: "user", content: `Achtergrond van deze projectkaart "${t.taak}" (context, hoeft geen apart antwoord):\n${t.toelichting.slice(0, 2000)}` }
    : null;

  // De laatste chat-conclusie (assistent-antwoord) van deze pagina, ingekort en
  // plat, zodat hij als sturing mee kan bij het starten van een fase.
  async function chatConclusie(): Promise<string> {
    let laatste = [...msgs].reverse().find((m) => m.role === "assistant")?.content || "";
    if (!laatste && t.url) {
      try {
        const d = await fetch(`/api/admin/page-chats?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(t.url)}`).then((r) => r.json());
        const eerste = d?.chats?.[0];
        if (eerste?.id) {
          const c = await fetch(`/api/admin/page-chats?id=${eerste.id}`).then((r) => r.json());
          const lijst = Array.isArray(c?.chat?.messages) ? (c.chat.messages as ChatMsg[]) : [];
          laatste = [...lijst].reverse().find((m) => m.role === "assistant")?.content || "";
        }
      } catch { /* geen chat, geen conclusie */ }
    }
    return laatste.replace(/<[^>]*>/g, " ").replace(/[#*|]/g, "").replace(/\s+/g, " ").trim().slice(0, 600);
  }

  // Chat: laden bij eerste keer openklappen. Met pagina: de meest recente
  // pagina-chat (zelfde geheugen als Pagina's); zonder pagina: het eigen
  // kaart-gesprek via de bird's eye-chat.
  async function openChat(prefill?: string) {
    setChatOpen(true);
    if (prefill) setInput(prefill);
    if (msgs.length) return;
    try {
      if (t.url) {
        const d = await fetch(`/api/admin/page-chats?slug=${encodeURIComponent(slug)}&url=${encodeURIComponent(t.url)}`).then((r) => r.json());
        const eerste = d?.chats?.[0];
        if (eerste?.id) {
          const c = await fetch(`/api/admin/page-chats?id=${eerste.id}`).then((r) => r.json());
          if (c?.ok && Array.isArray(c.chat?.messages)) {
            setMsgs(c.chat.messages); setChatId(eerste.id);
            setChatDatum({ laatste: eerste.updatedAt || "", gestart: eerste.createdAt || "" });
          }
        }
      } else {
        const d = await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(kaartThread)}&nothreads=1`).then((r) => r.json());
        if (d?.ok) setChatDatum({ laatste: String(d.updatedAt || ""), gestart: "" });
        if (d?.ok && Array.isArray(d.messages)) {
          // Alleen de tekst; actie-kaarten uit dit gesprek renderen we hier niet.
          setMsgs((d.messages as ChatMsg[]).map((m) => ({ role: m.role, content: m.content })).filter((m) => (m.content || "").trim()));
        }
      }
    } catch { /* stil */ }
  }

  // Eén vraag versturen en het antwoord terugkrijgen, met een begrijpelijke reden
  // als het misgaat. Waarom apart: `r.json()` klapte eruit zodra de server géén
  // JSON teruggaf, en dat is precies wat er gebeurt als een zware vraag over de
  // tijdslimiet van vijf minuten loopt (dan komt er een foutpagina terug). Die
  // uitzondering werd stil opgevangen, dus was er geen antwoord én geen uitleg.
  async function vraagAssistent(pad: string, payload: Record<string, unknown>): Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; fout: string }> {
    let res: Response;
    try {
      res = await fetch(pad, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    } catch {
      return { ok: false, fout: "Geen verbinding met het dashboard. Je vraag staat weer in het invulveld; probeer het zo nog een keer." };
    }
    let data: Record<string, unknown> | null = null;
    try { data = await res.json() as Record<string, unknown>; } catch { data = null; }
    if (!data) {
      return { ok: false, fout: res.status === 504 || res.status === 408 || res.status === 502
        ? "Deze vraag duurde te lang en is na vijf minuten afgebroken; er kwam dus geen antwoord terug. Splits hem in twee kleinere vragen, of stel hem gerichter (één pagina of één keuze tegelijk)."
        : `De assistent gaf geen leesbaar antwoord terug (foutcode ${res.status}). Probeer het opnieuw.` };
    }
    if (!data.ok) return { ok: false, fout: String(data.error || "De assistent is niet bereikbaar.") };
    return { ok: true, data };
  }

  async function sendChat() {
    const tekst = input.trim();
    if (!tekst || chatBusy) return;
    setInput(""); setChatBusy(true); setChatFout("");
    const voorheen = msgs;
    const next: ChatMsg[] = [...msgs, { role: "user", content: tekst }];
    setMsgs(next);
    // Mislukt het, dan gaat de vraag terug naar het invulveld en verdwijnt de
    // losse vraagballon weer. Anders bleef er een vraag zonder antwoord hangen en
    // moest je hem opnieuw intypen of plakken; dat is hoe dezelfde vraag twee keer
    // onder elkaar kwam te staan zonder dat er ooit een antwoord onder kwam.
    const mislukt = (fout: string) => { setMsgs(voorheen); setInput(tekst); setChatFout(fout); };
    try {
      const seed = achtergrond();
      const outgoing = seed ? [seed, ...next.slice(-11)] : next.slice(-12);
      if (t.url) {
        const r = await vraagAssistent("/api/admin/page-chat", { slug, url: t.url, messages: outgoing });
        if (!r.ok) { mislukt(r.fout); return; }
        const withReply: ChatMsg[] = [...next, { role: "assistant", content: String(r.data.reply || "") }];
        setMsgs(withReply);
        const s = await fetch("/api/admin/page-chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, id: chatId, messages: withReply }) }).then((res) => res.json()).catch(() => null);
        if (s?.ok && s.id) setChatId(s.id);
        // Er is net iets gezegd, dus dit gesprek is van vandaag. Zonder deze
        // regel bleef de datum in de kop op de oude stand staan tot je de kaart
        // opnieuw opende.
        setChatDatum((d) => ({ laatste: new Date().toISOString(), gestart: d.gestart || new Date().toISOString() }));
      } else {
        const r = await vraagAssistent("/api/admin/chat", { slug, thread: kaartThread, messages: outgoing });
        if (!r.ok) { mislukt(r.fout); return; }
        const withReply: ChatMsg[] = [...next, { role: "assistant", content: String(r.data.answer || "") }];
        setMsgs(withReply);
        // De server slaat inclusief het context-bericht op; vervang de historie
        // meteen door de schone lijst zodat de seed nooit in beeld komt.
        await fetch("/api/admin/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread: kaartThread, messages: withReply }) }).catch(() => {});
        setChatDatum((d) => ({ laatste: new Date().toISOString(), gestart: d.gestart }));
      }
    } catch { mislukt("De assistent is niet bereikbaar. Je vraag staat weer in het invulveld."); } finally { setChatBusy(false); }
  }

  // Eén chatbericht weghalen (kruisje); de opgeslagen historie gaat meteen mee.
  // Bevestigen gebeurt in de rij zelf, niet met een browserpopup.
  async function verwijderChatBericht(i: number) {
    setWegVraag(null); setOpenBericht({});
    const nieuw = msgs.filter((_, idx) => idx !== i);
    setMsgs(nieuw);
    try {
      if (t.url) await fetch("/api/admin/page-chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, id: chatId, messages: nieuw }) });
      else await fetch("/api/admin/chat", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, thread: kaartThread, messages: nieuw }) });
    } catch { /* stil */ }
  }

  // Het hele gesprek weggooien. Dat kon hier helemaal niet; je kon alleen bericht
  // voor bericht opruimen. Bij een kaart met pagina gooit dit de opgeslagen
  // pagina-chat weg, bij een kaart zonder pagina het eigen kaart-gesprek.
  async function wisChat() {
    setWegVraag(null); setMsgs([]); setOpenBericht({}); setChatDatum({ laatste: "", gestart: "" });
    try {
      if (t.url) { if (chatId !== null) await fetch(`/api/admin/page-chats?id=${chatId}`, { method: "DELETE" }); setChatId(null); }
      else await fetch(`/api/admin/chat?slug=${encodeURIComponent(slug)}&thread=${encodeURIComponent(kaartThread)}`, { method: "DELETE" });
    } catch { /* stil */ }
  }

  // Dezelfde afsluitknop als in de pagina-chat: het hele gesprek wordt samengevat,
  // de conclusie wordt de vastgelegde strategie (de basis voor de volgende fases)
  // en er komt een Pingwin-document van in de Drive-map, als afgeronde werkzaamheid.
  async function vatSamenEnLegVast() {
    if (!t.url || chatBusy || vatFase) return;
    const voorheen = msgs;
    const next: ChatMsg[] = [...msgs, { role: "user", content: SUMMARIZE_PROMPT }];
    setVatFase("samenvatten"); setChatBusy(true); setFoutje(""); setMelding("");
    setMsgs(next);
    try {
      // Voor de samenvatting gaat het héle gesprek ongekort mee, plus de
      // kaart-achtergrond als context (net als bij een gewone vraag).
      const seed = achtergrond();
      const outgoing = seed ? [seed, ...next] : next;
      // Via dezelfde robuuste weg als een gewone vraag. Stond hier als kale
      // fetch met `r.json()`, en dat klapt stuk zodra de server géén JSON
      // teruggeeft (een tijdslimiet geeft een foutpagina). Je kreeg dan
      // "Samenvatten mislukt, probeer het nog een keer" zonder enige reden,
      // terwijl de echte oorzaak wél te benoemen was. Gebeurde op 20-08-2026
      // bij /hovenier-oss/.
      const r = await vraagAssistent("/api/admin/page-chat", { slug, url: t.url, messages: outgoing, volledig: true });
      if (!r.ok) { setFoutje(r.fout); setMsgs(voorheen); return; }
      const d = r.data as { reply?: string; proposal?: { plan?: string } };
      if (!String(d.reply || "").trim()) { setFoutje("Het samenvatten leverde geen tekst op. Probeer het nog een keer; blijft het gebeuren, vat dan samen vanuit Pagina's."); setMsgs(voorheen); return; }
      const withReply: ChatMsg[] = [...next, { role: "assistant", content: String(d.reply) }];
      setMsgs(withReply);
      const s = await fetch("/api/admin/page-chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, id: chatId, messages: withReply }) }).then((r) => r.json()).catch(() => null);
      if (s?.ok && s.id) setChatId(s.id);
      setVatFase("vastleggen");
      const plan = String(d.proposal?.plan || "").trim() || String(d.reply);
      const a = await fetch("/api/admin/page-chat/accept", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, plan }) }).then((r) => r.json());
      if (!a?.ok) { setFoutje(a?.error || "Strategie vastleggen mislukte."); return; }
      setVatFase("document");
      const doc = await fetch("/api/admin/page-analysis-doc", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, url: t.url, analysis: String(d.reply), background: true, ...(driveMap ? { folderId: driveMap.id } : {}) }) }).then((r) => r.json()).catch(() => null);
      setMelding(doc?.ok
        ? `Strategie vastgelegd. Het document wordt op de achtergrond gemaakt${driveMap ? ` in "${driveMap.path || driveMap.name}"` : ""} en verschijnt als werkzaamheid.`
        : "Strategie vastgelegd. Alleen het document maken lukte niet; probeer dat zo opnieuw (of vanuit de pagina-chat in Pagina's).");
      refreshBoard();
    } catch { setFoutje("Samenvatten mislukt, probeer het nog een keer."); setMsgs(voorheen); }
    finally { setVatFase(""); setChatBusy(false); }
  }

  return {
    chatOpen, setChatOpen, msgs, chatFout, openBericht, setOpenBericht, wegVraag, setWegVraag,
    input, setInput, chatBusy, msgsRef, vatFase, laatsteAntwoord, chatDatum,
    openChat, sendChat, verwijderChatBericht, wisChat, vatSamenEnLegVast, chatConclusie,
  };
}

export type KaartChatState = ReturnType<typeof useKaartChat>;
