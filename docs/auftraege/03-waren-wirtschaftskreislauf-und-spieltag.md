# Auftrag 03 – Waren, Wirtschaftskreislauf und Spieltag

**Priorität:** P1 – Phase 3  
**Voraussetzung:** Auftrag 01 und 02 abgeschlossen; O-3 und O-4 sind laut `docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md` am 2026-11-12 entschieden.  
**Ziel:** Aus dem ausgestalteten Kiosk wird ein spielbarer Betrieb: Waren einkaufen, Lieferung annehmen, einräumen, verkaufen, Geld verdienen und den Tag abrechnen. Die Spielzeit läuft nach dem bestätigten Zeitmodell.

Dieser Auftrag ist eine konkrete Entwicklungsanweisung. Er muss gegen den tatsächlichen Code umgesetzt werden. Keine Architektur neu erfinden und keine vorhandenen Funktionen überschreiben, ohne ihre Aufgabe und Tests zu verstehen.

## 1. Pflichtlektüre und Bestandsaufnahme

Vor Änderungen vollständig lesen:
- `CLAUDE.md`
- `README.md`
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

Prüfe aktuellen Branch, Arbeitsbaum, package scripts, Game-Fassade, Savegame/Migrationen, Layout-/Asset-Katalog, UI, Welt-Loop und Tests. Erstelle zuerst einen kurzen Umsetzungsplan mit betroffenen Dateien und Reihenfolge. Bestehende Nutzeränderungen niemals verwerfen.

## 2. Verbindliche Produktentscheidungen

### O-3 – Spielzeit
- Eine Spielminute entspricht einer realen Sekunde.
- Öffnungstag ist zunächst 06:00 bis 22:00 Uhr (16 reale Minuten bei Normaltempo).
- Zeit muss pausierbar und vorspulbar sein.
- Tagesabschluss erfolgt um 22:00 Uhr oder über eine explizite, bestätigte Aktion, sofern die Tagesabschlussregeln erfüllt sind.
- Zeitgeschwindigkeit als zentraler Balancing-Wert konfigurieren, nicht an mehreren Stellen fest verdrahten.
- Zeit und Tag müssen gespeichert und nach Laden korrekt fortgesetzt werden.

### O-4 – Altersbeschränkte Waren
- Fiktives Bier und fiktive Tabakwaren sind verkaufbar.
- Das Produktmodell führt ein eindeutiges Alterskennzeichen.
- Ausschließlich fiktive Marken und neutrale, nicht werbliche Verpackungen. Keine realen Marken, Logos, Packungsdesigns oder Vereinszeichen.
- Alterskontrolle muss eine echte Verkaufsschranke sein und darf nicht nur ein optisches Label bleiben.
- Keine verherrlichende Inszenierung; Darstellung bleibt sachlich.

## 3. Wirtschaftliches Datenmodell

Entwickle die Domänenmodelle in `src/game/` und die regionalen Definitionen in `src/content/regions/ruhrgebiet/`. Die konkreten Typen dürfen an den Ist-Code angepasst werden, müssen aber folgende Konzepte abbilden:

### Produktdefinition
Jedes Produkt erhält:
- stabile Inhalts-ID mit Präfix `product.`, die nach Vergabe nicht mehr umbenannt oder wiederverwendet wird,
- Anzeigename und fiktive Markenfamilie,
- Kategorie (mindestens Getränke, Snacks, Süßwaren, Eis, Backwaren, Presse/Zeitschriften, Alltagsbedarf; Bier und Tabakwaren als klar erkennbare Untergruppen),
- Einkaufspreis und vorgeschlagenen Verkaufspreis in ganzen Cent,
- Lager-/Präsentationsanforderung (z. B. Regal, Kühlung, Tiefkühlung, Theke, Zeitschriftenständer),
- Mengen-/Platzbedarf und sinnvolle Kapazitätsangabe,
- Nachfrage-Tags als Daten, noch ohne komplexe dynamische Nachfrage,
- Alterskennzeichen bzw. Mindestalter, falls eingeschränkt,
- Asset-ID und visuelle Etikett-/Farbvariante.

