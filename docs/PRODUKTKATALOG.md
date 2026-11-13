# Produktkatalog (Auftrag 03)

**Stand:** 2026-11-13 · erzeugt aus den tatsächlichen Inhaltsdaten (`src/content/regions/ruhrgebiet/products.ts`, `slots.ts`, `src/content/assets/productAssets.ts`), nicht von Hand abgetippt. Die Tabellen wurden mit einem Wegwerf-Skript aus dem geladenen Inhaltspaket erzeugt; bei Änderungen an den Daten sind sie neu zu erzeugen. Verträge: [MODUL-UND-DATENVERTRAEGE.md, Abschnitt 15](MODUL-UND-DATENVERTRAEGE.md); Stand und Prüfergebnisse: [TECHNISCHER-IST-STAND.md](TECHNISCHER-IST-STAND.md); Asset-Status: [Artwork-Register](artwork-prompts/07-artwork-register.md).

**Marken:** Alle Marken, Produkte und Etiketten sind frei erfunden. Die Namen (Ruhrbrause, Zechenblitz, Püttbräu, Naschwerk, Eiskumpel, Pottbäcker, Halden-Verlag, Knobelschacht, Abstoß, Pottsoft, Funkenflug, Flammwerk, Zechenhof, Großhandel Emscher) sind **Arbeitstitel und rechtlich nicht geprüft**; vor einer Veröffentlichung ist eine Markenrecherche nötig. Alkohol und Tabak sind neutral und sachlich dargestellt (schlichte Etiketten ohne Werbeflächen).

**Regeln der Daten:** Alle Preise sind ganze Cent im Code; hier in Euro. Einkaufspreis ist überall kleiner als Verkaufspreis. Das Mindestalter (`minimumAge`, 16 für Bier, 18 für Tabakwaren) ist die einzige Quelle der Altersschranke. Eine Asset-ID `P-0xx` gehört genau einem Produkt; Produkte mit gleicher Verpackungsart teilen sich die Modellfabrik der Verpackung, Etikett, Farben, Beschriftung und Maße unterscheiden sie. Die Maße beziehen sich auf **eine** Einheit. „Stapel“ ist die maximale Zahl übereinanderliegender Lagen (Standard der Verpackung, bei Schachteln, Heften und Tabakwaren per `maxStack` überschrieben). Verkauft wird zum vorgeschlagenen Verkaufspreis; der Spieler kann Preise in dieser Phase nicht ändern.

## 1. Produkte (28)

