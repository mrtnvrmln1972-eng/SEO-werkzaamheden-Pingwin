"use client";

import AdminKop from "../AdminKop";
import { Paneel, Tabel, Chip, Tekst, Leeg } from "../../_ui/Uitkomst";
import type { BronStatus, WpKlantStatus } from "../../../lib/bron-gezondheid-controle";

// ═══════════════════════════════════════════════════════════
// BRONNEN-GEZONDHEID (R7): PER KOPPELING WERKT HIJ, EN SINDS WANNEER NIET MEER
// ═══════════════════════════════════════════════════════════
// Elke koppeling die dit dashboard gebruikt kan een dag stil zijn: een verlopen
// toegang, een limiet, een storing. Dit scherm is de ene plek waar dat per bron
// staat, met een knop om meteen te herstellen waar dat kan.
// ═══════════════════════════════════════════════════════════

function tijdstip(iso: string | null): string {
  if (!iso) return "nog nooit gezien";
  return new Date(iso).toLocaleString("nl-NL", { dateStyle: "medium", timeStyle: "short" });
}

function ChipVoorStand({ stand }: { stand: BronStatus["stand"] }) {
  if (stand === "werkt") return <Chip toon="goed">Werkt</Chip>;
  if (stand === "storing") return <Chip toon="let-op">Storing</Chip>;
  if (stand === "niet-gekoppeld") return <Chip toon="uit">Niet gekoppeld</Chip>;
  return <Chip toon="uit">Niet ingesteld</Chip>;
}

export default function BronnenGezondheidClient({ bronnen, wordpress }: { bronnen: BronStatus[]; wordpress: WpKlantStatus[] }) {
  const storingen = bronnen.filter((b) => b.stand === "storing").length + wordpress.filter((w) => w.stand === "storing").length;

  return (
    <>
      <AdminKop titel="Bronnen-gezondheid" />
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "var(--s-6) var(--s-5) var(--s-10)" }}>
        <Paneel
          titel="Bronnen-gezondheid"
          uitleg="Elke koppeling die dit dashboard gebruikt (Ahrefs, Google, Microsoft, Moneybird, WordPress) kan een dag stil zijn: een verlopen toegang, een limiet, een storing. Deze controle is zojuist opnieuw uitgevoerd, dus wat hieronder staat is de actuele stand, niet een oud cijfer."
          knoppen={<a href="/admin/bronnen-gezondheid" className="btn btn-klein">Opnieuw controleren</a>}
        >
          {storingen === 0 ? (
            <Tekst>Alle koppelingen werken. Geen enkele bron staat op storing.</Tekst>
          ) : (
            <Tekst>{`Let op: ${storingen} ${storingen === 1 ? "koppeling staat" : "koppelingen staan"} op storing. Zie de reden en het herstel hieronder.`}</Tekst>
          )}

          <Tabel kolommen={["Bron", "Status", "Laatst gelukt", "Wat er aan de hand is", "Herstel"]}>
            {bronnen.map((b) => (
              <tr key={b.id}>
                <td>{b.naam}</td>
                <td><ChipVoorStand stand={b.stand} /></td>
                <td>{tijdstip(b.laatstGelukt)}</td>
                <td>{b.stand === "werkt" ? "—" : b.melding}</td>
                <td>
                  {b.stand !== "werkt" && b.herstelPad ? (
                    <a className="btn btn-klein" href={b.herstelPad}>Opnieuw koppelen</a>
                  ) : "—"}
                </td>
              </tr>
            ))}
          </Tabel>
        </Paneel>

        <Paneel
          titel="WordPress per klant"
          uitleg="WordPress is per klant gekoppeld, niet één keer voor het hele dashboard. Alleen klanten met opgeslagen inloggegevens staan hieronder; de rest heeft simpelweg nog geen WordPress-koppeling."
        >
          {wordpress.length === 0 ? (
            <Leeg>Nog geen enkele klant heeft een WordPress-koppeling met inloggegevens.</Leeg>
          ) : (
            <Tabel kolommen={["Klant", "Status", "Laatst gelukt", "Wat er aan de hand is", "Herstel"]}>
              {wordpress.map((w) => (
                <tr key={w.slug}>
                  <td>{w.naam}</td>
                  <td><ChipVoorStand stand={w.stand} /></td>
                  <td>{tijdstip(w.laatstGelukt)}</td>
                  <td>{w.stand === "werkt" ? "—" : w.melding}</td>
                  <td>
                    {w.stand !== "werkt" ? (
                      <a className="btn btn-klein" href={`/admin/client/${w.slug}`}>Naar de klant</a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </Tabel>
          )}
        </Paneel>
      </div>
    </>
  );
}
