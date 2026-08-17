"use client";

// Bespreeklijsten per persoon: kleine afvinklijstjes onder de Actuele stand van
// zaken. Per persoon (Klant, Dev, ...) een toggle met alles wat Maarten wil
// bespreken, laten uitvoeren of controleren. Afvinken streept door (blijft
// zichtbaar), mailen zet alle open punten in een nette mail en stempelt
// "gedeeld", zodat je ziet wat de ander al heeft en wat er nieuw is.
//
// Een punt is opgemaakte tekst: je klikt hem aan en typt, met vet, bullets en
// links, in hetzelfde veld als "Zoekwoorden & links". URL's en slugs worden
// automatisch klikbaar, ook in de punten die als platte tekst zijn binnengekomen
// (vanuit een AI-antwoord, een projectkaart of een takenvoorstel).

import { useEffect, useRef, useState } from "react";
import { persoonLabel, devVoornaam } from "../../../../lib/personen";
import { netteHtml } from "../../../../lib/nette-html";
import { escapeHtml, isHtml, htmlNaarTekst } from "../../../../lib/veilige-html";
import { openMailProgramma } from "../../../../lib/mailto-openen";
import RijkTekstVeld from "../../../_velden/RijkTekstVeld";
import AdresVeld from "./AdresVeld";

type Item = { id: number; persoon: string; tekst: string; klaar: boolean; gedeeldAt: string | null; createdAt: string | null };

