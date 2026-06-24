import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pingwin SEO Dashboard",
  description: "Maandelijks overzicht van SEO-werkzaamheden.",
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
