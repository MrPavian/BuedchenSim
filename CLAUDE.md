# CLAUDE.md – Verbindliche Projektanweisungen für BuedchenSim

Diese Datei ist die zentrale Arbeitsanweisung für Claude Code. **Alle Projektunterlagen sind als konkrete Entwicklungsaufträge für Claude Code zu verstehen.** Das Spiel wird mit **Three.js** umgesetzt. Konzepttexte sind keine unverbindlichen Inspirationssammlungen: Sie beschreiben gewünschte Spielsysteme, Assets, technische Leitplanken und Abnahmekriterien.

## 1. Zuerst lesen – verpflichtende Reihenfolge
Vor jeder größeren Aufgabe diese Dokumente in genau dieser Reihenfolge lesen:
1. `docs/artwork-prompts/README.md` – Dokumentationsindex und Grundregeln
2. `docs/artwork-prompts/01-art-direction.md` – verbindliche visuelle Richtung
3. `docs/artwork-prompts/03-regionen-und-welten.md` – regionale Identität
4. `docs/artwork-prompts/04-marken-und-produktwelt.md` – fiktive Produktwelt
5. `docs/artwork-prompts/06-threejs-asset-standard.md` – technische 3D-Standards
6. `docs/artwork-prompts/02-roadmap-und-artwork-katalog.md` – Produktionsreihenfolge und Assets
7. `docs/artwork-prompts/08-das-viertel-lebt.md` – soziale Systeme, NPCs, Quests und Events
8. `docs/artwork-prompts/07-artwork-register.md` – Asset-IDs und Status
9. `docs/artwork-prompts/05-claude-prompts.md` – aufgabenspezifische Umsetzungsaufträge

Zusätzlich immer zuerst den tatsächlichen Codebestand untersuchen. Diese Dokumente ersetzen keine Codeanalyse.

## 2. Technischer Auftrag: Three.js
- Implementiere die 3D-Welt mit der im Repository bereits verwendeten Three.js-Version und Architektur.
- Nutze die vorhandene Szenen-, Kamera-, Steuerungs-, Physik-, UI-, Asset- und Build-Struktur. Keine Migration oder Framework-Neueinführung ohne zwingenden Grund und vorherige Begründung.
- Bevorzugtes Austauschformat für externe 3D-Assets: GLB/glTF, sofern die bestehende Pipeline dies unterstützt.
- Maßstab 1 Unit = 1 Meter ist eine Planungsannahme. Vor Nutzung die vorhandene Skalierung prüfen.
- Assets modular, wiederverwendbar und performant bauen; Instancing/Material-Sharing sinnvoll einsetzen.
- Keine bloßen Konzeptbilder als fertige 3D-Assets behandeln. Bilder sind Referenzen; die Umsetzung muss echte Three.js-Geometrie, Materialien, Texturen oder geladene 3D-Modelle erzeugen.
- Wenn ein Artwork visuelle Details vorgibt, diese in konkrete Geometrie-, Material-, Licht-, Textur- und Platzierungsanforderungen übersetzen.

## 3. Verbindliche Spielvision
BuedchenSim verbindet drei gleichwertige Säulen:
1. **Wirtschaft:** Waren einkaufen, Preise kalkulieren, verkaufen, Lager verwalten, investieren und den Kiosk entwickeln.
2. **Gemeinschaft:** wiederkehrende Bewohner, Beziehungen, Erinnerungen, Dialoge, Geschichten, kleine Quests und lokale Traditionen.
3. **Viertelleben:** Wetter, Jahreszeiten, Spieltage, Straßenfeste, Stadtfeste, Jubiläen und spontane Ereignisse.

Der Kiosk soll sich wie der eigene Ort des Spielers anfühlen. Menschen und Ereignisse sind keine Dekoration, sondern beeinflussen Alltag, Nachfrage, Beziehungen und die Entwicklung des Viertels.

## 4. Absolute Marken- und Designregel
Keine realen Marken, Logos, Firmennamen, Produktnamen, originalgetreuen Verpackungen, Werbekampagnen, Vereinswappen oder geschützten Figuren verwenden. Alle Marken, Produkte, Schilder, Vereine und Grafiken müssen fiktiv und originär sein. Regionale Authentizität entsteht über Architektur, Stadtmöblierung, Typografie, Farben, Warenmix und Atmosphäre – nicht über kopierte Marken.

## 5. Verbindliche Arbeitsweise
Bei jeder Aufgabe:
1. Relevante Dokumente lesen und den aktuellen Code untersuchen.
2. Bestehende Architektur, Dateipfade, Konventionen und offene TODOs feststellen.
3. Einen kurzen Umsetzungsplan mit betroffenen Dateien und technischen Entscheidungen nennen.
4. In kleinen, überprüfbaren Schritten implementieren.
5. Die Umsetzung in der tatsächlichen Three.js-Szene prüfen – nicht nur Code erzeugen.
6. Start-/Build-/Lint-/Test-Kommandos aus dem Repository verwenden und Ergebnisse dokumentieren.
7. Neue Assets, IDs, Abhängigkeiten und Systemzustände in der Dokumentation nachführen.

Keine Features als fertig melden, wenn sie nur als Platzhalter, Mockup oder Konzept existieren. Wenn ein Detail unklar ist, zuerst die Codebasis und Dokumentation prüfen; nicht eigenmächtig widersprüchliche Systeme erfinden.

## 6. Produktionsreihenfolge
Der verbindliche Plan steht in `docs/IMPLEMENTIERUNGSPLAN.md`. Grundsätzlich:
- Bestand aufnehmen und technische Basis verstehen
- spielbare Greybox und grundlegenden Kiosk-Loop herstellen
- Kioskgebäude und Innenausstattung modular umsetzen
- erste fiktive Produktserie und Warenwirtschaft integrieren
- NPC-Grundsystem und soziale MVP-Geschichten ergänzen
- Event-/Wetter-/Kalendersystem mit Wirtschaft und NPCs verbinden
- Umgebung, Atmosphäre, Audio und Polish
- weitere Regionen und Content-Ausbau

Nicht alle Systeme gleichzeitig anfangen. Erst einen stabilen, testbaren Vertical Slice fertigstellen.

## 7. Umgang mit Dokumentationsänderungen
Wenn sich Anforderungen ändern, aktualisiere die zuständigen Dokumente und diesen Auftrag bei Bedarf. Halte Links, Asset-IDs und Produktionsreihenfolge konsistent. Nutzerentscheidungen haben Vorrang vor älteren Vorschlägen.
