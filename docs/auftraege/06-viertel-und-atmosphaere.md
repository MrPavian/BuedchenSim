# Auftrag 06 – Viertel und Atmosphäre

**Projekt:** BÜDCHEN-SIM  
**Phase:** 6  
**Status:** freigegeben am 2026-11-19 (Nutzer: „Weiter“, damit gelten die Vorschläge zu O-6 bis O-8); in Umsetzung  
**Ziel:** Das Büdchen steht in einer glaubwürdigen Ruhrgebietsstraße. Straßenraum, Nachbarhäuser, Tageslicht, Klang und kleine Bewegungen machen aus der Kulisse einen belebten Ort. Bewohner nutzen diesen Raum, und Entscheidungen des Spielers werden im Viertel sichtbar.

> **Arbeitsregel:** Dieser Auftrag ist die verbindliche fachliche Spezifikation. Er beruht auf der Bestandsaufnahme vom 2026-11-19 (Abschnitt 3). Vor jedem Paket den tatsächlichen Code erneut prüfen. Dateinamen und Pfade in diesem Dokument sind Vorschläge; vorhandene passende Module sind zu erweitern, nicht zu duplizieren.

---

## 1. Produktziel

Bisher endet die Welt an einer grünen Fläche: ein ausgearbeiteter Kiosk auf einem Greybox-Gehweg, eine graue Straße, kein Nachbarhaus, kein Ton und ein Licht, das sich über den Tag nicht verändert. Phase 6 schließt diese Lücke.

Der Spieler soll spüren:
- **wo** er ist – eine Ecke im Ruhrgebiet mit Backstein, Putz, Laternen, Fahrradständer und Nachbarschaft;
- **wann** er ist – Morgenlicht, Mittag, Feierabend, Dämmerung; im Dezember ist es um halb fünf dunkel und das Büdchen leuchtet;
- **wer** da ist – Bewohner sitzen auf der Bank, stellen ihr Fahrrad ab, werfen etwas in den Mülleimer und reden an der Ecke miteinander;
- **was er bewirkt** – ein gepflegter Platz vor dem Büdchen, Spenden und Geschenke der Bewohner, die sichtbar bleiben.

**Leitprinzip:** Jedes neue Element hat entweder eine Funktion im Spiel oder trägt messbar zur Atmosphäre bei. Keine Dekoration ohne Bezug zum Ort.

## 2. Verbindliche Produktentscheidungen

### 2.1 Straßenraum
- Die Spielfläche bleibt die bestehende Ecke (x −12…12, z −8…11). Die Welt wird **nicht** zu einer begehbaren Stadt erweitert; was außerhalb liegt, ist Kulisse.
- Der Spieler kann weiterhin nur Gehweg, Hof und Kiosk betreten; die Straße bleibt gesperrt.

### 2.2 Tageslicht
- Sonnenstand aus Spielzeit **und** Datum (Breite etwa 51,5° N): Sonnenaufgang und -untergang verschieben sich über das Jahr. Im Juni wird es nach 21:30 dunkel, im Dezember gegen 16:30.
- Die Öffnungszeit 06:00–22:00 bleibt unverändert; Dunkelheit ist ein Teil des Spieltags, kein Hindernis.
- Laternen, Kioskschild und Innenlicht schalten sich mit der Dämmerung ein.

### 2.3 Klang
- Eigenes Modul `audio` (wie in den Datenverträgen seit Phase 0 vorgesehen), das nur auf Signale und den abgeleiteten Zustand reagiert und den Spielzustand nie verändert.
- **Klangquelle (offene Entscheidung O-6, siehe Abschnitt 14):** Vorschlag: Synthese mit der Web Audio API (keine Dateien, keine Lizenzfragen), ergänzt um wenige CC0-Aufnahmen nur dort, wo Synthese unglaubwürdig klingt (z. B. Vögel). Keine erkennbare Musik realer Künstler, keine Stadiongesänge realer Vereine.
- Ton startet erst nach der ersten Eingabe des Spielers (Browserregel), ist stummschaltbar und hat eine Gesamtlautstärke; die Einstellung wird je Gerät gespeichert, nicht im Spielstand.

