'use strict';

const RecycleClient = require('./client');

async function recycleModule(fastify) {
  const client = new RecycleClient();
  fastify.get('/api/recycle/status', async () => client.status());
  fastify.get('/api/recycle/parts/:partPk/images', async (request, reply) => {
    try {
      return await client.getProductImages(request.params?.partPk);
    } catch (error) {
      return reply.status(error.statusCode || 502).send({ error: error.message });
    }
  });
  fastify.post('/api/recycle/search', async (request, reply) => {
    const partNumber = String(request.body?.partNumber || '').trim();
    if (!partNumber || partNumber.length > 100) return reply.status(400).send({ error: 'Geçerli bir partNumber gereklidir.' });
    try {
      return await client.search(partNumber);
    } catch (error) {
      return reply.status(error.statusCode || 502).send({ error: error.message });
    }
  });
  fastify.post('/api/recycle/search-references', async (request, reply) => {
    const references = Array.isArray(request.body?.references) ? request.body.references : [];
    if (!references.length) return reply.status(400).send({ error: 'Geçerli referans listesi gereklidir.' });
    try {
      return await client.searchReferences(references);
    } catch (error) {
      return reply.status(error.statusCode || 502).send({ error: error.message });
    }
  });
  fastify.post('/api/recycle/search-local-items', async (request, reply) => {
    const items = Array.isArray(request.body?.items) ? request.body.items.slice(0, 120) : [];
    if (!items.length) return reply.status(400).send({ error: 'Gecerli yerel sonuc listesi gereklidir.' });
    try {
      return await client.searchLocalItems(items);
    } catch (error) {
      return reply.status(error.statusCode || 502).send({ error: error.message });
    }
  });
  fastify.post('/api/recycle/cancel', async () => { await client.cancel(); return { cancelled: true }; });
  fastify.addHook('onClose', async () => client.close());
}

module.exports = recycleModule;
