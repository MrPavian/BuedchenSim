# Architektur-Entscheidungen (ADRs)

**Stand:** 2026-11-14 · Ergebnis von [Auftrag 00](auftraege/00-bestandsaufnahme-und-architektur.md), fortgeführt bis [Auftrag 04](auftraege/04-bewohner-und-soziale-bindung.md)

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
**Status:** Entschieden (umgesetzt in Auftrag 01). Geldbeträge in ganzen Cent sind seit Auftrag 03 umgesetzt (Savegame Version 2). Der Zufall ist seit Auftrag 04 umgesetzt, aber anders als unten entworfen: nicht als gespeicherter Generatorzustand, sondern als gespeicherter Weltseed mit zustandslosen Würfen (siehe ADR-017); das Savegame ist seit Auftrag 04 Version 3.

**Kontext:** Geschichten und Beziehungen müssen über Spielstände hinweg bestehen; das Format muss sich weiterentwickeln können.

**Entscheidung:** Gespeichert wird der `GameState` als JSON mit `schemaVersion` in `localStorage`. Laden durchläuft eine Kette von Migrationsfunktionen (Version n → n+1). Es werden nur fachliche Daten und stabile IDs gespeichert, nie Three.js-Objekte. Geldbeträge sind ganze Cent. Der Zufallsgenerator ist geseedet, sein Zustand wird mitgespeichert.

**Konsequenzen:** Reproduzierbare Spielstände und Tests. Jede Änderung am `GameState` erfordert eine Versionserhöhung mit Migration und Test. Unbekannte IDs (entfernte Inhalte) werden beim Laden mit Warnung verworfen statt abzustürzen. Export/Import als Datei kann später ergänzt werden.

### ADR-006 – Assets zuerst prozedural, GLB als Erweiterungspunkt
**Status:** Entschieden für prozedurale Fabriken (umgesetzt in Auftrag 01). Der GLB-Weg ist vorgesehen, aber noch nicht erprobt.

**Kontext:** Die Doku bevorzugt GLB für externe Assets, es gibt aber keine Modelle und keine Modellierpipeline. CLAUDE.md verlangt echte Geometrie statt Konzeptbilder.

**Entscheidung:** Jedes Asset aus dem Register wird durch eine Fabrikfunktion erzeugt, die unter seiner Asset-ID registriert ist und ein `Object3D` mit dokumentiertem Pivot und Maßen liefert. Zunächst bauen diese Funktionen Three.js-Geometrie mit geteilten Materialien; Beschriftungen entstehen als Canvas-Texturen. Eine Fabrik kann später ein GLB laden, ohne dass Aufrufer sich ändern.

**Konsequenzen:** Keine Abhängigkeit von externen Werkzeugen, kleine Ladezeiten, einheitlicher Stil. Der Detailgrad ist begrenzt; für Figuren kann GLB früher nötig werden (Auftrag 04 hat die Figuren dennoch prozedural gebaut, siehe ADR-021).

### ADR-007 – UI als HTML/CSS-Overlay ohne Framework
**Status:** Entschieden (umgesetzt in Auftrag 01).

**Kontext:** Kasse, Warenverwaltung, Dialoge und Kalender sind text- und listenlastig.

**Entscheidung:** UI-Elemente sind DOM-Elemente über dem Canvas, geschrieben in TypeScript ohne UI-Framework. Jedes Panel liest Zustand über die öffentliche `game`-Schnittstelle, abonniert Signale und löst Aktionen aus.

**Konsequenzen:** Gute Lesbarkeit, Tastaturbedienung und Barrierefreiheit mit Bordmitteln. Sollte die UI in Phase 3–5 unhandlich werden, wird ein leichtgewichtiges Framework per neuem ADR geprüft; die Schichtentrennung macht das ohne Eingriff in `game` möglich.

### ADR-008 – Keine Physik-Engine; einfache Kollision und Wegpunkt-Navigation
**Status:** Kollision entschieden (umgesetzt in Auftrag 01). Wegpunkt-Navigation für NPCs entschieden und umgesetzt in Auftrag 04 (siehe ADR-018).

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

### ADR-011 – Geometrische Slot-Kapazität mit einer Quelle der Wahrheit
**Status:** Entschieden (umgesetzt in Auftrag 03).

**Kontext:** Waren müssen im Regal sichtbar sein, ohne dass sich Modelle überlappen, und das Spiel muss Überbelegung ausschließen. Eine frei gewählte Kapazitätszahl je Platz würde von der Darstellung abweichen.

**Entscheidung:** Ein Warenplatz (`StockSlotDef`) ist eine Box im lokalen Rahmen seiner Platzierung. Die Funktion `slotUnitPositions` in `src/game/stockLayout.ts` ordnet Einheiten (Maß aus dem Produkt-Asset, Stapellimit der Verpackung oder des Produkts, 1 cm Abstand) in Spalten, Reihen und Lagen an; die Kapazität ist die Länge dieser Liste. Spiel (Einräumen, Laden, Validierung) und Welt (Darstellung) rufen dieselbe Funktion auf.

