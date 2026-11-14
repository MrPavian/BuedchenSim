# Auftrag 04.5 – VISUAL IDENTITY & GRAPHICS FOUNDATION

**Status:** vorbereitet – vor Phase 5 ausführen  
**Branch:** `claude/elegant-curie-17qulu`  
**Ziel:** Die visuelle Qualität von BuedchenSim früh verbindlich festlegen und die vorhandene Three.js-Szene auf eine belastbare, wiederverwendbare Grafikbasis heben. Dieser Auftrag ist eine gezielte visuelle Vertiefung des Vertical Slice – kein vollständiger Grafik- oder Asset-Produktionsdurchlauf.

---

## 1. Warum dieser Auftrag jetzt kommt

BuedchenSim besitzt bereits einen spielbaren Kiosk, 28 sichtbare Produktdefinitionen und vier prozedurale Bewohner. Die aktuelle Szene ist funktional, aber der technische Ist-Stand weist unter anderem auf begrenzte Lesbarkeit kleiner Produktetiketten, hohe Dreiecksanzahl bei vollen Regalen und fehlende Prüfung auf echter Grafikhardware hin.

Die Grafik darf deshalb nicht bis zum abschließenden Polish warten. Wir brauchen vor dem Ausbau des Viertels einen überprüften visuellen Maßstab, damit neue Gebäude, NPCs, Waren, Wettereffekte und regionale Inhalte nicht in unterschiedlichen Stilrichtungen entstehen.

**Leitentscheidung:** Gameplay und Grafik werden parallel entwickelt. Dieser Auftrag etabliert die visuelle Grundlage; Phase 5 baut darauf auf. Die finale Detailpolitur bleibt späteren Schritten vorbehalten.

## 2. Verbindliche visuelle Richtung

Die bestehende Art Direction bleibt Grundlage und wird für die tatsächliche Spielkamera konkretisiert:

- Stylized 3D mit kontrolliertem Low-/Mid-Poly-Einfluss.
- Warmherzige, glaubwürdige Ruhrgebiets-Nachbarschaft statt generischer Asset-Store-Kulisse.
- Leicht stilisierte, klare Formen und Silhouetten; keine kindliche Comicoptik. Bei Figuren gilt ausdrücklich: so realistisch und glaubwürdig wie innerhalb der gewählten stilisierten Bildsprache technisch sinnvoll – keine fotorealistischen Fremdkörper, aber auch keine groben Low-Poly-Puppen.
- Handwerkliche Materialwirkung: Backstein, Putz, Beton, Asphalt, Metall, Kunststoff, Glas und Holz müssen unterscheidbar sein.
- Dezente Gebrauchsspuren und kleine Unregelmäßigkeiten; keine künstlich starke Verschmutzung.
- Warme, einladende Innenbeleuchtung; außen nachvollziehbare Tageslichtstimmung und klare Lesbarkeit.
- Satter, aber kontrollierter Farbkontrast. Farben stammen aus Material, Umgebung und fiktiven Produkten – keine Kopie realer Marken-Farbwelten.
- Lesbarkeit und Orientierung aus der tatsächlichen Third-Person-Spielkamera haben Vorrang vor Details, die nur in Nahaufnahmen sichtbar wären.

**Visuelles Zielgefühl:** ein liebevoll gebautes, leicht stilisiertes 3D-Diorama eines belebten Ruhrgebietsviertels, das sich wie ein glaubwürdiger Ort anfühlt. Der Kiosk ist der visuelle Anker und darf charaktervoller sein als seine Umgebung. **Die Bewohner und späteren Figuren sollen dabei eine besonders hohe Qualitätsstufe erreichen:** glaubwürdige menschliche Proportionen, Gesichter, Kleidung, Materialien und Animationen, ohne den einheitlichen Stylized-3D-Look zu verlassen.

Keine realen Marken, Logos, Produktverpackungen, Vereinswappen, Werbekampagnen oder geschützten Figuren. Alle Schilder, Grafiken, Produkte und Requisiten bleiben originär und fiktiv.

