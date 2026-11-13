import { Group, InstancedMesh, Matrix4, Mesh, Vector3, type BufferGeometry, type Material } from 'three';
import { log } from '../../core/log';
import { placementBaseHeight } from '../../game/placement';
import type { Game } from '../../game/game';
import { findProduct } from '../../game/selectors';
import { productMaxStack } from '../../game/stockLayout';
import type { PlacementDef, ProductDef, StockSlotDef } from '../../game/types';
import { furnitureSurfaceTilt } from '../assets/furniture';
import { createProductModel } from '../assets/registry';
import type { Materials } from '../materials';
import { findMirroredSlots, placementMatrix, slotUnitPoses, unitWorldMatrix, type SlotFrame } from './stockLayout';

export interface StockSlotInfo {
  slotId: string;
  /** Product drawn in the slot (null = empty slot, nothing drawn). */
  productId: string | null;
  /** Units the game state holds in the slot. */
  quantity: number;
  /** Instances actually written into the instanced meshes for this slot (equals `quantity` unless the slot cannot show them all). */
  instances: number;
  /** World position (bottom centre) of the first unit as stored in the instanced mesh; null when nothing is drawn. */
  firstUnit: { x: number; y: number; z: number } | null;
}

export interface StockInfo {
  slots: StockSlotInfo[];
  /** Total drawn unit instances. */
  drawnInstances: number;
  /** Visible InstancedMesh objects (draw calls caused by stock, before culling). */
  instancedMeshes: number;
}

export interface StockView {
  root: Group;
  getInfo(): StockInfo;
  dispose(): void;
}

interface SlotEntry {
  slot: StockSlotDef;
  placement: PlacementDef;
  frame: SlotFrame;
  frameMatrix: Matrix4;
  productId: string | null;
  quantity: number;
  matrices: Matrix4[];
  /** First instance index inside the product's meshes and number of instances (set by `rebuildProduct`). */
  start: number;
  count: number;
}

interface ProductModel {
  parts: Array<{ geometry: BufferGeometry; material: Material }>;
  meshes: InstancedMesh[];
  capacity: number;
  size: { width: number; depth: number; height: number };
}

const MIN_CAPACITY = 32;

const nextPow2 = (n: number): number => 2 ** Math.ceil(Math.log2(Math.max(n, 1)));

/**
 * Draws `game.state.economy.shelves`: for every occupied slot the first `quantity` unit positions of
 * `slotUnitPositions` (the same function the game uses for capacity), moved by the slot's placement transform.
 * One InstancedMesh per mesh part of a product model holds all units of that product on all slots, so a fully
 * stocked kiosk costs a few dozen draw calls. Updates only on `product.stock.changed` / `game.state.replaced`,
 * and only the products of slots that actually changed are rebuilt. Units neither cast nor receive shadows.
 */
