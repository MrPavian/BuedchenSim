import type { DialogueDef } from '../../../game/types';
import { deryaDialogues } from './dialoguesDerya';
import { guenterDialogues } from './dialoguesGuenter';
import { jonasDialogues } from './dialoguesJonas';
import { marleneDialogues } from './dialoguesMarlene';

/** All dialogues of the Ruhrgebiet pack, keyed by id (the files per resident hold the content). */
export const ruhrgebietDialogues: Record<string, DialogueDef> = Object.fromEntries(
  [...guenterDialogues, ...deryaDialogues, ...jonasDialogues, ...marleneDialogues].map((d) => [d.id, d]),
);
