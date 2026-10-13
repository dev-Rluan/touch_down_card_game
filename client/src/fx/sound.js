// 게임 효과음 — Web Audio API 로 합성한다 (파일 없음, 네트워크 요청 없음).
//
// 스타일별 효과음 세트(SOUND_SETS)는 (오디오 컨텍스트, 출력 노드, 옵션)을 받는 순수 함수라서
// 실제 재생과 테스트용 오프라인 렌더링(OfflineAudioContext)이 같은 코드를 쓴다.
// 나중에 효과음 파일로 바꿀 때는 해당 함수만 교체하면 된다 (호출하는 쪽은 playSound(이름) 그대로).
//
// 모바일 브라우저는 사용자 조작(터치/클릭) 안에서만 오디오를 시작할 수 있으므로
// main.jsx 에서 조작 때마다 unlockAudio() 를 부른다.
import { getFxStyle } from './style.js';

const STORAGE_KEY = 'td-sound';

let ctx = null;
let master = null;
let enabled = readEnabled();
const listeners = new Set();
const noiseCache = new WeakMap();

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

/** 사용자 조작 때 호출: 오디오를 사용 가능한 상태로 만든다 */
export function unlockAudio() {
  const c = getContext();
  if (c && c.state !== 'running') c.resume().catch(() => {});
}

// ── 합성 도구 ─────────────────────────────────────────────────────────────────

function noiseBuffer(ac) {
  let buf = noiseCache.get(ac);
  if (!buf) {
    const length = Math.floor(ac.sampleRate * 0.25);
    buf = ac.createBuffer(1, length, ac.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ac, buf);
  }
  return buf;
}

// 짧게 올라갔다가 지수적으로 사라지는 음량 곡선
function envelope(gainNode, t, attack, peak, decay) {
  gainNode.gain.setValueAtTime(0.0001, t);
  gainNode.gain.exponentialRampToValueAtTime(peak, t + attack);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

function tone(ac, out, freq, t, { type = 'sine', attack = 0.005, peak = 0.3, decay = 0.2, to = null } = {}) {
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + attack + decay);
  envelope(gain, t, attack, peak, decay);
  osc.connect(gain);
  gain.connect(out);
  osc.start(t);
  osc.stop(t + attack + decay + 0.05);
}

// 필터를 거친 짧은 잡음 (종이·나무가 닿는 질감)
function noiseHit(ac, out, t, { freq = 1700, q = 0.9, peak = 0.5, decay = 0.07, type = 'bandpass' } = {}) {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac);
  const filter = ac.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = ac.createGain();
  envelope(gain, t, 0.002, peak, decay);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t);
  src.stop(t + decay + 0.05);
}

// 마림바처럼 둥근 타격음: 기본음 + 빨리 사라지는 4배음
function mallet(ac, out, freq, t, peak = 0.2, decay = 0.35) {
  tone(ac, out, freq, t, { attack: 0.003, peak, decay });
  tone(ac, out, freq * 4, t, { attack: 0.002, peak: peak * 0.25, decay: 0.05 });
}

// ── 효과음 세트 ───────────────────────────────────────────────────────────────

