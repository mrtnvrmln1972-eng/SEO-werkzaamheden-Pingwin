# SaaS-referenties: interaction design

Vijf tools die in 2026 breed en onderbouwd bekend staan om hun interaction design, niet als
merkstijl om te kopiëren maar om de patronen te zien die het verschil maken. Toegevoegd
08-08-2026 na een vraag van Maarten: "waar halen we die kennis vandaan, welke tools doen dit
écht goed?" (Amazon, bol.com, HubSpot en Ahrefs golden daarbij expliciet niet als goed
voorbeeld.) Onderzocht via actuele bronnen, niet uit het geheugen gegokt.

### Linear — type: dashboard / projectmanagement
Bron: https://blog.logrocket.com/ux-design/linear-design/, https://performance.dev/how-is-linear-so-fast-a-technical-breakdown
Waarom dit goed is:
- **Progressive disclosure als kernprincipe, niet als extra.** Toont op elk moment maar één
  detailniveau tegelijk; een lijst blijft een lijst tot je er echt in klikt. Direct het principe
  dat in dit dashboard ontbrak toen drie zware stroken (Verzamelde structured data, Nog aan te
  leveren, Kennisbank per categorie) tegelijk om aandacht streden met de toolbar erboven.
- **Kort en asymmetrisch getimede animaties** (hover meteen, wegvagen in ~150ms): geeft een
  "snel"-gevoel zonder een show te maken van beweging. Zie DESIGN-PRINCIPES.md §8.
- **Toetsenbord als eersteklas interactie** (command palette): complexiteit weggestopt achter
  een actie in plaats van permanent zichtbaar in de UI.

### Stripe — type: dashboard
Bron: https://www.925studios.co/blog/saas-dashboard-design-examples-2026
Waarom dit goed is:
- Complexiteit zit achter een klik, niet in de eerste laag van het scherm. Relevant voor
  "Kennisbank per categorie" en "Nog aan te leveren": pas relevant ná een klik, dus ze mogen er
  in rust (dichtgeklapt) niet zwaarder uitzien dan de dingen die wél altijd zichtbaar moeten zijn.

### Vercel — type: dashboard
Bron: https://www.925studios.co/blog/saas-dashboard-design-examples-2026
Waarom dit goed is:
- Eén duidelijke hoofdmetric per kaart in plaats van alles ineens tonen.
- Lege en incomplete staten krijgen evenveel ontwerpaandacht als volle staten (zorgvuldige
  skeletons/empty states). Relevant voor hoe bijvoorbeeld "Nog aan te leveren (0)" zich hoort te
  gedragen: geen kaal restant van een kop, geen zwaar kader als er niets te melden valt.

### Attio — type: CRM / dashboard
Bron: https://www.925studios.co/blog/saas-dashboard-design-examples-2026
Waarom dit goed is:
- AI-samenvattingen liggen bovenop inspecteerbare brondata, vervangen die nooit. Relevant
  principe voor hoe "Verzamelde structured data" (het automatisch ingevulde deel) zich moet
  verhouden tot de losse formuliervelden eronder: samenvatting eerst, ruwe data altijd
  controleerbaar.

### Raycast — type: tool / command interface
Bron: https://www.925studios.co/blog/saas-dashboard-design-examples-2026
Waarom dit goed is:
- Dark-first, minimale chrome: zo min mogelijk decoratieve randen en vlakken, zodat wat
  overblijft (tekst, acties) meteen de aandacht krijgt. Hetzelfde argument als waarom de
  stroken in Bedrijfsgegevens hun getinte vlak en dikke rand kwijtraakten.
- Toetsenbord als eersteklas interactie, net als Linear.

## Welk principe wanneer

- **Hiërarchie/gewicht** (DESIGN-PRINCIPES.md §5, "max drie niveaus", "meer ruimte/gewicht =
  meer belang"): gebruik dit zodra een onderdeel zwaarder oogt dan zijn eigen ouder-paneel, of
  zodra alles er even belangrijk uitziet terwijl dat niet zo is.
- **Progressive disclosure** (Linear, Stripe): gebruik dit zodra een scherm alles tegelijk toont
  wat pas ná een keuze relevant wordt.
- **Consistentie/geen ad-hoc varianten** (DESIGN-PRINCIPES.md §6): gebruik dit zodra je merkt dat
  er twee of drie bijna-identieke stijlen naast elkaar bestaan voor hetzelfde soort ding (zoals
  de vier tellerbadges die er hier waren).
