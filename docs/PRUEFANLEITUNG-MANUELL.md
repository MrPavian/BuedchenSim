# Manuelle Prüfanleitung – Browser mit echter Grafikhardware

**Zweck:** Der automatische Check (`npm run check:browser`) läuft in Headless-Chromium mit Software-Rendering. Diese Anleitung ergänzt ihn um eine Prüfung im normalen Desktop-Browser. Sie ersetzt keine Messung: Ergebnisse bitte unten eintragen.

**Stand der manuellen Prüfung:** In der Entwicklungsumgebung von Claude Code gibt es keinen Browser mit Grafikhardware. Diese Prüfung wurde dort **nicht** durchgeführt. Firefox und Safari sind **ungeprüft**. Es gibt keine gemessene Bildrate auf realer Hardware. Das gilt auch für alle Schritte 13–31 (Waren, Kasse, Tagesabschluss, Speichern, Wochentag) aus Auftrag 03: Sie sind nur in Headless-Chromium mit Software-Rendering automatisch geprüft, **manuell wurde nichts davon durchgeführt**.

## Vorbereitung
1. `npm install`
2. `npm run dev` und die angezeigte Adresse mit angehängtem `?debug` öffnen, z. B. `http://localhost:5173/?debug`.
3. Entwicklerwerkzeuge öffnen (F12), Reiter „Konsole".
4. Für einen sauberen Start oben rechts „Neues Spiel" zweimal klicken.

