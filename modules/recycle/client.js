'use strict';

const { chromium } = require('playwright-core');
const { loadConfig } = require('./config');

const normalizePartNumber = (value) => String(value || '')
  .toUpperCase()
  .replace(/Ä/g, 'A')
  .replace(/Ö/g, 'O')
  .replace(/Ü/g, 'U')
  .replace(/ß/g, 'SS')
  .replace(/İ/g, 'I')
  .replace(/İ/g, 'I')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9]/g, '');

const normalizeRecyclePartNumber = (value) => String(value || '')
  .toUpperCase()
  .replace(/Ä/g, 'A')
  .replace(/Ö/g, 'O')
  .replace(/Ü/g, 'U')
  .replace(/ß/g, 'SS')
  .replace(/İ/g, 'I')
  .replace(/İ/g, 'I')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^A-Z0-9*]/g, '');

// Order details are legacy HTML tables. Field positions vary by sales channel,
// so extract label/value pairs instead of relying on a fixed column index.
const orderDetailFields = (html) => {
  const decode = (value) => String(value || '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#(?:x([0-9a-f]+)|(\d+));/gi, (_, hex, decimal) => String.fromCodePoint(parseInt(hex || decimal, hex ? 16 : 10)))
    .replace(/\s+/g, ' ').trim();
  const result = {};
  let physicalStorageFound = false;
  // Recycle renders the physical "Lager" value separately from its order
  // state. Read it first so that "reserviert Nein" can never become a depot.
  for (const labelMatch of String(html || '').matchAll(/(?:^|>)\s*Lager\s*(?=<|:)/gi)) {
    const afterLabel = String(html || '').slice(labelMatch.index, labelMatch.index + 1400);
    const nextField = afterLabel.search(/<td\b[^>]*class\s*=\s*["'][^"']*fieldname/i);
    const section = afterLabel.slice(0, nextField > 0 ? nextField : afterLabel.length);
    const fixSet = section.match(/FixSet\(\s*['"][^'"]*['"]\s*,\s*['"]([^'"]*)['"]/i);
    const input = section.match(/<input\b[^>]*>/i)?.[0];
    const valueMatch = input?.match(/\bvalue\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const rawValue = fixSet?.[1] || valueMatch?.[1] || valueMatch?.[2] || valueMatch?.[3] || '';
    const value = decode(String(rawValue).replace(/\s*<br\s*\/?>(?:\s*)/gi, ' · '));
    if (value && !/^(?:null|undefined|fixset\s*\(|reserviert\b)/i.test(value)) {
      result.location = value;
      physicalStorageFound = true;
      break;
    }
  }
  // The part-detail page stores its internal article number in a legacy
  // JavaScript field instead of a visible "Artikelnummer" table cell.
  for (const match of String(html || '').matchAll(/FixSet\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]*)['"]/gi)) {
    const label = match[1].replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
    if (!result.articleNumber && /^(teilenummer|artikelnummer|artikelnr|artnr)$/.test(label)) result.articleNumber = decode(match[2]);
  }
  for (const row of String(html || '').matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)].map(cell => decode(cell[1]));
    for (let index = 0; index < cells.length - 1; index += 1) {
      const label = cells[index].replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
      const value = cells[index + 1];
      if (!value) continue;
      if (!result.articleNumber && /^(artikelnummer|artikelnr|artnr)$/.test(label)) result.articleNumber = value;
      if (/^(lager|lagerort|lagerplatz)$/.test(label) && !physicalStorageFound && !/^reserviert\b/i.test(value)) result.location = value;
      if (!result.total && /^(gesamt(?:betrag|summe)?|summe|rechnungsbetrag|endbetrag|brutto)$/.test(label) && /(?:€|EUR)/i.test(value)) result.total = value;
    }
    const rowText = decode(row[1]);
    if (!result.articleNumber) {
      const match = rowText.match(/(?:artikel\s*(?:nummer|nr\.?)|art\.?\s*nr\.?)\s*:?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i);
      if (match) result.articleNumber = match[1];
    }
    if (!result.location) {
      const match = rowText.match(/(?:lagerort|lagerplatz)\s*:?\s*([A-Z0-9][A-Z0-9._/ -]{0,60}?)(?=\s{2,}|$)/i);
      if (match) result.location = match[1].trim();
    }
    if (!result.total) {
      const match = rowText.match(/(?:gesamt(?:betrag|summe)?|rechnungsbetrag|endbetrag|summe)\s*:?\s*([\d.,\s]+(?:€|EUR))/i);
      if (match) result.total = match[1].trim();
    }
  }
  // Some Recycle templates put fields in nested tables or divs, where a
  // row-based parser cannot see the label/value cells together.
  const allText = decode(String(html || '').replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ''));
  if (!result.articleNumber) {
    const match = allText.match(/(?:artikel\s*[-.]?\s*(?:nummer|nr\.?)|art\.?\s*nr\.?)\s*:?\s*([A-Z0-9][A-Z0-9._/-]{2,})/i);
    if (match) result.articleNumber = match[1];
  }
  if (!result.oldArticleNumber) {
    const match = allText.match(/alte\s+teilenummer\s*:\s*([A-Z0-9][A-Z0-9._/-]{2,})/i);
    if (match) result.oldArticleNumber = match[1];
  }
  if (!result.location) {
    const match = allText.match(/(?:lagerort|lagerplatz)\s*:?\s*([A-Z0-9][A-Z0-9._/ -]{0,60}?)(?=\s{2,}|(?:artikel|verkaufs|einkaufs|preis|menge|status)\b|$)/i);
    if (match) result.location = match[1].trim();
  }
  if (!result.location) {
    const match = allText.match(/\blager\s*:?\s*(.+?)(?=\s+(?:reserviert|status|qualität|qualit.t|verkaufspreis)\b)/i);
    if (match && match[1].trim() !== '-' && !/^(?:null|fixset|false|true)/i.test(match[1].trim())) result.location = match[1].trim();
  }
  if (!result.brand) {
    const match = allText.match(/\bhersteller\s*:?\s*(.+?)(?=\s+modell\b)/i);
    if (match) result.brand = match[1].trim();
  }
  if (!result.model) {
    const match = allText.match(/\bmodell\s*:?\s*(.+?)(?=\s+typ\b)/i);
    if (match) result.model = match[1].trim();
  }
  if (!result.type) {
    const match = allText.match(/\btyp\s*:?\s*(.+?)(?=\s+(?:leistung|hubraum|bauzeit|weitere\s+verwendungen)\b)/i);
    if (match) result.type = match[1].trim();
  }
  if (!result.total) {
    const match = allText.match(/(?:gesamt(?:betrag|summe)?|rechnungsbetrag|endbetrag|summe)\s*:?\s*([\d.,\s]+(?:€|EUR))/i);
    if (match) result.total = match[1].trim();
  }
  // A reservation state is never a storage location. Hide it if this legacy
  // template did not supply a real Lager/Lagerort field.
  if (/^reserviert\b/i.test(String(result.location || '').trim())) delete result.location;
  return result;
};

class RecycleClient {
  constructor() {
    this.browser = null;
    this.page = null;
    this.loggedIn = false;
    this.activeSearch = null;
    this.cache = new Map();
    this.imageCache = new Map();
    this.vehicleImageCache = new Map();
    this.orderImageCache = new Map();
    this.cancelled = false;
  }

  status() {
    const config = loadConfig();
    return {
      enabled: Boolean(config.username && config.password),
      credentialsConfigured: Boolean(config.username && config.password),
      sessionActive: Boolean(this.browser && this.loggedIn)
    };
  }

  async ensurePage() {
    if (this.page && !this.page.isClosed()) return this.page;
    this.browser = await chromium.launch({ channel: 'msedge', headless: true });
    const context = await this.browser.newContext({ locale: 'de-DE', viewport: { width: 1440, height: 1000 } });
    this.page = await context.newPage();
    return this.page;
  }

  async login() {
    const config = loadConfig();
    if (!config.username || !config.password) {
      const error = new Error('Recycle kullanıcı adı ve şifresi yapılandırılmamış.');
      error.statusCode = 503;
      throw error;
    }
    const page = await this.ensurePage();
    page.setDefaultTimeout(config.timeoutMs);
    try {
      await page.goto(config.loginUrl, { waitUntil: 'domcontentloaded' });
      await page.locator('input[name="username"]').fill(config.username);
      await page.locator('input[name="password"]').fill(config.password);
      await Promise.all([
        page.waitForLoadState('domcontentloaded').catch(() => {}),
        page.locator('form[name="LoginForm"] input[type="submit"]').click()
      ]);
      await page.waitForTimeout(1000);
      if (!page.frame({ name: 'CONTENT' }) || !page.frame({ name: 'MENU' })) throw new Error('login-failed');
      this.loggedIn = true;
    } catch (_) {
      throw new Error('Recycle girişi tamamlanamadı. Kullanıcı adı ve şifreyi kontrol edin.');
    }
  }

  buildSearchUrl(search) {
    const criteria = search && typeof search === 'object' ? search : { OENumber: search };
    const oeNumber = normalizeRecyclePartNumber(criteria.OENumber || criteria.partNumber);
    const internalRemarks = String(criteria.internalRemarks || '').trim();
    const url = new URL('/recycle/partsearch.do', 'https://recycle.baytemuer.de');
    const fields = {
      select: '', sparePartsToDisposallist: '', searchid: '6', code: '', name: '', partpk: '', partname: criteria.partName || '',
      typeCode: '', typeName: criteria.typeName || '', modelCode: '', modelName: criteria.modelName || '', manufacturerCode: '', manufacturerName: criteria.manufacturerName || '',
      mode: 'Disassembled', reservationBool: 'Alle', serviceClientId_PK: '', motorCode: criteria.motorCode || '', gearBoxCode: criteria.gearBoxCode || '',
      vehicleCode: '', internalVehicleCode: '', OENumber: oeNumber, beonBool: 'false', boolNoPricing: 'false',
      relevantHazardousBool: 'false', clustersearch: 'false', catalogId: 'all', otherCatalogId: '', locationId: '',
      kw: '', displacement: '', constructionTime: '', storage: '', storageCode: '', remarks: '', internalRemarks,
      deliveryCode: '', preproduction: 'false', grouping: '', chassis: '', state: '', refSpId: ''
    };
    for (const [key, value] of Object.entries(fields)) url.searchParams.set(key, value);
    return url.toString();
  }

  async performSearch(partNumber) {
    if (!this.loggedIn) await this.login();
    const page = await this.ensurePage();
    const query = typeof partNumber === 'object' ? partNumber : normalizeRecyclePartNumber(partNumber);
    const searchUrl = this.buildSearchUrl(query);
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    if (await page.locator('input[name="password"]').count()) {
      this.loggedIn = false;
      await this.login();
      await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    }

    const results = await page.locator('[onclick*="partSelect("]').evaluateAll((clickables) => {
      const output = [];
      for (const clickable of clickables) {
        const onclick = clickable.getAttribute('onclick') || '';
        const match = onclick.match(/partSelect\(['"]([^'"]+)['"]\)/);
        if (!match) continue;
        const row = clickable.closest('tr');
        if (!row) continue;
        if (row.querySelector("img[alt='verkauft']")) continue;
        const cells = [...row.querySelectorAll(':scope > td')];
        if (cells.length < 8) continue;
        const cellText = (index) => String(cells[index]?.innerText || '').replace(/\u00a0/g, ' ').trim();
        const partLines = cellText(2).split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
        const productName = partLines[0] || 'Recycle Produkt';
        const motorCode = partLines.find((line) => /^Motorcode=/i.test(line))?.split('=').slice(1).join('=').trim() || '';
        const gearboxCode = partLines.find((line) => /^Getriebecode=/i.test(line))?.split('=').slice(1).join('=').trim() || '';
        const oeStart = partLines.findIndex((line) => /^OE-Nummern:/i.test(line));
        const oeNumbers = oeStart >= 0 ? partLines.slice(oeStart).join(' ').replace(/^OE-Nummern:\s*/i, '') : '';
        const url = new URL('spare_part_show.do', location.href);
        url.searchParams.set('PartPK', match[1]);
        url.searchParams.set('select', '');
        url.searchParams.set('searchId', '20');
        url.searchParams.set('fromSearch', '1');
        output.push({
          url: url.toString(),
          partPk: match[1],
          hasImages: Boolean(row.querySelector("img[alt='Foto(s)']")),
          code: cellText(1),
          productName,
          motorCode,
          gearboxCode,
          oeNumbers,
          status: cellText(3).replace(/\s+/g, ' '),
          vehicle: cellText(4).replace(/\s+/g, ' '),
          storage: cellText(5).replace(/\s+/g, ' · '),
          netPrice: cellText(6).replace(/\s+/g, ' '),
          price: cellText(7).replace(/\s+/g, ' '),
          title: `${cellText(1)} ${productName}`.trim()
        });
      }
      return output;
    });
    const unique = [...new Map(results.map((item) => [item.url, item])).values()];
    return { partNumber: typeof partNumber === 'object' ? JSON.stringify(partNumber) : partNumber, query, status: unique.length ? 'FOUND' : 'NOT_FOUND', count: unique.length, results: unique };
  }

  async getProductImages(partPk) {
    const id = String(partPk || '').trim();
    if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) {
      const error = new Error('Geçerli bir Recycle parça kimliği gereklidir.');
      error.statusCode = 400;
      throw error;
    }
    const cached = this.imageCache.get(id);
    if (cached && cached.result.fields && Date.now() - cached.createdAt < 30 * 60 * 1000) return cached.result;
    if (!this.loggedIn) await this.login();
    const page = await this.ensurePage();
    const detailUrl = new URL('/recycle/spare_part_show.do', 'https://recycle.baytemuer.de');
    detailUrl.searchParams.set('PartPK', id);
    detailUrl.searchParams.set('select', '');
    detailUrl.searchParams.set('searchId', '20');
    detailUrl.searchParams.set('fromSearch', '1');
    const response = await page.context().request.get(detailUrl.toString());
    if (!response.ok()) {
      const error = new Error('Recycle görselleri alınamadı.');
      error.statusCode = 502;
      throw error;
    }
    const html = await response.text();
    const images = [];
    const seen = new Set();
    for (const match of html.matchAll(/goImage\(\s*['"]([^'"]+)['"]\s*\)/gi)) {
      const decoded = match[1].replace(/&amp;/g, '&');
      let imageUrl;
      try { imageUrl = new URL(decoded, detailUrl).toString(); } catch { continue; }
      const parsed = new URL(imageUrl);
      if (parsed.protocol !== 'https:' || parsed.hostname !== 'recycle.baytemuer.de') continue;
      if (!parsed.pathname.startsWith('/Baytemuer/artikel/bilder/shop/') || !/\.(?:jpe?g|png|webp)$/i.test(parsed.pathname)) continue;
      if (!seen.has(imageUrl)) { seen.add(imageUrl); images.push(imageUrl); }
      if (images.length >= 20) break;
    }
    const thumbnail = images[0] ? images[0].replace(/\/([^/]+)$/, '/th$1') : '';
    const result = { partPk: id, count: images.length, thumbnail, images, fields: orderDetailFields(html) };
    this.imageCache.set(id, { createdAt: Date.now(), result });
    return result;
  }

  async getProductImage(partPk, imageIndex) {
    const index = Number(imageIndex);
    if (!Number.isInteger(index) || index < 0 || index >= 20) {
      const error = new Error('Geçerli bir görsel sırası gereklidir.');
      error.statusCode = 400;
      throw error;
    }
    const images = await this.getProductImages(partPk);
    const imageUrl = images.images[index];
    if (!imageUrl) {
      const error = new Error('Görsel bulunamadı.');
      error.statusCode = 404;
      throw error;
    }
    const page = await this.ensurePage();
    const response = await page.context().request.get(imageUrl);
    if (!response.ok()) {
      const error = new Error('Recycle görseli alınamadı.');
      error.statusCode = 502;
      throw error;
    }
    const contentType = response.headers()['content-type'] || 'image/jpeg';
    if (!/^image\/(?:jpe?g|png|webp)$/i.test(contentType)) {
      const error = new Error('Recycle geçerli bir görsel döndürmedi.');
      error.statusCode = 502;
      throw error;
    }
    return { contentType, body: await response.body() };
  }

  async searchVehiclesByVinSuffix(vinSuffix) {
    const suffix = String(vinSuffix || '').trim().replace(/^\*/, '');
    if (!/^\d{5}$/.test(suffix)) { const error = new Error('VIN son 5 hanesi gerekli.'); error.statusCode = 400; throw error; }
    const key = `vehicle:${suffix}`;
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) return cached.result;
    if (this.activeSearch) { const error = new Error('Baska bir Recycle aramasi devam ediyor.'); error.statusCode = 429; throw error; }
    this.activeSearch = (async () => {
      if (!this.loggedIn) await this.login();
      const page = await this.ensurePage();
      await page.goto('https://recycle.baytemuer.de/recycle/vehicles_search.do', { waitUntil: 'domcontentloaded' });
      let frame;
      for (let attempt = 0; attempt < 30 && !frame; attempt += 1) {
        frame = page.frames().find((item) => item.name() === 'vehiclesearchlist');
        if (!frame) await page.waitForTimeout(200);
      }
      if (!frame) { const error = new Error('Recycle arac arama formu acilamadi.'); error.statusCode = 502; throw error; }
      await frame.locator('input[name="chassis"]').fill(`*${suffix}`);
      await frame.locator('form[name="vehiclesearch"]').evaluate((form) => form.requestSubmit());
      await frame.waitForTimeout(800);
      const html = await frame.content();
      const decode = (value) => String(value || '').replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/\s+/g, ' ').trim();
      const results = [];
      for (const row of html.matchAll(/<tr\b[^>]*class=["'][^"']*listcolumnBG[^"']*["'][^>]*>([\s\S]*?)<\/tr>/gi)) {
        const source = row[1]; const select = source.match(/vehicleSelect\(\s*['"]([^'"]+)['"]\s*,\s*['"]([^'"]+)['"]/i);
        if (!select) continue;
        const cells = [...source.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => decode(cell[1]));
        const text = decode(source); const id = select[1]; const vehicleNumber = select[2];
        results.push({ id, vehicleNumber, vin: text.match(/[A-HJ-NPR-Z0-9]{11,17}/i)?.[0] || '', title: cells.filter(Boolean).slice(1, 5).join(' · ') || vehicleNumber, detailUrl: `https://recycle.baytemuer.de/recycle/vehicle.do?vehicle=${encodeURIComponent(id)}` });
      }
      const unique = [...new Map(results.map((item) => [item.id, item])).values()].slice(0, 20);
      const enriched = await Promise.all(unique.map(async (item) => { const details = await this.getVehicleImages(item.id).catch(() => ({ count: 0, fields: {} })); return { ...item, ...details.fields, imageCount: details.count }; }));
      const result = { query: `*${suffix}`, count: enriched.length, results: enriched };
      this.cache.set(key, { createdAt: Date.now(), result }); return result;
    })().catch(async (error) => { await this.close(); throw error; }).finally(() => { this.activeSearch = null; });
    return this.activeSearch;
  }

  async getVehicleImages(vehicleId) {
    const id = String(vehicleId || '').trim();
    if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) { const error = new Error('Gecerli Recycle arac kimligi gerekli.'); error.statusCode = 400; throw error; }
    const cached = this.vehicleImageCache.get(id); if (cached && Date.now() - cached.createdAt < 30 * 60 * 1000) return cached.result;
    if (!this.loggedIn) await this.login(); const page = await this.ensurePage(); const detailUrl = `https://recycle.baytemuer.de/recycle/vehicle.do?vehicle=${encodeURIComponent(id)}`;
    const response = await page.context().request.get(detailUrl); if (!response.ok()) { const error = new Error('Recycle arac detayi alinamadi.'); error.statusCode = 502; throw error; }
    const html = await response.text(); const field = (name) => html.match(new RegExp(`name=["']${name}["'][^>]*value=["']([^"']*)`, 'i'))?.[1]?.trim() || '';
    const fields = { brand: field('manufacturerName'), model: field('modelName'), type: field('typeName'), vin: field('chassisNumber'), plate: field('licenseNumber'), motorCode: field('motorcode'), gearboxCode: field('gearboxcode') };
    const images = []; const seen = new Set();
    for (const match of html.matchAll(/(?:goImage\(\s*['"]|<img\b[^>]*src=["'])([^'"]+)/gi)) {
      const raw = match[1].replace(/&amp;/g, '&'); if (/^(?:bilder\/|\/recycle\/bilder\/|media_upload|create\.gif|pixel\.gif)/i.test(raw)) continue;
      try { const imageUrl = new URL(raw, detailUrl); if (imageUrl.protocol === 'https:' && imageUrl.hostname === 'recycle.baytemuer.de' && !seen.has(imageUrl.toString())) { seen.add(imageUrl.toString()); images.push(imageUrl.toString()); } } catch { /* legacy link */ }
      if (images.length >= 20) break;
    }
    const result = { vehicleId: id, count: images.length, images, fields }; this.vehicleImageCache.set(id, { createdAt: Date.now(), result }); return result;
  }

  async getVehicleImage(vehicleId, imageIndex) {
    const result = await this.getVehicleImages(vehicleId); const imageUrl = result.images[Number(imageIndex)];
    if (!imageUrl) { const error = new Error('Gorsel bulunamadi.'); error.statusCode = 404; throw error; }
    const page = await this.ensurePage(); const response = await page.context().request.get(imageUrl);
    if (!response.ok()) { const error = new Error('Recycle arac gorseli alinamadi.'); error.statusCode = 502; throw error; }
    return { contentType: response.headers()['content-type'] || 'image/jpeg', body: await response.body() };
  }

  async getOrders(criteria = {}) {
    if (!this.loggedIn) await this.login();
    const number = (value, min, max, fallback) => {
      const parsed = Number.parseInt(value, 10);
      return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
    };
    const from = criteria.from || {};
    const to = criteria.to || {};
    const now = new Date();
    const start = { day: number(from.day, 1, 31, 1), month: number(from.month, 1, 12, now.getMonth() + 1), year: number(from.year, 2020, 2100, now.getFullYear()) };
    const end = { day: number(to.day, 1, 31, now.getDate()), month: number(to.month, 1, 12, now.getMonth() + 1), year: number(to.year, 2020, 2100, now.getFullYear()) };
    const url = new URL('/recycle/commissioning.do', 'https://recycle.baytemuer.de');
    const fields = {
      orderStatusOption: 'PROCESSING', startOrderDateTag: start.day, startOrderDateMonat: start.month, startOrderDateJahr: start.year,
      orderCode: '', paymentReceivedOption: 'all', orderTypeOption: 'all', endOrderDateTag: end.day, endOrderDateMonat: end.month,
      endOrderDateJahr: end.year, partCode: '', freightOrderedOption: 'all', productStatusOption: 'all', commissioningStatusOption: 'all',
      confirmationOfArrivalReceivedOption: 'all', saleChannelOption: 'all', paymentModeOption: 'all', ebayNumber: '', search: 'Suchen', action: 'show'
    };
    Object.entries(fields).forEach(([key, value]) => url.searchParams.set(key, String(value)));
    const page = await this.ensurePage();
    await page.goto(url.toString(), { waitUntil: 'domcontentloaded' });
    if (await page.locator('input[name="password"]').count()) { this.loggedIn = false; await this.login(); await page.goto(url.toString(), { waitUntil: 'domcontentloaded' }); }
    const content = page.frame({ name: 'CONTENT' }) || page;
    await content.waitForLoadState('domcontentloaded').catch(() => {});
    const showOrderFunction = await content.evaluate(() => typeof window.showOrder === 'function' ? String(window.showOrder) : '');
    const rows = await content.locator('tr').evaluateAll((tableRows) => tableRows.map((row) => {
      const cells = [...row.querySelectorAll(':scope > td')];
      // The commissioning page starts with a filter form laid out in table
      // rows. Those rows contain form controls and must never be displayed as
      // orders.
      // Real orders also have a checkbox. Only select controls belong to the
      // filter form, so a checkbox must not discard an order row.
      if (cells.length < 3 || row.querySelector('select, textarea, button')) return null;
      const rowText = cells.map(cell => String(cell.innerText || '').replace(/\s+/g, ' ').trim()).join(' | ');
      if (/AuftragsNr\.?\s*\|.*(?:Verkaufskanal|Komm\.-Status|Läger)/i.test(rowText)) return null;
      const text = (i) => String(cells[i]?.innerText || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
      const image = row.querySelector('img[src]');
      const links = [...row.querySelectorAll('a')].map(link => ({ href: link.getAttribute('href') || '', onclick: link.getAttribute('onclick') || '', label: String(link.innerText || '').replace(/\s+/g, ' ').trim() }));
      return { cells: cells.map((_, i) => text(i)), imageUrl: image ? new URL(image.getAttribute('src'), location.href).toString() : '', links };
    }).filter(Boolean));
    const basicOrders = rows.map((row, index) => {
      const values = row.cells.filter(Boolean);
      const imageId = row.imageUrl ? `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 10)}` : '';
      if (imageId) this.orderImageCache.set(imageId, { url: row.imageUrl, createdAt: Date.now() });
      const price = values.find(value => /(?:€|EUR)/i.test(value)) || '';
      // Verkaufskanal is the eighth column on Recycle's commissioning list;
      // do not mistake the adjacent payment method for the sales channel.
      const source = values[7] || values.find(value => /\b(eBay|Ovoko|Teilehaber|Autoteilemarkt|PartsBits|Opisto)\b/i.test(value)) || '';
      const location = values.find(value => /(?:lager(?:ort|platz)?|storage|shelf|regal|fach)\s*[:#-]/i.test(value)) || '';
      const orderLink = row.links.find(link => /(?:commission|order|auftrag|showOrder)/i.test(`${link.href} ${link.onclick}`));
      // Some Recycle rows use an inline showOrder(...) handler instead of a
      // navigable href. Keep that handler so the detail request still works.
      const orderUrl = orderLink?.href && !/^\s*(?:#|javascript:void\(0\))\s*$/i.test(orderLink.href) ? orderLink.href : (orderLink?.onclick || '');
      return { id: String(index + 1), orderCode: values[0] || '', date: values.find(value => /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(value)) || '', name: values.find(value => value.length > 4 && !/(?:€|EUR|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/i.test(value)) || '', price, source, location, imageId, orderUrl, links: row.links, raw: values };
    });
    const orders = await Promise.all(basicOrders.map(async order => {
      if (!order.orderUrl) return order;
      try {
        const action = order.orderUrl.match(/showOrder\(\s*["']([A-Za-z0-9-]+)["'](?:\s*,\s*["']([A-Za-z0-9-]+)["'])?\s*\)/i);
        const detailUrl = action ? `https://recycle.baytemuer.de/recycle/showorder.do?pk=${encodeURIComponent(action[1])}${action[2] ? `&ipk=${encodeURIComponent(action[2])}` : ''}` : order.orderUrl;
        const response = await page.context().request.get(detailUrl);
        if (!response.ok()) return order;
        const html = await response.text();
        const fields = orderDetailFields(html);
        const detailLinks = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map(match => ({ href: match[1].replace(/&amp;/g, '&'), label: match[2].replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim() })).filter(link => link.label || /part|article|spare/i.test(link.href));
        const partMatch = html.match(/(?:PartPK|partPk)=([A-Za-z0-9-]{8,80})/i) || html.match(/ShowPart\(\s*["']([A-Za-z0-9-]{8,80})["']/i);
        if (!partMatch) return { ...order, ...fields, detailUrl, detailLinks };
        const partPk = partMatch[1];
        // In the order detail, the Name column contains the product link.
        const linkMatch = html.match(new RegExp(`<a[^>]+(?:PartPK|partPk)=${partPk}[^>]*>([\\s\\S]*?)<\\/a>`, 'i'));
        const productName = linkMatch ? String(linkMatch[1]).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim() : '';
        const nameLink = detailLinks.find(link => /ShowPart/i.test(link.href) && link.label);
        const partFields = await this.getProductFields(partPk).catch(() => ({}));
        // The commissioning-list row may describe reservation status as a
        // "Lagerort". Only a value resolved from the order/product detail is
        // a physical storage location.
        const resolvedLocation = partFields.location || fields.location || '';
        return {
          ...order,
          ...fields,
          ...partFields,
          location: resolvedLocation,
          price: fields.total || order.price,
          detailUrl,
          detailLinks,
          productUrl: `https://recycle.baytemuer.de/recycle/spare_part_show.do?PartPK=${encodeURIComponent(partPk)}&select=&searchId=20&fromSearch=1`,
          partPk,
          name: productName || nameLink?.label || order.name
        };
      } catch { return order; }
    }));
    return { range: { start, end }, count: orders.length, orders, showOrderFunction };
  }

  async getProductFields(partPk) {
    const id = String(partPk || '').trim();
    if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) return {};
    return (await this.getProductImages(id)).fields || {};
  }

  async getOrderImage(imageId) {
    const item = this.orderImageCache.get(String(imageId || ''));
    if (!item || Date.now() - item.createdAt > 30 * 60 * 1000) { const error = new Error('Sipariş görseli artık geçerli değil.'); error.statusCode = 404; throw error; }
    const imageUrl = new URL(item.url);
    if (imageUrl.protocol !== 'https:' || imageUrl.hostname !== 'recycle.baytemuer.de') { const error = new Error('Geçersiz görsel kaynağı.'); error.statusCode = 400; throw error; }
    const page = await this.ensurePage();
    const response = await page.context().request.get(imageUrl.toString());
    if (!response.ok()) { const error = new Error('Sipariş görseli alınamadı.'); error.statusCode = 502; throw error; }
    return { contentType: response.headers()['content-type'] || 'image/jpeg', body: await response.body() };
  }

  search(partNumber) {
    this.cancelled = false;
    const key = normalizeRecyclePartNumber(partNumber);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) return Promise.resolve(cached.result);
    if (this.activeSearch) {
      const error = new Error('Başka bir Recycle araması devam ediyor.');
      error.statusCode = 429;
      throw error;
    }
    this.activeSearch = this.performSearch(partNumber)
      .then((result) => { this.cache.set(key, { createdAt: Date.now(), result }); return result; })
      .catch(async (error) => { await this.close(); throw error; })
      .finally(() => { this.activeSearch = null; });
    return this.activeSearch;
  }

  async close() {
    if (this.browser) await this.browser.close().catch(() => {});
    this.browser = null;
    this.page = null;
    this.loggedIn = false;
  }

  async searchReferences(references) {
    this.cancelled = false;
    const unique = [];
    const seen = new Set();
    for (const item of references || []) {
      const reference = String(item?.reference || item || '').trim();
      const key = reference.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
      if (key.length < 4 || seen.has(key)) continue;
      seen.add(key);
      unique.push({ reference, group: String(item?.group || '').trim() });
      if (unique.length >= 200) break;
    }

    const products = new Map();
    let searched = 0;
    const searchByReference = async (item, query, cacheSuffix) => {
      const key = `${item.reference.replace(/[^A-Za-z0-9]/g, '').toUpperCase()}:${cacheSuffix}`;
      const cached = this.cache.get(key);
      let result;
      if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) {
        result = cached.result;
      } else {
        result = await this.performSearch(query);
        this.cache.set(key, { createdAt: Date.now(), result });
      }
      searched += 1;
      return result;
    };

    for (const item of unique) {
      if (this.cancelled) {
        const error = new Error('Recycle referans araması iptal edildi.');
        error.statusCode = 499;
        throw error;
      }
      const oeResult = await searchByReference(item, { OENumber: item.reference }, 'oe');
      const results = [...(oeResult.results || [])];
      if (!results.length) {
        const remarkResult = await searchByReference(item, { internalRemarks: `*${item.reference}*` }, 'remark');
        results.push(...(remarkResult.results || []));
      }
      for (const product of results) {
        const existing = products.get(product.url);
        const match = { reference: item.reference, group: item.group };
        if (existing) {
          if (!existing.matchedReferences.some((entry) => entry.reference === match.reference && entry.group === match.group)) {
            existing.matchedReferences.push(match);
          }
        } else {
          products.set(product.url, { ...product, matchedReferences: [match] });
        }
      }
    }
    return { searchedReferences: searched, totalReferences: unique.length, count: products.size, results: [...products.values()] };
  }

  async searchLocalItems(items) {
    this.cancelled = false;
    const rows = [];
    const searches = new Map();
    const clean = (value) => String(value || '').trim();
    const searchKey = (query) => JSON.stringify(query, Object.keys(query).sort());
    const addSearch = (query) => {
      const compactValues = Object.values(query).map(clean).filter(Boolean);
      if (!compactValues.length) return '';
      const key = searchKey(Object.fromEntries(Object.entries(query).filter(([, value]) => clean(value))));
      if (!searches.has(key)) searches.set(key, Object.fromEntries(Object.entries(query).map(([name, value]) => [name, clean(value)]).filter(([, value]) => value)));
      return key;
    };

    for (const item of items || []) {
      const index = Number(item?.index);
      if (!Number.isInteger(index) || index < 0) continue;
      const references = [];
      const oeSearchKeys = [];
      const internalRemarkSearchKeys = [];
      const seen = new Set();
      for (const raw of Array.isArray(item?.references) ? item.references : []) {
        const reference = String(raw || '').trim();
        const key = reference.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
        if (key.length < 4 || key.length > 40 || seen.has(key)) continue;
        seen.add(key);
        references.push(reference);
        oeSearchKeys.push(addSearch({ OENumber: reference }));
        internalRemarkSearchKeys.push(addSearch({ internalRemarks: `*${reference}*` }));
        if (references.length >= 5) break;
      }
      const uniqueOeSearchKeys = [...new Set(oeSearchKeys.filter(Boolean))];
      const uniqueInternalRemarkSearchKeys = [...new Set(internalRemarkSearchKeys.filter(Boolean))];
      if (uniqueOeSearchKeys.length || uniqueInternalRemarkSearchKeys.length) {
        rows.push({ index, references, oeSearchKeys: uniqueOeSearchKeys, internalRemarkSearchKeys: uniqueInternalRemarkSearchKeys });
      }
      if (searches.size >= 120) break;
    }

    const searchResults = new Map();
    let searched = 0;
    const runSearch = async (key) => {
      if (this.cancelled) {
        const error = new Error('Recycle yerel sonuc aramasi iptal edildi.');
        error.statusCode = 499;
        throw error;
      }
      if (searchResults.has(key)) return searchResults.get(key);
      const query = searches.get(key);
      if (!query) return { results: [] };
      const cached = this.cache.get(key);
      let result;
      if (cached && Date.now() - cached.createdAt < 10 * 60 * 1000) {
        result = cached.result;
      } else {
        result = await this.performSearch(query);
        this.cache.set(key, { createdAt: Date.now(), result });
      }
      searched += 1;
      searchResults.set(key, result);
      return result;
    };

    const matches = [];
    for (const row of rows) {
      const products = new Map();
      for (const key of row.oeSearchKeys) {
        const result = await runSearch(key);
        for (const product of result?.results || []) {
          if (!products.has(product.url)) {
            products.set(product.url, { ...product, matchedReference: row.references[0] || 'ESS', matchSource: 'OENumber' });
          }
        }
      }
      if (!products.size) {
        for (const key of row.internalRemarkSearchKeys) {
          const result = await runSearch(key);
          for (const product of result?.results || []) {
            if (!products.has(product.url)) {
              products.set(product.url, { ...product, matchedReference: row.references[0] || 'ESS', matchSource: 'Interne Bemerkung' });
            }
          }
        }
      }
      if (products.size) {
        matches.push({ index: row.index, count: products.size, results: [...products.values()].slice(0, 3) });
      }
    }
    return { searchedReferences: searched, matchedRows: matches.length, matches };
  }

  async cancel() {
    this.cancelled = true;
    await this.close();
  }
}

module.exports = RecycleClient;