### 2.4 Sichtbare Folgen
- Der Platz vor dem Büdchen hat einen Zustand **Sauberkeit**: Verkäufe erzeugen Abfall, der Mülleimer füllt sich; leert der Spieler ihn nicht, liegt Abfall auf dem Gehweg. Das ist die einzige neue Wirtschaftsmechanik dieser Phase und bewusst klein.
- Weitere sichtbare Folgen entstehen über das vorhandene Flag- und Platzierungssystem (`requiresFlag`), nicht über ein neues System.

## 3. Bestandsaufnahme (2026-11-19, Kurzfassung)

| Bereich | Ist-Stand | Folge für Phase 6 |
|---|---|---|
| Gehweg E-001, Straße E-002, Bordstein | flache Greybox-Flächen (`src/world/assets/ground.ts`), Register-Status „In Arbeit (Greybox)“ | ausarbeiten |
| Laterne E-003, Mülleimer E-005, Fahrrad E-006, Baum E-007 | geplant, nicht vorhanden | bauen |
| Bank E-004 | Hofbank, nur mit Flag `yard.bench` | Fabrik wiederverwenden (zweite Platzierung am Gehweg) |
| Nachbarbebauung | keine; jenseits von Hof und Straße grüne Fläche | Nachbarhäuser und Kulisse |
| Licht | Sonne fest (`world.ts`, `LIGHT`), Jahreszeit und Wetter tönen Himmel und Licht (`atmosphereView.ts`), keine Tageszeit | Sonnenstand, Dämmerung, Nacht |
| Audio | nicht vorhanden; Modul `audio` in `MODUL-UND-DATENVERTRAEGE.md` für Phase 6 vorgesehen | neu |
| Bewohner | Orte Fenster, Ecke, Gehweg (Durchgang), Hofbank, Werkstatt; Clips idle, walk, talk | Sitzen, Fahrrad abstellen, Mülleimer, Gespräch untereinander |
| Wetter/Events | deterministisch, Dekorationen je Veranstaltung | Wind für Bäume, Klang je Wetter und Veranstaltung |
| Einstellungen | Effektstufe in `localStorage` (`main.ts`) | Lautstärke und Stumm ebenso |
| Savegame | Schema 4 | Schema 5 nur für Sauberkeit (Abschnitt 10) |

## 4. Architektur- und Qualitätsregeln

Unverändert aus den Aufträgen 04 und 05:
- Schichten `core` ← `game` ← `world`/`ui`/`audio`, `content` liefert Daten; ESLint erzwingt das. `audio` importiert weder `world` noch `ui`.
- `world` und `audio` stellen dar, sie sind nie Quelle des Zustands. Kamera-, Licht- und Klangzustand werden nicht gespeichert.
- Reproduzierbarkeit: Sonnenstand, Verkehr und Umgebungsbewegung werden aus Seed, Tag und Minute abgeleitet; kein `Math.random()` in Spiel- oder Darstellungslogik, die Screenshots beeinflusst.
- Neue Assets: Low-/Mid-Poly, warme Palette nach `docs/VISUAL-BASELINE.md`, Material-Sharing, wiederholte Objekte als `InstancedMesh` oder geteilte Geometrie, Pivot Bodenmitte, 1 Unit = 1 m.
- Ausschließlich fiktive Namen: Straßenschild, Ladenlokale, Plakate, Fahrradmarken, Autos ohne Herstellermerkmale.

## 5. Arbeitspaket 6.1 – Straßenraum und Stadtmöblierung

Assets (IDs im Register nachtragen, Status erst nach Sichtprüfung auf „Im Spiel integriert“):

