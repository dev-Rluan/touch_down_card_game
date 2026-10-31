import React from 'react';

const FRUIT_LABELS = {
  strawberry: '딸기',
  banana: '바나나',
  plum: '포도',
  lemon: '레몬',
};

export default function CardFace({ fruit, count }) {
  const label = `${FRUIT_LABELS[fruit]} ${count}${fruit === 'plum' ? '송이' : '개'}`;

  return (
    <div className="card-face" data-fruit={fruit} data-count={count} role="img" aria-label={label}>
      <span className="card-corner" aria-hidden="true">{count}</span>
      <div className={`card-fruits card-fruits-${count}`} aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <img
            key={i}
            className="card-fruit"
            src={`/public/brand/fruits/${fruit}.png`}
            alt=""
            aria-hidden="true"
            draggable={false}
          />
        ))}
      </div>
    </div>
  );
}
