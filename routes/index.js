const express = require('express');
const router = express.Router();
const logger = require('../services/logger');
const { addSlash } = require('../services/fixUrl');
const { sanitizeSets } = require('../services/setUtils');
const { sanitizeCards } = require('../services/cardUtils');
const { updateDB, isLocked } = require('../db/updateDb');
const { getTokens, getCardTokens, checkSets } = require('../db/fetchDb');

/* GET home page. */
router.get('/', addSlash, function(req, res) {
  res.render('index', { title: 'Token Find' });
});

/* Check set list */
router.post('/sets', async function(req, res) {
  logger.log('Sets Req:',req.body);

  const invalid = await checkSets(sanitizeSets(req.body.sets));
  return res.status(200).send({ invalid });
});

/* POST token data. */
const sortOpts = ['dateAsc','list','dateDesc']
router.post('/tokens', async function(req, res) {
  logger.log('Tokens Req:',req.body);

  const sort = req.body.sort && sortOpts.includes(req.body.sort) ?
    sortOpts.indexOf(req.body.sort) - 1 : 0;
  const sets = await getTokens(sanitizeSets(req.body.sets),sort,req.body.unique === 'on');

  res.render('tokens', { title: 'Token Results', sets });
});

/* POST card data. */
router.post('/cards', async function(req, res) {
  logger.log('Cards Req:',{...req.body, cards: '[' + req.body.cards.split('\n').length + ' lines]'});

  const cards = await getCardTokens(sanitizeCards(req.body.cards));

  res.render('cards', { title: 'Card Results', cards });
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
