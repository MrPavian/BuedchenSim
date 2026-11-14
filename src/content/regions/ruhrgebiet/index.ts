import type { ContentPack } from '../../../game/types';
import { assetCatalog } from '../../assets/catalog';
import { ruhrgebietClimate } from './climate';
import { ruhrgebietCustomerLines } from './customerLines';
import { ruhrgebietDialogues } from './dialogues';
import { ruhrgebietLayout } from './layout';
import { ruhrgebietProducts } from './products';
import { ruhrgebietQuests } from './quests';
import { ruhrgebietResidents } from './residents';
import { ruhrgebietStockSlots } from './slots';

export const ruhrgebietPack: ContentPack = {
  regionId: 'region.ruhrgebiet',
  name: 'Ruhrgebiet',
  assets: assetCatalog,
  layout: ruhrgebietLayout,
  products: ruhrgebietProducts,
  stockSlots: ruhrgebietStockSlots,
  npcs: ruhrgebietResidents,
  dialogues: ruhrgebietDialogues,
  quests: ruhrgebietQuests,
  customerLines: ruhrgebietCustomerLines,
  climate: ruhrgebietClimate,
};
