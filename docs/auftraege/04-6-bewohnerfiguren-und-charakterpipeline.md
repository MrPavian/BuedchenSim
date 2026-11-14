# Auftrag 04.6 – Bewohnerfiguren und Charakterpipeline

**Branch:** `claude/elegant-curie-17qulu`  
**Voraussetzung:** Auftrag 04.5 – Visual Identity & Graphics Foundation  
**Ziel:** Die vier wiederkehrenden Bewohner erhalten einen einheitlichen, hochwertigen Figurenstandard. Günter (N-002) ist die visuelle Referenz. Seine bereits positiv bestätigte Gestaltung bleibt die Grundlage; Derya, Jonas und Marlene werden als eigenständige, glaubwürdige Charaktere umgesetzt.

---

## 1. Ausgangslage und verbindliche Leitentscheidung

Die visuelle Baseline in `docs/VISUAL-BASELINE.md`, insbesondere Abschnitt 8, beschreibt die MakeHuman-zu-Blender-zu-GLB-Pipeline und Günters Prototyp. Der Nutzer hat Günters neue Optik ausdrücklich positiv bewertet („Sieht super aus“). Die grundsätzliche Stilrichtung gilt damit als bestätigt.

**Nicht neu interpretieren und keinen Stilwechsel beginnen.** Auftrag 04.6 ist die konsequente Fertigstellung und Vereinheitlichung der vier Bewohner – keine neue Art-Direction.

Verbindliche Qualität:
- So realistisch und glaubwürdig wie innerhalb der bestehenden stilisierten 3D-Bildsprache möglich.
- Natürliche menschliche Anatomie und Proportionen; keine groben Low-Poly-Puppen, keine kindliche Comicoptik und keine fotorealistischen Fremdkörper.
- Individuelle Gesichter, Körperformen, Silhouetten, Frisuren, Kleidung, Haltung und Farbkomposition.
- Haut, Augen, Haare, Bart und Kleidung mit differenzierten, aber zur bestehenden Welt passenden Materialien.
- Kleidung mit glaubwürdigem Schnitt, Falten, Nähten, Säumen, Taschen und dezenten Gebrauchsspuren.
- Figuren müssen in Nahansicht überzeugen und aus der normalen Spielkamera unterscheidbar sein.
- Natürlich wirkende Idle-, Walk- und Talk-Animationen; keine sichtbaren Gelenkfehler oder steifen T-Pose-Eindrücke.
- Figuren müssen sich in die bestehende Beleuchtung, Schatten und Materialwelt einfügen.

Ausschließlich originäre Figuren. Keine realen Personen nachbilden, keine geschützten Figuren oder fremden Charakterdesigns kopieren. Externe Quelldaten nur mit dokumentierter Lizenz; bevorzugt die bereits dokumentierte CC0-MakeHuman-Datenbasis.

## 2. Pflicht-Bestandsaufnahme vor Änderungen

Vor jeder Implementierung:
1. `CLAUDE.md` und die relevanten Projektunterlagen lesen.
2. Branch und Git-Status prüfen. Ausschließlich auf `claude/elegant-curie-17qulu` arbeiten; niemals auf `main`.
3. `docs/VISUAL-BASELINE.md`, `docs/PHASE-04-5-ABSCHLUSSBERICHT.md`, `docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md`, `docs/BEWOHNER-UND-GESCHICHTEN.md` und den vorhandenen Figurenauftrag lesen.
4. Tatsächliche Skripte, MakeHuman-Datenzugriff, Blender-Version, GLB-Ladepipeline, Animationen, Tests und Asset-IDs untersuchen.
5. Die vorhandenen Figuren und Referenzansichten reproduzieren. Günters aktuelle GLB-Datei und die bestehenden Screenshots sind die Referenz.
6. Prüfen, ob sich der Stand seit Auftrag 04.5 geändert hat. Keine Annahmen aus älteren Berichten als aktuelle Tatsachen behandeln.

Erstelle `docs/PHASE-04-6-BESTANDSAUFNAHME.md` mit:
- tatsächlichem Figuren- und Pipeline-Stand;
- wiederverwendbaren Skripten, Daten und Laufzeitverträgen;
- Abweichungen zwischen Dokumentation und Code;
- Risiken, Abhängigkeiten und konkreter Umsetzungsreihenfolge.

Keine parallele Pipeline aufbauen und keine bestehenden Verträge ohne Not ändern.

## 3. Arbeitspaket 4.6.1 – Günter gezielt fertigstellen

