# Auftrag 05 – Das lebendige Viertel

**Projekt:** BÜDCHEN-SIM  
**Phase:** 5  
**Status:** vorbereitet – Umsetzung erst nach Abschluss und Prüfung von Auftrag 04  
**Ziel:** Kalender, Wettervorhersage, Veranstaltungen, dynamische Nachfrage und die erste eigene Kiosk-Spezialität zu einer zusammenhängenden Viertelsimulation verbinden.

> **Arbeitsregel:** Dieser Auftrag ist die verbindliche fachliche Spezifikation. Claude Code muss vor der Implementierung den tatsächlichen Stand nach Auftrag 04 untersuchen. Versionsnummern, Schnittstellen und Dateipfade dürfen nicht ungeprüft vorausgesetzt werden.

---

## 1. Produktziel

Das Büdchen soll Teil eines lebendigen Viertels werden. Jahreszeit, Wetter, Wochentag und Veranstaltungen verändern Atmosphäre, Bewohnerverhalten, Besucheraufkommen und Nachfrage. Der Spieler kann anhand einer Wettervorhersage und des Veranstaltungskalenders vorausplanen, Waren bestellen und eigene Spezialitäten entwickeln.

Die Systeme müssen miteinander interagieren. Ein heißer Samstag mit Fußballspiel soll beispielsweise Wetter, NPC-Besuche, Kaufwünsche, Warenabsatz und Dialoge beeinflussen.

**Leitprinzip:** Die Welt lebt unabhängig vom Spieler, aber der Spieler kann ihren Verlauf durch seine Entscheidungen beeinflussen.

## 2. Verbindliche Produktentscheidungen

### 2.1 Spieljahr und Kalender

- Ein Spieljahr umfasst 365 Kalendertage; Schaltjahre korrekt 366 Tage.
- Das Spiel startet mit einem konfigurierten Startdatum.
- Keine Abhängigkeit von der echten Systemzeit.
- Das bestehende Zeitmodell bleibt erhalten: 1 Spielminute = 1 reale Sekunde, Spieltag 06:00–22:00 Uhr, pausierbar und vorspulbar, Halt bei 22:00 Uhr bis zum Tagesabschluss.
- Datum, Monat, Jahr, Kalendertag und Wochentag werden korrekt berechnet. Der Wochentag wird aus dem Datum abgeleitet und nicht redundant gespeichert.
- Jahreszeiten: Frühling März–Mai, Sommer Juni–August, Herbst September–November, Winter Dezember–Februar.
- Kalenderansicht mit aktuellem Datum, Wochentag, Jahreszeit und einer Übersicht der kommenden sieben Spieltage samt Veranstaltungen.

### 2.2 Wetter

Dynamische, deterministische Wetterentwicklung mit spielinterner Vorhersage. Die Vorhersage umfasst:
- heute, morgen und übermorgen mit Wetterzustand und Temperaturspanne;
- vier weitere Tage als längerfristige, ausdrücklich unsicherere Tendenz.

Wetterzustände:
1. Sonnig
2. Bewölkt
3. Leichter Regen
4. Starker Regen
5. Nebel
6. Schnee
7. Frost

Temperatur ist ein eigenständiger Wert. Jahreszeit und Wetterverlauf beeinflussen die Wahrscheinlichkeiten. Eine Vorhersage darf nicht beim Öffnen eines Menüs neu ausgewürfelt werden. Kurzfristige Vorhersagen bleiben stabil; längerfristige Prognosen dürfen nachvollziehbar angepasst werden.

### 2.3 Erste Kiosk-Spezialität

Der verbindliche Produktname lautet ausschließlich **„Frikadelle im Brötchen“**. Nicht „Frikadellen-Schrippe“ oder andere Alternativnamen verwenden.

### 2.4 Erste Veranstaltungen

Die fünf ersten Events sind:
1. Fußballspieltag
2. Straßenfest
3. Flohmarkt
4. Weihnachtszeit
5. Hitzewelle

Alle Marken, Veranstaltungen, Schilder, Vereinsbezüge und visuellen Assets bleiben fiktiv. Keine realen Vereinsnamen, Logos oder geschützten Designs verwenden.

---

## 3. Pflicht: Bestandsaufnahme vor Implementierung

