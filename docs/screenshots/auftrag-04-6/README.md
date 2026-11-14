# Screenshots Auftrag 04.6 – Bewohnerfiguren

**Kontext:** BuedchenSim ist ein Kiosk-Simulator im Ruhrgebiet (Three.js, Browser). Auftrag 04.6 stellt alle vier wiederkehrenden Bewohner auf GLB-Figuren aus frei lizenzierten MakeHuman-Daten (CC0) um. Alle Namen, Personen, Marken und Produkte sind erfunden.

**Renderer:** Headless Chromium mit SwiftShader (Software-Rendering). **Keine Aufnahmen echter Grafikhardware, keine Render-Mockups.**

Zwei Quellen:
- **Figurenbetrachter** `tools/character-viewer/` (Vite-Seite im Repository): lädt die GLB-Datei mit dem Renderer, Tone Mapping und Licht des Spiels (`LIGHT`), ohne Spielwelt. Parameter: `view` (close, side), `clip`, `time` (Sekunde im Clip), `face=1` (Kopf), `expr` (Morph-Target-Gewichte). 900 × 900 bzw. 900 × 1100 Pixel, Gerätefaktor 1.
- **Spiel** `node scripts/visual-shots.mjs --out docs/screenshots/auftrag-04-6/spiel --only aussen,bewohner,gespraech --scale 2`: laufende Anwendung, fester Spielstand über den Debug-Zugang (Uhr angehalten), normale Spielkamera, 1280 × 720 CSS-Pixel bei Gerätefaktor 2. Messwerte in `spiel/metrics.json`.

| Datei | Figur | Perspektive | Clip / Zustand |
|---|---|---|---|
| `<figur>-gesicht.png` | Günter, Derya, Jonas, Marlene | Betrachter, Kopf frontal | `idle`, 0 s, neutral |
| `<figur>-ganz.png` | alle vier | Betrachter, Ganzkörper frontal | `idle`, 0 s |
| `<figur>-gehen.png` | alle vier | Betrachter, Profil | `walk`, 0,25 s |
| `<figur>-sprechen.png` | alle vier | Betrachter, Ganzkörper frontal | `talk`, 1,2 s, Ausdruck `friendly` = 1 |
| `<figur>-spielkamera.png` | alle vier | Ausschnitt aus `spiel/bewohner.png` (vierfach vergrößert) | Spiel, `idle` |
| `spiel/bewohner.png` | alle vier gemeinsam | Spielkamera, Hofbank und Gehweg | Do, Tag 4, 16:50, Flag `yard.bench` |
| `spiel/aussen.png` | Günter, Marlene, Jonas | Spielkamera, Gehweg vor dem Verkaufsfenster | Di, Tag 2, 14:38 |
| `spiel/gespraech.png` | Günter | Spielkamera, Spieler am Verkaufsfenster nach Taste E | Dialog „erstes Mal“; das Dialogfenster verdeckt die Figur, die Mimik zeigen die Betrachterbilder |
| `guenter-vorher-*.png` | Günter | Betrachter, Stand nach Auftrag 04.5 | `vorne`, `gesicht`, `seite` (gehen) |
| `guenter-nachher-*.png` | Günter | Betrachter, Stand nach 04.6 | dieselben Ansichten: Arme näher am Körper, rechte Hand am Stock mit Griff, linke Hand neben dem Oberschenkel, keine roten Punkte neben der Nase, saubere Schirmkanten |
| `guenter-mimik-freundlich.png`, `guenter-mimik-nachdenklich.png` | Günter | Betrachter, Kopf | `talk`, 1,2 s, Ausdruck `friendly` bzw. `thoughtful` = 1 |

**Hinweise:** Die Spielszenen zeigen die Figuren klein (Spielkamera aus 9 m Höhe); Gesichtsausdrücke sind dort nicht erkennbar. Bildzeiten im Software-Rendering sind nicht aussagekräftig.
