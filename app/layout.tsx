import type { Metadata } from "next";
import "./globals.css";

// Zelfde code, twee werelden: het Vercel-project bepaalt het merk. De NOC-cockpit
// (project noc-seo-cockpit) krijgt het oog van het Nationaal Oogcentrum als favicon,
// alle andere deployments de Pingwin-pinguïn.
const isNoc = (process.env.VERCEL_PROJECT_PRODUCTION_URL || "").includes("noc-seo-cockpit");

export const metadata: Metadata = {
  title: isNoc ? "NOC SEO Cockpit" : "Pingwin SEO Dashboard",
  description: "Maandelijks overzicht van SEO-werkzaamheden.",
  icons: { icon: isNoc ? "/favicon-noc.png" : "/favicon-pingwin.png", apple: isNoc ? "/favicon-noc.png" : "/favicon-pingwin.png" },
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
      <body>{children}</body>
    </html>
  );
}
