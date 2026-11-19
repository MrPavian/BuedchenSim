import type { EventAmbience } from '../game/eventCalendar';
import type { Game } from '../game/game';
import { sunOf } from '../game/sun';
import { AMBIENCE_LAYERS, ambienceMix, masterGain, type AmbienceLayer, type AmbienceMix, type SoundLevel } from './mix';

/**
 * Sound of the neighbourhood (Auftrag 06, 6.4). Everything is synthesised with the Web Audio API (decision O-6): no
 * sound files, no licences, no real music or chants. The module only listens: it reads the derived state (weather,
 * events, time of day) and the game's signals and never changes the game. The audio context is created on the first
 * player gesture (browser rule) and only if sound is not switched off.
 */

export interface AudioInfo {
  /** 'none' until the context exists, then the context state ('running', 'suspended', 'closed'). */
  state: string;
  level: SoundLevel;
  mix: AmbienceMix | null;
  /** One-shot sounds played since start, by name (for checks). */
  played: Record<string, number>;
}

export interface GameAudio {
  /** Call from a user gesture (pointer/key): creates or resumes the audio context. */
  unlock(): void;
  setLevel(level: SoundLevel): void;
  info(): AudioInfo;
  dispose(): void;
}

type Ctx = AudioContext;

/** Small deterministic generator for noise buffers and musical choices (no Math.random). */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function noiseBuffer(ctx: Ctx, seconds: number, color: 'white' | 'pink' | 'brown', seed: number): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  const rand = rng(seed);
  let b0 = 0, b1 = 0, b2 = 0, last = 0;
  for (let i = 0; i < length; i += 1) {
    const white = rand() * 2 - 1;
    if (color === 'white') data[i] = white * 0.5;
    else if (color === 'pink') {
      b0 = 0.99765 * b0 + white * 0.099046;
      b1 = 0.963 * b1 + white * 0.2965164;
      b2 = 0.57 * b2 + white * 1.0526913;
      data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.12;
    } else {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
  }
  return buffer;
}

interface Layer {
  gain: GainNode;
  /** Relative loudness of the layer at mix value 1. */
  scale: number;
}

