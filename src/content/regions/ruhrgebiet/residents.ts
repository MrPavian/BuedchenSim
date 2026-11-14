import type { NpcDef, RoutineEntry, WishDef } from '../../../game/types';

/**
 * The four first residents. Asset ids N-002/3/6/7 are register ids of figure models that are not in the asset catalog
 * (the catalog only knows buildings, furniture, ground and products); validation checks the format 'N-\d{3}'.
 *
 * Look notes for the world layer (not data): Günter flat cap, walking stick, slightly stiff left knee, slow gait; Derya work
 * trousers, tool belt, sawdust on the sleeves, quick long strides; Jonas bicycle helmet, courier bag, jacket, light and fast;
 * Marlene cardigan, shopping bag, upright posture.
 * Weekdays: 0 = Monday ... 6 = Sunday. Times are minutes since midnight.
 */

const WEEK: RoutineEntry['weekdays'] = [0, 1, 2, 3, 4, 5, 6];
const MON_FRI: RoutineEntry['weekdays'] = [0, 1, 2, 3, 4];
const h = (hours: number, minutes = 0): number => hours * 60 + minutes;

const GUENTER = 'npc.guenter';
const DERYA = 'npc.derya';
const JONAS = 'npc.jonas';
const MARLENE = 'npc.marlene';

const guenterWishes: WishDef[] = [
  {
    id: 'wish.guenter-echo',
    lines: [
      { productId: 'product.halden-echo-lokalblatt', quantity: 1 },
      { productId: 'product.pottbaecker-broetchen', quantity: 2 },
    ],
    when: [{ type: 'time', from: h(6), to: h(12) }],
    weight: 3,
    text: 'Ein Echo und zwei Brötchen. Wenn die noch warm sind.',
    onSold: [{ type: 'relationship', npcId: GUENTER, delta: 2, key: 'k.guenter.erster-kauf' }],
  },
  {
    id: 'wish.guenter-pils',
    lines: [{ productId: 'product.puettbraeu-pils', quantity: 2 }],
    when: [{ type: 'time', from: h(17), to: h(22) }],
    weight: 3,
    text: 'Zwei Pils. Der Tag war lang genug.',
  },
  {
    id: 'wish.guenter-raetsel',
    lines: [{ productId: 'product.knobelschacht-raetselheft', quantity: 1 }],
    when: [{ type: 'weekday', days: [6] }],
    weight: 4,
    text: 'Das Rätselheft. Sonntags muss der Kopf auch mal laufen.',
  },
];

const deryaWishes: WishDef[] = [
  {
    id: 'wish.derya-fruehstueck',
    lines: [
      { productId: 'product.pottbaecker-broetchen', quantity: 2 },
      { productId: 'product.ruhrbrause-wasser-still', quantity: 1 },
    ],
    when: [
      { type: 'time', from: h(6), to: h(12) },
      { type: 'not', condition: { type: 'questOutcome', questId: 'quest.hof', outcome: 'kompromiss' } },
    ],
    weight: 3,
    text: 'Zwei Brötchen und ein Wasser. Schnell, die Maschine läuft schon warm.',
  },
  {
    id: 'wish.derya-fruehstueck-neun',
    lines: [
      { productId: 'product.pottbaecker-broetchen', quantity: 2 },
      { productId: 'product.ruhrbrause-wasser-still', quantity: 1 },
    ],
    when: [
      { type: 'time', from: h(6), to: h(12) },
      { type: 'questOutcome', questId: 'quest.hof', outcome: 'kompromiss' },
    ],
    weight: 3,
    text: 'Brötchen, Wasser. Gesägt wird erst ab neun. Ich halte mich dran, ehrlich.',
  },
  {
    id: 'wish.derya-suess',
    lines: [{ productId: 'product.pottbaecker-streuselteilchen', quantity: 1 }],
    when: [{ type: 'time', from: h(12), to: h(17) }],
    weight: 3,
    text: 'Ein Streuselteilchen. Mittagszucker, sonst steht die Säge still.',
    onSold: [{ type: 'relationship', npcId: DERYA, delta: 2, key: 'k.derya.erster-kauf' }],
  },
];

