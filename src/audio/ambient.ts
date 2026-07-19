import * as Tone from 'tone';

/**
 * Ambient synth bed — moody generative synth-ambient (spec §6).
 * Three layers: rain (textured, not whitenoise), city life (hum + distant
 * events), music (pads + sparse lonely lead). Browsers gate AudioContext
 * behind a user gesture; armAmbientAudio() starts on first interaction.
 */

let started = false;
let master: Tone.Gain | null = null;
let muted = false;

const MASTER_LEVEL = 0.9;

export function armAmbientAudio(onStart: () => void): void {
  const begin = () => {
    if (started) return;
    started = true;
    void Tone.start().then(() => {
      master = buildBed();
      onStart();
    });
  };
  window.addEventListener('pointerdown', begin, { once: true });
  window.addEventListener('keydown', begin, { once: true });
}

/** Ramped gain-stage mute. Returns the new muted state. No-op before audio starts. */
export function toggleMute(): boolean {
  if (!master) return false;
  muted = !muted;
  master.gain.rampTo(muted ? 0 : MASTER_LEVEL, 0.1);
  return muted;
}

function buildBed(): Tone.Gain {
  const out = new Tone.Gain(MASTER_LEVEL).toDestination();
  buildRain(out);
  buildCityLife(out);
  buildMusic(out);
  Tone.Transport.start();
  return out;
}

/** Rain: bandpass hiss with gusts + brown-noise body + droplet plinks. */
function buildRain(out: Tone.Gain): void {
  const hiss = new Tone.Noise('pink').start();
  const hissFilter = new Tone.Filter(2100, 'bandpass');
  const hissGain = new Tone.Gain(0.05);
  hiss.connect(hissFilter);
  hissFilter.connect(hissGain);
  hissGain.connect(out);
  new Tone.LFO(0.11, 1600, 2700).start().connect(hissFilter.frequency); // texture drift
  new Tone.LFO(0.07, 0.028, 0.06).start().connect(hissGain.gain); // slow gusts

  const rumble = new Tone.Noise('brown').start();
  const rumbleFilter = new Tone.Filter(220, 'lowpass');
  const rumbleGain = new Tone.Gain(0.05);
  rumble.connect(rumbleFilter);
  rumbleFilter.connect(rumbleGain);
  rumbleGain.connect(out);

  // droplet plips — membrane-synth "ploop" with fast pitch decay, not sine beeps
  const drip = new Tone.MembraneSynth({
    pitchDecay: 0.008,
    octaves: 2.5,
    envelope: { attack: 0.001, decay: 0.09, sustain: 0 },
  });
  const dripGain = new Tone.Gain(0.03);
  drip.connect(dripGain);
  dripGain.connect(out);
  new Tone.Loop((time) => {
    if (Math.random() < 0.3) {
      const drops = Math.random() < 0.25 ? 2 : 1;
      for (let i = 0; i < drops; i++) {
        drip.triggerAttackRelease(
          500 + Math.random() * 700,
          0.06,
          time + i * (0.05 + Math.random() * 0.09),
        );
      }
    }
  }, 0.25).start(0.1);
}

/** City life: grid hum, vehicle whooshes, signal blips, thuds, rare siren. */
function buildCityLife(out: Tone.Gain): void {
  const humGain = new Tone.Gain(0.045);
  humGain.connect(out);
  new Tone.Oscillator(50, 'sine').start().connect(humGain);
  new Tone.Oscillator(50.6, 'sine').start().connect(humGain); // beat frequency hum

  const whooshFilter = new Tone.Filter(800, 'bandpass');
  const whooshGain = new Tone.Gain(0);
  const whooshNoise = new Tone.Noise('pink').start();
  whooshNoise.connect(whooshFilter);
  whooshFilter.connect(whooshGain);
  whooshGain.connect(out);

  const blip = new Tone.Synth({
    oscillator: { type: 'square' },
    envelope: { attack: 0.002, decay: 0.08, sustain: 0, release: 0.05 },
  });
  const blipGain = new Tone.Gain(0.025);
  blip.connect(blipGain);
  blipGain.connect(out);

  const thud = new Tone.MembraneSynth({
    pitchDecay: 0.02,
    octaves: 4,
    envelope: { attack: 0.001, decay: 0.5, sustain: 0 },
  });
  const thudGain = new Tone.Gain(0.12);
  thud.connect(thudGain);
  thudGain.connect(out);

  const siren = new Tone.Oscillator(660, 'sine').start();
  const sirenGain = new Tone.Gain(0);
  siren.connect(sirenGain);
  sirenGain.connect(out);

  new Tone.Loop((time) => {
    const roll = Math.random();
    if (roll < 0.3) {
      // distant vehicle pass
      const peak = 500 + Math.random() * 1400;
      whooshFilter.frequency.setValueAtTime(peak * 0.5, time);
      whooshFilter.frequency.linearRampTo(peak, 1.2, time);
      whooshFilter.frequency.linearRampTo(peak * 0.45, 2.6, time + 1.2);
      whooshGain.gain.setValueAtTime(0, time);
      whooshGain.gain.linearRampTo(0.05 + Math.random() * 0.03, 1.4, time);
      whooshGain.gain.linearRampTo(0, 1.4, time + 1.4);
    } else if (roll < 0.5) {
      // electronic signal blip, sometimes two-tone
      const f = 900 + Math.random() * 1500;
      blip.triggerAttackRelease(f, 0.07, time);
      if (Math.random() < 0.4) blip.triggerAttackRelease(f * 0.75, 0.07, time + 0.18);
    } else if (roll < 0.6) {
      // dull construction thud
      thud.triggerAttackRelease(45 + Math.random() * 15, 0.4, time);
    } else if (roll < 0.64) {
      // rare distant siren — slow mournful glide
      sirenGain.gain.setValueAtTime(0, time);
      sirenGain.gain.linearRampTo(0.018, 2, time);
      siren.frequency.setValueAtTime(620, time);
      siren.frequency.linearRampTo(880, 3, time);
      siren.frequency.linearRampTo(600, 3, time + 3);
      sirenGain.gain.linearRampTo(0, 2, time + 4.5);
    }
  }, 4).start(2);
}

