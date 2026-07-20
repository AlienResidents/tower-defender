import * as Tone from 'tone';
import { audioMaster } from './ambient';
import { presetFor, type SfxPreset, type WeaponSoundKind } from '../data/sfx';

/**
 * Generic weapon-SFX engine: interprets a preset (osc sweep + noise mix +
 * envelope + repeat hits). Short-lived nodes per hit, disposed after.
 * Routes through the ambient master when present (so [m] mute covers SFX),
 * otherwise its own bus (the /lab page runs without the ambient bed).
 */

let fallbackBus: Tone.Gain | null = null;

function bus(): Tone.ToneAudioNode {
  const master = audioMaster();
  if (master) return master;
  if (!fallbackBus) {
    const limiter = new Tone.Limiter(-2).toDestination();
    fallbackBus = new Tone.Gain(0.9).connect(limiter);
  }
  return fallbackBus;
}

// voice caps — at 4x speed unbounded SFX voices clip the whole stream
const VOICE_CAPS: Record<WeaponSoundKind, number> = {
  rail: 6,
  beam: 6,
  missile: 6,
  chain: 6,
  burst: 3,
  splash: 4,
};
const voices = new Map<WeaponSoundKind, number>();

function voiceAvailable(kind: WeaponSoundKind): boolean {
  return (voices.get(kind) ?? 0) < VOICE_CAPS[kind];
}

function voiceHeld(kind: WeaponSoundKind, seconds: number): void {
  voices.set(kind, (voices.get(kind) ?? 0) + 1);
  setTimeout(
    () => voices.set(kind, Math.max(0, (voices.get(kind) ?? 1) - 1)),
    Math.max(50, seconds * 1000),
  );
}

function playHit(p: SfxPreset, time: number): void {
  const out = bus();
  const env = new Tone.AmplitudeEnvelope({
    attack: p.attack,
    decay: p.duration * 0.7,
    sustain: 0,
    release: p.duration * 0.3,
  }).connect(out);

  const osc = new Tone.Oscillator(p.freqStart, p.osc);
  const oscGain = new Tone.Gain((1 - p.noise) * p.gain);
  osc.connect(oscGain);
  oscGain.connect(env);
  osc.frequency.setValueAtTime(p.freqStart, time);
  osc.frequency.exponentialRampTo(Math.max(p.freqEnd, 1), p.sweepTime, time);
  if (p.tailEnd) {
    // doppler flyby — pitch falls away after the sweep completes
    osc.frequency.exponentialRampTo(
      Math.max(p.tailEnd, 1),
      Math.max(p.duration - p.sweepTime, 0.05),
      time + p.sweepTime,
    );
  }
  osc.start(time).stop(time + p.duration + 0.05);

  let noise: Tone.Noise | null = null;
  let noiseFilter: Tone.Filter | null = null;
  let noiseGain: Tone.Gain | null = null;
  if (p.noise > 0.01) {
    noise = new Tone.Noise('white');
    noiseFilter = new Tone.Filter(p.noiseFreq, 'bandpass');
    noiseGain = new Tone.Gain(p.noise * p.gain * 0.8);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(env);
    noise.start(time).stop(time + p.duration + 0.05);
  }

  env.triggerAttackRelease(p.duration, time);

  // low resonant body under the transient — gives the sound somewhere to go
  let bodyOsc: Tone.Oscillator | null = null;
  let bodyGain: Tone.Gain | null = null;
  let bodyEnv: Tone.AmplitudeEnvelope | null = null;
  if (p.body && p.body.gain > 0.001) {
    bodyEnv = new Tone.AmplitudeEnvelope({
      attack: 0.005,
      decay: p.body.decay,
      sustain: 0,
      release: p.body.decay * 0.3,
    }).connect(out);
    bodyOsc = new Tone.Oscillator(p.body.freq, p.body.osc);
    bodyGain = new Tone.Gain(p.body.gain);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(bodyEnv);
    bodyOsc.start(time).stop(time + p.body.decay + 0.1);
    bodyEnv.triggerAttackRelease(p.body.decay, time);
  }

  const disposeAfter = Math.max(
    0,
    time - Tone.getContext().immediate() + Math.max(p.duration, p.body?.decay ?? 0) + 0.4,
  );
  setTimeout(() => {
    osc.dispose();
    oscGain.dispose();
    env.dispose();
    noise?.dispose();
    noiseFilter?.dispose();
    noiseGain?.dispose();
    bodyOsc?.dispose();
    bodyGain?.dispose();
    bodyEnv?.dispose();
  }, disposeAfter * 1000);
}

export function playPreset(p: SfxPreset, timeScale = 1): void {
  // schedule at immediate() — Tone.now() includes a 100ms look-ahead that
  // makes sounds trail the visual shot
  let t0 = Tone.getContext().immediate();
  if (p.charge && p.charge.gain > 0.001 && p.charge.duration > 0.01) {
    playCharge(p.charge, t0, timeScale);
    t0 += p.charge.duration / timeScale; // compress charge at high game speed
  }
  const hitGap = p.hitGap / timeScale;
  for (let i = 0; i < p.hits; i++) {
    const at = t0 + i * hitGap;
    playHit(p, at);
    if (p.secondHit) playSecond(p, at + p.secondHit.at / timeScale);
  }
}

/** Rising capacitor whine before the main hit. */
function playCharge(
  c: { osc: SfxPreset['osc']; freqStart: number; freqEnd: number; duration: number; gain: number },
  time: number,
  timeScale = 1,
): void {
  const dur = c.duration / timeScale;
  const out = bus();
  const env = new Tone.AmplitudeEnvelope({
    attack: dur * 0.2,
    decay: dur * 0.7,
    sustain: 0,
    release: 0.03,
  }).connect(out);
  const osc = new Tone.Oscillator(c.freqStart, c.osc);
  const g = new Tone.Gain(c.gain);
  osc.connect(g);
  g.connect(env);
  osc.frequency.setValueAtTime(c.freqStart, time);
  osc.frequency.exponentialRampTo(Math.max(c.freqEnd, 1), dur * 0.9, time);
  osc.start(time).stop(time + dur + 0.05);
  env.triggerAttackRelease(dur, time);
  const disposeAfter = Math.max(0, time - Tone.getContext().immediate() + dur + 0.3) * 1000;
  setTimeout(() => {
    osc.dispose();
    g.dispose();
    env.dispose();
  }, disposeAfter);
}

/** The distinct second transient — the "chunk" after the "ku". */
function playSecond(p: SfxPreset, time: number): void {
  const s = p.secondHit;
  if (!s) return;
  playHit(
    {
      ...p,
      osc: s.osc,
      freqStart: s.freqStart,
      freqEnd: s.freqEnd,
      duration: s.duration,
      gain: s.gain,
      noise: s.noise,
      noiseFreq: s.noiseFreq,
      attack: 0.002,
      charge: undefined,
      secondHit: undefined,
      hits: 1,
      hitGap: 0,
    },
    time,
  );
}

/** Play the currently-selected preset for a weapon kind (lab-tuned). */
export function playWeaponSound(kind: WeaponSoundKind, timeScale = 1): void {
  if (!voiceAvailable(kind)) return; // 4x-speed flood guard
  const preset = presetFor(kind);
  if (!preset) return;
  const span = preset.hits * preset.hitGap + preset.duration + (preset.body?.decay ?? 0);
  voiceHeld(kind, span);
  playPreset(preset, timeScale);
}
