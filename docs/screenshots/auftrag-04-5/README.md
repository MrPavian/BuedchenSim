# Screenshots Auftrag 04.5 – Visuelle Basis

**Kontext:** BuedchenSim ist ein Kiosk-Simulator im Ruhrgebiet (Three.js, Browser). Auftrag 04.5 legt die visuelle Basis fest: Licht, Tone Mapping, Farben und schlankere Geometrie. Die Bilder zeigen dieselben fünf Ansichten vor und nach den Änderungen. Alle Namen, Marken und Produkte sind erfunden.

**Entstehung:** `node scripts/visual-shots.mjs --out docs/screenshots/auftrag-04-5/<vorher|nachher>`. Das Skript startet die laufende Anwendung, setzt über den Debug-Zugang einen festen Spielstand (Uhr angehalten) und eine feste Spielerposition und nimmt die normale Spielkamera auf: 1280 × 720 CSS-Pixel bei Gerätefaktor 2 (Bild 2560 × 1440), die Detailansicht als Ausschnitt 640 × 360 CSS-Pixel. Renderer: Headless Chromium 153 mit SwiftShader (Software-Rendering). **Keine Aufnahmen echter Grafikhardware, keine Render-Mockups.** Die Messwerte je Ansicht stehen in `vorher/metrics.json` und `nachher/metrics.json` und sind in [VISUAL-BASELINE.md](../../VISUAL-BASELINE.md) ausgewertet.

`vorher/` entstand vor jeder Änderung von Auftrag 04.5, `nachher/` nach allen Änderungen; Spielzustände und Kamerapositionen sind identisch.

| Datei | Perspektive | Spielzustand | Einordnung |
|---|---|---|---|
| `aussen.png` | Spielkamera, Spieler auf dem Gehweg vor dem Verkaufsfenster | Di, Tag 2, 14:38; Klappe und Tür offen; Günter (graue Jacke, Mütze, Stock) am Fenster, Marlene (pflaumenfarbene Strickjacke) und Jonas (grüner Helm, Kuriertasche) am Eck | Fassade, Schild, Markise, Fenster, Eingang, Gehweg; nachher mit deutlicherem Sonnenschatten, wärmerer Fassade, frischerer Wiese |
| `innen.png` | Spielkamera, Spieler im Gang des Kiosks (Dach und Südwand ausgeblendet) | alle 67 Warenplätze bis zur Kapazität gefüllt (1.573 Einheiten) | Innenraum mit Theke, Regalen, Kühlschrank, Truhe, Zeitschriftenständer; nachher mit 57 % weniger Dreiecken bei gleichem Bestand |
| `regale.png` | Spielkamera, Spieler vor dem Mittelregal | wie `innen` | bestückte Regale aus der typischen Arbeitsposition |
| `bewohner.png` | Spielkamera, Spieler auf dem Gehweg westlich des Kiosks | Do, Tag 4, 16:50; Flag `yard.bench` (Hofbank aus Geschichte A); Günter, Marlene und Derya (senfgelbes Hemd) an der Bank, Jonas auf dem Gehweg | Bewohner im Viertel; nachher mit Schatten unter den Figuren und weniger Draw Calls je Figur |
| `detail.png` | Ausschnitt der Außenansicht ohne Bewohner | wie `aussen` | Materialqualität: Klinker mit Fugen, Putzband, Schild, Markise, Fensterbank, Tür |
