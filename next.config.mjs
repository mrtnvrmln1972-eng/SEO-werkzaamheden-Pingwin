// Routes die de headless browser gebruiken: voor het renderen van een pagina en
// voor de omslag van een document. Chromium zelf kwam wel mee in de deploy, maar
// de bijbehorende systeembibliotheken niet, en dan start de browser met
// "libnss3.so: cannot open shared object file". De omslag van elk document viel
// daardoor stil terug op de tekst-versie.
const BROWSER_ROUTES = [
  "/api/admin/browser-check",
  "/api/admin/documenten",
  "/api/admin/page-analysis-doc",
  "/api/admin/page-doc",
  "/api/admin/page-doc/run",
  "/api/admin/page-doc/upload",
  "/api/admin/page-doc/voorbeeld",
  "/api/admin/page-doc-client",
  "/api/admin/canni-check",
  "/api/admin/canni-row",
  "/api/admin/client-profile/generate",
  "/api/admin/dev-worklist",
  "/api/admin/dev-worklist/push",
  "/api/admin/dev-worklist/verify",
  "/api/admin/meta-ctr/verify",
  "/api/admin/org-data/sitewide",
  "/api/admin/page-cannibal",
  "/api/admin/page-cannibal/apply",
  "/api/admin/page-internal-links",
  "/api/admin/page-internal-links/apply",
  "/api/admin/page-schema",
  "/api/admin/page-schema/apply",
  "/api/admin/page-schema/verify",
  "/api/admin/weekplan/add",
  "/api/admin/schermafbeeldingen",
  "/api/cron/doc-runs",
];
const CHROMIUM_BESTANDEN = ["./node_modules/@sparticuz/chromium/bin/**"];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // docx + de headless-browser packages hebben dynamische/native requires die
  // webpack niet moet bundelen; laat ze als runtime-require in de functie staan.
  experimental: {
    serverComponentsExternalPackages: ["docx", "@sparticuz/chromium", "puppeteer-core"],
    // De cannibalisatie- en interne-link-analyse laden de skill-bestanden op runtime;
    // die moeten mee in de serverless-functie (anders staan ze niet in de deploy).
    outputFileTracingIncludes: {
      "/api/admin/cannibal-redirect": ["./skills/keyword-cannibalisatie-analyse/**/*"],
      "/api/admin/internal-links": ["./skills/interne-links-optimalisatie/**/*"],
      ...Object.fromEntries(BROWSER_ROUTES.map((r) => [r, CHROMIUM_BESTANDEN])),
    },
  },
};

export default nextConfig;
