# Bewohner, Dialoge und Geschichten

**Stand:** 2026-11-14 · nach [Auftrag 04](auftraege/04-bewohner-und-soziale-bindung.md)

Dieses Dokument beschreibt die Inhalte und Regeln der vier ersten Bewohner: Profile, Orte und Wege, Tagesroutinen, Dialogsystem, die zwei Alltagsgeschichten mit allen Ausgängen, Beziehungsmodell, Kundenkäufe, Alterskontrolle, Determinismus, Figuren und Oberfläche. Alles hier ist im Code geprüft (Stand der Quelldateien in Abschnitt 13). Die Prüfergebnisse (Vitest, Browserprüfung) stehen im [technischen Ist-Stand](TECHNISCHER-IST-STAND.md), die Typen und Verträge in [MODUL-UND-DATENVERTRAEGE.md, Abschnitt 16](MODUL-UND-DATENVERTRAEGE.md), die Begründungen in den [ADRs](ARCHITEKTUR-ENTSCHEIDUNGEN.md) (ADR-017 bis ADR-022). **Alle Namen, Orte, Produkte und Vereine sind frei erfunden; Ähnlichkeiten mit realen Personen sind zufällig.**

Wochentage werden als Index 0 = Montag bis 6 = Sonntag gespeichert und gerechnet (Tag 1 = Montag); hier stehen sie als Mo bis So. Uhrzeiten sind Spielzeit (1 Spielminute = 1 Sekunde bei Tempo 1×).

## 1. Überblick

| Größe | Wert |
|---|---|
| Bewohner | 4 (`npc.guenter`, `npc.derya`, `npc.jonas`, `npc.marlene`) |
| Orte (Places) | 8: 3 Ausgänge, Verkaufsfenster, Ecke, Gehweg (nur Durchgang), Hofbank, Werkstatt |
| Wegpunkte / Kanten | 39 / 46 (handgepflegter Graph, `src/content/regions/ruhrgebiet/nav.ts`) |
| Routineeinträge | 21 (Günter 5, Derya 5, Jonas 6, Marlene 5) |
| Warenwünsche | 13 (Günter 3, Derya 3, Jonas 4, Marlene 3) |
| Dialoge / Dialogknoten | 56 / 129 (Günter 19, Derya 14, Jonas 9, Marlene 14) |
| Geschichten | 2 (`quest.hof` mit 3 Schritten und 4 Ausgängen, `quest.paket` mit 4 Schritten und 2 Ausgängen) |
| Story-Flags | 5 (`yard.bench`, `parcel.at-kiosk`, `kiosk.photo`, `photo.stand-idee`, `photo.stand`) |
| Beziehungseffekte | 51 verschiedene Schlüssel (`k.…`), jeder wirkt höchstens einmal |
| Figuren | prozedural, Asset-IDs N-002, N-003, N-006, N-007 |

Quellen: Inhalt in `src/content/regions/ruhrgebiet/{residents,nav,quests,customerLines,dialogueKit,dialogues*}.ts`, Regeln in `src/game/{npcSim,dialogue,story,conditions,relationship,wishes,nav,random}.ts`, Figuren in `src/world/assets/residents/`, Oberfläche in `src/ui/panels/{dialogue,journal}.ts` und `src/ui/socialViewModel.ts`.

## 2. Die vier Bewohner

| | Günter Wollny | Derya Aksoy | Jonas Pietrek | Marlene Hoffmann |
|---|---|---|---|---|
| ID | `npc.guenter` | `npc.derya` | `npc.jonas` | `npc.marlene` |
| Figur (Asset-ID) | N-002 Stammkunde | N-003 Handwerkerin | N-006 Fahrradkurier | N-007 Nachbarin |
| Alter | 71 | 38 | 17 | 58 |
| Rolle | Stammkunde, früher Stellwerker | Tischlerin mit Werkstatt im Hinterhof | Fahrradkurier (Apothekenfahrten und Pakete) | Schulsekretärin, organisiert die Hausgemeinschaft |
| Eigenschaften | trocken, aufmerksam, eigensinnig, verlässlich | praktisch, direkt, hilfsbereit, ungeduldig | flink, neugierig, chaotisch, freundlich | warmherzig, bestimmt, ordnungsliebend, gesellig |
| Gehgeschwindigkeit | 0,9 m/s | 1,4 m/s | 1,6 m/s | 1,2 m/s |
| Startbeziehung | 30 (bekannt) | 10 (fremd) | 5 (fremd) | 12 (fremd) |
| Heimatausgang | `place.exit-west` | `place.exit-hof` | `place.exit-east` | `place.exit-hof` |

Die Gehgeschwindigkeit gilt bei Tempo 1× und wird mit dem Spieltempo skaliert.

**Biografien (aus den Inhaltsdaten):**
- **Günter Wollny:** Hat vierzig Jahre lang Weichen und Signale gestellt und sieht seitdem jede Veränderung auf der Straße zuerst: neue Gardinen, ein anderes Fahrrad, wer zu früh heimgeht. Trocken im Humor, nie nur wehmütig. Schiebermütze, Gehstock, das Knie macht ihm zu schaffen. Morgens Zeitung und Brötchen, manchmal abends ein Pils.
- **Derya Aksoy:** Hat vor vier Jahren eine kleine Tischlerei im Hinterhof aufgemacht und kennt durch Reparaturen halb die Straße. Praktisch, direkt, hilfsbereit und ein bisschen ungeduldig. Arbeitshose, Werkzeuggürtel, Sägespäne an den Ärmeln. Morgens Brötchen und Wasser, mittags etwas Süßes.
- **Jonas Pietrek:** Macht eine Ausbildung und fährt nach der Berufsschule Apothekenlieferungen und Pakete durchs Viertel. Schnell, immer ein bisschen zu spät, kennt jede Abkürzung und bringt Neuigkeiten aus anderen Straßen mit. Fahrradhelm, Kuriertasche, Jacke. Kommt an wechselnden Wochentagen zu wechselnden Zeiten.
- **Marlene Hoffmann:** Sitzt im Sekretariat einer Berufsschule und hält nebenbei das Haus zusammen: Aushänge, Mülltonnen, Treppenhausfest. Warm, aber bestimmt, und sie schätzt ruhige Morgen. Strickjacke, Einkaufstasche, aufrechter Gang. Zeitung, Schokolade und manchmal eine Limonade.

**Vorlieben und Abneigungen** (`likes`/`dislikes`, Produkt-IDs oder `tag:<Nachfrage-Tag>`): Die Werte werden validiert (die Produkte und Tags müssen existieren, nichts darf in beiden Listen stehen), **haben aber im Spiel keine Wirkung**: Warenwünsche und Reaktionen hängen von Bedingungen und Gewichten der Wünsche ab (Abschnitt 7), nicht von `likes`.

| | gern | nicht gern |
|---|---|---|
| Günter | Halden-Echo Lokalblatt, Pottbäcker Brötchen, Püttbräu Pils, Knobelschacht Rätselheft | Zechenblitz Energy, `tag:kids` |
| Derya | Pottbäcker Brötchen, Ruhrbrause Wasser still, Pottbäcker Streuselteilchen, `tag:morning` | Ruhrbrause Brause Klassik |
| Jonas | Zechenblitz Energy, Eiskumpel Wassereis Brause, `tag:sport` | Knobelschacht Rätselheft |
| Marlene | Halden-Echo Lokalblatt, Naschwerk Vollmilchschokolade, Ruhrbrause Zitronenlimo | Püttbräu Schachtbier Dose, `tag:matchday` |

**Beziehungen der Bewohner untereinander** (`relationships`, beschreibende Daten: Art und Notiz, ohne Zahlenwert und ohne Spielwirkung; sie sind validiert und dienen als Quelle für Dialoge):

| Von | zu | Art | Notiz |
|---|---|---|---|
| Günter | Derya | Bekannte | Derya hat ihm im Frühjahr die Gartenbank repariert und wollte kein Geld dafür. |
| Günter | Marlene | Hausnachbarin | Sie bringt ihm den Hausaushang vorbei; er kommentiert ihn trocken. |
| Günter | Jonas | Lieferbekanntschaft | Jonas bringt ihm manchmal Medikamente aus der Apotheke; Günter nennt ihn „den Rennleiter“. |
| Derya | Günter | Bekannter | Schätzt seine Hartnäckigkeit; sein Wackeltisch ist ihr Dauerauftrag. |
| Derya | Marlene | Hofnachbarin | Respekt auf beiden Seiten, aber der Sägelärm steht zwischen ihnen. |
| Derya | Jonas | Kurier | Jonas holt gelegentlich Zuschnitte für sie ab und kommt dabei nie pünktlich. |
| Jonas | Günter | Kundschaft | Liefert ihm Medikamente und mag, dass er immer Trinkgeld verspricht und nie vergisst, ihn zu veräppeln. |
| Jonas | Derya | Auftraggeberin | Holt für sie Zuschnitte ab. Sie schimpft über seine Pünktlichkeit und gibt ihm trotzdem jeden Auftrag. |
| Jonas | Marlene | Sekretärin der Berufsschule | Sie kennt ihn aus dem Sekretariat, wegen fehlender Entschuldigungen. |
| Marlene | Günter | Hausnachbar | Kennt ihn seit dem Treppenhausfest und sorgt dafür, dass er den Hausaushang bekommt. |
| Marlene | Derya | Hofnachbarin | Mag ihre Arbeit, nicht den Zeitpunkt. Der Hof als Treffpunkt ist ihr wichtiger als das Holz. |
| Marlene | Jonas | Schüler der Berufsschule | Sie jagt ihm Entschuldigungen hinterher und hält ihn insgeheim für den Fleißigsten. |

**Aussehen und Figur** (Maße im Ruhezustand, in Vitest an den echten Fabriken gemessen; Details in Abschnitt 11):

