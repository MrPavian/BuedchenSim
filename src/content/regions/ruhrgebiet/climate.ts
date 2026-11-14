import type { Climate } from '../../../game/weather';

/**
 * Climate of the Ruhr area, roughly following long-term averages (temperate, mild winters, frequent rain, warm summers
 * with occasional heat). Weights are relative per month; snow and frost only occur when the day is cold enough.
 */
export const ruhrgebietClimate: Climate = [
  { high: 5, low: 0, weights: { sunny: 2, cloudy: 5, 'light-rain': 3, 'heavy-rain': 1, fog: 2, snow: 2, frost: 2 } }, // Jan
  { high: 6, low: 0, weights: { sunny: 2, cloudy: 5, 'light-rain': 3, 'heavy-rain': 1, fog: 2, snow: 2, frost: 2 } }, // Feb
  { high: 10, low: 2, weights: { sunny: 3, cloudy: 5, 'light-rain': 3, 'heavy-rain': 1, fog: 1, snow: 1, frost: 1 } }, // Mar
  { high: 14, low: 4, weights: { sunny: 4, cloudy: 4, 'light-rain': 3, 'heavy-rain': 1, fog: 1 } }, // Apr
  { high: 18, low: 8, weights: { sunny: 5, cloudy: 4, 'light-rain': 3, 'heavy-rain': 1 } }, // May
  { high: 21, low: 11, weights: { sunny: 6, cloudy: 4, 'light-rain': 2, 'heavy-rain': 1 } }, // Jun
  { high: 24, low: 13, weights: { sunny: 7, cloudy: 3, 'light-rain': 2, 'heavy-rain': 1 } }, // Jul
  { high: 23, low: 13, weights: { sunny: 6, cloudy: 3, 'light-rain': 2, 'heavy-rain': 1 } }, // Aug
  { high: 19, low: 10, weights: { sunny: 5, cloudy: 4, 'light-rain': 3, 'heavy-rain': 1, fog: 1 } }, // Sep
  { high: 14, low: 7, weights: { sunny: 3, cloudy: 5, 'light-rain': 3, 'heavy-rain': 1, fog: 2 } }, // Oct
  { high: 9, low: 3, weights: { sunny: 2, cloudy: 5, 'light-rain': 4, 'heavy-rain': 1, fog: 3, frost: 1 } }, // Nov
  { high: 6, low: 1, weights: { sunny: 2, cloudy: 5, 'light-rain': 3, 'heavy-rain': 1, fog: 2, snow: 1, frost: 2 } }, // Dec
];