Alle Geldwerte sind Integer-Cent. Keine Fließkomma-Geldrechnung. Einkaufspreis muss kleiner als Verkaufspreis sein, sofern es kein ausdrücklich begründetes Sonderangebot ist. Preise und Bestände dürfen nicht negativ werden.

### Spielstand
Ergänze den serialisierbaren `GameState` mindestens um:
- Spieltag / Kalenderdatum in einer klar definierten, deterministischen Form,
- aktuelle Spielminute bzw. Uhrzeit,
- Zeitstatus (läuft/pausiert) und gewählte Geschwindigkeit,
- Kassenbestand / verfügbares Betriebskapital in Cent,
- Lagerbestand je Produkt,
- Warenbestand je Präsentationsplatz,
- offene Lieferung/Bestellung, sofern der Bestellablauf über mehrere Schritte läuft,
- Tagesumsatz, Einkaufsausgaben und Transaktionshistorie in angemessener, begrenzter Form.

Nur fachliche Daten und stabile IDs speichern. Niemals Three.js-Objekte oder DOM-Zustand serialisieren.

## 4. Erster Warenkatalog und 3D-Darstellung

Erstelle **20 bis 30 eigenständige, fiktive Produkte** mit nachvollziehbaren Preisrelationen und passenden Produktfamilien. Der Katalog soll ein glaubwürdiges Ruhrgebiets-Büdchen abbilden, nicht aus 30 Varianten desselben Getränks bestehen.

Mindestens enthalten:
- mehrere alkoholfreie Getränke (Wasser, Limonade, Cola-ähnliche Brause, Saft o. Ä.),
- fiktives Bier,
- Snacks und Knabberartikel,
- Schokolade/Süßwaren,
- Eis,
- mindestens ein Backwarenprodukt,
- Zeitschriften/Presse,
- ein kleiner Alltagsbedarfsartikel,
- fiktive Tabakwaren.

Nutze die bestehenden Asset-IDs und das Artwork-Register. Falls Produkt-Assets noch nicht registriert sind, ergänze das Register mit eindeutigen P-IDs. Mehrere Produkte dürfen eine gemeinsame Modellfabrik verwenden, wenn Form und Verpackungstyp gleich sind; Etikett, Farbe, Größe und Beschriftung müssen die Produkte dennoch visuell unterscheidbar machen.

Anforderungen:
- stylized Low-/Mid-Poly passend zu Kiosk und Möbeln,
- klare Silhouetten und lesbare, fiktive Etiketten,
- keine realen Marken, keine nachgebildeten Verpackungen,
- keine bloßen schwebenden Farbkugeln als fertige Ware,
- sinnvolle Gruppierung und Platzierung auf Wandregal, Mittelregal, Kühlschrank, Eistruhe, Zeitschriftenständer und Theke,
- Produktdarstellung folgt dem fachlichen Bestand; leere Plätze bleiben leer.

Die Produktmodelle sind Darstellung. Produkt-ID, Bestand und Preis bleiben ausschließlich in `game`.

## 5. Lager, Warenplätze und Einräumen

Implementiere eine nachvollziehbare Bestandslogik:
- eingekaufte Ware landet zunächst im Lager,
- der Spieler kann verfügbare Mengen aus dem Lager auf passende Präsentationsplätze umlagern,
- ein Platz kann nur Produkte aufnehmen, deren Lager-/Präsentationsanforderung zur Rolle des Möbelstücks passt,
- Kapazitäten und belegte Plätze werden geprüft,
- niemals negative Mengen oder Überbelegung zulassen,
- Verkauf reduziert ausschließlich den Bestand am jeweiligen Verkaufsplatz; optional kann eine bewusst ausgelöste Nachfüllaktion aus dem Lager folgen.