| Figur | Höhe | Kleidung und Merkmale | Gang |
|---|---|---|---|
| N-002 Günter | 1,72 m | flache olivgrüne Mütze mit kurzem Schirm, helle graue lange Jacke mit rotem Schal, anthrazitfarbene Hose, weiße Haare an den Seiten, Gehstock in der rechten Hand | gebeugt (Neigung 0,24 rad), kurze langsame Schritte, rechter Arm schwingt kaum |
| N-003 Derya | 1,81 m | senfgelbes Arbeitshemd mit hochgekrempelten Ärmeln, braune Arbeitshose mit dunklen Kniepolstern, hellbrauner Werkzeuggürtel mit Tasche und Hammer, schwere braune Stiefel, dunkles Haar im Dutt mit Bleistift | breit und sicher, lange Schritte |
| N-006 Jonas | 1,83 m | limettengrüner Fahrradhelm mit Schirm, anthrazitfarbener Kapuzenpulli, helle schmale Hose, weiße Turnschuhe, große petrolfarbene Kuriertasche am Rücken mit gelbem Reflexgurt quer über der Brust | schlank, weit ausholend, deutliche Vorwärtsneigung |
| N-007 Marlene | 1,67 m | pflaumenfarbene Strickjacke über cremefarbener Bluse, camelfarbener Midirock, dunkle Strumpfhose, kurze silberblonde Locken, rot gerahmte Brille, mintfarbene Einkaufstasche in der linken Hand | aufrecht, mittleres Tempo, linker Arm schwingt kaum |

## 3. Orte, Wege und Routinen

### 3.1 Koordinaten und Orte
Maße in Metern, +X Osten, +Z Süden. Das Kioskgebäude steht bei x −3…3, z −2…2 (Südwand z = 2, Verkaufsfenster x −2,4…0,4, Tür x 1,5…2,5). Der Gehweg liegt bei z 2…5, der Hof nördlich bis z −8; die Figur darf sich innerhalb x −11…11, z −7…4,8 bewegen.

**Zwei Gehweg-Bahnen** verhindern, dass sich zwei Bewohner (oder ein Bewohner und der Spieler) auf dem Gehweg blockieren:
- **Bahn A** (Hauptbahn) bei z = 3,3: `wp.a-1` bis `wp.a-12` bei x = −8,0 / −5,4 / −3,0 / −1,7 / −1,0 / −0,3 / 1,2 / 3,0 / 3,9 / 4,8 / 5,7 / 7,5.
- **Bahn B** (Umgehung) bei z = 4,3: `wp.b-1` bis `wp.b-7` bei x = −8,0 / −5,4 / −3,0 / −0,3 / 3,0 / 5,7 / 7,5.
- Verbindungen zwischen den Bahnen bei x = −8, −5,4, −3, −0,3, 3, 5,7 und 7,5; beide Bahnen enden an den Ausgängen im Westen und Osten.
- Der Startpunkt des Spielers (0,9 / 3,6) liegt zwischen den Bahnen; so kommen Bewohner an ihm vorbei.

**Ausgänge** (hier erscheinen und verschwinden Bewohner; je genau ein Standpunkt):

| Ort | Wegpunkt | Position (x / z) | Blickrichtung |
|---|---|---|---|
| `place.exit-west` | `wp.exit-west` | −10,8 / 3,8 | nach Osten |
| `place.exit-east` | `wp.exit-east` | 10,8 / 3,8 | nach Westen |
| `place.exit-hof` | `wp.exit-hof` | −10,2 / −6,3 | nach Süden |

**Aufenthaltsorte** (jeder Standplatz ist ein Wegpunkt; die Blickrichtung ist in Radiant gespeichert, 0 = +Z):

| Ort | Art | Standplätze (Position x / z) | Blick |
|---|---|---|---|
| `place.kiosk-window` | Verkaufsfenster | `wp.win-1` (−1,7 / 2,55), `wp.win-2` (−1,0 / 2,55), `wp.win-3` (−0,3 / 2,55) | zum Fenster (Norden) |
| `place.corner` | Gehweg (Ecke östlich der Tür) | `wp.corner-1` (3,9 / 2,45), `wp.corner-2` (4,8 / 2,45), `wp.corner-3` (5,7 / 2,45) | zueinander bzw. zur Straße |
| `place.gehweg` | Gehweg, nur Durchgang | `wp.a-3` (−3,0 / 3,3) | – (kein Stehplatz) |
| `place.yard-bench` | Hof, Bankplätze | `wp.bank-1` (−6,5 / 0,4), `wp.bank-2` (−5,4 / 0,4), `wp.bank-3` (−4,3 / 0,4) | zueinander |
| `place.workshop` | Hof, Werkstattecke | `wp.work-1` (−8,0 / −2,4), `wp.work-2` (−7,4 / −1,6) | zur Werkstatt |

Weitere Wegpunkte im Hof: die Hofbahn bei z = 1,5 (`wp.y-1` bis `wp.y-4` bei x = −8,0 / −6,5 / −5,4 / −4,3, angebunden an Bahn A bei `wp.a-2`), `wp.y-5` (−9,4 / −1,0) und `wp.y-6` (−9,8 / −4,5) auf dem Weg zum Hofausgang.

Regeln des Graphen (von `validateResidents` geprüft): jeder Standplatz liegt höchstens 1,8 m (`NPC_TALK_RADIUS`) vom Standpunkt hinter der Theke (−1,0 / 0,95) entfernt, wenn er zum Verkaufsfenster gehört; Standplätze halten 0,65 m Abstand zueinander und zu jeder Bahn, zu der sie nicht gehören; der Zugang zur Tür bleibt frei; jede Kante ist für einen Kreis mit Radius 0,3 m frei von Kollisionsrechtecken (Wände, Möbel, auch die später erscheinende Hofbank); jeder Wegpunkt ist von jedem Ausgang erreichbar.

### 3.2 Routinen
Ein Routineeintrag (`RoutineEntry`) hat Wochentage, Zeitfenster (Minuten seit Mitternacht, Beginn eingeschlossen, Ende ausgeschlossen, zwischen 06:00 und 22:00), Aktivität, Ort, eine Wahrscheinlichkeit in Prozent und optionale Bedingungen. Aktivitäten: **shop** (Kunde am Verkaufsfenster, nur dort erlaubt), **visit** und **linger** (am Ort stehen; beide verhalten sich in der Simulation gleich), **pass-by** (vom Heimatausgang durch den Ort zu einem anderen Ausgang gehen, ohne stehen zu bleiben; in der Praxis führt es über den westlichen Ausgang).

| Bewohner | Eintrag | Tage | Zeit | Ort | Aktivität | Chance | Bedingung |
|---|---|---|---|---|---|---|---|
| Günter | `g.morgen` | Mo–Sa | 07:00–09:30 | Verkaufsfenster | shop | 85 % | – |
| | `g.sonntag` | So | 09:00–11:00 | Verkaufsfenster | shop | 70 % | – |
| | `g.ecke` | Di, Do | 14:00–16:00 | Ecke | linger | 70 % | – |
| | `g.abend` | Mi, Fr, Sa | 18:00–20:30 | Verkaufsfenster | shop | 60 % | – |
| | `g.bank` | Sa, So | 15:00–17:00 | Hofbank | visit | 80 % | Flag `yard.bench` |
| Derya | `d.broetchen` | Mo–Fr | 06:30–07:30 | Verkaufsfenster | shop | 75 % | – |
| | `d.saegen-frueh` | Mo–Sa | 07:30–12:30 | Werkstatt | linger | 90 % | Ausgang von `quest.hof` weder `kompromiss` noch `marlene` |
| | `d.saegen-spaet` | Mo–Sa | 09:00–12:30 | Werkstatt | linger | 85 % | Ausgang von `quest.hof` ist `kompromiss` oder `marlene` |
| | `d.suess` | Mo–Fr | 12:45–13:45 | Verkaufsfenster | shop | 70 % | – |
| | `d.bank` | Mi, Fr | 17:30–19:00 | Hofbank | visit | 70 % | Flag `yard.bench` |
| Jonas | `j.di` | Di | 15:15–16:30 | Verkaufsfenster | shop | 85 % | – |
| | `j.do` | Do | 16:30–18:00 | Verkaufsfenster | shop | 85 % | – |
| | `j.fr-pause` | Fr | 13:00–13:45 | Ecke | visit | 70 % | – |
| | `j.fr-durch` | Fr | 17:00–17:30 | Gehweg | pass-by | 80 % | – |
| | `j.sa` | Sa | 10:30–12:30 | Verkaufsfenster | shop | 75 % | – |
| | `j.mi` | Mi | 12:15–13:00 | Gehweg | pass-by | 60 % | – |
| Marlene | `m.sa-echo` | Sa | 09:00–10:30 | Verkaufsfenster | shop | 80 % | – |
| | `m.werktag` | Mo–Fr | 14:30–15:30 | Verkaufsfenster | shop | 65 % | – |
| | `m.ecke` | Mo, Mi | 17:00–18:00 | Ecke | visit | 60 % | – |
| | `m.hof-bank` | Do, So | 17:00–18:30 | Hofbank | visit | 90 % | Flag `yard.bench` |
| | `m.hof-treff` | Do, So | 17:00–18:30 | Hofbank | visit | 60 % | Ausgang von `quest.hof` ist nicht `derya` |

Folgen der Geschichten für die Routinen (siehe Abschnitt 6): **Derya sägt später**, wenn Story A mit `kompromiss` oder `marlene` endet (sie ist dann erst ab 09:00 statt ab 07:30 in der Werkstatt); die **Hofbank** (Flag `yard.bench`, nur bei `kompromiss`) schaltet zusätzlich drei Bankbesuche frei (`g.bank`, `d.bank`, `m.hof-bank`); nach `derya` entfällt Marlenes Hoftreff (`m.hof-treff`). Der Ort `place.yard-bench` hat auch ohne Bank-Möbel Standplätze; Marlene trifft sich dort also schon vor der Bank (außer nach `derya`).

