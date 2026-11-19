import type { EventDef } from '../../../game/eventCalendar';
import type { Condition, DialogueDef, RoutineEntry, WishDef } from '../../../game/types';
import { bye, mem, opt, rel } from './dialogueKit';
import { HILDE, OLE } from './guests';
import { SPECIALTY_PRODUCT } from './specialty';

/**
 * What the neighbourhood does with the specialty (Auftrag 05, 5.5): wishes, dialogues, a weekly tradition and extra
 * regulars, each gated by the stage flags the specialty sets. Stage 1 (first batch): residents try it. Stage 2
 * (Geheimtipp): more residents ask, talk about it, the sign stands outside. Stage 3 (Kultstatus): residents ask for it
 * by name, the "Frikadellen-Freitag" exists and brings the guests on Fridays too.
 */

export const SPECIALTY_FLAGS = {
  tried: 'specialty.frikadelle.tried',
  sign: 'specialty.frikadelle.sign',
  cult: 'specialty.frikadelle.cult',
} as const;

export const FRIDAY = 'event.frikadellenfreitag';
const FOOTBALL = 'event.fussballspieltag';
const FLEA = 'event.flohmarkt';

const G = 'npc.guenter';
const D = 'npc.derya';
const J = 'npc.jonas';
const M = 'npc.marlene';

const h = (hours: number, minutes = 0): number => hours * 60 + minutes;
const flag = (id: string): Condition => ({ type: 'flag', id, value: true });
const notFlag = (id: string): Condition => ({ type: 'not', condition: flag(id) });
const time = (from: number, to: number): Condition => ({ type: 'time', from, to });
const active = (eventId: string): Condition => ({ type: 'eventActive', eventId });
const frikadelle = (quantity: number): WishDef['lines'] => [{ productId: SPECIALTY_PRODUCT, quantity }];

export const frikadellenFreitag: EventDef = {
  id: FRIDAY,
  ambience: 'market',
  name: 'Frikadellen-Freitag',
  description:
    'Seit die Frikadelle im Brötchen im Viertel Kult ist, stehen freitags mittags Handwerker, Rentner und Schüler am Büdchen. ' +
    'Eine Tradition, die keiner beschlossen hat.',
  schedule: { kind: 'everyNthWeek', weekday: 4, everyWeeks: 1, first: { year: 2027, month: 6, dayOfMonth: 11 } },
  hours: { from: h(11), to: h(15) },
  announceDays: 6,
  productGroups: ['Frikadelle im Brötchen', 'Kaltgetränke'],
  demand: { [SPECIALTY_PRODUCT]: 35, 'tag:lunch': 10, 'tag:thirst': 5 },
  visitorBonus: 15,
  memory: 'erlebt:frikadellenfreitag',
  requiresFlag: SPECIALTY_FLAGS.cult,
};

/** Specialty wishes per resident, appended to the resident's own wishes. */
export const specialtyWishes: Record<string, WishDef[]> = {
  [D]: [
    {
      id: 'wish.derya-frikadelle',
      lines: frikadelle(1),
      when: [flag(SPECIALTY_FLAGS.tried), time(h(11), h(14))],
      weight: 2,
      text: 'Was riecht hier so? Gib mal eine von den Frikadellen. Mit ordentlich Senf.',
    },
    {
      id: 'wish.derya-frikadelle-baustelle',
      lines: frikadelle(3),
      when: [flag(SPECIALTY_FLAGS.sign), time(h(11), h(14))],
      weight: 2,
      text: 'Drei Frikadellen, die Jungs von der Baustelle haben mich geschickt. Die fragen nach nix anderem mehr.',
    },
  ],
  [J]: [
    {
      id: 'wish.jonas-frikadelle',
      lines: frikadelle(1),
      when: [flag(SPECIALTY_FLAGS.tried), time(h(11), h(15))],
      weight: 1,
      text: 'Eine Frikadelle im Brötchen, auf die Hand. Ich hab sieben Minuten Pause.',
    },
  ],
  [G]: [
    {
      id: 'wish.guenter-frikadelle',
      lines: frikadelle(1),
      when: [flag(SPECIALTY_FLAGS.sign), time(h(10), h(14))],
      weight: 2,
      text: 'Eine Frikadelle. Die Derya schwärmt davon, da muss ich das ja mal prüfen.',
      onSold: [{ type: 'relationship', npcId: G, delta: 2, key: 'k.guenter.frikadelle' }],
    },
  ],
  [M]: [
    {
      id: 'wish.marlene-frikadelle',
      lines: frikadelle(1),
      when: [flag(SPECIALTY_FLAGS.sign), time(h(11), h(14))],
      weight: 1,
      text: 'Eine Frikadelle im Brötchen, bitte. Für den Mittag, heute koch ich nicht.',
    },
  ],
  [OLE]: [
    {
      id: 'wish.ole-frikadelle',
      lines: frikadelle(2),
      when: [flag(SPECIALTY_FLAGS.sign), active(FOOTBALL)],
      weight: 3,
      text: 'Zwei Frikadellen für die Kurve! Mit Senf, das bringt Glück.',
    },
  ],
  [HILDE]: [
    {
      id: 'wish.hilde-frikadelle',
      lines: frikadelle(1),
      when: [flag(SPECIALTY_FLAGS.cult), active(FLEA)],
      weight: 3,
      text: 'Eine Frikadelle, Kind. Wie früher in der Kantine. Aber sag’s keinem.',
    },
  ],
};

