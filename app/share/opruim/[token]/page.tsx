import OpruimShare from "./OpruimShare";

// Publieke leespagina van het opruimrapport. Het token is de toegang; er valt
// hier niets te wijzigen, want alles wat een besluit vastlegt zit achter de
// adminroutes en die eisen een admin-cookie.
export const metadata = { robots: { index: false, follow: false } };

export default function Page({ params }: { params: { token: string } }) {
  return <OpruimShare token={params.token} />;
}
