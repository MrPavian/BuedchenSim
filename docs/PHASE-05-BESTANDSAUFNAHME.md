# Bestandsaufnahme Auftrag 05 – Das lebendige Viertel

**Datum:** 2026-11-14 · **Branch:** `claude/elegant-curie-17qulu` (Stand `c5c9d1d`) · Auftrag: [05](auftraege/05-das-lebendige-viertel.md)

Grundlage ist der Code, nicht frühere Berichte. Phase 4 (Auftrag 04) sowie die Zwischenschritte 04.5 und 04.6 sind abgeschlossen; Typecheck, Lint, 609 Tests, Build und die Browserprüfung (149/149) waren zuletzt grün. Es gibt keine offenen Phase-4-Fehler, die Phase 5 blockieren.

## 1. Tatsächlicher technischer Stand

| Bereich | Stand im Code | Datei |
|---|---|---|
| Zeit | `CalendarState { day, minute, paused, speed, phase }`; Tag 1 ist ein Montag, der Wochentag wird aus `day` abgeleitet (`weekdayOf`), nicht gespeichert. Ein Datum, Monate, Jahre oder Jahreszeiten gibt es nicht. 1 Spielminute = 1 s, 06:00–22:00, Halt bei 22:00 (`awaiting_close`), `closeDay` → `startNextDay`. | `src/game/clock.ts`, `state.ts`, `selectors.ts`, `balance.ts` |
| Zufall | Ausschließlich deterministisch: `roll(seed, …teile)` (zustandslos) und `createRng`; Seed in `state.world.seed`. Kein `Math.random` in der Spiellogik. | `random.ts` |
| Bewohner | Vier Bewohner mit Routinen (Zeitfenster, Wochentage, `chancePercent`, Bedingungen), Wegegraph, Wünschen (`pickWish`, gewichtet und deterministisch), Gesprächen, Beziehungen, Erinnerungen, Geschichten. | `npcSim.ts`, `wishes.ts`, `dialogue.ts`, `story.ts` |
| Bedingungen/Effekte | Geschlossene Typen (`flag`, `relationship…`, `quest…`, `time`, `weekday`, `seen`, `memory`, `dayAtLeast`, `not`, `any`; Effekte `relationship`, `setFlag`, `remember`, `questStep/Outcome`, Kundeneffekte). | `npcTypes.ts`, `conditions.ts` |
| Wirtschaft | `placeOrder` (Kasse sofort, Lieferung ausstehend), `receiveDelivery`, `restock`/`unstock`, `completeSale` (Alterskontrolle, Regalbestand, Transaktion mit `npcId`), `closeDay` (Tagesbericht). Lager 400 Einheiten. | `economy.ts` |
| Ereignisse | Typisierte Signale (`GameEvents`), z. B. `day.started`, `sale.completed`, `npc.wish`. Ein Veranstaltungssystem gibt es nicht. | `core/signals.ts`, `game/events.ts` |
| Spielstand | Schema **Version 3**, Migrationen 1→2→3, inhaltsbewusste Validierung mit Warnungen. | `save/save.ts` |
| Wetter, Kalender, Events | **nicht vorhanden** | – |
| Welt | Licht `LIGHT`, Tone Mapping, Kiosk, Waren, Bewohner (GLB), Markierungen; flaggebundene Platzierungen (`requiresFlag`). Kein Himmel-/Nebel-/Partikelsystem. | `world/world.ts`, `views/*`, `placementGates.ts` |
| UI | HUD (Uhr, Tempo, Notizen, Tag abschließen), Panels `goods` (Tabs Bestand/Bestellen/Lieferung/Einräumen), `till`, `report`, `confirmClose`, `dialogue`, `journal`. | `ui/*` |
| Audio | **nicht vorhanden** (laut ADR-Teil C Phase 6). | – |
| Tests | 38 Testdateien, 609 Tests (Vitest), Browserprüfung `scripts/browser-check.mjs` (149 Prüfungen, rund 25 min), Referenzansichten `scripts/visual-shots.mjs`. | |

## 2. Wiederverwendbare Module und Schnittstellen
- **Kalender:** `day` bleibt der einzige gespeicherte Zeitzähler. Datum, Wochentag und Jahreszeit werden daraus und aus einem konfigurierten Startdatum abgeleitet (reine Funktionen). `weekdayOf` bleibt die eine Wochentagsquelle und rechnet künftig über das Datum.
- **Zufall:** `roll(seed, …)` trägt Wetter und Vorhersage ohne neuen Speicherzustand: Das Wetter eines Tages ist eine reine Funktion aus Seed, Datum und Vortag; die Vorhersage eine reine Funktion aus Seed, Zieltag und Betrachtungstag.
- **Bedingungen:** neue Bedingungstypen (Wetter, Temperatur, Jahreszeit, aktive Veranstaltung, Stufe der Spezialität) passen in den geschlossenen Typ.
- **Routinen und Wünsche:** Wahrscheinlichkeit und Gewichte erhalten einen Nachfragezuschlag statt einer zweiten Kaufentscheidung.
- **Wirtschaft:** Zutaten sind Produkte im bestehenden Katalog und Lager; die Spezialität ist ein Produkt, verkauft über `completeSale`. Produktion bucht nur Lager um (Zutaten → fertige Einheiten).
- **Platzierungen mit `requiresFlag`:** Werbeschild und Kult-Dekoration der Spezialität.
- **UI-Panels und Signale** für Kalender/Wetter, Veranstaltungen und Spezialität.

