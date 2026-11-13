# Technischer Ist-Stand

**Stand:** 2026-11-13 · nach [Auftrag 03](auftraege/03-waren-wirtschaftskreislauf-und-spieltag.md)

Dieses Dokument enthält nur geprüfte Fakten und trennt durchgehend **implementiert**, **automatisiert getestet** (Vitest, Headless-Browserprüfung) und **manuell geprüft** (nichts davon ist bisher geschehen). Entscheidungen stehen in [ARCHITEKTUR-ENTSCHEIDUNGEN.md](ARCHITEKTUR-ENTSCHEIDUNGEN.md), Verträge in [MODUL-UND-DATENVERTRAEGE.md](MODUL-UND-DATENVERTRAEGE.md), die Schritte für die Prüfung auf echter Grafikhardware in [PRUEFANLEITUNG-MANUELL.md](PRUEFANLEITUNG-MANUELL.md).

## 1. Kernaussage
Das Repository enthält eine startbare Three.js-Anwendung mit einem begehbaren, ausgestatteten Kiosk und einem **geschlossenen Wirtschaftskreislauf**: Der Spieler bestellt Ware bei einem fiktiven Großhandel, nimmt die Lieferung an, räumt sie in 67 Warenplätze ein, verkauft über die Kasse (mit echter Altersschranke für Bier und Tabakwaren) und schließt den Tag mit einer Abrechnung ab. Die Spielzeit läuft nach O-3 (1 Spielminute = 1 Sekunde, 06:00–22:00 Uhr, Pause, 1×/2×/4×). Die 28 fiktiven Produkte sind als 3D-Ware im Regal sichtbar und folgen dem Bestand. Der Spielstand ist auf Version 2 migriert (Version 1 bleibt ladbar).

Nicht vorhanden sind NPCs und Kunden, Preisänderungen, Nachfrage, Wetter, Events und Audio. Verkäufe sind ein expliziter Kassenvorgang des Spielers. Alle Prüfungen liefen in Headless-Chromium mit Software-Rendering; auf echter Grafikhardware und in Firefox oder Safari wurde nichts geprüft.

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
| `npm run check:browser` | baut, startet die Anwendung in Chromium, prüft sie mit echten Tastendrücken und schreibt Screenshots nach `docs/screenshots/` (Laufzeit in der Entwicklungsumgebung mit Software-Rendering: rund 11–12 Minuten); mit `-- --only economy` läuft nur der Wirtschaftsabschnitt |

`check:browser` braucht einen zu Playwright 1.63.0 passenden Chromium. Auf einem frischen Rechner einmalig `npx playwright install chromium` ausführen.

`node scripts/screenshot.mjs --out <png> --x <m> --z <m> [--heading] [--door open|closed] [--shutter open|closed]` erzeugt einen einzelnen Screenshot aus der laufenden Anwendung an einer vorgegebenen Position.