Vor dem Schreiben von Gameplay-Code muss Claude den tatsächlichen Repository-Stand auf dem Entwicklungsbranch `claude/elegant-curie-17qulu` untersuchen. Niemals versehentlich auf `main` arbeiten. Nicht committete Änderungen anderer Arbeit dürfen nicht überschrieben werden.

Zu lesen und zu prüfen sind mindestens:
- `CLAUDE.md`, `README.md`, `docs/IMPLEMENTIERUNGSPLAN.md`
- `docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md`
- `docs/MODUL-UND-DATENVERTRAEGE.md`
- `docs/TECHNISCHER-IST-STAND.md`
- Aufträge 00 bis 04 und deren Abschlussberichte
- tatsächliche Entry Points, package scripts, Tests, Content- und Modulstruktur.

Gezielt untersuchen:
- Zeitfortschritt, Tageswechsel, Tagesabschluss und Ableitung des Wochentags;
- NPC-Daten, Routinen, Bewegung, Dialoge, Beziehungen, Erinnerungen und Kundenkäufe;
- vorhandene Event-/Message-Infrastruktur;
- Produktkatalog, Lager, Lieferungen, Transaktionen und `economy.completeSale`;
- Savegame-Version, Datenverträge und sämtliche Migrationen;
- Wetter-/Kalender-/Eventcode, falls bereits vorhanden;
- Testergebnisse, offene Fehler und Performancegrenzen.

Erstelle `docs/PHASE-05-BESTANDSAUFNAHME.md` mit:
1. tatsächlichem technischen Stand;
2. wiederverwendbaren Modulen und Schnittstellen;
3. notwendigen Erweiterungen;
4. Abweichungen zwischen Dokumentation und Code;
5. Risiken und Abhängigkeiten;
6. angepasster Implementierungsreihenfolge.

**Keine Schnittstellen erfinden und keine vorhandene Architektur duplizieren.** Wenn Auftrag 04 nicht vollständig abgeschlossen oder kritische Voraussetzungen nicht erfüllt sind, zunächst den Befund dokumentieren und abhängige Implementierung stoppen. Keine stillschweigende Umgehung offener Phase-4-Probleme.

---

## 4. Architektur- und Qualitätsregeln

Die vorhandenen Schichtengrenzen bleiben verbindlich:
- `game` kennt weder Three.js noch DOM oder konkrete Contentdateien.
- `world` stellt Spielzustände dar, ist aber nicht deren Quelle.
- `ui` und `world` importieren einander nicht.
- `core` kennt keine konkreten Produkte, NPCs oder Quests.
- Savegames sind versioniert; Three.js-Objekte werden niemals serialisiert.
- Contentdaten und Simulationslogik bleiben getrennt.

Weitere Regeln:
- Bestehende Systeme erweitern, nicht parallel neu bauen.
- Bestehende Wirtschaft und `economy.completeSale` weiterverwenden.
- Alle Zufallsentscheidungen kontrolliert und reproduzierbar gestalten. Kein unkontrolliertes `Math.random()`.
- Gleicher Spielstand, gleicher Seed und gleicher Simulationsfortschritt müssen reproduzierbare Ergebnisse liefern.
- Menüs öffnen/schließen oder UI neu rendern darf keinen Spielzustand verändern.
- Keine unnötigen Frameworks oder Abhängigkeiten.
- Artstyle: stylized 3D, Low-/Mid-Poly, warme Beleuchtung, klare Silhouetten und glaubwürdige Gebrauchsspuren.
- Ausschließlich originäre, fiktive Marken, Verpackungen, Schilder und Assets.

Die nachfolgend genannten Dateinamen und Modulpfade sind Architekturvorschläge, keine Behauptung über die bestehende Struktur. Vorhandene passende Module sind zu erweitern.

---

## 5. Arbeitspaket 5.1 – Kalender und Jahreszeiten

Ein eigenständiges, deterministisches und testbares Kalendersystem implementieren.

Funktionen:
- konfiguriertes Startdatum;
- korrektes Datum, Monat, Jahr und Wochentag;
- Monats-, Jahres- und Schaltjahrwechsel;
- Ableitung der Jahreszeit;
- Kalenderansicht;
- Übersicht der kommenden sieben Spieltage;
- Anzeige besonderer Termine und Veranstaltungen.

