# Auftrag 04 – Bewohner, Kundenverhalten und soziale Bindung

**Priorität:** P1 – Phase 4  
**Voraussetzung:** Auftrag 03 abgeschlossen; wirtschaftlicher Kern mit `economy.completeSale`, Spieluhr, Signalen und Savegame-Version 2 vorhanden.  
**Ziel:** Das Viertel bekommt wiederkehrende Menschen. Vier Bewohner sollen erkennbare Persönlichkeiten, Tagesabläufe, Vorlieben, Beziehungen und Erinnerungen besitzen. Der Spieler begegnet ihnen im Raum, spricht mit ihnen, trifft kleine Entscheidungen und erlebt, dass diese Entscheidungen später Folgen haben. Einige Bewohner kaufen tatsächlich Waren am Kiosk.

Dieser Auftrag ist ein spielbarer MVP, kein vollständiges Lebenssimulationssystem. Qualität und Glaubwürdigkeit der Figuren sind wichtiger als eine große NPC-Anzahl. Die drei Spielsäulen Wirtschaft, Gemeinschaft und Viertelleben müssen verbunden werden, aber Wetter und große Events gehören erst in Phase 5.

---

## 1. Pflichtlektüre und Bestandsaufnahme

Vor Änderungen vollständig lesen:
- `CLAUDE.md`
- `README.md`
- `docs/ARCHITEKTUR-ZIELBILD.md`
- `docs/IMPLEMENTIERUNGSPLAN.md`
- `docs/TECHNISCHER-IST-STAND.md`
- `docs/ARCHITEKTUR-ENTSCHEIDUNGEN.md`
- `docs/MODUL-UND-DATENVERTRAEGE.md`
- `docs/PRODUKTKATALOG.md`
- `docs/artwork-prompts/01-art-direction.md`
- `docs/artwork-prompts/02-roadmap-und-artwork-katalog.md`
- `docs/artwork-prompts/04-marken-und-produktwelt.md`
- `docs/artwork-prompts/06-threejs-asset-standard.md`
- `docs/artwork-prompts/07-artwork-register.md`

Prüfe Branch, Arbeitsbaum und tatsächliche Implementierung. Phase 3 liegt auf GameState-Schema 2. Untersuche insbesondere:
- `Game`-Fassade und Signale,
- Spieluhr und Wochentagsableitung,
- `economy.completeSale`, Warenbestand und Alterskontrolle,
- Interaktionspunkte und Welt-Kollision,
- Savegame-Migration und Validierung,
- Asset-Registry, Produktdarstellung und Browserprüfung.

Erstelle vor Änderungen einen knappen Plan mit betroffenen Dateien und Reihenfolge. Keine bestehenden Funktionen oder Nutzeränderungen überschreiben.

### 1.1 Phase-3-Vorabprüfung

Die dokumentierten Phase-3-Prüfwerte sind 370 Unit-/Integrationstests und 98/98 Browserchecks. Diese Zahlen nicht ungeprüft übernehmen: führe die vorhandenen Befehle erneut aus und dokumentiere tatsächliche Ergebnisse.

Prüfe zusätzlich folgende bekannte Grenzen aus dem Phase-3-Ist-Stand:
- Bestellungen und Warenannahme können laut aktuellem Vertrag während `awaiting_close` stattfinden; Warenumlagerung hat keine eigene Tagesphasen-Sperre.
- Verkauf ist während einer Pause möglich, solange Tag und Verkaufsklappe offen sind.
- Lieferung trifft sofort ein, muss aber angenommen werden.
- Preise sind noch nicht änderbar.
- Wochentag wird aus Tag 1 = Montag abgeleitet; ein echtes Datum existiert noch nicht.
- Es gibt noch keinen geseedeten Zufallsgenerator.
- Etiketten sind aus normaler Kameradistanz teilweise nicht lesbar; echte Grafikhardware wurde nicht geprüft.

Diese Punkte sind nicht automatisch Fehler. Dokumentiere, welche Regeln Phase 4 benötigt und welche unverändert bleiben. Ändere den Phase-3-Vertrag nicht stillschweigend. Wenn du einen tatsächlichen Fehler findest, ergänze einen gezielten, isolierten Fix samt Regressionstest und beschreibe ihn im Abschlussbericht. Keine größere Wirtschafts-Neuentwicklung in diesen Auftrag ziehen.

