import React, { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext.jsx';
import Icon from './Icon.jsx';

const CATEGORIES = [
  { id: 'bug', label: '버그 신고' },
  { id: 'idea', label: '기능 제안' },
  { id: 'etc', label: '기타 의견' },
];
const MAX_LENGTH = 1000;

// 로비 하단의 "피드백 보내기" 버튼 + 작성 모달. 결과는 서버 ack 로 받는다.
export default function FeedbackButton() {
  const { emit } = useGame();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('idea');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    function onKey(e) { if (e.key === 'Escape') setOpen(false); }
    document.addEventListener('keydown', onKey);
    document.body.classList.add('modal-open');
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('modal-open');
    };
  }, [open]);

  function openModal() {
    setStatus('idle');
    setError('');
    setOpen(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (status === 'sending' || text.trim().length < 2) return;
    setStatus('sending');
    setError('');
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      setStatus('error');
      setError('서버 응답이 없습니다. 잠시 후 다시 시도해 주세요.');
    }, 8000);
    emit('sendFeedback', { category, text }, (res) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (res?.ok) {
        setStatus('done');
        setText('');
      } else {
        setStatus('error');
        setError(res?.error || '보내지 못했습니다.');
      }
    });
  }

  return (
    <>
      <div className="feedback-entry">
        <span>불편한 점이나 바라는 기능이 있나요?</span>
        <button className="btn btn-sm btn-outline-light" onClick={openModal}>
          <Icon name="chat" className="me-1" />피드백 보내기
        </button>
      </div>

      {open && (
        <>
          <div
            className="modal fade show d-block"
            tabIndex="-1"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedbackTitle"
            onMouseDown={e => { if (e.target === e.currentTarget) setOpen(false); }}
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content">
                <div className="modal-header">
                  <h5 className="modal-title" id="feedbackTitle">피드백 보내기</h5>
                  <button type="button" className="btn-close" aria-label="닫기" onClick={() => setOpen(false)} />
                </div>

                {status === 'done' ? (
                  <>
                    <div className="modal-body text-center py-4">
                      <div className="feedback-thanks">감사합니다!</div>
                      <div className="text-muted small mt-1">보내주신 의견은 꼼꼼히 읽고 반영할게요.</div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setStatus('idle')}>하나 더 보내기</button>
                      <button type="button" className="btn btn-primary" onClick={() => setOpen(false)}>닫기</button>
                    </div>
                  </>
                ) : (
                  <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                      <div className="feedback-cats mb-3" role="radiogroup" aria-label="종류">
                        {CATEGORIES.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            role="radio"
                            aria-checked={category === c.id}
                            className={`feedback-cat ${category === c.id ? 'active' : ''}`}
                            onClick={() => setCategory(c.id)}
                          >
                            {c.label}
                          </button>
                        ))}
                      </div>
                      <textarea
                        className="form-control"
                        style={{ fontSize: 16 }}
                        rows={5}
                        value={text}
                        onChange={e => setText(e.target.value)}
                        maxLength={MAX_LENGTH}
                        placeholder={category === 'bug'
                          ? '어떤 상황에서 문제가 생겼는지 알려주세요. (예: 4명 게임 중 벨을 눌렀는데…)'
                          : '자유롭게 적어 주세요.'}
                        autoFocus
                        required
                        aria-label="피드백 내용"
                      />
                      <div className="d-flex justify-content-between mt-1 small">
                        <span className="text-danger" role="alert">{error}</span>
                        <span className="text-muted">{text.length}/{MAX_LENGTH}</span>
                      </div>
                    </div>
                    <div className="modal-footer">
                      <button type="button" className="btn btn-secondary" onClick={() => setOpen(false)}>취소</button>
                      <button type="submit" className="btn btn-primary" disabled={status === 'sending' || text.trim().length < 2}>
                        {status === 'sending' ? '보내는 중…' : '보내기'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
          <div className="modal-backdrop fade show" />
        </>
      )}
    </>
  );
}
