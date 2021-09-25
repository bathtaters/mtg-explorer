const express = require('express');
const router = express.Router();
const { sanitizeSets } = require('../services/setUtils');
const { getTokens, checkSets, updateDB, isLocked } = require('../db/updateDb');

/* GET home page. */
router.get('/', function(req, res) {
  res.render('index', { title: 'Token Find' });
});

/* Check set list */
router.post('/sets', function(req, res) {
  console.log('Sets Req:',req.body);

  const invalid = checkSets(sanitizeSets(req.body.sets));

  return res.status(200).send({ invalid });
});

/* POST token data. */
const sortOpts = ['dateAsc','list','dateDesc']
router.post('/tokens', async function(req, res) {
  console.log('Tokens Req:',req.body);

  const sort = req.body.sort && sortOpts.includes(req.body.sort) ?
    sortOpts.indexOf(req.body.sort) - 1 : 0;
  const sets = await getTokens(sanitizeSets(req.body.sets),sort,req.body.unique === 'on');

  res.render('tokens', { title: 'Token Results', sets });
});

/* Update database (Secret link) */
router.get('/admin/updateDb', async function(req, res) {
  if (isLocked())
    return res.status(503).send(
      'Unable to rebuild. Server data is currently rebuilding.\n'+
      'Please try again later.'
    );

  updateDB();
  return res.status(202).send(
    'Rebuilding database, this make take up to 5 minutes.\n'+
    'Please navigate away from this page and do not refresh.'
  );
});

module.exports = router;
