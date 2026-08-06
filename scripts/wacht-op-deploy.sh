#!/usr/bin/env bash
# Wacht tot de live site echt de opgegeven commit draait, door /api/versie te
# pollen. Draai dit direct na `git push origin main`.
#
# Waarom: pushen is niet hetzelfde als live. Zonder deze stap wordt er
# teruggekoppeld op een deploy die nog loopt, en dan opent Maarten een link die
# hem het oude scherm laat zien. De regel is: de link komt pas als het staat.
#
# Gebruik:
#   scripts/wacht-op-deploy.sh [sha] [url]
#     sha   commit om op te wachten (standaard: HEAD van deze checkout)
#     url   basis-URL (standaard: de productie-URL van het dashboard)
#
# Knoppen (env):
#   WACHT_INTERVAL_S   seconden tussen pogingen (standaard 10)
#   WACHT_TIMEOUT_S    harde tijdslimiet in seconden (standaard 600)
#
# Exitcodes:
#   0  live (exact deze commit, of een latere deploy die hem bevat)
#   1  tijdslimiet verstreken; NIET melden als live, eerst de bouwstatus
#      opvragen via de GitHub-tools (er is geen Vercel-token in deze repo)
#   2  verkeerd gebruik

set -uo pipefail

SHA="${1:-}"
URL="${2:-https://pingwin-seo-dashboard.vercel.app}"
INTERVAL="${WACHT_INTERVAL_S:-10}"
TIMEOUT="${WACHT_TIMEOUT_S:-600}"

if [ -z "$SHA" ]; then
  SHA="$(git rev-parse HEAD 2>/dev/null)"
  if [ -z "$SHA" ]; then
    echo "FOUT: geen commit opgegeven en geen git-repo om HEAD uit te lezen." >&2
    exit 2
  fi
fi

ENDPOINT="${URL%/}/api/versie"
START=$(date +%s)
POGING=0
GEFETCHT=0

echo "Wacht op ${SHA:0:7} via ${ENDPOINT} (elke ${INTERVAL}s, limiet ${TIMEOUT}s)..."

while true; do
  POGING=$((POGING + 1))
  VERSTREKEN=$(( $(date +%s) - START ))

  if [ "$VERSTREKEN" -ge "$TIMEOUT" ]; then
    echo "TIJDSLIMIET na ${VERSTREKEN}s: ${SHA:0:7} is nooit live verschenen."
    echo "Niet melden als live. Vraag de bouwstatus van deze commit op via de"
    echo "GitHub-tools; een mislukte build ziet er van hieraf hetzelfde uit als"
    echo "een trage build."
    exit 1
  fi

  ANTWOORD="$(curl -sS --max-time 10 "$ENDPOINT" 2>/dev/null)"
  if [ $? -ne 0 ]; then
    echo "[${VERSTREKEN}s] poging ${POGING}: site nog niet bereikbaar, nog bezig..."
    sleep "$INTERVAL"
    continue
  fi

  LIVE="$(printf '%s' "$ANTWOORD" | sed -n 's/.*"sha":"\([0-9a-f]\{7,40\}\)".*/\1/p')"

  if [ -z "$LIVE" ]; then
    # Twee onschuldige oorzaken, allebei "nog bezig": de nog-live build kent
    # /api/versie nog niet (de allereerste keer dat deze route uitrolt, dan is
    # het een 404), of de deploy is net omgewisseld. Lost zichzelf op.
    echo "[${VERSTREKEN}s] poging ${POGING}: nog geen geldige versie terug, nog bezig..."
    sleep "$INTERVAL"
    continue
  fi

  if [ "$LIVE" = "$SHA" ]; then
    echo "LIVE: ${LIVE:0:7} staat er, na ${VERSTREKEN}s (${POGING} pogingen)."
    exit 0
  fi

  # Er staat iets anders live. Dat hoeft geen probleem te zijn: er wordt vanuit
  # meerdere chats en crons naar main gepusht, dus onze commit kan zijn
  # meegelift met een nieuwere deploy. Dan zijn we ook klaar.
  if ! git cat-file -e "${LIVE}^{commit}" 2>/dev/null && [ "$GEFETCHT" -eq 0 ]; then
    git fetch --quiet origin main 2>/dev/null
    GEFETCHT=1
  fi
  if git cat-file -e "${LIVE}^{commit}" 2>/dev/null \
     && git merge-base --is-ancestor "$SHA" "$LIVE" 2>/dev/null; then
    echo "LIVE (meegelift): live is ${LIVE:0:7} en dat bevat ${SHA:0:7}."
    exit 0
  fi

  echo "[${VERSTREKEN}s] poging ${POGING}: live is nog ${LIVE:0:7}, wachten op ${SHA:0:7}..."
  sleep "$INTERVAL"
done
