// Normalize Set titles
const normTitle = str => str.replace(/[^\w\s]/gi, '').trim().toLowerCase();

// Base fields from Set to include
const mapBaseSet = ({
    name, code, releaseDate
}, additFields={}) => ({
    name, code, date: new Date(releaseDate),
    ...additFields
});

// Hide SET fields from master object
/*const allFields = [
    "baseSetSize","block","booster","cards","code",
    "codeV3","isForeignOnly","isFoilOnly","isNonFoilOnly",
    "isOnlineOnly","isPaperOnly","isPartialPreview",
    "keyruneCode","mcmId","mcmIdExtras","mcmName",
    "mtgoCode","name","parentCode","releaseDate",
    "sealedProduct","tcgplayerGroupId","tokens",
    "totalSetSize","translations","type",
];*/
const defaultIgnore = [
    "booster","cards","sealedProduct","translations",
    "codeV3","keyruneCode","mcmId","mcmIdExtras",
];

const hidingFields = (obj,fields=defaultIgnore) => {
    fields.forEach(f => delete obj[f]);
    return obj;
};

// Use the second half title with these
const postSplit = [
    'duel decks',
    'premium deck',
    'signature spellbook',
    'from the vault',
    'innistrad', 'ravnica',
    'conspiracy',
    'commander collection',
].map(normTitle);
// Don't get altTitles for four-letter+ setCodes
const splitThreeCodesOnly = true;

const titleSplit = /:|,|\//;
const additionalTitles = (title,code) => {
    if (splitThreeCodesOnly && code.length !== 3) return [];
    if (titleSplit.test(title)) {
        const splitIdx = +postSplit.some(t => normTitle(title).includes(t));
        const altTitle = normTitle(title.split(titleSplit)[splitIdx]); 
        if (altTitle) return [altTitle];
    }
    return [];
}

// Extract codes from NameMap
const getSetCodes = nameMap => nameMap ? Object.keys(nameMap).reduce((codes,key) => {
    if (!codes.includes(nameMap[key])) codes.push(nameMap[key].toUpperCase());
    return codes;
}, []) : [];

// Sanitize user input
const sanitizeSets = sets => sets.split('\n').map(s=>s.trim()).filter(s=>!!s);

module.exports = { mapBaseSet, hidingFields, additionalTitles, normTitle, getSetCodes, sanitizeSets }