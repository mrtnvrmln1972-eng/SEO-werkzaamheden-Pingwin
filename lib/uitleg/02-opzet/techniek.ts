import type { Uitklapper } from "../types";

// Waar het op draait, hoe de database zichzelf op orde houdt, en één codebase voor meerdere merken.
export const BLOKKEN: Uitklapper[] = [
    {
      titel: "Technisch: waar het op draait",
      kern: "Next.js op Vercel, Postgres, geen UI-library.",
      tekst:
        "- **Applicatie:** Next.js 14 (App Router) met TypeScript en React 18. Server-side waar het om data " +
        "gaat, client-side waar het om interactie gaat.\n" +
        "- **Database:** eigen Postgres (Neon), ongeveer tachtig tabellen, alles per klant gescheiden.\n" +
        "- **Hosting:** Vercel. Een push naar de hoofdlijn is een productie-deploy.\n" +
        "- **Vormgeving:** handgeschreven CSS op een vast fundament van schaal-tokens (afstanden, tekstgroottes, " +
        "rondingen, schaduwen) met gedeelde bouwstenen. Geen Tailwind, geen componentbibliotheek, dus geen " +
        "vreemde huisstijl die er doorheen komt.\n" +
        "- **Documenten:** Word-documenten worden in de applicatie zelf opgebouwd in de Pingwin-huisstijl, " +
        "Excel-exports idem.\n" +
        "- **Crawlen:** een echte browser (headless Chromium) voor pagina's die JavaScript nodig hebben, en een " +
        "snelle HTML-modus voor de rest.",
    },
    {
      titel: "De database houdt zichzelf op orde",
      kern: "Geen migratiescripts, de app repareert haar eigen schema.",
      tekst:
        "Een nieuwe kolom of tabel wordt niet met een handmatig script uitgerold, maar bij het eerste gebruik " +
        "aangemaakt als hij nog niet bestaat. Dat is een bewuste keuze: het bureau dat dit gebruikt hoeft geen " +
        "database-beheerder te zijn, en een nieuwe omgeving is binnen een minuut werkend.\n\n" +
        "Praktisch gevolg: dit dashboard uitrollen voor een tweede bureau is een kwestie van een leeg project, " +
        "een database en de sleutels van de koppelingen. Niet een migratietraject.\n\n" +
        "Sinds 11 augustus 2026 gebeurt dat repareren ook één keer in plaats van steeds opnieuw. De app draaide " +
        "die honderd controles namelijk bij élke koude server, en dat waren honderd losse rondjes naar de " +
        "database vóórdat er iets in beeld kwam. Nu staat er een stempel in de database met de versie van het " +
        "schema: klopt die met de code, dan wordt het hele blok overgeslagen. Eén korte leesopdracht in plaats " +
        "van honderd schrijfopdrachten. Vergeten die versie op te hogen kan niet, want de bouw rekent de " +
        "vingerafdruk van de code na en mislukt als het niet meer klopt.",
    },
    {
      titel: "Eén codebase, meerdere merken",
      kern: "Het project bepaalt het merk, niet de code.",
      tekst:
        "De naam, de favicon en de accenten volgen uit welke omgeving er draait. Dezelfde code levert dus een " +
        "Pingwin-dashboard, een dashboard voor een zorginstelling met hun eigen merk, en een derde omgeving, " +
        "zonder aparte takken of losse kopieën.\n\n" +
        "Dat is de basis onder een licentiemodel: een bureau krijgt zijn eigen omgeving met zijn eigen merk, " +
        "zijn eigen database en zijn eigen sleutels, terwijl de motor voor iedereen dezelfde blijft en dus " +
        "voor iedereen tegelijk beter wordt.",
    },
    {
      titel: "Een klant verhuizen tussen omgevingen",
      kern: "Alles gaat mee, in één keer, zonder lijst die veroudert.",
      tekst:
        "Draait een klant nog in een eigen, losse omgeving, dan haalt één scherm hem hierheen: taken, chats, " +
        "pagina's en alles wat er verder aan die klant hangt. De klantkaart ontstaat vanzelf mee, zonder inlog " +
        "en zonder bedragen.\n\n" +
        "Het bijzondere zit in wat er níet gebeurt: er is geen lijst met soorten gegevens die iemand moet " +
        "bijhouden. De verhuizing kijkt in de database zelf welke tabellen aan een klant hangen, dus wat er " +
        "later bijkomt gaat vanzelf mee. Een eerdere koppeling kende acht soorten, terwijl er vierenzeventig " +
        "aan een klant hangen; alles daarbuiten bleef stil achter.\n\n" +
        "Het inlezen gebeurt van server naar server, dus zonder ingelogde gebruiker. Het slot daarop is een " +
        "code die de ontvangende kant zelf maakt: een uur geldig, gebonden aan één klant, versleuteld " +
        "opgeslagen en met één klik in te trekken. Zonder geldige code bestaat die deur niet. Verhuizen kan " +
        "bovendien alleen naar een Pingwin-omgeving, en twee keer verhuizen levert geen dubbele taken op: de " +
        "eerste hap van een soort vervangt wat er stond.",
    },
];
