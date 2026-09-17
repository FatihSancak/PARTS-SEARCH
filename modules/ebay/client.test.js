'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const Fastify = require('fastify');
const { EbayClient, parameters, containsExactPartNumber } = require('./client');
const env = { EBAY_PRODUCTION_APP_ID: 'test-app', EBAY_PRODUCTION_CERT_ID: 'test-secret' };
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
const item = { itemId: '1', title: 'Testteil', conditionId: '3000', itemLocation: { country: 'DE' }, itemWebUrl: 'https://www.ebay.de/itm/123', image: { imageUrl: 'https://i.ebayimg.com/test.jpg' }, price: { value: '25', currency: 'EUR' } };

test('always restricts to German used business car parts and validates input before fetching', () => {
  const p = parameters({ q: '04L & Motor', page: '2', sort: 'price' });
  assert.equal(p.params.get('category_ids'), '6030');
  assert.equal(p.params.get('filter'), 'conditionIds:{3000},sellerAccountTypes:{BUSINESS},itemLocationCountry:DE');
  assert.equal(p.params.get('q'), '04L & Motor');
  assert.equal(p.params.get('limit'), '100');
  assert.equal(p.params.get('offset'), '100');
  assert.equal(p.params.get('sort'), 'price');
  assert.equal(parameters({ sort: '-price', page: 2 }).params.get('sort'), '-price');
  for (const input of [{ page: -1 }, { page: 1.5 }, { page: 101 }, { q: 'a'.repeat(101) }, { sort: 'malicious' }]) assert.throws(() => parameters(input), { code: 'INVALID_QUERY' });
});

test('exact part-number matching rejects attached prefixes and suffixes', async () => {
  assert.equal(containsExactPartNumber({ title: 'Turbolader 038145209Q Original' }, '038145209Q'), true);
  assert.equal(containsExactPartNumber({ title: 'Turbolader 038 145 209 Q Original' }, '038145209Q'), true);
  assert.equal(containsExactPartNumber({ title: 'Turbolader', shortDescription: 'OE 038145209Q passend' }, '038145209Q'), true);
  assert.equal(containsExactPartNumber({ title: 'Turbolader 038145209QFD' }, '038145209Q'), false);
  assert.equal(containsExactPartNumber({ title: 'Turbolader 038145209QTH' }, '038145209Q'), false);
  assert.equal(containsExactPartNumber({ title: 'Turbolader X038145209Q' }, '038145209Q'), false);
  assert.equal(parameters({ q: '038-145-209-Q', exact: true }).exactPartNumber, '038145209Q');
  assert.throws(() => parameters({ q: '1', exact: true }), { code: 'INVALID_QUERY' });

  const variants = [
    { title: 'OE 038145209Q Original' },
    { title: 'OE 038145209QFD Original' },
    { title: 'OE 038145209QTH Original' },
    { title: 'OE 038-145-209-Q Original' },
    { title: 'Turbolader', shortDescription: 'Referenz: 038145209Q' }
  ].map((value, index) => ({ ...item, ...value, itemId: String(index + 1), itemWebUrl: `https://www.ebay.de/itm/${index + 1}` }));
  const client = new EbayClient({ env, fetchImpl: async url => url.includes('/token')
    ? response(200, { access_token: 'test', expires_in: 7200 })
    : response(200, { total: variants.length, itemSummaries: variants }) });
  const result = await client.search({ q: '038145209Q', exact: true });
  assert.deepEqual(result.items.map(entry => entry.id), ['1', '4', '5']);
  assert.equal(result.total, 3);
  assert.equal(result.exactPartNumber, '038145209Q');
});

