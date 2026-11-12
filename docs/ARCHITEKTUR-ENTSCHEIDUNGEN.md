# Architektur-Entscheidungen (ADRs)

**Stand:** 2026-11-11 · Ergebnis von [Auftrag 00](auftraege/00-bestandsaufnahme-und-architektur.md)

Grundlage: Das Repository enthält keinen Code ([Ist-Stand](TECHNISCHER-IST-STAND.md)). Es gibt daher keine bestehende Architektur, die zu respektieren wäre; die folgenden Entscheidungen legen die erste fest.

**Statuswerte:** *Vorgeschlagen* = technische Empfehlung, gilt als Arbeitsgrundlage für Phase 1, solange der Projektinhaber nicht widerspricht. *Offen* = Produktentscheidung, die der Projektinhaber treffen muss. *Entschieden* = bestätigt.

Die technischen ADRs sind seit Auftrag 01 umgesetzt, soweit ihr Status das angibt.

---

## Teil A – Technische Entscheidungen

### ADR-001 – Build-Stack: Vite, TypeScript, Three.js über npm
**Status:** Entschieden (umgesetzt in Auftrag 01). Gepinnt: three 0.187.0, vite 8.3.8, typescript 6.0.3 (nicht 7.x, weil typescript-eslint 8.72.2 nur TypeScript < 6.1 unterstützt).

**Kontext:** Kein Stack vorhanden. Gefordert sind Three.js, datengetriebene Inhalte mit Validierung, stabile Datenverträge und Überschaubarkeit für eine Einzelperson.

**Entscheidung:** Vite als Dev-Server und Bundler, TypeScript im `strict`-Modus, `three` als npm-Abhängigkeit in der beim Aufsetzen aktuellen Version (fest gepinnt, Lockfile eingecheckt). Kein UI- oder Spiel-Framework.

**Konsequenzen:** Datenverträge werden vom Compiler geprüft; schneller Start mit `npm run dev`; statischer Build, der auf jedem Webspace läuft. Es entsteht ein Build-Schritt; Three.js-Upgrades erfolgen bewusst und einzeln.

### ADR-002 – Vier Schichten mit gerichteten Abhängigkeiten
**Status:** Entschieden (umgesetzt in Auftrag 01). Die ESLint-Regel wurde mit absichtlichen Verstößen geprüft.

**Kontext:** Das Zielbild verlangt, dass Spielzustand nicht in Meshes steckt und UI keine Geschäftslogik dupliziert.

**Entscheidung:** `core` ← `game` ← `world` und `ui`; `content` liefert Daten nach den Typen aus `game`. `game` importiert weder `three` noch DOM-APIs. `world` und `ui` importieren einander nicht. Verdrahtet wird ausschließlich in `main.ts`. Details: [Modul- und Datenverträge](MODUL-UND-DATENVERTRAEGE.md).

**Konsequenzen:** Die gesamte Spiellogik ist ohne Browser testbar. Die Regel wird per ESLint-Importregel erzwungen, nicht nur dokumentiert. Preis: Darstellung muss Zustand aktiv abfragen oder abonnieren.

### ADR-003 – Ein serialisierbarer Spielzustand, Aktionen und typisierte Signale
**Status:** Entschieden (umgesetzt in Auftrag 01).

**Kontext:** Auftrag 00 verlangt, einen globalen Event-Bus nur bei nachgewiesenem Nutzen einzuführen.

**Entscheidung:**
- Ein zentrales, rein datenförmiges `GameState`-Objekt ist die einzige Quelle der Wahrheit.
- Änderungen laufen nur über benannte Aktionen der Domänenmodule (direkte Methodenaufrufe).
- Domänenmodule rufen einander direkt auf, wenn die Beziehung eng ist (z. B. Verkauf → Inventar).
- Nach außen (zu `world`, `ui`, später `audio`) meldet `game` Änderungen über einen kleinen, typisierten, synchronen Signal-Emitter mit fester Ereignisliste.

**Begründung des Nutzens:** `game` darf seine Darstellungen nicht kennen, mehrere davon müssen aber auf dieselbe Änderung reagieren. Das ist genau ein Fall für Benachrichtigungen. Für Abläufe innerhalb von `game` wird der Emitter nicht verwendet.

**Konsequenzen:** Kein untypisierter Bus, keine versteckten Abläufe in der Logik. Ereignisnamen sind ein Vertrag und werden in den Datenverträgen gepflegt.

### ADR-004 – Inhalte als typisierte TypeScript-Datenmodule mit Laufzeitvalidierung
**Status:** Entschieden (umgesetzt in Auftrag 01 für Layoutdaten; weitere Inhaltstypen folgen in ihren Phasen).

**Kontext:** Produkte, NPCs, Dialoge, Quests und Events sollen ohne Änderung der Kernlogik ergänzbar sein; ungültige Daten sollen verständliche Fehler liefern.

