# Technischer Ist-Stand

**Stand:** 2026-11-11 · nach [Auftrag 01](auftraege/01-threejs-projektgeruest-und-greybox.md)

Dieses Dokument enthält nur geprüfte Fakten. Entscheidungen stehen in [ARCHITEKTUR-ENTSCHEIDUNGEN.md](ARCHITEKTUR-ENTSCHEIDUNGEN.md), Verträge in [MODUL-UND-DATENVERTRAEGE.md](MODUL-UND-DATENVERTRAEGE.md).

## 1. Kernaussage
Das Repository enthält eine startbare Three.js-Anwendung mit einer begehbaren Kiosk-Greybox: Third-Person-Kamera, Bewegung mit WASD, Kollision, zwei Interaktionen (Tür, Verkaufsklappe) und ein versioniertes Savegame. Wirtschaft, Produkte, NPCs, Quests, Zeit, Wetter und Audio existieren noch nicht.

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
| `npm run check:browser` | baut, startet die Anwendung in Chromium, prüft sie mit echten Tastendrücken und schreibt Screenshots nach `docs/screenshots/` (ca. 2–3 Minuten) |

`check:browser` braucht einen zu Playwright 1.63.0 passenden Chromium. Auf einem frischen Rechner einmalig `npx playwright install chromium` ausführen.

## 4. Struktur
```
index.html                     Einstieg, lädt src/main.ts
src/main.ts                    einzige Verdrahtung: Inhalt prüfen, Spielstand laden, Game/World/UI/Loop starten, Autosave, Fehleranzeige
src/core/                      loop.ts (fester Zeitschritt), signals.ts (typisierter Emitter), log.ts
src/game/                      game.ts (Fassade), state.ts (GameState), types.ts (Inhaltsverträge),
                               interaction.ts, result.ts, save/save.ts, testing/fixture-pack.ts
src/content/                   validate.ts, regions/ruhrgebiet/{index,layout}.ts
src/world/                     world.ts, renderer.ts, camera.ts, input.ts, collision.ts, kioskGeometry.ts,
                               materials.ts, occlusion.ts, playerFigure.ts,
                               assets/{registry,kioskK001,furniture,ground}.ts, views/{kioskView,markerView}.ts
src/ui/                        ui.ts, texts.ts, styles.css
scripts/browser-check.mjs      Browserprüfung
docs/screenshots/              Screenshots aus der laufenden Anwendung
```
Tests liegen als `*.test.ts` neben dem Code.

## 5. Implementierte Funktionen
**Szene und Darstellung**
- WebGL-Renderer mit Schatten, Himmelslicht, warmem Richtungslicht und warmem Punktlicht im Kiosk.
- Kiosk-Greybox 6 × 4 × 3,2 m aus den Layoutdaten: vier Wände mit ausgeschnittenem Verkaufsfenster und Türöffnung, Flachdach, Innenboden, Theke, Wandregal, Schild „BÜDCHEN AM ECK" (fiktiv, als Canvas-Textur).
- Gehweg mit Plattenfugen, Bordstein, Straße, Grünfläche.
- Asset-Fabriken sind unter ihrer Asset-ID registriert: `K-001`, `I-001`, `I-003`, `E-001`, `E-002`.
- Maßstab 1 Unit = 1 Meter, Y nach oben, +X Osten (rechts), +Z Süden (zur Kamera).

**Spielfigur, Kamera, Steuerung**
- Stilisierte Figur von etwa 1,75 m mit erkennbarer Vorderseite, dreht sich in Laufrichtung.
- Third-Person-Kamera schräg von Süden, feste Ausrichtung, weicher Nachlauf.
- WASD und Pfeiltasten, bildschirmbezogen, 3,5 m/s, Diagonale normalisiert.
- Simulation in festen Schritten (60 Hz), Darstellung interpoliert.

**Kollision**
- Kreis (Radius 0,3 m) gegen achsparallele Rechtecke mit Gleiten an Wänden; Grenzen des begehbaren Bereichs.
- Wandsegmente für Darstellung und Kollision entstehen aus derselben Funktion (`kioskGeometry.ts`).
- Die geschlossene Tür blockiert, die offene nicht.

**Sichtfreistellung**
- Im Kiosk wird das Dach ausgeblendet und die Südwand samt Schild und Klappe durchscheinend.
- Verdeckt das Gebäude die Figur (z. B. hinter dem Kiosk), werden die verdeckenden Teile durchscheinend.

**Interaktion**
- Zwei Interaktionspunkte: Tür und Verkaufsklappe, jeweils öffnen/schließen.
- `game` bestimmt den verfügbaren Punkt aus Spielerposition und Layout; die UI zeigt den Prompt, die Welt eine Markierung.
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

**Inhaltsvalidierung**
- `validateContent` prüft IDs, Präfixe, Rechtecke, Öffnungen, Möbel, Startpunkt und Interaktionspunkte. Im Entwicklungsmodus verhindert ein Fehler den Start und wird angezeigt.

