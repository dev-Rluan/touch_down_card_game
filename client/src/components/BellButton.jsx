import React, { useRef, useCallback } from 'react';
import { useGame } from '../context/GameContext.jsx';

function playBellSound() {
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(400, audioContext.currentTime + 0.1);
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.3);
  } catch (_) {}
}

export default function BellButton({ skinClass = '' }) {
  const { emit } = useGame();
  const [pressed, setPressed] = React.useState(false);
  const touchRef = useRef({ active: false, moved: false, startX: 0, startY: 0 });

  const trigger = useCallback(() => {
    setPressed(true);
    playBellSound();
    if (navigator.vibrate) navigator.vibrate(50);
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
        aria-label="할리갈리 벨"
      >
        <i className="icon ion-ios-bell" />
        <span className="bell-label">할리갈리!</span>
      </button>
    </div>
  );
}
