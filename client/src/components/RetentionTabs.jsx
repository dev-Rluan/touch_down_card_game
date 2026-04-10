import React, { useState } from 'react';
import useRetention from '../hooks/useRetention.js';
import useCosmetics from '../hooks/useCosmetics.js';
import useShop from '../hooks/useShop.js';
import { useGame } from '../context/GameContext.jsx';

const MEDAL = ['🥇', '🥈', '🥉'];

function LeaderboardPanel() {
  const { leaderboard, myRank, period, setPeriod, rankType, setRankType, loading } = useRetention();

  return (
    <div>
      <div className="d-flex gap-2 mb-3 flex-wrap">
        <select className="form-select form-select-sm" style={{ width: 'auto' }} value={period} onChange={e => setPeriod(e.target.value)}>
          <option value="alltime">전체</option>
          <option value="weekly">이번 주</option>
          <option value="monthly">이번 달</option>
        </select>
        <select className="form-select form-select-sm" style={{ width: 'auto' }} value={rankType} onChange={e => setRankType(e.target.value)}>
          <option value="score">점수</option>
          <option value="wins">승리수</option>
        </select>
      </div>

      {myRank && (
        <div className="alert alert-info py-2 mb-2 small">
          내 순위: <strong>{myRank.rank ? `${myRank.rank}위` : '순위 없음'}</strong>
          {' · '}점수: <strong>{myRank.score}</strong>
        </div>
      )}

      {loading ? (
        <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>
      ) : (
        <div className="list-group list-group-flush">
          {leaderboard.map((entry, i) => (
            <div key={entry.accountId} className="list-group-item py-2 px-0">
              <div className="d-flex align-items-center gap-2">
                <span style={{ width: 28, textAlign: 'center', fontSize: '1.1rem' }}>
                  {i < 3 ? MEDAL[i] : <span className="text-muted small">#{entry.rank}</span>}
                </span>
                {entry.avatar
                  ? <img src={entry.avatar} className="rounded-circle" width="28" height="28" style={{ objectFit: 'cover' }} alt="" />
                  : <span className="navbar-avatar" style={{ width: 28, height: 28, fontSize: '0.8rem' }}>{entry.displayName.charAt(0)}</span>
                }
                <span className="flex-grow-1 small fw-semibold">{entry.displayName}</span>
                <span className="badge bg-primary">{entry.score}</span>
              </div>
            </div>
          ))}
          {leaderboard.length === 0 && (
            <div className="text-muted text-center py-3 small">랭킹 데이터가 없습니다.</div>
          )}
        </div>
      )}
    </div>
  );
}

function AchievementsPanel() {
  const { achievements, loading } = useRetention();

  if (loading) return <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>;

  return (
    <div className="row g-2">
      {achievements.map(a => (
        <div key={a.id} className="col-12">
          <div className={`achievement-card ${a.unlocked ? 'unlocked' : 'locked'}`}>
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: '1.5rem' }}>{a.icon || '🏆'}</span>
              <div className="flex-grow-1">
                <div className="fw-semibold small">{a.title}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{a.description}</div>
                {a.progress !== undefined && (
                  <div className="progress mt-1" style={{ height: 4 }}>
                    <div className="progress-bar" style={{ width: `${Math.min(100, (a.progress / a.target) * 100)}%` }} />
                  </div>
                )}
              </div>
              {a.unlocked && <i className="icon ion-checkmark-circle text-success" />}
            </div>
          </div>
        </div>
      ))}
      {achievements.length === 0 && (
        <div className="col-12 text-muted text-center py-3 small">업적이 없습니다.</div>
      )}
    </div>
  );
}

function MissionsPanel() {
  const { missions, loading } = useRetention();

  if (loading) return <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>;

  return (
    <div className="row g-2">
      {missions.map(m => (
        <div key={m.id} className="col-12">
          <div className={`mission-card ${m.completed ? 'completed' : ''}`}>
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: '1.3rem' }}>{m.icon || '📋'}</span>
              <div className="flex-grow-1">
                <div className="fw-semibold small">{m.title}</div>
                <div className="text-muted" style={{ fontSize: '0.75rem' }}>{m.description}</div>
                {m.progress !== undefined && (
                  <div className="progress mt-1" style={{ height: 4 }}>
                    <div className="progress-bar bg-success" style={{ width: `${Math.min(100, (m.progress / m.target) * 100)}%` }} />
                  </div>
                )}
              </div>
              {m.completed
                ? <span className="badge bg-success">완료</span>
                : <span className="badge bg-secondary">{m.progress || 0}/{m.target}</span>
              }
            </div>
          </div>
        </div>
      ))}
      {missions.length === 0 && (
        <div className="col-12 text-muted text-center py-3 small">오늘의 미션이 없습니다.</div>
      )}
    </div>
  );
}