Die Jahreszeit muss in der Welt sichtbar werden, ohne für jede Saison eine vollständig neue Umgebung zu bauen. Modulare Veränderungen an Licht, Vegetation, Dekoration und Umgebung bevorzugen.

**Abnahme:**
- Monats- und Jahreswechsel korrekt;
- Schaltjahre korrekt;
- Wochentagsberechnung korrekt;
- Kalenderzustand bleibt nach Speichern und Laden erhalten;
- alte Spielstände werden sicher migriert.

---

## 6. Arbeitspaket 5.2 – Wetter und Vorhersage

### 6.1 Simulationsdaten

Mindestens verwalten:
- aktuellen Wetterzustand;
- Temperatur;
- Zeitpunkt/Spielzeit;
- Vorhersagezustand und Vorhersagequalität;
- Seed beziehungsweise reproduzierbare Zustandsdaten.

### 6.2 Vorhersage

Heute, morgen und übermorgen werden mit Wetterzustand und Temperaturspanne dargestellt. Vier weitere Tage zeigen eine grobe Tendenz mit klarer Unsicherheitskennzeichnung.

Die Vorhersage muss eine echte Planungsgrundlage sein. Der Spieler soll beispielsweise vor einer Hitzewelle zusätzliche Getränke und Eis bestellen können.

### 6.3 Darstellung in der 3D-Welt

Je nach Zustand:
- Regen- und Schneepartikel mit begrenzter Anzahl;
- Anpassung von Licht, Himmelsfarbe und Atmosphäre;
- nasse Oberflächen bei Regen;
- optionale Windbewegung von Vegetation/Dekoration;
- passende Wettergeräusche.

Visuelle Effekte gehören in die World-Schicht. Die Spiellogik darf keine Three.js-Objekte kennen. Wettereffekte müssen abschaltbar beziehungsweise reduzierbar sein, ohne die Simulation zu verändern. Partikel, Draw Calls und Speicherverbrauch begrenzen.

### 6.4 Gameplayeffekte

- Sonne/Hitze: mehr Nachfrage nach Kaltgetränken und Eis, mehr Außenaufenthalte.
- Regen: weniger Laufkundschaft und kürzere Außenaufenthalte.
- Frost/Schnee: veränderte Nachfrage, weniger Außenaufenthalte.
- Nebel: atmosphärische Darstellung und gegebenenfalls angepasstes Passantenaufkommen.

Effekte müssen ausgewogen sein. Schlechtes Wetter darf den Spieler nicht wirtschaftlich ruinieren.

**Abnahme:**
- alle sieben Wetterzustände funktionieren;
- Temperatur wird berücksichtigt;
- Wetter und Vorhersage sind reproduzierbar;
- Öffnen/Schließen der UI verändert die Vorhersage nicht;
- Wetter ist visuell erkennbar;
- Wetter beeinflusst Nachfrage und NPC-Verhalten;
- Zustand übersteht Neustart und Laden.

---

## 7. Arbeitspaket 5.3 – Eventsystem

Einen modularen, datengetriebenen Eventmanager implementieren.

Jedes Event besitzt mindestens:
- stabile ID, Name und Beschreibung;
- Start-/Enddatum und bei Bedarf Uhrzeit;
- Auslösebedingungen;
- Status;
- betroffene Produktgruppen;
- Nachfrage- und Besucherwirkungen;
- NPC-Reaktionen/Dialogmarker;
- optionale Dekorationen;
- optionale Erinnerungsmarker.

Eventzustände:
1. Geplant
2. Angekündigt
3. Aktiv
4. Abgeschlossen

Events dürfen nicht doppelt starten. Effekte müssen nach Ende vollständig zurückgenommen werden. Der Spieler soll bevorstehende Events im Kalender sehen.

### 7.1 Fußballspieltag
- Ankündigung im Kalender;
- zusätzliche Fans/Besucher;
- veränderte NPC-Routinen und Dialoge;
- höhere Nachfrage nach passenden Getränken und Snacks;
- mögliche Erinnerungen nach dem Event.

Kein vollständiges Fußballspiel und kein Stadion erforderlich.

### 7.2 Straßenfest
- mehr Besucher;
- Begegnungen und besondere Dialoge;
- veränderte Nachfrage;
- optionale Dekorationen.

