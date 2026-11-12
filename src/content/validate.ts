import { PLAYER_RADIUS } from '../game/constants';
import {
  placementCollides,
  placementFootprint,
  placementFront,
  frontStrip,
} from '../game/placement';
import { anyReachableInRect, anyReachableWithin, computeReachability } from '../game/reachability';
import { rectContainsRect, rectsOverlap } from '../game/rects';
import type { ContentPack, PlacementDef, QuarterTurn, Rect, WallOpening } from '../game/types';

function collectNonFinite(value: unknown, path: string, out: string[]): void {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) out.push(`${path} is not a finite number`);
  } else if (Array.isArray(value)) {
    value.forEach((item, i) => collectNonFinite(item, `${path}[${i}]`, out));
  } else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) collectNonFinite(v, `${path}.${k}`, out);
  }
}

const rectOk = (r: Rect): boolean => r.minX < r.maxX && r.minZ < r.maxZ;

const contains = (outer: Rect, x: number, z: number): boolean =>
  x >= outer.minX && x <= outer.maxX && z >= outer.minZ && z <= outer.maxZ;

function checkIds(kind: string, prefix: string, ids: string[], errors: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (!id.startsWith(prefix)) errors.push(`${kind} id "${id}" must start with "${prefix}"`);
    if (seen.has(id)) errors.push(`duplicate ${kind} id "${id}"`);
    seen.add(id);
  }
}

/** Extent of the wall (inner span, so openings cannot cut into the corners). */
function wallExtent(side: WallOpening['side'], fp: Rect, t: number): [number, number] {
  return side === 'north' || side === 'south' ? [fp.minX + t, fp.maxX - t] : [fp.minZ + t, fp.maxZ - t];
}

const QUARTER_TURNS: readonly number[] = [0, 90, 180, 270];

/** Depth of the strip in front of a colliding placement in which the player must be able to stand. */
const FRONT_REACH_DEPTH = 0.6;

interface PlacementState {
  colliders: Array<{ placementId: string; rect: Rect }>;
}

