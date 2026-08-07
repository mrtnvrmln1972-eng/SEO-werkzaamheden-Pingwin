import OrgDevShareClient from "./OrgDevShareClient";

// Deelbare, alleen-lezen sitebouwer-pagina (zonder login, token in de URL is
// het toegangsbewijs): de developer ziet hier de bedrijfsgegevens en de
// site-brede structured-data-code, klaar om te verwerken.
export default function OrgDevSharePage({ params }: { params: { token: string } }) {
  return <OrgDevShareClient token={params.token} />;
}
