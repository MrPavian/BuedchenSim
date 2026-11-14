# Technischer Ist-Stand

**Stand:** 2026-11-14 · nach [Auftrag 04](auftraege/04-bewohner-und-soziale-bindung.md)

Dieses Dokument enthält nur geprüfte Fakten und trennt durchgehend **implementiert**, **automatisiert getestet** (Vitest, Headless-Browserprüfung) und **manuell geprüft** (nichts davon ist bisher geschehen). Entscheidungen stehen in [ARCHITEKTUR-ENTSCHEIDUNGEN.md](ARCHITEKTUR-ENTSCHEIDUNGEN.md), Verträge in [MODUL-UND-DATENVERTRAEGE.md](MODUL-UND-DATENVERTRAEGE.md), die Inhalte der Bewohner und Geschichten in [BEWOHNER-UND-GESCHICHTEN.md](BEWOHNER-UND-GESCHICHTEN.md), die Schritte für die Prüfung auf echter Grafikhardware in [PRUEFANLEITUNG-MANUELL.md](PRUEFANLEITUNG-MANUELL.md).

## 1. Kernaussage
Das Repository enthält eine startbare Three.js-Anwendung mit einem begehbaren, ausgestatteten Kiosk, einem **geschlossenen Wirtschaftskreislauf** und seit Auftrag 04 **vier wiederkehrenden Bewohnern**. Der Spieler bestellt Ware bei einem fiktiven Großhandel, nimmt die Lieferung an, räumt sie in 67 Warenplätze ein, verkauft über die Kasse (mit echter Altersschranke für Bier und Tabakwaren) und schließt den Tag mit einer Abrechnung ab. Die Spielzeit läuft nach O-3 (1 Spielminute = 1 Sekunde, 06:00–22:00 Uhr, Pause, 1×/2×/4×). Die 28 fiktiven Produkte sind als 3D-Ware im Regal sichtbar und folgen dem Bestand.

Vier Bewohner (Günter Wollny, Derya Aksoy, Jonas Pietrek, Marlene Hoffmann; Figuren N-002, N-003, N-006, N-007, prozedural gebaut) gehen nach Tagesroutinen über einen handgepflegten Wegpunktgraphen vor dem Kiosk und im Hof, sind über E ansprechbar, führen Gespräche mit Bedingungen und Effekten, haben Beziehungen und Erinnerungen und stoßen zwei mehrstufige Alltagsgeschichten mit je mehreren Ausgängen an, die miteinander verknüpft sind. Alle vier kaufen als Kunden über dieselbe Verkaufsdomäne (`economy.completeSale`) ein; die Alterskontrolle gilt auch für sie (Jonas, 17, kann Tabak nie kaufen). Routinen und Wünsche sind deterministisch aus einem gespeicherten Weltseed abgeleitet. Der Spielstand ist Version 3; Version 2 und Version 1 bleiben ladbar. Inhalte und Regeln: [BEWOHNER-UND-GESCHICHTEN.md](BEWOHNER-UND-GESCHICHTEN.md).

Nicht vorhanden sind Preisänderungen, dynamische Nachfrage, Wetter, Events, Kalenderdatum und Audio; nur vier Bewohner. Verkäufe an der Kasse sind weiterhin ein expliziter Kassenvorgang des Spielers. Alle automatisierten Prüfungen liefen in Node (Vitest) bzw. Headless-Chromium mit Software-Rendering; auf echter Grafikhardware und in Firefox oder Safari wurde nichts geprüft, und **manuell geprüft wurde nichts**.

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
| `npm run check:browser` | baut, startet die Anwendung in Chromium, prüft sie mit echten Tastendrücken und schreibt Screenshots nach `docs/screenshots/` (Laufzeit in der Entwicklungsumgebung mit Software-Rendering: bis Auftrag 03 rund 11–12 Minuten; Auftrag 04: rund 20 Minuten); mit `-- --only economy` läuft nur der Wirtschaftsabschnitt |

`check:browser` braucht einen zu Playwright 1.63.0 passenden Chromium. Auf einem frischen Rechner einmalig `npx playwright install chromium` ausführen.

`node scripts/screenshot.mjs --out <png> --x <m> --z <m> [--heading] [--door open|closed] [--shutter open|closed]` erzeugt einen einzelnen Screenshot aus der laufenden Anwendung an einer vorgegebenen Position.

## 4. Struktur
```
index.html                     Einstieg, lädt src/main.ts
src/main.ts                    einzige Verdrahtung: Inhalt prüfen, Spielstand laden, Game/World/UI/Loop starten, Autosave, Fehleranzeige
src/core/                      loop.ts (fester Zeitschritt), signals.ts (typisierter Emitter), log.ts
src/game/                      game.ts (Fassade), state.ts (GameState v3), types.ts (Inhaltsverträge, Produkte, Warenplätze),
                               balance.ts (alle Balancing-Werte), clock.ts (Spieluhr), economy.ts (Bestellung, Einräumen, Verkauf, Tagesabschluss),
                               selectors.ts (lesende Hilfen), stockLayout.ts (Anordnung und Kapazität eines Warenplatzes), events.ts (Signale), domain.ts,
                               placement.ts (Grundfläche, Drehung, Vorderseite), colliders.ts, reachability.ts,
                               kioskGeometry.ts (Wandstücke, Schnitthöhe), rects.ts, constants.ts,
                               interaction.ts (Kiosk-Punkte und Bewohner in Reichweite), result.ts, save/save.ts (Schema 3), testing/{fixture-pack,harness}.ts,
                               npcTypes.ts (Inhaltsverträge Phase 4: Bedingungen, Effekte, Dialoge, Quests, Routinen, Wünsche), npcSim.ts (Routinen, Wege, Kunden),
                               npcs.ts (lesende Sicht), npcSelectors.ts, dialogue.ts (Gespräche und Kundengespräch), story.ts (Effekte), conditions.ts,
                               relationship.ts (Stufen), wishes.ts (Wunschwahl), nav.ts (Graph, Wegsuche), random.ts (geseedeter Zufall)
src/content/                   validate.ts, validateStock.ts (Produkte und Warenplätze), assets/{catalog,productAssets}.ts (Asset-Katalog, P-001 bis P-028),
                               regions/ruhrgebiet/{index,layout,products,slots}.ts (Kiosk, Platzierungsliste, Boden, Interaktionspunkte inkl. Kasse und Lager, 28 Produkte, 67 Warenplätze),
                               validateResidents.ts (Graph, Bewohner, Dialoge, Quests), regions/ruhrgebiet/{residents,nav,quests,customerLines,dialogueKit,dialogues,
                               dialoguesGuenter,dialoguesDerya,dialoguesJonas,dialoguesMarlene}.ts (vier Bewohner, Graph, zwei Geschichten, 56 Dialoge)
src/world/                     world.ts, renderer.ts, camera.ts, input.ts, collision.ts, colliders.ts, materials.ts,
                               occlusion.ts, occlusionRules.ts, playerFigure.ts, placementGates.ts (flaggebundene Platzierungen)
src/world/assets/              registry.ts (Asset-ID → Fabrik), ground.ts
src/world/assets/kiosk/        K-001 in Teilen: walls, roof, awning, salesWindow, door, signage, lighting, interior,
                               materials, textures
src/world/assets/products/     bottles, flat, food (Verpackungsfabriken), kit, labelTexture (Canvas-Etiketten), materials, index (Fabrik je Verpackungsart)
src/world/assets/furniture/    counter, register, wallShelf, middleShelf, fridge, freezer, magazineRack,
                               storageRack, crates, bench (E-004), photo (I-013), kit (Bauhilfe), materials, placeholder
src/world/assets/residents/    index.ts (Asset-ID → Fabrik), kit.ts (Bauteile, Rig, Animation), guenter, derya, jonas, marlene (N-002, N-003, N-006, N-007), fallback
src/world/views/               kioskView.ts (Tür-/Klappenanimation), markerView.ts, stockView.ts (Bestand als InstancedMesh), stockLayout.ts (Posen, Spiegelung, Neigung),
                               residentView.ts (Bewohner aus dem Zustand zeichnen, Kollisionskreise)
src/integration/               Tests des echten Inhaltspakets gegen die echten Fabriken
src/ui/                        ui.ts, hud.ts, modal.ts, panels/{goods,till,dayClose,dialogue,journal}.ts, viewModel.ts, socialViewModel.ts, format.ts, dom.ts, texts.ts, styles.css
scripts/                       browser-check.mjs, screenshot.mjs
docs/screenshots/              Screenshots aus der laufenden Anwendung (Auftrag 04 in auftrag-04/)
docs/BEWOHNER-UND-GESCHICHTEN.md  Bewohner, Routinen, Dialoge, Geschichten, Kundenkäufe
docs/PRODUKTKATALOG.md         Produktkatalog und Warenplätze aus den echten Daten
```
Tests liegen als `*.test.ts` neben dem Code.