**Konsequenzen:** Was das Spiel zulässt, ist genau das, was die Welt zeichnet, und Modelle überlappen nicht. Die Plätze stehen als Daten in `slots.ts` und werden gegen die echten Möbelfabriken geprüft (Integrationstest). Ändert sich ein Möbel, müssen die Platzmaße mitgezogen werden. Die Maße gelten für Maßstab 1 (kein Asset ist skalierbar). Produkte, die nicht in einen Platz passen, haben dort Kapazität 0.

### ADR-012 – Ein P-Asset je Produkt, gemeinsame Modellfabriken je Verpackungsart
**Status:** Entschieden (umgesetzt in Auftrag 03; Etiketten nachgearbeitet am 2026-11-13).

**Kontext:** Das Register führte P-001 bis P-030 als Sammeleintrag. Der Auftrag erlaubt gemeinsame Fabriken bei gleicher Form, verlangt aber unterscheidbare Produkte.

**Entscheidung:** Jedes der 28 Produkte hat genau eine Asset-ID (`P-001` bis `P-028`, in Katalogreihenfolge) mit dem Maß einer Einheit; die Validierung verlangt, dass eine Asset-ID nur einem Produkt gehört. Zehn Fabriken je Verpackungsart (`PackageKind`) bauen die Form; Farben, Beschriftung und Etikett kommen aus dem `ProductDef`, Maße aus dem Asset. P-029 und P-030 bleiben frei.

**Konsequenzen:** Ein neues Produkt braucht nur Daten, solange die Verpackungsart existiert. Die Form ist je Verpackungsart gleich. Die Etiketten sind Canvas-Texturen mit Akzentfeld und Emblem je Markenfamilie; ein Produktwort steht nur bei physisch mindestens 2,6 cm Schrifthöhe. Text auf Flaschen und Dosen ist aus Kameraabstand nicht lesbar, Wörter auf Beuteln nur bei doppelter Pixeldichte. Die Produktdarstellung nutzt `InstancedMesh` je Modellteil und Produkt.

### ADR-013 – Lieferung trifft sofort ein, wird aber ausdrücklich angenommen
**Status:** Entschieden (umgesetzt in Auftrag 03).

**Kontext:** Der Auftrag lässt eine sofortige oder eine kurz verzögerte Lieferung zu und verlangt die einfachere, robuste Variante.

**Entscheidung:** `placeOrder` bucht die Summe sofort ab, verbucht eine Transaktion und setzt eine offene Lieferung (höchstens eine); `receiveDelivery` schreibt sie dem Hinterlager gut. Es gibt keine Wartezeit. Das Hinterlager ist ein Zähler (400 Stück), die offene Lieferung reserviert Platz.

**Konsequenzen:** Keine zeitabhängigen Zustände im Savegame, einfach zu testen. Der Spieler sieht die Lieferung nachvollziehbar und nimmt sie an. Das Geld ist bei der Bestellung weg, nicht bei der Annahme. Eine Wartezeit ließe sich später als Feld an `PendingDelivery` ergänzen (mit Migration).

### ADR-014 – Die Uhr hält bei 22:00 und schließt den Tag nie selbst
**Status:** Entschieden (umgesetzt in Auftrag 03).

**Kontext:** Der Auftrag nennt Tagesabschluss „um 22:00 Uhr oder über eine explizite Aktion“ und verbietet stillschweigende Gutschriften und unbemerkte Zeitsprünge.

**Entscheidung:** Bei 22:00 wird die Zeit begrenzt, die Phase wechselt einmalig auf `awaiting_close` und `day.ending` wird gesendet; der Tagesabschluss geschieht nur durch `economy.closeDay()` auf Bestätigung des Spielers, auch vorzeitig. Der nächste Tag beginnt nur durch `calendar.startNextDay()`.

**Konsequenzen:** Keine doppelten Abschlüsse durch große Zeitschritte, kein verlorener Abend. Zwischen 22:00 und Abschluss steht die Zeit, Bestellen, Einräumen und Zurücknehmen bleiben möglich, Verkauf nicht. Ein Spieler kann den Abschluss beliebig hinauszögern.

### ADR-015 – Keine Preisänderung durch den Spieler in dieser Phase
**Status:** Entschieden (umgesetzt in Auftrag 03).

**Kontext:** Der Auftrag stellt `economy.setPrice` frei („nur falls sinnvoll und vollständig“). Ohne Kunden und Nachfrage hätte ein Preis keine Gegenwirkung.

**Entscheidung:** Verkauft wird zum vorgeschlagenen Verkaufspreis des Produkts (`suggestedPriceCents`). Es gibt keinen Preis im Spielstand und keine Aktion `setPrice`.

**Konsequenzen:** Weniger Zustand und kein Balancing ohne Nachfrage. Eine spätere Preisfunktion braucht Zustand je Produkt, eine Migration und die Nachfragewirkung (Phase 5).

### ADR-016 – Kasse und Warenverwaltung sind ortsgebunden; die Ortsregel liegt in der UI, nicht in der Verkaufsdomäne
**Status:** Entschieden (umgesetzt in der Nacharbeit zu Auftrag 03, 2026-11-13).

