# Verslagcoach

Verslagcoach helpt studenten bij het schrijven van verslagen voor school. **Jij schrijft het verslag zelf**; de AI-coach helpt je het onderwerp te begrijpen, stelt vragen en geeft feedback. De coach schrijft nooit kant-en-klare verslagtekst voor je.

Het is een statische website: alles draait in je browser, er is geen eigen server en er is geen tracking. Je gebruikt je eigen AI-sleutel.

## Wat doet de app?

Elk verslag heeft drie hoofdstukken:

1. **Theorie** – alleen theorie die nieuw is ten opzichte van eerdere opdrachten.
2. **Uitwerking van de opdracht** – per stap wat, hoe en waarom, met screenshots en commando's.
3. **Resultaat van de opdracht** – eindresultaat, testcases (verwacht / werkelijk / geslaagd) en een korte reflectie.

Functies:

- **Opdracht plakken** (tekst en eventueel afbeeldingen). De coach maakt een plan: theorie-onderwerpen met uitleg om te leren en vragen om te beantwoorden, stappen voor hoofdstuk 2, testcases en reflectievragen. Theorie die je al in eerdere opdrachten behandelde, wordt herkend en standaard overgeslagen.
- Per onderdeel: **Feedback op mijn tekst** (de coach bekijkt ook je screenshots), **Help me op weg** (een opbouw plus één beginzin) en een vragenvak.
- Een **coach-chat** die weet in welke opdracht en welk hoofdstuk je zit.
- **Screenshots** plakken met Ctrl+V, slepen of kiezen. Klik om te vergroten, nog een keer om te verkleinen. Afbeeldingen worden verkleind voordat ze worden opgeslagen.
- **Stappen overnemen** (tekst, commando's, screenshots) uit een eerdere opdracht.
- Opdrachten op **ingeleverd** zetten en een **overzicht per vak**.
- **Export naar Word (.docx)** met je eigen sjabloon of het meegeleverde standaardsjabloon.
- **Oude verslagen importeren** (.docx) om de lijst met eerder behandelde theorie te vullen.
- **Coach-instructies** aanpassen: strengheid, onderwijsniveau, taal en taalniveau, eigen instructies en een maatstaf.
- **Back-up** van al je gegevens als één bestand (zonder je API-sleutel).
- Licht en donker thema, werkt op een smal scherm, te bedienen met het toetsenbord.

## Een API-sleutel aanmaken en invullen

Verslagcoach heeft geen ingebouwde AI-sleutel. Iedere gebruiker vult zijn eigen sleutel in.

### Anthropic (Claude) – aanbevolen

1. Ga naar de [Claude Console](https://platform.claude.com/) en maak een account aan.
2. Zet tegoed op je account (Billing). Stel eventueel een maandelijks maximum in, zodat je nooit meer uitgeeft dan je wilt.
3. Ga naar **API keys** en klik op **Create key**. Kopieer de sleutel (begint met `sk-ant-`). Je ziet hem maar één keer.
4. Open Verslagcoach → **Instellingen** → *AI-coach: jouw eigen sleutel*.
5. Kies aanbieder **Anthropic (Claude)**, plak de sleutel en klik op **Sleutel opslaan**.
6. Kies een model en klik op **Test verbinding**. Met **Modellen ophalen** zie je alle modellen die jouw sleutel mag gebruiken.

Standaard staat het model op Claude Opus 5.5 (beste kwaliteit). Wil je goedkoper werken, kies dan bijvoorbeeld Claude Sonnet 5.5 of Claude Haiku 5.5. Bij Claude-modellen van generatie 5 stuurt de app de optie `fallbacks: "default"` mee: weigert het model een verzoek om veiligheidsredenen, dan probeert Anthropic het automatisch met een ander model.

### Andere aanbieders (OpenAI-compatibel)

Kies **OpenAI-compatibel (eigen adres)** en vul de basis-URL in, bijvoorbeeld:

| Aanbieder | Basis-URL |
| --- | --- |
| OpenAI | `https://api.openai.com/v1` |
| OpenRouter | `https://openrouter.ai/api/v1` |
| Ollama (lokaal) | `http://localhost:11434/v1` (geen sleutel nodig) |

Let op: niet elke aanbieder staat verzoeken rechtstreeks vanuit de browser toe (CORS). Werkt het niet, dan meldt de app dat de dienst niet bereikbaar is.

### Wat gebeurt er met je sleutel?

- De sleutel staat **alleen op jouw apparaat**, in de opslag van je browser (`localStorage`). Hij staat niet in de code, gaat niet mee in back-ups of Word-bestanden en wordt nergens anders bewaard.
- Je vragen, teksten en screenshots gaan rechtstreeks van je browser naar de AI-aanbieder. Voor Anthropic gebruikt de app de officiële SDK met de header `anthropic-dangerous-direct-browser-access: true`.
- Het gebruik wordt **afgerekend op je eigen account**.
- Op een gedeelde computer: wis je sleutel als je klaar bent (Instellingen → *Sleutel wissen*).

Duidelijke foutmeldingen vertellen wat er mis is, bijvoorbeeld een ongeldige sleutel, een bereikte limiet, geen tegoed of geen internet.

## Een eigen Word-sjabloon maken

Je kunt het sjabloon van je school gebruiken. Zet daarin de volgende placeholders (inclusief de dubbele accolades):

| Placeholder | Wordt |
| --- | --- |
| `{{TITEL}}` | titel van de opdracht |
| `{{VAK}}` | vak |
| `{{NAAM}}` | je naam (Instellingen) |
| `{{KLAS}}` | je klas (Instellingen) |
| `{{SCHOOL}}` | je school (Instellingen) |
| `{{DATUM}}` | datum van vandaag, bijvoorbeeld *29 oktober 2026* |
| `{{INHOUDSOPGAVE}}` | de inhoudsopgave (in een eigen alinea) |
| `{{INHOUD}}` | de drie hoofdstukken (in een eigen alinea) |

Zo maak je het sjabloon:

1. Download het standaardsjabloon (Instellingen → *Word-sjabloon* → **Standaardsjabloon downloaden**) of open het sjabloon van je school.
2. Pas voorblad, kop- en voettekst, lettertypen en kleuren aan in Word. Placeholders mogen ook in de kop- en voettekst staan.
3. Zet `{{INHOUDSOPGAVE}}` en `{{INHOUD}}` elk in een eigen, verder lege alinea.
4. De koppen gebruiken de Word-stijlen **Kop 1** en **Kop 2**; afbeeldingen krijgen de stijl **Bijschrift**. Pas die stijlen aan om het uiterlijk te veranderen. Ontbreken ze, dan voegt de app ze toe.
5. Sla op als **Word-sjabloon (.dotx)** of als gewoon document (.docx) en upload het in Instellingen of op het tabblad *Word* van een opdracht.

Tips:

- De app begint elk hoofdstuk en de inhoudsopgave op een nieuwe pagina. Staat er in je sjabloon al een pagina-einde vlak voor de placeholder, dan voegt de app er geen tweede toe.
- Staat `{{INHOUD}}` niet in het sjabloon, dan komen de hoofdstukken aan het eind van het document.
- Onbekende placeholders (zoals `{{DOCENT}}`) blijven staan; de app waarschuwt je.
- Na het openen vraagt Word of velden bijgewerkt moeten worden. Kies **Ja**: dan wordt de inhoudsopgave gevuld.

## Lokaal draaien

Je hebt [Node.js](https://nodejs.org/) 22 of nieuwer nodig.

```bash
npm install
```

```bash
npm run dev
```

Open daarna de link die in de terminal staat (meestal http://localhost:5173).

Andere commando's:

```bash
npm test
```

```bash
npm run build
```

`npm run build` controleert de types en zet de site in de map `dist/`. Met `npm run preview` bekijk je die versie.

## Publiceren op GitHub Pages

De workflow `.github/workflows/deploy.yml` bouwt en test de app bij elke push naar `main` en publiceert hem daarna op GitHub Pages.

1. Push de code naar GitHub (branch `main`).
2. Ga in je repository naar **Settings → Pages** en kies bij *Source* voor **GitHub Actions**.
3. Na de volgende push (of via **Actions → Bouwen en publiceren → Run workflow**) staat de site op `https://<gebruikersnaam>.github.io/<repository>/`.

De site gebruikt relatieve paden en hash-routing (`#/...`), dus hij werkt in elke submap zonder extra instellingen.

## Privacy en opslag

- Opdrachten, screenshots, het Word-sjabloon en de lijst met eerdere theorie staan in **IndexedDB** in je browser. Instellingen staan in `localStorage`.
- Met **Back-up downloaden** krijg je één JSON-bestand met al je gegevens (zonder API-sleutel). Met **Back-up terugzetten** zet je het terug, bijvoorbeeld op een andere computer.
- Er is geen tracking, geen analytics en geen eigen server.

## Voor ontwikkelaars

| Map / bestand | Inhoud |
| --- | --- |
| `src/ai/standaard-instructies.ts` | **Alle standaardinstructies voor de coach** in één bestand |
| `src/ai/prompts.ts` | Bouwt de prompts op uit de coach-instellingen |
| `src/ai/plan.ts` | JSON-schema en verwerking van het plan |
| `src/ai/providers/` | Anthropic (SDK), OpenAI-compatibel, foutmeldingen. Een nieuwe aanbieder implementeert `AiAanbieder` en wordt geregistreerd in `index.ts` |
| `src/data/` | Gegevensmodel, IndexedDB, instellingen, back-up |
| `src/docx/` | Word-export, standaardsjabloon en import van oude verslagen |
| `src/ui/` | React-componenten en pagina's |
| `tests/` | Vitest-tests (Word-export, prompts, plan, opslag, providers) |

De vaste regel dat de coach geen complete verslagtekst schrijft staat in `VASTE_REGEL` en wordt altijd vooraan in de systeemprompt gezet, met een herinnering aan het eind; eigen instructies van de student komen daarna en zijn er expliciet ondergeschikt aan.

Zie ook [docs/PLAN.md](docs/PLAN.md) voor het oorspronkelijke plan.
