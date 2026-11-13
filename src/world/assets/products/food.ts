import { BoxGeometry, Color, CylinderGeometry, SphereGeometry, type Object3D } from 'three';
import type { AssetDef, ProductDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { ProductBuilder, hash01, lathe, mix, paintVertices } from './kit';
import { getProductMaterials } from './materials';

/** Ice cream in a waffle cup: ridged waffle cone, paper rim/lid ring and a flat scoop dome (stackable). */
export function createIceCup(asset: AssetDef, product: ProductDef, m: Materials): Object3D {
  const { width: w, depth: d, height: H } = asset.size;
  const mat = getProductMaterials(m);
  const r = Math.min(w, d) / 2;
  const cone = lathe(
    [
      [0, 0],
      [r * 0.52, 0],
      [r * 0.97, 0.62 * H],
    ],
    14,
  );
  const rim = new CylinderGeometry(r, r * 0.98, 0.07 * H, 14).translate(0, 0.655 * H, 0);
  const scoop = new SphereGeometry(1, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2).scale(r * 0.9, 0.3 * H, r * 0.9).translate(0, 0.69 * H, 0);
  const b = new ProductBuilder()
    .add(mat.waffle('#d9a864'), cone)
    .add(mat.plain(product.label.accentColor), rim)
    .add(mat.plain(product.label.primaryColor), scoop);
  return b.build(asset.assetId);
}

/**
 * Pastry, shape chosen by proportions: a bread roll (domed, with a baked-in cut) when it is tall for its footprint,
 * otherwise a flat streusel pastry (crumbly top, light crumbs). Coloured per vertex from the label colours.
 */
export function createPastry(asset: AssetDef, product: ProductDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const mat = getProductMaterials(m);
  const crust = new Color(product.label.primaryColor);
  const crumb = new Color(product.label.accentColor);
  const dark = new Color(mix(product.label.primaryColor, '#000000', 0.45));
  const flat = h < 0.5 * Math.min(w, d);
  if (flat) {
    const geometry = new BoxGeometry(w, h, d, 14, 1, 12);
    const pos = geometry.getAttribute('position');
    for (let i = 0; i < pos.count; i += 1) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      if (pos.getY(i) > 0) {
        const bump = hash01(`${Math.round(x * 1000)},${Math.round(z * 1000)}`, 7);
        pos.setY(i, h / 2 - bump * h * 0.3);
        // Rounded edge: the rim of the top is a little lower.
        const edge = Math.max(Math.abs(x) / (w / 2), Math.abs(z) / (d / 2));
        if (edge > 0.92) pos.setY(i, pos.getY(i) - h * 0.18);
      }
    }
    geometry.computeVertexNormals();
    geometry.translate(0, h / 2, 0);
    paintVertices(geometry, (x, y, z) => {
      if (y < h * 0.45) return crust.clone().multiplyScalar(0.9);
      const n = hash01(`${Math.round(x * 400)},${Math.round(z * 400)}`, 3);
      return n > 0.45 ? crumb.clone().lerp(crust, 0.2) : crust.clone();
    });
    return new ProductBuilder().add(mat.vertexColored(), geometry).build(asset.assetId);
  }
  const geometry = new SphereGeometry(1, 26, 16).scale(w / 2, 0.6 * h, d / 2).translate(0, 0.4 * h, 0);
  const pos = geometry.getAttribute('position');
  for (let i = 0; i < pos.count; i += 1) if (pos.getY(i) < 0) pos.setY(i, 0);
  geometry.computeVertexNormals();
  paintVertices(geometry, (x, y, z) => {
    // Baked-in cut along the length on top, floury lighter crown, darker base.
    if (y > h * 0.6 && Math.abs(z) < d * 0.055) return dark.clone();
    const t = Math.min(1, y / h);
    return crust.clone().lerp(crumb, Math.max(0, t - 0.55) * 0.5).multiplyScalar(0.82 + 0.18 * t);
  });
  return new ProductBuilder().add(mat.vertexColored(), geometry).build(asset.assetId);
}
