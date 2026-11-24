/** A soft, synthesized paper crease: a short filtered noise swish + a tiny tap. */
let ctx: AudioContext | null = null;

export function crease() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const now = ctx.currentTime;

    const len = Math.floor(ctx.sampleRate * 0.22);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      const env = Math.pow(1 - i / len, 2.2);
      data[i] = (Math.random() * 2 - 1) * env * (Math.random() < 0.08 ? 1.6 : 1);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2600, now);
    bp.frequency.exponentialRampToValueAtTime(900, now + 0.2);
    bp.Q.value = 0.9;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.22, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    src.connect(bp).connect(g).connect(ctx.destination);
    src.start(now);

    const tap = ctx.createOscillator();
    tap.type = 'triangle';
    tap.frequency.setValueAtTime(180, now + 0.16);
    tap.frequency.exponentialRampToValueAtTime(70, now + 0.24);
    const tg = ctx.createGain();
    tg.gain.setValueAtTime(0.0001, now + 0.16);
    tg.gain.exponentialRampToValueAtTime(0.12, now + 0.17);
    tg.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    tap.connect(tg).connect(ctx.destination);
    tap.start(now + 0.16);
    tap.stop(now + 0.3);
  } catch {
    /* audio unavailable */
  }
}
