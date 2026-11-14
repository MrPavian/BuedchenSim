# Manuelle Prüfanleitung – Browser mit echter Grafikhardware

**Zweck:** Der automatische Check (`npm run check:browser`) läuft in Headless-Chromium mit Software-Rendering. Diese Anleitung ergänzt ihn um eine Prüfung im normalen Desktop-Browser. Sie ersetzt keine Messung: Ergebnisse bitte unten eintragen.

**Stand der manuellen Prüfung:** In der Entwicklungsumgebung von Claude Code gibt es keinen Browser mit Grafikhardware. Diese Prüfung wurde dort **nicht** durchgeführt. Firefox und Safari sind **ungeprüft**. Es gibt keine gemessene Bildrate auf realer Hardware. Das gilt auch für alle Schritte 13–31 (Waren, Kasse, Tagesabschluss, Speichern, Wochentag) aus Auftrag 03: Sie sind nur in Headless-Chromium mit Software-Rendering automatisch geprüft, **manuell wurde nichts davon durchgeführt**. Dasselbe gilt für die Schritte 32–47 aus Auftrag 04 (Bewohner, Gespräche, Geschichten, Kundenkäufe, Altersablehnung, Journal, Neuladen): Sie sind nur über die Vitest-Tests und die Headless-Browserprüfung abgedeckt, **in der Entwicklungsumgebung wurde keiner dieser Schritte von Hand ausgeführt**.

