// Updates mtgJSON data from website (Takes ~ 1 hr)
//   Usage: updateDb(updateSet?,updateCards?,forceUpdate?) => Promise
// NOT WORKING ON SERVER (Uses too much memory)

const fs = require('fs');
const https = require('https');
const { join, dirname } = require('path');
const JSONStream = require('JSONStream');
const { hidingFields, additionalTitles, normTitle, getSetCodes } = require('../services/setUtils');
const { mapSetToTokens, errToken, removeEqualTokens } = require('../services/tokenUtils');

// Path to Stored Data
const dbPath = join(__dirname,'storage','AllPrintings.json');
const dbFolder = join(__dirname,'storage','sets');
const nameMapPath = join(__dirname,'storage','nameMap.json');
const baseDataURL = 'https://mtgjson.com/api/v5/AllPrintings.json';

// Update every N records parsed (0 == don't show)
const showProgress = 100; 

// Load name map
let nameMap = fs.existsSync(nameMapPath) ?
    require('./storage/nameMap.json') : null;
let setCodes = getSetCodes(nameMap);

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

// Get token-data from each set
async function getTokens(setNames, sortByDate=0, unique=true) {
    console.log('Searching sets:',setNames);
    setNames = setNames.map(name => nameMap[normTitle(name)] || name.toUpperCase() );
    console.log('As:',setNames);
    
    // Download payload to database
    console.time('Retrieved records');
    let result = await Promise.all(setNames.map(code =>
        fs.promises.readFile(join(dbFolder,code+'.json'),{encoding: 'utf8'})
            .then(data => mapSetToTokens(JSON.parse(data)))
            .catch(errToken(code))
    ));
    if (sortByDate) result.sort((a,b) => (a.date - b.date) * sortByDate);
    if (unique) result = removeEqualTokens(result);
    
    console.timeEnd('Retrieved records');
    console.log(new Date().toISOString(), `Retrieved ${result.length} of ${setNames.length} sets.`);
    return result;
}

// Check sets, return invalid set list
function checkSets(setNames) {
    console.log('Searching sets:',setNames);
    const codes = setNames.map(name => nameMap[normTitle(name)] || name.toUpperCase());
    let invalid = [];
    for (let i = 0, e = codes.length; i < e; i++) {
        if (!setCodes.includes(codes[i])) invalid.push(setNames[i]);
    }
    console.log(
        invalid.length ?
        `Found ${invalid.length} invalid sets: ${invalid.join(',')}` :
        'All sets are valid.'
    );
    return invalid;
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

// Generate SET files from master object
async function regenSetFiles() {
    if (lock) return; lock = true;
    console.log('Regenerating set data...');
    fs.mkdirSync(dbFolder, {recursive: true});
    const saveFile = set => 
        fs.promises.writeFile(
            join(dbFolder,set.code+'.json'),
            JSON.stringify(hidingFields(set)),
            {encoding: 'utf8'}
        );
    return Promise.all(await readJSON(dbPath, ['data',true], null, saveFile))
        .then(() => {console.log('DB files saved.'); lock = false;});
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

const regenAll = () => regenNameMap().then(regenSetFiles);

module.exports = {
    getTokens, checkSets, updateDB,
    isLocked: () => lock,
    admin: {regenNameMap, regenSetFiles, regenAll},
};

// Generate missing files
if (!fs.existsSync(dbPath)) updateDB();
else if (!fs.existsSync(dbFolder) || !fs.readdirSync(dbFolder).length) regenAll();
else if (!nameMap) regenNameMap();
