const Card = require('../../models/Card');

describe('Card 모델', () => {
  test('fruit와 count로 카드를 생성한다', () => {
    const card = new Card('strawberry', 3);
    expect(card.fruit).toBe('strawberry');
    expect(card.count).toBe(3);
  });

  test('count가 1~5 범위의 카드를 생성한다', () => {
    [1, 2, 3, 4, 5].forEach(count => {
      const card = new Card('banana', count);
      expect(card.count).toBe(count);
    });
  });

  test('4가지 과일 타입을 모두 지원한다', () => {
    const fruits = ['strawberry', 'banana', 'plum', 'lemon'];
    fruits.forEach(fruit => {
      const card = new Card(fruit, 1);
      expect(card.fruit).toBe(fruit);
    });
  });
});
