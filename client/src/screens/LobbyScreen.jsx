import React, { useState, useRef } from 'react';
import { useGame } from '../context/GameContext.jsx';
import Navbar from '../components/Navbar.jsx';
import RoomList from '../components/RoomList.jsx';
import RetentionTabs from '../components/RetentionTabs.jsx';
import AdBanner from '../components/AdBanner.jsx';
import useAuth from '../hooks/useAuth.js';

export default function LobbyScreen() {
  const { state, emit } = useGame();
  const { account, providers } = useAuth();
  const [roomName, setRoomName] = useState('');
  const [maxUsers, setMaxUsers] = useState(4);
  const modalRef = useRef(null);

  function handleCreateRoom(e) {
    e.preventDefault();
    const name = roomName.trim();
    if (!name) return;
    emit('createRoom', name, maxUsers);
    setRoomName('');
    setMaxUsers(4);
    // Bootstrap 모달 닫기
    const modal = window.bootstrap?.Modal?.getInstance(modalRef.current);
    modal?.hide();
  }

  function handleRefresh() {
    emit('roomList');
  }

  return (
    <>
      <Navbar />

      <div className="container-fluid py-3">
        {/* 로그인 배너 (미로그인 시) */}
        {!account && providers.length > 0 && (
          <div className="login-banner mb-3">
            <div className="login-banner-inner">
              <div>
                <strong>로그인하면 랭킹·업적·꾸미기를 이용할 수 있어요!</strong>
              </div>
              <div className="login-banner-buttons mt-2">
                {providers.includes('google') && (
                  <a href="/auth/google" className="btn btn-sm btn-outline-dark me-2">
                    <i className="icon ion-social-google me-1" />Google로 로그인
                  </a>
                )}
                {providers.includes('kakao') && (
                  <a href="/auth/kakao" className="btn btn-sm btn-warning">
                    <i className="icon ion-social-buffer me-1" />Kakao로 로그인
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* AdSense 배너 */}
        <AdBanner slot={window.__ADSENSE_LOBBY_SLOT__} className="mb-3" />

        <div className="row g-3">
          {/* 방 목록 */}
          <div className="col-lg-6">
            <div className="card game-card">
              <div className="card-header d-flex justify-content-between align-items-center">
                <h5 className="card-title mb-0">
                  <i className="icon ion-ios-people me-2" />게임 방 목록
                </h5>
                <div className="d-flex gap-2">
                  <button className="btn btn-sm btn-outline-secondary" onClick={handleRefresh}>
                    <i className="icon ion-refresh" />
                  </button>
                  <button
                    className="btn btn-sm btn-primary"
                    data-bs-toggle="modal"
                    data-bs-target="#modal_createRoom"
                  >
                    <i className="icon ion-plus me-1" />방 만들기
                  </button>
                </div>
              </div>
              <div className="card-body p-0">
                <RoomList />
              </div>
            </div>
          </div>

          {/* RetentionTabs (랭킹/업적/미션/꾸미기) */}
          <div className="col-lg-6">
            <RetentionTabs />
          </div>
        </div>
      </div>

      {/* 방 만들기 모달 */}
      <div className="modal fade" id="modal_createRoom" tabIndex="-1" ref={modalRef}>
        <div className="modal-dialog modal-dialog-centered">
          <div className="modal-content">
            <div className="modal-header">
              <h5 className="modal-title">방 만들기</h5>
              <button type="button" className="btn-close" data-bs-dismiss="modal" />
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
                <button type="button" className="btn btn-secondary" data-bs-dismiss="modal">취소</button>
                <button type="submit" className="btn btn-primary">방 만들기</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