## 4. Struktur
```
index.html                     Einstieg, lädt src/main.ts
src/main.ts                    einzige Verdrahtung: Inhalt prüfen, Spielstand laden, Game/World/UI/Loop starten, Autosave, Fehleranzeige
src/core/                      loop.ts (fester Zeitschritt), signals.ts (typisierter Emitter), log.ts
src/game/                      game.ts (Fassade), state.ts (GameState v2), types.ts (Inhaltsverträge, Produkte, Warenplätze),
                               balance.ts (alle Balancing-Werte), clock.ts (Spieluhr), economy.ts (Bestellung, Einräumen, Verkauf, Tagesabschluss),
                               selectors.ts (lesende Hilfen), stockLayout.ts (Anordnung und Kapazität eines Warenplatzes), events.ts (Signale), domain.ts,
                               placement.ts (Grundfläche, Drehung, Vorderseite), colliders.ts, reachability.ts,
                               kioskGeometry.ts (Wandstücke, Schnitthöhe), rects.ts, constants.ts,
                               interaction.ts, result.ts, save/save.ts, testing/fixture-pack.ts
src/content/                   validate.ts, validateStock.ts (Produkte und Warenplätze), assets/{catalog,productAssets}.ts (Asset-Katalog, P-001 bis P-028),
                               regions/ruhrgebiet/{index,layout,products,slots}.ts (Kiosk, Platzierungsliste, Boden, Interaktionspunkte inkl. Kasse und Lager, 28 Produkte, 67 Warenplätze)
src/world/                     world.ts, renderer.ts, camera.ts, input.ts, collision.ts, colliders.ts, materials.ts,
                               occlusion.ts, occlusionRules.ts, playerFigure.ts
src/world/assets/              registry.ts (Asset-ID → Fabrik), ground.ts
src/world/assets/kiosk/        K-001 in Teilen: walls, roof, awning, salesWindow, door, signage, lighting, interior,
                               materials, textures
src/world/assets/products/     bottles, flat, food (Verpackungsfabriken), kit, labelTexture (Canvas-Etiketten), materials, index (Fabrik je Verpackungsart)
src/world/assets/furniture/    counter, register, wallShelf, middleShelf, fridge, freezer, magazineRack,
                               storageRack, crates, kit (Bauhilfe), materials, placeholder
src/world/views/               kioskView.ts (Tür-/Klappenanimation), markerView.ts, stockView.ts (Bestand als InstancedMesh), stockLayout.ts (Posen, Spiegelung, Neigung)
src/integration/               Tests des echten Inhaltspakets gegen die echten Fabriken
src/ui/                        ui.ts, hud.ts, modal.ts, panels/{goods,till,dayClose}.ts, viewModel.ts, format.ts, dom.ts, texts.ts, styles.css
scripts/                       browser-check.mjs, screenshot.mjs
docs/screenshots/              Screenshots aus der laufenden Anwendung
docs/PRODUKTKATALOG.md         Produktkatalog und Warenplätze aus den echten Daten
```
Tests liegen als `*.test.ts` neben dem Code.

## 5. Implementierte Funktionen
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
- Kompaktes HUD: Tag, Uhrzeit, Kassenstand, Status „Geöffnet/Geschlossen“ (aus der Verkaufsklappe abgeleitet), Pause/Weiter, Tempo 1×/2×/4×, **immer verfügbare Schaltflächen „Waren“ und „Kasse“**, „Tag abschließen“ (nach Abschluss „Abrechnung“) und ein Hinweis mit Schaltfläche, sobald es 22:00 ist.
- Panels (jeweils ein Modal über abgedunkeltem Hintergrund, Escape und „Schließen“ schließen, Tab bleibt im Dialog): Warenverwaltung mit vier Reitern (Bestand, Bestellen, Lieferung, Einräumen), Kasse mit Warenkorb und Altersprüfung, Bestätigung des Tagesabschlusses, Tagesabrechnung mit „Nächsten Tag beginnen“.
- Öffnen: „Waren“ und „Kasse“ über das HUD an jeder Stelle; zusätzlich mit E am Kassenpunkt (hinter der Theke neben der Kasse) bzw. am Lagerpunkt (vor dem Lagerregal) jeweils über die Interaktionspunkte `interaction.register` und `interaction.storage` (Kasse öffnet die Kasse, Lager die Warenverwaltung). Nach einem Neuladen in der Phase „closed“ öffnet sich die Abrechnung wieder.
- **Eingabesperre:** Solange ein Panel offen ist, ignoriert die Welt Bewegung und E und lässt gehaltene Tasten los (`world.setInputEnabled`). Die Uhr läuft dabei weiter.
- Die Oberfläche ändert keine Spielwerte: Warenkorb und Altersbestätigung leben nur im Panel, Aktionen laufen über die `Game`-Fassade, Ablehnungsgründe werden auf deutsche Texte abgebildet.

