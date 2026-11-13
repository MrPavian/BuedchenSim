import { BoxGeometry, type Object3D, PlaneGeometry } from 'three';
import type { AssetDef, ProductDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { ProductBuilder, mix, pillowGeometry } from './kit';
import { getProductMaterials } from './materials';

/** Text on a label only where the front is wide enough to be read at game camera distance. */
const readable = (widthM: number): boolean => widthM >= 0.06;

/** Pillow bag (chips, nuts, gummies, pouch): crimped seams top and bottom, label on the pillow. */
export function createBag(asset: AssetDef, product: ProductDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const mat = getProductMaterials(m);
  const label = mat.label(product, 'front', { layout: 'front', widthM: w, heightM: h, drawText: readable(w), crimp: 0.1 });
  return new ProductBuilder().add(label, pillowGeometry(w, h, d)).build(asset.assetId);
}

/** Chocolate bar lying flat: foil slab with a printed paper sleeve around the middle (label on the top face). */
export function createBar(asset: AssetDef, product: ProductDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const mat = getProductMaterials(m);
  const foil = mat.plain(mix(product.label.accentColor, '#9c9a94', 0.55));
  const sleeveW = w * 0.66;
  const sleeve = mat.label(product, 'sleeve', { layout: 'front', widthM: sleeveW, heightM: d, drawText: true });
  return new ProductBuilder()
    .add(foil, new BoxGeometry(w, h * 0.86, d * 0.96).translate(0, (h * 0.86) / 2, 0))
    .add(sleeve, new BoxGeometry(sleeveW, h, d).translate(0, h / 2, 0))
    .build(asset.assetId);
}

/** Small carton/tin/card (gum tin, tissues, batteries, lighter card, cigarette pack): a box with a printed front. */
export function createBox(asset: AssetDef, product: ProductDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const mat = getProductMaterials(m);
  const lid = product.category === 'sweet' ? 0.2 : product.subcategory === 'tobacco' ? 0.3 : undefined;
  const label = mat.label(product, 'front', {
    layout: 'front',
    widthM: w,
    heightM: h,
    drawText: readable(w),
    ...(lid !== undefined ? { lidLine: lid } : {}),
  });
  return new ProductBuilder().add(label, new BoxGeometry(w, h, d).translate(0, h / 2, 0)).build(asset.assetId);
}

/** Wrapped ice lolly: pillow wrapper on the bottom part, a flat wooden stick sticking out at the top. */
export function createIceStick(asset: AssetDef, product: ProductDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const mat = getProductMaterials(m);
  const wrapperH = h * 0.84;
  const label = mat.label(product, 'front', { layout: 'front', widthM: w, heightM: wrapperH, drawText: readable(w), crimp: 0.09 });
  const wood = mat.plain('#d9bb8a');
  const stickW = Math.max(0.012, w * 0.28);
  return new ProductBuilder()
    .add(label, pillowGeometry(w, wrapperH, d, 0.2, 0.3))
    .add(wood, new BoxGeometry(stickW, h - wrapperH * 0.94, Math.min(d * 0.14, 0.006)).translate(0, wrapperH * 0.94 + (h - wrapperH * 0.94) / 2, 0))
    .build(asset.assetId);
}

/** Upright magazine: paper block, printed cover facing +Z, plain back cover. */
export function createMagazine(asset: AssetDef, product: ProductDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const mat = getProductMaterials(m);
  const cover = mat.label(product, 'cover', { layout: 'front', widthM: w, heightM: h, drawText: true, cover: true });
  const back = mat.plain(mix(product.label.primaryColor, '#000000', 0.2));
  const paper = mat.plain('#e8e1cd');
  return new ProductBuilder()
    .add(paper, new BoxGeometry(w - 0.002, h - 0.002, Math.max(d - 0.0008, 0.002)).translate(0, h / 2, 0))
    .add(cover, new PlaneGeometry(w, h).translate(0, h / 2, d / 2))
    .add(back, new PlaneGeometry(w, h).rotateY(Math.PI).translate(0, h / 2, -d / 2))
    .build(asset.assetId);
}
