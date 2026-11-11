import type { ContentPack, Rect, WallOpening } from '../game/types';

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

const overlaps = (a: Rect, b: Rect): boolean =>
  a.minX < b.maxX && b.minX < a.maxX && a.minZ < b.maxZ && b.minZ < a.maxZ;

const contains = (outer: Rect, x: number, z: number): boolean =>
  x >= outer.minX && x <= outer.maxX && z >= outer.minZ && z <= outer.maxZ;

const containsRect = (outer: Rect, inner: Rect): boolean =>
  inner.minX >= outer.minX && inner.maxX <= outer.maxX && inner.minZ >= outer.minZ && inner.maxZ <= outer.maxZ;

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

/** Returns readable error messages; an empty array means the pack is valid. */
export function validateContent(pack: ContentPack): string[] {
  const errors: string[] = [];
  const { layout } = pack;

  collectNonFinite(layout, 'layout', errors);
  if (errors.length > 0) return errors; // geometry checks are meaningless with NaN/Infinity

  if (!pack.regionId.startsWith('region.')) errors.push(`regionId "${pack.regionId}" must start with "region."`);

  const { kiosk } = layout;
  const fp = kiosk.footprint;
  const t = kiosk.wallThickness;

  // Rects
  if (!rectOk(fp)) errors.push('kiosk footprint must have min < max on both axes');
  if (!rectOk(layout.walkBounds)) errors.push('walkBounds must have min < max on both axes');
  for (const f of layout.furniture) if (!rectOk(f.rect)) errors.push(`furniture "${f.id}" rect must have min < max`);
  for (const g of layout.ground) if (!rectOk(g.rect)) errors.push(`ground area "${g.id}" rect must have min < max`);
  if (!(kiosk.height > 0)) errors.push('kiosk height must be positive');
  if (!(t > 0)) errors.push('kiosk wallThickness must be positive');
  else if (rectOk(fp) && (fp.maxX - fp.minX <= 2 * t || fp.maxZ - fp.minZ <= 2 * t)) {
    errors.push('kiosk wallThickness leaves no interior');
  }

  // IDs
  checkIds('opening', 'opening.', kiosk.openings.map((o) => o.id), errors);
  checkIds('furniture', 'furniture.', layout.furniture.map((f) => f.id), errors);
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

  // Furniture inside the interior
  const interior: Rect = { minX: fp.minX + t, maxX: fp.maxX - t, minZ: fp.minZ + t, maxZ: fp.maxZ - t };
  for (const f of layout.furniture) {
    if (!(f.height > 0)) errors.push(`furniture "${f.id}" height must be positive`);
    if (rectOk(f.rect) && !containsRect(interior, f.rect)) {
      errors.push(`furniture "${f.id}" is not inside the kiosk interior`);
    }
  }

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
  for (const f of layout.furniture) {
    if (contains(f.rect, position.x, position.z)) errors.push(`spawn position is inside furniture "${f.id}"`);
  }
  // Furniture must not overlap each other either (all blocks block movement).
  for (let i = 0; i < layout.furniture.length; i += 1) {
    for (let j = i + 1; j < layout.furniture.length; j += 1) {
      const a = layout.furniture[i];
      const b = layout.furniture[j];
      if (a && b && overlaps(a.rect, b.rect)) errors.push(`furniture "${a.id}" overlaps "${b.id}"`);
    }
  }

  // Interaction points
  for (const p of layout.interactionPoints) {
    const opening = kiosk.openings.find((o) => o.id === p.openingId);
    if (!opening) {
      errors.push(`interaction point "${p.id}" references unknown opening "${p.openingId}"`);
    } else {
      const expected = p.kind === 'door' ? 'door' : 'window';
      if (opening.kind !== expected) {
        errors.push(`interaction point "${p.id}" of kind "${p.kind}" needs a ${expected} opening, but "${opening.id}" is a ${opening.kind}`);
      }
    }
    if (!(p.radius > 0)) errors.push(`interaction point "${p.id}" radius must be positive`);
    if (!contains(layout.walkBounds, p.position.x, p.position.z)) {
      errors.push(`interaction point "${p.id}" is outside walkBounds`);
    }
  }

  return errors;
}
