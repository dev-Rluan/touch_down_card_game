// 게임 화면 이펙트 — React 렌더링과 분리된 고정 레이어에서 Web Animations API 로 그린다.
// 요소 위치는 이벤트가 상태에 반영되기 전에 측정한다 (예: 벨 성공 직후 사라질 카드 더미).
//
// 원칙: 이미 일어난 일(카드를 냄, 벨 결과)에만 이펙트를 붙인다.
// "같은 과일이 5개가 되면 반짝임" 같은 이펙트는 벨 정답을 화면이 알려주게 되므로 넣지 않는다.

function prefersReducedMotion() {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {
    return false;
  }
}

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

/**
 * 카드 한 장을 fromRect 에서 toRect 로 날린다.
 * @param {string} html - 날아가는 카드의 내용 (앞면 카드 복제 또는 뒷면)
 */
function flyCard(fromRect, toRect, { html = '', className = '', duration = 420, delay = 0, rotate = 0, midScale = 1.04, endScale = 0.9 } = {}) {
  if (!fromRect || !toRect) return;
  const el = document.createElement('div');
  el.className = `fx-card ${className}`;
  el.innerHTML = html;
  el.style.width = `${fromRect.width}px`;
  el.style.height = `${fromRect.height}px`;
  el.style.left = `${fromRect.left}px`;
  el.style.top = `${fromRect.top}px`;
  getLayer().appendChild(el);

  const from = centerOf(fromRect);
  const to = centerOf(toRect);
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const anim = run(el, [
    { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
    { transform: `translate(${dx * 0.5}px, ${dy * 0.5 - 30}px) rotate(${rotate / 2}deg) scale(${midScale})`, opacity: 1, offset: 0.5 },
    { transform: `translate(${dx}px, ${dy}px) rotate(${rotate}deg) scale(${endScale})`, opacity: 0.85 },
  ], { duration, delay, easing: 'cubic-bezier(.3,.7,.2,1)', fill: 'both' });
  if (anim) anim.onfinish = () => el.remove();
  else el.remove();
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

  const keyframes = prefersReducedMotion()
    ? [{ opacity: 0 }, { opacity: 1, offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0 }]
    : [
      { opacity: 0, transform: 'translate(-50%, -30%) scale(0.6)' },
      { opacity: 1, transform: 'translate(-50%, -80%) scale(1.15)', offset: 0.22 },
      { opacity: 1, transform: 'translate(-50%, -110%) scale(1)', offset: 0.75 },
      { opacity: 0, transform: 'translate(-50%, -150%) scale(1)' },
    ];
  const anim = run(el, keyframes, { duration: 1400, easing: 'ease-out', fill: 'both' });
  if (anim) anim.onfinish = () => el.remove();
  else setTimeout(() => el.remove(), 1400);
}

/** 화면 전체가 한 번 번쩍임 */
export function flash(kind = 'good') {
  if (prefersReducedMotion()) return;
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
    duration: 260,
    endScale: 0.7,
  });
}

/** 벨 성공: 모든 더미의 맨 위 카드가 성공한 사람 더미로 쓸려 들어감 + 그 더미가 빛남 */
export function sweepTo(winnerId) {
  const winner = stackElement(winnerId);
  if (!winner) return;
  const target = (winner.querySelector('.player-stack-cards') || winner).getBoundingClientRect();

  if (!prefersReducedMotion()) {
    const tops = Array.from(document.querySelectorAll('[data-stack-id] .stack-card:last-child'));
    tops.forEach((card, i) => {
      flyCard(card.getBoundingClientRect(), target, {
        html: card.innerHTML,
        className: 'fx-card-face',
        duration: 480,
        delay: i * 60,
        rotate: (i % 2 ? 1 : -1) * 12,
        midScale: 0.95,
        endScale: 0.4,
      });
    });
  }
  run(winner, [
    { boxShadow: '0 0 0 0 var(--accent)' },
    { boxShadow: '0 0 0 6px var(--accent), 0 0 28px 8px var(--accent)', offset: 0.35 },
    { boxShadow: '0 0 0 0 var(--accent)' },
  ], { duration: 900, easing: 'ease-out' });
}

/** 벨 실패: 실패한 사람 더미가 흔들리고, 카드 1장이 뒤집힌 채 버림 더미로 날아감 */
export function failToDiscard(playerId) {
  const host = stackElement(playerId);
  const pile = document.getElementById('discardPile');
  if (!host) return;

  if (!prefersReducedMotion()) {
    run(host, [
      { transform: 'translateX(0)' },
      { transform: 'translateX(-8px)' },
      { transform: 'translateX(7px)' },
      { transform: 'translateX(-5px)' },
      { transform: 'translateX(3px)' },
      { transform: 'translateX(0)' },
    ], { duration: 380, easing: 'ease-in-out' });

    const from = (host.querySelector('.player-stack-cards') || host).getBoundingClientRect();
    if (pile) {
      const to = pile.getBoundingClientRect();
      const size = { left: from.left + from.width / 2 - to.width / 2, top: from.top + from.height / 2 - to.height / 2, width: to.width, height: to.height };
      flyCard(size, to, {
        html: '<div class="card-back-pattern"></div>',
        className: 'fx-card-back',
        duration: 520,
        rotate: 200,
        endScale: 1,
      });
      run(pile, [{ transform: 'scale(1)' }, { transform: 'scale(1)', offset: 0.85 }, { transform: 'scale(1.15)', offset: 0.92 }, { transform: 'scale(1)' }], { duration: 640 });
    }
  }
  run(host, [
    { boxShadow: '0 0 0 0 var(--fx-bad)' },
    { boxShadow: '0 0 0 4px var(--fx-bad), 0 0 22px 6px var(--fx-bad)', offset: 0.3 },
    { boxShadow: '0 0 0 0 var(--fx-bad)' },
  ], { duration: 800, easing: 'ease-out' });
}
