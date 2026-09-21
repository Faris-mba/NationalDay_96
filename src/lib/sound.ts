"use client";

/**
 * أصوات بسيطة بـ Web Audio — بلا ملفات صوتية ولا تحميل.
 * يجب أن يبدأ السياق بعد أول تفاعل من المستخدم (سياسة المتصفحات).
 */

type Cue = "tick" | "tickUrgent" | "correct" | "wrong" | "buzz" | "start" | "win" | "reveal";

let ctx: AudioContext | null = null;
let muted = false;

export function isMuted() {
  return muted;
}

export function setMuted(value: boolean) {
  muted = value;
  if (typeof window !== "undefined") {
    window.localStorage.setItem("tahadi:muted", value ? "1" : "0");
  }
}

export function loadMutePreference(): boolean {
  if (typeof window === "undefined") return false;
  muted = window.localStorage.getItem("tahadi:muted") === "1";
  return muted;
}

export function unlockAudio() {
  if (typeof window === "undefined") return;
  if (!ctx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") void ctx.resume();
}

function blip(
  freq: number,
  startAt: number,
  duration: number,
  gain = 0.12,
  type: OscillatorType = "sine",
  sweepTo?: number
) {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const vol = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startAt);
  if (sweepTo) osc.frequency.exponentialRampToValueAtTime(sweepTo, startAt + duration);

  vol.gain.setValueAtTime(0.0001, startAt);
  vol.gain.exponentialRampToValueAtTime(gain, startAt + 0.012);
  vol.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);

  osc.connect(vol).connect(ctx.destination);
  osc.start(startAt);
  osc.stop(startAt + duration + 0.02);
}

function noise(startAt: number, duration: number, gain = 0.08) {
  if (!ctx) return;
  const frames = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  }
  const src = ctx.createBufferSource();
  const vol = ctx.createGain();
  vol.gain.setValueAtTime(gain, startAt);
  src.buffer = buffer;
  src.connect(vol).connect(ctx.destination);
  src.start(startAt);
}

export function play(cue: Cue) {
  if (muted) return;
  unlockAudio();
  if (!ctx) return;
  const t = ctx.currentTime;

  switch (cue) {
    case "tick":
      blip(880, t, 0.06, 0.05, "square");
      break;
    case "tickUrgent":
      blip(1320, t, 0.08, 0.11, "square");
      break;
    case "correct":
      blip(660, t, 0.12, 0.13);
      blip(880, t + 0.1, 0.14, 0.13);
      blip(1320, t + 0.22, 0.26, 0.13);
      break;
    case "wrong":
      blip(220, t, 0.22, 0.13, "sawtooth", 110);
      break;
    case "buzz":
      blip(150, t, 0.3, 0.16, "square", 90);
      noise(t, 0.16, 0.05);
      break;
    case "start":
      blip(523, t, 0.1, 0.1);
      blip(659, t + 0.09, 0.1, 0.1);
      blip(784, t + 0.18, 0.18, 0.1);
      break;
    case "reveal":
      blip(392, t, 0.1, 0.09, "triangle");
      blip(587, t + 0.08, 0.16, 0.09, "triangle");
      break;
    case "win": {
      const notes = [523, 659, 784, 1046, 784, 1046, 1318];
      notes.forEach((n, i) => blip(n, t + i * 0.13, 0.22, 0.12, "triangle"));
      noise(t + 0.1, 0.5, 0.04);
      break;
    }
  }
}
