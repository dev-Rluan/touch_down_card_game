// 게임 화면 이펙트 — React 렌더링과 분리된 고정 레이어에서 Web Animations API 로 그린다.
// 요소 위치는 이벤트가 상태에 반영되기 전에 측정한다 (예: 벨 성공 직후 사라질 카드 더미).
//
// 스타일 두 가지 (fx/style.js):
//  - classic: 화려하게 — 화면 번쩍임, 빛나는 테두리, 직선으로 날아가는 카드
//  - stack  : 통통 (Stacklands 풍) — 번쩍임 없이, 카드가 포물선으로 깡충 뛰고 착지할 때 눌렸다 튕김
//
// 원칙: 이미 일어난 일(카드를 냄, 벨 결과)에만 이펙트를 붙인다.
// "같은 과일이 5개가 되면 반짝임" 같은 이펙트는 벨 정답을 화면이 알려주게 되므로 넣지 않는다.
import { getFxStyle } from './style.js';

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {
    return false;
  }
}

const isStack = () => getFxStyle() === 'stack';

function getLayer() {
  let layer = document.getElementById('fx-layer');
  if (!layer) {
    layer = document.createElement('div');
    layer.id = 'fx-layer';
    layer.className = 'fx-layer';
    layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
  }
  return layer;
}

