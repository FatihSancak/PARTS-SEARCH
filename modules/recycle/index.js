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

async function recycleModule(fastify, options = {}) {
  const client = new RecycleClient();
  const pendingOrders = new Map();
  // Recycle uses one browser page per client. Serialise order reads so a
  // scheduled scan and a user request can never navigate that page at the
  // same time and destroy each other's Playwright execution context.
  let orderQueue = Promise.resolve();
  const getOrdersSafely = (criteria) => {
    const task = orderQueue.catch(() => {}).then(async () => {
      const result = await client.getOrders(criteria);
      await fillMissingOrderLocations(result, options);
      return fillMissingOrderBrands(result, options);
    });
    orderQueue = task.catch(() => {});
    return task;
  };

  const hasLocation = (value) => String(value || '').trim().length > 0;
  const normalizePartNumber = options.normalizePartNumber || (value => String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase());
  async function fillMissingOrderLocations(result, dbOptions) {
    if (!dbOptions.getDbPool || !dbOptions.sql || !Array.isArray(result?.orders)) return result;

    const oldArticleNumbers = [...new Set(result.orders
      .filter(order => !hasLocation(order.location) && String(order.oldArticleNumber || '').trim())
      .map(order => normalizePartNumber(order.oldArticleNumber))
      .filter(Boolean))];
    if (!oldArticleNumbers.length) return result;

    try {
      const dbPool = await dbOptions.getDbPool();
      const request = dbPool.request();
      const inputs = oldArticleNumbers.map((number, index) => {
        const name = `oldArticle${index}`;
        request.input(name, dbOptions.sql.NVarChar, number);
        return `@${name}`;
      });
      // Both article-number fields occur in ESS installations. Locations from
      // either Lagerort or Lagerplatz are accepted, but blank values are not.
      const normalizeSql = expression => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(CONVERT(NVARCHAR(4000), ${expression})), N' ', N''), N'-', N''), N'.', N''), N'/', N''), N'_', N'')`;
      const resultSet = await request.query(`
        SELECT ${normalizeSql('g.[Artikelnummer]')} AS articleNumber,
               COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Lagerort]))), ''),
                        NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Lagerplatz]))), '')) AS location
        FROM dbo.Gebrauchtteile g
        WHERE ${normalizeSql('g.[Artikelnummer]')} IN (${inputs.join(', ')})
          AND COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Lagerort]))), ''),
                       NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Lagerplatz]))), '')) IS NOT NULL
        UNION ALL
        SELECT ${normalizeSql('g.[ArtikelNr]')} AS articleNumber,
               COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Lagerort]))), ''),
                        NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Lagerplatz]))), '')) AS location
        FROM dbo.Gebrauchtteile g
        WHERE ${normalizeSql('g.[ArtikelNr]')} IN (${inputs.join(', ')})
          AND COALESCE(NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Lagerort]))), ''),
                       NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Lagerplatz]))), '')) IS NOT NULL;
      `);
      const locationsByArticle = new Map();
      for (const row of resultSet.recordset) {
        if (!locationsByArticle.has(row.articleNumber)) locationsByArticle.set(row.articleNumber, row.location);
      }
      for (const order of result.orders) {
        if (hasLocation(order.location)) continue;
        const location = locationsByArticle.get(normalizePartNumber(order.oldArticleNumber));
        if (location) order.location = location;
      }
    } catch (error) {
      // ESS lookup must not prevent the order list from being displayed.
      fastify.log.warn({ err: error }, 'ESS storage-location lookup for orders failed');
    }
    return result;
  }

  async function fillMissingOrderBrands(result, dbOptions) {
    if (!dbOptions.getDbPool || !dbOptions.sql || !Array.isArray(result?.orders)) return result;

    const articleNumbers = [...new Set(result.orders
      .filter(order => !String(order.brand || '').trim() && String(order.articleNumber || '').trim())
      .map(order => normalizePartNumber(order.articleNumber))
      .filter(Boolean))];
    if (!articleNumbers.length) return result;

    try {
      const dbPool = await dbOptions.getDbPool();
      const request = dbPool.request();
      const inputs = articleNumbers.map((number, index) => {
        const name = `orderArticle${index}`;
        request.input(name, dbOptions.sql.NVarChar, number);
        return `@${name}`;
      });
      const normalizeSql = expression => `REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(UPPER(CONVERT(NVARCHAR(4000), ${expression})), N' ', N''), N'-', N''), N'.', N''), N'/', N''), N'_', N'')`;
      const resultSet = await request.query(`
        SELECT ${normalizeSql('g.[Artikelnummer]')} AS articleNumber,
               LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Marke]))) AS brand
        FROM dbo.Gebrauchtteile g
        WHERE ${normalizeSql('g.[Artikelnummer]')} IN (${inputs.join(', ')})
          AND NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Marke]))), '') IS NOT NULL
        UNION ALL
        SELECT ${normalizeSql('g.[ArtikelNr]')} AS articleNumber,
               LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Marke]))) AS brand
        FROM dbo.Gebrauchtteile g
        WHERE ${normalizeSql('g.[ArtikelNr]')} IN (${inputs.join(', ')})
          AND NULLIF(LTRIM(RTRIM(CONVERT(nvarchar(255), g.[Marke]))), '') IS NOT NULL;
      `);
      const brandsByArticle = new Map();
      for (const row of resultSet.recordset) {
        if (!brandsByArticle.has(row.articleNumber)) brandsByArticle.set(row.articleNumber, row.brand);
      }
      for (const order of result.orders) {
        if (String(order.brand || '').trim()) continue;
        const brand = brandsByArticle.get(normalizePartNumber(order.articleNumber));
        if (brand) order.brand = brand;
      }
    } catch (error) {
      // The order list remains usable when the optional ESS brand lookup fails.
      fastify.log.warn({ err: error }, 'ESS brand lookup for orders failed');
    }
    return result;
  }
  let scanInProgress = false;
  let lastScanAt = null;
  const scanOrders = async () => {
    if (scanInProgress) return;
    scanInProgress = true;
    try {
      const today = new Date(); const start = new Date(today); start.setDate(start.getDate() - 2);
      const result = await getOrdersSafely({ from: { day: start.getDate(), month: start.getMonth() + 1, year: start.getFullYear() }, to: { day: today.getDate(), month: today.getMonth() + 1, year: today.getFullYear() } });
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
    try { return await getOrdersSafely(request.body || {}); }
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
