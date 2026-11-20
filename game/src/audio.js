// Procedural WebAudio: an engine drone pitched by speed, a two-tone Bay Patrol siren, a gunshot,
// a pickup chime and a slow synth music bed. Every sound is generated, so there are no audio files
// and no network. The AudioContext is created on the first user gesture (browser autoplay policy).

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engine = null;
  let siren = null;
  let muted = false;
  let musicTimer = null;

  function ensure() {
    if (ctx) return true;
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    startMusic();
    return true;
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  // ---- engine: a sawtooth whose pitch and level follow the vehicle's speed ----
  function engineOn() {
    if (!ensure() || engine) return;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = 'sawtooth';
    sub.type = 'square';
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    gain.gain.value = 0;
    osc.connect(filter);
    sub.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start();
    sub.start();
    engine = { osc, sub, gain, filter };
  }

  function engineUpdate(speed, maxSpeed, active) {
    if (!engine) return;
    const t = ctx.currentTime;
    const frac = Math.min(1, Math.abs(speed) / maxSpeed);
    const target = active ? 0.06 + frac * 0.08 : 0;
    engine.gain.gain.setTargetAtTime(target, t, 0.08);
    engine.osc.frequency.setTargetAtTime(50 + frac * 150, t, 0.1);
    engine.sub.frequency.setTargetAtTime(25 + frac * 70, t, 0.1);
    engine.filter.frequency.setTargetAtTime(500 + frac * 1400, t, 0.1);
  }

  // ---- siren: two alternating tones while the Bay Patrol is on the player ----
  function sirenOn(on) {
    if (on) {
      if (!ensure()) return;
      if (siren) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(master);
      osc.start();
      let high = false;
      const timer = setInterval(() => {
        if (!ctx) return;
        high = !high;
        osc.frequency.setTargetAtTime(high ? 880 : 620, ctx.currentTime, 0.02);
      }, 320);
      siren = { osc, gain, timer };
    } else if (siren) {
      clearInterval(siren.timer);
      siren.osc.stop();
      siren.gain.disconnect();
      siren = null;
    }
  }

  function blip(freq, duration, type = 'square', level = 0.2, slideTo = null) {
    if (!ensure()) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = level;
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + duration);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  }

  function noiseBurst(duration, level) {
    if (!ensure()) return;
    const frames = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const gain = ctx.createGain();
    gain.gain.value = level;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1800;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start();
  }

  // ---- a slow four-chord pad, scheduled a bar at a time ----
  const CHORDS = [
    [110, 130.81, 164.81], // Am
    [98, 146.83, 174.61], // G
    [87.31, 130.81, 174.61], // F
    [82.41, 123.47, 164.81], // E
  ];
  let chordIndex = 0;

  function playChord() {
    if (!ctx || muted) return;
    const chord = CHORDS[chordIndex % CHORDS.length];
    chordIndex += 1;
    const now = ctx.currentTime;
    for (const freq of chord) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.detune.value = (Math.random() - 0.5) * 12;
      gain.gain.value = 0;
      gain.gain.setTargetAtTime(0.12, now, 0.6);
      gain.gain.setTargetAtTime(0, now + 2.2, 0.8);
      osc.connect(gain);
      gain.connect(musicGain);
      osc.start(now);
      osc.stop(now + 4.2);
    }
  }

  function startMusic() {
    if (musicTimer) return;
    playChord();
    musicTimer = setInterval(playChord, 3200);
  }

  return {
    /** Must be called from a user gesture; safe to call again. */
    unlock() {
      ensure();
      resume();
    },
    engineOn,
    engineUpdate,
    sirenOn,
    gunshot() {
      noiseBurst(0.22, 0.35);
      blip(180, 0.12, 'square', 0.12, 60);
    },
    pickup() {
      blip(660, 0.12, 'sine', 0.2);
      setTimeout(() => blip(990, 0.18, 'sine', 0.2), 90);
    },
    cash() {
      blip(523, 0.1, 'triangle', 0.2);
      setTimeout(() => blip(659, 0.1, 'triangle', 0.2), 80);
      setTimeout(() => blip(784, 0.2, 'triangle', 0.2), 160);
    },
    crash() {
      noiseBurst(0.3, 0.25);
    },
    complete() {
      [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => blip(f, 0.25, 'sine', 0.2), i * 130));
    },
    setMute(value) {
      muted = value;
      if (master) master.gain.value = muted ? 0 : 0.5;
    },
    get muted() {
      return muted;
    },
  };
}