Auswahlregeln (`pickRoutine` in `src/game/npcSim.ts`):
1. Es zählt der erste Eintrag in Listenreihenfolge, dessen Fenster jetzt gilt, dessen Wochentag stimmt (`weekdayOf(Tag)`), der heute noch nicht erledigt ist und dessen Bedingungen gelten.
2. Pro Tag und Eintrag gibt es genau einen deterministischen Wurf (Abschnitt 9); besteht er, startet der Eintrag, sobald das Fenster beginnt und die Spieluhr in der Phase „open“ steht.
3. Ein Bewohner erscheint am Heimatausgang und geht über den kürzesten Weg (Dijkstra auf dem Graphen) zu einem freien Standplatz seines Ortes. Ist kein Platz frei oder steht jemand (auch der Spieler) auf dem Ausgang, startet der Eintrag nicht und wird im nächsten Simulationsschritt erneut versucht, solange das Fenster gilt.
4. Der Eintrag gilt als erledigt, wenn der Bewohner ihn beendet (Fenster vorbei, bedient oder abgelehnt, oder Tagesphase nicht mehr „open“); `doneToday` wird mit dem Tageswechsel zurückgesetzt. Ein Eintrag läuft also höchstens einmal pro Tag.
5. Nach Fensterende geht der Bewohner zum Heimatausgang zurück (ein Spaziergang mit `pass-by` wird zu Ende gegangen). Bei Tagesschluss (22:00-Wartezustand oder Abschluss) gehen alle Bewohner heim.

### 3.3 Zustände
`NpcStatus`: `away` (nicht in der Welt), `walking`, `at_place` (steht an einem Ort), `waiting` (Kunde mit offenem Wunsch am Verkaufsfenster), `talking` (im Gespräch). Es gibt keinen eigenen Zustand `at_kiosk`; `at_place` an `place.kiosk-window` entspricht ihm. Übergänge sind das Signal `npc.status.changed` (nie pro Tick). Der Ablauf eines Kunden ist `away → walking → at_place → waiting → walking → away`; ein Bewohner in einem Gespräch (`talking`) steht still, auch wenn er unterwegs war, und läuft danach weiter.

### 3.4 Blockaden und Ausweichen
- Bewohner bleiben vor dem Spieler und vor anderen Bewohnern stehen, sobald sie ihnen näher als der Mindestabstand kämen (Spieler 0,65 m = `PLAYER_RADIUS` 0,3 + `NPC_RADIUS` 0,3 + `NPC_CLEARANCE_MARGIN` 0,05; Bewohner untereinander 0,65 m). **Bewohner schieben den Spieler nie**, und der Spieler wird von Bewohnern nie bewegt.
- Nach `NPC_BLOCKED_WAIT_SECONDS` = 4 s Blockade sucht der Bewohner eine andere Route, die die blockierte Kante meidet (praktisch die Umgehungsbahn B); gibt es keine, wartet er und versucht es später erneut, auch beliebig lange, solange der Spieler im Weg steht.
- Zwischen zwei gehenden Bewohnern weicht der mit der höheren ID aus (der mit der niedrigeren hat Vorrang).
- **Letzte Rückfallebene gegen eine dauerhafte Verklemmung:** Nach `NPC_DEADLOCK_SECONDS` = 20 s ununterbrochener Blockade durch einen Bewohner (ohne Ausweichroute) geht der ausweichpflichtige Bewohner durch den anderen hindurch, bis kein Bewohner mehr in seiner Nähe ist. Das betrifft nur Bewohner untereinander, nie den Spieler, nie Wände oder Möbel (die Wege sind validiert kollisionsfrei).
- Die Simulation läuft in Teilschritten von höchstens 1/30 s (Spieltempo-skaliert) und erzeugt keine Objekte pro Bild.

## 4. Gespräche und Dialogsystem

### 4.1 Wer spricht mit wem
Der Spieler kann einen **sichtbaren** Bewohner (Status nicht `away`) ansprechen, der höchstens `NPC_TALK_RADIUS` = 1,8 m entfernt steht und in den der Blickwinkel höchstens `NPC_TALK_MAX_ANGLE` = 75° abweicht (ein Bewohner praktisch auf dem Spieler gilt als angesehen). Das gilt auch über die Theke von hinten und für gehende Bewohner. Der nächste Bewohner gewinnt; ein Bewohner in Reichweite hat Vorrang vor Kiosk-Interaktionspunkten. E oder ein Klick auf den Hinweis „Mit … sprechen“ öffnet das Gespräch.

### 4.2 Welches Gespräch kommt
`DialogueEngine.open` entscheidet:
1. **Wartet der Bewohner mit einem offenen Wunsch** (Status `waiting`), beginnt das eingebaute **Kundengespräch** (Abschnitt 7). In dieser Zeit wird **kein** Geschichtsgespräch angeboten.
2. Sonst wird aus `NpcDef.dialogueIds` das Gespräch mit der **höchsten Priorität** gewählt, dessen Bedingungen gelten; bei gleicher Priorität gewinnt der frühere Eintrag in der Liste. Einmalige Gespräche (`once`) entfallen, sobald sie gesehen sind. Gibt es keines, lehnt `open` mit `nothing_to_say` ab (die Validierung verlangt je Bewohner ein unbedingtes, nicht einmaliges Rückfallgespräch).
3. Beim Öffnen: Der **Tagesgruß** gibt +1 Beziehung (einmal pro Tag und Bewohner), `lastTalk` wird gesetzt, der Bewohner dreht sich zum Spieler und wechselt in `talking`.

Ein Geschichtsgespräch gilt erst als **gesehen** (`story.seenDialogues`), wenn es mit einer Antwort ohne Folgeknoten endet. Wird es vorzeitig geschlossen (Schaltfläche, Escape) oder durch Laden bzw. „Neues Spiel“ verworfen, wird es nicht vermerkt und beim nächsten Ansprechen wieder angeboten. So kann ein einmaliges Gespräch, das eine Geschichte startet, nicht durch Schließen verloren gehen.

### 4.3 Aufbau
Ein Gespräch (`DialogueDef`) hat ID `dialogue.…`, Bewohner, Priorität, optionale Bedingungen, `once`, einen Startknoten und Knoten (`DialogueNode`: Text und 1 bis 4 Antworten). Eine Antwort hat Text, optionale Bedingungen, optionale Effekte und optional einen Folgeknoten (fehlt er, endet das Gespräch). Jeder Knoten braucht mindestens eine unbedingte Antwort. Die Antworten sind im Panel mit den Tasten 1 bis 4 wählbar.

**Bedingungen** (geschlossene Menge, keine Skripte): `flag`, `relationshipAtLeast`, `relationshipBelow`, `questStep`, `questOutcome`, `questNotStarted`, `time` (von eingeschlossen, bis ausgeschlossen), `weekday`, `seen`, `memory`, `dayAtLeast`, `not`, `any`. Unbekannte IDs lassen eine Bedingung nie zutreffen und werfen nie.

**Effekte** (geschlossene Menge): `relationship` (Wert mit Schlüssel, höchstens einmal je Schlüssel für immer, danach auf 0 bis 100 begrenzt), `setFlag`, `remember` (Erinnerung des Bewohners, einmal), `questStep` (nur vorwärts, nach einem Ausgang wirkungslos), `questOutcome` (endgültig, ein zweiter Ausgang wirkt nicht) und die Kundeneffekte `sellWish`, `declineWish`, `checkId`, die auf den offenen Wunsch des Gesprächspartners wirken. Sie gehören dem eingebauten Kundengespräch; die Engine würde sie auch in einer Dialogoption ausführen, die Inhaltsvalidierung verbietet sie aber in Dialogen und in den Effekten der Wünsche. Alle Effekte einer Antwort laufen atomar und in Reihenfolge; schlägt ein Kundeneffekt fehl, wird die Antwort abgebrochen, bevor ein anderer Effekt wirkt. Es gibt keinen Effekt „Gegenstand vergeben“; Belohnungen sind Flags (z. B. `kiosk.photo`), die die Welt sichtbar verändern.

Die Validierung (`validateResidents`) prüft unter anderem: eindeutige IDs mit Präfix, auflösbare Verweise auf Bewohner, Dialoge, Quests, Produkte und Orte, erreichbare Knoten, 1 bis 4 Antworten und eine unbedingte Antwort je Knoten, Zeitfenster und Wochentage, Beziehungsschwellen 0 bis 100, Effektwerte (nicht null, höchstens ±20), Erinnerungen und Flags, die jemand setzt, widersprüchliche Ausgänge oder Flags in einer Antwort und einen Beziehungsschlüssel, der für verschiedene Effekte benutzt wird. Sie prüft **nicht**, ob die Bedingungen eines Gesprächs im Spiel je zusammen erfüllbar sind (siehe Einschränkungen).

### 4.4 Alle Gespräche
Priorität (P), einmalig (1×), Bedingung. Rein zeitabhängige Gespräche: „morgens“ = 06:00–12:00, „abends“ = 17:00–22:00, „nachmittags“ = 12:00–17:00. Beziehungswerte siehe Abschnitt 5; „Beziehung ≥ n“ meint den Wert des sprechenden Bewohners.

**Günter (19):**