**Kontext:** Die Schaltflächen „Waren“ und „Kasse“ im HUD öffneten die Panels an jeder Stelle, auch außerhalb des Kiosks. Das widersprach der Vorstellung, dass der Kiosk der Ort des Spielers ist, und machte den Verkauf zu einer Handlung ohne Ort.

**Entscheidung:** Die Kasse öffnet sich nur am Interaktionspunkt `interaction.register`, die Warenverwaltung nur am Punkt `interaction.storage`, jeweils mit E oder per Klick auf die Eingabeaufforderung. Ein offenes Panel schließt sich, wenn die Figur den Punkt verlässt oder der Spielstand ersetzt wird. Die Verkaufsdomäne `economy.completeSale` prüft die Position nicht; `restock` und `unstock` ebenfalls nicht. Der Debug-Hook `ui.openPanel(...)` umgeht die Ortsregel bewusst.

**Konsequenzen:** Die Ortsregel ist eine reine UI-Regel und lässt sich ohne Änderung am Spielzustand ändern. NPC-Kunden in Phase 4 können dieselbe Verkaufsdomäne nutzen, ohne an der Spielerposition zu hängen. Die Test-IDs `hud-open-goods` und `hud-open-till` entfallen. Der Tag-abschließen-Knopf bleibt im HUD.

### ADR-017 – Entscheidungen aus einem gespeicherten Weltseed, zustandslos gewürfelt
**Status:** Entschieden (umgesetzt in Auftrag 04). Ersetzt den „gespeicherten Generatorzustand“ aus ADR-005.

**Kontext:** Routinen, Besuche und Wünsche brauchen Zufall; ein Neuladen desselben Spielstands darf aber keine Entscheidung ändern, und die Spiellogik darf kein `Math.random()` benutzen. Ein Generator mit gespeichertem Zustand liefert die Zahlen in der Reihenfolge der Aufrufe; wer vor dem Speichern mehr oder weniger Würfe verbraucht hat, bekommt nach dem Laden andere Ergebnisse.

**Entscheidung:** `roll(seed, …Teile)` in `src/game/random.ts` ist eine reine Funktion: `hashParts(seed, …Teile) / 2³²` (FNV-1a mit Trennzeichen und murmur3-Endmischung, Wert in [0, 1)). Der Seed (`state.world.seed`, 32 Bit) wird gespeichert. Die Teile benennen die Entscheidung: Routinechance `(Tag, npcId, 'routine', eintragId)`, Wunschwahl `(Tag, npcId, 'wish', routineId)`. Ein neues Spiel bekommt seinen Seed aus der Uhrzeit (nur in `main.ts`, auch bei „Neues Spiel“), Tests nutzen den festen Seed 1, die Migration 2→3 leitet ihn aus Region und Speicherzeit ab. Ein kleiner Generator mit Zustand (`createRng`, mulberry32) liegt getestet bereit, wird aber nicht benutzt.

**Konsequenzen:** Entscheidungen hängen nur von Seed, Tag und IDs ab, nicht von Reihenfolge, Bildrate oder Spieltempo; ein Neuladen ändert nichts (getestet, auch mitten am Tag). Die IDs der Einträge sind Teil der Entscheidung: Wer einen Routineeintrag umbenennt, verändert sein Würfelergebnis; Inhalts-IDs bleiben ohnehin stabil. Jede neue Art von Entscheidung braucht einen eigenen Zweck-Text. Der Seed ist im Spielstand lesbar und änderbar; das ist hier unbedenklich.

### ADR-018 – Bewohner bewegen sich nur auf einem validierten Wegpunktgraphen
**Status:** Entschieden (umgesetzt in Auftrag 04). Konkretisiert ADR-008.

**Kontext:** Bewohner dürfen nicht durch Wände, Theke oder Möbel laufen, nicht teleportieren und nicht dauerhaft im Weg des Spielers hängen. Eine Physik- oder Navigationsmesh-Lösung wäre für vier Figuren und einen Gehweg unverhältnismäßig.

**Entscheidung:** Der Graph (`NavDef`: Wegpunkte mit stabilen IDs, ungerichtete Kanten, Orte mit mehreren Standplätzen, Ausgänge) ist Inhalt (`nav.ts`) und von Hand gepflegt. Die Wegsuche (Dijkstra, deterministisch) liegt in `src/game/nav.ts`. Bewohner bewegen sich nur auf Kanten, in festen Teilschritten innerhalb von `game.tick`; Position, Ziel und Rest der Route stehen im Spielstand. Die Kollisionsfreiheit wird **beim Inhalt** bewiesen, nicht zur Laufzeit: `validateResidents` prüft jede Kante gegen alle Kollisionsrechtecke (Kreis mit Radius 0,3 m, auch gebundene Platzierungen wie die Bank), Abstände der Standplätze, Reichweite des Verkaufsfensters, freie Türzufahrt und Erreichbarkeit von jedem Ausgang. Zur Laufzeit halten Bewohner nur Abstand zum Spieler und zueinander (0,65 m). Bei Blockade warten sie, suchen nach 4 s eine Route um die blockierte Kante (zwei Gehweg-Bahnen), der Bewohner mit der höheren ID weicht aus, und als letzte Rückfallebene gehen sich zwei Bewohner nach 20 s durch (nie den Spieler, nie Wände).

