const { mapBaseSet, fixSetCode } = require('./setUtils');


// Check if one token is the same as another
function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    a = [...a].sort();
    b = [...b].sort();

    for (var i = 0; i < a.length; ++i) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

const tokensEqual = (a, b) => 
    a.name.toLowerCase() == b.name.toLowerCase() && 
    (a.text || '').toLowerCase() == (b.text || '').toLowerCase() && 
    a.footer == b.footer && 
    arraysEqual(a.colors,b.colors) &&
    arraysEqual(a.types,b.types);
    
exports.removeEqualTokens = (setArr) => {
    let seen = [], result = [];
    for (const set of setArr) {
        if (set.tokens) { 
            let remaining = [];
            for (const token of set.tokens) {
                if (seen.some(t => tokensEqual(token, t))) continue;
                remaining.push(token);
                seen.push(token);
            }
            if (set.tokens.length !== remaining.length)
                console.log(set.name,'removed',set.tokens.length-remaining.length,'non-unique tokens');
            set.tokens = remaining;
        }
        if (!set.error && !set.tokens) console.log(set);
        if (set.error || set.tokens.length) result.push(set);
    }
    return result;
};

// Build a char safe ID string to help determine similar tokens
exports.uniqueTokenId = token => (
    token.name + '_' +
    (token.text || '0') + '_' +
    (token.footer || getFooter(token) || '0') + '_' +
    (token.colors || ['0']).join('') + '_' +
    (getTypes(token) || ['0']).join('_')
).replace(/\s,'\./g,'')
 .replace(/[^\w_-]/g,'_')
 .toLowerCase();


// Card name to Scryfall URL
exports.getCardUrl = (name, set = '') => 
    'https://scryfall.com/search?q=' +
    escape(name).replace(/%20/,'+') + 
    (set ? '+set%3A' + fixSetCode(set) : '');
exports.getTokenUrl = token =>
    `https://api.scryfall.com/cards/${
        typeof token === 'object' ?
        token.id.scryfall : token
    }?format=image`;

// Data to retrieve from token
exports.mapSetToTokens = async (data, getAltSets) => {
    let newTokens = data.tokens.filter(filterToken).map(mapToken);
    if (getAltSets) newTokens = await Promise.all(newTokens.map(t=>appendAltSets(t,getAltSets)));
    console.log(data.name, 'Tokens:', newTokens.length, 'of', data.tokens.length);
    return mapBaseSet(data, {tokens: newTokens});
};
exports.mapCardToTokens = async (tokens, getAltSets) => {
    let newTokens = Object.values(tokens).filter(filterToken).map(mapToken);
    if (getAltSets) newTokens = await Promise.all(newTokens.map(t=>appendAltSets(t,getAltSets,[false])));
    // console.log('Tokens:', newTokens.length, 'of', data.tokens.length);
    return newTokens;
};
const getTypes = token =>
    token.types ?
    token.types.filter(t=>t!=='Token') :
    token.types;
const getFooter = token => 
    token.power || token.toughness ?
    (token.power||'-')+'/'+(token.toughness||'-') :
    token.power;
const mapToken = ({
    name, faceName, reverseRelated, keywords,
    colors, types, text, power, toughness,
    number, identifiers, side, isReprint,
    availability, isOnlineOnly, setCode
}) => ({
    name: faceName || name,
    fullName: faceName ? name : undefined,
    id: {
        // cardKingdom: identifiers.cardKingdomId,
        gatherer: identifiers.multiverseId,
        scryfall: identifiers.scryfallId,
        // oracle: identifiers.scryfallOracleId,
    }, 
    types: getTypes({types}),
    footer: getFooter({power, toughness}),
    setCode: fixSetCode(setCode),
    colors, keywords, text, number, side, isReprint,
    reverseRelated, availability, isOnlineOnly
});
const appendAltSets = async (token, getAltSets, args = []) => { 
    token.altSets = await getAltSets(token, ...args);
    return token;
};
exports.appendAltSets = appendAltSets;
const filterToken = ({availability, isOnlineOnly}) => 
    (!availability || availability.includes('paper')) && !isOnlineOnly;


// Specific token fixes
exports.tokenFixes = [
    // Array of objects w/ 3 functions: { testSet, test, fix } 
    //   if testSet(set) && test(token,set) are TRUE, then token = fix(token,set)
    { // Fix Embalm tokens
        testSet: set => /AKH/.test(set.code),
        test: token => !token.reverseRelated || !token.reverseRelated.length && token.colors[0] === 'W',
        fix: token => { token.reverseRelated = [token.name,]; return token; },
    }, { // Fix Eternalize tokens
        testSet: set => /HOU/.test(set.code),
        test: token => !token.reverseRelated || !token.reverseRelated.length && token.colors[0] === 'B',
        fix: token => { token.reverseRelated = [token.name,]; return token; },
    },
];

// Format token-data on Error
const noSetErr = 'ENOENT: no such file or directory';
exports.errToken = code => e => ({
    name: code,
    code: 'ERR',
    error: 
        'Cannot find set "'+code+'": ' + 
        ((e.message || e).includes(noSetErr) ?
        'This set/code does not exist.' : 
        (e.message || e))
});

