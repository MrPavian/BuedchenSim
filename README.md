# BuedchenSim
Ein Büdchen-Simulator

## Start für Claude Code
Das [Architektur-Zielbild](docs/ARCHITEKTUR-ZIELBILD.md) beschreibt die langfristige modulare Struktur. Es wird früh geplant, aber schrittweise umgesetzt.
Die verbindlichen Arbeitsanweisungen stehen in [CLAUDE.md](CLAUDE.md). Der chronologische [Implementierungsplan](docs/IMPLEMENTIERUNGSPLAN.md) legt die Reihenfolge der Three.js-Entwicklung fest. Claude Code muss zuerst diese Dateien lesen und anschließend die jeweilige Fachdokumentation.

## Installation und Start
Voraussetzung: Node.js ab 22.12 (geprüft mit 22.23.4) und npm.

```bash
npm install
```

```bash
npm run dev
```

Danach die angezeigte Adresse im Desktop-Browser öffnen. Steuerung: **WASD** oder Pfeiltasten zum Laufen, **E** zum Interagieren (oder Klick auf den Hinweis).

| Befehl | Zweck |
|---|---|
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Typprüfung und statischer Build nach `dist/` |
| `npm run preview` | gebauten Stand ausliefern |
| `npm run typecheck` | TypeScript-Prüfung |
| `npm run lint` | ESLint inklusive Schichtenregel |
| `npm run test` | Unit-Tests (Vitest) |
| `npm run check:browser` | Prüfung der laufenden Szene in Chromium mit Screenshots (mehrere Minuten); benötigt einmalig `npx playwright install chromium` |

## Projektstand
Phase 2 ist umgesetzt ([Auftrag 02](docs/auftraege/02-modularer-kiosk-und-einrichtung.md)): ein ausgearbeitetes Kioskgebäude mit Klinkerfassade, Markise, Verkaufsfenster und fiktivem Schild sowie neun Einrichtungs-Assets, die aus einer versionierten Platzierungsliste aufgestellt werden. Dazu kommen Third-Person-Kamera, Kollision, Tür-/Klappeninteraktionen und automatisches Speichern.

Die Regale und Kühlgeräte sind derzeit noch leer. Produkte, Warenwirtschaft und Spielzeit sind noch nicht implementiert. Die nächste Entwicklungsstufe ist in [Auftrag 03 – Waren, Wirtschaftskreislauf und Spieltag](docs/auftraege/03-waren-wirtschaftskreislauf-und-spieltag.md) konkret beschrieben.

Geprüft wurde Phase 2 in Headless-Chromium mit Software-Rendering. Die Prüfung auf echter Grafikhardware und in Firefox oder Safari steht aus; die Schritte dafür stehen in der [manuellen Prüfanleitung](docs/PRUEFANLEITUNG-MANUELL.md).

![Kiosk von außen](docs/screenshots/auftrag-02-aussen.png)

![Innenraum mit Einrichtung](docs/screenshots/auftrag-02-innen.png)

- [Technischer Ist-Stand](docs/TECHNISCHER-IST-STAND.md) – was tatsächlich implementiert und geprüft ist
- [Architektur-Entscheidungen (ADRs)](docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md)
- [Modul- und Datenverträge](docs/MODUL-UND-DATENVERTRAEGE.md)

## Produktentscheidungen
- **O-1 – Perspektive (entschieden):** Third Person mit schräger, leicht erhöhter Kamera; WASD und E, Maus ergänzend.
- **O-2 – Plattform (entschieden):** Desktop-Browser mit Maus und Tastatur zuerst; Touch später.
- **O-3 – Zeitmodell (entschieden):** 1 Spielminute = 1 Sekunde, Öffnungstag 06:00–22:00 Uhr, pausierbar und vorspulbar, mit Tagesabschluss. Umsetzung ist Auftrag 03.
- **O-4 – Alkohol und Tabak (entschieden):** fiktives Bier und fiktive Tabakwaren sind verkaufbar, mit Alterskennzeichen und neutraler, nicht werblicher Darstellung. Umsetzung ist Auftrag 03.
- **Offen:** O-5 Hosting und Lizenz.

## Nächster Schritt
Phase 3 wird mit [Auftrag 03 – Waren, Wirtschaftskreislauf und Spieltag](docs/auftraege/03-waren-wirtschaftskreislauf-und-spieltag.md) umgesetzt. Der Auftrag umfasst Produktkatalog, 3D-Waren, Einkauf, Lager, Einräumen, Verkauf, Kasse, Alterskontrolle, Spieluhr, Tagesabschluss und Savegame-Migration. NPCs und soziale Systeme bleiben Phase 4.

## Projekt-Dokumentation
Die Art-Direction, Produktionsplanung, Regionen, fiktive Produktwelt, Claude-Code-Prompts und Three.js-Asset-Standards liegen unter [docs/artwork-prompts](docs/artwork-prompts/README.md).

**Wichtige Gestaltungsregel:** ausschließlich fiktive Marken, Logos, Verpackungen und Beschilderung. Keine realen Marken oder nachgebildeten geschützten Designs.