**Konsequenzen:** Kein Physikbedarf, deterministisch und leicht zu testen. Der Graph ist Handarbeit; wer ein Möbel verschiebt, muss die Validierung bestehen. Es gibt keine freie Navigation. Die Rückfallebene ist eine bewusste Abweichung vom Grundsatz „nicht durcheinander laufen“, um eine dauerhafte Verklemmung auszuschließen.

### ADR-019 – Bewohnerkäufe über die bestehende Verkaufsdomäne, Alter aus den Inhaltsdaten
**Status:** Entschieden (umgesetzt in Auftrag 04). Beantwortet die offene Frage aus O-4.

**Kontext:** Bewohner sollen wirklich Ware kaufen, ohne eine zweite Bestands- und Geldlogik und ohne Umgehung der Altersschranke; ein Kauf darf nicht durch doppeltes E oder mehrere Bilder mehrfach bezahlt werden.

**Entscheidung:** `economy.completeSale` bleibt die einzige Buchung. `SaleRequest` bekommt das optionale Feld `customer: { npcId }`; die Domäne ergänzt `unknown_customer` und `customer_underage` (Alter aus `NpcDef.age`, auch bei bestätigter Ausweisprüfung) und schreibt `npcId` in die Transaktion und in `sale.completed`. `ageCheckConfirmed` bleibt eine ausdrückliche Bestätigung des Aufrufs; im Kundengespräch ist sie die Antwort „Ausweis, bitte.“, die das Alter aus den Inhaltsdaten zeigt. Der offene Wunsch ist Teil des Bewohnerzustands (`NpcState.wish`); Verkauf, Auflösung (`resolved`), Erinnerung, Wunsch-Effekte und Heimgehen geschehen in einem Schritt, ein aufgelöster Wunsch lässt sich nicht wieder verkaufen. Bewohner kaufen nur, wenn der Spieler sie bedient (keine Hintergrundverkäufe), zum vorgeschlagenen Verkaufspreis.

**Konsequenzen:** Die Kassenverkäufe des Spielers sind unverändert (getestet). Ein Bewohner unter dem Mindestalter kann die Ware nie kaufen, egal was der Spieler bestätigt. Die Wirtschaft kennt weiter keine Nachfrage; die Wünsche sind Inhalt mit Bedingungen und Gewichten.

### ADR-020 – Dialoge, Bedingungen und Effekte als geschlossene Datentypen ohne Code
**Status:** Entschieden (umgesetzt in Auftrag 04). Konkretisiert ADR-004.

**Kontext:** Gespräche und Geschichten sollen ohne Änderung der Kernlogik ergänzbar sein; der Auftrag verbietet `eval`, ausführbaren Code und eine freie Skriptsprache.

**Entscheidung:** `Condition` (13 Fälle) und `Effect` (8 Fälle) sind diskriminierte Unions in `src/game/npcTypes.ts`; ausgewertet werden sie an je einer Stelle (`conditions.ts`, `story.ts`, `dialogue.ts`). Ein Gespräch wird nach Priorität unter denen gewählt, deren Bedingungen gelten (`once` entfällt nach dem Sehen); ein einziges generisches Panel zeigt es. Relationseffekte tragen einen Schlüssel und wirken höchstens einmal (`story.effectKeys`); die einzige wiederholbare Beziehungsänderung ist der Tagesgruß. Quest-Schritte gehen nur vorwärts, ein Ausgang ist endgültig. Das Kundengespräch ist eingebaut (nicht Inhalt) und nutzt die Kundeneffekte `sellWish`, `declineWish`, `checkId`, die die Inhaltsvalidierung in Inhalten verbietet. `validateResidents` prüft Verweise, Wertebereiche, erreichbare Knoten, Widersprüche und Schlüssel.

**Konsequenzen:** Eine neue Bedingung ist ein Fall im Typ plus je eine Auswertung und Validierung. Gesprächsverläufe entstehen aus Priorität und Bedingungen, nicht aus einem Skript; ob alle Bedingungen je zusammen erfüllbar sind, prüft die Validierung nicht. Ein Gespräch gilt erst mit einer Schlussantwort als gesehen; vorzeitiges Schließen verbraucht kein einmaliges Gespräch (Fehler bei der Dokumentation gefunden und am 2026-11-14 behoben). Erinnerungen sind einfache Kennungen ohne Typ.

### ADR-021 – Bewohnerfiguren prozedural mit einem leichten gemeinsamen Animations-Kit
**Status:** Entschieden (umgesetzt in Auftrag 04). Bestätigt ADR-006 für Figuren.

**Kontext:** Der Auftrag verlangt vier unterscheidbare Figuren mit lesbaren Körperteilen und einfachen Geh-, Idle- und Gesprächsanimationen und verlangt, die Wahl „prozedural oder GLB“ zu begründen.

