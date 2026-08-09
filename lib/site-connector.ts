// ═══════════════════════════════════════════════════════════
// DE DOORVOERLAAG: ÉÉN KOPPELVLAK VOOR ELK SITESYSTEEM (R6)
// ═══════════════════════════════════════════════════════════
// Tot nu toe kende het dashboard maar één manier om iets op een klantsite te
// zetten: rechtstreeks WordPress-code, overal waar iets doorgevoerd moest
// worden. Dit bestand zet daar een klein koppelvlak (SiteConnector) tussen,
// met dezelfde drie regels voor elk systeem: het wachtwoord staat versleuteld,
// elke push doet een terug-controle, en een mislukte push meldt eerlijk waarom
// in plaats van "gelukt" te doen. lib/wp-push.ts is het eerste (en vandaag
// enige) koppelstuk dat aan deze vorm voldoet.
//
// Vandaag zit elke Pingwin-klant op WordPress, dus connectorFor() kiest hem
// altijd. Zodra er een klant bijkomt die op een ander systeem zit, komt er een
// tweede koppelstuk naast wordpressConnector (zelfde vorm: pushMeta/
// pushAltTexts/pushCopyDraft) en wordt connectorFor() een echte keuze op basis
// van het systeem van die klant. Tot die tijd blijft de werklijst voor de
// sitebouwer (lib/dev-worklist.ts) de terugval voor alles wat hier niet
// (automatisch) lukt.

import { wordpressConnector, type WpPushResult, type WpAltPushResult, type CopyPushResult } from "./wp-push";

export type { WpPushResult as PushResult, WpAltPushResult as AltPushResult, CopyPushResult };

export type SiteConnector = {
  id: string;
  naam: string;
  pushMeta(slug: string, pageUrl: string, fields: { title?: string; desc?: string }): Promise<WpPushResult>;
  pushAltTexts(slug: string, pageUrl: string, alts: { file: string; alt: string }[]): Promise<WpAltPushResult>;
  pushCopyDraft(slug: string, pageUrl: string, copyContent: string): Promise<CopyPushResult>;
};

/** Het koppelstuk voor deze klant. Vandaag altijd WordPress. */
export function connectorFor(_slug: string): SiteConnector {
  return wordpressConnector;
}
