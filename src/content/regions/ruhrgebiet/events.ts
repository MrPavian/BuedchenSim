import type { EventDef } from '../../../game/eventCalendar';

/**
 * The first five neighbourhood events (Auftrag 05, 2.4). All names, clubs and decorations are fictional: the local
 * club is the invented "SV Grubenlicht 09" (colours blue and gold); no real club, league or brand.
 */
export const ruhrgebietEvents: EventDef[] = [
  {
    id: 'event.fussballspieltag',
    name: 'Heimspiel SV Grubenlicht 09',
    description:
      'Der SV Grubenlicht spielt zu Hause. Ab mittags ziehen Fans in Blau-Gold am Büdchen vorbei, nach dem Abpfiff wird an der Ecke gefachsimpelt.',
    // Every second Saturday, from the first Saturday of the game (12 June 2027).
    schedule: { kind: 'everyNthWeek', weekday: 5, everyWeeks: 2, first: { year: 2027, month: 6, dayOfMonth: 12 } },
    hours: { from: 11 * 60, to: 20 * 60 },
    announceDays: 7,
    productGroups: ['Bier', 'Kaltgetränke', 'Knabbereien'],
    demand: { 'tag:matchday': 30, 'tag:thirst': 10, 'category:snack': 15 },
    visitorBonus: 15,
    decoration: 'decor.football',
    memory: 'erlebt:heimspiel',
  },
  {
    id: 'event.strassenfest',
    name: 'Straßenfest Am Eck',
    description:
      'Die Nachbarschaft feiert: Wimpelketten, Tische auf dem Gehweg, Musik aus dem Hinterhof. Viele bleiben länger als geplant.',
    // Second Saturday and Sunday of August.
    schedule: { kind: 'yearlyNthWeekday', month: 8, weekday: 5, nth: 2, durationDays: 2 },
    hours: { from: 11 * 60, to: 22 * 60 },
    announceDays: 14,
    productGroups: ['Getränke', 'Eis', 'Süßes', 'Backwaren'],
    demand: { 'category:drink': 15, 'category:icecream': 15, 'category:sweet': 10, 'category:bakery': 10 },
    visitorBonus: 20,
    decoration: 'decor.streetfest',
    memory: 'erlebt:strassenfest',
  },
  {
    id: 'event.flohmarkt',
    name: 'Flohmarkt im Hof',
    description: 'Am ersten Sonntag im Monat stehen Tapeziertische im Hof. Früh am Morgen kommen die Sammler, später die Familien.',
    // First Sunday of April to October.
    schedule: { kind: 'monthlyNthWeekday', weekday: 6, nth: 1, months: [4, 5, 6, 7, 8, 9, 10] },
    hours: { from: 7 * 60, to: 15 * 60 },
    announceDays: 7,
    productGroups: ['Brötchen und Gebäck', 'Getränke', 'Zeitungen'],
    demand: { 'tag:morning': 15, 'category:bakery': 15, 'category:drink': 10, 'category:press': 10 },
    visitorBonus: 15,
    decoration: 'decor.fleamarket',
    memory: 'erlebt:flohmarkt',
  },
  {
    id: 'event.weihnachtszeit',
    name: 'Weihnachtszeit',
    description: 'Lichterketten am Büdchen, Tannengrün an der Tür. Die Leute bleiben auf einen Plausch stehen und kaufen Süßes für die Lieben.',
    schedule: { kind: 'dateRange', from: { month: 12, dayOfMonth: 1 }, to: { month: 12, dayOfMonth: 24 } },
    announceDays: 14,
    productGroups: ['Süßes', 'Backwaren', 'Alltagsbedarf'],
    demand: { 'category:sweet': 20, 'category:bakery': 10, 'category:everyday': 10, 'tag:cold': -10 },
    visitorBonus: 10,
    decoration: 'decor.christmas',
    memory: 'erlebt:weihnachtszeit',
  },
  {
    id: 'event.hitzewelle',
    name: 'Hitzewelle',
    description: 'Mindestens drei Tage über 30 Grad. Wer kann, bleibt im Schatten; Eis und kalte Getränke gehen weg wie nichts.',
    schedule: { kind: 'heatwave', minHigh: 30, minDays: 3 },
    announceDays: 2,
    productGroups: ['Eis', 'Kaltgetränke'],
    demand: { 'category:icecream': 35, 'tag:cold': 30, 'tag:thirst': 20, 'category:bakery': -10 },
    visitorBonus: 0,
    decoration: 'decor.heatwave',
    memory: 'erlebt:hitzewelle',
  },
];
