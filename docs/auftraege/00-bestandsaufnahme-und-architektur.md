# Auftrag 00 – Repository-Bestandsaufnahme und Architekturvorbereitung

**Ausführung:** Claude Code im Repository-Root von BuedchenSim  
**Technologie-Ziel:** Three.js  
**Priorität:** P0 – vor jeder Implementierung  
**Änderungsumfang:** Analyse und Dokumentation. Keine Gameplay-Implementierung und keine unnötigen Codeänderungen.

## Ziel
Ermittle den tatsächlichen technischen Zustand des Repositories und entwickle daraus eine realistische, modulare Zielarchitektur für das geplante Büdchen-Simulationsspiel. Die langfristigen Systeme müssen von Anfang an berücksichtigt werden, werden aber ausdrücklich nicht alle sofort implementiert.

## Pflichtlektüre
1. `/CLAUDE.md`
2. `/docs/ARCHITEKTUR-ZIELBILD.md`
3. `/docs/IMPLEMENTIERUNGSPLAN.md`
4. `/docs/artwork-prompts/README.md`
5. Alle für die Architektur relevanten Unterdokumente, insbesondere Three.js-Standard, Roadmap und „Das Viertel lebt“.

## Arbeitsschritt A – Tatsächlichen Repository-Stand erfassen
Untersuche vollständig:
- vorhandene Dateien und Ordner
- package.json und sämtliche Scripts, falls vorhanden
- Three.js- und sonstige Abhängigkeiten
- Einstiegspunkte und App-Bootstrap
- Szenenaufbau, Renderer, Kamera, Controls und Beleuchtung
- UI und Interaktionssystem
- Asset-Pipeline und 3D-Formate
- Datenhaltung und Savegame-Ansatz
- Tests, Linting, Build und Deployment
- vorhandene Gameplay-Systeme und TODOs

Führe keine Annahmen als Fakten auf. Wenn das Repository noch keinen Spielcode enthält, sage das ausdrücklich und liste auf, was tatsächlich vorhanden ist.

## Arbeitsschritt B – Ist-/Soll-Abgleich
Ordne die Zielsysteme dem realen Bestand zu:
- Core / Game Runtime
- Three.js World
- Kiosk und Einrichtung
- Produkte, Inventar und Warenwirtschaft
- Finanzen, Kasse und Tagesabschluss
- NPCs, Routinen und Beziehungen
- Dialoge, Quests und Geschichten
- Kalender, Wetter und Events
- Rezepte und Kiosk-Traditionen
- UI
- Savegames und Datenmigration
- Audio und regionale Content-Pakete

Kennzeichne jedes System als vorhanden, teilweise vorhanden, nicht vorhanden oder noch zu entscheiden.

## Arbeitsschritt C – Modulgrenzen und Verträge
Schlage eine überschaubare Modulstruktur vor, die spätere Erweiterungen ermöglicht. Definiere:
- Zuständigkeit jedes Moduls
- öffentliche Schnittstellen
- erlaubte Abhängigkeiten und verbotene Querzugriffe
- Datenverträge und stabile IDs
- Kommunikation zwischen Modulen (Event-Nachrichten nur dort, wo sie sinnvoll sind)
- Trennung von Gameplay-Zustand und Three.js-Darstellung
- Trennung von Spiellogik und UI
- Savegame-Struktur, Versionsnummer und Migrationsstrategie
- Datenvalidierung für Produkte, NPCs, Quests und Events

Vermeide Überengineering. Keine Microservices, keine unnötigen Frameworks und kein globales Event-Bus-System ohne nachgewiesenen Nutzen. Einfache direkte Schnittstellen sind vorzuziehen, wenn sie ausreichen.

## Arbeitsschritt D – Umsetzungsstrategie
Lege fest:
1. Welches minimale Fundament vor dem ersten Gameplay-Feature nötig ist.
2. Welche Schnittstellen früh stabil sein müssen.
3. Welche Systeme zunächst als einfache Implementierung starten können.
4. Welche Teile ausdrücklich später ergänzt werden.
5. Wie neue Inhalte ohne Umbau zentraler Systeme hinzugefügt werden.
6. Welche technischen Risiken vor Phase 1 beseitigt werden müssen.

## Arbeitsschritt E – Dokumentation
Erstelle oder aktualisiere:
- `docs/TECHNISCHER-IST-STAND.md` – Fakten zur aktuellen Codebasis
- `docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md` – kurze ADRs mit Kontext, Entscheidung und Konsequenzen
- `docs/MODUL-UND-DATENVERTRAEGE.md` – Modulübersicht, Schnittstellen und zentrale Datenmodelle

Aktualisiere den Implementierungsplan nur, wenn die Analyse eine begründete Anpassung erfordert.

## Abnahmekriterien
- Tatsächlicher Codebestand ist nachvollziehbar dokumentiert.
- Keine erfundenen Dateien, Abhängigkeiten oder bereits existierenden Systeme.
- Modulstruktur ist klein, verständlich und Three.js-kompatibel.
- Spätere Features sind architektonisch vorgesehen, aber nicht vorzeitig gebaut.
- Savegames, stabile IDs und Datenverträge sind berücksichtigt.
- Claude nennt die nächsten konkreten Schritte für Phase 1.
- Build-/Test-Ergebnisse werden nur behauptet, wenn die entsprechenden Befehle tatsächlich ausgeführt wurden.

## Abschlussbericht
Am Ende kurz und präzise berichten:
1. Was im Repository tatsächlich vorhanden ist.
2. Welche Architektur vorgeschlagen wurde und warum.
3. Welche Dokumente geändert/neu angelegt wurden.
4. Welche Befehle ausgeführt wurden und mit welchem Ergebnis.
5. Welche konkrete Aufgabe als Nächstes ansteht.

**Wichtig:** Falls das Repository bisher nur Dokumentation enthält, ist das kein Grund, Spielcode zu erfinden. In diesem Fall zuerst die technische Projektbasis vorschlagen und vor ihrer Implementierung die notwendigen Entscheidungen transparent machen.