| Gespräch (`dialogue.guenter.…`) | P | 1× | Bedingung | Inhalt |
|---|---|---|---|---|
| `erstes-mal` | 80 | ja | – | Erste Begegnung; Echo zusagen (+4, Erinnerung `guenter:echo-zugesagt`), offen lassen (+1), nach dem Stellwerk fragen (+2) |
| `moin` | 1 | | – | Rückfallgespräch: Knie (+1, einmalig), Neues auf der Straße |
| `moin-morgen` | 5 | | morgens | Morgenplausch über das Echo |
| `moin-abend` | 5 | | abends | Feierabend, das Stellwerk |
| `vertraut` | 9 | | Beziehung ≥ 50 | Das Nicken am Büdchen |
| `echo-erinnerung` | 8 | ja | Erinnerung `guenter:echo-zugesagt`, morgens | „liegt bereit“ (+2) oder „heute leider nicht“ (−1) |
| `klappe-zu` | 30 | ja | Erinnerung `kiosk-closed` | Reaktion auf die geschlossene Klappe: „kommt nicht wieder vor“ (+2) oder „ich hab auch ein Leben“ (−2) |
| `pils-vergessen` | 31 | ja | Erinnerung `declined:wish.guenter-pils` | Reaktion auf abgelehntes Pils: Zusage, welches da zu haben (+1) |
| `paket-bitte` | 60 | ja | Geschichte B nicht gestartet, `erstes-mal` gesehen, ab Tag 2 | Start von Geschichte B (Abschnitt 6.2) |
| `paket-nochmal` | 59 | | Geschichte B bei Schritt `bitte` | erneute Bitte |
| `paket-uebergabe` | 70 | | Flag `parcel.at-kiosk`, Schritt `paket` | Paketübergabe |
| `foto-kompromiss`, `foto-derya`, `foto-marlene`, `foto-neutral` | 72 | ja | Schritt `uebergeben`, Ausgang von Geschichte A | Fotoszene je Ausgang |
| `foto-offen` | 71 | ja | Schritt `uebergeben`, Geschichte A ohne Ausgang | Fotoszene ohne Entscheidung |
| `foto-danach` | 12 | | Ausgang `foto`, ohne Flag `photo.stand` | „Hängt mein Foto noch?“ (+1, einmalig) |
| `foto-staender` | 13 | | Ausgang `foto`, mit Flag `photo.stand` | Das Foto steht auf einem Eichenständer (+2, einmalig) |
| `paket-abgelehnt` | 30 | ja | Ausgang `abgelehnt` von Geschichte B | Günter hat das Paket selbst geholt; „ich hätte es annehmen sollen“ (+2) |

**Derya (14):**

| Gespräch (`dialogue.derya.…`) | P | 1× | Bedingung | Inhalt |
|---|---|---|---|---|
| `erstes-mal` | 80 | ja | – | Das wackelnde Regal (+3, Erinnerung `derya:regal-angeboten`), die Werkstatt (+2) |
| `moin` | 1 | | – | Rückfallgespräch: Auftragslage; „Du kennst hier alle?“ (+1, Erinnerung) |
| `moin-morgen` | 6 | | morgens, Geschichte A nicht gestartet | „Ja, ich fang früh an“ |
| `moin-mittag` | 5 | | nachmittags | Mittagszucker |
| `vertraut` | 9 | | Beziehung ≥ 50 | Ihr Vater, der Schreiner |
| `bank` | 9 | | Flag `yard.bench`, Ausgang `kompromiss` | Wollny hat die Bank ausprobiert |
| `hof-seite` | 60 | | Geschichte A bei Schritt `beschwerde` | Deryas Seite (Abschnitt 6.1) |
| `hof-entscheidung` | 62 | | Geschichte A bei Schritt `gegenseite` | Entscheidung (Abschnitt 6.1) |
| `nachklang-kompromiss`, `-derya`, `-marlene`, `-neutral` | 70 | ja | Ausgang von Geschichte A | Rückblick, je nach Ausgang |
| `foto-staender` | 58 | ja | Flag `photo.stand-idee`, ohne Flag `photo.stand` | Angebot, einen Ständer für das Foto zu bauen |
| `foto-kuehl` | 58 | ja | Flag `kiosk.photo`, Ausgang `marlene` | kühler Kommentar zum Foto |

**Jonas (9):**

| Gespräch (`dialogue.jonas.…`) | P | 1× | Bedingung | Inhalt |
|---|---|---|---|---|
| `erstes-mal` | 80 | ja | – | Vorstellung; Fahrrad (+2), Tipps (Erinnerung `jonas:tipp-bekommen`) |
| `moin` | 1 | | – | Rückfallgespräch, Neuigkeiten aus der Hüttenstraße |
| `neuigkeit-hof` | 7 | | Geschichte A bei Schritt `gegenseite` | Jonas hat von dem Streit im Hof gehört |
| `neuigkeit-bank` | 8 | | Flag `yard.bench` | die neue Bank im Hof |
| `neuigkeit-foto` | 8 | | Flag `kiosk.photo` | das Foto auf der Theke |
| `vertraut` | 9 | | Beziehung ≥ 50 | Wunsch, Mechatroniker zu werden |
| `paket` | 60 | | Geschichte B bei Schritt `angebot` | Paketübergabe an den Kiosk (Abschnitt 6.2) |
| `paket-danach` | 40 | ja | Ausgang `foto` von Geschichte B | Günter hat Trinkgeld gegeben (+2 bei „Ich hab ein Paket angenommen“) |
| `tabak-reaktion` | 40 | ja | Erinnerung `declined:wish.jonas-tabak` | Reaktion auf den abgelehnten Tabak: „Regel ist Regel“ (+2) |

**Marlene (14):**

| Gespräch (`dialogue.marlene.…`) | P | 1× | Bedingung | Inhalt |
|---|---|---|---|---|
| `erstes-mal` | 80 | ja | – | Aushang (+3, Erinnerung `marlene:aushang`), „noch neu“ (+1) |
| `moin` | 1 | | – | Rückfallgespräch über das Haus |
| `moin-du` | 3 | | Erinnerung `marlene:duzen` | Rückfallgespräch im Du |
| `moin-morgen` | 5 | | morgens | „Morgens brauche ich Ruhe“ |
| `duzen` | 30 | ja | Beziehung ≥ 30 | Angebot, sich zu duzen („Gern, Marlene“ +3 und Erinnerung `marlene:duzen`; „lieber beim Sie“ Erinnerung `marlene:siezen`) |
| `vertraut` | 9 | | Beziehung ≥ 50, Erinnerung `marlene:duzen` | der Hof als Nachbarschaft |
| `bank` | 9 | | Flag `yard.bench`, Ausgang `kompromiss` | Hofabende auf der Bank |
| `hof-beschwerde` | 60 | | Geschichte A nicht gestartet, `erstes-mal` gesehen | Start von Geschichte A (Abschnitt 6.1) |
| `hof-entscheidung` | 62 | | Geschichte A bei Schritt `gegenseite` | Entscheidung (Abschnitt 6.1) |
| `nachklang-kompromiss`, `-derya`, `-marlene`, `-neutral` | 70 | ja | Ausgang von Geschichte A | Rückblick, je nach Ausgang |
| `foto-kuehl` | 58 | ja | Flag `kiosk.photo`, Ausgang `derya` | kühler Kommentar zum Foto |

Nicht einmalige Folgegespräche mit höherer Priorität (z. B. Günters `foto-danach`/`foto-staender`, Jonas’ `neuigkeit-*`, Derya `bank`) ersetzen das einfache `moin` ihres Bewohners dauerhaft, sobald ihre Bedingung gilt.

## 5. Beziehungsmodell und Erinnerungen

- **Wert:** ganze Zahl 0 bis 100 je Bewohner (`NpcState.relationship`), Startwerte siehe Abschnitt 2. Änderungen werden gerundet und begrenzt; `relationship.changed` kommt nur bei echter Änderung.
- **Stufen** (`RELATIONSHIP_TIER_THRESHOLDS`): **fremd** 0–19, **bekannt** 20–49, **vertraut** 50–79, **eng verbunden** 80–100. In der Oberfläche steht die Stufe als kleines Etikett im Gesprächskopf (kein Zahlenwert, keine Leiste über dem Kopf); ein Stufenwechsel erzeugt einen zurückhaltenden Hinweis („… kennt dich jetzt.“, „… vertraut dir inzwischen.“, „Zwischen dir und … ist eine echte Verbindung gewachsen.“, bzw. „… wirkt dir gegenüber distanzierter.“).
- **Die einzige wiederholbare Änderung** ist der **Tagesgruß**: +1 (`DAILY_GREETING_BONUS`) beim ersten Gespräch mit einem Bewohner an einem Spieltag (`greetedDay`).
- **Alle anderen Änderungen sind einmalig:** Ein `relationship`-Effekt trägt einen Schlüssel (`k.…`); der Schlüssel wird in `story.effectKeys` gespeichert, und derselbe Schlüssel wirkt nie ein zweites Mal. Wiederholtes Anklicken derselben Antwort bringt also nichts (kein Farmen). Die Validierung lässt einen Schlüssel nur für denselben Bewohner und Wert zu und verbietet Werte 0 und über ±20.
- **Käufe:** Der Kauf eines Wunsches setzt die Erinnerung `served:<Wunsch-ID>`; bei vier bestimmten Wünschen gibt es einmalig +2 (Günter `wish.guenter-echo`, Derya `wish.derya-suess`, Jonas `wish.jonas-energy`, Marlene `wish.marlene-echo`). Eine Ablehnung setzt `declined:<Wunsch-ID>`, ohne Beziehungsänderung.
- **Wirkung der Beziehung im Spiel:** Sie schaltet Gespräche frei (`vertraut` bei ≥ 50 für alle vier, Marlenes `duzen` bei ≥ 30) und die Option „vermitteln“ in Geschichte A (Beziehung beider ≥ 15). Beziehungen beeinflussen weder Preise, noch Besuchshäufigkeit, noch Wünsche.

**Erinnerungen** (`NpcState.memories`, einfache Zeichenketten, je Bewohner höchstens 200, ohne Doppelte):
- von der Spiellogik gesetzt: `served:<wishId>`, `declined:<wishId>`, `ignored:<wishId>` (der Kunde ging, ohne bedient oder abgelehnt zu sein) und `kiosk-closed` (der Kunde wartete vergeblich auf die geöffnete Klappe);
- von Dialogen gesetzt (`<bewohner>:<thema>`, z. B. `marlene:duzen`, `derya:hof-kompromiss`); Dialogbedingungen lesen davon nur wenige: `guenter:echo-zugesagt`, `kiosk-closed`, `declined:wish.guenter-pils`, `declined:wish.jonas-tabak`, `marlene:duzen`. Die übrigen stehen im Spielstand für spätere Inhalte.