### 7.3 Flohmarkt
- zusätzliche Laufkundschaft;
- veränderte Besuchergruppen;
- passende Dialoge und Atmosphäre.

### 7.4 Weihnachtszeit
- saisonale Dekoration;
- besondere Dialoge;
- angepasste Nachfrage und Atmosphäre.

### 7.5 Hitzewelle
- wetterabhängig ausgelöst;
- erhöhte Nachfrage nach Eis und Kaltgetränken;
- veränderte NPC-Aufenthalte.

**Abnahme:**
- alle fünf Events sind datengetrieben;
- Ankündigung, Start und Ende funktionieren;
- keine doppelte Aktivierung;
- Effekte werden korrekt zurückgenommen;
- Fortschritt ist savegamefest;
- relevante NPCs reagieren auf Events.

---

## 8. Arbeitspaket 5.4 – Nachfrage und Warenwirtschaft

Das bestehende Wirtschaftssystem erweitern. Keine parallele Waren-, Kassen- oder Verkaufslogik.

Die Nachfrage beeinflusst die Wahrscheinlichkeit von NPC-Besuchen und Käufen, erzeugt aber **niemals automatische Hintergrundverkäufe**.

Einflüsse:
- Produktgrundnachfrage;
- Wochentag und Tageszeit;
- Jahreszeit;
- Wetter und Temperatur;
- aktive Veranstaltungen;
- individuelle NPC-Vorlieben.

Empfohlenes, begrenztes Modell:

`D = clamp(B + W + E + S + T, D_min, D_max)`

Dabei stehen B für Grundnachfrage, W für Wetter/Temperatur, E für Events, S für Saison/Wochentag und T für Tageszeit. Werte müssen datengetrieben und balancierbar sein. Keine unkontrollierte Multiplikation von Faktoren.

Die Nachfrage beeinflusst:
- welche NPCs erscheinen;
- wann sie erscheinen;
- welche Produkte sie bevorzugen;
- wie wahrscheinlich ein Kaufwunsch ist;
- wie viele potenzielle Kunden das Viertel besuchen.

Tatsächliche Verkäufe laufen weiterhin über `economy.completeSale`. Bestehende Alterskontrolle, Lagerprüfung, Transaktionen und NPC-Zuordnung bleiben verbindlich.

**Abnahme:**
- Nachfrage reagiert auf Wetter, Events, Saison, Wochentag und Tageszeit;
- NPC-Kaufverhalten berücksichtigt Nachfrage;
- keine automatischen Verkäufe;
- Lager, Kasse und Transaktionen bleiben konsistent;
- Berechnung ist deterministisch und isoliert testbar.

---

## 9. Arbeitspaket 5.5 – Spezialität „Frikadelle im Brötchen“

Die erste vollständig spielbare Kiosk-Spezialität entwickeln. Das System soll später weitere Spezialitäten ermöglichen, Phase 5 implementiert aber nur diese eine vollständig.

### 9.1 Zutaten

Für die erste Version:
- Frikadellenmasse;
- Brötchen;
- Senf;
- optional Zwiebeln.

Zutaten sollen nach Möglichkeit über das vorhandene Waren- und Lagerverwaltungssystem gekauft und verwaltet werden. Falls neue Produktarten nötig sind, bestehende Datenmodelle kontrolliert erweitern. Keine doppelte Lagerlogik.

### 9.2 Rezept und Produktion

Rezeptdaten enthalten:
- stabile Rezept-ID;
- Zutaten und Verbrauch pro Einheit;
- Produktionszeit;
- Produktionsmenge;
- Qualitätsparameter.

Der Spieler kann Zutaten prüfen, Produktionsmenge wählen und Herstellung starten. Die Produktion benötigt Spielzeit. Sie verbraucht Zutaten und erzeugt eine definierte Menge fertiger Produkte. Fertige Einheiten werden gelagert und über die bestehende Verkaufsdomäne verkauft.

Keine sofortige Herstellung ohne Zeitaufwand und kein komplexes Küchenmanagement.

### 9.3 Qualität

Ein einfaches, nachvollziehbares Modell aus:
- Rezeptqualität;
- Zutatenqualität;
- Entwicklungsstufe;
- optional Frische der Zutaten.

Keine Hygiene-, Kühlketten- oder Temperaturmanagementsimulation in diesem Auftrag.

