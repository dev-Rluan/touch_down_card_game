const {
  createDeck,
  shuffleCards,
  dealCards,
  calculateCardSum,
  checkHalliGalli,
  generateCardId,
  getCardInfo,
} = require('../../utils/CardUtils');
const Card = require('../../models/Card');

describe('CardUtils', () => {
  describe('createDeck', () => {
    test('56장의 카드를 생성한다', () => {
      const deck = createDeck();
      // 4 과일 × (5+3+3+2+1) = 4 × 14 = 56
      expect(deck).toHaveLength(56);
    });

    test('모든 카드가 Card 인스턴스다', () => {
      const deck = createDeck();
      deck.forEach(card => expect(card).toBeInstanceOf(Card));
    });

    test('4가지 과일이 각각 14장씩 있다', () => {
      const deck = createDeck();
      const fruits = ['strawberry', 'banana', 'plum', 'lemon'];
      fruits.forEach(fruit => {
        const count = deck.filter(c => c.fruit === fruit).length;
        expect(count).toBe(14);
      });
    });

    test('count 분포가 올바르다 (과일당 5,3,3,2,1장)', () => {
      const deck = createDeck();
      const fruits = ['strawberry', 'banana', 'plum', 'lemon'];
      const expectedDist = { 1: 5, 2: 3, 3: 3, 4: 2, 5: 1 };

      fruits.forEach(fruit => {
        const fruitCards = deck.filter(c => c.fruit === fruit);
        Object.entries(expectedDist).forEach(([count, qty]) => {
          const actual = fruitCards.filter(c => c.count === Number(count)).length;
          expect(actual).toBe(qty);
        });
      });
    });
  });

  describe('shuffleCards', () => {
    test('카드 수가 변하지 않는다', () => {
      const deck = createDeck();
      const shuffled = shuffleCards([...deck]);
      expect(shuffled).toHaveLength(deck.length);
    });

    test('인자 없이 호출하면 새 덱을 셔플한다', () => {
      const shuffled = shuffleCards();
      expect(shuffled).toHaveLength(56);
    });

    test('셔플 후 같은 카드들을 포함한다', () => {
      const deck = createDeck();
      const shuffled = shuffleCards([...deck]);
      const sortFn = (a, b) => `${a.fruit}${a.count}`.localeCompare(`${b.fruit}${b.count}`);
      expect(shuffled.sort(sortFn)).toEqual(deck.sort(sortFn));
    });
  });

  describe('dealCards', () => {
    const makePlayers = (n) =>
      Array.from({ length: n }, (_, i) => ({ id: `p${i}` }));

    test('모든 카드가 분배된다', () => {
      const players = makePlayers(2);
      const deck = createDeck();
      const result = dealCards(players, deck);
      const totalDealt = Object.values(result).reduce((s, cards) => s + cards.length, 0);
      expect(totalDealt).toBe(deck.length);
    });

    test('2인 플레이 시 각 28장씩 분배된다', () => {
      const players = makePlayers(2);
      const deck = createDeck();
      const result = dealCards(players, deck);
      Object.values(result).forEach(cards => expect(cards).toHaveLength(28));
    });

    test('4인 플레이 시 각 14장씩 분배된다', () => {
      const players = makePlayers(4);
      const deck = createDeck();
      const result = dealCards(players, deck);
      Object.values(result).forEach(cards => expect(cards).toHaveLength(14));
    });

    test('모든 플레이어 ID가 결과에 포함된다', () => {
      const players = makePlayers(3);
      const deck = createDeck();
      const result = dealCards(players, deck);
      players.forEach(p => expect(result).toHaveProperty(p.id));
    });
  });

  describe('calculateCardSum', () => {
    test('같은 과일의 count를 합산한다', () => {
      const cards = [
        new Card('strawberry', 2),
        new Card('strawberry', 3),
        new Card('banana', 1),
      ];
      const sums = calculateCardSum(cards);
      expect(sums.strawberry).toBe(5);
      expect(sums.banana).toBe(1);
    });

    test('빈 배열이면 빈 객체를 반환한다', () => {
      expect(calculateCardSum([])).toEqual({});
    });
  });

  describe('checkHalliGalli', () => {
    test('같은 과일이 정확히 5개면 true를 반환한다', () => {
      const cards = [
        new Card('strawberry', 2),
        new Card('strawberry', 3),
        new Card('banana', 1),
      ];
      expect(checkHalliGalli(cards)).toBe(true);
    });

    test('5개 미만이면 false를 반환한다', () => {
      const cards = [
        new Card('strawberry', 2),
        new Card('banana', 2),
      ];
      expect(checkHalliGalli(cards)).toBe(false);
    });

    test('5개 초과면 false를 반환한다', () => {
      const cards = [
        new Card('lemon', 3),
        new Card('lemon', 4),
      ];
      expect(checkHalliGalli(cards)).toBe(false);
    });

    test('딱 5개짜리 단일 카드면 true를 반환한다', () => {
      expect(checkHalliGalli([new Card('plum', 5)])).toBe(true);
    });

    test('빈 배열이면 false를 반환한다', () => {
      expect(checkHalliGalli([])).toBe(false);
    });
  });

  describe('generateCardId', () => {
    test('fruit_count 형식으로 ID를 반환한다', () => {
      expect(generateCardId('banana', 3)).toBe('banana_3');
    });
  });

  describe('getCardInfo', () => {
    test('카드 ID를 파싱해 fruit, count, id를 반환한다', () => {
      const info = getCardInfo('lemon_2');
      expect(info.fruit).toBe('lemon');
      expect(info.count).toBe(2);
      expect(info.id).toBe('lemon_2');
    });
  });
});