Günters Erscheinungsbild bleibt erhalten. Nur klar erkennbare Schwächen korrigieren:
- Hände und Armhaltung im Idle natürlicher an den Körper beziehungsweise den Spazierstock anpassen; keine unnatürlich abstehenden Hände.
- Rote Artefaktpunkte neben der Nase in der Hauttextur prüfen und entfernen, sofern es Texturfehler sind.
- Kleine Zacken an den Schirmenden der Schiebermütze beseitigen und die Kanten sauber ausarbeiten.
- Bestehende Identität, Alterseindruck, Gesicht, Kleidung, Farbgebung, Stock und Silhouette nicht unbeabsichtigt verändern.

### Mimik und Gesichtsausdrücke
Untersuche die vorhandenen MakeHuman-Ausdrucksziele unter `targets/expression` und die technische GLB-/Three.js-Unterstützung.
- Wenn technisch sauber und mit vertretbarem Aufwand möglich: wenige ausdrucksstarke, dezente Gesichtsausdrücke integrieren (mindestens neutral, freundlich, nachdenklich/ernst).
- Ausdruckswechsel müssen in Gesprächen natürlich und nicht abrupt wirken.
- Keine übertriebenen Grimassen und keine permanenten Gesichtsbewegungen.
- Falls Blend Shapes/Morph Targets die Dateigröße oder Laufzeit unverhältnismäßig erhöhen oder die Pipeline instabil machen, zunächst einen kleinen belastbaren Prototyp dokumentieren. Nicht die ganze Pipeline dafür umbauen.
- Für alle Figuren dieselbe technische Lösung verwenden, sofern sie sich bewährt.

## 4. Arbeitspaket 4.6.2 – Derya, Jonas und Marlene als individuelle Charaktere

Die drei vorhandenen NPCs N-003, N-006 und N-007 werden über dieselbe geprüfte Pipeline in eigenständige GLB-Figuren überführt.

### Charaktertreue
Die vorhandenen Contentprofile, Altersangaben, Persönlichkeiten, Tagesroutinen und Geschichten sind verbindlich. Vor dem Modellieren die tatsächlichen Daten in `src/content/regions/ruhrgebiet/residents.ts` und den zugehörigen Story-/Dialogdaten auswerten. Keine neuen Persönlichkeitsmerkmale erfinden, die den bestehenden Figuren widersprechen.

Jede Figur braucht:
- eigenständige Körperproportionen und Silhouette;
- unverwechselbares Gesicht und altersgerechte Merkmale;
- passende Frisur und gegebenenfalls Bart/Accessoires;
- Kleidung, die Persönlichkeit, Alltag und soziale Rolle plausibel widerspiegelt;
- eigene, stimmige Farbpalette;
- passende Haltung und dezente charakteristische Gesten.

**Keine drei Varianten desselben Grundmodells mit lediglich anderen Farben.** Die Figuren müssen schon als Silhouette und in der Spielkamera unterscheidbar sein.

### Vorgaben je Figur
- **Derya (N-003):** eigenständige weibliche Figur; Alter, Beruf/Alltag, Erscheinungsbild und Persönlichkeit aus den vorhandenen Contentdaten übernehmen. Kleidung und praktische Details müssen zu ihren tatsächlichen Routinen und ihrer Rolle als Handwerkerin passen, ohne Klischees.
- **Jonas (N-006):** jugendliche, klar als 17-jährig erkennbare Figur; natürliche jugendliche Proportionen, Kleidung und Haltung passend zu den vorhandenen Daten. Nicht wie ein erwachsener Mann mit verkleinertem Kopf gestalten. Seine Altersidentität muss glaubwürdig bleiben; die bestehende Alterskontrolle im Spiel bleibt unverändert.
- **Marlene (N-007):** eigenständige Figur mit den tatsächlichen Alters-, Persönlichkeits- und Alltagsmerkmalen aus den Contentdaten. Gesicht, Körperform, Frisur, Kleidung und Haltung deutlich von Derya und Günter unterscheiden.

Die konkreten Modellparameter werden aus den vorhandenen Charakterprofilen abgeleitet und in der Bestandsaufnahme beziehungsweise im Asset-Register dokumentiert. Keine unbegründeten Änderungen an NPC-Alter, Identität oder Story.

## 5. Technischer Figurenvertrag

Die in `docs/VISUAL-BASELINE.md` Abschnitt 8.3 festgelegten Verträge bleiben verbindlich, sofern die Bestandsaufnahme keine konkrete technische Unvereinbarkeit nachweist:

| Merkmal | Ziel |
|---|---|
| Format / Ort | GLB unter `public/models/residents/<asset-id>.glb` |
| Registrierung | vorhandene `RESIDENT_MODELS`-Registry |
| Maßstab / Pivot | 1 Einheit = 1 m; Pivot zwischen den Füßen; Blickrichtung wie bestehende Figuren |
| Animationen | `idle`, `walk`, `talk`; fehlende Clips dürfen nicht zu Laufzeitfehlern führen |
| Skelett | pro Instanz korrekt geklont; Geometrien, Materialien und Texturen möglichst geteilt |
| Material | glTF-PBR passend zur vorhandenen Lichtwelt |
| Texturen | WebP; maximal 1024², sofern kein belegter Grund dagegen spricht |
| Budget | höchstens 32.000 Dreiecke, 12 Primitive/Draw Calls je Figur und 2 MB je GLB |
| Fallback | prozedurale Figur bleibt bei Ladefehlern oder in Testumgebungen verfügbar |

Die Budgets sind Obergrenzen, keine Zielwerte, die ausgeschöpft werden müssen. Qualität darf nicht durch unnötige Geometrie erkauft werden. Gemeinsame Materialien/Geometrien/Texturen nutzen, wo es ohne sichtbare Qualitätsverluste möglich ist.

Die bestehende GLB-Lade- und Animationslogik erweitern, nicht parallel neu implementieren. Keine Änderungen an Gameplay-Simulation, Dialogen, Beziehungen, Wirtschaft oder Savegame-Schema, sofern nicht zwingend technisch erforderlich. Falls eine Vertragsänderung nötig wird, vorher begründen und rückwärtskompatibel umsetzen.

## 6. Integration und visuelle Abstimmung

Alle vier Figuren müssen gemeinsam in der echten Spielszene geprüft werden:
- gleiche Licht- und Schattenbedingungen;
- vergleichbare Materialwirkung und Detailtiefe;
- kein sichtbarer Stilbruch zwischen den Figuren;
- individuelle Gesichter und Silhouetten bleiben erhalten;
- keine ungewollten Durchdringungen von Kleidung, Körper oder Accessoires;
- keine auffälligen Fußgleiter, Gelenkdeformationen oder schwebenden Gegenstände;
- Gesprächsgesten und Blickrichtung passen zur Interaktion;
- Figuren bleiben bei Tagesroutinen, Wegfindung und Kollisionen korrekt.

Die Figuren dürfen feiner modelliert sein als Gebäude und Waren, müssen aber als zusammengehörige Bewohner derselben Spielwelt erscheinen.

## 7. Performance und Robustheit

Messen und dokumentieren:
- Dreiecke, Primitive/Draw Calls und Dateigröße jeder Figur;
- Gesamtszene mit vier GLB-Figuren;
- Speicherbedarf der gemeinsam genutzten Texturen und Geometrien;
- Ladezeit und Verhalten bei verzögertem Laden;
- Verhalten bei fehlender oder fehlerhafter GLB-Datei;
- Animationen bei mehreren gleichzeitig sichtbaren Bewohnern.

Keine FPS-Versprechen aus SwiftShader-/Headless-Messungen ableiten. Echte Hardwareprüfung separat kennzeichnen. Kein LOD-System für vier Bewohner erzwingen; nur dann ergänzen, wenn Messwerte und ein konkreter Anwendungsfall es rechtfertigen.

## 8. Regression und Abnahme

Alle vorhandenen Spielsysteme müssen unverändert funktionieren:
- Bewohner erscheinen und folgen ihren Tagesroutinen;
- Navigation, Wegpunkte, Kollisionsvermeidung und Ausweichverhalten;
- Dialoge, Antwortoptionen, Beziehungen, Erinnerungen und beide Alltagsgeschichten;
- NPC-Wünsche und Verkäufe über `economy.completeSale`;
- Alterskontrolle: Jonas (17) kann weiterhin keine Tabakwaren kaufen;
- Interaktionen, Kiosk-Kollisionen, Türen und Verkaufsklappe;
- Savegame Version 3 und Migrationen 1→2→3;
- prozeduraler Fallback bei fehlendem GLB und in Testumgebungen.

### Verbindliche visuelle Nachweise
Erstelle Screenshots aus der tatsächlichen Anwendung, keine Render-Mockups:
1. jede Figur frontal in Nahansicht;
2. jede Figur als Ganzkörperansicht;
3. jede Figur aus normaler Spielkamera;
4. alle vier gemeinsam in einer typischen Spielsituation;
5. alle vier in Idle, Walk und Talk;
6. Günter vorher/nachher für die gezielten Korrekturen;
7. mindestens eine Gesprächssituation, in der Mimik/Gesten erkennbar sind, sofern umgesetzt.

Lege die Ergebnisse unter `docs/screenshots/auftrag-04-6/` ab und ergänze eine README mit Figur, Perspektive, Animationsclip, Spielzustand, Browser/Renderer und Hinweisen.