**Flags** (`story.flags`, bis 500): `yard.bench` (Bank im Hof, nur Ausgang `kompromiss`), `parcel.at-kiosk` (das Paket liegt im Kiosk; wird bei der Übergabe wieder gelöscht), `kiosk.photo` (Foto auf der Theke), `photo.stand-idee` (Günter hat die Ständer-Idee weitergegeben), `photo.stand` (Derya baut den Ständer; wirkt nur auf Dialoge, nicht auf die Szene).

## 6. Die zwei Geschichten

Beide Geschichten sind in `src/content/regions/ruhrgebiet/quests.ts` (Titel, Schritte, Ausgänge, Journaltext) und in den Dialogdateien (Effekte) definiert. Ein Schritt rückt nur vorwärts, ein Ausgang ist endgültig. Der Spieler kann jedes Gespräch unterbrechen; jede Geschichte kennt jederzeit nur den aktuellen Schritt. Geld ist nie ein Ausgang: Geschichte B ändert die Kasse nachweislich nicht (Test).

**Wo man wen trifft:** Ein Bewohner, der mit einem offenen Wunsch am Fenster wartet, spricht nur als Kunde. Geschichtsgespräche entstehen daher an der Ecke, im Hof, in der Werkstatt, bei gehenden Bewohnern oder wenn der Kunde am Fenster steht, während die Klappe zu ist (dann ohne Wunsch, bis er nach 30 Spielminuten geht). Ein Bewohner im Hof (Werkstatt, Bank) ist erreichbar, sobald der Spieler hinausgeht.

### 6.1 Geschichte A – „Krach im Hinterhof“ (`quest.hof`)

Marlene (Schulsekretärin) leidet unter dem Sägen ab halb sieben im Hof, Derya (Tischlerin) sägt morgens, weil die Aufträge am Mittag raus müssen. (Die Dialogtexte sprechen von „ab halb sieben“; als Routine ist Derya erst ab 07:30 in der Werkstatt, davor kauft sie Brötchen am Fenster. Die Texte und die Routine stimmen darin nicht genau überein.) Schritte: `beschwerde` → `gegenseite` → `entscheidung`. Ausgänge: `kompromiss`, `derya`, `marlene`, `neutral`.

**Entscheidungsbaum:**

```
Marlene `erstes-mal` gesehen (Voraussetzung)
└─ Marlene `hof-beschwerde` (P 60, Quest nicht gestartet)
   ├─ „Das klingt anstrengend.“ → Schritt `beschwerde`, Erinnerung marlene:hof-beschwerde, Marlene +3 (k.marlene.hof-zuhoeren)
   │   └─ Derya `hof-seite` (P 60, Schritt `beschwerde`)
   │      ├─ „Warum muss es so früh sein?“ → Knoten „grund“
   │      │   ├─ „Verstehe. Beide haben ihre Gründe.“ → Schritt `gegenseite`, Erinnerung derya:hof-gehoert, Derya +3 (k.derya.hof-zuhoeren)
   │      │   │   └─ ENTSCHEIDUNG (Derya `hof-entscheidung` oder Marlene `hof-entscheidung`, beide P 62, Schritt `gegenseite`; gleiche Effekte)
   │      │   │      ├─ „Gesägt wird erst ab neun … Bank“ (nur bei Beziehung Derya ≥ 15 und Marlene ≥ 15) → Ausgang `kompromiss`
   │      │   │      ├─ „Dein Hof, deine Werkstatt …“ → Ausgang `derya`
   │      │   │      ├─ „Morgens ist Ruhe …“ → Ausgang `marlene`
   │      │   │      └─ „Das müsst ihr unter euch klären.“ → Ausgang `neutral`
   │      │   └─ „Das klingt nach Ausrede.“ → endet ohne Effekt (Gespräch wird später wieder angeboten)
   │      └─ „Ich will mich nicht einmischen.“ → endet ohne Effekt (wird wieder angeboten)
   └─ „Das müssen Sie schon selbst klären.“ → Marlene −2 (k.marlene.abgewimmelt, einmalig), Quest bleibt ungestartet; Marlene bietet das Gespräch wieder an
```

Alle vier Entscheidungsantworten setzen den Schritt `entscheidung` und den Ausgang zusammen; sie sind in beiden Gesprächen gleich (gemeinsame Effektliste, gleiche Schlüssel: wer immer gefragt wird, die Wirkung tritt nur einmal ein). Die Startwerte 12 (Marlene) und 10 (Derya) liegen unter der Schwelle 15 der Vermittlung; mit den Zugewinnen der vorherigen Gespräche (Tagesgruß +1, `erstes-mal`-Antworten bis +3, `hof-zuhoeren` +3) wird die Option meist, aber nicht immer sichtbar. Rechenbeispiel aus den Daten: Antwortet der Spieler Derya im ersten Gespräch nur mit „Gut zu wissen.“ und führt alle ihre Gespräche am selben Tag, steht sie bei 10 + 1 + 3 = 14, und „vermitteln“ fehlt; ein Gespräch an einem späteren Tag bringt einen weiteren Tagesgruß.

**Alle Ausgänge:**

| Ausgang | Antwort | Effekte (Erinnerungen, Beziehung, Flag) | Folgen im Spiel |
|---|---|---|---|
| **`kompromiss`** | „vermitteln“ (nur bei Beziehung ≥ 15 beider) | Erinnerungen `derya:hof-kompromiss`, `marlene:hof-kompromiss`; Derya +5 (`k.hof.kompromiss.derya`), Marlene +5 (`k.hof.kompromiss.marlene`); Flag **`yard.bench`** | **Derya sägt erst ab 09:00** (`d.saegen-spaet`); die **Hofbank E-004** erscheint im Hof und kollidiert; neue Bankbesuche (Günter Sa/So, Derya Mi/Fr, Marlene Do/So, siehe 3.2); Derya wünscht morgens „Brötchen, Wasser. Gesägt wird erst ab neun.“ (`wish.derya-fruehstueck-neun`); Gespräche `bank` (Derya, Marlene), `neuigkeit-bank` (Jonas); Nachklang Marlene (+2 bei „Soll ich was beisteuern?“) und Derya (+2 bei „Das wird ein guter Platz.“); Günters Fotoszene `foto-kompromiss` mit der Ständer-Idee |
| **`derya`** | „Dein Hof, deine Werkstatt …“ | Erinnerungen `derya:hof-unterstuetzt`, `marlene:hof-uebergangen`; Derya +6 (`k.hof.derya.derya`), Marlene **−8** (`k.hof.derya.marlene`) | Derya sägt weiter ab 07:30; keine Bank; **Marlene gibt den Hoftreff auf** (`m.hof-treff` entfällt); Nachklang Marlene („Ich hab die Hofabende abgesagt“, +1) und Derya (+1); Günters `foto-derya`; Marlenes `foto-kuehl` zum Foto |
| **`marlene`** | „Morgens ist Ruhe …“ | Erinnerungen `derya:hof-uebergangen`, `marlene:hof-unterstuetzt`; Derya **−8** (`k.hof.marlene.derya`), Marlene +6 (`k.hof.marlene.marlene`) | **Derya sägt erst ab 09:00** (wie bei `kompromiss`), aber ohne Bank und verstimmt; Nachklang Derya („Ab neun, ohne mich zu fragen“, +2) und Marlene (+1); Günters `foto-marlene`; Deryas `foto-kuehl` zum Foto |
| **`neutral`** | „Das müsst ihr unter euch klären.“ | Erinnerungen `derya:hof-rausgehalten`, `marlene:hof-rausgehalten`; Derya −2 (`k.hof.neutral.derya`), Marlene −2 (`k.hof.neutral.marlene`) | nichts ändert sich im Hof (Derya sägt früh, keine Bank); Nachklang beider (je +1); Günters `foto-neutral` |

Die Nachklänge sind einmalige Gespräche (Priorität 70) nach dem Ausgang; die Beziehungsgewinne darin gibt es nur bei der jeweils ersten Antwort, nicht beim Schließen.

### 6.2 Geschichte B – „Ein Paket für Günter“ (`quest.paket`)

Günter kommt mit seinem Knie nicht zum Paketshop. Schritte: `bitte` → `angebot` → `paket` → `uebergeben`. Ausgänge: `foto`, `abgelehnt`.

**Entscheidungsbaum:**

```
Günter `erstes-mal` gesehen und ab Tag 2 (Voraussetzung)
└─ Günter `paket-bitte` (P 60, einmalig, Quest nicht gestartet)
   ├─ „Lass es doch hierher liefern. Ich nehm es an.“ → Schritte `bitte` und `angebot`, Erinnerung guenter:paket-angeboten, Günter +3 (k.guenter.paket-angebot)
   │   └─ Jonas `paket` (P 60, Schritt `angebot`)
   │      ├─ „Gib her, ich geb es ihm.“ → Flag `parcel.at-kiosk`, Schritt `paket`, Erinnerung jonas:paket-abgegeben, Jonas +4 (k.jonas.paket)
   │      │   └─ Günter `paket-uebergabe` (P 70, Flag `parcel.at-kiosk`, Schritt `paket`)
   │      │      ├─ „Ja. Das Paket ist da, bitte sehr.“ → Flag `parcel.at-kiosk` gelöscht, Schritt `uebergeben`, Erinnerung guenter:paket-erhalten, Günter +6 (k.guenter.paket-erhalten)
   │      │      │   └─ FOTOSZENE (Günter, einmalig; Variante je Ausgang von Geschichte A, siehe unten) → Ausgang `foto`
   │      │      └─ „Moment, ich muss erst suchen.“ → endet ohne Effekt (wird wieder angeboten)
   │      └─ „Lieber nicht …“ → Erinnerung jonas:paket-abgelehnt; Schritt bleibt `angebot`, Jonas fragt wieder
   ├─ „Ich überleg mir was.“ → Schritt `bitte`, Erinnerung guenter:paket-erwaehnt
   │   └─ Günter `paket-nochmal` (P 59, Schritt `bitte`): „Ich nehm es hier an …“ (→ wie oben, `angebot`, +3 mit demselben Schlüssel) / „Ich kann das wirklich nicht übernehmen.“ (→ Ausgang `abgelehnt`) / „Ich denke drüber nach.“ (bleibt bei `bitte`)
   └─ „Da kann ich dir nicht helfen.“ → Ausgang `abgelehnt`, Erinnerung guenter:paket-abgelehnt, Günter −3 (k.guenter.paket-absage)
      └─ Günter `paket-abgelehnt` (P 30, einmalig): „Ich hätte es annehmen sollen.“ → Günter +2 (k.guenter.absage-leid)
```

