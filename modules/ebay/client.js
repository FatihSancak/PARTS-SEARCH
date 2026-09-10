'use strict';

const SORTS = new Set(['best', 'price', '-price', 'newlyListed']);

class EbayError extends Error {
  constructor(message, code, statusCode = 502) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}

function parameters(input = {}) {
  const flags = {};
  for (const name of ['used', 'business', 'germany']) {
    const value = input[name] ?? 'true';
    if (![true, false, 'true', 'false'].includes(value)) throw new EbayError('Geçersiz filtre seçimi.', 'INVALID_QUERY', 400);
    flags[name] = value === true || value === 'true';
  }
  const q = String(input.q || '').trim();
  const exactValue = input.exact ?? 'false';
  if (![true, false, 'true', 'false'].includes(exactValue)) throw new EbayError('Geçersiz tam eşleşme seçimi.', 'INVALID_QUERY', 400);
  const exact = exactValue === true || exactValue === 'true';
  const sort = String(input.sort || 'best');
  const page = Number(input.page ?? 1);
  if (q.length > 100 || !SORTS.has(sort) || !Number.isInteger(page) || page < 1 || page > 417) {
    throw new EbayError('Arama en fazla 100 karakter olmalı; sayfa ve sıralama geçerli olmalıdır.', 'INVALID_QUERY', 400);
  }
  const filters = [];
  if (flags.used) filters.push('conditionIds:{3000}');
  if (flags.business) filters.push('sellerAccountTypes:{BUSINESS}');
  if (flags.germany) filters.push('itemLocationCountry:DE');
  const params = new URLSearchParams({ category_ids: '6030', limit: '24', offset: String((page - 1) * 24) });
  if (filters.length) params.set('filter', filters.join(','));
  if (q) params.set('q', q);
  // Browse API price/-price sorts the full result set by item price + shipping cost.
  if (sort !== 'best') params.set('sort', sort);
  const exactPartNumber = exact ? q.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
  if (exact && exactPartNumber.length < 3) throw new EbayError('Tam eşleşme için geçerli bir parça numarası gereklidir.', 'INVALID_QUERY', 400);
  return { q, sort, page, params, flags, exact, exactPartNumber };
}

function containsExactPartNumber(item, partNumber) {
  if (!partNumber) return true;
  const flexibleNumber = [...partNumber].map(character => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s._/-]*');
  const matcher = new RegExp(`(?:^|[^A-Z0-9])${flexibleNumber}(?=$|[^A-Z0-9])`, 'i');
  // In exact mode the number must be visible in the listing title. This avoids
  // loosely related results whose number appears only in hidden metadata.
  return matcher.test(String(item.title || ''));
}

function safeUrl(value, kind) {
  try {
    const url = new URL(value);
    const allowed = kind === 'image' ? /(^|\.)ebayimg\.com$/i : /(^|\.)ebay\.(de|com)$/i;
    return url.protocol === 'https:' && allowed.test(url.hostname) ? url.href : null;
  } catch { return null; }
}

class EbayClient {
  constructor({ env = process.env, fetchImpl = fetch } = {}) {
    this.env = env;
    this.fetch = fetchImpl;
    this.token = null;
    this.tokenPending = null;
    this.cache = new Map();
    this.statisticsCache = new Map();
    this.pending = new Map();
    this.imageCache = new Map();
  }

  async images(id) {
    if (typeof id !== 'string' || !/^v1\|\d+\|\d+$/.test(id)) throw new EbayError('Geçersiz eBay ilan kimliği.', 'INVALID_QUERY', 400);
    const cached = this.imageCache.get(id);
    if (cached && cached.expires > Date.now()) return cached.value;
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      result = await this.request(`https://api.ebay.com/buy/browse/v1/item/${encodeURIComponent(id)}`, {
        headers: { Authorization: `Bearer ${await this.accessToken()}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_DE' }
      });
      if (result.response.status !== 401) break;
      this.token = null;
    }
    if (!result.response.ok) throw new EbayError('İlan görselleri şu anda alınamıyor.', 'EBAY_IMAGES');
    const value = { images: [...new Set([result.body.image, ...(result.body.additionalImages || [])].map(img => safeUrl(img?.imageUrl, 'image')).filter(Boolean))] };
    if (this.imageCache.size >= 100) this.imageCache.delete(this.imageCache.keys().next().value);
    this.imageCache.set(id, { value, expires: Date.now() + 60000 });
    return value;
  }

  async request(url, options) {
    try {
      const response = await this.fetch(url, { ...options, signal: AbortSignal.timeout(20000) });
      const body = await response.json();
      return { response, body };
    } catch {
      throw new EbayError('eBay bağlantısı kurulamadı veya zaman aşımına uğradı. Lütfen tekrar deneyin.', 'EBAY_CONNECTION');
    }
  }

  async accessToken() {
    if (this.token && this.token.expires > Date.now()) return this.token.value;
    if (this.tokenPending) return this.tokenPending;
    this.tokenPending = this.mintToken();
    try { return await this.tokenPending; } finally { this.tokenPending = null; }
  }

  async browse(params) {
    let result;
    for (let attempt = 0; attempt < 2; attempt++) {
      const token = await this.accessToken();
      result = await this.request(`https://api.ebay.com/buy/browse/v1/item_summary/search?${params}`, {
        headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': 'EBAY_DE', 'Accept-Language': 'de-DE' }
      });
      if (result.response.status !== 401) break;
      this.token = null;
    }
    return result;
  }