## 2. Leitbild für NPCs

NPCs sind Bewohner des Viertels, keine Quest-Automaten und keine zufälligen Statisten.

Jeder NPC benötigt:
- eine stabile ID mit Präfix `npc.`,
- Namen, Alter und kurze Biografie,
- Beruf oder Alltagssituation,
- Persönlichkeit mit 2–4 konkreten Eigenschaften,
- sichtbare Eigenheiten (Kleidung, Gangbild, Accessoire, Haltung),
- Tagesroutine und Besuchsfenster,
- bevorzugte Aufenthaltsorte und Wegpunkte,
- Produktvorlieben und Abneigungen über Produkt-IDs oder Nachfrage-Tags,
- Beziehungen zu anderen bekannten NPCs,
- Beziehungswert zum Spieler/Kiosk,
- gespeicherte Erinnerungs- und Quest-Flags,
- Dialoge, die auf Zeit, Beziehung und frühere Entscheidungen reagieren.

Die Figuren sollen nicht alle ständig am Kiosk stehen. Sie gehen ihrem Alltag nach, kommen zu plausiblen Zeiten vorbei, warten bei Bedarf, verlassen den Ort wieder und können sich untereinander kennen. Wiederholte Begegnungen müssen Kontinuität erzeugen.

**Keine Klischeefiguren:** Ruhrgebietsidentität entsteht über Sprache, Alltag, Orte, Humor und Verhalten – nicht über Karikaturen, Dialektübertreibung oder stereotype Berufe. Dialoge klingen natürlich, knapp und individuell. Keine realen Personen oder Marken verwenden.

## 3. Erste vier Bewohner

Setze vier wiederkehrende Figuren um. Namen und Details darf Claude passend zur Spielwelt ausgestalten; die folgenden Rollen und Kontraste sind verbindlich:

| Asset-ID | Rolle | Persönlichkeit und Funktion |
|---|---|---|
| N-002 | Langjähriger Stammkunde | kennt den Kiosk und das Viertel, beobachtet Veränderungen, trocken-humorvoll, aber nicht bloß nostalgisch |
| N-003 | Handwerker/in aus dem Viertel | praktisch, direkt, hilfsbereit; hat eigene Aufträge und kennt mehrere Bewohner |
| N-006 | Fahrradkurier/in | viel unterwegs, kommt zu wechselnden Tageszeiten, bringt Neuigkeiten aus anderen Straßenzügen |
| N-007 | Nachbar/in | kennt den Alltag rund um den Kiosk, pflegt Kontakte und kann kleine Nachbarschaftsgeschichten anstoßen |

N-001 „Kioskbetreiber“ bleibt die Spielerfigur und wird nicht als zusätzlicher NPC umgesetzt. N-004 Schülergruppe und N-005 Fußballfan bleiben für spätere Erweiterungen geplant.

Jede Figur muss sich optisch unterscheiden. Verwende die Asset-IDs aus dem Register. Wenn vorhandene N-Modelle nur geplant sind, erstelle passende prozedurale Figurenfabriken oder eine kleine, nachvollziehbare GLB-Pipeline. Keine bloßen farbigen Kapseln als fertige Figuren. Einfache Low-/Mid-Poly-Silhouetten mit Kopf, Rumpf, Armen, Beinen, Kleidung und charakteristischen Details reichen; Gesichtsdetaillierung bleibt stilisiert.

## 4. Datenmodell und Savegame

Entwickle typisierte, datengetriebene Verträge in `src/game/` und Inhalte in `src/content/regions/ruhrgebiet/`.

Mindestens erforderlich:

### NPC-Definition (`NpcDef`)
- `id`, `name`, `age`, `role`, `bio`,
- `assetId`,
- `personalityTags`,
- `routine` mit Wochentag(en), Start-/Endminute, Aktivität und Zielort,
- `waypointRoute` oder Verweis auf einen Weg,
- `likes` und `dislikes` als Produkt-IDs/Nachfrage-Tags,
- `relationships` zu anderen NPC-IDs,
- `dialogueIds`,
- optionale Besuchsbedingungen.