## Vorbereitung
1. `npm install`
2. `npm run dev` und die angezeigte Adresse mit angehängtem `?debug` öffnen, z. B. `http://localhost:5173/?debug`.
3. Entwicklerwerkzeuge öffnen (F12), Reiter „Konsole".
4. Für einen sauberen Start oben rechts „Neues Spiel" zweimal klicken.
5. Für die Schritte 32–47: Die Routinen der Bewohner würfeln mit einem Seed, der bei jedem neuen Spiel anders ist, und haben Wahrscheinlichkeiten zwischen 60 und 90 Prozent. Ein Bewohner erscheint daher nicht an jedem Tag; die Zeiten stehen in [BEWOHNER-UND-GESCHICHTEN.md, Abschnitt 3.2](BEWOHNER-UND-GESCHICHTEN.md). Tag 1 ist ein Montag. Mit Tempo 4× und geschlossenen Panels lässt sich ein Spieltag in rund vier Minuten durchlaufen. Zum Ablesen des Zustands dienen in der Konsole `__buedchen.game.state.npcs` (Status, Position, Beziehung, Erinnerungen), `__buedchen.game.state.story` (Flags, Geschichten) und `__buedchen.world.getResidentInfo()`; Werte dabei nicht verändern.

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
| 32 | Neues Spiel; Figur auf den Gehweg vor das Verkaufsfenster stellen; Tempo 4×; zu den Zeiten aus der Routinetabelle abwarten (z. B. Montag: Derya ab 06:30 vom Hof, Günter ab 07:00 vom Westende des Gehwegs, Marlene ab 14:30; Jonas Di ab 15:15 und Do ab 16:30 vom Osten) | Bewohner erscheinen an den Rändern des Gehwegs bzw. im Hof und gehen zum Fenster, zur Ecke oder zur Werkstatt; sie erscheinen nicht alle am selben Punkt und stehen auf verschiedenen Standplätzen; ein Bewohner kann an einem Tag ausfallen (Wahrscheinlichkeit), dann einen anderen Tag versuchen; nach Fensterende gehen sie heim |
| 33 | Die vier Figuren nebeneinander ansehen (auch aus dem Kiosk durch das Verkaufsfenster) | Günter: Schiebermütze, Gehstock, gebeugt, langsam. Derya: Arbeitshemd, Werkzeuggürtel, breite Haltung, zügig. Jonas: Fahrradhelm, Kuriertasche, schlank, schnell. Marlene: Strickjacke, Einkaufstasche, aufrecht. Unterschiedliche Größen und Farben; Gehen, Stehen und Sprechen sind animiert; kein Zucken oder Gleiten |
| 34 | Einem gehenden Bewohner auf dem Gehweg im Weg stehen; dann in einen stehenden Bewohner laufen | Der Bewohner bleibt stehen, schiebt die Figur nicht und weicht nach einigen Sekunden über die andere Gehweg-Bahn aus; die Figur bleibt vor einem Bewohner stehen und gleitet seitlich; kein Bewohner läuft durch Wand, Theke, Tür oder Möbel |
| 35 | Bis auf etwa 1,5 m an einen Bewohner herangehen (Reichweite 1,8 m) und ihn ansehen | Hinweis „Mit … sprechen“; E oder Klick öffnet das Dialogpanel mit Name, Rolle, Beziehungsstufe („fremd“ …), Aussage und 2–4 Antworten (auch mit den Tasten 1–4 wählbar); der Bewohner dreht sich zur Figur und gestikuliert; die Figur bewegt sich nicht, die Uhr läuft weiter; Escape schließt, die Steuerung kehrt zurück, das Gespräch öffnet sich nicht von selbst neu |
| 36 | Erstes Gespräch mit Günter („Ich leg dir das Echo zurück.“); am nächsten Morgen erneut ansprechen | Hinweis „… wird sich daran erinnern.“; am Folgetag spricht Günter das Echo an (Erinnerung); der Tagesgruß (+1) zählt nur beim ersten Gespräch eines Tages (die Zahl lässt sich in `__buedchen.game.state.npcs` ablesen); Stufenwechsel erscheinen als zurückhaltender Hinweis |
| 37 | Ware bestellen und einräumen (Schritte 14–17), z. B. Echo, Brötchen, Pils, Streuselteilchen, Energy, Wasser, Schokolade, Wassereis, Limonade; Klappe öffnen; auf einen Kunden am Fenster warten und ihn ansprechen | Der Kunde bleibt am Fenster stehen; das Gespräch zeigt Wunsch, Zeilen mit Preis und Regalbestand, Summe und die Antworten „Bitte sehr.“, „Das hab ich gerade nicht.“ (bei altersbeschränkter Ware zusätzlich „Ausweis, bitte.“) |
| 38 | „Bitte sehr.“ wählen (Taste 1), dann sofort mehrfach klicken | Kasse steigt genau um die angezeigte Summe, Regalbestand sinkt genau um die Mengen, Hinweis „Verkauf abgeschlossen“, Bewohner geht; weitere Klicks ändern am Verkauf nichts; die Tagesabrechnung zählt den Verkauf mit |
| 39 | Einen Kunden ablehnen („Das hab ich gerade nicht.“); bei einem anderen das Gespräch schließen, die gewünschte Ware im Lager zurücknehmen, den Kunden erneut ansprechen und „Bitte sehr.“ wählen | Ablehnen: kein Verkauf, Bewohner geht, Kasse unverändert. Fehlende Ware: die Antwort „So viel hast du davon nicht da?“, nichts ändert sich, der Wunsch bleibt offen |
| 40 | Altersprüfung: Drehtabak und Pils bestellen und einräumen; abends (Mi, Fr, Sa 18:00–20:30) Günters Pils; Jonas (Di, Do, Sa, ab Tag 4) wünscht Drehtabak mit dem Gewicht 1 von 8, also nur in manchen Besuchen | Günters Pils: ohne „Ausweis, bitte.“ abgelehnt, mit Ausweis (71 Jahre) verkauft. Jonas’ Drehtabak: ohne Ausweis abgelehnt, mit Ausweis steht „17 Jahre“ und der Verkauf bleibt abgelehnt („Okay, okay. War einen Versuch wert.“); Kasse, Bestand und Transaktionen bleiben unverändert; nach „Das hab ich gerade nicht.“ reagiert Jonas später auf die Ablehnung |
| 41 | Klappe geschlossen lassen und Günter als Kunden am Fenster abwarten (Tempo 4×) | Er steht am Fenster ohne Wunsch und geht nach 30 Spielminuten (bei 4× etwa 7,5 s); beim nächsten Gespräch erwähnt er die geschlossene Klappe |
| 42 | Geschichte A („Krach im Hinterhof“) nach [BEWOHNER-UND-GESCHICHTEN.md, Abschnitt 6.1](BEWOHNER-UND-GESCHICHTEN.md): Marlene ansprechen (z. B. Mo oder Mi 17:00–18:00 an der Ecke), dann Derya in der Werkstatt, dann entscheiden; mit einem zweiten neuen Spiel einen anderen Ausgang wählen | Jedes Gespräch bietet die beschriebenen Antworten (die Vermittlung nur bei Beziehung ≥ 15 beider); die Folgegespräche erinnern sich an die Entscheidung; das Journal zeigt Schritt und Ausgang |
| 43 | Folgen von Geschichte A prüfen (bei „Vermitteln“ und bei den anderen Ausgängen) | Bei „Vermitteln“ erscheint sofort die Hofbank im Hof (die Figur läuft dagegen), Derya sägt erst ab 09:00 (Werkstatt), an den Bankplätzen stehen später Bewohner; bei „Derya“ bleibt der Hof ohne Bank, Derya ab 07:30, Marlene kommt nicht mehr zum Hoftreff; bei „Marlene“ ab 09:00 ohne Bank; bei „Raushalten“ ändert sich nichts |
| 44 | Geschichte B („Ein Paket für Günter“) ab Tag 2 nach Abschnitt 6.2: Günter ansprechen (Ecke Di/Do 14:00–16:00 oder bei geschlossener Klappe), Jonas ansprechen, Günter das Paket übergeben, später Günter erneut für die Fotoszene; Gespräche dabei nicht mit Escape abbrechen | Am Ende steht das gerahmte Foto links auf der Theke (durch das Verkaufsfenster sichtbar); Günters Kommentar passt zum Ausgang von Geschichte A; bei „Vermitteln“ gibt es die Antwort „Ich sag Derya Bescheid.“ und später Deryas Ständer-Angebot; die Kasse bleibt unverändert (keine Geldbelohnung). Bekannte Einschränkung: Wird Günters Bitte oder die Fotoszene vorzeitig geschlossen, kommt sie nicht wieder |
| 45 | Journal: **J** drücken oder „Notizen“ in der Leiste klicken; mit offener Kasse oder offenem Gespräch erneut versuchen | Das Journal listet nur Bewohner, mit denen schon gesprochen wurde, den aktuellen Schritt begonnener Geschichten und abgeschlossene Geschichten (nur den Ausgang); keine unbekannten Geschichten, keine künftigen Schritte; die Figur steht still, die Uhr läuft; J oder Escape schließt; bei einem anderen offenen Fenster öffnet sich das Journal nicht |
| 46 | Mitten in Geschichte A und mit Beziehungen über 20 neu laden (F5); danach die Gespräche und die Bewohner ansehen | „Spielstand geladen“; Beziehungsstufen, Journaleintrag, Flags (Bank, Foto) und Erinnerungen sind wiederhergestellt; Bewohner stehen bzw. gehen an derselben Stelle; ein offenes Gespräch ist beendet; am selben Tag kommen dieselben Routinen wie vor dem Neuladen (Bewohner, die schon erschienen sind, erscheinen nicht noch einmal) |
| 47 | Einen Spielstand der Version 2 (aus Phase 3, unter `localStorage` `buedchensim.save.slot1`) laden; Konsole ansehen | Zeit, Kasse, Bestände, Warenplätze und Tagesbericht bleiben, die Bewohner beginnen bei Beziehung 30/10/5/12 (Günter/Derya/Jonas/Marlene); nach dem nächsten Speichern steht `schemaVersion` 3 im Speicher; keine Fehler, keine Warnungen zu WebGL-Kontextverlust |

