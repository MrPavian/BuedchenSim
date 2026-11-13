# Modul- und Datenverträge

**Stand:** 2026-11-13 · Ergebnis von [Auftrag 00](auftraege/00-bestandsaufnahme-und-architektur.md)

**Plan und Bestand:** Die Abschnitte 1–12 sind der Plan aus Auftrag 00. Was davon umgesetzt ist und wo die Umsetzung abweicht, steht in den Abschnitten 13, 14 und 15 und im [Ist-Stand](TECHNISCHER-IST-STAND.md). Begründungen stehen in den [ADRs](ARCHITEKTUR-ENTSCHEIDUNGEN.md). Typen sind Vertragsskizzen; Feldnamen können sich bei der Umsetzung der jeweiligen Phase noch präzisieren, die Grundform nicht.

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

*Stand nach Auftrag 03:* `economy` und `calendar` sind umgesetzt (Abschnitt 15.4); `tick` nimmt reale Sekunden (`tick(dtSeconds)`), nicht Spielminuten, und `economy.setPrice` gibt es nicht. Die Skizze oben bleibt der Plan.

## 5. Kommunikation

| Fall | Mittel |
|---|---|
| UI/Welt will etwas ändern | Aktion auf der `Game`-Fassade |
| UI/Welt will etwas anzeigen | `game.state` lesen |
| UI/Welt/Audio muss auf Änderung reagieren | Signal abonnieren |
| Domäne braucht andere Domäne innerhalb von `game` | direkter Funktionsaufruf |

**Signale:** synchron, typisiert, Namensschema `bereich.ereignis` in Vergangenheitsform, Nutzlast enthält nur IDs und einfache Werte. Ein Fehler in einem Abonnenten wird geloggt und hält die anderen nicht auf. Im Entwicklungsmodus lassen sich alle Signale in der Konsole mitschreiben.

Geplante Ereignisse (jeweils erst mit ihrer Phase eingeführt). Die Signale der Phase 3 sind umgesetzt, mit teils anderen Nutzlasten; maßgeblich ist Abschnitt 15.5:

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

**Kiosk-Layout** (`layout.ts`; die Warenplätze stehen seit Auftrag 03 als `StockSlotDef` in `slots.ts`, Abschnitt 15): Liste platzierter Einrichtungsgegenstände mit Asset-ID, Position, Drehung und Lagerplätzen. Die Welt baut daraus die Szene, `game` daraus die Lagerkapazität. So bleibt die Einrichtung verschiebbar und speicherbar.

## 8. Validierung

`validateContent(pack)` prüft und liefert eine Liste lesbarer Fehler mit Datei-/ID-Bezug:
- IDs eindeutig und mit korrektem Präfix
- alle Verweise auflösbar (Produkt ↔ Asset, NPC ↔ Dialog, Quest ↔ NPC, Rezept ↔ Zutat, Event ↔ Tags)
- Wertebereiche (Preise > 0, Verkaufspreis-Vorschlag ≥ Einkaufspreis, Uhrzeiten 0–24, Wahrscheinlichkeiten 0–1)
- jede Quest hat mindestens einen Schritt, jeder Dialog einen Einstieg, kein Dialogknoten unerreichbar

Aufruf: beim Start im Entwicklungsmodus (Fehler werden sichtbar angezeigt, das Spiel startet nicht) und als Vitest-Test. Im Produktionsbuild nur geloggt.

## 9. Spielzustand und Savegame

*Überholt für Phase 3:* Das umgesetzte `GameState` (Version 2, mit `calendar` und `economy`) steht in Abschnitt 15.2, das Savegame in 15.8. Die Skizze zeigt den langfristigen Plan.

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
Nur JSON-Daten und stabile IDs. Nicht im Zustand: Warenkorb, Altersbestätigung, offene Panels, Bestellentwurf. Anfangswerte: Tag 1, 06:00, Tempo 1×, nicht pausiert, Phase `open`, 30.000 Cent, leere Bestände, keine Lieferung, leere Tagessummen, kein Bericht, `nextTransactionId` 1.

Phasen: `open` = Uhr läuft (sofern nicht pausiert); `awaiting_close` = 22:00 erreicht, die Uhr steht und wartet auf `economy.closeDay()`; `closed` = Tag abgeschlossen, wartet auf `calendar.startNextDay()`.

### 15.3 Balancing (`src/game/balance.ts`)
| Konstante | Wert | Bedeutung |
|---|---|---|
| `START_CASH_CENTS` | 30000 | Startkapital 300,00 € |
| `DAY_START_MINUTE` / `DAY_END_MINUTE` | 360 / 1320 | 06:00 / 22:00 |
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

Weitere Ablehnungsgründe der Fassade: `player.setPose` → `invalid_pose`; `interact` → `nothing_in_range`; `load` → `region_mismatch`. Pause sperrt weder Bestellung noch Verkauf noch Einräumen. `restock`, `unstock` und Verkauf hängen nicht von der Position der Figur ab; die Oberfläche kann sie überall auslösen.

`interact()` an einem Punkt vom Typ `register` oder `storage` ändert keinen Zustand und sendet `interaction.triggered`; an Tür und Klappe schaltet es wie bisher. `AvailableInteraction.action` kennt zusätzlich `register.use` und `storage.use`.

Lesende Hilfen (`selectors.ts`, ohne Veränderung): `findProduct`, `findSlot`, `storageQuantity`, `storageUnits`, `pendingUnits`, `freeStorageUnits`, `shelfQuantity`, `slotCapacityFor`, `slotsAccepting`, `cartNeedsAgeCheck`, `cartMinimumAge`, `cartTotalCents`, `orderTotalCents`.

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
`economy.completeSale` kennt weder UI noch Spielerposition: Es nimmt Produktzeilen und das Flag `ageCheckConfirmed` und bucht Bestand, Kasse, Tagesumsatz und Transaktion. Ein späterer NPC-Kunde könnte dieselbe Domäne aufrufen, statt Regeln nachzubauen; die Altersschranke und die Prüfung von Bestand, Phase und Klappe gelten dann gleich. Offen bleibt, wer die Altersprüfung für einen NPC bestätigt und ob `sale.completed` um einen `npcId` erweitert wird; beides ist Sache von Phase 4. Eine Preisänderung (`economy.setPrice`) gibt es nicht; sie wäre eine Erweiterung von `EconomyState` mit Migration.