const jonasWishes: WishDef[] = [
  {
    id: 'wish.jonas-energy',
    lines: [{ productId: 'product.zechenblitz-energy', quantity: 1 }],
    weight: 3,
    text: 'Eine Zechenblitz, so kalt wie möglich. Ich hab noch vier Lieferungen.',
    onSold: [{ type: 'relationship', npcId: JONAS, delta: 2, key: 'k.jonas.erster-kauf' }],
  },
  {
    id: 'wish.jonas-wassereis',
    lines: [{ productId: 'product.eiskumpel-wassereis-brause', quantity: 1 }],
    when: [{ type: 'time', from: h(12), to: h(22) }],
    weight: 2,
    text: 'Ein Wassereis, Brause. Ich fahr heute nur bergauf, kommt mir vor.',
  },
  {
    id: 'wish.jonas-wasser',
    lines: [{ productId: 'product.ruhrbrause-wasser-still', quantity: 1 }],
    weight: 2,
    text: 'Ein stilles Wasser. Und mach schnell, der Chef zählt die Minuten.',
  },
  {
    // Jonas is 17: the sale can never happen (tobacco is 18+), however the player checks.
    id: 'wish.jonas-tabak',
    lines: [{ productId: 'product.zechenhof-drehtabak-30', quantity: 1 }],
    when: [{ type: 'dayAtLeast', day: 4 }],
    weight: 1,
    text: 'Einmal Drehtabak. Ist für meinen Onkel, der kann gerade nicht.',
  },
];

const marleneWishes: WishDef[] = [
  {
    id: 'wish.marlene-echo',
    lines: [{ productId: 'product.halden-echo-lokalblatt', quantity: 1 }],
    weight: 3,
    text: 'Das Echo, bitte. Die Schulnachrichten stehen heute drin, und ich möchte sie vor dem Direktor lesen.',
    onSold: [{ type: 'relationship', npcId: MARLENE, delta: 2, key: 'k.marlene.erster-kauf' }],
  },
  {
    id: 'wish.marlene-schoko',
    lines: [{ productId: 'product.naschwerk-vollmilch', quantity: 1 }],
    weight: 2,
    text: 'Eine Vollmilch. Frag nicht.',
  },
  {
    id: 'wish.marlene-limo',
    lines: [{ productId: 'product.ruhrbrause-zitronenlimo', quantity: 1 }],
    when: [{ type: 'weekday', days: [0, 1, 2, 3, 4] }],
    weight: 2,
    text: 'Eine Zitronenlimo. Das Telefon im Sekretariat hat mich heute geschafft.',
  },
];

