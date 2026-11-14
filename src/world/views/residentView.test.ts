import { Scene } from 'three';
import { describe, expect, it } from 'vitest';
import type { Game } from '../../game/game';
import type { NpcStatus } from '../../game/state';
import { setLogSink } from '../../core/log';
import { createMaterials } from '../materials';
import { createResidentView } from './residentView';

interface FakeNpc {
  status: NpcStatus;
  position: { x: number; z: number };
  heading: number;
}

function fakeGame(npcs: Record<string, FakeNpc>, assetIds: Record<string, string>) {
  const listeners = new Map<string, Array<() => void>>();
  const state = { npcs, player: { position: { x: 0, z: 10 }, heading: 0 } };
  const game = {
    content: { npcs: Object.fromEntries(Object.entries(assetIds).map(([id, assetId]) => [id, { id, assetId }])) },
    state,
    signals: {
      on(name: string, fn: () => void) {
        listeners.set(name, [...(listeners.get(name) ?? []), fn]);
        return () => undefined;
      },
    },
  } as unknown as Game;
  return { game, state, emit: (name: string) => listeners.get(name)?.forEach((fn) => fn()) };
}

const IDS = { 'npc.a': 'N-002', 'npc.b': 'N-003', 'npc.c': 'N-006', 'npc.d': 'N-007' };

function setup(statuses: Partial<Record<string, NpcStatus>> = {}) {
  const npcs: Record<string, FakeNpc> = {};
  Object.keys(IDS).forEach((id, i) => {
    npcs[id] = { status: statuses[id] ?? 'away', position: { x: i * 2, z: 5 }, heading: 0 };
  });
  const fake = fakeGame(npcs, IDS);
  const view = createResidentView(fake.game, createMaterials());
  const scene = new Scene();
  scene.add(view.root);
  const visibleCount = (): number => view.root.children.filter((c) => c.visible).length;
  return { ...fake, view, scene, npcs, visibleCount };
}

