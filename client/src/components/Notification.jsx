import React, { useEffect } from 'react';

const TYPE_CLASS = {
  success: 'alert-success',
  error: 'alert-danger',
  warning: 'alert-warning',
  info: 'alert-info',
};

const AUTO_DISMISS_MS = { error: 4000, warning: 3500 };

export function Notification({ message, type = 'info', onClose }) {
  // 알림마다 독립된 타이머로 자동 닫기
  useEffect(() => {
    const timer = setTimeout(onClose, AUTO_DISMISS_MS[type] || 3000);
    return () => clearTimeout(timer);
  }, [onClose, type]);

  return (
    <div
      className={`alert ${TYPE_CLASS[type] || 'alert-info'} alert-dismissible fade show toast-notification`}
      role={type === 'error' ? 'alert' : 'status'}
    >
      {message}
      <button type="button" className="btn-close" aria-label="닫기" onClick={onClose} />
    </div>
  );
}

export default function NotificationStack({ items, onClose }) {
  if (!items.length) return null;
  return (
    <div className="toast-stack" aria-live="polite">
      {items.map(n => (
        <NotificationItem key={n.id} item={n} onClose={onClose} />
      ))}
    </div>
  );
}

function NotificationItem({ item, onClose }) {
  const handleClose = React.useCallback(() => onClose(item.id), [onClose, item.id]);
  return <Notification message={item.message} type={item.type} onClose={handleClose} />;
}