**Entscheidung:** Definitionen liegen als `.ts`-Dateien unter `src/content/`, gruppiert nach Region. Jeder Inhaltstyp hat eine handgeschriebene Validierungsfunktion (eindeutige IDs, gültige Referenzen, Wertebereiche). Validiert wird beim Start im Entwicklungsmodus und in einem Test. Keine Schema-Bibliothek.

**Konsequenzen:** Tippfehler in Feldern fallen beim Kompilieren auf, kaputte Referenzen beim Test. Bedingungen und Effekte in Dialogen/Quests werden als kleine, feste Menge von Datentypen modelliert, nicht als freier Code in den Daten. Ein späterer Wechsel auf JSON bleibt möglich, weil die Definitionen reine Daten sind.

### ADR-005 – Versioniertes Savegame im Browser-Speicher
**Status:** Entschieden (umgesetzt in Auftrag 01). Noch nicht umgesetzt, weil es noch keinen Zufall gibt: geseedeter Zufallsgenerator. Geldbeträge in Cent folgen mit Phase 3.

**Kontext:** Geschichten und Beziehungen müssen über Spielstände hinweg bestehen; das Format muss sich weiterentwickeln können.

**Entscheidung:** Gespeichert wird der `GameState` als JSON mit `schemaVersion` in `localStorage`. Laden durchläuft eine Kette von Migrationsfunktionen (Version n → n+1). Es werden nur fachliche Daten und stabile IDs gespeichert, nie Three.js-Objekte. Geldbeträge sind ganze Cent. Der Zufallsgenerator ist geseedet, sein Zustand wird mitgespeichert.

**Konsequenzen:** Reproduzierbare Spielstände und Tests. Jede Änderung am `GameState` erfordert eine Versionserhöhung mit Migration und Test. Unbekannte IDs (entfernte Inhalte) werden beim Laden mit Warnung verworfen statt abzustürzen. Export/Import als Datei kann später ergänzt werden.

### ADR-006 – Assets zuerst prozedural, GLB als Erweiterungspunkt
**Status:** Entschieden für prozedurale Fabriken (umgesetzt in Auftrag 01). Der GLB-Weg ist vorgesehen, aber noch nicht erprobt.

**Kontext:** Die Doku bevorzugt GLB für externe Assets, es gibt aber keine Modelle und keine Modellierpipeline. CLAUDE.md verlangt echte Geometrie statt Konzeptbilder.

**Entscheidung:** Jedes Asset aus dem Register wird durch eine Fabrikfunktion erzeugt, die unter seiner Asset-ID registriert ist und ein `Object3D` mit dokumentiertem Pivot und Maßen liefert. Zunächst bauen diese Funktionen Three.js-Geometrie mit geteilten Materialien; Beschriftungen entstehen als Canvas-Texturen. Eine Fabrik kann später ein GLB laden, ohne dass Aufrufer sich ändern.

**Konsequenzen:** Keine Abhängigkeit von externen Werkzeugen, kleine Ladezeiten, einheitlicher Stil. Der Detailgrad ist begrenzt; für Figuren kann GLB früher nötig werden.

### ADR-007 – UI als HTML/CSS-Overlay ohne Framework
**Status:** Entschieden (umgesetzt in Auftrag 01).

**Kontext:** Kasse, Warenverwaltung, Dialoge und Kalender sind text- und listenlastig.

**Entscheidung:** UI-Elemente sind DOM-Elemente über dem Canvas, geschrieben in TypeScript ohne UI-Framework. Jedes Panel liest Zustand über die öffentliche `game`-Schnittstelle, abonniert Signale und löst Aktionen aus.

**Konsequenzen:** Gute Lesbarkeit, Tastaturbedienung und Barrierefreiheit mit Bordmitteln. Sollte die UI in Phase 3–5 unhandlich werden, wird ein leichtgewichtiges Framework per neuem ADR geprüft; die Schichtentrennung macht das ohne Eingriff in `game` möglich.

### ADR-008 – Keine Physik-Engine; einfache Kollision und Wegpunkt-Navigation
**Status:** Kollision entschieden (umgesetzt in Auftrag 01). Wegpunkt-Navigation für NPCs bleibt vorgeschlagen bis Phase 4.

**Kontext:** Ein kleiner Kiosk mit Gehweg braucht keine Starrkörperphysik.

**Entscheidung:** Kollision auf der Bodenebene mit Kreisen (Figuren) gegen achsparallele Rechtecke (Wände, Möbel). NPCs bewegen sich entlang eines handgepflegten Wegpunktgraphen pro Region. Interaktion über Punkte mit Radius und Blickprüfung.

**Konsequenzen:** Keine zusätzliche Abhängigkeit, deterministisch, leicht zu debuggen. Für eine deutlich größere Welt müsste ein Navigationsnetz ergänzt werden.

### ADR-009 – Qualitätssicherung
**Status:** Entschieden (umgesetzt in Auftrag 01). Zusätzliches Script `check:browser`; Playwright 1.63.0 als Entwicklungsabhängigkeit.