**Entscheidung:** Prozedural. Ein `PartKit` baut jede Figur aus sieben gemeinsamen Grundgeometrien und einem Material je Farbe auf einem Gerüst aus Gruppen (Rumpf, Kopf, Arme, Beine); die Animation (Schrittphase aus der zurückgelegten Strecke, Atmen, Gewichtsverlagerung, Gesten beim Sprechen) ist reine Skalarrechnung je Bild ohne neue Objekte, ein `GaitStyle` je Figur macht den Gang erkennbar. Eine Fabrik je Asset-ID (`N-002`, `N-003`, `N-006`, `N-007`) wird in `src/world/assets/residents/index.ts` registriert; unbekannte IDs bekommen eine neutrale Fallback-Figur und eine Warnung. Kein `AnimationMixer`, kein `InstancedMesh`.

**Gründe:** Es gibt keine Modelldateien, keine Modellierpipeline und in der Umgebung kein Werkzeug dafür; Maße, Pivot und Unterscheidbarkeit lassen sich im Code exakt kontrollieren und testen; für vier Figuren genügt ein kleines Kit.

**Konsequenzen:** Die Details sind begrenzt (stilisierte Gesichter, kleine Merkmale aus der Spielkamera kaum lesbar). Vier Figuren kosten 123 Meshes, also 123 Draw Calls; bei deutlich mehr Bewohnern müsste zusammengefasst oder instanziiert werden. Ein späterer Wechsel auf GLB ersetzt nur die Fabrik, weil Aufrufer nur `ResidentFigure` kennen.

### ADR-022 – Flaggebundene Platzierungen für sichtbare Folgen von Entscheidungen
**Status:** Entschieden (umgesetzt in Auftrag 04).

**Kontext:** Entscheidungen sollen die Welt sichtbar verändern (eine Bank im Hof, ein Foto auf der Theke). Platzierungen sind Inhalt, nicht Spielstand (Abschnitt 14.3 der Datenverträge); der Spielstand kennt aber die Story-Flags.

**Entscheidung:** `PlacementDef.requiresFlag` benennt ein Story-Flag; `placementPresent(placement, flags)` entscheidet, ob die Platzierung existiert. Zur Laufzeit zeichnet die Welt das Objekt und seine Kollision nur, solange das Flag gesetzt ist, und baut die Kollisionslisten bei `story.changed` und `game.state.replaced` neu (`placementGates.ts`); Objekte, die darauf stehen (das Foto auf der Theke), verschwinden mit ihm. Die Inhaltsvalidierung übergibt keine Flags und behandelt gebundene Platzierungen als vorhanden, damit eine spätere Bank keinen Weg versperrt; ein gelesenes Flag muss von einem Effekt gesetzt werden. Der Spielstand speichert weiter nur das Flag, nicht die Platzierung.

**Konsequenzen:** Das Layout bleibt Inhalt und nahezu unverändert; ein Objekt lässt sich nur zu- und abschalten, nicht verschieben. Wird ein Flag zurückgesetzt, verschwindet das Objekt wieder (das nutzt derzeit keine Geschichte für Platzierungen).

### ADR-023 – Figuren als GLB aus CC0-MakeHuman-Daten per Blender-Skript, prozedurale Figur als Fallback
**Status:** Entschieden (Prototyp N-002 umgesetzt in Auftrag 04.5). Erweitert ADR-021, setzt den GLB-Weg aus ADR-006 erstmals um.

**Kontext:** Auftrag 04.5, Abschnitt 6A verlangt glaubwürdige stilisierte Figuren mit natürlichen Proportionen, Gesicht, Kleidung, Rig und Animation. Weder das prozedurale Kit noch ein Blender-Skript aus Grundformen erreichten das (erster Prototyp verworfen: unglaubwürdige Proportionen). Ein Modellierprogramm mit Oberfläche gibt es in der Umgebung nicht; Blender ist als Python-Modul (`bpy`) installierbar. MakeHuman stellt Grundkörper, Formziele, Rig, Gewichte, Kleidung und Texturen als CC0-Daten bereit.

**Entscheidung:** Figuren entstehen als GLB nach dem Vertrag in [VISUAL-BASELINE.md, Abschnitt 8.3](VISUAL-BASELINE.md) (Pivot an den Füßen, Blick +Z, Clips `idle`/`walk`/`talk`, ein Skin). Quelle ist das versionierte Skript `tools/characters/build_mh_resident.py`, das **nur die CC0-Daten** von MakeHuman liest (Grundmesh, Makro- und Detailziele, `game_engine`-Rig, Kleidung über `.mhclo`) und daraus Körper, Rig, Kleidung, Texturen und Animationen baut; MakeHuman- oder MPFB-Programmcode wird weder ausgeführt noch mitgeliefert. Ein von Hand modelliertes GLB nach demselben Vertrag ist ebenso zulässig. Zur Laufzeit lädt `residentView` die Datei über `GLTFLoader`, kopiert das Skelett je Instanz (`SkeletonUtils.clone`) und mischt die Clips mit einem `AnimationMixer` nach denselben Regeln wie das prozedurale Kit; die Schnittstelle `ResidentFigure` bleibt unverändert. Bis zum Laden, bei Ladefehlern und in Node-Tests bleibt die prozedurale Figur. Welche Asset-ID ein Modell hat, steht in `RESIDENT_MODELS`.

**Gründe:** realistische Anatomie aus einer erprobten Datenbasis statt Eigenbau; Regler (Alter, Gewicht, Größe, Gesichtsdetails) machen jede Figur individuell und reproduzierbar; CC0 erlaubt Änderung und Weitergabe ohne Auflagen; keine Engine- oder Build-Änderung.

