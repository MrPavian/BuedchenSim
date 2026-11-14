import type { DemandConfig } from '../../../game/demand';

/**
 * Demand of the Ruhr kiosk (Auftrag 05, 5.4): D = clamp(B + W + E + S + T, 5, 100) with B = 50. Bad weather lowers
 * the demand for cold goods and raises it for papers, sweets and baked goods, so a rainy day shifts sales instead of
 * ruining the kiosk. Event bonuses live in the event data.
 */
export const ruhrgebietDemand: DemandConfig = {
  base: 50,
  min: 5,
  max: 100,
  weather: {
    sunny: { 'tag:cold': 8, 'category:icecream': 8, 'tag:summer': 5 },
    cloudy: {},
    'light-rain': { 'tag:cold': -8, 'category:icecream': -12, 'category:press': 6, 'category:sweet': 5, 'category:bakery': 4 },
    'heavy-rain': { 'tag:cold': -12, 'category:icecream': -20, 'category:press': 10, 'category:sweet': 6, 'category:bakery': 6 },
    fog: { 'category:press': 4 },
    snow: { 'category:icecream': -25, 'tag:cold': -12, 'category:sweet': 10, 'category:bakery': 8 },
    frost: { 'category:icecream': -25, 'tag:cold': -15, 'category:bakery': 10, 'category:sweet': 6 },
  },
  temperature: [
    { key: 'tag:cold', above: 22, perDegree: 2, cap: 20 },
    { key: 'category:icecream', above: 22, perDegree: 3, cap: 25 },
    { key: 'tag:thirst', above: 24, perDegree: 2, cap: 15 },
    { key: 'category:icecream', below: 10, perDegree: -2, cap: 20 },
    { key: 'category:bakery', below: 8, perDegree: 1, cap: 8 },
  ],
  season: {
    summer: { 'tag:summer': 10, 'category:icecream': 8 },
    winter: { 'category:icecream': -12, 'category:sweet': 6 },
    autumn: { 'category:press': 4 },
    spring: {},
  },
  weekdays: [
    { days: [0, 1, 2, 3, 4], bonus: { 'tag:commuter': 8 } },
    { days: [5, 6], bonus: { 'tag:weekend': 10 } },
  ],
  groups: [
    { id: 'icecream', label: 'Eis', key: 'category:icecream' },
    { id: 'cold', label: 'Kaltgetränke', key: 'tag:cold' },
    { id: 'beer', label: 'Bier', key: 'tag:matchday' },
    { id: 'snack', label: 'Knabbereien', key: 'category:snack' },
    { id: 'sweet', label: 'Süßes', key: 'category:sweet' },
    { id: 'bakery', label: 'Backwaren', key: 'category:bakery' },
    { id: 'press', label: 'Zeitungen', key: 'category:press' },
  ],
  timeOfDay: [
    { from: 6 * 60, to: 11 * 60, bonus: { 'tag:morning': 15, 'tag:commuter': 5 } },
    { from: 11 * 60, to: 14 * 60, bonus: { 'tag:lunch': 10 } },
    { from: 17 * 60, to: 22 * 60, bonus: { 'tag:evening': 15 } },
  ],
};
