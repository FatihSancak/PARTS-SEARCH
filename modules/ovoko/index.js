'use strict';

const safeUrl = value => {
  try { const url = new URL(value, 'https://ovoko.de'); return url.protocol === 'https:' && /(^|\.)ovoko\.de$/i.test(url.hostname) ? url.href : ''; } catch { return ''; }
};
const text = value => String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();

function collect(value, output, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value) || output.length >= 48) return;
  seen.add(value);
  if (Array.isArray(value)) { value.forEach(item => collect(item, output, seen)); return; }
  const title = text(value.title || value.name || value.part_name || value.product_name);
  const image = safeUrl(value.image?.url || value.image || value.image_url || value.photo?.url || value.thumbnail);
  const url = safeUrl(value.url || value.product_url || value.link || value.slug && `/part/${value.slug}`);
  const rawPrice = value.price?.amount ?? value.price?.value ?? value.price ?? value.amount;
  const numeric = Number(String(rawPrice || '').replace(',', '.').replace(/[^0-9.]/g, ''));
  if (title && url && (image || Number.isFinite(numeric))) output.push({ title, url, image, price: Number.isFinite(numeric) ? numeric : null, currency: value.price?.currency || value.currency || 'EUR', seller: text(value.seller?.name || value.seller_name), vehicle: text(value.vehicle?.name || value.vehicle_name) });
  Object.values(value).forEach(item => collect(item, output, seen));
}

module.exports = async function ovokoModule(fastify) {
  fastify.get('/ovoko-parcalar', async (request, reply) => reply.sendFile('ovoko-parts.html'));
  fastify.get('/api/ovoko/search', async (request, reply) => {
    const q = String(request.query?.q || '').trim().slice(0, 100);
    if (!q) return reply.code(400).send({ error: 'Parça numarası gereklidir.' });
    const pageUrl = `https://ovoko.de/suche?exact=1&q=${encodeURIComponent(q)}`;
    try {
      const response = await fetch(pageUrl, { headers: { 'User-Agent': 'Mozilla/5.0 BaytemuerParts/1.0', Accept: 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(25000) });
      if (!response.ok) return reply.code(502).send({ error: `Ovoko yanıtı alınamadı (HTTP ${response.status}).` });
      const html = await response.text(); const items = [];
      for (const match of html.matchAll(/<script[^>]+type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { collect(JSON.parse(match[1]), items); } catch {} }
      const unique = [...new Map(items.map(item => [item.url, item])).values()];
      return { query: q, total: unique.length, items: unique, sourceUrl: pageUrl };
    } catch { return reply.code(502).send({ error: 'Ovoko bağlantısı kurulamadı. Lütfen tekrar deneyin.' }); }
  });
};