### Laufender NPC-Zustand
Speichere nur fachlich relevante Daten:
- aktueller Aufenthalts-/Routinenzustand,
- Position und Ziel/Wegpunkt, soweit für Savegame-Kontinuität nötig,
- Beziehung zum Kiosk/Spieler,
- dauerhafte Erinnerungs- und Story-Flags,
- letzter relevanter Besuch oder Dialogzeitpunkt,
- gegebenenfalls offene Kaufabsicht.

Keine Three.js-Objekte, Animationsmixer, DOM-Elemente, zufälligen UI-Zustände oder flüchtige Dialogfenster speichern.

### Beziehungssystem
- Beziehung als klar begrenzter, validierter Integerwert, z. B. 0–100.
- Definiere wenige verständliche Stufen (fremd, bekannt, vertraut, eng verbunden) mit nachvollziehbaren Schwellen.
- Entscheidungen und wiederholte Begegnungen verändern den Wert gezielt.
- Kein beliebiges Farmen durch wiederholtes Anklicken derselben Dialogoption.
- Beziehungen müssen Dialoge, Hilfsbereitschaft, Besuche oder Story-Freischaltungen sichtbar beeinflussen.

### Migration
- Erhöhe `schemaVersion` von 2 auf 3.
- Migration 2→3 ergänzt NPC-/Beziehungs-/Erinnerungszustand verlustfrei.
- Bestehende Position, Tür, Klappe, Zeit, Kassenstand, Lager, Warenplätze, Transaktionen und Tagesbericht bleiben erhalten.
- Version-1-Spielstände müssen weiterhin über 1→2→3 laden.
- Unbekannte NPC-/Dialog-/Quest-IDs werden kontrolliert verworfen und mit Warnung gemeldet.
- Teste Version 1→3, Version 2→3, aktuellen Rundlauf und beschädigte Daten.

## 5. Tagesabläufe, Bewegung und Aufenthaltsorte

Die bestehende Spieluhr ist die einzige Zeitquelle. Keine eigenen Echtzeit-Timer pro NPC.

Implementiere:
- mindestens drei unterscheidbare Aufenthaltsorte im erreichbaren Viertel (z. B. Kiosk, Gehweg-/Straßenecke, Hof-/Wartebereich),
- einen kleinen, handgepflegten Wegpunktgraphen mit stabilen IDs,
- vier Routinen, die die Tageszeit und den abgeleiteten Wochentag nutzen,
- sinnvolle Ankunfts- und Abgangszeiten,
- Zustände wie `away`, `walking`, `waiting`, `at_kiosk`, `talking` oder gleichwertige klare Zustände,
- einfache Geh- und Idle-Animationen,
- Kollision bzw. Wegführung, die verhindert, dass NPCs durch Wände, Theke oder Möbel laufen,
- sanfte Bewegungsübergänge und nachvollziehbare Blickrichtung.

Die NPCs dürfen nicht alle gleichzeitig am selben Punkt erscheinen. Wegpunkte und Zielorte müssen erreichbar und kollisionsfrei sein. Wenn ein Weg blockiert ist, muss die Figur warten oder eine definierte Alternative nutzen; nicht durch Hindernisse teleportieren.

**Performance:** vier aktive Figuren sind das Ziel. Keine unnötige Physik-Engine. NPC-Logik wird in festen Simulationsschritten aktualisiert und darf nicht pro Renderframe neue Objekte/Geometrien erzeugen.

### Determinismus
Führe einen kleinen geseedeten Zufallsgenerator ein oder nutze für diesen MVP deterministische, aus Tag/NPC-ID abgeleitete Entscheidungen. Bevorzugt wird eine zentrale, getestete RNG-Funktion mit gespeichertem Zustand, wenn sie sich sauber in die vorhandene Architektur einfügt. Keine Nutzung von `Math.random()` in spielrelevanter Logik.

Ein erneutes Laden desselben Spielstands darf nicht plötzlich andere Routineentscheidungen, Dialogfreischaltungen oder Questzustände erzeugen.

## 6. Interaktion und Dialogsystem

