import type { Object3D } from 'three';
import type { AssetDef } from '../../../game/types';
import type { Materials } from '../../materials';
import { PartBuilder } from '../furniture/kit';
import { cylX, taper } from './geo';
import { getStreetMaterials } from './materials';

/**
 * E-008 Fahrradständer (0.7 x 0.8 x 0.8 m). Steel Anlehnbügel: two inverted-U hoops (hoop plane along X, width 0.7,
 * height 0.8) 0.72 m apart along Z, each with chamfered corners and two foot plates. A bike stands parallel to X between
 * the hoops and leans on them (two hoops = up to four places; the sidewalk strip only fits one bike, see layout).
 */
export function createBikeRackE008(asset: AssetDef, m: Materials): Object3D {
  const { width: w, depth: d, height: h } = asset.size;
  const s = getStreetMaterials(m);
  const b = new PartBuilder({ vertexColors: s.baked });
  const tube = 0.025;
  const plate = 0.04; // half size of a foot plate
  const legX = w / 2 - plate; // leg axis inside the plate
  const zs = [-(d / 2 - plate), d / 2 - plate];
  const cut = 0.1; // corner chamfer
  for (const z of zs) {
    for (const sx of [-1, 1]) {
      b.box(s.steel, sx * legX - plate, sx * legX + plate, 0, 0.012, z - plate, z + plate);
      b.geometry(s.steel, taper(tube, tube, 0.012, h - tube - cut, sx * legX, z, 8));
      b.bar(s.steel, [sx * legX, h - tube - cut, z], [sx * (legX - cut), h - tube, z], tube * 1.6);
    }
    b.geometry(s.steel, cylX(tube, -(legX - cut), legX - cut, h - tube, z));
  }
  return b.build(asset.assetId);
}