## 5. Implementierte Funktionen
**Bewohner, Dialoge und Geschichten (Auftrag 04)**
Ausführlich mit allen Tabellen, Ausgängen und Texten: [BEWOHNER-UND-GESCHICHTEN.md](BEWOHNER-UND-GESCHICHTEN.md). Typen und Verträge: [MODUL-UND-DATENVERTRAEGE.md, Abschnitt 16](MODUL-UND-DATENVERTRAEGE.md). Hier die Kurzfassung des Implementierten.

*Bewohner und Inhalte*
- Vier Bewohner als Inhaltsdaten (`npc.guenter` N-002 Stammkunde, 71; `npc.derya` N-003 Tischlerin, 38; `npc.jonas` N-006 Fahrradkurier, 17; `npc.marlene` N-007 Nachbarin, 58) mit Biografie, Eigenschaften, Startbeziehung, Vorlieben, Beziehungen zueinander, Routine, Warenwünschen und Dialogen. Vorlieben, Abneigungen und die Beziehungen der Bewohner zueinander sind validierte Daten ohne Spielwirkung.
- 56 Dialoge mit 129 Knoten, 13 Warenwünsche, 21 Routineeinträge, zwei Geschichten (`quest.hof` mit vier Ausgängen, `quest.paket` mit zwei Ausgängen und der Verknüpfung A → B), fünf Story-Flags. Alle Spieltexte sind deutsch; alle Namen sind frei erfunden.
- Bedingungen und Effekte sind eine geschlossene Menge von Datentypen (`src/game/npcTypes.ts`); kein ausführbarer Code in den Inhalten.

*Orte, Wege, Routinen*
- Handgepflegter Wegpunktgraph (39 Wegpunkte, 46 Kanten, drei Ausgänge) mit zwei Gehweg-Bahnen (A bei z = 3,3 und die Umgehung B bei z = 4,3), Hofbahn, Bankplätzen und Werkstattecke; fünf Aufenthaltsorte (Verkaufsfenster, Ecke, Gehweg als Durchgang, Hofbank, Werkstatt). Die Kanten sind validiert kollisionsfrei, alle Wegpunkte erreichbar.
- Routinen nutzen Tageszeit und den aus dem Tageszähler abgeleiteten Wochentag, eine tägliche deterministische Chance und optionale Bedingungen (Story). Zustände `away`, `walking`, `at_place`, `waiting`, `talking`; Erscheinen und Verschwinden an den Ausgängen. Die Simulation läuft in `game.tick` in festen Teilschritten (höchstens 1/30 s, Spieltempo-skaliert), steht bei Pause still; ohne die Phase „open“ gehen alle Bewohner heim.
- Wegführung: kürzester Weg (Dijkstra), Stehenbleiben vor dem Spieler und vor anderen Bewohnern (Mindestabstand 0,65 m), nach 4 s Ausweichroute, Vorrang nach ID; **als letzte Rückfallebene** gehen sich Bewohner nach 20 s Verklemmung durch (nur untereinander).

*Zufall und Determinismus*
- Kein `Math.random()` in der Spiellogik. `src/game/random.ts`: zustandsloser Wurf `roll(seed, …Teile)` aus dem **gespeicherten Weltseed** (`state.world.seed`) für Routinechance und Wunschwahl; ein Neuladen trifft dieselben Entscheidungen. Der Seed entsteht bei einem neuen Spiel aus der Uhrzeit (`main.ts`), in Tests ist er fest. Ein Generator mit Zustand (`createRng`) liegt bereit, wird aber nicht benutzt.

*Gespräche, Beziehungen, Erinnerungen*
- Ein Bewohner in Reichweite (1,8 m, höchstens 75° Abweichung der Blickrichtung, sichtbar) hat Vorrang vor Kiosk-Punkten; E oder Klick auf den Hinweis „Mit … sprechen“ öffnet das Gespräch (`game.interact()`, `game.npcs.talk`). Es wird das Gespräch mit der höchsten Priorität gewählt, dessen Bedingungen gelten; einmalige Gespräche entfallen nach dem Sehen. Ein wartender Kunde mit offenem Wunsch bekommt statt dessen das eingebaute Kundengespräch.
- Beziehung 0 bis 100 mit den Stufen fremd (0–19), bekannt (20–49), vertraut (50–79), eng verbunden (80–100). Einzige wiederholbare Änderung ist der Tagesgruß (+1 je Bewohner und Tag); alle Effekte tragen einen Schlüssel und wirken höchstens einmal (`story.effectKeys`). Erinnerungen (einfache Kennungen, je Bewohner), Quest-Fortschritt und Flags stehen im Spielstand.
- Die Stufe steht als zurückhaltendes Etikett im Gesprächskopf; Stufenwechsel und das erste Merkenswerte in einem Gespräch erzeugen Hinweise.

*Kundenkäufe und Alterskontrolle*
- Ein Bewohner mit der Routine `shop` steht am Verkaufsfenster; bei offener Klappe wählt er deterministisch einen Wunsch (`npc.wish`), der gespeichert wird. Im Kundengespräch kann der Spieler verkaufen, den Ausweis prüfen oder ablehnen. Der Verkauf ist ein einziger Aufruf von `economy.completeSale({ …, customer: { npcId } })`: Bestand, Kasse, Tagesumsatz und Transaktion (mit `npcId`) ändern sich genau einmal, `sale.completed` trägt die `npcId`. Ein aufgelöster Wunsch lässt sich nie erneut verkaufen; das Panel sperrt Doppelklicks 250 ms.
- Wartezeit: Bei offener Klappe wartet der Kunde bis zum Ende seines Routinefensters; bei geschlossener Klappe geht er nach 30 Spielminuten mit der Erinnerung `kiosk-closed`.
- **Alter:** Das Alter eines Bewohners kommt aus den Inhaltsdaten. `completeSale` lehnt unter dem Mindestalter mit `customer_underage` ab, auch bei bestätigter Ausweisprüfung; ohne die ausdrückliche Prüfung lehnt es mit `age_check_required` ab. Jonas (17) kann Tabak (ab 18) nie kaufen. Die Kassenverkäufe des Spielers sind unverändert.

*Figuren, Kollision, flaggebundene Platzierungen*
- Vier **prozedurale** Figuren (Fabriken N-002, N-003, N-006, N-007, Fallback-Figur für unbekannte IDs): Kopf, Rumpf, Arme, Beine, Kleidung und Merkmale je Figur; 28 bis 33 Meshes und 1.854 bis 2.338 Dreiecke je Figur, 7 gemeinsame Grundgeometrien, geteilte Materialien je Farbe; Geh-, Steh- und Sprechanimation ohne Objekterzeugung pro Bild. Höhen 1,67 bis 1,83 m (Maße aus einem Vitest-Lauf). Die Wahl „prozedural statt GLB“ steht in ADR-021.
- Die Darstellung (`residentView`) liest `game.state.npcs`, interpoliert zwischen den festen Schritten und blendet verborgene Bewohner aus. Die sichtbaren Bewohner begrenzen die **Bewegung des Spielers** (Kreis gegen Kreis, Radius 0,3 m, Gleiten); **Bewohner schieben den Spieler nie**, ein stehender Spieler wird nie bewegt.
- **Flaggebundene Platzierungen** (`PlacementDef.requiresFlag`): E-004 Hofbank (Flag `yard.bench`, kollidiert) und I-013 gerahmtes Kioskfoto auf der Theke (Flag `kiosk.photo`, kollidiert nicht) existieren nur nach der Entscheidung der Geschichte; Darstellung und Kollision folgen dem Flag, die Inhaltsvalidierung behandelt sie als vorhanden.

*Oberfläche*
- Generisches Dialogpanel (Name, Rolle, Stufe, Aussage, bis zu vier Antworten, Tasten 1–4) mit Kundenansicht (Wunschzeilen, Summe, Altersangabe, Regalbestand, Warnung). Journal „Notizen“ (J oder Schaltfläche in der Leiste): bekannte Leute, aktuelle Schritte begonnener Geschichten, abgeschlossene Geschichten. Beide sind Modale wie Kasse und Warenverwaltung: Bewegung und E der Welt ruhen, die Uhr läuft weiter. Ein Gespräch öffnet sich nie über einem anderen Fenster.
- Gespeichert wird zusätzlich (300 ms entprellt) nach `dialogue.closed`, `story.changed`, `relationship.changed`, `memory.added` und `npc.wish`.

*Savegame Version 3*
- `GameState` erweitert um `world.seed`, `npcs` (Status, Position, Route, Beziehung, Erinnerungen, offener Wunsch u. a.) und `story` (Flags, Quests, gesehene Dialoge, verbrauchte Effektschlüssel); `Transaction.npcId` ist optional. Migration 2→3 ergänzt Seed (aus Region und Speicherzeit), leere Bewohner und leere Geschichte und lässt alles andere unverändert; 1→2→3 läuft als Kette. Unbekannte Bewohner, Dialoge und Quests (und unbekannte Orte, Wegpunkte, Routinen, Wünsche eines Bewohners) werden verworfen bzw. zurückgesetzt und als Warnung gemeldet. Ein Gespräch und Laufzeitzähler werden nie gespeichert; `talking` wird beim Laden zu `walking`, `waiting` oder `at_place`.

