"use client";

// ═══════════════════════════════════════════════════════════
// HET KNOPJE "TWEAK" OP ELK BEHEERSCHERM
// ═══════════════════════════════════════════════════════════
// Maarten ziet kleine dingen terwijl hij werkt. Tot nu toe kostte zo'n ding een
// hele chat: uitleggen wélk scherm, wat er staat, wat er anders moet, en dan een
// bouw plus deploy voor die ene regel.
//
// Dit knopje hangt in de gedeelde adminschil, dus het staat op élk beheerscherm
// zonder dat een pagina er iets voor hoeft door te geven. Je meldt de tweak op
// het moment dat je hem ziet, vanaf het scherm waar je al staat. Het scherm, het
// pad en de klant gaan automatisch mee; die hoeft hij dus nooit te beschrijven.
//
// Waarom een schermafbeelding erin kan: de meeste tweaks gaan over hoe iets
// eruitziet, en de omgeving waarin gebouwd wordt kan geen browser openen. Eén
// geplakt beeld scheelt de heen-en-weer die anders volgt op "welk venster
// bedoel je precies".
// ═══════════════════════════════════════════════════════════

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { SCHERMEN } from "./OntwikkelMenu";

/**
 * Hoe heet dit scherm in gewone taal? Zodat de stapel later leesbaar is en er
 * niet dertig keer een kaal pad in staat.
 *
 * De vaste beheerschermen komen uit dezelfde lijst als het Intern-menu (één
 * bron). Klantschermen hebben een slug in het pad en staan daar dus niet in;
 * die krijgen "Cockpit <klant>", met het tabblad erbij als dat in de URL staat.
 */