  async mintToken() {
    const app = this.env.EBAY_PRODUCTION_APP_ID?.trim();
    const secret = this.env.EBAY_PRODUCTION_CERT_ID?.trim();
    if (!app || !secret) throw new EbayError('Sunucuda eBay Production App ID ve Cert ID tanımlanmalıdır.', 'EBAY_CONFIG', 503);
    const { response, body } = await this.request('https://api.ebay.com/identity/v1/oauth2/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${Buffer.from(`${app}:${secret}`).toString('base64')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'client_credentials', scope: 'https://api.ebay.com/oauth/api_scope' }).toString()
    });
    if (!response.ok || !body.access_token) {
      if (body.error === 'unauthorized_client') throw new EbayError('eBay uygulama anahtarları client_credentials yöntemiyle token almaya yetkili değil (unauthorized_client). eBay Developer hesabında Production anahtarlarının OAuth / Browse API erişimi kontrol edilmelidir.', 'EBAY_UNAUTHORIZED_CLIENT', 503);
      if (response.status === 429) throw new EbayError('eBay istek sınırına ulaşıldı. Bir süre sonra tekrar deneyin.', 'EBAY_RATE_LIMIT', 429);
      throw new EbayError('eBay uygulama kimliği doğrulanamadı. Production App ID ve Cert ID bilgilerini kontrol edin.', 'EBAY_AUTH', 503);
    }
    this.token = { value: body.access_token, expires: Date.now() + Math.max(0, (Number(body.expires_in) || 7200) - 60) * 1000 };
    return this.token.value;
  }

  async search(input) {
    const query = parameters(input);
    const key = `${query.params}|exact=${query.exact ? query.exactPartNumber : ''}`;
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return { ...cached.value, cached: true };
    if (this.pending.has(key)) return this.pending.get(key);
    if (this.pending.size >= 8) throw new EbayError('Arama servisi meşgul. Lütfen kısa süre sonra tekrar deneyin.', 'EBAY_BUSY', 429);
    const task = this.searchRemote(query);
    this.pending.set(key, task);
    try {
      const value = await task;
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value);
      this.cache.set(key, { value, expires: Date.now() + 60000 });
      return value;
    } finally { this.pending.delete(key); }
  }

  async searchRemote(query) {
    const result = await this.browse(query.params);
    const { response, body } = result;
    if (!response.ok) {
      if (response.status === 429) throw new EbayError('eBay istek sınırına ulaşıldı. Bir süre sonra tekrar deneyin.', 'EBAY_RATE_LIMIT', 429);
      if ([401, 403].includes(response.status)) throw new EbayError('eBay Browse API erişimi reddedildi. Uygulamanın Production Browse API yetkisini kontrol edin.', 'EBAY_ACCESS', 503);
      throw new EbayError('eBay arama isteğini tamamlayamadı. Lütfen tekrar deneyin.', 'EBAY_SEARCH');
    }
    // Seller account type is enforced by the API filter; location and condition are checked again here.
    const matchesQuery = item =>
      (!query.flags.germany || item.itemLocation?.country === 'DE') &&
      (!query.flags.used || String(item.conditionId) === '3000') &&
      containsExactPartNumber(item, query.exactPartNumber);
    const items = (body.itemSummaries || []).filter(matchesQuery).map(item => ({
      id: item.itemId, title: item.title, image: safeUrl(item.image?.imageUrl, 'image'),
      images: [...new Set([item.image, ...(item.additionalImages || [])].map(img => safeUrl(img?.imageUrl, 'image')).filter(Boolean))],
      url: safeUrl(item.itemWebUrl, 'link'), price: item.price || null,
      shipping: item.shippingOptions?.[0]?.shippingCost || null,
      seller: item.seller?.username || '', feedbackPercentage: item.seller?.feedbackPercentage || null,
      feedbackScore: Number.isInteger(item.seller?.feedbackScore) ? item.seller.feedbackScore : null,
      // Browse Seller exposes feedback, but no seller-wide total sales count.
      sellerTotalSales: null,
      location: [item.itemLocation?.city, item.itemLocation?.postalCode].filter(Boolean).join(' '),
      condition: item.condition || null
    })).filter(item => item.url);
    const marketParams = new URLSearchParams(query.params);
    marketParams.set('limit', '200');
    marketParams.set('offset', '0');
    // Statistics must not inherit the visible page's price sorting/offset.
    marketParams.delete('sort');
    const statisticsKey = `${marketParams}|exact=${query.exactPartNumber}`;
    let statistics = this.statisticsCache.get(statisticsKey);
    if (!statistics || statistics.expires <= Date.now()) {
      const firstMarketResult = await this.browse(marketParams);
      if (!firstMarketResult.response.ok) throw new EbayError('eBay fiyat istatistikleri alınamadı.', 'EBAY_SEARCH');
      const firstMarketBody = firstMarketResult.body;
      const maximumRecords = Math.min(Number(firstMarketBody.total) || 0, 10000);
      const summaries = [...(firstMarketBody.itemSummaries || [])];
      const offsets = [];
      for (let offset = 200; offset < maximumRecords; offset += 200) offsets.push(offset);
      // Small concurrent batches keep a multi-page search responsive without
      // flooding the Browse API.
      for (let start = 0; start < offsets.length; start += 4) {
        const batch = await Promise.all(offsets.slice(start, start + 4).map(async offset => {
          const params = new URLSearchParams(marketParams);
          params.set('offset', String(offset));
          const pageResult = await this.browse(params);
          if (!pageResult.response.ok) throw new EbayError('eBay fiyat istatistikleri alınamadı.', 'EBAY_SEARCH');
          return pageResult.body.itemSummaries || [];
        }));
        batch.forEach(pageItems => summaries.push(...pageItems));
      }
      const matchingSummaries = summaries.filter(matchesQuery);
      let shippingKnownCount = 0;
      let shippingUnknownCount = 0;
      const marketPrices = matchingSummaries.map(item => {
        const price = item.price?.currency === 'EUR' ? Number(item.price.value) : NaN;
        const shippingCost = item.shippingOptions?.[0]?.shippingCost;
        const shipping = shippingCost?.currency === 'EUR' ? Number(shippingCost.value) : NaN;
        if (!Number.isFinite(price) || price < 0) return null;
        // Every listing with a valid EUR item price belongs in the market
        // calculation. Add shipping when eBay supplies it; an unspecified
        // shipping price must not discard the whole listing.
        const shippingKnown = Number.isFinite(shipping) && shipping >= 0;
        if (shippingKnown) shippingKnownCount += 1;
        else shippingUnknownCount += 1;
        return price + (shippingKnown ? shipping : 0);
      }).filter(value => value !== null);
      statistics = { marketPrices, shippingKnownCount, shippingUnknownCount, exactTotal: matchingSummaries.length, expires: Date.now() + 60000 };
      if (this.statisticsCache.size >= 100) this.statisticsCache.delete(this.statisticsCache.keys().next().value);
      this.statisticsCache.set(statisticsKey, statistics);
    }
    const { marketPrices, shippingKnownCount, shippingUnknownCount } = statistics;
    const resultTotal = query.exact ? statistics.exactTotal : body.total || 0;
    return { items, total: resultTotal, page: query.page, pageSize: 24, hasNext: Boolean(body.next) && query.page < 417,
      query: query.q, sort: query.sort, fetchedAt: new Date().toISOString(), cached: false,
      marketPrices, marketRecordCount: marketPrices.length, shippingKnownCount, shippingUnknownCount,
      exactPartNumber: query.exactPartNumber || null,
      marketplace: 'EBAY_DE', filters: { conditionId: query.flags.used ? '3000' : null, sellerAccountType: query.flags.business ? 'BUSINESS' : null, itemLocationCountry: query.flags.germany ? 'DE' : null } };
  }
}

module.exports = { EbayClient, EbayError, parameters, containsExactPartNumber };
