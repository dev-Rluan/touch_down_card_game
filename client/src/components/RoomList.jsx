import React from 'react';
import { useGame } from '../context/GameContext.jsx';

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
        <i className="icon ion-ios-people text-muted" style={{ fontSize: '3rem' }} />
        <h6 className="text-muted mt-2">현재 생성된 방이 없습니다</h6>
        <p className="text-muted small">새로운 방을 만들어보세요!</p>
        <button className="btn btn-sm btn-outline-secondary" onClick={handleRefresh}>
          <i className="icon ion-refresh me-1" />새로고침
        </button>
      </div>
    );
  }

  return (
    <div className="list-group list-group-flush">
      {roomList.map(room => {
        const count = room.userCount ?? room.users?.length ?? 0;
        const isFull = count >= room.maxUserCnt;
        return (
        <div key={room.id} className="list-group-item">
          <div className="d-flex justify-content-between align-items-center">
            <div className="d-flex align-items-center">
              <div className="me-3">
                <span className={`badge ${isFull ? 'bg-secondary' : 'bg-primary'}`}>{count}/{room.maxUserCnt}</span>
              </div>
              <div>
                <h6 className="mb-1">{room.name}</h6>
                <small className="text-muted">{isFull ? '인원이 가득 찼습니다' : `${count}명 참여 중`}</small>
              </div>
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={() => handleJoin(room.id)}
              disabled={isFull}
            >
              <i className="icon ion-log-in me-1" />{isFull ? '만원' : '입장'}
            </button>
          </div>
        </div>
        );
      })}
    </div>
  );
}