Leite nutzbare Plätze aus stabilen Platzierungs-IDs und Rollen des bestehenden Layouts ab. Erfinde keine zweite, abweichende Möbelplatzierung. Wenn die bestehende Geometrie keine präzisen Slots besitzt, definiere zunächst eine einfache, typisierte Slot-Liste je Platzierung; dokumentiere Maße/Kapazität und halte sie unabhängig von Three.js.

## 6. Einkauf und Lieferung

Baue einen einfachen, gut verständlichen Einkaufskreislauf:
1. Spieler öffnet die Bestell-/Warenoberfläche.
2. Er wählt Produkte und Mengen.
3. Gesamtkosten werden vor Bestätigung angezeigt.
4. Bestellbestätigung prüft verfügbares Kapital und verhindert negative Kassenbestände.
5. Lieferung wird nachvollziehbar angenommen und dem Lager gutgeschrieben.
6. Einkaufsausgaben werden als Transaktion verbucht.

Kein komplexes Lieferanten-Netzwerk, keine Verhandlungen, keine dynamischen Einkaufspreise und keine Lieferfahrzeuge in diesem Auftrag. Eine einfache fiktive Lieferantenquelle genügt. Die Lieferung darf sofort oder nach einer kurzen, klar angezeigten Spielzeit eintreffen; entscheide dich für die einfachere robuste Variante und dokumentiere sie.

## 7. Verkauf, Kasse und Alterskontrolle

Implementiere eine echte Kassen-/Verkaufsoberfläche:
- Produkte und verfügbare Mengen übersichtlich anzeigen,
- Mengenwahl und Warenkorb,
- Zwischensumme und Gesamtsumme in Euro korrekt aus Cent berechnen,
- Verkauf nur bei ausreichendem Bestand,
- Verkauf bucht Bestand aus, erhöht Kassenbestand und Tagesumsatz,
- jeder Verkauf wird als Transaktion mit Zeit, Produkt-ID, Menge und Gesamtbetrag protokolliert,
- Abbruch des Vorgangs verändert keine Daten.

Alterskontrolle:
- Bei jedem altersbeschränkten Produkt muss vor Abschluss eine Altersprüfung erfolgen.
- Die UI fragt eindeutig nach bestätigter Altersprüfung (z. B. „Ausweis geprüft – Mindestalter erreicht“). Standardzustand ist nicht bestätigt.
- Ohne bestätigte Prüfung darf der Verkauf nicht abgeschlossen werden.
- Die Prüfung gilt nur für den aktuellen Verkaufsvorgang und wird nicht dauerhaft gespeichert.
- Altersschranken zentral aus Produktdaten ableiten; keine verstreuten Sonderfälle für einzelne Produktnamen.
- Diese Phase hat noch keine NPCs. Verwende deshalb einen expliziten, neutralen Kassenablauf statt vorgetäuschter Kunden-KI. Die spätere NPC-Integration muss dieselbe Verkaufsdomäne verwenden können.

## 8. Spieluhr und Tagesablauf

Ergänze eine deterministische Spielzeit:
- Startzeit 06:00 Uhr; Ende 22:00 Uhr.
- 1 Spielminute = 1 reale Sekunde bei Normaltempo.
- Pause und mindestens zwei Vorspulstufen (z. B. 2× und 4×).
- Zeitfortschritt erfolgt über den bestehenden Loop mit Delta-Zeit; keine eigenen Timer pro Feature.
- Große Frames/Deltas dürfen keine Zeit überspringen oder doppelte Tagesabschlüsse auslösen.
- Zeitstatus und Spielminute werden gespeichert.
- Tagesabschluss ist genau einmal pro Spieltag möglich und erzeugt eine Abrechnung mit Umsatz, Wareneinsatz/Einkaufsausgaben, weiteren im Auftrag vorhandenen Kosten und Tagesergebnis.
- Tagesabschluss zeigt eine verständliche Zusammenfassung und startet anschließend den nächsten Öffnungstag um 06:00 Uhr, wenn der Spieler bestätigt.
- Keine stillschweigende Geldgutschrift und kein automatisches Auffüllen von Waren.
- Wenn der Kiosk geschlossen ist, pausiert der Zeitfortschritt oder die Simulation verhält sich gemäß einer klar dokumentierten Regel. Keine unbemerkte Zeitbeschleunigung.

