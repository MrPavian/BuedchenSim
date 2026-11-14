# Bestandsaufnahme Auftrag 04.6 – Bewohnerfiguren und Charakterpipeline

**Datum:** 2026-11-14 · **Branch:** `claude/elegant-curie-17qulu` · Auftrag: [04.6](auftraege/04-6-bewohnerfiguren-und-charakterpipeline.md)

Grundlage: Code und Dateien im Repository nach Commit `6b00b19`, nicht frühere Berichte. Geprüft durch Lesen des Codes, Neuaufbau von Günters GLB mit dem Skript und Ansicht im Figurenbetrachter und im Spiel.

## 1. Tatsächlicher Figuren- und Pipeline-Stand
| Bewohner | Asset-ID | Darstellung im Spiel | Quelle |
|---|---|---|---|
| Günter Wollny, 71, früher Stellwerker | N-002 | GLB `public/models/residents/n-002.glb` (28.902 Dreiecke, 9 Primitive, 53 Knochen, 1,47 MB, WebP-Texturen) | `tools/characters/build_mh_resident.py` aus CC0-MakeHuman-Daten |
| Derya Aksoy, 38, Tischlerin | N-003 | prozedural (`src/world/assets/residents/derya.ts`) | Bauteilkit aus Auftrag 04 |
| Jonas Pietrek, 17, Fahrradkurier | N-006 | prozedural (`jonas.ts`) | dto. |
| Marlene Hoffmann, 58, Schulsekretärin | N-007 | prozedural (`marlene.ts`) | dto. |

**Pipeline:** MakeHuman-Daten (MPFB 2.0.18 `data/`, `makehuman_system_assets_cc0`) → Blender 5.3 als Python-Modul (`bpy`, ohne Oberfläche) → GLB. Das Skript liest nur Daten: Grundmesh, Makro- und Detailziele, `game_engine`-Rig mit Gewichten, Kleidung und Haare über `.mhclo`, Texturen über `.mhmat`. Mütze und Stock entstehen im Skript. Export als GLB mit WebP-Texturen und drei Clips (`idle`, `walk`, `talk`).

**Laufzeit:** `RESIDENT_MODELS` in `src/world/assets/residents/glbResident.ts` ordnet Asset-ID → Datei und `walkSpeed` zu. `residentView` lädt die Dateien nach dem Start (`GLTFLoader`, einmal je URL), klont das Skelett je Bewohner (`SkeletonUtils.clone`), mischt die Clips mit einem `AnimationMixer` und tauscht die prozedurale Figur aus. Bis zum Laden, bei Ladefehlern (Warnung im Log) und in Node-Tests bleibt die prozedurale Figur. Die Schnittstelle `ResidentFigure` ist unverändert. Tests: `glbResident.test.ts` (Registrierung, Höhe, Klon, Clip-Wechsel), `residents.test.ts` (prozedurale Figuren).

**Werkzeuge:** `tools/character-viewer/` (Vite-Seite mit Renderer und Licht des Spiels, Parameter `model`, `view`, `clip`, `time`, `face`), `scripts/visual-shots.mjs` (Referenzansichten mit Messwerten).

## 2. Wiederverwendbar
- Das ganze Skript: Makro- und Detailziele, Rig, Gewichte, `.mhclo`-Anpassung, Gewichtsübertragung, Texturbearbeitung (`recolor`), Alpha-Masken, Export. Für weitere Figuren werden nur Spezifikationen (Regler, Kleidung, Farben, Requisiten, Haltung) ergänzt.
- Mütze aus der abgetasteten Kopfoberfläche: dasselbe Verfahren trägt Jonas' Helm.
- Laufzeit: `RESIDENT_MODELS`, Lader, Klon, Clip-Mischung, Fallback; weitere Figuren sind ein Eintrag in der Registry.
- Kleidung im Asset-Pack (CC0): `male_casualsuit01` (Hemd + Hose, getrennte Texturbereiche), `female_elegantsuit01` (Bluse + Rock), Schuhe `shoes03` (Stiefel), `shoes04` (Halbschuhe), `shoes05` (Turnschuhe), Haare `ponytail01`, `bob02`, `short04` u. a., Häute `young_*`, `middleage_*`, `old_*`. Nicht nutzbar: `male_casualsuit02/04`, `female_casualsuit01/02` (Projektlogo auf dem T-Shirt).
- Mimik: `targets/expression/units/caucasian/` enthält Ausdruckseinheiten (Brauen heben/senken, Augen schließen/verengen, Mundwinkel ziehen, Mund pressen, Lippen öffnen u. a.). Daraus lassen sich wenige dezente Ausdrücke als Morph Targets bauen; Blender exportiert Shape Keys als glTF-Morph-Targets (dünn besetzt), Three.js unterstützt Morph Targets an Skinned Meshes.