*3D-Ware*
- Zehn Verpackungsfabriken (Glasflasche, PET-Flasche, Dose, Beutel, Tafel, Schachtel, Stieleis, Eisbecher, Backware, Heft) bauen eine Einheit mit Pivot Bodenmitte und dem Maß des Produkt-Assets; Farbe, Beschriftung und Maße machen die 28 Produkte unterscheidbar.
- Etiketten sind Canvas-Texturen je Produkt (Farbband, Akzent, Beschriftung; Bier und Tabak schlicht ohne Zierformen). Flaschen und Dosen tragen Text nur formal; aus Kameraabstand sind es Farbblöcke (siehe Einschränkungen).
- Die Bestandsdarstellung (`stockView.ts`) zeichnet für jeden belegten Platz die ersten n Positionen aus `slotUnitPositions`, als `InstancedMesh` je Modellteil und Produkt, ohne Schatten. Leere Plätze bleiben leer. Aktualisierung nur bei `product.stock.changed` und `game.state.replaced`, nur für betroffene Produkte. Die Rückseite des Mittelregals ist gespiegelt, Hefte liegen geneigt auf den Ablagen des Ständers.

*Savegame*
- `schemaVersion` 2 (`GameState` um `calendar` und `economy` erweitert). Migration 1→2 setzt Anfangswerte (Tag 1, 06:00, Tempo 1×, Phase „open“, 300,00 €, leere Bestände) und lässt Position, Blickrichtung, Tür und Klappe unverändert.
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
- Kreis (Radius 0,3 m) gegen achsparallele Rechtecke mit Gleiten an Wänden; Grenzen des begehbaren Bereichs.
- Die Rechtecke entstehen aus den Wandstücken und aus der Platzierungsliste (`layoutColliders`).
- Die geschlossene Tür blockiert, die offene nicht.

**Sichtfreistellung (Auftrag 02 neu)**
- Figur im Kiosk: Das Dach wird ausgeblendet und die Südwand auf Brüstungshöhe (1,0 m) geschnitten, zusammen mit Schild, Markise, Klappe und oberem Türblatt. Ost- und Westwand werden nur geschnitten, wenn sie zwischen Kamera und Figur liegen. Die Nordwand bleibt stehen.
- Figur außen und vom Gebäude verdeckt (hinter oder neben dem Kiosk): Das Gebäude bleibt vollständig deckend, die Figur erscheint als flächige, türkisfarbene Silhouette.
- Die Silhouette erscheint nur, wenn das Gebäudevolumen zwischen Kamera und Brust oder Kopf der Figur liegt (`shouldShowSilhouette`). Im Kiosk und hinter Möbeln oder Kisten wird sie nicht gezeichnet; verdeckte Füße sind dort einfach verdeckt.
- Es gibt keine durchscheinenden Gebäudematerialien mehr.

**Interaktion**
- Vier Interaktionspunkte: Tür und Verkaufsklappe (öffnen/schließen) sowie Kasse und Lager (öffnen je ein Panel, ändern keinen Zustand). `game` meldet bei Kasse und Lager `interaction.triggered`. Die Markierungen von Kasse (flache Ellipse auf der Theke neben der Kasse) und Lager (Ring auf dem Boden vor dem Regal) kommen aus den Layoutdaten.
- `game` bestimmt den verfügbaren Punkt aus Spielerposition und Layout; die UI zeigt den Prompt, die Welt eine Markierung.
- Die Markierung der Klappe liegt als flacher Streifen auf der äußeren Fensterbank (Position und Maße aus den Layoutdaten, `marker.radius`/`radiusZ`). Sie ist von außen und innen bei offener und geschlossener Klappe sichtbar.
- Der schwebende Marker der Tür sitzt oberhalb der Tafel „Trinkhalle"; seine Höhe wird aus der Lage der Tafel abgeleitet.
- Auslösen mit E oder Mausklick auf den Prompt. Tür und Klappe sind animiert.

**UI**
- Steuerungshinweis, Interaktionsprompt, Meldungen, Schaltfläche „Neues Spiel" (zweiter Klick bestätigt), sichtbare Fehleranzeige bei Start- oder Laufzeitfehlern; HUD und Panels siehe oben.
- Alle Spieltexte in `src/ui/texts.ts`.

