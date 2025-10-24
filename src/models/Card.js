// /models/Card.js

class Card {
    /**
     * @param {string} fruit  - 과일 종류(예: strawberry, banana, plum, lemon 등)
     * @param {number} count  - 카드에 그려진 과일 개수
     */
    constructor(fruit, count) {
      this.fruit = fruit;    // ex) 'strawberry'
      this.count = count;    // ex) 1,2,3,4,5
    }
  }
  
  module.exports = Card;