/** Catalog and placement-list rules (ids, assets, rotation, scale, support, bounds, overlaps, door swing). */
function validatePlacements(pack: ContentPack, interior: Rect, errors: string[]): PlacementState {
  const { layout, assets } = pack;
  const fp = layout.kiosk.footprint;
  const state: PlacementState = { colliders: [] };

  if (!Number.isInteger(layout.layoutVersion) || layout.layoutVersion <= 0) {
    errors.push(`layoutVersion ${layout.layoutVersion} must be a positive integer`);
  }

  // Catalog
  for (const [key, asset] of Object.entries(assets)) {
    if (asset.assetId !== key) errors.push(`asset catalog key "${key}" does not match its assetId "${asset.assetId}"`);
    const { width, depth, height } = asset.size;
    if (!(width > 0 && depth > 0 && height > 0)) errors.push(`asset "${key}" size must be positive in all dimensions`);
    if (asset.allowedRotations.length === 0 || asset.allowedRotations.some((r) => !QUARTER_TURNS.includes(r))) {
      errors.push(`asset "${key}" allowedRotations must be a non-empty list of 0, 90, 180 or 270`);
    }
  }
  const kioskAsset = assets[layout.kiosk.assetId];
  if (!kioskAsset) errors.push(`kiosk references unknown asset "${layout.kiosk.assetId}"`);
  else if (kioskAsset.category !== 'building') errors.push(`kiosk asset "${kioskAsset.assetId}" must have category "building"`);
  for (const g of layout.ground) {
    if (g.assetId !== undefined && !assets[g.assetId]) {
      errors.push(`ground area "${g.id}" references unknown asset "${g.assetId}"`);
    }
  }

  const byId = new Map<string, PlacementDef>();
  for (const p of layout.placements) if (!byId.has(p.id)) byId.set(p.id, p);

  const footprints = new Map<string, Rect>();
  for (const p of layout.placements) {
    const asset = assets[p.assetId];
    if (!asset) {
      errors.push(`placement "${p.id}" references unknown asset "${p.assetId}"`);
      continue;
    }
    if (asset.category !== 'furniture') {
      errors.push(`placement "${p.id}": asset "${asset.assetId}" has category "${asset.category}", only furniture can be placed`);
    }
    if (!asset.allowedRotations.includes(p.rotation as QuarterTurn)) {
      errors.push(`placement "${p.id}": rotation ${p.rotation} is not allowed for asset "${asset.assetId}" (allowed: ${asset.allowedRotations.join(', ')})`);
      continue;
    }
    if (p.scale !== undefined) {
      if (!asset.scalable) errors.push(`placement "${p.id}": asset "${asset.assetId}" is not scalable, remove "scale"`);
      else if (!(p.scale > 0)) errors.push(`placement "${p.id}": scale ${p.scale} must be positive`);
    }
    const rect = placementFootprint(p, asset);
    footprints.set(p.id, rect);

    if (p.on === undefined) {
      if (asset.requiresSupport) errors.push(`placement "${p.id}": asset "${asset.assetId}" requires support, set "on"`);
      const insideInterior = rectContainsRect(interior, rect);
      const outsideBuilding = !rectsOverlap(rect, fp);
      if (!insideInterior && !outsideBuilding) {
        errors.push(`placement "${p.id}" straddles a kiosk wall (must be fully inside the interior or fully outside the building)`);
      }
      if (!rectContainsRect(layout.walkBounds, rect)) errors.push(`placement "${p.id}" is not inside walkBounds`);
    } else {
      const supporter = byId.get(p.on);
      if (p.on === p.id) errors.push(`placement "${p.id}" cannot stand on itself`);
      else if (!supporter) errors.push(`placement "${p.id}" stands on unknown placement "${p.on}"`);
      else if (supporter.on !== undefined) {
        errors.push(`placement "${p.id}" stands on "${p.on}", which itself stands on "${supporter.on}" (max. one level)`);
      } else {
        const supporterAsset = assets[supporter.assetId];
        if (supporterAsset) {
          const supportRect = placementFootprint(supporter, supporterAsset);
          if (!rectContainsRect(supportRect, rect)) {
            errors.push(`placement "${p.id}" is not fully inside the footprint of its supporter "${p.on}"`);
          }
        }
      }
    }
    if (placementCollides(p, asset)) state.colliders.push({ placementId: p.id, rect });
  }

  // Forbidden overlaps between colliding footprints (touching edges are fine).
  for (let i = 0; i < state.colliders.length; i += 1) {
    for (let j = i + 1; j < state.colliders.length; j += 1) {
      const a = state.colliders[i];
      const b = state.colliders[j];
      if (a && b && rectsOverlap(a.rect, b.rect)) errors.push(`placement "${a.placementId}" overlaps "${b.placementId}"`);
    }
  }

  // Door swing: a door-width square just inside every door opening must stay free.
  for (const o of layout.kiosk.openings) {
    if (o.kind !== 'door') continue;
    const w = o.to - o.from;
    const swing: Rect =
      o.side === 'south'
        ? { minX: o.from, maxX: o.to, minZ: interior.maxZ - w, maxZ: interior.maxZ }
        : o.side === 'north'
          ? { minX: o.from, maxX: o.to, minZ: interior.minZ, maxZ: interior.minZ + w }
          : o.side === 'east'
            ? { minX: interior.maxX - w, maxX: interior.maxX, minZ: o.from, maxZ: o.to }
            : { minX: interior.minX, maxX: interior.minX + w, minZ: o.from, maxZ: o.to };
    for (const c of state.colliders) {
      if (rectsOverlap(c.rect, swing)) errors.push(`placement "${c.placementId}" blocks the swing area of door "${o.id}"`);
    }
  }
  return state;
}

/** Flood fill from the spawn (doors open): interaction points, the interior and every furniture front must be reachable. */
function checkReachability(pack: ContentPack, interior: Rect, errors: string[]): void {
  const { layout, assets } = pack;
  const grid = computeReachability(layout, assets, PLAYER_RADIUS);
  if (!grid) {
    errors.push('spawn position is not on walkable ground (the player circle does not fit there)');
    return;
  }
  if (!anyReachableInRect(grid, interior)) errors.push('the kiosk interior is not reachable from the spawn position');
  for (const p of layout.interactionPoints) {
    if (!anyReachableWithin(grid, p.position.x, p.position.z, p.radius)) {
      errors.push(`interaction point "${p.id}" cannot be reached: no walkable cell within its radius ${p.radius}`);
    }
  }
  for (const placement of layout.placements) {
    const asset = assets[placement.assetId];
    if (!asset || !placementCollides(placement, asset)) continue;
    const strip = frontStrip(placementFootprint(placement, asset), placementFront(placement), FRONT_REACH_DEPTH);
    if (!anyReachableInRect(grid, strip)) {
      errors.push(`placement "${placement.id}" cannot be used from the front: no reachable spot within ${FRONT_REACH_DEPTH} m in front of it`);
    }
  }
}

