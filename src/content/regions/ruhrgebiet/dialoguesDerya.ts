import type { DialogueDef, Effect } from '../../../game/types';
import { bye, AFTERNOON, flag, mem, MORNING, opt, outcome, rel, step, when } from './dialogueKit';

const D = 'npc.derya';
const M = 'npc.marlene';
const HOF = 'quest.hof';

/** Effects of the yard decision; shared by the decision dialogues of Derya and Marlene (same keys: the effect happens once). */
export const hofDecisionEffects: Record<'kompromiss' | 'derya' | 'marlene' | 'neutral', Effect[]> = {
  kompromiss: [
    step(HOF, 'entscheidung'),
    outcome(HOF, 'kompromiss'),
    flag('yard.bench'),
    mem(D, 'derya:hof-kompromiss'),
    mem(M, 'marlene:hof-kompromiss'),
    rel(D, 5, 'k.hof.kompromiss.derya'),
    rel(M, 5, 'k.hof.kompromiss.marlene'),
  ],
  derya: [
    step(HOF, 'entscheidung'),
    outcome(HOF, 'derya'),
    mem(D, 'derya:hof-unterstuetzt'),
    mem(M, 'marlene:hof-uebergangen'),
    rel(D, 6, 'k.hof.derya.derya'),
    rel(M, -8, 'k.hof.derya.marlene'),
  ],
  marlene: [
    step(HOF, 'entscheidung'),
    outcome(HOF, 'marlene'),
    mem(D, 'derya:hof-uebergangen'),
    mem(M, 'marlene:hof-unterstuetzt'),
    rel(D, -8, 'k.hof.marlene.derya'),
    rel(M, 6, 'k.hof.marlene.marlene'),
  ],
  neutral: [
    step(HOF, 'entscheidung'),
    outcome(HOF, 'neutral'),
    mem(D, 'derya:hof-rausgehalten'),
    mem(M, 'marlene:hof-rausgehalten'),
    rel(D, -2, 'k.hof.neutral.derya'),
    rel(M, -2, 'k.hof.neutral.marlene'),
  ],
};

const trusted = [when.relAtLeast(D, 15), when.relAtLeast(M, 15)];