| ID | Asset | Anforderungen |
|---|---|---|
| E-001 | Gehweg ausgearbeitet | Plattenraster 0,3 × 0,3 m bzw. 0,5 × 0,5 m mit Fugen, einzelne versetzte oder gesprungene Platten, Baumscheibe; eine Textur, keine Einzelmeshes je Platte |
| E-002 | Straße ausgearbeitet | Asphalt mit Flicken, Mittelmarkierung, Gullydeckel, Querungsstelle mit abgesenktem Bordstein |
| E-001-B | Bordstein | echte Kante (Höhe etwa 0,12 m), Absenkung an der Querung |
| E-003 | Laterne | Ruhrgebietstyp (schlanker Mast, Pilz- oder Auslegerleuchte), 2 Stück; abends leuchtend (Abschnitt 7) |
| E-014 | Gehwegbank | eigene städtische Bank am Gehweg, immer vorhanden; die Hofbank E-004 bleibt ein flaggebundenes Story-Requisit aus Brettresten (Abweichung vom Entwurf, der E-004 wiederverwenden wollte: eine Stadtbank sieht anders aus als die selbstgebaute Hofbank) |
| E-005 | Mülleimer | Gehwegmülleimer am Mast, Füllstand sichtbar (Abschnitt 9) |
| E-006 | Fahrrad | 2–3 Varianten über Farbe; Jonas' Fahrrad steht nur, während er da ist |
| E-007 | Baum / Pflanzkübel | Straßenbaum (im Hof, damit die Krone die Kamera nicht verdeckt), Pflanzkübel; Krone bewegt sich mit Wind |
| E-008 | Fahrradständer | Anlehnbügel, 3 Plätze |
| E-012 | Straßenschild | fiktiver Straßenname (Vorschlag „Zechenstraße“ oder frei erfunden, gegen reale Marken geprüft) |
| E-013 | Verteilerkasten | Verteilerkasten mit verblassten fiktiven Aufklebern; Gullys und Kanaldeckel gehören zur Straße E-002 |

Regeln:
- Alle Möbel mit Kollision für den Spieler; Bewohner-Navigation (`nav.ts`) bleibt gültig, die Validierung (Kanten frei von Kollidern) muss weiter grün sein.
- Die Kamera darf nicht von Laterne oder Baum verdeckt werden: Prüfung im Browser aus allen Spielerpositionen; notfalls Ausblenden nahe der Kamera wie bei bestehenden Objekten.

## 6. Arbeitspaket 6.2 – Nachbarschaft und Kulisse

| ID | Asset | Anforderungen |
|---|---|---|
| E-009 | Nachbarhaus Backstein | zwei- bis dreigeschossig, Erdgeschoss mit fiktivem Ladenlokal (z. B. eine fiktive Änderungsschneiderei), Fenster mit Gardinen, nachts einzelne erleuchtete Fenster (deterministisch je Tag) |
| E-010 | Nachbarhaus Putz | mit Toreinfahrt oder Garage, Balkon, Satellitenschüssel ohne Logo |
| E-011 | Kulisse | Häuserzeile gegenüber hinter der Straße als vereinfachte Fassaden, in der Ferne ein angedeutetes Fördergerüst und Baumreihen; nicht begehbar, wenige Draw Calls |

Regeln:
- Nachbarhäuser sind Kulisse mit Tiefe (Fensterlaibungen, Dachkanten), aber ohne Innenraum.
- Leistungsziel: der gesamte Umgebungszuwachs höchstens etwa 60 zusätzliche Draw Calls und 60.000 Dreiecke (Messung mit `scripts/visual-shots.mjs`, vorher/nachher dokumentieren).
- Die grüne Endlosfläche verschwindet aus allen Standardansichten.

## 7. Arbeitspaket 6.3 – Tageszeit und Licht

