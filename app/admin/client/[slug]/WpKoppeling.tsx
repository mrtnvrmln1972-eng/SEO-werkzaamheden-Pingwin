"use client";

// ═══════════════════════════════════════════════════════════
// DE WORDPRESS-KOPPELING: ÉÉN FORMULIER, OVERAL HETZELFDE
// ═══════════════════════════════════════════════════════════
// Het applicatiewachtwoord van de site van een klant werd op twee schermen
// ingevuld, met twee eigen formulieren en twee eigen opslagen: op het tabblad
// Wijzigingen (mét test) en op Meta & CTR (zónder test). Die twee liepen uit
// elkaar, en op 21-08-2026 zag Maarten het gevolg bij GardenSwimm: op Wijzigingen
// stond "WordPress is gekoppeld" en werd de hele bewerkingshistorie opgehaald,
// terwijl Meta & CTR in dezelfde minuut meldde "De site weigert de koppeling".
// Allebei waar, want het waren twee verschillende wachtwoorden.
//
// Dit is nu het enige formulier, en het schrijft naar de enige opslag
// (lib/wp-creds.ts, die eerst test). Bouw er nooit een tweede naast; zet dit
// component neer op de plek waar iemand tegen het probleem aanloopt.
//
// Het opent zichzelf zodra er een probleem gemeld wordt (`probleem`): dat is
// precies het moment waarop je hem nodig hebt, en dan hoort hij niet achter een
// knop te zitten die als een statusmelding leest.

import { useCallback, useEffect, useState } from "react";

export type WpStand = { gekoppeld: boolean; gebruiker: string };

export default function WpKoppeling({ slug, probleem, waarvoor, onStand }: {
  slug: string;
  /** Melding van het scherm eromheen ("de site weigert de koppeling"). Staat hij
      er, dan gaat het formulier vanzelf open met die reden erboven. */
  probleem?: string;
  /** Eén zin: waar deze koppeling in dít scherm voor dient. */
  waarvoor?: string;
  onStand?: (s: WpStand) => void;
}) {
  const [gekoppeld, setGekoppeld] = useState(false);
  const [gebruiker, setGebruiker] = useState("");
  const [open, setOpen] = useState(false);
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState("");
  const [gelukt, setGelukt] = useState(false);

  const meld = useCallback((s: WpStand) => { onStand?.(s); }, [onStand]);

  useEffect(() => {
    let leeft = true;
    fetch(`/api/admin/wp-creds?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!leeft || !d?.ok) return;
        setGekoppeld(!!d.set);
        setGebruiker(d.user || "");
        meld({ gekoppeld: !!d.set, gebruiker: d.user || "" });
      })
      .catch(() => {});
    return () => { leeft = false; };
  }, [slug, meld]);

  // Een gemeld probleem zet het formulier open: daar loop je er tegenaan.
  useEffect(() => { if (probleem) setOpen(true); }, [probleem]);

  async function bewaar() {
    if (!gebruiker.trim() || !wachtwoord.trim() || bezig) return;
    setBezig(true); setMelding("");
    try {
      const d = await fetch("/api/admin/wp-creds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, user: gebruiker.trim(), appPassword: wachtwoord.trim() }),
      }).then((r) => r.json());
      if (d?.ok) {
        setGekoppeld(true); setWachtwoord(""); setGelukt(true);
        setMelding("Getest bij de site en opgeslagen. De koppeling werkt.");
        meld({ gekoppeld: true, gebruiker: gebruiker.trim() });
      } else {
        setGelukt(false);
        setMelding(d?.error || "Opslaan mislukt.");
      }
    } catch {
      setGelukt(false); setMelding("Opslaan mislukt.");
    } finally { setBezig(false); }
  }

  async function verwijder() {
    setBezig(true); setMelding("");
    try {
      await fetch("/api/admin/wp-creds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, action: "delete" }),
      });
      setGekoppeld(false); setWachtwoord(""); setGelukt(true); setMelding("Koppeling verwijderd.");
      meld({ gekoppeld: false, gebruiker: "" });
    } catch { /* stil */ } finally { setBezig(false); }
  }

  return (
    <>
      <button type="button" className="btn btn-klein" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        title="De WordPress-gebruikersnaam en het applicatiewachtwoord van deze site. Eén koppeling voor het hele dashboard: de bewerkingshistorie én het doorvoeren van meta's en alt-teksten gebruiken dezelfde.">
        {gekoppeld ? `Koppeling bijwerken${gebruiker ? ` (${gebruiker})` : ""}` : "Site koppelen"}
      </button>
      {open && (
        <div className="wz-add wp-koppel">
          {probleem && <div className="login-error">{probleem}</div>}
          <div className="muted wp-koppel-uitleg">
            {waarvoor ? `${waarvoor} ` : ""}
            Het dashboard heeft daarvoor een WordPress-applicatiewachtwoord nodig. Maak dat aan in
            WordPress-beheer: <strong>Gebruikers → Profiel → Wachtwoorden voor applicaties</strong>, geef het een
            naam (bijvoorbeeld &ldquo;Pingwin dashboard&rdquo;) en plak de getoonde code hieronder. Er is één
            koppeling per klant; hij geldt overal in het dashboard.
          </div>
          <div className="wz-add-row">
            <div className="wp-koppel-veld">
              <label className="compose-label" htmlFor={`wp-user-${slug}`}>WordPress-gebruikersnaam</label>
              <input id={`wp-user-${slug}`} className="compose-input wp-koppel-invoer" value={gebruiker}
                onChange={(e) => setGebruiker(e.target.value)}
                placeholder="de inlognaam van de beheeromgeving"
                name="pw_site_login" autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
              <div className="hint">De naam waarmee je op wp-login inlogt, niet de weergavenaam. Die gebruiker moet mogen bewerken.</div>
            </div>
            <div className="wp-koppel-veld">
              <label className="compose-label" htmlFor={`wp-pass-${slug}`}>Applicatiewachtwoord</label>
              <input id={`wp-pass-${slug}`} className="compose-input wp-koppel-invoer" type="password" value={wachtwoord}
                onChange={(e) => setWachtwoord(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") void bewaar(); }}
                placeholder="xxxx xxxx xxxx xxxx xxxx xxxx"
                name="pw_site_apptoken" autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
              <div className="hint">De code uit Wachtwoorden voor applicaties, niet het gewone wachtwoord.</div>
            </div>
          </div>
          <div className="pnl-acties-groep wp-koppel-acties">
            <button type="button" className="btn btn-primary btn-klein" onClick={() => void bewaar()}
              disabled={bezig || !gebruiker.trim() || !wachtwoord.trim()}>
              {bezig ? "Testen bij de site…" : "Opslaan en testen"}
            </button>
            {gekoppeld && <button type="button" className="btn btn-klein" onClick={() => void verwijder()} disabled={bezig}>Koppeling verwijderen</button>}
          </div>
          {melding && <div className={gelukt ? "saved-msg" : "login-error"}>{melding}</div>}
        </div>
      )}
    </>
  );
}
