import type { ContentPack } from '../../../game/types';
import { assetCatalog } from '../../assets/catalog';
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
};
