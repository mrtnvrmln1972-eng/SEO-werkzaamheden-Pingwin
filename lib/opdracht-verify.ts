// Automatisch checken of een losse opdrachtregel ("Opdrachten in deze kaart")
// is doorgevoerd. Niet elke opdracht is meetbaar (een instructie die alleen
// per mail naar de developer ging levert geen paginafeit op); dan is het
// eerlijke antwoord "kon ik niet automatisch checken", nooit een gok.
//
// Wat wél gecheckt wordt: paden/URL's die letterlijk in de opdrachttekst
// staan (bijv. "/hovenier-oss/"), her-fetcht tegen de live site. Dat bewijst
// dat de pagina bestaat en bereikbaar is, niet dat de instructie inhoudelijk
// klopt (bijv. dat de parent-structuur goed staat) — de melding zegt precies
// wat er gemeten is, zodat dat onderscheid nooit verloren gaat.

import { setOpdrachtMark } from "./opdracht-marks";

async function fetchStatus(u: string): Promise<number | null> {
  try {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 15000);
    const res = await fetch(u, { headers: { "User-Agent": "Mozilla/5.0 (compatible; PingwinDashboard)" }, signal: ctl.signal, redirect: "follow" });
    clearTimeout(t);
    return res.status;
  } catch { return null; }
}

const PAD_RE = /\/[a-z0-9][a-z0-9-]*(?:\/[a-z0-9][a-z0-9-]*)*\/?/gi;

export async function verifyOpdracht(taskId: number, tekst: string, referentieUrl: string): Promise<{ ok: boolean; melding: string }> {
  const paden = [...new Set((tekst.match(PAD_RE) || []).map((p) => p.toLowerCase()))].slice(0, 4);
  if (!paden.length) {
    const melding = "Geen specifieke URL in deze opdracht gevonden om automatisch te toetsen; bekijk de live pagina zelf en vink hem met de hand af.";
    await setOpdrachtMark(taskId, tekst, "automatisch_niet", melding);
    return { ok: false, melding };
  }
  let origin = "";
  try { origin = referentieUrl ? new URL(referentieUrl).origin : ""; } catch { origin = ""; }
  const resultaten: { pad: string; status: number | null }[] = [];
  for (const pad of paden) {
    const doel = /^https?:\/\//i.test(pad) ? pad : (origin ? new URL(pad, origin).toString() : "");
    resultaten.push({ pad, status: doel ? await fetchStatus(doel) : null });
  }
  const alleLive = resultaten.every((r) => r.status !== null && r.status < 400);
  const zonderOrigin = !origin && resultaten.some((r) => r.status === null);
  const detail = resultaten.map((r) => `${r.pad} → ${r.status ?? "niet te bereiken"}`).join(", ");
  const melding = zonderOrigin
    ? `Geen paginakoppeling op deze kaart om ${paden.join(", ")} tegen te bereiken; beoordeel zelf.`
    : `Live gecontroleerd: ${detail}. ${alleLive ? "Alles live." : "Nog niet (alles) live."}`;
  await setOpdrachtMark(taskId, tekst, alleLive ? "automatisch_ok" : "automatisch_niet", melding);
  return { ok: alleLive, melding };
}
