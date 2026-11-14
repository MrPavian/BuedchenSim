import type { Condition, DialogueDef } from '../../../game/types';
import { bye, EVENING, flag, mem, MORNING, opt, outcome, rel, step, when } from './dialogueKit';

const G = 'npc.guenter';
const Q = 'quest.paket';
const HOF = 'quest.hof';

/** Günter Wollny: dry, observant retired signalman. Story B (the parcel) and its link to story A (the yard). */
export const guenterDialogues: DialogueDef[] = [
  {
    id: 'dialogue.guenter.erstes-mal',
    npcId: G,
    priority: 80,
    once: true,
    start: 'a',
    nodes: {
      a: {
        text: 'Moin. Du bist also der Neue. Der Vorige hat mir das Echo immer zurückgelegt. Nicht, dass ich das einfordere.',
        options: [
          opt('zusagen', 'Ich leg dir das Echo zurück.', {
            effects: [mem(G, 'guenter:echo-zugesagt'), rel(G, 4, 'k.guenter.echo-zusage')],
            next: 'zugesagt',
          }),
          opt('offen', 'Mal sehen, was sich einrichten lässt.', {
            effects: [mem(G, 'guenter:echo-offen'), rel(G, 1, 'k.guenter.echo-offen')],
            next: 'offen',
          }),
          opt('fragen', 'Wie lange kommst du schon hierher?', {
            effects: [mem(G, 'guenter:stellwerk'), rel(G, 2, 'k.guenter.stellwerk')],
            next: 'stellwerk',
          }),
        ],
      },
      zugesagt: {
        text: 'Gut. Dann weiß ich, woran ich bin. Brötchen nur, wenn sie noch warm sind. Das ist keine Bedingung, nur eine Feststellung.',
        options: [bye('Wird notiert.')],
      },
      offen: {
        text: 'Ehrlich ist auch was. Der Vorige hat viel versprochen und wenig behalten.',
        options: [bye('Ich versuch’s.')],
      },
      stellwerk: {
        text: 'Seit einundachtzig. Erst im Stellwerk am Güterbahnhof, jetzt nur noch zum Zugucken. Von hier aus sieht man mehr als aus jedem Fenster.',
        options: [
          opt('mehr', 'Was siehst du denn so?', { next: 'gesehen' }),
          bye('Dann bist du hier richtig.'),
        ],
      },
      gesehen: {
        text: 'Wer morgens zu spät ist. Wer abends zu früh heimgeht. Und wer neuerdings ein Fahrrad hat, das schneller ist als der Mann darauf.',
        options: [bye('Dir entgeht nichts.')],
      },
    },
  },
  {
    id: 'dialogue.guenter.moin',
    npcId: G,
    priority: 1,
    start: 'a',
    nodes: {
      a: {
        text: 'Moin.',
        options: [
          opt('knie', 'Wie macht sich das Knie?', {
            effects: [mem(G, 'guenter:knie-gefragt'), rel(G, 1, 'k.guenter.knie')],
            next: 'knie',
          }),
          opt('strasse', 'Was gibt’s Neues auf der Straße?', { next: 'strasse' }),
          bye('Schönen Tag noch.'),
        ],
      },
      knie: {
        text: 'Wetterfühlig. Wie ein Barometer mit Beschwerden. Aber es trägt mich noch bis zur Ecke.',
        options: [bye('Das reicht ja auch.')],
      },
      strasse: {
        text: 'Neu ist, dass nichts neu ist. Außer den Gardinen im dritten Stock gegenüber. Die sind grün. Wer hängt freiwillig grüne Gardinen auf?',
        options: [bye('Vielleicht jemand mit Geschmack.')],
      },
    },
  },
  {
    id: 'dialogue.guenter.moin-morgen',
    npcId: G,
    priority: 5,
    when: [MORNING],
    start: 'a',
    nodes: {
      a: {
        text: 'Morgens, wenn die Stadt noch nicht weiß, was sie will. Da mag ich sie am liebsten.',
        options: [
          opt('echo', 'Was steht heute im Echo?', { next: 'echo' }),
          bye('Genieß’ es.'),
        ],
      },
      echo: {
        text: 'Wer gestorben ist, wer eröffnet hat, wer sich beschwert. Die Reihenfolge schwankt.',
        options: [bye('Klingt nach Alltag.')],
      },
    },
  },
  {
    id: 'dialogue.guenter.moin-abend',
    npcId: G,
    priority: 5,
    when: [EVENING],
    start: 'a',
    nodes: {
      a: {
        text: 'Feierabend. Auch wenn ich keinen mehr habe. Das Gefühl bleibt, es kommt nur ohne Schichtplan.',
        options: [
          opt('stellwerk', 'Fehlt dir das Stellwerk?', { next: 'stellwerk' }),
          bye('Ruh dich aus.'),
        ],
      },
      stellwerk: {
        text: 'Nur nachts. Da hatte man Züge gestellt, die man nie gesehen hat. Hier seh ich wenigstens, wer ankommt.',
        options: [bye('Da bist du gut aufgehoben.')],
      },
    },
  },
  {
    id: 'dialogue.guenter.vertraut',
    npcId: G,
    priority: 9,
    when: [when.relAtLeast(G, 50)],
    start: 'a',
    nodes: {
      a: {
        text: 'Weißt du, was an so einem Büdchen das Beste ist? Dass keiner was erklären muss. Man steht, man kauft, man nickt.',
        options: [
          opt('nicken', 'Das Nicken ist das Wichtigste.', { next: 'nicken' }),
          bye('Und trotzdem erzählst du mir was.'),
        ],
      },
      nicken: {
        text: 'Hab ich vierzig Jahre geübt. Man hebt die Hand, der Zug fährt, keiner sagt ein Wort. Mit dir geht das auch.',
        options: [bye('Nick zurück.')],
      },
    },
  },
  {
    id: 'dialogue.guenter.echo-erinnerung',
    npcId: G,
    priority: 8,
    once: true,
    when: [when.memory(G, 'guenter:echo-zugesagt'), MORNING],
    start: 'a',
    nodes: {
      a: {
        text: 'Du hast gesagt, das Echo liegt zurück. Ich frag nicht, ich stelle nur fest, dass ich hier stehe.',
        options: [
          opt('liegt', 'Liegt bereit, Günter.', { effects: [rel(G, 2, 'k.guenter.echo-liegt')], next: 'gut' }),
          opt('vergessen', 'Heute leider nicht, tut mir leid.', { effects: [rel(G, -1, 'k.guenter.echo-vergessen')], next: 'schade' }),
        ],
      },
      gut: { text: 'Siehst du. Läuft wie ein Fahrplan.', options: [bye('Fast pünktlich.')] },
      schade: { text: 'Kann passieren. Ich notiere es nur im Kopf, nicht im Fahrplan.', options: [bye('Danke für die Geduld.')] },
    },
  },
  {
    id: 'dialogue.guenter.klappe-zu',
    npcId: G,
    priority: 30,
    once: true,
    when: [when.memory(G, 'kiosk-closed')],
    start: 'a',
    nodes: {
      a: {
        text: 'Gestern hab ich vor der geschlossenen Klappe gestanden. Kein Drama. Als Eisenbahner kennt man Verspätungen.',
        options: [
          opt('leid', 'Tut mir leid, kommt nicht wieder vor.', { effects: [rel(G, 2, 'k.guenter.klappe-leid')], next: 'ok' }),
          opt('leben', 'Ich hab auch noch ein Leben.', { effects: [rel(G, -2, 'k.guenter.klappe-leben')], next: 'kuehl' }),
        ],
      },
      ok: { text: 'Mal sehen. Ich hab ein langes Gedächtnis und viel Geduld.', options: [bye('Danke.')] },
      kuehl: { text: 'Schön für dich. Ich hab auch eins, aber das beginnt um sieben.', options: [bye('Verstanden.')] },
    },
  },
  {
    id: 'dialogue.guenter.pils-vergessen',
    npcId: G,
    priority: 31,
    once: true,
    when: [when.memory(G, 'declined:wish.guenter-pils')],
    start: 'a',
    nodes: {
      a: {
        text: 'Gestern war kein Pils da. Ich hab mir ein Wasser gegönnt, was ich nicht noch mal tun werde.',
        options: [
          opt('besorgen', 'Ich sorge dafür, dass welches da ist.', { effects: [rel(G, 1, 'k.guenter.pils-versprochen')], next: 'ok' }),
          bye('Es war halt ausverkauft.'),
        ],
      },
      ok: { text: 'Wer Pils führt, wird nicht vergessen. Merk dir das.', options: [bye('Mach ich.')] },
    },
  },
  // --- Story B: a parcel for Günter ---------------------------------------------------------------------------------
  {
    id: 'dialogue.guenter.paket-bitte',
    npcId: G,
    priority: 60,
    once: true,
    when: [when.notStarted(Q), when.seen('dialogue.guenter.erstes-mal'), { type: 'dayAtLeast', day: 2 }],
    start: 'a',
    nodes: {
      a: {
        text: 'Du, bei mir lag ein Zettel im Kasten. Paket, abzuholen im Paketshop an der Zechenstraße. Siebenhundert Meter. Mit dem Knie bin ich da eine Stunde unterwegs.',
        options: [
          opt('anbieten', 'Lass es doch hierher liefern. Ich nehm es an.', {
            effects: [step(Q, 'bitte'), step(Q, 'angebot'), mem(G, 'guenter:paket-angeboten'), rel(G, 3, 'k.guenter.paket-angebot')],
            next: 'ja',
          }),
          opt('spaeter', 'Ich überleg mir was.', { effects: [step(Q, 'bitte'), mem(G, 'guenter:paket-erwaehnt')] }),
          opt('absagen', 'Da kann ich dir nicht helfen.', {
            effects: [outcome(Q, 'abgelehnt'), mem(G, 'guenter:paket-abgelehnt'), rel(G, -3, 'k.guenter.paket-absage')],
            next: 'nein',
          }),
        ],
      },
      ja: {
        text: 'Du würdest das tun? Sag dem Fahrradjungen Bescheid, dem mit der Tasche. Der klingelt sonst vergeblich bei mir.',
        options: [bye('Ich red mit ihm.')],
      },
      nein: { text: 'Verstehe. Dann eben mit dem Stock. Hab schon Schlimmeres geschafft.', options: [bye('Tut mir leid.')] },
    },
  },
  {
    id: 'dialogue.guenter.paket-nochmal',
    npcId: G,
    priority: 59,
    when: [when.step(Q, 'bitte')],
    start: 'a',
    nodes: {
      a: {
        text: 'Das Paket liegt immer noch im Paketshop. Ich erwähne es nur, damit du es weißt.',
        options: [
          opt('anbieten', 'Ich nehm es hier an. Ich sag dem Kurier Bescheid.', {
            effects: [step(Q, 'angebot'), mem(G, 'guenter:paket-angeboten'), rel(G, 3, 'k.guenter.paket-angebot')],
            next: 'ja',
          }),
          opt('absagen', 'Ich kann das wirklich nicht übernehmen.', {
            effects: [outcome(Q, 'abgelehnt'), mem(G, 'guenter:paket-abgelehnt'), rel(G, -3, 'k.guenter.paket-absage')],
            next: 'nein',
          }),
          bye('Ich denke drüber nach.'),
        ],
      },
      ja: { text: 'Sag ihm, er soll nicht klingeln, sondern zu dir fahren. Er ist ja schnell genug.', options: [bye('Mach ich.')] },
      nein: { text: 'Verstehe. Dann eben mit dem Stock.', options: [bye('Tut mir leid.')] },
    },
  },
  {
    id: 'dialogue.guenter.paket-uebergabe',
    npcId: G,
    priority: 70,
    when: [when.flag('parcel.at-kiosk'), when.step(Q, 'paket')],
    start: 'a',
    nodes: {
      a: {
        text: 'Na? Ist da was für mich abgegeben worden?',
        options: [
          opt('uebergeben', 'Ja. Das Paket ist da, bitte sehr.', {
            effects: [flag('parcel.at-kiosk', false), step(Q, 'uebergeben'), mem(G, 'guenter:paket-erhalten'), rel(G, 6, 'k.guenter.paket-erhalten')],
            next: 'danke',
          }),
          bye('Moment, ich muss erst suchen.', 'suchen'),
        ],
      },
      danke: {
        text: 'Dann muss ich nicht durchs ganze Viertel humpeln. Das vergess ich dir nicht. Kann sein, dass ich dir beim nächsten Mal was zeige.',
        options: [bye('Bin gespannt.')],
      },
    },
  },
  {
    id: 'dialogue.guenter.paket-abgelehnt',
    npcId: G,
    priority: 30,
    once: true,
    when: [when.outcome(Q, 'abgelehnt')],
    start: 'a',
    nodes: {
      a: {
        text: 'Paket hab ich geholt. Eine Stunde hin, eine zurück, mit Pausen an jeder zweiten Mauer. Ich erwähne es nur.',
        options: [
          opt('leid', 'Ich hätte es annehmen sollen.', { effects: [rel(G, 2, 'k.guenter.absage-leid')], next: 'ok' }),
          bye('Hauptsache, du hast es.'),
        ],
      },
      ok: { text: 'Gut, dass du es sagst. Das ist mehr, als der Vorige je gesagt hat.', options: [bye('Danke.')] },
    },
  },
];

