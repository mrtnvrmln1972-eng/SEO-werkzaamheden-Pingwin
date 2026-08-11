import { BLOKKEN as basis } from "./basis";
import { BLOKKEN as prioriteiten } from "./prioriteiten";
import { BLOKKEN as metaCtr } from "./meta-ctr";
import { BLOKKEN as opruimen } from "./opruimen";
import { BLOKKEN as interneLinks } from "./interne-links";
import { BLOKKEN as structuredData } from "./structured-data";
import { BLOKKEN as kansenEnSignalen } from "./kansen-en-signalen";
import { BLOKKEN as bedrijfsprofiel } from "./bedrijfsprofiel";
import type { Hoofdstuk } from "../types";

export const HOOFDSTUK: Hoofdstuk = {
  id: "motoren",
  titel: "De motoren: hoe de analyses werkelijk gebeuren",
  intro:
    "Dit is het hart. Elke motor hieronder is een zelfstandige analyse met een eigen scherm, eigen opslag en " +
    "eigen bewijsvoering. Ze delen dezelfde metingen, zodat hetzelfde cijfer nooit op twee tabjes anders staat.",
  uitklappers: [
    ...basis,
    ...prioriteiten,
    ...metaCtr,
    ...opruimen,
    ...interneLinks,
    ...structuredData,
    ...kansenEnSignalen,
    ...bedrijfsprofiel,
  ],
};