export const ruhrgebietResidents: Record<string, NpcDef> = {
  [GUENTER]: {
    id: GUENTER,
    name: 'Günter Wollny',
    age: 71,
    role: 'Stammkunde, früher Stellwerker',
    bio:
      'Günter hat vierzig Jahre lang Weichen und Signale gestellt und sieht seitdem jede Veränderung auf der Straße zuerst: ' +
      'neue Gardinen, ein anderes Fahrrad, wer zu früh heimgeht. Trocken im Humor, nie nur wehmütig. Mit Schiebermütze und ' +
      'Gehstock, das Knie macht ihm zu schaffen. Morgens Zeitung und Brötchen, manchmal abends ein Pils.',
    assetId: 'N-002',
    personalityTags: ['trocken', 'aufmerksam', 'eigensinnig', 'verlässlich'],
    walkSpeed: 0.9,
    startRelationship: 30,
    homeExitPlaceId: 'place.exit-west',
    routine: [
      { id: 'g.morgen', weekdays: [0, 1, 2, 3, 4, 5], from: h(7), to: h(9, 30), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 85 },
      { id: 'g.sonntag', weekdays: [6], from: h(9), to: h(11), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 70 },
      { id: 'g.ecke', weekdays: [1, 3], from: h(14), to: h(16), activity: 'linger', placeId: 'place.corner', chancePercent: 70 },
      { id: 'g.abend', weekdays: [2, 4, 5], from: h(18), to: h(20, 30), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 60 },
      {
        id: 'g.bank',
        weekdays: [5, 6],
        from: h(15),
        to: h(17),
        activity: 'visit',
        placeId: 'place.yard-bench',
        chancePercent: 80,
        when: [{ type: 'flag', id: 'yard.bench' }],
      },
    ],
    likes: ['product.halden-echo-lokalblatt', 'product.pottbaecker-broetchen', 'product.puettbraeu-pils', 'product.knobelschacht-raetselheft'],
    dislikes: ['product.zechenblitz-energy', 'tag:kids'],
    relationships: [
      { npcId: DERYA, kind: 'Bekannte', note: 'Derya hat ihm im Frühjahr die Gartenbank repariert und wollte kein Geld dafür.' },
      { npcId: MARLENE, kind: 'Hausnachbarin', note: 'Sie bringt ihm den Hausaushang vorbei; er kommentiert ihn trocken.' },
      { npcId: JONAS, kind: 'Lieferbekanntschaft', note: 'Jonas bringt ihm manchmal Medikamente aus der Apotheke; Günter nennt ihn „den Rennleiter“.' },
    ],
    dialogueIds: [
      'dialogue.guenter.erstes-mal',
      'dialogue.guenter.moin',
      'dialogue.guenter.moin-morgen',
      'dialogue.guenter.moin-abend',
      'dialogue.guenter.vertraut',
      'dialogue.guenter.echo-erinnerung',
      'dialogue.guenter.klappe-zu',
      'dialogue.guenter.pils-vergessen',
      'dialogue.guenter.paket-bitte',
      'dialogue.guenter.paket-nochmal',
      'dialogue.guenter.paket-uebergabe',
      'dialogue.guenter.foto-kompromiss',
      'dialogue.guenter.foto-derya',
      'dialogue.guenter.foto-marlene',
      'dialogue.guenter.foto-neutral',
      'dialogue.guenter.foto-offen',
      'dialogue.guenter.foto-danach',
      'dialogue.guenter.foto-staender',
      'dialogue.guenter.paket-abgelehnt',
    ],
    wishes: guenterWishes,
  },
  [DERYA]: {
    id: DERYA,
    name: 'Derya Aksoy',
    age: 38,
    role: 'Tischlerin mit Werkstatt im Hinterhof',
    bio:
      'Derya hat vor vier Jahren eine kleine Tischlerei im Hinterhof aufgemacht und kennt durch Reparaturen halb die Straße. ' +
      'Praktisch, direkt, hilfsbereit und ein bisschen ungeduldig. Arbeitshose, Werkzeuggürtel, Sägespäne an den Ärmeln. ' +
      'Morgens Brötchen und Wasser, mittags etwas Süßes.',
    assetId: 'N-003',
    personalityTags: ['praktisch', 'direkt', 'hilfsbereit', 'ungeduldig'],
    walkSpeed: 1.4,
    startRelationship: 10,
    homeExitPlaceId: 'place.exit-hof',
    routine: [
      { id: 'd.broetchen', weekdays: MON_FRI, from: h(6, 30), to: h(7, 30), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 75 },
      {
        id: 'd.saegen-frueh',
        weekdays: [0, 1, 2, 3, 4, 5],
        from: h(7, 30),
        to: h(12, 30),
        activity: 'linger',
        placeId: 'place.workshop',
        chancePercent: 90,
        when: [{ type: 'not', condition: { type: 'any', conditions: [
          { type: 'questOutcome', questId: 'quest.hof', outcome: 'kompromiss' },
          { type: 'questOutcome', questId: 'quest.hof', outcome: 'marlene' },
        ] } }],
      },
      {
        id: 'd.saegen-spaet',
        weekdays: [0, 1, 2, 3, 4, 5],
        from: h(9),
        to: h(12, 30),
        activity: 'linger',
        placeId: 'place.workshop',
        chancePercent: 85,
        when: [{ type: 'any', conditions: [
          { type: 'questOutcome', questId: 'quest.hof', outcome: 'kompromiss' },
          { type: 'questOutcome', questId: 'quest.hof', outcome: 'marlene' },
        ] }],
      },
      { id: 'd.suess', weekdays: MON_FRI, from: h(12, 45), to: h(13, 45), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 70 },
      {
        id: 'd.bank',
        weekdays: [2, 4],
        from: h(17, 30),
        to: h(19),
        activity: 'visit',
        placeId: 'place.yard-bench',
        chancePercent: 70,
        when: [{ type: 'flag', id: 'yard.bench' }],
      },
    ],
    likes: ['product.pottbaecker-broetchen', 'product.ruhrbrause-wasser-still', 'product.pottbaecker-streuselteilchen', 'tag:morning'],
    dislikes: ['product.ruhrbrause-brause-klassik'],
    relationships: [
      { npcId: GUENTER, kind: 'Bekannter', note: 'Schätzt seine Hartnäckigkeit; sein Wackeltisch ist ihr Dauerauftrag.' },
      { npcId: MARLENE, kind: 'Hofnachbarin', note: 'Respekt auf beiden Seiten, aber der Sägelärm steht zwischen ihnen.' },
      { npcId: JONAS, kind: 'Kurier', note: 'Jonas holt gelegentlich Zuschnitte für sie ab und kommt dabei nie pünktlich.' },
    ],
    dialogueIds: [
      'dialogue.derya.erstes-mal',
      'dialogue.derya.moin',
      'dialogue.derya.moin-morgen',
      'dialogue.derya.moin-mittag',
      'dialogue.derya.vertraut',
      'dialogue.derya.bank',
      'dialogue.derya.hof-seite',
      'dialogue.derya.hof-entscheidung',
      'dialogue.derya.nachklang-kompromiss',
      'dialogue.derya.nachklang-derya',
      'dialogue.derya.nachklang-marlene',
      'dialogue.derya.nachklang-neutral',
      'dialogue.derya.foto-staender',
      'dialogue.derya.foto-kuehl',
    ],
    wishes: deryaWishes,
  },
  [JONAS]: {
    id: JONAS,
    name: 'Jonas Pietrek',
    age: 17,
    role: 'Fahrradkurier (Apothekenfahrten und Pakete)',
    bio:
      'Jonas macht eine Ausbildung und fährt nach der Berufsschule Apothekenlieferungen und Pakete durchs Viertel. ' +
      'Schnell, immer ein bisschen zu spät, kennt jede Abkürzung und bringt Neuigkeiten aus anderen Straßen mit. ' +
      'Fahrradhelm, Kuriertasche, Jacke. Kommt an wechselnden Wochentagen zu wechselnden Zeiten.',
    assetId: 'N-006',
    personalityTags: ['flink', 'neugierig', 'chaotisch', 'freundlich'],
    walkSpeed: 1.6,
    startRelationship: 5,
    homeExitPlaceId: 'place.exit-east',
    routine: [
      { id: 'j.di', weekdays: [1], from: h(15, 15), to: h(16, 30), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 85 },
      { id: 'j.do', weekdays: [3], from: h(16, 30), to: h(18), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 85 },
      { id: 'j.fr-pause', weekdays: [4], from: h(13), to: h(13, 45), activity: 'visit', placeId: 'place.corner', chancePercent: 70 },
      { id: 'j.fr-durch', weekdays: [4], from: h(17), to: h(17, 30), activity: 'pass-by', placeId: 'place.gehweg', chancePercent: 80 },
      { id: 'j.sa', weekdays: [5], from: h(10, 30), to: h(12, 30), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 75 },
      { id: 'j.mi', weekdays: [2], from: h(12, 15), to: h(13), activity: 'pass-by', placeId: 'place.gehweg', chancePercent: 60 },
    ],
    likes: ['product.zechenblitz-energy', 'product.eiskumpel-wassereis-brause', 'tag:sport'],
    dislikes: ['product.knobelschacht-raetselheft'],
    relationships: [
      { npcId: GUENTER, kind: 'Kundschaft', note: 'Liefert ihm Medikamente und mag, dass er immer Trinkgeld verspricht und nie vergisst, ihn zu veräppeln.' },
      { npcId: DERYA, kind: 'Auftraggeberin', note: 'Holt für sie Zuschnitte ab. Sie schimpft über seine Pünktlichkeit und gibt ihm trotzdem jeden Auftrag.' },
      { npcId: MARLENE, kind: 'Sekretärin der Berufsschule', note: 'Sie kennt ihn aus dem Sekretariat, wegen fehlender Entschuldigungen.' },
    ],
    dialogueIds: [
      'dialogue.jonas.erstes-mal',
      'dialogue.jonas.moin',
      'dialogue.jonas.neuigkeit-hof',
      'dialogue.jonas.neuigkeit-bank',
      'dialogue.jonas.neuigkeit-foto',
      'dialogue.jonas.vertraut',
      'dialogue.jonas.paket',
      'dialogue.jonas.tabak-reaktion',
      'dialogue.jonas.paket-danach',
    ],
    wishes: jonasWishes,
  },
  [MARLENE]: {
    id: MARLENE,
    name: 'Marlene Hoffmann',
    age: 58,
    role: 'Schulsekretärin, organisiert die Hausgemeinschaft',
    bio:
      'Marlene sitzt im Sekretariat einer Berufsschule und hält nebenbei das Haus zusammen: Aushänge, Mülltonnen, Treppenhausfest. ' +
      'Warm, aber bestimmt, und sie schätzt ruhige Morgen. Strickjacke, Einkaufstasche, aufrechter Gang. ' +
      'Zeitung, Schokolade und manchmal eine Limonade.',
    assetId: 'N-007',
    personalityTags: ['warmherzig', 'bestimmt', 'ordnungsliebend', 'gesellig'],
    walkSpeed: 1.2,
    startRelationship: 12,
    homeExitPlaceId: 'place.exit-hof',
    routine: [
      { id: 'm.sa-echo', weekdays: [5], from: h(9), to: h(10, 30), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 80 },
      { id: 'm.werktag', weekdays: MON_FRI, from: h(14, 30), to: h(15, 30), activity: 'shop', placeId: 'place.kiosk-window', chancePercent: 65 },
      { id: 'm.ecke', weekdays: [0, 2], from: h(17), to: h(18), activity: 'visit', placeId: 'place.corner', chancePercent: 60 },
      {
        id: 'm.hof-bank',
        weekdays: [3, 6],
        from: h(17),
        to: h(18, 30),
        activity: 'visit',
        placeId: 'place.yard-bench',
        chancePercent: 90,
        when: [{ type: 'flag', id: 'yard.bench' }],
      },
      {
        id: 'm.hof-treff',
        weekdays: [3, 6],
        from: h(17),
        to: h(18, 30),
        activity: 'visit',
        placeId: 'place.yard-bench',
        chancePercent: 60,
        when: [{ type: 'not', condition: { type: 'questOutcome', questId: 'quest.hof', outcome: 'derya' } }],
      },
    ],
    likes: ['product.halden-echo-lokalblatt', 'product.naschwerk-vollmilch', 'product.ruhrbrause-zitronenlimo'],
    dislikes: ['product.puettbraeu-schachtbier-dose', 'tag:matchday'],
    relationships: [
      { npcId: GUENTER, kind: 'Hausnachbar', note: 'Kennt ihn seit dem Treppenhausfest und sorgt dafür, dass er den Hausaushang bekommt.' },
      { npcId: DERYA, kind: 'Hofnachbarin', note: 'Mag ihre Arbeit, nicht den Zeitpunkt. Der Hof als Treffpunkt ist ihr wichtiger als das Holz.' },
      { npcId: JONAS, kind: 'Schüler der Berufsschule', note: 'Sie jagt ihm Entschuldigungen hinterher und hält ihn insgeheim für den Fleißigsten.' },
    ],
    dialogueIds: [
      'dialogue.marlene.erstes-mal',
      'dialogue.marlene.moin',
      'dialogue.marlene.moin-du',
      'dialogue.marlene.moin-morgen',
      'dialogue.marlene.duzen',
      'dialogue.marlene.vertraut',
      'dialogue.marlene.bank',
      'dialogue.marlene.hof-beschwerde',
      'dialogue.marlene.hof-entscheidung',
      'dialogue.marlene.nachklang-kompromiss',
      'dialogue.marlene.nachklang-derya',
      'dialogue.marlene.nachklang-marlene',
      'dialogue.marlene.nachklang-neutral',
      'dialogue.marlene.foto-kuehl',
    ],
    wishes: marleneWishes,
  },
};

// Kept for readers of the routine tables: every weekday is valid.
export const ALL_WEEKDAYS = WEEK;
