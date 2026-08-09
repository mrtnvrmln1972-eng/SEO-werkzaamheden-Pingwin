"use client";

import { useState } from "react";
import AdminKop from "../AdminKop";
import { Paneel, Tekst, Leeg, Signaal } from "../../_ui/Uitkomst";
import type { OpgeslagenScherm } from "../../../lib/schermbeeld";

function tijdstip(iso: string): string {
  return new Date(iso).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" });
}

export default function SchermafbeeldingenClient({ schermen, verwacht }: {
  schermen: OpgeslagenScherm[]; verwacht: number;
}) {
  const [lijst, setLijst] = useState(schermen);
  const [bezig, setBezig] = useState(false);
  const [melding, setMelding] = useState<string | null>(null);

  async function vernieuwAlles() {
    setBezig(true);
    setMelding(null);
    try {
      const res = await fetch("/api/admin/schermafbeeldingen", { method: "POST" });
      const data = await res.json();
      if (!data.ok && data.gelukt === 0) {
        setMelding("Geen enkel scherm kon gefotografeerd worden. De browser start waarschijnlijk niet op deze server.");
      } else if (data.gelukt < data.totaal) {
        setMelding(`${data.gelukt} van de ${data.totaal} schermen zijn vernieuwd. De rest lukte niet, zie hieronder welke.`);
      } else {
        setMelding(`Alle ${data.totaal} schermen zijn vernieuwd.`);
      }
      const opnieuw = await fetch("/api/admin/schermafbeeldingen");
      const opnieuwData = await opnieuw.json();
      if (opnieuwData.ok) setLijst(opnieuwData.schermen);
    } catch {
      setMelding("Het vernieuwen is mislukt. Probeer het zo nog eens.");
    } finally {
      setBezig(false);
    }
  }

  return (
    <>
      <AdminKop titel="Schermafbeeldingen" />
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "var(--s-6) var(--s-5) var(--s-10)" }}>
        <Paneel
          titel="Schermafbeeldingen voor /uitleg"
          uitleg="Het dashboard fotografeert een vaste lijst van zijn eigen schermen, met een echte adminsessie. Vóór elke opname worden klantnaam, domein en mailadres vervangen door een neutrale naam, zodat elk beeld hieronder veilig openbaar op /uitleg mag staan."
          knoppen={
            <button className="btn btn-primary" onClick={vernieuwAlles} disabled={bezig}>
              {bezig ? "Bezig met fotograferen…" : "Alles vernieuwen"}
            </button>
          }
        >
          {melding && <Tekst>{melding}</Tekst>}
          <Tekst klein>{`${lijst.length} van de ${verwacht} vaste schermen hebben een beeld.`}</Tekst>

          {lijst.length === 0 ? (
            <Leeg>Nog geen enkel scherm gefotografeerd. Klik op "Alles vernieuwen" om te beginnen.</Leeg>
          ) : (
            <div className="sb-grid">
              {lijst.map((s) => (
                <div className="sb-kaart" key={s.hoofdstuk}>
                  <img src={s.dataUrl} alt={s.label} />
                  <div className="sb-kaart-body">
                    <div className="sb-kaart-titel">{s.label}</div>
                    <div className="sb-kaart-meta">{s.pad} · gemaakt {tijdstip(s.gemaaktOp)}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {lijst.length < verwacht && (
            <Signaal soort="notitie">
              {`${verwacht - lijst.length} van de vaste schermen hebben nog geen beeld. Klik op "Alles vernieuwen".`}
            </Signaal>
          )}
        </Paneel>
      </div>
    </>
  );
}
