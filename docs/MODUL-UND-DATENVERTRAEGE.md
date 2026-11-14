# Modul- und Datenverträge

**Stand:** 2026-11-14 · Ergebnis von [Auftrag 00](auftraege/00-bestandsaufnahme-und-architektur.md), fortgeführt bis [Auftrag 04](auftraege/04-bewohner-und-soziale-bindung.md)

**Plan und Bestand:** Die Abschnitte 1–12 sind der Plan aus Auftrag 00. Was davon umgesetzt ist und wo die Umsetzung abweicht, steht in den Abschnitten 13, 14, 15 und 16 und im [Ist-Stand](TECHNISCHER-IST-STAND.md). Begründungen stehen in den [ADRs](ARCHITEKTUR-ENTSCHEIDUNGEN.md). Typen sind Vertragsskizzen; Feldnamen können sich bei der Umsetzung der jeweiligen Phase noch präzisieren, die Grundform nicht.

## 1. Modulübersicht

```
                 ┌──────────┐
                 │ main.ts  │  verdrahtet alles
                 └────┬─────┘
        ┌─────────────┼──────────────┬────────────┐
        ▼             ▼              ▼            ▼
   ┌─────────┐   ┌─────────┐    ┌─────────┐  ┌─────────┐
   │ world   │   │  ui     │    │ content │  │ (audio) │
   │ Three.js│   │  DOM    │    │ Daten   │  │ später  │
   └────┬────┘   └────┬────┘    └────┬────┘  └────┬────┘
        └─────────────┴──────┬───────┴────────────┘
                             ▼
                        ┌─────────┐
                        │  game   │  Regeln + Zustand, kein three, kein DOM
                        └────┬────┘
                             ▼
                        ┌─────────┐
                        │  core   │  Schleife, Uhr, Signale, Zufall
                        └─────────┘
```

Pfeile zeigen die erlaubte Importrichtung.

## 2. Geplante Ordnerstruktur

```
index.html
src/
  main.ts                 Bootstrap: Inhalte laden, validieren, Game/World/UI erzeugen
  core/                   loop, clock, signals, rng, log
  game/
    game.ts               Fassade: Zustand, Aktionen, Signale, tick()
    state.ts              GameState und Anfangszustand
    types.ts              Inhaltsdefinitionen (ProductDef, NpcDef, …)
    economy/              Inventar, Preise, Verkauf, Finanzen, Bestellungen
    people/               NPC-Besuche, Routinen, Beziehungen, Erinnerungen
    story/                Dialoge, Quests, Bedingungen und Effekte
    calendar/             Spielzeit, Wochentag, Saison, Wetter, Events
    specialties/          Rezepte und Traditionen
    save/                 serialisieren, laden, migrieren
  content/
    validate.ts
    regions/ruhrgebiet/   products.ts, npcs.ts, dialogues.ts, quests.ts,
                          events.ts, specialties.ts, layout.ts
  world/
    renderer, scene, camera, controls, collision, interaction
    assets/               Fabrikfunktionen je Asset-ID, Materialien
    views/                Darstellung von Zustand: Regalinhalt, NPC-Figuren, Wetter
  ui/                     hud, register (Kasse), stock, dialogue, calendar, texts
  audio/                  erst Phase 6
```

Unterordner von `game/` entstehen erst, wenn ihre Phase beginnt.

*Stand nach Auftrag 04:* Die Bewohner-Logik liegt flach in `src/game/` (`npcSim.ts`, `dialogue.ts`, `story.ts`, `nav.ts`, `random.ts` …), nicht in den Unterordnern `people/` und `story/`; die Inhaltsdateien heißen `residents.ts`, `nav.ts`, `quests.ts`, `dialogues*.ts` (Abschnitt 16).

## 3. Zuständigkeiten und öffentliche Schnittstellen

| Modul | Zuständig für | Öffentliche Schnittstelle | Darf importieren |
|---|---|---|---|
| `core` | feste Simulationsschleife, Signal-Emitter, geseedeter Zufall, Logging | `createLoop`, `createSignals`, `createRng` | nichts |
| `game` | sämtliche Spielregeln und der gesamte Spielzustand | `Game`-Fassade (siehe 4) und Typen | `core` |
| `content` | Definitionen von Produkten, NPCs, Dialogen, Quests, Events, Rezepten, Kiosk-Layout | `ContentPack` je Region, `validateContent` | Typen aus `game` |
| `world` | Three.js-Szene, Kamera, Spielerbewegung, Kollision, Interaktionspunkte, Asset-Fabriken, Darstellung des Zustands | `createWorld(game, content)`, `world.render(alpha)` | `game`, `core`, `three` |
| `ui` | HUD, Kasse, Warenverwaltung, Dialoge, Kalender, Meldungen | `createUi(game, content)` | `game`, `core` |
| `audio` | Klang als Reaktion auf Signale (später) | `createAudio(game)` | `game`, `core` |
| `main.ts` | Verdrahtung, Start, Fehleranzeige | – | alles |

*Stand nach Auftrag 04:* Der Zufall liegt in `src/game/random.ts` (`roll`, `hashParts`, `createRng`), nicht in `core`; `core` enthält Schleife, Signale und Log.