*Inhaltsvalidierung (`validateResidents`)*
- Graph (IDs, Kanten, kollisionsfrei, erreichbar, Abstände der Standplätze, Fensterreichweite, freie Türzufahrt), Bewohner (Profil, Routinen, Wünsche, Vorlieben, Referenzen, Rückfallgespräch), Dialoge (Knoten erreichbar, 1–4 Antworten, unbedingte Antwort, Bedingungen und Effekte auflösbar, keine widersprüchlichen Ausgänge, Schlüssel eindeutig), Geschichten (mindestens drei Schritte, zwei Ausgänge, jeder Schritt und jeder Ausgang wird von einem Effekt gesetzt), Kundentexte, Flags (gelesene Flags werden gesetzt, auch Platzierungs-Flags). Im Entwicklungsmodus verhindert ein Fehler den Start.

*Debug-Zugang:* zusätzlich `world.getResidentInfo()` (gezeichnete Pose, Animation, Kopf in Bildschirmkoordinaten) und `world.getGatedPlacements()`; `game.npcs`, `game.dialogue` und `ui.openPanel('journal')` sind darüber erreichbar.

**Waren, Wirtschaft und Spieltag (Auftrag 03)**

*Produktkatalog und Warenplätze*
- 28 fiktive Produkte (`product.…`, Asset-IDs `P-001` bis `P-028`) in sieben Kategorien, Bier und Tabakwaren als Unterkategorien; Preise in ganzen Cent, Lagerart, Mindestalter, Nachfrage-Tags (nur Daten, ohne Wirkung), Verpackungsart und Etikett. Vollständige Tabelle: [PRODUKTKATALOG.md](PRODUKTKATALOG.md). Die Marken sind Arbeitstitel und rechtlich nicht geprüft.
- 67 Warenplätze (`slot.<möbel>.<n>`) auf Theke, beiden Wandregalen, Mittelregal, Kühlschrank, Eistruhe und Zeitschriftenständer. Ein Platz hat eine Box im lokalen Rahmen seiner Platzierung, akzeptiert genau eine Lagerart und hält ein Produkt zur Zeit.
- **Geometrische Kapazität mit einer Quelle:** `slotUnitPositions` (`src/game/stockLayout.ts`) ordnet Einheiten in Spalten, Reihen und Lagen an; die Kapazität ist die Zahl dieser Positionen. Spiel (Kapazitätsprüfung) und Welt (Darstellung) verwenden dieselbe Funktion, die Darstellung kann also weder überfüllen noch überlappen.
- Zuordnung Rolle der Platzierung zu Lagerart in `validateStock.ts`: Verkauf = Theke, Präsentation = Regal und Zeitschriftenständer, Kühlung = Kühlung, Tiefkühlung = Tiefkühlung; Kasse, Lager, Leergut tragen keine Waren. Die Zuordnung gilt je Rolle, nicht je Asset.

*Lager, Bestellung, Lieferung, Einräumen*
- Das Hinterlager ist ein Zähler je Produkt mit höchstens 400 Stück insgesamt (`STORAGE_CAPACITY_UNITS`), die offene Lieferung reserviert Platz. Startkapital 300,00 €.
- Bestellung (`economy.placeOrder`): ein fiktiver Lieferant („Großhandel Emscher“), Summe wird sofort aus der Kasse abgebucht, die Bestellung als Transaktion verbucht, es gibt höchstens eine offene Lieferung. **Die Lieferung trifft sofort ein** (es gibt keine Wartezeit), muss aber **ausdrücklich angenommen** werden (`economy.receiveDelivery`) und landet dann im Lager.
- Einräumen (`economy.restock`) vom Lager in einen passenden Platz, Zurücknehmen (`economy.unstock`) ins Lager. Geprüft werden Lagerart, fremdes Produkt im Platz, Platzkapazität und Lagerbestand. Bestände und Geld bleiben ganze, nicht negative Zahlen.

*Kasse und Verkauf*
- Verkauf (`economy.completeSale`) ist atomar: entweder alle Zeilen oder nichts. Verkauft wird nur Ware auf Warenplätzen (nicht aus dem Lager), zum vorgeschlagenen Verkaufspreis, und nur wenn die Verkaufsklappe geöffnet ist **und** der Tag in der Phase „open“ ist (nicht bei 22:00-Wartezustand und nicht nach Tagesabschluss). Pause sperrt den Verkauf nicht (und auch keine Bestellung). Der Bestand wird über die Warenplätze in Inhaltsreihenfolge abgebucht.
- Ein Verkauf erhöht Kasse und Tagesumsatz, bucht den Wareneinsatz (Einkaufspreis der verkauften Ware) und protokolliert eine Transaktion mit Tag, Minute, Produkt-ID, Menge, Einzelpreis und Summe. Es bleiben die letzten 200 Transaktionen erhalten.
- **Alterskontrolle als Verkaufsschranke:** Sobald eine Warenkorbzeile ein Produkt mit `minimumAge` enthält, lehnt `completeSale` ohne `ageCheckConfirmed: true` mit `age_check_required` ab. Die Schranke wird je Verkauf aus den Produktdaten abgeleitet (kein Sonderfall für Produktnamen), die Bestätigung ist ein Parameter genau dieses Aufrufs und wird **nie gespeichert**. Die Kasse zeigt dafür ein Kontrollkästchen „Ausweis geprüft – Mindestalter (n) erreicht“, standardmäßig nicht gesetzt; es wird nach dem Verkauf und beim Schließen zurückgesetzt.

*Spieluhr und Tagesabschluss*
- 1 Spielminute = 1 reale Sekunde bei Tempo 1× (`GAME_MINUTES_PER_SECOND`), Tag 06:00 bis 22:00 Uhr (960 Spielminuten), Tempo 1×, 2×, 4× und Pause (`SPEEDS`, alles in `balance.ts`). Die Uhr wird über `game.tick(dtSeconds)` aus dem festen 60-Hz-Schritt des Loops getrieben, ohne eigene Timer. Sie läuft unabhängig von Tür und Klappe und auch bei geöffnetem Panel.
- Bei 22:00 Uhr wird die Zeit auf 22:00 begrenzt (auch bei sehr großen Zeitschritten), die Phase wechselt einmalig auf „awaiting_close“ und `day.ending` wird gesendet. **Die Uhr schließt den Tag nie selbst und wartet auf den ausdrücklichen Abschluss.**
- Tagesabschluss (`economy.closeDay`) ist in den Phasen „open“ (vorzeitig, mit Bestätigungsdialog, die Restzeit entfällt) und „awaiting_close“ möglich und genau einmal je Tag (`day_already_closed`). Der Bericht enthält: Umsatz (Summe der Verkäufe), Wareneinsatz (Einkaufswert der heute verkauften Ware), Einkäufe (heute bei der Bestellung bezahlte Summe, auch für Ware im Lager), Rohertrag (Umsatz minus Wareneinsatz), Kassenveränderung (Umsatz minus Einkäufe), Kassenstand am Abend, Zahl der Verkäufe und Abschlussminute. Weitere Kosten gibt es nicht. Es wird nichts gutgeschrieben und nichts aufgefüllt.
- Nächster Tag (`calendar.startNextDay`, nur in Phase „closed“): Tag + 1, 06:00 Uhr, Phase „open“, Tagessummen zurückgesetzt; Tempo und Pause bleiben. Bestellungen sind in der Phase „closed“ gesperrt (`day_closed`).

*Signale (Nutzlast nur IDs und einfache Werte)*
`day.started`, `day.ending`, `day.ended`, `calendar.changed`, `product.stock.changed`, `money.changed`, `sale.completed`, `order.placed`, `delivery.received`, `interaction.triggered`; Details in [MODUL-UND-DATENVERTRAEGE.md, Abschnitt 15](MODUL-UND-DATENVERTRAEGE.md).

*HUD, Panels und Bedienung*
- Kompaktes HUD: Tag mit abgeleitetem Wochentag (z. B. „Mo · Tag 1“), Uhrzeit, Kassenstand, Status „Geöffnet/Geschlossen“ (aus der Verkaufsklappe abgeleitet), Pause/Weiter, Tempo 1×/2×/4×, „Tag abschließen“ (nach Abschluss „Abrechnung“) und ein Hinweis mit Schaltfläche, sobald es 22:00 ist. Die HUD hat keine Schaltflächen für Waren oder Kasse.
- Panels (jeweils ein Modal über abgedunkeltem Hintergrund, Escape und „Schließen“ schließen, Tab bleibt im Dialog): Warenverwaltung mit vier Reitern (Bestand, Bestellen, Lieferung, Einräumen), Kasse mit Warenkorb und Altersprüfung, Bestätigung des Tagesabschlusses, Tagesabrechnung mit „Nächsten Tag beginnen“.
- Öffnen nur ortsgebunden: Die Kasse öffnet sich am Kassenpunkt (hinter der Theke neben der Kasse, `interaction.register`), die Warenverwaltung am Lagerpunkt (vor dem Lagerregal, `interaction.storage`). Jeweils mit E oder per Klick auf die Eingabeaufforderung („Kasse bedienen“ bzw. „Lager öffnen“). Ein offenes Panel schließt sich, wenn die Figur den passenden Punkt verlässt oder der Spielstand ersetzt wird (Laden, „Neues Spiel“). Die Ortsregel liegt in der Oberfläche; `economy.completeSale` prüft die Position der Figur nicht, damit später NPC-Kunden dieselbe Verkaufsdomäne nutzen können. Der Debug-Hook `ui.openPanel(...)` (nur mit `?debug` bzw. in DEV) umgeht die Ortsregel. Nach einem Neuladen in der Phase „closed“ öffnet sich die Abrechnung wieder.
- **Eingabesperre:** Solange ein Panel offen ist, ignoriert die Welt Bewegung und E und lässt gehaltene Tasten los (`world.setInputEnabled`). Die Uhr läuft dabei weiter.
- Die Oberfläche ändert keine Spielwerte: Warenkorb und Altersbestätigung leben nur im Panel, Aktionen laufen über die `Game`-Fassade, Ablehnungsgründe werden auf deutsche Texte abgebildet.

