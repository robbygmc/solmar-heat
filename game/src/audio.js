// SOLMAR HEAT — sound, synthesized with WebAudio. No audio files.
// One clear job: engine hum, sirens, shots, crashes, chimes. Everything is an
// oscillator or filtered noise, built lazily on the first user gesture.
import { CONFIG } from './config.js';

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      // Engine: a sawtooth whose pitch follows speed.
      engineOsc = ctx.createOscillator();
      engineOsc.type = 'sawtooth';
      engineOsc.frequency.value = 50;
      engineGain = ctx.createGain();
      engineGain.gain.value = 0;
      const engineFilter = ctx.createBiquadFilter();
      engineFilter.type = 'lowpass';
      engineFilter.frequency.value = 500;
      engineOsc.connect(engineFilter);
      engineFilter.connect(engineGain);
      engineGain.connect(master);
      engineOsc.start();
      // Siren: a triangle that alternates two tones.
      sirenOsc = ctx.createOscillator();
      sirenOsc.type = 'triangle';
      sirenOsc.frequency.value = 700;
      sirenGain = ctx.createGain();
      sirenGain.gain.value = 0;
      sirenOsc.connect(sirenGain);
      sirenGain.connect(master);
      sirenOsc.start();
      // Waves on the beach: looped filtered noise, very quiet.
      const noise = noiseBuffer(2);
      const waves = ctx.createBufferSource();
      waves.buffer = noise;
      waves.loop = true;
      const waveFilter = ctx.createBiquadFilter();
      waveFilter.type = 'lowpass';
      waveFilter.frequency.value = 320;
      const waveGain = ctx.createGain();
      waveGain.gain.value = 0.05;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.12;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.03;
      lfo.connect(lfoGain);
      lfoGain.connect(waveGain.gain);
      waves.connect(waveFilter);
      waveFilter.connect(waveGain);
      waveGain.connect(master);
      waves.start();
      lfo.start();
      // Music bus: everything musical goes through this gain, so muting and
      // ducking never touch the engine, sirens or effects.
      musicGain = ctx.createGain();
      musicGain.gain.value = musicMuted ? 0 : CONFIG.musicLevel;
      musicGain.connect(master);
      musicFilter = ctx.createBiquadFilter();
      musicFilter.type = 'lowpass';
      musicFilter.frequency.value = 2400;
      musicFilter.connect(musicGain);
    } catch {
      ctx = null;
      return false;
    }
    return true;
  }

  // ---- Music: an original synth loop, "Sunset over Solmar" ----
  // 8 bars at 96 BPM, Am - F - C - G - Am - F - Dm - E. A warm pad, a bass
  // on beats 1 and 3, and a pentatonic lead with a quiet echo. All notes are
  // scheduled ahead with a lookahead timer; no audio files, nothing copied.
  const MUSIC_BPM = 96;
  // Levels live in CONFIG with the rest of the game's tuning.
  const EIGHTH = 60 / MUSIC_BPM / 2; // 0.3125s
  const CHORDS = [
    [110.0, 130.81, 164.81], // Am
    [87.31, 110.0, 130.81], // F
    [130.81, 164.81, 196.0], // C
    [98.0, 123.47, 146.83], // G
    [110.0, 130.81, 164.81], // Am
    [87.31, 110.0, 130.81], // F
    [146.83, 174.61, 220.0], // Dm
    [82.41, 103.83, 123.47], // E
  ];
  // One lead note per eighth-note slot (64 slots); 0 = rest.
  const LEAD = [
    440, 0, 523.25, 0, 659.25, 0, 523.25, 440,
    440, 0, 523.25, 0, 698.46, 0, 523.25, 440,
    392, 0, 659.25, 0, 783.99, 0, 659.25, 523.25,
    587.33, 0, 659.25, 0, 783.99, 0, 587.33, 493.88,
    440, 523.25, 659.25, 880, 783.99, 659.25, 523.25, 0,
    440, 0, 523.25, 0, 440, 0, 349.23, 0,
    587.33, 0, 698.46, 0, 880, 0, 698.46, 587.33,
    659.25, 0, 830.61, 0, 987.77, 0, 830.61, 659.25,
  ];
  let musicGain = null;
  let musicFilter = null;
  let musicTimer = null;
  let musicStep = 0;
  let musicNextTime = 0;
  let musicMuted = false;

  function schedulePad(freq, t, dur) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.35);
    g.gain.setValueAtTime(0.05, t + dur - 0.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(musicFilter);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function scheduleBass(freq, t, dur) {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.16, t + 0.05);
    g.gain.setValueAtTime(0.16, t + dur - 0.15);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(musicGain);
    osc.start(t);
    osc.stop(t + dur + 0.05);
  }

  function scheduleLead(freq, t) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.085, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(g);
    g.connect(musicFilter);
    osc.start(t);
    osc.stop(t + 0.35);
    // One quiet echo an eighth later.
    const echo = ctx.createOscillator();
    echo.type = 'triangle';
    echo.frequency.value = freq;
    const eg = ctx.createGain();
    const et = t + EIGHTH;
    eg.gain.setValueAtTime(0.0001, et);
    eg.gain.linearRampToValueAtTime(0.028, et + 0.01);
    eg.gain.exponentialRampToValueAtTime(0.001, et + 0.3);
    echo.connect(eg);
    eg.connect(musicFilter);
    echo.start(et);
    echo.stop(et + 0.35);
  }

  function scheduleStep(step, t) {
    const bar = Math.floor(step / 8) % 8;
    const slot = step % 8;
    const chord = CHORDS[bar];
    if (slot === 0) {
      const barDur = EIGHTH * 8;
      for (const f of chord) schedulePad(f, t, barDur);
      scheduleBass(chord[0] / 2, t, EIGHTH * 4);
    }
    if (slot === 4) scheduleBass(chord[0] / 2, t, EIGHTH * 4);
    const lead = LEAD[step % 64];
    if (lead) scheduleLead(lead, t);
  }

  function musicTick() {
    if (!ctx) return;
    while (musicNextTime < ctx.currentTime + 0.5) {
      scheduleStep(musicStep, musicNextTime);
      musicNextTime += EIGHTH;
      musicStep = (musicStep + 1) % 64;
    }
  }

  function startMusic() {
    if (!ctx || musicTimer) return;
    musicStep = 0;
    musicNextTime = ctx.currentTime + 0.1;
    musicTimer = setInterval(musicTick, 100);
    musicTick();
  }

  function stopMusic() {
    if (musicTimer) {
      clearInterval(musicTimer);
      musicTimer = null;
    }
  }

  function noiseBuffer(seconds) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  function blip(freq, dur, type = 'sine', vol = 0.3, when = 0) {
    if (!ctx) return;
    const t = ctx.currentTime + when;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseBurst(dur, filterFreq, vol = 0.5) {
    if (!ctx) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(dur);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start();
  }

  return {
    ensure,
    startMusic,
    stopMusic,
    // M toggles the music; returns true when music is now on.
    toggleMusic() {
      if (!ctx) return false;
      musicMuted = !musicMuted;
      if (musicGain) musicGain.gain.setTargetAtTime(musicMuted ? 0 : CONFIG.musicLevel, ctx.currentTime, 0.1);
      return !musicMuted;
    },
    musicOn() {
      return !!musicTimer && !musicMuted;
    },
    musicState() {
      return {
        playing: !!musicTimer,
        muted: musicMuted,
        ctxState: ctx ? ctx.state : 'none',
      };
    },
    // Quieter while paused, full level while playing.
    duckMusic(ducked) {
      if (!ctx || !musicGain) return;
      musicGain.gain.setTargetAtTime(musicMuted ? 0 : ducked ? CONFIG.musicDuckLevel : CONFIG.musicLevel, ctx.currentTime, 0.2);
    },
    engine(speed01, on) {
      if (!ctx) return;
      engineGain.gain.setTargetAtTime(on ? 0.05 + speed01 * 0.06 : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(48 + speed01 * 130, ctx.currentTime, 0.08);
    },
    siren() {
      if (!ctx) return;
      sirenGain.gain.setTargetAtTime(0.05, ctx.currentTime, 0.2);
      sirenTimer = 6;
    },
    update(dt, wanted) {
      if (!ctx) return;
      if (sirenTimer > 0) {
        sirenTimer -= dt;
        sirenOsc.frequency.value = Math.sin(ctx.currentTime * 4.4) > 0 ? 720 : 540;
        if (sirenTimer <= 0 || wanted === 0) sirenGain.gain.setTargetAtTime(0, ctx.currentTime, 0.3);
      }
    },
    shot() {
      noiseBurst(0.12, 2400, 0.5);
    },
    crash() {
      noiseBurst(0.25, 500, 0.5);
    },
    punch() {
      noiseBurst(0.08, 900, 0.3);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.25);
      blip(880, 0.18, 'sine', 0.25, 0.09);
    },
    objective() {
      blip(520, 0.1, 'triangle', 0.25);
      blip(780, 0.16, 'triangle', 0.25, 0.08);
    },
    complete() {
      [523, 659, 784, 1047].forEach((f, i) => blip(f, 0.22, 'triangle', 0.25, i * 0.11));
    },
    mission() {
      blip(330, 0.3, 'triangle', 0.25);
      blip(392, 0.3, 'triangle', 0.25, 0.15);
    },
    busted() {
      [392, 311, 233].forEach((f, i) => blip(f, 0.3, 'sawtooth', 0.2, i * 0.16));
    },
  };
}
