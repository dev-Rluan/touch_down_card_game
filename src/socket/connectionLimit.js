/**
 * IP당 동시 Socket.IO 연결 수 제한.
 *
 * 클라이언트 IP: 리버스 프록시(Koyeb, Caddy) 뒤에서는 X-Forwarded-For 의 **마지막** 값이
 * 우리 프록시가 직접 본 주소다 (앞쪽 값은 클라이언트가 마음대로 넣을 수 있으므로 쓰지 않는다).
 * 프록시가 없으면 소켓의 실제 주소를 쓴다.
 * 같은 와이파이·PC방처럼 한 IP 를 여럿이 쓰는 경우를 고려해 기본 10개로 넉넉하게 둔다 (MAX_CONN_PER_IP).
 * MAX_CONN_PER_IP=0 이면 끈다 (프록시가 X-Forwarded-For 를 넣지 않아 모두가 같은 IP 로 보이는 환경 대비).
 */
function clientIp(socket) {
  const xff = socket.handshake.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.trim()) {
    const parts = xff.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length) return parts[parts.length - 1];
  }
  return socket.handshake.address || 'unknown';
}

module.exports = function connectionLimit(io, { maxPerIp = 10 } = {}) {
  const counts = new Map(); // ip -> 연결 수
  if (!(maxPerIp > 0)) return { clientIp, _counts: counts };
  io.use((socket, next) => {
    const ip = clientIp(socket);
    const n = counts.get(ip) || 0;
    if (n >= maxPerIp) {
      const err = new Error('같은 곳에서 너무 많이 접속했습니다. 다른 탭을 닫고 다시 시도하세요.');
      err.data = { code: 'TOO_MANY_CONNECTIONS' };
      return next(err);
    }
    counts.set(ip, n + 1);
    socket.on('disconnect', () => {
      const left = (counts.get(ip) || 1) - 1;
      if (left <= 0) counts.delete(ip); else counts.set(ip, left);
    });
    next();
  });
  return { clientIp, _counts: counts };
};

module.exports.clientIp = clientIp;