### 9.4 Bekanntheit und Entwicklungsstufen

**Stufe 1 – Erster Versuch**
- erste Charge herstellen;
- Kunden probieren;
- Feedback erhalten;
- Qualität kennenlernen.

**Stufe 2 – Geheimtipp**
- wiederholte Verkäufe;
- Stammkunden empfehlen das Produkt;
- neue Dialoge;
- Bekanntheit wächst;
- Werbeschild wird freigeschaltet.

**Stufe 3 – Kultstatus**
- Spezialität wird im Viertel bekannt;
- Bewohner fragen gezielt danach;
- besondere Dekoration wird freigeschaltet;
- lokale Tradition entsteht.

Bekanntheit darf nicht nur von verkauften Einheiten abhängen. Berücksichtige Qualität, Zufriedenheit, Wiederholungskäufe, Empfehlungen und soziale Beziehungen. Ein dauerhaft schlechtes Produkt darf nicht automatisch Kultstatus erreichen.

### 9.5 Belohnungen
- neue Dialoge;
- stärkere Kundenbindung;
- zusätzliche Stammkunden;
- Dekoration/Beschilderung;
- Rezeptverbesserungen;
- lokale Tradition.

### 9.6 Wirtschaftliche Integration
- Zutaten besitzen Einkaufskosten;
- Produktion verbraucht Zutaten;
- Produktion erzeugt Warenbestand;
- Verkauf läuft über die vorhandene Verkaufslogik;
- Umsatz und Kosten erscheinen korrekt in der Tagesabrechnung;
- NPC-Verkäufe werden korrekt zugeordnet.

### 9.7 UI
Übersichtlich darstellen:
- Rezept und Zutatenbestand;
- Produktionsmenge und -fortschritt;
- fertigen Bestand;
- Qualität;
- Bekanntheit und Kundenfeedback;
- nächste Entwicklungsstufe.

**Abnahme – vollständiger Spielkreislauf:**
1. Zutaten einkaufen;
2. Zutaten lagern;
3. Rezept auswählen;
4. Produktion starten;
5. Produktionszeit abwarten;
6. fertige Produkte erhalten;
7. Produkt verkaufen;
8. Umsatz verbuchen;
9. Kundenfeedback erhalten;
10. Bekanntheit steigern;
11. Geheimtipp und Kultstatus erreichen.

---

## 10. Arbeitspaket 5.6 – Bewohner und Haushalte

Das vorhandene NPC-System erweitern, nicht neu bauen.

Bewohner reagieren auf Regen, Hitze, Frost, Schnee, Nebel und relevante Veranstaltungen. Reaktionen müssen zur Persönlichkeit und Tagesroutine passen. Wetter darf nicht alle NPCs gleich behandeln.

Relevante Ereignisse können Erinnerungen erzeugen, zum Beispiel:
- Besuch beim Straßenfest;
- gemeinsamer Spieltag;
- Kauf der Frikadelle im Brötchen;
- Empfehlung der Spezialität.

### Haushaltsarchitektur

Ein Haushalt ist eine soziale Gruppe mehrerer eigenständiger NPCs, keine gemeinsam gesteuerte Spielfigur.

Jedes Familienmitglied besitzt eigene:
- Tagesroutine und Aufenthaltsorte;
- Geldbörse;
- Vorlieben;
- Beziehungen;
- Erinnerungen.

Der Haushalt kann gemeinsame Informationen besitzen:
- Familienzugehörigkeit;
- Wohnort;
- gemeinsame Ereignisse und Erinnerungen.

Familienmitglieder können unabhängig voneinander das Büdchen besuchen. Die vollständige Familie Schneider muss in Phase 5 noch nicht umgesetzt werden. Die Architektur muss Familien, Paare und Wohngemeinschaften später ermöglichen. Bei Kindern bleiben Schulzeiten, Alter und Altersbeschränkungen verbindlich.

**Abnahme:** Wetter-/Eventreaktionen funktionieren; individuelle NPC-Routinen bleiben eigenständig; Haushaltszugehörigkeit ist architektonisch vorgesehen, ohne Phase 4 zu destabilisieren.

---

## 11. Savegame und Migration

Zuerst die tatsächlich implementierte Savegame-Version nach Phase 4 feststellen.

