"use client";

import { useState } from "react";
import AdminKop from "../AdminKop";
import { WpKoppelRij } from "../client/[slug]/WpKoppeling";

type Klant = { slug: string; naam: string; domein: string };

export default function KoppelScherm({ alle, start }: { alle: Klant[]; start: string[] }) {
  const [getoond, setGetoond] = useState<string[]>(start);
  const rijen = getoond.map((s) => alle.find((k) => k.slug === s)).filter((k): k is Klant => !!k);
  const over = alle.filter((k) => !getoond.includes(k.slug)).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));

  return (
    <>
      <AdminKop titel="WordPress-koppelingen" />
      <div className="beheer-container">
        <h1 className="beheer-h1">WordPress-koppelingen</h1>
        <div className="wpk-kaart">
          <table className="wpk-tabel">
            <thead>
              <tr>
                <th>Klant</th>
                <th>Gebruikersnaam</th>
                <th>Applicatiewachtwoord</th>
                <th aria-label="Acties" />
                <th>Stand</th>
              </tr>
            </thead>
            <tbody>
              {rijen.map((k) => <WpKoppelRij key={k.slug} slug={k.slug} naam={k.naam} domein={k.domein} />)}
            </tbody>
          </table>
        </div>
        {over.length > 0 && (
          <div className="wpk-toevoegen">
            <select className="compose-input wpk-kies" aria-label="Klant toevoegen" value=""
              onChange={(e) => { const s = e.target.value; if (s) setGetoond((g) => [...g, s]); }}>
              <option value="">Klant toevoegen</option>
              {over.map((k) => <option key={k.slug} value={k.slug}>{k.naam}</option>)}
            </select>
          </div>
        )}
      </div>
    </>
  );
}
