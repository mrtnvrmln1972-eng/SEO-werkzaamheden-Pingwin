import type { Metadata } from "next";
import "./globals.css";
import HoverHint from "./_ui/HoverHint";

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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        {children}
        <HoverHint />
      </body>
    </html>
  );
}