function cssEscape(value) {
  return window.CSS && window.CSS.escape ? window.CSS.escape(value) : String(value).replace(/"/g, '\\"');
}

function stackElement(playerId) {
  return document.querySelector(`[data-stack-id="${cssEscape(playerId)}"]`);
}

function centerOf(rect) {
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

function run(el, keyframes, options) {
  if (!el || typeof el.animate !== 'function') return null;
  return el.animate(keyframes, options);
}

// classic: 살짝 떠올랐다가 직선에 가깝게 이동
function straightPath(dx, dy, { rotate, midScale, endScale }) {
  return [
    { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) rotate(${rotate / 2}deg) scale(${midScale})`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${rotate}deg) scale(${endScale})`, opacity: 0.85 },
  ];
}

// stack: 포물선으로 깡충 → 착지할 때 납작하게 눌렸다가 튕겨 돌아옴
function hopPath(dx, dy, { rotate, endScale, height }) {
  const frames = [];
  const steps = [0, 0.2, 0.4, 0.6, 0.8, 0.88];
  steps.forEach(p => {
    const y = dy * p - 4 * height * p * (1 - p);
    const lift = 1 + 0.08 * Math.sin(Math.PI * p);
    frames.push({ transform: `translate(${dx * p}px, ${y}px) rotate(${rotate * p}deg) scale(${lift})`, offset: p });
  });
  frames.push({ transform: `translate(${dx}px, ${dy}px) rotate(${rotate}deg) scale(${endScale * 1.12}, ${endScale * 0.82})`, offset: 0.94 });
  frames.push({ transform: `translate(${dx}px, ${dy}px) rotate(${rotate}deg) scale(${endScale})`, offset: 1, opacity: 0.9 });
  return frames;
}

/**
 * 카드 한 장을 fromRect 에서 toRect 로 날린다.
 * @param {string} html - 날아가는 카드의 내용 (앞면 카드 복제 또는 뒷면)
 */
function flyCard(fromRect, toRect, { html = '', className = '', duration = 420, delay = 0, rotate = 0, midScale = 1.04, endScale = 0.9, height = 60 } = {}) {
  if (!fromRect || !toRect) return;
  const el = document.createElement('div');
  el.className = `fx-card ${className}`;
  el.innerHTML = html;
  el.style.width = `${fromRect.width}px`;
  el.style.height = `${fromRect.height}px`;
  el.style.setProperty('--fx-h', `${fromRect.height}px`); // 카드 크기에 맞춰 그림·숫자 크기 조절
  el.style.left = `${fromRect.left}px`;
  el.style.top = `${fromRect.top}px`;
  getLayer().appendChild(el);

  const from = centerOf(fromRect);
  const to = centerOf(toRect);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const stack = isStack();
  const keyframes = stack
    ? hopPath(dx, dy, { rotate, endScale, height })
    : straightPath(dx, dy, { rotate, midScale, endScale });
  const anim = run(el, keyframes, {
    duration: stack ? duration * 1.15 : duration,
    delay,
    easing: stack ? 'linear' : 'cubic-bezier(.3,.7,.2,1)',
    fill: 'both',
  });
  if (anim) anim.onfinish = () => el.remove();
  else el.remove();
}

/** 요소를 통 튀게 (stack 스타일의 반응) */
function bounce(el, strength = 1) {
  run(el, [
    { transform: 'translateY(0) scale(1)' },
    { transform: `translateY(${-10 * strength}px) scale(${1 + 0.04 * strength}, ${1 - 0.03 * strength})`, offset: 0.3 },
    { transform: `translateY(0) scale(${1 + 0.05 * strength}, ${1 - 0.06 * strength})`, offset: 0.55 },
    { transform: `translateY(${-3 * strength}px) scale(1)`, offset: 0.75 },
    { transform: 'translateY(0) scale(1)' },
  ], { duration: 520, easing: 'ease-out' });
}

/** 플레이어 더미 위로 떠오르는 글자 (+7, -1 등) */
export function floatText(playerId, text, kind = 'good') {
  const host = stackElement(playerId);
  if (!host) return;
  const rect = host.getBoundingClientRect();
  const el = document.createElement('div');
  el.className = `fx-float fx-float-${kind}`;
  el.textContent = text;
  el.style.left = `${rect.left + rect.width / 2}px`;
  el.style.top = `${rect.top + rect.height * 0.32}px`; // 카드 그림보다 위쪽
  getLayer().appendChild(el);

  let keyframes;
  if (prefersReducedMotion()) {
    keyframes = [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }];
  } else if (isStack()) {
    // 통통: 튀어나오며 커졌다 작아지고, 살짝만 떠오름
    keyframes = [
      { opacity: 0, transform: 'translate(-50%, -40%) scale(0.3)' },
      { opacity: 1, transform: 'translate(-50%, -70%) scale(1.25)', offset: 0.18 },
      { opacity: 1, transform: 'translate(-50%, -60%) scale(0.92)', offset: 0.3 },
      { opacity: 1, transform: 'translate(-50%, -65%) scale(1)', offset: 0.42 },
      { opacity: 1, transform: 'translate(-50%, -75%) scale(1)', offset: 0.8 },
      { opacity: 0, transform: 'translate(-50%, -95%) scale(0.9)' },
    ];
  } else {
    keyframes = [
      { opacity: 0, transform: 'translate(-50%, -30%) scale(0.6)' },
      { opacity: 1, transform: 'translate(-50%, -80%) scale(1.15)', offset: 0.22 },
      { opacity: 1, transform: 'translate(-50%, -110%) scale(1)', offset: 0.75 },
      { opacity: 0, transform: 'translate(-50%, -150%) scale(1)' },
    ];
  }
  const anim = run(el, keyframes, { duration: 1400, easing: 'ease-out', fill: 'both' });
  if (anim) anim.onfinish = () => el.remove();
  else setTimeout(() => el.remove(), 1400);
}

/** 화면 전체가 한 번 번쩍임 (classic 만) */
export function flash(kind = 'good') {
  if (prefersReducedMotion() || isStack()) return;
  const el = document.createElement('div');
  el.className = `fx-flash fx-flash-${kind}`;
  getLayer().appendChild(el);
  const anim = run(el, [{ opacity: 0.2 }, { opacity: 0 }], { duration: 380, easing: 'ease-out', fill: 'both' });
  if (anim) anim.onfinish = () => el.remove();
  else el.remove();
}

/** 내가 카드를 낼 때: 내 덱에서 내 더미로 카드 뒷면이 날아감 */
export function deckToStack(playerId) {
  if (prefersReducedMotion()) return;
  const deck = document.querySelector('.my-deck-card');
  const host = stackElement(playerId);
  const target = host && host.querySelector('.player-stack-cards');
  if (!deck || !target) return;
  flyCard(deck.getBoundingClientRect(), target.getBoundingClientRect(), {
    html: '<div class="card-back-pattern"></div>',
    className: 'fx-card-back',
    duration: isStack() ? 300 : 260,
    endScale: 0.7,
    height: 50,
  });
}

