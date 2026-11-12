# Auftrag 02 – Modularer Kiosk, Einrichtung und technische Nachpflege

**Priorität:** P1 – Phase 2  
**Voraussetzung:** Auftrag 01 abgeschlossen; Three.js-Greybox läuft  
**Ziel:** Aus der funktionalen Greybox einen glaubwürdigen, modular aufgebauten Ruhrgebiets-Kiosk machen. Gebäude und Einrichtung sollen aus wiederverwendbaren Asset-Fabriken und einer datengetriebenen Platzierungsliste entstehen.

## 1. Pflichtlektüre und Bestandsaufnahme

Vor Änderungen vollständig lesen:
- `CLAUDE.md`
- `docs/ARCHITEKTUR-ZIELBILD.md`
- `docs/IMPLEMENTIERUNGSPLAN.md`
- `docs/TECHNISCHER-IST-STAND.md`
- `docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md`
- `docs/MODUL-UND-DATENVERTRAEGE.md`
- `docs/artwork-prompts/01-art-direction.md`
- `docs/artwork-prompts/02-roadmap-und-artwork-katalog.md`
- `docs/artwork-prompts/04-marken-und-produktwelt.md`
- `docs/artwork-prompts/06-threejs-asset-standard.md`
- `docs/artwork-prompts/07-artwork-register.md`

Prüfe Branch, Arbeitsbaum und vorhandene Implementierung. Keine bestehenden Funktionen oder Änderungen überschreiben. Erstelle vorab einen kurzen Plan mit betroffenen Dateien.

## 2. Technische Nachpflege zuerst

### 2.1 npm audit
Der letzte dokumentierte `npm install`-Lauf meldete zehn Hinweise mittlerer Schwere aus Entwicklungswerkzeugen.

- Führe `npm audit` aus und dokumentiere jedes Advisory mit betroffenem Paket, Abhängigkeitspfad, betroffener Version und verfügbarer Behebung.
- Prüfe, ob es Laufzeitabhängigkeiten oder ausschließlich Entwicklungswerkzeuge betrifft.
- Aktualisiere nur gezielt und kompatibel. Keine blinden Major-Upgrades und kein pauschales `npm audit fix --force`.
- Wenn eine Behebung nicht sicher möglich ist, dokumentiere Grund, Risiko und spätere Maßnahme.
- Führe danach Typecheck, Lint, Tests, Build und Browsercheck erneut aus.

### 2.2 Build-Größe
Der Three.js-Build überschreitet aktuell Vites 500-kB-Warnschwelle. Analysiere den tatsächlichen Output:
- Prüfe, ob dynamische Imports für klar getrennte, später benötigte Bereiche sinnvoll sind.
- Keine künstliche Aufteilung nur zum Entfernen der Warnung.
- Keine Kernlogik oder Startszene verzögert laden.
- Wenn eine sinnvolle Optimierung ohne Architekturbruch möglich ist, implementiere sie und vergleiche vorher/nachher. Andernfalls Warnung mit konkreter Begründung dokumentieren.

## 3. Datengetriebenes Kiosk-Layout

Stelle das aktuelle Layout aus festen Möbel-Rechtecken auf eine versionierte, typisierte Platzierungsliste um.

Jede Platzierung benötigt mindestens:
- stabile Platzierungs-ID,
- Asset-ID aus dem Artwork-Register,
- Position und Rotation,
- optionalen Skalierungsfaktor nur, wenn das Asset diesen ausdrücklich erlaubt,
- Kollisions-/Interaktionsdaten, soweit erforderlich,
- optionale Funktions-/Nutzungsrolle (z. B. Verkauf, Kühlung, Lager).

Regeln:
- Asset-ID und Platzierungs-ID nicht verwechseln.
- Geometrie, Pivot, Maße und erlaubte Ausrichtung müssen pro Asset dokumentiert sein.
- Dieselben Layoutdaten speisen Darstellung und Kollision, damit beides nicht auseinanderläuft.
- Validierung prüft doppelte IDs, unbekannte Assets, ungültige Positionen, Überschneidungen dort, wo sie verboten sind, und Kollision mit Laufwegen.
- Ein späterer Editor darf dieses Format verwenden; in diesem Auftrag noch keinen Editor bauen.
- Falls das Savegame-Format sich ändert, schemaVersion erhöhen und Migration samt Tests ergänzen.

## 4. Kiosk-Gebäude gestalterisch ausarbeiten

Baue den vorhandenen Kiosk sichtbar weiter aus, ohne die Lesbarkeit der Third-Person-Kamera zu verlieren:
- glaubwürdige Ruhrgebiets-Fassade mit Backstein-/Putzanteilen und Gebrauchsspuren,
- eigenständige Markise,
- ausgearbeitete Tür mit Griff und Rahmen,
- Verkaufsfenster mit Rahmen, Fensterbank und nachvollziehbarer Klappenmechanik,
- Dachkante/Attika und dezente Dachdetails,
- fiktive Beschilderung und dezente Außenbeleuchtung,
- Innenraum mit stimmigen Materialien und klarer Wegeführung.

Kein fotorealistischer Detailwust. Stil bleibt stylized Low-/Mid-Poly, warme Beleuchtung, klare Silhouetten, glaubwürdige Gebrauchsspuren.

## 5. Einrichtung als eigenständige Assets

