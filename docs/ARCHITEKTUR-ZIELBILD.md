# Zielarchitektur – modulares Three.js-Spiel ohne spätere Großumbauten

**Auftrag an Claude Code:** Diese Datei beschreibt die langfristige Zielstruktur und die vorgesehenen Erweiterungspunkte. Sie ist früh zu berücksichtigen, aber nicht vollständig vorab zu implementieren. Leite aus ihr nach der Repository-Analyse einen realistischen Architekturplan ab, der zur vorhandenen Codebasis passt.

## 1. Leitprinzip
Früh die richtigen Grenzen und Verträge schaffen; Features anschließend schrittweise liefern. Wir wollen weder einen monolithischen Spielcode noch ein überkompliziertes Framework. Neue Systeme sollen sich als klar abgegrenzte Module ergänzen lassen, ohne Kernlogik, Szene oder bestehende Features ständig umzubauen.

**Wichtig:** Modularität bedeutet klare Zuständigkeiten und Schnittstellen, nicht möglichst viele Ordner, Klassen oder Abstraktionen. Keine Microservices, kein Plugin-System um seiner selbst willen und keine Framework-Migration.

## 2. Geplante Systemlandschaft
Die folgenden Module sind als langfristige Produktvision vorzusehen. Ihre Umsetzung erfolgt in Etappen.

### Core / Runtime
- Game Bootstrap und Lebenszyklus
- Szenen- und Zustandsverwaltung
- Zeit-/Tick-System und Pause
- Input und Interaktionsvermittlung
- Konfiguration und Feature-Registrierung
- zentrale Fehlerbehandlung und Debug-Werkzeuge

### 3D World (Three.js)
- Scene composition und regionale Weltpakete
- Kamera, Bewegung und Navigation
- Interaktionspunkte und Trigger
- Licht, Wetterdarstellung und Tageszeit
- Asset-/GLB-Loading, Materialverwaltung und Instancing
- NPC-Visuals, Animationen und räumliche Navigation

### Gameplay-Domänen
- Kiosk und Einrichtung
- Produkte, Kategorien und Inventar
- Einkauf, Lieferanten und Bestellungen
- Verkauf, Kasse und Tagesabschluss
- Preise, Finanzen und Upgrades
- NPCs, Bedürfnisse, Routinen und Beziehungen
- Dialoge, Quests, Geschichten und Erinnerungen
- Events, Kalender, Saison und Wetter
- Rezepte, Eigenprodukte und Kiosk-Traditionen
- Ruf, Nachbarschaft und Viertelentwicklung

### Presentation / UI
- HUD und Tagesübersicht
- Kasse und Warenverwaltung
- Dialog-/Quest-Oberfläche
- Event- und Kalenderübersicht
- Inventar, Bau-/Upgrade-Menüs
- Feedback, Benachrichtigungen und Accessibility

### Data / Persistence
- Produkt-, NPC-, Quest- und Eventdefinitionen als datengetriebene Inhalte
- Savegames für Fortschritt, Beziehungen, Flags, Lager und Weltzustände
- Versionierung des Savegame-Schemas und kontrollierte Migrationen
- Konfiguration und Balancing getrennt von Spielregeln

### Audio / Atmosphere
- Umgebung, Innenraum, Wetter und Event-Sounds
- Musik-/Stimmungszustände
- räumliche Audiohinweise, sofern technisch sinnvoll

## 3. Abhängigkeitsregeln
- Core kennt keine konkreten Questgeschichten, Produktnamen oder einzelnen NPCs.
- Gameplay-Systeme enthalten Spielregeln und Zustände, aber möglichst keine direkten DOM- oder UI-Manipulationen.
- UI fragt Zustände ab und löst definierte Aktionen aus; sie dupliziert keine Geschäftslogik.
- Three.js-Visualisierung stellt Gameplay-Zustände dar. Sie soll nicht alleinige Quelle für Geld, Lagerbestand, Beziehungen oder Questfortschritt sein.
- Dateninhalte (z. B. NPC-Profile, Produktdefinitionen, Event-Konfigurationen) werden soweit sinnvoll von der Logik getrennt.
- Module kommunizieren über klar benannte öffentliche Methoden, Events oder vorhandene Projektmechanismen. Keine direkten Querzugriffe auf interne Variablen fremder Module.
- Vermeide zirkuläre Abhängigkeiten.

