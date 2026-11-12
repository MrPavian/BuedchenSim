# Technischer Ist-Stand

**Stand:** 2026-11-12 · nach [Auftrag 02](auftraege/02-modularer-kiosk-und-einrichtung.md)

Dieses Dokument enthält nur geprüfte Fakten. Entscheidungen stehen in [ARCHITEKTUR-ENTSCHEIDUNGEN.md](ARCHITEKTUR-ENTSCHEIDUNGEN.md), Verträge in [MODUL-UND-DATENVERTRAEGE.md](MODUL-UND-DATENVERTRAEGE.md), die Schritte für die Prüfung auf echter Grafikhardware in [PRUEFANLEITUNG-MANUELL.md](PRUEFANLEITUNG-MANUELL.md).

## 1. Kernaussage
Das Repository enthält eine startbare Three.js-Anwendung mit einem ausgearbeiteten, begehbaren Kiosk: detailliertes Gebäude, neun Einrichtungs-Assets aus einer datengetriebenen Platzierungsliste, Third-Person-Kamera, Bewegung mit WASD, Kollision, zwei Interaktionen (Tür, Verkaufsklappe) und ein versioniertes Savegame. Wirtschaft, Produkte, NPCs, Quests, Zeit, Wetter und Audio existieren noch nicht. Kühlschrank, Truhe und Regale sind leer.

## 2. Werkzeuge und Versionen
Geprüft mit Node.js 22.23.4 und npm 10.9.9. Alle Pakete sind exakt gepinnt, `package-lock.json` ist eingecheckt.

| Paket | Version | Zweck |
|---|---|---|
| three | 0.187.0 | 3D-Darstellung |
| @types/three | 0.187.0 | Typen |
| vite | 8.3.8 | Dev-Server und Build |
| typescript | 6.0.3 | Sprache, `strict` |
| vitest | 5.1.0 | Unit-Tests |
| eslint | 10.14.0 | Lint und Schichtenregel |
| @eslint/js | 10.0.1 | ESLint-Grundregeln |
| typescript-eslint | 8.72.2 | TypeScript-Regeln |
| playwright | 1.63.0 | Browserprüfung mit Screenshots |

TypeScript 7 wurde nicht gewählt, weil typescript-eslint 8.72.2 nur TypeScript bis unter 6.1 unterstützt.

`package.json` enthält `overrides: { "minimatch": "11.0.8" }` (siehe Abschnitt 7).

## 3. Scripts
| Befehl | Wirkung |
|---|---|
| `npm install` | Abhängigkeiten installieren |
| `npm run dev` | Entwicklungsserver (Vite) |
| `npm run build` | Typprüfung und statischer Build nach `dist/` |
| `npm run preview` | gebauten Stand lokal ausliefern |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint inklusive Schichtenregel |
| `npm run test` | Vitest |
| `npm run check:browser` | baut, startet die Anwendung in Chromium, prüft sie mit echten Tastendrücken und schreibt Screenshots nach `docs/screenshots/` (in der Entwicklungsumgebung mit Software-Rendering ca. 9–10 Minuten) |

`check:browser` braucht einen zu Playwright 1.63.0 passenden Chromium. Auf einem frischen Rechner einmalig `npx playwright install chromium` ausführen.

`node scripts/screenshot.mjs --out <png> --x <m> --z <m> [--heading] [--door open|closed] [--shutter open|closed]` erzeugt einen einzelnen Screenshot aus der laufenden Anwendung an einer vorgegebenen Position.

## 4. Struktur
```
index.html                     Einstieg, lädt src/main.ts
src/main.ts                    einzige Verdrahtung: Inhalt prüfen, Spielstand laden, Game/World/UI/Loop starten, Autosave, Fehleranzeige
src/core/                      loop.ts (fester Zeitschritt), signals.ts (typisierter Emitter), log.ts
src/game/                      game.ts (Fassade), state.ts (GameState), types.ts (Inhaltsverträge),
                               placement.ts (Grundfläche, Drehung, Vorderseite), colliders.ts, reachability.ts,
                               kioskGeometry.ts (Wandstücke, Schnitthöhe), rects.ts, constants.ts,
                               interaction.ts, result.ts, save/save.ts, testing/fixture-pack.ts
src/content/                   validate.ts, assets/catalog.ts (Asset-Katalog),
                               regions/ruhrgebiet/{index,layout}.ts (Kiosk, Platzierungsliste, Boden, Interaktionspunkte)
src/world/                     world.ts, renderer.ts, camera.ts, input.ts, collision.ts, colliders.ts, materials.ts,
                               occlusion.ts, occlusionRules.ts, playerFigure.ts
src/world/assets/              registry.ts (Asset-ID → Fabrik), ground.ts
src/world/assets/kiosk/        K-001 in Teilen: walls, roof, awning, salesWindow, door, signage, lighting, interior,
                               materials, textures
src/world/assets/furniture/    counter, register, wallShelf, middleShelf, fridge, freezer, magazineRack,
                               storageRack, crates, kit (Bauhilfe), materials, placeholder
src/world/views/               kioskView.ts (Tür-/Klappenanimation), markerView.ts
src/integration/               Tests des echten Inhaltspakets gegen die echten Fabriken
src/ui/                        ui.ts, texts.ts, styles.css
scripts/                       browser-check.mjs, screenshot.mjs
docs/screenshots/              Screenshots aus der laufenden Anwendung
```
Tests liegen als `*.test.ts` neben dem Code.

