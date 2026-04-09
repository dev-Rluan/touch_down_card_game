import React from 'react';
import { useGame } from '../context/GameContext.jsx';
import useAuth from '../hooks/useAuth.js';

export default function Navbar() {
  const { state, emit } = useGame();
  const { account, providers } = useAuth();
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
          <i className="icon ion-ios-bell me-2" />
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
                autoFocus
              />
              <button type="submit" className="btn btn-sm btn-light">확인</button>
              <button type="button" className="btn btn-sm btn-outline-light" onClick={() => setEditingNick(false)}>취소</button>
            </form>
          ) : (
            <button
              className="btn btn-sm btn-outline-light d-flex align-items-center gap-1"
              onClick={() => { setNickInput(state.nickname); setEditingNick(true); }}
              title="닉네임 변경"
            >
              <i className="icon ion-person" />
              <span className="d-none d-sm-inline">{state.nickname}</span>
            </button>
          )}

          {/* 인증 영역 */}
          {account ? (
            <div className="d-flex align-items-center gap-1">
              <span className="text-light small d-none d-md-inline">{account.displayName}</span>
              {account.avatar
                ? <img src={account.avatar} className="rounded-circle" width="28" height="28" style={{ objectFit: 'cover' }} alt="avatar" />
                : <span className="navbar-avatar">{account.displayName.charAt(0).toUpperCase()}</span>
              }
              <a href="/auth/logout" className="btn btn-sm btn-outline-light ms-1">로그아웃</a>
            </div>
          ) : (
            <div className="d-flex gap-1">
              {providers.includes('google') && (
                <a href="/auth/google" className="btn btn-sm btn-light">
                  <i className="icon ion-social-google" /> Google
                </a>
              )}
              {providers.includes('kakao') && (
                <a href="/auth/kakao" className="btn btn-sm btn-warning">
                  <i className="icon ion-social-buffer" /> Kakao
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </nav>
  );
}
