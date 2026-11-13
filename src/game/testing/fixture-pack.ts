import type {
  AssetDef,
  ContentPack,
  CustomerLines,
  DialogueDef,
  NavDef,
  NpcDef,
  ProductDef,
  QuestDef,
  RegionLayout,
  StockSlotDef,
} from '../types';

/**
 * Self-contained test fixture so game tests do not depend on the content layer
 * (game imports core only). Mirrors the shape of a real region pack.
 */
const assets: Record<string, AssetDef> = {
  'K-001': {
    assetId: 'K-001',
    name: 'Test building',
    category: 'building',
    size: { width: 6, depth: 4, height: 3.2 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
  'I-001': {
    assetId: 'I-001',
    name: 'Test counter',
    category: 'furniture',
    size: { width: 2.8, depth: 0.65, height: 1.0 },
    collides: true,
    allowedRotations: [0, 180],
    scalable: false,
  },
  'I-002': {
    assetId: 'I-002',
    name: 'Test register',
    category: 'furniture',
    size: { width: 0.45, depth: 0.4, height: 0.35 },
    collides: false,
    allowedRotations: [0, 90, 180, 270],
    scalable: false,
    requiresSupport: true,
  },
  'I-003': {
    assetId: 'I-003',
    name: 'Test wall shelf',
    category: 'furniture',
    size: { width: 2.4, depth: 0.4, height: 2.0 },
    collides: true,
    allowedRotations: [0, 90, 180, 270],
    scalable: false,
  },
  'P-901': {
    assetId: 'P-901',
    name: 'Test water bottle',
    category: 'product',
    size: { width: 0.07, depth: 0.07, height: 0.22 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
  'P-902': {
    assetId: 'P-902',
    name: 'Test can',
    category: 'product',
    size: { width: 0.066, depth: 0.066, height: 0.123 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
  'P-903': {
    assetId: 'P-903',
    name: 'Test beer bottle',
    category: 'product',
    size: { width: 0.065, depth: 0.065, height: 0.24 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
  'P-904': {
    assetId: 'P-904',
    name: 'Test tobacco box',
    category: 'product',
    size: { width: 0.09, depth: 0.025, height: 0.12 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
  'E-001': {
    assetId: 'E-001',
    name: 'Test sidewalk',
    category: 'ground',
    size: { width: 24, depth: 3, height: 0.03 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
  'E-002': {
    assetId: 'E-002',
    name: 'Test street',
    category: 'ground',
    size: { width: 24, depth: 5.8, height: 0.02 },
    collides: false,
    allowedRotations: [0],
    scalable: false,
  },
};

/**
 * Walking graph of the fixture. West-to-east street line z 3.6 with a bypass (b1) around the edge w1-w2, two spots at
 * the sales window (outside the south wall), two sidewalk spots and a yard in the east. All edges are clear of the colliders.
 */
export const fixtureNav: NavDef = {
  waypoints: [
    { id: 'wp.exit-west', position: { x: -10, z: 3.6 } },
    { id: 'wp.w1', position: { x: -6, z: 3.6 } },
    { id: 'wp.b1', position: { x: -4.25, z: 4.4 } },
    { id: 'wp.w2', position: { x: -2.5, z: 3.6 } },
    { id: 'wp.win-a', position: { x: -1.6, z: 2.55 } },
    { id: 'wp.w3', position: { x: 1.2, z: 3.6 } },
    { id: 'wp.win-b', position: { x: -0.4, z: 2.55 } },
    { id: 'wp.w4', position: { x: 5, z: 3.6 } },
    { id: 'wp.side-a', position: { x: 4.2, z: 2.8 } },
    { id: 'wp.side-b', position: { x: 5.8, z: 2.8 } },
    { id: 'wp.exit-east', position: { x: 10, z: 3.6 } },
    { id: 'wp.y1', position: { x: 7, z: 1.0 } },
    { id: 'wp.yard-a', position: { x: 7.5, z: -1.0 } },
    { id: 'wp.yard-b', position: { x: 9, z: -1.0 } },
  ],
  edges: [
    ['wp.exit-west', 'wp.w1'],
    ['wp.w1', 'wp.w2'],
    ['wp.w1', 'wp.b1'],
    ['wp.b1', 'wp.w2'],
    ['wp.w2', 'wp.win-a'],
    ['wp.w2', 'wp.w3'],
    ['wp.w3', 'wp.win-b'],
    ['wp.w3', 'wp.w4'],
    ['wp.w4', 'wp.side-a'],
    ['wp.w4', 'wp.side-b'],
    ['wp.w4', 'wp.exit-east'],
    ['wp.w4', 'wp.y1'],
    ['wp.y1', 'wp.yard-a'],
    ['wp.y1', 'wp.yard-b'],
  ],
  places: [
    { id: 'place.exit-west', kind: 'exit', spots: [{ waypointId: 'wp.exit-west', heading: Math.PI / 2 }] },
    { id: 'place.exit-east', kind: 'exit', spots: [{ waypointId: 'wp.exit-east', heading: -Math.PI / 2 }] },
    {
      id: 'place.window',
      kind: 'kiosk-window',
      spots: [
        { waypointId: 'wp.win-a', heading: Math.PI },
        { waypointId: 'wp.win-b', heading: Math.PI },
      ],
    },
    {
      id: 'place.sidewalk',
      kind: 'sidewalk',
      spots: [
        { waypointId: 'wp.side-a', heading: 0 },
        { waypointId: 'wp.side-b', heading: 0 },
      ],
    },
    {
      id: 'place.yard',
      kind: 'yard',
      spots: [
        { waypointId: 'wp.yard-a', heading: Math.PI },
        { waypointId: 'wp.yard-b', heading: Math.PI },
      ],
    },
  ],
};

const layout: RegionLayout = {
  kiosk: {
    assetId: 'K-001',
    footprint: { minX: -3, maxX: 3, minZ: -2, maxZ: 2 },
    height: 3.2,
    wallThickness: 0.15,
    openings: [
      { id: 'opening.sales-window', kind: 'window', side: 'south', from: -2.4, to: 0.4, sill: 1.0, head: 2.2 },
      { id: 'opening.door', kind: 'door', side: 'south', from: 1.5, to: 2.5, sill: 0, head: 2.1 },
    ],
    signText: 'TEST KIOSK',
  },
  layoutVersion: 1,
  placements: [
    { id: 'placement.counter', assetId: 'I-001', position: { x: -1.0, z: 1.525 }, rotation: 0 },
    {
      id: 'placement.register',
      assetId: 'I-002',
      position: { x: -0.2, z: 1.525 },
      rotation: 180,
      on: 'placement.counter',
    },
    { id: 'placement.wall-shelf-north', assetId: 'I-003', position: { x: -1.65, z: -1.65 }, rotation: 0 },
    { id: 'placement.wall-shelf-west', assetId: 'I-003', position: { x: -2.65, z: -0.2 }, rotation: 90 },
  ],
  ground: [
    { id: 'ground.sidewalk', assetId: 'E-001', kind: 'sidewalk', rect: { minX: -12, maxX: 12, minZ: 2, maxZ: 5 } },
    { id: 'ground.curb', kind: 'curb', rect: { minX: -12, maxX: 12, minZ: 5, maxZ: 5.2 } },
    { id: 'ground.street', assetId: 'E-002', kind: 'street', rect: { minX: -12, maxX: 12, minZ: 5.2, maxZ: 11 } },
    { id: 'ground.yard', kind: 'yard', rect: { minX: -12, maxX: 12, minZ: -8, maxZ: 2 } },
  ],
  walkBounds: { minX: -11, maxX: 11, minZ: -7, maxZ: 4.8 },
  spawn: { position: { x: 0.9, z: 3.6 }, heading: Math.PI },
  interactionPoints: [
    { id: 'interaction.register', kind: 'register', position: { x: -0.2, z: 1.0 }, radius: 0.6 },
    { id: 'interaction.storage', kind: 'storage', position: { x: 2.1, z: -1.0 }, radius: 0.8 },
    { id: 'interaction.door', kind: 'door', position: { x: 2.0, z: 2.0 }, radius: 1.4, openingId: 'opening.door' },
    {
      id: 'interaction.shutter',
      kind: 'shutter',
      position: { x: -1.0, z: 1.6 },
      radius: 1.7,
      openingId: 'opening.sales-window',
      marker: { position: { x: -1.0, z: 1.95 }, height: 1.03 },
    },
  ],
  nav: fixtureNav,
};

const products: Record<string, ProductDef> = {
  'product.test-water': {
    id: 'product.test-water',
    name: 'Test water',
    brand: 'Testquell',
    category: 'drink',
    purchasePriceCents: 40,
    suggestedPriceCents: 100,
    storage: 'shelf',
    demandTags: ['thirst'],
    assetId: 'P-901',
    package: 'pet-bottle',
    label: { primaryColor: '#3a7bd5', accentColor: '#ffffff', text: 'WASSER' },
  },
  'product.test-cola': {
    id: 'product.test-cola',
    name: 'Test cola',
    brand: 'Testbrause',
    category: 'drink',
    purchasePriceCents: 55,
    suggestedPriceCents: 130,
    storage: 'cooled',
    demandTags: ['thirst', 'sweet'],
    assetId: 'P-902',
    package: 'can',
    label: { primaryColor: '#b22222', accentColor: '#f5f5f5', text: 'BRAUSE' },
  },
  'product.test-beer': {
    id: 'product.test-beer',
    name: 'Test beer',
    brand: 'Testbräu',
    category: 'drink',
    subcategory: 'beer',
    purchasePriceCents: 70,
    suggestedPriceCents: 150,
    storage: 'shelf',
    minimumAge: 16,
    demandTags: ['evening'],
    assetId: 'P-903',
    package: 'glass-bottle',
    label: { primaryColor: '#8b5a2b', accentColor: '#e8c872', text: 'PILS' },
  },
  'product.test-tobacco': {
    id: 'product.test-tobacco',
    name: 'Test tobacco',
    brand: 'Testrauch',
    category: 'everyday',
    subcategory: 'tobacco',
    purchasePriceCents: 520,
    suggestedPriceCents: 650,
    storage: 'counter',
    minimumAge: 18,
    demandTags: ['evening'],
    assetId: 'P-904',
    package: 'box',
    label: { primaryColor: '#2f4f4f', accentColor: '#c0c0c0', text: 'RAUCH' },
  },
};

const stockSlots: StockSlotDef[] = [
  {
    id: 'slot.shelf-north-1',
    placementId: 'placement.wall-shelf-north',
    accepts: 'shelf',
    origin: { x: -0.6, y: 1.0, z: 0 },
    size: { width: 1.0, depth: 0.3, height: 0.3 },
  },
  {
    id: 'slot.shelf-north-2',
    placementId: 'placement.wall-shelf-north',
    accepts: 'shelf',
    origin: { x: 0.6, y: 1.0, z: 0 },
    size: { width: 1.0, depth: 0.3, height: 0.3 },
  },
  {
    id: 'slot.cooled-west',
    placementId: 'placement.wall-shelf-west',
    accepts: 'cooled',
    origin: { x: 0, y: 0.2, z: 0 },
    size: { width: 1.0, depth: 0.3, height: 0.5 },
  },
  {
    id: 'slot.counter-top',
    placementId: 'placement.counter',
    accepts: 'counter',
    origin: { x: 0, y: 1.0, z: 0 },
    size: { width: 0.8, depth: 0.5, height: 0.2 },
  },
];

const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

const quests: Record<string, QuestDef> = {
  'quest.dispute': {
    id: 'quest.dispute',
    title: 'Test dispute',
    steps: [
      { id: 'step.heard', journal: 'Heard about the dispute.' },
      { id: 'step.decided', journal: 'Took a side or stayed out.' },
    ],
    outcomes: [
      { id: 'outcome.mediated', journal: 'Mediated.' },
      { id: 'outcome.neutral', journal: 'Stayed neutral.' },
    ],
  },
};

const npcs: Record<string, NpcDef> = {
  'npc.stammkunde': {
    id: 'npc.stammkunde',
    name: 'Test regular',
    age: 64,
    role: 'Regular customer',
    bio: 'Test bio',
    assetId: 'N-002',
    personalityTags: ['dry', 'observant'],
    walkSpeed: 1.4,
    startRelationship: 30,
    homeExitPlaceId: 'place.exit-east',
    routine: [
      { id: 'r.morning-shop', weekdays: [...ALL_DAYS], from: 480, to: 600, activity: 'shop', placeId: 'place.window', chancePercent: 100 },
      { id: 'r.evening-shop', weekdays: [...ALL_DAYS], from: 1080, to: 1200, activity: 'shop', placeId: 'place.window', chancePercent: 100 },
      { id: 'r.weekend-yard', weekdays: [5, 6], from: 720, to: 840, activity: 'linger', placeId: 'place.yard', chancePercent: 100 },
      { id: 'r.maybe-sidewalk', weekdays: [...ALL_DAYS], from: 900, to: 1000, activity: 'visit', placeId: 'place.sidewalk', chancePercent: 50 },
    ],
    likes: ['product.test-water', 'tag:thirst'],
    dislikes: ['product.test-cola'],
    relationships: [{ npcId: 'npc.nachbarin', kind: 'neighbour', note: 'Know each other for years.' }],
    dialogueIds: ['dialogue.stammkunde.greeting', 'dialogue.stammkunde.dispute', 'dialogue.stammkunde.followup'],
    wishes: [
      {
        id: 'wish.water',
        lines: [{ productId: 'product.test-water', quantity: 2 }],
        when: [{ type: 'time', from: 360, to: 1080 }],
        text: 'Zwei Wasser, bitte.',
        onSold: [{ type: 'relationship', npcId: 'npc.stammkunde', delta: 2, key: 'k.sold.water' }],
      },
      {
        id: 'wish.beer',
        lines: [{ productId: 'product.test-beer', quantity: 1 }],
        when: [{ type: 'time', from: 1080, to: 1320 }],
        text: 'Ein Pils zum Feierabend.',
      },
      {
        id: 'wish.stock-out',
        lines: [{ productId: 'product.test-water', quantity: 99 }],
        when: [{ type: 'flag', id: 'test.big-order' }],
        weight: 1000,
        text: 'Gleich eine ganze Kiste.',
      },
    ],
  },
  'npc.kurier': {
    id: 'npc.kurier',
    name: 'Test courier',
    age: 17,
    role: 'Courier',
    bio: 'Test bio',
    assetId: 'N-006',
    personalityTags: ['fast'],
    walkSpeed: 1.8,
    startRelationship: 5,
    homeExitPlaceId: 'place.exit-west',
    routine: [
      { id: 'r.shop', weekdays: [...ALL_DAYS], from: 540, to: 720, activity: 'shop', placeId: 'place.window', chancePercent: 100 },
    ],
    likes: ['tag:thirst'],
    dislikes: [],
    relationships: [],
    dialogueIds: ['dialogue.kurier.greeting'],
    wishes: [
      {
        id: 'wish.kurier-tobacco',
        lines: [{ productId: 'product.test-tobacco', quantity: 1 }],
        when: [{ type: 'flag', id: 'test.kurier-tobacco' }],
        weight: 1000,
        text: 'Eine Schachtel Rauch.',
      },
      {
        id: 'wish.kurier-beer',
        lines: [{ productId: 'product.test-beer', quantity: 1 }],
        when: [{ type: 'flag', id: 'test.kurier-beer' }],
        weight: 1000,
        text: 'Ein Pils.',
      },
      { id: 'wish.kurier-water', lines: [{ productId: 'product.test-water', quantity: 1 }], text: 'Ein Wasser.' },
    ],
  },
  'npc.nachbarin': {
    id: 'npc.nachbarin',
    name: 'Test neighbour',
    age: 52,
    role: 'Neighbour',
    bio: 'Test bio',
    assetId: 'N-007',
    personalityTags: ['chatty'],
    walkSpeed: 1.2,
    startRelationship: 15,
    homeExitPlaceId: 'place.exit-west',
    routine: [
      { id: 'r.pass', weekdays: [...ALL_DAYS], from: 420, to: 480, activity: 'pass-by', placeId: 'place.sidewalk', chancePercent: 100 },
      { id: 'r.yard-visit', weekdays: [0, 1, 2, 3, 4], from: 600, to: 960, activity: 'visit', placeId: 'place.yard', chancePercent: 100 },
    ],
    likes: [],
    dislikes: [],
    relationships: [{ npcId: 'npc.stammkunde', kind: 'neighbour', note: 'Know each other for years.' }],
    dialogueIds: ['dialogue.nachbarin.greeting', 'dialogue.nachbarin.reaction'],
  },
};

const dialogues: Record<string, DialogueDef> = {
  'dialogue.stammkunde.greeting': {
    id: 'dialogue.stammkunde.greeting',
    npcId: 'npc.stammkunde',
    priority: 1,
    start: 'a',
    nodes: {
      a: {
        text: 'Moin.',
        options: [
          { id: 'chat', text: 'Wie läuft es?', effects: [{ type: 'relationship', npcId: 'npc.stammkunde', delta: 2, key: 'k.chat' }], next: 'b' },
          { id: 'evening', text: 'Schönen Feierabend.', when: [{ type: 'time', from: 1080, to: 1320 }] },
          { id: 'bye', text: 'Tschüss.' },
        ],
      },
      b: { text: 'Muss ja.', options: [{ id: 'bye', text: 'Tschüss.' }] },
    },
  },
  'dialogue.stammkunde.dispute': {
    id: 'dialogue.stammkunde.dispute',
    npcId: 'npc.stammkunde',
    priority: 10,
    when: [{ type: 'questNotStarted', questId: 'quest.dispute' }],
    start: 'a',
    nodes: {
      a: {
        text: 'Hast du den Streit nebenan gehört?',
        options: [
          {
            id: 'listen',
            text: 'Erzähl.',
            effects: [
              { type: 'questStep', questId: 'quest.dispute', step: 'step.heard' },
              { type: 'remember', npcId: 'npc.stammkunde', memoryId: 'told-dispute' },
              { type: 'relationship', npcId: 'npc.stammkunde', delta: 3, key: 'k.listen' },
            ],
            next: 'b',
          },
          { id: 'dismiss', text: 'Nicht mein Problem.', effects: [{ type: 'relationship', npcId: 'npc.stammkunde', delta: -1, key: 'k.dismiss' }] },
        ],
      },
      b: {
        text: 'Und jetzt?',
        options: [
          {
            id: 'mediate',
            text: 'Ich rede mit beiden.',
            when: [{ type: 'relationshipAtLeast', npcId: 'npc.stammkunde', value: 20 }],
            effects: [
              { type: 'questStep', questId: 'quest.dispute', step: 'step.decided' },
              { type: 'questOutcome', questId: 'quest.dispute', outcome: 'outcome.mediated' },
              { type: 'setFlag', id: 'test.mediated', value: true },
              { type: 'remember', npcId: 'npc.stammkunde', memoryId: 'mediated' },
              { type: 'relationship', npcId: 'npc.stammkunde', delta: 5, key: 'k.mediate' },
            ],
          },
          {
            id: 'neutral',
            text: 'Ich halte mich raus.',
            effects: [
              { type: 'questStep', questId: 'quest.dispute', step: 'step.decided' },
              { type: 'questOutcome', questId: 'quest.dispute', outcome: 'outcome.neutral' },
              { type: 'relationship', npcId: 'npc.stammkunde', delta: -2, key: 'k.neutral' },
            ],
          },
        ],
      },
    },
  },
  'dialogue.stammkunde.followup': {
    id: 'dialogue.stammkunde.followup',
    npcId: 'npc.stammkunde',
    priority: 20,
    once: true,
    when: [{ type: 'questOutcome', questId: 'quest.dispute', outcome: 'outcome.mediated' }],
    start: 'a',
    nodes: {
      a: {
        text: 'Danke fürs Vermitteln.',
        options: [{ id: 'thanks', text: 'Gern.', effects: [{ type: 'relationship', npcId: 'npc.stammkunde', delta: 2, key: 'k.followup' }] }],
      },
    },
  },
  'dialogue.kurier.greeting': {
    id: 'dialogue.kurier.greeting',
    npcId: 'npc.kurier',
    priority: 1,
    start: 'a',
    nodes: { a: { text: 'Keine Zeit.', options: [{ id: 'bye', text: 'Ok.' }] } },
  },
  'dialogue.nachbarin.greeting': {
    id: 'dialogue.nachbarin.greeting',
    npcId: 'npc.nachbarin',
    priority: 1,
    start: 'a',
    nodes: {
      a: {
        text: 'Guten Tag.',
        options: [
          { id: 'weekend', text: 'Schönes Wochenende.', when: [{ type: 'weekday', days: [5, 6] }] },
          { id: 'bye', text: 'Tag.' },
        ],
      },
    },
  },
  'dialogue.nachbarin.reaction': {
    id: 'dialogue.nachbarin.reaction',
    npcId: 'npc.nachbarin',
    priority: 10,
    once: true,
    when: [{ type: 'memory', npcId: 'npc.stammkunde', memoryId: 'mediated' }],
    start: 'a',
    nodes: {
      a: { text: 'Man hört, du hast vermittelt.', options: [{ id: 'bye', text: 'Hm.' }] },
    },
  },
};

const customerLines: CustomerLines = {
  sell: 'Bitte sehr.',
  checkId: 'Ausweis bitte.',
  decline: 'Habe ich nicht.',
  close: 'Tschüss.',
  idChecked: 'Bitte. Ich bin {age}.',
  sold: 'Danke.',
  declined: 'Schade.',
  failed: {
    insufficient_stock: 'Nicht genug da.',
    customer_underage: 'Das darf ich dir nicht geben.',
    age_check_required: 'Erst der Ausweis.',
  },
  failedFallback: 'Geht nicht.',
};

export const testPack: ContentPack = {
  regionId: 'region.test',
  name: 'Test',
  assets,
  layout,
  products,
  stockSlots,
  npcs,
  dialogues,
  quests,
  customerLines,
};

/** A pack without residents (nav empty) for tests of the economy and the interaction that need none. */
export const testPackWithoutNpcs: ContentPack = {
  ...testPack,
  layout: { ...layout, nav: { waypoints: [], edges: [], places: [] } },
  npcs: {},
  dialogues: {},
  quests: {},
};