## 3. Notwendige Erweiterungen
1. `src/game/date.ts`: Datum aus Spieltag und Startdatum, Schaltjahre, Wochentag, Jahreszeit.
2. `src/game/weather.ts`: Klima je Monat (Inhaltsdaten), deterministische Tageskette, Temperaturverlauf über den Tag, Vorhersage (3 Tage fest, 4 Tage Tendenz mit Unsicherheit).
3. Veranstaltungen als Inhaltsdaten (`EventDef` mit Regel: feste Daten, Wochentagsrhythmus, monatlich, wetterabhängig) und ein reiner Auswerter für Status (geplant, angekündigt, aktiv, abgeschlossen) je Tag; gespeichert wird nur, was nicht ableitbar ist (vergebene Erinnerungen).
4. `src/game/demand.ts`: `D = clamp(B + W + E + S + T, Dmin, Dmax)` je Produkt aus Inhaltsdaten; wirkt auf Routinenwahrscheinlichkeit und Wunschgewichte, nie auf Verkäufe.
5. Spezialität: Rezept- und Spezialitätsdaten, Zustand (Produktion, Qualität, Bekanntheit, Stufe, Rückmeldungen), Aktionen, Produktion über Spielzeit.
6. Bewohner: Wetter- und Veranstaltungsbedingungen an Routinen, neue Dialoge und Wünsche, Erinnerungen; Haushalte als Inhaltsdaten (`householdId`), Tagesbudget je Bewohner.
7. Welt: Himmel, Nebel, Licht nach Wetter und Jahreszeit, Regen- und Schneepartikel, nasse Flächen, Dekorationen für Veranstaltungen, Werbeschild.
8. UI: HUD mit Datum und Wetter, Kalender- und Wetterpanel mit Veranstaltungen und Nachfragehinweisen, Spezialitätenpanel.
9. Spielstand Version 4 mit Migration 3→4.

## 4. Abweichungen zwischen Dokumentation und Code
- Auftrag 05 nennt „Zeitpunkt/Spielzeit“, „Wetter-Seed“ und „Vorhersagezustand“ als Speicherdaten. Da Wetter und Vorhersage vollständig aus `world.seed` und `day` reproduzierbar sind, werden sie **nicht** gespeichert (Auftrag 11: „Nur Daten speichern, die nicht sicher reproduzierbar sind“). Ebenso der Veranstaltungsstatus.
- Auftrag 05 schreibt „Halt bei 22:00 Uhr“ und „pausierbar und vorspulbar“: im Code bestätigt (`awaiting_close`, Tempo 1/2/4).
- Wochentag „wird aus dem Datum abgeleitet“: bisher aus dem Tageszähler mit Tag 1 = Montag. Mit einem Startdatum an einem Montag ist beides gleich; künftig rechnet `weekdayOf` über das Datum, die Inhaltsvalidierung verlangt einen Montag als Startdatum, damit alte Spielstände ihre Wochentage behalten.
- `MODUL-UND-DATENVERTRAEGE.md` beschreibt noch keine Datums-, Wetter-, Veranstaltungs- oder Spezialitätsverträge; wird ergänzt.
- Audio existiert nicht; „passende Wettergeräusche“ (6.3) setzen ein Audiosystem voraus, das laut Architekturplan zu Phase 6 gehört.

## 5. Risiken und Abhängigkeiten
- **Nur vier Bewohner:** „mehr Besucher“ bei Veranstaltungen braucht zusätzliche Figuren. Lösung im Umfang: wenige Gastbesucher als Inhaltsdaten mit eigener Routine, nur an Veranstaltungstagen aktiv, mit der vorhandenen prozeduralen Ersatzfigur dargestellt. Kein Massenpassantensystem (Abgrenzung 15).
- **Browserprüfung:** Neue Bedingungen für Routinen können Erscheinungszeiten der Bewohner an bestimmten Tagen verschieben; die bestehende Prüfung setzt Tage und Seeds fest. Wetter- und Veranstaltungsbedingungen dürfen die Phase-4-Routinen an Werktagen ohne Ereignis nicht verändern.
- **Spielbalance:** Schlechtes Wetter darf nicht ruinieren; Nachfrage begrenzt (`Dmin`, `Dmax`), Routinenchancen höchstens ±25 Prozentpunkte.
- **Dauer der Browserprüfung** (rund 25 min): Phase-5-Prüfungen setzen Zustände direkt über den Debug-Zugang statt Tage abzuspielen.
- **Performance der Partikel** im Software-Rendering: wenige tausend Punkte in einem Draw Call; abschaltbar.

## 6. Angepasste Implementierungsreihenfolge
1. 5.1 Datum und Jahreszeiten (`date.ts`, `weekdayOf` über das Datum), HUD-Datum, Kalenderpanel-Grundgerüst, sichtbare Jahreszeit (Wiese, Licht).
2. 5.2 Wetter, Vorhersage, Wetterdarstellung (Himmel, Nebel, Partikel, nasse Flächen, abschaltbar), Wetterpanel.
3. 5.3 Veranstaltungen (Inhaltsdaten, Auswerter, Bedingungen, Dekorationen, Gastbesucher, Kalenderansicht).
4. 5.4 Nachfrage (Modell, Wirkung auf Routinen und Wünsche, Hinweise in der Vorhersage).
5. 5.5 Frikadelle im Brötchen (Zutaten, Rezept, Produktion, Qualität, Bekanntheit, Stufen, Belohnungen, Panel); Spielstand Version 4.
6. 5.6 Bewohnerreaktionen, Haushalte, Integrationstest „Heißer Samstag mit Heimspiel“, Browserprüfung, Screenshots, Dokumentation.