export function createStockView(game: Game, materials: Materials): StockView {
  const content = game.content;
  const root = new Group();
  root.name = 'stock';

  const mirrored = findMirroredSlots(content.stockSlots);
  const placements = new Map<string, { placement: PlacementDef; matrix: Matrix4; assetId: string }>();
  for (const placement of content.layout.placements) {
    placements.set(placement.id, {
      placement,
      matrix: placementMatrix(placement, placementBaseHeight(placement, content.layout, content.assets)),
      assetId: placement.assetId,
    });
  }

  const entries: SlotEntry[] = [];
  for (const slot of content.stockSlots) {
    const host = placements.get(slot.placementId);
    if (!host) {
      log.warn(`Stock slot "${slot.id}" references unknown placement "${slot.placementId}"; it is never drawn`);
      continue;
    }
    entries.push({
      slot,
      placement: host.placement,
      frame: { mirrored: mirrored.has(slot.id), tilt: furnitureSurfaceTilt(host.assetId) },
      frameMatrix: host.matrix,
      productId: null,
      quantity: 0,
      matrices: [],
      start: 0,
      count: 0,
    });
  }

  const models = new Map<string, ProductModel>();
  const tmp = new Matrix4();

  const modelFor = (product: ProductDef): ProductModel | null => {
    const hit = models.get(product.id);
    if (hit) return hit;
    const asset = Object.hasOwn(content.assets, product.assetId) ? content.assets[product.assetId] : undefined;
    if (!asset) {
      log.warn(`Product "${product.id}" references unknown asset "${product.assetId}"; its stock is not drawn`);
      return null;
    }
    const built = createProductModel(asset, product, materials);
    const parts: ProductModel['parts'] = [];
    built.traverse((o) => {
      const mesh = o as Mesh;
      if (mesh.isMesh) parts.push({ geometry: mesh.geometry, material: mesh.material as Material });
    });
    const model: ProductModel = { parts, meshes: [], capacity: 0, size: asset.size };
    models.set(product.id, model);
    return model;
  };

  const releaseMeshes = (model: ProductModel): void => {
    for (const mesh of model.meshes) {
      root.remove(mesh);
      mesh.dispose(); // frees the instance buffer only; geometry and material stay shared with the model
    }
    model.meshes = [];
  };

  const rebuildProduct = (productId: string): void => {
    const product = findProduct(content, productId);
    const used = entries.filter((e) => e.productId === productId && e.matrices.length > 0);
    const total = used.reduce((sum, e) => sum + e.matrices.length, 0);
    const model = product ? modelFor(product) : models.get(productId);
    if (!model) return;
    if (total === 0) {
      for (const mesh of model.meshes) {
        mesh.count = 0;
        mesh.visible = false;
      }
      for (const e of entries) if (e.productId === productId) Object.assign(e, { start: 0, count: 0 });
      return;
    }
    if (total > model.capacity || model.meshes.length === 0) {
      releaseMeshes(model);
      model.capacity = Math.max(MIN_CAPACITY, nextPow2(total));
      for (const part of model.parts) {
        const mesh = new InstancedMesh(part.geometry, part.material, model.capacity);
        mesh.name = `stock.${productId}`;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        root.add(mesh);
        model.meshes.push(mesh);
      }
    }
    let index = 0;
    for (const e of used) {
      e.start = index;
      e.count = e.matrices.length;
      for (const matrix of e.matrices) {
        for (const mesh of model.meshes) mesh.setMatrixAt(index, matrix);
        index += 1;
      }
    }
    for (const mesh of model.meshes) {
      mesh.count = total;
      mesh.visible = true;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  };

  /** Brings every slot in line with the state and rebuilds only the products whose slots changed. */
  const sync = (): void => {
    const touched = new Set<string>();
    const shelves = game.state.economy.shelves;
    for (const entry of entries) {
      const stock = Object.hasOwn(shelves, entry.slot.id) ? shelves[entry.slot.id] : undefined;
      let productId: string | null = null;
      let quantity = 0;
      if (stock && Number.isFinite(stock.quantity) && stock.quantity > 0) {
        if (findProduct(content, stock.productId)) {
          productId = stock.productId;
          quantity = Math.floor(stock.quantity);
        } else {
          log.warn(`Slot "${entry.slot.id}" holds unknown product "${stock.productId}"; nothing is drawn`);
        }
      }
      if (productId === entry.productId && quantity === entry.quantity) continue;
      if (entry.productId) touched.add(entry.productId);
      if (productId) touched.add(productId);
      entry.productId = productId;
      entry.quantity = quantity;
      entry.matrices = [];
      entry.start = 0;
      entry.count = 0;
      const product = productId ? findProduct(content, productId) : undefined;
      const model = product ? modelFor(product) : null;
      if (product && model) {
        const poses = slotUnitPoses(entry.slot, model.size, productMaxStack(product), entry.frame, quantity);
        entry.matrices = poses.map((pose) => unitWorldMatrix(entry.frameMatrix, pose));
      }
    }
    for (const productId of touched) rebuildProduct(productId);
  };

  sync();
  const offs = [game.signals.on('product.stock.changed', sync), game.signals.on('game.state.replaced', sync)];

  return {
    root,
    getInfo() {
      let drawn = 0;
      const slots: StockSlotInfo[] = entries.map((e) => {
        const model = e.productId ? models.get(e.productId) : undefined;
        const mesh = model?.meshes[0];
        let instances = 0;
        let firstUnit: StockSlotInfo['firstUnit'] = null;
        if (mesh && e.count > 0 && e.start + e.count <= mesh.count) {
          instances = e.count;
          mesh.getMatrixAt(e.start, tmp);
          const p = new Vector3().setFromMatrixPosition(tmp);
          firstUnit = { x: p.x, y: p.y, z: p.z };
        }
        drawn += instances;
        return { slotId: e.slot.id, productId: e.productId, quantity: e.quantity, instances, firstUnit };
      });
      let instancedMeshes = 0;
      for (const model of models.values()) for (const mesh of model.meshes) if (mesh.visible) instancedMeshes += 1;
      return { slots, drawnInstances: drawn, instancedMeshes };
    },
    dispose() {
      for (const off of offs) off();
      for (const model of models.values()) {
        releaseMeshes(model);
        for (const part of model.parts) part.geometry.dispose();
      }
      models.clear();
    },
  };
}
