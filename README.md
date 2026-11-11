# BuedchenSim
Ein Büdchen-Simulator

## Start für Claude Code
Das [Architektur-Zielbild](docs/ARCHITEKTUR-ZIELBILD.md) beschreibt die langfristige modulare Struktur. Es wird früh geplant, aber schrittweise umgesetzt.
Die verbindlichen Arbeitsanweisungen stehen in [CLAUDE.md](CLAUDE.md). Der chronologische [Implementierungsplan](docs/IMPLEMENTIERUNGSPLAN.md) legt die Reihenfolge der Three.js-Entwicklung fest. Claude Code muss zuerst diese Dateien lesen und anschließend die jeweilige Fachdokumentation.

## Projektstand
Das Repository enthält bisher nur Dokumentation, noch keinen Spielcode. [Auftrag 00](docs/auftraege/00-bestandsaufnahme-und-architektur.md) ist abgeschlossen; seine Ergebnisse:
- [Technischer Ist-Stand](docs/TECHNISCHER-IST-STAND.md)
- [Architektur-Entscheidungen (ADRs)](docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md) – enthält offene Produktentscheidungen O-1 bis O-5
- [Modul- und Datenverträge](docs/MODUL-UND-DATENVERTRAEGE.md)

## Bestätigte Produktentscheidungen
- **O-1 – Perspektive:** Third Person mit schräger, leicht erhöhter Kamera; WASD und E, Maus ergänzend.
- **O-2 – Plattform:** Desktop-Browser mit Maus und Tastatur zuerst; Touch später.

Die Entscheidungen sind in den [ADRs](docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md) als entschieden markiert.

## Nächster Schritt
[Auftrag 01 – Three.js-Projektgerüst und erste spielbare Greybox](docs/auftraege/01-threejs-projektgeruest-und-greybox.md) mit Claude Code ausführen. Er baut erstmals echten Spielcode auf Basis der Architektur aus Auftrag 00.

## Projekt-Dokumentation
Die Art-Direction, Produktionsplanung, Regionen, fiktive Produktwelt, Claude-Code-Prompts und Three.js-Asset-Standards liegen unter [docs/artwork-prompts](docs/artwork-prompts/README.md).

**Wichtige Gestaltungsregel:** ausschließlich fiktive Marken, Logos, Verpackungen und Beschilderung. Keine realen Marken oder nachgebildeten geschützten Designs.
