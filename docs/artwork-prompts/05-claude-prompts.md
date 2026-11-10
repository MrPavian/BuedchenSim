# 05 – Claude-Code-Prompts

Die folgenden Prompts sind als Arbeitsaufträge gedacht. Claude soll zuerst den vorhandenen Code untersuchen und die bestehende Architektur respektieren. Keine großflächigen Umbauten ohne Rückfrage.

## Prompt A – Projektanalyse und Produktionsplan
Du arbeitest am Projekt BuedchenSim. Analysiere zuerst das vorhandene Repository: Ordnerstruktur, Einstiegspunkt, Three.js-Version, Szenenaufbau, Kamera, Steuerung, Asset-Ladepfade, Beleuchtung, Kollisionen und Build-/Startprozess. Ändere zunächst keine Dateien. Liefere eine knappe Bestandsaufnahme, benenne technische Risiken und schlage einen konkreten, inkrementellen Plan für ein erstes spielbares Ruhrgebiets-Büdchen vor. Bestehende Konventionen haben Vorrang. Keine Framework-Migration.

## Prompt B – Greybox des Ruhrgebiets-Kiosks
Setze auf Basis der vorhandenen Projektarchitektur eine maßstäbliche Greybox für einen kleinen Kiosk um. Planungsmaß: ungefähr 6 m breit, 4 m tief und 3,2 m hoch. Erzeuge Außenwände, Dach, Verkaufsöffnung, Eingang und einen begehbaren Innenraum. Ergänze Gehweg und einen kleinen Außenbereich. Nutze einfache Materialien und klare Geometrie. Achte auf korrekte Maßstäbe, Kamera-Lesbarkeit und Kollisionen, sofern das Projekt diese bereits unterstützt. Keine realen Marken, Logos oder Werbeschilder. Vor Änderungen relevante Dateien nennen und nach der Umsetzung Start-/Testschritte dokumentieren.

## Prompt C – Modulare Innenausstattung
Ergänze modular und wiederverwendbar: Verkaufstheke, Kasse/POS, Wandregal, Mittelregal, Getränkekühlschrank, Eistruhe, Zeitschriftenständer mit fiktiven Titeln, neutrales Produktdisplay, Hocker, Lagerregal und Leergutbereich. Nutze konsistente Maße, sinnvolle Pivots und wiederverwendbare Geometrie-/Materialfunktionen. Objekte sollen sich leicht verschieben und austauschen lassen. Keine realen Marken oder Verpackungen.

## Prompt D – Fiktive Produktwelt
Erstelle zunächst 20–30 eigenständige Kioskprodukte für das Ruhrgebiets-Vertical-Slice. Kategorien: Getränke, Snacks, Süßwaren, Eis, Backwaren und Alltagsbedarf. Verwende ausschließlich erfundene Marken und originäre Verpackungsdesigns. Keine realen Logos, Markennamen, Produktnamen oder nachgebildeten Verpackungen. Produkte müssen aus der üblichen Spielkamera unterscheidbar sein. Erstelle ein konsistentes Datenmodell und gruppiere Assets nach Kategorie. Dokumentiere IDs, Abmessungen, Regal-/Kühlbedarf und Materialvarianten.

## Prompt E – Regionale Umgebung und NPCs
Ergänze eine glaubwürdige Ruhrgebiets-Straßenszene mit Gehweg, Bordstein, Laterne, Bank, Mülleimer, Fahrrad, Bäumen und angrenzenden Fassaden. Entwickle mehrere eigenständige NPC-Silhouetten: Betreiber, Stammkunde, Handwerker, Schüler, fiktiver Fußballfan, Kurier und Nachbarin. Regionale Anmutung über Architektur, Kleidung und Alltagssituationen erzeugen. Keine realen Personen, Marken, Vereinswappen oder geschützten Designs.

## Arbeitsregeln für alle Prompts
- Vor dem Editieren relevante Dateien und geplante Änderungen nennen.
- Kleine, überprüfbare Schritte statt Komplettumbau.
- Keine Abhängigkeit hinzufügen, wenn sie nicht nötig ist.
- Bestehende Namens-, Import- und Asset-Konventionen respektieren.
- Keine Platzhalter als fertige Features ausgeben.
- Nach jedem Schritt Fehler, Startbarkeit und betroffene Szenen prüfen.
- Neue Assets und IDs im Artwork-Register dokumentieren.
