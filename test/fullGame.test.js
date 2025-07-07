// 전체 게임 기능 통합 테스트
const Room = require('../src/models/Room');
const User = require('../src/models/User');
const Card = require('../src/models/Card');
const gameService = require('../src/services/gameService');

describe('할리갈리 게임 전체 기능 통합 테스트', () => {
  let room, user1, user2;

  beforeEach(() => {
    // 방, 유저 초기화
    room = new Room('room1', '테스트방', 4);
    user1 = new User('u1', 's1', '철수');
    user2 = new User('u2', 's2', '영희');
    room.addUser(user1);
    room.addUser(user2);
    // roomService mocking
    jest.spyOn(require('../src/services/roomService'), 'findRoom').mockImplementation((id) => id === 'room1' ? room : null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('유저 레디 및 전체 레디 확인', async () => {
    await gameService.userReady('s1', 'room1');
    await gameService.userReady('s2', 'room1');
    expect(gameService.checkAllReady(room)).toBe(true);
  });

  test('게임 시작 및 카드 분배', async () => {
    await gameService.userReady('s1', 'room1');
    await gameService.userReady('s2', 'room1');
    const result = await gameService.startGame('room1');
    expect(result.users.length).toBe(2);
    expect(room.game.status).toBe('playing');
    expect(room.users[0].cardPack.length).toBeGreaterThan(0);
  });

  test('턴 진행(카드 뒤집기)', async () => {
    await gameService.userReady('s1', 'room1');
    await gameService.userReady('s2', 'room1');
    await gameService.startGame('room1');
    const turnResult = await gameService.playTurn('s1', 'room1');
    expect(turnResult.fieldCards.length).toBeGreaterThanOrEqual(0);
    expect(typeof turnResult.turnIndex).toBe('number');
  });

  test('종 치기(ringBell) 및 처리', async () => {
    await gameService.userReady('s1', 'room1');
    await gameService.userReady('s2', 'room1');
    await gameService.startGame('room1');
    // 필드에 카드가 깔려있다고 가정하고 종 치기
    room.game.fieldCards = [new Card('banana', 5), new Card('banana', 5)];
    const bellResult = await gameService.ringBell('s1', 'room1');
    expect(bellResult.success).toBe(true);
    expect(bellResult.userId).toBe('u1');
  });

  test('게임 종료 및 승자 판정', async () => {
    await gameService.userReady('s1', 'room1');
    await gameService.userReady('s2', 'room1');
    await gameService.startGame('room1');
    // 카드 수 조작(철수 승리)
    user1.cardPack = [new Card('banana', 5), new Card('lemon', 3)];
    user2.cardPack = [];
    const endResult = await gameService.endGame('room1');
    expect(endResult.winner.id).toBe('u1');
    expect(endResult.users.length).toBe(2);
  });
}); 