**Verboten:**
- `game` importiert `three`, DOM-APIs, `world`, `ui` oder konkrete Dateien aus `content`.
- `world` und `ui` importieren einander. Braucht die UI eine Weltinformation (z. B. „Spieler steht an der Kasse"), läuft sie als Aktion oder Zustand über `game`.
- `world` und `ui` verändern `GameState` direkt. Sie lesen ihn und rufen Aktionen auf.
- `core` kennt keine Produkte, NPCs oder Geschichten.
- Spielrelevante Werte (Geld, Bestand, Beziehung, Questfortschritt) in `Object3D.userData` oder im DOM ablegen. Dort stehen höchstens IDs.

## 4. Die `Game`-Fassade

```ts
interface Game {
  readonly state: Readonly<GameState>;   // nur lesen
  readonly signals: Signals<GameEvents>; // abonnieren
  tick(dtGameMinutes: number): void;     // von der Schleife aufgerufen
  // Aktionen, nach Domäne gruppiert; wachsen mit den Phasen:
  readonly economy: { /* restock, setPrice, sell, placeOrder, closeDay … */ };
  readonly people:  { /* ab Phase 4 */ };
  readonly story:   { /* ab Phase 4 */ };
  readonly calendar:{ /* pause, setSpeed … */ };
  save(): SaveFile;
}
function createGame(content: ContentPack, save?: SaveFile): Game;
```

Aktionen geben ein Ergebnis zurück (`{ ok: true } | { ok: false; reason }`), damit UI und Welt Ablehnungen anzeigen können, ohne Regeln nachzubauen.

*Stand nach Auftrag 04:* Zusätzlich gibt es `npcs` und `dialogue` (statt `people` und `story`), `getInteractionTarget()` und die Erweiterung von `completeSale` um einen optionalen Kunden (Abschnitt 16.5); der Zustand ist Version 3 (16.3).

*Stand nach Auftrag 03:* `economy` und `calendar` sind umgesetzt (Abschnitt 15.4); `tick` nimmt reale Sekunden (`tick(dtSeconds)`), nicht Spielminuten, und `economy.setPrice` gibt es nicht. Die Skizze oben bleibt der Plan.

## 5. Kommunikation

| Fall | Mittel |
|---|---|
| UI/Welt will etwas ändern | Aktion auf der `Game`-Fassade |
| UI/Welt will etwas anzeigen | `game.state` lesen |
| UI/Welt/Audio muss auf Änderung reagieren | Signal abonnieren |
| Domäne braucht andere Domäne innerhalb von `game` | direkter Funktionsaufruf |

**Signale:** synchron, typisiert, Namensschema `bereich.ereignis` in Vergangenheitsform, Nutzlast enthält nur IDs und einfache Werte. Ein Fehler in einem Abonnenten wird geloggt und hält die anderen nicht auf. Im Entwicklungsmodus lassen sich alle Signale in der Konsole mitschreiben.

Geplante Ereignisse (jeweils erst mit ihrer Phase eingeführt). Die Signale der Phase 3 sind umgesetzt, mit teils anderen Nutzlasten; maßgeblich ist Abschnitt 15.5. Die Signale der Phase 4 heißen anders als unten skizziert (`npc.visited_kiosk`, `quest.updated`, `quest.completed` gibt es nicht); maßgeblich ist Abschnitt 16.6:

| Signal | Nutzlast | Phase |
|---|---|---|
| `day.started`, `day.ended` | `{ day }` | 3 |
| `product.stock.changed` | `{ productId, location, quantity }` | 3 |
| `sale.completed` | `{ productId, quantity, totalCents, npcId? }` | 3 |
| `money.changed` | `{ balanceCents }` | 3 |
| `npc.visited_kiosk` | `{ npcId }` | 4 (ÜBERHOLT, siehe 16.6: `npc.status.changed`, `npc.wish`) |
| `relationship.changed` | `{ npcId, level }` | 4 (umgesetzt als `{ npcId, value, tier }`) |
| `quest.updated`, `quest.completed` | `{ questId, stepId? }` | 4 (ÜBERHOLT, siehe 16.6: `story.changed`) |
| `weather.changed` | `{ weather, temperatureC }` | 5 |
| `event.started`, `event.ended` | `{ eventId, phase }` | 5 |
| `kiosk.specialty.unlocked` | `{ specialtyId }` | 5 |

## 6. Stabile IDs

Zwei ID-Arten, die nicht vermischt werden:

- **Asset-IDs** aus dem [Artwork-Register](artwork-prompts/07-artwork-register.md): `K-001`, `I-005`, `P-012`, `E-003`, `N-002`. Sie bezeichnen ein 3D-Modell.
- **Inhalts-IDs** für Spielinhalte: kleingeschriebene Kennungen mit Typpräfix, z. B. `product.ruhrbrause-zitrone`, `npc.stammkunde-01`, `quest.frikadellen-legende`, `event.spieltag`, `specialty.frikadelle`, `dialogue.…`, `region.ruhrgebiet`.

Regeln: Eine vergebene Inhalts-ID wird nie umbenannt oder wiederverwendet, weil Savegames auf sie verweisen. Anzeigenamen sind frei änderbar. Ein Inhalt verweist über `assetId` auf sein Modell; mehrere Produkte dürfen sich ein Modell mit unterschiedlichem Etikett teilen.

## 7. Datenverträge für Inhalte

Skizzen der Definitionen. Vollständig ausgearbeitet wird jeder Typ zu Beginn seiner Phase.

```ts
// ÜBERHOLT: Das umgesetzte ProductDef steht in Abschnitt 15.1 (u. a. `minimumAge` statt `ageRestricted`,
// Lagerarten 'shelf'|'cooled'|'frozen'|'counter'|'press', `package`, `maxStack`, kein `unitsPerSlot`).
interface ProductDef {            // Phase 3 (Skizze)
  id: string;                     // product.*
  name: string;
  brand?: string;                 // fiktive Markenfamilie
  category: 'drink' | 'snack' | 'sweet' | 'icecream' | 'bakery' | 'magazine' | 'everyday' | 'seasonal';
  purchasePriceCents: number;
  suggestedPriceCents: number;
  storage: 'shelf' | 'fridge' | 'freezer' | 'counter' | 'rack';
  unitsPerSlot: number;           // Platzbedarf in der Einrichtung
  demandTags: string[];           // z. B. 'cold', 'matchday', 'kids'
  ageRestricted?: boolean;        // siehe Entscheidung O-4: Bier und Tabakwaren
  assetId: string;                // P-xxx
  label: { primaryColor: string; accentColor: string }; // Etikettvariante
}

// ÜBERHOLT: Das umgesetzte NpcDef, DialogueDef, QuestDef, Condition und Effect stehen in Abschnitt 16.1 (u. a. `routine` mit
// RoutineEntry statt VisitWindow, `relationships` mit Art und Notiz, Dialoge mit Knoten und Priorität statt `lines`, Quests ohne
// eigene Auslöser, `relationship` mit `value` statt `level`, Effekte mit Schlüssel; kein Effekt `money`/`startQuest`/`unlock`).
interface NpcDef {                // Phase 4 (Skizze)
  id: string;                     // npc.*
  name: string;
  role: string;
  assetId: string;                // N-xxx
  routine: VisitWindow[];         // Wochentage, Uhrzeit, Wahrscheinlichkeit, Bedingungen
  likes: string[];                // Produkt-IDs oder demandTags
  dislikes: string[];
  relations: { npcId: string; kind: string }[];
  dialogueIds: string[];
}

interface DialogueDef {           // Phase 4
  id: string;
  npcId: string;
  when: Condition[];
  lines: DialogueNode[];          // Text, Antwortoptionen, jeweils mit Effect[]
}

interface QuestDef {              // Phase 4
  id: string;
  trigger: Condition[];
  steps: { id: string; goal: Condition[]; onComplete: Effect[] }[];
  optional: true;                 // Quests sind immer ablehnbar
}

interface EventDef {              // Phase 5
  id: string;
  schedule: { weekday?: number; season?: Season; day?: number } | { trigger: Condition[] };
  phases: { id: 'leadup' | 'active' | 'aftermath'; durationDays: number;
            demandModifiers: { tag: string; factor: number }[];
            effects: Effect[] }[];
}

interface SpecialtyDef {          // Phase 5
  id: string;
  ingredients: { productId: string; quantity: number }[];
  prepMinutes: number;
  traditionThreshold: number;     // wie oft angeboten, bis es zur Tradition wird
}
```

**Bedingungen und Effekte** sind eine kleine, geschlossene Menge unterscheidbarer Datentypen, z. B.:

```ts
type Condition =
  | { type: 'flag'; id: string; value?: boolean }
  | { type: 'relationshipAtLeast'; npcId: string; level: number }
  | { type: 'questStep'; questId: string; stepId: string }
  | { type: 'dayAtLeast'; day: number }
  | { type: 'weather'; is: Weather }
  | { type: 'inStock'; productId: string; min: number };

type Effect =
  | { type: 'setFlag'; id: string; value: boolean }
  | { type: 'relationship'; npcId: string; delta: number }
  | { type: 'remember'; npcId: string; memoryId: string }
  | { type: 'money'; deltaCents: number }
  | { type: 'startQuest'; questId: string }
  | { type: 'unlock'; id: string };
```

Neue Arten werden als weiterer Fall ergänzt und an genau einer Stelle in `game/story` ausgewertet. Kein frei ausführbarer Code in den Daten.

*Stand nach Auftrag 04:* Die umgesetzten Mengen mit 13 Bedingungen und 8 Effekten stehen in Abschnitt 16.1 (ausgewertet in `src/game/conditions.ts` und `src/game/story.ts`, nicht in `game/story/`).

**Kiosk-Layout** (`layout.ts`; die Warenplätze stehen seit Auftrag 03 als `StockSlotDef` in `slots.ts`, Abschnitt 15): Liste platzierter Einrichtungsgegenstände mit Asset-ID, Position, Drehung und Lagerplätzen. Die Welt baut daraus die Szene, `game` daraus die Lagerkapazität. So bleibt die Einrichtung verschiebbar und speicherbar.

## 8. Validierung

`validateContent(pack)` prüft und liefert eine Liste lesbarer Fehler mit Datei-/ID-Bezug:
- IDs eindeutig und mit korrektem Präfix
- alle Verweise auflösbar (Produkt ↔ Asset, NPC ↔ Dialog, Quest ↔ NPC, Rezept ↔ Zutat, Event ↔ Tags)
- Wertebereiche (Preise > 0, Verkaufspreis-Vorschlag ≥ Einkaufspreis, Uhrzeiten 0–24, Wahrscheinlichkeiten 0–1)
- jede Quest hat mindestens einen Schritt, jeder Dialog einen Einstieg, kein Dialogknoten unerreichbar

Aufruf: beim Start im Entwicklungsmodus (Fehler werden sichtbar angezeigt, das Spiel startet nicht) und als Vitest-Test. Im Produktionsbuild nur geloggt.

## 9. Spielzustand und Savegame

*Überholt für Phase 3 und 4:* Das umgesetzte `GameState` (Version 2, mit `calendar` und `economy`) steht in Abschnitt 15.2, das Savegame in 15.8; die Version 3 mit `world`, `npcs` und `story` (statt `rngState`, `people`) steht in Abschnitt 16.3, das Savegame in 16.7. Die Skizze zeigt den langfristigen Plan.

```ts
interface GameState {
  regionId: string;
  rngState: number;
  calendar: { day: number; minuteOfDay: number; speed: number; paused: boolean;
              weather: Weather; temperatureC: number;
              events: Record<string, { phase: string; startedDay: number }> };
  economy:  { balanceCents: number;
              prices: Record<string, number>;
              stock: { shelf: Record<string, number>; storage: Record<string, number> };
              orders: Order[];
              ledger: DaySummary[] };
  kiosk:    { placements: Placement[]; upgrades: string[] };
  people:   Record<string, { relationship: number; memories: string[];
                             lastVisitDay: number }>;
  story:    { flags: Record<string, boolean>;
              quests: Record<string, { stepId: string; status: QuestStatus }> };
  specialties: Record<string, { timesOffered: number; quality: number; isTradition: boolean }>;
  player:   { position: [number, number]; heading: number };
}

interface SaveFile {
  schemaVersion: number;   // beginnt bei 1
  savedAt: string;         // ISO-Datum
  state: GameState;
}
```

Abschnitte, deren Phase noch nicht begonnen hat, sind im Anfangszustand leer. Sie stehen von Beginn an im Schema, damit spätere Phasen Felder füllen statt die Struktur umzubauen.

**Regeln:**
- `GameState` enthält nur JSON-fähige Werte: keine Klasseninstanzen, `Map`, `Date` oder Three.js-Objekte.
- Flüchtiges (laufende Animation, aktueller Wegabschnitt eines NPC, offene UI-Panels) wird nicht gespeichert, sondern nach dem Laden aus dem Zustand abgeleitet.
- Speicherort: `localStorage`, Schlüssel `buedchensim.save.<slot>`. Automatisch am Tagesende, zusätzlich manuell.
- **Migration:** `migrations[n]` wandelt Version n in n+1 um. Laden wendet alle fehlenden Schritte der Reihe nach an. Jede Schemaänderung bringt Migration und Test mit einem eingecheckten Beispiel-Save der Vorversion mit.
- **Fehlertoleranz:** unbekannte IDs werden verworfen und gemeldet; ein neuerer Spielstand als die Spielversion wird abgelehnt statt beschädigt; ein nicht lesbarer Spielstand wird nicht überschrieben.

## 10. Trennung von Zustand und Darstellung

- Die Simulation läuft in festen Schritten (`game.tick`), das Rendern mit Bildrate. `world` interpoliert Bewegungen.
- `world/views` hält je Zustandsbereich eine Darstellung, die sich bei Signalen aktualisiert: Regalinhalt aus `economy.stock`, Figuren aus den NPC-Besuchen, Himmel und Licht aus `calendar`.
- Die Spielerposition ist die einzige Größe, die `world` ermittelt (Eingabe, Kollision). Sie wird per Aktion an `game` gemeldet, damit sie gespeichert wird und Interaktionen dort geprüft werden können.
- Interaktionspunkte in der Welt tragen nur eine Kennung (`register`, `shelf:<placementId>`, `npc:<id>`). Was dort möglich ist, entscheidet `game`.

## 11. Umsetzungsstrategie

**1. Minimales Fundament vor dem ersten Gameplay-Feature**
- Projektgerüst (ADR-001, ADR-009) mit lauffähigen Scripts
- `core`: Schleife, Signale, Zufall
- `game`: Fassade mit `GameState` (zunächst nur `calendar` und `player`), `save`/`load` mit Version 1 und leerer Migrationskette
- `content`: Region Ruhrgebiet mit `layout.ts`, Validierungsgerüst
- `world`: Renderer, Szene, Licht, Kamera, Steuerung, Kollision, Interaktionspunkte, Asset-Registry
- `ui`: minimales HUD (Uhrzeit, Interaktionshinweis), Fehleranzeige

**2. Früh stabile Schnittstellen**
Importregeln der Schichten, `Game`-Fassade als einziger Zugang, ID-Schema, `SaveFile`-Hülle mit Migration, Asset-Fabrik-Signatur (ID → `Object3D` mit Pivot Bodenmitte, Maße in Metern), Namensschema der Signale.

**3. Zunächst einfach starten**
- Nachfrage: Grundwert × Preisfaktor × Tag-Modifikatoren, keine Marktsimulation
- Kundschaft in Phase 3: anonyme Laufkundschaft; benannte NPCs folgen in Phase 4 über dieselbe Besuchslogik
- NPC-Bewegung: Wegpunkte, einfache Figuren ohne Skelettanimation
- Wetter: Tageswert aus Saison und Zufall
- Dialoge: lineare Knoten mit Antwortoptionen
- UI: schlichte Panels

**4. Ausdrücklich später**
Audio, weitere Regionen, GLB-Modelle und Animationen, Bau-/Umstellmodus für Einrichtung, Upgrades, Lieferantenbeziehungen, Viertelentwicklung, Touch-Steuerung, Spielstand-Export, Mehrsprachigkeit, LOD.

**5. Neue Inhalte ohne Umbau**
- Neues Produkt: Eintrag in `products.ts`, bei neuem Modell eine Fabrik plus Registerzeile
- Neuer NPC, Dialog, Quest, Event: je eine Definition in den Inhaltsdateien
- Neue Bedingung/neuer Effekt: ein Fall im Typ und eine Auswertung in `game/story`
- Neue Region: neuer Ordner unter `content/regions/` mit eigenem `ContentPack` und eigenen Asset-Fabriken

**6. Risiken vor Phase 1**

| Risiko | Maßnahme |
|---|---|
| Perspektive unentschieden (O-1) | vor der Greybox entscheiden; sonst Kamera, Steuerung und Assetdetail doppelt |
| Zeitmodell (O-3, entschieden: durchlaufend) | in Phase 3 umsetzen; Geschwindigkeit bleibt Balancing |
| Schichten weichen auf | ESLint-Importregel ab dem ersten Commit |
| Savegame bricht bei Änderungen | Version und Migrationstest ab dem ersten Speichern |
| Prozedurale Assets wirken zu schlicht | Stil früh an Kiosk und zwei Produkten prüfen, bevor 30 Waren entstehen |
| Markennamen kollidieren mit realen Marken | Namen bleiben Arbeitstitel in den Daten und sind an einer Stelle änderbar; Recherche vor Veröffentlichung |
| Umfang wächst vor dem ersten spielbaren Stand | Phasenreihenfolge einhalten, je Phase Abnahme in der laufenden Szene |

## 12. Nächste Schritte für Phase 1

1. Entscheidungen O-1 und O-2 bestätigen.
2. Projektgerüst anlegen: `package.json`, Vite, TypeScript, ESLint, Vitest, `.gitignore`, Startanleitung im README.
3. `core` und die `Game`-Fassade mit Uhr, Spielerposition und Speichern/Laden samt Tests.
4. `world`-Grundlage: Renderer, Licht, Boden, Kamera, Steuerung, Kollision.
5. Greybox nach Prompt B: Kiosk (ca. 6 × 4 × 3,2 m) mit Verkaufsöffnung, Eingang, Innenraum, Gehweg; als `layout.ts` und Asset-Fabriken K-001-A, E-001, E-002.
6. Interaktionspunkte (Tür, Theke) mit HUD-Hinweis.
7. Prüfung im Browser per Screenshot, Ergebnisse und Registerstatus dokumentieren.

## 13. Stand nach Auftrag 01: Konkretisierungen und Abweichungen

Maßgeblich sind die Typen im Code (`src/game/types.ts`, `src/game/state.ts`, `src/game/game.ts`, `src/game/save/save.ts`). Hier stehen nur die Unterschiede zum Plan oben.

**Abweichungen**
- **`GameState` ist kleiner als in Abschnitt 9.** (Seit Auftrag 03 Version 2 mit `calendar` und `economy`, siehe 15.2.) Version 1 enthielt nur `regionId`, `player` und `kiosk: { doorOpen, shutterOpen }`. Die Abschnitte für Kalender, Wirtschaft, Menschen, Geschichten und Spezialitäten kommen mit ihrer Phase per Migration hinzu, statt von Beginn an leer im Schema zu stehen. Grund: Auftrag 01 schließt vorgezogene Systeme aus.
- **`Game.tick` gibt es seit Auftrag 03 (Abschnitt 15.4); `rngState` gibt es weiterhin nicht.** Zum Stand von Auftrag 01: Ohne Spielzeit und ohne Zufall hatte `game` nichts zu simulieren.
- **Kiosk-Layout:** Das Gebäude ist über Grundfläche, Höhe, Wandstärke und Öffnungen beschrieben. Die Einrichtung war in Auftrag 01 eine Liste fester Rechtecke; seit Auftrag 02 ist sie eine Platzierungsliste (Abschnitt 14).
- **Aktionen sind seit Auftrag 03 nach Domänen gruppiert** (`player`, `calendar`, `economy`, Abschnitt 15.4). Zum Stand von Auftrag 01 hatte die Fassade nur `player.setPose`, `interact`, `getAvailableInteraction`, `save`, `load`, `reset`.

**Konkretisierte Verträge**
- **Koordinaten:** 1 Unit = 1 m, Y oben, +X Osten, +Z Süden. Blickrichtung in Radiant, 0 zeigt nach +Z, `atan2(dx, dz)`.
- **Signale:** `kiosk.door.changed { open }`, `kiosk.shutter.changed { open }`, `interaction.available.changed { interaction }`, `game.state.replaced {}` (nach Laden oder Zurücksetzen; Darstellungen lesen dann den Zustand neu).
- **Interaktion:** `game` ermittelt den nächstgelegenen Punkt innerhalb seines Radius und die mögliche Aktion (`door.open`, `door.close`, `shutter.open`, `shutter.close`). Welt und UI zeigen nur an und rufen `interact()`.
- **Spielerposition:** Die Welt berechnet Bewegung und Kollision und meldet das Ergebnis über `player.setPose`; `game` begrenzt auf `walkBounds`.
- **Savegame:** `parseSave` liefert `ok`, `empty`, `corrupt` oder `unsupported_version`. `createSaveStore` kapselt den Speicher, fängt Speicherfehler ab und legt bei unlesbaren Ständen eine Sicherung unter `<Schlüssel>.backup` an. Der Zugriff auf `localStorage` selbst geschieht nur in `main.ts`.
- **Inhalts-IDs:** zusätzliche Präfixe `opening.`, `furniture.`, `interaction.`, `ground.`.
- **Schichtenregel in Tests:** Tests gehören zu ihrer Schicht. `game`- und `world`-Tests nutzen deshalb `src/game/testing/fixture-pack.ts` statt des echten Inhaltspakets.
- **Asset-Fabriken:** Registrierung in `src/world/assets/registry.ts`. Die Kiosk-Fabrik liefert ein `Object3D` mit benannten Kindern (Tür, Klappe, Dach, Wände, Schild), die `kioskView` ansteuert. Namen sind Darstellungsdetails, keine Spieldaten.
- **Kollision und Wandgeometrie** sind reine Funktionen ohne Three.js-Import (`collision.ts`, `kioskGeometry.ts`) und einzeln getestet.
- **Entwicklungshilfe:** Im Entwicklungsmodus oder mit `?debug` in der Adresse stellt `main.ts` `window.__buedchen.game` bereit; die Browserprüfung liest darüber den Zustand.

## 14. Stand nach Auftrag 02: Asset-Katalog und Platzierungsliste

Maßgeblich sind `src/game/types.ts`, `src/game/placement.ts`, `src/content/assets/catalog.ts` und `src/content/regions/ruhrgebiet/layout.ts`.

### 14.1 Zwei Arten von IDs
- **Asset-ID** (`I-005`): bezeichnet ein Modell aus dem [Artwork-Register](artwork-prompts/07-artwork-register.md). Zu jeder Asset-ID gibt es einen Katalogeintrag (Daten) und eine Fabrik (Three.js).
- **Platzierungs-ID** (`placement.fridge`): bezeichnet ein aufgestelltes Exemplar. Ein Asset kann beliebig oft platziert werden; die Platzierungs-ID ist stabil und wird nie wiederverwendet.

### 14.2 Asset-Vertrag (`AssetDef`)
| Feld | Bedeutung |
|---|---|
| `assetId`, `name`, `category` | Register-ID, Anzeigename, `building` / `furniture` / `ground` |
| `size` | Hüllmaß in Metern bei Rotation 0: Breite (X), Tiefe (Z), Höhe (Y) |
| `collides` | blockiert mit der ganzen Grundfläche |
| `allowedRotations` | erlaubte Vierteldrehungen |
| `scalable` | ob eine Platzierung skalieren darf (in Phase 2 bei keinem Asset) |
| `requiresSupport` | darf nur auf einer anderen Platzierung stehen (Kasse) |
| `defaultRole` | übliche Nutzungsrolle |

**Für alle Assets gilt:** Pivot ist die Bodenmitte des Hüllmaßes. Bei Rotation 0 zeigt die Vorderseite (Kunden- bzw. Bedienseite) nach +Z (Süden). Eine Fabrik baut das Modell aus `asset.size`; ein Test prüft, dass das gebaute Modell das Hüllmaß auf 2 cm einhält, auch mit geänderten Maßen.

| Asset | Name | Maße B × T × H (m) | Rotationen | Kollision | Rolle | Fabrik |
|---|---|---|---|---|---|---|
| K-001 | Musterkiosk | 6 × 4 × 3,2 (aus `KioskDef`) | 0 | Wände aus `kioskGeometry` | – | `src/world/assets/kiosk/` |
| I-001 | Verkaufstheke | 2,8 × 0,65 × 1,0 | 0, 180 | ja | Verkauf | `furniture/counter.ts` |
| I-002 | Kasse | 0,45 × 0,40 × 0,35 | alle | nein, braucht Unterlage | Kasse | `furniture/register.ts` |
| I-003 | Wandregal | 2,4 × 0,40 × 2,0 | alle | ja | Präsentation | `furniture/wallShelf.ts` |
| I-004 | Mittelregal | 1,2 × 0,5 × 1,35 | alle | ja | Präsentation | `furniture/middleShelf.ts` |
| I-005 | Getränkekühlschrank | 0,7 × 0,7 × 2,0 | alle | ja | Kühlung | `furniture/fridge.ts` |
| I-006 | Eistruhe | 1,2 × 0,65 × 0,9 | alle | ja | Tiefkühlung | `furniture/freezer.ts` |
| I-007 | Zeitschriftenständer | 0,8 × 0,4 × 1,5 | alle | ja | Präsentation | `furniture/magazineRack.ts` |
| I-011 | Lagerregal | 1,2 × 0,5 × 1,9 | alle | ja | Lager | `furniture/storageRack.ts` |
| I-012 | Leergut-/Kistenbereich | 0,9 × 0,7 × 0,75 | alle | ja | Leergut | `furniture/crates.ts` |

Fabrikpfade relativ zu `src/world/assets/`. Die Gebäudeteile K-001-A bis K-001-H sind Teilbauer derselben Fabrik (`walls.ts`, `roof.ts`, `awning.ts`, `salesWindow.ts`, `door.ts`, `signage.ts`, `lighting.ts`, `interior.ts`).

### 14.3 Platzierungs-Vertrag (`PlacementDef`)
| Feld | Bedeutung |
|---|---|
| `id` | stabile Platzierungs-ID mit Präfix `placement.` |
| `assetId` | Verweis auf den Katalog |
| `position` | Pivot auf der Bodenebene (x, z) in Metern |
| `rotation` | 0, 90, 180 oder 270 Grad, gegen den Uhrzeigersinn von oben. 0 = Front nach +Z, 90 = +X, 180 = −Z, 270 = −X |
| `scale` | nur zulässig, wenn das Asset `scalable` ist |
| `on` | Platzierungs-ID der Unterlage; die Platzierung steht dann auf deren Oberkante und kollidiert selbst nicht |
| `role` | Nutzungsrolle: `sales`, `checkout`, `display`, `cooling`, `freezing`, `storage`, `returns` |
| `collides` | überschreibt den Katalogwert |

`RegionLayout` trägt dazu `layoutVersion` (derzeit 1) und `placements`. Nur Vierteldrehungen sind erlaubt, damit Kollisionsrechtecke achsparallel bleiben.

**Eine Quelle für alles:** Die Funktionen in `src/game/placement.ts` (`placementFootprint`, `placementBaseHeight`, `placementColliders`, `placementFront`) liefern Grundfläche, Höhe, Kollisionsrechtecke und Blickrichtung. Die Welt stellt damit dar und kollidiert damit, die Validierung prüft damit. Die Wandsegmente kommen aus `src/game/kioskGeometry.ts`.

**Umstellen ohne Codeänderung:** Eine Platzierung wird verschoben oder gedreht, indem ihr Eintrag in `layout.ts` geändert wird. Fabriken kennen keine Positionen. So wurden die Außenkisten in Auftrag 02 von der Rückseite an die Westwand verlegt.

**Platzierungen sind Inhalt, kein Spielstand.** (Stand Auftrag 02: `schemaVersion` 1; mit Auftrag 03 ist sie 2, siehe 15.8, die Platzierungen bleiben Inhalt.) Sobald der Spieler Einrichtung selbst umstellen kann, wandern Platzierungen in den Spielstand; dann sind Versionserhöhung und Migration fällig. Ein späterer Editor kann dieses Format direkt verwenden.

### 14.4 Validierung des Layouts
`validateContent` meldet zusätzlich zu den Prüfungen aus Auftrag 01:
- doppelte oder falsch benannte Platzierungs-IDs, ungültige `layoutVersion`, fehlerhafte Katalogeinträge
- unbekannte Asset-ID, nicht erlaubte Rotation, Skalierung bei nicht skalierbarem Asset
- fehlerhafte Unterlage (`on`): unbekannt, auf sich selbst, verkettet, fehlend trotz `requiresSupport`, oder die Platzierung ragt über die Unterlage hinaus
- Position außerhalb des begehbaren Bereichs oder Grundfläche quer durch eine Wand
- Überschneidung zweier kollidierender Grundflächen (Berührung ist erlaubt)
- Möbel im Schwenkbereich einer Tür
- **Laufwege:** Von der Startposition aus wird auf einem 10-cm-Raster geprüft, was die Figur (Radius 0,3 m) bei offenen Türen erreicht. Erreichbar sein müssen der Innenraum, jeder Interaktionspunkt und ein Platz direkt vor der Vorderseite jedes kollidierenden Möbels.

### 14.5 Weitere Vertragsänderungen
- `ContentPack.assets`: der Asset-Katalog des Pakets.
- `InteractionPointDef.marker`: optionale Position, Höhe und Radius der sichtbaren Markierung, getrennt vom logischen Interaktionspunkt. Mit dem optionalen `radiusZ` (kleiner als `radius`) wird die Markierung als flache Ellipse statt als Ring gezeichnet. Die Klappen-Markierung liegt damit als Streifen auf der äußeren Fensterbank. Die Validierung verlangt positive Werte für `radius` und `radiusZ`.
- `PLAYER_RADIUS` (0,3 m) ist eine gemeinsame Konstante in `game`, genutzt von Welt und Validierung.
- `src/integration/`: Tests, die wie `main.ts` alle Schichten importieren dürfen (echtes Inhaltspaket gegen echte Fabriken).

### 14.6 Sichtfreistellung
- **Figur im Kiosk:** Das Dach wird ausgeblendet, die Südwand auf Brüstungshöhe (1,0 m) gekappt; Schild, Markise, Klappe und obere Türhälfte verschwinden mit. Ost- und Westwand werden nur gekappt, wenn sie die Sichtlinie zur Figur kreuzen. Die Nordwand bleibt stehen. Die Entscheidung ist eine reine, getestete Funktion (`src/world/occlusionRules.ts`).
- **Figur außen und verdeckt:** Das Gebäude bleibt vollständig deckend. Die Figur wird zusätzlich als einfarbige Silhouette durch das Hindernis gezeichnet. Die Silhouette ist nur eingeschaltet, wenn die Figur außen steht und das Gebäudevolumen die Sichtlinie zu Brust oder Kopf kreuzt (`shouldShowSilhouette`, mit 0,15 m Hysterese); Möbel, Kisten und die gekappte Südwand lösen sie nicht aus.
- Kein Bauteil ist mehr durchscheinend; Glas an Kühlschrank und Eistruhe ist die einzige Transparenz.

## 15. Stand nach Auftrag 03: Produkte, Warenplätze, Wirtschaft, Spielzeit

Maßgeblich sind `src/game/{types,state,balance,clock,economy,selectors,stockLayout,events,game,interaction}.ts`, `src/game/save/save.ts`, `src/content/regions/ruhrgebiet/{products,slots}.ts`, `src/content/assets/productAssets.ts` und `src/content/validateStock.ts`. Dieser Abschnitt ersetzt die Skizzen in den Abschnitten 4, 5, 7 und 9 für alles, was Phase 3 betrifft. Die Daten aller Produkte stehen im [Produktkatalog](PRODUKTKATALOG.md).

### 15.1 Inhaltstypen (`src/game/types.ts`)
```ts
export type StorageKind = 'shelf' | 'cooled' | 'frozen' | 'counter' | 'press';
export type ProductCategory = 'drink' | 'snack' | 'sweet' | 'icecream' | 'bakery' | 'press' | 'everyday';
export type ProductSubcategory = 'beer' | 'tobacco';
export type PackageKind =
  | 'glass-bottle' | 'pet-bottle' | 'can' | 'bag' | 'bar' | 'box'
  | 'ice-stick' | 'ice-cup' | 'pastry' | 'magazine';

export interface ProductDef {
  id: string;                    // 'product.*', nie umbenannt oder wiederverwendet
  name: string;
  brand: string;                 // fiktive Markenfamilie
  category: ProductCategory;
  subcategory?: ProductSubcategory;
  purchasePriceCents: number;
  suggestedPriceCents: number;
  storage: StorageKind;          // welche Art Präsentationsplatz das Produkt braucht
  minimumAge?: number;           // 16 oder 18; fehlt = unbeschränkt; EINZIGE Quelle der Altersschranke
  demandTags: string[];          // nur Daten, noch ohne Wirkung
  assetId: string;               // 'P-0xx'; AssetDef.size ist das Maß EINER Einheit
  package: PackageKind;
  maxStack?: number;             // überschreibt PACKAGE_MAX_STACK
  label: { primaryColor: string; accentColor: string; text: string };
}

export interface StockSlotDef {
  id: string;                    // 'slot.*'
  placementId: string;
  accepts: StorageKind;
  origin: { x: number; y: number; z: number };      // Unterseite Mitte, lokaler Rahmen der Platzierung bei Rotation 0
  size: { width: number; depth: number; height: number };
}

export type InteractionKind = 'door' | 'shutter' | 'register' | 'storage';
```
`AssetCategory` enthält zusätzlich `'product'`. `ContentPack` hat zusätzlich `products: Record<string, ProductDef>` und `stockSlots: StockSlotDef[]`. `InteractionPointDef.openingId` ist nur für `door` und `shutter` Pflicht. `ProductDef` hat bewusst kein Feld „Platzbedarf“: Der Platzbedarf ergibt sich aus dem Maß des Produkt-Assets, dem Stapellimit und dem Platzmaß (15.5).

### 15.2 `GameState` Version 2 (`src/game/state.ts`)
*Seit Auftrag 04 ist der Zustand Version 3 (Abschnitt 16.3); dieser Abschnitt beschreibt den Stand nach Auftrag 03.*

```ts
export type DayPhase = 'open' | 'awaiting_close' | 'closed';

export interface CalendarState {
  day: number;            // beginnt bei 1
  minute: number;         // Minuten seit Mitternacht, auch gebrochen
  paused: boolean;
  speed: GameSpeed;       // 1 | 2 | 4
  phase: DayPhase;
}
export interface ProductLine { productId: string; quantity: number }
export interface TransactionLine { productId: string; quantity: number; unitPriceCents: number }
export interface Transaction {
  id: number; day: number; minute: number;   // ganze Minuten seit Mitternacht
  kind: 'purchase' | 'sale'; lines: TransactionLine[]; totalCents: number;
}
export interface DayReport {
  day: number; revenueCents: number; costOfGoodsSoldCents: number; purchaseCents: number;
  grossProfitCents: number;   // revenue - cost of goods sold
  cashFlowCents: number;      // revenue - purchases
  cashEndCents: number; salesCount: number; closedAtMinute: number;
}
export interface ShelfStock { productId: string; quantity: number }
export interface PendingDelivery { lines: ProductLine[]; totalCents: number }
export interface TodayTotals { revenueCents: number; purchaseCents: number; costOfGoodsSoldCents: number; salesCount: number }

export interface EconomyState {
  cashCents: number;
  storage: Record<string, number>;          // Hinterlager: Stück je Produkt-ID (keine Nulleinträge)
  shelves: Record<string, ShelfStock>;      // Warenplatz-ID -> Ware (leere Plätze ohne Eintrag)
  pendingDelivery: PendingDelivery | null;
  today: TodayTotals;
  lastReport: DayReport | null;
  transactions: Transaction[];              // die neuesten TRANSACTION_LIMIT, älteste zuerst
  nextTransactionId: number;
}

export interface GameState {
  regionId: string;
  player: { position: Vec2; heading: number };
  kiosk: { doorOpen: boolean; shutterOpen: boolean };
  calendar: CalendarState;
  economy: EconomyState;
}
```
Nur JSON-Daten und stabile IDs. Nicht im Zustand: Warenkorb, Altersbestätigung, offene Panels, Bestellentwurf, Wochentag (abgeleitet aus `calendar.day` über `weekdayOf`, kein Schema-Wechsel). Anfangswerte: Tag 1, 06:00, Tempo 1×, nicht pausiert, Phase `open`, 30.000 Cent, leere Bestände, keine Lieferung, leere Tagessummen, kein Bericht, `nextTransactionId` 1.

Phasen: `open` = Uhr läuft (sofern nicht pausiert); `awaiting_close` = 22:00 erreicht, die Uhr steht und wartet auf `economy.closeDay()`; `closed` = Tag abgeschlossen, wartet auf `calendar.startNextDay()`.

### 15.3 Balancing (`src/game/balance.ts`)
| Konstante | Wert | Bedeutung |
|---|---|---|
| `START_CASH_CENTS` | 30000 | Startkapital 300,00 € |
| `DAY_START_MINUTE` / `DAY_END_MINUTE` | 360 / 1320 | 06:00 / 22:00 |
| `WEEK_LENGTH` | 7 | Tage je Woche; Tag 1 ist ein Montag. Der Wochentag wird aus dem Tageszähler abgeleitet (`weekdayOf`) und nicht gespeichert |
| `GAME_MINUTES_PER_SECOND` | 1 | Spielminuten je reale Sekunde bei Tempo 1× |
| `SPEEDS`, `DEFAULT_SPEED` | `[1, 2, 4]`, 1 | erlaubte Tempostufen |
| `TRANSACTION_LIMIT` | 200 | gespeicherte Transaktionen |
| `STORAGE_CAPACITY_UNITS` | 400 | Stück im Hinterlager inkl. offener Lieferung |
| `UNIT_GAP_METERS` | 0,01 | Abstand zwischen Einheiten im Platz |
| `PACKAGE_MAX_STACK` | Glasflasche 1, PET 1, Dose 2, Beutel 1, Tafel 3, Schachtel 2, Stieleis 1, Eisbecher 2, Backware 1, Heft 3 | Standard-Stapellagen je Verpackung |

Die Spiellogik liest diese Werte nur hier. Die Texte der Oberfläche nennen „22:00“ und „06:00“ allerdings als feste Zeichenketten (`texts.ts`); bei geänderten Zeiten sind sie mitzuziehen.

### 15.4 `Game`-Fassade: Erweiterungen (`game.ts`, `clock.ts`, `economy.ts`)
Alle Aktionen liefern `{ ok: true }` oder `{ ok: false, reason }` (`ActionResult`); `completeSale` liefert zusätzlich die Transaktion, `closeDay` den Bericht. Eine abgelehnte Aktion ändert nichts. Prüfreihenfolge ist die der Tabellen.

**Uhr**
| Aktion | Wirkung und Voraussetzung | Ablehnungsgründe |
|---|---|---|
| `game.tick(dtSeconds)` | rückt die Uhr um `dt × GAME_MINUTES_PER_SECOND × Tempo` Minuten vor; nur in Phase `open` und nicht pausiert; nicht endliche oder nicht positive `dt` werden ignoriert. Erreicht die Uhr 22:00, wird die Minute auf 22:00 gesetzt, die Phase auf `awaiting_close` und `day.ending` gesendet (einmal) | – (kein Rückgabewert) |
| `calendar.pause()` / `resume()` | setzt bzw. löscht die Pause; jederzeit | – |
| `calendar.setSpeed(speed)` | Tempo 1, 2 oder 4 | `invalid_speed` |
| `calendar.startNextDay()` | nur in Phase `closed`: Tag + 1, 06:00, Phase `open`, Tagessummen zurückgesetzt; Tempo und Pause bleiben | `day_not_closed` |

**Wirtschaft**
| Aktion | Wirkung | Ablehnungsgründe |
|---|---|---|
| `economy.placeOrder(lines)` | fasst doppelte Zeilen zusammen, bucht die Summe sofort ab, verbucht eine Transaktion `purchase`, setzt `pendingDelivery`, erhöht `today.purchaseCents` | `day_closed` (Phase `closed`); `empty_order`; `invalid_quantity` (nicht ganzzahlig oder ≤ 0); `unknown_product`; `order_pending`; `insufficient_cash`; `storage_full` (Stück > freie Lagerplätze abzüglich reservierter Lieferung) |
| `economy.receiveDelivery()` | schreibt die Lieferung dem Hinterlager gut, leert `pendingDelivery` | `no_delivery`; `storage_full` (nur bei verändertem Spielstand möglich) |
| `economy.restock(slotId, productId, quantity)` | Lager → Platz | `unknown_slot`; `unknown_product`; `invalid_quantity`; `storage_kind_mismatch`; `slot_occupied_by_other_product`; `slot_capacity_exceeded`; `insufficient_storage` |
| `economy.unstock(slotId, quantity)` | Platz → Lager | `unknown_slot`; `invalid_quantity`; `slot_empty`; `insufficient_slot_stock`; `storage_full` |
| `economy.completeSale({ lines, ageCheckConfirmed })` | atomarer Verkauf aus Warenplätzen zum `suggestedPriceCents`; Bestand wird über die Plätze in Inhaltsreihenfolge abgebucht; Kasse und Tagesumsatz steigen, `costOfGoodsSoldCents` und `salesCount` auch; Transaktion `sale` | `empty_cart`; `invalid_quantity`; `unknown_product`; `day_not_open` (Phase ≠ `open`); `kiosk_closed` (Verkaufsklappe zu); `age_check_required` (mindestens eine Zeile mit `minimumAge`, `ageCheckConfirmed` nicht `true`); `insufficient_stock` (Regalbestand, nicht Lager) |
| `economy.closeDay()` | in Phase `open` oder `awaiting_close`: erzeugt `lastReport`, Phase `closed`, sendet `calendar.changed` und `day.ended` | `day_already_closed` |

Weitere Ablehnungsgründe der Fassade: `player.setPose` → `invalid_pose`; `interact` → `nothing_in_range`; `load` → `region_mismatch`. Pause sperrt weder Bestellung noch Verkauf noch Einräumen. `restock`, `unstock` und Verkauf hängen nicht von der Position der Figur ab. Die Oberfläche öffnet Kasse und Warenverwaltung seit der Nacharbeit zu Auftrag 03 nur am Kassenpunkt (`register`) bzw. Lagerpunkt (`storage`); die Ortsregel liegt in `ui.ts`, nicht in der Fassade (siehe [ARCHITEKTUR-ENTSCHEIDUNGEN.md](ARCHITEKTUR-ENTSCHEIDUNGEN.md)).

`interact()` an einem Punkt vom Typ `register` oder `storage` ändert keinen Zustand und sendet `interaction.triggered`; an Tür und Klappe schaltet es wie bisher. `AvailableInteraction.action` kennt zusätzlich `register.use` und `storage.use`.

Lesende Hilfen (`selectors.ts`, ohne Veränderung): `findProduct`, `findSlot`, `storageQuantity`, `storageUnits`, `pendingUnits`, `freeStorageUnits`, `shelfQuantity`, `slotCapacityFor`, `slotsAccepting`, `cartNeedsAgeCheck`, `cartMinimumAge`, `cartTotalCents`, `orderTotalCents`, `weekdayOf` (Tag 1 = Montag, Index 0 bis 6).

### 15.5 Signale (`events.ts`)
| Signal | Nutzlast | Wann |
|---|---|---|
| `calendar.changed` | `{ paused, speed, phase }` | Pause, Tempo oder Phase geändert (nie je Tick) |
| `day.ending` | `{ day }` | 22:00 erreicht, einmal je Tag |
| `day.ended` | `{ day }` | nach `closeDay` |
| `day.started` | `{ day }` | nach `startNextDay` |
| `product.stock.changed` | `{ productId }` | Lager- oder Regalmenge eines Produkts geändert (Lieferung, Einräumen, Zurücknehmen, Verkauf), je Produkt |
| `money.changed` | `{ cashCents }` | Bestellung und Verkauf |
| `sale.completed` | `{ transactionId, totalCents }` | Verkauf |
| `order.placed` | `{ totalCents }` | Bestellung |
| `delivery.received` | `{ totalCents }` | Lieferung angenommen |
| `interaction.triggered` | `{ pointId, kind }` | Kasse oder Lager benutzt |
| `game.state.replaced` | `{}` | nach Laden oder Zurücksetzen |

Abweichungen von der Skizze in Abschnitt 5: `product.stock.changed` trägt nur die Produkt-ID (Ort und Menge liest man im Zustand), `money.changed` heißt `cashCents` statt `balanceCents`, `sale.completed` trägt die Transaktions-ID und die Summe (Produkt und Menge stehen in der Transaktion), `npcId` fehlt bis Phase 4. Ein Signal pro Ereignis; Domänen rufen einander direkt auf.

### 15.6 Anordnung und Kapazität eines Warenplatzes (eine Quelle)
`slotUnitPositions(slot, unit, { gap, maxStack })` in `src/game/stockLayout.ts` ist die **einzige** Berechnung: Spalten entlang der Breite (zentriert), Reihen entlang der Tiefe (bündig an der Vorderkante +Z), Lagen nach oben bis `min(maxStack, ⌊Höhe / Einheitenhöhe⌋)`, Abstand 1 cm. Füllreihenfolge: Lage für Lage, vordere Reihe zuerst, links nach rechts; die ersten n Einträge sind die Positionen von n Einheiten, die Kapazität ist die Zahl der Einträge. `slotCapacityFor(content, slotId, productId)` nutzt sie mit `productMaxStack(product)` (Produktwert oder Standard der Verpackung) und gibt 0 zurück bei unbekannter ID oder unpassender Lagerart. Das Spiel prüft damit Einräumen, Laden und Validierung; die Welt (`stockView`) zeichnet an genau diesen Positionen (Rückseite des Mittelregals gespiegelt, Hefte geneigt). Kapazität ist daher immer gleich der sichtbaren Ware, ohne Überlappung. Gilt für Maßstab 1.

### 15.7 Zuordnung Rolle → Lagerart und Validierung (`validateStock.ts`)
| Rolle der Platzierung | darf präsentieren |
|---|---|
| `sales` | `counter` |
| `display` | `shelf`, `press` |
| `cooling` | `cooled` |
| `freezing` | `frozen` |
| `checkout`, `storage`, `returns` | nichts |

Die Zuordnung gilt je Rolle, nicht je Asset. `validateContent` ruft `validateStock` und meldet:
- **Produkte:** Schlüssel gleich ID; Präfix `product.`; eindeutige IDs; nichtleerer Name und Marke; Preise positive ganze Zahlen; Einkaufspreis kleiner als Verkaufspreis; bekannte Kategorie, Unterkategorie, Lagerart und Verpackung; `minimumAge` nur 16 oder 18; Unterkategorie verlangt `minimumAge`; `maxStack` ganze Zahl ≥ 1; keine leeren Nachfrage-Tags; Etikettfarben `#rrggbb`, nichtleerer Etikettext; Asset muss existieren und Kategorie `product` haben; jede Asset-ID genau einmal verwendet, jedes Produkt-Asset verwendet; zu jedem Produkt mindestens ein Platz der passenden Lagerart mit Kapazität ≥ 1.
- **Plätze:** Präfix `slot.`; eindeutige IDs; positive Maße; bekannte Lagerart; Platzierung existiert; Lagerart passt zur Rolle der Platzierung; Platz liegt innerhalb der Asset-Maße und nicht unter der Basis; kein Platz überschneidet ein auf der Platzierung stehendes Möbel (Kasse auf der Theke); Plätze derselben Platzierung überschneiden sich nicht.
- **Interaktionspunkte:** `door` und `shutter` brauchen einen passenden `openingId`; `register` und `storage` nicht. Alle Punkte müssen erreichbar sein (wie in 14.4).
- Nicht endliche Zahlen in Produkten und Plätzen werden abgelehnt.

Ein neues Produkt ist ein Eintrag in `products.ts` plus (bei neuer Verpackung) eine Fabrik, immer eine Asset-ID in `productAssets.ts` und eine Registerzeile.

### 15.8 Savegame Version 2 (`save/save.ts`)
*Seit Auftrag 04 ist `CURRENT_SCHEMA_VERSION` 3 und die Kette 1 → 2 → 3 (Abschnitt 16.7); dieser Abschnitt beschreibt den Stand nach Auftrag 03.*

- `CURRENT_SCHEMA_VERSION = 2`. Migration `1 → 2`: ergänzt `calendar` und `economy` mit den Anfangswerten aus 15.2; `regionId`, `player`, `kiosk` bleiben unverändert. Ein defekter Version-1-Stand bleibt `corrupt`.
- **Prüfung beim Laden (streng):** `calendar` (Tag ≥ 1, Minute zwischen 360 und 1320, Pause boolesch, Tempo aus `SPEEDS`, Phase eine der drei); Geld, Mengen, Zähler und Transaktionen als ganze Zahlen (Berichtsfelder `grossProfitCents` und `cashFlowCents` dürfen negativ sein); höchstens `TRANSACTION_LIMIT` Transaktionen. Verstöße ergeben `corrupt` mit lesbarem Grund.
- **Bereinigung bei geändertem Inhalt (kein Abbruch):** Hinterlagerposten, Regalplätze und Lieferzeilen mit unbekannter Produkt- oder Platz-ID werden verworfen; ein Regalposten, dessen Produkt nicht mehr zur Lagerart des Platzes passt, wird verworfen; Mengen über der aktuellen Platzkapazität werden gekürzt; Nullmengen fallen still weg. Jede Bereinigung erzeugt eine Warnung (`LoadResult.warnings`); `main.ts` loggt sie und zeigt einen Hinweis. Eine offene Lieferung, deren Zeilen alle unbekannt sind, entfällt ganz; das bereits abgebuchte Geld wird nicht erstattet.
- Der Warenkorb und die Altersbestätigung sind nicht Teil des Zustands und damit nie im Spielstand (getestet).
- Speichern: Schlüssel, Sicherung und Fehlerbehandlung wie in 13; zusätzliche Auslöser siehe [Ist-Stand](TECHNISCHER-IST-STAND.md).

### 15.9 Wer darf was ändern
| Schicht | Darf | Darf nicht |
|---|---|---|
| `game` (`economy`, `clock`) | einziger Ort, der `calendar`, `economy` und `kiosk` verändert; entscheidet über Verkauf, Altersschranke, Kapazität, Phasen; sendet Signale | `three`, DOM, konkrete Inhaltsdateien |
| `content` | liefert `ProductDef`, `StockSlotDef`, Assets, Layout; validiert sie | Zustand oder Regeln |
| `world` | zeichnet Ware aus `economy.shelves` über `slotUnitPositions`; liest nur | Bestände, Preise, Geld ändern; Spielwerte in `userData` ablegen |
| `ui` | liest Zustand, hält Warenkorb und Altersbestätigung als flüchtigen Panelzustand, ruft Aktionen auf, übersetzt Ablehnungsgründe in Text | Bestände, Preise oder Geld direkt ändern; Altersregeln selbst entscheiden |
| `main.ts` | verdrahtet, speichert, schaltet die Welteingabe bei offenem Panel ab (`world.setInputEnabled`) | Spielregeln |

### 15.10 Hinweis für spätere NPC-Kunden (kein Versprechen)
*Umgesetzt in Auftrag 04: Bewohner kaufen über `completeSale` mit dem optionalen Feld `customer`, das Alter kommt aus den Inhaltsdaten, `sale.completed` und die Transaktion tragen `npcId` (Abschnitt 16.5). Der folgende Text beschreibt den Stand vor Auftrag 04.*

`economy.completeSale` kennt weder UI noch Spielerposition: Es nimmt Produktzeilen und das Flag `ageCheckConfirmed` und bucht Bestand, Kasse, Tagesumsatz und Transaktion. Ein späterer NPC-Kunde könnte dieselbe Domäne aufrufen, statt Regeln nachzubauen; die Altersschranke und die Prüfung von Bestand, Phase und Klappe gelten dann gleich. Offen bleibt, wer die Altersprüfung für einen NPC bestätigt und ob `sale.completed` um einen `npcId` erweitert wird; beides ist Sache von Phase 4. Eine Preisänderung (`economy.setPrice`) gibt es nicht; sie wäre eine Erweiterung von `EconomyState` mit Migration.

## 16. Stand nach Auftrag 04: Bewohner, Dialoge, Geschichten, Savegame 3

Maßgeblich sind `src/game/{npcTypes,state,balance,npcSim,npcs,npcSelectors,dialogue,story,conditions,relationship,wishes,nav,random,interaction,economy,events,game,placement,colliders}.ts`, `src/game/save/save.ts`, `src/content/regions/ruhrgebiet/{residents,nav,quests,customerLines,dialogueKit,dialogues*,layout,index}.ts` und `src/content/validateResidents.ts`, `src/world/assets/residents/*`, `src/world/views/residentView.ts`, `src/world/placementGates.ts`, `src/world/collision.ts` sowie `src/ui/{socialViewModel,ui,texts}.ts` und `src/ui/panels/{dialogue,journal}.ts`. Dieser Abschnitt ersetzt die Skizzen in den Abschnitten 4, 5, 7 und 9 für alles, was Phase 4 betrifft. Die Inhalte der Bewohner und Geschichten stehen in [BEWOHNER-UND-GESCHICHTEN.md](BEWOHNER-UND-GESCHICHTEN.md), die Begründungen in ADR-017 bis ADR-022 der [ADRs](ARCHITEKTUR-ENTSCHEIDUNGEN.md).

**Abweichungen vom Plan der Abschnitte 2 bis 9:**
- Die Bewohner-Logik liegt flach in `src/game/` (keine Unterordner `people/` und `story/`); die Fassade heißt `game.npcs` und `game.dialogue` statt `people` und `story`.
- Der Zufall liegt in `src/game/random.ts` (nicht in `core`) und ist zustandslos (ADR-017); `rngState` steht nicht im Spielstand, dafür `world.seed`.
- `NpcDef`, `DialogueDef`, `QuestDef`, `Condition` und `Effect` haben andere Felder als die Skizzen (siehe 16.1); Dialoge haben Knoten und Prioritäten statt `lines`, Quests sind reine Fortschrittsdefinitionen (Schritte und Ausgänge, die Dialoge setzen) ohne eigene Auslöser; „ablehnbar“ sind sie über Ausgänge (z. B. `abgelehnt`, `neutral`).
- Signale heißen anders als in Abschnitt 5 skizziert (16.6): `npc.visited_kiosk`, `quest.updated` und `quest.completed` gibt es nicht.

### 16.1 Inhaltstypen (`src/game/npcTypes.ts`)
Nur Daten; das einzige Verhalten liegt in `conditions.ts`, `story.ts` und der Simulation. Kein Code in den Daten.

```ts
export interface WaypointDef { id: string /* 'wp.' */; position: Vec2 }
export type PlaceKind = 'kiosk-window' | 'sidewalk' | 'yard' | 'exit';
export interface PlaceSpotDef { waypointId: string; heading: number /* rad, 0 = +Z */ }
export interface PlaceDef { id: string /* 'place.' */; kind: PlaceKind; spots: PlaceSpotDef[] /* Exit: genau einer */ }
export interface NavDef { waypoints: WaypointDef[]; edges: [string, string][] /* ungerichtet */; places: PlaceDef[] }

export type Condition =
  | { type: 'flag'; id: string; value?: boolean }
  | { type: 'relationshipAtLeast'; npcId: string; value: number }
  | { type: 'relationshipBelow'; npcId: string; value: number }
  | { type: 'questStep'; questId: string; step: string }
  | { type: 'questOutcome'; questId: string; outcome: string }
  | { type: 'questNotStarted'; questId: string }
  | { type: 'time'; from: number; to: number }          // Minuten seit Mitternacht, from eingeschlossen, to ausgeschlossen
  | { type: 'weekday'; days: Weekday[] }
  | { type: 'seen'; dialogueId: string }
  | { type: 'memory'; npcId: string; memoryId: string }
  | { type: 'dayAtLeast'; day: number }
  | { type: 'not'; condition: Condition }
  | { type: 'any'; conditions: Condition[] };

export type Effect =
  | { type: 'relationship'; npcId: string; delta: number; key: string }  // höchstens einmal je key, Ergebnis 0..100
  | { type: 'setFlag'; id: string; value: boolean }
  | { type: 'remember'; npcId: string; memoryId: string }                // einmal
  | { type: 'questStep'; questId: string; step: string }                 // nur vorwärts
  | { type: 'questOutcome'; questId: string; outcome: string }           // endgültig
  | { type: 'sellWish' } | { type: 'declineWish' } | { type: 'checkId' }; // Kundeneffekte

export interface DialogueOption { id: string; text: string; when?: Condition[]; effects?: Effect[]; next?: string /* fehlt = Ende */ }
export interface DialogueNode { text: string; options: DialogueOption[] }
export interface DialogueDef {
  id: string /* 'dialogue.' */; npcId: string; priority: number /* höher zuerst */;
  when?: Condition[]; once?: boolean; start: string; nodes: Record<string, DialogueNode>;
}
export interface QuestDef {
  id: string /* 'quest.' */; title: string;
  steps: { id: string; journal: string }[];      // geordnet, nur vorwärts
  outcomes: { id: string; journal: string }[];
}

export type RoutineActivity = 'shop' | 'visit' | 'linger' | 'pass-by';
export interface RoutineEntry {
  id: string; weekdays: Weekday[]; from: number; to: number;   // 360..1320, from eingeschlossen, to ausgeschlossen
  activity: RoutineActivity; placeId: string; chancePercent: number; when?: Condition[];
}
export interface WishLine { productId: string; quantity: number }
export interface WishDef {
  id: string /* 'wish.' */; lines: WishLine[]; when?: Condition[]; text: string; weight?: number;
  onSold?: Effect[]; onDeclined?: Effect[];                    // ohne Kundeneffekte
}
export interface NpcRelationshipDef { npcId: string; kind: string; note: string }
export interface NpcDef {
  id: string /* 'npc.' */; name: string; age: number; role: string; bio: string;
  assetId: string /* 'N-0xx' */; personalityTags: string[] /* 2..4 */; walkSpeed: number /* m/s bei Tempo 1 */;
  startRelationship: number; homeExitPlaceId: string; routine: RoutineEntry[];
  likes: string[]; dislikes: string[] /* Produkt-ID oder 'tag:<Nachfrage-Tag>', ohne Spielwirkung */;
  relationships: NpcRelationshipDef[] /* beschreibend, ohne Spielwirkung */; dialogueIds: string[]; wishes?: WishDef[];
}
export interface CustomerLines {            // alle Spieltexte des eingebauten Kundengesprächs
  sell: string; checkId: string; decline: string; close: string; idChecked: string /* enthält {age} */;
  sold: string; declined: string; failed: Record<string, string> /* je Ablehnungsgrund */; failedFallback: string;
}
```

Erweiterungen bestehender Verträge: `ContentPack` hat zusätzlich `npcs`, `dialogues`, `quests` (je nach ID) und `customerLines`; `RegionLayout.nav: NavDef`; `PlacementDef.requiresFlag?: string` (Story-Flag, das die Platzierung existieren lässt); `AssetCategory` bleibt (Bewohner-Assets `N-0xx` stehen nicht im Katalog, nur im Register).

**Auswertung der Bedingungen** (`evaluateCondition`, rein, wirft nie): `flag` gilt als gesetzt nur bei `true` (fehlend = falsch, `value` standardmäßig `true`); `relationshipAtLeast/Below` verlangen einen bekannten Bewohner (unbekannt trifft nie zu); `questStep` und `questOutcome` vergleichen den gespeicherten Fortschritt; `questNotStarted` gilt ohne Eintrag oder bei `step === null && outcome === null`; `time` vergleicht die Minute der Uhr; `weekday` nutzt `weekdayOf(Tag)`; `seen` liest `story.seenDialogues`; `memory` die Erinnerungen des Bewohners; `dayAtLeast` den Tageszähler; `not` und `any` verknüpfen. Eine leere oder fehlende Liste gilt als erfüllt.

**Wirkung der Effekte** (`story.ts`, `dialogue.ts`): `relationship` wirkt nur, wenn der Schlüssel noch nicht in `story.effectKeys` steht (und die Liste nicht voll ist); das Ergebnis wird gerundet und auf 0 bis 100 begrenzt, ein Signal kommt nur bei echter Änderung. `setFlag` setzt oder löscht (höchstens 500 Flags). `remember` hängt die Erinnerung einmal an (höchstens 200 je Bewohner). `questStep` rückt nur auf einen späteren Schritt der Liste vor und wirkt nach einem Ausgang nicht mehr; `questOutcome` ist endgültig. Unbekannte IDs werden still ignoriert (die Inhaltsvalidierung meldet sie). Kundeneffekte laufen **vor** allen anderen Effekten einer Antwort; scheitert einer, wird die Antwort abgebrochen und nichts sonst wirkt. Alle Effekte einer Antwort laufen in der Reihenfolge der Liste.

### 16.2 IDs und Konventionen
| Art | Muster | Beispiel |
|---|---|---|
| Bewohner | `npc.<name>` | `npc.guenter` |
| Dialog | `dialogue.<bewohner>.<thema>` | `dialogue.marlene.hof-beschwerde` |
| Quest | `quest.<name>` | `quest.hof`; Schritte und Ausgänge sind kurze IDs (`beschwerde`, `kompromiss`) |
| Wunsch | `wish.<bewohner>-<ware>` | `wish.jonas-tabak` |
| Wegpunkt, Ort | `wp.<name>`, `place.<name>` | `wp.win-1`, `place.kiosk-window` |
| Routine | frei, je Bewohner eindeutig | `g.morgen` |
| Beziehungsschlüssel | `k.<…>` (Konvention, nicht erzwungen), ein Schlüssel = ein Bewohner und ein Wert | `k.hof.kompromiss.derya` |
| Erinnerungen der Spiellogik | `served:<wishId>`, `declined:<wishId>`, `ignored:<wishId>`, `kiosk-closed` | |
| Erinnerungen der Dialoge | `<bewohner>:<thema>` (Konvention) | `marlene:duzen` |
| Flags | frei | `yard.bench`, `parcel.at-kiosk`, `kiosk.photo`, `photo.stand-idee`, `photo.stand` |
| Figur-Asset | `N-0xx` (Format wird geprüft, kein Katalogeintrag) | `N-002` |

Eine vergebene ID wird wie in Abschnitt 6 nie umbenannt oder wiederverwendet, weil Spielstände auf sie verweisen (Bewohner, Dialoge, Quests mit Schritten und Ausgängen, Routinen, Wünsche, Orte, Wegpunkte). Das gilt auch für Routine-IDs, die in die Würfel eingehen (ADR-017).

### 16.3 `GameState` Version 3 (`src/game/state.ts`)
```ts
export type NpcStatus = 'away' | 'walking' | 'waiting' | 'at_place' | 'talking';
export interface DayTime { day: number; minute: number /* ganze Minuten */ }
export interface NpcWishState {
  wishId: string; lines: ProductLine[];
  ageChecked: boolean;                 // Ausweisprüfung im Kundengespräch gewählt
  resolved: 'sold' | 'declined' | null; // endgültig
}
export interface NpcState {
  status: NpcStatus; position: Vec2; heading: number;       // rad, 0 = +Z
  placeId: string | null;              // Ziel oder Aufenthaltsort, null = abwesend
  spotIndex: number | null;            // reservierter Standplatz
  route: string[];                     // übrige Wegpunkte, der erste ist das Ziel
  routineId: string | null;            // treibender Routineeintrag
  relationship: number;                // ganze Zahl 0..100
  memories: string[];
  lastVisit: DayTime | null; lastTalk: DayTime | null;
  greetedDay: number | null;           // Tag des letzten Tagesgrußes (+1)
  doneToday: { day: number; routineIds: string[] };
  wish: NpcWishState | null;
  waitingSince: number | null;         // absolute Spielminute (Tag × 1440 + Minute)
}
export interface QuestProgress { step: string | null; outcome: string | null }
export interface StoryState {
  flags: Record<string, boolean>;
  quests: Record<string, QuestProgress>;   // Eintrag mit dem ersten Schritt oder Ausgang
  seenDialogues: string[];                 // Gespräche, die mindestens einmal endeten (auch durch Schließen)
  effectKeys: string[];                    // verbrauchte Beziehungsschlüssel
}
export interface GameState {
  regionId: string;
  player: { position: Vec2; heading: number };
  kiosk: { doorOpen: boolean; shutterOpen: boolean };
  calendar: CalendarState;
  economy: EconomyState;
  world: { seed: number };                 // 32 Bit, gespeichert
  npcs: Record<string, NpcState>;
  story: StoryState;
}
// Transaction hat zusätzlich das optionale Feld npcId?: string (Bewohner als Kunde).
```
Nicht im Zustand: das offene Gespräch (Sitzung, Knoten, Hinweis), Laufzeitzähler der Simulation (Blockadezeiten, Rückfallebene, Tagescache der Würfe), Interaktionsziel, alle Three.js-Objekte, DOM und Animationszustand. Ein gespeicherter `talking`-Status wird beim Laden zu `walking`, `waiting` oder `at_place`. Anfangszustand eines Bewohners (`createInitialNpcState`): `away` am Heimatausgang, Startbeziehung aus dem Inhalt, leere Erinnerungen, kein Wunsch.

### 16.4 Balancing (`src/game/balance.ts`, neue Werte)
| Konstante | Wert | Bedeutung |
|---|---|---|
| `NPC_RADIUS` | 0,3 | Kollisionsradius eines Bewohners in Metern |
| `NPC_CLEARANCE_MARGIN` | 0,05 | zusätzlicher Abstand zu Spieler und anderen Bewohnern (Mindestabstand Bewohner–Spieler 0,65 m, Bewohner–Bewohner 0,65 m) |
| `NPC_BLOCKED_WAIT_SECONDS` | 4 | Wartezeit vor der Suche nach einer Ausweichroute (spieltempo-skaliert) |
| `NPC_DEADLOCK_SECONDS` | 20 | Blockadezeit durch einen Bewohner, nach der der ausweichpflichtige (höhere ID) durch ihn hindurchgeht |
| `NPC_MAX_STEP_SECONDS` | 1/30 | längster Simulationsteilschritt |
| `NPC_MAX_TICK_SECONDS` | 5 | höchste Simulationsdauer der Bewohner je `game.tick` (größere Zeitschritte werden gekappt) |
| `NPC_TALK_RADIUS` | 1,8 | Reichweite zum Ansprechen (m) |
| `NPC_TALK_MAX_ANGLE` | 75° (in Radiant) | größte Abweichung der Blickrichtung des Spielers |
| `SHUTTER_PATIENCE_MINUTES` | 30 | Geduld eines Kunden vor geschlossener Klappe (Spielminuten) |
| `RELATIONSHIP_MIN`, `RELATIONSHIP_MAX` | 0, 100 | Wertebereich |
| `RELATIONSHIP_TIER_THRESHOLDS` | bekannt 20, vertraut 50, eng verbunden 80 | Untergrenzen der Stufen (fremd darunter) |
| `DAILY_GREETING_BONUS` | 1 | einzige wiederholbare Beziehungsänderung |
| `SAVE_LIMITS` | Erinnerungen 200 je Bewohner, Route 64, erledigte Routinen 64 je Tag, Wunschzeilen 16, Flags 500, gesehene Dialoge 500, Effektschlüssel 1000 | Obergrenzen der gespeicherten Listen (größer im Spielstand = beschädigt, die Engine hört beim Limit auf zu ergänzen) |
| `DEFAULT_WORLD_SEED` (`state.ts`) | 1 | Seed ohne Vorgabe (Tests, Werkzeuge); `main.ts` übergibt bei einem neuen Spiel einen frischen |

In `validateResidents.ts` stehen außerdem `MAX_EFFECT_DELTA` = 20 und `MAX_OPTIONS` = 4 als Inhaltsgrenzen.

### 16.5 `Game`-Fassade: Erweiterungen
Alle Ablehnungen sind `{ ok: false, reason }`; eine abgelehnte Aktion ändert nichts (Ausnahme: ein gescheiterter Kundenverkauf zeigt seinen Grund in der Kundenansicht an, ändert aber keinen Spielzustand).

`createGame(content, initialState?, seed?)`: `seed` ist eine Zahl oder eine Funktion, die für jedes neue Spiel einschließlich `reset()` aufgerufen wird; ohne sie gilt `DEFAULT_WORLD_SEED`. Mit `initialState` gilt der gespeicherte Seed.

| Aktion | Wirkung | Ablehnungsgründe |
|---|---|---|
| `game.tick(dtSeconds)` | wie in 15.4 für die Uhr, danach die Bewohner-Simulation (feste Teilschritte, steht bei Pause) und die Auffrischung des Interaktionsziels | – |
| `game.npcs.list()`, `game.npcs.get(npcId)` | Kopien (`NpcView`: `id`, `status`, `position`, `heading`, `placeId`, `visible`, `hasWish`, `activity`, `relationship`, `tier`); `get` liefert `null` für unbekannte IDs | – |
| `game.npcs.talk(npcId)` | öffnet ein Gespräch: bei `waiting` mit offenem Wunsch das Kundengespräch, sonst das Gespräch mit der höchsten Priorität, dessen Bedingungen gelten; Tagesgruß (+1, einmal je Tag), `lastTalk`, Blick zum Spieler, Status `talking`; Signale `npc.status.changed`, `dialogue.opened` | `unknown_npc`; `npc_away`; `dialogue_already_open`; `nothing_to_say` |
| `game.dialogue.current()` | die offene Sitzung als `DialogueView` oder `null` | – |
| `game.dialogue.choose(optionId)` | wendet die Effekte der Antwort atomar und in Reihenfolge an, geht zum Folgeknoten oder beendet; liefert `{ ok: true, ended, transaction? }` | `no_dialogue`; `unknown_option`; `option_unavailable` (Bedingungen der Antwort gelten nicht; im Kundengespräch auch „Bis gleich.“ vor der Entscheidung). Im Kundengespräch zusätzlich: `no_wish`, `wish_already_resolved` und jeder Grund von `completeSale` (`day_not_open`, `kiosk_closed`, `age_check_required`, `customer_underage`, `insufficient_stock`, `unknown_customer`, bei defekten Daten `invalid_quantity` oder `unknown_product`) |
| `game.dialogue.close()` | beendet die Sitzung vorzeitig, **ohne** das Gespräch als gesehen zu vermerken (erst eine Schlussantwort über `choose` vermerkt es), Bewohner läuft weiter oder wartet; Signal `dialogue.closed` | `no_dialogue` |
| `game.getInteractionTarget()` | `InteractionTarget \| null`: der nächste sichtbare Bewohner in Reichweite, den der Spieler ansieht (`kind: 'npc'`, `action: 'npc.talk'`, `pointId` = Bewohner-ID, `npcId`), sonst der Kiosk-Punkt | – |
| `game.getAvailableInteraction()` | wie bisher der Kiosk-Punkt, aber `null`, solange ein Bewohner anvisiert ist | – |
| `game.interact()` | Bewohner in Reichweite: wie `npcs.talk`; sonst wie in 15.4 | `nothing_in_range`; die Gründe von `talk` |
| `economy.completeSale({ lines, ageCheckConfirmed, customer? })` | wie in 15.4; mit `customer: { npcId }` zusätzlich Alter aus den Inhaltsdaten; die Transaktion trägt `npcId`, `sale.completed` ebenfalls | zusätzlich `unknown_customer` (unbekannte Bewohner-ID) und `customer_underage` (Alter unter dem höchsten Mindestalter der Zeilen, auch bei `ageCheckConfirmed: true`); Prüfreihenfolge: Zeilen (`empty_cart`, `invalid_quantity`, `unknown_product`), `unknown_customer`, `day_not_open`, `kiosk_closed`, `age_check_required`, `customer_underage`, `insufficient_stock` |
| `game.load(state)`, `game.reset()` | ersetzen den Zustand, beenden ein offenes Gespräch (Signal `dialogue.closed`, **ohne** es als gesehen zu vermerken), leeren die Laufzeitzähler der Simulation, Signal `game.state.replaced` | `load`: `region_mismatch` |

`DialogueView` (`game.dialogue.current()`):
```ts
interface DialogueView {
  npcId: string; dialogueId: string;       // Inhalts-ID oder 'dialogue.customer' (CUSTOMER_DIALOGUE_ID)
  nodeId: string;                          // Inhaltsknoten, im Kundengespräch 'offer' | 'sold' | 'declined'
  text: string; options: { id: string; text: string }[];   // nur Antworten, deren Bedingungen gelten
  customer?: {                             // nur im Kundengespräch
    wishId: string; lines: ProductLine[]; totalCents: number; minimumAge: number | null;
    ageChecked: boolean; revealedAge: number | null;       // das Alter erst nach 'checkId'
    stage: 'offer' | 'sold' | 'declined'; failureReason: string | null;
  };
}
```
Option-IDs des Kundengesprächs (`CUSTOMER_OPTION`): `sell`, `checkId` (nur bei altersbeschränkter Ware und solange nicht geprüft), `decline`, `close` (nur nach der Entscheidung). Die Texte kommen aus `customerLines`.

Weitere lesende Helfer: `findNpcState` (`npcSelectors.ts`), `relationshipTier` und `clampRelationship` (`relationship.ts`), `findNpcInteraction` und `angleBetween` (`interaction.ts`), `buildNavGraph`, `findPath`, `nearestWaypoint`, `navEdgeClear`, `navReachability` (`nav.ts`), `pickWish` (`wishes.ts`), `roll`, `hashParts`, `createRng` (`random.ts`).

### 16.6 Signale (`events.ts`, neu oder geändert)
| Signal | Nutzlast | Wann |
|---|---|---|
| `npc.status.changed` | `{ npcId, status }` | ein Bewohner erscheint, geht, steht, wartet, spricht oder verschwindet; nie je Tick |
| `npc.wish` | `{ npcId, wishId }` | ein Kunde hat seinen Wunsch geäußert und wartet |
| `dialogue.opened` | `{ npcId, dialogueId }` | Gespräch geöffnet (`dialogueId` ist die Inhalts-ID oder `dialogue.customer`) |
| `dialogue.closed` | `{ npcId }` | Gespräch beendet (Antwort ohne Folgeknoten, `close`, Laden, Zurücksetzen) |
| `relationship.changed` | `{ npcId, value, tier }` | nur bei echter Änderung des Werts |
| `story.changed` | `{ questId?, flag? }` | ein Flag hat seinen Wert geändert oder ein Quest-Schritt bzw. Ausgang wurde gesetzt |
| `memory.added` | `{ npcId, memoryId }` | eine neue Erinnerung (nie doppelt) |
| `interaction.target.changed` | `{ target: InteractionTarget \| null }` | das Ziel von `interact()` (Bewohner oder Punkt) hat gewechselt |
| `interaction.available.changed` | `{ interaction: AvailableInteraction \| null }` | wie bisher; `null`, solange ein Bewohner anvisiert ist |
| `sale.completed` | `{ transactionId, totalCents, npcId? }` | wie in 15.5; `npcId` nur bei Bewohnerkäufen |

Alle anderen Signale aus 15.5 bleiben. Nutzlasten enthalten nur IDs und einfache Werte.

### 16.7 Savegame Version 3 (`save/save.ts`)
- `CURRENT_SCHEMA_VERSION = 3`. **Migration 2 → 3:** ergänzt `world: { seed }` (aus `hashParts('legacy-world', Region, Speicherzeit)`; dieselbe Datei ergibt immer denselben Seed), `npcs: {}` und eine leere `story`; alles andere (Position, Tür, Klappe, Zeit, Kasse, Lager, Warenplätze, Transaktionen, Tagesbericht) bleibt unverändert. Die Migration kennt keinen Inhalt: Der inhaltsabhängige Teil der Prüfung ergänzt jeden fehlenden Bewohner mit seinem Anfangszustand (ohne Warnung, solange die gespeicherte Liste leer war; bei einer nichtleeren, unvollständigen Liste mit Warnung). **Version 1** lädt über die Kette 1 → 2 → 3. Ein defekter Version-2-Stand bleibt `corrupt`; eine neuere Version ergibt `unsupported_version`.
- **Strenge Prüfung (Verstoß ergibt `corrupt`):** `world.seed` eine ganze Zahl 0 bis 2³²−1; je Bewohner Status aus der Liste, Position und Blickrichtung endlich, Route höchstens 64 Wegpunkte, `relationship` ganze Zahl 0 bis 100, Erinnerungen und Listen mit Obergrenzen, Wunschzeilen (Menge ≥ 1), `resolved` ∈ {null, sold, declined}; `story.flags` boolesch (höchstens 500), Quest-Einträge mit `step`/`outcome` als Text oder `null`, Listenlängen.
- **Bereinigung bei geändertem Inhalt (kein Abbruch, Warnung):** unbekannte Bewohner werden verworfen; unbekannte Dialog-IDs in `seenDialogues` werden verworfen; Quests mit unbekannter ID, unbekanntem Schritt oder Ausgang werden verworfen; ein Bewohner mit unbekanntem Ort, Wegpunkt, Standplatz, Routine, Wunsch oder unbekannter Ware im Wunsch wird auf „abwesend am Heimatausgang“ zurückgesetzt (Beziehung, Erinnerungen und Zeiten bleiben); unbekannte Routine-IDs in `doneToday` entfallen; ein unbekannter Bewohner in einer Transaktion wird aus ihr entfernt (die Transaktion bleibt); neue Bewohner im Inhalt werden ergänzt. Normalisierung: `talking` wird nie wiederhergestellt (`walking`, wenn eine Route bleibt, sonst `waiting` mit offenem Wunsch oder `at_place`); ein abwesender Bewohner trägt weder Ort noch Route noch Wunsch; ein nicht abwesender Bewohner ohne Ort wird zurückgesetzt.
- **Bewusst nicht bereinigt:** Erinnerungen, Flags und Effektschlüssel sind einfache Zeichenketten und werden nicht gegen den Inhalt geprüft (Effektschlüssel werden nur entdoppelt).
- Nicht im Spielstand: Gesprächssitzung, Laufzeitzähler, Interaktionsziel (getestet: keine flüchtigen Gesprächsdaten).
- Speichern: Schlüssel, Sicherung und Fehlerbehandlung wie in 13; zusätzliche Auslöser stehen im [Ist-Stand](TECHNISCHER-IST-STAND.md) (und in [BEWOHNER-UND-GESCHICHTEN.md, Abschnitt 11](BEWOHNER-UND-GESCHICHTEN.md)).

### 16.8 Validierungsregeln (`validateResidents`, aufgerufen von `validateContent`)
- **Graph:** Präfixe und eindeutige IDs; Wegpunkte endlich und innerhalb der begehbaren Grenzen; Kanten verbinden bekannte, verschiedene Wegpunkte, ohne Doppelte, und sind für einen Kreis von 0,3 m frei von allen Kollisionsrechtecken (gebundene Platzierungen zählen als vorhanden); mindestens zwei Ausgänge, je mit genau einem Standpunkt; jeder Ort hat Standplätze, ein Wegpunkt gehört höchstens einem Ort; Standplätze halten 0,65 m Abstand zueinander und (außer Ausgängen und reinen Durchgangsorten) zu jeder fremden Bahn; mindestens ein Verkaufsfenster mit mindestens zwei Plätzen, jeder höchstens 1,8 m vom Standpunkt hinter der Theke entfernt; die Türzufahrt bleibt frei; jeder Wegpunkt ist von jedem Ausgang erreichbar.
- **Bewohner:** IDs mit Präfix `npc.`, Schlüssel gleich ID, keine gemeinsame Figur-ID, `N-001` nicht erlaubt; Name, Rolle, Biografie nicht leer; Alter 0 bis 120; 2 bis 4 Eigenschaften; Gehgeschwindigkeit in (0, 3]; Startbeziehung 0 bis 100; Heimatort ist ein Ausgang; Vorlieben und Abneigungen verweisen auf bekannte Produkte oder Nachfrage-Tags und überschneiden sich nicht; Beziehungen verweisen auf andere bekannte Bewohner mit Art und Notiz; jeder gelistete Dialog existiert, gehört dem Bewohner und ist nicht doppelt; mindestens ein unbedingtes, nicht einmaliges Rückfallgespräch; mindestens ein Routineeintrag.
- **Routinen:** eindeutige IDs, gültige eindeutige Wochentage 0 bis 6, Fenster 06:00 ≤ von < bis ≤ 22:00, bekannte Aktivität, Chance 0 bis 100, Ort existiert und ist kein Ausgang, `shop` nur am Verkaufsfenster und das Verkaufsfenster nur für `shop`, Bedingungen auflösbar.
- **Wünsche:** wer einkauft, hat Wünsche; IDs `wish.…` eindeutig; Zeilen mit bekannten Produkten und Menge ≥ 1; Text nicht leer; Gewicht positiv; Bedingungen auflösbar; `onSold`/`onDeclined` ohne Kundeneffekte.
- **Dialoge:** Präfix `dialogue.…`, Schlüssel gleich ID, Bewohner bekannt und der Dialog in dessen `dialogueIds` gelistet; ganzzahlige Priorität; Startknoten existiert; jeder Knoten erreichbar, Text nicht leer, 1 bis 4 Antworten, mindestens eine unbedingte; Antwort-IDs je Knoten eindeutig, Texte nicht leer, Folgeknoten existiert; Bedingungen und Effekte auflösbar (Bewohner, Quests, Schritte, Ausgänge, Dialoge, Produkte); `memory`-Bedingungen nur auf Erinnerungen, die ein Effekt oder die Engine setzt; `any` nicht leer; Beziehungswert ganzzahlig, nicht null, höchstens ±20, Schlüssel nicht leer; keine Kundeneffekte in Dialogen; keine widersprüchlichen Ausgänge oder Flag-Werte in einer Antwort; ein Beziehungsschlüssel gilt nur für denselben Bewohner und Wert.
- **Quests:** Präfix `quest.…`, mindestens drei Schritte und zwei Ausgänge, eindeutige IDs, Journaltexte nicht leer; jeder Schritt und jeder Ausgang wird von mindestens einem Effekt gesetzt.
- **Flags:** Jedes gelesene Flag (Bedingung oder `requiresFlag` einer Platzierung) wird von einem Effekt auf `true` gesetzt.
- **Kundentexte:** alle Zeilen nicht leer, `idChecked` enthält `{age}`, Zeilen für `insufficient_stock`, `kiosk_closed`, `customer_underage`, `age_check_required` und `day_not_open`.
- Nicht geprüft: ob die Bedingungen eines Dialogs je zusammen erfüllbar sind und ob ein Quest-Schritt im Spiel tatsächlich erreicht werden kann, solange sein Effekt irgendwo steht.

### 16.9 Welt-Verträge (`world`)
- **Figuren:** `createResident(assetId, materials): ResidentFigure` (`src/world/assets/residents/index.ts`) wählt die Fabrik je Asset-ID (`N-002`, `N-003`, `N-006`, `N-007`); unbekannte IDs liefern die neutrale Fallback-Figur und eine einmalige Warnung. `ResidentFigure`: `root` (Pivot an den Füßen, Blick +Z, etwa 1,6 bis 1,85 m), `height`, `headHeight`, `update(dt, speed, talking)` (keine Allokation) und `animation()` (`walk`, `idle` oder `talk`).
- **`createResidentView(game, materials)`:** `step(dt)` liest nach jedem `game.tick` `game.state.npcs`; `update(dt, alpha)` interpoliert und animiert; `circles()` liefert die Kollisionskreise der sichtbaren Bewohner (Radius `NPC_RADIUS`) an `moveCircle` des Spielers; `getInfo(project)` für die Debug-Anzeige. Die Darstellung liest nur und ändert keinen Spielzustand.
- **Spielerbewegung:** `moveCircle(start, delta, radius, obstacles, bounds, circles?)` hält den Abstand zu jedem Kreis auf mindestens das Kleinere aus der Radiensumme und dem Abstand vor dem Schritt (`constrainToCircles`); Wände und Möbel haben Vorrang. Bewohner schieben den Spieler nie.
- **Flaggebundene Platzierungen:** `createPlacementGates(layout, assets, objects).apply(flags)` zeigt oder versteckt die Objekte und liefert die passenden Kollisionslisten; `placementPresent` und `layoutColliders(layout, assets, doorOpen, flags?)` sind die einzige Quelle in `game`. Die Welt ruft `apply` bei `story.changed` und `game.state.replaced`.
- Debug (`?debug` oder Entwicklungsmodus): `world.getResidentInfo()`, `world.getGatedPlacements()`.

### 16.10 Wer darf was ändern (Ergänzung zu 15.9)
| Schicht | Darf | Darf nicht |
|---|---|---|
| `game` (`npcSim`, `dialogue`, `story`) | einziger Ort, der `npcs`, `story` und `world` verändert; entscheidet über Routinen, Wünsche, Gespräche, Effekte und Beziehungen; sendet Signale; ruft für Käufe `economy.completeSale` auf | `three`, DOM, konkrete Inhaltsdateien |
| `content` | liefert Graph, Bewohner, Dialoge, Quests, Wünsche und Texte als reine Daten; validiert sie | Zustand oder Regeln, ausführbaren Code in Daten |
| `world` | zeichnet Bewohner aus `game.state.npcs`; liefert Kreise für die Spielerbewegung; schaltet flaggebundene Objekte | Beziehungen, Erinnerungen, Flags, Bestände ändern |
| `ui` | rendert `game.dialogue.current()` und das Journal aus dem Zustand; ruft `dialogue.choose/close` und `interact()` auf; hält nur die Sperre gegen Doppelaktivierung und die letzte Ablehnungsmeldung | Effekte, Altersregeln oder Beziehungen selbst entscheiden |
| `main.ts` | verdrahtet, übergibt den frischen Seed, speichert (auch nach Gesprächs- und Story-Signalen), schaltet die Welteingabe bei offenem Panel ab | Spielregeln |

### 16.11 Offene Punkte für Phase 5
Wetter, Events und dynamische Nachfrage können an die Routinenbedingungen (neue `Condition`-Fälle), die Wunschgewichte und `sale.completed` anknüpfen. Dafür fehlen noch ein Kalenderdatum (bisher nur `weekdayOf(day)`), Bedingungen auf Wetter und Events und die Möglichkeit, dass ein Bewohner einen Wunsch anders gewichtet (`likes`/`dislikes` haben bisher keine Wirkung). Neue Bedingungen und Effekte sind je ein Fall im Typ mit Auswertung und Validierung.
