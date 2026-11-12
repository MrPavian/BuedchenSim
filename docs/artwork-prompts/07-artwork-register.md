# 07 – Artwork-Register

Dieses Register ist die zentrale Liste für geplante und umgesetzte Artworks. Statuswerte: **Geplant**, **In Arbeit**, **Review**, **Freigegeben**, **Im Spiel integriert**.

**Lesart:** „In Arbeit" mit dem Zusatz *(Greybox)* heißt, dass nur eine einfache Platzhalterform im Spiel ist. „Im Spiel integriert" wird nur gesetzt, wenn Fabrik, Registrierung, Platzierung und Sichtprüfung in der laufenden Szene vorliegen. Das ist eine technische Aussage; eine gestalterische Freigabe („Freigegeben") erteilt der Projektinhaber.

| ID | Asset | Region | Priorität | Status |
|---|---|---|---|---|
| K-001 | Musterkiosk / Gebäude | Ruhrgebiet | P0 | Im Spiel integriert |
| K-001-A | Gebäudegrundkörper | Ruhrgebiet | P0 | Im Spiel integriert |
| K-001-B | Fassadenmaterial / Backstein | Ruhrgebiet | P0 | Im Spiel integriert |
| K-001-C | Markise | Ruhrgebiet | P0 | Im Spiel integriert |
| K-001-D | Verkaufsfenster | Ruhrgebiet | P0 | Im Spiel integriert |
| K-001-E | Eingangstür | Ruhrgebiet | P0 | Im Spiel integriert |
| K-001-F | Dach / Attika | Ruhrgebiet | P0 | Im Spiel integriert |
| K-001-G | Fiktive Beschilderung | Ruhrgebiet | P0 | Im Spiel integriert |
| K-001-H | Beleuchtung | Ruhrgebiet | P1 | Im Spiel integriert |
| I-001 | Verkaufstheke | Ruhrgebiet | P0 | Im Spiel integriert |
| I-002 | Kasse / POS | Ruhrgebiet | P0 | Im Spiel integriert |
| I-003 | Wandregal | Ruhrgebiet | P0 | Im Spiel integriert |
| I-004 | Mittelregal | Ruhrgebiet | P1 | Im Spiel integriert |
| I-005 | Getränkekühlschrank | Ruhrgebiet | P0 | Im Spiel integriert |
| I-006 | Eistruhe | Ruhrgebiet | P1 | Im Spiel integriert |
| I-007 | Zeitschriftenständer | Ruhrgebiet | P1 | Im Spiel integriert |
| I-008 | Produktdisplay | Ruhrgebiet | P1 | Geplant |
| I-009 | Fiktives Service-Terminal | Ruhrgebiet | P2 | Geplant |
| I-010 | Hocker | Ruhrgebiet | P2 | Geplant |
| I-011 | Lagerregal | Ruhrgebiet | P1 | Im Spiel integriert |
| I-012 | Leergut-/Kistenbereich | Ruhrgebiet | P1 | Im Spiel integriert |
| P-001 bis P-030 | Erste Produktserie | Ruhrgebiet | P0 | Geplant |
| E-001 | Gehweg / Bordstein | Ruhrgebiet | P0 | In Arbeit (Greybox) |
| E-002 | Straßenbelag | Ruhrgebiet | P0 | In Arbeit (Greybox) |
| E-003 | Laterne | Ruhrgebiet | P1 | Geplant |
| E-004 | Bank | Ruhrgebiet | P2 | Geplant |
| E-005 | Mülleimer | Ruhrgebiet | P1 | Geplant |
| E-006 | Fahrrad | Ruhrgebiet | P1 | Geplant |
| E-007 | Baum / Pflanzkübel | Ruhrgebiet | P2 | Geplant |
| N-001 | Kioskbetreiber | Ruhrgebiet | P0 | Geplant |
| N-002 | Stammkunde | Ruhrgebiet | P1 | Geplant |
| N-003 | Handwerker | Ruhrgebiet | P1 | Geplant |
| N-004 | Schülergruppe | Ruhrgebiet | P2 | Geplant |
| N-005 | Fiktiver Fußballfan | Ruhrgebiet | P2 | Geplant |
| N-006 | Fahrradkurier | Ruhrgebiet | P2 | Geplant |
| N-007 | Nachbarin | Ruhrgebiet | P2 | Geplant |

## Änderungsprotokoll
Bei jeder neuen oder geänderten Asset-Version Datum, Änderung, verantwortliche Person und betroffene Dateien ergänzen. Ein Asset erst auf „Freigegeben“ setzen, wenn es die Qualitätskriterien aus der Art Direction erfüllt.

| Datum | Änderung | Verantwortlich | Dateien |
|---|---|---|---|
| 2026-11-11 | Greybox-Fassungen für K-001 (inkl. K-001-A), I-001, I-003, E-001 (mit Bordstein) und E-002 im Spiel; Status „In Arbeit", da noch keine ausgearbeiteten Assets | Claude Code (Auftrag 01) | `src/world/assets/kioskK001.ts`, `furniture.ts`, `ground.ts`, `registry.ts` |
| 2026-11-12 | K-001 mit Teilen A–H ausgearbeitet (Backstein-/Putzfassade, Dach mit Attika, Markise, Verkaufsfenster mit Klappe, Tür, Leuchtschild, Außen- und Innenlicht) | Claude Code (Auftrag 02) | `src/world/assets/kiosk/*` |
| 2026-11-12 | I-001, I-002, I-003, I-004, I-005, I-006, I-007, I-011, I-012 als eigene Fabriken, über die Platzierungsliste aufgestellt; Regale, Kühlschrank und Eistruhe bewusst leer | Claude Code (Auftrag 02) | `src/world/assets/furniture/*`, `src/content/assets/catalog.ts`, `src/content/regions/ruhrgebiet/layout.ts` |
| 2026-11-12 | E-001, E-002 unverändert einfache Flächen; als Greybox gekennzeichnet | Claude Code (Auftrag 02) | `src/world/assets/ground.ts` |
