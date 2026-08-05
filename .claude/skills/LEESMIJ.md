# Waarom hier symlinks staan

Claude Code vindt repo-skills alleen in `.claude/skills/`. De echte mappen staan een
niveau hoger in `skills/`, omdat het dashboard zelf daaruit leest tijdens het draaien
(`lib/prioriteiten-score.ts` leest `skills/vindbaarheid-prioriteiten-scan/scoring-config.json`).

Verplaatsen zou die leesroute breken, en een tweede kopie maken zou precies de fout zijn
die het brein beschrijft: dezelfde inhoud op twee plekken, die daarna stil uit elkaar loopt.
Vandaar een verwijzing in plaats van een kopie. Eén waarheid, twee ingangen.

Nieuwe skill toevoegen: map aanmaken in `skills/`, daarna hier de verwijzing erbij zetten
(`ln -s ../../skills/<naam> <naam>`).
