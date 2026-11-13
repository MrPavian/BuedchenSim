import type { AssetDef } from '../../game/types';

/**
 * Product assets P-001 ... P-028 (register: docs/artwork-prompts/07-artwork-register.md), one per product in
 * catalog order (src/content/regions/ruhrgebiet/products.ts). `size` is the bounding box of ONE unit in metres at
 * rotation 0: width along X, depth along Z (thickness, front/back), height along Y; pivot = ground centre of the box.
 * The front of a unit (label side) faces +Z.
 *
 * Orientation decisions:
 * - bottles, cans, bags, boxes, ice products and pastries stand/lie as they are normally displayed, label towards +Z;
 * - chocolate bars LIE flat (160 x 75 x 12 mm) so that stacking them in layers is physically meaningful;
 * - magazines stand UPRIGHT in the rack, cover towards +Z: width x thickness (depth) x height.
 *
 * Product units collide with nothing (they are decoration of a slot) and are neither rotated freely nor scaled.
 */
const unit = (
  assetId: string,
  name: string,
  width: number,
  depth: number,
  height: number,
): [string, AssetDef] => [
  assetId,
  {
    assetId,
    name,
    category: 'product',
    size: { width, depth, height },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
];

export const productAssets: Record<string, AssetDef> = Object.fromEntries([
  // Drinks
  unit('P-001', 'Ware: Wasser still 0,5 l (PET-Flasche)', 0.065, 0.065, 0.21),
  unit('P-002', 'Ware: Zitronenlimo 0,5 l (PET-Flasche)', 0.066, 0.066, 0.205),
  unit('P-003', 'Ware: Brause Klassik 0,33 l (Glasflasche)', 0.065, 0.065, 0.23),
  unit('P-004', 'Ware: Fantasie-Energydrink 0,25 l (Dose)', 0.053, 0.053, 0.135),
  unit('P-005', 'Ware: Apfelschorle 0,33 l (Glasflasche)', 0.065, 0.065, 0.215),
  unit('P-006', 'Ware: Eistee Pfirsich 0,5 l (PET-Flasche)', 0.068, 0.068, 0.215),
  // Beer
  unit('P-007', 'Ware: Pils 0,33 l (Glasflasche)', 0.065, 0.065, 0.235),
  unit('P-008', 'Ware: Export 0,5 l (Dose)', 0.068, 0.068, 0.168),
  // Snacks
  unit('P-009', 'Ware: Chips Paprika 150 g (Beutel)', 0.19, 0.06, 0.27),
  unit('P-010', 'Ware: Erdnüsse 200 g (Beutel)', 0.15, 0.05, 0.22),
  unit('P-011', 'Ware: Salzstangen 125 g (Beutel)', 0.13, 0.04, 0.24),
  // Sweets
  unit('P-012', 'Ware: Vollmilchschokolade 100 g (Tafel, liegend)', 0.16, 0.075, 0.012),
  unit('P-013', 'Ware: Fruchtgummi 200 g (Beutel)', 0.14, 0.045, 0.2),
  unit('P-014', 'Ware: Sahnebonbons 120 g (Dose)', 0.09, 0.06, 0.08),
  unit('P-015', 'Ware: Kaugummi Minze (Dose)', 0.065, 0.065, 0.085),
  // Ice cream (frozen)
  unit('P-016', 'Ware: Stieleis Himbeere', 0.055, 0.04, 0.18),
  unit('P-017', 'Ware: Eis im Waffelbecher', 0.07, 0.07, 0.1),
  unit('P-018', 'Ware: Wassereis Brause', 0.05, 0.04, 0.2),
  // Bakery
  unit('P-019', 'Ware: Brötchen', 0.11, 0.08, 0.06),
  unit('P-020', 'Ware: Streuselteilchen', 0.12, 0.1, 0.04),
  // Press (upright in the rack: width x thickness x height)
  unit('P-021', 'Ware: Lokalblatt (stehend)', 0.2, 0.008, 0.23),
  unit('P-022', 'Ware: Rätselheft (stehend)', 0.15, 0.005, 0.21),
  unit('P-023', 'Ware: Ligaheft (stehend)', 0.17, 0.006, 0.23),
  // Everyday items
  unit('P-024', 'Ware: Papiertaschentücher 10er', 0.095, 0.04, 0.12),
  unit('P-025', 'Ware: Batterien AA 4er', 0.09, 0.03, 0.14),
  unit('P-026', 'Ware: Einwegfeuerzeug 2er-Karte', 0.085, 0.03, 0.14),
  // Tobacco
  unit('P-027', 'Ware: Filterzigaretten 20er (Schachtel)', 0.055, 0.022, 0.088),
  unit('P-028', 'Ware: Drehtabak 30 g (Beutel)', 0.12, 0.03, 0.09),
]);