- Reine Funktion im `game`-Bereich (ohne Three.js): `sunOf(day, minute)` → Höhe, Richtung, Dämmerungsgrad, aus dem Kalenderdatum; Tests für Juni- und Dezembertag, Sommerzeit wird ignoriert oder dokumentiert.
- `atmosphereView` erweitert: Sonnenrichtung und -farbe (Morgen warm, Mittag neutral, Abend orange), Himmel, Nebel und Umgebungslicht nach Dämmerungsgrad, kombiniert mit Jahreszeit und Wetter aus Auftrag 05.
- Nacht: Laternen (E-003) und Kioskbeleuchtung (K-001-H) als Hauptlicht; höchstens zwei zusätzliche schattenfreie Punktlichter oder vorgebackene Lichtkegel; keine Schattenkaskaden.
- Fenster der Nachbarhäuser leuchten nachts teilweise (Emissive, kein Licht).
- Übergänge gleiten (keine Sprünge bei Vorspulen ×4 oder nach dem Laden).
- Lesbarkeit: Waren, HUD-relevante Objekte und Bewohner bleiben auch um 22:00 im Dezember erkennbar (Screenshot-Nachweis).

## 8. Arbeitspaket 6.4 – Klang

Modul `src/audio/` mit `createAudio(game)`:
- **Umgebung:** Straßengrundrauschen, Vögel am Morgen, leiser am Abend; entferntes Verkehrsrauschen.
- **Wetter:** Regen (Stärke nach Zustand), Wind, gedämpfter Klang bei Schnee; aus dem abgeleiteten Wetter.
- **Veranstaltungen:** Heimspiel als ferne, unverständliche Menge (kein realer Gesang), Straßenfest als gedämpfte Musik ohne erkennbares Stück, Weihnachtszeit dezent.
- **Interaktion:** Klappe, Tür, Kasse/Verkauf, Lieferung, Kühlschrank, Mülleimer leeren; aus vorhandenen Signalen.
- **Bewohner:** keine Sprachaufnahmen; höchstens kurze, neutrale Laute beim Gruß.
- Mischlogik als reine Funktion (Zustand → Lautstärken je Ebene), in Vitest geprüft; das Erzeugen der Web-Audio-Knoten nur im Browser.
- Steuerung: Lautstärke und Stumm im Kalender-/Einstellungsbereich, Speicherung je Gerät wie die Effektstufe. Pause und geschlossenes Panel verändern keinen Spielzustand.

## 9. Arbeitspaket 6.5 – Bewohner nutzen den Raum

Mit dem bestehenden Routinen-, Orts- und Wegpunktsystem; neue Ortsarten nur, wo nötig:
- **Sitzen** auf der Gehwegbank (neuer Clip `sit` in der Figuren-Pipeline `tools/characters/build_mh_resident.py`, alle GLB neu bauen; prozedurale Ersatzfiguren mit einfacher Sitzpose).
- **Fahrrad abstellen:** Jonas stellt sein Fahrrad in den Ständer (E-008), es steht dort, solange er da ist.
- **Mülleimer:** Kunden werfen nach dem Kauf manchmal etwas ein (Füllstand steigt); deterministisch.
- **Gespräch an der Ecke:** zwei Bewohner am selben Ort drehen sich zueinander und nutzen den Clip `talk`; kein neues Dialogsystem.
- Neue Routinen-Einträge und Dialogzeilen als Inhaltsdaten (z. B. Kommentar zu vollem Mülleimer, zur neuen Bank, zum Abendlicht).
- **Verkehr (niedrige Priorität):** gelegentlich ein vorbeifahrendes Auto oder Fahrrad auf der Straße als reine Darstellung, deterministisch aus Seed und Minute, ohne Herstellermerkmale.

## 10. Arbeitspaket 6.6 – Sichtbare Folgen und Sauberkeit

