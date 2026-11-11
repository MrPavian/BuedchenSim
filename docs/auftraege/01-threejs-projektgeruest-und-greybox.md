# Auftrag 01 – Three.js-Projektgerüst und erste spielbare Greybox

**Priorität:** P0 – nächster Entwicklungsschritt nach Auftrag 00  
**Voraussetzung:** Auftrag 00 abgeschlossen; O-1 und O-2 bestätigt  
**Ziel:** Aus dem reinen Dokumentationsrepository eine startbare, testbare Three.js-Anwendung mit einer begehbaren Kiosk-Greybox machen.

## Verbindliche Entscheidungen

- Perspektive: Third Person, schräg und leicht erhöht; die Spielfigur bleibt sichtbar.
- Steuerung: WASD zur Bewegung, E für die nächstgelegene Interaktion; Maus für optionale UI-/Interaktionsbedienung.
- Plattform: Desktop-Browser, Tastatur und Maus zuerst. Keine Touch-Implementierung in diesem Auftrag.
- Stack gemäß ADRs: Vite, TypeScript im strict-Modus, Three.js über npm, ohne React/Vue/Angular oder weiteres Spiel-Framework.
- Schichten: core, game, content, world, ui. Die tatsächlichen Importregeln aus den Modulverträgen sind einzuhalten.
- Maßstab: 1 Three.js-Unit = 1 Meter, Y-Achse nach oben.
- Ausschließlich fiktive Marken und Beschriftungen.

## 1. Vor dem Ändern

1. Lies CLAUDE.md vollständig.
2. Lies TECHNISCHER-IST-STAND.md, ARCHITEKTUR-ENTSCHEIDUNGEN.md, MODUL-UND-DATENVERTRAEGE.md und IMPLEMENTIERUNGSPLAN.md.
3. Prüfe den aktuellen Branch und Arbeitsbaum. Erhalte alle fremden/ungecommitten Änderungen.
4. Bestätige, dass O-1 und O-2 als entschieden dokumentiert sind.
5. Erstelle einen kurzen Umsetzungsplan mit konkreten Dateien und führe ihn anschließend aus. Stelle keine Rückfragen zu bereits entschiedenen Punkten.

## 2. Projektgerüst

Lege ein schlankes Vite-/TypeScript-Projekt an:
- package.json mit reproduzierbaren Scripts: dev, build, preview, typecheck, lint, test.
- Lockfile einchecken.
- TypeScript strict aktivieren.
- Three.js als direkte Abhängigkeit.
- Vitest für Unit-Tests, ESLint mit TypeScript-Unterstützung und einer durchgesetzten Schichtenregel.
- Playwright nur dann ergänzen, wenn es für einen reproduzierbaren Browser-Screenshot tatsächlich benötigt wird; keine unnötige Testinfrastruktur.
- index.html und src/main.ts als klaren Einstiegspunkt.
- .gitignore und eine kurze README-Startanleitung.

Nutze stabile, zueinander passende Paketversionen. Prüfe vor der Installation die tatsächlich verfügbare Node-/npm-Version der Umgebung und dokumentiere die gewählten Versionen. Keine ungeprüften Versionsnummern aus der Dokumentation übernehmen.

## 3. Minimalfundament der Schichten

Implementiere nur das für die Greybox notwendige Fundament:
- core: Simulations-/Renderloop-Grundlage, typisierter Signal-Emitter nur soweit benötigt, Logging bzw. Fehlerbehandlung.
- game: GameState als reine Datenstruktur, Initialzustand und kleine Game-Fassade. Keine Three.js- oder DOM-Imports.
- content: kleines, typisiertes Ruhrgebiet-ContentPack bzw. minimale Layoutdaten; Validierung mit Tests.
- world: Three.js-Renderer, Szene, Kamera, Licht, Boden, Kiosk-Greybox, Spielfigur, Bewegung, einfache Kollision und Interaktionspunkte.
- ui: minimale HTML/CSS-Overlay-Hinweise für Steuerung und Interaktionsprompt. Keine Spielregeln in der UI.
- main.ts: einzige Stelle, die Game, World und UI zusammenführt.

Implementiere keine vorgezogenen Systeme für Wirtschaft, NPC-Beziehungen, Quests, Events, Wetter, Rezepte oder Audio. Die Architektur muss Erweiterung ermöglichen, aber diese Systeme entstehen erst in ihren Phasen.

## 4. Kiosk-Greybox und Spielraum

Baue eine räumlich verständliche erste Szene:
- Kiosk-Außenmaß als Planungsziel ungefähr 6 m breit × 4 m tief × 3,2 m hoch.
- Außenkörper, Dach, Verkaufsöffnung, Eingang und einfacher Innenraum.
- Gehweg und kleiner Außenbereich, damit die Spielfigur den Kiosk umrunden und betreten kann, soweit das Layout es vorsieht.
- Sichtbare, gut lesbare Verkaufs-/Interaktionspunkte: Verkaufsfenster/Theke und Eingang; zunächst genügt ein funktionierender Interaktionsprompt.
- Fiktive, neutrale Beschilderung ohne reale Marken, Vereinslogos oder geschützte Gestaltung.
- Einfache, stilisierte Materialien und Beleuchtung passend zur Art Direction. Keine finalen Artwork-Assets vortäuschen.