*3D-Ware*
- Zehn Verpackungsfabriken (Glasflasche, PET-Flasche, Dose, Beutel, Tafel, Schachtel, Stieleis, Eisbecher, Backware, Heft) bauen eine Einheit mit Pivot Bodenmitte und dem Maß des Produkt-Assets; Farbe, Beschriftung und Maße machen die 28 Produkte unterscheidbar.
- Etiketten sind Canvas-Texturen je Produkt mit großem Akzentfeld und einem originalen Emblem je fiktiver Markenfamilie (z. B. Scheibe, Raute, Stern, Blitz). Ein Produktwort steht nur, wenn die Schrift physisch mindestens 2,6 cm hoch ist; sonst zeigt das Etikett das Emblem mit einem großen Anfangsbuchstaben. Flaschen und Dosen sind umlaufend und wiederholen sich, damit sie von jeder Seite lesbar wirken; Kronkorken tragen die Akzentfarbe (Bier: Stahl). Bier und Tabak behalten ein schlichtes Band ohne Emblem. Eine Textur je Produkt; Draw Calls unverändert, Texturspeicher höher. Zur Lesbarkeit siehe Einschränkungen.
- Die Bestandsdarstellung (`stockView.ts`) zeichnet für jeden belegten Platz die ersten n Positionen aus `slotUnitPositions`, als `InstancedMesh` je Modellteil und Produkt, ohne Schatten. Leere Plätze bleiben leer. Aktualisierung nur bei `product.stock.changed` und `game.state.replaced`, nur für betroffene Produkte. Die Rückseite des Mittelregals ist gespiegelt, Hefte liegen geneigt auf den Ablagen des Ständers.

*Savegame*
- `schemaVersion` 2 (`GameState` um `calendar` und `economy` erweitert; seit Auftrag 04 ist die Version 3, siehe oben). Migration 1→2 setzt Anfangswerte (Tag 1, 06:00, Tempo 1×, Phase „open“, 300,00 €, leere Bestände) und lässt Position, Blickrichtung, Tür und Klappe unverändert.
- Strenge Prüfung von Form und Wertebereichen. Unbekannte Produkt- oder Platz-IDs, nicht mehr passende Lagerarten und zu große Mengen werden verworfen bzw. auf die aktuelle Kapazität gekürzt und als Warnungen gemeldet (Hinweis „n Einträge wurden an geänderte Inhalte angepasst“); das Spiel startet trotzdem. Warenkorb und Altersbestätigung stehen nie im Spielstand.
- Gespeichert wird zusätzlich zum Intervall und den Tür-/Klappenänderungen nach `sale.completed`, `order.placed`, `delivery.received`, `day.ended`, `day.started`, `calendar.changed`, `product.stock.changed` und `money.changed` (um 300 ms entprellt), beim Verbergen der Seite und beim Verlassen.

*Debug-Zugang:* `window.__buedchen = { game, world, ui }` (Entwicklungsmodus oder `?debug`); neu sind `world.getStockInfo()` (Platz, Produkt, Menge, gezeichnete Instanzen, Position der ersten Einheit) und `ui.openPanel` / `ui.currentPanel`.

**Asset-Katalog und Platzierungsliste (Auftrag 02)**
- Der Katalog (`src/content/assets/catalog.ts`) beschreibt jedes Asset mit ID, Maßen, Kategorie, erlaubten Drehungen und Kollisionsverhalten.
- Das Layout (`layoutVersion: 1`) enthält elf Platzierungen mit stabiler ID (`placement.…`), Asset-ID, Position, Drehung in 90°-Schritten, optionaler Skalierung, optionaler Auflage (`on`) und Rolle.
- Darstellung und Kollision lesen dieselben Daten. Ein Möbel wird durch eine Änderung in `layout.ts` verschoben oder gedreht; die Fabrik bleibt unberührt.
- Zwei Assets stehen mehrfach in unterschiedlicher Lage: das Wandregal `I-003` (Nordwand 0°, Westwand 90°) und der Kistenstapel `I-012` (im Kiosk 180°, außen an der Westwand 270°).
- Platzierungen sind Inhalt, kein Spielstand.
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
- Die Möbelfabriken bauen leere Möbel; Ware kommt aus der Bestandsdarstellung (Auftrag 03). Der Zeitschriftenständer zeigt keine Platzhalterhefte mehr, das Lagerregal drei unbedruckte Kartons, der Leergutbereich neutrale Kisten.

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
- Kreis (Radius 0,3 m) gegen achsparallele Rechtecke mit Gleiten an Wänden; Grenzen des begehbaren Bereichs. Sichtbare Bewohner sind zusätzliche Kreise (Radius 0,3 m), die den Spieler aufhalten, aber nie verschieben (Auftrag 04).
- Die Rechtecke entstehen aus den Wandstücken und aus der Platzierungsliste (`layoutColliders`).
- Die geschlossene Tür blockiert, die offene nicht.

**Sichtfreistellung (Auftrag 02 neu)**
- Figur im Kiosk: Das Dach wird ausgeblendet und die Südwand auf Brüstungshöhe (1,0 m) geschnitten, zusammen mit Schild, Markise, Klappe und oberem Türblatt. Ost- und Westwand werden nur geschnitten, wenn sie zwischen Kamera und Figur liegen. Die Nordwand bleibt stehen.
- Figur außen und vom Gebäude verdeckt (hinter oder neben dem Kiosk): Das Gebäude bleibt vollständig deckend, die Figur erscheint als flächige, türkisfarbene Silhouette.
- Die Silhouette erscheint nur, wenn das Gebäudevolumen zwischen Kamera und Brust oder Kopf der Figur liegt (`shouldShowSilhouette`). Im Kiosk und hinter Möbeln oder Kisten wird sie nicht gezeichnet; verdeckte Füße sind dort einfach verdeckt.
- Es gibt keine durchscheinenden Gebäudematerialien mehr.

**Interaktion**
- Bewohner in Reichweite (Auftrag 04) haben Vorrang vor den Kiosk-Punkten: `game.getInteractionTarget()` liefert Bewohner oder Punkt, E und Klick auf den Hinweis rufen `game.interact()`; der Hinweis lautet „Mit … sprechen“.
- Vier Interaktionspunkte: Tür und Verkaufsklappe (öffnen/schließen) sowie Kasse und Lager (öffnen je ein Panel, ändern keinen Zustand). `game` meldet bei Kasse und Lager `interaction.triggered`. Die Markierungen von Kasse (flache Ellipse auf der Theke neben der Kasse) und Lager (Ring auf dem Boden vor dem Regal) kommen aus den Layoutdaten.
- `game` bestimmt den verfügbaren Punkt aus Spielerposition und Layout; die UI zeigt den Prompt, die Welt eine Markierung.
- Die Markierung der Klappe liegt als flacher Streifen auf der äußeren Fensterbank (Position und Maße aus den Layoutdaten, `marker.radius`/`radiusZ`). Sie ist von außen und innen bei offener und geschlossener Klappe sichtbar.
- Der schwebende Marker der Tür sitzt oberhalb der Tafel „Trinkhalle"; seine Höhe wird aus der Lage der Tafel abgeleitet.
- Auslösen mit E oder Mausklick auf den Prompt. Tür und Klappe sind animiert.

**UI**
- Steuerungshinweis, Interaktionsprompt, Meldungen, Schaltfläche „Neues Spiel" (zweiter Klick bestätigt), sichtbare Fehleranzeige bei Start- oder Laufzeitfehlern; HUD und Panels siehe oben.
- Alle Spieltexte in `src/ui/texts.ts`. Seit Auftrag 04 zusätzlich Dialogpanel, Journal und die Schaltfläche „Notizen“ in der Leiste.

**Speichern und Laden (Grundlagen aus Auftrag 01, Erweiterung siehe oben)**
- JSON mit `schemaVersion` in `localStorage` unter `buedchensim.save.slot1`; Laden beim Start.
- Strenge Prüfung beim Laden. Ein unlesbarer oder zu neuer Spielstand wird nach `buedchensim.save.slot1.backup` kopiert, dann startet ein neues Spiel mit Hinweis.
- Die Migrationskette enthält seit Auftrag 03 die Migration 1→2, seit Auftrag 04 zusätzlich 2→3.

