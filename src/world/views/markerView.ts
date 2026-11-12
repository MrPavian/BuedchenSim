import { Group, Mesh, OctahedronGeometry, RingGeometry, type MeshBasicMaterial } from 'three';
import type { Game } from '../../game/game';
import type { InteractionPointDef } from '../../game/types';
import type { Materials } from '../materials';
import { SIDEWALK_HEIGHT } from '../assets/ground';
import { doorPlateTop } from '../assets/kiosk/signage';

export interface MarkerInfo {
  highlighted: boolean;
  ring: { x: number; y: number; z: number };
  gem: { x: number; y: number; z: number };
}

export interface MarkerView {
  /** Debug accessor: world positions and highlight state of one marker. */
  getInfo(id: string): MarkerInfo | null;
  update(timeSeconds: number): void;
  dispose(): void;
  root: Group;
}

const GEM_RADIUS = 0.13;
/** Gem centre above the door plate: largest pulse scale, bob amplitude and a small gap. */
const GEM_CLEARANCE = GEM_RADIUS * 1.25 + 0.05 + 0.03;

interface Marker {
  id: string;
  ring: Mesh;
  gem: Mesh;
  baseY: number;
  ringMaterial: MeshBasicMaterial;
  gemMaterial: MeshBasicMaterial;
}

/**
 * Subtle marker per interaction point: a flat ring on the ground plus a small floating gem
 * above the opening it belongs to. The available one glows and pulses
 * (`interaction.available.changed`); the others stay dim.
 */
export function createMarkerView(game: Game, points: readonly InteractionPointDef[], m: Materials): MarkerView {
  const root = new Group();
  root.name = 'interaction-markers';
  const openings = game.content.layout.kiosk.openings;
  const markers: Marker[] = [];
  const ringGeometries = new Map<string, RingGeometry>();
  const ringFor = (radius: number, radiusZ: number): RingGeometry => {
    const key = `${radius}x${radiusZ}`;
    let g = ringGeometries.get(key);
    if (!g) {
      if (radiusZ < radius) {
        // Too narrow for a readable band: a filled ellipse (ring local y becomes world -z after the flat rotation).
        g = new RingGeometry(0, radius, 40);
        g.scale(1, radiusZ / radius, 1);
      } else {
        g = new RingGeometry(radius - Math.max(0.1, radius * 0.3), radius, 40);
      }
      ringGeometries.set(key, g);
    }
    return g;
  };
  const gemGeometry = new OctahedronGeometry(GEM_RADIUS);

  for (const point of points) {
    const opening = openings.find((o) => o.id === point.openingId);
    const ringMaterial = m.marker.clone();
    const gemMaterial = m.marker.clone();
    gemMaterial.depthTest = false; // stays readable through the wall it hangs in
    const radius = point.marker?.radius ?? 0.42;
    const ring = new Mesh(ringFor(radius, point.marker?.radiusZ ?? radius), ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    // Visual marker position: the point's own marker override (e.g. on the sill), else the ground at the point.
    const at = point.marker?.position ?? point.position;
    ring.position.set(at.x, point.marker ? point.marker.height + 0.02 : SIDEWALK_HEIGHT + 0.02, at.z);
    ring.renderOrder = 2;
    // Doors: above the plate that sits over the door head; windows: middle of the opening.
    const baseY = opening ? (point.kind === 'door' ? doorPlateTop(opening.head) + GEM_CLEARANCE : (opening.sill + opening.head) / 2) : 2;
    const gem = new Mesh(gemGeometry, gemMaterial);
    gem.position.set(at.x, baseY, at.z);
    gem.renderOrder = 10;
    root.add(ring, gem);
    markers.push({ id: point.id, ring, gem, baseY, ringMaterial, gemMaterial });
  }

  let activeId: string | null = game.getAvailableInteraction()?.pointId ?? null;
  const offs = [
    game.signals.on('interaction.available.changed', ({ interaction }) => {
      activeId = interaction?.pointId ?? null;
    }),
    game.signals.on('game.state.replaced', () => {
      activeId = game.getAvailableInteraction()?.pointId ?? null;
    }),
  ];

  return {
    root,
    getInfo(id) {
      const marker = markers.find((mk) => mk.id === id);
      if (!marker) return null;
      return {
        highlighted: marker.id === activeId,
        ring: marker.ring.position.clone(),
        gem: marker.gem.position.clone(),
      };
    },
    update(t) {
      for (const marker of markers) {
        const active = marker.id === activeId;
        const pulse = 0.5 + 0.5 * Math.sin(t * 4);
        marker.ringMaterial.opacity = active ? 0.7 + 0.25 * pulse : 0.18;
        marker.gemMaterial.opacity = active ? 0.95 : 0.3;
        const scale = active ? 1.1 + 0.15 * pulse : 0.8;
        marker.ring.scale.setScalar(active ? 1 + 0.12 * pulse : 0.85);
        marker.gem.scale.setScalar(scale);
        marker.gem.position.y = marker.baseY + Math.sin(t * 2.2) * 0.05;
        marker.gem.rotation.y = t * 1.5;
      }
    },
    dispose() {
      for (const off of offs) off();
      for (const g of ringGeometries.values()) g.dispose();
      gemGeometry.dispose();
      for (const marker of markers) {
        marker.ringMaterial.dispose();
        marker.gemMaterial.dispose();
      }
    },
  };
}
