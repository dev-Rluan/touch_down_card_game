// 서버 시계 맞추기 + 내 핑 측정 (벨 시간 보정 1단계)
//
// 3초마다 timeSync 를 보내 서버 시각(Ts)을 받는다.
//   RTT    = 받은 시각 − 보낸 시각
//   offset = Ts − (보낸 시각 + RTT/2)        → 서버 시각 ≈ (performance.timeOrigin + performance.now()) + offset
// 지연이 튄 측정은 오차가 크므로 최근 10개 중 RTT 가 가장 작은 측정의 offset 을 쓴다.
// 핑 표시는 최근 값들의 중앙값 (페이지 로딩 중 첫 측정처럼 튄 값에 흔들리지 않게).
const INTERVAL_MS = 3000;
const MAX_SAMPLES = 10;

let samples = [];        // [{ rtt, offset }]
let ping = null;         // 표시용 RTT 중앙값 (ms)
let offset = 0;          // 서버 시각 − 내 시각 (ms)
let timer = null;
let active = false;      // 대기실·게임 화면에서만 3초마다, 그 외(로비)에는 15초마다
let tick = 0;
let sock = null;
const listeners = new Set();

function notify() {
  listeners.forEach(fn => fn(ping));
}

function measure(socket) {
  if (!socket.connected) return;
  // 시각은 모두 performance 기준(timeOrigin + now)으로 잰다 — 이벤트 timeStamp 와 같은 기준이고 시스템 시계 조정에 흔들리지 않는다
  const sentMono = performance.now();
  const sentWall = performance.timeOrigin + sentMono;
  socket.timeout(2000).emit('timeSync', (err, serverTs) => {
    if (err || typeof serverTs !== 'number') return;
    const rtt = performance.now() - sentMono;
    samples.push({ rtt, offset: serverTs - (sentWall + rtt / 2) });
    if (samples.length > MAX_SAMPLES) samples.shift();
    offset = samples.reduce((best, s) => (s.rtt < best.rtt ? s : best)).offset;
    const sorted = samples.map(x => x.rtt).sort((a, b) => a - b);
    ping = sorted[Math.floor(sorted.length / 2)];
    notify();
  });
}

/** 소켓 연결 후 호출. 반환된 함수로 정리 */
export function startClockSync(socket) {
  sock = socket;
  // 서버가 재는 지연 측정에 바로 응답
  const onPing = (_ts, ack) => { if (typeof ack === 'function') ack(); };
  socket.on('latencyPing', onPing);

  const kick = () => {
    samples = [];
    measure(socket);
  };
  socket.on('connect', kick);
  if (socket.connected) kick();
  clearInterval(timer);
  timer = setInterval(() => { if (active || tick++ % 5 === 0) measure(socket); }, INTERVAL_MS);

  return () => {
    clearInterval(timer);
    socket.off('latencyPing', onPing);
    socket.off('connect', kick);
  };
}

/** 대기실·게임 화면에 있는지 (자주 측정할지) */
export function setClockActive(on) {
  const wasActive = active;
  active = Boolean(on);
  // 대기실·게임에 들어온 순간 바로 한 번 재서 표시와 시계 차이를 최신으로
  if (active && !wasActive && sock) measure(sock);
}

/** 내 왕복 지연(ms, 반올림). 아직 측정 전이면 null */
export function getPing() {
  return ping == null ? null : Math.round(ping);
}

/** 서버 시계 기준 현재 시각 */
export function serverNow() {
  return performance.timeOrigin + performance.now() + offset;
}

/** 이벤트의 timeStamp(performance.now 기준)를 서버 시계 기준 시각으로 */
export function toServerTime(perfTimestamp) {
  return performance.timeOrigin + perfTimestamp + offset;
}

export function subscribePing(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