## 3. Phase-0-Bestandsaufnahme – vor jeder Änderung verpflichtend

Zuerst den aktuellen Branch und Codebestand untersuchen. Dokumentation allein reicht nicht.

Prüfen und belegen:
1. tatsächliche Renderer-Konfiguration, Tone Mapping, Farbmanagement und Ausgabe-Farbraum;
2. Kamera, FOV, Perspektive, Blickwinkel, Auflösung und typische Sichtabstände;
3. vorhandene Lichtquellen, Schattenkonfiguration und Tageslichtmodell;
4. Materialtypen, Farbwerte, Texturen, Wiederverwendung und Transparenz;
5. Geometrieerzeugung, geteilte Geometrien/Materialien, Instancing und Draw Calls;
6. Warenmodelle, Regale, Fassaden, Innenraum und NPC-Figuren in der echten Szene;
7. vorhandene Asset-Registry, Platzierungsdaten und Ladepfade;
8. aktuelle Screenshots und Browserprüfung sowie bekannte Performancegrenzen;
9. tatsächliche Zielplattform und verfügbare Grafikhardware-Prüfmöglichkeiten.

Erstelle `docs/VISUAL-BASELINE.md` mit:
- Ist-Zustand und konkreten Codepfaden;
- mindestens drei repräsentativen Ausgangsscreenshots (Außenansicht, Innenraum, Bewohner/Waren);
- messbaren Ausgangswerten, soweit technisch zuverlässig erhebbar;
- Problemen nach Wirkung und Priorität;
- einer Liste von Änderungen, die wirklich nötig sind.

Keine erfundenen Messwerte und keine Behauptung, echte Hardware getestet zu haben, wenn nur Headless-/Software-Rendering verfügbar war.

## 4. Visuelles Zielbild und Referenzaufbau

Erstelle einen konsistenten visuellen Referenzaufbau in der laufenden Anwendung. Keine isolierte Konzeptgrafik als Ersatz für die echte Szene.

Der Referenzaufbau muss mindestens zeigen:
- Kiosk-Außenansicht mit Fassade, Schild, Markise, Fenster, Eingang und Gehweg;
- Innenraum mit Theke, Regalen, Kühlung und sichtbar bestückten Waren;
- mindestens zwei Bewohner in der Umgebung;
- Tageslicht-/Schattenwirkung und warmes Innenlicht;
- eine Nah- und eine typische Spielkameraansicht, soweit die vorhandene Kamera dies sinnvoll ermöglicht.

Definiere in `docs/VISUAL-BASELINE.md` eine kompakte Style-Spezifikation:
- Farbpalette mit Rollen (Grundmaterial, Akzent, UI/Interaktion, Licht);
- Materialcharakter und zulässige Rauheit/Glanzwirkung;
- Detaildichte je Sichtabstand;
- Silhouetten- und Proportionsregeln;
- Licht- und Schattenprinzip;
- Regeln für fiktive Beschilderung und Waren;
- Beispiele für erwünschte und unerwünschte Gestaltung.

Keine exakten Farbwerte oder Renderparameter blind aus Konzepten übernehmen: erst mit der tatsächlichen Szene und dem vorhandenen Farbmanagement abstimmen und dann dokumentieren.

## 5. Technische Grafikbasis

Bestehende Architektur erweitern, keine neue Render-Engine und kein Framework einführen.

Prüfen und bei nachgewiesenem Bedarf verbessern:
- konsistente Materialparameter und Farbdefinitionen;
- zentrale, sparsame Wiederverwendung gemeinsamer Materialien;
- sinnvolle Geometrie-Wiederverwendung und Instancing bei wiederholten Waren-/Umgebungselementen;
- lesbare Normalen, Kanten und Silhouetten;
- Schatten nur dort, wo sie sichtbar zur Orientierung oder Atmosphäre beitragen;
- klare Trennung von Weltzustand und Darstellung;
- robuste Sichtbarkeit von Interaktionspunkten und wichtigen Waren;
- angemessene Texturauflösungen und Vermeidung unnötiger Materialvarianten.

