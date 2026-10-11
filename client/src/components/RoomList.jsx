import React from 'react';
import { useGame } from '../context/GameContext.jsx';
import Icon from './Icon.jsx';

export default function RoomList() {
  const { state, emit } = useGame();
  const { roomList } = state;

  function handleJoin(roomId) {
    emit('joinRoom', roomId);
  }

  function handleRefresh() {
    emit('roomList');
  }

  if (!roomList || roomList.length === 0) {
    return (
      <div className="text-center py-4">
        <Icon name="people" size="3rem" className="text-muted" />
        <h6 className="text-muted mt-2">현재 생성된 방이 없습니다</h6>
        <p className="text-muted small">새로운 방을 만들어보세요!</p>
        <button className="btn btn-sm btn-outline-secondary" onClick={handleRefresh}>
          <Icon name="refresh" className="me-1" />새로고침
        </button>
      </div>
    );
  }

  return (
    <div className="list-group list-group-flush">
      {roomList.map(room => (
        <div key={room.id} className="list-group-item">
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center">
              <div className="me-3">
                <span className="badge bg-primary">{room.users.length}/{room.maxUserCnt}</span>
              </div>
              <div>
                <h6 className="mb-1">{room.name}</h6>
                <small className="text-muted">{room.users.length}명 참여 중</small>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleJoin(room.id)}
              disabled={room.users.length >= room.maxUserCnt}
            >
              <Icon name="log-in" className="me-1" />입장
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
