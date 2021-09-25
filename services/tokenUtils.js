const { mapBaseSet } = require('./setUtils');

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


// Data to retrieve from token
exports.mapSetToTokens = data => {
    const newTokens = data.tokens.filter(filterToken).map(mapToken);
    console.log(data.name, 'Tokens:', newTokens.length, 'of', data.tokens.length);
    return mapBaseSet(data, {tokens: newTokens});
};
const mapToken = ({
    name, faceName, reverseRelated, keywords,
    colors, types, text, power, toughness,
    number, identifiers, side, isReprint,
    availability, isOnlineOnly
}) => ({
    name: faceName || name,
    fullName: faceName ? name : undefined,
    id: {
        cardKingdom: identifiers.cardKingdomId,
        gatherer: identifiers.multiverseId,
        scryfall: identifiers.scryfallId,
        oracle: identifiers.scryfallOracleId,
    }, 
    footer: power || toughness ? power+'/'+toughness : null,
    reverseRelated, colors, types, keywords, text, number, side, isReprint,
    availability, isOnlineOnly
});
const filterToken = ({availability, isOnlineOnly}) => 
    (!availability || availability.includes('paper')) && !isOnlineOnly;

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