/** Music: synthwave-ambient — bright thin pads, arpeggio, bass pulse, sparse lead. */
function buildMusic(out: Tone.Gain): void {
  const reverb = new Tone.Reverb({ decay: 6, wet: 0.4 });
  reverb.connect(out);

  // pad — thinner voicings, brighter swept filter (organ territory avoided)
  const pad = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: 'fatsawtooth', count: 2, spread: 14 },
    envelope: { attack: 1.6, decay: 2, sustain: 0.5, release: 4 },
  });
  const padFilter = new Tone.Filter(1400, 'lowpass');
  const chorus = new Tone.Chorus(0.7, 3.8, 0.4).start();
  pad.connect(padFilter);
  padFilter.connect(chorus);
  chorus.connect(reverb);
  pad.volume.value = -20;
  new Tone.LFO(0.05, 900, 1900).start().connect(padFilter.frequency);

  const chords: string[][] = [
    ['D3', 'F3', 'A3', 'E4'], // Dm9
    ['A#2', 'D3', 'F3', 'D4'], // Bbmaj7
    ['F3', 'A3', 'C4', 'G4'], // Fmaj9
    ['C3', 'E3', 'G3', 'D4'], // Cmaj9
  ];
  const roots = ['D2', 'A#1', 'F2', 'C2'];
  let step = 0;
  new Tone.Loop((time) => {
    pad.triggerAttackRelease(chords[step % chords.length], '6m', time);
    step++;
  }, '8m').start(0);

  // arpeggio — the synthwave signature, 8ths through ping-pong delay
  const arp = new Tone.Synth({
    oscillator: { type: 'sawtooth' },
    envelope: { attack: 0.004, decay: 0.16, sustain: 0, release: 0.12 },
  });
  const arpFilter = new Tone.Filter(2500, 'lowpass');
  const arpDelay = new Tone.PingPongDelay('8n.', 0.35);
  arpDelay.wet.value = 0.35;
  const arpGain = new Tone.Gain(0.055);
  arp.connect(arpFilter);
  arpFilter.connect(arpDelay);
  arpDelay.connect(arpGain);
  arpGain.connect(reverb);
  let arpNote = 0;
  new Tone.Loop((time) => {
    const tones = chords[step % chords.length];
    arp.triggerAttackRelease(tones[arpNote % tones.length], '16n', time);
    arpNote++;
  }, '8n').start(0);

  // bass pulse — quiet drive under the drone
  const bass = new Tone.MembraneSynth({
    pitchDecay: 0.01,
    octaves: 3,
    envelope: { attack: 0.002, decay: 0.3, sustain: 0 },
  });
  const bassGain = new Tone.Gain(0.14);
  bass.connect(bassGain);
  bassGain.connect(out);
  new Tone.Loop((time) => {
    bass.triggerAttackRelease(roots[step % roots.length], '8n', time);
  }, '4n').start(0);

  // sparse lead — minor pentatonic fragments with long silences
  const lead = new Tone.Synth({
    oscillator: { type: 'triangle' },
    envelope: { attack: 0.02, decay: 0.4, sustain: 0.3, release: 1.6 },
  });
  const leadVibrato = new Tone.Vibrato(4.5, 0.15);
  const leadGain = new Tone.Gain(0.09);
  lead.connect(leadVibrato);
  leadVibrato.connect(leadGain);
  leadGain.connect(reverb);

  const pool = ['A3', 'C4', 'D4', 'E4', 'G4', 'A4', 'C5'];
  new Tone.Loop((time) => {
    if (Math.random() < 0.55) {
      const notes = 1 + Math.floor(Math.random() * 3);
      let t = time;
      for (let i = 0; i < notes; i++) {
        const note = pool[Math.floor(Math.random() * pool.length)];
        const dur = 0.4 + Math.random() * 0.9;
        lead.triggerAttackRelease(note, dur, t);
        t += dur * (0.7 + Math.random() * 0.5);
      }
    }
  }, 7).start(4);
}
