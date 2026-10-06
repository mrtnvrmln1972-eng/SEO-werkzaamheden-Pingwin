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

// ═══════════════════════════════════════════════════════════
// DEZELFDE KOPPELING, ALS ÉÉN REGEL IN HET KOPPELSCHERM
// ═══════════════════════════════════════════════════════════
// Het koppelscherm (/admin/wordpress) zet alle klanten onder elkaar. Dit is geen
// tweede formulier met een eigen opslag: het staat bewust in dít bestand en
// praat met exact dezelfde ingang (/api/admin/wp-creds → lib/wp-creds.ts), die
// eerst bij de site test en pas daarna bewaart. Het wachtwoord komt nooit terug
// naar de browser; na opslaan is het veld leeg en kan het alleen vervangen of
// losgekoppeld worden.

type RijStand = {
  set: boolean;
  user: string;
  getestOp: string | null;
  testOk: boolean | null;
  fout: string;
  rol: string;
};

function wanneer(iso: string | null): string {
  if (!iso) return "";
  return new Intl.DateTimeFormat("nl-NL", {
    timeZone: "Europe/Amsterdam", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso));
}

export function WpKoppelRij({ slug, naam, domein }: { slug: string; naam: string; domein: string }) {
  const [stand, setStand] = useState<RijStand | null>(null);
  const [gebruiker, setGebruiker] = useState("");
  const [wachtwoord, setWachtwoord] = useState("");
  const [bezig, setBezig] = useState<"" | "koppel" | "test" | "los">("");
  const [poging, setPoging] = useState<{ ok: boolean; fout: string; soort: string } | null>(null);

  const neem = useCallback((d: Partial<RijStand> & { set?: boolean }) => {
    setStand({
      set: !!d.set, user: d.user || "", getestOp: d.getestOp ?? null,
      testOk: typeof d.testOk === "boolean" ? d.testOk : null, fout: d.fout || "", rol: d.rol || "",
    });
    if (d.user) setGebruiker(d.user);
  }, []);

  useEffect(() => {
    let leeft = true;
    fetch(`/api/admin/wp-creds?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((d) => { if (leeft && d?.ok) neem(d); })
      .catch(() => {});
    return () => { leeft = false; };
  }, [slug, neem]);

  async function stuur(body: Record<string, string>, soort: "koppel" | "test" | "los") {
    setBezig(soort); setPoging(null);
    try {
      const d = await fetch("/api/admin/wp-creds", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...body }),
      }).then((r) => r.json());
      if (soort === "los") {
        setStand({ set: false, user: "", getestOp: null, testOk: null, fout: "", rol: "" });
        setGebruiker(""); setWachtwoord("");
        return;
      }
      if (d?.set !== undefined) neem(d);
      if (d?.ok) setWachtwoord("");
      setPoging({ ok: !!d?.ok, fout: d?.ok ? "" : (d?.error || "De test gaf geen antwoord."), soort });
    } catch {
      setPoging({ ok: false, fout: "Het dashboard kreeg geen antwoord. Probeer het zo nog een keer.", soort });
    } finally { setBezig(""); }
  }

  const koppel = () => {
    if (!gebruiker.trim() || !wachtwoord.trim() || bezig) return;
    void stuur({ user: gebruiker.trim(), appPassword: wachtwoord.trim() }, "koppel");
  };
  const loskoppelen = () => {
    if (bezig) return;
    if (!window.confirm(`De WordPress-koppeling van ${naam} loskoppelen?`)) return;
    void stuur({ action: "delete" }, "los");
  };

  // Wat het label zegt: de laatste handeling wint, daarna de vastgelegde test.
  const mislukt = poging ? !poging.ok : stand?.testOk === false;
  const fout = poging && !poging.ok ? poging.fout : (stand?.testOk === false ? stand.fout : "");
  const gekoppeld = !!stand?.set;

  return (
    <tr className="wpk-rij">
      <td className="wpk-klant">
        <strong>{naam}</strong>
        {domein && <a className="wpk-domein" href={`https://${domein}`} target="_blank" rel="noreferrer">{domein}</a>}
      </td>
      <td>
        <input className="compose-input wpk-invoer" aria-label={`Gebruikersnaam ${naam}`} value={gebruiker}
          onChange={(e) => setGebruiker(e.target.value)}
          name={`wpk_login_${slug}`} autoComplete="off" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
      </td>
      <td>
        <input className="compose-input wpk-invoer" type="password" aria-label={`Applicatiewachtwoord ${naam}`}
          value={wachtwoord} placeholder={gekoppeld ? "Opgeslagen" : ""}
          onChange={(e) => setWachtwoord(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") koppel(); }}
          name={`wpk_code_${slug}`} autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" data-form-type="other" />
      </td>
      <td className="wpk-acties">
        <button type="button" className="btn btn-primary btn-klein" onClick={koppel}
          disabled={!!bezig || !gebruiker.trim() || !wachtwoord.trim()}>
          {bezig === "koppel" ? "Testen…" : "Koppelen en testen"}
        </button>
        {gekoppeld && (
          <button type="button" className="btn btn-ghost btn-klein" onClick={() => void stuur({ action: "test" }, "test")} disabled={!!bezig}>
            {bezig === "test" ? "Testen…" : "Opnieuw testen"}
          </button>
        )}
        {gekoppeld && (
          <button type="button" className="btn btn-quiet btn-klein" onClick={loskoppelen} disabled={!!bezig}>Loskoppelen</button>
        )}
      </td>
      <td className="wpk-stand">
        {stand === null ? null : mislukt ? (
          <span className="wpk-label wpk-fout">Mislukt</span>
        ) : gekoppeld ? (
          <span className="wpk-label wpk-ok">Gekoppeld</span>
        ) : (
          <span className="wpk-label wpk-leeg">Niet gekoppeld</span>
        )}
        {gekoppeld && stand?.getestOp && <span className="wpk-meta">{wanneer(stand.getestOp)}</span>}
        {gekoppeld && stand?.rol && !mislukt && <span className="wpk-meta wpk-rol">{stand.rol}</span>}
        {fout && <div className="wpk-melding">{fout}{poging?.soort === "koppel" && !poging.ok && gekoppeld ? " De vorige koppeling blijft staan." : ""}</div>}
      </td>
    </tr>
  );
}