export function schermNaam(pad: string, tab: string | null): string {
  const klant = /^\/admin\/client\/([^/]+)/.exec(pad);
  if (klant) {
    const rest = pad.slice(klant[0].length).replace(/^\//, "");
    const deel = tab || rest || "overzicht";
    return `Cockpit ${klant[1]} (${deel})`;
  }
  const treffer = SCHERMEN
    .filter((s) => pad === s.pad || pad.startsWith(s.pad + "/"))
    .sort((a, b) => b.pad.length - a.pad.length)[0];
  return treffer ? treffer.naam : pad;
}

function klantUitPad(pad: string): string | null {
  return /^\/admin\/client\/([^/]+)/.exec(pad)?.[1] ?? null;
}

/**
 * Een schermafbeelding samendrukken vóór het versturen. Een knip van een groot
 * scherm is al gauw enkele megabytes, en dat is zonde van de opslag én van de
 * wachttijd bij het melden. Maximaal 1400 pixels breed is ruim genoeg om te
 * zien waar een venster staat en wat eraan mankeert.
 */
async function verklein(bestand: Blob): Promise<string> {
  const beeld = await createImageBitmap(bestand);
  const schaal = Math.min(1, 1400 / beeld.width);
  const doek = document.createElement("canvas");
  doek.width = Math.round(beeld.width * schaal);
  doek.height = Math.round(beeld.height * schaal);
  doek.getContext("2d")?.drawImage(beeld, 0, 0, doek.width, doek.height);
  return doek.toDataURL("image/jpeg", 0.72);
}

export default function TweakKnop() {
  const pad = usePathname() || "";
  const zoek = useSearchParams();
  const [open, setOpen] = useState(false);
  const [tekst, setTekst] = useState("");
  const [beeld, setBeeld] = useState<string>("");
  const [bezig, setBezig] = useState(false);
  const [fout, setFout] = useState("");
  const [tellers, setTellers] = useState<{ wachtrij: number; controleer: number } | null>(null);
  const [klaar, setKlaar] = useState(false);
  // Kleine aanpassing of een groter idee: hetzelfde knopje, twee bakken. Een
  // idee gaat niet mee in een ronde maar krijgt eerst een voorstel van mij.
  const [soort, setSoort] = useState<"tweak" | "idee">("tweak");
  const veldRef = useRef<HTMLTextAreaElement>(null);

  const scherm = schermNaam(pad, zoek?.get("tab") ?? null);

  // Het aantal op de stapel staat op het knopje, zodat je ziet dat het oploopt
  // zonder ergens heen te gaan.
  const telOpnieuw = useCallback(() => {
    fetch("/api/admin/tweaks?tel=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j?.ok) setTellers(j.tellers); })
      .catch(() => {});
  }, []);

  useEffect(() => { telOpnieuw(); }, [telOpnieuw]);

  useEffect(() => {
    if (!open) return;
    veldRef.current?.focus();
    const opToets = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", opToets);
    return () => window.removeEventListener("keydown", opToets);
  }, [open]);

  async function neemBestand(bestand: Blob | null | undefined) {
    if (!bestand || !bestand.type.startsWith("image/")) return;
    try { setBeeld(await verklein(bestand)); } catch { setFout("Die afbeelding kon ik niet lezen."); }
  }

  async function verstuur() {
    if (!tekst.trim() || bezig) return;
    setBezig(true); setFout("");
    try {
      const r = await fetch("/api/admin/tweaks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tekst, pad, scherm, klant: klantUitPad(pad), beeld, soort }),
      });
      const j = await r.json().catch(() => null);
      if (!r.ok || !j?.ok) { setFout(j?.error || "Opslaan lukte niet."); return; }
      setTellers(j.tellers);
      setKlaar(true);
      setTekst(""); setBeeld(""); setSoort("tweak");
      // Even laten staan zodat je de bevestiging ziet, dan vanzelf dicht.
      setTimeout(() => { setKlaar(false); setOpen(false); }, 1200);
    } catch {
      setFout("Opslaan lukte niet.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="tw-knop"
        onClick={() => { setOpen(true); setFout(""); }}
        title="Iets dat anders moet op dit scherm? Meld het hier."
      >
        Tweak
        {tellers?.wachtrij ? <span className="tw-teller">{tellers.wachtrij}</span> : null}
        {tellers?.controleer ? <span className="tw-teller tw-teller-kijk" title="Staat live, wacht op jouw controle">{tellers.controleer}</span> : null}
      </button>

      {open && (
        // Bewust géén sluiten bij een klik op de achtergrond: een venster hoort
        // alleen dicht te gaan via het kruisje, Annuleren of Escape. Anders ben
        // je je getypte tekst kwijt door één misklik naast het venster.
        <div className="tw-overlay">
          <div className="tw-venster" role="dialog" aria-label="Tweak melden">
            <div className="tw-kop">
              <div>
                <div className="tw-titel">Wat moet er anders?</div>
                <div className="tw-context">{scherm}</div>
              </div>
              <button type="button" className="tw-sluit" onClick={() => setOpen(false)} aria-label="Sluiten">×</button>
            </div>

            <div className="tw-body">
              <div className="tw-soort">
                <button
                  type="button"
                  className={"btn btn-klein" + (soort === "tweak" ? " btn-primary" : " btn-ghost")}
                  onClick={() => setSoort("tweak")}
                >
                  Kleine aanpassing
                </button>
                <button
                  type="button"
                  className={"btn btn-klein" + (soort === "idee" ? " btn-primary" : " btn-ghost")}
                  onClick={() => setSoort("idee")}
                >
                  Groter idee
                </button>
              </div>
              <p className="tw-soort-uitleg">
                {soort === "tweak"
                  ? "Gaat mee in de eerstvolgende ronde en staat vandaag nog live."
                  : "Wordt niet meteen gebouwd. Ik maak er eerst een voorstel van dat jij goed- of afkeurt."}
              </p>
              <textarea
                ref={veldRef}
                className="tw-veld"
                value={tekst}
                onChange={(e) => setTekst(e.target.value)}
                onPaste={(e) => {
                  const item = [...e.clipboardData.items].find((i) => i.type.startsWith("image/"));
                  if (item) { e.preventDefault(); void neemBestand(item.getAsFile()); }
                }}
                placeholder="Typ of dicteer wat er niet klopt en wat je wilt zien. Rommelig mag."
              />
              <div className="tw-hulp">
                Schermafbeelding erin plakken kan gewoon met Ctrl/Cmd+V, of kies er een.
              </div>

              {beeld ? (
                <div className="tw-beeld">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={beeld} alt="Meegestuurde schermafbeelding" />
                  <button type="button" className="btn btn-quiet btn-klein" onClick={() => setBeeld("")}>Beeld weghalen</button>
                </div>
              ) : (
                <label className="tw-kies">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => { void neemBestand(e.target.files?.[0]); e.target.value = ""; }}
                  />
                  <span>Kies een afbeelding</span>
                </label>
              )}

              {fout && <div className="tw-fout">{fout}</div>}
              {klaar && <div className="tw-ok">Staat op de stapel.</div>}
            </div>

            <div className="tw-acties">
              <button type="button" className="btn btn-primary" onClick={() => void verstuur()} disabled={!tekst.trim() || bezig}>
                {bezig ? "Bezig…" : "Op de stapel"}
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Annuleren</button>
              <a className="btn btn-quiet tw-naar-stapel" href="/admin/tweaks">
                Bekijk de stapel{tellers?.wachtrij ? ` (${tellers.wachtrij})` : ""}
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