export const SOUND_SETS = {
  // 화려하게: 또렷한 전자음
  classic: {
    cardPlace(ac, out, { pitch = 1 } = {}) {
      const t = ac.currentTime;
      noiseHit(ac, out, t, { freq: 1700 * pitch, peak: 0.5, decay: 0.07 });
      tone(ac, out, 150 * pitch, t, { peak: 0.22, decay: 0.06, to: 80 });
    },
    myTurn(ac, out) {
      const t = ac.currentTime;
      tone(ac, out, 660, t, { attack: 0.01, peak: 0.16, decay: 0.18 });
      tone(ac, out, 990, t + 0.11, { attack: 0.01, peak: 0.14, decay: 0.3 });
    },
    bellPress(ac, out) {
      const t = ac.currentTime;
      tone(ac, out, 1320, t, { attack: 0.002, peak: 0.22, decay: 0.9 });
      tone(ac, out, 1320 * 2.76, t, { attack: 0.002, peak: 0.07, decay: 0.45 });
      tone(ac, out, 1320 * 5.4, t, { attack: 0.002, peak: 0.035, decay: 0.25 });
    },
    bellSuccess(ac, out) {
      const t = ac.currentTime;
      [784, 988, 1175, 1568].forEach((f, i) => tone(ac, out, f, t + i * 0.07, { type: 'triangle', peak: 0.18, decay: 0.25 }));
      tone(ac, out, 1568, t + 0.28, { peak: 0.12, decay: 0.6 });
    },
    bellFail(ac, out) {
      const t = ac.currentTime;
      const osc = ac.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(180, t);
      osc.frequency.exponentialRampToValueAtTime(90, t + 0.35);
      const low = ac.createBiquadFilter();
      low.type = 'lowpass';
      low.frequency.value = 700;
      const gain = ac.createGain();
      envelope(gain, t, 0.01, 0.22, 0.35);
      osc.connect(low);
      low.connect(gain);
      gain.connect(out);
      osc.start(t);
      osc.stop(t + 0.42);
    },
    chat(ac, out) {
      const t = ac.currentTime;
      tone(ac, out, 880, t, { attack: 0.004, peak: 0.15, decay: 0.07 });
      tone(ac, out, 1320, t + 0.06, { attack: 0.004, peak: 0.13, decay: 0.1 });
    },
    tick(ac, out) {
      tone(ac, out, 900, ac.currentTime, { type: 'square', attack: 0.002, peak: 0.16, decay: 0.05 });
    },
    go(ac, out) {
      const t = ac.currentTime;
      tone(ac, out, 660, t, { type: 'square', attack: 0.004, peak: 0.16, decay: 0.12 });
      tone(ac, out, 990, t + 0.1, { type: 'square', attack: 0.004, peak: 0.18, decay: 0.3 });
    },
    win(ac, out) {
      const t = ac.currentTime;
      [523, 659, 784, 1046].forEach((f, i) => tone(ac, out, f, t + i * 0.12, { type: 'triangle', peak: 0.2, decay: 0.3 }));
      tone(ac, out, 1046, t + 0.5, { type: 'triangle', peak: 0.16, decay: 0.8 });
    },
    lose(ac, out) {
      const t = ac.currentTime;
      [440, 392, 330].forEach((f, i) => tone(ac, out, f, t + i * 0.18, { peak: 0.16, decay: 0.3 }));
      tone(ac, out, 262, t + 0.56, { peak: 0.14, decay: 0.7 });
    },
  },

  // 통통 (스택랜드풍): 나무·종이를 두드리는 듯한 짧고 둥근 소리
  stack: {
    cardPlace(ac, out, { pitch = 1 } = {}) {
      const t = ac.currentTime;
      noiseHit(ac, out, t, { freq: 900 * pitch, q: 1.4, peak: 0.35, decay: 0.04 });
      tone(ac, out, 420 * pitch, t, { attack: 0.002, peak: 0.22, decay: 0.05, to: 220 });
      tone(ac, out, 210 * pitch, t, { type: 'triangle', attack: 0.002, peak: 0.12, decay: 0.06 });
    },
    myTurn(ac, out) {
      const t = ac.currentTime;
      mallet(ac, out, 523, t, 0.16);
      mallet(ac, out, 784, t + 0.1, 0.14);
    },
    bellPress(ac, out) {
      const t = ac.currentTime;
      tone(ac, out, 1046, t, { attack: 0.003, peak: 0.18, decay: 0.6 });
      tone(ac, out, 2093, t, { attack: 0.003, peak: 0.05, decay: 0.3 });
    },
    bellSuccess(ac, out) {
      const t = ac.currentTime;
      [523, 659, 784, 1046].forEach((f, i) => mallet(ac, out, f, t + i * 0.08, 0.18, 0.3));
      tone(ac, out, 500, t + 0.34, { attack: 0.003, peak: 0.12, decay: 0.08, to: 900 }); // 마지막 "뽁"
    },
    bellFail(ac, out) {
      const t = ac.currentTime;
      tone(ac, out, 300, t, { attack: 0.004, peak: 0.24, decay: 0.18, to: 120 });   // "봉크"
      noiseHit(ac, out, t, { freq: 500, q: 1, peak: 0.15, decay: 0.05, type: 'lowpass' });
    },
    chat(ac, out) {
      tone(ac, out, 500, ac.currentTime, { attack: 0.003, peak: 0.17, decay: 0.07, to: 900 }); // 물방울 "뽁"
    },
    tick(ac, out) {
      const t = ac.currentTime;
      tone(ac, out, 800, t, { attack: 0.002, peak: 0.16, decay: 0.03 });
      noiseHit(ac, out, t, { freq: 2500, q: 2, peak: 0.18, decay: 0.02 });
    },
    go(ac, out) {
      const t = ac.currentTime;
      mallet(ac, out, 659, t, 0.16);
      mallet(ac, out, 988, t + 0.09, 0.18, 0.4);
    },
    win(ac, out) {
      const t = ac.currentTime;
      [523, 659, 784, 1046, 1318].forEach((f, i) => mallet(ac, out, f, t + i * 0.1, 0.18, 0.35));
    },
    lose(ac, out) {
      const t = ac.currentTime;
      [392, 330, 262].forEach((f, i) => mallet(ac, out, f, t + i * 0.16, 0.15, 0.4));
    },
  },
};

export const SOUND_NAMES = Object.keys(SOUND_SETS.classic);

/** 현재 이펙트 스타일의 효과음을 재생한다 */
export function playSound(name, options) {
  if (!enabled) return;
  const c = getContext();
  const set = SOUND_SETS[getFxStyle()] || SOUND_SETS.classic;
  if (!c || !set[name]) return;
  if (c.state !== 'running') c.resume().catch(() => {});
  try {
    set[name](c, master, options);
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