Die Zeitgeschwindigkeit ist ein Spiel-Balancing-Wert. Vermeide Echtzeit-Timer, die in Tests nicht deterministisch kontrolliert werden können. Domänenlogik erhält explizite Delta-Zeit bzw. Spielminuten.

## 9. Game-Fassade, Signale und Schichtentrennung

Die Spielregeln bleiben in `game`, UI bleibt DOM/CSS, Welt bleibt Three.js-Darstellung. `game` importiert weder `three` noch DOM-APIs noch konkrete Dateien aus `content`.

Erweitere die bestehende `Game`-Fassade mit klaren, benannten Aktionen, z. B.:
- `economy.placeOrder`, `economy.receiveDelivery`,
- `economy.restock`, `economy.setPrice` (nur falls Preisänderung in diesem Auftrag sinnvoll und vollständig),
- `economy.sell` / `economy.completeSale`,
- `economy.closeDay`,
- `calendar.pause`, `calendar.setSpeed`, `calendar.advance` bzw. `tick`.

Die endgültigen Namen dürfen dem bestehenden Stil folgen. Aktionen liefern typisierte Ergebnisse mit Ablehnungsgründen. Keine UI-Komponente darf Bestände, Preise oder Geld direkt ändern.

Führe die vorgesehenen typisierten Signale ein, soweit sie tatsächlich benötigt werden:
- `day.started`, `day.ended`,
- `product.stock.changed`,
- `sale.completed`,
- `money.changed`,
- gegebenenfalls `order.placed` und `delivery.received`.

Signale enthalten nur stabile IDs und einfache Werte. Interne Domänenabläufe verwenden direkte Funktionsaufrufe statt eines globalen Event-Bus.

## 10. Savegame und Migration

- Erhöhe `schemaVersion` und migriere vorhandene Version-1-Spielstände verlustfrei.
- Ein alter Spielstand muss weiterhin laden und Spielerposition, Tür und Klappe behalten.
- Definiere sinnvolle Anfangswerte für Betriebskapital, Spieltag, Zeit, Inventar und Tagesbuchhaltung.
- Lade-/Speicherfehler bleiben verständlich und dürfen nicht den Start der Anwendung blockieren.
- Teste Migration v1 → aktuelle Version, Speichern/Laden des neuen Zustands sowie ungültige/fehlende Produkt-IDs.
- Savegames dürfen keine flüchtigen UI-Zustände enthalten, insbesondere keinen Warenkorb und keine vorübergehende Altersbestätigung.

## 11. UI und Spielwelt

Die UI muss in der laufenden Anwendung bedienbar sein und zur bestehenden Gestaltung passen. Mindestens:
- kompaktes HUD mit Uhrzeit, Tag, Kassenbestand und Status (offen/geschlossen),
- Waren-/Bestandsansicht,
- Bestell-/Lieferansicht,
- Einräum-/Nachfüllansicht,
- Kasse mit Warenkorb und Altersprüfung,
- Tagesabschlussansicht.

Interaktionen sollen über verständliche Bedienelemente erreichbar sein. Nutze bestehende Interaktionspunkte und ergänze nur nötige, validierte Punkte. Der Spieler muss den Kiosk weiterhin begehen können; Menüs dürfen Steuerung und Kamera nicht versehentlich weiterlaufen lassen.

Die 3D-Welt zeigt Bestände sichtbar: Produkte erscheinen und verschwinden passend zu den Daten. Achte auf lesbare Mengen, keine überlappenden Modelle und sinnvolle Stapel-/Reihenanordnung. Die Darstellung muss bei leerem Bestand sauber reagieren.