/** The photo scene (step 4 of story B) in five variants; the outcome of story A (the yard) decides which one Günter plays. */
const photoEffects = [flag('kiosk.photo'), outcome(Q, 'foto'), mem(G, 'guenter:foto-geschenkt'), rel(G, 8, 'k.guenter.foto')];
const photoCommon = (id: string, extraWhen: Condition[], priority: number, reveal: string, comment: string, extraOption?: ReturnType<typeof opt>): DialogueDef => ({
  id,
  npcId: G,
  priority,
  once: true,
  when: [when.step(Q, 'uebergeben'), ...extraWhen],
  start: 'a',
  nodes: {
    a: {
      text: 'Ich hab was mitgebracht. Stand seit Jahren bei mir im Flur und keiner hat es angesehen.',
      options: [opt('zeigen', 'Zeig mal.', { next: 'b' })],
    },
    b: {
      text: reveal,
      options: [opt('aufhaengen', 'Das gehört auf die Theke.', { effects: photoEffects, next: 'c' })],
    },
    c: {
      text: comment,
      options: extraOption ? [extraOption, bye('Danke, Günter.')] : [bye('Danke, Günter.')],
    },
  },
});
const REVEAL =
  'Das Büdchen. Zweiundsiebzig, Eröffnungstag. Der Mann im Kittel ist der erste Pächter, daneben die Familie. Der Rahmen hat sich gelöst, hält gerade noch.';