## 6. Prüfergebnisse (2026-11-14)
Strikte Trennung: **implementiert** ist in Abschnitt 5 beschrieben, **automatisiert getestet** steht hier, **manuell geprüft** wurde nichts (siehe Abschnitt 9).

| Befehl | Ergebnis |
|---|---|
| `npm run typecheck` | fehlerfrei (eigener Lauf 2026-11-14) |
| `npm run lint` | fehlerfrei (eigener Lauf 2026-11-14) |
| `npm run test` | 37 Dateien, 605 Tests bestanden (eigener Lauf 2026-11-14) |
| `npm run build` | erfolgreich (131 Module), Größen siehe Abschnitt 8 |
| `npm run check:browser` | 149 von 149 Prüfungen bestanden (zwei Läufe nacheinander am 2026-11-14, 1.287 s und 1.188 s) |
| `npm audit` | am 2026-11-14 nicht erneut ausgeführt (letzter Lauf 2026-11-12: 0 Hinweise) |

**Phase-3-Vorabprüfung (Auftrag 04, Abschnitt 1.1):** Der dokumentierte Phase-3-Stand wurde nicht ungeprüft übernommen. Ein eigener Lauf der Tests am Phase-3-Commit `1247610` (Stand vor Auftrag 04) ergab 23 Dateien und 370 bestandene Tests, die Zahl stimmt also. Die 98 von 98 Browserprüfungen aus Auftrag 03 sind Teil der erweiterten Browserprüfung dieses Auftrags (Ergebnis: alle 98 weiterhin grün, Teil der 149 von 149). Der Vergleich der Quelltexte mit dem Phase-3-Stand zeigt für `economy.ts` und `clock.ts` ausschließlich die Erweiterung um den optionalen Kundenbezug (Abschnitt 5, Kundenkäufe); es wurde kein Phase-3-Fehler gefunden und keiner behoben. Die Bewertung der bekannten Phase-3-Grenzen steht im [Implementierungsplan (Phase 4)](IMPLEMENTIERUNGSPLAN.md).

**Automatisiert getestet mit Vitest (605 Tests in 37 Dateien; 234 mehr als in Phase 3, davon 188 in 14 neuen Dateien; Dateien mit Auftrag-04-Bezug):**
- `src/game/npcSim.test.ts` (25): Routinen an Fensterbeginn (eingeschlossen) und -ende (ausgeschlossen), Wochentage (Tag 8 ist wieder ein Montag), Phasen, Bedingungen von Einträgen; deterministische Würfe (gleicher Seed und Tag gleiches Ergebnis, anderer Seed unterscheidet sich, Neuladen mitten am Tag, ein ganzer simulierter Tag identisch); Zustandsfolge away → walking → at_place → waiting → walking → away mit je einem Signal; ein Eintrag läuft nicht zweimal am Tag; Kunde bei geschlossener Klappe wartet und geht mit Erinnerung (einmal); getrennte Standplätze; Durchgang (pass-by); Bewohner überlappen nie und bleiben auf den Kanten; Pause, Tempo, Tagesphasen schicken alle heim; Stehenbleiben vor dem Spieler (kein Durchlaufen, kein Teleport), Umgehungsbahn, Warten bei Blockade, kein Erscheinen auf besetztem Ausgang, Vorrang der niedrigeren ID bei langer Verklemmung.
- `src/game/customer.test.ts` (18): deterministische Wunschwahl; Kundenablauf (Wunsch, Signal, genau ein Verkauf, Gehen); Ablehnen; gescheiterter Verkauf hält den Wunsch offen; Rückfallzeilen; Schließen ändert nichts; nicht bedienter Kunde geht mit `ignored:`; Altersregeln (Erwachsener braucht die Ausweisprüfung, 17-Jähriger nie die 18er-Ware, `unknown_customer`, `customer_underage` auch bei bestätigter Prüfung); der Kassenverkauf des Spielers bleibt unverändert; Kundeneffekte in Dialogoptionen; Flags steuern Wünsche.
- `src/game/dialogue.test.ts` (28): Öffnen und Ablehnungsgründe, Priorität, einmalige Gespräche, Status `talking` und Wiederherstellung, Bedingungen und Effekte von Optionen, `seen` erst bei einer Schlussantwort, vorzeitiges Schließen verbraucht kein einmaliges Gespräch (Regression), Beziehung (Schlüssel wirkt einmal, Tagesgruß, Begrenzung, vier Stufen), Quest-Schritte nur vorwärts, Ausgang endgültig, beide Geschichtspfade mit Alternativen, Interaktionsziel (Reichweite, Blick, Vorrang), Laden und Zurücksetzen.
- `src/game/conditions.test.ts` (9), `random.test.ts` (8), `nav.test.ts` (13): alle Bedingungstypen, Wurf und Generator, Wegsuche, Kantenfreiheit, Erreichbarkeit.
- `src/integration/stories.test.ts` (28): Geschichte A mit allen vier Ausgängen (Beziehungsänderungen, Erinnerungen, Flag, Folgegespräche, Routinen: Derya sägt erst ab 09:00, Marlenes Hoftreff), Vermittlung nur ab Beziehung 15, Entscheidung mit Derya oder mit Marlene; Geschichte B bis zum Foto ohne Geldbelohnung, Verschieben, Ablehnen, Sperre vor Tag 2, Übergabe erst nach Jonas; Verknüpfung A → B in allen Varianten (Ständer-Idee nur bei `kompromiss`, kühle Kommentare); Käufe von Günter, Derya und Marlene über dieselbe Domäne; Jonas kauft Tabak nie, Reaktion auf die Ablehnung; gebundene Platzierungen und Speichern.
- `src/game/save/save.test.ts` (119, vorher 75): Version 3 (Seed, Bewohner, Geschichte) im Rundlauf; Fortsetzung nach dem Laden identisch; Migration 2→3 mit Erhalt von Position, Tür, Klappe, Zeit, Kasse, Lager, Warenplätzen, Transaktionen und Bericht; derselbe Seed bei derselben Datei; Migration 1→2→3; beschädigter Version-2-Stand bleibt `corrupt`; strenge Prüfung von Version 3; Verwerfen und Zurücksetzen unbekannter Bewohner, Dialoge, Quests, Orte, Wegpunkte, Routinen und Wünsche mit Warnungen; neue Bewohner im Inhalt; `talking` wird nie wiederhergestellt; keine flüchtigen Gesprächsdaten im Spielstand.
- `src/content/validateResidents.test.ts` (24): das echte Paket ist gültig, vier Bewohner, zwei Geschichten, gebundene Platzierungen, keine realen Marken oder Vereine (kleine Sperrliste), und Mutationen (kaputte Graphen, Kanten durch Kollider, unerreichbare Wegpunkte, ungültige Routinen, Wünsche, Dialoge, Bedingungen, Effekte, Quests, Kundentexte).
- `src/world/assets/residents/residents.test.ts` (6), `src/world/views/residentView.test.ts` (7), `src/world/residentCollision.test.ts` (7), `src/world/assets/furniture/yardProps.test.ts` (3), `src/integration/placement-gates.test.ts` (4), `src/game/placement.test.ts` (10, vorher 9), `src/integration/content-world.test.ts` (9, vorher 8): Figuren (Höhe 1,6–1,85 m, Pivot an den Füßen, deutlich verschieden, geteilte Geometrien, Animation ohne neue Objekte, Fallback mit einer Warnung), Darstellung (Interpolation, Drehung, Springen nach Ersetzen des Zustands, keine neuen Objekte), Spielerkollision (Anhalten, Gleiten, kein Tunneln, nie geschoben), Bank und Foto passen auf 2 cm zu den Katalogmaßen, gebundene Platzierungen erscheinen und kollidieren nur mit Flag.
- `src/ui/socialViewModel.test.ts` (9): Dialogmodell (Name, Rolle, Stufe, nummerierte Antworten; Kundenzeilen, Summen, Bestandswarnung, Altersangaben), Journal (leer vor dem Spiel, nur bekannte Leute, nur aktueller Schritt bzw. Ausgang, keine rohen Erinnerungen), zurückhaltende Stufenhinweise.
- Weiter nicht automatisiert getestet sind die DOM-Panels selbst (Dialogpanel, Journal wie Kasse und Warenverwaltung) und das Rendering außerhalb der Browserprüfung; die Panels werden nur über die Browserprüfung berührt.

