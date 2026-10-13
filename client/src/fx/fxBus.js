// 게임 이벤트를 이펙트/효과음 쪽에 알리는 작은 발행-구독 채널.
// 소켓 이벤트가 상태(reducer)에 반영되기 "전에" 발행해서, 사라지기 직전의 화면 위치(카드 더미 등)를 측정할 수 있게 한다.
const listeners = new Set();

export function emitFx(type, detail) {
  listeners.forEach(fn => {
    try {
      fn(type, detail);
    } catch (e) {
      console.error('[fx]', e);
    }
  });
}

export function onFx(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
