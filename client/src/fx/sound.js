// 게임 효과음 — Web Audio API 로 합성한다 (파일 없음, 네트워크 요청 없음).
// 나중에 효과음 파일로 바꿀 때는 SOUNDS 의 각 함수만 교체하면 된다 (호출하는 쪽은 playSound(이름) 그대로).
//
// 모바일 브라우저는 사용자 조작(터치/클릭) 안에서만 오디오를 시작할 수 있으므로
// main.jsx 에서 첫 조작 때 unlockAudio() 를 부른다.

const STORAGE_KEY = 'td-sound';

let ctx = null;
let master = null;
let noiseBuffer = null;
let enabled = readEnabled();
const listeners = new Set();

function readEnabled() {
  try { return localStorage.getItem(STORAGE_KEY) !== 'off'; } catch (_) { return true; }
}

export function isSoundOn() {
  return enabled;
}

export function setSoundOn(on) {
  enabled = !!on;
  try { localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off'); } catch (_) { /* 저장 불가 시 무시 */ }
  listeners.forEach(fn => fn(enabled));
}

export function subscribeSound(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function getContext() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.6;
  master.connect(ctx.destination);
  return ctx;
}

/** 첫 사용자 조작 때 호출: 오디오를 사용 가능한 상태로 만든다 */
export function unlockAudio() {
  const c = getContext();
  if (c && c.state !== 'running') c.resume().catch(() => {});
}

function getNoise() {
  if (noiseBuffer) return noiseBuffer;
  const length = Math.floor(ctx.sampleRate * 0.25);
  noiseBuffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = noiseBuffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return noiseBuffer;
}

// 짧게 올라갔다가 지수적으로 사라지는 음량 곡선
function envelope(gainNode, t, attack, peak, decay) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(freq, t, { type = 'sine', attack = 0.005, peak = 0.3, decay = 0.2, to = null } = {}) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  envelope(gain, t, attack, peak, decay);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

const SOUNDS = {
  // 카드를 바닥에 "탁" 내려놓는 소리: 짧은 잡음(종이) + 낮은 울림(바닥)
  cardPlace({ pitch = 1 } = {}) {
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = getNoise();
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1700 * pitch;
    band.Q.value = 0.9;
    const gain = ctx.createGain();
    envelope(gain, t, 0.002, 0.5, 0.07);
    src.connect(band);
    band.connect(gain);
    gain.connect(master);
    src.start(t);
    src.stop(t + 0.12);
    tone(150 * pitch, t, { peak: 0.22, decay: 0.06, to: 80 });
  },

  // 내 차례: 부드러운 두 음 "띵-딩"
  myTurn() {
    const t = ctx.currentTime;
    tone(660, t, { attack: 0.01, peak: 0.16, decay: 0.18 });
    tone(990, t + 0.11, { attack: 0.01, peak: 0.14, decay: 0.3 });
  },

  // 벨을 누르는 순간: 금속 종 (비정수배 배음)
  bellPress() {
    const t = ctx.currentTime;
    tone(1320, t, { attack: 0.002, peak: 0.22, decay: 0.9 });
    tone(1320 * 2.76, t, { attack: 0.002, peak: 0.07, decay: 0.45 });
    tone(1320 * 5.4, t, { attack: 0.002, peak: 0.035, decay: 0.25 });
  },

  // 벨 성공: 올라가는 밝은 아르페지오 + 여운
  bellSuccess() {
    const t = ctx.currentTime;
    [784, 988, 1175, 1568].forEach((f, i) => tone(f, t + i * 0.07, { type: 'triangle', peak: 0.18, decay: 0.25 }));
    tone(1568, t + 0.28, { peak: 0.12, decay: 0.6 });
  },

  // 벨 실패: 낮게 떨어지는 버저
  bellFail() {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.35);
    const low = ctx.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 700;
    const gain = ctx.createGain();
    envelope(gain, t, 0.01, 0.22, 0.35);
    osc.connect(low);
    low.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + 0.42);
  },
};

export function playSound(name, options) {
  if (!enabled) return;
  const c = getContext();
  if (!c || !SOUNDS[name]) return;
  if (c.state !== 'running') c.resume().catch(() => {});
  try {
    SOUNDS[name](options);
  } catch (_) {
    /* 오디오 실패는 게임 진행에 영향 없게 무시 */
  }
}

/** 진동 (소리를 끄면 진동도 끈다) */
export function vibrate(pattern) {
  if (!enabled) return;
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) { /* 지원하지 않는 기기 */ }
}