export function createAudio(game: Game, initialLevel: SoundLevel): GameAudio {
  let level = initialLevel;
  let ctx: Ctx | null = null;
  let master: GainNode | null = null;
  let layers: Partial<Record<AmbienceLayer, Layer>> = {};
  let mix: AmbienceMix | null = null;
  let timer: ReturnType<typeof setInterval> | null = null;
  const played: Record<string, number> = {};
  const rand = rng(0xb0dc4e);
  const unsubscribe: Array<() => void> = [];
  // Next start times (context seconds) of the scheduled sounds.
  const next = { traffic: 0, bird: 0, bell: 0, note: 0, cheer: 0 };
  let noteIndex = 0;

  const kioskFootprint = game.content.layout.kiosk.footprint;
  const isInside = (): boolean => {
    const p = game.state.player.position;
    return p.x > kioskFootprint.minX && p.x < kioskFootprint.maxX && p.z > kioskFootprint.minZ && p.z < kioskFootprint.maxZ;
  };

  const eventAmbience = (): EventAmbience[] => {
    const env = game.weather.environment();
    const out: EventAmbience[] = [];
    for (const id of env.activeEvents) {
      const a = game.content.events?.find((e) => e.id === id)?.ambience;
      if (a) out.push(a);
    }
    return out;
  };

  /** A looping noise source through a filter into its own gain (starts silent). */
  const loopLayer = (c: Ctx, out: AudioNode, color: 'white' | 'pink' | 'brown', seed: number, filter: BiquadFilterType, freq: number, q: number, scale: number): Layer => {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 6, color, seed);
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    const gain = c.createGain();
    gain.gain.value = 0;
    src.connect(f).connect(gain).connect(out);
    src.start();
    return { gain, scale };
  };

  /**
   * Slow loudness wobble (wind gusts, babble): a gain of 1 +- depth after the layer gain, so a silent layer stays silent.
   */
  const wobble = (c: Ctx, layer: Layer, out: AudioNode, rate: number, depth: number): void => {
    const w = c.createGain();
    w.gain.value = 1;
    const lfo = c.createOscillator();
    lfo.frequency.value = rate;
    const amount = c.createGain();
    amount.gain.value = depth;
    lfo.connect(amount).connect(w.gain);
    layer.gain.disconnect();
    layer.gain.connect(w).connect(out);
    lfo.start();
  };

  const build = (c: Ctx): void => {
    master = c.createGain();
    master.gain.value = masterGain(level);
    master.connect(c.destination);
    const m = master;
    layers = {
      street: loopLayer(c, m, 'brown', 11, 'lowpass', 420, 0.5, 0.35),
      traffic: loopLayer(c, m, 'pink', 12, 'bandpass', 520, 0.7, 0),
      rain: loopLayer(c, m, 'white', 13, 'highpass', 1400, 0.4, 0.22),
      wind: loopLayer(c, m, 'pink', 14, 'lowpass', 380, 0.8, 0.45),
      crowd: loopLayer(c, m, 'pink', 15, 'bandpass', 650, 0.9, 0.5),
      market: loopLayer(c, m, 'pink', 16, 'bandpass', 1100, 1.4, 0.35),
      // Birds, bells and music are scheduled notes; their layer gain is only the bus.
      birds: { gain: c.createGain(), scale: 0.18 },
      bells: { gain: c.createGain(), scale: 0.2 },
      music: { gain: c.createGain(), scale: 0.22 },
    };
    for (const key of ['birds', 'bells', 'music'] as const) {
      const l = layers[key];
      if (!l) continue;
      l.gain.gain.value = 0;
      if (key === 'music') {
        // Muffled, as if from a backyard: low-pass before the bus.
        const lp = c.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 700;
        l.gain.connect(lp).connect(m);
      } else l.gain.connect(m);
    }
    const wind = layers.wind;
    if (wind) wobble(c, wind, m, 0.13, 0.5);
    const market = layers.market;
    if (market) wobble(c, market, m, 2.7, 0.35);
    const crowd = layers.crowd;
    if (crowd) wobble(c, crowd, m, 0.07, 0.3);
  };

  const tone = (c: Ctx, out: AudioNode, type: OscillatorType, f0: number, f1: number, at: number, dur: number, peak: number): void => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.02, dur / 4));
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(out);
    o.start(at);
    o.stop(at + dur + 0.05);
  };

  const noiseBurst = (c: Ctx, out: AudioNode, filter: BiquadFilterType, freq: number, at: number, dur: number, peak: number): void => {
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, Math.max(0.05, dur), 'white', 21 + Math.floor(freq));
    const f = c.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(peak, at);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    src.connect(f).connect(g).connect(out);
    src.start(at);
  };

  /** Scheduled sounds (traffic passes, birds, bells, music) for the next half second. */
  const schedule = (c: Ctx, now: number): void => {
    if (!mix) return;
    const horizon = now + 0.5;
    const traffic = layers.traffic;
    if (traffic && mix.traffic > 0 && next.traffic < horizon) {
      // A car passing by: the band of noise swells and fades over a few seconds.
      const at = Math.max(now, next.traffic);
      const dur = 2.5 + rand() * 2.5;
      const peak = 0.16 * mix.traffic * (0.6 + rand() * 0.4);
      traffic.gain.gain.cancelScheduledValues(at);
      traffic.gain.gain.setValueAtTime(0.0001, at);
      traffic.gain.gain.linearRampToValueAtTime(peak, at + dur * 0.5);
      traffic.gain.gain.linearRampToValueAtTime(0.0001, at + dur);
      next.traffic = at + dur + (2 + rand() * 10) / Math.max(0.2, mix.traffic);
    }
    const birds = layers.birds;
    if (birds && mix.birds > 0.02 && next.bird < horizon) {
      const at = Math.max(now, next.bird);
      const base = 2600 + rand() * 2200;
      const chirps = 2 + Math.floor(rand() * 4);
      for (let i = 0; i < chirps; i += 1) tone(c, birds.gain, 'sine', base, base * (1.15 + rand() * 0.3), at + i * 0.13, 0.08 + rand() * 0.05, 0.5);
      next.bird = at + 0.8 + rand() * 4 / Math.max(0.2, mix.birds);
    }
    const bells = layers.bells;
    if (bells && mix.bells > 0 && next.bell < horizon) {
      const at = Math.max(now, next.bell);
      const f = [523.25, 659.25, 783.99, 880][Math.floor(rand() * 4)] ?? 523.25;
      for (const [ratio, amp] of [[1, 0.5], [2.76, 0.2], [5.4, 0.08]] as const) tone(c, bells.gain, 'sine', f * ratio, f * ratio, at, 2.2, amp);
      next.bell = at + 3 + rand() * 6;
    }
    const music = layers.music;
    if (music && mix.music > 0 && next.note < horizon) {
      // A simple, invented pentatonic tune over a bass; deterministic, not a real song.
      const scale = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25];
      let at = Math.max(now, next.note);
      while (at < horizon) {
        const beat = 0.3;
        const f = scale[Math.floor(rand() * scale.length)] ?? 261.63;
        tone(c, music.gain, 'triangle', f, f, at, beat * 0.9, 0.35);
        if (noteIndex % 4 === 0) tone(c, music.gain, 'sine', (scale[noteIndex % 3] ?? 261.63) / 2, (scale[noteIndex % 3] ?? 261.63) / 2, at, beat * 3.6, 0.5);
        noteIndex += 1;
        at += beat;
      }
      next.note = at;
    }
    const crowd = layers.crowd;
    if (crowd && mix.crowd > 0 && next.cheer < horizon) {
      // Now and then the distant crowd rises (a chance, a goal somewhere far away).
      const at = Math.max(now, next.cheer);
      noiseBurst(c, master ?? c.destination, 'bandpass', 800, at, 2.5, 0.08 * mix.crowd);
      next.cheer = at + 12 + rand() * 30;
    }
  };

  const applyMix = (c: Ctx): void => {
    const now = c.currentTime;
    const day = game.state.calendar.day;
    const minute = game.state.calendar.minute;
    const env = game.weather.environment();
    mix = ambienceMix({ minute, daylight: sunOf(day, minute).daylight, weather: env.weather.condition, eventAmbience: eventAmbience(), inside: isInside() });
    for (const key of AMBIENCE_LAYERS) {
      if (key === 'traffic') continue; // driven by the passes
      const l = layers[key];
      if (l) l.gain.gain.setTargetAtTime(mix[key] * l.scale, now, 1.2);
    }
    schedule(c, now);
  };

  const play = (name: string, fn: (c: Ctx, out: AudioNode, at: number) => void): void => {
    played[name] = (played[name] ?? 0) + 1;
    if (!ctx || !master || level === 'off') return;
    fn(ctx, master, ctx.currentTime + 0.01);
  };

  unsubscribe.push(
    game.signals.on('kiosk.shutter.changed', ({ open }) =>
      play('shutter', (c, out, at) => {
        // Rolling a metal shutter: a rattling band of noise, rising when opened, falling when closed.
        const src = c.createBufferSource();
        src.buffer = noiseBuffer(c, 1, 'white', 31);
        const f = c.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.setValueAtTime(open ? 700 : 1300, at);
        f.frequency.linearRampToValueAtTime(open ? 1300 : 700, at + 0.9);
        const rattle = c.createGain();
        const lfo = c.createOscillator();
        lfo.frequency.value = 28;
        const depth = c.createGain();
        depth.gain.value = 0.12;
        lfo.connect(depth).connect(rattle.gain);
        rattle.gain.setValueAtTime(0.18, at);
        rattle.gain.linearRampToValueAtTime(0.0001, at + 0.95);
        src.connect(f).connect(rattle).connect(out);
        src.start(at);
        lfo.start(at);
        lfo.stop(at + 1);
      }),
    ),
    game.signals.on('kiosk.door.changed', ({ open }) =>
      play('door', (c, out, at) => {
        tone(c, out, 'sine', open ? 140 : 110, 70, at, 0.18, 0.4);
        noiseBurst(c, out, 'lowpass', 900, at, 0.12, 0.15);
      }),
    ),
    game.signals.on('sale.completed', () =>
      play('sale', (c, out, at) => {
        // Till: a drawer click and two bright bell tones.
        noiseBurst(c, out, 'highpass', 2500, at, 0.05, 0.25);
        tone(c, out, 'sine', 1318.5, 1318.5, at + 0.06, 0.35, 0.2);
        tone(c, out, 'sine', 1760, 1760, at + 0.16, 0.5, 0.18);
      }),
    ),
    game.signals.on('delivery.received', () =>
      play('delivery', (c, out, at) => {
        for (let i = 0; i < 3; i += 1) {
          tone(c, out, 'sine', 95, 55, at + i * 0.22, 0.2, 0.45);
          noiseBurst(c, out, 'lowpass', 600, at + i * 0.22, 0.15, 0.2);
        }
      }),
    ),
    game.signals.on('specialty.produced', () =>
      play('specialty', (c, out, at) => {
        noiseBurst(c, out, 'highpass', 3000, at, 1.2, 0.06); // a short sizzle
      }),
    ),
  );

  const ensure = (): void => {
    if (level === 'off') return;
    if (!ctx) {
      const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      build(ctx);
      const c = ctx;
      timer = setInterval(() => {
        if (c.state === 'running') applyMix(c);
      }, 250);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  };

  return {
    unlock: ensure,
    setLevel(next) {
      level = next;
      if (master && ctx) master.gain.setTargetAtTime(masterGain(level), ctx.currentTime, 0.1);
      if (level !== 'off') ensure();
    },
    info: () => ({ state: ctx ? ctx.state : 'none', level, mix: mix ? { ...mix } : null, played: { ...played } }),
    dispose() {
      for (const off of unsubscribe) off();
      if (timer) clearInterval(timer);
      void ctx?.close();
      ctx = null;
    },
  };
}
