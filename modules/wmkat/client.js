'use strict';

const { chromium } = require('playwright-core');
const { loadConfig, validateRemoteUrl } = require('./config');

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

class WmkatClient {
  constructor() {
    this.browser = null;
    this.context = null;
    this.page = null;
    this.loggedIn = false;
    this.activeSearch = null;
    this.cache = new Map();
    this.cacheTtlMs = 30 * 60 * 1000;
  }

  status() {
    const config = loadConfig();
    return {
      enabled: Boolean(config.loginUrl && !config.missingCredentials.length),
      credentialsConfigured: config.missingCredentials.length === 0,
      loginUrlConfigured: Boolean(config.loginUrl),
      selectorsConfigured: Boolean(config.selectors.searchInput && config.selectors.referencesContainer),
      sessionActive: Boolean(this.browser && this.loggedIn)
    };
  }

  async ensurePage() {
    if (this.page && !this.page.isClosed()) return this.page;
    this.browser = await chromium.launch({ channel: 'msedge', headless: true });
    this.context = await this.browser.newContext({ locale: 'de-DE', viewport: { width: 1440, height: 1000 } });
    this.page = await this.context.newPage();
    return this.page;
  }

  async waitForCalm(page, timeoutMs = 15000) {
    await page.waitForLoadState('networkidle', { timeout: timeoutMs }).catch(() => {});
    await page.waitForTimeout(500);
  }

  async clickFirstVisible(locator, timeoutMs = 15000) {
    await locator.first().waitFor({ state: 'attached', timeout: timeoutMs }).catch(() => {});
    for (let index = 0; index < await locator.count(); index += 1) {
      const item = locator.nth(index);
      if (await item.isVisible().catch(() => false)) {
        await item.scrollIntoViewIfNeeded().catch(() => {});
        await item.click({ timeout: 5000 }).catch(() => item.click({ timeout: 5000, force: true }));
        return true;
      }
    }
    return false;
  }

  async login(config = loadConfig()) {
    if (config.missingCredentials.length) {
      throw new Error(`WMKAT kimlik bilgileri eksik: ${config.missingCredentials.join(', ')}`);
    }
    const page = await this.ensurePage();
    page.setDefaultTimeout(config.timeoutMs);
    try {
      await page.goto(validateRemoteUrl(config.loginUrl, 'WMKAT_LOGIN_URL'), { waitUntil: 'domcontentloaded' });

      const customer = page.locator(config.selectors.customerNumber);
      await customer.waitFor({ state: 'visible' });
      await customer.fill(config.credentials.customerNumber);
      if (!await this.clickFirstVisible(page.locator(config.selectors.loginSubmit))) {
        throw new Error('customer-submit');
      }

      const username = page.locator(config.selectors.username);
      await username.waitFor({ state: 'visible' });
      await username.fill(config.credentials.username);
      if (!await this.clickFirstVisible(page.locator(config.selectors.loginSubmit))) {
        throw new Error('username-submit');
      }

      const password = page.locator(config.selectors.password);
      await password.waitFor({ state: 'visible' });
      await password.fill(config.credentials.password);
      if (!await this.clickFirstVisible(page.locator(config.selectors.loginSubmit))) {
        throw new Error('password-submit');
      }
      await this.waitForCalm(page, config.timeoutMs);

      await this.openNumberSearch(config);
      await page.locator(config.selectors.loggedInMarker).first().waitFor({ state: 'visible', timeout: config.timeoutMs });
      this.loggedIn = true;
    } catch (_) {
      throw new Error('WMKAT üç aşamalı girişi tamamlanamadı. Bilgileri veya giriş adımlarını kontrol edin.');
    }
  }

  async openNumberSearch(config) {
    const page = await this.ensurePage();
    if (await page.locator(config.selectors.searchInput).first().isVisible().catch(() => false)) return;
    const tab = page.getByText('Nummernsuche', { exact: true });
    if (!await this.clickFirstVisible(tab, 15000)) throw new Error('WMKAT Nummernsuche ekranı bulunamadı.');
    await this.waitForCalm(page);
    await page.locator(config.selectors.searchInput).first().waitFor({ state: 'visible' });
  }

  async searchNumber(query, config) {
    const page = await this.ensurePage();
    await this.openNumberSearch(config);
    const input = page.locator(config.selectors.searchInput).first();
    await input.fill(query);
    const clicked = await this.clickFirstVisible(page.locator(config.selectors.searchSubmit), 5000);
    if (!clicked) await input.press('Enter');
    await this.waitForCalm(page, config.timeoutMs);
  }

