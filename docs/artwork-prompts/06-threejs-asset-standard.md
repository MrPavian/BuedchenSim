# 06 – Three.js Asset-Standard

## Zweck
Einheitliche technische Leitplanken für die Erstellung, Integration und Pflege von 3D-Assets. Zuerst bestehende Projektkonventionen prüfen; dieses Dokument ist ein Vorschlag, keine Aufforderung zur Migration.

## Maßstab und Koordinaten
- Planungsannahme: 1 Three.js-Unit = 1 Meter, sofern das Repository nichts anderes verwendet.
- Maße in Metern dokumentieren.
- Einheitliche Up-Achse und Ausrichtung entsprechend der vorhandenen Szene verwenden.
- Pivots an sinnvollen Montage-/Platzierungspunkten setzen (z. B. Bodenmitte oder hintere linke Ecke) und dokumentieren.

## Formate und Integration
- Bevorzugt GLB/glTF für externe 3D-Assets.
- Materialien und Texturen effizient halten; Texturauflösung nach Sichtabstand wählen.
- Asset-Pfade und Loader an die bestehende Projektstruktur anpassen.
- Keine neuen Libraries ohne konkreten Bedarf.
- Wiederverwendbare Objekte als Funktionen, Klassen oder Datenkonfiguration entsprechend dem vorhandenen Code-Stil umsetzen.

## Modell- und Performance-Regeln
- Geometrie nur dort detaillieren, wo sie sichtbar oder spielrelevant ist.
- Wiederholte Elemente instanzieren, wenn sinnvoll.
- Materialien teilen, unnötige Draw Calls vermeiden.
- Texturen komprimiert und angemessen dimensioniert halten.
- Schatten selektiv aktivieren; nicht jedes Kleinteil muss Schatten werfen.
- LOD oder vereinfachte Varianten erst bei nachgewiesenem Bedarf ergänzen.

## Asset-Metadaten
Für jedes Asset dokumentieren:
- Asset-ID und Anzeigename
- Kategorie / Region
- Abmessungen
- Pivot und Ausrichtung
- Material-/Texturhinweise
- Varianten
- Interaktions- und Kollisionsbedarf
- Quelle / Erstellungsstatus
- Dateipfad

## Qualitätsprüfung
- korrekte Skalierung und Orientierung
- keine unbeabsichtigten Löcher oder invertierten Flächen
- Materialdarstellung in der tatsächlichen Spielbeleuchtung prüfen
- keine flackernden oder überlappenden Flächen
- Performance in einer realistischen Szene testen
- Marken-/Designprüfung: ausschließlich originäre fiktive Gestaltung