// Frikadellen-Freitag: everyone asks for it by name.
for (const [npcId, text] of [
  [G, 'Frikadellen-Freitag. Zwei, bitte. Eine für jetzt, eine für nachher.'],
  [D, 'Frikadellen-Freitag! Vier Stück für die Baustelle, Senf extra.'],
  [J, 'Ist doch Freitag: eine Frikadelle. Die Kollegen warten schon an der Ampel.'],
  [M, 'Zwei Frikadellen. Mein Nachbar sagt, freitags gibt’s nichts anderes mehr.'],
  [OLE, 'Zwei Frikadellen, wie jeden Freitag. Aberglaube ist das nicht, das ist Tradition.'],
  [HILDE, 'Eine Frikadelle. Freitags gönn ich mir das, das hab ich mir verdient.'],
] as const) {
  (specialtyWishes[npcId] ??= []).push({
    id: `wish.${npcId.slice(4)}-frikadellenfreitag`,
    lines: frikadelle(npcId === D ? 4 : npcId === G || npcId === M || npcId === OLE ? 2 : 1),
    when: [flag(SPECIALTY_FLAGS.cult), active(FRIDAY)],
    weight: 5,
    text,
  });
}

/** Extra regulars (Kultstatus): the guests come on Frikadellen-Freitag too. Appended to the guest's routine. */
export const specialtyRoutines: Record<string, RoutineEntry[]> = {
  [OLE]: [
    { id: 'o.frikadellenfreitag', weekdays: [4], from: h(12), to: h(14, 30), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 70, when: [active(FRIDAY)] },
  ],
  [HILDE]: [
    { id: 'h.frikadellenfreitag', weekdays: [4], from: h(11), to: h(13), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 60, when: [active(FRIDAY)] },
  ],
};