## 12. Tests und Qualitätssicherung

Ergänze Unit- und Integrationstests mindestens für:
- Produktdatenvalidierung und stabile/unique IDs,
- Preise als Integer-Cent und ungültige Werte,
- Startkapital und Bestandsinitialisierung,
- Bestellung, Kapitalprüfung, Lieferung und Lagerzugang,
- Einräumen, Slot-Kompatibilität, Kapazität und Überbelegung,
- Verkauf, Bestand, Kassenbestand und Tagesumsatz,
- Alterskontrolle: gesperrt ohne Bestätigung, erfolgreich mit Bestätigung, Bestätigung nicht über Verkauf hinaus gültig,
- Tagesuhr: Normaltempo, Pause, Vorspulen, Tagesende, genau einmaliger Abschluss,
- Savegame-Migration v1 → neue Version und Rundlauf,
- Signale und unveränderte bestehende Tür-/Klappeninteraktionen.

Browserprüfung mit Playwright erweitern:
- Warenbestellung bis zur Lieferung,
- Ware einräumen und im 3D-Regal sichtbar machen,
- normaler Verkauf mit korrekter Geld-/Bestandsänderung,
- altersbeschränkter Verkauf ohne Prüfung blockiert und mit Prüfung möglich,
- Zeit pausieren/vorspulen und Tagesabschluss auslösen,
- keine unbehandelten Konsolenfehler.

Führe aus und dokumentiere:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run check:browser`

Screenshots aus der echten Anwendung:
- Innenraum mit bestückten Regalen,
- Kassen-/Verkaufsoberfläche,
- Warenverwaltung/Lager,
- Tagesabschluss.

Keine Testzahl erfinden und keine Funktion als fertig melden, wenn sie nur als statisches Mockup existiert.

## 13. Bewusst nicht Teil von Auftrag 03

- NPCs, Kunden-KI, Tagesroutinen und Dialoge (Phase 4).
- Beziehungen, Erinnerungen, Quests und soziale Geschichten (Phase 4).
- Wetter, Jahreszeiten, Spieltagevents und dynamische Nachfrage (Phase 5).
- Lieferantenverhandlungen, mehrere Lieferanten, dynamische Einkaufspreise.
- Rezepte und Kiosk-Spezialitäten.
- Visueller Einrichtung-Editor und frei platzierbare Möbel.
- Weitere Regionen, Mobile-/Touch-Optimierung und Audio.

## 14. Dokumentation und Abschlussbericht

Aktualisiere:
- `README.md`,
- `docs/TECHNISCHER-IST-STAND.md`,
- `docs/IMPLEMENTIERUNGSPLAN.md`,
- `docs/MODUL-UND-DATENVERTRAEGE.md`,
- `docs/artwork-prompts/07-artwork-register.md`,
- bei Bedarf ADRs und manuelle Prüfanleitung.

Dokumentiere den tatsächlichen Produktkatalog mit IDs, Kategorien, Preisen, Alterskennzeichen und Asset-IDs. Trenne implementiert, automatisiert getestet und manuell geprüft.

Abschlussbericht:
1. wichtigste Änderungen und betroffene Dateien,
2. Produktkatalog und Asset-Register,
3. Waren-/Slot-/Lagerlogik,
4. Einkauf, Verkauf, Alterskontrolle und Tagesabschluss,
5. Zeitmodell und Savegame-Migration,
6. Typecheck/Lint/Tests/Build/Browsercheck,
7. Screenshot-Pfade,
8. bekannte Einschränkungen,
9. Empfehlung für Phase 4.

**Definition of Done:** Der Spieler kann in der laufenden Anwendung Ware bestellen, erhalten, einräumen und verkaufen. Geld und Bestände bleiben konsistent. Altersbeschränkte Waren sind ohne bestätigte Altersprüfung nicht verkaufbar. Die Spieluhr läuft nach O-3, ist pausierbar und vorspulbar; Tagesabschluss und Savegame-Migration funktionieren.