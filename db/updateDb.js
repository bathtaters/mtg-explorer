// Updates mtgJSON data from website (Takes ~ 1 hr)
//   Usage: updateDb(updateSet?,updateCards?,forceUpdate?) => Promise
// NOT WORKING ON SERVER (Uses too much memory)

const fs = require('fs');
const https = require('https');
const { join, dirname } = require('path');
const JSONStream = require('JSONStream');
const { hidingFields, additionalTitles, normTitle, getSetCodes, fixSetCode } = require('../services/setUtils');
const { appendTokens, cardFilename } = require('../services/cardUtils');
const { uniqueTokenId, tokenFixes } = require('../services/tokenUtils');

// Path to Stored Data
const dbPath = join(__dirname,'storage','AllPrintings.json');
const setFolder = join(__dirname,'storage','sets');
const cardFolder = join(__dirname,'storage','cards');
const nameMapPath = join(__dirname,'storage','nameMap.json');
const multiSetPath = join(__dirname,'storage','setMap.json');
const baseDataURL = 'https://mtgjson.com/api/v5/AllPrintings.json';

// Update every N records parsed (0 == don't show)
const showProgress = 100; 

// Flush mem after this many cardFiles are found (for regenCardFiles)
const cardMemLimit = 100;

// Load name map
let nameMap = fs.existsSync(nameMapPath) ?
    require('./storage/nameMap.json') : null;
let setCodes = getSetCodes(nameMap);
let setMap = fs.existsSync(multiSetPath) ?
    require('./storage/setMap.json') : null;

// Generic JSON Parser - filter/map works like array.filter()/array.map()
function readJSON(path, parsePath, filter=undefined, map=undefined, findLimit=0, parseLimit=0) {
    return new Promise((resolve, reject) => {
        const dbFile = fs.createReadStream(path, {encoding: 'utf8'});
        const jsonPipe = dbFile.pipe(JSONStream.parse(parsePath));
                
        let result = [], parsed = 0, found = 0;
        jsonPipe.on('data', data => {
            // Map/Filter then append to result
            if (!filter || filter(data)) {
                if (map) data = map(data);
                result.push(data);
                if (++found === findLimit && findLimit) return jsonPipe.destroy();
            }
            
            // Show incremental progress
            if (++parsed === parseLimit && parseLimit) return jsonPipe.destroy();
            if (showProgress && parsed % showProgress == 0)
                console.log(new Date().toISOString(), parsed+' records parsed.'); 
        });
        jsonPipe.on('error', reject);
        jsonPipe.on('close', () => resolve(result) );
    }).catch(e => 
        console.error(`Error downloading data: ${e.message || e}`)
    );
}

// Download JSON from MTGJSON
let lock = false; // DB lock, engage while working
function updateDB(fromUrl=baseDataURL, toFile=dbPath) {
    if (lock) return; lock = true;
    console.log('Downloading master database...');
    fs.mkdirSync(dirname(toFile),{recursive: true});
    return new Promise((resolve) => https.get(fromUrl, (res) => {
        const filePath = fs.createWriteStream(toFile);
        res.pipe(filePath);
        filePath.on('close',() => {
            filePath.close();
            console.log('Master database download complete.');
            lock = false;
            return resolve(null);
        })
    })).then(regenAll);
}

async function regenMultiSetMap() {
    if (lock) return; lock = true;
    console.log('Regenerating multi-set map...');
    fs.mkdirSync(dirname(multiSetPath), {recursive: true});

    // Create map
    let newMap = {};
    await readJSON(
        dbPath, ['data',true],
        set => set.tokens && set.tokens.length,
        set => {
            for (const token of set.tokens) {
                const id = uniqueTokenId(token);
                const code = fixSetCode(token.setCode);
                if (!newMap[id]) newMap[id] = [code];
                else if (!newMap[id].includes(code)) newMap[id].push(code);
            }
        }
    );

    // Filter map
    Object.keys(newMap).forEach(k => {
        if (newMap[k].length === 1) delete newMap[k];
    });

    // Store map
    setMap = newMap;
    return fs.promises.writeFile(
        multiSetPath,
        JSON.stringify(newMap),
        {encoding: 'utf8'}
    ).then(() => {console.log('Multi-set map saved.'); lock = false;});
}

