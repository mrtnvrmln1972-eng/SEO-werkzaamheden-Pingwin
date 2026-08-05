// Gedeelde vouwkop voor chats.
//
// Antwoorden in een chat zijn lang; eerdere antwoorden klappen daarom dicht tot
// één regel. Op die regel staat het eerste kopje van het antwoord, zodat je nog
// steeds ziet waar het over ging. Deze functie stond alleen in OverviewChat;
// de pagina-chat gebruikt hem nu ook, dus hij hoort op één plek te staan.

export function eersteKop(md: string): string {
  for (const raw of (md || "").split("\n")) {
    const r = raw.trim();
    const kop = /^#{1,3}\s+(.*)$/.exec(r);
    if (kop) return kop[1].replace(/[#*]/g, "").trim().slice(0, 90);
  }
  const tekst = (md || "").replace(/^[-*#>\s]+/, "").replace(/\*\*/g, "").trim();
  return (tekst.split(/(?<=[.!?])\s/)[0] || tekst).slice(0, 90) || "Eerder antwoord";
}