**Konsequenzen:** Je Figur rund 30.000 Dreiecke und 1,5 MB statt rund 2.000 Dreiecken; Draw Calls etwa gleich oder geringer. Die Datenordner (MPFB-`data`, `makehuman_system_assets`) liegen nicht im Repository und müssen zum Erzeugen heruntergeladen werden; Python 3.13 und `bpy` 5.3 werden nur zum Erzeugen gebraucht, nicht für Build oder Tests. Lizenz- und Projekthinweise in Texturen entfernt das Skript; Kleidung mit Projektlogo wird nicht verwendet. PBR-Materialien der Figuren und Lambert-Welt sind abzustimmen, wenn mehr Figuren umgestellt sind.

**Ergänzung (Auftrag 04.6):** Alle vier Bewohner nutzen diesen Weg; jede Figur ist eine Spezifikation im Skript. Gesichtsausdrücke kommen als optionale Morph Targets `friendly`, `thoughtful`, `blink` (aus MakeHuman-Ausdruckseinheiten, dünn besetzt) in dieselbe Datei; die Laufzeit blinzelt und blendet beim Sprechen weich zwischen den Ausdrücken. Dateien ohne Morph Targets bleiben gültig.


### ADR-024 – Datum, Wetter und Veranstaltungen werden abgeleitet, nicht gespeichert
**Status:** Entschieden (umgesetzt in Auftrag 05).

**Kontext:** Auftrag 05 verlangt Kalender, Jahreszeiten, Wetter mit Vorhersage und Veranstaltungen, die reproduzierbar sind und einen Neustart überstehen. Jeder gespeicherte abgeleitete Wert kann veralten oder dem Inhalt widersprechen.

**Entscheidung:** Gespeichert bleibt nur `calendar.day` (Tageszähler ab Montag, 7. Juni 2027) und der Weltseed. Datum, Wochentag und Jahreszeit berechnet `src/game/date.ts` (Gregorianischer Kalender, Schaltjahre). Das Wetter eines Tages ist eine reine Funktion `weatherOfDay(seed, Klima, Tag)`: eine Kette mit Erhaltungsneigung und Temperaturanomalie, je Monat aus den Klimadaten des Regionalpakets; die Vorhersage (`forecastFor`) liefert drei sichere Tage und vier Tendenztage mit Verlässlichkeit. Veranstaltungen sind Daten mit Terminregeln (`everyNthWeek`, `monthlyNthWeekday`, `yearlyNthWeekday`, `dateRange`, `heatwave`); ihr Status (geplant, angekündigt, läuft, beendet) folgt aus Datum und Uhrzeit (`eventCalendar.ts`). `environmentOf` bündelt Jahreszeit, Wetter, Temperatur und laufende Veranstaltungen je Spielminute (zwischengespeichert). Eine Veranstaltung kann ein Story-Flag verlangen (`EventDef.requiresFlag`), z. B. eine Tradition.

**Gründe:** Kein Speicherstand kann eine Veranstaltung doppelt starten oder ihre Wirkung „hängen lassen“; Wirkungen enden genau mit dem Ende der Veranstaltung. Die Vorhersage bleibt stabil, weil sie dieselbe Funktion wie das spätere Wetter nutzt. Savegames bleiben klein, ältere Stände brauchen keine Wetter- oder Eventmigration.

**Konsequenzen:** Inhaltsänderungen an Klima oder Terminen verändern auch Wetter und Termine bestehender Spielstände (gewollt: Inhalt hat Vorrang). Einmalige, nicht wiederholbare Ereignisse müssten künftig als Flag oder Erinnerung gespeichert werden.

### ADR-025 – Nachfrage als begrenzte Summe, die nur Wahrscheinlichkeiten verändert
**Status:** Entschieden (umgesetzt in Auftrag 05).

**Kontext:** Wetter, Temperatur, Jahreszeit, Wochentag, Tageszeit und Veranstaltungen sollen Kaufverhalten beeinflussen, ohne dass es Hintergrundverkäufe gibt.

**Entscheidung:** Nachfrage je Produkt ist `D = clamp(B + W + E + S + T)` aus Inhaltsdaten (`demand.ts`, Schlüssel `tag:`, `category:` oder Produkt-ID). Sie wirkt nur an zwei Stellen: als Gewichtsfaktor bei der Wunschauswahl der Bewohner (`wishDemandFactor`) und, über `visitorBonus` der Veranstaltungen und die persönliche `weatherResponse` der Bewohner, auf die Wahrscheinlichkeit ihrer Routinen (`routineChance`). Verkauft wird weiterhin nur über `economy.completeSale`. Der Kalender zeigt Nachfragepfeile relativ zu einem üblichen Tag (bewölkt, 18 °C, keine Veranstaltung).

**Konsequenzen:** Nachfrage ist nachvollziehbar und testbar, aber kein Marktmodell; Preise bleiben fest (ADR-015).

### ADR-026 – Spezialitäten als Rezept über das bestehende Lager, Qualität und Bekanntheit im Spielstand
**Status:** Entschieden (umgesetzt in Auftrag 05).