## 4. Ereignisse und Erweiterbarkeit
Prüfe, ob ein leichtgewichtiges internes Event-/Message-System sinnvoll ist. Beispiele für fachliche Ereignisse:
- `day.started`, `day.ended`
- `weather.changed`
- `product.stock.changed`
- `sale.completed`
- `npc.visited_kiosk`
- `relationship.changed`
- `quest.completed`
- `event.started`, `event.ended`
- `kiosk.specialty.unlocked`

Diese Namen sind Beispiele für mögliche Verträge, keine bereits vorhandenen APIs. Vor Implementierung einheitliche Namenskonvention, Payloads, Fehlerbehandlung und Debugbarkeit festlegen. Nicht jedes Ereignis braucht ein globales Event-System; direkte Methodenaufrufe sind für einfache, enge Beziehungen oft besser.

## 5. Datengetriebene Inhalte
Neue Produkte, NPCs, Dialoge, Quests und Events sollen möglichst durch Definitionen ergänzt werden können, statt jedes Mal zentrale Logik umzuschreiben.

Beispielhafte Datenfelder:
- Produkt: ID, Kategorie, Preis, Bestandseinheit, Modellreferenz, Regaltyp, Nachfrage-Tags
- NPC: ID, Profil, Routine, Vorlieben, Beziehungen, Dialog-/Quest-Referenzen
- Quest: ID, Trigger, Voraussetzungen, Schritte, Konsequenzen, Belohnungen
- Event: ID, Zeitraum/Trigger, Phasen, Effekte auf Nachfrage, NPCs und Umgebung
- Spezialität: Rezept, Zutaten, Kosten, Produktionszeit, Qualität, Kundenreaktionen

Definitionen validieren und bei ungültigen Daten verständliche Fehler ausgeben. Datengetrieben heißt nicht, komplexe Logik in unlesbare JSON-Strukturen zu pressen.

## 6. Savegames und langfristiger Weltzustand
Früh ein zentrales, versioniertes Savegame-Konzept vorsehen. Es muss perspektivisch speichern können:
- Geld, Lager, Bestellungen, Preise und Upgrades
- Spieltag, Uhrzeit, Wetter, Saison und Eventzustände
- NPC-Beziehungen, Erinnerungen, Routinen-Overrides
- Questfortschritt und Entscheidungen
- freigeschaltete Rezepte, Traditionen und Kiosk-Ruf
- platzierte oder veränderte Weltobjekte

Nicht alles muss im ersten Prototyp aktiv sein. Das Speicherformat sollte aber versionierbar sein und stabile IDs verwenden. Keine Three.js-Objekte oder Laufzeitklassen direkt serialisieren; speichere fachliche Daten und rekonstruiere die Darstellung.

## 7. Regionale Erweiterbarkeit
Regionen sollen später als Content-/World-Pakete ergänzt werden können: Gebäudevarianten, Stadtmöblierung, Produkte, NPC-Pools, Events, Sounds und Atmosphäre. Gemeinsame Systeme bleiben zentral; regionale Unterschiede werden über Konfigurationen und eigene Assets ausgedrückt. Keine Region darf nur ein Farb-Reskin sein.

## 8. Architekturauftrag für Phase 0
Nach der Codeanalyse soll Claude:
1. Ist-Architektur und tatsächliche Abhängigkeiten dokumentieren.
2. Die oben beschriebenen Zielmodule auf vorhandene Strukturen abbilden.
3. Eine einfache Modul-/Abhängigkeitsübersicht erstellen.
4. Festlegen, welche Schnittstellen jetzt wirklich nötig sind und welche erst später entstehen.
5. Einen minimalen Architektur-Unterbau für Phase 1–3 vorschlagen.
6. Risiken für Savegames, Datenmodelle, Eventkommunikation und Erweiterbarkeit benennen.
7. Die Architekturentscheidung in einem kurzen ADR (Architecture Decision Record) dokumentieren.

**Noch nicht** alle Zielmodule implementieren. Zuerst Struktur und Verträge planen; dann nur die für den aktuellen Vertical Slice nötigen Grundlagen umsetzen.

## 9. Definition of Done für Modularität
- Neue Inhalte können möglichst ohne Änderung an zentralen Kernmodulen ergänzt werden.
- Gameplay-Zustände sind nicht in Three.js-Meshes versteckt.
- UI, Gameplay-Regeln und 3D-Darstellung sind nachvollziehbar getrennt.
- Persistente Daten verwenden stabile IDs und ein versioniertes Schema.
- Abhängigkeiten sind gerichtet und verständlich.
- Die Architektur bleibt klein genug, dass ein einzelner Entwickler sie überblicken und erweitern kann.
