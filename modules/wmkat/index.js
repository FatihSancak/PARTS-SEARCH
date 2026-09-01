'use strict';

const WmkatClient = require('./client');

async function wmkatModule(fastify, options) {
  const client = new WmkatClient();

  fastify.get('/api/wmkat/status', async () => client.status());

  fastify.post('/api/wmkat/search', async (request, reply) => {
    const partNumber = String(request.body?.partNumber || '').trim();
    if (!partNumber || partNumber.length > 100) {
      return reply.status(400).send({ error: 'Geçerli bir partNumber gereklidir.' });
    }
    try {
      return await client.search(partNumber);
    } catch (error) {
      request.log.warn({ err: error }, 'WMKAT araması başarısız');
      return reply.status(error.statusCode || 502).send({ error: error.message });
    }
  });

  fastify.post('/api/wmkat/alternatives', async (request, reply) => {
    const partNumber = String(request.body?.partNumber || '').trim();
    const unit = String(request.body?.unit || '').trim();
    if (!partNumber || partNumber.length > 100) {
      return reply.status(400).send({ error: 'Geçerli bir partNumber gereklidir.' });
    }
    if (typeof options.localStockSearch !== 'function') {
      return reply.status(503).send({ error: 'Yerel stok arama servisi yapılandırılmamış.' });
    }
    try {
      const wmkat = await client.search(partNumber);
      if (!wmkat.references.length) {
        return { ...wmkat, rows: [], localCount: 0, searchedReferences: 0 };
      }
      const local = await options.localStockSearch({ references: wmkat.references, unit });
      return {
        partNumber,
        status: wmkat.status,
        wmkatReferenceCount: wmkat.count,
        searchedReferences: local.searchedReferences,
        localCount: local.rows.length,
        rows: local.rows
      };
    } catch (error) {
      request.log.warn({ err: error }, 'WMKAT alternatif araması başarısız');
      return reply.status(error.statusCode || 502).send({ error: error.message });
    }
  });

  fastify.post('/api/wmkat/cancel', async () => {
    await client.cancel();
    return { cancelled: true };
  });

  fastify.post('/api/wmkat/local-stock', async (request, reply) => {
    const references = Array.isArray(request.body?.references) ? request.body.references.slice(0, 400) : [];
    const unit = String(request.body?.unit || '').trim();
    if (!references.length || typeof options.localStockSearch !== 'function') {
      return reply.status(400).send({ error: 'Geçerli WMKAT referansları gereklidir.' });
    }
    try {
      return await options.localStockSearch({ references, unit });
    } catch (error) {
      request.log.warn({ err: error }, 'WMKAT yerel stok araması başarısız');
      return reply.status(500).send({ error: error.message });
    }
  });

  fastify.addHook('onClose', async () => client.close());
}

module.exports = wmkatModule;