describe('resident view', () => {
  it('builds one figure per resident of the content and shows only residents that are not away', () => {
    const t = setup({ 'npc.a': 'walking', 'npc.c': 'at_place' });
    expect(t.view.root.children).toHaveLength(4);
    t.view.step(1 / 60);
    t.view.update(1 / 60, 1);
    expect(t.visibleCount()).toBe(2);
    expect(t.view.getInfo(() => ({ x: 1, y: 2, visible: true })).map((i) => i.visible)).toEqual([true, false, true, false]);
    t.npcs['npc.b']!.status = 'waiting';
    t.npcs['npc.a']!.status = 'away';
    t.view.step(1 / 60);
    t.view.update(1 / 60, 1);
    expect(t.visibleCount()).toBe(2);
    expect(t.view.root.getObjectByName('resident.npc.a')?.visible).toBe(false);
    expect(t.view.root.getObjectByName('resident.npc.b')?.visible).toBe(true);
  });

  it('only hidden residents are skipped as collision circles', () => {
    const t = setup({ 'npc.a': 'walking', 'npc.b': 'talking' });
    t.view.step(1 / 60);
    expect(t.view.circles()).toHaveLength(2);
    t.npcs['npc.a']!.status = 'away';
    t.view.step(1 / 60);
    expect(t.view.circles()).toHaveLength(1);
    expect(t.view.circles()[0]).toMatchObject({ x: 2, z: 5, r: 0.3 });
  });

  it('interpolates smoothly between fixed steps instead of snapping, and appears at its position without sliding in', () => {
    const t = setup({ 'npc.a': 'walking' });
    const figure = t.view.root.getObjectByName('resident.npc.a')!;
    t.view.step(1 / 60);
    t.view.update(1 / 60, 1);
    expect(figure.position.x).toBeCloseTo(0, 6); // no glide from (0,0)
    const dt = 1 / 60;
    let last = figure.position.x;
    let maxJump = 0;
    for (let step = 1; step <= 30; step += 1) {
      t.npcs['npc.a']!.position.x = step * 1.2 * dt; // 1.2 m/s
      t.view.step(dt);
      for (const alpha of [0.25, 0.75]) {
        t.view.update(dt / 2, alpha);
        maxJump = Math.max(maxJump, Math.abs(figure.position.x - last));
        expect(figure.position.x).toBeGreaterThanOrEqual(last - 1e-9);
        last = figure.position.x;
      }
    }
    expect(maxJump).toBeLessThan(1.2 * dt); // at most one step of travel per half-step render
    expect(last).toBeCloseTo(30 * 1.2 * dt * 0.75 + 29 * 1.2 * dt * 0.25, 3);
    const mid = t.view.getInfo(() => ({ x: 0, y: 0, visible: true }))[0]!;
    expect(mid.animation).toBe('walk');
  });

  it('turns smoothly towards the walking direction and faces the player while talking', () => {
    const t = setup({ 'npc.a': 'walking' });
    const dt = 1 / 60;
    t.view.step(dt);
    t.view.update(dt, 1);
    const info = (): number => t.view.getInfo(() => ({ x: 0, y: 0, visible: true }))[0]!.heading;
    // Walks towards +x for a while: heading goes to ~ +pi/2 over several frames, not at once.
    t.npcs['npc.a']!.heading = Math.PI / 2;
    t.npcs['npc.a']!.position.x += 0.05;
    t.view.step(dt);
    t.view.update(dt, 1);
    const first = info();
    expect(first).toBeGreaterThan(0);
    expect(first).toBeLessThan(Math.PI / 2 - 0.1);
    for (let i = 0; i < 90; i += 1) {
      t.npcs['npc.a']!.position.x += 0.02;
      t.view.step(dt);
      t.view.update(dt, 1);
    }
    expect(info()).toBeCloseTo(Math.PI / 2, 1);
    // Talking: stands still and looks at the player at (0, 10) from (x, 5): straight +z.
    t.npcs['npc.a']!.status = 'talking';
    for (let i = 0; i < 120; i += 1) {
      t.view.step(dt);
      t.view.update(dt, 1);
    }
    const talk = t.view.getInfo(() => ({ x: 0, y: 0, visible: true }))[0]!;
    expect(talk.animation).toBe('talk');
    const p = t.npcs['npc.a']!.position;
    expect(talk.heading).toBeCloseTo(Math.atan2(0 - p.x, 10 - p.z), 1);
  });

  it('snaps instead of gliding after a state replacement or a large jump', () => {
    const t = setup({ 'npc.a': 'walking' });
    t.view.step(1 / 60);
    t.view.update(1 / 60, 1);
    t.npcs['npc.a']!.position = { x: 20, z: 20 };
    t.emit('game.state.replaced');
    t.view.step(1 / 60);
    t.view.update(1 / 60, 0.5);
    const info = t.view.getInfo(() => ({ x: 0, y: 0, visible: true }))[0]!;
    expect(info.position).toEqual({ x: 20, z: 20 });
  });

  it('creates no scene objects, geometries or materials while stepping and rendering', () => {
    const t = setup({ 'npc.a': 'walking', 'npc.b': 'talking', 'npc.c': 'waiting', 'npc.d': 'at_place' });
    const count = (): { objects: number; geometries: Set<unknown>; materials: Set<unknown> } => {
      const geometries = new Set<unknown>();
      const materials = new Set<unknown>();
      let objects = 0;
      t.scene.traverse((o) => {
        objects += 1;
        const mesh = o as { geometry?: unknown; material?: unknown };
        if (mesh.geometry) geometries.add(mesh.geometry);
        if (mesh.material) materials.add(mesh.material);
      });
      return { objects, geometries, materials };
    };
    t.view.step(1 / 60);
    t.view.update(1 / 60, 1);
    const before = count();
    for (let i = 0; i < 600; i += 1) {
      t.npcs['npc.a']!.position.x += 0.02;
      t.view.step(1 / 60);
      t.view.update(1 / 60, (i % 4) / 4);
    }
    const after = count();
    expect(after.objects).toBe(before.objects);
    expect(after.geometries.size).toBe(before.geometries.size);
    expect(after.materials.size).toBe(before.materials.size);
  });

  it('unknown asset ids get the neutral figure with a warning instead of crashing', () => {
    const logs: string[] = [];
    const restore = setLogSink((level, message) => logs.push(`${level}: ${message}`));
    try {
      const fake = fakeGame({ 'npc.x': { status: 'walking', position: { x: 1, z: 1 }, heading: 0 } }, { 'npc.x': 'N-404' });
      const view = createResidentView(fake.game, createMaterials());
      view.step(1 / 60);
      view.update(1 / 60, 1);
      expect(view.root.children[0]?.visible).toBe(true);
    } finally {
      restore();
    }
    expect(logs.some((l) => l.includes('N-404'))).toBe(true);
  });
});
