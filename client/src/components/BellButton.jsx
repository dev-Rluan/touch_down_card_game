import React, { useRef, useCallback } from 'react';
import { useGame } from '../context/GameContext.jsx';
import { playSound, vibrate } from '../fx/sound.js';

export default function BellButton({ skinClass = '' }) {
  const { emit } = useGame();
  const [pressed, setPressed] = React.useState(false);
  const touchRef = useRef({ active: false, moved: false, startX: 0, startY: 0 });

  const trigger = useCallback(() => {
    setPressed(true);
    playSound('bellPress');
    vibrate(40);
    emit('halliGalli');
    setTimeout(() => setPressed(false), 300);
  }, [emit]);

  function onTouchStart(e) {
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
        className={`halli-galli-bell ${pressed ? 'bell-pressed' : ''}`}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={trigger}
        aria-label="TOUCH DOWN"
      >
        <span className="bell-label">TOUCH<br />DOWN</span>
      </button>
    </div>
  );
}
