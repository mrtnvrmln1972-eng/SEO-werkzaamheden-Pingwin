import type { Metadata } from "next";
import "./globals.css";
import HoverHint from "./_ui/HoverHint";
import { huisstijlCssGecached } from "../lib/huisstijl";
import { symboolFontUrls } from "../lib/icoontekens";

// Zelfde code, drie werelden: het Vercel-project bepaalt het merk. De NOC-cockpit
// (project noc-seo-cockpit) krijgt het oog van het Nationaal Oogcentrum als favicon,
// de MMC-wereld (project mmc-seo-dashboard) een eigen titel, en alle andere
// deployments de Pingwin-pinguïn.
const prodUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL || "";
const isNoc = prodUrl.includes("noc-seo-cockpit");
const isMmc = prodUrl.includes("mmc-seo");

const favicon = isNoc ? "/favicon-noc.png" : isMmc ? "/favicon-mmc.png" : "/favicon-pingwin.png";

export const metadata: Metadata = {
  title: isNoc ? "NOC SEO Cockpit" : isMmc ? "MMC SEO Dashboard" : "Pingwin SEO Dashboard",
  description: "Maandelijks overzicht van SEO-werkzaamheden.",
  icons: { icon: favicon, apple: favicon },
};

// De vastgelegde huisstijl staat hier en niet in een los stukje op elke pagina:
// hij moet in de kop staan vóór het eerste beeld, anders zie je een tel lang de
// oude stijl. Leeg als er niets is vastgelegd, en ook leeg als de database niet
// bereikbaar is; een stijl mag nooit een scherm tegenhouden.
export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const stijl = await huisstijlCssGecached();
  return (
    <html lang="nl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        {/* De tekens die Montserrat niet heeft: pijltjes, vinkjes, driehoekjes,
            sterretjes. Uitgeknipt tot precies die tekens, dus een paar honderd
            bytes per stuk. Zonder deze twee valt de browser terug op wat het
            apparaat toevallig heeft, en op een apparaat zonder symbolenlettertype
            (zoals de server die de schermfoto's maakt) staat er een leeg
            vierkantje. Welke tekens dit zijn staat in lib/icoontekens.ts. */}
        {symboolFontUrls().map((href) => <link key={href} href={href} rel="stylesheet" />)}
        {stijl && <style id="huisstijl" dangerouslySetInnerHTML={{ __html: stijl }} />}
      </head>
      <body>
        {children}
        <HoverHint />
      </body>
    </html>
  );
}
