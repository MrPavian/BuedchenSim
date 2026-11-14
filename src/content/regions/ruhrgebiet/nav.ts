import type { NavDef, PlaceSpotDef, WaypointDef } from '../../../game/types';

/**
 * Walking graph of the residents (metres; +X east, +Z south). Kiosk footprint x -3..3, z -2..2; sidewalk z 2..5; yard elsewhere.
 *
 * - Main lane A at z 3.3 along the sidewalk, bypass lane B at z 4.3 (linked to A at x -8, -5.4, -3, -0.3, 3, 5.7, 7.5), so two
 *   residents (or a resident and the player at the spawn (0.9, 3.6)) can always pass each other.
 * - Window spots 0.55 m off the south wall (z 2.55), 0.7 m apart: every spot is within NPC_TALK_RADIUS of the counter (-1.0, 0.95).
 * - Corner (meeting point) east of the door at x 3.9..5.7, z 2.45; the door approach (x 1.5..2.5, z 2..3.2) stays free.
 * - West yard: lane z 1.5 branching off lane A at x -5.4, three bench spots at z 0.4 (bench placement E-004 north of them), a
 *   workshop corner with two spots and the back-yard exit in the north-west.
 * Standing spots keep >= 0.7 m to every lane they do not belong to (the validator demands the NPC clearance of 0.65 m).
 */
const wp = (id: string, x: number, z: number): WaypointDef => ({ id, position: { x, z } });
const spots = (heading: number, ...ids: string[]): PlaceSpotDef[] => ids.map((waypointId) => ({ waypointId, heading }));

const waypoints: WaypointDef[] = [
  wp('wp.exit-west', -10.8, 3.8),
  wp('wp.exit-east', 10.8, 3.8),
  wp('wp.exit-hof', -10.2, -6.3),
  // Lane A
  wp('wp.a-1', -8.0, 3.3),
  wp('wp.a-2', -5.4, 3.3),
  wp('wp.a-3', -3.0, 3.3),
  wp('wp.a-4', -1.7, 3.3),
  wp('wp.a-5', -1.0, 3.3),
  wp('wp.a-6', -0.3, 3.3),
  wp('wp.a-7', 1.2, 3.3),
  wp('wp.a-8', 3.0, 3.3),
  wp('wp.a-9', 3.9, 3.3),
  wp('wp.a-10', 4.8, 3.3),
  wp('wp.a-11', 5.7, 3.3),
  wp('wp.a-12', 7.5, 3.3),
  // Bypass lane B
  wp('wp.b-1', -8.0, 4.3),
  wp('wp.b-2', -5.4, 4.3),
  wp('wp.b-3', -3.0, 4.3),
  wp('wp.b-4', -0.3, 4.3),
  wp('wp.b-5', 3.0, 4.3),
  wp('wp.b-6', 5.7, 4.3),
  wp('wp.b-7', 7.5, 4.3),
  // Sales window spots
  wp('wp.win-1', -1.7, 2.55),
  wp('wp.win-2', -1.0, 2.55),
  wp('wp.win-3', -0.3, 2.55),
  // Corner east of the door
  wp('wp.corner-1', 3.9, 2.45),
  wp('wp.corner-2', 4.8, 2.45),
  wp('wp.corner-3', 5.7, 2.45),
  // West yard
  wp('wp.y-1', -8.0, 1.5),
  wp('wp.y-2', -6.5, 1.5),
  wp('wp.y-3', -5.4, 1.5),
  wp('wp.y-4', -4.3, 1.5),
  wp('wp.bank-1', -6.5, 0.4),
  wp('wp.bank-2', -5.4, 0.4),
  wp('wp.bank-3', -4.3, 0.4),
  wp('wp.y-5', -9.4, -1.0),
  wp('wp.y-6', -9.8, -4.5),
  wp('wp.work-1', -8.0, -2.4),
  wp('wp.work-2', -7.4, -1.6),
];

const lane = (prefix: string, from: number, to: number): [string, string][] =>
  Array.from({ length: to - from }, (_, i): [string, string] => [`${prefix}${from + i}`, `${prefix}${from + i + 1}`]);

const edges: [string, string][] = [
  ['wp.exit-west', 'wp.a-1'],
  ['wp.exit-west', 'wp.b-1'],
  ...lane('wp.a-', 1, 12),
  ['wp.a-12', 'wp.exit-east'],
  ...lane('wp.b-', 1, 7),
  ['wp.b-7', 'wp.exit-east'],
  // Links between the lanes
  ['wp.a-1', 'wp.b-1'],
  ['wp.a-2', 'wp.b-2'],
  ['wp.a-3', 'wp.b-3'],
  ['wp.a-6', 'wp.b-4'],
  ['wp.a-8', 'wp.b-5'],
  ['wp.a-11', 'wp.b-6'],
  ['wp.a-12', 'wp.b-7'],
  // Spots
  ['wp.a-4', 'wp.win-1'],
  ['wp.a-5', 'wp.win-2'],
  ['wp.a-6', 'wp.win-3'],
  ['wp.a-9', 'wp.corner-1'],
  ['wp.a-10', 'wp.corner-2'],
  ['wp.a-11', 'wp.corner-3'],
  // Yard
  ['wp.a-2', 'wp.y-3'],
  ['wp.y-1', 'wp.y-2'],
  ['wp.y-2', 'wp.y-3'],
  ['wp.y-3', 'wp.y-4'],
  ['wp.y-2', 'wp.bank-1'],
  ['wp.y-3', 'wp.bank-2'],
  ['wp.y-4', 'wp.bank-3'],
  ['wp.y-1', 'wp.y-5'],
  ['wp.y-5', 'wp.work-1'],
  ['wp.y-5', 'wp.work-2'],
  ['wp.y-5', 'wp.y-6'],
  ['wp.y-6', 'wp.exit-hof'],
];

export const ruhrgebietNav: NavDef = {
  waypoints,
  edges,
  places: [
    { id: 'place.exit-west', kind: 'exit', spots: spots(Math.PI / 2, 'wp.exit-west') },
    { id: 'place.exit-east', kind: 'exit', spots: spots(-Math.PI / 2, 'wp.exit-east') },
    { id: 'place.exit-hof', kind: 'exit', spots: spots(0, 'wp.exit-hof') },
    // Facing the window (north, heading pi).
    { id: 'place.kiosk-window', kind: 'kiosk-window', spots: spots(Math.PI, 'wp.win-1', 'wp.win-2', 'wp.win-3') },
    {
      id: 'place.corner',
      kind: 'sidewalk',
      spots: [
        { waypointId: 'wp.corner-1', heading: 1.3 },
        { waypointId: 'wp.corner-2', heading: -1.3 },
        { waypointId: 'wp.corner-3', heading: -1.3 },
      ],
    },
    // Pass-by only: residents walk through this lane waypoint on their way across the street.
    { id: 'place.gehweg', kind: 'sidewalk', spots: spots(Math.PI / 2, 'wp.a-3') },
    {
      id: 'place.yard-bench',
      kind: 'yard',
      spots: [
        { waypointId: 'wp.bank-1', heading: 1.3 },
        { waypointId: 'wp.bank-2', heading: -1.3 },
        { waypointId: 'wp.bank-3', heading: -1.3 },
      ],
    },
    {
      id: 'place.workshop',
      kind: 'yard',
      spots: [
        { waypointId: 'wp.work-1', heading: 2.6 },
        { waypointId: 'wp.work-2', heading: -2.4 },
      ],
    },
  ],
};
