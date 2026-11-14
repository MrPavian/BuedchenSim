import type { RecipeDef, SpecialtyDef } from '../specialty';
import type { ContentPack, ProductDef } from '../types';
import { testPack } from './fixture-pack';

/** The fixture pack plus one specialty (Auftrag 05, 5.5): a test "Frikadelle" made from two ingredients. */

export const FRIKA = 'product.test-frika';
export const MASSE = 'product.test-masse';
export const ONION = 'product.test-onion';
export const CUSTOMER = 'npc.stammkunde';

const ingredient = (id: string, assetId: string, price: number): ProductDef => ({
  id,
  name: id,
  brand: 'Test',
  category: 'everyday',
  purchasePriceCents: price,
  suggestedPriceCents: price,
  storage: 'ingredient',
  demandTags: ['ingredient'],
  assetId,
  package: 'box',
  label: { primaryColor: '#888888', accentColor: '#ffffff', text: 'ZUTAT' },
});

export const recipe: RecipeDef = {
  id: 'recipe.test-frika',
  name: 'Test Frikadelle',
  productId: FRIKA,
  batchSize: 6,
  minutesPerBatch: 40,
  maxBatches: 3,
  ingredients: [
    { productId: MASSE, quantity: 1 },
    { productId: 'product.test-water', quantity: 2 },
  ],
  optional: [{ productId: ONION, quantity: 1, label: 'mit Zwiebeln', qualityBonus: 8 }],
  quality: { base: 48, perLevel: 12, practicePerBatch: 2, practiceCap: 10 },
};

export const specialty: SpecialtyDef = {
  id: 'specialty.test-frika',
  name: 'Test Frikadelle',
  recipeId: recipe.id,
  firstStageName: 'Erster Versuch',
  firstFlag: 'test.tried',
  stages: [
    { stage: 2, name: 'Geheimtipp', minFame: 30, minSold: 8, minRepeatBuyers: 1, minRecommendations: 0, minSatisfaction: 55, flag: 'test.sign', recipeLevel: 2 },
    { stage: 3, name: 'Kultstatus', minFame: 70, minSold: 25, minRepeatBuyers: 1, minRecommendations: 1, minSatisfaction: 65, flag: 'test.cult', recipeLevel: 3 },
  ],
  recommendMemory: 'empfiehlt:test-frika',
  feedback: { great: ['{name}: super'], good: ['{name}: gut'], meh: ['{name}: geht so'], bad: ['{name}: nee'] },
};

export const specialtyPack: ContentPack = {
  ...testPack,
  products: {
    ...testPack.products,
    [FRIKA]: {
      id: FRIKA,
      name: 'Test Frikadelle',
      brand: 'Test',
      category: 'bakery',
      purchasePriceCents: 100,
      suggestedPriceCents: 290,
      storage: 'counter',
      demandTags: ['lunch'],
      assetId: 'P-904',
      package: 'pastry',
      label: { primaryColor: '#9a5b33', accentColor: '#f3d9a4', text: 'FRIKA' },
    },
    [MASSE]: ingredient(MASSE, 'P-904', 420),
    [ONION]: ingredient(ONION, 'P-904', 50),
  },
  recipes: [recipe],
  specialties: [specialty],
};

