import type { ContentPack } from '../../../game/types';
import { assetCatalog } from '../../assets/catalog';
import { ruhrgebietClimate } from './climate';
import { ruhrgebietCustomerLines } from './customerLines';
import { ruhrgebietDemand } from './demand';
import { ruhrgebietEvents } from './events';
import { ruhrgebietDialogues } from './dialogues';
import { worldDialogues } from './dialoguesWorld';
import { ruhrgebietGuests } from './guests';
import { ruhrgebietLayout } from './layout';
import { ruhrgebietProducts } from './products';
import { ruhrgebietQuests } from './quests';
import { ruhrgebietResidents } from './residents';
import { ruhrgebietStockSlots } from './slots';

/** Residents and guests, each with the weather/event dialogues added to its dialogue list. */
const npcs = Object.fromEntries(
  Object.entries({ ...ruhrgebietResidents, ...ruhrgebietGuests }).map(([id, def]) => [
    id,
    { ...def, dialogueIds: [...def.dialogueIds, ...worldDialogues.filter((d) => d.npcId === id).map((d) => d.id)] },
  ]),
);

export const ruhrgebietPack: ContentPack = {
  regionId: 'region.ruhrgebiet',
  name: 'Ruhrgebiet',
  assets: assetCatalog,
  layout: ruhrgebietLayout,
  products: ruhrgebietProducts,
  stockSlots: ruhrgebietStockSlots,
  npcs,
  dialogues: { ...ruhrgebietDialogues, ...Object.fromEntries(worldDialogues.map((d) => [d.id, d])) },
  quests: ruhrgebietQuests,
  customerLines: ruhrgebietCustomerLines,
  climate: ruhrgebietClimate,
  events: ruhrgebietEvents,
  demand: ruhrgebietDemand,
};