Renderer- und Farbmanagementänderungen nur mit Vorher-/Nachher-Vergleich durchführen. Keine pauschale globale Materialumstellung, die vorhandene Waren oder NPCs ungewollt verfälscht.

### Performance-Budget

Vor Änderungen Messmethode und Referenzszene festlegen. Mindestens dokumentieren:
- Draw Calls;
- sichtbare Dreiecke;
- Anzahl sichtbarer Meshes;
- Textur-/Materialanzahl, soweit sinnvoll ermittelbar;
- Bildrate bzw. Framezeit auf verfügbarer Hardware, mit Gerät, Browser, Auflösung und Messdauer.

Ziel ist nicht ein willkürlicher Zahlenwert, sondern eine stabile, nachvollziehbare Basis. Bei vollen Regalen und vier Bewohnern darf die Grafik nicht unnötig durch tausende identische Einzelobjekte wachsen. Instancing/Batching nur dort einsetzen, wo es die tatsächliche Szene verbessert und Interaktion/Bestandsdarstellung nicht beschädigt.

Die bekannte Messung von ca. 452.000 Dreiecken bei 1.513 Wareneinheiten ist als Warnsignal zu untersuchen, nicht ungeprüft als aktueller Gesamtwert zu übernehmen.

## 6. Gezielte visuelle Überarbeitung

Nach Bestandsaufnahme und Style-Festlegung nur die Bereiche überarbeiten, die den größten visuellen Gewinn bringen:

1. Kioskfassade und Außenwirkung;
2. Innenraum, Theke und Regale;
3. Warenpräsentation und Lesbarkeit;
4. Boden, Gehweg und unmittelbarer Außenbereich;
5. Licht, Schatten und Materialabstimmung;
6. Bewohnerdarstellung und visuelle Einbindung; mindestens eine Figur als hochwertiger Charakter-Prototyp.

Die Überarbeitung muss die vorhandenen Asset-IDs, Platzierungsverträge, Interaktionspunkte, Kollisionen, Warenbestände und Savegames erhalten. Falls ein Vertrag angepasst werden muss, zuerst Auswirkungen dokumentieren und Tests ergänzen.

**Keine Komplettneumodellierung des Kiosks**, wenn gezielte Verbesserungen ausreichen. Keine großflächige Nachbarschaft, keine neue Region und keine vollständige NPC-Überarbeitung in diesem Auftrag.

## 6A. Figurenqualität – ausdrückliche Priorität

Die Figuren sind ein zentraler Träger der emotionalen Bindung. Sie dürfen nicht dauerhaft auf dem aktuellen prozeduralen Platzhalter-/Blockfiguren-Niveau bleiben. Das Ziel ist eine hochwertige, glaubwürdige stilisierte Charakterdarstellung.

**Gestalterisches Ziel:**
- Menschliche Anatomie und Körperproportionen glaubwürdig und individuell; keine übergroßen Köpfe, Hände oder vereinfachten Gliedmaßen, sofern dies nicht bewusst und subtil zum Gesamtstil passt.
- Gesichter mit erkennbarer Persönlichkeit: stimmige Augen, Nase, Mund, Ohren, Kiefer, Wangen und altersgerechte Merkmale. Keine austauschbaren Standardgesichter.
- Haut, Haare, Bart, Augen, Kleidung und Schuhe mit differenzierten, aber stilistisch passenden Materialien.
- Kleidung mit nachvollziehbarem Schnitt, Lagen, Faltenwurf, Nähten, Säumen und kleinen Gebrauchsspuren. Kleidung muss Beruf, Alter, Persönlichkeit und Alltag erkennen lassen.
- Individuelle Silhouette, Farbkomposition und Details je Bewohner. Figuren müssen auch aus normaler Spielentfernung unterscheidbar sein.
- Natürlich wirkende Idle-, Geh-, Dreh-, Gesprächs- und Interaktionsanimationen. Keine steifen T-Pose-Eindrücke, mechanischen Bewegungen oder sichtbaren Gelenkfehler.
- Gesichtsausdrücke und kleine Gesten sollen Dialoge unterstützen; zunächst wenige gut ausgeführte Animationen statt vieler schlechter.
- Figuren müssen in Licht, Schatten und Umgebung eingebettet sein und dürfen nicht wie separat importierte Assets wirken.

