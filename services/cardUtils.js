// Reduce function for appending unique tokens to a card object
const toCards = (cards,token) => {
  if (Array.isArray(token.reverseRelated)) {
      token.reverseRelated.forEach(r => {
          if (cards[r]) cards[r].push(token);
          else cards[r] = [token,];
      });
  }
  return cards;
};

// Replace annoying characters
const charFix = (s) => s
  .replace(/[\u2018\u2019]/g, "'") // Single smart quotes
  .replace(/[\u201C\u201D]/g, '"') // Double smart quotes
  .replace(/\u2013|\u2014/g, "-"); // Long dashes

const appendTokens = (newTokens, cardsObj) => newTokens.reduce(toCards, cardsObj || {});

// Normalize card name for looking up files
const cardFilename = cardName => cardName.replace(/\s+/g,'-').replace(/[^\w-]/g,'').toLowerCase() + '.json';

// Sanitize user input
const sanitizeCards = cards => cards.split('\n').map(s=>charFix(s.replace(/^\s*\d+\s/,'').trim())).filter(s=>!!s);

module.exports = { appendTokens, cardFilename, sanitizeCards }