- `GameState.street = { litter: number, binFill: number }` (Vorschlag), Grenzen 0…100.
- Verkäufe erhöhen den Füllstand; ist der Eimer voll, steigt `litter`. Der Spieler leert den Eimer am Interaktionspunkt (Taste E, wie Lager und Kasse); `litter` sinkt beim Fegen (zweite Interaktion) oder langsam über Nacht.
- Wirkung: geringe Sauberkeit senkt die Zufriedenheit beim Besuch leicht und löst Kommentare aus; hohe Sauberkeit wirkt nicht als Bonus auf Verkäufe (kein Optimierungszwang).
- Darstellung: Abfallteile auf dem Gehweg als Instanzen, Anzahl aus `litter`; Mülleimer mit sichtbarem Füllstand.
- Sichtbare Belohnungen über `requiresFlag`, z. B. ein von Marlene gespendeter Pflanzkübel nach hoher Beziehung, eine Lichterkette über dem Fenster nach dem Kultstatus der Frikadelle; jeweils mit Inhaltsdaten und Validierung.
- **Savegame Schema 5:** Migration 4 → 5 legt `street` mit Startwerten an; Kette 1 → … → 5 bleibt vollständig; Rundlauftests.

## 11. Integrationsdurchlauf „Novemberabend“

Verbindlicher Test (Vitest-Integration und Browserprüfung):
1. Ein Wochentag im November mit Regen; 15:00 Uhr, Tageslicht.
2. Bis 17:00 vorspulen: Dämmerung, Laternen und Kioskschild an, Nachbarfenster teilweise hell, Regenklang aktiv (Mischlogik), Regen sichtbar.
3. Jonas kommt, stellt das Fahrrad ab, kauft, fährt wieder; das Fahrrad verschwindet.
4. Günter sitzt auf der Bank.
5. Mehrere Verkäufe: Mülleimer voll, Abfall auf dem Gehweg, ein Bewohner kommentiert.
6. Spieler leert den Eimer und fegt: Abfall verschwindet.
7. Speichern, neu laden: Sauberkeit und Füllstand erhalten, Licht und Klang ergeben sich aus Datum und Uhrzeit.

## 12. Tests und Qualitätssicherung

- Vitest: `sunOf` (Auf-/Untergang Juni/Dezember, Dämmerungsgrad monoton), Mischlogik Audio, Sauberkeit (Füllen, Überlaufen, Leeren, Fegen, über Nacht), Routinen mit Sitzen und Fahrrad, Migration 4 → 5, Inhaltsvalidierung neuer Platzierungen und Flags, Navigation weiterhin kollisionsfrei.
- Browserprüfung (`npm run check:browser`, neuer Abschnitt P6): Umgebung vorhanden, keine Kameraverdeckung, Tageszeitwechsel ohne Sprung, Nacht-Lesbarkeit, Laternen an/aus, Audio-Kontext nach Eingabe aktiv, Stumm wirkt und bleibt gespeichert, keine Konsolenfehler, Sauberkeitsablauf mit echter Taste E, Integrationsdurchlauf.
- Screenshots unter `docs/screenshots/auftrag-06/`: `strasse-morgen.png`, `mittag.png`, `abend-sommer.png`, `dezember-1630.png`, `nacht-regen.png`, `bank-und-fahrrad.png`, `muell.png`, `nachbarschaft-totale.png`, Vorher/Nachher der Umgebung. Bestehende Screenshot-Ordner bleiben unverändert.
- Performance: Draw Calls, Dreiecke und Bildrate vorher/nachher mit `scripts/visual-shots.mjs` (Headless, kein Nachweis für echte Hardware).

## 13. Abgrenzung – ausdrücklich nicht Teil von Phase 6

- keine begehbare Stadt, keine Innenräume der Nachbarhäuser;
- keine neuen Hauptbewohner (N-004 Schülergruppe, N-005 Fußballfan bleiben geplant);
- keine Musikstücke, keine Sprachausgabe;
- keine Fahrzeugsimulation, keine Ampeln, kein Parken;
- keine neuen Waren und kein neues Wirtschaftssystem außer Sauberkeit;
- keine weiteren Regionen.

## 14. Entscheidungen (am 2026-11-19 mit der Freigabe angenommen)