**Speichern und Laden (Grundlagen aus Auftrag 01, Erweiterung siehe oben)**
- JSON mit `schemaVersion` in `localStorage` unter `buedchensim.save.slot1`; Laden beim Start.
- Strenge Prüfung beim Laden. Ein unlesbarer oder zu neuer Spielstand wird nach `buedchensim.save.slot1.backup` kopiert, dann startet ein neues Spiel mit Hinweis.
- Die Migrationskette enthält seit Auftrag 03 die Migration 1→2.

## 6. Prüfergebnisse (2026-11-13)
Strikte Trennung: **implementiert** ist in Abschnitt 5 beschrieben, **automatisiert getestet** steht hier, **manuell geprüft** wurde nichts (siehe Abschnitt 9).

| Befehl | Ergebnis |
|---|---|
| `npm run typecheck` | fehlerfrei |
| `npm run lint` | fehlerfrei |
| `npm run test` | 22 Dateien, 367 Tests bestanden (eigener Lauf am 2026-11-13) |
| `npm run build` | erfolgreich, Größen siehe Abschnitt 8 |
| `npm run check:browser` | 90 von 90 Prüfungen bestanden (eigener Lauf 2026-11-13, 683 Sekunden; davor zwei grüne Läufe des umsetzenden Subagenten) |
| `npm audit` | 0 Hinweise am 2026-11-12; am 2026-11-13 nicht erneut ausgeführt |

**Automatisiert getestet mit Vitest (367 Tests, 22 Dateien; Dateien mit Auftrag-03-Bezug):**
- `src/game/economy.test.ts` (35): Startwerte, Bestellung (Kapitalprüfung bis auf den letzten Cent, genau eine offene Lieferung, Lagerkapazität inkl. reservierter Lieferung, gesperrt nach Tagesabschluss), Lieferung, Einräumen und Zurücknehmen (Lagerart, fremdes Produkt, Kapazität, Bestand), Verkauf (Buchungen, Atomarität, mehrere Plätze, nur Regalbestand, Klappe zu, Phasen), Alterskontrolle (gesperrt ohne, möglich mit Bestätigung, Ableitung nur aus Produktdaten, gemischter Warenkorb), Tagesbericht und Transaktionsgrenze, Invariante „Geld und Mengen bleiben nicht negative ganze Zahlen“ in einer langen Zufallssitzung.
- `src/game/clock.test.ts` (10): ein Spielminute je Sekunde, Pause, 2× und 4×, ungültige Zeitschritte, Begrenzung bei 22:00 mit riesigem Zeitschritt und genau ein Signal, kein automatischer Abschluss, Unabhängigkeit von Tür und Klappe, genau ein Tagesabschluss, vorzeitiger Abschluss, nächster Tag.
- `src/game/save/save.test.ts` (75): Rundlauf von Version 2, Migration 1→2 mit Erhalt von Position, Tür und Klappe, beschädigter Version-1-Stand, Wertebereiche, Verwerfen unbekannter Produkt- und Platz-IDs mit Warnungen, Kürzen auf geänderte Kapazität, kein Warenkorb im Spielstand.
- `src/game/stockLayout.test.ts` (7), `src/content/stock.test.ts` (21), `src/integration/stock-slots.test.ts` (68): Anordnung und Kapazität, Validierung von Produkten und Plätzen inkl. Fehlerfälle, Prüfung der Platzmaße gegen die echten Möbelfabriken (Auflage ±2 cm, freie Höhe), Erreichbarkeit der Interaktionspunkte.
- `src/integration/stock-view.test.ts` (11) und `content-world.test.ts` (8): Darstellung folgt dem Bestand (Einräumen, Verkauf, Zurücknehmen, Zustandswechsel), nichts bei leeren Plätzen, wenige Instanzen-Meshes bei vollem Kiosk, Spiegelung der Mittelregal-Rückseite, Hefte auf der geneigten Ablage, jedes der 28 Produktmodelle passt auf 2 cm zum Maß seines Assets (Pivot unten Mitte), Produkte einer Verpackungsart teilen nie ihren ganzen Materialsatz (eigene Etiketten).
- `src/ui/viewModel.test.ts` (16), `src/ui/format.test.ts` (6): Cent-Formatierung, Warenkorb- und Bestellsummen, Abbildung aller Ablehnungsgründe auf Texte, Altersangaben.
- `src/game/game.test.ts` (15), `interaction.test.ts` (5): Tür und Klappe unverändert, Kasse und Lager ändern keinen Zustand und senden `interaction.triggered`.
- Nicht automatisiert getestet sind die DOM-Panels selbst und das Rendering außerhalb der Browserprüfung; die Panels werden nur über die Browserprüfung (siehe unten) berührt.