NPC-Interaktionen müssen sich wie die bestehenden Kiosk-Interaktionen anfühlen:
- Wenn der Spieler nahe genug an einem NPC steht und ihn sinnvoll ansehen kann, erscheint ein Interaktionshinweis.
- E oder Klick öffnet ein Dialogfenster.
- Das Dialogfenster zeigt kurze, charakteristische Aussagen und höchstens 2–4 klare Antwortmöglichkeiten.
- Antwortoptionen können Bedingungen haben (Uhrzeit, Beziehung, Story-Flag, früherer Dialog).
- Effekte sind eine feste, typisierte Datenmenge: Beziehung ändern, Erinnerung setzen, Questschritt aktivieren/abschließen, Dialogoption freischalten oder einen Gegenstand/Belohnungsstatus vergeben, sofern ein solcher Status wirklich existiert.
- Kein `eval`, kein ausführbarer JavaScript-Code in Inhaltsdaten und keine freie Skriptsprache.
- Dialoge werden nicht endlos wiederholbar belohnt. Einmalige Reaktionen und Erinnerungen werden gespeichert.
- Nach Schließen des Dialogs kehrt die Steuerung korrekt zurück; die Spielfigur läuft nicht weiter und der Dialog wird nicht durch die Uhr unkontrolliert neu geöffnet.

Das Dialogsystem muss mehrere Figuren und spätere Inhalte unterstützen, ohne für jede Figur eine eigene UI-Komponente zu bauen.

## 7. Zwei kleine Alltagsgeschichten

Implementiere mindestens zwei kurze, mehrstufige Geschichten mit jeweils mindestens drei inhaltlich unterschiedlichen Schritten. Sie sollen aus Begegnungen entstehen und nicht wie klassische Sammelquests wirken.

### Geschichte A – Ein Konflikt im Viertel
- Zwei NPCs haben unterschiedliche Sichtweisen auf ein konkretes Problem im direkten Umfeld.
- Der Spieler kann zuhören, vermitteln oder bewusst neutral bleiben.
- Spätere Dialoge zeigen, dass die Figuren sich an die Entscheidung erinnern.
- Mindestens zwei mögliche Ausgänge mit unterschiedlichen sozialen Folgen.
- Keine Lösung darf nur „mehr Geld“ sein.

### Geschichte B – Kleine Nachbarschaftshilfe
- Eine Figur bittet um Unterstützung bei einem realistischen Alltagsproblem.
- Der Spieler kann durch Gespräche und eine kleine Handlung helfen.
- Eine zweite Figur oder ein späterer Besuch bestätigt die Wirkung.
- Belohnung ist sozial oder atmosphärisch (Vertrauen, neue Begegnung, Dekoration, hilfreiche Information), nicht bloß Bargeld.

Die Geschichten müssen im Spielverlauf miteinander verknüpft oder zumindest in derselben Welt verankert sein. Eine Entscheidung aus Geschichte A soll mindestens eine Dialogreaktion oder einen Zustand in Geschichte B beeinflussen können.

Kein Frikadellen-Rezeptsystem und keine großen Events in diesem Auftrag; das gehört in Phase 5.

## 8. NPCs als Kunden – Verbindung zur Wirtschaft

Mindestens zwei der vier Bewohner sollen gelegentlich als Kunden auftreten und Waren tatsächlich kaufen können.

Ablauf:
1. NPC erreicht den Verkaufsbereich und wartet auf Bedienung.
2. Er äußert einen konkreten Wunsch, der aus Vorlieben, Tageszeit oder einer Story-Bedingung abgeleitet wird.
3. Der Spieler kann den Wunsch erfüllen oder ablehnen.
4. Bei erfülltem Wunsch wird die bestehende Verkaufsdomäne verwendet; keine zweite, abweichende Bestands-/Geldlogik einführen.
5. Verkauf reduziert Warenbestand, erhöht Kasse und Tagesumsatz, erzeugt Transaktion und Signal.
6. Der NPC erinnert sich an passende positive/negative Erfahrungen; Beziehung kann sich verändern.

