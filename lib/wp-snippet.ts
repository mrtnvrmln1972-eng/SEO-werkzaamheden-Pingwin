// ═══════════════════════════════════════════════════════════
// HET PINGWIN-SNIPPET: SEO-VELDEN OPENZETTEN VOOR DE REST API
// ═══════════════════════════════════════════════════════════
// WAAROM DIT NODIG IS (in gewone taal)
// Een SEO-plugin (Yoast, Rank Math) bewaart de paginatitel en de
// meta-omschrijving als "post meta" bij de pagina. WordPress geeft zulke velden
// alleen door aan zijn eigen API als de plugin ze daar uitdrukkelijk voor heeft
// aangemeld. Rank Math doet dat op veel sites niet. Het gevolg is gemeen: de
// site antwoordt netjes "gelukt" op het verzoek en gooit het veld daarna weg.
// Zonder terugcontrole zou het dashboard dus melden dat het doorgevoerd is
// terwijl er niets veranderd was. Die terugcontrole zit erin (zie wp-push.ts),
// en dít stukje PHP haalt de oorzaak weg.
//
// WAT ER OP 21-08-2026 MIS WAS: de foutmelding zei "laat het Pingwin-snippet op
// de site installeren", en dat snippet bestond nergens. Een melding die naar
// iets verwijst dat je niet kunt krijgen, is geen oplossing maar een muur.
// Vandaar dit bestand: één bron voor de code én voor de instructie, met een
// knop om ze op te halen op precies het scherm waar je vastloopt.
//
// WAT HET SNIPPET WEL EN NIET DOET: het meldt vier bestaande velden aan bij de
// WordPress-API, met een rechtencontrole erbij (alleen wie de pagina mag
// bewerken, mag ze schrijven). Het verstuurt niets, het leest niets uit, het
// verandert uit zichzelf niets aan de site en het is met één bestand weer weg.
// ═══════════════════════════════════════════════════════════

export const SNIPPET_BESTAND = "pingwin-seo-rest.php";

export const WP_SNIPPET = `<?php
/**
 * Plugin Name: Pingwin SEO REST
 * Description: Stelt de SEO-velden van Yoast en Rank Math open voor de WordPress REST API, zodat een goedgekeurde paginatitel en meta-omschrijving vanuit het Pingwin SEO-dashboard doorgevoerd kunnen worden. Verstuurt niets, leest niets uit en wijzigt uit zichzelf niets.
 * Author: Pingwin Online Marketing
 * Version: 1.0
 */

defined( 'ABSPATH' ) || exit;

add_action(
	'init',
	function () {
		$velden = array(
			'_yoast_wpseo_title',
			'_yoast_wpseo_metadesc',
			'rank_math_title',
			'rank_math_description',
		);

		foreach ( get_post_types( array( 'public' => true ), 'names' ) as $type ) {
			foreach ( $velden as $veld ) {
				register_post_meta(
					$type,
					$veld,
					array(
						'type'              => 'string',
						'single'            => true,
						'show_in_rest'      => true,
						'sanitize_callback' => 'wp_strip_all_tags',
						'auth_callback'     => function ( $allowed, $meta_key, $post_id ) {
							return current_user_can( 'edit_post', $post_id );
						},
					)
				);
			}
		}
	},
	20
);
`;

/**
 * De instructie voor de sitebouwer, als platte tekst om te mailen of te plakken.
 *
 * Bewust hier en niet in een scherm: hij wordt op meer dan één plek gebruikt
 * (het scherm zelf en de knop "kopieer de instructie"), en twee kopieën van
 * dezelfde uitleg lopen uit elkaar.
 */
export function snippetInstructie(domein = ""): string {
  const site = domein ? ` van ${domein}` : "";
  return [
    `Verzoek: één klein bestand op de WordPress-site${site} plaatsen.`,
    "",
    "WAAROM",
    "Rank Math (en Yoast) bewaren de SEO-titel en de meta-omschrijving als post meta, maar melden die velden niet aan bij de WordPress REST API. Daardoor accepteert de site een wijziging via de API wel, maar bewaart hij hem niet. Dit bestand meldt precies die vier velden aan, met een rechtencontrole erbij.",
    "",
    "WAT HET DOET",
    `Het roept register_post_meta() aan voor _yoast_wpseo_title, _yoast_wpseo_metadesc, rank_math_title en rank_math_description, met show_in_rest = true en een auth_callback die current_user_can('edit_post') controleert. Verder niets: het verstuurt niets, het leest niets uit en het verandert uit zichzelf niets aan de site.`,
    "",
    "PLAATSEN, MANIER 1 (voorkeur, geen plugin nodig)",
    `1. Zet het bestand ${SNIPPET_BESTAND} in de map wp-content/mu-plugins/ (bestaat die map niet, maak hem dan aan).`,
    "2. Klaar. Een must-use plugin hoeft niet geactiveerd te worden en blijft staan bij een update van WordPress of van de thema's.",
    "",
    "PLAATSEN, MANIER 2 (als je niet bij de bestanden kunt)",
    "1. Installeer de gratis plugin Code Snippets.",
    "2. Nieuw snippet, type PHP, en plak de code erin zonder de eerste regel <?php.",
    "3. Zet hem op Run everywhere en activeer hem.",
    "",
    "TERUGDRAAIEN",
    "Bestand weggooien of het snippet deactiveren. Er blijft niets achter.",
    "",
    "CONTROLE",
    "Laat het even weten als het geplaatst is; wij drukken dan op Doorvoeren op de site en zien meteen of het veld nu wél bewaard wordt.",
  ].join("\n");
}
