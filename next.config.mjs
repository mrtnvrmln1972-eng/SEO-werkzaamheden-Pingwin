/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // docx + de headless-browser packages hebben dynamische/native requires die
  // webpack niet moet bundelen; laat ze als runtime-require in de functie staan.
  experimental: {
    serverComponentsExternalPackages: ["docx", "@sparticuz/chromium", "puppeteer-core"],
    // De cannibalisatie-analyse laadt de skill-bestanden op runtime; die moeten mee
    // in de serverless-functie (anders staan ze niet in de deploy).
    outputFileTracingIncludes: {
      "/api/admin/cannibal-redirect": ["./skills/keyword-cannibalisatie-analyse/**/*"],
    },
  },
};

export default nextConfig;