## 5. Implementierte Funktionen
**Asset-Katalog und Platzierungsliste (Auftrag 02)**
- Der Katalog (`src/content/assets/catalog.ts`) beschreibt jedes Asset mit ID, Maßen, Kategorie, erlaubten Drehungen und Kollisionsverhalten.
- Das Layout (`layoutVersion: 1`) enthält elf Platzierungen mit stabiler ID (`placement.…`), Asset-ID, Position, Drehung in 90°-Schritten, optionaler Skalierung, optionaler Auflage (`on`) und Rolle.
- Darstellung und Kollision lesen dieselben Daten. Ein Möbel wird durch eine Änderung in `layout.ts` verschoben oder gedreht; die Fabrik bleibt unberührt.
- Zwei Assets stehen mehrfach in unterschiedlicher Lage: das Wandregal `I-003` (Nordwand 0°, Westwand 90°) und der Kistenstapel `I-012` (im Kiosk 180°, außen an der Westwand 270°).
- Platzierungen sind Inhalt, kein Spielstand. Das Savegame bleibt bei `schemaVersion` 1, eine Migration war nicht nötig.
- Vertragsdetails und die Maßtabelle stehen in [MODUL-UND-DATENVERTRAEGE.md, Abschnitt 14](MODUL-UND-DATENVERTRAEGE.md).

**Inhaltsvalidierung**
- `validateContent` prüft zusätzlich: doppelte Platzierungs-IDs, unbekannte Assets, unzulässige Drehung oder Skalierung, Lage außerhalb des begehbaren Bereichs, Überschneidung von Möbeln untereinander und mit Wänden, fehlende oder falsche Auflage, zugestellte Tür, zugestellte Bedienseiten und Erreichbarkeit aller Interaktionspunkte und Möbelvorderseiten vom Startpunkt (Flutfüllung im 0,1-m-Raster).
- Im Entwicklungsmodus verhindert ein Fehler den Start und wird angezeigt.

**Kioskgebäude K-001**
- 6 × 4 × 3,2 m aus den Layoutdaten: Klinkerfassade mit Sockel und Putzband, Gebrauchsspuren, Flachdach mit Attika, Blechabdeckung, Dachaufbauten und Fallrohr.
- Gestreifte Markise mit Gestell, Verkaufsfenster mit Rahmen, Fensterbank und nach oben schwenkender Klappe, Tür mit Rahmen, Glasfeld und Griff.
- Fiktives Schild „BÜDCHEN AM ECK" und eine kleine Tafel „Trinkhalle" als Canvas-Texturen, Außenleuchten, drei Punktlichter ohne Schatten.
- Innen Fliesenboden und verputzte Wände. Alle Texturen entstehen im Code; es gibt keine externen Bild- oder Modelldateien.

**Einrichtung**
- Neun Fabriken unter ihrer Asset-ID: `I-001` Verkaufstheke, `I-002` Kasse (steht auf der Theke), `I-003` Wandregal, `I-004` Mittelregal, `I-005` Getränkekühlschrank, `I-006` Eistruhe, `I-007` Zeitschriftenständer, `I-011` Lagerregal, `I-012` Leergut-/Kistenbereich.
- Jede Fabrik baut bei Drehung 0 mit Pivot in der Bodenmitte und Vorderseite nach +Z. Ein Integrationstest prüft, dass die Hüllbox jeder Fabrik auf 2 cm den Katalogmaßen entspricht.
- Kühlschrank, Truhe und Regale sind leer; es gibt keine Produkte und keine Markenflächen. Der Zeitschriftenständer zeigt unbeschriftete, einfarbige Platzhalterhefte, das Lagerregal drei unbedruckte Kartons, der Leergutbereich neutrale Kisten.

