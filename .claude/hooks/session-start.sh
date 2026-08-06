#!/bin/bash
# Sessiestart voor het dashboard-repo: geeft het werk door aan de hook in het
# brein-repo.
#
# Waarom dit bestand bestaat: tot nu toe draaide er in een dashboardsessie
# helemaal geen sessiestart. Begon je een chat hier, dan kreeg je geen
# overdrachtsbriefje, geen lopende sporen, geen meekijk-sessie en geen
# skill-synchronisatie. Precies de sessies waarin het meeste gebouwd wordt
# begonnen dus met de minste context.
#
# Geen kopie van de hook maar een doorverwijzing, want twee kopieën lopen uit
# elkaar (dat is met de skills al een keer misgegaan). Eén waarheid: het brein.
set -euo pipefail

if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BREIN_HOOK="$(dirname "$REPO")/pingwin-brein/.claude/hooks/session-start.sh"

if [ -x "$BREIN_HOOK" ]; then
  exec "$BREIN_HOOK"
fi

echo "Let op: het brein-repo (pingwin-brein) komt niet mee in deze sessie."
echo "  Daardoor ontbreken het overdrachtsbriefje, de lopende sporen en de"
echo "  meekijk-sessie. Meld dit; koppel het brein als extra bron aan deze"
echo "  omgeving in plaats van vanuit het geheugen te werken."
