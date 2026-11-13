# BuedchenSim – verbindlicher Implementierungsplan für Claude Code + Three.js

Dieser Plan ist die operative Reihenfolge für die Entwicklung. Er ist als Arbeitsauftrag zu verstehen, nicht als lose Ideensammlung. Claude Code muss jede Phase gegen den realen Repository-Stand prüfen und darf keine nicht vorhandene Technik voraussetzen.

## Grundregeln vor Phase 1
- `/CLAUDE.md` und die verlinkten Projektdokumente lesen.
- Repository vollständig untersuchen: Entry Points, package scripts, Three.js-Version, Szenen, Kamera, Controls, UI, Asset-Lader, Datenhaltung, Tests und Build.
- Noch nichts großflächig umbauen. Zuerst einen Bestandsbericht und eine auf den Ist-Zustand angepasste Aufgabenliste erstellen.
- Jede Phase in kleine PR-artige Änderungen gliedern; nach jedem Schritt starten und testen.

## Phase 0 – Technische Bestandsaufnahme
**Ziel:** wissen, was tatsächlich vorhanden ist.

Aufgaben:
1. Repository- und Ordnerstruktur erfassen.
2. Laufzeit, Frameworks, Three.js-Version und Start-/Build-Skripte identifizieren.
3. Vorhandene Szene, Kamera, Licht, Steuerung, Interaktion, Kollision und UI prüfen.
4. Asset-Pipeline, Dateiformate und Ladepfade prüfen.
5. Vorhandene Spielfunktionen und technische Schulden benennen.
6. Zielbild aus `docs/ARCHITEKTUR-ZIELBILD.md` auf die reale Codebasis abbilden.
7. Modulgrenzen, Abhängigkeitsregeln, Datenverträge, Eventkommunikation und Savegame-Versionierung konzipieren.
8. Minimalen Architektur-Unterbau für die ersten Gameplay-Module festlegen und offene Architekturentscheidungen als ADR dokumentieren.

**Abnahme:** dokumentierter Ist-Zustand, Startanleitung, Risiken, Modul-/Abhängigkeitsübersicht, minimale Schnittstellenplanung und priorisierte Umsetzungsschritte. In dieser Phase keine unnötigen Codeänderungen. Das Ziel ist eine tragfähige Struktur für spätere Features, nicht die sofortige Implementierung aller Systeme.

## Phase 1 – Spielbarer Kern und Greybox
**Ziel:** eine begehbare, testbare Kiosk-Grundszene.

**Anpassung nach Auftrag 00 (2026-11-11):** Das Repository enthielt keinen Code. Phase 1 beginnt deshalb mit dem Projektgerüst und dem minimalen Fundament aus `docs/MODUL-UND-DATENVERTRAEGE.md` (Abschnitte 11 und 12). Formulierungen wie „bestehende Szene" beziehen sich ab hier auf dieses Fundament. Voraussetzung: Entscheidungen O-1 und O-2 aus `docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md`.

Aufgaben:
0. Projektgerüst (Vite, TypeScript, Three.js, Lint, Tests) und Schichten `core`, `game`, `content`, `world`, `ui` anlegen; Maßstab 1 Unit = 1 Meter, Y nach oben festschreiben.
1. Maßstab und Koordinatensystem der bestehenden Szene feststellen.
2. Kiosk-Greybox mit Außenkörper, Verkaufsöffnung, Eingang, Dach und Innenraum bauen.
3. Gehweg und kleinen Außenbereich ergänzen.
4. Kamera, Spielerbewegung und Interaktionsabstände abstimmen.
5. Kollisionen und einfache Interaktionspunkte integrieren, sofern die bestehende Architektur sie vorsieht.

**Abnahme:** Szene startet stabil; Spieler kann den relevanten Bereich erkunden; Kiosk und Laufwege sind räumlich verständlich.

**Status (2026-11-11): abgeschlossen mit Auftrag 01.** Typecheck, Lint, 96 Tests, Build und die Browserprüfung (19 von 19) sind grün; Screenshots liegen unter `docs/screenshots/`. Details und Einschränkungen: `docs/TECHNISCHER-IST-STAND.md`.

Offene Restpunkte, die in Phase 2 mitgenommen werden:
- Darstellung, wenn die Figur hinter dem Kiosk steht (derzeit durchscheinender Kasten).
- Markierung der Verkaufsklappe liegt im Thekenvolumen.
- Prüfung auf echter Grafikhardware und in weiteren Browsern.
- Layout von festen Rechtecken auf eine verschiebbare Platzierungsliste umstellen, sobald Einrichtung modular wird.