### Alterskontrolle bei NPC-Kunden
- Alter stammt aus validierten NPC-Daten.
- Unter dem Mindestalter darf ein NPC das betreffende Produkt niemals kaufen.
- Erwachsene NPCs dürfen altersbeschränkte Ware nur dann kaufen, wenn die bestehende Verkaufsdomäne eine passende, explizite Altersfreigabe erhält.
- Die manuelle Ausweisbestätigung des Spielers darf nicht ungeprüft als Altersnachweis für einen NPC verwendet werden.
- Erweitere `SaleRequest`/Transaktion/Event so, dass ein optionaler `npcId`-Bezug möglich ist, ohne bestehende Spieler-Kassenverkäufe zu brechen.
- Kauf und Dialogreaktion müssen atomar bzw. gegen doppelte Auslösung abgesichert sein. Ein NPC darf denselben Wunsch nicht durch doppeltes E oder mehrere Renderframes mehrfach bezahlen.

Wenn ein NPC nichts kaufen möchte, ist das völlig in Ordnung. Nicht jeder Besuch muss ein Verkauf sein.

## 9. Dialog-, Story- und Beziehungsinhalte

Lege Inhalte als Datenmodule an und validiere:
- eindeutige IDs und Präfixe,
- gültige NPC-, Dialog-, Quest- und Produktreferenzen,
- keine unerreichbaren Dialogknoten,
- keine nicht auflösbaren Bedingungen,
- keine doppelten oder widersprüchlichen Story-Effekte,
- Beziehungsschwellen innerhalb des erlaubten Bereichs,
- Routinen mit gültigen Wochentagen und Zeitfenstern,
- erreichbare Wegpunkte und gültige Routen.

Alle Spieltexte auf Deutsch. Dialoge sollen individuell klingen, nicht wie generische KI-Floskeln. Kurze Texte mit Subtext sind besser als lange Monologe.

## 10. Qualität der Figuren und Animation

Die Figuren müssen in der bestehenden Third-Person-Kamera erkennbar sein:
- unterschiedliche Körperformen, Kleidungssilhouetten und Farbpaletten,
- Kopf, Oberkörper, Arme und Beine als klar lesbare Teile,
- kleine charakteristische Details (z. B. Tasche, Werkzeugtasche, Fahrradhelm, Jacke),
- einfache Idle-, Geh- und Gesprächsanimationen,
- Blickrichtung zur Gesprächsperson,
- keine unnötig detaillierten Gesichter, die aus der Kamera ohnehin nicht lesbar wären.

Nutze möglichst geteilte Geometrien/Materialien und Instancing dort, wo es tatsächlich sinnvoll ist. Vermeide ein eigenes schweres Animationsframework. Dokumentiere, ob Figuren prozedural oder als GLB gebaut werden und warum.

## 11. UI und Feedback

Ergänze:
- NPC-Interaktionsprompt,
- generisches Dialogpanel mit Name, kurzer Aussage und Antwortmöglichkeiten,
- sichtbare Beziehungshinweise in zurückhaltender Form (keine dauerhafte Gamification-Leiste über jedem Kopf),
- optional ein kleines Notiz-/Erinnerungsjournal, sofern es den MVP nicht aufbläht.

Das Journal soll, falls umgesetzt, nur bereits bekannte Personen, aktive Geschichten und erinnerte Entscheidungen anzeigen. Keine allwissende Questliste, die dem Spieler jede Lösung vorwegnimmt.

Die bestehenden Kassen- und Warenpanels müssen weiter funktionieren. Dialogfenster blockieren Bewegung wie die vorhandenen Modals; die Spieluhr läuft entsprechend dem Phase-3-Vertrag weiter.

## 12. Tests und Browserprüfung

### Unit-/Integrationstests
Mindestens:
- NPC-Datenvalidierung und Referenzen,
- Tagesroutinen an Zeitgrenzen und Wochentagen,
- deterministische Routine-/Zufallsentscheidungen,
- Wegfindung und Erreichbarkeit,
- Bewegung ohne Durchdringen von Möbeln/Wänden,
- Zustandsübergänge away → walking → waiting → away,
- Dialogbedingungen und Auswahloptionen,
- einmalige Effekte und Erinnerungen,
- Beziehungswerte und Schwellen,
- beide Storyverläufe einschließlich alternativer Ausgänge,
- Savegame-Migration 1→2→3 und 2→3,
- NPC-Kauf mit Bestand/Geld/Transaktion,
- Altersgrenze bei NPC-Käufen,
- Schutz gegen doppelte Kauf-/Dialogauslösung,
- Phase-3-Regressionsfälle (Bestellung, Verkauf, Altersschranke, Uhr, Tagesabschluss, Warenansicht).