Falls Version 3 bestätigt wird, Migration 3 → 4 implementieren. Falls nicht, den realen Migrationspfad korrekt fortsetzen. Alle älteren Migrationen müssen weiterhin funktionieren.

Persistente Daten umfassen nach Bedarf:
- Spieljahr und Datum;
- Wetter-Seed, Zustand und Vorhersagezustand;
- geplante, aktive und abgeschlossene Events;
- Spezialitätenrezept, Entwicklungsstufe, Bekanntheit und Qualität;
- Produktionszustände und Zutatenbestand;
- neue NPC-Erinnerungen;
- Haushaltszugehörigkeiten, sofern implementiert.

Nur Daten speichern, die nicht sicher reproduzierbar sind. Keine Three.js-Objekte serialisieren.

Migration ausdrücklich testen: alten Stand laden, migrieren, speichern, Anwendung neu starten, erneut laden und Kalender, Wetter, Events, Waren sowie Spezialität kontrollieren.

---

## 12. UI und Spielerführung

Die neuen Ansichten in das vorhandene UI integrieren:
1. Kalender und Wetter;
2. Eventübersicht;
3. Spezialitätenverwaltung.

Keine parallele UI-Technologie und keine unnötigen Menüs.

Der Spieler muss erkennen können:
- aktuelles Datum und Jahreszeit;
- aktuelles Wetter und Vorhersage;
- bevorstehende Events;
- erwartete Nachfrageveränderungen;
- Zutaten, Produktionsfortschritt und Entwicklung der Spezialität.

Die Vorhersage soll konkrete Einkaufsentscheidungen ermöglichen.

---

## 13. Verbindlicher Integrationstest

Folgendes Szenario muss nachvollziehbar spielbar und so weit wie möglich automatisiert getestet werden:

**Heißer Samstag mit Heimspiel**
1. Wettervorhersage kündigt Hitzewelle an.
2. Kalender kündigt Fußballspieltag an.
3. Spieler bestellt zusätzliche Getränke und Zutaten.
4. Samstag beginnt; Wetter entspricht der Vorhersage.
5. NPC-Besucherzahlen und Kaufwünsche verändern sich.
6. Spieler produziert Frikadelle im Brötchen.
7. Stammkunden kaufen die Spezialität.
8. Event beeinflusst Dialoge und Bewohnerverhalten.
9. Event endet; Effekte werden zurückgenommen.
10. Tagesabschluss weist Kosten, Verkäufe und Erlöse korrekt aus.
11. Neustart erhält den gesamten Fortschritt.

---

## 14. Tests und Qualitätssicherung