## Phase 2 – Kiosk als modularer 3D-Ort
**Ziel:** das erste Ruhrgebiets-Büdchen bekommt seine erkennbare Identität.

**Nächster konkreter Auftrag:** [Auftrag 02 – Modularer Kiosk und Einrichtung](auftraege/02-modularer-kiosk-und-einrichtung.md). Er umfasst auch die technische Nachpflege aus Auftrag 01 (npm audit, Build-Größe und Darstellungs-Restpunkte).

Aufgaben:
1. Gebäude, Fassade, Markise, Verkaufsfenster, Tür, Dach und fiktive Beschilderung ausarbeiten.
2. Theke, Kasse, Wandregal, Mittelregal, Kühlschrank, Eistruhe, Zeitschriftenständer, Lager und Leergutbereich modular umsetzen.
3. Beleuchtung und Materialien für die Spielkamera optimieren.
4. Assets mit IDs, Maßen, Pivot und Dateipfaden dokumentieren.

**Abnahme:** ein stimmiger, modularer Kiosk, dessen wichtige Bereiche in der Spielansicht lesbar sind.

**Status (2026-11-12): umgesetzt mit Auftrag 02.** Einzelheiten und Prüfergebnisse stehen in [TECHNISCHER-IST-STAND.md](TECHNISCHER-IST-STAND.md).
- Umgesetzt und geprüft: Gebäude `K-001` in Teilen, neun Einrichtungs-Assets (`I-001` bis `I-007`, `I-011`, `I-012`), Asset-Katalog und versionierte Platzierungsliste mit Validierung, neue Sichtfreistellung, Klappenmarkierung am Verkaufsfenster, `npm audit` ohne Hinweise, Three.js als eigener Build-Chunk.
- Die Restpunkte aus Phase 1 zu Sichtfreistellung, Klappenmarkierung und Platzierungsliste sind damit erledigt.

Offene Restpunkte:
- Prüfung auf echter Grafikhardware und in Firefox/Safari nach [PRUEFANLEITUNG-MANUELL.md](PRUEFANLEITUNG-MANUELL.md) ist noch nicht durchgeführt.
- Erledigt in der Nacharbeit vom 2026-11-12: Klappenmarkierung liegt auf der äußeren Fensterbank, Türmarker sitzt über der Tafel, Silhouette erscheint nur bei Verdeckung durch das Gebäude.
- Gehweg und Straße (`E-001`, `E-002`) sind weiterhin Greybox; Umgebung folgt in Phase 6.
- Regale und Kühlgeräte sind leer; Waren folgen in Phase 3. (Erledigt mit Auftrag 03, siehe unten.)
- O-3 (Zeitmodell) und O-4 (Alkohol und Tabak) sind am 2026-11-12 entschieden, siehe [ARCHITEKTUR-ENTSCHEIDUNGEN.md](ARCHITEKTUR-ENTSCHEIDUNGEN.md); die Umsetzung gehört zu Phase 3.

## Phase 3 – Wirtschaftlicher Büdchen-Alltag und erste Produkte
**Ziel:** ein geschlossener Gameplay-Loop: Waren einkaufen, Lieferung annehmen, einräumen, verkaufen und den Tag abrechnen. Die beschlossenen Entscheidungen O-3 (Spielzeit) und O-4 (Alkohol/Tabak) werden in dieser Phase umgesetzt.

**Konkreter Auftrag:** [Auftrag 03 – Waren, Wirtschaftskreislauf und Spieltag](auftraege/03-waren-wirtschaftskreislauf-und-spieltag.md).

Umfang:
1. 20–30 originäre, fiktive Produkte mit stabilen IDs, Preisen in Integer-Cent, Kategorien, Lageranforderungen und Asset-Zuordnung.
2. Warenmodelle und sichtbare Bestückung von Regalen, Kühlschrank, Eistruhe, Pressebereich und Theke.
3. Einkauf, Bestellung, Lieferung und Lagerbestand.
4. Einräumen/Nachfüllen mit passenden Lager- und Präsentationsplätzen sowie Kapazitätsprüfung.
5. Kassenoberfläche, Warenkorb, Verkauf, Geld-/Bestandsbuchung und Transaktionshistorie.
6. Altersprüfung für fiktives Bier und fiktive Tabakwaren als verbindliche Verkaufsschranke.
7. Spieluhr: 1 Spielminute = 1 Sekunde, 06:00–22:00 Uhr, Pause, Vorspulen und Tagesabschluss.
8. Savegame-Schema erweitern und bestehende Version-1-Spielstände migrieren.

