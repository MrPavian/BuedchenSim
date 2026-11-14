import type { NpcDef, RoutineEntry, WishDef } from '../../../game/types';

/**
 * Guest visitors (Auftrag 05, 5.3): they only come on event days (every routine entry requires an active event), so the
 * four residents' days stay as they were. Figures: GLB models N-008 and N-009 built with the same pipeline. All names
 * are fictional; "SV Grubenlicht 09" is an invented club.
 */

const WEEK: RoutineEntry['weekdays'] = [0, 1, 2, 3, 4, 5, 6];
const h = (hours: number, minutes = 0): number => hours * 60 + minutes;
const FOOTBALL = 'event.fussballspieltag';
const FEST = 'event.strassenfest';
const FLEA = 'event.flohmarkt';
const XMAS = 'event.weihnachtszeit';

export const OLE = 'npc.ole';
export const HILDE = 'npc.hilde';

const oleWishes: WishDef[] = [
  {
    id: 'wish.ole-vorglühen',
    lines: [
      { productId: 'product.puettbraeu-pils', quantity: 2 },
      { productId: 'product.naschwerk-chips-paprika', quantity: 1 },
    ],
    when: [{ type: 'eventActive', eventId: FOOTBALL }, { type: 'time', from: h(11), to: h(15) }],
    weight: 4,
    text: 'Zwei Pils und Chips. Heute holen wir die drei Punkte, ich spür das im Knie.',
  },
  {
    id: 'wish.ole-schachtbier',
    lines: [{ productId: 'product.puettbraeu-schachtbier-dose', quantity: 2 }],
    when: [{ type: 'eventActive', eventId: FOOTBALL }],
    weight: 2,
    text: 'Zwei Schachtbier für die Kurve. Dosen, wegen der Taschenkontrolle.',
  },
  {
    id: 'wish.ole-fest',
    lines: [
      { productId: 'product.ruhrbrause-brause-klassik', quantity: 2 },
      { productId: 'product.eiskumpel-stieleis-himbeere', quantity: 1 },
    ],
    when: [{ type: 'eventActive', eventId: FEST }],
    weight: 3,
    text: 'Zwei Brause und ein Himbeereis. Meine Nichte steht am Kinderschminken und will Nachschub.',
  },
];

const hildeWishes: WishDef[] = [
  {
    id: 'wish.hilde-flohmarkt',
    lines: [
      { productId: 'product.pottbaecker-broetchen', quantity: 2 },
      { productId: 'product.ruhrbrause-wasser-still', quantity: 1 },
    ],
    when: [{ type: 'eventActive', eventId: FLEA }],
    weight: 3,
    text: 'Zwei Brötchen und ein Wasser. Seit halb sechs steh ich am Tisch, die Sammler kommen ja immer im Dunkeln.',
  },
  {
    id: 'wish.hilde-echo',
    lines: [{ productId: 'product.halden-echo-lokalblatt', quantity: 1 }],
    when: [{ type: 'eventActive', eventId: FLEA }],
    weight: 1,
    text: 'Das Echo. Die Kleinanzeigen, ich muss wissen, wer seine Keller räumt.',
  },
  {
    id: 'wish.hilde-advent',
    lines: [
      { productId: 'product.naschwerk-sahnebonbons', quantity: 2 },
      { productId: 'product.naschwerk-vollmilch', quantity: 1 },
    ],
    when: [{ type: 'eventActive', eventId: XMAS }],
    weight: 3,
    text: 'Zweimal Sahnebonbons und eine Vollmilch. Für die Enkel, die kriegen sonst nur Gutscheine.',
  },
];

export const ruhrgebietGuests: Record<string, NpcDef> = {
  [OLE]: {
    id: OLE,
    name: 'Ole Brinkmann',
    age: 34,
    role: 'Fan des SV Grubenlicht 09, Busfahrer',
    bio:
      'Ole fährt unter der Woche die Linie 365 und am Heimspieltag im Blau-Gold-Schal mit dem Rad zum Platz. ' +
      'Laut, herzlich, abergläubisch: Er kauft vor jedem Spiel am selben Büdchen dasselbe. Beim Straßenfest hilft er am Grill.',
    assetId: 'N-008',
    personalityTags: ['laut', 'herzlich', 'abergläubisch', 'treu'],
    walkSpeed: 1.3,
    startRelationship: 10,
    homeExitPlaceId: 'place.exit-east',
    routine: [
      { id: 'o.vor-dem-spiel', weekdays: [5], from: h(11, 30), to: h(14, 30), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 90, when: [{ type: 'eventActive', eventId: FOOTBALL }] },
      { id: 'o.nach-dem-spiel', weekdays: [5], from: h(17, 30), to: h(19, 30), activity: 'linger', placeId: 'place.corner', chancePercent: 80, when: [{ type: 'eventActive', eventId: FOOTBALL }] },
      { id: 'o.fest', weekdays: WEEK, from: h(12), to: h(17), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 75, when: [{ type: 'eventActive', eventId: FEST }] },
    ],
    likes: ['product.puettbraeu-pils', 'tag:matchday', 'product.naschwerk-chips-paprika'],
    dislikes: ['product.knobelschacht-raetselheft'],
    relationships: [
      { npcId: 'npc.guenter', kind: 'Stammtisch an der Ecke', note: 'Streitet mit ihm über die Aufstellung von 1977.' },
      { npcId: 'npc.jonas', kind: 'Fahrgast', note: 'Jonas schmuggelt sein Rad manchmal in Oles Bus.' },
    ],
    dialogueIds: [],
    wishes: oleWishes,
  },
  [HILDE]: {
    id: HILDE,
    name: 'Hilde Kaczmarek',
    age: 66,
    role: 'Trödelhändlerin vom Flohmarkt im Hof',
    bio:
      'Hilde hat vierzig Jahre in der Kantine der Zeche gestanden und verkauft heute am ersten Sonntag im Monat Geschirr, ' +
      'Schallplatten und Geschichten. Feilscht gern, verschenkt noch lieber. In der Adventszeit kommt sie samstags vorbei.',
    assetId: 'N-009',
    personalityTags: ['geschäftstüchtig', 'großzügig', 'gesprächig', 'resolut'],
    walkSpeed: 1.0,
    startRelationship: 15,
    homeExitPlaceId: 'place.exit-hof',
    routine: [
      { id: 'h.flohmarkt', weekdays: [6], from: h(7, 30), to: h(11), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 90, when: [{ type: 'eventActive', eventId: FLEA }] },
      { id: 'h.advent', weekdays: [5], from: h(10), to: h(12, 30), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 80, when: [{ type: 'eventActive', eventId: XMAS }] },
    ],
    likes: ['product.naschwerk-sahnebonbons', 'product.halden-echo-lokalblatt', 'tag:sweet'],
    dislikes: ['product.zechenblitz-energy'],
    relationships: [
      { npcId: 'npc.marlene', kind: 'Organisation Flohmarkt', note: 'Marlene meldet den Flohmarkt beim Amt an, Hilde bringt die Tische.' },
      { npcId: 'npc.guenter', kind: 'Alte Bekannte', note: 'Kennt ihn noch aus der Kantine, als er mittags vom Stellwerk kam.' },
    ],
    dialogueIds: [],
    wishes: hildeWishes,
  },
};
