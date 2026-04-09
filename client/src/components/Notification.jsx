import React from 'react';

const TYPE_CLASS = {
  success: 'alert-success',
  error: 'alert-danger',
  warning: 'alert-warning',
  info: 'alert-info',
};

export default function Notification({ message, type = 'info', onClose }) {
  return (
    <div
      className={`alert ${TYPE_CLASS[type] || 'alert-info'} alert-dismissible fade show position-fixed`}
      style={{ top: 20, right: 20, zIndex: 9999, minWidth: 280, maxWidth: 400 }}
      role="alert"
    >
      {message}
      <button type="button" className="btn-close" onClick={onClose} />
    </div>
  );
}
