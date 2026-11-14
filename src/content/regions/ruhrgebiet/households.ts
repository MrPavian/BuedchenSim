import type { HouseholdDef } from '../../../game/types';

/**
 * Households of the first residents (Auftrag 05, 5.6). In phase 5 everyone lives alone; the data contract already
 * covers couples, families and shared flats (a later family, e.g. the Schneiders, is added here as data: one
 * household, several residents with their own routines, purses and memories). All addresses are fictional.
 */
export const ruhrgebietHouseholds: HouseholdDef[] = [
  { id: 'household.wollny', name: 'Wollny', kind: 'single', home: 'Stellwerkstraße 2, Erdgeschoss', memberIds: ['npc.guenter'] },
  { id: 'household.aksoy', name: 'Aksoy', kind: 'single', home: 'Hinterhof 5, über der Werkstatt', memberIds: ['npc.derya'] },
  { id: 'household.pietrek', name: 'Pietrek', kind: 'single', home: 'Zechenring 14, Dachgeschoss', memberIds: ['npc.jonas'] },
  { id: 'household.hoffmann', name: 'Hoffmann', kind: 'single', home: 'Zechenring 14, erster Stock', memberIds: ['npc.marlene'] },
  { id: 'household.brinkmann', name: 'Brinkmann', kind: 'single', home: 'Am Busdepot 3', memberIds: ['npc.ole'] },
  { id: 'household.kaczmarek', name: 'Kaczmarek', kind: 'single', home: 'Kantinenweg 9', memberIds: ['npc.hilde'] },
];

/** Each resident's purse per visit (cents): enough for the usual wishes, not for everything at once. */
export const ruhrgebietPurses: Record<string, number> = {
  'npc.guenter': 1500,
  'npc.derya': 2000,
  'npc.jonas': 1500,
  'npc.marlene': 1500,
  'npc.ole': 2500,
  'npc.hilde': 1500,
};