## 6. Prüfergebnisse (2026-11-11)
| Befehl | Ergebnis |
|---|---|
| `npm run typecheck` | fehlerfrei |
| `npm run lint` | fehlerfrei |
| `npm run test` | 8 Dateien, 96 Tests bestanden |
| `npm run build` | erfolgreich; JS 579 kB (149 kB gzip), CSS 2,7 kB. Vite warnt wegen der Größe über 500 kB; das ist Three.js |
| `npm run check:browser` | 19 von 19 Prüfungen bestanden |

Die Browserprüfung lief in Headless-Chromium mit Software-Rendering (ca. 33 Bilder/s) und deckt ab: Canvas rendert, Figur sichtbar, Bewegung in alle Richtungen, Diagonalgeschwindigkeit, Kamera folgt, Wand und geschlossene Tür blockieren, Tür öffnen und hindurchgehen, Klappe von innen bedienen, Kiosk umrunden, Zustand nach Neuladen wiederhergestellt, keine Konsolenfehler.

Screenshots aus der laufenden Anwendung:
- `docs/screenshots/auftrag-01-aussen.png`
- `docs/screenshots/auftrag-01-innen.png`
- `docs/screenshots/auftrag-01-rueckseite.png`

**Schichtenregel:** Mit absichtlich falschen Testdateien geprüft; ESLint meldete Fehler für `three` und DOM-Globals in `core`/`game`, für `content` in `game`, für `world`/`three`/`content` in `ui` und für `ui`/`content` in `world`. Die Testdateien wurden wieder entfernt.

## 7. Bekannte Einschränkungen
- Nicht auf echter Grafikhardware und nicht in Firefox oder Safari geprüft; Bildrate dort ist ungemessen.
- Die Browserprüfung löst das Speichern vor dem Neuladen selbst über ein `pagehide`-Ereignis aus. Ob der Browser dieses Ereignis beim Neuladen zuverlässig sendet, ist nicht separat belegt; das 10-Sekunden-Intervall fängt das ab.
- Die drei Screenshots entstehen aus vorbereiteten Spielständen, nicht am Ende des Tastenablaufs.
- Steht die Figur hinter dem Kiosk, erscheint das Gebäude als durchscheinender Kasten. Funktional, aber noch nicht schön.
- Die Markierung der Verkaufsklappe liegt im Volumen der Theke; ihr Bodenring ist deshalb verdeckt, nur der schwebende Marker ist sichtbar.
- Die Straße ist nicht begehbar. Es gibt keine Höhenunterschiede und keine vertikale Kollision.
- Jenseits des Layouts liegt eine einfarbige Fläche im Dunst; es gibt noch keine Nachbarbebauung.
- `npm install` meldet 10 Hinweise mittlerer Stufe aus `npm audit`; sie betreffen Entwicklungswerkzeuge und wurden nicht bearbeitet.
- Kein CI, kein Deployment, keine Lizenzdatei.

## 8. Ist-/Soll-Abgleich
| Zielsystem | Status | Bemerkung |
|---|---|---|
| Core / Game Runtime | teilweise vorhanden | Loop, Signale, Log, Fassade; keine Spielzeit (O-3 offen) |
| Three.js World | teilweise vorhanden | Greybox, Figur, Kamera, Kollision, Interaktion; keine Umgebung, kein Wetter |
| Kiosk und Einrichtung | teilweise vorhanden | Greybox mit Theke und Wandregal als Blöcke |
| Produkte, Inventar, Warenwirtschaft | nicht vorhanden | Phase 3; O-4 offen |
| Finanzen, Kasse, Tagesabschluss | nicht vorhanden | Phase 3 |
| NPCs, Routinen, Beziehungen | nicht vorhanden | Phase 4 |
| Dialoge, Quests, Geschichten | nicht vorhanden | Phase 4 |
| Kalender, Wetter, Events | nicht vorhanden | Phase 5; O-3 offen |
| Rezepte und Kiosk-Traditionen | nicht vorhanden | Phase 5 |
| UI | teilweise vorhanden | Hinweise, Prompt, Meldungen |
| Savegames und Datenmigration | teilweise vorhanden | Version 1, Migrationskette leer |
| Audio | nicht vorhanden | Phase 6 |
| Regionale Content-Pakete | teilweise vorhanden | Ruhrgebiet mit Layoutdaten |

## 9. Unstimmigkeiten in der Konzeptdokumentation (unverändert offen)
- Der Katalog (`02`) nennt zehn NPC-Typen, das Register (`07`) führt nur N-001 bis N-007.
- Fahrradständer, Hausfassaden und Schilder haben keine Register-ID.
- P-001 bis P-030 sind ein Sammeleintrag ohne Einzelprodukte.
- Der Bordstein hat keine eigene Asset-ID; er wird derzeit unter E-001 mitgebaut.