**Umgebung**
- Gehweg mit Plattenfugen, Bordstein, Straße, Grünfläche (`E-001`, `E-002`, weiterhin Greybox).
- Maßstab 1 Unit = 1 Meter, Y nach oben, +X Osten (rechts), +Z Süden (zur Kamera).

**Spielfigur, Kamera, Steuerung**
- Stilisierte Figur von etwa 1,75 m mit erkennbarer Vorderseite, dreht sich in Laufrichtung.
- Third-Person-Kamera schräg von Süden, feste Ausrichtung, weicher Nachlauf.
- WASD und Pfeiltasten, bildschirmbezogen, 3,5 m/s, Diagonale normalisiert.
- Simulation in festen Schritten (60 Hz), Darstellung interpoliert.
- Ein Tastendruck, der kürzer als ein Bild ist, bewegt die Figur für einen Simulationsschritt und geht nicht mehr verloren.

**Kollision**
- Kreis (Radius 0,3 m) gegen achsparallele Rechtecke mit Gleiten an Wänden; Grenzen des begehbaren Bereichs.
- Die Rechtecke entstehen aus den Wandstücken und aus der Platzierungsliste (`layoutColliders`).
- Die geschlossene Tür blockiert, die offene nicht.

**Sichtfreistellung (Auftrag 02 neu)**
- Figur im Kiosk: Das Dach wird ausgeblendet und die Südwand auf Brüstungshöhe (1,0 m) geschnitten, zusammen mit Schild, Markise, Klappe und oberem Türblatt. Ost- und Westwand werden nur geschnitten, wenn sie zwischen Kamera und Figur liegen. Die Nordwand bleibt stehen.
- Figur außen und verdeckt (hinter oder neben dem Kiosk): Das Gebäude bleibt vollständig deckend, die Figur erscheint als flächige, türkisfarbene Silhouette.
- Es gibt keine durchscheinenden Gebäudematerialien mehr.

**Interaktion**
- Zwei Interaktionspunkte: Tür und Verkaufsklappe, jeweils öffnen/schließen.
- `game` bestimmt den verfügbaren Punkt aus Spielerposition und Layout; die UI zeigt den Prompt, die Welt eine Markierung.
- Die Markierung der Klappe sitzt am Verkaufsfenster auf der Theke (Position aus den Layoutdaten), nicht mehr im Thekenvolumen.
- Auslösen mit E oder Mausklick auf den Prompt. Tür und Klappe sind animiert.

**UI**
- Steuerungshinweis, Interaktionsprompt, Meldungen, Schaltfläche „Neues Spiel" (zweiter Klick bestätigt), sichtbare Fehleranzeige bei Start- oder Laufzeitfehlern.
- Alle Spieltexte in `src/ui/texts.ts`.

**Speichern und Laden**
- `GameState` Version 1: `regionId`, `player` (Position, Blickrichtung), `kiosk` (`doorOpen`, `shutterOpen`).
- JSON mit `schemaVersion` in `localStorage` unter `buedchensim.save.slot1`.
- Automatisch nach jeder Tür-/Klappenänderung, alle 10 Sekunden und beim Verlassen der Seite; Laden beim Start.
- Strenge Prüfung beim Laden. Ein unlesbarer oder zu neuer Spielstand wird nach `buedchensim.save.slot1.backup` kopiert, dann startet ein neues Spiel mit Hinweis.
- Migrationskette ist vorhanden und getestet, enthält aber noch keine Migration.

**Debug-Zugang**
- Im Entwicklungsmodus oder mit `?debug` in der Adresse steht `window.__buedchen = { game, world }` bereit. `world` liefert Platzierungstransformationen, Render-Statistik, Simulationszeit, Sichtbarkeit der Gebäudeteile sowie Bildschirmpositionen von Figur und Markierungen. Die Browserprüfung nutzt diesen Zugang.

## 6. Prüfergebnisse (2026-11-12)
| Befehl | Ergebnis |
|---|---|
| `npm run typecheck` | fehlerfrei |
| `npm run lint` | fehlerfrei |
| `npm run test` | 14 Dateien, 142 Tests bestanden |
| `npm run build` | erfolgreich, Größen siehe Abschnitt 8 |
| `npm run check:browser` | 41 von 41 Prüfungen bestanden (vier Läufe in Folge) |
| `npm audit` | 0 Hinweise |