### Browserprüfung
Erweitere `npm run check:browser`:
- alle vier NPCs erscheinen zu den vorgesehenen Zeiten,
- mindestens zwei NPCs bewegen sich über sichtbare, kollisionsfreie Routen,
- Interaktion mit E/Klick funktioniert,
- Dialogoptionen verändern gespeicherte Zustände,
- ein späterer Besuch zeigt eine Erinnerung an eine frühere Entscheidung,
- beide Geschichten können mit mindestens zwei möglichen Ausgängen abgeschlossen werden,
- mindestens zwei NPCs können einen Warenwunsch äußern,
- erfolgreicher NPC-Kauf verändert Geld und Bestand genau einmal,
- ein minderjähriger NPC kann keine altersbeschränkte Ware kaufen,
- Reload stellt Beziehungen, Routinen und Story-Fortschritt wieder her,
- bestehende Phase-3-Kassen-/Lager-/Tagesabschlussprüfungen bleiben grün,
- keine unbehandelten Konsolenfehler oder verlorenen WebGL-Kontexte.

Erzeuge Screenshots aus der echten Anwendung:
- mindestens zwei NPCs im Viertel,
- Dialogpanel mit Antwortoptionen,
- sichtbare Begegnung am Kiosk/Verkaufsfenster,
- ein Screenshot, der eine Story-Folge oder Beziehungskonsequenz zeigt.

Führe aus und dokumentiere:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run check:browser`

Keine Testzahlen erfinden. Automatisierte Headless-Prüfung nicht als manuelle grafische Freigabe ausgeben.

## 13. Ausdrücklich nicht Teil von Auftrag 04

- Wetter, Jahreszeiten und echtes Kalenderdatum (Phase 5).
- Spieltag, Straßenfest oder andere große Events (Phase 5).
- Dynamische Nachfrage aufgrund von Wetter/Event (Phase 5).
- Rezept-/Spezialitätensystem und Frikadellen-Tradition (Phase 5).
- Vollständige Stadt oder frei erkundbares Straßennetz.
- Mehr als vier vollständig ausgearbeitete NPCs.
- Komplexe Bedürfnisse-Simulation (Hunger, Schlaf, Gesundheit, Geld, Inventar jedes NPCs).
- Vollständige Sprachausgabe oder Synchronisation.
- Große Quest-Editoren oder visuelle Dialog-Tools.
- Weitere Regionen, Touchsteuerung und Audio.

## 14. Dokumentation und Abschlussbericht

Aktualisiere:
- `README.md`,
- `docs/TECHNISCHER-IST-STAND.md`,
- `docs/IMPLEMENTIERUNGSPLAN.md`,
- `docs/MODUL-UND-DATENVERTRAEGE.md`,
- `docs/artwork-prompts/07-artwork-register.md`,
- gegebenenfalls ADRs und manuelle Prüfanleitung.

Dokumentiere:
1. vier NPC-Profile, IDs und Asset-Zuordnung,
2. Routinen, Wegpunkte und Aufenthaltsorte,
3. Dialog- und Storystruktur mit allen möglichen Ausgängen,
4. Beziehungsmodell und gespeicherte Erinnerungen,
5. Kundenkäufe und Integration mit der Wirtschaftsdomäne,
6. Alterskontrolle bei NPC-Käufen,
7. Savegame-Schema 3 und Migrationen,
8. Typecheck/Lint/Test/Build/Browserprüfung,
9. Screenshots und bekannte Einschränkungen,
10. welche Phase-3-Grenzen weiterhin bewusst bestehen.

**Definition of Done:** Vier wiederkehrende, optisch unterscheidbare Bewohner bewegen sich nach nachvollziehbaren Tagesroutinen durch den Kioskbereich. Der Spieler kann mit ihnen sprechen; Entscheidungen verändern Beziehungen und gespeicherte Erinnerungen. Zwei mehrstufige Alltagsgeschichten haben unterschiedliche Ausgänge. Mindestens zwei Bewohner können Warenwünsche äußern und über die bestehende Wirtschaftsdomäne kaufen. Altersbeschränkungen gelten auch für NPC-Kunden. Bestehende Spielstände bleiben durch Migration erhalten.