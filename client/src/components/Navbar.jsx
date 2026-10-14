import React from 'react';
import { useGame } from '../context/GameContext.jsx';
import ThemePicker from './ThemePicker.jsx';
import SoundToggle from './SoundToggle.jsx';
import Icon from './Icon.jsx';

export default function Navbar() {
  const { state, emit } = useGame();
  const [editingNick, setEditingNick] = React.useState(false);
  const [nickInput, setNickInput] = React.useState('');

  function handleNickSubmit(e) {
    e.preventDefault();
    const name = nickInput.trim();
    if (!name) return;
    emit('change name', name);
    setNickInput('');
    setEditingNick(false);
  }

  return (
    <nav className="navbar navbar-expand-lg navbar-dark sticky-top">
      <div className="container-fluid">
        <span className="navbar-brand fw-bold">
          Touch Down
        </span>

        <div className="d-flex align-items-center gap-2 ms-auto">
          {/* 닉네임 */}
          {editingNick ? (
            <form className="d-flex gap-1" onSubmit={handleNickSubmit}>
              <input
                className="form-control form-control-sm"
                style={{ width: 120, fontSize: 16 }}
                value={nickInput}
                onChange={e => setNickInput(e.target.value)}
                placeholder="새 닉네임"
                maxLength={12}
                autoFocus
              />
              <button type="submit" className="btn btn-sm btn-light">확인</button>
              <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setEditingNick(false)}>취소</button>
            </form>
          ) : (
            <button
              className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
              onClick={() => { setNickInput(state.nickname); setEditingNick(true); }}
              disabled={!!state.roomId}
              title={state.roomId ? '방에서는 닉네임을 바꿀 수 없습니다' : '닉네임 변경'}
            >
              <Icon name="person" />
              <span className="text-truncate" style={{ maxWidth: 110 }}>{state.nickname}</span>
            </button>
          )}

          <SoundToggle />
          <ThemePicker />
        </div>
      </div>
    </nav>
  );
}
