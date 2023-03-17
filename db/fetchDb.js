const fs = require('fs');
const { join } = require('path');
const logger = require('../services/logger');
const { normTitle } = require('../services/setUtils');
const { cardFilename } = require('../services/cardUtils');
const { mapSetToTokens, mapCardToTokens, errToken, removeEqualTokens, uniqueTokenId } = require('../services/tokenUtils');
const { setFolder, cardFolder, cardMemLimit } = require('./updateDb').params;
const { nameMap, setCodes, setMap } = require('./updateDb').get;
const { regenNameMap, regenMultiSetMap } = require('./updateDb').admin;

// Get token-data from each set
async function getTokens(setNames, sortByDate=0, unique=true) {
  logger.log('Searching sets:',setNames);
  setNames = setNames.map(name => nameMap()[normTitle(name)] || name.toUpperCase() );
  logger.log('As:',setNames);
  
  // Download payload to database
  // console.time('Retrieved records');
  let result = await Promise.all(setNames.map(code =>
      fs.promises.readFile(join(setFolder,code+'.json'),{encoding: 'utf8'})
          .then(data => mapSetToTokens(JSON.parse(data),getAltSets))
          .catch(errToken(code))
  ));
  if (sortByDate) result.sort((a,b) => (a.date - b.date) * sortByDate);
  if (unique) result = removeEqualTokens(result);
  
  // console.timeEnd('Retrieved records');
  logger.log(new Date().toISOString(), `Retrieved ${result.length} of ${setNames.length} sets.`);
  return result;
}

// Get sets that use each token
async function getAltSets(token, filterSelf = true) {
  if (!setMap()) await regenMultiSetMap();
  const sets = setMap()[uniqueTokenId(token)] || [];
  return filterSelf ? sets.filter(s=>s!==token.setCode) : sets; 
}

// Check sets, return invalid set list
async function checkSets(setNames) {
  if (!nameMap()) await regenNameMap();
  const codes = setNames.map(name => nameMap[normTitle(name)] || name.toUpperCase());
  let invalid = [];
  for (let i = 0, e = codes.length; i < e; i++) {
      if (!setCodes().includes(codes[i])) invalid.push(setNames[i]);
  }
  logger.log(
      invalid.length ?
      `Found ${invalid.length} invalid sets: ${invalid.join(',')}` :
      'All sets are valid.'
  );
  return invalid;
}

// Reverse card name lookup
async function getCardTokens(cardNames) {
  let result = { _missing: [] };
  for (let i = 0; i < cardNames.length; i += cardMemLimit) {
    await Promise.all(cardNames.slice(i, i + cardMemLimit).map(card => 
      fs.promises.readFile(join(cardFolder, cardFilename(card)))
        .then(f => mapCardToTokens(JSON.parse(f),getAltSets))
        .then(t => { result[card] = t; })
        .catch(e => {
          if (e.code !== 'ENOENT') throw e;
          result._missing.push(card);
        })
    ));
  }
  return result;
}

module.exports = { getTokens, getCardTokens, checkSets, getAltSets, };