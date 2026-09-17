'use strict';
window.EbayResults = (() => {
  let generation = 0;
  const section = document.querySelector('#ebayInlineResults');
  const frame = document.querySelector('#ebayResultsFrame');
  const toggle = document.querySelector('#ebayInlineToggle');
  const pageLink = document.querySelector('#ebayInlinePage');
  // "Open on a separate page" must update the one eBay tab, not create a
  // fresh tab for every result search. Keeping an opener enables its return.
  pageLink.target = 'baytemur-ebay-parts';
  pageLink.rel = '';
  const exactFilterWrap = document.querySelector('#ebayExactFilterWrap');
  const exactFilter = document.querySelector('#ebayExactFilter');
  let language = localStorage.getItem('lang') || 'tr';
  let expanded = false;
  let exactAvailable = false;
  const labels = {
    tr: { show: 'eBay sonuçlarını göster', hide: 'eBay sonuçlarını gizle', frame: 'eBay parça ilanları', section: 'eBay parça sonuçları' },
    de: { show: 'eBay-Ergebnisse anzeigen', hide: 'eBay-Ergebnisse ausblenden', frame: 'eBay-Teileangebote', section: 'eBay-Teileergebnisse' },
    en: { show: 'Show eBay results', hide: 'Hide eBay results', frame: 'eBay parts listings', section: 'eBay parts results' }
  };
  function syncToggle() {
    const copy = labels[language] || labels.tr;
    frame.hidden = !expanded;
    toggle.textContent = expanded ? copy.hide : copy.show;
    toggle.setAttribute('aria-expanded', String(expanded));
    frame.title = copy.frame;
    section.setAttribute('aria-label', copy.section);
  }
  function setLanguage(value) {
    language = ['tr', 'de', 'en'].includes(value) ? value : 'tr';
    syncToggle();
    if (!frame.getAttribute('src')) return;
    const url = new URL(frame.src, location.origin);
    if (url.searchParams.get('lang') === language) return;
    url.searchParams.set('lang', language);
    frame.src = url.pathname + url.search;
    const pageUrl = new URL(pageLink.href, location.origin);
    pageUrl.searchParams.set('lang', language);
    pageLink.href = pageUrl.pathname + pageUrl.search;
  }
  function clear() {
    generation++;
    section.hidden = true;
    frame.removeAttribute('src');
    return generation;
  }
  function load(query, expected, exact = false) {
    if (expected !== generation || !query.trim()) return;
    exactAvailable = Boolean(exact);
    exactFilterWrap.hidden = !exactAvailable;
    exactFilter.checked = exactAvailable;
    const params = new URLSearchParams({ q: query.slice(0, 100), sort: 'price', embed: '1', lang: language, exact: String(Boolean(exact)) });
    frame.style.height = '280px';
    frame.src = '/ebay-parcalar?' + params;
    document.querySelector('#ebayInlineQuery').textContent = query;
    pageLink.href = '/ebay-parcalar?' + new URLSearchParams({ q: query, sort: 'price', lang: language, exact: String(Boolean(exact)) });
    section.hidden = false;
    syncToggle();
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame.contentWindow || section.hidden) return;
    if (event.data?.type === 'ebay-height' && Number.isFinite(event.data.height)) frame.style.height = Math.min(15000, Math.max(200, event.data.height + 12)) + 'px';
    if (event.data?.type === 'ebay-gallery' && Array.isArray(event.data.images)) {
      const images = event.data.images.filter(value => {
        try { const url = new URL(value); return url.protocol === 'https:' && /(^|\.)ebayimg\.com$/i.test(url.hostname); } catch { return false; }
      }).slice(0, 100);
      if (images.length && typeof window.openExternalGallery === 'function') window.openExternalGallery(String(event.data.title || 'eBay'), images);
    }
  });
  toggle.addEventListener('click', () => {
    expanded = !expanded;
    syncToggle();
  });
  exactFilter.addEventListener('change', () => {
    if (!exactAvailable || !frame.getAttribute('src')) return;
    const frameUrl = new URL(frame.src, location.origin);
    frameUrl.searchParams.set('exact', String(exactFilter.checked));
    frame.src = frameUrl.pathname + frameUrl.search;
    const pageUrl = new URL(pageLink.href, location.origin);
    pageUrl.searchParams.set('exact', String(exactFilter.checked));
    pageLink.href = pageUrl.pathname + pageUrl.search;
  });
  window.addEventListener('app-language-change', event => setLanguage(event.detail?.language));
  document.querySelector('#searchForm').addEventListener('reset', clear);
  syncToggle();
  return { clear, load, setLanguage };
})();