**Alle Ausgänge:**

| Ausgang | Bedingung | Folgen |
|---|---|---|
| **`foto`** | Paket angenommen und übergeben, Fotoszene gespielt | Flag **`kiosk.photo`**: das **Foto I-013** steht auf der Theke; Erinnerung `guenter:foto-geschenkt`; Günter +8 (`k.guenter.foto`); Jonas’ `paket-danach` (+2) und `neuigkeit-foto`; Günters `foto-danach` bzw. `foto-staender`; kein Geld |
| **`abgelehnt`** | Günters Bitte abgesagt | Günter −3, Erinnerung `guenter:paket-abgelehnt`; Jonas hat nichts zu übergeben (Geschichte kann nicht weitergehen); kein Foto; Günters `paket-abgelehnt` |
| (offen) | Der Spieler entscheidet sich nie | Die Geschichte bleibt beim letzten Schritt; das Journal zeigt ihn |

Die „kleine Handlung“ der Geschichte sind die Antworten des Spielers („Ich nehm es an“, „Gib her“, „Das Paket ist da“); es gibt kein Paket als sichtbaren Gegenstand und keine Wegstrecke, nur den Zustand `parcel.at-kiosk`.

### 6.3 Verknüpfung A → B

Die **Fotoszene** (Schritt `uebergeben`) hat fünf einmalige Varianten; welche Günter spielt, entscheidet der Ausgang von Geschichte A zum Zeitpunkt der Szene. In allen Varianten führt `Zeig mal.` zur Enthüllung („Das Büdchen. Zweiundsiebzig, Eröffnungstag …“); `Das gehört auf die Theke.` setzt `kiosk.photo`, den Ausgang `foto`, die Erinnerung `guenter:foto-geschenkt` und Günter +8.

| Ausgang A | Fotoszene (`dialogue.guenter.…`, P) | Kommentar Günters und weitere Folgen |
|---|---|---|
| `kompromiss` | `foto-kompromiss` (72) | erwähnt die Bank im Hof; **zusätzliche Antwort „Ich sag Derya Bescheid.“** → Flag `photo.stand-idee`, Erinnerung `guenter:staender-idee`, Günter +2 (`k.guenter.staender`). Danach Derya `foto-staender` (einmalig): „Bau ihn. Ich nehm das gern.“ → Flag `photo.stand`, Erinnerung `derya:staender-gebaut`, Derya +4 (`k.derya.staender`); „Lass mal, so reicht es.“ → Erinnerung `derya:staender-abgelehnt` (das Angebot kommt nicht wieder) |
| `derya` | `foto-derya` (72) | „Marlene redet seitdem leiser über dich, nicht netter.“ Später Marlene `foto-kuehl` (Erinnerung `marlene:foto-kuehl` bei „Ruhe hat auch ihren Preis.“) |
| `marlene` | `foto-marlene` (72) | „Die Tischlerin schaut an mir vorbei …“ Später Derya `foto-kuehl` (Erinnerung `derya:foto-kuehl` bei „Das Foto ist nicht gegen dich.“) |
| `neutral` | `foto-neutral` (72) | „Wer nicht stellt, den stellt der Zug.“ |
| (kein Ausgang) | `foto-offen` (71) | „Sieht man gut, wie wenig sich verändert hat.“ |

Der Ständer (`photo.stand`) ist nur ein **Dialog-Zustand**: Er schaltet Günters `foto-staender` statt `foto-danach` (+2 statt +1) frei, ändert aber das Aussehen des Fotos auf der Theke nicht. Marlenes und Deryas Kommentare (`foto-kuehl`) hängen nur an `kiosk.photo` und dem Ausgang von A; sie erscheinen daher auch, wenn Geschichte A erst nach der Fotoszene entschieden wird. Die Ständer-Idee gibt es nur in der Variante `kompromiss`.

**Gesamtübersicht der Endzustände (A × B):**

| Geschichte A \ Geschichte B | `foto` | `abgelehnt` | offen |
|---|---|---|---|
| `kompromiss` | Bank und Foto, Ständer-Idee, Ständer gebaut oder nicht | Bank, kein Foto | Bank |
| `derya` | Foto, Marlene kühl | kein Foto | nur die Folgen von A |
| `marlene` | Foto, Derya kühl | kein Foto | nur die Folgen von A |
| `neutral` | Foto, Günter kommentiert | kein Foto | nur die Folgen von A |
| offen | Foto ohne Bezug zum Hof (`foto-offen`) | kein Foto | Ausgangszustand |

## 7. Kundenkäufe und die Wirtschaftsdomäne

**Ablauf** (alles in `src/game/{npcSim,wishes,dialogue,economy}.ts`):
1. Eine Routine mit der Aktivität `shop` führt zum Verkaufsfenster; mit der Ankunft ist der Bewohner `at_place`.
2. Ist die **Verkaufsklappe offen** und die Phase „open“, wählt `pickWish` unter den Wünschen des Bewohners, deren Bedingungen jetzt gelten (Tageszeit, Wochentag, Tag, Story), einen mit einem **gewichteten, deterministischen Wurf** (Abschnitt 9). Der Wunsch (`NpcWishState`: Wunsch-ID, Zeilen, `ageChecked`, `resolved`) wird gespeichert, der Bewohner wechselt zu `waiting`, das Signal `npc.wish` erscheint. Hat der Bewohner keinen passenden Wunsch, geht er.
3. Der Spieler spricht den Wartenden an; es öffnet sich das **Kundengespräch** (`dialogue.customer`): der Wunsch als Text, die Zeilen (Menge, Name, Preis, Regalbestand), die Summe, bei altersbeschränkter Ware der Hinweis „Altersbeschränkt: ab n“. Antworten: **Bitte sehr.** (verkaufen), **Ausweis, bitte.** (nur bei altersbeschränkter Ware, solange nicht geprüft), **Das hab ich gerade nicht.** (ablehnen); nach der Entscheidung **Bis gleich.**
4. **Verkauf** (`sellWish`): ein einziger Aufruf von `economy.completeSale({ lines, ageCheckConfirmed, customer: { npcId } })`. Es gibt keine zweite Bestands- oder Geldlogik: die Domäne prüft Phase, Klappe, Alter und Bestand, bucht Regalbestand, Kasse, Tagesumsatz und Wareneinsatz, schreibt die **Transaktion mit `npcId`** und sendet `sale.completed` mit `npcId`. Der Preis ist der vorgeschlagene Verkaufspreis; der Bewohner feilscht nicht.
5. **Danach**, im selben Schritt: `resolved = 'sold'`, Erinnerung `served:<Wunsch>`, die `onSold`-Effekte des Wunsches (z. B. +2 Beziehung beim ersten Kauf) und der Bewohner geht heim. **Ablehnen** setzt `resolved = 'declined'`, die Erinnerung `declined:<Wunsch>`, die `onDeclined`-Effekte (derzeit keine) und der Bewohner geht heim.
6. **Schutz gegen Doppelauslösung:** Ein aufgelöster Wunsch kann nie wieder verkauft werden (`wish_already_resolved`); das Dialogpanel sperrt Antworten 250 ms nach einer Wahl (Doppelklick, Tastenwiederholung); die Antwortoptionen verschwinden nach der Auflösung; ein fehlgeschlagener Verkauf ändert nichts (die Domäne verkauft atomar). Getestet ist, dass ein zweites „Bitte sehr“ abgelehnt wird und Kasse und Bestand nur einmal ändert.

**Ablehnungsgründe eines Kundenverkaufs** (Tabelle in `customerLines.ts`, jeder Grund hat eine eigene Antwortzeile; der Wunsch bleibt offen): `insufficient_stock`, `kiosk_closed`, `customer_underage`, `age_check_required`, `day_not_open`; alle anderen Gründe nutzen eine Rückfallzeile. Der Wunsch bleibt offen: Der Spieler kann das Gespräch schließen, im Lager nachräumen und den Wartenden erneut ansprechen oder ablehnen.

**Wartezeit und Geduld:**
- Steht die Klappe **offen**, wartet der Kunde mit seinem Wunsch, bis sein **Routinefenster endet**; ein Geduldslimit gibt es nicht. Verlässt er den Ort unbedient, setzt er die Erinnerung `ignored:<Wunsch>`.
- Steht die Klappe **geschlossen**, wenn er ankommt, wartet er ohne Wunsch am Fenster höchstens **30 Spielminuten** (`SHUTTER_PATIENCE_MINUTES`), danach geht er mit der Erinnerung `kiosk-closed` (Günter reagiert mit `klappe-zu`). Öffnet sich die Klappe in dieser Zeit, wählt er seinen Wunsch. Schließt die Klappe, nachdem er seinen Wunsch geäußert hat, bleibt er warten (der Verkauf scheitert dann mit `kiosk_closed`) und geht spätestens zum Fensterende.
- Das Schließen des Gesprächs ändert nichts am offenen Wunsch; der Bewohner wartet weiter.
- Pause: die Simulation steht, aber das Gespräch und der Verkauf funktionieren (`completeSale` kennt keine Pause, wie in Phase 3).

**Wünsche** (Preise = vorgeschlagene Verkaufspreise; Gewicht = relative Wahrscheinlichkeit unter den zurzeit möglichen Wünschen):