## 3. Abweichungen zwischen Dokumentation und Code
- Die MakeHuman-Datenordner lagen nur in der Arbeitsumgebung, ein Neuaufbau war für andere nicht ohne Weiteres möglich. Behoben mit `tools/characters/fetch_mh_data.sh` (Download mit SHA-256-Prüfung, entpackt nur die Datenordner).
- `walkSpeed` steht doppelt: in den Inhaltsdaten (`NpcDef.walkSpeed`, Günter 0,9 m/s) und in `RESIDENT_MODELS` (0,9). Für die neuen Figuren wird der Wert aus den Inhaltsdaten übernommen (Derya 1,4, Jonas 1,6, Marlene 1,2); die Doppelung bleibt, weil der Clip-Takt eine Eigenschaft der Datei ist.
- `headHeight` (Höhe für Sprechblase und Blickziel) wird für GLB-Figuren pauschal als Höhe − 0,13 m geschätzt; bei Mütze und Helm liegt der Kopf etwas tiefer. Bei den neuen Figuren prüfen.
- `VISUAL-BASELINE.md` 8.5 nennt für Günter noch abstehende Hände, rote Punkte neben der Nase und Zacken am Schirm: im Code bestätigt, Gegenstand von 4.6.1.
- Die prozeduralen Figuren haben eine festgelegte, in Auftrag 04 dokumentierte Erscheinung (Farben und Merkmale in den Kommentaren von `derya.ts`, `jonas.ts`, `marlene.ts`). Sie ist im Spiel und in Screenshots eingeführt und wird für die GLB-Figuren übernommen.

## 4. Abgeleitete Figurenparameter
Aus `src/content/regions/ruhrgebiet/residents.ts` (Alter, Rolle, Beschreibung) und den bisherigen Figuren. MakeHuman-Alter: 0,5 = 25 Jahre, 1,0 = 90 Jahre, 0,1875 = 11 Jahre.

| Figur | Inhaltsdaten | Körper (MakeHuman) | Kleidung und Merkmale |
|---|---|---|---|
| Günter (N-002) | 71, Schiebermütze, Gehstock, Knie | bleibt (Alter 0,86, leicht gebeugt) | bleibt; Hände näher am Körper, rechte Hand am Stock |
| Derya (N-003) | 38, Tischlerin; „Arbeitshose, Werkzeuggürtel, Sägespäne an den Ärmeln“; praktisch, direkt | weiblich, Alter 0,60, kräftig (Muskeln 0,65), 1,73 m, breite Schultern | senfgelbes Arbeitshemd, braune Arbeitshose, Werkzeuggürtel mit Tasche, braune Arbeitsstiefel, dunkles Haar zum Zopf; fester, breiter Stand, zügiger Gang |
| Jonas (N-006) | 17, Fahrradkurier; „Fahrradhelm, Kuriertasche, Jacke“; flink, neugierig | männlich, Alter 0,32 (≈ 17 Jahre, jugendliche Proportionen aus den MakeHuman-Zielen, kein verkleinerter Erwachsener), schlank, 1,82 m | limettengrüner Helm, dunkelgraue Jacke, hellgraue Hose, weiße Turnschuhe, petrolfarbene Kuriertasche mit Gurt; leicht vorgebeugt, lange schnelle Schritte |
| Marlene (N-007) | 58, Schulsekretärin; „Strickjacke, Einkaufstasche, aufrechter Gang“; warm, bestimmt | weiblich, Alter 0,75, etwas fülliger, 1,63 m | pflaumenfarbenes Oberteil, kamelfarbener Rock, dunkle Strumpfhose, Halbschuhe, kurzes silberblondes Haar, rote Brille, mintgrüne Einkaufstasche; aufrecht |

## 5. Risiken und Abhängigkeiten
- **Kleidung für die andere Körperform:** Die Kleidung im Pack ist teils für männliche Körper gemacht (Hemd und Hose für Derya). Die Anpassung über `.mhclo` folgt dem Körper, an der Brust kann es eng werden oder durchstoßen. Prüfen in Nah- und Seitenansicht.
- **Jugendliche Figur:** Jonas muss klar als 17-Jähriger wirken. Alter über den MakeHuman-Regler, nicht über Skalierung; Sichtprüfung im Vergleich mit den Erwachsenen.
- **Dateigröße durch Mimik:** Morph Targets vergrößern die Datei. Nur wenige Ausdrücke, nur Kopf-Vertices, dünn besetzte Accessoren; Budget 2 MB je Datei.
- **Bauzeit und Daten:** Python 3.13, `bpy` 5.3, rund 330 MB Daten (nur zum Erzeugen, nicht für Build und Tests).
- **Gleichzeitige Ladevorgänge:** Vier Dateien (je etwa 1,5 MB) laden parallel nach dem Start; bis dahin prozedurale Figuren.
- **Browserprüfung:** Sie prüft Bewohner über den Spielzustand und Sichtbarkeit; die GLB-Figuren dürfen deren Annahmen (Sichtbarkeit, Kopfhöhe) nicht brechen.

## 6. Umsetzungsreihenfolge
1. Bestandsaufnahme, Download-Skript (dieser Schritt).
2. Skript auf Figurenspezifikationen umstellen, Günter korrigieren (Arme und Hände, Hautpunkte, Schirmkanten), Mimik-Prototyp an Günter (Morph Targets `neutral`, `friendly`, `thoughtful`, Laufzeit-Überblendung beim Sprechen).
3. Derya bauen, integrieren, prüfen.
4. Jonas bauen, integrieren, prüfen.
5. Marlene bauen, integrieren, prüfen.
6. Alle vier gemeinsam abstimmen, messen, Regression (Typecheck, Lint, Tests, Build, vollständige Browserprüfung nach der letzten Änderung).
7. Dokumentation, Screenshots, Abschlussbericht.
