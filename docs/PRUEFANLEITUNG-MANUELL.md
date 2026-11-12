# Manuelle Prüfanleitung – Browser mit echter Grafikhardware

**Zweck:** Der automatische Check (`npm run check:browser`) läuft in Headless-Chromium mit Software-Rendering. Diese Anleitung ergänzt ihn um eine Prüfung im normalen Desktop-Browser. Sie ersetzt keine Messung: Ergebnisse bitte unten eintragen.

**Stand der manuellen Prüfung:** In der Entwicklungsumgebung von Claude Code gibt es keinen Browser mit Grafikhardware. Diese Prüfung wurde dort **nicht** durchgeführt. Firefox und Safari sind **ungeprüft**. Es gibt keine gemessene Bildrate auf realer Hardware.

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

## Bildrate messen (optional)
In der Konsole ausführen, dabei 10 Sekunden herumlaufen:

```js
(() => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 10000 ? requestAnimationFrame(f) : console.log((n / 10).toFixed(1) + ' Bilder/s', window.__buedchen.world.getRenderStats()); }; requestAnimationFrame(f); })();
```

## Protokoll
| Datum | Gerät / Grafikkarte | Betriebssystem | Browser und Version | Schritte 1–12 | Bilder/s | Auffälligkeiten |
|---|---|---|---|---|---|---|
| | | | | | | |