export default function BespreekLijsten({ slug, clientName, clientEmail, domain }: { slug: string; clientName?: string; clientEmail?: string; domain?: string | null }) {
  // Standaard dicht, net als "Laatste mails": de hele kaart achter één toggle,
  // in plaats van de koppen van alle lijstjes altijd in beeld.
  const [kaartOpen, setKaartOpen] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [openLijst, setOpenLijst] = useState<string>("");
  const [invoer, setInvoer] = useState<Record<string, string>>({});
  const [invoerKey, setInvoerKey] = useState(0);   // reset het invoerveld na toevoegen
  const [nieuwNaam, setNieuwNaam] = useState("");
  const [toonNieuw, setToonNieuw] = useState(false);
  const [busy, setBusy] = useState(false);
  // Developer van DEZE klant; leeg = gewoon "Dev", geen verzonnen naam.
  const [devNaam, setDevNaam] = useState<string | null>(null);
  // Welk punt je aan het bewerken bent, en de laatste tekst daarvan.
  const [bewerkId, setBewerkId] = useState<number | null>(null);
  const bewerkTekstRef = useRef("");
  const bewaarTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Mailen vanuit het dashboard (met opmaak) in plaats van via mailto.
  const [mailVoor, setMailVoor] = useState<string | null>(null);
  const [mailAan, setMailAan] = useState("");
  const [mailBusy, setMailBusy] = useState(false);
  const [mailMsg, setMailMsg] = useState("");
  const [mailKan, setMailKan] = useState(false);

  const host = (domain || "").replace(/^https?:\/\//i, "").replace(/\/+$/, "");

  async function laad() {
    const d = await fetch(`/api/admin/discuss?slug=${encodeURIComponent(slug)}`).then((r) => r.json()).catch(() => null);
    if (d?.ok) { setItems(d.items || []); setDevNaam(d.devName || null); }
  }
  useEffect(() => { void laad(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [slug]);
  // Kan het dashboard zelf mailen? Zo niet, dan valt de knop terug op je eigen
  // mailprogramma (en gaat de opmaak verloren, want mailto kan alleen tekst).
  useEffect(() => {
    fetch("/api/admin/mail?status=1").then((r) => r.json()).then((d) => setMailKan(!!d?.connected)).catch(() => setMailKan(false));
  }, []);

  const DEFAULTS = ["Klant", "Dev"];
  const personen = [...new Set([...DEFAULTS, ...items.map((i) => i.persoon)])];
  const van = (p: string) => items.filter((i) => i.persoon === p);
  const labelVan = (p: string) => persoonLabel(p, { devName: devNaam, clientName });

  // Een punt als nette HTML, via de gedeelde poort. Deed hier eerst iets eigens
  // en zwakkers: platte tekst werd alleen geëscaped met <br>'s ertussen, dus een
  // punt met een kopje of een opsomming erin kwam als `## Kopje` en `- punt`
  // letterlijk in beeld. Nu gaat het door dezelfde renderer als de rest.
  const puntHtml = (tekst: string) => netteHtml(tekst, { basis: host });

  async function post(body: Record<string, unknown>) {
    setBusy(true);
    try { await fetch("/api/admin/discuss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...body }) }); await laad(); }
    catch { /* volgende laad herstelt het beeld */ }
    finally { setBusy(false); }
  }
  async function voegToe(p: string) {
    const tekst = (invoer[p] || "").trim();
    if (!tekst || tekst === "<br>") return;
    setInvoer({ ...invoer, [p]: "" });
    setInvoerKey((k) => k + 1);
    await post({ action: "add", persoon: p, tekst });
  }

  // Bewerken: bewaart vanzelf tijdens het typen, en bij het sluiten meteen.
  function bewerkWijzig(id: number, html: string) {
    bewerkTekstRef.current = html;
    if (bewaarTimer.current) clearTimeout(bewaarTimer.current);
    bewaarTimer.current = setTimeout(() => {
      void fetch("/api/admin/discuss", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, action: "edit", id, tekst: html }) });
      setItems((lijst) => lijst.map((i) => (i.id === id ? { ...i, tekst: html } : i)));
    }, 900);
  }
  async function bewerkKlaar(id: number) {
    if (bewaarTimer.current) clearTimeout(bewaarTimer.current);
    const html = bewerkTekstRef.current;
    setBewerkId(null);
    if (!html.trim()) return;
    setItems((lijst) => lijst.map((i) => (i.id === id ? { ...i, tekst: html } : i)));
    await post({ action: "edit", id, tekst: html });
  }

  function mailOpenen(p: string) {
    setMailMsg("");
    setMailVoor(p);
    // Leeg beginnen, altijd (ADRESVELD-REGEL, zie MailUitKaart.tsx). Hier werd
    // het laatst gebruikte developer-adres ingevuld, en dat geheugen was gedeeld
    // over alle klanten heen.
    setMailAan("");
  }

  function mailTekst(p: string): { onderwerp: string; aanhef: string; punten: Item[] } {
    const naam = p === "Dev" ? devVoornaam(devNaam) : (clientName || "").split(" ")[0] || "";
    return {
      onderwerp: `Punten om op te pakken (${clientName || "Pingwin"})`,
      aanhef: `Beste ${naam || ""},`,
      punten: van(p).filter((i) => !i.klaar),
    };
  }

  // Versturen vanuit het dashboard: de opmaak van de punten blijft staan.
  async function mailVersturen(p: string) {
    const { onderwerp, aanhef, punten } = mailTekst(p);
    if (!punten.length || !mailAan.trim()) { setMailMsg("Vul een ontvanger in."); return; }
    const html = `<p>${escapeHtml(aanhef)}</p><p>Hierbij de openstaande punten op een rij:</p>` +
      `<ul>${punten.map((i) => `<li>${puntHtml(i.tekst)}</li>`).join("")}</ul>` +
      `<p>Wil je ze oppakken en even laten weten als iets klaar is of vragen oproept?</p>` +
      `<p>Met vriendelijke groet,<br>Maarten Vermeulen<br>Pingwin Online Marketing</p>`;
    setMailBusy(true); setMailMsg("");
    try {
      const d = await fetch("/api/admin/mail", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mode: "compose", slug, to: mailAan.trim(), subject: onderwerp, html }) }).then((r) => r.json());
      if (d?.ok) {
        setMailMsg(`Verstuurd naar ${(d.sentTo || []).join(", ") || mailAan.trim()}.`);
        setMailVoor(null);
        await post({ action: "gedeeld", persoon: p });
      } else setMailMsg(d?.error || "Versturen mislukte.");
    } catch { setMailMsg("Versturen mislukte."); }
    finally { setMailBusy(false); }
  }

  // Terugval zonder mailkoppeling: je eigen mailprogramma, dus platte tekst.
  function mailProgramma(p: string) {
    const { onderwerp, aanhef, punten } = mailTekst(p);
    if (!punten.length) return;
    const body = `${aanhef}\n\nHierbij de openstaande punten op een rij:\n\n${punten.map((i) => `- ${htmlNaarTekst(i.tekst)}`).join("\n")}\n\nWil je ze oppakken en even laten weten als iets klaar is of vragen oproept?\n\nMet vriendelijke groet,\nMaarten Vermeulen\nPingwin Online Marketing`;
    // Zonder ontvanger opent er niets; dan niet stilzwijgend "gedeeld" stempelen.
    if (!openMailProgramma({ aan: mailAan, onderwerp, tekst: body })) {
      setMailMsg("Vul eerst een ontvanger in.");
      return;
    }
    setMailVoor(null);
    void post({ action: "gedeeld", persoon: p });
  }

  const dd = (d: string | null) => { try { return d ? new Date(d).toLocaleDateString("nl-NL", { day: "numeric", month: "short" }) : ""; } catch { return ""; } };

  const totaalOpen = items.filter((i) => !i.klaar).length;

  return (
    <div className="cockpit-card strategy-card">
      <button type="button" className="strategy-head" onClick={() => setKaartOpen((v) => !v)}>
        <span className="strategy-caret">{kaartOpen ? "▾" : "▸"}</span>
        <span className="strategy-title">Bespreeklijsten</span>
        {totaalOpen > 0 && <span className="wp-count">{totaalOpen}</span>}
      </button>
      <div className="strategy-body" style={{ display: kaartOpen ? undefined : "none" }}>
      <div className="bl-kop">
        <div className="bl-kop-tekst">
          <span className="bl-sub muted">Per persoon: bijhouden, afvinken en in één klik mailen.</span>
        </div>
        <span className="wp-fase-spacer" />
        {toonNieuw ? (
          <span className="bl-nieuw-rij">
            <input className="wp-docdrop-input" value={nieuwNaam} placeholder="Naam, bijv. Tekstschrijver" autoFocus
              onChange={(e) => setNieuwNaam(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && nieuwNaam.trim()) { setOpenLijst(nieuwNaam.trim()); setToonNieuw(false); void post({ action: "add", persoon: nieuwNaam.trim(), tekst: "Eerste punt (pas aan of verwijder)" }); setNieuwNaam(""); } }} />
          </span>
        ) : (
          <button type="button" className="ghost-btn small" onClick={() => setToonNieuw(true)}>+ lijstje</button>
        )}
      </div>
      {personen.map((p) => {
        const lijst = van(p);
        const open = lijst.filter((i) => !i.klaar);
        const isOpen = openLijst === p;
        const gedeeld = lijst.map((i) => i.gedeeldAt).filter(Boolean).sort().pop() || null;
        return (
          <div key={p} className="bl-lijst">
            <button type="button" className="strategy-head bl-head" onClick={() => setOpenLijst(isOpen ? "" : p)}>
              <span className="strategy-caret">{isOpen ? "▾" : "▸"}</span>
              <span className="bl-titel">Bespreken met {labelVan(p)}</span>
              {open.length > 0 && <span className="wp-count">{open.length}</span>}
              {gedeeld && <span className="bl-gedeeld muted">gedeeld {dd(gedeeld)}</span>}
            </button>
            {isOpen && (
              <div className="bl-body">
                <div className="bl-add">
                  <div className="bl-add-veld">
                    <RijkTekstVeld
                      key={`${p}-${invoerKey}`}
                      waarde=""
                      klasse="bl-invoer"
                      placeholder="Nieuw punt; plak gerust een rijtje URL's…"
                      onChange={(html) => setInvoer((v) => ({ ...v, [p]: html }))}
                    />
                  </div>
                  <div className="bl-add-knoppen">
                    <button type="button" className="wp-fase-btn" disabled={busy || !(invoer[p] || "").replace(/<br>|\s/g, "")} onClick={() => void voegToe(p)}>Voeg toe</button>
                    <button type="button" className="wp-fase-btn wp-fase-btn-primair" disabled={busy || !open.length} title="Alle open punten als nette mail, met opmaak en klikbare links; de lijst onthoudt dat je ze gedeeld hebt." onClick={() => mailOpenen(p)}>Mail ({open.length})</button>
                  </div>
                </div>
                {mailVoor === p && (
                  <div className="bl-mail">
                    <label className="bl-mail-label">Aan</label>
                    {/* Zelfde adresveld als in de mailvensters: het veld begint
                        leeg en stelt namen voor uit de eigen contacten zodra je
                        twee letters typt. Hier stond een kaal invulvak zonder
                        die hulp, en dus was een voorgevuld adres verleidelijk. */}
                    <AdresVeld waarde={mailAan} onChange={setMailAan} className="wp-docdrop-input"
                      placeholder="naam@bedrijf.nl" />
                    {mailKan
                      ? <button type="button" className="wp-fase-btn wp-fase-btn-primair" disabled={mailBusy || !mailAan.trim()} onClick={() => void mailVersturen(p)}>{mailBusy ? "Versturen…" : "Verstuur"}</button>
                      : <button type="button" className="wp-fase-btn" disabled={!mailAan.trim()} title="Geen mailkoppeling; dit opent je eigen mailprogramma zonder opmaak." onClick={() => mailProgramma(p)}>Open in mailprogramma</button>}
                    <button type="button" className="wp-fase-btn" onClick={() => { setMailVoor(null); setMailMsg(""); }}>Annuleren</button>
                  </div>
                )}
                {mailMsg && <div className="bl-mail-msg muted">{mailMsg}</div>}
                {lijst.length === 0 && <div className="muted">Nog geen punten; typ hierboven het eerste punt.</div>}
                <ul className="bl-punten">
                  {lijst.map((i) => (
                    <li key={i.id} className={i.klaar ? "bl-klaar" : ""}>
                      <label className="bl-check">
                        <input type="checkbox" checked={i.klaar} onChange={(e) => void post({ action: "vink", id: i.id, klaar: e.target.checked })} />
                      </label>
                      {bewerkId === i.id ? (
                        <div className="bl-tekst bl-bewerk">
                          <RijkTekstVeld
                            waarde={isHtml(i.tekst) ? i.tekst : escapeHtml(i.tekst).replace(/\r?\n/g, "<br>")}
                            autoFocus
                            onChange={(html) => bewerkWijzig(i.id, html)}
                            onKlaar={() => void bewerkKlaar(i.id)}
                            toolbarExtra={<button type="button" className="bl-bewerk-klaar" onClick={() => void bewerkKlaar(i.id)}>klaar</button>}
                          />
                        </div>
                      ) : (
                        <span
                          className="bl-tekst md bl-tekst-klik"
                          title="Klik om dit punt aan te passen"
                          onClick={(e) => { if (!(e.target as HTMLElement).closest("a")) { bewerkTekstRef.current = i.tekst; setBewerkId(i.id); } }}
                          dangerouslySetInnerHTML={{ __html: puntHtml(i.tekst) }}
                        />
                      )}
                      {!i.klaar && i.gedeeldAt == null && gedeeld && <span className="bl-nieuw">nieuw</span>}
                      <button type="button" className="wp-icon wp-del" title="Punt verwijderen" onClick={() => void post({ action: "del", id: i.id })}>×</button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
