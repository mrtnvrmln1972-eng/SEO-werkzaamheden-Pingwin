// De vorm van een projectkaart en van de pagina waar hij over gaat.
//
// Apart van de kaart zelf, omdat Planning.tsx en MailUitKaart.tsx deze types ook
// lezen: één type importeren hoort niet het hele kaartscherm mee naar binnen te
// trekken. WeekplanCard.tsx exporteert ze nog steeds door, zodat bestaande
// importregels blijven werken.

export type WpTask = { id: number; thread: string; taak: string; toelichting: string; wie: string; url: string; taaktype: string; copyUrl: string; bronMail: string; weekYear: number; weekNo: number; status: string; sortOrder: number; naarDev?: boolean; archiefAantal?: number; ruw?: boolean; notitie?: string };

export type WpPageInfo = { url: string; live: boolean; klikken?: number; vertoningen?: number; doorgevoerd?: boolean | null; strategie: boolean; gelieerde: boolean; analyse: boolean; blauwdruk: boolean; copy: boolean; bouw: boolean; structured: boolean; structuredStatus: string; next: string; links: { analyse: string; blauwdruk: string; copy: string } };

// De zeven fases hebben één bron: lib/fase-volgorde.ts. De kaart schreef die
// lijst zelf nog een keer uit, en dat is precies hoe twee lijsten uit elkaar gaan
// lopen; hier alleen doorgeven.
export type { FaseKey } from "../../../../../lib/fase-volgorde";
