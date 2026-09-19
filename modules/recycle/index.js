'use strict';

const RecycleClient = require('./client');

const reminderEnabled = !['false', '0', 'no', 'off'].includes(String(process.env.RECYCLE_ORDER_REMINDER_ENABLED || 'true').trim().toLowerCase());
const reminderIntervalMinutes = Math.min(Math.max(Number(process.env.RECYCLE_ORDER_REMINDER_INTERVAL_MINUTES) || 5, 1), 1440);
const reminderStartMinute = Math.min(Math.max(Number.parseInt(process.env.RECYCLE_ORDER_REMINDER_START_MINUTE, 10) || 0, 0), 59);

function nextReminderTime(now = new Date()) {
  // The start minute is relative to midnight: 15/0 runs at :00, :15, :30, :45.
  const next = new Date(now);
  next.setHours(0, reminderStartMinute, 0, 0);
  const intervalMs = reminderIntervalMinutes * 60 * 1000;
  while (next <= now) next.setTime(next.getTime() + intervalMs);
  return next;
}

async function recycleModule(fastify) {
  const client = new RecycleClient();
  const pendingOrders = new Map();
  let scanInProgress = false;
  let lastScanAt = null;
  const scanOrders = async () => {
    if (scanInProgress) return;
    scanInProgress = true;
    try {
      const today = new Date(); const start = new Date(today); start.setDate(start.getDate() - 2);
      const result = await client.getOrders({ from: { day: start.getDate(), month: start.getMonth() + 1, year: start.getFullYear() }, to: { day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear() } });
      for (const order of result.orders) {
        const id = Buffer.from([order.orderCode, order.date, order.name, order.price].join('|')).toString('base64url');
        if (!pendingOrders.has(id)) pendingOrders.set(id, { ...order, id, detectedAt: new Date().toISOString() });
      }
      lastScanAt = new Date().toISOString();
    } catch (error) { fastify.log.warn({ err: error }, 'Recycle order scan failed'); }
    finally { scanInProgress = false; }
  };
  let reminderTimer = null;
  const scheduleNextScan = () => {
    if (!reminderEnabled) return;
    const next = nextReminderTime();
    reminderTimer = setTimeout(async () => {
      await scanOrders();
      scheduleNextScan();
    }, Math.max(next.getTime() - Date.now(), 1));
    fastify.log.info({ nextReminderAt: next.toISOString(), reminderIntervalMinutes, reminderStartMinute }, 'Recycle order reminder scheduled');
  };
  scheduleNextScan();
  fastify.get('/api/recycle/order-alerts', async () => ({
    orders: [...pendingOrders.values()],
    lastScanAt,
    scanning: scanInProgress,
    enabled: reminderEnabled,
    intervalMinutes: reminderIntervalMinutes,
    startMinute: reminderStartMinute
  }));
  fastify.post('/api/recycle/order-alerts/acknowledge', async (request) => {
    const ids = Array.isArray(request.body?.ids) ? request.body.ids : [];
    ids.forEach(id => pendingOrders.delete(String(id)));
    return { acknowledged: ids.length, remaining: pendingOrders.size };
  });
  fastify.get('/api/recycle/status', async () => client.status());
  fastify.post('/api/recycle/orders', async (request, reply) => {
    try { return await client.getOrders(request.body || {}); }
    catch (error) { return reply.status(error.statusCode || 502).send({ error: error.message }); }
  });
  fastify.get('/api/recycle/orders/images/:imageId', async (request, reply) => {
    try {
      const image = await client.getOrderImage(request.params?.imageId);
      return reply.type(image.contentType).header('Cache-Control', 'private, max-age=1800').send(image.body);
    } catch (error) { return reply.status(error.statusCode || 502).send({ error: error.message }); }
  });
  fastify.get('/api/recycle/parts/:partPk/images', async (request, reply) => {
    try {
      return await client.getProductImages(request.params?.partPk);
    } catch (error) {
      return reply.status(error.statusCode || 502).send({ error: error.message });
    }
  });
  // Recycle images require its authenticated session. Proxy them through this
  // server so that result thumbnails and galleries work in the browser.
  fastify.get('/api/recycle/parts/:partPk/images/:imageIndex', async (request, reply) => {
    try {
      const image = await client.getProductImage(request.params?.partPk, request.params?.imageIndex);
      return reply.type(image.contentType).header('Cache-Control', 'private, max-age=1800').send(image.body);
    } catch (error) {
      return reply.status(error.statusCode || 502).send({ error: error.message });
    }
  });
  fastify.post('/api/recycle/vehicles/search', async (request, reply) => {
    const vinSuffix = String(request.body?.vinSuffix || '').trim();
    if (!/^\*?\d{5}$/.test(vinSuffix)) return reply.status(400).send({ error: 'VIN son 5 hanesi gerekli.' });
    try { return await client.searchVehiclesByVinSuffix(vinSuffix); }
    catch (error) { return reply.status(error.statusCode || 502).send({ error: error.message }); }
  });
  fastify.get('/api/recycle/vehicles/:vehicleId/images', async (request, reply) => {
    try { return await client.getVehicleImages(request.params?.vehicleId); }
    catch (error) { return reply.status(error.statusCode || 502).send({ error: error.message }); }
  });
  fastify.get('/api/recycle/vehicles/:vehicleId/images/:imageIndex', async (request, reply) => {
    try { const image = await client.getVehicleImage(request.params?.vehicleId, request.params?.imageIndex); return reply.type(image.contentType).header('Cache-Control', 'private, max-age=1800').send(image.body); }
    catch (error) { return reply.status(error.statusCode || 502).send({ error: error.message }); }
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
  fastify.addHook('onClose', async () => { clearTimeout(reminderTimer); await client.close(); });
}

module.exports = recycleModule;
