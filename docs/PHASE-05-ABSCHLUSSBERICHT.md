# Abschlussbericht Phase 5 – Das lebendige Viertel

**Auftrag:** [Auftrag 05](auftraege/05-das-lebendige-viertel.md) · **Bestandsaufnahme:** [PHASE-05-BESTANDSAUFNAHME.md](PHASE-05-BESTANDSAUFNAHME.md) · **Branch:** `claude/elegant-curie-17qulu` · **Stand:** 2026-11-15

Strikte Trennung: **implementiert** (Code liegt vor und läuft), **automatisiert getestet** (Vitest in Node, Browserprüfung in Headless-Chromium mit Software-Rendering), **manuell geprüft** (von Hand im Spiel; in dieser Phase nur Sichtprüfungen von Screenshots durch Claude Code und die Rückmeldung des Nutzers zum Sonnenschirm), **nicht geprüft** (echte Grafikhardware, Firefox, Safari, Mobilgeräte).

## 1. Umgesetzte Funktionen

| Paket | Inhalt | Status |
|---|---|---|
| 5.1 Kalender und Jahreszeiten | Datum aus `calendar.day` ab Mo 7. Juni 2027, Schaltjahre, Wochentag aus dem Datum, Jahreszeiten; HUD-Datum mit Wetter; Kalenderpanel (Taste K); Jahreszeit in Rasen, Himmel und Licht | implementiert, automatisiert getestet |
| 5.2 Wetter und Vorhersage | sieben Zustände, Klima je Monat, Erhaltungsneigung und Temperaturanomalie, Tagesgang; Vorhersage 3 Tage sicher + 4 Tage Tendenz mit Verlässlichkeit; Himmel, Nebel, Licht, nasses Pflaster, Schneedecke, Regen- und Schneepartikel (voll/reduziert/aus); Wetterbedingungen für Inhalte | implementiert, automatisiert getestet |
| 5.3 Veranstaltungen | Heimspiel SV Grubenlicht 09, Straßenfest, Flohmarkt, Weihnachtszeit, Hitzewelle als Daten mit Terminregeln; Status geplant/angekündigt/läuft/beendet abgeleitet; Dekorationen am Büdchen; Gäste Ole (N-008) und Hilde (N-009); Veranstaltungs- und Wettergespräche; Erinnerungen `erlebt:…` | implementiert, automatisiert getestet |
| 5.4 Nachfrage | `D = clamp(B + W + E + S + T)` aus Inhaltsdaten; Wunschgewichte, Besucherbonus, persönliche Wetterreaktion; Nachfragepfeile im Kalender; keine Hintergrundverkäufe | implementiert, automatisiert getestet |
| 5.5 Frikadelle im Brötchen | Zutaten als Lagerware (`ingredient`), Rezept, Herstellung über Spielzeit, Qualität (Rezeptstufe, optionale Zutat, Übung), Verkauf über die Verkaufsdomäne, Kundenstimmen, Bekanntheit aus Zufriedenheit, Wiederholungskäufen und Empfehlungen; Stufen Erster Versuch → Geheimtipp (Kundenstopper I-014, Rezeptstufe 2, Wünsche, Gespräche) → Kultstatus (Kult-Tafel I-015, Tradition Frikadellen-Freitag, zusätzliche Stammkunden); UI-Reiter „Spezialität“; nicht beim Großhandel bestellbar | implementiert, automatisiert getestet |
| 5.6 Bewohner, Haushalte, Integration | Haushalte als Datenvertrag mit gemeinsamen Erinnerungen und Bedingung `householdMemory`; Geldbörse je Bewohner; Erinnerungen `probiert:`/`empfiehlt:frikadelle`; Integrationstest „Heißer Samstag mit Heimspiel“; erweiterte Browserprüfung | implementiert, automatisiert getestet |

Zusätzlich während der Phase: Sonnenschirm der Hitzewelle stand in der Kioskwand (Rückmeldung des Nutzers) – frei neben die Westwand versetzt (Schirmkante 0,4 m vor der Wand), per Screenshot geprüft.

**Abnahme „vollständiger Spielkreislauf“ (Auftrag 9.7):** Zutaten einkaufen ✓, lagern ✓, Rezept wählen ✓, Produktion starten ✓, Zeit abwarten ✓, fertige Produkte erhalten ✓, verkaufen ✓, Umsatz verbuchen ✓, Kundenfeedback ✓, Bekanntheit steigern ✓, Geheimtipp und Kultstatus erreichen ✓ – jeweils automatisiert getestet (`src/game/specialty.test.ts`, `src/integration/hot-matchday.test.ts`), die UI-Schritte zusätzlich in der Browserprüfung.