// Generate SET files from master object
async function regenSetFiles() {
    if (lock) return; lock = true;
    console.log('Regenerating set data...');
    fs.mkdirSync(setFolder, {recursive: true});
    const saveFile = set => {
        const fixes = tokenFixes.filter(f => f.testSet(set));
        // Fix tokens w/o related cards
        set.tokens = set.tokens.map(t => {
            fixes.filter(f => f.test(t,set))
                .forEach(f => { t = f.fix(t,set); });
            return t;
        });
        return fs.promises.writeFile(
            join(setFolder,set.code+'.json'),
            JSON.stringify(hidingFields(set)),
            {encoding: 'utf8'}
        );
    }
    return Promise.all(await readJSON(dbPath, ['data',true], null, saveFile))
        .then(() => {console.log('DB files saved.'); lock = false;})
        .then(regenCardFiles);
}

// Generate "Reverse Related" files from master object
async function regenCardFiles() {
    if (lock) return; lock = true;
    console.log('Regenerating card-lookup data...');

    const writeCards = cards => Promise.all(Object.keys(cards).map(async c => {
        if (!cards[c] || !cards[c].length) return;
        const path = join(cardFolder,cardFilename(c));
        let tokens = {};
        if (fs.existsSync(path))
            tokens = await fs.promises.readFile(path).then(JSON.parse);
        cards[c].forEach(t => {
            const key = uniqueTokenId(t);
            if (!Object.keys(tokens).includes(key)) tokens[key] = t;
        });
        return fs.promises.writeFile(path, JSON.stringify(tokens));
    }));

    let cards;
    const sets = fs.readdirSync(setFolder);
    await fs.promises.mkdir(cardFolder, {recursive: true});
    for (const setFile of sets) {
        const setTokens = await fs.promises.readFile(join(setFolder,setFile))
            .then(s => JSON.parse(s)).then(s=>s && s.tokens);
        if (!setTokens || !setTokens.length) continue; // skip empty sets

        cards = appendTokens(setTokens, cards);

        // Break up writes
        if (Object.keys(cards).length > cardMemLimit) {
            await writeCards(cards);
            cards = {};
        }
    }
    return writeCards(cards)
        .then(() => {console.log('Card-lookup DB saved.'); lock = false;});
}

// Generate name map for translating full set names to set codes
async function regenNameMap() {
    if (lock) return; lock = true;
    console.log('Regenerating set name map...');
    const getName = ({code, name}) => [name, code];
    const nameArr = await readJSON(dbPath, ['data',true], null, getName);
    const newNameMap = nameArr.reduce((o,n) => {
        o[normTitle(n[0])] = n[1];
        additionalTitles(n[0], n[1]).forEach(altTitle => {
            if (!o[altTitle]) o[altTitle] = n[1];
        });
        return o;
    },{});
    nameMap = newNameMap;
    setCodes = getSetCodes(newNameMap);
    fs.mkdirSync(dirname(nameMapPath),{recursive: true});
    return fs.promises.writeFile(nameMapPath,JSON.stringify(newNameMap),{encoding: 'utf8'})
        .then(() => {console.log('Name Map saved.'); lock = false;});
}

const regenAll = () => regenNameMap().then(regenSetFiles).then(regenMultiSetMap);

module.exports = {
    updateDB, isLocked: () => lock,
    admin: {regenNameMap, regenMultiSetMap, regenSetFiles, regenCardFiles, regenAll},
    params: {setFolder, cardFolder, cardMemLimit},
    get: {
        nameMap: () => nameMap,
        setCodes: () => setCodes,
        setMap: () => setMap, 
    }
};

// Generate missing files
if (!fs.existsSync(dbPath)) updateDB();
else if (!fs.existsSync(setFolder) || !fs.readdirSync(setFolder).length) regenAll();
else if (!nameMap) regenNameMap();
else if (!setMap) regenMultiSetMap();