**Browserprüfung (Auftrag 03):** 90 Prüfungen, davon 43 im neuen Wirtschaftsabschnitt und 47 in den übrigen Abschnitten (Bewegung, Kollision, Interaktion, Sichtfreistellung, Platzierungen, Screenshots). Die Wirtschaftsaktionen werden über die echte Oberfläche mit Klicks und Tasten ausgelöst; der Debug-Zugang dient nur zum Lesen des Zustands und zum Versetzen der Figur. Geprüft wird:
- HUD: Tag 1, 06:00 Uhr, Startkasse 300,00 €, Status folgt der Klappe.
- E am Lagerpunkt öffnet die Warenverwaltung; bei offenem Panel bewegt sich die Figur nicht; Escape schließt.
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

- Three.js liegt jetzt in einem eigenen Chunk (`vite.config.ts`). Die Gesamtmenge sinkt dadurch nicht; der Vorteil ist, dass der Browser den großen, selten geänderten Three.js-Chunk im Cache behält, wenn sich nur Spielcode ändert.
- Der Spielcode ist gegenüber Auftrag 02 von 84,89 kB auf 161,94 kB gewachsen (Wirtschaft, Uhr, Savegame v2, Produktdaten, Warenmodelle, Panels); die Größen stammen aus `npm run build` am 2026-11-13.
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

**Einschränkungen der Waren- und Wirtschaftsfunktionen (Auftrag 03, jeweils im Code geprüft)**
- **Keine Preisänderung durch den Spieler:** Verkauft wird zum vorgeschlagenen Verkaufspreis (`suggestedPriceCents`); es gibt kein `setPrice`.
- **Keine Kunden und keine Nachfrage:** Verkäufe sind ein expliziter Kassenvorgang des Spielers. Die Nachfrage-Tags sind reine Daten ohne Wirkung.
- **Keine Kosten außer Einkäufen:** Es gibt weder Miete noch Personal, Strom oder Schwund; der Tagesbericht kennt nur Umsatz, Wareneinsatz und Einkäufe.
- **Lieferung sofort:** Es gibt weder Lieferzeit noch Lieferfahrzeug; Annahme ist ausdrücklich, eine zweite Bestellung erst danach möglich. Das Geld wird bei der Bestellung abgebucht, nicht bei der Annahme.
- **Lager ist ein Zähler:** höchstens 400 Stück insgesamt (`STORAGE_CAPACITY_UNITS`), ohne Platzbedarf je Produkt und ohne sichtbare Lagerware im Regal `I-011`.
- **Kasse und Waren überall bedienbar:** Die HUD-Schaltflächen „Waren“ und „Kasse“ öffnen die Panels an jeder Stelle, auch außerhalb des Kiosks; die Interaktionspunkte sind eine zusätzliche Möglichkeit. Verkauf und Bestellung sind nicht an die Position der Figur gebunden (verkauft werden kann nur bei geöffneter Verkaufsklappe).
- **Etiketten unlesbar aus Kameraabstand:** Die Beschriftung auf Flaschen und Dosen ist zu klein und erscheint als Farbblöcke; lesbar ist sie vor allem auf Heften und Beuteln. Die Produkte unterscheiden sich über Farben, Form und Maße.
- **Volle Regale sind dreiecksreich** (etwa 452.000 Dreiecke bei 1.513 Einheiten, Messwert aus Abschnitt 6); die Leistung auf echter Grafikhardware ist ungemessen.
- **Verworfene Zeilen einer offenen Lieferung werden nicht erstattet:** Nach einer Inhaltsänderung entfernt das Laden unbekannte Produktzeilen einer offenen Lieferung ohne Rückbuchung des bereits abgebuchten Betrags.
- **Platzmaße gelten für Maßstab 1:** Kapazität und Validierung der Warenplätze ignorieren die Skalierung einer Platzierung (die Darstellung wendet sie an). Kein Asset ist derzeit skalierbar.
- **Zuordnung Rolle zu Lagerart je Rolle, nicht je Asset:** `STORAGE_KINDS_BY_ROLE` gilt für alle Möbel derselben Rolle.
- **Der Verkauf bucht nach Produkt, nicht nach Platz:** Der Warenkorb enthält Produkte; das Spiel nimmt die Ware aus den Plätzen in Inhaltsreihenfolge, der Spieler wählt keinen Platz.
- Chips (P-009, 27 cm hoch) passen nicht in die 26 cm hohen Plätze des Mittelregals; die Einräum-Ansicht bietet sie dort deshalb nicht an. In den Wandregalen passen 15 je Platz.
- **Spielzeit-Datum:** Es gibt nur einen Tageszähler, keinen Wochentag und kein Kalenderdatum.
- **Markennamen sind Arbeitstitel** und rechtlich nicht geprüft; vor einer Veröffentlichung ist eine Recherche nötig.
- **Die DOM-Panels haben keine eigenen Einzeltests;** sie werden nur durch die Browserprüfung abgedeckt, die in Headless-Chromium lief.

