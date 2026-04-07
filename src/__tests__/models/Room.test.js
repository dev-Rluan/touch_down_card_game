const Room = require('../../models/Room');

const makeUser = (id, name, isManager = false) => ({
  id,
  name,
  manager: isManager,
  cardPack: [],
  score: 0,
  readyStatus: 'waiting',
  isActive: false,
});

describe('Room 모델', () => {
  let room;

  beforeEach(() => {
    room = new Room('room-1', '테스트방', 4);
  });

  test('초기 상태가 올바르다', () => {
    expect(room.id).toBe('room-1');
    expect(room.name).toBe('테스트방');
    expect(room.maxUserCount).toBe(4);
    expect(room.users).toEqual([]);
    expect(room.status).toBe('waiting');
    expect(room.game).toBeNull();
  });

  describe('addUser', () => {
    test('유저를 추가한다', () => {
      const user = makeUser('u1', '플레이어1');
      room.addUser(user);
      expect(room.users).toHaveLength(1);
      expect(room.users[0].id).toBe('u1');
    });

    test('최대 인원 초과 시 에러를 던진다', () => {
      for (let i = 0; i < 4; i++) {
        room.addUser(makeUser(`u${i}`, `플레이어${i}`));
      }
      expect(() => room.addUser(makeUser('u5', '플레이어5'))).toThrow('Room is full');
    });
  });

  describe('removeUser', () => {
    test('ID로 유저를 제거한다', () => {
      room.addUser(makeUser('u1', '플레이어1'));
      room.addUser(makeUser('u2', '플레이어2'));
      room.removeUser('u1');
      expect(room.users).toHaveLength(1);
      expect(room.users[0].id).toBe('u2');
    });

    test('존재하지 않는 ID를 제거해도 에러가 발생하지 않는다', () => {
      room.addUser(makeUser('u1', '플레이어1'));
      expect(() => room.removeUser('없는ID')).not.toThrow();
      expect(room.users).toHaveLength(1);
    });
  });

  describe('findUser', () => {
    test('ID로 유저를 찾는다', () => {
      const user = makeUser('u1', '플레이어1');
      room.addUser(user);
      expect(room.findUser('u1')).toBe(user);
    });

    test('없는 유저는 undefined를 반환한다', () => {
      expect(room.findUser('없는ID')).toBeUndefined();
    });
  });

  describe('assignManagerIfNone', () => {
    test('방장이 없을 때 첫 번째 유저를 방장으로 지정한다', () => {
      room.addUser(makeUser('u1', '플레이어1', false));
      room.addUser(makeUser('u2', '플레이어2', false));
      room.assignManagerIfNone();
      expect(room.users[0].manager).toBe(true);
      expect(room.users[1].manager).toBe(false);
    });

    test('이미 방장이 있으면 변경하지 않는다', () => {
      room.addUser(makeUser('u1', '플레이어1', false));
      room.addUser(makeUser('u2', '플레이어2', true));
      room.assignManagerIfNone();
      expect(room.users[0].manager).toBe(false);
      expect(room.users[1].manager).toBe(true);
    });

    test('유저가 없으면 아무 것도 하지 않는다', () => {
      expect(() => room.assignManagerIfNone()).not.toThrow();
    });
  });

  describe('setStatus', () => {
    test('상태를 변경한다', () => {
      room.setStatus('playing');
      expect(room.status).toBe('playing');
      room.setStatus('finished');
      expect(room.status).toBe('finished');
    });
  });
});
