import type { ProductDef } from '../../../game/types';
import type { RecipeDef, SpecialtyDef } from '../../../game/specialty';

/**
 * The first kiosk specialty (Auftrag 05, 5.5): "Frikadelle im Brötchen" (binding name). Ingredients are normal catalog
 * products bought from the supplier and kept in the back storage; the existing Pottbäcker rolls are used as the bread.
 * All brands are fictional.
 */

export const SPECIALTY_PRODUCT = 'product.frikadelle-im-broetchen';

export const specialtyProducts: ProductDef[] = [
  {
    id: SPECIALTY_PRODUCT,
    name: 'Frikadelle im Brötchen',
    brand: 'Büdchen am Eck',
    category: 'bakery',
    // Cost of goods per unit: the ingredients of one batch (masse 4,20 + 6 rolls 1,20 + mustard 0,60) / 6 units.
    purchasePriceCents: 100,
    suggestedPriceCents: 290,
    storage: 'counter',
    demandTags: ['lunch', 'matchday', 'specialty', 'weekend'],
    assetId: 'P-029',
    package: 'pastry',
    label: { primaryColor: '#9a5b33', accentColor: '#f3d9a4', text: 'FRIKADELLE' },
  },
  {
    id: 'product.zur-glocke-frikadellenmasse',
    name: 'Frikadellenmasse für 6 (Fleischerei Zur Glocke)',
    brand: 'Fleischerei Zur Glocke',
    category: 'everyday',
    purchasePriceCents: 420,
    suggestedPriceCents: 420,
    storage: 'ingredient',
    demandTags: ['ingredient'],
    assetId: 'P-030',
    package: 'box',
    label: { primaryColor: '#b8473b', accentColor: '#fff1e2', text: 'MASSE' },
  },
  {
    id: 'product.pottgold-senf',
    name: 'Pottgold Senf mittelscharf (für 6)',
    brand: 'Pottgold',
    category: 'everyday',
    purchasePriceCents: 60,
    suggestedPriceCents: 60,
    storage: 'ingredient',
    demandTags: ['ingredient'],
    assetId: 'P-031',
    package: 'box',
    label: { primaryColor: '#e2b82c', accentColor: '#3b2a12', text: 'SENF' },
  },
  {
    id: 'product.pottgold-roestzwiebeln',
    name: 'Pottgold Röstzwiebeln (für 6)',
    brand: 'Pottgold',
    category: 'everyday',
    purchasePriceCents: 50,
    suggestedPriceCents: 50,
    storage: 'ingredient',
    demandTags: ['ingredient'],
    assetId: 'P-032',
    package: 'bag',
    label: { primaryColor: '#c88a3c', accentColor: '#3b2a12', text: 'ZWIEBEL' },
  },
];

export const ruhrgebietRecipes: RecipeDef[] = [
  {
    id: 'recipe.frikadelle-im-broetchen',
    name: 'Frikadelle im Brötchen',
    productId: SPECIALTY_PRODUCT,
    batchSize: 6,
    minutesPerBatch: 40,
    maxBatches: 3,
    ingredients: [
      { productId: 'product.zur-glocke-frikadellenmasse', quantity: 1 },
      { productId: 'product.pottbaecker-broetchen', quantity: 6 },
      { productId: 'product.pottgold-senf', quantity: 1 },
    ],
    optional: [{ productId: 'product.pottgold-roestzwiebeln', quantity: 1, label: 'mit Röstzwiebeln', qualityBonus: 8 }],
    quality: { base: 48, perLevel: 12, practicePerBatch: 2, practiceCap: 10 },
  },
];

export const ruhrgebietSpecialties: SpecialtyDef[] = [
  {
    id: 'specialty.frikadelle',
    name: 'Frikadelle im Brötchen',
    recipeId: 'recipe.frikadelle-im-broetchen',
    firstStageName: 'Erster Versuch',
    firstFlag: 'specialty.frikadelle.tried',
    stages: [
      {
        stage: 2,
        name: 'Geheimtipp',
        minFame: 30,
        minSold: 8,
        minRepeatBuyers: 1,
        minRecommendations: 0,
        minSatisfaction: 55,
        flag: 'specialty.frikadelle.sign',
        recipeLevel: 2,
      },
      {
        stage: 3,
        name: 'Kultstatus',
        minFame: 70,
        minSold: 25,
        minRepeatBuyers: 3,
        minRecommendations: 2,
        minSatisfaction: 65,
        flag: 'specialty.frikadelle.cult',
        recipeLevel: 3,
      },
    ],
    recommendMemory: 'empfiehlt:frikadelle',
    tasteMemory: 'probiert:frikadelle',
    feedback: {
      great: [
        '{name}: „Die ist ja wie früher bei Muttern. Davon erzähl ich.“',
        '{name}: „Saftig, ordentlich Senf. So muss das.“',
        '{name}: „Die nehm ich nächstes Mal gleich zwei.“',
      ],
      good: [
        '{name}: „Schmeckt. Noch ’n bisschen mehr Pfeffer, dann ist die perfekt.“',
        '{name}: „Ordentlich. Kann man nicht meckern.“',
      ],
      meh: [
        '{name}: „Geht so. Das Brötchen ist zäh.“',
        '{name}: „Satt macht sie. Mehr sag ich nicht.“',
      ],
      bad: [
        '{name}: „Die war noch kalt in der Mitte. Da musst du noch üben.“',
        '{name}: „Nee, die kauf ich dir so nicht noch mal ab.“',
      ],
    },
  },
];
