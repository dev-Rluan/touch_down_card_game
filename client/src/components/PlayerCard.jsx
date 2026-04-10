import React from 'react';

const STATUS_LABEL = { ready: '준비완료', playing: '게임중', waiting: '대기중' };
const STATUS_CLASS = { ready: 'status-ready', playing: 'status-playing', waiting: 'status-waiting' };

export default function PlayerCard({ player, isMe = false, cardCount = null }) {
  const status = player.readyStatus || 'waiting';
  return (
    <div className={`player-card ${status} ${player.manager ? 'manager' : ''} ${isMe ? 'is-me' : ''}`}>
      <div className="player-info">
        <div className="player-avatar">
          {player.name ? player.name.charAt(0).toUpperCase() : '?'}
        </div>
        <div className="player-details">
          <h6>
            {player.name}
            {isMe && <span className="badge bg-info ms-1" style={{ fontSize: '0.65rem' }}>나</span>}
          </h6>
          <div className="player-status">
            <span className={`status-badge ${STATUS_CLASS[status] || 'status-waiting'}`}>
              {STATUS_LABEL[status] || '대기중'}
            </span>
            {player.manager && <span className="badge bg-warning ms-1">방장</span>}
          </div>
        </div>
        {cardCount !== null && (
          <div className="ms-auto">
            <span className="badge bg-primary">🃏 {cardCount}장</span>
          </div>
        )}
      </div>
    </div>
  );
}
