import { BLOKKEN as lagen } from "./lagen";
import { BLOKKEN as opmaak } from "./opmaak";
import { BLOKKEN as techniek } from "./techniek";
import type { Hoofdstuk } from "../types";

// Dit hoofdstuk stond als één bestand van 253 regels, en dat is precies één regel
// te veel volgens `proeven/uitleg.proef.ts`. Die maat is geen willekeur maar een
// botsmaatregel: hoe groter een bestand, hoe vaker twee chats op dezelfde dag in
// hetzelfde bestand schrijven over onderwerpen die niets met elkaar te maken
// hebben. De voorgeschreven oplossing is opsplitsen, niet de maat verhogen.
//
// Drie onderwerpen, drie bestanden: hoe het in elkaar zit (lagen.ts), hoe het
// eruitziet en wat dat bewaakt (opmaak.ts), en waar het op draait (techniek.ts).
// Dit bestand is alleen de volgorde; raak het niet aan om tekst te wijzigen.

export const HOOFDSTUK: Hoofdstuk = {
  id: "opzet",
  titel: "Hoe het is opgezet",
  intro:
    "Twee lagen in één applicatie, één vaste URL, en de login bepaalt wie wat ziet. Daaronder een database die " +
    "zichzelf op orde houdt en een reeks koppelingen die de data ophalen.",
  uitklappers: [...lagen, ...opmaak, ...techniek],
};
