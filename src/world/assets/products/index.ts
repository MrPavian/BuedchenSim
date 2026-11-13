import type { Object3D } from 'three';
import type { AssetDef, PackageKind, ProductDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { createCan, createGlassBottle, createPetBottle } from './bottles';
import { createBag, createBar, createBox, createIceStick, createMagazine } from './flat';
import { createIceCup, createPastry } from './food';

/**
 * Builds the model of ONE product unit at rotation 0: pivot = bottom centre, label/front side +Z, bounding box =
 * `asset.size` (+-2 cm). The shape comes from the package kind; label colours and text from the ProductDef, so
 * products with the same package kind share a factory but never look the same.
 */
export type ProductFactory = (asset: AssetDef, product: ProductDef, m: Materials) => Object3D;

export const productFactories: Readonly<Record<PackageKind, ProductFactory>> = {
  'glass-bottle': createGlassBottle,
  'pet-bottle': createPetBottle,
  can: createCan,
  bag: createBag,
  bar: createBar,
  box: createBox,
  'ice-stick': createIceStick,
  'ice-cup': createIceCup,
  pastry: createPastry,
  magazine: createMagazine,
};

export function hasProductFactory(kind: PackageKind): boolean {
  return Object.hasOwn(productFactories, kind);
}

export function createProductModel(asset: AssetDef, product: ProductDef, m: Materials): Object3D {
  const factory = productFactories[product.package] as ProductFactory | undefined;
  if (!factory) throw new Error(`No product factory for package kind "${product.package}" (${product.id})`);
  return factory(asset, product, m);
}
