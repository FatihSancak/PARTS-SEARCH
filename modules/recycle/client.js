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

class RecycleClient {
  constructor() {
    this.browser = null;
    this.page = null;
    this.loggedIn = false;
    this.activeSearch = null;
    this.cache = new Map();
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
    const oeNumber = normalizePartNumber(criteria.OENumber || criteria.partNumber);
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
    const query = typeof partNumber === 'object' ? partNumber : normalizePartNumber(partNumber);
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

  search(partNumber) {
    this.cancelled = false;
    const key = normalizePartNumber(partNumber);
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
