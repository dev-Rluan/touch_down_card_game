import React, { useState, useEffect, useRef } from 'react';
import { useGame } from '../context/GameContext.jsx';
import Icon from './Icon.jsx';

const MAX_LENGTH = 200;

/**
 * 같은 방 플레이어끼리의 채팅.
 *  - variant="inline": 대기실/결과 화면에 붙여 쓰는 패널
 *  - variant="sheet" : 게임 화면에서 아래에서 올라오는 시트 (onClose 로 닫기)
 * 패널이 화면에 보이는 동안은 "읽는 중"으로 보고 안 읽은 메시지 수를 0 으로 유지한다.
 * 메시지는 React 가 텍스트로 렌더링하므로 HTML 이 실행되지 않는다.
 */
export default function ChatPanel({ variant = 'inline', onClose }) {
  const { state, emit, dispatch } = useGame();
  const { chat, mySocketId } = state;
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    dispatch({ type: 'CHAT_OPEN' });
    return () => dispatch({ type: 'CHAT_CLOSE' });
  }, [dispatch]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat.length]);

  useEffect(() => {
    if (variant !== 'sheet' || !onClose) return;
    function onKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [variant, onClose]);

  function submit(e) {
    e.preventDefault();
    const value = text.trim();
    if (!value) return;
    emit('chat message', value);
    setText('');
  }

  const panel = (
    <div className={`chat-panel chat-${variant}`}>
      {variant === 'sheet' && (
        <div className="chat-header">
          <span className="fw-bold">채팅</span>
          <button type="button" className="btn-close btn-close-white" aria-label="채팅 닫기" onClick={onClose} />
        </div>
      )}

      <div className="chat-list" ref={listRef} role="log" aria-live="polite">
        {chat.length === 0 ? (
          <div className="chat-empty">아직 메시지가 없습니다.</div>
        ) : (
          chat.map((m, i) => {
            const mine = m.userId === mySocketId;
            return (
              <div key={`${m.ts}-${i}`} className={`chat-msg ${mine ? 'mine' : ''}`}>
                {!mine && <span className="chat-name">{m.name}</span>}
                <span className="chat-bubble">{m.text}</span>
              </div>
            );
          })
        )}
      </div>

      <form className="chat-form" onSubmit={submit}>
        <input
          className="form-control"
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="메시지 입력"
          maxLength={MAX_LENGTH}
          enterKeyHint="send"
          autoComplete="off"
          aria-label="채팅 메시지"
        />
        <button type="submit" className="btn btn-primary chat-send" aria-label="보내기" disabled={!text.trim()}>
          <Icon name="send" />
        </button>
      </form>
    </div>
  );

  if (variant === 'sheet') {
    return (
      <>
        <div className="chat-backdrop" onMouseDown={onClose} />
        {panel}
      </>
    );
  }
  return panel;
}
