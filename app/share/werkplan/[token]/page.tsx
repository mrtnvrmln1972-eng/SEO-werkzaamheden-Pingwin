import WerkplanShare from "./WerkplanShare";

// Publieke leespagina van het werkplan. Het token is de toegang; er valt hier
// niets te wijzigen, want alles wat een besluit vastlegt (in de planning zetten,
// een omleiding doorvoeren) zit achter de adminroutes en die eisen een
// admin-cookie. De pagina toont ook geen weg naar de rest van het dashboard.
export const metadata = { robots: { index: false, follow: false } };

export default function Page({ params }: { params: { token: string } }) {
  return <WerkplanShare token={params.token} />;
}
