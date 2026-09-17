# Deploy en proeven: het waarom onder de twee regels

Uitwerking bij hoofdstuk 7 in `CLAUDE.md`. Verplaatst op 17-09-2026 bij het
zetten van de omvang-poort in deze repo; er is niets geschrapt.

## 7. Deploy en test

**Begin élke wijziging met de laatste code, ook als de chat al even openstaat (vaste regel,
11-08-2026).** Een chat krijgt zijn kopie van de repo op het moment dat de chat opengaat, niet op
het moment dat je gaat bouwen. Sta je 's ochtends aan en werk je 's middags door, dan bouw je op
code van vanochtend, ook al liep er niets tegelijk. Dat is de echte reden waarom "ik los A op en B
breekt": je legt je werk over een versie heen die intussen is opgeschoven. Dus vóór je iets
aanraakt, en nog een keer vlak vóór je pusht:

```bash
git fetch origin main && git rebase origin/main
npm run proef
```

Botsen er twee wijzigingen, dan zie je dat nu meteen als een conflict in plaats van later als een
kapot scherm. Dit is geen theorie: tijdens het bouwen van de proeven-poort op 11 augustus schoof
`main` twee keer op onder de sessie door, met een botsing in `package.json` tot gevolg.

```bash
git add . && git commit -m "[beschrijving]" && git push origin main
scripts/wacht-op-deploy.sh
```

**Die tweede regel hoort er altijd bij.** Pushen is niet hetzelfde als live: zonder die stap
koppel je terug op een deploy die nog loopt, en opent Maarten een link die hem het oude scherm
laat zien. `scripts/wacht-op-deploy.sh` pollt `/api/versie` (die geeft de draaiende commit terug)
tot jouw commit er staat, of tot een latere deploy die hem bevat: er wordt uit meerdere chats en
crons naar `main` gepusht, dus dat laatste is normaal. Klaar met code 0 betekent live; dán pas het
scherm bekijken via het meekijk-recept en dán pas terugkoppelen. Code 1 betekent tijdslimiet: niet
melden als live, maar de bouwstatus van die commit opvragen via de GitHub-tools, want een mislukte
build ziet er van buitenaf hetzelfde uit als een trage. Knoppen: `WACHT_INTERVAL_S` en
`WACHT_TIMEOUT_S`.

Pushen naar main is genoeg: de GitHub-koppeling deployt automatisch naar productie (geldt voor Pingwin én de NOC-cockpit, zelfde repo). Draai NIET ook nog `npx vercel --prod --yes` na een push: dat geeft dubbele deployments en elke extra deploy breekt lopende achtergrondtaken (doc-generaties) een keer extra af. Gebruik dat commando alleen om te deployen ZONDER code-wijziging (bijv. een nieuwe env-var activeren). Testen gebeurt op de live URL (DB alleen op de server). Rooktest met curl op de login- en admin-endpoints werkt goed.
