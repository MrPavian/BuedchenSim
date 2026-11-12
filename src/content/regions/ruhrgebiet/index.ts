import type { ContentPack } from '../../../game/types';
import { assetCatalog } from '../../assets/catalog';
import { ruhrgebietLayout } from './layout';

export const ruhrgebietPack: ContentPack = {
  regionId: 'region.ruhrgebiet',
  name: 'Ruhrgebiet',
  assets: assetCatalog,
  layout: ruhrgebietLayout,
};
