import React, { useRef, useCallback } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { playSound, vibrate } from '../fx/sound.js';
import { toServerTime } from '../net/clock.js';

// 서버 BELL_COOLDOWN_MS 와 같은 값: 누른 뒤 이 시간 동안 다시 누를 수 없다
export const BELL_COOLDOWN_MS = 1000;

export default function BellButton({ skinClass = '', eliminated = false }) {
  const { emit, getBoardSeq } = useGame();
  // 손가락/마우스가 닿은 순간 (벨 시간 보정: 떼는 순간이 아니라 누른 순간을 보낸다)
  const downAtRef = useRef(null);
  const [pressed, setPressed] = React.useState(false);
  const [cooling, setCooling] = React.useState(false);
  const coolingRef = useRef(false);
  const touchRef = useRef({ active: false, moved: false, startX: 0, startY: 0 });

  const trigger = useCallback((eventTimeStamp) => {
    if (coolingRef.current || eliminated) return;
    const now = performance.now();
    const down = downAtRef.current;
    downAtRef.current = null;
    // 누른 순간: 직전 누름 시작 시각(1.5초 이내) > 이벤트 시각 > 지금
    const pressedPerf = down != null && now - down < 1500 ? down : (typeof eventTimeStamp === 'number' ? eventTimeStamp : now);
    coolingRef.current = true;
    setCooling(true);
    setPressed(true);
    playSound('bellPress');
    vibrate(40);
    emit('halliGalli', { pressedAt: Math.round(toServerTime(pressedPerf)), boardSeq: getBoardSeq() });
    setTimeout(() => setPressed(false), 300);
    setTimeout(() => { coolingRef.current = false; setCooling(false); }, BELL_COOLDOWN_MS);
  }, [emit, eliminated, getBoardSeq]);

  function onTouchStart(e) {
    downAtRef.current = e.timeStamp;
    const t = e.touches[0];
    touchRef.current = { active: true, moved: false, startX: t.clientX, startY: t.clientY };
  }

  function onTouchMove(e) {
    if (!touchRef.current.active) return;
    const t = e.touches[0];
    const dx = Math.abs(t.clientX - touchRef.current.startX);
    const dy = Math.abs(t.clientY - touchRef.current.startY);
    if (dx > 10 || dy > 10) touchRef.current.moved = true;
  }

  function onTouchEnd(e) {
    if (!touchRef.current.active) return;
    e.preventDefault();
    touchRef.current.active = false;
    if (!touchRef.current.moved) trigger();
  }

  return (
    <div className={`halli-galli-bell-container ${skinClass}`}>
      <button
        id="halliGalliBell"
        className={`halli-galli-bell ${pressed ? 'bell-pressed' : ''} ${cooling ? 'bell-cooling' : ''} ${eliminated ? 'bell-out' : ''}`}
        style={{ '--bell-cooldown': `${BELL_COOLDOWN_MS}ms` }}
        disabled={eliminated}
        aria-disabled={cooling || eliminated}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onMouseDown={e => { downAtRef.current = e.timeStamp; }}
        onClick={e => trigger(e.timeStamp)}
        aria-label={eliminated ? '탈락' : 'TOUCH DOWN'}
      >
        <span className="bell-label">{eliminated ? '탈락' : <>TOUCH<br />DOWN</>}</span>
        {cooling && <span className="bell-cooldown-ring" aria-hidden="true" />}
      </button>
    </div>
  );
}
