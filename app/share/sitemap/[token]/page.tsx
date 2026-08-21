import SitemapShare from "./SitemapShare";

// Publieke leespagina van de sitemap-check. Het token is de toegang; er valt
// hier niets te wijzigen en niets aan te zetten, want de publieke route leest
// alleen de bewaarde stand en alles wat iets doet zit achter de adminroutes.
export const metadata = { robots: { index: false, follow: false } };

export default function Page({ params }: { params: { token: string } }) {
  return <SitemapShare token={params.token} />;
}