Die Spielfigur muss in der Third-Person-Ansicht sichtbar sein. Kamera folgt mit weichem Nachlauf, bleibt stabil und schneidet weder Spielfigur noch Kiosk unnötig ab. Steuerung muss auf dem Bodenebenen-Bewegungsmodell funktionieren; diagonale Bewegung normalisieren. Kollisionen verhindern das Durchlaufen von Wänden und relevanten Hindernissen.

## 5. Speichern und Laden

Implementiere nur einen minimalen, versionierten Savegame-Unterbau:
- JSON mit schemaVersion.
- localStorage-Adapter mit klarer Fehlerbehandlung.
- Speichern und Laden des reinen GameState, keine Three.js-Objekte.
- Mindestens einen Test für Serialisierung/Roundtrip und einen für unbekannte oder fehlerhafte Savegame-Versionen.
- Noch keine umfangreiche Migration, sofern es nur Version 1 gibt; Schnittstelle für spätere Migrationen vorbereiten.

## 6. Qualität und Prüfung

Alle folgenden Befehle müssen erfolgreich laufen und im Abschlussbericht stehen:
- npm run typecheck
- npm run lint
- npm run test
- npm run build

Zusätzlich:
- Anwendung im Browser starten und echte Three.js-Szene prüfen.
- Einen Screenshot der laufenden Greybox erzeugen und im Repository unter docs/screenshots/ ablegen oder als PR-Artefakt bereitstellen. Screenshot muss aus der echten Anwendung stammen, kein Konzeptbild.
- Prüfen: Spielfigur sichtbar, Kamera folgt, WASD funktioniert, Kollision funktioniert, Interaktionspunkt reagiert, Browserkonsole ohne unbehandelte Fehler.
- Prüfen, dass game/core keine Three.js- oder DOM-Abhängigkeiten importieren und die Schichtenregel automatisiert greift.

Wenn Browserautomation in der Umgebung nicht verfügbar ist, klar benennen und nicht behaupten, die Browserprüfung sei erfolgt. Dann mindestens Build und Tests durchführen und einen konkreten manuellen Prüfablauf dokumentieren.

## 7. Dokumentation

Aktualisiere:
- README.md: Installation, Start, Scripts, aktueller Projektstand.
- docs/TECHNISCHER-IST-STAND.md: nun tatsächlich implementierte Dateien und Funktionen.
- docs/MODUL-UND-DATENVERTRAEGE.md: nur Abweichungen und konkretisierte Verträge dokumentieren.
- docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md: ADRs nur dann von „Vorgeschlagen" auf „Entschieden" setzen, wenn sie tatsächlich umgesetzt und überprüft wurden. O-1/O-2 bleiben entschieden.
- docs/IMPLEMENTIERUNGSPLAN.md: Phase 1 Status und offene Restpunkte aktualisieren.
- CLAUDE.md: Start-/Testbefehle nur ergänzen, wenn sie nun tatsächlich existieren.

## 8. Grenzen und Definition of Done

Nicht Teil dieses Auftrags:
- Wirtschaftssystem, Produktkatalog und Warenverkauf.
- NPC-KI, Dialoge, Quests, Beziehungen.
- Tages-/Jahreszeitenmodell (O-3 bleibt offen).
- Alkohol-/Tabakentscheidung (O-4 bleibt offen).
- Audio, Touch, Mobile-Layout, weitere Regionen.
- Finalmodelle oder umfangreiche Asset-Produktion.

Abnahme erst, wenn:
1. Projekt lokal mit npm install und npm run dev startet.
2. Eine echte Three.js-Szene mit begehbarer Greybox läuft.
3. Third-Person-Kamera und WASD/E-Steuerung funktionieren.
4. Kollision und mindestens eine Interaktion funktionieren.
5. Savegame-Roundtrip getestet ist.
6. Typecheck, Lint, Tests und Build erfolgreich sind.
7. Dokumentation den tatsächlichen Stand widerspiegelt.

## 9. Abschlussbericht

Berichte knapp und konkret:
- implementierte Funktionen und wichtigste Dateien,
- Architekturentscheidungen, die umgesetzt wurden bzw. abweichen,
- genaue Paketversionen,
- ausgeführte Befehle mit Ergebnissen,
- Browserprüfung und Screenshot-Pfad,
- bekannte Fehler und Einschränkungen,
- nächster sinnvoller Auftrag.

Keine Funktion als fertig melden, die nur als TODO, Platzhalter oder statisches Bild existiert.