## Prüfschritte
| Nr. | Schritt | Erwartung |
|---|---|---|
| 1 | Seite laden | Kiosk mit Backsteinfassade, Markise, Schild „BÜDCHEN AM ECK", Figur auf dem Gehweg; keine roten Meldungen in der Konsole |
| 2 | W, A, S, D und Pfeiltasten je kurz halten, dann W+D | Figur läuft in die jeweilige Richtung, diagonal nicht schneller; Kamera folgt weich |
| 3 | Geradeaus gegen die Fassade laufen, dabei A oder D halten | Figur bleibt vor der Wand und gleitet seitlich, kein Zittern, kein Durchlaufen |
| 4 | Vor die Tür stellen | Hinweis „E – Tür öffnen", Markierung am Boden hebt sich hervor |
| 5 | E drücken, hineingehen | Tür schwingt nach innen; im Kiosk verschwindet das Dach, die Südwand ist bis Brüstungshöhe gekappt, die Einrichtung ist sichtbar |
| 6 | Im Kiosk an jedes Möbel laufen | Figur stoppt an jeder Möbelkante; alle Möbel sind von vorn erreichbar; nichts flackert |
| 7 | Hinter die Theke stellen, E drücken | Hinweis „Verkaufsklappe öffnen/schließen"; Klappe schwingt nach außen; Markierung auf der Fensterbank ist sichtbar |
| 8 | Hinausgehen und vor das Verkaufsfenster stellen | Markierung auf der Fensterbank sichtbar, Hinweis erscheint |
| 9 | Einmal um den Kiosk laufen | Gebäude bleibt deckend; hinter dem Gebäude ist die Figur als helle Silhouette erkennbar; an der Westwand stehen die Leergutkisten |
| 10 | Tür und Klappe in einen beliebigen Zustand bringen, Seite neu laden | Position, Tür und Klappe sind wiederhergestellt, Meldung „Spielstand geladen" |
| 11 | Fenster verkleinern und vergrößern | Bild passt sich an, nichts verzerrt |
| 12 | Konsole ansehen | keine Fehler, keine Warnungen zu WebGL-Kontextverlust |
| 13 | Oben in der Leiste prüfen: „Mo · Tag 1“, 06:00, Kasse 300,00 €, „Geschlossen“; Schaltflächen Pause, 1×/2×/4×, Tag abschließen (es gibt keine Schaltflächen „Waren“ oder „Kasse“) | Die Uhr läuft: eine Spielminute je Sekunde (nach 10 s etwa 06:10) |
| 14 | Zum Lagerregal gehen (Interaktionspunkt vor dem Regal), E drücken oder auf „Lager öffnen“ klicken; Reiter „Bestellen“, z. B. 6 × Zitronenlimo, 6 × Pils, 6 × Chips, 6 × Stieleis, 4 × Brötchen und 2 × Filter 20er wählen | Zeile „Bestellsumme“ und „Kasse nach Bestellung“ stimmen mit den Einzelpreisen überein (Betrag selbst nachrechnen); die Figur bewegt sich bei offenem Fenster nicht, E tut nichts, die Uhr läuft weiter |
| 15 | „Bestellen“ klicken | Kasse sinkt sofort um die Summe, Reiter „Lieferung“ zeigt die Lieferung; eine zweite Bestellung wird abgelehnt |
| 16 | „Lieferung annehmen“, Reiter „Bestand“ | Mengen stehen im Lager, noch nicht im Regal |
| 17 | Reiter „Einräumen“: Zitronenlimo in den Kühlschrank, Pils und Chips in ein Regal, Stieleis in die Eistruhe, Brötchen und Filter in die Theke einräumen; Fenster schließen (Escape) | Die Ware steht sichtbar an den Plätzen im Kiosk (Dach und Südwand sind ausgeblendet, wenn die Figur drin steht); nichts überlappt, Ware steht auf den Böden, leere Plätze bleiben leer |
| 18 | Mehr einräumen als Platz ist | Wird abgelehnt; die Zahl „Platz für n“ entspricht der sichtbar möglichen Menge |
| 19 | Zurück ins Lager nehmen | Ware verschwindet im Regal, Lagerbestand steigt |
| 20 | Verkaufsklappe geschlossen: hinter die Theke neben der Kasse gehen, E drücken oder auf „Kasse bedienen“ klicken, und etwas verkaufen | Hinweis und Ablehnung: Verkaufsklappe geschlossen; bei geöffneter Klappe ist der Verkauf möglich |
| 21 | Zitronenlimo in den Warenkorb, „Verkauf abschließen“ | Kasse steigt um den Verkaufspreis, Regalbestand sinkt um 1, die Flasche verschwindet im Kühlschrank |
| 22 | Pils (ab 16) in den Warenkorb, „Verkauf abschließen“ ohne Häkchen | Ablehnung „Altersprüfung fehlt“; Kasse und Bestand unverändert. Mit Häkchen „Ausweis geprüft“ klappt der Verkauf; danach ist das Häkchen wieder gelöst. Dasselbe mit dem Filter 20er (ab 18) |
| 23 | Kasse wie in Schritt 20 öffnen, „Abbrechen“ | Nichts ändert sich, Warenkorb ist beim nächsten Öffnen leer |
| 24 | Pause klicken, dann Weiter; 2× und 4× wählen | Uhr steht bei Pause, läuft danach mit doppeltem bzw. vierfachem Tempo |
| 25 | Tempo 4× bis 22:00 laufen lassen (ca. 4 Minuten) | Uhr hält bei 22:00, Hinweis „der Tag muss abgeschlossen werden“; Verkaufen ist gesperrt, die Zeit läuft nicht weiter |
| 26 | „Jetzt abschließen“, bestätigen | Abrechnung mit Umsatz, Wareneinsatz, Einkäufen, Rohertrag, Kassenveränderung, Kassenstand und Zahl der Verkäufe; Werte gegenrechnen. Einen zweiten Abschluss gibt es nicht; Bestellen ist gesperrt |
| 27 | „Nächsten Tag beginnen“ | „Di · Tag 2“, 06:00, Tagessummen bei 0, Bestände und Kasse unverändert |
| 28 | Neuladen (F5) mit Ware im Regal, Ware im Lager, offener Lieferung, Tag und Uhrzeit | Alles ist wiederhergestellt (Hinweis „Spielstand geladen“), Regalinhalt sichtbar; nach Neuladen am Abend (Abrechnung offen) erscheint die Abrechnung wieder |
| 29 | Einen Spielstand aus Phase 2 laden (Version 1, falls vorhanden) | Position, Tür und Klappe bleiben, Tag 1, 300,00 € |
| 30 | Etiketten ansehen (normale Spielkamera, 1280×720) | Magazine, Beutel, Schachteln und Eiswaren sind über Farbfeld und Emblem zu unterscheiden; Wörter sind nur auf Beuteln bei doppelter Pixeldichte lesbar. Flaschen und Dosen (4–6 px breit) sind nicht lesbar und unterscheiden sich über Farbteilung und Kronkorkenfarbe (bekannte Einschränkung). Bier und Tabak haben ein schlichtes Band ohne Emblem |
| 31 | Wochentag prüfen: Leiste zeigt „Mo · Tag 1“; nach „Nächsten Tag beginnen“ (Schritt 27) „Di · Tag 2“; Abrechnung trägt den Titel „Tagesabrechnung – Montag, Tag 1“ | Der Wochentag stimmt mit Tag 1 = Montag überein und wird aus dem Tageszähler abgeleitet; es gibt kein Datum und keine Jahreszeit. Nach Neuladen steht derselbe Wochentag in der Leiste |

## Bildrate messen (optional)
In der Konsole ausführen, dabei 10 Sekunden herumlaufen:

```js
(() => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 10000 ? requestAnimationFrame(f) : console.log((n / 10).toFixed(1) + ' Bilder/s', window.__buedchen.world.getRenderStats()); }; requestAnimationFrame(f); })();
```

## Protokoll
| Datum | Gerät / Grafikkarte | Betriebssystem | Browser und Version | Schritte 1–31 | Bilder/s | Auffälligkeiten |
|---|---|---|---|---|---|---|
| | | | | | | |
