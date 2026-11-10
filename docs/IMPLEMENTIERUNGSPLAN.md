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

**Abnahme:** dokumentierter Ist-Zustand, Startanleitung, Risiken und priorisierte Umsetzungsschritte. In dieser Phase keine unnötigen Codeänderungen.

## Phase 1 – Spielbarer Kern und Greybox
**Ziel:** eine begehbare, testbare Kiosk-Grundszene.

Aufgaben:
1. Maßstab und Koordinatensystem der bestehenden Szene feststellen.
2. Kiosk-Greybox mit Außenkörper, Verkaufsöffnung, Eingang, Dach und Innenraum bauen.
3. Gehweg und kleinen Außenbereich ergänzen.
4. Kamera, Spielerbewegung und Interaktionsabstände abstimmen.
5. Kollisionen und einfache Interaktionspunkte integrieren, sofern die bestehende Architektur sie vorsieht.

**Abnahme:** Szene startet stabil; Spieler kann den relevanten Bereich erkunden; Kiosk und Laufwege sind räumlich verständlich.

## Phase 2 – Kiosk als modularer 3D-Ort
**Ziel:** das erste Ruhrgebiets-Büdchen bekommt seine erkennbare Identität.

Aufgaben:
1. Gebäude, Fassade, Markise, Verkaufsfenster, Tür, Dach und fiktive Beschilderung ausarbeiten.
2. Theke, Kasse, Wandregal, Mittelregal, Kühlschrank, Eistruhe, Zeitschriftenständer, Lager und Leergutbereich modular umsetzen.
3. Beleuchtung und Materialien für die Spielkamera optimieren.
4. Assets mit IDs, Maßen, Pivot und Dateipfaden dokumentieren.

**Abnahme:** ein stimmiger, modularer Kiosk, dessen wichtige Bereiche in der Spielansicht lesbar sind.

## Phase 3 – Wirtschaftlicher Büdchen-Alltag und erste Produkte
**Ziel:** ein geschlossener Gameplay-Loop statt einer reinen 3D-Kulisse.

Aufgaben:
1. Datenmodell für Produkte, Kategorien, Einkaufspreis, Verkaufspreis, Bestand und Lagerbedarf definieren.
2. Erste 20–30 originäre, fiktive Waren als 3D-Assets erstellen.
3. Waren platzieren, auffüllen, verkaufen und Bestand verändern.
4. Kasse und Tagesabschluss bzw. einfache Umsatzübersicht integrieren.
5. Preise, Nachfrage und Lagerengpässe nachvollziehbar darstellen.

**Abnahme:** Spieler kann Ware beschaffen, einräumen und verkaufen; Geld und Bestand ändern sich konsistent.

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
1. Kleinen Kalender für Wochentage, Jahreszeiten und besondere Termine einführen, passend zur bestehenden Zeitlogik.
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
