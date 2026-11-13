import type { ContentPack } from '../../../game/types';
import { assetCatalog } from '../../assets/catalog';
import { ruhrgebietCustomerLines } from './customerLines';
import { ruhrgebietLayout } from './layout';
import { ruhrgebietProducts } from './products';
import { ruhrgebietStockSlots } from './slots';

export const ruhrgebietPack: ContentPack = {
  regionId: 'region.ruhrgebiet',
  name: 'Ruhrgebiet',
  assets: assetCatalog,
  layout: ruhrgebietLayout,
  products: ruhrgebietProducts,
  stockSlots: ruhrgebietStockSlots,
  // Residents, dialogues and quests: stage 2 of phase 4.
  npcs: {},
  dialogues: {},
  quests: {},
  customerLines: ruhrgebietCustomerLines,
};
