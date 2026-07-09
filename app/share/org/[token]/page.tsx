import OrgShareClient from "./OrgShareClient";

// Deelbare klantpagina (zonder login, token in de URL is het toegangsbewijs):
// de klant loopt hier de bedrijfsgegevens na die de basis vormen voor de
// structured data van de site. Bewerken kan zolang Pingwin niet vergrendeld heeft.
export default function OrgSharePage({ params }: { params: { token: string } }) {
  return <OrgShareClient token={params.token} />;
}
