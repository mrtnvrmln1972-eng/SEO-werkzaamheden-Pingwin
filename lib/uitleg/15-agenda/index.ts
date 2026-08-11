import { BLOKKEN as werkwijze } from "./werkwijze";
import { BLOKKEN as golf1 } from "./golf-1";
import { BLOKKEN as golf2 } from "./golf-2";
import { BLOKKEN as golf3 } from "./golf-3";
import { BLOKKEN as kaders } from "./kaders";
import type { Hoofdstuk } from "../types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "agenda",
  titel: "Eerlijke agenda en routekaart",
  intern: true,
  intro:
    "Dit hoofdstuk is alleen zichtbaar met een beheerderssessie, en het is tegelijk de ontwikkelagenda. " +
    "Vijftien punten, genummerd R1 tot R15, in drie golven plus een lijst met wat we bewust níet doen. Elk " +
    "punt staat er met wat er nu mis is, wat het oplevert, hoe het gebouwd zou worden en waaraan je ziet dat " +
    "het af is. Zo kan één punt in één aparte werksessie opgepakt worden zonder dat het opnieuw bedacht hoeft " +
    "te worden.",
  uitklappers: [
    ...werkwijze,
    ...golf1,
    ...golf2,
    ...golf3,
    ...kaders,
  ],
};
