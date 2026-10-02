'use strict';

(() => {
  const SUPPORTED_LANGUAGES = ['tr', 'de', 'en'];
  const NAV_ITEMS = [
    { key: 'parts', href: '/' },
    { key: 'vehicles', href: '/?view=vehicles' },
    { key: 'kba', href: '/kba' },
    { key: 'ebay', href: '/ebay-parcalar' },
    { key: 'orders', href: '/siparisler' }
  ];
  const TEXT = {
    tr: {
      parts: 'Parçalar', vehicles: 'Araçlar', kba: 'KBA Arama', ebay: 'eBay Parçalar', orders: 'Siparişler',
      mainMenu: 'Ana menü', footerMenu: 'Alt menü', online: 'Sunucu bağlantısı aktif', offline: 'Sunucu bağlantısı yok'
    },
    de: {
      parts: 'Teile', vehicles: 'Fahrzeuge', kba: 'KBA-Suche', ebay: 'eBay-Teile', orders: 'Bestellungen',
      mainMenu: 'Hauptmenü', footerMenu: 'Fußmenü', online: 'Serververbindung aktiv', offline: 'Keine Serververbindung'
    },
    en: {
      parts: 'Parts', vehicles: 'Vehicles', kba: 'KBA Search', ebay: 'eBay Parts', orders: 'Orders',
      mainMenu: 'Main menu', footerMenu: 'Footer menu', online: 'Server connection active', offline: 'No server connection'
    }
  };
  const MARKETPLACE_LOGOS = {
    ebay: '/marketplace-logos/ebay.svg', ovoko: '/marketplace-logos/ovoko.svg',
    teilehaber: '/marketplace-logos/teilehaber.svg', autoteilemarkt: '/marketplace-logos/autoteilemarkt.svg',
    'autoteile-markt': '/marketplace-logos/autoteilemarkt.svg', partsbit: '/marketplace-logos/partsbit.svg',
    opisto: '/marketplace-logos/opisto.svg'
  };

  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const isHome = path === '/';

  function getLanguage() {
    const requestedLanguage = new URLSearchParams(window.location.search).get('lang');
    if (SUPPORTED_LANGUAGES.includes(requestedLanguage)) return requestedLanguage;
    const savedLanguage = localStorage.getItem('lang');
    if (SUPPORTED_LANGUAGES.includes(savedLanguage)) return savedLanguage;
    const pageLanguage = document.documentElement.lang?.slice(0, 2).toLowerCase();
    return SUPPORTED_LANGUAGES.includes(pageLanguage) ? pageLanguage : 'tr';
  }

  function activePage() {
    if (isHome) return new URLSearchParams(window.location.search).get('view') === 'vehicles' ? 'vehicles' : 'parts';
    if (path === '/kba') return 'kba';
    if (path === '/ebay-parcalar') return 'ebay';
    if (path === '/siparisler') return 'orders';
    return '';
  }

  function createLink(item, footer = false) {
    const link = document.createElement('a');
    link.href = item.href;
    link.dataset.siteNavKey = item.key;
    link.className = footer ? 'site-footer-link' : 'menu-button';
    return link;
  }

  function createNav(footer = false) {
    const nav = document.createElement('nav');
    nav.className = footer ? 'site-footer-menu' : 'main-menu site-nav';
    nav.dataset.siteNav = footer ? 'footer' : 'header';
    NAV_ITEMS.forEach((item) => nav.append(createLink(item, footer)));
    return nav;
  }

  function normalizeHomeNav(header) {
    const nav = header.querySelector('.main-menu') || createNav();
    nav.classList.add('main-menu', 'site-nav');
    nav.dataset.siteNav = 'header';
    const homeButtons = {
      parts: nav.querySelector('#partsMenuBtn'), vehicles: nav.querySelector('#vehiclesMenuBtn'), kba: nav.querySelector('#kbaMenuBtn')
    };
    Object.entries(homeButtons).forEach(([key, element]) => { if (element) element.dataset.siteNavKey = key; });

    nav.querySelectorAll('[data-site-nav-key="ebay"], a[href="/ebay-parcalar"], button[onclick*="ebay-parcalar"]').forEach((element) => element.remove());
    nav.querySelectorAll('[data-site-nav-key="orders"], a[href="/siparisler"]').forEach((element) => element.remove());
    nav.append(createLink(NAV_ITEMS.find(({ key }) => key === 'ebay')));
    nav.append(createLink(NAV_ITEMS.find(({ key }) => key === 'orders')));

    const actions = header.querySelector('.top-actions');
    if (!nav.isConnected && actions) actions.prepend(nav);
    else if (!nav.isConnected) header.append(nav);
  }

  function normalizeHeader() {
    const header = document.querySelector('body > header');
    if (!header) return;
    header.classList.add('topbar', 'site-nav-header');
    if (!isHome) document.querySelector('#settingsBtn')?.remove();

    if (isHome) {
      normalizeHomeNav(header);
      return;
    }

    header.querySelectorAll('.main-menu').forEach((element) => element.remove());
    header.querySelector(':scope > .back')?.remove();
    const nav = createNav();
    const actions = header.querySelector('.top-actions');
    if (actions) actions.prepend(nav);
    else header.insertBefore(nav, header.querySelector('.languages, .logout-button'));
  }

  function createStatus() {
    const status = document.createElement('div');
    status.className = 'connection site-footer-status';
    status.setAttribute('role', 'status');
    status.innerHTML = '<span class="site-status-dot" aria-hidden="true"></span><span class="site-status-text"></span>';
    return status;
  }

  function normalizeFooter() {
    let footer = document.querySelector('body > footer');
    if (!footer) {
      footer = document.createElement('footer');
      document.body.append(footer);
    }
    footer.classList.add('site-footer', 'site-shell-footer');
    if (!footer.querySelector('.footer-signature') && footer.textContent.trim()) {
      const signature = document.createElement('div');
      signature.className = 'footer-signature';
      while (footer.firstChild) signature.append(footer.firstChild);
      footer.append(signature);
    }
    footer.querySelectorAll('.kba-footer-menu, .site-footer-menu').forEach((element) => element.remove());
    footer.prepend(createNav(true));

    const connection = document.querySelector('.connection') || createStatus();
    connection.classList.add('site-footer-status');
    if (!connection.querySelector('.site-status-dot')) connection.firstElementChild?.classList.add('site-status-dot');
    if (!connection.querySelector('.site-status-text')) connection.lastElementChild?.classList.add('site-status-text');

    let meta = footer.querySelector('.site-footer-meta');
    if (!meta) {
      meta = document.createElement('div');
      meta.className = 'site-footer-meta';
      const signature = footer.querySelector('.footer-signature');
      if (signature) meta.append(signature);
      footer.append(meta);
    }
    meta.prepend(connection);
  }

  function updateTranslations() {
    const text = TEXT[getLanguage()];
    const currentPage = activePage();
    document.querySelectorAll('[data-site-nav]').forEach((nav) => {
      nav.setAttribute('aria-label', nav.dataset.siteNav === 'footer' ? text.footerMenu : text.mainMenu);
    });
    document.querySelectorAll('[data-site-nav-key]').forEach((element) => {
      const key = element.dataset.siteNavKey;
      element.textContent = text[key] || key;
      const active = key === currentPage;
      element.classList.toggle('active', active);
      if (active) element.setAttribute('aria-current', 'page');
      else element.removeAttribute('aria-current');
    });
    const status = document.querySelector('.site-footer-status');
    if (status) status.setAttribute('aria-label', status.classList.contains('bad') ? text.offline : text.online);
  }

  async function updateHealth() {
    const status = document.querySelector('.site-footer-status');
    if (!status || isHome) return;
    try {
      const response = await fetch('/api/health');
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      status.classList.remove('bad');
      status.classList.add('ok');
      status.title = [data.server, data.database].filter(Boolean).join(' · ') || TEXT[getLanguage()].online;
    } catch {
      status.classList.remove('ok');
      status.classList.add('bad');
      status.title = TEXT[getLanguage()].offline;
    }
    updateTranslations();
  }

  function applyMarketplaceLogo(element) {
    if (element.dataset.marketLogo) return;
    const name = (element.dataset.marketplace || element.textContent || '').trim().toLowerCase().replace(/\s+/g, '');
    const source = MARKETPLACE_LOGOS[name];
    if (!source) return;
    element.dataset.marketLogo = 'true';
    element.classList.add('marketplace-badge', `marketplace-${name.replace(/[^a-z]/g, '')}`);
    const image = new Image();
    image.src = source;
    image.alt = name;
    element.replaceChildren(image);
  }

  function watchMarketplaceBadges() {
    const applyAll = (root = document) => root.querySelectorAll?.('.source, [data-marketplace]').forEach(applyMarketplaceLogo);
    applyAll();
    new MutationObserver((records) => {
      records.forEach(({ addedNodes }) => addedNodes.forEach((node) => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches('.source, [data-marketplace]')) applyMarketplaceLogo(node);
        applyAll(node);
      }));
    }).observe(document.body, { childList: true, subtree: true });
  }

  function loadStyles() {
    if (document.querySelector('link[data-site-shell]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/site-nav.css?v=1';
    link.dataset.siteShell = 'true';
    document.head.append(link);
  }

  function initialize() {
    loadStyles();
    normalizeHeader();
    normalizeFooter();
    updateTranslations();
    updateHealth();
    watchMarketplaceBadges();
    window.addEventListener('app-language-change', updateTranslations);
    document.addEventListener('click', (event) => {
      if (isHome && event.target.closest('[data-site-nav-key="parts"], [data-site-nav-key="vehicles"]')) {
        queueMicrotask(updateTranslations);
      }
    });
    window.addEventListener('storage', ({ key }) => { if (key === 'lang') updateTranslations(); });
    new MutationObserver(updateTranslations).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    const status = document.querySelector('.site-footer-status');
    if (status) new MutationObserver(updateTranslations).observe(status, { attributes: true, attributeFilter: ['class'] });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initialize, { once: true });
  else initialize();
})();