Die Browserprüfung lief in Headless-Chromium mit Software-Rendering (ca. 26–29 Bilder/s). Sie deckt ab:
- Canvas rendert, WebGL-Kontext geht nicht verloren, keine Konsolen- oder Seitenfehler.
- Bewegung in alle Richtungen; Geschwindigkeit gerade und diagonal 3,5 m/s (±3 %, gemessen gegen die Simulationszeit); Kamera folgt.
- Wand und geschlossene Tür blockieren; Tür öffnen und hindurchgehen; Klappe von innen bedienen; Kiosk umrunden; Zustand nach Neuladen wiederhergestellt.
- Alle elf Platzierungen stehen an der konfigurierten Position, Drehung (1 cm / 0,5°) und Höhe.
- Kollision folgt den Layoutdaten: Mittelregal, Kühlschrank, Eistruhe und die Kisten außen stoppen die Figur 0,30 m vor der aus den Daten berechneten Grundfläche; der Gang zwischen Mittelregal und Theke ist begehbar.
- Figur sichtbar vor, im, hinter und neben dem Kiosk; hinter dem Kiosk als Silhouette bei deckendem Gebäude; innen sind Dach und obere Südwand ausgeblendet, die untere Wand sichtbar.
- Klappenmarkierung sichtbar von innen und außen, jeweils bei offener und geschlossener Klappe.

Screenshots aus der laufenden Anwendung:
- `docs/screenshots/auftrag-02-aussen.png` – Vorderseite mit Schild, Markise und offenem Verkaufsfenster
- `docs/screenshots/auftrag-02-innen.png` – Innenraum mit Einrichtung, Dach und Südwand freigestellt
- `docs/screenshots/auftrag-02-rueckseite.png` – Figur hinter dem Kiosk als Silhouette
- `docs/screenshots/auftrag-02-seite.png` – Figur an der Westwand neben den Kisten
- `docs/screenshots/auftrag-01-*.png` – Stand der Greybox aus Auftrag 01, unverändert

**Render-Aufwand** (aus `getRenderStats()` in der Browserprüfung, Figur im Kiosk): etwa 238 Draw Calls und 22.500 Dreiecke. Das ist ein Messwert der Szene, keine Aussage über die Bildrate auf echter Hardware.

**Schichtenregel:** In Auftrag 01 mit absichtlich falschen Testdateien geprüft. Nach dem Eingriff in die Abhängigkeiten (Abschnitt 7) wurde erneut geprüft, dass ESLint Verstöße weiterhin meldet.

## 7. `npm audit`
| | |
|---|---|
| Vorher | 10 Hinweise der Stufe „moderate" |
| Ursache | ein einziges Advisory, GHSA-g3hv-75wg-m249, im Paket `minimatch` (installiert 10.2.6, behoben ab 11.0.1) |
| Abhängigkeitspfade | `eslint → minimatch`, `eslint → @eslint/config-array → minimatch`, `typescript-eslint → @typescript-eslint/typescript-estree → minimatch` |
| Betroffen | nur Entwicklungswerkzeuge; `minimatch` gelangt nicht in den ausgelieferten Build |
| Maßnahme | `overrides: { "minimatch": "11.0.8" }` in `package.json`; kein `npm audit fix --force`, kein Versionssprung von ESLint oder typescript-eslint |
| Geprüft | `lint`, `typecheck`, `test`, `build` grün; die Schichtenregel meldet Verstöße weiterhin |
| Nachher | 0 Hinweise, keine offenen Advisories |

Der Override setzt eine neuere Hauptversion durch, als die betroffenen Pakete selbst anfordern. Er soll entfernt werden, sobald ESLint und typescript-eslint von sich aus eine behobene Version zulassen.

## 8. Build-Größe
| Stand | Datei | Größe | gzip |
|---|---|---|---|
| Auftrag 01 | `index-*.js` (alles in einer Datei) | 579,09 kB | 148,73 kB |
| Auftrag 02 | `index-*.js` (Spielcode) | 84,89 kB | 30,85 kB |
| Auftrag 02 | `three-*.js` (Three.js) | 546,12 kB | 135,35 kB |
| Auftrag 02 | `index-*.css` | 2,66 kB | 1,00 kB |

