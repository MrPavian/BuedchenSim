import { describe, expect, it } from 'vitest';
import { actionFor, findAvailableInteraction, findNearestInteractionPoint } from './interaction';
import type { InteractionPointDef } from './types';

const points: InteractionPointDef[] = [
  { id: 'a', kind: 'door', position: { x: 0, z: 0 }, radius: 2, openingId: 'o.a' },
  { id: 'b', kind: 'shutter', position: { x: 3, z: 0 }, radius: 2, openingId: 'o.b' },
];

describe('interaction lookup', () => {
  it('returns null out of range', () => {
    expect(findNearestInteractionPoint(points, { x: 0, z: 10 })).toBeNull();
  });
  it('picks the nearest when ranges overlap', () => {
    expect(findNearestInteractionPoint(points, { x: 1, z: 0 })?.id).toBe('a');
    expect(findNearestInteractionPoint(points, { x: 2, z: 0 })?.id).toBe('b');
  });
  it('treats the radius as inclusive', () => {
    expect(findNearestInteractionPoint(points, { x: -2, z: 0 })?.id).toBe('a');
  });
  it('derives actions for register and storage points without an opening', () => {
    expect(actionFor('register', { doorOpen: true, shutterOpen: true })).toBe('register.use');
    expect(actionFor('storage', { doorOpen: false, shutterOpen: false })).toBe('storage.use');
    const extra: InteractionPointDef[] = [{ id: 'r', kind: 'register', position: { x: 9, z: 9 }, radius: 1 }];
    expect(findAvailableInteraction(extra, { x: 9, z: 9 }, { doorOpen: false, shutterOpen: false })).toEqual({
      pointId: 'r',
      kind: 'register',
      action: 'register.use',
    });
  });
  it('derives the action from kiosk state', () => {
    expect(actionFor('door', { doorOpen: false, shutterOpen: true })).toBe('door.open');
    expect(actionFor('shutter', { doorOpen: false, shutterOpen: true })).toBe('shutter.close');
    expect(findAvailableInteraction(points, { x: 0, z: 0 }, { doorOpen: true, shutterOpen: false })).toEqual({
      pointId: 'a',
      kind: 'door',
      action: 'door.close',
    });
  });
});
