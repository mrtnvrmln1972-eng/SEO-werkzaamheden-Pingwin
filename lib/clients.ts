// ═══════════════════════════════════════════════════════════
// KLANTENLIJST (multi-client)
// ═══════════════════════════════════════════════════════════
// Eén gedeeld dashboard, per klant alleen eigen data + login.
//
// Niet-geheim (mag in deze publieke repo staan): naam, inlognaam,
// Google Sheet-id, gid en de budgetbedragen. De Sheet is toch al
// "gepubliceerd naar het web".
//
// WEL geheim: het wachtwoord. Dat staat NOOIT hier, maar als
// environment-variabele in Vercel (en lokaal in .env.local).
// Naamconventie: <SLUG in hoofdletters, streepjes => underscores>_PASSWORD
//   slug "one-day-clinic"  ->  ONE_DAY_CLINIC_PASSWORD
//
// Nieuwe klant toevoegen = één blok hieronder + één env-var in Vercel.
// ═══════════════════════════════════════════════════════════

export type ClientBudget = {
  maandbudget: number;      // totale maandfee incl. linkbuilding
  linkbuilding: number;     // vast linkbuilding-budget per maand
  urenBudget: number;       // deel van de fee voor uren (maandbudget - linkbuilding)
  uurtarief: number;        // afgesproken uurtarief
  beschikbareUren: number;  // beschikbare uren per maand
};

export type ClientConfig = {
  slug: string;       // uniek, url-veilig
  loginId: string;    // wat de klant intypt als inlognaam (niet geheim)
  name: string;       // weergavenaam in het dashboard
  sheetId: string;    // Google Sheet-id
  gid: string;        // tabblad-id (gid) binnen de Sheet
  budget: ClientBudget;
};

export const CLIENTS: ClientConfig[] = [
  {
    slug: "one-day-clinic",
    loginId: "onedayclinic",
    name: "One Day Clinic",
    sheetId: "1O1HeqzxCBH-WeyIhb4QhTniBj_Z7RxGpXl5L5FfJW5I",
    gid: "1531693305",
    budget: {
      maandbudget: 1800,
      linkbuilding: 600,
      urenBudget: 1200,
      uurtarief: 100,
      beschikbareUren: 12,
    },
  },
];

export function getClientBySlug(slug: string): ClientConfig | undefined {
  return CLIENTS.find((c) => c.slug === slug);
}

export function getClientByLoginId(loginId: string): ClientConfig | undefined {
  const id = loginId.trim().toLowerCase();
  return CLIENTS.find((c) => c.loginId.toLowerCase() === id);
}

// Wachtwoord van een klant uit de environment halen.
export function passwordEnvKey(slug: string): string {
  return slug.toUpperCase().replace(/-/g, "_") + "_PASSWORD";
}

export function getClientPassword(slug: string): string | undefined {
  return process.env[passwordEnvKey(slug)];
}