## 2. Neue und geänderte Dateien (Auswahl; vollständig: `git diff --stat 87419b1~1..HEAD`)

- **game:** `date.ts`, `weather.ts`, `environment.ts`, `eventCalendar.ts`, `demand.ts`, `specialty.ts` (neu); `conditions.ts`, `npcTypes.ts`, `types.ts`, `state.ts`, `events.ts`, `game.ts`, `npcSim.ts`, `wishes.ts`, `story.ts`, `economy.ts`, `selectors.ts`, `save/save.ts` (erweitert); Tests `date`, `demand`, `specialty`, `households`, `save/saveSpecialty`, Testpaket `testing/specialtyPack.ts`.
- **content:** `regions/ruhrgebiet/{climate,events,demand,guests,dialoguesWorld,specialty,specialtySocial,households}.ts` (neu), `index.ts`, `layout.ts`, `residents.ts`, `assets/{catalog,productAssets}.ts`, `validateWorld.ts` (neu), `validateResidents.ts`, `validateStock.ts`; Tests `climate`, `events`, `demand`, `households`.
- **world:** `views/atmosphereView.ts`, `views/precipitation.ts`, `views/eventDecorView.ts`, `assets/furniture/frikadelleProps.ts` (I-014, I-015), Registrierung, `ground.ts` (Materialnamen), Bewohner N-008/N-009 (GLB `public/models/residents/n-008.glb`, `n-009.glb`).
- **ui:** `calendarViewModel.ts`, `panels/calendar.ts`, `specialtyViewModel.ts`, `panels/specialtyTab.ts` (neu), `panels/goods.ts`, `hud.ts`, `ui.ts`, `texts.ts`, `styles.css`, `socialViewModel.ts`.
- **Integration:** `src/integration/hot-matchday.test.ts`; `scripts/browser-check.mjs` (Abschnitt P5).
- **Dokumentation:** README, IMPLEMENTIERUNGSPLAN, ARCHITEKTUR-ENTSCHEIDUNGEN (ADR-024 bis ADR-029), MODUL-UND-DATENVERTRAEGE (Abschnitt 17), TECHNISCHER-IST-STAND (5a, 6), BEWOHNER-UND-GESCHICHTEN (14), PRODUKTKATALOG, Artwork-Register (N-008, N-009, P-029–P-032, I-014, I-015), dieser Bericht, Screenshots unter `docs/screenshots/auftrag-05/`.

## 3. Architekturentscheidungen
ADR-024 (Datum, Wetter, Veranstaltungen abgeleitet statt gespeichert), ADR-025 (Nachfrage als begrenzte Summe, wirkt nur auf Wahrscheinlichkeiten), ADR-026 (Spezialität über Rezept und bestehendes Lager), ADR-027 (Gäste als normale Bewohner mit bedingten Routinen), ADR-028 (Haushalte als soziale Gruppe ohne gemeinsame Steuerung), ADR-029 (Savegame-Schema 4) – siehe [ARCHITEKTUR-ENTSCHEIDUNGEN.md](ARCHITEKTUR-ENTSCHEIDUNGEN.md).

## 4. Savegame-Version und Migration
Festgestellt nach Phase 4: Version 3. Umgesetzt: **Version 4** mit `specialties` und `households`; Migration 3 → 4 legt beide leer an; Kette 1 → 2 → 3 → 4 bleibt vollständig. Unbekannte Spezialitäten oder Haushalte werden mit Warnung verworfen, fehlende ergänzt, ungültige Werte führen zu „beschädigt“ (Sicherung, neues Spiel). Datum, Wetter, Vorhersage, Veranstaltungen und Nachfrage werden nicht gespeichert, sondern aus Seed und `calendar.day` abgeleitet. Getestet: Migration 3 → 4, 1 → 2 → 3 → 4, Round-Trip mit laufender Herstellung, Bekanntheit, Käufern und Stimmen, Haushaltserinnerungen, „speichern → neu laden → erneut speichern → laden“ im Integrationstest.

## 5. Testergebnisse (eigene Läufe 2026-11-15)
| Befehl | Ergebnis |
|---|---|
| `npm run typecheck` | fehlerfrei |
| `npm run lint` | fehlerfrei |
| `npm run test` | 50 Dateien, 655 Tests bestanden (Phase 4: 37 Dateien, 605 Tests) |
| `npm run build` | erfolgreich, 157 Module (Größen siehe Abschnitt 7) |
| `npm run check:browser` | 182 von 182 Prüfungen bestanden (vollständiger Lauf, 1.937 s) |