**Kontext:** Die erste Spezialität „Frikadelle im Brötchen“ soll vom Zutateneinkauf bis zum Kultstatus spielbar sein, ohne doppelte Lagerlogik oder Küchenmanagement.

**Entscheidung:** Zutaten sind normale Katalogprodukte mit der Lagerart `ingredient` (bestellbar, nur im Lager, nie auf einem Warenplatz, nie verkäuflich; Richtpreis = Einkaufspreis). Ein `RecipeDef` nennt Zutaten je Durchgang, optionale Zutaten mit Qualitätsbonus, Durchgangsgröße, Spielminuten und Qualitätsparameter. `specialty.startProduction` verbraucht die Zutaten sofort; nach der Spielzeit kommen die fertigen Einheiten ins Lager und werden wie jede Ware eingeräumt und über die Verkaufsdomäne verkauft. Qualität = Grundwert + Rezeptstufe + optionale Zutaten + Übung (gedeckelt). Jeder Verkauf an einen Bewohner erzeugt eine Bewertung (Qualität, Beziehung, Vorlieben, kleiner deterministischer Wurf); Bekanntheit wächst aus Zufriedenheit, Wiederholungskäufen und Empfehlungen (einmal je Bewohner, mit Erinnerung). Stufen (Erster Versuch, Geheimtipp, Kultstatus) verlangen Bekanntheit, Verkäufe, Wiederholungskäufer, Empfehlungen **und** eine Mindestzufriedenheit; sie setzen Story-Flags, die Wünsche, Dialoge, Platzierungen (I-014, I-015) und die Tradition „Frikadellen-Freitag“ freischalten.

**Konsequenzen:** Weitere Spezialitäten sind reine Daten. Der Wareneinsatz der Spezialität wird über ihren festen Einkaufspreis gebucht (Näherung der Zutatenkosten), der tatsächliche Zutateneinkauf erscheint als Einkauf. Ein dauerhaft schlechtes Produkt erreicht den Kultstatus nie (getestet).

### ADR-027 – Gäste zu Veranstaltungen sind normale Bewohner mit bedingten Routinen
**Status:** Entschieden (umgesetzt in Auftrag 05).

**Entscheidung:** Ole (N-008) und Hilde (N-009) sind gewöhnliche `NpcDef` mit Routinen, die nur bei laufender Veranstaltung (Bedingung `eventActive`) gelten; mit dem Kultstatus kommen sie zusätzlich am Frikadellen-Freitag. Ihre Figuren sind GLB aus der Pipeline von ADR-023 (`n-008.glb`, `n-009.glb`); bis zum Laden und bei Fehlern gilt die neutrale prozedurale Figur. Wetter- und Veranstaltungsdialoge stehen in einer eigenen Datei und werden beim Zusammenbau des Pakets den Bewohnern zugeordnet.

**Konsequenzen:** Keine Sonderlogik für Gäste; Simulation, Gespräche, Verkäufe und Speicherung gelten unverändert.

### ADR-028 – Haushalte als soziale Gruppe ohne gemeinsame Steuerung
**Status:** Entschieden (Architektur umgesetzt in Auftrag 05; Inhalte bisher nur Ein-Personen-Haushalte).

**Entscheidung:** `HouseholdDef` (Art, Name, Wohnort, Mitglieder) ist Inhalt; `NpcDef.householdId` verweist darauf. Jedes Mitglied behält eigene Routine, Geldbörse (`purseCents`: Wünsche, die es nicht bezahlen kann, werden nicht gewählt), Vorlieben, Beziehungen und Erinnerungen. Der Spielstand hält je Haushalt nur Gemeinsames: `households[id].memories` (erlebte Veranstaltungen eines Mitglieds), abfragbar über die Bedingung `householdMemory`. Die Validierung prüft Mitgliedschaft, Eindeutigkeit und Mindestgröße je Art.

**Konsequenzen:** Familien, Paare und Wohngemeinschaften (z. B. später Familie Schneider) sind reine Daten; Altersgrenzen gelten weiter je Person über die Verkaufsregeln.

### ADR-029 – Savegame-Schema 4
**Status:** Entschieden (umgesetzt in Auftrag 05).

**Entscheidung:** Version 4 ergänzt `specialties` (Stufe, Bekanntheit, Rezeptstufe, Durchgänge, Lagerqualität, laufende Herstellung, Verkäufe, Bewertungen, Käufer, Empfehlungen, Stimmen) und `households`. Die Migration 3 → 4 legt beide leer an; unbekannte Einträge werden mit Warnung verworfen, fehlende ergänzt. Datum, Wetter, Vorhersage und Veranstaltungen werden nicht gespeichert (ADR-024). Ältere Migrationen 1 → 2 → 3 bleiben unverändert in der Kette.

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
**Status: Entschieden (2026-11-12), umgesetzt in Auftrag 03 (2026-11-13).** Durchlaufende Spielzeit: 1 Spielminute = 1 Sekunde (Öffnungstag 06–22 Uhr = 16 Minuten bei Tempo 1×), pausierbar, mit Vorspulen; der Tag endet mit einem Tagesabschluss.