| Nr. | Frage | Entscheidung |
|---|---|---|
| O-6 | Klangquelle: nur Synthese oder zusätzlich CC0-Aufnahmen (mit Lizenzregister `docs/AUDIO-QUELLEN.md`)? | Synthese als Grundlage, CC0 nur für Vögel, Regen und Menge, falls Synthese nicht überzeugt |
| O-7 | Sauberkeit als kleine Mechanik oder rein optisch? | kleine Mechanik wie in Abschnitt 10 |
| O-8 | Vorbeifahrender Verkehr ja/nein? | ja, aber als letztes Paket und abschaltbar mit der Effektstufe |

## 15. Arbeitspakete und Commit-Strategie

Reihenfolge:
1. 6.1 Straßenraum und Stadtmöblierung;
2. 6.2 Nachbarschaft und Kulisse;
3. 6.3 Tageszeit und Licht;
4. 6.4 Klang;
5. 6.5 Bewohner nutzen den Raum;
6. 6.6 Sichtbare Folgen und Sauberkeit, Integration, Abschluss.

Nach jedem Paket: Typecheck, Lint, Tests, Build, Sichtprüfung in der laufenden Szene, Dokumentation, Commit und Push auf `claude/elegant-curie-17qulu`. Rückmeldungen des Nutzers zur Optik haben Vorrang vor dem Paketplan.

## 16. Dokumentation und Abschlussbericht

Aktualisieren: README, IMPLEMENTIERUNGSPLAN, ARCHITEKTUR-ENTSCHEIDUNGEN (neue ADRs: Tageslicht aus Datum, Audio-Modul, Sauberkeit/Schema 5), MODUL-UND-DATENVERTRAEGE, TECHNISCHER-IST-STAND, VISUAL-BASELINE (Messwerte), Artwork-Register (E-001 bis E-013), BEWOHNER-UND-GESCHICHTEN, PRUEFANLEITUNG-MANUELL (neue Schritte, insbesondere Ton und Nacht auf echter Hardware).

Erstellen: `docs/PHASE-06-ABSCHLUSSBERICHT.md` mit derselben Gliederung wie Phase 5 und strikter Trennung von implementiert, automatisiert getestet, manuell geprüft und nicht geprüft.

## 17. Definition of Done

Phase 6 ist abgeschlossen, wenn:
- Straße, Gehweg, Bordstein und Stadtmöbel ausgearbeitet in der Szene stehen und keine Greybox mehr sichtbar ist;
- Nachbarhäuser und Kulisse die grüne Fläche in allen Standardansichten ersetzen;
- Licht aus Datum und Uhrzeit folgt, Laternen abends angehen und die Szene nachts lesbar bleibt;
- Klang auf Umgebung, Wetter, Veranstaltungen und Interaktionen reagiert und stummschaltbar ist;
- Bewohner sitzen, Fahrrad abstellen, den Mülleimer nutzen und an der Ecke miteinander reden;
- Sauberkeit funktioniert, gespeichert und migriert wird (Schema 5);
- der Durchlauf „Novemberabend“ automatisiert und im Browser grün ist;
- Typecheck, Lint, Tests, Build und Browserprüfung grün und dokumentiert sind;
- Leistungswerte vorher/nachher dokumentiert sind.

## 18. Zielbild

Ein Dienstag im November, kurz nach fünf. Es nieselt. Die Laternen gehen an, im Haus gegenüber brennt Licht in der Küche. Das Leuchtschild des Büdchens spiegelt sich auf dem nassen Pflaster. Jonas lehnt sein Rad an den Bügel und holt sich eine Brause, Günter sitzt trotz Regen unter dem Vordach auf der Bank. Der Mülleimer ist voll – der Spieler leert ihn, bevor Marlene etwas sagen kann.

Man hört den Regen, ein Auto in der Ferne, die Kasse. Das Büdchen ist der helle Punkt an der Ecke.