| Bewohner | Wunsch | Ware | Summe | Bedingung | Gewicht | Altersgrenze |
|---|---|---|---|---|---|---|
| Günter | `wish.guenter-echo` | 1 × Halden-Echo Lokalblatt, 2 × Pottbäcker Brötchen | 2,70 € | 06:00–12:00; beim Kauf +2 (einmalig) | 3 | – |
| | `wish.guenter-pils` | 2 × Püttbräu Pils 0,33 l | 2,40 € | 17:00–22:00 | 3 | ab 16 |
| | `wish.guenter-raetsel` | 1 × Knobelschacht Rätselheft | 1,50 € | Sonntag | 4 | – |
| Derya | `wish.derya-fruehstueck` | 2 × Pottbäcker Brötchen, 1 × Ruhrbrause Wasser still | 1,70 € | 06:00–12:00, Ausgang von `quest.hof` nicht `kompromiss` | 3 | – |
| | `wish.derya-fruehstueck-neun` | dieselbe Ware | 1,70 € | 06:00–12:00, Ausgang `kompromiss` | 3 | – |
| | `wish.derya-suess` | 1 × Pottbäcker Streuselteilchen | 1,60 € | 12:00–17:00; beim Kauf +2 (einmalig) | 3 | – |
| Jonas | `wish.jonas-energy` | 1 × Zechenblitz Energy 0,25 l | 1,90 € | immer; beim Kauf +2 (einmalig) | 3 | – |
| | `wish.jonas-wassereis` | 1 × Eiskumpel Wassereis Brause | 0,70 € | 12:00–22:00 | 2 | – |
| | `wish.jonas-wasser` | 1 × Ruhrbrause Wasser still 0,5 l | 0,80 € | immer | 2 | – |
| | `wish.jonas-tabak` | 1 × Zechenhof Drehtabak 30 g | 6,50 € | ab Tag 4 | 1 | **ab 18** |
| Marlene | `wish.marlene-echo` | 1 × Halden-Echo Lokalblatt | 1,80 € | immer; beim Kauf +2 (einmalig) | 3 | – |
| | `wish.marlene-schoko` | 1 × Naschwerk Vollmilchschokolade 100 g | 1,19 € | immer | 2 | – |
| | `wish.marlene-limo` | 1 × Ruhrbrause Zitronenlimo 0,5 l | 1,20 € | Mo–Fr | 2 | – |

Wünsche werden **nicht** aus `likes` abgeleitet, sondern aus diesen Bedingungen. Verkauft wird nur Ware, die auf Warenplätzen steht; fehlt sie, lehnt der Verkauf mit `insufficient_stock` ab und der Wunsch bleibt offen.

## 8. Alterskontrolle bei Bewohnern

- Das Alter eines Bewohners stammt ausschließlich aus den validierten Inhaltsdaten (`NpcDef.age`: Günter 71, Derya 38, Jonas 17, Marlene 58).
- `economy.completeSale` prüft bei einem Kundenverkauf **immer** das Alter des Bewohners gegen das höchste Mindestalter der Zeilen und lehnt unter dem Mindestalter mit **`customer_underage`** ab – auch wenn die Ausweisbestätigung gesetzt ist. Die Bestätigung des Spielers ist nie ein Altersnachweis.
- Zusätzlich verlangt die Domäne wie bei der Kasse für jede altersbeschränkte Zeile die ausdrückliche Bestätigung (`ageCheckConfirmed`); im Kundengespräch ist das die Antwort **„Ausweis, bitte.“** (`checkId`): sie merkt die Prüfung im Wunsch (`ageChecked`) und zeigt das Alter aus den Inhaltsdaten („Ausweis: 71 Jahre“). Ohne sie lehnt der Verkauf mit **`age_check_required`** ab (die Antwort des Bewohners: „Du willst erst den Ausweis sehen. Klar, frag ruhig.“).
- Reihenfolge der Prüfungen in `completeSale`: Zeilen, `unknown_customer`, `day_not_open`, `kiosk_closed`, `age_check_required`, `customer_underage`, `insufficient_stock`. Ein 17-jähriger Bewohner sieht bei Tabak also erst `age_check_required`, nach „Ausweis, bitte.“ dann `customer_underage`.
- **Jonas (17) kann Tabak (ab 18) nie kaufen**, mit oder ohne Ausweis. Sein Wunsch `wish.jonas-tabak` (ab Tag 4) endet immer mit Ablehnung („Okay, okay. War einen Versuch wert.“), Kasse und Bestand bleiben unverändert, es entsteht keine Transaktion. Lehnt der Spieler ab, merkt sich Jonas `declined:wish.jonas-tabak` und reagiert später mit `tabak-reaktion`. (Waren ab 16 könnte ein 17-Jähriger nach der Prüfung kaufen; im Inhalt wünscht Jonas keine.)
- Günters Pils (ab 16) braucht die Ausweisprüfung und wird dann an den 71-Jährigen verkauft. Die Käufe des Spielers an der Kasse (ohne `customer`) verhalten sich unverändert (getestet).

## 9. Determinismus

- In der Spiellogik gibt es **kein `Math.random()`** (geprüft: der einzige Treffer im Quelltext ist ein Kommentar). Zeit kommt nur aus der Spieluhr (`game.tick`); es gibt keine NPC-Timer.
- Entscheidungen sind **reine Funktionen des gespeicherten Weltseeds** (`state.world.seed`, 32 Bit) und dessen, was entschieden wird: `roll(seed, …Teile)` = `hashParts(seed, …Teile) / 2³²` (FNV-1a mit Trennzeichen und murmur3-Endmischung, Wert in [0, 1)). Die Routinewahl nutzt `roll(seed, Tag, npcId, 'routine', eintragId) × 100 < chancePercent`, die Wunschwahl `roll(seed, Tag, npcId, 'wish', routineId)` gegen die Summe der Gewichte.
- Ein erneutes Laden desselben Spielstands trifft daher dieselben Entscheidungen (Routinen, Wünsche, Gesprächsfreischaltungen, Questzustände); getestet sind identische Entscheidungen über mehrere Tage und ein Neuladen mitten am Tag.
- Der Seed wird bei einem neuen Spiel (und bei „Neues Spiel“) in `main.ts` aus der Uhrzeit gebildet und gespeichert; Tests nutzen den festen Seed 1 (`DEFAULT_WORLD_SEED`); die Migration 2→3 leitet ihn aus Region und Speicherzeit ab (derselbe Spielstand ergibt immer denselben Seed).
- Ein kleiner Generator mit Zustand (`createRng`, mulberry32) liegt bereit und ist getestet, wird aber in der Spiellogik nicht benutzt. Ein gespeicherter Generatorzustand ist deshalb nicht nötig (anders als in ADR-005 vorgesehen).
- Nicht gespeichert und nach dem Laden neu aufgebaut: Wartezeiten vor Blockaden, die Rückfallebene gegen Verklemmung, der Tagescache der Würfe, das Gespräch selbst.

## 10. Figuren, Kollision und gebundene Platzierungen

**Prozedural, nicht als GLB:** Es gibt keine Modelldateien und keine Modellierpipeline (ADR-006); vier stilisierte Figuren aus Grundformen reichen für die Spielkamera. Die Fabrik je Asset-ID (`src/world/assets/residents/`) liefert ein `ResidentFigure` und lässt sich später durch einen GLB-Lader ersetzen.

- **Teile:** Kopf mit Augen, Nase und Ohren, Rumpf (Kapsel), Arme mit Hand und Ärmel, Beine mit Schuhen, Kleidungsstücke und Merkmale je Figur (Abschnitt 2), mit einem Skelett aus Gruppen (Rumpf, Kopf, Arme, Beine).
- **Aufwand** (gemessen in Vitest an den Fabriken): 28 bis 33 Meshes je Figur, 123 Meshes für vier Figuren (je ein Draw Call), 1.854 bis 2.338 Dreiecke je Figur, zusammen etwa 8.300; 7 Grundgeometrien, die alle Figuren teilen, und ein Material je Farbe (`MeshLambertMaterial`, geteilt). Kein `InstancedMesh` (vier Figuren), keine Objekterzeugung pro Bild (getestet).
- **Animation:** Gehen (Schrittphase aus der zurückgelegten Strecke, damit die Beine zur Geschwindigkeit passen; Ausschlag von Beinen und Armen, Wippen, Vorwärtsneigung, je Figur ein eigener Gang), Stehen (Atmen, Gewichtsverlagerung, Umsehen) und Sprechen (ein Arm gestikuliert, Nicken, Kopfbewegung). Die Phasen sind je Figur verschoben, damit sie nicht synchron atmen.
- **Darstellung** (`residentView`): liest jeden Schritt `game.state.npcs`, interpoliert zwischen den letzten zwei Schritten, dreht weich in Gehrichtung und beim Sprechen zum Spieler, springt (ohne Gleiten) beim Erscheinen, nach einem Sprung über 2,5 m und nach dem Ersetzen des Zustands. Verborgene (`away`) Bewohner werden nicht gezeichnet und kollidieren nicht.
- **Kollision mit dem Spieler:** Die sichtbaren Bewohner liefern Kreise (Radius `NPC_RADIUS` = 0,3 m) an die Bewegung des Spielers (`moveCircle`/`constrainToCircles`): Der Abstand zum Kreis bleibt mindestens so groß wie das Kleinere aus der Radiensumme und dem Abstand vor dem Schritt; ein Bewohner, der in den Spieler läuft, **schiebt ihn nicht weg**, und ein stehender Spieler wird nie bewegt. Wände und Möbel bleiben vorrangig.
- **Bewohner und Wände:** Es gibt keine Kollisionsprüfung der Bewohner zur Laufzeit; sie bewegen sich nur auf validierten, kollisionsfreien Kanten des Graphen.
- **An Flags gebundene Platzierungen** (`PlacementDef.requiresFlag`): Ein Objekt der Platzierungsliste existiert (gezeichnet und kollidierend) nur, solange das Story-Flag gesetzt ist; Objekte darauf verschwinden mit ihm. `layoutColliders` und `placementColliders` bekommen zur Laufzeit die Flags; die Inhaltsvalidierung übergibt keine Flags und behandelt gebundene Platzierungen **als vorhanden** (die Bank darf also keinen Weg versperren). Die Welt (`placementGates`) zeigt/versteckt die Objekte und baut die Kollisionslisten bei `story.changed` und `game.state.replaced` neu.
  - **E-004 Hofbank** (1,6 × 0,5 × 0,85 m): Platzierung `placement.yard-bench` bei (−5,6 / −0,5), Drehung 0, Flag `yard.bench`; sie kollidiert. Die Bankplätze der Bewohner liegen auf z = 0,4, also 0,65 m vor der Vorderkante der Bank.
  - **I-013 Gerahmtes Kioskfoto** (0,32 × 0,10 × 0,40 m): Platzierung `placement.kiosk-photo` auf der Theke (`on: placement.counter`) bei (−2,0 / 1,75), Flag `kiosk.photo`; kollidiert nicht, ist durch das Verkaufsfenster sichtbar; das Foto selbst ist eine Canvas-Textur („1972“).
  - Beide Assets stehen im Katalog (`catalog.ts`) und in der Fabrikregistrierung; Hüllmaße sind auf 2 cm geprüft.

