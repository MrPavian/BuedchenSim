import type { QuestDef } from '../../../game/types';

/** Two small everyday stories; the outcome of the first (the yard) shapes the end of the second (the photo). */
export const ruhrgebietQuests: Record<string, QuestDef> = {
  'quest.hof': {
    id: 'quest.hof',
    title: 'Krach im Hinterhof',
    steps: [
      {
        id: 'beschwerde',
        journal: 'Marlene Hoffmann stört sich am frühen Sägen im Hof. Sie wünscht sich ruhige Morgen und den Hof als Treffpunkt für das Haus.',
      },
      {
        id: 'gegenseite',
        journal: 'Derya Aksoy sägt morgens, weil die Aufträge am Mittag raus müssen. Ihre Werkstatt steht seit Jahren im Hof.',
      },
      { id: 'entscheidung', journal: 'Beide Seiten sind gehört. Du hast dich entschieden.' },
    ],
    outcomes: [
      { id: 'kompromiss', journal: 'Gesägt wird erst ab neun, und Derya baut aus Resten eine Bank für den Hof.' },
      { id: 'derya', journal: 'Du hast dich auf Deryas Seite gestellt. Marlene ist enttäuscht, die Säge läuft früh weiter.' },
      { id: 'marlene', journal: 'Du hast Marlene recht gegeben. Derya sägt erst ab neun und ist verstimmt.' },
      { id: 'neutral', journal: 'Du hast dich rausgehalten. Beide fühlen sich allein gelassen.' },
    ],
  },
  'quest.paket': {
    id: 'quest.paket',
    title: 'Ein Paket für Günter',
    steps: [
      { id: 'bitte', journal: 'Günter Wollny kommt mit seinem Knie nicht zum Paketshop.' },
      { id: 'angebot', journal: 'Du hast angeboten, das Paket am Kiosk anzunehmen. Jonas, der Kurier, soll Bescheid wissen.' },
      { id: 'paket', journal: 'Jonas hat das Paket für Günter am Kiosk gelassen.' },
      { id: 'uebergeben', journal: 'Günter hat sein Paket. Er hat angedeutet, dass er dir bei Gelegenheit etwas zeigen will.' },
    ],
    outcomes: [
      { id: 'foto', journal: 'Günter hat ein Foto vom Kiosk aus dem Jahr 1972 gebracht. Es steht jetzt auf der Theke.' },
      { id: 'abgelehnt', journal: 'Du hast Günter nicht geholfen. Er holt sein Paket selbst, irgendwann.' },
    ],
  },
};
