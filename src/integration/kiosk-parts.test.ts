import { Box3, Mesh, Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { ruhrgebietPack } from '../content/regions/ruhrgebiet';
import { kioskCutHeight } from '../game/kioskGeometry';
import { getKioskParts } from '../world/assets/kiosk';
import { createKiosk } from '../world/assets/registry';
import { createMaterials } from '../world/materials';

const { kiosk } = ruhrgebietPack.layout;

function build() {
  const root = createKiosk(kiosk, createMaterials());
  root.updateMatrixWorld(true);
  return { root, parts: getKioskParts(root) };
}

describe('K-001 factory (node, no canvas)', () => {
  it('builds named parts', () => {
    const { root, parts } = build();
    expect(root.name).toBe('K-001');
    expect(parts.cutHeight).toBe(kioskCutHeight(kiosk));
    expect(parts.roof).toBeInstanceOf(Object3D);
    expect(parts.door?.name).toBe('kiosk.door.leaf');
    expect(parts.flap?.name).toBe('kiosk.shutter.flap');
    expect(parts.sign).not.toBeNull();
    expect(parts.awning).not.toBeNull();
    expect(parts.cut.south.length).toBeGreaterThan(1);
    expect(parts.cut.north).toHaveLength(0);
  });

  it('door and flap animate and the building stays within its footprint plus trims when closed', () => {
    const { root, parts } = build();
    parts.animated['door']?.setOpen(1);
    parts.animated['flap']?.setOpen(1);
    expect(parts.door?.rotation.y).toBeLessThan(-1.5);
    expect(parts.flap?.rotation.x).toBeLessThan(-1.5);
    parts.animated['door']?.setOpen(0);
    parts.animated['flap']?.setOpen(0);
    root.updateMatrixWorld(true);
    const fp = kiosk.footprint;
    root.traverse((o) => {
      if (!(o as Mesh).isMesh) return;
      const b = new Box3().setFromObject(o);
      expect(b.min.x, o.name).toBeGreaterThan(fp.minX - 0.25);
      expect(b.max.x, o.name).toBeLessThan(fp.maxX + 0.25);
      expect(b.min.z, o.name).toBeGreaterThan(fp.minZ - 0.25);
      expect(b.max.z, o.name).toBeLessThan(fp.maxZ + 0.9);
      expect(b.min.y, o.name).toBeGreaterThan(-0.01);
    });
  });

  it('uses few materials/meshes (shared materials, merged walls)', () => {
    const { root } = build();
    let meshes = 0;
    root.traverse((o) => {
      if ((o as Mesh).isMesh) meshes += 1;
    });
    expect(meshes).toBeLessThan(120);
  });
});