- Three.js liegt jetzt in einem eigenen Chunk (`vite.config.ts`). Die Gesamtmenge sinkt dadurch nicht; der Vorteil ist, dass der Browser den großen, selten geänderten Three.js-Chunk im Cache behält, wenn sich nur Spielcode ändert.
- Der Spielcode ist gegenüber Auftrag 01 gewachsen (Gebäude, neun Möbelfabriken, Validierung).
- Vite warnt weiterhin wegen eines Chunks über 500 kB. Das ist Three.js selbst; die Anwendung braucht es beim Start vollständig. Ein Nachladen per `import()` würde den Start nur komplizierter machen und wurde deshalb nicht eingebaut. Die Warnschwelle wurde nicht angehoben.

## 9. Bekannte Einschränkungen
- **Nicht auf echter Grafikhardware und nicht in Firefox oder Safari geprüft.** Die Bildrate dort ist ungemessen; es wird keine Bildrate zugesagt. Die Schritte für diese Prüfung stehen in [PRUEFANLEITUNG-MANUELL.md](PRUEFANLEITUNG-MANUELL.md) und sind noch nicht durchgeführt.
- Von außen bei geschlossener Klappe ist der Bodenring der Klappenmarkierung größtenteils verdeckt; der schwebende Marker darüber bleibt deutlich sichtbar.
- Die Sichtbarkeitsprüfungen für Figur und Markierung zählen Bildpunkte in bestimmten Farben. Das ist ein Näherungswert, kein Bildvergleich.
- Steht die Figur dicht neben dem Kistenstapel außen, erscheinen die verdeckten Beine als Silhouette. Das ist das vorgesehene Verhalten, wirkt aber etwas ungewohnt.
- Ein früherer Lauf der Browserprüfung brach einmal mit geschlossenem Browser ab. Die Ursache ließ sich nicht reproduzieren; das Skript meldet Absturz, Trennung und Kontextverlust jetzt ausdrücklich.
- Die Browserprüfung dauert mit Software-Rendering etwa 9–10 Minuten.
- Der Ladepfad für externe GLB-Modelle (ADR-006) ist weiterhin ungetestet; alle Assets entstehen im Code.
- Die Browserprüfung löst das Speichern vor dem Neuladen selbst über ein `pagehide`-Ereignis aus. Ob der Browser dieses Ereignis beim Neuladen zuverlässig sendet, ist nicht separat belegt; das 10-Sekunden-Intervall fängt das ab.
- Die Straße ist nicht begehbar. Es gibt keine Höhenunterschiede und keine vertikale Kollision.
- Jenseits des Layouts liegt eine einfarbige Fläche im Dunst; es gibt noch keine Nachbarbebauung.
- Kein Layout-Editor: Möbel werden in `layout.ts` verschoben.
- Kein CI, kein Deployment, keine Lizenzdatei.

## 10. Ist-/Soll-Abgleich
| Zielsystem | Status | Bemerkung |
|---|---|---|
| Core / Game Runtime | teilweise vorhanden | Loop, Signale, Log, Fassade; keine Spielzeit (O-3 offen) |
| Three.js World | teilweise vorhanden | Kiosk, Figur, Kamera, Kollision, Interaktion, Sichtfreistellung; keine Umgebung, kein Wetter |
| Kiosk und Einrichtung | vorhanden | Gebäude und neun Möbel modular; Regale und Kühlgeräte leer |
| Produkte, Inventar, Warenwirtschaft | nicht vorhanden | Phase 3; O-4 offen |
| Finanzen, Kasse, Tagesabschluss | nicht vorhanden | Phase 3; die Kasse ist nur ein Möbelstück |
| NPCs, Routinen, Beziehungen | nicht vorhanden | Phase 4 |
| Dialoge, Quests, Geschichten | nicht vorhanden | Phase 4 |
| Kalender, Wetter, Events | nicht vorhanden | Phase 5; O-3 offen |
| Rezepte und Kiosk-Traditionen | nicht vorhanden | Phase 5 |
| UI | teilweise vorhanden | Hinweise, Prompt, Meldungen |
| Savegames und Datenmigration | teilweise vorhanden | Version 1, Migrationskette leer |
| Audio | nicht vorhanden | Phase 6 |
| Regionale Content-Pakete | teilweise vorhanden | Ruhrgebiet mit Asset-Katalog und Platzierungsliste |

## 11. Unstimmigkeiten in der Konzeptdokumentation (unverändert offen)
- Der Katalog (`02`) nennt zehn NPC-Typen, das Register (`07`) führt nur N-001 bis N-007.
- Fahrradständer, Hausfassaden und Schilder haben keine Register-ID.
- P-001 bis P-030 sind ein Sammeleintrag ohne Einzelprodukte.
- Der Bordstein hat keine eigene Asset-ID; er wird derzeit unter E-001 mitgebaut.