**Browserprüfung (Auftrag 04):** 149 Prüfungen in zwei Läufen nacheinander bestanden (1.287 s und 1.188 s, Headless-Chromium mit Software-Rendering). Davon 98 aus Auftrag 01–03 (unverändert grün; zwei Abschnitte zur Klappenmarkierung schicken die Bewohner vorher nach Hause und halten die Uhr an, weil ein Bewohner in Reichweite Vorrang vor Tür und Klappe hat) und 51 neue im Bewohner-Abschnitt (`--only residents`). Geprüft wird über die echte Oberfläche:
- Alle vier Bewohner erscheinen zu ihren Zeiten (der Würfel des gespeicherten Startwerts wird mit der Spiellogik gesucht), nie zwei auf einem Platz, nie in Wänden oder Möbeln; mindestens zwei laufen sichtbar über kollisionsfreie Wege.
- Hinweis „Mit … sprechen“, E und Klick öffnen das Gespräch, Tasten 1–n wählen, das Panel sperrt die Bewegung, Escape schließt ohne Folgen.
- Antworten ändern den gespeicherten Zustand (Beziehung, Erinnerung, Geschichte, Spielstand Schema 3); ein späterer Besuch zeigt die Erinnerung, auch nach Neuladen.
- Geschichte A mit den Ausgängen „Kompromiss“ (Bank erscheint und blockiert die Spielfigur) und „Derya“; Geschichte B mit den Ausgängen „Foto“ (Foto auf der Theke) und „abgelehnt“.
- Alle vier Bewohner äußern Wünsche; ein Verkauf ändert Kasse und Bestand genau einmal (doppeltes Drücken) und trägt die Bewohner-ID; Jonas (17) bekommt keinen Tabak, auch nicht nach der Ausweisprüfung.
- Neuladen mitten im Weg stellt Position, Weg, Routine, Beziehungen und Geschichte wieder her, die Routine läuft weiter.
- Notizbuch zeigt nur getroffene Personen und begonnene oder abgeschlossene Geschichten.
- Keine Konsolenfehler, WebGL-Kontext nie verloren.

**Screenshots aus der laufenden Anwendung (Auftrag 04):** neun Bilder unter `docs/screenshots/auftrag-04/` (Beschreibung je Bild in der dortigen `README.md`, für die Weitergabe an ChatGPT gedacht), alle angesehen: Bewohner im Viertel, Kunde am Fenster, Gespräch, Kundenwunsch, Altersgrenze (Jonas), Hofbank als Folge von Geschichte A, Foto als Folge von Geschichte B, Notizbuch, alle vier Figuren nebeneinander. Die Bilder aus Auftrag 01–03 werden von der Browserprüfung nicht mehr überschrieben.

**Render-Aufwand der Figuren:** Vier Figuren zusammen 123 Meshes (je ein Draw Call) und etwa 8.300 Dreiecke (gezählt in Vitest an den Fabriken, nicht in der Szene gemessen). In der Szene gemessen (`getRenderStats`, Innenansicht hinter der Theke, zwei Bewohner sichtbar, leere Regale): 336 Draw Calls und rund 28.600 Dreiecke – Messwert in Headless-Chromium mit Software-Rendering, keine Aussage über die Bildrate auf echter Hardware.

### Stand Auftrag 03 (2026-11-13, zur Einordnung)
Die Zahlen und Listen dieses Unterabschnitts gelten für den Stand nach Auftrag 03 (23 Dateien, 370 Tests; Browserprüfung 98 von 98 in 727 Sekunden). Die Phase-3-Tests laufen unverändert im heutigen Bestand mit.

**Automatisiert getestet mit Vitest (Stand Auftrag 03: 370 Tests, 23 Dateien; Dateien mit Auftrag-03-Bezug):**
- `src/game/economy.test.ts` (35): Startwerte, Bestellung (Kapitalprüfung bis auf den letzten Cent, genau eine offene Lieferung, Lagerkapazität inkl. reservierter Lieferung, gesperrt nach Tagesabschluss), Lieferung, Einräumen und Zurücknehmen (Lagerart, fremdes Produkt, Kapazität, Bestand), Verkauf (Buchungen, Atomarität, mehrere Plätze, nur Regalbestand, Klappe zu, Phasen), Alterskontrolle (gesperrt ohne, möglich mit Bestätigung, Ableitung nur aus Produktdaten, gemischter Warenkorb), Tagesbericht und Transaktionsgrenze, Invariante „Geld und Mengen bleiben nicht negative ganze Zahlen“ in einer langen Zufallssitzung.
- `src/game/clock.test.ts` (10): ein Spielminute je Sekunde, Pause, 2× und 4×, ungültige Zeitschritte, Begrenzung bei 22:00 mit riesigem Zeitschritt und genau ein Signal, kein automatischer Abschluss, Unabhängigkeit von Tür und Klappe, genau ein Tagesabschluss, vorzeitiger Abschluss, nächster Tag.
- `src/game/save/save.test.ts` (75): Rundlauf von Version 2, Migration 1→2 mit Erhalt von Position, Tür und Klappe, beschädigter Version-1-Stand, Wertebereiche, Verwerfen unbekannter Produkt- und Platz-IDs mit Warnungen, Kürzen auf geänderte Kapazität, kein Warenkorb im Spielstand.
- `src/game/stockLayout.test.ts` (7), `src/content/stock.test.ts` (21), `src/integration/stock-slots.test.ts` (68): Anordnung und Kapazität, Validierung von Produkten und Plätzen inkl. Fehlerfälle, Prüfung der Platzmaße gegen die echten Möbelfabriken (Auflage ±2 cm, freie Höhe), Erreichbarkeit der Interaktionspunkte.
- `src/integration/stock-view.test.ts` (11) und `content-world.test.ts` (8): Darstellung folgt dem Bestand (Einräumen, Verkauf, Zurücknehmen, Zustandswechsel), nichts bei leeren Plätzen, wenige Instanzen-Meshes bei vollem Kiosk, Spiegelung der Mittelregal-Rückseite, Hefte auf der geneigten Ablage, jedes der 28 Produktmodelle passt auf 2 cm zum Maß seines Assets (Pivot unten Mitte), Produkte einer Verpackungsart teilen nie ihren ganzen Materialsatz (eigene Etiketten).
- `src/ui/viewModel.test.ts` (16), `src/ui/format.test.ts` (6): Cent-Formatierung, Warenkorb- und Bestellsummen, Abbildung aller Ablehnungsgründe auf Texte, Altersangaben.
- `src/game/game.test.ts` (15), `interaction.test.ts` (5): Tür und Klappe unverändert, Kasse und Lager ändern keinen Zustand und senden `interaction.triggered`.
- Nicht automatisiert getestet sind die DOM-Panels selbst und das Rendering außerhalb der Browserprüfung; die Panels werden nur über die Browserprüfung (siehe unten) berührt.

**Browserprüfung (Auftrag 03):** 98 Prüfungen, davon 51 im neuen Wirtschaftsabschnitt und 47 in den übrigen Abschnitten (Bewegung, Kollision, Interaktion, Sichtfreistellung, Platzierungen, Screenshots). Die Wirtschaftsaktionen werden über die echte Oberfläche mit Klicks und Tasten ausgelöst; der Debug-Zugang dient nur zum Lesen des Zustands und zum Versetzen der Figur. Geprüft wird:
- HUD: Tag 1, 06:00 Uhr, Startkasse 300,00 €, Status folgt der Klappe.
- E am Lagerpunkt öffnet die Warenverwaltung; bei offenem Panel bewegt sich die Figur nicht; Escape schließt.
- Das HUD hat keine Schaltflächen für Kasse und Warenverwaltung; auf dem Gehweg und im Hof gibt es keinen Weg, sie zu öffnen; an Kasse und Lagerregal öffnen E und ein Klick auf den Hinweis das passende Panel; „Neues Spiel“ bzw. ein Zustandswechsel schließt ein offenes Panel.
- Wochentag im HUD: „Mo · Tag 1“, nach dem Tageswechsel „Di · Tag 2“.
- Bestellung: angezeigte Summe entspricht den Produktdaten; Kasse sinkt um genau die Summe; Bestellung über dem Kassenbestand und zweite Bestellung bei offener Lieferung werden sichtbar abgelehnt und ändern nichts.
- Lieferung annehmen: Lager entspricht der Bestellung.
- Einräumen: nur passende Produkte werden angeboten; Regalstände entsprechen den Daten; die 3D-Welt zeichnet je Platz genau so viele Einheiten wie im Bestand; der bestückte Innenraum unterscheidet sich im Bild deutlich vom leeren.
- Verkauf: bei geschlossener Klappe abgelehnt; Abbrechen ändert nichts; Verkauf ändert Kasse, Regalbestand, HUD und 3D-Bestand um genau die richtigen Beträge.
- Altersprüfung: ohne Häkchen abgelehnt, mit Häkchen möglich, Bestätigung wird nicht gemerkt.
- Uhr: Pause hält die Uhr bei laufender Simulation an; Vorspulen wirkt; die Tempo-Schaltflächen zeigen den Zustand.
- Tagesabschluss: Abrechnung stimmt mit den erwarteten Zahlen überein; kein zweiter Abschluss; nach Neuladen erscheint die Abrechnung wieder; nächster Tag beginnt um 06:00 Uhr ohne Geld- oder Warenänderung.
- 22:00 Uhr: Die Uhr bleibt stehen, der Hinweis erscheint genau einmal, es gibt keinen automatischen Abschluss.
- Savegame: Rundlauf im neuen Format; ein Spielstand im Format 1 lädt mit Position, Tür und Klappe und Anfangswerten der Wirtschaft und wird danach im Format 2 gespeichert.
- WebGL-Kontext geht nicht verloren, keine Konsolen- oder Seitenfehler.

