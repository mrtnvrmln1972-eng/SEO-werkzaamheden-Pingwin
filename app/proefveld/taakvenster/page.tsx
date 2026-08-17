"use client";

// Oefenpagina voor het taakvenster van de developer. ALLEEN tijdens ontwikkelen.
//
// Waarom deze bestaat: het venster is een overlay die pas opengaat als je in de
// developerlijst op "Bekijk" klikt, en die lijst hangt aan de database. Op de
// server kun je er dus wel een foto van maken (`/api/admin/kijkbeeld`), maar
// alleen van de pagina eronder, niet van het geopende venster. Met deze pagina
// plus `npm run dev` staat het venster meteen open, met een taak die precies de
// situatie nabootst waar het om ging: een kaarttekst uit de weekplanning naast
// een leeg eigen opmerkingveld.
//
// In productie bestaat deze pagina niet; hij valt daar terug op "niet gevonden".

import { notFound } from "next/navigation";
import DeveloperOverview from "../../admin/developer/DeveloperOverview";

const TAAK = {
  clientSlug: "voorbeeld", clientName: "Voorbeeldklant", taskKey: "wp:1",
  taak: "/hovenier/etten-leur/ · herstellen",
  toelichting: "",
  kaartOpm: "Bouw: controleer waarom /hovenier/etten-leur/ een 404 geeft (verkeerde slug, niet gepubliceerd, redirect-fout), herstel publicatie, zet de gereedliggende copy live inclusief meta-title en meta-description.\nStructured data: FAQ-schema opstellen op basis van de bestaande H2's.",
  uren: null, status: "naar dev", maand: "", link: "https://kamsteegtuinen.nl/hovenier/etten-leur/",
  fase: "", execDate: "", position: 0, devDone: false, devNote: "", ownerDone: false,
  docs: [
    { label: "De pagina", url: "https://kamsteegtuinen.nl/hovenier/etten-leur/" },
    { label: "Copy: Copywriting-hovenier-etten-leur", url: "https://docs.google.com/document/d/voorbeeld1" },
    { label: "Blauwdruk: Blauwdruk-hovenier-etten-leur", url: "https://docs.google.com/document/d/voorbeeld2" },
  ],
};

export default function ProefTaakVenster() {
  if (process.env.NODE_ENV === "production") notFound();
  return <DeveloperOverview initialTasks={[TAAK]} embedded slug="voorbeeld" clientName="Voorbeeldklant" />;
}
