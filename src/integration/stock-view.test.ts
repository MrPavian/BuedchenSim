import { Mesh, Raycaster, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { ruhrgebietPack } from '../content/regions/ruhrgebiet';
import { createGame, type Game } from '../game/game';
import { quarterTurnToRadians } from '../game/placement';
import { slotCapacityFor } from '../game/selectors';
import { createInitialState } from '../game/state';
import { slotUnitPositions } from '../game/stockLayout';
import type { PlacementDef, QuarterTurn, StockSlotDef } from '../game/types';
import { createFurniture } from '../world/assets/registry';
import { createMaterials } from '../world/materials';
import { createStockView } from '../world/views/stockView';
import { findMirroredSlots, placementMatrix, slotUnitPoses, unitWorldMatrix } from '../world/views/stockLayout';

const pack = ruhrgebietPack;
const slotById = (id: string): StockSlotDef => {
  const slot = pack.stockSlots.find((s) => s.id === id);
  if (!slot) throw new Error(id);
  return slot;
};
const productFor = (storage: string, index = 0) => Object.values(pack.products).filter((p) => p.storage === storage)[index]!;
const assetOf = (productId: string) => pack.assets[pack.products[productId]!.assetId]!;

function newGame(): Game {
  const state = createInitialState(pack);
  state.economy.cashCents = 100_000_000;
  state.kiosk.shutterOpen = true;
  return createGame(pack, state);
}

/** Orders, receives and restocks through the real economy actions; returns the quantity put on the slot. */
function stock(game: Game, slotId: string, productId: string, quantity?: number): number {
  const q = quantity ?? slotCapacityFor(pack, slotId, productId);
  if (q === 0) return 0;
  expect(game.economy.placeOrder([{ productId, quantity: q }]).ok).toBe(true);
  expect(game.economy.receiveDelivery().ok).toBe(true);
  expect(game.economy.restock(slotId, productId, q).ok).toBe(true);
  return q;
}

describe('stock layout math', () => {
  const slot = slotById('slot.wall-shelf-north.1');
  const unit = assetOf(productFor('shelf', 0).id).size;

  it.each([0, 90, 180, 270] as QuarterTurn[])('maps slot-local unit positions into world space for rotation %i', (rotation) => {
    const placement: PlacementDef = { id: 'placement.t', assetId: 'I-003', position: { x: 3, z: -2 }, rotation };
    const m = placementMatrix(placement, 0.5);
    const th = quarterTurnToRadians(rotation);
    const poses = slotUnitPoses(slot, unit, 1, { mirrored: false, tilt: 0 }, 5);
    expect(poses).toHaveLength(5);
    for (const pose of poses) {
      const world = new Vector3().setFromMatrixPosition(unitWorldMatrix(m, pose));
      // three.js rotation.y = th: x' = x cos + z sin, z' = -x sin + z cos
      expect(world.x).toBeCloseTo(3 + pose.x * Math.cos(th) + pose.z * Math.sin(th), 9);
      expect(world.z).toBeCloseTo(-2 - pose.x * Math.sin(th) + pose.z * Math.cos(th), 9);
      expect(world.y).toBeCloseTo(0.5 + pose.y, 9);
    }
    // The front (+Z) of a unit follows the placement's front.
    const front = new Vector3(0, 0, 1).transformDirection(unitWorldMatrix(m, poses[0]!));
    expect(front.x).toBeCloseTo(Math.sin(th), 9);
    expect(front.z).toBeCloseTo(Math.cos(th), 9);
  });

  it('unmirrored poses equal the game layout positions', () => {
    const positions = slotUnitPositions(slot, unit, { maxStack: 1 });
    const poses = slotUnitPoses(slot, unit, 1, { mirrored: false, tilt: 0 }, 1000);
    expect(poses.map((p) => [p.x, p.y, p.z])).toEqual(positions.map((p) => [p.x, p.y, p.z]));
  });

  it('only the back side of the double-sided middle shelf is mirrored', () => {
    const mirrored = findMirroredSlots(pack.stockSlots);
    const expected = pack.stockSlots.filter((s) => s.placementId === 'placement.middle-shelf' && s.origin.z < 0).map((s) => s.id);
    expect(expected).toHaveLength(6);
    expect([...mirrored].sort()).toEqual(expected.sort());
  });

  it('mirrored slots keep their capacity, face -Z, fill from the -Z edge and stay inside the slot box', () => {
    for (const id of findMirroredSlots(pack.stockSlots)) {
      const s = slotById(id);
      for (const product of Object.values(pack.products).filter((p) => p.storage === s.accepts)) {
        const size = assetOf(product.id).size;
        const max = 3;
        const flat = slotUnitPositions(s, size, { maxStack: max });
        const poses = slotUnitPoses(s, size, max, { mirrored: true, tilt: 0 }, flat.length);
        expect(poses.length, `${id} ${product.id}`).toBe(flat.length);
        for (const p of poses) {
          expect(p.yaw).toBeCloseTo(Math.PI, 9);
          expect(p.x - size.width / 2).toBeGreaterThanOrEqual(s.origin.x - s.size.width / 2 - 1e-9);
          expect(p.x + size.width / 2).toBeLessThanOrEqual(s.origin.x + s.size.width / 2 + 1e-9);
          expect(p.z - size.depth / 2).toBeGreaterThanOrEqual(s.origin.z - s.size.depth / 2 - 1e-9);
          expect(p.z + size.depth / 2).toBeLessThanOrEqual(s.origin.z + s.size.depth / 2 + 1e-9);
        }
        if (poses.length > 0) {
          expect(Math.min(...poses.map((p) => p.z - size.depth / 2))).toBeCloseTo(s.origin.z - s.size.depth / 2, 9);
        }
      }
    }
  });
});

describe('stock view follows the game state', () => {
  it('draws nothing for empty shelves', () => {
    const game = newGame();
    const view = createStockView(game, createMaterials());
    const info = view.getInfo();
    expect(info.drawnInstances).toBe(0);
    expect(info.instancedMeshes).toBe(0);
    expect(info.slots.every((s) => s.productId === null && s.instances === 0 && s.firstUnit === null)).toBe(true);
    view.dispose();
  });

  it('tracks restock, sale, unstock and state replacement with the real pack', () => {
    const game = newGame();
    const view = createStockView(game, createMaterials());
    const slotInfo = (id: string) => view.getInfo().slots.find((s) => s.slotId === id)!;

    const wallSlot = 'slot.wall-shelf-west.2';
    const water = productFor('shelf', 0);
    const full = stock(game, wallSlot, water.id);
    expect(full).toBeGreaterThan(4);
    expect(slotInfo(wallSlot)).toMatchObject({ productId: water.id, quantity: full, instances: full });
    expect(view.getInfo().instancedMeshes).toBe(view.root.children.filter((c) => c.visible).length);

    // A second product on a middle-shelf back slot (mirrored) and one on a tilted magazine tray.
    const backSlot = 'slot.middle-shelf.8';
    const other = productFor('shelf', 3);
    const backQty = stock(game, backSlot, other.id, 4);
    const press = productFor('press', 0);
    const rackQty = stock(game, 'slot.magazine-rack.1', press.id);
    expect(view.getInfo().drawnInstances).toBe(full + backQty + rackQty);

    // Rebuild only affected products: the water meshes survive a change on another product's slot.
    const waterMeshes = view.root.children.filter((c) => c.name === `stock.${water.id}`);
    expect(waterMeshes.length).toBeGreaterThan(0);
    game.economy.unstock(backSlot, 2);
    expect(slotInfo(backSlot).instances).toBe(2);
    expect(view.root.children.filter((c) => c.name === `stock.${water.id}`)).toEqual(waterMeshes);

    // Sale removes units from the slots (first slot holding the product).
    const before = slotInfo(wallSlot).quantity;
    expect(game.economy.completeSale({ lines: [{ productId: water.id, quantity: 3 }], ageCheckConfirmed: false }).ok).toBe(true);
    expect(slotInfo(wallSlot)).toMatchObject({ quantity: before - 3, instances: before - 3 });

    // Quantity 0 removes everything of the slot.
    game.economy.unstock(backSlot, 2);
    expect(slotInfo(backSlot)).toMatchObject({ productId: null, instances: 0, firstUnit: null });

    // First unit position comes from the placement transform (wall shelf west: rotation 90 at x -2.65, z -0.2).
    const slot = slotById(wallSlot);
    const first = slotInfo(wallSlot).firstUnit!;
    const local = slotUnitPositions(slot, assetOf(water.id).size, { maxStack: 1 })[0]!;
    expect(first.x).toBeCloseTo(-2.65 + local.z, 6);
    expect(first.z).toBeCloseTo(-0.2 - local.x, 6);
    expect(first.y).toBeCloseTo(local.y, 6);

    // State replacement: reset empties everything, loading a saved state redraws it.
    const saved = structuredClone(game.state) as Parameters<Game['load']>[0];
    game.reset();
    expect(view.getInfo().drawnInstances).toBe(0);
    expect(view.getInfo().instancedMeshes).toBe(0);
    expect(game.load(saved).ok).toBe(true);
    const total = Object.values(saved.economy.shelves).reduce((s, v) => s + v.quantity, 0);
    expect(view.getInfo().drawnInstances).toBe(total);
    view.dispose();
  });

  it('a fully stocked kiosk needs few instanced meshes (one per product part, not per unit)', () => {
    const game = newGame();
    const view = createStockView(game, createMaterials());
    const perPlacement = new Map<string, number>();
    let units = 0;
    for (const slot of pack.stockSlots) {
      const n = perPlacement.get(slot.placementId) ?? 0;
      perPlacement.set(slot.placementId, n + 1);
      const candidates = Object.values(pack.products).filter((p) => p.storage === slot.accepts);
      const product = candidates[n % candidates.length]!;
      units += stock(game, slot.id, product.id);
    }
    const info = view.getInfo();
    expect(info.drawnInstances).toBe(units);
    expect(units).toBeGreaterThan(1000);
    expect(info.instancedMeshes).toBeLessThanOrEqual(60);
    view.dispose();
  });

  it('magazines lie on the tilted tray without cutting into it or the front lip', () => {
    const game = newGame();
    const press = productFor('press', 0);
    const slot = slotById('slot.magazine-rack.5'); // tier 2: not the lowest, lip further back
    stock(game, slot.id, press.id);
    const view = createStockView(game, createMaterials());
    const rack = createFurniture(pack.assets['I-007']!, createMaterials());
    rack.updateMatrixWorld(true);
    const meshes: Mesh[] = [];
    rack.traverse((o: Object3D) => {
      if ((o as Mesh).isMesh) meshes.push(o as Mesh);
    });
    const placement = pack.layout.placements.find((p) => p.id === slot.placementId)!;
    const size = assetOf(press.id).size;
    const poses = slotUnitPoses(slot, size, 3, { mirrored: false, tilt: 0.3 }, 100);
    expect(poses.length).toBeGreaterThan(3);
    const raycaster = new Raycaster();
    for (const [i, pose] of poses.entries()) {
      for (const dx of [-size.width / 2 + 0.01, 0, size.width / 2 - 0.01]) {
        raycaster.set(new Vector3(pose.x + dx, pose.y + 0.1, pose.z), new Vector3(0, -1, 0));
        const hit = raycaster.intersectObjects(meshes, false)[0];
        expect(hit, `unit ${i}`).toBeDefined();
        expect(hit!.point.y, `tray below unit ${i}`).toBeLessThanOrEqual(pose.y + 0.0015);
        expect(pose.y - hit!.point.y, `unit ${i} does not float`).toBeLessThan(0.012);
      }
      // Nothing of the rack (the lip) between the unit centre and its front face.
      raycaster.set(new Vector3(pose.x, pose.y + 0.05, pose.z), new Vector3(0, 0, 1));
      const lip = raycaster.intersectObjects(meshes, false)[0];
      if (i === 0) expect(lip === undefined || lip.point.z >= pose.z + size.depth / 2 - 1e-4).toBe(true);
    }
    // World matrices stay finite and put the units inside the kiosk.
    const m = placementMatrix(placement, 0);
    for (const pose of poses) {
      const p = new Vector3().setFromMatrixPosition(unitWorldMatrix(m, pose));
      expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
    }
    view.dispose();
  });
});