Mindestens folgende Asset-Fabriken mit Registry-Einträgen und dokumentierten Maßen/Pivots erstellen oder substanziell ausarbeiten:
- I-001 Verkaufstheke
- I-002 Kasse / POS
- I-003 Wandregal
- I-004 Mittelregal
- I-005 Getränkekühlschrank
- I-006 Eistruhe
- I-007 Zeitschriftenständer
- I-011 Lagerregal
- I-012 Leergut-/Kistenbereich

Die Möbel müssen optisch unterscheidbar sein und in den Raum passen. Kühlschrank und Eistruhe erhalten zunächst nur glaubwürdige Türen/Deckel und leere Innenräume bzw. neutrale Platzhalterflächen. Noch keine Warenmodelle oder Produktmarken.

Mindestens zwei Einrichtungsgegenstände müssen über die Platzierungsliste an unterschiedlichen Positionen und Rotationen demonstriert werden. Das Layout muss ohne Änderung der Asset-Fabrik umstellbar sein.

## 6. Restpunkte aus Auftrag 01

### 6.1 Sichtfreistellung
Die aktuelle durchscheinende Rückansicht wirkt wie ein transparenter Kasten. Verbessere sie:
- bevorzuge gezieltes Ausblenden einzelner verdeckender Bauteile oder eine abgestufte, gut lesbare Lösung,
- verhindere unnötiges Durchscheinen von Innenmöbeln und anderen Flächen,
- teste mehrere Positionen: vor dem Kiosk, im Innenraum, hinter dem Kiosk und seitlich.

### 6.2 Klappen-Markierung
Die Bodenmarkierung muss an der Verkaufsklappe sichtbar sein, ohne im Thekenvolumen zu verschwinden. Position, Höhe, Größe und Lesbarkeit in der Spielkamera testen.

### 6.3 Browser- und Grafikprüfung
- Behalte den automatisierten Headless-Chromium-Check.
- Ergänze nachvollziehbare manuelle Prüfschritte für einen Browser mit echter Grafikhardware, sofern in der Entwicklungsumgebung verfügbar.
- Firefox/Safari nicht als geprüft melden, wenn sie nicht tatsächlich getestet wurden.
- Keine Mindest-FPS versprechen, ohne Messung auf dokumentierter Hardware.

## 7. Asset-Register und Stilkontrolle

Aktualisiere `docs/artwork-prompts/07-artwork-register.md`:
- Status nur dann auf „Im Spiel integriert" setzen, wenn Asset-Fabrik, Registry, Platzierung und Sichtprüfung vorhanden sind.
- Greybox-Status und ausgearbeitete Assets unterscheiden.
- Änderungsprotokoll mit Datum und konkreten Dateien ergänzen.

Keine realen Marken, Logos, Produktnamen, Verpackungen, Vereinswappen oder nachgebildeten geschützten Designs verwenden. Alle Beschriftungen und Produktwelten bleiben fiktiv.

## 8. Qualitätssicherung und Abnahme

Alle Befehle ausführen und Ergebnisse dokumentieren:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run check:browser`

Browsercheck erweitern um:
- Möbel erscheinen an den konfigurierten Positionen und Rotationen,
- Kollision folgt denselben Layoutdaten,
- Tür und Klappe funktionieren weiterhin,
- Figur ist in allen vier relevanten Ansichten gut sichtbar,
- Klappenmarker ist sichtbar,
- keine unbehandelten Browser-/Konsolenfehler.

Erzeuge Screenshots aus der echten Anwendung:
- Außenansicht,
- Innenraum mit Einrichtung,
- Rück-/Seitenansicht zur Sichtfreistellung.
Lege sie unter `docs/screenshots/` ab.

## 9. Ausdrücklich nicht Teil dieses Auftrags

- Produkte, Produktverpackungen und Warenwirtschaft (Phase 3).
- Einkauf, Verkauf, Preise, Inventar und Kasse als Gameplay.
- Spielzeitmodell O-3; bleibt offen.
- Alkohol-/Tabakentscheidung O-4; bleibt offen.
- NPCs, Dialoge, Quests, Beziehungen und Events.
- Touchsteuerung, Mobile-Optimierung, Audio und weitere Regionen.
- Ein visueller Einrichtungseditor.

## 10. Dokumentation und Abschlussbericht

Aktualisiere README, technischen Ist-Stand, Modul-/Datenverträge, Implementierungsplan, Asset-Register und gegebenenfalls ADRs. Trenne strikt zwischen implementiert, getestet und geplant.

Abschlussbericht:
1. wichtigste Änderungen und Dateien,
2. Layout-/Asset-Vertrag,
3. npm-Audit-Ergebnis mit behobenen und offenen Advisories,
4. Build-Größe vorher/nachher,
5. Typecheck/Lint/Tests/Build/Browsercheck,
6. Screenshot-Pfade,
7. bekannte Einschränkungen,
8. nächster Auftrag.

**Definition of Done:** modularer Kiosk mit verschiebbarer Einrichtung, funktionierender Kollision aus Layoutdaten, verbesserter Sichtfreistellung, sichtbarer Klappenmarkierung, nachvollziehbarer Audit-Bewertung und grüner Test-/Browserprüfung. Keine bloße Konzeptgrafik als fertiges Asset melden.
