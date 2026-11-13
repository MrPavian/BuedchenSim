import { MeshLambertMaterial, type Texture } from 'three';
import type { ProductDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { createLabelTexture, createWaffleTexture, type LabelArt } from './labelTexture';
import { hash01 } from './kit';

/**
 * Materials of the product models. They are shared per `Materials` set: neutral parts (caps, glass, foil, wood)
 * by colour, label materials per product. Textures are owned by `Materials.textures` and released with it.
 */
export interface ProductMaterials {
  /** Flat lambert material by CSS colour (shared). */
  plain(color: string): MeshLambertMaterial;
  /** Textured label material of one product and variant (texture only in the browser; flat primary colour otherwise). */
  label(product: ProductDef, variant: string, art: Omit<LabelArt, 'primary' | 'accent' | 'text' | 'brand' | 'sober' | 'style'>): MeshLambertMaterial;
  /** Lambert material that reads vertex colours (pastry). */
  vertexColored(): MeshLambertMaterial;
  /** Waffle-grid material for ice cups (flat colour without a DOM). */
  waffle(base: string): MeshLambertMaterial;
}

const cache = new WeakMap<Materials, ProductMaterials>();

export function getProductMaterials(base: Materials): ProductMaterials {
  const hit = cache.get(base);
  if (hit) return hit;
  const plains = new Map<string, MeshLambertMaterial>();
  const labels = new Map<string, MeshLambertMaterial>();
  let vertex: MeshLambertMaterial | null = null;
  const waffles = new Map<string, MeshLambertMaterial>();
  const own = (t: Texture | null): Texture | null => {
    if (t) base.textures.push(t);
    return t;
  };
  const out: ProductMaterials = {
    plain(color) {
      let m = plains.get(color);
      if (!m) {
        m = new MeshLambertMaterial({ color });
        plains.set(color, m);
      }
      return m;
    },
    label(product, variant, art) {
      const key = `${product.id}|${variant}`;
      let m = labels.get(key);
      if (!m) {
        const sober = product.subcategory === 'beer' || product.subcategory === 'tobacco';
        const full: LabelArt = {
          ...art,
          primary: product.label.primaryColor,
          accent: product.label.accentColor,
          text: product.label.text,
          brand: product.brand,
          sober,
          style: Math.floor(hash01(product.id) * 4),
        };
        const texture = own(createLabelTexture(full));
        m = texture ? new MeshLambertMaterial({ map: texture }) : new MeshLambertMaterial({ color: product.label.primaryColor });
        labels.set(key, m);
      }
      return m;
    },
    vertexColored() {
      vertex ??= new MeshLambertMaterial({ vertexColors: true });
      return vertex;
    },
    waffle(color) {
      let m = waffles.get(color);
      if (!m) {
        const texture = own(createWaffleTexture(color));
        if (texture) texture.repeat.set(7, 1.6);
        m = texture ? new MeshLambertMaterial({ map: texture }) : new MeshLambertMaterial({ color });
        waffles.set(color, m);
      }
      return m;
    },
  };
  cache.set(base, out);
  return out;
}