/** Returns readable error messages; an empty array means the pack is valid. */
export function validateContent(pack: ContentPack): string[] {
  const errors: string[] = [];
  const { layout } = pack;

  collectNonFinite(layout, 'layout', errors);
  collectNonFinite(pack.assets, 'assets', errors);
  if (errors.length > 0) return errors; // geometry checks are meaningless with NaN/Infinity

  if (!pack.regionId.startsWith('region.')) errors.push(`regionId "${pack.regionId}" must start with "region."`);

  const { kiosk } = layout;
  const fp = kiosk.footprint;
  const t = kiosk.wallThickness;

  // Rects
  if (!rectOk(fp)) errors.push('kiosk footprint must have min < max on both axes');
  if (!rectOk(layout.walkBounds)) errors.push('walkBounds must have min < max on both axes');
  for (const g of layout.ground) if (!rectOk(g.rect)) errors.push(`ground area "${g.id}" rect must have min < max`);
  if (!(kiosk.height > 0)) errors.push('kiosk height must be positive');
  if (!(t > 0)) errors.push('kiosk wallThickness must be positive');
  else if (rectOk(fp) && (fp.maxX - fp.minX <= 2 * t || fp.maxZ - fp.minZ <= 2 * t)) {
    errors.push('kiosk wallThickness leaves no interior');
  }

  // IDs
  checkIds('opening', 'opening.', kiosk.openings.map((o) => o.id), errors);
  checkIds('placement', 'placement.', layout.placements.map((p) => p.id), errors);
  checkIds('ground area', 'ground.', layout.ground.map((g) => g.id), errors);
  checkIds('interaction point', 'interaction.', layout.interactionPoints.map((p) => p.id), errors);

  // Openings
  for (const o of kiosk.openings) {
    const [lo, hi] = wallExtent(o.side, fp, t);
    if (!(o.from < o.to)) errors.push(`opening "${o.id}" must have from < to`);
    else if (o.from < lo || o.to > hi) {
      errors.push(`opening "${o.id}" (${o.from}..${o.to}) lies outside the ${o.side} wall extent ${lo}..${hi}`);
    }
    if (o.sill < 0) errors.push(`opening "${o.id}" sill must be >= 0`);
    if (!(o.sill < o.head)) errors.push(`opening "${o.id}" must have sill < head`);
    if (o.head > kiosk.height) errors.push(`opening "${o.id}" head ${o.head} exceeds kiosk height ${kiosk.height}`);
  }
  for (let i = 0; i < kiosk.openings.length; i += 1) {
    for (let j = i + 1; j < kiosk.openings.length; j += 1) {
      const a = kiosk.openings[i];
      const b = kiosk.openings[j];
      if (a && b && a.side === b.side && a.from < b.to && b.from < a.to) {
        errors.push(`openings "${a.id}" and "${b.id}" overlap on the ${a.side} wall`);
      }
    }
  }

  const interior: Rect = { minX: fp.minX + t, maxX: fp.maxX - t, minZ: fp.minZ + t, maxZ: fp.maxZ - t };
  const placementState = validatePlacements(pack, interior, errors);

  // Spawn
  const { position } = layout.spawn;
  if (!contains(layout.walkBounds, position.x, position.z)) errors.push('spawn position is outside walkBounds');
  const wallRects: Rect[] = [
    { minX: fp.minX, maxX: fp.maxX, minZ: fp.minZ, maxZ: fp.minZ + t },
    { minX: fp.minX, maxX: fp.maxX, minZ: fp.maxZ - t, maxZ: fp.maxZ },
    { minX: fp.minX, maxX: fp.minX + t, minZ: fp.minZ, maxZ: fp.maxZ },
    { minX: fp.maxX - t, maxX: fp.maxX, minZ: fp.minZ, maxZ: fp.maxZ },
  ];
  if (wallRects.some((w) => contains(w, position.x, position.z))) errors.push('spawn position is inside a kiosk wall');
  for (const c of placementState.colliders) {
    if (contains(c.rect, position.x, position.z)) errors.push(`spawn position is inside placement "${c.placementId}"`);
  }

  // Interaction points
  for (const p of layout.interactionPoints) {
    if (p.kind === 'door' || p.kind === 'shutter') {
      const opening = p.openingId === undefined ? undefined : kiosk.openings.find((o) => o.id === p.openingId);
      if (p.openingId === undefined) {
        errors.push(`interaction point "${p.id}" of kind "${p.kind}" needs an openingId`);
      } else if (!opening) {
        errors.push(`interaction point "${p.id}" references unknown opening "${p.openingId}"`);
      } else {
        const expected = p.kind === 'door' ? 'door' : 'window';
        if (opening.kind !== expected) {
          errors.push(`interaction point "${p.id}" of kind "${p.kind}" needs a ${expected} opening, but "${opening.id}" is a ${opening.kind}`);
        }
      }
    }
    if (!(p.radius > 0)) errors.push(`interaction point "${p.id}" radius must be positive`);
    if (!contains(layout.walkBounds, p.position.x, p.position.z)) {
      errors.push(`interaction point "${p.id}" is outside walkBounds`);
    }
    if (p.marker) {
      const { radius, radiusZ } = p.marker;
      if (radius !== undefined && !(radius > 0)) errors.push(`interaction point "${p.id}" marker radius must be positive`);
      if (radiusZ !== undefined && !(radiusZ > 0)) errors.push(`interaction point "${p.id}" marker radiusZ must be positive`);
    }
  }

  // Walkways: only meaningful when the geometry above is sound.
  if (errors.length === 0) checkReachability(pack, interior, errors);

  return errors;
}
