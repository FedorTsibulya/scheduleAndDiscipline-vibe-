// Звуки генерируются на лету через Web Audio — без файлов
let ctx: AudioContext | null = null;

// Вызывать по клику пользователя (старт таймера): браузеры не дают играть звук без жеста
export function unlockAudio() {
  try {
    ctx ??= new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
  } catch {
    /* звук недоступен */
  }
}

function tone(freq: number, startAt: number, dur: number, vol: number) {
  if (!ctx) return;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, startAt);
  g.gain.linearRampToValueAtTime(vol, startAt + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, startAt + dur);
  o.connect(g).connect(ctx.destination);
  o.start(startAt);
  o.stop(startAt + dur + 0.05);
}

export function playChime() {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.05;
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, t + i * 0.16, 0.9, 0.22));
}

export function playSoft() {
  unlockAudio();
  if (!ctx) return;
  tone(660, ctx.currentTime + 0.05, 0.6, 0.08);
}

export function playPop() {
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime + 0.02;
  tone(880, t, 0.18, 0.12);
  tone(1320, t + 0.07, 0.22, 0.1);
}
