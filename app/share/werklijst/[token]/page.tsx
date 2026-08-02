import WerklijstShare from "./WerklijstShare";

// Publieke afwerkpagina voor de sitebouwer (deel-token = toegang, geen login).
export default function Page({ params }: { params: { token: string } }) {
  return <WerklijstShare token={params.token} />;
}
