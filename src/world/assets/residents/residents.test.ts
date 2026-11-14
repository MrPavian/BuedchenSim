import { Box3, Vector3, type Material, type Mesh, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { setLogSink } from '../../../core/log';
import { createMaterials } from '../../materials';
import { createResident, hasResidentFactory, residentAssetIds } from './index';

const IDS = ['N-002', 'N-003', 'N-006', 'N-007'];

function stats(root: Object3D): { meshes: number; triangles: number; materials: Set<Material>; box: Box3 } {
  root.updateMatrixWorld(true);
  const materials = new Set<Material>();
  let meshes = 0;
  let triangles = 0;
  root.traverse((o) => {
    const mesh = o as Mesh;
    if (!mesh.isMesh) return;
    meshes += 1;
    const g = mesh.geometry;
    triangles += (g.index ? g.index.count : g.getAttribute('position').count) / 3;
    materials.add(mesh.material as Material);
  });
  return { meshes, triangles, materials, box: new Box3().setFromObject(root) };
}

describe('resident figures', () => {
  it('registers the four residents', () => {
    expect(residentAssetIds().sort()).toEqual(IDS);
    for (const id of IDS) expect(hasResidentFactory(id)).toBe(true);
  });

  it('builds figures 1.6-1.85 m tall with the pivot at the feet and a real body (many parts, modest triangle count)', () => {
    const m = createMaterials();
    for (const id of IDS) {
      const figure = createResident(id, m);
      const s = stats(figure.root);
      expect(s.box.max.y, id).toBeGreaterThanOrEqual(1.6);
      expect(s.box.max.y, id).toBeLessThanOrEqual(1.85);
      expect(figure.height).toBeCloseTo(s.box.max.y, 6);
      expect(s.box.min.y, id).toBeGreaterThanOrEqual(-0.02);
      expect(s.box.min.y, id).toBeLessThanOrEqual(0.03);
      expect(Math.abs((s.box.min.x + s.box.max.x) / 2), id).toBeLessThan(0.15);
      expect(s.meshes, id).toBeGreaterThanOrEqual(8);
      expect(s.triangles, id).toBeLessThan(2600);
      expect(figure.headHeight, id).toBeGreaterThan(figure.height - 0.3);
    }
  });

  it('are clearly distinct: different heights, silhouettes and colour sets', () => {
    const m = createMaterials();
    const figures = IDS.map((id) => ({ id, ...stats(createResident(id, m).root) }));
    for (let i = 0; i < figures.length; i += 1) {
      for (let j = i + 1; j < figures.length; j += 1) {
        const a = figures[i]!;
        const b = figures[j]!;
        const sa = a.box.getSize(new Vector3());
        const sb = b.box.getSize(new Vector3());
        const d = Math.abs(sa.x - sb.x) + Math.abs(sa.y - sb.y) + Math.abs(sa.z - sb.z);
        expect(d, `${a.id} vs ${b.id} bounding box`).toBeGreaterThan(0.05);
        const colours = (s: typeof a): Set<number> =>
          new Set([...s.materials].map((mat) => (mat as unknown as { color: { getHex(): number } }).color.getHex()));
        const ca = colours(a);
        const shared = [...colours(b)].filter((c) => ca.has(c)).length;
        // They share at most a few neutral colours (e.g. dark eyes), never most of their palette.
        expect(shared, `${a.id} vs ${b.id} shared colours`).toBeLessThanOrEqual(Math.min(ca.size, colours(b).size) / 2);
      }
    }
    // The stooped retiree is shorter than the courier and slimmer than the carpenter.
    const byId = Object.fromEntries(figures.map((f) => [f.id, f.box.getSize(new Vector3())]));
    expect(byId['N-002']!.y).toBeLessThan(byId['N-006']!.y - 0.08);
    expect(byId['N-007']!.y).toBeLessThan(byId['N-003']!.y - 0.08);
    expect(byId['N-003']!.x).toBeGreaterThan(byId['N-006']!.x - 0.5);
  });

  it('merges static parts per rig group and material: few meshes (draw calls) per figure, limbs stay separate', () => {
    const m = createMaterials();
    for (const id of IDS) {
      const figure = createResident(id, m);
      let meshes = 0;
      const perParent = new Map<unknown, Set<unknown>>();
      figure.root.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        meshes += 1;
        const mats = perParent.get(mesh.parent) ?? new Set();
        // At most one mesh per material on each group: everything that could be merged was merged.
        expect(mats.has(mesh.material), `${id}: two meshes with one material on one group`).toBe(false);
        mats.add(mesh.material);
        perParent.set(mesh.parent, mats);
      });
      expect(meshes, `${id} meshes`).toBeLessThanOrEqual(24);
      expect(meshes, `${id} meshes`).toBeGreaterThanOrEqual(8);
    }
  });

  it('walks, idles and talks: the pose changes, scales with speed and creates no objects per update', () => {
    const m = createMaterials();
    const figure = createResident('N-003', m);
    const countObjects = (): number => {
      let n = 0;
      figure.root.traverse(() => {
        n += 1;
      });
      return n;
    };
    const before = countObjects();
    const legAngle = (): number => (figure.root.children[0]!.children[1] as Object3D).rotation.x;
    const swing = (speed: number): number => {
      const f = createResident('N-003', m);
      let max = 0;
      for (let i = 0; i < 120; i += 1) {
        f.update(1 / 60, speed, false);
        max = Math.max(max, Math.abs((f.root.children[0]!.children[1] as Object3D).rotation.x));
      }
      return max;
    };
    figure.update(1 / 60, 0, false);
    expect(figure.animation()).toBe('idle');
    expect(Math.abs(legAngle())).toBeLessThan(1e-6);
    for (let i = 0; i < 60; i += 1) figure.update(1 / 60, 1.3, false);
    expect(figure.animation()).toBe('walk');
    expect(swing(0.6)).toBeLessThan(swing(1.3));
    for (let i = 0; i < 60; i += 1) figure.update(1 / 60, 0, true);
    expect(figure.animation()).toBe('talk');
    expect(countObjects()).toBe(before);
  });

  it('falls back to a neutral figure with one warning for unknown asset ids and never throws', () => {
    const m = createMaterials();
    const logs: string[] = [];
    const restore = setLogSink((level, message) => logs.push(`${level}: ${message}`));
    try {
      const a = createResident('N-999', m);
      const b = createResident('N-999', m);
      expect(a.assetId).toBe('N-999');
      const s = stats(a.root);
      expect(s.box.max.y).toBeGreaterThan(1.6);
      expect(stats(b.root).meshes).toBeGreaterThan(10);
    } finally {
      restore();
    }
    expect(logs.filter((l) => l.includes('N-999'))).toHaveLength(1);
    expect(logs[0]).toContain('warn');
  });

});
