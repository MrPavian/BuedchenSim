import { describe, expect, it } from 'vitest';
import { createGame } from '../game';
import { createInitialSpecialty } from '../specialty';
import { createInitialState } from '../state';
import { MASSE, specialty, specialtyPack } from '../testing/specialtyPack';
import { CURRENT_SCHEMA_VERSION, parseSave, serializeSave } from './save';

/** Schema version 4 (Auftrag 05): specialties. Calendar day, weather and events are derived and not saved. */

describe('schema version 4 (specialties)', () => {
  it('was followed by version 5 (Auftrag 06)', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(5);
  });

  it('3 -> 4 adds the specialties and keeps everything else', () => {
    const state = createInitialState(specialtyPack);
    state.calendar.day = 12;
    state.economy.storage = { [MASSE]: 2 };
    state.story.flags['kiosk.photo'] = true;
    const v3 = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
    delete v3['specialties'];
    const result = parseSave(JSON.stringify({ schemaVersion: 3, savedAt: '2026-11-11T10:00:00.000Z', state: v3 }), specialtyPack);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.state.calendar.day).toBe(12);
    expect(result.state.economy.storage).toEqual({ [MASSE]: 2 });
    expect(result.state.story.flags).toEqual({ 'kiosk.photo': true });
    expect(result.state.specialties).toEqual({ [specialty.id]: createInitialSpecialty() });
  });

  it('roundtrips a running production, fame, buyers and feedback exactly', () => {
    const game = createGame(specialtyPack, undefined, 7);
    const state = game.state as unknown as ReturnType<typeof createInitialState>;
    state.calendar.minute = 600;
    state.economy.storage = { [MASSE]: 1, 'product.test-water': 2 };
    expect(game.specialty.startProduction(specialty.id, 1, false)).toEqual({ ok: true });
    const s = state.specialties[specialty.id];
    if (!s) throw new Error('specialty');
    Object.assign(s, { stage: 2, fame: 41.5, sold: 9, buyers: { 'npc.stammkunde': 3 }, ratings: 3, satisfactionSum: 180, recommendations: 1, stockQuality: 61 });
    s.feedback.push({ day: 1, minute: 610, npcId: 'npc.stammkunde', rating: 'good', satisfaction: 60, text: 'Gut.' });
    const result = parseSave(serializeSave(state), specialtyPack);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.state.specialties).toEqual(state.specialties);
  });

  it('drops unknown specialties with a warning and rejects broken values', () => {
    const state = createInitialState(specialtyPack);
    const raw = JSON.parse(serializeSave(state)) as { state: { specialties: Record<string, unknown> } };
    raw.state.specialties['specialty.gone'] = createInitialSpecialty();
    const dropped = parseSave(JSON.stringify(raw), specialtyPack);
    expect(dropped.status).toBe('ok');
    if (dropped.status === 'ok') {
      expect(Object.keys(dropped.state.specialties)).toEqual([specialty.id]);
      expect(dropped.warnings?.some((w) => w.includes('specialty.gone'))).toBe(true);
    }
    raw.state.specialties[specialty.id] = { ...createInitialSpecialty(), stage: 7 };
    expect(parseSave(JSON.stringify(raw), specialtyPack).status).toBe('corrupt');
  });
});