## Bildrate messen (optional)
In der Konsole ausführen, dabei 10 Sekunden herumlaufen:

```js
(() => { let n = 0; const t0 = performance.now(); const f = () => { n++; performance.now() - t0 < 10000 ? requestAnimationFrame(f) : console.log((n / 10).toFixed(1) + ' Bilder/s', window.__buedchen.world.getRenderStats()); }; requestAnimationFrame(f); })();
```

## Bewohnerfiguren auf echter Grafikhardware (Auftrag 04.6)
Misst die anspruchsvollste Figurenszene: alle vier GLB-Bewohner an der Hofbank und auf dem Gehweg, Spiel angehalten.

1. Für realistische Werte den Produktions-Build verwenden: entweder die veröffentlichte Seite (GitHub Pages, `https://mrpavian.github.io/buedchensim/?debug`, Workflow `.github/workflows/pages.yml`) oder lokal `npm run build`, dann `npm run preview` und `http://localhost:4173/?debug` öffnen. Fenster wie beim normalen Spielen (z. B. Vollbild), Netzteil angeschlossen.
2. Warten, bis das Spiel steht (rund 5 Sekunden; die Figuren laden kurz nach dem Start).
3. Entwicklerwerkzeuge (F12) → Konsole, folgenden Block einfügen und Enter drücken. Danach 15 Sekunden nichts anklicken.
4. Die ausgegebene JSON-Ausgabe kopieren und ins Protokoll übernehmen (oder an Claude geben). Zusätzlich die Szene mit Blick auf die Figuren ansehen: Gesichter, Kleidung, Schatten, Flimmern, Durchdringungen.
5. Achtung: Das Snippet lädt einen Prüfzustand in das laufende Spiel (Do, Tag 4, 16:50). Danach „Neues Spiel“ klicken, wenn normal weitergespielt werden soll.

