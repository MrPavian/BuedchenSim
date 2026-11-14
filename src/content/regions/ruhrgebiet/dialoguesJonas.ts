import type { DialogueDef } from '../../../game/types';
import { bye, flag, mem, opt, rel, step, when } from './dialogueKit';

const J = 'npc.jonas';
const Q = 'quest.paket';
const HOF = 'quest.hof';

/** Jonas Pietrek: 17-year-old courier who brings news from other streets. Step 2 of story B (the parcel) happens here. */
export const jonasDialogues: DialogueDef[] = [
  {
    id: 'dialogue.jonas.erstes-mal',
    npcId: J,
    priority: 80,
    once: true,
    start: 'a',
    nodes: {
      a: {
        text: 'Moin, kurz nur. Ich hab Apothekenfahrten bis vier und der Chef zählt die Minuten. Du bist neu hier, oder? Ich bin der, der hier nie pünktlich ist.',
        options: [
          opt('rad', 'Fährst du das den ganzen Tag?', { effects: [rel(J, 2, 'k.jonas.fahrrad')], next: 'rad' }),
          opt('tipp', 'Hast du Tipps für die Gegend?', { effects: [mem(J, 'jonas:tipp-bekommen')], next: 'tipp' }),
          bye('Dann nicht aufhalten.'),
        ],
      },
      rad: {
        text: 'Vier Tage Schule, drei Tage Räder. Ich kenn jede Ecke, wo man noch durchpasst. Ist wie ein Parcours, nur dass einem Rentner im Weg stehen.',
        options: [bye('Fahr vorsichtig.')],
      },
      tipp: {
        text: 'Kanalbrücke ist Baustelle, nimm den Weg am Spielplatz. Und wenn du eine Abkürzung zum Hinterhof suchst: Frag nicht mich, ich bin Radfahrer, ich hab die Hecke gerammt.',
        options: [bye('Gut zu wissen.')],
      },
    },
  },
  {
    id: 'dialogue.jonas.moin',
    npcId: J,
    priority: 1,
    start: 'a',
    nodes: {
      a: {
        text: 'Hey. Zeit hab ich eigentlich nicht.',
        options: [
          opt('neues', 'Was gibt’s Neues aus den anderen Straßen?', { next: 'neues' }),
          bye('Dann los.'),
        ],
      },
      neues: {
        text: 'Auf der Hüttenstraße macht der Optiker zu. Alle drei Schaufenster voller Rabatt. Zum ersten Mal schauen sich die Leute die Fenster an.',
        options: [bye('Immer erst, wenn es zu spät ist.')],
      },
    },
  },
  {
    id: 'dialogue.jonas.neuigkeit-hof',
    npcId: J,
    priority: 7,
    when: [when.step(HOF, 'gegenseite')],
    start: 'a',
    nodes: {
      a: {
        text: 'Im Hinterhof ist dicke Luft, hab ich gehört. Die Frau aus dem Sekretariat sagt, es sägt zu früh. Die Tischlerin sagt, sie sägt, wann sie muss. Wer von beiden Recht hat, weiß ich nicht. Ich hol nur Zuschnitte ab.',
        options: [bye('Ich kümmere mich drum.')],
      },
    },
  },
  {
    id: 'dialogue.jonas.neuigkeit-bank',
    npcId: J,
    priority: 8,
    when: [when.flag('yard.bench')],
    start: 'a',
    nodes: {
      a: {
        text: 'Im Hof steht jetzt eine Bank, hab ich im Vorbeifahren gesehen. Neu? Da sitzen Leute drauf, mitten in der Woche. Ich dachte, die Leute hier haben keine Zeit.',
        options: [bye('Anscheinend haben sie welche gefunden.')],
      },
    },
  },
  {
    id: 'dialogue.jonas.neuigkeit-foto',
    npcId: J,
    priority: 8,
    when: [when.flag('kiosk.photo')],
    start: 'a',
    nodes: {
      a: {
        text: 'Auf deiner Theke steht ein altes Foto. Zweiundsiebzig? Der Wollny hat mir mal was von einem Foto erzählt, aber ich dachte, er übertreibt.',
        options: [bye('Hat er nicht.')],
      },
    },
  },
  {
    id: 'dialogue.jonas.vertraut',
    npcId: J,
    priority: 9,
    when: [when.relAtLeast(J, 50)],
    start: 'a',
    nodes: {
      a: {
        text: 'Sag mal, darf ich dir was erzählen? Ich will nicht ewig Kurier bleiben. Mechatroniker, wenn es klappt. Die Berufsschule ist okay, nur Frau Hoffmann im Sekretariat führt eine Strichliste.',
        options: [
          opt('klappt', 'Das klappt bestimmt.', { next: 'klappt' }),
          bye('Dann hilft dir die Strichliste nicht.'),
        ],
      },
      klappt: { text: 'Sagen alle. Aber von dir klingt es nicht so, als müsste man es verkaufen.', options: [bye('Fahr los.')] },
    },
  },
  // --- Story B: a parcel for Günter (step 2) ------------------------------------------------------------------------
  {
    id: 'dialogue.jonas.paket',
    npcId: J,
    priority: 60,
    when: [when.step(Q, 'angebot')],
    start: 'a',
    nodes: {
      a: {
        text: 'Du, das Paket für den Wollny. Dreimal versucht, er macht nicht auf oder ist beim Knie. Soll ich es bei dir lassen?',
        options: [
          opt('annehmen', 'Gib her, ich geb es ihm.', {
            effects: [flag('parcel.at-kiosk'), step(Q, 'paket'), mem(J, 'jonas:paket-abgegeben'), rel(J, 4, 'k.jonas.paket')],
            next: 'ok',
          }),
          opt('ablehnen', 'Lieber nicht, das ist mir zu viel Verantwortung.', { effects: [mem(J, 'jonas:paket-abgelehnt')], next: 'nein' }),
        ],
      },
      ok: { text: 'Ich schreibe „bei Nachbar abgegeben“. Sag ihm: Zustellversuch zählt nicht, wenn er nicht da ist.', options: [bye('Richte ich aus.')] },
      nein: { text: 'Auch gut. Dann fahr ich morgen noch mal hin und klingele mir einen Wolf.', options: [bye('Frag mich später noch mal.')] },
    },
  },
  {
    id: 'dialogue.jonas.paket-danach',
    npcId: J,
    priority: 40,
    once: true,
    when: [when.outcome(Q, 'foto')],
    start: 'a',
    nodes: {
      a: {
        text: 'Der Wollny hat mir zwei Euro Trinkgeld gegeben. Der! Der hat in seinem Leben nie Trinkgeld gegeben, er hat nur immer gedroht. Was hast du mit ihm gemacht?',
        options: [
          opt('nichts', 'Ich hab ein Paket angenommen.', { effects: [rel(J, 2, 'k.jonas.paket-danach')], next: 'ok' }),
          bye('Geheimnis.'),
        ],
      },
      ok: { text: 'Siehst du, das ist der Unterschied zwischen Zustellung und Nachbarschaft.', options: [bye('Gut gesagt.')] },
    },
  },
  {
    id: 'dialogue.jonas.tabak-reaktion',
    npcId: J,
    priority: 40,
    once: true,
    when: [when.memory(J, 'declined:wish.jonas-tabak')],
    start: 'a',
    nodes: {
      a: {
        text: 'Wegen vorhin. Der Tabak war wirklich für meinen Onkel, glaub ich. Der kann halt nicht selbst gehen. Aber ich versteh schon, dass du nicht verkaufst.',
        options: [
          opt('regel', 'Regel ist Regel. Sag ihm, er soll selbst kommen.', { effects: [rel(J, 2, 'k.jonas.respekt')], next: 'ok' }),
          bye('Ist schon gut.'),
        ],
      },
      ok: { text: 'Ich richte es aus. Ist ehrlicher als bei dem Laden an der Ecke. Da fragt keiner.', options: [bye('Fahr los.')] },
    },
  },
];
