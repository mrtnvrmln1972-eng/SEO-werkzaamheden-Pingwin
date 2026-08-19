"use client";

// Oefenpagina voor het documentenblok van een taakkaart. ALLEEN tijdens ontwikkelen.
//
// Waarom deze bestaat: dat blok hangt aan de database (documenten van een echte
// klant) en het venster "Ondersteunend maken" gaat pas open als je op een knop
// in een opengeklapte kaart klikt. Op de server kun je er dus wel een foto van
// maken, maar alleen van het scherm eronder. Met deze pagina plus `npm run dev`
// staat het blok meteen open, met precies de situatie waar het om ging: twee
// stukken copy in één taak die over twee verschillende projecten gaan.
//
// De antwoorden van de server zijn hier vast ingevuld, zodat er geen database en
// geen Claude-aanroep aan te pas komt. In productie bestaat deze pagina niet.

import { notFound } from "next/navigation";
import DocVersies from "../../admin/client/[slug]/DocVersies";

const VERSIES = [
  {
    id: 1, kind: "copy", source: "klant", naam: "Natuurlijke zwemvijver in Zeeuws-Vlaanderen",
    driveLink: "https://docs.google.com/document/d/voorbeeld1", samenvatting: "Aangeleverd projectverhaal.",
    vergelijking: "", status: "", createdAt: "2026-08-18T09:12:00.000Z", goedgekeurd: false,
    inhoudDatum: "2026-08-18T09:12:00.000Z", datumBron: "drive", datumUitleg: "Laatst gewijzigd in Drive",
  },
  {
    id: 2, kind: "copy", source: "klant", naam: "Strak natuurzwembad in IJsselstein",
    driveLink: "https://docs.google.com/document/d/voorbeeld2", samenvatting: "Tweede project, los van het eerste.",
    vergelijking: "", status: "", createdAt: "2026-08-18T15:40:00.000Z", goedgekeurd: false,
    inhoudDatum: "2026-08-18T15:40:00.000Z", datumBron: "drive", datumUitleg: "Laatst gewijzigd in Drive",
  },
];

const PLAN = {
  kop: "Dit stuk pakt de onderhoudsvragen en stuurt de aanvragen door naar de aanlegpagina.",
  doelen: [{
    url: "https://voorbeeld.nl/natuurzwembad-aanleggen/",
    hoofdterm: "natuurzwembad aanleggen",
    steuntermen: ["natuurzwembad onderhouden", "welke planten in een natuurzwembad", "kosten per jaar"],
  }],
  titel: "Zo houd je een natuurzwembad helder zonder chloor",
  metaTitle: "Natuurzwembad onderhouden: zo blijft het water helder",
  metaDescription: "Wat een natuurzwembad per seizoen nodig heeft, en wanneer je hulp inschakelt.",
  wijzigingen: [
    "Titel en H1 gaan nu over onderhoud in plaats van over aanleggen, zodat ze de landingspagina niet beconcurreren.",
    "Twee koppen herschreven die woordelijk op de hoofdterm zaten.",
    "Afsluitende alinea toegevoegd die naar de aanlegpagina verwijst.",
  ],
  links: [{ naar: "https://voorbeeld.nl/natuurzwembad-aanleggen/", anker: "een natuurzwembad aanleggen", plek: "in de alinea over de start van een project" }],
  linksNaarBlog: [{ van: "/blog/", anker: "natuurzwembad helder houden" }],
  waarschuwingen: [],
};

// Eén keer, bij het laden van deze pagina: de antwoorden van de server vervangen
// door vaste voorbeelden. Alleen de drie adressen die dit blok gebruikt; al het
// andere gaat gewoon naar de echte server.
if (typeof window !== "undefined" && !(window as unknown as { __proefStub?: boolean }).__proefStub) {
  (window as unknown as { __proefStub?: boolean }).__proefStub = true;
  const echt = window.fetch.bind(window);
  window.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const adres = String(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const json = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
    if (adres.includes("/api/admin/page-doc/upload")) return json({ ok: true, versions: VERSIES });
    if (adres.includes("/api/admin/urls")) {
      return json({ ok: true, urls: [
        { url: "https://voorbeeld.nl/natuurzwembad-aanleggen/" },
        { url: "https://voorbeeld.nl/zwemvijver-aanleggen/" },
        { url: "https://voorbeeld.nl/tuinontwerp/" },
      ] });
    }
    if (adres.includes("/api/admin/page-doc/ondersteunend")) {
      return json({ ok: true, plan: PLAN, link: "https://docs.google.com/document/d/voorbeeld3", naam: "Zo houd je een natuurzwembad helder (ondersteunend aan /natuurzwembad-aanleggen/)" });
    }
    return echt(input as RequestInfo, init);
  }) as typeof window.fetch;
}

export default function ProefDocumenten() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <main className="pg-wrap" style={{ maxWidth: "56rem" }}>
      <h1 className="pg-titel">Oefenpagina: documenten bij een taak</h1>
      <p className="muted">
        Twee stukken copy over twee verschillende projecten. Er hoort dus géén vraag te staan welke versie
        geldt, en bij elk stuk staat de knop om het ondersteunend te maken aan een landingspagina.
      </p>
      <div className="wp-card wp-open">
        <div className="wp-overdeze">
          <DocVersies slug="voorbeeld" url="taak:1" taakId={1} open
            driveMap={{ id: "map1", name: "GardenSwimm", path: "Klanten / GardenSwimm / Content" }}
            onKiesMap={() => { /* de echte kiezer hangt aan de kaart */ }} />
        </div>
      </div>
    </main>
  );
}