Nach jedem Arbeitspaket passende Tests ausführen. Mindestens die vorhandenen Skripte:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run check:browser`

Vorher package scripts prüfen. Nicht vorhandene Skripte nicht als ausgeführt melden.

Testbereiche:
- Kalender: Monats-/Jahreswechsel, Schaltjahr, Wochentag, Migration;
- Wetter: deterministische Erzeugung, Vorhersagestabilität, saisonale Verteilung, Übergänge;
- Events: Start/Ende, keine Doppelaktivierung, Rücknahme, Persistenz;
- Nachfrage: alle Faktoren, Begrenzung, keine automatischen Verkäufe;
- Spezialität: Zutatenverbrauch, Produktionszeit, Menge, Qualität, Verkauf, Abrechnung, Bekanntheit;
- NPCs: Wetter-/Eventreaktionen, individuelle Routinen, Haushaltsdaten.

Browserprüfung und Screenshots mindestens von:
- Kalender;
- Wettervorhersage;
- Regen in der 3D-Welt;
- winterlicher Atmosphäre;
- aktivem Fußballspieltag;
- Herstellung der Frikadelle im Brötchen;
- Spezialität mit Kultstatus;
- vollständigem Beispielszenario.

Headless-Performance ist kein Nachweis für echte Grafikhardware. Browser, Auflösung, Testdauer und Einschränkungen dokumentieren.

---

## 15. Abgrenzung – ausdrücklich nicht Teil von Phase 5

- vollständige Stadt oder neue Stadtteile;
- 20–30 vollständig ausgearbeitete Bewohner;
- vollständige Familienkampagne;
- komplexes Restaurant-/Küchenmanagement;
- Hygiene- oder Kühlkettenmanagement;
- dynamische Wirtschaft sämtlicher Geschäfte;
- vollständige Fußballsimulation oder Stadion;
- Multiplayer;
- komplexe Verkehrs- oder Passantensimulation;
- umfangreiche neue Questkampagne.

Die Architektur darf spätere Erweiterungen nicht verhindern. Der Umfang dieses Auftrags bleibt aber verbindlich begrenzt.

---

## 16. Arbeitspakete und Commit-Strategie

In dieser Reihenfolge umsetzen:
1. 5.1 Kalender und Jahreszeiten;
2. 5.2 Wetter und Vorhersage;
3. 5.3 Eventsystem;
4. 5.4 Nachfrage und Warenwirtschaft;
5. 5.5 Frikadelle im Brötchen;
6. 5.6 Integration und Qualitätssicherung.

Jedes Paket muss build-, test- und integrationsfähig sein. Nach jedem Paket:
- Typecheck, Lint und relevante Tests;
- Build;
- Git-Status kontrollieren;
- Dokumentation aktualisieren;
- nachvollziehbaren Commit erstellen.

Keine fremden Änderungen überschreiben und keine Änderungen an `main`. Wenn ein Paket nicht abgeschlossen werden kann, Status und Blocker dokumentieren; nicht als erfolgreich voraussetzen.

---

## 17. Dokumentation und Abschlussbericht

Aktualisieren:
- `README.md`;
- `docs/IMPLEMENTIERUNGSPLAN.md`;
- `docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md`, falls neue Entscheidungen erforderlich sind;
- `docs/MODUL-UND-DATENVERTRAEGE.md`;
- technische Dokumentation und Asset-/Contentregister.

Erstellen:
- `docs/PHASE-05-BESTANDSAUFNAHME.md`;
- `docs/PHASE-05-ABSCHLUSSBERICHT.md);
- passende Screenshots;
- gegebenenfalls neue ADRs.

Der Abschlussbericht enthält:
1. umgesetzte Funktionen;
2. neue und geänderte Dateien;
3. Architekturentscheidungen;
4. tatsächliche Savegame-Version und Migration;
5. Testergebnisse;
6. Browserprüfungen und Screenshots;
7. Performancebeobachtungen;
8. bekannte Fehler und offene Einschränkungen;
9. Branch und Commit-Hashes.

Unterscheide strikt zwischen tatsächlich ausgeführten Tests, dokumentierten Ergebnissen, manuellen Prüfungen und nicht geprüften Funktionen. Keine vollständige Abnahme melden, solange kritische Kriterien offen sind.

---

## 18. Definition of Done

Phase 5 ist abgeschlossen, wenn:
- Kalender und Jahreszeiten korrekt funktionieren;
- Wetter und Vorhersage deterministisch und spielrelevant sind;
- alle fünf Events korrekt starten, wirken und enden;
- Nachfrage NPC-Kaufverhalten beeinflusst, ohne Hintergrundverkäufe;
- Frikadelle im Brötchen vom Einkauf der Zutaten bis zum Verkauf vollständig spielbar ist;
- die Bekanntheitsstufen Geheimtipp und Kultstatus erreichbar sind;
- Bewohner auf Wetter und Events reagieren;
- Haushaltsarchitektur spätere eigenständige Familienmitglieder ermöglicht;
- Savegame-Migration und bestehende Spielstände funktionieren;
- Typecheck, Lint, Tests, Build und Browserprüfung erfolgreich sind;
- Dokumentation und Abschlussbericht vollständig sind.

## 19. Zielbild

Es ist ein Samstag im Juli im Ruhrgebiet. Der Spieler hat in der Vorhersage eine Hitzewelle gesehen. Im Kalender steht ein Heimspieltag. Er hat zusätzliche Getränke bestellt und Zutaten vorbereitet.

Das Viertel wird lebendig. Bewohner sprechen über das Spiel. Fans kommen vorbei. Die Nachfrage nach Kaltgetränken steigt. Stammkunden kaufen die inzwischen bekannte **Frikadelle im Brötchen**.

Am Abend wird abgerechnet. Das Büdchen ist nicht mehr nur ein Verkaufsraum, sondern ein fester Bestandteil des Viertels.

**Entwickle genau dieses Spielerlebnis – technisch sauber, modular, nachvollziehbar und innerhalb des definierten Umfangs.**
