// De vorm van één tip en één hoofdstuk in de Claude-gebruiksaanwijzing.

export type Tip = {
  /** Kort en herkenbaar; dit is wat Maarten scant. */
  titel: string;
  /** Wat je moet doen of weten, in gewone taal. */
  tekst: string;
  /**
   * Waar het over gaat: een scherm, een venster of een plek in Claude zelf.
   * Een pad dat met / begint wordt op het scherm vanzelf klikbaar.
   */
  waar?: string;
  /** Waar deze tip vandaan komt: een dag waarop het echt misging. */
  geleerd?: string;
};

export type Hoofdstuk = {
  /** Zonder nummer; de volgorde komt uit de index, niet uit de titel. */
  titel: string;
  /** Eén zin die zegt wanneer je hier moet zijn. */
  waarvoor: string;
  tips: Tip[];
};