**Abgrenzung:** Noch keine NPC-KI oder Kundenroutinen, Dialoge, Beziehungen, Quests, Wetter, Events oder dynamische Nachfrage. Verkäufe erfolgen zunächst über einen expliziten Kassenablauf; die Verkaufsdomäne wird so gebaut, dass Phase 4 sie mit NPC-Kunden verwenden kann.

**Abnahme:** Der Spieler kann in der laufenden Anwendung Ware bestellen, erhalten, einräumen und verkaufen. Geld und Bestände bleiben konsistent; altersbeschränkte Waren sind ohne bestätigte Altersprüfung gesperrt. Die Spieluhr ist pausierbar/vorspulbar, Tagesabschluss und Savegame-Migration funktionieren.

**Status (2026-11-13): umgesetzt mit Auftrag 03.** O-3 und O-4 sind in [ARCHITEKTUR-ENTSCHEIDUNGEN.md](ARCHITEKTUR-ENTSCHEIDUNGEN.md) entschieden und umgesetzt. Einzelheiten, Prüfergebnisse und Einschränkungen: [TECHNISCHER-IST-STAND.md](TECHNISCHER-IST-STAND.md); Verträge: [MODUL-UND-DATENVERTRAEGE.md, Abschnitt 15](MODUL-UND-DATENVERTRAEGE.md); Katalog: [PRODUKTKATALOG.md](PRODUKTKATALOG.md).
- Umgesetzt: 28 fiktive Produkte (`P-001` bis `P-028`) mit 3D-Modellen und Etiketten, 67 Warenplätze mit geometrischer Kapazität, Hinterlager, Bestellung mit sofort eintreffender, ausdrücklich anzunehmender Lieferung, Einräumen und Zurücknehmen, Kasse mit Warenkorb, Transaktionen und Alterskontrolle als Verkaufsschranke, Spieluhr (1 Minute = 1 Sekunde, 06:00–22:00, Pause, 1×/2×/4×, Halt bei 22:00 bis zum ausdrücklichen Abschluss), Tagesabrechnung, HUD und Panels (Kasse nur am Kassenpunkt, Warenverwaltung nur am Lagerpunkt; keine HUD-Schaltflächen dafür), abgeleiteter Wochentag im HUD (Tag 1 = Montag, nicht gespeichert), sichtbarer Bestand im Regal, Savegame Version 2 mit Migration 1→2.
- Automatisiert getestet: 370 Tests in 23 Dateien (eigener Lauf 2026-11-13); Browserprüfung in Headless-Chromium: 98 von 98 Prüfungen bestanden (eigener Lauf 2026-11-13 nach der Nacharbeit). Manuell auf echter Grafikhardware: nicht geprüft.

Offene Restpunkte aus Phase 3:
- Keine Preisänderung durch den Spieler (Verkauf zum vorgeschlagenen Preis); keine Kosten außer Einkäufen; Lieferung ohne Wartezeit; Lager nur als Zähler (400 Stück).
- Etiketten nur teilweise lesbar: Flaschen und Dosen (4–6 px breit) aus Kameraabstand nicht lesbar, Wörter auf Beuteln nur bei doppelter Pixeldichte; Emblem, Farbfeld und Kronkorkenfarbe tragen die Unterscheidung. Volle Regale sind dreiecksreich (Messwert 452.000 Dreiecke bei 1.513 Einheiten), Leistung auf echter Hardware ungemessen.
- Verworfene Lieferzeilen nach Inhaltsänderungen werden nicht erstattet; Platzmaße ignorieren Platzierungsskalierung; Rolle→Lagerart je Rolle statt je Asset.
- Markennamen sind Arbeitstitel und rechtlich nicht geprüft.
- Prüfung auf echter Grafikhardware und in Firefox/Safari nach [PRUEFANLEITUNG-MANUELL.md](PRUEFANLEITUNG-MANUELL.md), nun auch für den Wirtschaftskreislauf, steht aus.

**Grundlage für Phase 4:** `economy.completeSale` ist die Verkaufsdomäne, die NPC-Kunden später wie der Kassenablauf aufrufen können (Bestand, Altersschranke, Phase und Klappe werden dort geprüft); `day.started`, `day.ended`, `sale.completed` und `product.stock.changed` sind vorhanden; die Uhr läuft deterministisch über `game.tick`, der Spielstand ist versioniert und migrierbar; die Nachfrage-Tags der Produkte stehen als Daten bereit. Der Wochentag ist als Ableitung aus dem Tageszähler vorhanden (`weekdayOf`, `WEEK_LENGTH` = 7, nicht gespeichert). Für Phase 4 fehlen noch geseedeter Zufall und eine Kunden- bzw. Besuchslogik; Kalender mit Datum und Jahreszeiten kommt eher mit Phase 5.

