/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // docx heeft een dynamische require die webpack niet kan bundelen; laat het als
  // runtime-require in de serverless-functie staan i.p.v. mee te bundelen.
  experimental: {
    serverComponentsExternalPackages: ["docx"],
  },
};

export default nextConfig;