Neue bzw. erweiterte Testdateien dieser Phase u. a.: `date`, `demand`, `specialty` (9), `households`, `save/saveSpecialty`, Inhalte `climate`, `events`, `demand`, `households`, UI `specialtyViewModel`, Integration `hot-matchday` (Szenario Auftrag 13, Seed 7, Tag 48 = Sa 24. Juli 2027).

## 6. Browserprüfung und Screenshots
Headless-Chromium mit Software-Rendering (SwiftShader, etwa 2–3 Bilder/s) – **kein** Nachweis für echte Grafikhardware.

**Angepasste bestehende Prüfungen (Bedeutung unverändert):** R0b erwartet jetzt sechs Bewohner (vier Stammbewohner plus die Gäste Ole und Hilde, alle anfangs abwesend); E11d/R5b erwarten Schema 4; der Regalfüllplan in E13 überspringt Zutaten und Rezeptprodukte (nicht bestellbar); die Gedränge-Suche in R3 zählt nur die vier Stammbewohner (Ole kommt an Spieltagen dazu); der Wirtschaftsablauf (E5e) startet mit Wetterpartikeln „aus“, damit zufälliger Regen am ersten Tag den Pixelvergleich nicht verrauscht. Neue Option `--only p5`.

**Neuer Abschnitt P5:**
- **P5a** HUD-Datum mit Jahreszeit und Wetter (Tag 1 und Dezember).
- **P5b** Kalender per Klick auf das Datum und Taste K; 3 sichere + 4 Tendenztage, Veranstaltungsliste, Effektschalter; Öffnen/Schließen ändert keinen Zustand.
- **P5c** gleiches Wetter und gleiche Vorhersage nach Neuladen, anderer Seed anderes Wetter; Regentag mit Partikeln und nassem Pflaster; Effekte aus/reduziert/voll.
- **P5d** Dezember-Schneetag mit Schneedecke, Partikeln und Weihnachtsdekoration; nach dem 24. Dezember ist sie weg.
- **P5e** Heimspiel: Ole kommt ans Fenster, Dekoration, Bier-Bonus über normalem Samstag; nach 20:00 kein Bonus, Dekoration bis Tagesende, am Folgetag weg; Ole kommt nicht wieder.
- **P5f** Herstellung über echte Bedienung (Taste E am Lager, Reiter „Spezialität“, Chargen, Start), Fortschritt, 12 Einheiten nach 80 Minuten, Verkauf an Bewohner, Kundenstimme im Reiter.
- **P5g** Kundenstopper I-014 und Kult-Tafel I-015 erscheinen nur mit den Stufen-Flags an ihren Layoutpositionen; Frikadellen-Freitag erscheint im Kalender nur mit Kultstatus.
- **P5h** Speichern/Neuladen erhält Kalender, Wetter, Vorhersage, Veranstaltungen, Lager, Ware, laufende Herstellung, Spezialität, Flags und Kasse (Schema 4); die Herstellung läuft danach weiter.
- **P5i** Szenario „Heißer Samstag mit Heimspiel“ im Browser (Vorhersage, Bestellung, Herstellung, Verkauf, Spielende, Tagesabschluss, Neuladen).
- **P5z** WebGL-Kontext nie verloren.

Die Prüfungen setzen Spielzustände (Tag, Flags) wie die R-Abschnitte über `game.load`; die Bedienschritte (HUD-Klick, Tasten K und E, Reiter, Startknopf) sind echte Eingaben.

**Screenshots** (`docs/screenshots/auftrag-05/`, Gerätefaktor 2, alle von Claude Code angesehen): `kalender.png`, `vorhersage.png` (Donnerstag vor dem heißen Spieltag, Nachfragepfeile), `regen.png`, `winter.png` (23. Dezember, Schnee, Tannenbaum, Lichterkette), `fussballspieltag.png` (Ole am Fenster), `herstellung.png` (Reiter „Spezialität“ bei etwa 48 %), `kultstatus.png` (Kundenstopper und Kult-Tafel), `szenario-heisser-samstag.png` (Sonnenschirm, Wimpel, Fahne, Ole). Die Screenshots der Aufträge 01–04 wurden nicht verändert.