| Asset-ID | Produkt-ID | Name | Marke | Kategorie | Einkauf (€) | Verkauf (€) | Lagerart | Mindestalter | Verpackung (Fabrik) | Maße B×T×H (cm) | Stapel |
|---|---|---|---|---|---:|---:|---|---|---|---|---:|
| P-001 | `product.ruhrbrause-wasser-still` | Ruhrbrause Wasser still 0,5 l | Ruhrbrause | Getränke | 0,30 | 0,80 | Regal | – | PET-Flasche (`pet-bottle`) | 6,5 × 6,5 × 21 | 1 |
| P-002 | `product.ruhrbrause-zitronenlimo` | Ruhrbrause Zitronenlimo 0,5 l | Ruhrbrause | Getränke | 0,45 | 1,20 | Kühlung | – | PET-Flasche (`pet-bottle`) | 6,6 × 6,6 × 20,5 | 1 |
| P-003 | `product.ruhrbrause-brause-klassik` | Ruhrbrause Brause Klassik 0,33 l | Ruhrbrause | Getränke | 0,60 | 1,50 | Kühlung | – | Glasflasche (`glass-bottle`) | 6,5 × 6,5 × 23 | 1 |
| P-004 | `product.zechenblitz-energy` | Zechenblitz Energy 0,25 l | Zechenblitz | Getränke | 0,75 | 1,90 | Kühlung | – | Dose (`can`) | 5,3 × 5,3 × 13,5 | 2 |
| P-005 | `product.ruhrbrause-apfelschorle` | Ruhrbrause Apfelschorle 0,33 l | Ruhrbrause | Getränke | 0,50 | 1,30 | Kühlung | – | Glasflasche (`glass-bottle`) | 6,5 × 6,5 × 21,5 | 1 |
| P-006 | `product.ruhrbrause-eistee-pfirsich` | Ruhrbrause Eistee Pfirsich 0,5 l | Ruhrbrause | Getränke | 0,55 | 1,40 | Kühlung | – | PET-Flasche (`pet-bottle`) | 6,8 × 6,8 × 21,5 | 1 |
| P-007 | `product.puettbraeu-pils` | Püttbräu Pils 0,33 l | Püttbräu | Getränke · Bier | 0,60 | 1,20 | Regal | ab 16 | Glasflasche (`glass-bottle`) | 6,5 × 6,5 × 23,5 | 1 |
| P-008 | `product.puettbraeu-schachtbier-dose` | Püttbräu Schachtbier Dose 0,5 l | Püttbräu | Getränke · Bier | 0,75 | 1,50 | Kühlung | ab 16 | Dose (`can`) | 6,8 × 6,8 × 16,8 | 2 |
| P-009 | `product.naschwerk-chips-paprika` | Naschwerk Chips Paprika 150 g | Naschwerk | Snacks | 1,05 | 1,99 | Regal | – | Beutel (`bag`) | 19 × 6 × 27 | 1 |
| P-010 | `product.naschwerk-erdnuesse` | Naschwerk Erdnüsse geröstet 200 g | Naschwerk | Snacks | 0,80 | 1,79 | Regal | – | Beutel (`bag`) | 15 × 5 × 22 | 1 |
| P-011 | `product.naschwerk-salzstangen` | Naschwerk Salzstangen 125 g | Naschwerk | Snacks | 0,55 | 1,19 | Regal | – | Beutel (`bag`) | 13 × 4 × 24 | 1 |
| P-012 | `product.naschwerk-vollmilch` | Naschwerk Vollmilchschokolade 100 g | Naschwerk | Süßwaren | 0,55 | 1,19 | Regal | – | Tafel (`bar`) | 16 × 7,5 × 1,2 | 3 |
| P-013 | `product.naschwerk-fruchtgummi` | Naschwerk Fruchtgummi Zechenbunt 200 g | Naschwerk | Süßwaren | 0,70 | 1,49 | Regal | – | Beutel (`bag`) | 14 × 4,5 × 20 | 1 |
| P-014 | `product.naschwerk-sahnebonbons` | Naschwerk Sahnebonbons 120 g | Naschwerk | Süßwaren | 0,70 | 1,49 | Regal | – | Schachtel (`box`) | 9 × 6 × 8 | 1 |
| P-015 | `product.naschwerk-kaugummi-minze` | Naschwerk Kaugummi Minze | Naschwerk | Süßwaren | 0,45 | 1,09 | Regal | – | Schachtel (`box`) | 6,5 × 6,5 × 8,5 | 1 |
| P-016 | `product.eiskumpel-stieleis-himbeere` | Eiskumpel Stieleis Himbeere | Eiskumpel | Eis | 0,55 | 1,20 | Tiefkühlung | – | Stieleis (`ice-stick`) | 5,5 × 4 × 18 | 1 |
| P-017 | `product.eiskumpel-waffelbecher` | Eiskumpel Waffelbecher Vanille | Eiskumpel | Eis | 0,70 | 1,80 | Tiefkühlung | – | Eisbecher (`ice-cup`) | 7 × 7 × 10 | 2 |
| P-018 | `product.eiskumpel-wassereis-brause` | Eiskumpel Wassereis Brause | Eiskumpel | Eis | 0,25 | 0,70 | Tiefkühlung | – | Stieleis (`ice-stick`) | 5 × 4 × 20 | 1 |
| P-019 | `product.pottbaecker-broetchen` | Pottbäcker Brötchen | Pottbäcker | Backwaren | 0,20 | 0,45 | Theke | – | Backware (`pastry`) | 11 × 8 × 6 | 1 |
| P-020 | `product.pottbaecker-streuselteilchen` | Pottbäcker Streuselteilchen | Pottbäcker | Backwaren | 0,70 | 1,60 | Theke | – | Backware (`pastry`) | 12 × 10 × 4 | 1 |
| P-021 | `product.halden-echo-lokalblatt` | Halden-Echo Lokalblatt | Halden-Verlag | Presse | 1,00 | 1,80 | Zeitschriftenständer | – | Heft (`magazine`) | 20 × 0,8 × 23 | 1 |
| P-022 | `product.knobelschacht-raetselheft` | Knobelschacht Rätselheft | Knobelschacht | Presse | 0,90 | 1,50 | Zeitschriftenständer | – | Heft (`magazine`) | 15 × 0,5 × 21 | 1 |
| P-023 | `product.abstoss-ligaheft` | Abstoß Ligaheft | Abstoß | Presse | 1,60 | 2,90 | Zeitschriftenständer | – | Heft (`magazine`) | 17 × 0,6 × 23 | 1 |
| P-024 | `product.pottsoft-taschentuecher` | Pottsoft Papiertaschentücher 10er | Pottsoft | Alltagsbedarf | 0,40 | 0,79 | Regal | – | Schachtel (`box`) | 9,5 × 4 × 12 | 1 |
| P-025 | `product.funkenflug-batterien-aa` | Funkenflug Batterien AA 4er | Funkenflug | Alltagsbedarf | 2,70 | 4,99 | Regal | – | Schachtel (`box`) | 9 × 3 × 14 | 1 |
| P-026 | `product.flammwerk-feuerzeug` | Flammwerk Einwegfeuerzeug 2er | Flammwerk | Alltagsbedarf | 0,55 | 1,29 | Regal | – | Schachtel (`box`) | 8,5 × 3 × 14 | 1 |
| P-027 | `product.zechenhof-filter-20` | Zechenhof Filter 20er | Zechenhof | Alltagsbedarf · Tabakwaren | 7,40 | 8,00 | Theke | ab 18 | Schachtel (`box`) | 5,5 × 2,2 × 8,8 | 1 |
| P-028 | `product.zechenhof-drehtabak-30` | Zechenhof Drehtabak 30 g | Zechenhof | Alltagsbedarf · Tabakwaren | 5,90 | 6,50 | Theke | ab 18 | Beutel (`bag`) | 12 × 3 × 9 | 1 |

