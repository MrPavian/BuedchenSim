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

Danach die angezeigte Adresse im Desktop-Browser öffnen. Steuerung: **WASD** oder Pfeiltasten zum Laufen, **E** zum Interagieren (oder Klick auf den Hinweis). Mit **E** an der Kasse (hinter der Theke neben der Kasse) öffnet sich die Kasse, mit **E** am Lagerregal im Kiosk die Warenverwaltung. Kasse und Warenverwaltung sind ortsgebunden; die Leiste oben hat dafür keine Schaltflächen. Sie zeigt den Tag mit Wochentag (z. B. „Mo · Tag 1“). **Escape** schließt die Oberflächen. Solange ein Fenster offen ist, steht die Figur still, die Uhr läuft weiter.

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
Phase 3 ist umgesetzt ([Auftrag 03](docs/auftraege/03-waren-wirtschaftskreislauf-und-spieltag.md)). Aufbauend auf dem ausgearbeiteten Kiosk aus Phase 2 ([Auftrag 02](docs/auftraege/02-modularer-kiosk-und-einrichtung.md)) kann der Spieler jetzt einen vollständigen Tag führen:

- **Bestellen** bei einem fiktiven Großhandel (28 erfundene Produkte, Startkapital 300,00 €) und die **Lieferung annehmen**; die Ware liegt zunächst im Lager.
- **Einräumen** in Regale, Kühlschrank, Eistruhe, Theke und Zeitschriftenständer; die Ware erscheint sichtbar im 3D-Regal, leere Plätze bleiben leer.
- **Verkaufen** über die Kasse mit Warenkorb. Die Verkaufsklappe muss geöffnet sein. Bei Bier (ab 16) und Tabakwaren (ab 18) ist eine bestätigte Ausweisprüfung eine echte Verkaufsschranke; ohne sie lehnt das Spiel den Verkauf ab.
- **Spielzeit**: 1 Spielminute = 1 Sekunde, Tag von 06:00 bis 22:00 Uhr, Pause und 1×/2×/4×. Um 22:00 Uhr wartet die Uhr auf den ausdrücklichen **Tagesabschluss** (auch vorher möglich) mit Abrechnung; danach beginnt der nächste Tag.
- Der Spielstand (Version 2) enthält Zeit, Kasse, Bestände und Tagesabrechnung; Spielstände aus Phase 2 werden migriert.

Noch nicht vorhanden: Preisänderungen, Kunden und Nachfrage (Verkäufe sind ein Kassenvorgang des Spielers), Bewohner, Wetter, Events, Audio. Alle Marken sind frei erfunden; die Namen sind Arbeitstitel und rechtlich nicht geprüft. Das Sortiment steht im [Produktkatalog](docs/PRODUKTKATALOG.md).

**Prüfstand:** Geprüft wurde ausschließlich automatisch: Typecheck, Lint, 370 Unit- und Integrationstests, Build sowie die Browserprüfung (98 von 98 Prüfungen bestanden) in Headless-Chromium mit Software-Rendering. Die Prüfung auf echter Grafikhardware und in Firefox oder Safari steht aus; die Schritte dafür stehen in der [manuellen Prüfanleitung](docs/PRUEFANLEITUNG-MANUELL.md).

![Innenraum mit bestückten Regalen](docs/screenshots/auftrag-03-innen-bestueckt.png)

![Kasse mit Warenkorb und Altersprüfung](docs/screenshots/auftrag-03-kasse.png)

Weitere Screenshots aus der laufenden Anwendung: [Warenverwaltung](docs/screenshots/auftrag-03-warenverwaltung.png), [Tagesabrechnung](docs/screenshots/auftrag-03-tagesabschluss.png).

![Kiosk von außen](docs/screenshots/auftrag-02-aussen.png)

![Innenraum mit Einrichtung (Stand Auftrag 02, noch ohne Ware)](docs/screenshots/auftrag-02-innen.png)

- [Technischer Ist-Stand](docs/TECHNISCHER-IST-STAND.md) – was tatsächlich implementiert und geprüft ist
- [ThreeRT – Proof of Concept](docs/THREERT-POC.md) – separater Versuch mit einem Pfadverfolger; Ergebnis: nicht als Hauptrenderer, allenfalls als Offline-Werkzeug
- [Architektur-Entscheidungen (ADRs)](docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md)
- [Modul- und Datenverträge](docs/MODUL-UND-DATENVERTRAEGE.md)
- [Produktkatalog](docs/PRODUKTKATALOG.md) – alle 28 Produkte mit Preisen, Alterskennzeichen, Asset-IDs und Warenplätzen

## Produktentscheidungen
- **O-1 – Perspektive (entschieden):** Third Person mit schräger, leicht erhöhter Kamera; WASD und E, Maus ergänzend.
- **O-2 – Plattform (entschieden):** Desktop-Browser mit Maus und Tastatur zuerst; Touch später.
- **O-3 – Zeitmodell (entschieden, umgesetzt in Auftrag 03):** 1 Spielminute = 1 Sekunde, Öffnungstag 06:00–22:00 Uhr, pausierbar und vorspulbar, mit Tagesabschluss.
- **O-4 – Alkohol und Tabak (entschieden, umgesetzt in Auftrag 03):** fiktives Bier und fiktive Tabakwaren sind verkaufbar, mit Alterskennzeichen, neutraler, nicht werblicher Darstellung und einer echten Altersprüfung an der Kasse.
- **Offen:** O-5 Hosting und Lizenz.

## Nächster Schritt
Phase 4 – **Bewohner, Kundenverhalten und soziale Bindung**. [Auftrag 04](docs/auftraege/04-bewohner-und-soziale-bindung.md) wird derzeit umgesetzt. Erst nach Abschluss und Prüfung folgt Phase 5.

Die Spezifikation für Phase 5 ist bereits vorbereitet: [Auftrag 05 – Das lebendige Viertel](docs/auftraege/05-das-lebendige-viertel.md). Sie verbindet Kalender und Jahreszeiten, Wettervorhersage, fünf erste Veranstaltungen, dynamische Nachfrage, NPC-Reaktionen und die Spezialität **Frikadelle im Brötchen**. Die Umsetzung steht ausdrücklich noch aus und setzt die technische Bestandsaufnahme nach Auftrag 04 voraus.

## Projekt-Dokumentation
Die Art-Direction, Produktionsplanung, Regionen, fiktive Produktwelt, Claude-Code-Prompts und Three.js-Asset-Standards liegen unter [docs/artwork-prompts](docs/artwork-prompts/README.md).

**Wichtige Gestaltungsregel:** ausschließlich fiktive Marken, Logos, Verpackungen und Beschilderung. Keine realen Marken oder nachgebildeten geschützten Designs.