**Entscheidung:** `tsc --noEmit`, ESLint (inklusive Schichtenregel), Vitest für `core`, `game` und Inhaltsvalidierung. Die 3D-Szene wird je Schritt per Playwright-Screenshot im echten Browser geprüft. Scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`.

**Konsequenzen:** Die Forderung „in der tatsächlichen Three.js-Szene prüfen" ist reproduzierbar erfüllbar. CI wird erst eingerichtet, wenn gewünscht.

### ADR-010 – Sprache im Code
**Status:** Entschieden (umgesetzt in Auftrag 01).

**Entscheidung:** Bezeichner und Code-Kommentare auf Englisch, Dokumentation und sämtliche Spieltexte auf Deutsch. Spieltexte liegen in den Inhaltsdaten bzw. einer zentralen Textdatei der UI, nicht verstreut in der Logik.

**Konsequenzen:** Einheitlicher Code; eine spätere Übersetzung bleibt möglich, wird aber jetzt nicht gebaut.

---

## Teil B – Offene Produktentscheidungen

Diese Punkte kann die Analyse nicht entscheiden. Bis zur Antwort gilt jeweils die Empfehlung als Arbeitsannahme.

### O-1 – Spielperspektive und Steuerung
**Status: Entschieden (2026-11-11).** Third Person mit schräger, leicht erhöhter Kamera; WASD und E, Mausklick als ergänzende Interaktion.

**Ursprüngliche Empfehlung:** Spielfigur in der dritten Person mit schräger, leicht erhöhter Kamera; Bewegung mit WASD, Interaktion mit E bzw. Mausklick.

**Warum:** Passt zu „mittlerer Spielkamera" und „lesbaren Silhouetten" der Art Direction, zeigt Kiosk, Kundschaft und Gehweg gleichzeitig und kommt mit moderatem Asset-Detail aus.

**Alternative:** Ego-Perspektive hinter der Theke. Wirkt unmittelbarer, verlangt aber deutlich detailliertere Produkte und Figuren und erschwert den Überblick.

**Auswirkung:** Kamera, Steuerung, Kollision, Detailgrad aller Assets. Muss vor der Greybox feststehen.

### O-2 – Zielplattform
**Status: Entschieden (2026-11-11).** Desktop-Browser mit Maus und Tastatur zuerst; Touch-Unterstützung wird später geprüft.

**Ursprüngliche Empfehlung:** Desktop-Browser mit Maus und Tastatur zuerst; Touch später.

**Auswirkung:** Eingabesystem, UI-Größen, Leistungsbudget.

### O-3 – Zeitmodell
**Status: Entschieden (2026-11-12).** Durchlaufende Spielzeit: 1 Spielminute = 1 Sekunde (Öffnungstag 06–22 Uhr ≈ 16 Minuten), pausierbar, mit Vorspulen; der Tag endet mit einem Tagesabschluss.

**Noch nicht umgesetzt.** Die Geschwindigkeit bleibt ein Balancing-Wert und ist nachträglich änderbar; die Grundform (durchlaufend) steht fest.

**Auswirkung:** NPC-Routinen, Nachfrage, Events, Savegame (`Game.tick`, Spielzeit im `GameState`, voraussichtlich neue `schemaVersion` mit Migration).

### O-4 – Alkohol und Tabak
**Status: Entschieden (2026-11-12).** Fiktives Bier und fiktive Tabakwaren sind verkaufbare Waren, jeweils mit Alterskennzeichen (`ageRestricted`) im Produktdatenmodell.

**Abweichung von der ursprünglichen Empfehlung:** Empfohlen war, Tabak nur als nicht verkaufbare Dekoration zu führen. Die Nutzerentscheidung hat Vorrang.

**Leitplanken, die weiter gelten:**
- Ausschließlich fiktive Marken und Verpackungen (CLAUDE.md, Abschnitt 4). Keine realen Tabak- oder Biermarken, keine nachgebildeten Packungsdesigns.
- Der Katalog (`02-roadmap-und-artwork-katalog.md`) verlangt Tabakwaren als „generische, nicht werbliche Requisiten". Das gilt für die Darstellung weiter: neutrale Packungen, keine Werbeflächen, keine verherrlichende Inszenierung.

**Noch nicht umgesetzt.** Offen für den Auftrag zu Phase 3: ob das Alterskennzeichen eine Spielmechanik bekommt (z. B. Alterskontrolle an der Theke) oder zunächst nur ein Datenfeld ist.

**Auswirkung:** Produktdatenmodell, Zielgruppe, eventuelle Altersfreigabe bei einer Veröffentlichung.

### O-5 – Hosting und Lizenz
**Empfehlung:** Später statisches Hosting (z. B. GitHub Pages); Lizenz vor einer Veröffentlichung klären. Blockiert Phase 1 nicht.

---

## Teil C – Bewusst nicht entschieden
Diese Themen werden erst geplant, wenn ihre Phase ansteht: Audio-Technik (Phase 6), Animationssystem für Figuren (Phase 4), LOD und Instancing-Strategie (bei nachgewiesenem Bedarf), Aufbau regionaler Pakete jenseits der Ordnerstruktur (nach dem Ruhrgebiets-Slice), Mehrsprachigkeit.