/** Derya Aksoy: practical carpenter in the back yard. Story A (yard conflict) side two and decision; link to story B (photo). */
export const deryaDialogues: DialogueDef[] = [
  {
    id: 'dialogue.derya.erstes-mal',
    npcId: D,
    priority: 80,
    once: true,
    start: 'a',
    nodes: {
      a: {
        text: 'Moin. Aksoy, Tischlerei hinterm Haus. Du bist der Neue am Büdchen, oder? Wenn dir ein Regal wackelt, sag Bescheid.',
        options: [
          opt('regal', 'Mein Wandregal wackelt tatsächlich.', {
            effects: [mem(D, 'derya:regal-angeboten'), rel(D, 3, 'k.derya.regal')],
            next: 'regal',
          }),
          opt('werkstatt', 'Eine Tischlerei im Hinterhof?', { effects: [rel(D, 2, 'k.derya.werkstatt')], next: 'werkstatt' }),
          bye('Gut zu wissen.'),
        ],
      },
      regal: {
        text: 'Dann guck ich es mir an. Nicht heute. Meistens ist die Wand das Problem, nicht das Regal.',
        options: [bye('Dann bis bald.')],
      },
      werkstatt: {
        text: 'Seit vier Jahren. Zwei Maschinen, ein Stapel Eiche und ein Hund, der nicht mir gehört, aber jeden Morgen kommt.',
        options: [bye('Klingt nach Alltag.')],
      },
    },
  },
  {
    id: 'dialogue.derya.moin',
    npcId: D,
    priority: 1,
    start: 'a',
    nodes: {
      a: {
        text: 'Moin.',
        options: [
          opt('auftrag', 'Viel zu tun?', { next: 'auftrag' }),
          opt('wer', 'Du kennst hier alle, oder?', { effects: [mem(D, 'derya:erzaehlt-bewohner'), rel(D, 1, 'k.derya.bewohner')], next: 'wer' }),
          bye('Schönen Tag.'),
        ],
      },
      auftrag: {
        text: 'Immer. Wer ein Möbelstück will, will es gestern. Und zahlt dann am liebsten übermorgen.',
        options: [bye('Kenn ich.')],
      },
      wer: {
        text: 'Fast. Wollny sitzt morgens an der Ecke, Frau Hoffmann regt sich über alles auf, was Krach macht, und der Fahrradjunge ist zu keiner Uhrzeit pünktlich. Aber alle bezahlen ihre Rechnungen.',
        options: [bye('Das ist die halbe Miete.')],
      },
    },
  },
  {
    id: 'dialogue.derya.moin-morgen',
    npcId: D,
    priority: 6,
    when: [MORNING, when.notStarted(HOF)],
    start: 'a',
    nodes: {
      a: {
        text: 'Bevor du fragst: Ja, ich fang früh an. Nein, es ist nicht persönlich gemeint.',
        options: [
          opt('wieso', 'Wer fragt denn?', { next: 'wieso' }),
          bye('Ich hab nichts gesagt.'),
        ],
      },
      wieso: {
        text: 'Die Leute im zweiten Stock. Einer von denen hat den ganzen Hof für sich entdeckt. Dabei ist das ein Arbeitshof.',
        options: [bye('Ich hör mal rum.')],
      },
    },
  },
  {
    id: 'dialogue.derya.moin-mittag',
    npcId: D,
    priority: 5,
    when: [AFTERNOON],
    start: 'a',
    nodes: {
      a: {
        text: 'Mittagszucker. Ohne den steht die Säge still und der Kunde fragt, warum.',
        options: [bye('Dann bleib süß.')],
      },
    },
  },
  {
    id: 'dialogue.derya.vertraut',
    npcId: D,
    priority: 9,
    when: [when.relAtLeast(D, 50)],
    start: 'a',
    nodes: {
      a: {
        text: 'Mein Vater war Schreiner in der Nachbarstadt. Ich hab seinen Betrieb nicht übernommen, ich hab meinen eigenen gebaut. Er findet das bis heute nicht vorgesehen.',
        options: [
          opt('stolz', 'Er ist bestimmt stolz.', { next: 'stolz' }),
          bye('Eigener Kopf, eigener Hof.'),
        ],
      },
      stolz: { text: 'Er sagt es nie. Aber er kommt jeden Monat und prüft meine Zapfenverbindungen. Das ist bei uns dasselbe.', options: [bye('Das ist es.')] },
    },
  },
  {
    id: 'dialogue.derya.bank',
    npcId: D,
    priority: 9,
    when: [when.flag('yard.bench'), when.outcome(HOF, 'kompromiss')],
    start: 'a',
    nodes: {
      a: {
        text: 'Die Bank hat sogar Wollny ausprobiert. Sein Urteil: zu weich, aber tragfähig. Von ihm ist das ein Orden.',
        options: [bye('Dann hast du ihn.')],
      },
    },
  },
  // --- Story A: conflict in the back yard ---------------------------------------------------------------------------
  {
    id: 'dialogue.derya.hof-seite',
    npcId: D,
    priority: 60,
    when: [when.step(HOF, 'beschwerde')],
    start: 'a',
    nodes: {
      a: {
        text: 'Hat Frau Hoffmann sich bei dir ausgeheult? Hab ich mir gedacht. Der Hof gehört zum Haus, aber meine Werkstatt steht auch da. Und ich war vor ihr da.',
        options: [
          opt('zuhoeren', 'Warum muss es so früh sein?', { next: 'grund' }),
          bye('Ich will mich nicht einmischen.', 'abwiegeln'),
        ],
      },
      grund: {
        text: 'Weil die Platten morgens gerade sind und nachmittags schon wieder arbeiten. Und weil um zwölf der Kunde kommt und das Regal fertig sein muss. Ich säge nicht aus Spaß.',
        options: [
          opt('verstanden', 'Verstehe. Beide haben ihre Gründe.', {
            effects: [step(HOF, 'gegenseite'), mem(D, 'derya:hof-gehoert'), rel(D, 3, 'k.derya.hof-zuhoeren')],
            next: 'ende',
          }),
          bye('Das klingt nach Ausrede.', 'ausrede'),
        ],
      },
      ende: { text: 'Immerhin einer, der fragt, bevor er urteilt.', options: [bye('Ich denk drüber nach.')] },
    },
  },
  {
    id: 'dialogue.derya.hof-entscheidung',
    npcId: D,
    priority: 62,
    when: [when.step(HOF, 'gegenseite')],
    start: 'a',
    nodes: {
      a: {
        text: 'Du hast mit uns beiden geredet. Also: Wie geht’s weiter im Hof?',
        options: [
          opt('vermitteln', 'Gesägt wird erst ab neun. Dafür baust du aus den Resten eine Bank.', {
            when: trusted,
            effects: hofDecisionEffects.kompromiss,
            next: 'kompromiss',
          }),
          opt('derya', 'Dein Hof, deine Werkstatt. Frau Hoffmann muss damit leben.', { effects: hofDecisionEffects.derya, next: 'derya' }),
          opt('marlene', 'Morgens ist Ruhe. Da hat Marlene recht.', { effects: hofDecisionEffects.marlene, next: 'marlene' }),
          opt('raushalten', 'Das müsst ihr unter euch klären.', { effects: hofDecisionEffects.neutral, next: 'neutral' }),
        ],
      },
      kompromiss: {
        text: 'Ab neun. Eine Bank aus Eichenresten, die habe ich eh noch liegen. Meinetwegen. Sag Frau Hoffmann, sie soll die Schrauben selbst festdrehen, wenn sie meckert.',
        options: [bye('Sag ich ihr.')],
      },
      derya: {
        text: 'Gut. Ich vergess das nicht. Sie wird dich dafür nicht mehr grüßen, das weißt du.',
        options: [bye('Ich weiß.')],
      },
      marlene: {
        text: 'Ab neun also. Dann ist das so. Ich hätte nur gedacht, du fragst vorher, wie das mit meinen Aufträgen aussieht.',
        options: [bye('Tut mir leid.')],
      },
      neutral: {
        text: 'Raushalten. Fair, bequem und hilft keinem.',
        options: [bye('Ich weiß.')],
      },
    },
  },
  ...(['kompromiss', 'derya', 'marlene', 'neutral'] as const).map((o): DialogueDef => {
    const texts: Record<typeof o, { text: string; yes: string; yesText: string; no: string; key: string; delta: number }> = {
      kompromiss: {
        text: 'Die Bank wird besser, als ich dachte. Eiche, aus den Resten. Und bis neun gehört der Hof Frau Hoffmann. Hätte schlimmer kommen können.',
        yes: 'Das wird ein guter Platz.',
        yesText: 'Setz dich ruhig mal drauf, wenn sie fertig ist.',
        no: 'Dann bis später.',
        key: 'k.derya.nk-kompromiss',
        delta: 2,
      },
      derya: {
        text: 'Du hast dich auf meine Seite gestellt. Das merk ich mir. Der Hof bleibt ein Arbeitshof, und ich säge weiter, wann es sein muss.',
        yes: 'Ich hab gesagt, was ich denke.',
        yesText: 'Das ist selten genug.',
        no: 'Hoffentlich bleibt es friedlich.',
        key: 'k.derya.nk-derya',
        delta: 1,
      },
      marlene: {
        text: 'Ab neun, ohne mich zu fragen. Ich sage nicht, dass es falsch war. Ich sage nur, dass ich es gemerkt hab.',
        yes: 'Es tut mir leid, dass es so lief.',
        yesText: 'Schon gut. Ich bin ungeduldig, nicht nachtragend. Meistens.',
        no: 'So ist es nun.',
        key: 'k.derya.nk-marlene',
        delta: 2,
      },
      neutral: {
        text: 'Du hast dich rausgehalten. Fair. Hilft mir nur nicht. Der Hof ist so laut oder leise, wie ich ihn mache.',
        yes: 'Ich wollte keinem wehtun.',
        yesText: 'Hat keiner verlangt. Aber niemand ist unparteiisch, der nichts tut.',
        no: 'Dann sehen wir weiter.',
        key: 'k.derya.nk-neutral',
        delta: 1,
      },
    };
    const t = texts[o];
    return {
      id: `dialogue.derya.nachklang-${o}`,
      npcId: D,
      priority: 70,
      once: true,
      when: [when.outcome(HOF, o)],
      start: 'a',
      nodes: {
        a: { text: t.text, options: [opt('ja', t.yes, { effects: [rel(D, t.delta, t.key)], next: 'b' }), bye(t.no)] },
        b: { text: t.yesText, options: [bye('Bis dann.')] },
      },
    };
  }),
  // --- Link A -> B: the photo ---------------------------------------------------------------------------------------
  {
    id: 'dialogue.derya.foto-staender',
    npcId: D,
    priority: 58,
    once: true,
    when: [when.flag('photo.stand-idee'), when.not(when.flag('photo.stand'))],
    start: 'a',
    nodes: {
      a: {
        text: 'Wollny hat erzählt, du hast ein Foto vom Büdchen von zweiundsiebzig. Ich hab noch Eiche von der Bank übrig. Ein Ständer, dann fällt das Ding nicht beim ersten Kunden um.',
        options: [
          opt('bitte', 'Bau ihn. Ich nehm das gern.', {
            effects: [flag('photo.stand'), mem(D, 'derya:staender-gebaut'), rel(D, 4, 'k.derya.staender')],
            next: 'ja',
          }),
          opt('lass', 'Lass mal, so reicht es.', { effects: [mem(D, 'derya:staender-abgelehnt')] }),
        ],
      },
      ja: { text: 'Morgen steht er auf deiner Theke. Und Wollny zahlt mir dafür einen Kaffee, hat er gesagt. Ich halt ihn dran fest.', options: [bye('Danke dir.')] },
    },
  },
  {
    id: 'dialogue.derya.foto-kuehl',
    npcId: D,
    priority: 58,
    once: true,
    when: [when.flag('kiosk.photo'), when.outcome(HOF, 'marlene')],
    start: 'a',
    nodes: {
      a: {
        text: 'Ach, ein Foto auf der Theke. Schick. Wenn du mal was gesägt haben willst: Ab neun bin ich ja jetzt zu sprechen.',
        options: [
          opt('ok', 'Das Foto ist nicht gegen dich.', { effects: [mem(D, 'derya:foto-kuehl')] }),
          bye('Ich weiß, ich weiß.'),
        ],
      },
    },
  },
];
