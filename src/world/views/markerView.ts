import { Group, Mesh, OctahedronGeometry, RingGeometry, type MeshBasicMaterial } from 'three';
import type { Game } from '../../game/game';
import type { InteractionPointDef } from '../../game/types';
import type { Materials } from '../materials';
import { SIDEWALK_HEIGHT } from '../assets/ground';

export interface MarkerView {
  update(timeSeconds: number): void;
  dispose(): void;
  root: Group;
}

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
  const ringGeometry = new RingGeometry(0.32, 0.42, 40);
  const gemGeometry = new OctahedronGeometry(0.13);

  for (const point of points) {
    const opening = openings.find((o) => o.id === point.openingId);
    const ringMaterial = m.marker.clone();
    const gemMaterial = m.marker.clone();
    gemMaterial.depthTest = false; // stays readable through the wall it hangs in
    const ring = new Mesh(ringGeometry, ringMaterial);
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(point.position.x, SIDEWALK_HEIGHT + 0.02, point.position.z);
    ring.renderOrder = 2;
    const baseY = opening ? (point.kind === 'door' ? opening.head + 0.35 : (opening.sill + opening.head) / 2) : 2;
    const gem = new Mesh(gemGeometry, gemMaterial);
    gem.position.set(point.position.x, baseY, point.position.z);
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
      ringGeometry.dispose();
      gemGeometry.dispose();
      for (const marker of markers) {
        marker.ringMaterial.dispose();
        marker.gemMaterial.dispose();
      }
    },
  };
}
