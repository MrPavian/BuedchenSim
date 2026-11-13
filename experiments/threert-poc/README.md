# ThreeRT – Proof of Concept

Separater Versuch, **nicht Teil des Spiels**. Nichts unter `src/` wird geändert; die Spielprüfungen (`npm run lint`,
`typecheck`, `test`) schließen diesen Ordner aus. Ergebnisse und Empfehlung: [docs/THREERT-POC.md](../../docs/THREERT-POC.md).

| Datei | Zweck |
|---|---|
| `capture/index.html`, `capture/capture.ts` | startet das unveränderte Spiel, greift die Three.js-Szene über `Scene.onBeforeRender` ab und exportiert sie als GLB mit PBR-Materialien |
| `vite.config.mjs` | Vite-Konfiguration nur für die Abgriffsseite (eine gemeinsame Three.js-Instanz) |
| `export-scene.mjs` | Playwright: Spiel starten, Regale über die Spielaktionen füllen, GLBs, Szeneninfo und Three.js-Vergleichsbilder schreiben |
| `threert/kiosk-scene.ts` | ThreeRT-Szene: unser GLB, Sonne in Lux, Himmel, Lampen in Candela, Testobjekte (Glas, Spiegel, Leuchtfläche), Kamerafahrt |
| `run-threert.mjs` | bündelt die Szene mit ThreeRTs Bundler und rendert sie mit `threert-render` (Standbilder und Echtzeit-Bilder bei bewegter Kamera) |
| `web-probe.mjs` | öffnet einen ThreeRT-Web-Build (WebAssembly + WebGPU) in Chromium und misst ihn |

## Ablauf

Voraussetzung: ein gebautes ThreeRT (`git clone https://github.com/meshy-dev/ThreeRT`, Rust 1.100, `npm install`,
`cargo build --release` in `renderer/`). Ohne Grafikkarte geht es mit Mesas Software-Vulkan (`mesa-vulkan-drivers`,
`VK_ICD_FILENAMES=/usr/share/vulkan/icd.d/lvp_icd.json`) – dann sind alle Zeiten CPU-Zeiten.

```bash
node experiments/threert-poc/export-scene.mjs
```

```bash
THREERT_DIR=/pfad/zu/ThreeRT node experiments/threert-poc/run-threert.mjs --spp 16 --live 10
```

Web-Build (braucht `wasm-bindgen-cli` 0.2.130):

```bash
node /pfad/zu/ThreeRT/tools/build-web.ts experiments/threert-poc/out/gen/orbit.ts -o /tmp/threert-web
```

```bash
cp experiments/threert-poc/out/kiosk-outside.glb /tmp/threert-web/ && node experiments/threert-poc/web-probe.mjs /tmp/threert-web --provide kiosk-outside.glb --frames 12
```