test('normalizes real response structure, excludes wrong location/condition/URLs, caches results and token', async () => {
  const calls = [];
  const client = new EbayClient({ env, fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return url.includes('/token') ? response(200, { access_token: 'private-token', expires_in: 7200 }) : response(200, { total: 4, next: 'next', itemSummaries: [item, { ...item, conditionId: '1000' }, { ...item, itemLocation: { country: 'PL' } }, { ...item, itemWebUrl: 'javascript:alert(1)' }] });
  } });
  const first = await client.search({});
  assert.equal(first.items.length, 1);
  assert.equal(first.items[0].price.value, '25');
  assert.equal(first.hasNext, true);
  assert.equal((await client.search({})).cached, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers['X-EBAY-C-MARKETPLACE-ID'], 'EBAY_DE');
  assert.ok(!JSON.stringify(first).includes('private-token'));
  await client.search({ q: 'motor' });
  assert.equal(calls.length, 3);
});

test('unauthorized app returns actionable sanitized error and never invents results', async () => {
  const client = new EbayClient({ env, fetchImpl: async () => response(401, { error: 'unauthorized_client', error_description: 'sensitive upstream details' }) });
  const app = Fastify();
  await app.register(require('./index'), { client });
  try {
    const result = await app.inject('/api/ebay/search');
    assert.equal(result.statusCode, 503);
    assert.equal(result.json().code, 'EBAY_UNAUTHORIZED_CLIENT');
    assert.ok(!result.body.includes('sensitive'));
    assert.equal(result.json().items, undefined);
    assert.equal((await app.inject('/api/ebay/search?page=0')).statusCode, 400);
  } finally { await app.close(); }
});

test('refreshes an expired token once and handles upstream rate limiting', async () => {
  let tokens = 0, searches = 0;
  const client = new EbayClient({ env, fetchImpl: async url => {
    if (url.includes('/token')) return response(200, { access_token: 'token-' + (++tokens), expires_in: 7200 });
    searches++;
    return searches === 1 ? response(401, {}) : response(200, { total: 0 });
  } });
  assert.deepEqual((await client.search({})).items, []);
  assert.equal(tokens, 2);
  client.fetch = async () => response(429, {});
  await assert.rejects(client.search({ q: 'other' }), { code: 'EBAY_RATE_LIMIT', statusCode: 429 });
});

test('filters can be disabled independently and unfiltered results are not removed or cached together', async () => {
  for (const name of ['used', 'business', 'germany']) {
    assert.equal(parameters({ [name]: 'false' }).flags[name], false);
    assert.throws(() => parameters({ [name]: 'invalid' }), { code: 'INVALID_QUERY' });
  }
  assert.equal(parameters({ used: false, business: false, germany: false }).params.has('filter'), false);
  const seen = [];
  const client = new EbayClient({ env, fetchImpl: async url => {
    if (url.includes('/token')) return response(200, { access_token: 'test', expires_in: 7200 });
    seen.push(new URL(url).searchParams.get('filter'));
    return response(200, { total: 2, itemSummaries: [item, { ...item, itemId: '2', conditionId: '1000', itemLocation: { country: 'PL' } }] });
  } });
  assert.equal((await client.search({})).items.length, 1);
  const unrestricted = await client.search({ used: false, business: false, germany: false });
  assert.equal(unrestricted.items.length, 2);
  assert.deepEqual(unrestricted.filters, { conditionId: null, sellerAccountType: null, itemLocationCountry: null });
  assert.equal(seen.length, 2);
  assert.equal(seen[1], null);
});

test('gallery fetches and caches only trusted eBay images, and rejects arbitrary IDs', async () => {
  let calls = 0;
  const client = new EbayClient({ env, fetchImpl: async url => {
    if (url.includes('/token')) return response(200, { access_token: 'test', expires_in: 7200 });
    calls++;
    return response(200, { image: { imageUrl: 'https://i.ebayimg.com/one.jpg' }, additionalImages: [
      { imageUrl: 'https://i.ebayimg.com/two.jpg' }, { imageUrl: 'https://evil.example/img.jpg' }, { imageUrl: 'https://i.ebayimg.com/one.jpg' }
    ] });
  } });
  assert.deepEqual((await client.images('v1|123|0')).images, ['https://i.ebayimg.com/one.jpg', 'https://i.ebayimg.com/two.jpg']);
  await client.images('v1|123|0');
  assert.equal(calls, 1);
  await assert.rejects(client.images('https://evil.example'), { code: 'INVALID_QUERY' });
});
