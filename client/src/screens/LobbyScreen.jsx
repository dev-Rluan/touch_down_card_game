import React, { useState, useEffect } from 'react';
import { useGame } from '../context/GameContext.jsx';
import Navbar from '../components/Navbar.jsx';
import RoomList from '../components/RoomList.jsx';
import AdBanner from '../components/AdBanner.jsx';
import Icon from '../components/Icon.jsx';
import FeedbackButton from '../components/FeedbackButton.jsx';

// ── 게임방 탭 ────────────────────────────────────────────────────────────────

function RoomsPanel({ emit }) {
  const [roomName, setRoomName] = useState('');
  const [maxUsers, setMaxUsers] = useState(4);
  const [showCreate, setShowCreate] = useState(false);

  // 모달이 열려 있는 동안: Esc 로 닫기, 배경 스크롤 잠금 (Bootstrap JS 없이 직접 처리)
  useEffect(() => {
    if (!showCreate) return;
    function onKey(e) {
      if (e.key === 'Escape') setShowCreate(false);
    }
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [showCreate]);

  function handleCreateRoom(e) {
    e.preventDefault();
    const name = roomName.trim();
    if (!name) return;
    emit('createRoom', name, maxUsers);
    setRoomName('');
    setMaxUsers(4);
    setShowCreate(false);
  }

  return (
    <div className="lobby-panel">
      <AdBanner slot={window.__ADSENSE_LOBBY_SLOT__} className="mb-3" />

      {/* 방 목록 카드 */}
      <div className="card game-card">
        <div className="card-header d-flex justify-content-between align-items-center">
          <h5 className="card-title mb-0">
            <Icon name="people" className="me-2" />게임 방 목록
          </h5>
          <div className="d-flex gap-2">
            <button className="btn btn-sm btn-outline-secondary" onClick={() => emit('roomList')} aria-label="새로고침">
              <Icon name="refresh" />
            </button>
            <button className="btn btn-sm btn-primary" onClick={() => setShowCreate(true)}>
              <Icon name="plus" className="me-1" />방 만들기
            </button>
          </div>
        </div>
        <div className="card-body p-0">
          <RoomList />
        </div>
      </div>

      <FeedbackButton />

      {/* 방 만들기 모달 */}
      {showCreate && (
        <>
          <div
            className="modal fade show d-block"
            id="modal_createRoom"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            aria-labelledby="createRoomTitle"
            onMouseDown={e => { if (e.target === e.currentTarget) setShowCreate(false); }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" id="createRoomTitle">방 만들기</h5>
                  <button type="button" className="btn-close" aria-label="닫기" onClick={() => setShowCreate(false)} />
                </div>
                <form onSubmit={handleCreateRoom}>
                  <div className="modal-body">
                    <div className="mb-3">
                      <label className="form-label">방 이름</label>
                      <input
                        className="form-control"
                        style={{ fontSize: 16 }}
                        value={roomName}
                        onChange={e => setRoomName(e.target.value)}
                        placeholder="방 이름을 입력하세요"
                        maxLength={30}
                        autoFocus
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label className="form-label">최대 인원</label>
                      <select
                        className="form-select"
                        style={{ fontSize: 16 }}
                        value={maxUsers}
                        onChange={e => setMaxUsers(Number(e.target.value))}
                      >
                        <option value={2}>2명</option>
                        <option value={3}>3명</option>
                        <option value={4}>4명</option>
                      </select>
                    </div>
                  </div>
                  <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>취소</button>
                    <button type="submit" className="btn btn-primary">방 만들기</button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </div>
  );
}

// ── 메인 로비 화면 ────────────────────────────────────────────────────────────

export default function LobbyScreen() {
  const { emit } = useGame();

  return (
    <div className="lobby-layout">
      <Navbar />
      <div className="lobby-tab-content">
        <RoomsPanel emit={emit} />
      </div>
    </div>
  );
}
