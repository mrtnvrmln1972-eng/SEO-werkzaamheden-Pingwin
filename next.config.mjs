/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // docx + de headless-browser packages hebben dynamische/native requires die
  // webpack niet moet bundelen; laat ze als runtime-require in de functie staan.
  experimental: {
    serverComponentsExternalPackages: ["docx", "@sparticuz/chromium", "puppeteer-core"],
  },
};

export default nextConfig;