**Umsetzung (so im Code):**
- Tempo 1×, 2× und 4× sowie Pause; alle Werte in `src/game/balance.ts` (`GAME_MINUTES_PER_SECOND`, `SPEEDS`, `DAY_START_MINUTE`, `DAY_END_MINUTE`).
- Die Uhr wird über `game.tick(dtSeconds)` aus dem festen Simulationsschritt des Loops getrieben und rechnet mit der übergebenen Zeit, ohne eigene Timer; ungültige Zeitschritte werden ignoriert, ein sehr großer Zeitschritt überspringt 22:00 nicht.
- Bei 22:00 Uhr bleibt die Uhr stehen (Phase `awaiting_close`) und wartet auf den ausdrücklichen Tagesabschluss; der Abschluss ist auch vorher möglich (mit Bestätigung, Restzeit entfällt), genau einmal je Tag. Danach beginnt der nächste Tag um 06:00 Uhr erst auf Bestätigung des Spielers.
- Regel für den geschlossenen Kiosk: Die Uhr läuft unabhängig von Tür und Verkaufsklappe und auch bei offenem Panel; sie steht nur bei Pause, bei 22:00 und nach dem Tagesabschluss. Es gibt keine unbemerkte Beschleunigung.
- Spielzeit und Tag stehen im Spielstand (Version 2).

**Auswirkung:** NPC-Routinen, Nachfrage und Events können auf `calendar` und die Signale `day.started`/`day.ended` aufsetzen. Die Geschwindigkeit bleibt ein Balancing-Wert.

### O-4 – Alkohol und Tabak
**Status: Entschieden (2026-11-12), umgesetzt in Auftrag 03 (2026-11-13).** Fiktives Bier und fiktive Tabakwaren sind verkaufbare Waren, jeweils mit Alterskennzeichen im Produktdatenmodell.

**Abweichung von der ursprünglichen Empfehlung:** Empfohlen war, Tabak nur als nicht verkaufbare Dekoration zu führen. Die Nutzerentscheidung hat Vorrang.

**Leitplanken, die weiter gelten:**
- Ausschließlich fiktive Marken und Verpackungen (CLAUDE.md, Abschnitt 4). Keine realen Tabak- oder Biermarken, keine nachgebildeten Packungsdesigns.
- Der Katalog (`02-roadmap-und-artwork-katalog.md`) verlangt Tabakwaren als „generische, nicht werbliche Requisiten". Das gilt für die Darstellung weiter: neutrale Packungen, keine Werbeflächen, keine verherrlichende Inszenierung.

**Die offene Frage ist beantwortet: Die Alterskontrolle ist eine echte Verkaufsschranke.** Umsetzung:
- Das Alterskennzeichen ist das Feld `minimumAge` (16 für die zwei fiktiven Biere, 18 für die zwei fiktiven Tabakwaren; andere Werte lehnt die Validierung ab). Es ist die einzige Quelle der Schranke; es gibt keine Sonderfälle für Produktnamen. (Der frühe Entwurf `ageRestricted` entfällt.)
- `economy.completeSale` lehnt einen Verkauf mit mindestens einer altersbeschränkten Zeile ohne `ageCheckConfirmed: true` mit `age_check_required` ab; ein gemischter Warenkorb wird als Ganzes abgelehnt. Die Prüfung gilt je Verkauf, die Bestätigung wird nirgends gespeichert und steht nicht im Spielstand.
- Die Kasse fragt mit einem standardmäßig nicht gesetzten Kontrollkästchen „Ausweis geprüft – Mindestalter (n) erreicht“, nennt bei Bedarf das höchste Mindestalter im Warenkorb und setzt die Bestätigung nach dem Verkauf und beim Schließen zurück.
- Darstellung: fiktive Marken, schlichte Etiketten (ein Band und der Name, ohne Zierformen), Tabak hinter der Theke, keine verherrlichende Inszenierung. Die Namen sind Arbeitstitel und rechtlich nicht geprüft.
- Die offene Frage für Phase 4, wer die Prüfung für NPC-Kunden bestätigt, ist in ADR-019 entschieden: Das Alter eines Bewohners kommt aus den Inhaltsdaten, die Bestätigung des Spielers ist nie ein Altersnachweis.

**Auswirkung:** Produktdatenmodell, Zielgruppe, eventuelle Altersfreigabe bei einer Veröffentlichung.

### O-5 – Hosting und Lizenz
**Empfehlung:** Später statisches Hosting (z. B. GitHub Pages); Lizenz vor einer Veröffentlichung klären. Blockiert Phase 1 nicht.

---

## Teil C – Bewusst nicht entschieden
Diese Themen werden erst geplant, wenn ihre Phase ansteht: Audio-Technik (Phase 6), ein eigenes Animationssystem für Figuren (für Phase 4 entschieden: leichtes Kit statt Framework, siehe ADR-021; für GLB-Figuren der `AnimationMixer` von Three.js, siehe ADR-023), LOD und Instancing-Strategie (bei nachgewiesenem Bedarf), Aufbau regionaler Pakete jenseits der Ordnerstruktur (nach dem Ruhrgebiets-Slice), Mehrsprachigkeit.