## 7. Performance
- Build: 157 Module; Spielcode `index-*.js` 375,78 kB (gzip 124,68 kB), Three.js 645,24 kB (gzip 161,40 kB). Der Spielcode ist gegenüber Phase 4 gewachsen (Inhalte, Kalender, Wetter, Spezialität).
- Niederschlag: höchstens 1.600 Regenlinien bzw. 1.200 Schneeflocken als je ein Draw Call; „reduziert“ halbiert, „aus“ zeichnet nichts. Dekorationen sind wenige einfache Meshes je Veranstaltung, I-014 196 und I-015 86 Dreiecke.
- `environmentOf` ist je Spielminute zwischengespeichert, das Wetter je Tag memoisiert; Bewohner fragen es viele Male je Bild ab, ohne neu zu rechnen.
- Messungen der Bildrate liegen nur aus Headless-Chromium mit Software-Rendering vor und sind **kein** Nachweis für echte Grafikhardware.

## 8. Bekannte Fehler und offene Einschränkungen
1. **Keine Wettergeräusche und kein Audio** (Phase 6).
2. **Nur Ein-Personen-Haushalte als Inhalt;** mehrköpfige Haushalte sind als Vertrag umgesetzt und mit einem Testpaket geprüft, aber keine Familie ist angelegt.
3. **Wareneinsatz der Spezialität** wird über ihren festen Einkaufspreis (1,00 €) gebucht, nicht aus den tatsächlich verbrauchten Zutaten; die Zutaten erscheinen beim Einkauf als Einkauf. Über einen Tag stimmen Umsatz, Einkauf und Wareneinsatz damit buchhalterisch, die Marge der Frikadelle ist aber eine Näherung.
4. **Lagerqualität ist ein Mittelwert** über alle gehaltenen Einheiten; einzelne Chargen werden nicht unterschieden, Frische spielt keine Rolle (bewusst, Auftrag 9.3).
5. **Wetter und Termine hängen vom Inhalt ab:** Änderungen an Klima oder Terminregeln verändern auch bestehende Spielstände (ADR-024).
6. **Die Hitzewelle kann bereits laufen, wenn sie zum ersten Mal sichtbar wird** (Ankündigung zwei Tage vorher, also nur innerhalb der sicheren Vorhersage).
7. **Gästefiguren N-008/N-009** sind GLB-Figuren derselben Pipeline, gestalterisch nicht freigegeben.
8. **Nicht auf echter Grafikhardware, nicht in Firefox oder Safari geprüft.** Die Schritte dafür stehen in der [Prüfanleitung](PRUEFANLEITUNG-MANUELL.md).
9. Die Wetterkette kann im Sommer einzelne kühle Morgen (unter 10 °C) erzeugen; plausibel, aber nicht gegen echte Klimadaten kalibriert.

## 9. Branch und Commits
Branch `claude/elegant-curie-17qulu`:

- `87419b1` Paket 5.1 Kalender und Jahreszeiten
- `a1b0f96` Paket 5.2 Wetter, Vorhersage, Darstellung
- `461cbbb` Paket 5.3 Veranstaltungen, Gäste, Dekorationen
- `1ba6963` Paket 5.4 Nachfragemodell
- `15452e7` Sonnenschirm der Hitzewelle (kein Clipping mehr)
- `8e81f39` Paket 5.5 Spezialität – Domäne, Inhalte, Savegame v4
- `64fac44` Paket 5.5 UI der Spezialität
- `39362fa` Paket 5.6 Haushalte, Geldbörse, Erinnerungen
- `15761c1` Integrationstest Heißer Samstag mit Heimspiel
- `5be803f` Spezialität nicht bestellbar; ADRs, Datenverträge, Plan, Register
- `a775316` Ist-Stand und Bewohner-Dokument
- `0c4d8cf` Prüfanleitung Schritte 48–54
- Abschluss-Commit: Browserprüfung P5, Screenshots, dieser Bericht

## 10. Definition of Done (Auftrag 18)
| Kriterium | Stand |
|---|---|
| Alle Pakete 5.1–5.6 implementiert | ✓ (Abschnitt 1) |
| typecheck, lint, test, build grün | ✓ (Abschnitt 5) |
| `check:browser` grün, Szene tatsächlich geprüft | ✓ 182/182, Screenshots angesehen |
| Savegame-Migration und Round-Trip | ✓ (Abschnitt 4) |
| Keine realen Marken, Vereine, Personen | ✓ (Sperrlisten-Test, alle Namen fiktiv) |
| Dokumentation nachgeführt (ADRs, Datenverträge, Register, Plan, Ist-Stand, Prüfanleitung) | ✓ |
| Prüfung auf echter Grafikhardware, Firefox, Safari | **offen** – nicht von Claude Code durchführbar, Schritte 48–54 der Prüfanleitung |
| Audio/Wettergeräusche | **nicht Teil dieser Phase** (Phase 6) |
