# Technischer Ist-Stand

**Stand:** 2026-11-11 · Commit `61d2146` · Ergebnis von [Auftrag 00](auftraege/00-bestandsaufnahme-und-architektur.md)

Dieses Dokument enthält nur geprüfte Fakten. Vorschläge stehen in [ARCHITEKTUR-ENTSCHEIDUNGEN.md](ARCHITEKTUR-ENTSCHEIDUNGEN.md) und [MODUL-UND-DATENVERTRAEGE.md](MODUL-UND-DATENVERTRAEGE.md).

## 1. Kernaussage
**Das Repository enthält keinen Spielcode.** Es besteht ausschließlich aus 14 Markdown-Dateien (ca. 59 KB) in 20 Dokumentations-Commits. Es gibt keine Szene, keinen Renderer, keine Abhängigkeit und keinen Build. `main` und der Arbeitsbranch zeigen auf denselben Commit.

## 2. Vorhandene Dateien (vollständig)
```
CLAUDE.md
README.md
docs/ARCHITEKTUR-ZIELBILD.md
docs/IMPLEMENTIERUNGSPLAN.md
docs/auftraege/00-bestandsaufnahme-und-architektur.md
docs/artwork-prompts/README.md
docs/artwork-prompts/01-art-direction.md
docs/artwork-prompts/02-roadmap-und-artwork-katalog.md
docs/artwork-prompts/03-regionen-und-welten.md
docs/artwork-prompts/04-marken-und-produktwelt.md
docs/artwork-prompts/05-claude-prompts.md
docs/artwork-prompts/06-threejs-asset-standard.md
docs/artwork-prompts/07-artwork-register.md
docs/artwork-prompts/08-das-viertel-lebt.md
```

