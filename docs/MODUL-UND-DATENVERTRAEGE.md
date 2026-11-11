# Modul- und Datenverträge

**Stand:** 2026-11-11 · Ergebnis von [Auftrag 00](auftraege/00-bestandsaufnahme-und-architektur.md)

**Plan und Bestand:** Die Abschnitte 1–12 sind der Plan aus Auftrag 00. Was davon umgesetzt ist und wo die Umsetzung abweicht, steht in Abschnitt 13 und im [Ist-Stand](TECHNISCHER-IST-STAND.md). Begründungen stehen in den [ADRs](ARCHITEKTUR-ENTSCHEIDUNGEN.md). Typen sind Vertragsskizzen; Feldnamen können sich bei der Umsetzung der jeweiligen Phase noch präzisieren, die Grundform nicht.

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

## 5. Kommunikation

| Fall | Mittel |
|---|---|
| UI/Welt will etwas ändern | Aktion auf der `Game`-Fassade |
| UI/Welt will etwas anzeigen | `game.state` lesen |
| UI/Welt/Audio muss auf Änderung reagieren | Signal abonnieren |
| Domäne braucht andere Domäne innerhalb von `game` | direkter Funktionsaufruf |

**Signale:** synchron, typisiert, Namensschema `bereich.ereignis` in Vergangenheitsform, Nutzlast enthält nur IDs und einfache Werte. Ein Fehler in einem Abonnenten wird geloggt und hält die anderen nicht auf. Im Entwicklungsmodus lassen sich alle Signale in der Konsole mitschreiben.

Geplante Ereignisse (jeweils erst mit ihrer Phase eingeführt):

| Signal | Nutzlast | Phase |
|---|---|---|
| `day.started`, `day.ended` | `{ day }` | 3 |
| `product.stock.changed` | `{ productId, location, quantity }` | 3 |
| `sale.completed` | `{ productId, quantity, totalCents, npcId? }` | 3 |
| `money.changed` | `{ balanceCents }` | 3 |
| `npc.visited_kiosk` | `{ npcId }` | 4 |
| `relationship.changed` | `{ npcId, level }` | 4 |
| `quest.updated`, `quest.completed` | `{ questId, stepId? }` | 4 |
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
interface ProductDef {            // Phase 3
  id: string;                     // product.*
  name: string;
  brand?: string;                 // fiktive Markenfamilie
  category: 'drink' | 'snack' | 'sweet' | 'icecream' | 'bakery' | 'magazine' | 'everyday' | 'seasonal';
  purchasePriceCents: number;
  suggestedPriceCents: number;
  storage: 'shelf' | 'fridge' | 'freezer' | 'counter' | 'rack';
  unitsPerSlot: number;           // Platzbedarf in der Einrichtung
  demandTags: string[];           // z. B. 'cold', 'matchday', 'kids'
  ageRestricted?: boolean;        // siehe offene Entscheidung O-4
  assetId: string;                // P-xxx
  label: { primaryColor: string; accentColor: string }; // Etikettvariante
}

interface NpcDef {                // Phase 4
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

**Kiosk-Layout** (`layout.ts`): Liste platzierter Einrichtungsgegenstände mit Asset-ID, Position, Drehung und Lagerplätzen. Die Welt baut daraus die Szene, `game` daraus die Lagerkapazität. So bleibt die Einrichtung verschiebbar und speicherbar.

## 8. Validierung

`validateContent(pack)` prüft und liefert eine Liste lesbarer Fehler mit Datei-/ID-Bezug:
- IDs eindeutig und mit korrektem Präfix
- alle Verweise auflösbar (Produkt ↔ Asset, NPC ↔ Dialog, Quest ↔ NPC, Rezept ↔ Zutat, Event ↔ Tags)
- Wertebereiche (Preise > 0, Verkaufspreis-Vorschlag ≥ Einkaufspreis, Uhrzeiten 0–24, Wahrscheinlichkeiten 0–1)
- jede Quest hat mindestens einen Schritt, jeder Dialog einen Einstieg, kein Dialogknoten unerreichbar

Aufruf: beim Start im Entwicklungsmodus (Fehler werden sichtbar angezeigt, das Spiel startet nicht) und als Vitest-Test. Im Produktionsbuild nur geloggt.

## 9. Spielzustand und Savegame

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
| Zeitmodell unentschieden (O-3) | Grundform vor Phase 3 festlegen; Geschwindigkeit bleibt Balancing |
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
- **`GameState` ist kleiner als in Abschnitt 9.** Version 1 enthält nur `regionId`, `player` und `kiosk: { doorOpen, shutterOpen }`. Die Abschnitte für Kalender, Wirtschaft, Menschen, Geschichten und Spezialitäten kommen mit ihrer Phase per Migration hinzu, statt von Beginn an leer im Schema zu stehen. Grund: Auftrag 01 schließt vorgezogene Systeme aus.
- **`Game.tick` und `rngState` gibt es noch nicht.** Ohne Spielzeit (O-3 offen) und ohne Zufall hat `game` nichts zu simulieren. Der Loop treibt derzeit nur die Welt an.
- **Kiosk-Layout als Baukörper statt Platzierungsliste.** `RegionLayout` beschreibt den Kiosk über Grundfläche, Höhe, Wandstärke und Öffnungen; Möbel sind Rechtecke mit Höhe und Asset-ID. Eine verschiebbare Platzierungsliste mit Lagerplätzen folgt in Phase 2/3.
- **Aktionen sind noch nicht nach Domänen gruppiert.** Die Fassade hat `player.setPose`, `interact`, `getAvailableInteraction`, `save`, `load`, `reset`.

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
