import type { ContentPack } from '../../../game/types';
import { assetCatalog } from '../../assets/catalog';
import { ruhrgebietClimate } from './climate';
import { ruhrgebietCustomerLines } from './customerLines';
import { ruhrgebietRecipes, ruhrgebietSpecialties, specialtyProducts } from './specialty';
import { ruhrgebietDemand } from './demand';
import { ruhrgebietEvents } from './events';
import { ruhrgebietDialogues } from './dialogues';
import { worldDialogues } from './dialoguesWorld';
import { ruhrgebietGuests } from './guests';
import { ruhrgebietHouseholds, ruhrgebietPurses } from './households';
import { ruhrgebietLayout } from './layout';
import { ruhrgebietProducts } from './products';
import { ruhrgebietQuests } from './quests';
import { ruhrgebietResidents } from './residents';
import { ruhrgebietStockSlots } from './slots';
import { frikadellenFreitag, specialtyDialogues, specialtyRoutines, specialtyWishes } from './specialtySocial';

const extraDialogues = [...worldDialogues, ...specialtyDialogues];

/** Residents and guests, each with the weather/event/specialty dialogues, wishes and routines added. */
const npcs = Object.fromEntries(
  Object.entries({ ...ruhrgebietResidents, ...ruhrgebietGuests }).map(([id, def]) => [
    id,
    {
      ...def,
      householdId: ruhrgebietHouseholds.find((h) => h.memberIds.includes(id))?.id,
      purseCents: ruhrgebietPurses[id],
      routine: [...def.routine, ...(specialtyRoutines[id] ?? [])],
      wishes: [...(def.wishes ?? []), ...(specialtyWishes[id] ?? [])],
      dialogueIds: [...def.dialogueIds, ...extraDialogues.filter((d) => d.npcId === id).map((d) => d.id)],
    },
  ]),
);

export const ruhrgebietPack: ContentPack = {
  regionId: 'region.ruhrgebiet',
  name: 'Ruhrgebiet',
  assets: assetCatalog,
  layout: ruhrgebietLayout,
  products: { ...ruhrgebietProducts, ...Object.fromEntries(specialtyProducts.map((p) => [p.id, p])) },
  stockSlots: ruhrgebietStockSlots,
  npcs,
  dialogues: { ...ruhrgebietDialogues, ...Object.fromEntries(extraDialogues.map((d) => [d.id, d])) },
  quests: ruhrgebietQuests,
  customerLines: ruhrgebietCustomerLines,
  climate: ruhrgebietClimate,
  events: [...ruhrgebietEvents, frikadellenFreitag],
  demand: ruhrgebietDemand,
  recipes: ruhrgebietRecipes,
  specialties: ruhrgebietSpecialties,
  households: ruhrgebietHouseholds,
};
