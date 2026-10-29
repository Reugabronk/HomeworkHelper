# Plan: Verslagcoach

Verslagcoach is een statische webapp (Vite + TypeScript + React) die studenten helpt bij het
schrijven van verslagen. De student schrijft zelf; de AI-coach legt uit, stelt vragen en geeft
feedback. Alles draait in de browser: geen eigen server, geen tracking.

## Uitgangspunten

| Onderwerp | Keuze |
| --- | --- |
| Hosting | Statische site op GitHub Pages (`base: './'`, hash-routing) |
| Taal interface | Nederlands |
| Opslag | IndexedDB (opdrachten, afbeeldingen, sjabloon, eerdere theorie), localStorage (instellingen, API-sleutel apart) |
| AI | Eigen sleutel per gebruiker. Anthropic via de officiële SDK (`dangerouslyAllowBrowser`, stuurt `anthropic-dangerous-direct-browser-access: true`). OpenAI-compatibele endpoints via `fetch` met eigen base-URL. |
| Word | JSZip in de browser; eigen sjabloon (.dotx/.docx) met `{{PLACEHOLDERS}}` of het meegeleverde standaardsjabloon |
| Tests | Vitest (Word-export, prompts, opslag, hulpfuncties) |

## Mappenstructuur

```
.github/workflows/deploy.yml   Build + tests + publicatie op GitHub Pages
docs/PLAN.md                   Dit plan
index.html                     Startpunt van Vite
public/                        Statische bestanden (favicon)
src/
  main.tsx                     Opstarten van de app
  app/                         App-schil, router, gedeelde context
  data/                        Typen, IndexedDB, instellingen, back-up
  images/                      Verkleinen en opslaan van afbeeldingen
  ai/
    standaard-instructies.ts   ALLE standaardteksten voor de coach (één bestand)
    prompts.ts                 Bouwt de prompts op uit de instellingen
    plan.ts                    JSON-schema en controle van het opdrachtplan
    coach.ts                   Plan, feedback, op weg helpen, vragen, chat
    providers/                 Anthropic, OpenAI-compatibel, foutmeldingen
  docx/
    xml.ts                     Hulpfuncties voor WordprocessingML
    template.ts                Sjabloon laden, .dotx -> .docx, placeholders vervangen
    content.ts                 Hoofdstukken -> Word-XML (koppen, code, tabel, afbeeldingen)
    export.ts                  Alles samenvoegen tot een .docx
    default-template.ts        Het meegeleverde standaardsjabloon
    import.ts                  Theorie-koppen uit oude verslagen halen
  ui/
    components/                Knoppen, dialoog, afbeeldingen, coachvak, chat, markdown
    pages/                     Overzicht, opdracht (hoofdstukken), instellingen, coach, ...
  styles/                      CSS met licht/donker thema
tests/                         Vitest-tests
```

## Gegevensmodel (kort)

- **Opdracht**: vak, titel, opdrachttekst + afbeeldingen, status (bezig/ingeleverd), diepgang
  (basis/uitgebreid), plan, hoofdstukken en chatgeschiedenis.
- **Hoofdstuk 1 – Theorie**: onderwerpen met uitleg (om te leren), vragen, eigen tekst,
  screenshots, status (actief/overgeslagen) en "al behandeld in ...".
- **Hoofdstuk 2 – Uitwerking**: stappen met wat/hoe/waarom-tekst, commando's en screenshots.
- **Hoofdstuk 3 – Resultaat**: eindresultaat (tekst + screenshots), testcases
  (verwacht/werkelijk/geslaagd) en reflectie (vragen + tekst).
- **Afbeelding**: bytes (verkleind), type, afmetingen, bijschrift.
- **Eerdere theorie**: onderwerpen uit geïmporteerde verslagen; aangevuld met de theorie uit
  eigen opdrachten.

## Coach-instructies

De systeemprompt wordt opgebouwd uit vaste blokken in `standaard-instructies.ts`:

1. Rol + **vaste regel** (niet uit te zetten): de coach schrijft geen complete verslagtekst.
2. Verslagopbouw (drie hoofdstukken).
3. Onderwijsniveau, taal en taalniveau.
4. Strengheid (mild/normaal/streng).
5. Eigen instructies van de student (ondergeschikt aan de vaste regel).
6. Optionele maatstaf (voorbeeld van een voldoende verslag).
7. Taakinstructie (plan, feedback, op weg, vraag, chat) + context van opdracht en hoofdstuk.

## Stappen (commits)

1. Plan en mappenstructuur, Vite/TypeScript/Vitest-opzet.
2. Opslag: IndexedDB, instellingen, back-up (zonder sleutels), afbeeldingen verkleinen.
3. AI-koppeling: providers, foutmeldingen, model kiezen, verbinding testen.
4. Coach-instructies en promptopbouw (+ tests).
5. App-schil, thema, instellingenpagina's.
6. Opdrachten: nieuw, overzicht per vak, plan laten maken, ingeleverd.
7. Hoofdstukken 1–3 met coachvakken, screenshots en stappen overnemen; coach-chat.
8. Import van oude verslagen (eerdere theorie).
9. Word-export met eigen of standaardsjabloon (+ tests).
10. README en GitHub Pages-workflow.
