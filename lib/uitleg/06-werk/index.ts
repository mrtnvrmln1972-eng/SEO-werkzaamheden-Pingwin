import { BLOKKEN as koers } from "./koers";
import { BLOKKEN as notificaties } from "./notificaties";
import { BLOKKEN as fases } from "./fases";
import { BLOKKEN as planning } from "./planning";
import { BLOKKEN as werkplanning } from "./werkplanning";
import { BLOKKEN as paginalijst } from "./paginalijst";
import { BLOKKEN as sitebouwer } from "./sitebouwer";
import { BLOKKEN as doorvoeren } from "./doorvoeren";
import { BLOKKEN as gedaan } from "./gedaan";
import type { Hoofdstuk } from "../types";

// Was tot 14-08-2026 één bestand `06-werk.ts` van 249 regels; dat zat al
// tegen de limiet van proeven/uitleg.proef.ts aan. Zelfde aanpak als
// `04-motoren/` en `15-agenda/`: één bestand per onderwerp, deze index voegt
// ze alleen samen.
export const HOOFDSTUK: Hoofdstuk = {
  id: "werk",
  titel: "Van bevinding naar uitgevoerd werk",
  intro:
    "Een advies dat niet wordt uitgevoerd is geen advies. Daarom zit de hele weg van signaal naar live " +
    "wijziging in hetzelfde systeem, met een vaste voortgang per pagina.",
  uitklappers: [
    ...koers,
    ...notificaties,
    ...fases,
    ...planning,
    ...werkplanning,
    ...paginalijst,
    ...sitebouwer,
    ...doorvoeren,
    ...gedaan,
  ],
};