## 3. Prüfpunkte aus Arbeitsschritt A
| Prüfpunkt | Befund |
|---|---|
| `package.json`, Scripts | nicht vorhanden |
| Three.js und sonstige Abhängigkeiten | nicht vorhanden, keine Lockfile |
| Einstiegspunkt / Bootstrap (`index.html`, `main.*`) | nicht vorhanden |
| Szene, Renderer, Kamera, Controls, Licht | nicht vorhanden |
| UI und Interaktionssystem | nicht vorhanden |
| Asset-Pipeline, 3D-Dateien, Texturen, Audio | nicht vorhanden, keine Binärdateien |
| Datenhaltung, Savegames | nicht vorhanden |
| Tests, Linting, Formatierung | nicht vorhanden |
| Build, CI, Deployment (`.github/` o. Ä.) | nicht vorhanden |
| Gameplay-Systeme | nicht vorhanden |
| TODO-/FIXME-Marker | keine (nur das Wort „TODOs" in zwei Auftragstexten) |
| `.gitignore`, Lizenzdatei | nicht vorhanden |

## 4. Was die Dokumentation festlegt
- **Technik:** Three.js, 1 Unit = 1 Meter als Planungsannahme, GLB/glTF bevorzugt für externe Assets, keine unnötigen Libraries.
- **Spielvision:** drei gleichwertige Säulen – Wirtschaft, Gemeinschaft, Viertelleben.
- **Erster Vertical Slice:** Ruhrgebiets-Büdchen (Startmaß ca. 6 × 4 × 3,2 m), Innenausstattung I-001 bis I-012, 20–30 fiktive Waren, 3–5 wiederkehrende NPCs, zwei Quest-Ketten, ein Event, eine Kiosk-Spezialität.
- **Architektur-Zielbild:** Module Core, 3D World, Gameplay-Domänen, UI, Data/Persistence, Audio; datengetriebene Inhalte; versionierte Savegames; Regionen als Pakete.
- **Markenregel:** ausschließlich fiktive Marken, Vereine und Grafiken.

## 5. Was die Dokumentation nicht festlegt
Diese Lücken wurden in der Analyse gefunden und sind als offene Entscheidungen in den ADRs geführt:
- Spielperspektive und Steuerung (nur „mittlere Spielkamera" und „begehbar")
- Zielplattform (Desktop, Mobil, Touch)
- Zeitmodell (Tageslänge, Echtzeit oder Phasen, Pause)
- Sprache/Build-Werkzeuge (TypeScript oder JavaScript, Bundler)
- Herkunft der 3D-Assets (prozedural oder extern modelliert)
- Verkaufbarkeit von Alkohol und Tabak im Spiel
- Hosting, Lizenz

## 6. Unstimmigkeiten in der bestehenden Dokumentation
- Viele Formulierungen setzen vorhandenen Code voraus („bestehende Szene", „vorhandene Architektur respektieren"). Dieser existiert nicht; die Regel „bestehende Konventionen haben Vorrang" greift erst ab dem ersten Code.
- Der Katalog (`02`) nennt zehn NPC-Typen, das Register (`07`) führt nur N-001 bis N-007. Lieferant, Nachtkunde und Vierteloriginal fehlen.
- Fahrradständer, Hausfassaden, Fenster/Türen der Nachbarhäuser und Schilder stehen im Katalog, haben aber keine Register-ID.
- P-001 bis P-030 sind ein Sammeleintrag; einzelne Produkte sind noch nicht definiert.
- Quests, Events und die Kiosk-Spezialität haben bisher kein ID-Schema (Vorschlag in den Datenverträgen).

Diese Punkte werden nicht jetzt, sondern beim Anlegen der jeweiligen Inhalte im Register bereinigt (Phase 3 und 4).

## 7. Umgebung, in der geprüft wurde
| Werkzeug | Version |
|---|---|
| Node.js | 22.23.4 |
| npm | 10.9.9 |

Aktuelle Registry-Versionen am Prüftag (nicht installiert, nur abgefragt): `three` 0.187.0, `vite` 8.3.8, `typescript` 7.0.2, `vitest` 5.1.0.

## 8. Ausgeführte Befehle
| Befehl | Ergebnis |
|---|---|
| `git ls-files`, `find` | 14 Markdown-Dateien, sonst nichts |
| `git log --oneline` | 20 Commits, alle `docs:` |
| `git rev-parse HEAD origin/main` | identisch (`61d2146`) |
| `grep -rniE "TODO\|FIXME"` | keine echten Marker |
| `node -v`, `npm -v`, `npm view <paket> version` | siehe Abschnitt 7 |

Build-, Lint- und Testbefehle wurden nicht ausgeführt, weil es keine gibt.

## 9. Ist-/Soll-Abgleich
| Zielsystem | Status | Bemerkung |
|---|---|---|
| Core / Game Runtime | nicht vorhanden | Fundament für Phase 1 |
| Three.js World | nicht vorhanden | Fundament für Phase 1; Perspektive noch zu entscheiden |
| Kiosk und Einrichtung | nicht vorhanden | nur Asset-IDs und Startmaße dokumentiert |
| Produkte, Inventar, Warenwirtschaft | nicht vorhanden | Datenfeld-Vorschlag in `04`; Alkohol/Tabak noch zu entscheiden |
| Finanzen, Kasse, Tagesabschluss | nicht vorhanden | – |
| NPCs, Routinen, Beziehungen | nicht vorhanden | Konzept in `08` |
| Dialoge, Quests, Geschichten | nicht vorhanden | Konzept in `08` |
| Kalender, Wetter, Events | nicht vorhanden | Zeitmodell noch zu entscheiden |
| Rezepte und Kiosk-Traditionen | nicht vorhanden | Konzept in `08` |
| UI | nicht vorhanden | – |
| Savegames und Datenmigration | nicht vorhanden | Anforderungen im Zielbild |
| Audio | nicht vorhanden | laut Plan erst Phase 6 |
| Regionale Content-Pakete | nicht vorhanden | nur Ruhrgebiet für den Slice geplant |

Kein System ist „vorhanden" oder „teilweise vorhanden". Konzeptuell beschrieben sind alle.