## 11. Oberfläche

- **Hinweis:** Zeigt ein Bewohner in Reichweite, erscheint „E – Mit {Name} sprechen“; Klick auf den Hinweis oder E öffnet das Gespräch.
- **Dialogpanel** (ein generisches Panel für alle): Name, Rolle, Beziehungsstufe (Etikett mit Erklärung als Tooltip), die Aussage des Bewohners, bis zu vier Antworten mit den Tasten 1 bis 4. Das Panel rendert nur `game.dialogue.current()`; es hält keinen Spielzustand.
- **Kundenansicht** im selben Panel: Wunschzeilen mit Menge, Name, Einzelpreis, Regalbestand und Zeilensumme; Summe; Altersangabe („Altersbeschränkt: ab 18“) und nach „Ausweis, bitte.“ das Alter („Ausweis: 17 Jahre“, bei zu jungem Alter rot); eine Warnung bei zu wenig Regalbestand; die Antwort auf einen gescheiterten Verkauf.
- **Journal „Notizen“:** mit **J** oder der Schaltfläche „Notizen“ in der Leiste jederzeit zu öffnen (nicht, solange ein anderes Fenster offen ist; J schließt es wieder). Zeigt **bekannte Leute** (nur Bewohner, mit denen schon gesprochen wurde: Name, Rolle, Biografie, Beziehungsstufe, letztes Gespräch, erfüllte Wünsche), **was gerade ansteht** (bei begonnenen Geschichten nur den Text des aktuellen Schritts) und **Abgeschlossen** (nur der Text des Ausgangs). Nicht begonnene Geschichten, künftige Schritte und rohe Erinnerungs-IDs erscheinen nie. Das Journal ändert nichts.
- **Hinweise:** Beim ersten Merkenswerten in einem Gespräch („… wird sich daran erinnern.“, nicht für Käufe), bei Stufenwechseln und nach einem Kundenverkauf („Verkauf abgeschlossen: …“).
- **Modalverhalten:** Wie die Kasse und die Warenverwaltung blockiert das Dialogpanel die Bewegung und E der Welt (`world.setInputEnabled`); die Spieluhr läuft nach dem Phase-3-Vertrag weiter, der Bewohner im Gespräch steht still. Escape oder „Schließen“ beenden das Gespräch (und merken es als gesehen). Ein Gespräch öffnet sich nie über einem anderen Fenster; beim Laden und bei „Neues Spiel“ wird ein offenes Gespräch beendet.
- **Speichern:** Neben den bisherigen Auslösern (Intervall von 10 s, Tür und Klappe, `pagehide`, Sichtbarkeitswechsel, Wirtschaft und Kalender) wird zusätzlich 300 ms entprellt gespeichert nach `dialogue.closed`, `story.changed`, `relationship.changed`, `memory.added` und `npc.wish`. Ein offenes Gespräch wird nie gespeichert; ein gespeicherter `talking`-Status wird als `walking`, `waiting` oder `at_place` wiederhergestellt.

## 12. Bekannte Einschränkungen

Jeweils im Code geprüft. Die Einschränkungen der Phasen 1 bis 3 stehen im [Ist-Stand](TECHNISCHER-IST-STAND.md).

1. **Kunden warten bis zum Ende ihres Fensters**, solange die Klappe offen ist (kein Geduldslimit außer dem Routinefenster); nur bei geschlossener Klappe gehen sie nach 30 Spielminuten.
2. **Geschichtsgespräche entstehen nicht am Verkaufsfenster, solange der Bewohner mit einem Wunsch wartet** (dann ist es ein Kundengespräch). Sie geschehen an Ecke, Hof und Werkstatt, bei gehenden Bewohnern oder bei geschlossener Klappe.
3. **Behoben (2026-11-14): vorzeitiges Schließen verbrauchte einmalige Gespräche.** Bei der Dokumentation fiel auf, dass ein mit Escape geschlossenes einmaliges Gespräch als gesehen galt; Günters `paket-bitte` konnte so Geschichte B unmöglich machen. Seitdem zählt ein Gespräch erst mit einer Schlussantwort als gesehen (Regressionstests in `src/game/dialogue.test.ts`).
4. **Rückfallebene gegen Verklemmung:** Bewohner können sich als letzte Rettung (nach 20 s Blockade, nur zwischen Bewohnern) gegenseitig durchlaufen. Wände, Möbel und der Spieler sind davon nie betroffen.
5. **Laufzeitzeiten sind nicht gespeichert:** Die Zeit, die ein Bewohner bereits blockiert war, und der Tagescache der Würfe fehlen nach dem Laden; die Entscheidungen bleiben gleich (reine Funktionen), das genaue Timing von Wartezeiten kann abweichen. Das Gespräch wird nicht gespeichert.
6. **Erinnerungen sind einfache Kennungen:** Das Journal zeigt nur Notizen zu Geschichten, Bekanntschaften, Stufen und die Zahl erfüllter Wünsche, keine einzelnen Erinnerungen. Nur sechs Erinnerungen steuern Gespräche.
7. **`likes`, `dislikes` und die Beziehungen der Bewohner zueinander haben keine Spielwirkung**; Beziehungen zum Spieler beeinflussen nur Gespräche und die Vermittlungsoption, keine Besuche, Preise oder Wünsche.
8. **Der Ständer (`photo.stand`) hat kein eigenes Modell;** er wirkt nur in Dialogen. Das „Paket“ ist ein Zustand, kein sichtbarer Gegenstand; Sägen ist eine Routine ohne Animation und ohne Ton.
9. **Nicht einmalige Folgegespräche ersetzen das einfache `moin`** ihres Bewohners dauerhaft, sobald ihre Bedingung gilt (z. B. Günter nach dem Foto, Jonas nach der Bank). Die Inhalte sind daher nach den Geschichten weniger abwechslungsreich.
10. **Die Validierung erkennt nicht, ob Gesprächsbedingungen je zusammen erfüllbar sind** (geprüft werden Verweise, Erreichbarkeit der Knoten, Wertebereiche und Widersprüche innerhalb einer Antwort).
11. **Nur vier Bewohner;** N-004 und N-005 bleiben geplant. Der Bewohner bleibt in der Spielwelt auf Gehweg, Ecke, Hof; es gibt keine Nachbargebäude, in die er geht.
12. **Figurendetails sind aus der Spielkamera klein:** Gesichter und Kleinteile (Bleistift, Brillenfassung, Reflexgurt) sind nur aus der Nähe lesbar; unterschieden werden die Figuren über Silhouette, Größe und Farbe.
13. **Dialogtext und Routine weichen bei Deryas Sägebeginn ab:** Die Texte nennen „halb sieben“ (und „bis neun“ nach dem Kompromiss), die Routine `d.saegen-frueh` beginnt um 07:30.
14. **Nicht auf echter Grafikhardware und nicht in Firefox oder Safari geprüft;** die Browserprüfung läuft in Headless-Chromium mit Software-Rendering. Die Schritte für die manuelle Prüfung stehen in der [Prüfanleitung](PRUEFANLEITUNG-MANUELL.md), Schritte 32 bis 47; sie wurden in der Entwicklungsumgebung nicht von Hand ausgeführt.

## 13. Quellen und Prüfungen

Maßgebliche Dateien: `src/game/{npcTypes,state,balance,npcSim,npcs,dialogue,story,conditions,relationship,wishes,nav,random,interaction,economy,events,game,placement,colliders}.ts`, `src/game/save/save.ts`, `src/content/regions/ruhrgebiet/{residents,nav,quests,customerLines,dialogueKit,dialogues,dialoguesGuenter,dialoguesDerya,dialoguesJonas,dialoguesMarlene,layout,index}.ts`, `src/content/validateResidents.ts`, `src/content/assets/catalog.ts`, `src/world/assets/residents/*`, `src/world/views/residentView.ts`, `src/world/placementGates.ts`, `src/world/collision.ts`, `src/world/assets/furniture/{bench,photo}.ts`, `src/ui/panels/{dialogue,journal}.ts`, `src/ui/socialViewModel.ts`, `src/ui/texts.ts`, `src/main.ts`.

Automatisiert getestet (Vitest; Zahlen und Ergebnisse im [Ist-Stand](TECHNISCHER-IST-STAND.md), Abschnitt 6): Tagesroutinen an Zeit- und Wochentagsgrenzen, deterministische Entscheidungen, Wegsuche und Erreichbarkeit, Bewegung ohne Überlappen, Zustandsübergänge, Dialogbedingungen und Effekte, einmalige Effekte, Beziehungsstufen, beide Geschichten mit allen Ausgängen und der Verknüpfung (`src/integration/stories.test.ts`), Kundenkäufe und Alterskontrolle, Doppelauslösung, Savegame-Migration 1→2→3 und 2→3, flaggebundene Platzierungen, Figuren und Spielerkollision, Inhaltsvalidierung (`src/content/validateResidents.test.ts`). Die Browserprüfung (Headless-Chromium) ist ein eigener Abschnitt des Ist-Stands: [[BROWSERCHECK]].

Screenshots aus der laufenden Anwendung: [[SCREENSHOTS]] (Ordner [`docs/screenshots/auftrag-04/`](screenshots/auftrag-04/)).