## Phase 4 – Bewohner und soziale Bindung (MVP)
**Ziel:** das Viertel bekommt wiederkehrende Menschen und der Kiosk eine soziale Identität.

Aufgaben:
1. Drei bis fünf wiederkehrende NPCs mit stabilen IDs, Profilen, Tagesrhythmen, Vorlieben und Besuchszeiten anlegen.
2. NPC-Bewegung und Aufenthaltsorte in der Three.js-Welt integrieren.
3. Dialoge mit Bedingungen und gespeicherten Erinnerungs-/Quest-Flags ergänzen.
4. Einfaches Beziehungssystem mit verständlichen Reaktionen entwickeln.
5. Mindestens zwei kleine Alltagsgeschichten/Quest-Ketten umsetzen.
6. Mindestens eine sichtbare oder spielerisch wirksame Konsequenz aus einer sozialen Handlung zeigen.

**Abnahme:** Bewohner tauchen wiedererkennbar auf; Gespräche und Entscheidungen verändern gespeicherte Weltzustände; das System fühlt sich nicht wie ein isoliertes Quest-Menü an.

## Phase 5 – Events, Wetter und Kiosk-Traditionen
**Ziel:** Ereignisse verbinden Wirtschaft, Menschen und Jahreszeiten.

Aufgaben:
1. Kleinen Kalender für Datum, Jahreszeiten und besondere Termine einführen, passend zur bestehenden Zeitlogik; der Wochentag ist als Ableitung bereits vorhanden.
2. Mindestens ein Event (z. B. Spieltag oder Straßenfest) mit Vorbereitung, Durchführung und Nachwirkung umsetzen.
3. Wetter bzw. Temperatur mit Waren-Nachfrage und NPC-Verhalten verbinden.
4. Eine eigene Kiosk-Spezialität als entstehende Tradition implementieren – beispielsweise selbstgemachte Frikadellen: Rezept/Herstellung, Kosten, Angebot, Feedback und wiederkehrende Nachfrage.
5. Belohnungen nicht nur monetär gestalten: Vertrauen, Stammkunden, Rezept, Dekoration oder neue Begegnungen.

**Abnahme:** ein Event verändert sichtbar den Kiosk-Alltag; mindestens ein soziales Ereignis hat wirtschaftliche und erzählerische Folgen.

## Phase 6 – Viertel und Atmosphäre
**Ziel:** das Umfeld macht den Ort glaubwürdig.

Aufgaben:
- Straße, Bordstein, Gehweg, Laterne, Bank, Mülleimer, Fahrrad, Bäume, Nachbargebäude und kleine Alltagsrequisiten ergänzen.
- NPCs mit dem Raum interagieren lassen (warten, sitzen, reden, einkaufen).
- Tageszeit, Licht, Sound und dezente Umgebungsanimationen ergänzen.
- Sichtbare Veränderungen durch Spielerhandlungen berücksichtigen.

**Abnahme:** der Kiosk wirkt wie ein belebter Ort in einem zusammenhängenden Viertel.

## Phase 7 – Stabilisierung und Ausbau
**Ziel:** den Vertical Slice absichern und für Content-Erweiterung vorbereiten.

Aufgaben:
- Performance, Ladezeiten, Speicherverbrauch und Draw Calls prüfen.
- Speichern/Laden aller relevanten Zustände testen.
- Fehlerfälle, leere Bestände, abgelehnte Quests und verpasste Events behandeln.
- Asset-Register und technische Dokumentation aktualisieren.
- Erst nach stabilem Ruhrgebiets-Slice weitere Regionen (Berlin, Rheinland, Norddeutschland) als eigenständige Pakete planen.

**Abnahme:** reproduzierbarer Spielstand, dokumentierter Startprozess, getesteter Kernloop und nachvollziehbarer nächster Ausbau.

## Definition of Done für jede Phase
- Funktion läuft in der tatsächlichen Three.js-Anwendung.
- Kein reiner Platzhalter, wenn eine echte Funktion gefordert ist.
- Keine neuen Marken- oder Lizenzverstöße.
- Keine Regression der vorhandenen Funktionen.
- Start-/Build-/Test-Ergebnis ist dokumentiert.
- Geänderte Dateien, offene Punkte und bekannte Einschränkungen sind benannt.

## Wichtige Designentscheidung
Wirtschaft, Gemeinschaft und Viertelleben sind gleichwertige Spielsäulen. Sie müssen miteinander interagieren: Wetter und Events verändern Nachfrage; Bewohner haben Vorlieben und Routinen; Beziehungen erzeugen Geschichten und Hilfe; Kiosk-Traditionen schaffen Wiedererkennung und lokale Bindung.
