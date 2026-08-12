import type { ChatBesluit } from "./index";

// Cluster "soa test amsterdam", besloten op 12 augustus 2026 na nameting in de
// chat (Ahrefs, live). De aanleiding: op "soa test amsterdam" (1.900 zoekopdrachten
// per maand, moeilijkheid 5) stonden drie eigen pagina's tegelijk in de resultaten
// en kwam geen ervan structureel de top 5 in, terwijl de landingspagina met 99
// verwijzende domeinen het sterkste linkprofiel van de commerciële aanbieders
// heeft (Stadskliniek op positie 2 heeft er 46).

const GROEP = "SOA test Amsterdam";

export const BESLUITEN: ChatBesluit[] = [
  {
    pad: "/soa-klinieken/soa-test-amsterdam/",
    uitkomst: "uitbouwen",
    naar: "",
    reden: "Wordt de enige pagina voor \"soa test amsterdam\": de spoed- en sneltest-passages komen erin en de interne links gaan hierheen.",
    onderbouwing: [
      "Op \"soa test amsterdam\" (1.900 zoekopdrachten per maand, moeilijkheid 5) stonden drie eigen pagina's tegelijk in de resultaten: deze landingspagina op 8, het blog over testopties op 12 en de homepage op 18. Geen ervan komt zo de top 5 in; Google twijfelt tussen drie kandidaten.",
      "Autoriteit is niet het probleem: deze pagina heeft 99 verwijzende domeinen, terwijl Stadskliniek op positie 2 er 46 heeft. In de local pack staat hij al op 3.",
      "**Wat we doen:** de spoed/sneltest-passages (uitslag binnen 30 minuten) uit de losse pagina's hierheen verhuizen, want dat is het onderscheid tegenover de GGD, en interne links vanaf de homepage, /gratis-soa-test-ggd/ en /soa-klinieken/soa-amstelveen/ met gerichte ankers hierheen leggen.",
    ],
    term: "soa test amsterdam",
    volume: 1900,
    klikken: 0,
    vertoningen: 0,
    positie: 8,
    groep: GROEP,
    datum: "2026-08-12",
  },
  {
    pad: "/testen-in-amsterdam-welke-opties-heb-je/",
    uitkomst: "uitbouwen",
    naar: "",
    reden: "Blijft, maar wordt scherp op de GGD-vraag gezet: de zuivere \"soa test amsterdam\"-signalen gaan uit de title, H1 en eerste alinea.",
    onderbouwing: [
      "Dit blog wint op de GGD-termen (ggd soa test amsterdam 450, soa test ggd amsterdam 300, ggd amsterdam soa test 250, en meer, samen ruim 1.280 zoekopdrachten per maand) op posities 4 tot 6, mét klikken. Dat is een andere zoekvraag (gratis, via de GGD) die de commerciële landingspagina nooit gaat winnen; redirecten gooit dat volume weg.",
      "Tegelijk staat hij op positie 12 op \"soa test amsterdam\" zelf en zit hij daar de landingspagina in de weg.",
      "**Wat we doen:** de exacte term \"soa test amsterdam\" uit title, H1 en eerste alinea schrijven en het blog volledig op de GGD-vraag richten, met bovenin één duidelijke link naar de landingspagina met anker \"soa test in Amsterdam bij One Day Clinic\".",
    ],
    term: "ggd soa test amsterdam",
    volume: 450,
    klikken: 33,
    vertoningen: 0,
    positie: 5,
    groep: GROEP,
    datum: "2026-08-12",
  },
  {
    pad: "/snelle-soa-test-amsterdam/",
    uitkomst: "uitbouwen",
    naar: "",
    reden: "Niet redirecten: rankt vrijwel alleen op landelijke uitslag-vragen. Ombouwen tot dé uitslag-vraagpagina, Amsterdam-targeting eruit.",
    onderbouwing: [
      "Deze pagina rankt vrijwel uitsluitend op landelijke uitslag-vragen: \"soatestuitslag\" (250 per maand, positie 6), \"hoe snel uitslag soa test huisarts\", \"uitslag soa test huisarts\", allemaal positie 5 tot 10 en allemaal informatief. Geen enkele Amsterdam-term in zijn top.",
      "Een 301 naar de stadspagina (het eerdere voorstel uit Cowork) gooit die niche weg, want een lokale conversiepagina gaat nooit op \"uitslag soa test huisarts\" ranken.",
      "Deze pagina stond niet in de sitemap en was daardoor onzichtbaar in het dashboard; hij is via Search Console en Ahrefs teruggevonden.",
      "**Wat we doen:** de spoed/sneltest-USP-passages verhuizen naar /soa-klinieken/soa-test-amsterdam/, en deze pagina ombouwen tot de uitslag-vraagpagina (title en H1 op de uitslag-vraag, Amsterdam eruit), met onderin de brug \"binnen 30 minuten uitslag bij onze soa kliniek in Amsterdam\" naar de landingspagina. Desgewenst later verhuizen naar een schone URL zoals /uitslag-soa-test/ met een 301.",
    ],
    term: "soatestuitslag",
    volume: 250,
    klikken: 0,
    vertoningen: 0,
    positie: 6,
    groep: GROEP,
    datum: "2026-08-12",
  },
  {
    pad: "/spoed-soa-test-amsterdam-na-30-minuten-uitslag/",
    uitkomst: "samenvoegen",
    naar: "/soa-klinieken/soa-test-amsterdam/",
    reden: "Gaat op in de landingspagina: die staat op de spoed-term al op 2, dit losse blog hangt op 12 en voegt niets toe.",
    onderbouwing: [
      "Op \"spoed soa test amsterdam\" staat de landingspagina al op positie 2; deze losse pagina hangt op 12 en houdt het cluster onrustig.",
      "**Wat we doen:** de spoed-passage (uitslag na 30 minuten) eerst meenemen naar de landingspagina, daarna de 301. Keuzeladder trede 1: directe opvolger over hetzelfde onderwerp.",
    ],
    term: "spoed soa test amsterdam",
    volume: 10,
    klikken: 0,
    vertoningen: 0,
    positie: 12,
    groep: GROEP,
    datum: "2026-08-12",
  },
  {
    pad: "/en/soa-klinieken/landings-pagina-newest/",
    uitkomst: "samenvoegen",
    naar: "/en/soa-klinieken/soa-test-amsterdam/",
    reden: "De pagina met de testnaam-slug rankt op de Engelse termen, maar de nette Engelse URL heeft de links (17 verwijzende domeinen). Samenvoegen bundelt beide.",
    onderbouwing: [
      "In de Engelse tak staan twee Amsterdam-pagina's: /en/soa-klinieken/soa-test-amsterdam/ heeft de links (17 verwijzende domeinen, live gemeten) maar rankt niet; deze pagina met een testnaam als slug rankt wél (std test amsterdam positie 12, sti clinic amsterdam positie 10).",
      "**Wat we doen:** de content van deze pagina naar de nette Engelse URL, daar een 301 op, en daarna hreflang tussen de Nederlandse en Engelse Amsterdam-pagina. Sluit aan op het lopende /en-spoor (Nederlandse teksten op Engelse URL's).",
    ],
    term: "std test amsterdam",
    volume: 250,
    klikken: 0,
    vertoningen: 0,
    positie: 12,
    groep: GROEP,
    datum: "2026-08-12",
  },
];