```js
(async () => {
  const { game: g, world: w } = window.__buedchen;
  const s = structuredClone(g.state);
  const places = new Map(g.content.layout.nav.places.map((p) => [p.id, p]));
  const wp = new Map(g.content.layout.nav.waypoints.map((x) => [x.id, x.position]));
  Object.assign(s.calendar, { day: 4, minute: 1010, phase: 'open', paused: true });
  s.story.flags = { ...s.story.flags, 'yard.bench': true };
  s.player.position = { x: -3.0, z: 3.4 };
  s.player.heading = Math.PI;
  const at = { 'npc.guenter': 0, 'npc.marlene': 1, 'npc.derya': 2 };
  for (const [id, n] of Object.entries(s.npcs)) {
    const spot = id in at ? places.get('place.yard-bench').spots[at[id]] : places.get('place.corner').spots[0];
    const pos = id in at ? wp.get(spot.waypointId) : { x: -5.4, z: 3.3 };
    Object.assign(n, { status: 'at_place', position: { ...pos }, heading: id in at ? spot.heading : Math.PI / 2, placeId: id in at ? 'place.yard-bench' : 'place.corner', spotIndex: id in at ? at[id] : 0, route: [], routineId: null, wish: null, waitingSince: null });
  }
  g.load(s);
  await new Promise((r) => setTimeout(r, 3000));
  const times = [];
  let last = performance.now();
  const t0 = last;
  await new Promise((r) => { const f = () => { const now = performance.now(); times.push(now - last); last = now; now - t0 < 10000 ? requestAnimationFrame(f) : r(); }; requestAnimationFrame(f); });
  const sorted = [...times].sort((a, b) => a - b);
  const gl = document.querySelector('canvas').getContext('webgl2');
  const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
  const result = {
    gpu: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'unbekannt',
    browser: navigator.userAgent,
    canvas: `${innerWidth}x${innerHeight} @ dpr ${devicePixelRatio}`,
    fps: +(times.length / 10).toFixed(1),
    frameMs: { median: +sorted[Math.floor(sorted.length / 2)].toFixed(1), p95: +sorted[Math.floor(sorted.length * 0.95)].toFixed(1), max: +sorted[sorted.length - 1].toFixed(1) },
    render: w.getRenderStats(),
    residents: w.getResidentInfo().map((r) => `${r.npcId}: ${r.model}${r.visible ? '' : ' (unsichtbar)'}`),
  };
  console.log(JSON.stringify(result, null, 2));
  return result;
})();
```

Erwartet: `residents` zeigt viermal `glb`; `render.calls` rund 380–400, `render.triangles` rund 270.000–310.000. Wichtig für die Bewertung sind `gpu`, `canvas` (Auflösung und Pixeldichte), `fps` und `frameMs` (Median, 95-%-Wert, Maximum).

## Protokoll
| Datum | Gerät / Grafikkarte | Betriebssystem | Browser und Version | Schritte 1–47 | Bilder/s | Auffälligkeiten |
|---|---|---|---|---|---|---|
| | | | | | | |
