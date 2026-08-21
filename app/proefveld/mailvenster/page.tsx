"use client";

// Oefenpagina voor het mailvenster "Delen met developer". ALLEEN tijdens ontwikkelen.
//
// Waarom deze bestaat: dat venster gaat pas open na een klik op een kaart die aan
// de database hangt, en het maakt bij die klik een Drive-bestand en een taak aan.
// Er was dus geen manier om er zelf naar te kíjken zonder een echte klant te
// gebruiken. Sinds 21-08-2026 hoort de mail in zijn geheel in beeld te staan
// (geen schuifvakje in een venster) en hoort bij elke link te staan of de
// developer hem kan openen; dat is precies iets wat je moet zíen.
//
// In productie bestaat deze pagina niet; hij valt daar terug op "niet gevonden".

import { useState } from "react";
import { notFound } from "next/navigation";
import MailPopup from "../../admin/client/[slug]/MailPopup";
import { sitewideMailHtml } from "../../../lib/structured-taak";

const JSON_LINK = "https://drive.google.com/file/d/1KMCBBn4LHmuFhHBaecRZDNZJ3-cB0F84/view?usp=sharing";
const DEV_URL = "https://pingwin-seo-dashboard.vercel.app/share/org-dev/xOZkxuMVTKVBiNnL78fxpF69";

export default function ProefMailVenster() {
  if (process.env.NODE_ENV === "production") notFound();
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const [open, setOpen] = useState(true);
  return (
    <div className="container">
      <button type="button" className="btn btn-primary btn-klein" onClick={() => setOpen(true)}>Mailvenster openen</button>
      <MailPopup
        open={open}
        onClose={() => setOpen(false)}
        titel="Delen met developer"
        aanTo=""
        onderwerp="Structured data klaar – Voorbeeldklant"
        berichtHtml={sitewideMailHtml("Voorbeeldklant", { jsonLink: JSON_LINK, devUrl: DEV_URL })}
        extra={
          <div className="dev-deel-links">
            <div className="dev-deel-rij">
              <a className="dev-deel-naam" href={JSON_LINK} target="_blank" rel="noreferrer">De code als JSON-bestand</a>
              <span className="dev-deel-stand">iedereen met de link kan hem openen</span>
              <button type="button" className="btn btn-ghost btn-klein">Kopieer link</button>
            </div>
            <div className="dev-deel-rij">
              <a className="dev-deel-naam" href={DEV_URL} target="_blank" rel="noreferrer">Alle bedrijfsgegevens plus deze code</a>
              <span className="dev-deel-stand">alleen-lezen, geen inlog nodig</span>
              <button type="button" className="btn btn-ghost btn-klein">Kopieer link</button>
            </div>
            <div className="dev-deel-rij">
              <button type="button" className="btn btn-ghost btn-klein">Bekijk de JSON-code</button>
            </div>
          </div>
        }
      />
    </div>
  );
}