/** 벨 성공: 모든 더미의 맨 위 카드가 성공한 사람 더미로 모임 */
export function sweepTo(winnerId) {
  const winner = stackElement(winnerId);
  if (!winner) return;
  const target = (winner.querySelector('.player-stack-cards') || winner).getBoundingClientRect();
  const stack = isStack();

  if (!prefersReducedMotion()) {
    const tops = Array.from(document.querySelectorAll('[data-stack-id] .stack-card:last-child'));
    tops.forEach((card, i) => {
      flyCard(card.getBoundingClientRect(), target, {
        html: card.innerHTML,
        className: 'fx-card-face',
        duration: stack ? 460 : 480,
        delay: i * (stack ? 110 : 60),       // 통통: 한 장씩 차례로 깡충
        rotate: (i % 2 ? 1 : -1) * (stack ? 8 : 12),
        midScale: 0.95,
        endScale: 0.4,
        height: 70,
      });
    });
  }

  if (stack) {
    // 마지막 카드가 도착할 즈음 받은 더미가 기쁘게 통 튐
    const tops = document.querySelectorAll('[data-stack-id] .stack-card:last-child').length;
    setTimeout(() => bounce(winner, 1.2), prefersReducedMotion() ? 0 : 380 + tops * 110);
  } else {
    run(winner, [
      { boxShadow: '0 0 0 0 var(--accent)' },
      { boxShadow: '0 0 0 6px var(--accent), 0 0 28px 8px var(--accent)', offset: 0.35 },
      { boxShadow: '0 0 0 0 var(--accent)' },
    ], { duration: 900, easing: 'ease-out' });
  }
}

/** 벨 실패: 카드 1장이 뒤집힌 채 버림 더미로 감 + 실패한 사람 더미의 반응 */
export function failToDiscard(playerId) {
  const host = stackElement(playerId);
  const pile = document.getElementById('discardPile');
  if (!host) return;
  const stack = isStack();

  if (!prefersReducedMotion()) {
    if (stack) {
      // 시무룩하게 기우뚱
      run(host, [
        { transform: 'rotate(0deg) translateY(0)' },
        { transform: 'rotate(-4deg) translateY(3px)', offset: 0.25 },
        { transform: 'rotate(3deg) translateY(2px)', offset: 0.5 },
        { transform: 'rotate(-1.5deg) translateY(1px)', offset: 0.75 },
        { transform: 'rotate(0deg) translateY(0)' },
      ], { duration: 600, easing: 'ease-in-out' });
    } else {
      run(host, [
        { transform: 'translateX(0)' },
        { transform: 'translateX(-8px)' },
        { transform: 'translateX(7px)' },
        { transform: 'translateX(-5px)' },
        { transform: 'translateX(3px)' },
        { transform: 'translateX(0)' },
      ], { duration: 380, easing: 'ease-in-out' });
    }

    const from = (host.querySelector('.player-stack-cards') || host).getBoundingClientRect();
    if (pile) {
      const to = pile.getBoundingClientRect();
      const size = { left: from.left + from.width / 2 - to.width / 2, top: from.top + from.height / 2 - to.height / 2, width: to.width, height: to.height };
      flyCard(size, to, {
        html: '<div class="card-back-pattern"></div>',
        className: 'fx-card-back',
        duration: 520,
        rotate: stack ? 30 : 200,
        endScale: 1,
        height: 90,
      });
      if (stack) setTimeout(() => bounce(pile, 0.8), 560);
      else run(pile, [{ transform: 'scale(1)' }, { transform: 'scale(1)', offset: 0.85 }, { transform: 'scale(1.15)', offset: 0.92 }, { transform: 'scale(1)' }], { duration: 640 });
    }
  }

  if (!stack) {
    run(host, [
      { boxShadow: '0 0 0 0 var(--fx-bad)' },
      { boxShadow: '0 0 0 4px var(--fx-bad), 0 0 22px 6px var(--fx-bad)', offset: 0.3 },
      { boxShadow: '0 0 0 0 var(--fx-bad)' },
    ], { duration: 800, easing: 'ease-out' });
  }
}