Screenshots aus der laufenden Anwendung (Auftrag 03), alle angesehen:
- `docs/screenshots/auftrag-03-innen-bestueckt.png` – Innenraum mit bestückten Regalen, Kühlschrank, Zeitschriftenständer und Theke
- `docs/screenshots/auftrag-03-kasse.png` – Kasse mit Warenkorb und bestätigter Altersprüfung
- `docs/screenshots/auftrag-03-warenverwaltung.png` – Warenverwaltung, Reiter „Bestand"
- `docs/screenshots/auftrag-03-tagesabschluss.png` – Tagesabrechnung
- `docs/screenshots/auftrag-03-ansicht-{aussen,innen,rueckseite,seite}.png` – die vier Ansichten der Sichtfreistellung mit HUD

Für die Bilder mit Ware wurde der Spielstand über den Debug-Zugang vorbereitet (höherer Kassenbestand, breites Sortiment); sie zeigen deshalb keinen regulären Spielverlauf. Die Dateien `auftrag-01-*.png` und `auftrag-02-*.png` werden von der Browserprüfung nicht mehr überschrieben.

**Stand der Browserprüfung aus Auftrag 02 (2026-11-12, zur Einordnung):** 43 von 43 Prüfungen bestanden in Headless-Chromium mit Software-Rendering (ca. 26–29 Bilder/s). Sie deckte Bewegung, Kollision, Tür und Klappe, Platzierungen, Sichtfreistellung, Silhouette, Markierungen und Neuladen ab. Screenshots: `docs/screenshots/auftrag-02-aussen.png`, `auftrag-02-innen.png`, `auftrag-02-rueckseite.png`, `auftrag-02-seite.png`; `auftrag-01-*.png` zeigen den Stand der Greybox.

**Render-Aufwand:**
- Auftrag 02 (leerer Kiosk, Figur im Kiosk, `getRenderStats()` in der Browserprüfung): etwa 238 Draw Calls und 22.500 Dreiecke.
- Auftrag 03, vom implementierenden Agenten an einer Innenposition in Headless-Chromium mit Software-Rendering gemessen: leerer Kiosk 219 Draw Calls, etwa 21.000 Dreiecke, 14 Texturen; voll bestückt (1.513 Einheiten) 272 Draw Calls, etwa 452.000 Dreiecke, 40 Texturen. Das sind Messwerte der Szene an einer Position, keine Aussage über die Bildrate; auf echter Hardware wurde nichts gemessen.

**Schichtenregel:** In Auftrag 01 mit absichtlich falschen Testdateien geprüft, nach dem Eingriff in die Abhängigkeiten (Abschnitt 7) erneut. In Auftrag 03 wurde sie nicht erneut mit absichtlichen Verstößen geprüft; `npm run lint` meldet keine Verstöße.

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
| Auftrag 03 | `index-*.js` (Spielcode) | 161,94 kB | 54,37 kB |
| Auftrag 03 | `three-*.js` (Three.js) | 547,51 kB | 135,76 kB |
| Auftrag 03 | `index-*.css` | 9,77 kB | 2,59 kB |
| Auftrag 04 | `index-*.js` (Spielcode) | 286,12 kB | 94,92 kB |
| Auftrag 04 | `three-*.js` (Three.js) | 547,53 kB | 135,77 kB |
| Auftrag 04 | `index-*.css` | 10,97 kB | 2,81 kB |
| Auftrag 04 | `index.html` | 0,56 kB | 0,34 kB |

- Three.js liegt jetzt in einem eigenen Chunk (`vite.config.ts`). Die Gesamtmenge sinkt dadurch nicht; der Vorteil ist, dass der Browser den großen, selten geänderten Three.js-Chunk im Cache behält, wenn sich nur Spielcode ändert.
- Der Spielcode ist gegenüber Auftrag 02 von 84,89 kB auf 161,94 kB gewachsen (Wirtschaft, Uhr, Savegame v2, Produktdaten, Warenmodelle, Panels); die Größen stammen aus `npm run build` am 2026-11-13.
- Mit Auftrag 04 wächst der Spielcode von 161,94 kB auf 286,12 kB (Bewohner-Simulation, Dialogsystem, Inhalte mit 56 Dialogen, Savegame v3, Figurenfabriken, Panels); gemessen mit `npm run build` am 2026-11-14 (131 Module). Der Three.js-Chunk ist praktisch unverändert (547,53 kB).
- Vite warnt weiterhin wegen eines Chunks über 500 kB. Das ist Three.js selbst; die Anwendung braucht es beim Start vollständig. Ein Nachladen per `import()` würde den Start nur komplizierter machen und wurde deshalb nicht eingebaut. Die Warnschwelle wurde nicht angehoben.

## 9. Bekannte Einschränkungen
- **Nicht auf echter Grafikhardware und nicht in Firefox oder Safari geprüft.** Die Bildrate dort ist ungemessen; es wird keine Bildrate zugesagt. Die Schritte für diese Prüfung stehen in [PRUEFANLEITUNG-MANUELL.md](PRUEFANLEITUNG-MANUELL.md) und sind noch nicht durchgeführt.
- Die Klappenmarkierung auf der Fensterbank ist nur etwa 17 cm tief und in der Außenansicht entsprechend schmal; steht die Figur direkt davor, verdeckt ihr Kopf die Mitte.
- Die Silhouette schaltet an Gebäudeecken hart um (ganz sichtbar oder gar nicht), gedämpft durch eine kleine Hysterese.
- Die Sichtbarkeitsprüfungen für Figur und Markierung zählen Bildpunkte in bestimmten Farben. Das ist ein Näherungswert, kein Bildvergleich.
- Ein früherer Lauf der Browserprüfung brach einmal mit geschlossenem Browser ab. Die Ursache ließ sich nicht reproduzieren; das Skript meldet Absturz, Trennung und Kontextverlust jetzt ausdrücklich.
- Die Browserprüfung dauert mit Software-Rendering rund 11–12 Minuten.
- Der Ladepfad für externe GLB-Modelle (ADR-006) ist weiterhin ungetestet; alle Assets entstehen im Code.
- Die Browserprüfung löst das Speichern vor dem Neuladen selbst über ein `pagehide`-Ereignis aus. Ob der Browser dieses Ereignis beim Neuladen zuverlässig sendet, ist nicht separat belegt; das 10-Sekunden-Intervall fängt das ab.
- Die Straße ist nicht begehbar. Es gibt keine Höhenunterschiede und keine vertikale Kollision.
- Jenseits des Layouts liegt eine einfarbige Fläche im Dunst; es gibt noch keine Nachbarbebauung.
- Kein Layout-Editor: Möbel werden in `layout.ts` verschoben.
- Kein CI, kein Deployment, keine Lizenzdatei.

**Einschränkungen der Bewohner und Geschichten (Auftrag 04, jeweils im Code geprüft; Einzelheiten in [BEWOHNER-UND-GESCHICHTEN.md, Abschnitt 12](BEWOHNER-UND-GESCHICHTEN.md))**
- **Kunden warten bis zum Ende ihres Routinefensters,** solange die Verkaufsklappe offen ist; nur bei geschlossener Klappe gehen sie nach 30 Spielminuten mit der Erinnerung `kiosk-closed`.
- **Geschichtsgespräche entstehen nicht am Fenster, solange ein Bewohner mit offenem Wunsch wartet** (dann gilt das Kundengespräch); sie geschehen an Ecke, Hof und Werkstatt, bei gehenden Bewohnern oder bei geschlossener Klappe.
- **Behoben: vorzeitiges Schließen verbrauchte einmalige Gespräche.** Ein mit Escape geschlossenes Gespräch gilt nicht mehr als gesehen; erst eine Schlussantwort vermerkt es. Vorher konnte Günters `paket-bitte` Geschichte B unmöglich machen (Regressionstest vorhanden).
- **Rückfallebene gegen Verklemmung:** Als letzte Rettung (nach 20 s Blockade ohne Ausweichroute) gehen sich Bewohner untereinander durch. Wände, Möbel und der Spieler sind nie betroffen.
- **Laufzeitzähler sind nicht gespeichert:** Wartezeiten vor Blockaden, die Rückfallebene und der Tagescache der Würfe fehlen nach dem Laden; Entscheidungen bleiben gleich, das genaue Timing von Wartezeiten kann abweichen. Ein Gespräch wird nie gespeichert.
- **Erinnerungen sind einfache Kennungen;** das Journal zeigt nur Bekanntschaften, die aktuellen Schritte und Ausgänge der Geschichten und die Zahl erfüllter Wünsche. Nur sechs Erinnerungen steuern Gespräche.
- **Ohne Spielwirkung:** `likes`, `dislikes` und die Beziehungen der Bewohner zueinander; Beziehungen zum Spieler wirken nur auf Gespräche und die Vermittlungsoption, nicht auf Besuche, Preise oder Wünsche.
- **Der Ständer (`photo.stand`) hat kein eigenes Modell,** das Paket ist ein Zustand ohne sichtbaren Gegenstand, das Sägen eine Routine ohne Animation und Ton.
- **Nicht einmalige Folgegespräche ersetzen das einfache `moin`** ihres Bewohners dauerhaft, sobald ihre Bedingung gilt.
- **Die Validierung erkennt nicht, ob Gesprächsbedingungen je zusammen erfüllbar sind.**
- **Nur vier Bewohner;** N-004 und N-005 bleiben geplant; kein Bewohner betritt ein Gebäude.
- **Figurendetails sind aus der Spielkamera klein;** die Figuren unterscheiden sich über Silhouette, Größe und Farbe. Nicht in der Szene gemessen sind Draw Calls und Bildrate mit Bewohnern.
- **Nicht auf echter Grafikhardware und nicht in Firefox oder Safari geprüft** (auch nicht die Bewohner); die Schritte 32 bis 47 der Prüfanleitung wurden nicht von Hand ausgeführt.
- **Browserprüfung:** Die Browserprüfung dauert mit Software-Rendering rund 20 Minuten.

