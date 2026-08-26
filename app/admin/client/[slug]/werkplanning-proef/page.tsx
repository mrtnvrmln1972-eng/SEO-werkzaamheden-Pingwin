import WerkplanningProef from "./WerkplanningProef";

// Losse proefpagina (nog niet gekoppeld aan het klantmenu of de echte
// weekplanning-tab), zodat Maarten 'm op de echte data kan beoordelen voordat
// dit een vast onderdeel van de planning wordt. Zie het gesprek in de chat:
// twee zones (Gesignaleerd/De planning), per-pagina onderbouwing uit Opruimen,
// een geschatte duur per taak en een weekprojectie die daarop reageert.
export default function Page({ params }: { params: { slug: string } }) {
  return <WerkplanningProef slug={params.slug} />;
}
