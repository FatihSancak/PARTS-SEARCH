'use strict';
const { EbayClient } = require('./client');

module.exports = async function ebayModule(fastify, options) {
  const client = options.client || new EbayClient();
  fastify.get('/ebay-parcalar', async (request, reply) => reply.sendFile('ebay-parts.html'));
  fastify.get('/api/ebay/images', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try { return await client.images(request.query.id); }
    catch (error) { return reply.code(error.statusCode || 502).send({ error: error.code ? error.message : 'İlan görselleri alınamadı.' }); }
  });
  fastify.get('/api/ebay/search', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try { return await client.search(request.query); }
    catch (error) {
      return reply.code(error.statusCode || 502).send({ code: error.code || 'EBAY_ERROR', error: error.code ? error.message : 'eBay araması tamamlanamadı.' });
    }
  });
};