export const specialtyDialogues: DialogueDef[] = [
  // Stage 1: first attempt.
  {
    id: 'dialogue.derya.frikadelle-neu',
    npcId: D,
    priority: 4,
    once: true,
    when: [flag(SPECIALTY_FLAGS.tried), notFlag(SPECIALTY_FLAGS.sign)],
    start: 'a',
    nodes: {
      a: {
        text: 'Du machst jetzt Frikadellen? Wenn die was taugen, bring ich die Jungs von der Baustelle mit. Wenn nicht, sag ich’s dir ehrlich.',
        options: [
          opt('ehrlich', 'Ehrlich ist gut. Probier eine.', { effects: [rel(D, 2, 'k.derya.frikadelle-neu')] }),
          bye('Ich übe noch.'),
        ],
      },
    },
  },
  {
    id: 'dialogue.guenter.frikadelle-neu',
    npcId: G,
    priority: 3,
    once: true,
    when: [flag(SPECIALTY_FLAGS.tried), notFlag(SPECIALTY_FLAGS.sign)],
    start: 'a',
    nodes: {
      a: {
        text: 'Frikadellen am Büdchen. Meine Frau hat die mit eingeweichtem Brötchen gemacht, nicht mit Paniermehl. Nur so als Hinweis.',
        options: [
          opt('tipp', 'Eingeweichtes Brötchen. Merk ich mir.', { effects: [rel(G, 2, 'k.guenter.frikadelle-tipp'), mem(G, 'guenter:frikadelle-tipp')] }),
          bye('Das bleibt Betriebsgeheimnis.'),
        ],
      },
    },
  },
  // Stage 2: Geheimtipp.
  {
    id: 'dialogue.jonas.frikadelle-geheimtipp',
    npcId: J,
    priority: 4,
    once: true,
    when: [flag(SPECIALTY_FLAGS.sign)],
    start: 'a',
    nodes: {
      a: {
        text: 'Ich hab deine Frikadelle in der Fahrergruppe empfohlen. Jetzt fragen drei Kollegen, wo das Büdchen ist. Geheimtipp ist das nicht mehr lange.',
        options: [
          opt('danke', 'Danke dir. Die nächste geht auf mich.', { effects: [rel(J, 3, 'k.jonas.frikadelle')] }),
          bye('Dann mach ich mal mehr.'),
        ],
      },
    },
  },
  {
    id: 'dialogue.marlene.frikadelle-schild',
    npcId: M,
    priority: 3,
    once: true,
    when: [flag(SPECIALTY_FLAGS.sign)],
    start: 'a',
    nodes: {
      a: {
        text: 'Das Schild draußen ist neu. „Frikadelle im Brötchen“. Ordentlich geschrieben, das muss man sagen. Kreide hält aber nicht bei Regen.',
        options: [bye('Dann schreib ich’s neu.')],
      },
    },
  },
  {
    id: 'dialogue.ole.frikadelle',
    npcId: OLE,
    priority: 4,
    once: true,
    when: [flag(SPECIALTY_FLAGS.sign), active(FOOTBALL)],
    start: 'a',
    nodes: {
      a: {
        text: 'Seit ich vor dem Spiel deine Frikadelle esse, haben wir nicht mehr verloren. Zweimal. Das ist eine Serie!',
        options: [opt('serie', 'Dann darf die Serie nicht reißen.', { effects: [rel(OLE, 3, 'k.ole.frikadelle')] }), bye('Zufall.')],
      },
    },
  },
  // Stage 3: Kultstatus.
  {
    id: 'dialogue.marlene.frikadellenfreitag',
    npcId: M,
    priority: 5,
    once: true,
    when: [flag(SPECIALTY_FLAGS.cult)],
    start: 'a',
    nodes: {
      a: {
        text: 'Frikadellen-Freitag. Das steht jetzt sogar im Gemeindebrief. Ich hab nichts damit zu tun. Fast nichts.',
        options: [
          opt('danke', 'Danke, Marlene.', { effects: [rel(M, 3, 'k.marlene.frikadellenfreitag'), mem(M, 'marlene:frikadellenfreitag')] }),
          bye('Dann wird’s voll freitags.'),
        ],
      },
    },
  },
  {
    id: 'dialogue.guenter.frikadelle-kult',
    npcId: G,
    priority: 4,
    once: true,
    when: [flag(SPECIALTY_FLAGS.cult)],
    start: 'a',
    nodes: {
      a: {
        text: 'Mein Enkel will freitags nur noch hierher. Wegen der Frikadelle, nicht wegen mir. Ist in Ordnung. Ich komm mit.',
        options: [bye('Bring ihn mit.')],
      },
    },
  },
  {
    id: 'dialogue.hilde.frikadelle-kult',
    npcId: HILDE,
    priority: 4,
    once: true,
    when: [flag(SPECIALTY_FLAGS.cult)],
    start: 'a',
    nodes: {
      a: {
        text: 'Vierzig Jahre Kantine, und dann macht ein Büdchen die beste Frikadelle im Viertel. Ich bin nicht neidisch. Bisschen.',
        options: [opt('ritterschlag', 'Das nehm ich als Ritterschlag.', { effects: [rel(HILDE, 3, 'k.hilde.frikadelle')] }), bye('Danke, Hilde.')],
      },
    },
  },
];