  async openReferenceTab(config) {
    const page = await this.ensurePage();
    let tab = page.locator(config.selectors.referenceTab);
    await tab.first().waitFor({ state: 'attached', timeout: 15000 }).catch(() => {});
    if (!await tab.count()) {
      const text = page.locator('div.tab__content').filter({ hasText: /^\s*Referenznummern\s*$/i }).first();
      await text.waitFor({ state: 'attached', timeout: 8000 });
      tab = text.locator("xpath=ancestor::div[contains(concat(' ', normalize-space(@class), ' '), ' tab ')][1]");
    }
    if (!await page.locator(config.selectors.selectedReferenceTab).count()) {
      const first = tab.first();
      let selected = false;
      for (const options of [{}, { force: true }]) {
        await first.click({ timeout: 5000, ...options }).catch(() => {});
        await page.waitForTimeout(700);
        selected = Boolean(await page.locator(config.selectors.selectedReferenceTab).count());
        if (selected) break;
      }
      if (!selected) {
        await first.evaluate((element) => element.click()).catch(() => {});
        await page.locator(config.selectors.selectedReferenceTab).first().waitFor({ state: 'attached', timeout: 7000 });
      }
    }
    await page.locator(config.selectors.referencesContainer).first().waitFor({ state: 'attached', timeout: 10000 });
  }

  async extractReferences(config) {
    const page = await this.ensurePage();
    return page.evaluate((containerSelector) => {
      const clean = (text) => String(text || '').replace(/\s+/g, ' ').trim();
      const root = document.querySelector(containerSelector) || document;
      const output = [];
      const seen = new Set();
      for (const panel of root.querySelectorAll('div.panel')) {
        const titleNode = panel.querySelector('.panel__title .panel__text, .headline.panel__title .panel__text, .panel__text');
        const group = clean(titleNode?.textContent) || 'Unbekannt';
        const content = panel.querySelector('.panel__content') || panel;
        for (const node of content.querySelectorAll('.tag__value.text--strong, .text.text--strong, .text--strong')) {
          const reference = clean(node.textContent);
          const key = `${group}\u0000${reference}`;
          if (reference && reference !== '+' && reference !== '-' && !seen.has(key)) {
            seen.add(key);
            output.push({ group, reference });
          }
        }
      }
      return output;
    }, config.selectors.referencesContainer);
  }

  async closeModal(config) {
    const page = await this.ensurePage();
    const modal = page.locator("div[role='presentation'].MuiDialog-root, div.MuiDialog-root, div[role='dialog']");
    if (!await modal.count()) return;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(500);
    if (!await modal.count()) return;
    await this.clickFirstVisible(page.locator(config.selectors.closeModal), 2000).catch(() => {});
  }

  async performSearch(partNumber) {
    const config = loadConfig();
    if (!this.loggedIn) await this.login(config);
    const query = normalizePartNumber(partNumber);
    if (!query) throw new Error('Geçerli bir parça numarası gereklidir.');
    await this.searchNumber(query, config);
    const page = await this.ensurePage();
    if (await page.locator(config.selectors.noResults).count()) {
      return { partNumber, query, status: 'NO_WMKAT_RESULT', references: [], count: 0 };
    }
    if (!await this.clickFirstVisible(page.locator(config.selectors.detailsButton), 15000)) {
      throw new Error('WMKAT sonuç detay düğmesi bulunamadı.');
    }
    await this.openReferenceTab(config);
    const references = await this.extractReferences(config);
    await this.closeModal(config);
    return { partNumber, query, status: 'DONE', references, count: references.length };
  }

  search(partNumber) {
    const cacheKey = normalizePartNumber(partNumber);
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.createdAt < this.cacheTtlMs) {
      return Promise.resolve(cached.result);
    }
    if (cached) this.cache.delete(cacheKey);
    if (this.activeSearch) {
      const error = new Error('Başka bir WMKAT araması devam ediyor.');
      error.statusCode = 429;
      throw error;
    }
    this.activeSearch = this.performSearch(partNumber)
      .then((result) => {
        this.cache.set(cacheKey, { createdAt: Date.now(), result });
        return result;
      })
      .catch(async (error) => { await this.close(); throw error; })
      .finally(() => { this.activeSearch = null; });
    return this.activeSearch;
  }

  async close() {
    if (this.browser) await this.browser.close().catch(() => {});
    this.browser = null;
    this.context = null;
    this.page = null;
    this.loggedIn = false;
  }

  async cancel() {
    await this.close();
  }
}

module.exports = WmkatClient;