## 10. Ist-/Soll-Abgleich
| Zielsystem | Status | Bemerkung |
|---|---|---|
| Core / Game Runtime | teilweise vorhanden | Loop, Signale, Log, Fassade, Spieluhr (O-3 umgesetzt); kein geseedeter Zufall |
| Three.js World | teilweise vorhanden | Kiosk, Figur, Kamera, Kollision, Interaktion, Sichtfreistellung, 3D-Ware; keine Umgebung, kein Wetter |
| Kiosk und Einrichtung | vorhanden | Gebäude und neun Möbel modular, 67 Warenplätze |
| Produkte, Inventar, Warenwirtschaft | vorhanden (Basis) | 28 Produkte, Lager, Bestellung, Lieferung, Einräumen; keine Preisänderung, keine dynamischen Preise |
| Finanzen, Kasse, Tagesabschluss | vorhanden (Basis) | Kasse mit Warenkorb und Altersprüfung (O-4 umgesetzt), Tagesbericht; keine weiteren Kosten |
| NPCs, Routinen, Beziehungen | nicht vorhanden | Phase 4; Verkaufsdomäne `economy.completeSale` ist dafür vorbereitet |
| Dialoge, Quests, Geschichten | nicht vorhanden | Phase 4 |
| Kalender, Wetter, Events | teilweise vorhanden | Tageszähler und Uhr; kein Wochentag, keine Jahreszeit, kein Wetter, keine Events (Phase 5) |
| Rezepte und Kiosk-Traditionen | nicht vorhanden | Phase 5 |
| UI | vorhanden (Basis) | HUD, Warenverwaltung, Kasse, Tagesabschluss, Hinweise; kein Touch |
| Savegames und Datenmigration | vorhanden | Version 2, Migration 1→2, Verwerfen unbekannter IDs |
| Audio | nicht vorhanden | Phase 6 |
| Regionale Content-Pakete | teilweise vorhanden | Ruhrgebiet mit Asset-Katalog, Platzierungen, Produkten und Warenplätzen |

## 11. Unstimmigkeiten in der Konzeptdokumentation (unverändert offen)
- Der Katalog (`02`) nennt zehn NPC-Typen, das Register (`07`) führt nur N-001 bis N-007.
- Fahrradständer, Hausfassaden und Schilder haben keine Register-ID.
- Erledigt in Auftrag 03: P-001 bis P-028 stehen als Einzelzeilen im Register, P-029 und P-030 sind nicht vergeben.
- Der Bordstein hat keine eigene Asset-ID; er wird derzeit unter E-001 mitgebaut.
