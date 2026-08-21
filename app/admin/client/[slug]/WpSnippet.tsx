"use client";

// ═══════════════════════════════════════════════════════════
// "DE SEO-VELDEN STAAN NIET OPEN VOOR DE API": HIER IS DE OPLOSSING
// ═══════════════════════════════════════════════════════════
// Rank Math (en Yoast) bewaren de paginatitel en de meta-omschrijving als post
// meta, maar melden die velden niet aan bij de WordPress-API. De site zegt dan
// "gelukt" op een wijziging en gooit hem daarna weg. Het dashboard merkt dat
// (het leest het veld terug), maar de melding die eruit kwam verwees naar "het
// Pingwin-snippet" dat nergens te krijgen was. Maartens vraag op 21-08-2026:
// "hoe kunnen we dit oplossen, kun je mij een duidelijke instructie geven voor
// de sitebouwer?"
//
// Dit blok is dat antwoord, en het staat op precies het scherm waar je vastloopt:
// het bestand om te downloaden, de code om te plakken, en de instructie als
// kant-en-klare tekst om door te sturen. Eén bron voor alle drie
// (lib/wp-snippet.ts), zodat de uitleg in de mail en de uitleg op het scherm
// nooit uit elkaar kunnen lopen.

import { useState } from "react";
import { SNIPPET_BESTAND, WP_SNIPPET, snippetInstructie } from "../../../../lib/wp-snippet";

export default function WpSnippet({ slug, domein, melding }: {
  slug: string;
  /** Het domein van de klant, alleen om de instructie persoonlijk te maken. */
  domein?: string;
  /** De fout die het scherm kreeg; die zetten we erboven zodat duidelijk is
      waar dit blok bij hoort. */
  melding?: string;
}) {
  const [open, setOpen] = useState(false);
  const [gekopieerd, setGekopieerd] = useState("");

  async function kopieer(wat: "code" | "instructie") {
    const tekst = wat === "code" ? WP_SNIPPET : snippetInstructie(domein);
    try {
      await navigator.clipboard.writeText(tekst);
      setGekopieerd(wat);
      setTimeout(() => setGekopieerd(""), 2000);
    } catch { /* de browser weigert het klembord; de tekst staat hieronder ook */ }
  }

  return (
    <>
      <button type="button" className="btn btn-klein" onClick={() => setOpen((v) => !v)} aria-expanded={open}
        title="Waarom de site de wijziging niet bewaart, en het bestand plus de instructie waarmee de sitebouwer het eenmalig oplost.">
        Uitleg voor de sitebouwer
      </button>
      {open && (
        <div className="wz-add wp-snip">
          {melding && <div className="login-error">{melding}</div>}
          <p className="wp-snip-tekst">
            <strong>Wat er aan de hand is.</strong> De SEO-plugin bewaart de paginatitel en de meta-omschrijving
            wél, maar meldt die velden niet aan bij de WordPress-API. De site accepteert onze wijziging dus met
            een &ldquo;gelukt&rdquo; en gooit hem daarna weg. Het dashboard leest het veld terug en ziet dat, en
            daarom staat er hierboven een foutmelding in plaats van een groen vinkje.
          </p>
          <p className="wp-snip-tekst">
            <strong>De oplossing is eenmalig en klein.</strong> Eén bestand van twintig regels dat vier bestaande
            velden aanmeldt bij de API, met een rechtencontrole erbij. Het verstuurt niets, het leest niets uit
            en het verandert uit zichzelf niets aan de site. Weghalen kan altijd; er blijft niets achter.
            Daarna werkt &ldquo;Doorvoeren op de site&rdquo; voor élke pagina van deze klant.
          </p>
          <div className="pnl-acties-groep wp-snip-acties">
            <a className="btn btn-primary btn-klein" href={`/api/admin/wp-snippet?slug=${encodeURIComponent(slug)}`} download={SNIPPET_BESTAND}>
              Download {SNIPPET_BESTAND}
            </a>
            <button type="button" className="btn btn-klein" onClick={() => void kopieer("instructie")}>
              {gekopieerd === "instructie" ? "Instructie gekopieerd" : "Kopieer de instructie voor de sitebouwer"}
            </button>
            <button type="button" className="btn btn-klein" onClick={() => void kopieer("code")}>
              {gekopieerd === "code" ? "Code gekopieerd" : "Kopieer de code"}
            </button>
          </div>
          <p className="wp-snip-tekst">
            <strong>Waar het bestand heen moet.</strong> In de map <code>wp-content/mu-plugins/</code> op de
            site. Dat is een must-use map: er hoeft niets geactiveerd te worden en hij blijft staan bij een
            update. Kan de sitebouwer niet bij de bestanden, dan kan het ook met de gratis plugin Code Snippets:
            nieuw snippet, type PHP, de code erin zonder de eerste regel <code>&lt;?php</code>, op &ldquo;Run
            everywhere&rdquo; zetten en activeren.
          </p>
          <details className="wp-snip-code">
            <summary>De code zelf bekijken</summary>
            <pre className="md-code"><code>{WP_SNIPPET}</code></pre>
          </details>
          <p className="wp-snip-tekst muted">
            Staat het erop? Druk dan gewoon opnieuw op &ldquo;Doorvoeren op de site&rdquo;. Het dashboard leest
            het veld daarna terug, dus je ziet meteen of het nu wél bewaard is.
          </p>
        </div>
      )}
    </>
  );
}
