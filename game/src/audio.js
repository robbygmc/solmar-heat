// SOLMAR HEAT — sound, synthesized with WebAudio. No audio files.
// One clear job: engine hum, sirens, shots, crashes, chimes. Everything is an
// oscillator or filtered noise, built lazily on the first user gesture.
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
    } catch {
      ctx = null;
      return false;
    }
    return true;
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