Verteilung: Getränke 8 (davon Bier 2), Snacks 3, Süßwaren 4, Eis 3, Backwaren 2, Presse 3, Alltagsbedarf 5 (davon Tabakwaren 2). Lagerart: Regal 12, Kühlung 6, Tiefkühlung 3, Theke 4, Zeitschriftenständer 3. Asset-IDs `P-029` und `P-030` sind nicht vergeben.

## 2. Warenplätze je Möbel (67 Plätze)

Jeder Platz nimmt immer nur **ein** Produkt auf und akzeptiert genau eine Lagerart. Maße im lokalen Rahmen der Platzierung (Quelle: `slots.ts`).

| Platzierung | Asset | Rolle | Plätze | Akzeptiert | Platzmaß B × T × H (cm) | Anmerkung |
|---|---|---|---:|---|---|---|
| `placement.counter` | I-001 Verkaufstheke | Verkauf | 5 | Theke | 34 × 30 × 30 | Personalseite der Arbeitsplatte, vor der Kasse frei |
| `placement.wall-shelf-north` | I-003 Wandregal | Präsentation | 12 | Regal | 72–74 × 34 × 39 | vier nutzbare Böden × drei Fächer |
| `placement.wall-shelf-west` | I-003 Wandregal | Präsentation | 12 | Regal | 72–74 × 34 × 39 | wie oben |
| `placement.middle-shelf` | I-004 Mittelregal | Präsentation | 12 | Regal | 54 × 20 × 26 | drei Böden × zwei Hälften × zwei Seiten (Rückseite gespiegelt) |
| `placement.fridge` | I-005 Getränkekühlschrank | Kühlung | 10 | Kühlung | 28 × 43 × 29 | fünf Ebenen × zwei Spalten |
| `placement.freezer` | I-006 Eistruhe | Tiefkühlung | 4 | Tiefkühlung | 19–37,5 × 44–46 × 30 | Drahtkorb plus drei Fächer |
| `placement.magazine-rack` | I-007 Zeitschriftenständer | Präsentation | 12 | Zeitschriftenständer | 23 × 10 × 23,5 | vier geneigte Ablagen × drei Spalten |

Das Lagerregal `I-011` und die Leergutkisten `I-012` haben keine Warenplätze (Hinterlager ist ein einziger Zähler, siehe unten). Summe: 5 + 12 + 12 + 12 + 10 + 4 + 12 = 67. Nach Lagerart: Regal 36, Kühlung 10, Tiefkühlung 4, Theke 5, Zeitschriftenständer 12.

## 3. Kapazität

**Regel:** Die Kapazität eines Platzes für ein Produkt ist die Zahl der Einheiten, die `slotUnitPositions` (`src/game/stockLayout.ts`) im Platz überschneidungsfrei anordnet: Spalten × Reihen × Lagen aus Platzmaß, Einheitenmaß, 1 cm Abstand und Stapellimit. Die 3D-Darstellung zeichnet genau diese Positionen, Kapazität und sichtbare Ware sind also identisch. Die Kapazität ist nicht frei einstellbar.

**Hinterlager:** Das Lager ist ein einziger Zähler mit höchstens **400 Stück** (`STORAGE_CAPACITY_UNITS`), die offene Lieferung zählt mit. Es gibt keinen Platzbedarf je Produkt im Lager.

