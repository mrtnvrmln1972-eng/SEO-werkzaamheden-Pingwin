// ═══════════════════════════════════════════════════════════
// DE ADS-LIJST VAN EEN KLANT, ÉÉN INGANG VOOR IEDEREEN
// ═══════════════════════════════════════════════════════════
// Waarom dit een eigen bestand is en niet gewoon in `opruim-regels.ts` staat:
// dat bestand wordt óók door een browser-scherm ingeladen (via
// `opruim-weggelaten.ts` naar `WerkplanningProef.tsx`). Zodra het de paginalijst
// uit de database erbij haalt, sleept het de hele serverkant mee de bundel in en
// mislukt de bouw op `node:async_hooks`. Precies dat gebeurde op 27-08-2026.
//
// Dus: `opruim-regels.ts` blijft puur rekenwerk dat overal mag draaien, en alles
// wat de database nodig heeft staat hier. Dit bestand is alleen voor de server.
//
// Gebruik ALTIJD `adsVoorKlant` en niet `getAdsPaginas` als je wilt weten of een
// pagina een advertentiepagina is. De reden staat hieronder.

import { getAdsPaginas, zonderTeBrede, type AdsPaginas } from "./opruim-regels";
import { getClientUrls } from "./site-urls";

/**
 * De ads-lijst van een klant, met de te brede regels er al af.
 *
 * Waarom dit één functie is en geen losse stap per plek: op 27-08-2026 is de
 * breedte-regel wél in het plaatsadvies en de werklijst toegepast, maar niet in
 * de analysemotor zelf. Die draaide daarna alsnog zonder de 313 Engelse pagina's,
 * terwijl het scherm zei dat ze meededen. Eén bron, en de rest leest daaruit.
 */
export async function adsVoorKlant(slug: string): Promise<AdsPaginas> {
  const ads = await getAdsPaginas(slug).catch(() => ({ paden: [], geen: false, ingevuld: false }));
  if (!ads.paden.length) return ads;
  const urls = await getClientUrls(slug).catch(() => []);
  return zonderTeBrede(ads, urls.map((u) => u.url));
}
