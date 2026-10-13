import React, { useEffect, useState } from 'react';
import Icon from './Icon.jsx';
import { isSoundOn, setSoundOn, subscribeSound, unlockAudio, playSound } from '../fx/sound.js';

/** 소리·진동 켜기/끄기 (설정은 이 기기에 저장) */
export default function SoundToggle({ className = '' }) {
  const [on, setOn] = useState(isSoundOn);

  useEffect(() => subscribeSound(setOn), []);

  function toggle() {
    const next = !on;
    setSoundOn(next);
    if (next) {
      unlockAudio();
      playSound('cardPlace'); // 켜졌다는 걸 소리로 확인
    }
  }

  return (
    <button
      type="button"
      className={`sound-toggle ${on ? '' : 'is-off'} ${className}`.trim()}
      onClick={toggle}
      aria-pressed={on}
      aria-label={on ? '소리 끄기' : '소리 켜기'}
      title={on ? '소리 끄기' : '소리 켜기'}
    >
      <Icon name={on ? 'sound' : 'mute'} />
    </button>
  );
}
