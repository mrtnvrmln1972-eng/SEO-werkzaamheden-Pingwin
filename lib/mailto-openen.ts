// ═══════════════════════════════════════════════════════════
// HET EIGEN MAILPROGRAMMA OPENEN: ÉÉN MANIER, VOOR ELKE KNOP
// ═══════════════════════════════════════════════════════════
// Een mailknop die "niets doet" is bijna altijd dezelfde fout, en die fout is
// op drie plekken apart uitgeschreven geweest:
//
//   window.location.href = "mailto:..."   → de browser springt weg als er een
//                                           mailprogramma aan mailto: hangt, en
//                                           doet anders letterlijk niets
//   window.open("mailto:...", "_blank")   → laat een leeg tabblad achter, of
//                                           doet niets
//
// In beide gevallen krijgt de gebruiker geen enkel signaal: geen venster, geen
// melding, geen fout. Hij klikt nog een keer, en concludeert dat de knop stuk
// is. Dat is precies wat er met de mailknop in de developerlijst gebeurde.
//
// Wat wél betrouwbaar is: een echt <a>-element in de pagina zetten en dat
// aanklikken. Dan pakt de browser de standaard-mailapp zonder leeg tabblad.
// Werken kan het nog steeds niet als er in die browser helemaal geen
// mailprogramma aan mailto: hangt; daarom geeft deze functie `false` terug als
// er geen adres is, en hoort er bij élke knop een zichtbare terugval te staan
// ("kopieer mailtekst"), zodat de gebruiker nooit voor een dood knopje staat.
//
// De echte oplossing blijft: versturen via de mailkoppeling van het dashboard
// zelf (`/api/admin/mail`, zie `MailPopup`). Deze helper is de terugval voor
// omgevingen zonder die koppeling.
//
// `proeven/mailknop.proef.ts` bewaakt dat er geen nieuwe knop terugvalt op de
// twee kapotte patronen hierboven.
// ═══════════════════════════════════════════════════════════

/**
 * Opent het eigen mailprogramma met een voorgevulde mail.
 * Geeft `false` terug als er geen ontvanger is (dan hoort de knop een melding
 * te tonen in plaats van te doen alsof er iets gebeurde).
 *
 * `ontvangerLeegMag`: open het mailvenster ook ZONDER adres, zodat de gebruiker
 * de ontvanger in zijn eigen mailprogramma kiest. Dat is de juiste stand voor
 * elke knop die vroeger een onthouden adres invulde: het dashboard hoort nooit
 * te gokken naar wie een mail gaat (zie de ADRESVELD-REGEL in
 * app/admin/client/[slug]/MailUitKaart.tsx). Voor een knop met een eigen
 * adresveld in beeld blijft `false` juist: daar is een leeg veld een vergissing
 * en hoort er een melding te komen.
 */
export function openMailProgramma(opts: { aan: string; onderwerp: string; tekst: string; ontvangerLeegMag?: boolean }): boolean {
  const aan = (opts.aan || "").trim();
  if (!aan && !opts.ontvangerLeegMag) return false;
  if (typeof document === "undefined") return false;
  const a = document.createElement("a");
  a.href = `mailto:${aan}?subject=${encodeURIComponent(opts.onderwerp || "")}&body=${encodeURIComponent(opts.tekst || "")}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  return true;
}