**Technischer Weg:**
1. Bestehende prozedurale Figuren und deren Verträge untersuchen.
2. Qualitätslücke anhand von Referenzansichten und Zielkamera dokumentieren.
3. Eine repräsentative Figur als hochwertigen Charakter-Prototyp ausarbeiten und im echten Spiel testen.
4. Pipeline für Mesh/GLB, Material, Rig, Animation, LOD und Wiederverwendung anhand der tatsächlichen Infrastruktur festlegen.
5. Erst nach Abnahme des Prototyps die übrigen Bewohner nach demselben Qualitätsstandard überarbeiten.

GLB/glTF ist zu bevorzugen, sofern die vorhandene Ladepipeline es unterstützt; andernfalls zunächst eine begründete Erweiterung der vorhandenen Three.js-Pipeline prüfen. Keine Engine-Migration. Externe Assets müssen stilistisch und rechtlich geprüft werden; keine fremden Figuren oder erkennbaren realen Personen kopieren.

**Qualitätsabnahme des Figuren-Prototyps:**
- Nahansicht zeigt überzeugende Gesichts- und Kleidungsdetails.
- Typische Spielkamera zeigt glaubwürdige Proportionen und eine klare individuelle Silhouette.
- Geh- und Idle-Animation wirken natürlich und ohne offensichtliche Deformationen.
- Figur passt sichtbar zur Beleuchtung und Materialwelt des Kiosks.
- Identität bleibt über verschiedene Blickwinkel und Lichtverhältnisse stabil.
- Performance und Speicherbedarf sind dokumentiert.

Die Figurenqualität ist eine priorisierte Teilaufgabe und darf nicht mit dem Hinweis auf spätere finale Politur vollständig vertagt werden.

## 7. Warenlesbarkeit und visuelle Hierarchie

Waren müssen aus der üblichen Spielkamera als Produktkategorien und möglichst als einzelne fiktive Produkte erkennbar sein.

- Form, Verpackungstyp, Farbblock und originäres Emblem müssen zusammenwirken.
- Produktnamen dürfen nicht allein von winziger Texturtypografie abhängen.
- Wichtige Produktunterschiede müssen auch bei kleiner Bildschirmdarstellung erkennbar bleiben.
- Interaktive bzw. ausgewählte Waren dürfen eine dezente, konsistente Hervorhebung erhalten.
- Keine realen Marken- oder Verpackungsdesigns nachahmen.

Dokumentiere, welche Waren aus typischer Kameradistanz tatsächlich unterscheidbar sind und welche Einschränkungen verbleiben.

## 8. Screenshots und Qualitätsvergleich

Erstelle reproduzierbare Screenshots aus der laufenden Anwendung mit identischen Kamerapositionen und möglichst identischen Spielzuständen.

Mindestens:
- Außenansicht vor/nach;
- Innenraum vor/nach;
- bestückte Regale vor/nach;
- Bewohner im Viertel vor/nach;
- eine Detailansicht zur Materialqualität.

Lege sie unter `docs/screenshots/auftrag-04-5/` ab und ergänze eine README mit Perspektive, Spielzustand, Renderer/Browser und Einordnung. Screenshots dürfen keine bloßen Render-Mockups sein.

## 9. Tests und Abnahme

