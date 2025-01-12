const shuffleCards = () => {
  const cards = [];
  for (let i = 1; i <= 52; i++) {
    cards.push(i);
  }
  return cards.sort(() => Math.random() - 0.5);
};

const calculateCardSum = (cards) => cards.reduce((sum, card) => sum + card, 0);

module.exports = { shuffleCards, calculateCardSum };