### Tests
Zuerst die tatsächlich vorhandenen package scripts prüfen. Danach mindestens ausführen, sofern vorhanden:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run check:browser`

Die Browserprüfung nach den finalen Änderungen vollständig neu ausführen. Ein Testlauf vor der letzten Änderung zählt nicht als abschließender Nachweis. Testumfang, Laufzeit, Browser und Renderbackend dokumentieren.

## 9. Dokumentation und Abschlussbericht

Aktualisieren:
- `docs/VISUAL-BASELINE.md`;
- `docs/TECHNISCHER-IST-STAND.md`;
- `docs/IMPLEMENTIERUNGSPLAN.md`;
- `docs/artwork-prompts/07-artwork-register.md`, sofern dort Figurenstatus/Asset-IDs geführt werden;
- `README.md`.

Erstellen:
- `docs/PHASE-04-6-BESTANDSAUFNAHME.md`;
- `docs/PHASE-04-6-ABSCHLUSSBERICHT.md`;
- `docs/screenshots/auftrag-04-6/README.md`.

Der Abschlussbericht enthält:
1. Ausgangslage und tatsächliche Pipeline;
2. Änderungen an Günter;
3. individuelle Gestaltung der drei weiteren Figuren;
4. Asset-IDs, Dateigrößen und technische Budgets;
5. Mimik-/Morph-Target-Entscheidung und Grenzen;
6. Performancewerte und Messbedingungen;
7. Screenshots;
8. tatsächlich ausgeführte Tests;
9. Regressionsergebnisse und offene Einschränkungen;
10. Branch und Commit-Hashes.

Strikt zwischen ausgeführten Tests, dokumentierten Ergebnissen, manueller Sichtprüfung und nicht geprüften Funktionen unterscheiden.

## 10. Commit-Reihenfolge

In kleinen, nachvollziehbaren Schritten arbeiten:
1. Bestandsaufnahme und Pipeline-Prototyp für die gezielten Günter-Korrekturen;
2. Günter korrigieren und prüfen;
3. Derya modellieren, integrieren und prüfen;
4. Jonas modellieren, integrieren und prüfen;
5. Marlene modellieren, integrieren und prüfen;
6. alle vier Figuren gemeinsam abstimmen und Regression ausführen;
7. Dokumentation und Abschlussbericht vervollständigen.

Nach jedem Schritt relevante Tests und Build ausführen, Git-Status prüfen und einen aussagekräftigen Commit erstellen. Keine fremden Änderungen überschreiben. Alle Commits ausschließlich auf `claude/elegant-curie-17qulu`.

## 11. Ausdrücklich nicht Teil dieses Auftrags

- neue Engine, Godot, WebGPU oder Rendererwechsel;
- neue Region oder große Stadtumgebung;
- neue NPCs oder Änderungen an bestehenden Geschichten;
- neue Gameplaymechaniken, Dialoge oder Beziehungen;
- Savegame-Schemaänderung ohne zwingenden Grund;
- vollständiges Motion-Capture-System;
- komplexe Gesichtsrigging-/Lippensynchronisationspipeline;
- LOD-System ohne messbaren Bedarf;
- vollständige finale Grafikpolitur aller Spielassets.

## 12. Definition of Done

Auftrag 04.6 ist abgeschlossen, wenn:
- Günters bestätigte Optik erhalten und die klaren kleinen Schwächen gezielt behoben sind;
- Derya, Jonas und Marlene als individuelle, glaubwürdige Figuren im selben Qualitätsstandard integriert sind;
- alle vier Figuren aus Nah- und Spielkamera überzeugend und klar unterscheidbar wirken;
- Idle, Walk und Talk ohne auffällige Deformationen funktionieren;
- Mimik entweder mit einem kleinen, stabilen und sichtbaren Umfang umgesetzt oder technisch nachvollziehbar begründet zurückgestellt wurde;
- die vier GLB-Figuren gemeinsam innerhalb der dokumentierten Budgets laufen;
- Fallback, Tagesroutinen, Navigation, Dialoge, Kundenkäufe und Alterskontrolle intakt sind;
- Savegame Version 3 und Migrationen unverändert funktionieren;
- Typecheck, Lint, Tests, Build und finale Browserprüfung erfolgreich sind;
- Screenshots, Baseline und Abschlussbericht vollständig aktualisiert sind.

**Ergebnis:** Günter, Derya, Jonas und Marlene wirken wie vier unterschiedliche Menschen aus demselben Ruhrgebietsviertel – glaubwürdig, wiedererkennbar und stilistisch aus einem Guss. Danach kann Phase 5 auf einer konsistenten visuellen Figurenbasis weitergehen.
