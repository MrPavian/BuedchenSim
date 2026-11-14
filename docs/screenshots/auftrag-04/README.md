# Screenshots Auftrag 04 – Bewohner und soziale Bindung

**Kontext:** BuedchenSim ist ein Kiosk-Simulator im Ruhrgebiet (Three.js, Browser). Der Spieler betreibt das „Büdchen am Eck“: Ware einkaufen, einräumen, an der Klappe verkaufen. Mit Auftrag 04 kamen vier wiederkehrende Bewohner mit Tagesabläufen, Gesprächen, Beziehungen und zwei kleinen Geschichten hinzu. Alle Namen, Marken und Produkte sind erfunden. Ausführlich: [Bewohner und Geschichten](../../BEWOHNER-UND-GESCHICHTEN.md).

Alle neun Bilder stammen aus der laufenden Anwendung und werden von `npm run check:browser` (Abschnitt R13, auch einzeln mit `node scripts/browser-check.mjs --only residents`) erzeugt: 1280×720 CSS-Pixel bei Geräte-Pixelverhältnis 2 (Bilddatei 2560×1440). Es sind **Headless-Aufnahmen mit Software-Rendering** (Chromium, SwiftShader), keine Bilder einer echten GPU und keine manuelle grafische Abnahme. Die jeweilige Spielsituation (Uhrzeit, Geschichte, Position der Figuren) wird über den Debug-Zugang als Spielstand gesetzt; Dialoge, Notizbuch und Interaktionen laufen über die echte Oberfläche. Die Bilder 02–09 zeigen eine angehaltene Spielzeit („PAUSIERT“ im Kopf), damit die Szene stillsteht; Bild 01 läuft in Echtzeit.

Wer ist wer:
- **Günter Wollny** (71): graue Jacke, Schiebermütze, Gehstock.
- **Derya Aksoy** (38): senfgelbes Hemd, Werkzeuggürtel.
- **Jonas Pietrek** (17): limonengrüner Helm, petrolfarbene Kuriertasche.
- **Marlene Hoffmann** (58): pflaumenfarbene Strickjacke, Einkaufstasche.
- Die Figur mit roter Mütze und blauer Jacke ist der Spieler.

## 01-bewohner-im-viertel.png
Außenansicht des Büdchens am Dienstag, Tag 2, 14:38. Günter geht in Gehhaltung über den Gehweg vor dem Kiosk (zum Eck rechts der Tür), Marlene wartet am Verkaufsfenster, Jonas steht am Eck rechts außen. Der Spieler steht vor der Wand. Keine Geschichte aktiv, Spielstand im Ausgangszustand.

## 02-kunde-am-fenster.png
Dienstag, Tag 2, 07:20. Der Spieler steht hinter der Theke (Innenansicht, Dach ausgeblendet), Günter wartet draußen am Verkaufsfenster und hat seinen Wunsch geäußert. Unten im Bild der Prompt „E – Mit Günter Wollny sprechen“. Das Regal ist mit Waren bestückt, die Klappe ist offen.

## 03-dialog.png
Dienstag, Tag 2, 10:00. Das Dialogpanel mit Marlenes Beschwerde über das frühe Sägen im Hof (Geschichte „Krach im Hinterhof“, Schritt 1) und zwei Antwortoptionen, bedienbar mit den Tasten 1 und 2 oder per Klick. Im Kopf des Panels: Name, Rolle und Beziehungsstufe („fremd“). Die Szene dahinter ist abgedunkelt.

## 04-kundenwunsch.png
Dienstag, Tag 2, 07:20. Kundenansicht im Dialog: Günter wünscht ein Halden-Echo und zwei Pottbäcker-Brötchen. Zu sehen sind Einzelpreis, Bestand im Regal, Zeilenpreis und die Summe von 2,70 €; die Optionen „Bitte sehr.“ (Verkauf) und „Das hab ich gerade nicht.“ (ablehnen).

## 05-altersgrenze.png
Samstag, Tag 6, 11:00. Jonas (17) möchte Zechenhof Drehtabak (ab 18). Nach der Ausweisprüfung zeigt die Ansicht „Ausweis: 17 Jahre“, der Verkauf über „Bitte sehr.“ wird mit der roten Meldung „Zu jung für diese Ware – der Verkauf ist nicht erlaubt.“ abgelehnt; Kasse und Bestand bleiben unverändert.

## 06-folge-hofbank.png
Donnerstag, Tag 4, 16:50. Folge von Geschichte A (Ausgang „Kompromiss“, Flag `yard.bench`): die Holzbank E-004 steht im Hof westlich des Kiosks, Marlene (links) und Günter (rechts, mit Gehstock) stehen an den Bankplätzen. Der Spieler steht auf dem Gehweg davor.

## 07-folge-foto.png
Samstag, Tag 6, 10:00. Folge von Geschichte B (Ausgang „Foto“, Flag `kiosk.photo`): das gerahmte Foto vom Kiosk aus dem Jahr 1972 steht am linken Ende der Theke. Günter steht am Verkaufsfenster, der Spieler dahinter (Innenansicht).

## 08-notizbuch.png
Samstag, Tag 6, 10:00. Das Notizbuch („Notizen“) mit zwei bekannten Personen (Günter, Beziehungsstufe „vertraut“; Marlene, „bekannt“), der laufenden Geschichte „Krach im Hinterhof“ (Schritt „Gegenseite gehört“) unter „Was gerade ansteht“ und der abgeschlossenen Geschichte „Ein Paket für Günter“ (Ausgang „Foto“). Ungestartete Geschichten und nicht getroffene Personen erscheinen nicht.

## 09-figuren.png
Samstag, Tag 6, 10:00. Alle vier Bewohner nebeneinander auf dem Gehweg rechts neben der Tür, dem Betrachter zugewandt (von links nach rechts: Günter, Derya, Jonas, Marlene), zur Wiedererkennung der Figuren. Die Positionen sind für das Bild über den Spielstand gesetzt, nicht aus einer Routine entstanden.
