import type { Condition, DialogueDef } from '../../../game/types';
import { bye, mem, opt, rel } from './dialogueKit';
import { HILDE, OLE } from './guests';

/**
 * Dialogues about weather and neighbourhood events (Auftrag 05, 5.3/5.6), and the guests' dialogues. Priority 3-5: above
 * the daily small talk (1-2), below story steps (6+). They repeat on every matching day (no `once`), except first
 * meetings.
 */

const G = 'npc.guenter';
const D = 'npc.derya';
const J = 'npc.jonas';
const M = 'npc.marlene';

const event = (eventId: string): Condition => ({ type: 'eventToday', eventId });
const active = (eventId: string): Condition => ({ type: 'eventActive', eventId });
const weather = (...conditions: ('sunny' | 'cloudy' | 'light-rain' | 'heavy-rain' | 'fog' | 'snow' | 'frost')[]): Condition => ({
  type: 'weather',
  conditions,
});

export const worldDialogues: DialogueDef[] = [
  // --- Günter -----------------------------------------------------------------------------------------------------
  {
    id: 'dialogue.guenter.heimspiel',
    npcId: G,
    priority: 4,
    when: [event('event.fussballspieltag')],
    start: 'a',
    nodes: {
      a: {
        text: 'Heimspiel heute. Früher hab ich vom Stellwerk aus die Sonderzüge reingewunken, voll mit Blau-Gold. Heute reicht mir das Radio.',
        options: [
          opt('tipp', 'Wie geht’s aus?', { next: 'tipp' }),
          bye('Dann drück ich die Daumen.'),
        ],
      },
      tipp: {
        text: 'Zwei zu eins. Wie immer, wenn ich tippe und es nicht stimmt.',
        options: [bye('Ich merk’s mir.', 'merken')],
      },
    },
  },
  {
    id: 'dialogue.guenter.hitze',
    npcId: G,
    priority: 3,
    when: [{ type: 'temperatureAtLeast', value: 28 }],
    start: 'a',
    nodes: {
      a: {
        text: 'Bei der Hitze haben sich früher die Schienen verzogen. Jetzt verzieht sich nur mein Knie. Gib mir was Kaltes, dann mecker ich weniger.',
        options: [bye('Kalt ist im Kühlschrank.')],
      },
    },
  },
  {
    id: 'dialogue.guenter.regen',
    npcId: G,
    priority: 3,
    when: [weather('light-rain', 'heavy-rain')],
    start: 'a',
    nodes: {
      a: {
        text: 'Der Regen kriegt mich nicht ins Haus. Mütze drauf, Stock in die Hand, und das Echo bleibt trocken unterm Mantel.',
        options: [bye('Pass auf dem nassen Pflaster auf.')],
      },
    },
  },
  {
    id: 'dialogue.guenter.advent',
    npcId: G,
    priority: 4,
    when: [event('event.weihnachtszeit')],
    start: 'a',
    nodes: {
      a: {
        text: 'Lichterkette am Büdchen. Sieht gut aus. Meine Frau hat damals jedes Jahr die gleiche aufgehängt, mit einer kaputten Birne in der Mitte.',
        options: [
          opt('birne', 'Hast du sie noch?', { effects: [rel(G, 2, 'k.guenter.advent'), mem(G, 'guenter:advent-lichterkette')], next: 'birne' }),
          bye('Schöne Erinnerung.'),
        ],
      },
      birne: {
        text: 'Im Keller. Mit der kaputten Birne. Die bleibt drin.',
        options: [bye('Natürlich bleibt die drin.')],
      },
    },
  },
  // --- Derya ------------------------------------------------------------------------------------------------------
  {
    id: 'dialogue.derya.strassenfest',
    npcId: D,
    priority: 4,
    when: [event('event.strassenfest')],
    start: 'a',
    nodes: {
      a: {
        text: 'Ich hab die Biertischgarnituren repariert. Alle zwölf. Wenn heute einer zusammenklappt, war’s nicht mein Leim.',
        options: [
          opt('danke', 'Ohne dich gäb’s kein Fest.', { effects: [rel(D, 2, 'k.derya.strassenfest')], next: 'danke' }),
          bye('Ich halt mich an die Bänke vom Büdchen.'),
        ],
      },
      danke: { text: 'Übertreib nicht. Aber ja. Ohne mich gäb’s kein Fest.', options: [bye('Eben.')] },
    },
  },
  {
    id: 'dialogue.derya.hitze',
    npcId: D,
    priority: 3,
    when: [{ type: 'temperatureAtLeast', value: 29 }],
    start: 'a',
    nodes: {
      a: { text: 'In der Werkstatt ist es wärmer als im Leimtopf. Ich arbeite heute ab sechs, dafür ab Mittag im Schatten.', options: [bye('Klingt vernünftig.')] },
    },
  },
  {
    id: 'dialogue.derya.frost',
    npcId: D,
    priority: 3,
    when: [weather('frost', 'snow')],
    start: 'a',
    nodes: {
      a: { text: 'Bei der Kälte zieht sich das Holz zusammen und meine Laune auch. Der Ofen im Hof läuft seit fünf.', options: [bye('Halt dich warm.')] },
    },
  },
  // --- Jonas ------------------------------------------------------------------------------------------------------
  {
    id: 'dialogue.jonas.spieltag',
    npcId: J,
    priority: 4,
    when: [event('event.fussballspieltag')],
    start: 'a',
    nodes: {
      a: {
        text: 'Spieltag! Die halbe Hüttenstraße ist gesperrt, ich fahr meine Pakete über den Bürgersteig. Erzähl das keinem.',
        options: [bye('Ich hab nichts gehört.')],
      },
    },
  },
  {
    id: 'dialogue.jonas.regen',
    npcId: J,
    priority: 3,
    when: [weather('heavy-rain', 'light-rain')],
    start: 'a',
    nodes: {
      a: { text: 'Ich bin nass bis auf die Socken. Die Tabletten in der Tasche sind trocken, das ist das Wichtigste, sagt der Chef.', options: [bye('Sag dem Chef, er soll dir ein Cape kaufen.')] },
    },
  },
  {
    id: 'dialogue.jonas.hitze',
    npcId: J,
    priority: 3,
    when: [{ type: 'temperatureAtLeast', value: 28 }],
    start: 'a',
    nodes: {
      a: { text: 'Der Asphalt klebt am Reifen. Ich brauch was Kaltes, sonst schmelz ich vor der Apotheke weg.', options: [bye('Die Truhe ist voll.')] },
    },
  },
  // --- Marlene ----------------------------------------------------------------------------------------------------
  {
    id: 'dialogue.marlene.flohmarkt',
    npcId: M,
    priority: 4,
    when: [event('event.flohmarkt')],
    start: 'a',
    nodes: {
      a: {
        text: 'Flohmarkt! Ich hab die Anmeldung beim Amt gemacht, Hilde bringt die Tische. Wenn einer im Hof parkt, schreib ich ihm einen Zettel.',
        options: [bye('Ich wünsch gute Geschäfte.')],
      },
    },
  },
  {
    id: 'dialogue.marlene.strassenfest',
    npcId: M,
    priority: 4,
    when: [event('event.strassenfest')],
    start: 'a',
    nodes: {
      a: {
        text: 'Das Straßenfest läuft. Drei Kuchen, zwei Grills, ein Streit über die Musik. Also alles wie geplant.',
        options: [
          opt('helfen', 'Brauchst du Hilfe?', { effects: [rel(M, 2, 'k.marlene.strassenfest')], next: 'helfen' }),
          bye('Dann lass ich dich mal.'),
        ],
      },
      helfen: { text: 'Halt einfach das Büdchen offen. Das ist die halbe Miete.', options: [bye('Mach ich.')] },
    },
  },
  {
    id: 'dialogue.marlene.advent',
    npcId: M,
    priority: 4,
    when: [event('event.weihnachtszeit')],
    start: 'a',
    nodes: {
      a: { text: 'Im Treppenhaus hängt mein Adventskalender. Jeder Haushalt ein Türchen. Herr Wollny hat das vierundzwanzigste, das ist Tradition.', options: [bye('Schöne Tradition.')] },
    },
  },
  {
    id: 'dialogue.marlene.nebel',
    npcId: M,
    priority: 3,
    when: [weather('fog')],
    start: 'a',
    nodes: {
      a: { text: 'Bei dem Nebel hab ich fast die Laterne gegrüßt. Gut, dass das Büdchen leuchtet.', options: [bye('Wir lassen das Licht an.')] },
    },
  },
  // --- Guests -----------------------------------------------------------------------------------------------------
  {
    id: 'dialogue.ole.erstes-mal',
    npcId: OLE,
    priority: 6,
    once: true,
    start: 'a',
    nodes: {
      a: {
        text: 'Moin! Ole. Ich kauf vor jedem Heimspiel hier, schon beim Vorgänger. Seitdem verlieren wir nur noch auswärts.',
        options: [
          opt('tradition', 'Dann halten wir die Tradition.', { effects: [rel(OLE, 3, 'k.ole.erstes-mal'), mem(OLE, 'ole:tradition')] }),
          bye('Aberglaube?'),
        ],
      },
    },
  },
  {
    id: 'dialogue.ole.moin',
    npcId: OLE,
    priority: 1,
    start: 'a',
    nodes: { a: { text: 'Moin! Alles im grünen Bereich? Bei mir alles blau-gold.', options: [bye('Moin, Ole.')] } },
  },
  {
    id: 'dialogue.ole.spieltag',
    npcId: OLE,
    priority: 4,
    when: [active('event.fussballspieltag')],
    start: 'a',
    nodes: {
      a: {
        text: 'Heute geht’s gegen die von der anderen Ruhrseite. Wenn wir gewinnen, geb ich nachher an der Ecke einen aus.',
        options: [bye('Ich halt den Kühlschrank kalt.')],
      },
    },
  },
  {
    id: 'dialogue.ole.fest',
    npcId: OLE,
    priority: 4,
    when: [active('event.strassenfest')],
    start: 'a',
    nodes: {
      a: { text: 'Ich steh am Grill, bis die Kohle aus ist. Wenn du Durst hast, ich hab keinen Kühlschrank, du schon.', options: [bye('Wir teilen uns die Arbeit.')] },
    },
  },
  {
    id: 'dialogue.hilde.erstes-mal',
    npcId: HILDE,
    priority: 6,
    once: true,
    start: 'a',
    nodes: {
      a: {
        text: 'Hilde. Flohmarkt im Hof, erster Sonntag. Wenn du alte Schilder von früher hast, ich zahl gut. Für die Leute aus Düsseldorf.',
        options: [
          opt('schild', 'Ich schau mal im Keller.', { effects: [rel(HILDE, 3, 'k.hilde.erstes-mal'), mem(HILDE, 'hilde:keller')] }),
          bye('Leider nichts.'),
        ],
      },
    },
  },
  {
    id: 'dialogue.hilde.moin',
    npcId: HILDE,
    priority: 1,
    start: 'a',
    nodes: { a: { text: 'Na, mein Junge. Wie laufen die Geschäfte? Meine laufen langsam, aber sie laufen.', options: [bye('Läuft, Hilde.')] } },
  },
  {
    id: 'dialogue.hilde.flohmarkt',
    npcId: HILDE,
    priority: 4,
    when: [active('event.flohmarkt')],
    start: 'a',
    nodes: {
      a: { text: 'Drei Sammeltassen verkauft, eine verschenkt. An die Kleine, die hat so geguckt. Geschäft ist das nicht, aber schön.', options: [bye('Schön ist auch was wert.')] },
    },
  },
  {
    id: 'dialogue.hilde.advent',
    npcId: HILDE,
    priority: 4,
    when: [active('event.weihnachtszeit')],
    start: 'a',
    nodes: {
      a: { text: 'In der Kantine gab’s im Advent immer Spekulatius zum Kaffee. Heute kauf ich Sahnebonbons und erzähl den Enkeln davon.', options: [bye('Die hören bestimmt gern zu.')] },
    },
  },
];