Nach jeder Änderung:
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run check:browser`

Vorher prüfen, welche Skripte tatsächlich vorhanden sind. Alle Ergebnisse und Laufzeiten korrekt dokumentieren.

Zusätzlich prüfen:
- Warenbestände und Regalplatzierungen bleiben korrekt;
- Interaktionspunkte, Türen, Klappe und Kollisionen funktionieren unverändert;
- NPCs erscheinen, bewegen sich und bleiben ansprechbar;
- Dialoge und Kundenkäufe funktionieren;
- Sichtfreistellung des Kiosks bleibt korrekt;
- Savegame-Version 3 und Migrationen bleiben intakt;
- keine auffälligen visuellen Regressionen in den Referenzansichten.

Wenn echte Grafikhardware verfügbar ist, mindestens einen Lauf mit Gerät, Browser, Auflösung, Einstellungen und Messdauer dokumentieren. Andernfalls ausdrücklich als offen markieren.

## 10. Abgrenzung

Nicht Teil dieses Auftrags:
- vollständige finale Grafikpolitur;
- vollständiger Neubau aller Produktmodelle;
- neue große Stadtumgebung oder Nachbargebäude-Serie;
- vollständige Überarbeitung sämtlicher Figuren und eine komplette Charakterkampagne; ein hochwertiger Figuren-Prototyp samt belastbarer Pipeline ist ausdrücklich Teil dieses Auftrags.
- Wetter-/Jahreszeiteneffekte aus Phase 5;
- Audio;
- neue Regionen;
- Wechsel zu Godot, WebGPU oder einer anderen Engine;
- Austausch der vorhandenen Three.js-Architektur.

Dieser Auftrag soll die vorhandene Szene sichtbar und technisch sinnvoll verbessern, ohne die Gameplay-Entwicklung zu blockieren.

## 11. Dokumentation und Abschluss

Aktualisieren:
- `docs/TECHNISCHER-IST-STAND.md`;
- `docs/IMPLEMENTIERUNGSPLAN.md`;
- `docs/artwork-prompts/07-artwork-register.md`, sofern Assetstatus betroffen ist;
- `README.md`.

Erstellen:
- `docs/VISUAL-BASELINE.md`;
- `docs/screenshots/auftrag-04-5/README.md`;
- `docs/PHASE-04-5-ABSCHLUSSBERICHT.md`.

Der Abschlussbericht nennt:
1. Ausgangslage und Zielbild;
2. konkrete visuelle Änderungen;
3. betroffene Dateien und Asset-IDs;
4. Renderer-/Materialentscheidungen;
5. Vorher-/Nachher-Screenshots;
6. Performancewerte samt Messbedingungen;
7. tatsächlich ausgeführte Tests;
8. offene Einschränkungen;
9. Branch und Commit-Hashes.

## 12. Definition of Done

Auftrag 04.5 ist abgeschlossen, wenn:
- der visuelle Ist-Stand nachvollziehbar dokumentiert ist;
- ein konsistentes, in der echten Szene überprüftes Style-Zielbild vorliegt;
- Kiosk, Innenraum, Waren und Bewohner sichtbar aufeinander abgestimmt sind;
- mindestens eine repräsentative Figur den definierten hohen Qualitätsstandard für glaubwürdig stilisierte Charaktere erreicht und als Referenz für weitere Bewohner dient;
- die wichtigsten Materialien und Lichtstimmungen aus der Spielkamera überzeugend funktionieren;
- Waren besser erkennbar sind oder konkrete, verbleibende Grenzen dokumentiert sind;
- Performance nicht verschlechtert wurde, ohne dies zu begründen;
- bestehende Gameplay-Funktionen und Savegames erhalten bleiben;
- Tests, Browserprüfung und Screenshots dokumentiert sind;
- die visuellen Regeln für Phase 5 und spätere Assets verbindlich festgehalten sind.

**Ergebnis:** Ab Phase 5 wird neue Grafik nicht mehr nach Gefühl ergänzt, sondern folgt einem in der laufenden Three.js-Szene erprobten visuellen Standard. Die finale Politur bleibt ein späterer eigener Schritt.
