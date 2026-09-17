#!/usr/bin/env python3
"""
DE POORT OP DE OMVANG, doorverwijzing naar het brein.

De echte poort staat in `pingwin-brein/.claude/hooks/omvang-poort.py`. Dit
bestand roept die aan en geeft de invoer onveranderd door. Geen kopie, want
twee kopieën lopen uit elkaar zonder dat iemand het merkt (dat is met de skills
en met de werkregels in twee CLAUDE.md's al misgegaan). Eén waarheid: het
brein. Dezelfde keuze als `session-start.sh` hiernaast.

De grenzen zijn wél van deze repo en staan in `.claude/omvang-grenzen.json`.

Komt het brein niet mee in de sessie, dan houdt deze poort niets tegen, maar
zegt hij dat hardop. Een poort die stil uitstaat is gevaarlijker dan geen
poort: dan denk je dat er op gelet wordt.
"""

import os
import subprocess
import sys

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BREIN = os.path.join(os.path.dirname(REPO), "pingwin-brein", ".claude", "hooks", "omvang-poort.py")


def main() -> int:
    invoer = sys.stdin.read()

    if not os.path.isfile(BREIN):
        print(
            "Let op: het brein-repo (pingwin-brein) komt niet mee in deze sessie, dus de "
            "poort op de omvang van CLAUDE.md staat uit. Koppel het brein als extra bron "
            "aan deze chat, of kijk zelf na of CLAUDE.md niet te dik is geworden.",
            file=sys.stderr,
        )
        return 0

    uit = subprocess.run(
        [sys.executable, BREIN],
        input=invoer,
        text=True,
        capture_output=True,
        env={**os.environ, "CLAUDE_PROJECT_DIR": REPO},
    )
    if uit.stdout:
        sys.stdout.write(uit.stdout)
    if uit.stderr:
        sys.stderr.write(uit.stderr)
    return uit.returncode


if __name__ == "__main__":
    sys.exit(main())
