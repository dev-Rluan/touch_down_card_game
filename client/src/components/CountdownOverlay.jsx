import React from 'react';

export default function CountdownOverlay({ value, sub }) {
  if (value === null || value === undefined) return null;

  return (
    <div className="countdown-overlay">
      <div className={`countdown-number ${value === 'GO!' ? 'go' : ''}`}>
        {value}
      </div>
      {sub && <div className="countdown-sub">{sub}</div>}
    </div>
  );
}