guenterDialogues.push(
  photoCommon(
    'dialogue.guenter.foto-kompromiss',
    [when.outcome(HOF, 'kompromiss')],
    72,
    REVEAL,
    'Ich hab gehört, im Hof steht jetzt eine Bank, wo früher Gesägtes lag. Wenn die Tischlerin dafür noch einen Ständer baut, ist der Rahmen gerettet.',
    opt('weitersagen', 'Ich sag Derya Bescheid.', { effects: [flag('photo.stand-idee'), mem(G, 'guenter:staender-idee'), rel(G, 2, 'k.guenter.staender')] }),
  ),
  photoCommon(
    'dialogue.guenter.foto-derya',
    [when.outcome(HOF, 'derya')],
    72,
    REVEAL,
    'Du hast dich im Hof auf Deryas Seite gestellt. Kann man so machen. Marlene redet seitdem leiser über dich, nicht netter.',
  ),
  photoCommon(
    'dialogue.guenter.foto-marlene',
    [when.outcome(HOF, 'marlene')],
    72,
    REVEAL,
    'Im Hof herrscht jetzt Ruhe, sagt man. Die Tischlerin schaut an mir vorbei, wenn wir uns begegnen. Ruhe hat ihren Preis.',
  ),
  photoCommon(
    'dialogue.guenter.foto-neutral',
    [when.outcome(HOF, 'neutral')],
    72,
    REVEAL,
    'Du hältst dich aus allem raus, hab ich gehört. Ist auch eine Haltung. Ich hab dreißig Jahre Weichen gestellt: Wer nicht stellt, den stellt der Zug.',
  ),
  photoCommon(
    'dialogue.guenter.foto-offen',
    [when.not(when.outcome(HOF, 'kompromiss')), when.not(when.outcome(HOF, 'derya')), when.not(when.outcome(HOF, 'marlene')), when.not(when.outcome(HOF, 'neutral'))],
    71,
    REVEAL,
    'Sieht man gut, wie wenig sich verändert hat. Die Ecke ist dieselbe. Nur die Leute sind andere, und das Eis ist teurer.',
  ),
  {
    id: 'dialogue.guenter.foto-danach',
    npcId: G,
    priority: 12,
    when: [when.outcome(Q, 'foto'), when.not(when.flag('photo.stand'))],
    start: 'a',
    nodes: {
      a: {
        text: 'Hängt mein Foto noch? Gut. Dann weiß jeder, dass das hier schon immer ein Ort war und kein Laden.',
        options: [opt('ja', 'Es steht jeden Tag auf der Theke.', { effects: [rel(G, 1, 'k.guenter.foto-danach')] }), bye('Ich pass drauf auf.')],
      },
    },
  },
  {
    id: 'dialogue.guenter.foto-staender',
    npcId: G,
    priority: 13,
    when: [when.outcome(Q, 'foto'), when.flag('photo.stand')],
    start: 'a',
    nodes: {
      a: {
        text: 'Das Foto steht auf einem Ständer aus Eiche. Handwerk. Die Tischlerin hat mir nichts berechnet, sagt sie. Ich bring ihr dafür Kaffee.',
        options: [opt('ja', 'Das Bild hat’s verdient.', { effects: [rel(G, 2, 'k.guenter.foto-staender')] }), bye('Grüß sie von mir.')],
      },
    },
  },
);