**Einschränkungen der Waren- und Wirtschaftsfunktionen (Auftrag 03, jeweils im Code geprüft)**
- **Keine Preisänderung durch den Spieler:** Verkauft wird zum vorgeschlagenen Verkaufspreis (`suggestedPriceCents`); es gibt kein `setPrice`.
- **Keine Nachfrage:** Es gibt weiter keine Laufkundschaft und keine Nachfrageberechnung; seit Auftrag 04 kaufen nur die vier Bewohner nach ihren Wünschen ein, ein Verkauf an der Kasse ist weiter ein expliziter Vorgang des Spielers. Die Nachfrage-Tags sind reine Daten ohne Wirkung.
- **Keine Kosten außer Einkäufen:** Es gibt weder Miete noch Personal, Strom oder Schwund; der Tagesbericht kennt nur Umsatz, Wareneinsatz und Einkäufe.
- **Lieferung sofort:** Es gibt weder Lieferzeit noch Lieferfahrzeug; Annahme ist ausdrücklich, eine zweite Bestellung erst danach möglich. Das Geld wird bei der Bestellung abgebucht, nicht bei der Annahme.
- **Lager ist ein Zähler:** höchstens 400 Stück insgesamt (`STORAGE_CAPACITY_UNITS`), ohne Platzbedarf je Produkt und ohne sichtbare Lagerware im Regal `I-011`.
- **Etiketten nur teilweise lesbar:** Bei normaler Spielkamera (1280×720) sind Hefte, Beutel, Schachteln und Eiswaren über Farbfeld und Emblem erkennbar; Wörter auf Beuteln sind nur bei doppelter Pixeldichte lesbar. Flaschen und Dosen sind nur 4–6 px breit, ihre Beschriftung ist nicht lesbar; sie unterscheiden sich über Farbteilung und Kronkorkenfarbe.
- **Volle Regale sind dreiecksreich** (etwa 452.000 Dreiecke bei 1.513 Einheiten, Messwert aus Abschnitt 6); die Leistung auf echter Grafikhardware ist ungemessen.
- **Verworfene Zeilen einer offenen Lieferung werden nicht erstattet:** Nach einer Inhaltsänderung entfernt das Laden unbekannte Produktzeilen einer offenen Lieferung ohne Rückbuchung des bereits abgebuchten Betrags.
- **Platzmaße gelten für Maßstab 1:** Kapazität und Validierung der Warenplätze ignorieren die Skalierung einer Platzierung (die Darstellung wendet sie an). Kein Asset ist derzeit skalierbar.
- **Zuordnung Rolle zu Lagerart je Rolle, nicht je Asset:** `STORAGE_KINDS_BY_ROLE` gilt für alle Möbel derselben Rolle.
- **Der Verkauf bucht nach Produkt, nicht nach Platz:** Der Warenkorb enthält Produkte; das Spiel nimmt die Ware aus den Plätzen in Inhaltsreihenfolge, der Spieler wählt keinen Platz.
- Chips (P-009, 27 cm hoch) passen nicht in die 26 cm hohen Plätze des Mittelregals; die Einräum-Ansicht bietet sie dort deshalb nicht an. In den Wandregalen passen 15 je Platz.
- **Spielzeit-Datum:** Es gibt nur einen Tageszähler. Der Wochentag wird daraus abgeleitet (Tag 1 = Montag, `WEEK_LENGTH` = 7) und nicht gespeichert; ein Kalenderdatum und eine Jahreszeit gibt es nicht.
- **Markennamen sind Arbeitstitel** und rechtlich nicht geprüft; vor einer Veröffentlichung ist eine Recherche nötig.
- **Die DOM-Panels haben keine eigenen Einzeltests;** sie werden nur durch die Browserprüfung abgedeckt, die in Headless-Chromium lief (die Ansichtsmodelle von Dialogpanel und Journal sind getestet).

## 10. Ist-/Soll-Abgleich
| Zielsystem | Status | Bemerkung |
|---|---|---|
| Core / Game Runtime | teilweise vorhanden | Loop, Signale, Log, Fassade, Spieluhr (O-3 umgesetzt), geseedeter Zufall (zustandslos aus dem Weltseed, `src/game/random.ts`); der Generator mit Zustand aus ADR-005 ist vorhanden, aber ungenutzt |
| Three.js World | teilweise vorhanden | Kiosk, Figur, Kamera, Kollision, Interaktion, Sichtfreistellung, 3D-Ware, vier Bewohner, flaggebundene Hofbank und Foto; keine Umgebung, kein Wetter |
| Kiosk und Einrichtung | vorhanden | Gebäude und neun Möbel modular, 67 Warenplätze |
| Produkte, Inventar, Warenwirtschaft | vorhanden (Basis) | 28 Produkte, Lager, Bestellung, Lieferung, Einräumen; keine Preisänderung, keine dynamischen Preise |
| Finanzen, Kasse, Tagesabschluss | vorhanden (Basis) | Kasse mit Warenkorb und Altersprüfung (O-4 umgesetzt), Tagesbericht; keine weiteren Kosten |
| NPCs, Routinen, Beziehungen | vorhanden (MVP) | vier Bewohner, Routinen auf Wegpunktgraph, Beziehung 0–100 mit vier Stufen, Erinnerungen, Kundenkäufe über `economy.completeSale`; nur vier Bewohner, keine Bedürfnissimulation, Vorlieben ohne Wirkung |
| Dialoge, Quests, Geschichten | vorhanden (MVP) | generisches Dialogsystem mit Bedingungen und Effekten, 56 Dialoge, zwei verknüpfte Geschichten mit 4 bzw. 2 Ausgängen, Journal; keine Editoren, keine Sprachausgabe |
| Kalender, Wetter, Events | teilweise vorhanden | Tageszähler, Uhr und abgeleiteter Wochentag (von den Routinen genutzt); kein Kalenderdatum, keine Jahreszeit, kein Wetter, keine Events (Phase 5) |
| Rezepte und Kiosk-Traditionen | nicht vorhanden | Phase 5 |
| UI | vorhanden (Basis) | HUD, Warenverwaltung, Kasse, Tagesabschluss, Dialogpanel mit Kundenansicht, Journal, Hinweise; kein Touch |
| Savegames und Datenmigration | vorhanden | Version 3, Migrationen 1→2 und 2→3, Verwerfen unbekannter IDs mit Warnung, Weltseed gespeichert |
| Audio | nicht vorhanden | Phase 6 |
| Regionale Content-Pakete | teilweise vorhanden | Ruhrgebiet mit Asset-Katalog, Platzierungen, Produkten, Warenplätzen, Wegpunktgraph, Bewohnern, Dialogen und Geschichten |

## 11. Unstimmigkeiten in der Konzeptdokumentation (unverändert offen)
- Der Katalog (`02`) nennt zehn NPC-Typen, das Register (`07`) führt nur N-001 bis N-007. Seit Auftrag 04 sind N-002, N-003, N-006 und N-007 umgesetzt; N-001 (Kioskbetreiber) bleibt die Spielerfigur (`playerFigure.ts`, im Register unverändert „Geplant“), N-004 und N-005 sind geplant.
- Erledigt in Auftrag 04: E-004 (Hofbank) ist im Register „Im Spiel integriert“; das gerahmte Kioskfoto hat die neue Asset-ID I-013 und steht jetzt im Register. Die Figuren-Asset-IDs N-0xx stehen nicht im Asset-Katalog (`catalog.ts`), nur im Register und in `NpcDef.assetId`; die Validierung prüft das Format `N-\d{3}`.
- Fahrradständer, Hausfassaden und Schilder haben keine Register-ID.
- Erledigt in Auftrag 03: P-001 bis P-028 stehen als Einzelzeilen im Register, P-029 und P-030 sind nicht vergeben.
- Der Bordstein hat keine eigene Asset-ID; er wird derzeit unter E-001 mitgebaut.
