"use client";

// ═══════════════════════════════════════════════════════════
// ADRESVELD MET VOORSTELLEN
// ═══════════════════════════════════════════════════════════
// Zoals in een gewoon mailprogramma: je typt "ma" en Maarten wordt voorgesteld,
// pijltjes om te kiezen, Enter of een klik om over te nemen. De namen komen uit
// de eigen Microsoft 365-contacten (/api/admin/mail/people).
//
// Dit zat alleen in het compose-venster van het Werkzaamheden-tabblad. In elk
// ánder mailvenster moest je het adres dus uittypen, terwijl het om dezelfde
// mensen gaat. Vandaar één veld dat overal gebruikt wordt; komt er een mailvenster
// bij, dan hoort dit veld erin en niet een eigen kopie ernaast.

import { useEffect, useRef, useState } from "react";

type Persoon = { name: string; email: string };

export default function AdresVeld({
  waarde, onChange, onKlaar, className, wrapClassName, placeholder, id,
}: {
  waarde: string;
  onChange: (waarde: string) => void;
  /** Loopt bij verlaten van het veld én na het kiezen van een naam, met de nieuwe waarde. */
  onKlaar?: (waarde: string) => void;
  className?: string;
  wrapClassName?: string;
  placeholder?: string;
  id?: string;
}) {
  const [voorstellen, setVoorstellen] = useState<Persoon[]>([]);
  const [open, setOpen] = useState(false);
  const [actief, setActief] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const laatsteVraag = useRef("");

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Meerdere ontvangers mogen, gescheiden door een komma. Er wordt altijd gezocht
  // op het stuk waar je op dat moment staat, niet op de hele regel.
  function huidigeToken(v: string): string {
    return v.split(/[,;]/).pop()?.trim() || "";
  }

  function zoek(v: string) {
    const token = huidigeToken(v);
    if (timer.current) clearTimeout(timer.current);
    // Onder de twee tekens levert Graph alleen ruis op, en het is een netwerkvraag
    // per toetsaanslag.
    if (token.length < 2 || token.includes("@")) { setVoorstellen([]); setOpen(false); return; }
    laatsteVraag.current = token;
    timer.current = setTimeout(async () => {
      try {
        const d = await fetch(`/api/admin/mail/people?q=${encodeURIComponent(token)}`).then((r) => r.json());
        // Tik je door terwijl het antwoord onderweg is, dan is dit antwoord oud.
        if (laatsteVraag.current !== token) return;
        if (d?.ok && Array.isArray(d.people) && d.people.length) { setVoorstellen(d.people); setActief(0); setOpen(true); }
        else { setVoorstellen([]); setOpen(false); }
      } catch { setVoorstellen([]); setOpen(false); }
    }, 220);
  }

  function kies(email: string) {
    const delen = waarde.split(/[,;]/).map((s) => s.trim());
    delen[delen.length - 1] = email;
    const nieuw = `${delen.filter(Boolean).join(", ")}, `;
    onChange(nieuw);
    setVoorstellen([]); setOpen(false);
    onKlaar?.(nieuw);
  }

  return (
    <span className={`compose-autocomplete${wrapClassName ? ` ${wrapClassName}` : ""}`}>
      <input
        id={id}
        className={className}
        type="text"
        autoComplete="off"
        value={waarde}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); zoek(e.target.value); }}
        onFocus={() => { if (voorstellen.length) setOpen(true); }}
        // Even wachten met sluiten: anders is de lijst al weg voordat je klik
        // aankomt. Het kiezen zelf gebeurt op onMouseDown, dus dubbelop beveiligd.
        onBlur={(e) => { const v = e.target.value; setTimeout(() => setOpen(false), 150); onKlaar?.(v); }}
        onKeyDown={(e) => {
          if (!open || !voorstellen.length) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActief((i) => (i + 1) % voorstellen.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActief((i) => (i - 1 + voorstellen.length) % voorstellen.length); }
          else if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); kies(voorstellen[actief].email); }
          else if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
        }}
      />
      {open && voorstellen.length > 0 && (
        <ul className="compose-suggest">
          {voorstellen.map((p, i) => (
            <li key={p.email}>
              <button type="button" className={i === actief ? "cs-actief" : ""}
                onMouseEnter={() => setActief(i)}
                onMouseDown={(e) => { e.preventDefault(); kies(p.email); }}>
                <span className="cs-name">{p.name}</span>
                <span className="cs-email">{p.email}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
