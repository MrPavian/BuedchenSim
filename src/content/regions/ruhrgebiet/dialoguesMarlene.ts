import type { DialogueDef } from '../../../game/types';
import { hofDecisionEffects } from './dialoguesDerya';
import { bye, mem, MORNING, opt, rel, step, when } from './dialogueKit';

const M = 'npc.marlene';
const D = 'npc.derya';
const HOF = 'quest.hof';

/** Marlene Hoffmann: school secretary and organiser of the house community. Story A starts here. */
export const marleneDialogues: DialogueDef[] = [
  {
    id: 'dialogue.marlene.erstes-mal',
    npcId: M,
    priority: 80,
    once: true,
    start: 'a',
    nodes: {
      a: {
        text: 'Guten Tag. Sie haben das Büdchen übernommen? Hoffmann, Hausnummer vierzehn, ich organisiere die Hausgemeinschaft. Falls Sie mal einen Aushang brauchen: Das Schwarze Brett kostet nichts.',
        options: [
          opt('aushang', 'Ein Aushang wäre gut.', {
            effects: [mem(M, 'marlene:aushang'), rel(M, 3, 'k.marlene.aushang')],
            next: 'aushang',
          }),
          opt('neu', 'Ja, ich bin noch neu hier.', { effects: [rel(M, 1, 'k.marlene.neu')], next: 'neu' }),
          bye('Guten Tag.'),
        ],
      },
      aushang: {
        text: 'Dienstags und freitags ist Abholung. Gelbe Tonne, Papier. Ich schreibe Ihnen einen Zettel.',
        options: [bye('Danke, das hilft.')],
      },
      neu: { text: 'Man hört es. Das ist nicht schlimm, jeder hat mal angefangen.', options: [bye('Das beruhigt mich.')] },
    },
  },
  {
    id: 'dialogue.marlene.moin',
    npcId: M,
    priority: 1,
    start: 'a',
    nodes: {
      a: {
        text: 'Guten Tag.',
        options: [
          opt('haus', 'Wie läuft es im Haus?', { next: 'haus' }),
          bye('Schönen Tag noch.'),
        ],
      },
      haus: {
        text: 'Zweiter Stock tropft, dritter Stock feiert, vierter Stock beschwert sich über beide. Das Übliche.',
        options: [bye('Klingt nach Leben.')],
      },
    },
  },
  {
    id: 'dialogue.marlene.moin-du',
    npcId: M,
    priority: 3,
    when: [when.memory(M, 'marlene:duzen')],
    start: 'a',
    nodes: {
      a: {
        text: 'Hallo, du. Was gibt es?',
        options: [
          opt('haus', 'Wie läuft es im Haus?', { next: 'haus' }),
          bye('Nichts Besonderes.'),
        ],
      },
      haus: {
        text: 'Im zweiten Stock tropft es immer noch, aber jetzt tropft es wenigstens mit Termin. Der Klempner kommt Donnerstag.',
        options: [bye('Fortschritt.')],
      },
    },
  },
  {
    id: 'dialogue.marlene.moin-morgen',
    npcId: M,
    priority: 5,
    when: [MORNING],
    start: 'a',
    nodes: {
      a: {
        text: 'Um diese Zeit ist mein Kopf noch halb im Bett. Morgens brauche ich Ruhe, sonst wird der Tag laut.',
        options: [
          opt('ruhe', 'Dann sag ich es leise.', { next: 'leise' }),
          bye('Ich lass Sie in Ruhe.'),
        ],
      },
      leise: { text: 'Sehen Sie, geht doch. Wenn das alle so machen würden, hätten wir keine Hausversammlungen.', options: [bye('Dann bis bald.')] },
    },
  },
  {
    id: 'dialogue.marlene.duzen',
    npcId: M,
    priority: 30,
    once: true,
    when: [when.relAtLeast(M, 30)],
    start: 'a',
    nodes: {
      a: {
        text: 'Wir kennen uns jetzt ein paar Wochen. Ich bin Marlene. Das Sie macht mich älter, als ich bin.',
        options: [
          opt('ja', 'Gern, Marlene.', { effects: [mem(M, 'marlene:duzen'), rel(M, 3, 'k.marlene.duzen')], next: 'ja' }),
          opt('sie', 'Ich bleib lieber beim Sie.', { effects: [mem(M, 'marlene:siezen')], next: 'sie' }),
        ],
      },
      ja: { text: 'Na bitte. Dann gehört das Büdchen jetzt ein bisschen zum Haus.', options: [bye('Das freut mich.')] },
      sie: { text: 'Auch gut. Förmlichkeit hat ihr Gutes. Ich nehme es nicht persönlich.', options: [bye('Danke.')] },
    },
  },
  {
    id: 'dialogue.marlene.vertraut',
    npcId: M,
    priority: 9,
    when: [when.relAtLeast(M, 50), when.memory(M, 'marlene:duzen')],
    start: 'a',
    nodes: {
      a: {
        text: 'Weißt du, was ich am Hof mag? Dass man im Sommer das Fenster aufmacht und weiß, wer unten sitzt. Das ist keine Kontrolle, das ist Nachbarschaft.',
        options: [
          opt('nachbarn', 'Beides liegt manchmal nah beieinander.', { next: 'nah' }),
          bye('Das ist ein schöner Gedanke.'),
        ],
      },
      nah: { text: 'Ertappt. Aber wenn ich es nicht tue, tut es keiner. Und dann zieht der Hof zu.', options: [bye('Da hast du recht.')] },
    },
  },
  {
    id: 'dialogue.marlene.bank',
    npcId: M,
    priority: 9,
    when: [when.flag('yard.bench'), when.outcome(HOF, 'kompromiss')],
    start: 'a',
    nodes: {
      a: {
        text: 'Auf der Bank im Hof sitzt jetzt abends das halbe Haus. Und um sieben Uhr morgens ist Stille. Dass ich das noch erlebe.',
        options: [bye('Dann hat es sich gelohnt.')],
      },
    },
  },
  // --- Story A: conflict in the back yard ---------------------------------------------------------------------------
  {
    id: 'dialogue.marlene.hof-beschwerde',
    npcId: M,
    priority: 60,
    when: [when.notStarted(HOF), when.seen('dialogue.marlene.erstes-mal')],
    start: 'a',
    nodes: {
      a: {
        text: 'Ich muss das loswerden. Seit Wochen sägt es ab halb acht im Hof. Ich brauche meine Stunde Ruhe, bevor im Sekretariat das Telefon klingelt. Und der Hof wäre der einzige Platz, wo die Hausgemeinschaft sitzen könnte, wenn nicht überall Bretter lägen.',
        options: [
          opt('verstehen', 'Das klingt anstrengend.', {
            effects: [step(HOF, 'beschwerde'), mem(M, 'marlene:hof-beschwerde'), rel(M, 3, 'k.marlene.hof-zuhoeren')],
            next: 'danke',
          }),
          opt('abwiegeln', 'Das müssen Sie schon selbst klären.', { effects: [rel(M, -2, 'k.marlene.abgewimmelt')], next: 'kuehl' }),
        ],
      },
      danke: {
        text: 'Danke. Sie sind der Erste, der nicht gleich „Das ist doch Handwerk“ sagt. Reden Sie ruhig mit Frau Aksoy. Auf mich hört sie nicht.',
        options: [bye('Ich red mit ihr.')],
      },
      kuehl: { text: 'Dann eben nicht. Ich hatte gedacht, am Büdchen hört man sich Sachen an.', options: [bye('Vielleicht später.')] },
    },
  },
  {
    id: 'dialogue.marlene.hof-entscheidung',
    npcId: M,
    priority: 62,
    when: [when.step(HOF, 'gegenseite')],
    start: 'a',
    nodes: {
      a: {
        text: 'Und? Sie haben mit Frau Aksoy gesprochen. Wie geht es weiter im Hof?',
        options: [
          opt('vermitteln', 'Gesägt wird erst ab neun. Und Derya baut euch aus den Resten eine Bank.', {
            when: [when.relAtLeast(M, 15), when.relAtLeast(D, 15)],
            effects: hofDecisionEffects.kompromiss,
            next: 'kompromiss',
          }),
          opt('derya', 'Derya arbeitet dort. Das ist ihr Platz genauso.', { effects: hofDecisionEffects.derya, next: 'derya' }),
          opt('marlene', 'Sie haben recht. Morgens muss Ruhe sein.', { effects: hofDecisionEffects.marlene, next: 'marlene' }),
          opt('raushalten', 'Das müssen Sie unter sich klären.', { effects: hofDecisionEffects.neutral, next: 'neutral' }),
        ],
      },
      kompromiss: {
        text: 'Eine Bank. Und ab neun. Das hätte ich Ihnen gar nicht zugetraut. Wenn die Säge um neun statt um halb acht anfängt, sitze ich als Erste drauf.',
        options: [bye('Dann bis auf der Bank.')],
      },
      derya: { text: 'Ach so. Dann weiß ich ja, woran ich bin.', options: [bye('Es tut mir leid.')] },
      marlene: { text: 'Danke. Das vergesse ich nicht. Ich rede ruhig mit ihr, versprochen.', options: [bye('Gern.')] },
      neutral: { text: 'Raushalten. Ich verstehe. Es ist nur kein Zustand, in dem man etwas vorwärts bringt.', options: [bye('Ich weiß.')] },
    },
  },
  ...(['kompromiss', 'derya', 'marlene', 'neutral'] as const).map((o): DialogueDef => {
    const texts: Record<typeof o, { text: string; yes: string; yesText: string; no: string; key: string; delta: number }> = {
      kompromiss: {
        text: 'Frau Aksoy hat mir erzählt, wie das mit der Bank gedacht ist. Ich habe gleich den Hausaushang geschrieben: Hofabend am Donnerstag.',
        yes: 'Soll ich was beisteuern?',
        yesText: 'Kommen Sie einfach. Das reicht. Und bringen Sie keine Schokolade mit, die esse ich allein.',
        no: 'Das klingt gut.',
        key: 'k.marlene.nk-kompromiss',
        delta: 2,
      },
      derya: {
        text: 'Der Hof bleibt eine Baustelle. Ich hab die Hofabende abgesagt. Es hat keinen Sinn, an einem Tisch zu sitzen, an dem keiner mehr sitzt.',
        yes: 'Das tut mir leid für das Haus.',
        yesText: 'Danke. Das Haus kommt zurecht. Es braucht nur länger.',
        no: 'Vielleicht ändert es sich.',
        key: 'k.marlene.nk-derya',
        delta: 1,
      },
      marlene: {
        text: 'Ab neun, hat sie mir zugesagt. Ich war zu laut zu ihr, das war nicht fair. Aber es tut gut, wenn jemand zuhört.',
        yes: 'Reden hilft meistens.',
        yesText: 'Meistens. Ich werde ihr einen Kuchen backen, dann wird es auch von der anderen Seite leiser.',
        no: 'Gern geschehen.',
        key: 'k.marlene.nk-marlene',
        delta: 1,
      },
      neutral: {
        text: 'Im Hof wird immer noch gesägt. Ich habe mir Ohropax gekauft. Das ist keine Lösung, sondern ein Pflaster.',
        yes: 'Ich hätte mehr tun sollen.',
        yesText: 'Hätte, hätte. Wichtig ist, dass man es merkt. Schönen Tag noch.',
        no: 'Ich versteh Sie.',
        key: 'k.marlene.nk-neutral',
        delta: 1,
      },
    };
    const t = texts[o];
    return {
      id: `dialogue.marlene.nachklang-${o}`,
      npcId: M,
      priority: 70,
      once: true,
      when: [when.outcome(HOF, o)],
      start: 'a',
      nodes: {
        a: { text: t.text, options: [opt('ja', t.yes, { effects: [rel(M, t.delta, t.key)], next: 'b' }), bye(t.no)] },
        b: { text: t.yesText, options: [bye('Bis dann.')] },
      },
    };
  }),
  // --- Link A -> B: the photo ---------------------------------------------------------------------------------------
  {
    id: 'dialogue.marlene.foto-kuehl',
    npcId: M,
    priority: 58,
    once: true,
    when: [when.flag('kiosk.photo'), when.outcome(HOF, 'derya')],
    start: 'a',
    nodes: {
      a: {
        text: 'Hübsches Foto auf Ihrer Theke. Man sieht, wie ruhig es früher war. Ganz ohne Kreissäge.',
        options: [
          opt('ruhe', 'Ruhe hat auch ihren Preis.', { effects: [mem(M, 'marlene:foto-kuehl')] }),
          bye('Das Foto stammt von Günter Wollny.'),
        ],
      },
    },
  },
];