**Startkapital:** 300,00 € (`START_CASH_CENTS`).

Kapazität je Platz in Stück (Wandregal N/W jeweils 12 Plätze, Angaben „36/40“ = äußere Fächer / mittleres Fach; Eistruhe „45/27“ = Korb / Fächer):

| Asset-ID | Produkt | Lagerart | Plätze der Art | Kapazität je Platz (Stück) |
|---|---|---|---:|---|
| P-001 | Ruhrbrause Wasser still 0,5 l | Regal | 36 | Wandregal N 36/40 · Wandregal W 36/40 · Mittelregal 14 |
| P-002 | Ruhrbrause Zitronenlimo 0,5 l | Kühlung | 10 | Kühlschrank 15 |
| P-003 | Ruhrbrause Brause Klassik 0,33 l | Kühlung | 10 | Kühlschrank 15 |
| P-004 | Zechenblitz Energy 0,25 l | Kühlung | 10 | Kühlschrank 48 |
| P-005 | Ruhrbrause Apfelschorle 0,33 l | Kühlung | 10 | Kühlschrank 15 |
| P-006 | Ruhrbrause Eistee Pfirsich 0,5 l | Kühlung | 10 | Kühlschrank 15 |
| P-007 | Püttbräu Pils 0,33 l | Regal | 36 | Wandregal N 36/40 · Wandregal W 36/40 · Mittelregal 14 |
| P-008 | Püttbräu Schachtbier Dose 0,5 l | Kühlung | 10 | Kühlschrank 15 |
| P-009 | Naschwerk Chips Paprika 150 g | Regal | 36 | Wandregal N 15 · Wandregal W 15 · Mittelregal 0 |
| P-010 | Naschwerk Erdnüsse geröstet 200 g | Regal | 36 | Wandregal N 20 · Wandregal W 20 · Mittelregal 9 |
| P-011 | Naschwerk Salzstangen 125 g | Regal | 36 | Wandregal N 35 · Wandregal W 35 · Mittelregal 12 |
| P-012 | Naschwerk Vollmilchschokolade 100 g | Regal | 36 | Wandregal N 48 · Wandregal W 48 · Mittelregal 18 |
| P-013 | Naschwerk Fruchtgummi Zechenbunt 200 g | Regal | 36 | Wandregal N 24/30 · Wandregal W 24/30 · Mittelregal 9 |
| P-014 | Naschwerk Sahnebonbons 120 g | Regal | 36 | Wandregal N 35 · Wandregal W 35 · Mittelregal 15 |
| P-015 | Naschwerk Kaugummi Minze | Regal | 36 | Wandregal N 36/40 · Wandregal W 36/40 · Mittelregal 14 |
| P-016 | Eiskumpel Stieleis Himbeere | Tiefkühlung | 4 | Eistruhe 45/27 |
| P-017 | Eiskumpel Waffelbecher Vanille | Tiefkühlung | 4 | Eistruhe 40/20 |
| P-018 | Eiskumpel Wassereis Brause | Tiefkühlung | 4 | Eistruhe 54/27 |
| P-019 | Pottbäcker Brötchen | Theke | 5 | Theke 6 |
| P-020 | Pottbäcker Streuselteilchen | Theke | 5 | Theke 4 |
| P-021 | Halden-Echo Lokalblatt | Zeitschriftenständer | 12 | Ständer 6 |
| P-022 | Knobelschacht Rätselheft | Zeitschriftenständer | 12 | Ständer 7 |
| P-023 | Abstoß Ligaheft | Zeitschriftenständer | 12 | Ständer 6 |
| P-024 | Pottsoft Papiertaschentücher 10er | Regal | 36 | Wandregal N 42/49 · Wandregal W 42/49 · Mittelregal 20 |
| P-025 | Funkenflug Batterien AA 4er | Regal | 36 | Wandregal N 56 · Wandregal W 56 · Mittelregal 25 |
| P-026 | Flammwerk Einwegfeuerzeug 2er | Regal | 36 | Wandregal N 56 · Wandregal W 56 · Mittelregal 25 |
| P-027 | Zechenhof Filter 20er | Theke | 5 | Theke 45 |
| P-028 | Zechenhof Drehtabak 30 g | Theke | 5 | Theke 14 |

Auffälligkeit: Chips (P-009, 27 cm hoch) passen nicht in die 26 cm hohen Mittelregal-Plätze (Kapazität 0 dort). Die Einräum-Ansicht bietet diese Plätze für Chips nicht an; ein direkter Aufruf würde vom Spiel mit `slot_capacity_exceeded` abgelehnt.