function CosmeticsPanel() {
  const { state } = useGame();
  const { cosmetics, equip, loading } = useCosmetics();
  const { items: shopItems, purchase } = useShop();

  if (!state.account) {
    return (
      <div className="text-center py-4">
        <i className="icon ion-locked text-muted" style={{ fontSize: '2rem' }} />
        <p className="text-muted mt-2 small">꾸미기 기능은 로그인 후 이용 가능합니다.</p>
      </div>
    );
  }

  if (loading) return <div className="text-center py-3"><div className="spinner-border spinner-border-sm" /></div>;

  const catalog = cosmetics?.catalog || [];
  const owned = cosmetics?.owned || [];
  const equipped = cosmetics?.equipped || {};

  function isOwned(itemId) {
    return owned.includes(itemId) || itemId === 'card-default' || itemId === 'bell-gold';
  }

  function isEquipped(type, itemId) {
    return equipped[type] === itemId;
  }

  const cardSkins = catalog.filter(c => c.type === 'card');
  const bellSkins = catalog.filter(c => c.type === 'bell');

  return (
    <div>
      <h6 className="small fw-bold text-muted mb-2">카드 뒷면 스킨</h6>
      <div className="d-flex flex-wrap gap-2 mb-3">
        {cardSkins.map(item => {
          const owned_ = isOwned(item.id);
          const equipped_ = isEquipped('card', item.id);
          const shopItem = shopItems.find(s => s.skinId === item.id);
          return (
            <div key={item.id} className={`cosmetic-item ${equipped_ ? 'equipped' : ''} ${!owned_ ? 'locked' : ''}`}>
              <div className={`cosmetic-preview card-skin-preview ${item.cssClass}`} />
              <div className="cosmetic-name small">{item.name}</div>
              {owned_ ? (
                <button
                  className={`btn btn-xs ${equipped_ ? 'btn-success' : 'btn-outline-primary'}`}
                  onClick={() => !equipped_ && equip('card', item.id)}
                  disabled={equipped_}
                >
                  {equipped_ ? '장착중' : '장착'}
                </button>
              ) : shopItem ? (
                <button className="btn btn-xs btn-warning" onClick={() => purchase(shopItem.id)}>
                  {shopItem.price.toLocaleString()}원
                </button>
              ) : (
                <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>업적 해금</span>
              )}
            </div>
          );
        })}
      </div>

      <h6 className="small fw-bold text-muted mb-2">벨 스킨</h6>
      <div className="d-flex flex-wrap gap-2">
        {bellSkins.map(item => {
          const owned_ = isOwned(item.id);
          const equipped_ = isEquipped('bell', item.id);
          const shopItem = shopItems.find(s => s.skinId === item.id);
          return (
            <div key={item.id} className={`cosmetic-item ${equipped_ ? 'equipped' : ''} ${!owned_ ? 'locked' : ''}`}>
              <div className={`cosmetic-preview bell-skin-preview ${item.cssClass}`}>
                <i className="icon ion-ios-bell" />
              </div>
              <div className="cosmetic-name small">{item.name}</div>
              {owned_ ? (
                <button
                  className={`btn btn-xs ${equipped_ ? 'btn-success' : 'btn-outline-primary'}`}
                  onClick={() => !equipped_ && equip('bell', item.id)}
                  disabled={equipped_}
                >
                  {equipped_ ? '장착중' : '장착'}
                </button>
              ) : shopItem ? (
                <button className="btn btn-xs btn-warning" onClick={() => purchase(shopItem.id)}>
                  {shopItem.price.toLocaleString()}원
                </button>
              ) : (
                <span className="badge bg-secondary" style={{ fontSize: '0.65rem' }}>업적 해금</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const TABS = [
  { id: 'leaderboard', label: '🏆 랭킹', Component: LeaderboardPanel },
  { id: 'achievements', label: '🎖 업적', Component: AchievementsPanel },
  { id: 'missions', label: '📋 미션', Component: MissionsPanel },
  { id: 'cosmetics', label: '🎨 꾸미기', Component: CosmeticsPanel },
];

export default function RetentionTabs() {
  const [active, setActive] = useState('leaderboard');
  const tab = TABS.find(t => t.id === active);
  const { Component } = tab || {};

  return (
    <div className="card border-0" style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '1rem' }}>
      <div className="card-header" style={{ background: 'transparent', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <ul className="nav nav-tabs card-header-tabs flex-nowrap" style={{ overflowX: 'auto', borderBottom: 'none' }}>
          {TABS.map(t => (
            <li key={t.id} className="nav-item flex-shrink-0">
              <button
                className={`nav-link ${active === t.id ? 'active' : 'text-light'}`}
                onClick={() => setActive(t.id)}
                style={{ whiteSpace: 'nowrap', fontSize: '0.85rem' }}
              >
                {t.label}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="card-body" style={{ maxHeight: 320, overflowY: 'auto' }}>
        {Component && <Component />}
      </div>
    </div>
  );
}
