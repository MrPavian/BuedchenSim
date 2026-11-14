import { CylinderGeometry, type Object3D } from 'three';
import type { AssetDef, ProductDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { ProductBuilder, lathe, mix } from './kit';
import { getProductMaterials } from './materials';

/**
 * Round packages (glass bottle, PET bottle, can). Built with Lathe/Cylinder around the Y axis; the radius comes
 * from the asset's width (z is scaled to the depth), all heights are fractions of the asset height so the
 * bounding box is exact. The label is a wrapped band whose centre faces +Z.
 */

/** Radial segments: 8 keep a round silhouette at the 4–10 px a bottle or can covers from the game camera (was 14). */
const SEGMENTS = 8;

function fit<T extends { scale(x: number, y: number, z: number): T }>(geometry: T, asset: AssetDef): T {
  const { width, depth } = asset.size;
  return depth === width ? geometry : geometry.scale(1, 1, depth / width);
}

function band(r: number, y0: number, y1: number): CylinderGeometry {
  return new CylinderGeometry(r, r, y1 - y0, SEGMENTS, 1, true).rotateY(Math.PI).translate(0, (y0 + y1) / 2, 0);
}

function cap(r: number, y0: number, y1: number): CylinderGeometry {
  return new CylinderGeometry(r, r * 0.97, y1 - y0, SEGMENTS).translate(0, (y0 + y1) / 2, 0);
}

/** Glass bottle with a long neck, shoulder, crown cap and a wrapped paper label (beer: amber glass, steel cap, plain label). */
export function createGlassBottle(asset: AssetDef, product: ProductDef, m: Materials): Object3D {
  const { width: w, height: H } = asset.size;
  const mat = getProductMaterials(m);
  const r = w / 2;
  const rb = r - 0.0006;
  const nr = r * 0.42;
  const beer = product.subcategory === 'beer';
  const glass = mat.plain(beer ? '#7a4a1f' : mix('#9bc2b2', product.label.primaryColor, 0.3));
  const capMat = mat.plain(beer ? '#8d897f' : product.label.accentColor);
  const body = lathe(
    [
      [0, 0],
      [rb * 0.84, 0],
      [rb * 0.97, 0.014 * H],
      [rb, 0.032 * H],
      [rb, 0.56 * H],
      [rb * 0.93, 0.62 * H],
      [rb * 0.72, 0.69 * H],
      [nr * 1.5, 0.745 * H],
      [nr * 1.1, 0.785 * H],
      [nr, 0.82 * H],
      [nr, 0.93 * H],
      [nr * 1.2, 0.94 * H],
      [nr * 1.2, 0.955 * H],
      [0, 0.955 * H],
    ],
    SEGMENTS,
  );
  const labelMat = mat.label(product, 'wrap', { layout: 'wrap', widthM: 2 * Math.PI * r, heightM: 0.49 * H, drawText: true });
  return new ProductBuilder()
    .add(glass, fit(body, asset))
    .add(labelMat, fit(band(r, 0.06 * H, 0.55 * H), asset))
    .add(capMat, fit(cap(nr * 1.38, 0.925 * H, H), asset))
    .build(asset.assetId);
}

/** PET bottle: tinted body with a petaloid base, shoulder, collar, screw cap and a wrapped label band. */
export function createPetBottle(asset: AssetDef, product: ProductDef, m: Materials): Object3D {
  const { width: w, height: H } = asset.size;
  const mat = getProductMaterials(m);
  const r = w / 2;
  const rb = r - 0.0006;
  const nr = r * 0.4;
  const liquid = mat.plain(mix(product.label.primaryColor, '#ffffff', 0.3));
  const capMat = mat.plain(product.label.accentColor);
  const body = lathe(
    [
      [0, 0.012 * H],
      [rb * 0.5, 0],
      [rb * 0.9, 0],
      [rb, 0.032 * H],
      [rb, 0.62 * H],
      [rb * 0.93, 0.67 * H],
      [rb * 0.7, 0.735 * H],
      [nr * 1.35, 0.8 * H],
      [nr * 1.05, 0.83 * H],
      [nr, 0.86 * H],
      [nr * 1.3, 0.866 * H],
      [nr * 1.3, 0.88 * H],
      [nr, 0.885 * H],
      [nr, 0.9 * H],
      [0, 0.9 * H],
    ],
    SEGMENTS,
  );
  const labelMat = mat.label(product, 'wrap', { layout: 'wrap', widthM: 2 * Math.PI * r, heightM: 0.51 * H, drawText: true });
  return new ProductBuilder()
    .add(liquid, fit(body, asset))
    .add(labelMat, fit(band(r, 0.1 * H, 0.61 * H), asset))
    .add(capMat, fit(cap(nr * 1.28, 0.89 * H, H), asset))
    .build(asset.assetId);
}

/** Can: wrapped label body, silver base ring, shoulder and recessed lid with a pull tab. */
export function createCan(asset: AssetDef, product: ProductDef, m: Materials): Object3D {
  const { width: w, height: H } = asset.size;
  const mat = getProductMaterials(m);
  const r = w / 2;
  const metal = mat.plain('#c3c7c7');
  const ring = lathe(
    [
      [0, 0],
      [r * 0.84, 0],
      [r * 0.9, 0.02 * H],
      [r * 0.98, 0.045 * H],
      [r * 0.98, 0.055 * H],
    ],
    SEGMENTS,
  );
  const top = lathe(
    [
      [r * 0.98, 0.89 * H],
      [r * 0.98, 0.915 * H],
      [r * 0.88, 0.95 * H],
      [r * 0.86, 0.972 * H],
      [r * 0.9, 0.984 * H],
      [r * 0.9, H],
      [r * 0.8, H],
      [r * 0.8, 0.984 * H],
      [0, 0.984 * H],
    ],
    SEGMENTS,
  );
  const labelMat = mat.label(product, 'wrap', { layout: 'wrap', widthM: 2 * Math.PI * r, heightM: 0.85 * H, drawText: true });
  const b = new ProductBuilder()
    .add(metal, fit(ring, asset))
    .add(metal, fit(top, asset))
    .add(labelMat, fit(band(r, 0.05 * H, 0.9 * H), asset));
  const tab = new CylinderGeometry(r * 0.3, r * 0.3, 0.014 * H, 8).scale(1, 1, 0.55).translate(0, 0.992 * H - 0.0001, 0);
  b.add(metal, tab);
  return b.build(asset.assetId);
}
