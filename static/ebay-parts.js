'use strict';
const $ = id => document.getElementById(id);
const isBaytemuerSeller = value => ['baytemuer', 'baytemur'].includes(String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, ''));
const embedded = window.parent !== window && new URLSearchParams(location.search).get('embed') === '1';
if (embedded) document.documentElement.classList.add('embedded');
const partsSearchWindowName = 'baytemur-part-search';

function returnToPartsSearch(event) {
  if (embedded) return;
  event.preventDefault();
  // Prefer the caller so its existing search state is preserved. Otherwise,
  // reuse or create one named parts-search tab.
  const searchTab = window.opener && !window.opener.closed
    ? window.opener
    : window.open('/', partsSearchWindowName);
  try { searchTab.focus(); } catch { /* Focus may be blocked by the browser. */ }
  window.close();
}
document.querySelector('.back')?.addEventListener('click', returnToPartsSearch);
const dictionaries = {
  tr: {
    page_title: 'eBay Parçalar · Baytemür', home: 'Ana sayfa', back_to_search: '← Parça aramaya dön', price_summary: 'Rekabetçi fiyat özeti', recommended_price: 'Önerilen rekabetçi fiyat', quick_sale_price: 'Hızlı satış fiyatı', market_median: 'Piyasa medyanı', confidence_level: 'Güven seviyesi', shipping_target: 'Kargo dâhil hedef', shipping_included: 'Kargo dâhil', query_label: 'Parça adı veya OEM numarası', query_placeholder: 'Örn. Golf 7 Scheinwerfer veya 04L131501', sort_label: 'Sıralama', sort_best: 'En ilgili ilanlar', sort_price_asc: 'Parça + kargo: artan', sort_price_desc: 'Parça + kargo: azalan', sort_new: 'Yeni eklenenler', search_parts: 'Parça ara', listing_filters: 'İlan filtreleri', business_seller: 'Kurumsal satıcı', used: 'Kullanılmış', location_germany: 'Ürün konumu: Almanya', exact_part_number: 'Tam parça numarası eşleşmesi', clear_filters: 'Filtreleri kaldır', market_label: 'eBay Almanya · Otomobil parçaları ve aksesuarları', current_listings: 'Güncel ilanlar', parts_listings: 'eBay parça ilanları', result_pages: 'Sonuç sayfaları', previous: '← Önceki', next: 'Sonraki →', footer_note: 'İlanlar eBay’den alınır. Fiyat, kargo ve stok durumunu satın almadan önce eBay’de kontrol edin. Kurumsal satıcı filtresi eBay hesap türüne, Almanya filtresi ürünün bulunduğu ülkeye dayanır.', close: 'Kapat', previous_image: 'Önceki görsel', next_image: 'Sonraki görsel', listing_image: 'İlan görseli', start_title: 'Parça aramaya başlayın', start_description: 'Parça adı veya OEM numarasını yazıp Parça ara düğmesine basın.', price_unknown: 'Fiyat belirtilmemiş', confidence_high: 'Yüksek', confidence_medium: 'Orta', confidence_low: 'Düşük', seller_prices: '{count} bağımsız satıcı fiyatı', open_images: 'İlan görsellerini aç', image_error: 'Görseller alınamadı', no_image: 'Görsel bulunamadı', open_listing: 'eBay’de ilanı aç', seller: 'Satıcı: ', unspecified: 'Belirtilmemiş', feedback_score: 'Geri bildirim puanı: {score}', positive: '%{value} olumlu', free_shipping: 'Ücretsiz kargo', shipping: '+ {price} kargo', shipping_unknown: 'Kargo belirtilmemiş', total: 'Toplam: {price}', retry: 'Tekrar dene', filters_changed: 'Filtreler değiştirildi', filters_changed_description: 'Seçtiğiniz filtrelerle sonuçları görmek için Parça ara düğmesine basın.', loading: 'eBay ilanları yükleniyor…', results_count: '· {count} sonuç', last_query: 'Son sorgu {time}', cached: 'Önbellekten', no_results_title: 'Bu aramada ilan bulunamadı', no_results_description: 'Farklı bir parça adı veya OEM numarası deneyin. Almanca parça adlarıyla daha fazla sonuç bulabilirsiniz.', page: 'Sayfa {page}', unavailable_title: 'İlanlar şu anda alınamıyor', connection_error: 'Sunucuya ulaşılamadı. Bağlantınızı kontrol edip tekrar deneyin.', search_error: 'eBay araması tamamlanamadı.'
  },
  de: {
    page_title: 'eBay-Teile · Baytemür', home: 'Startseite', back_to_search: '← Zur Teilesuche', price_summary: 'Zusammenfassung der Wettbewerbspreise', recommended_price: 'Empfohlener Wettbewerbspreis', quick_sale_price: 'Preis für schnellen Verkauf', market_median: 'Marktmedian', confidence_level: 'Konfidenzniveau', shipping_target: 'Zielpreis inkl. Versand', shipping_included: 'Inkl. Versand', query_label: 'Teilename oder OEM-Nummer', query_placeholder: 'z. B. Golf 7 Scheinwerfer oder 04L131501', sort_label: 'Sortierung', sort_best: 'Relevanteste Angebote', sort_price_asc: 'Teil + Versand: aufsteigend', sort_price_desc: 'Teil + Versand: absteigend', sort_new: 'Neu eingestellt', search_parts: 'Teil suchen', listing_filters: 'Angebotsfilter', business_seller: 'Gewerblicher Verkäufer', used: 'Gebraucht', location_germany: 'Artikelstandort: Deutschland', exact_part_number: 'Exakte Teilenummer', clear_filters: 'Filter entfernen', market_label: 'eBay Deutschland · Autoteile & Zubehör', current_listings: 'Aktuelle Angebote', parts_listings: 'eBay-Teileangebote', result_pages: 'Ergebnisseiten', previous: '← Zurück', next: 'Weiter →', footer_note: 'Die Angebote stammen von eBay. Prüfen Sie Preis, Versand und Verfügbarkeit vor dem Kauf bei eBay. Der Filter für gewerbliche Verkäufer basiert auf dem eBay-Kontotyp, der Deutschland-Filter auf dem Artikelstandort.', close: 'Schließen', previous_image: 'Vorheriges Bild', next_image: 'Nächstes Bild', listing_image: 'Angebotsbild', start_title: 'Teilesuche starten', start_description: 'Geben Sie einen Teilenamen oder eine OEM-Nummer ein und klicken Sie auf Teil suchen.', price_unknown: 'Preis nicht angegeben', confidence_high: 'Hoch', confidence_medium: 'Mittel', confidence_low: 'Niedrig', seller_prices: '{count} unabhängige Verkäuferpreise', open_images: 'Angebotsbilder öffnen', image_error: 'Bilder konnten nicht geladen werden', no_image: 'Kein Bild verfügbar', open_listing: 'Angebot bei eBay öffnen', seller: 'Verkäufer: ', unspecified: 'Nicht angegeben', feedback_score: 'Bewertungspunkte: {score}', positive: '{value} % positiv', free_shipping: 'Kostenloser Versand', shipping: '+ {price} Versand', shipping_unknown: 'Versand nicht angegeben', total: 'Gesamt: {price}', retry: 'Erneut versuchen', filters_changed: 'Filter geändert', filters_changed_description: 'Klicken Sie auf Teil suchen, um Ergebnisse mit den gewählten Filtern anzuzeigen.', loading: 'eBay-Angebote werden geladen…', results_count: '· {count} Ergebnisse', last_query: 'Letzte Abfrage {time}', cached: 'Aus Cache', no_results_title: 'Keine Angebote gefunden', no_results_description: 'Versuchen Sie einen anderen Teilenamen oder eine andere OEM-Nummer.', page: 'Seite {page}', unavailable_title: 'Angebote sind derzeit nicht verfügbar', connection_error: 'Der Server ist nicht erreichbar. Prüfen Sie Ihre Verbindung und versuchen Sie es erneut.', search_error: 'Die eBay-Suche konnte nicht abgeschlossen werden.'
  },
  en: {
    page_title: 'eBay Parts · Baytemür', home: 'Home', back_to_search: '← Back to parts search', price_summary: 'Competitive price summary', recommended_price: 'Recommended competitive price', quick_sale_price: 'Quick-sale price', market_median: 'Market median', confidence_level: 'Confidence level', shipping_target: 'Target including shipping', shipping_included: 'Including shipping', query_label: 'Part name or OEM number', query_placeholder: 'e.g. Golf 7 headlight or 04L131501', sort_label: 'Sort', sort_best: 'Most relevant listings', sort_price_asc: 'Part + shipping: low to high', sort_price_desc: 'Part + shipping: high to low', sort_new: 'Newly listed', search_parts: 'Search parts', listing_filters: 'Listing filters', business_seller: 'Business seller', used: 'Used', location_germany: 'Item location: Germany', exact_part_number: 'Exact part number match', clear_filters: 'Clear filters', market_label: 'eBay Germany · Car parts & accessories', current_listings: 'Current listings', parts_listings: 'eBay parts listings', result_pages: 'Result pages', previous: '← Previous', next: 'Next →', footer_note: 'Listings are provided by eBay. Check the price, shipping, and availability on eBay before purchasing. The business seller filter is based on the eBay account type and the Germany filter on the item location.', close: 'Close', previous_image: 'Previous image', next_image: 'Next image', listing_image: 'Listing image', start_title: 'Start a parts search', start_description: 'Enter a part name or OEM number and select Search parts.', price_unknown: 'Price not specified', confidence_high: 'High', confidence_medium: 'Medium', confidence_low: 'Low', seller_prices: '{count} independent seller prices', open_images: 'Open listing images', image_error: 'Images could not be loaded', no_image: 'No image available', open_listing: 'Open listing on eBay', seller: 'Seller: ', unspecified: 'Not specified', feedback_score: 'Feedback score: {score}', positive: '{value}% positive', free_shipping: 'Free shipping', shipping: '+ {price} shipping', shipping_unknown: 'Shipping not specified', total: 'Total: {price}', retry: 'Try again', filters_changed: 'Filters changed', filters_changed_description: 'Select Search parts to view results with the chosen filters.', loading: 'Loading eBay listings…', results_count: '· {count} results', last_query: 'Last query {time}', cached: 'Cached', no_results_title: 'No listings found for this search', no_results_description: 'Try a different part name or OEM number. German part names may return more results.', page: 'Page {page}', unavailable_title: 'Listings are currently unavailable', connection_error: 'The server could not be reached. Check your connection and try again.', search_error: 'The eBay search could not be completed.'
  }
};
Object.assign(dictionaries.tr, { average_price: 'Ortalama fiyat', price_records: '{count} kayıt · {known} kargolu · {unknown} kargo belirsiz', seller_prices: 'Tüm sayfalardan {count} fiyat', baytemuer_rankings: 'baytemuer ilanları (kargo dahil): {items}', baytemuer_rank_item: '{rank}. sırada · {price}' });
Object.assign(dictionaries.de, { average_price: 'Durchschnittspreis', price_records: '{count} Angebote · {known} mit Versandpreis · {unknown} ohne Versandpreis', seller_prices: '{count} Preise aus allen Seiten', baytemuer_rankings: 'baytemuer-Angebote: {items}', baytemuer_rank_item: '{rank}. Platz · {price}' });
Object.assign(dictionaries.en, { average_price: 'Average price', price_records: '{count} listings · {known} with shipping · {unknown} without shipping', seller_prices: '{count} prices from all pages', baytemuer_rankings: 'baytemuer listings: {items}', baytemuer_rank_item: 'rank {rank} · {price}' });
Object.assign(dictionaries.tr, { top3_target: 'İlk 3 fiyat hedefi', market_stock: 'Piyasa / stok', stock_none: 'Stok yok · atölye fiyatı', stock_low: 'Stok {count} adet', stock_high: 'Stok {count} adet', stock_unknown: 'Recycle stok bilgisi yok', market_sparse: 'Seyrek', market_balanced: 'Dengeli', market_active: 'Canlı', market_dense: 'Yoğun' });
Object.assign(dictionaries.de, { top3_target: 'Top-3 Preisziel', market_stock: 'Markt / Bestand', stock_none: 'Kein Bestand · Werkstattpreis', stock_low: 'Bestand {count}', stock_high: 'Bestand {count}', stock_unknown: 'Recycle-Bestand unbekannt', market_sparse: 'Gering', market_balanced: 'Ausgeglichen', market_active: 'Aktiv', market_dense: 'Dicht' });
Object.assign(dictionaries.en, { top3_target: 'Top 3 price target', market_stock: 'Market / stock', stock_none: 'No stock · workshop price', stock_low: '{count} in stock', stock_high: '{count} in stock', stock_unknown: 'Recycle stock unavailable', market_sparse: 'Sparse', market_balanced: 'Balanced', market_active: 'Active', market_dense: 'Crowded' });
const requestedLanguage = new URLSearchParams(location.search).get('lang') || localStorage.getItem('lang') || 'tr';
const language = ['tr', 'de', 'en'].includes(requestedLanguage) ? requestedLanguage : 'tr';
const locale = language === 'tr' ? 'tr-TR' : language === 'en' ? 'en-US' : 'de-DE';
const translate = (key, values = {}) => Object.entries(values).reduce((text, [name, value]) => text.replaceAll(`{${name}}`, value), dictionaries[language][key] || key);
function applyLanguage() {
  document.documentElement.lang = language;
  document.querySelectorAll('[data-i18n]').forEach(element => { element.textContent = translate(element.dataset.i18n); });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(element => element.setAttribute('placeholder', translate(element.dataset.i18nPlaceholder)));
  document.querySelectorAll('[data-i18n-aria-label]').forEach(element => element.setAttribute('aria-label', translate(element.dataset.i18nAriaLabel)));
  document.querySelectorAll('[data-i18n-alt]').forEach(element => element.setAttribute('alt', translate(element.dataset.i18nAlt)));
  document.title = translate('page_title');
}
let state = { q: '', sort: 'price', page: 1, exact: false };
let controller;

function showInitialState() {
  controller?.abort();
  $('results').replaceChildren();
  $('results').setAttribute('aria-busy', 'false');
  $('pagination').hidden = true;
  $('count').textContent = ''; $('updated').textContent = '';
  resetStatistics();
  message(translate('start_title'), translate('start_description'));
}

function node(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

// OEM numbers are commonly copied with visual separators. eBay receives the
// compact value, just like the main part-number search does.
function normalizeEbayQuery(value) {
  return String(value || '').replace(/[\s*-]+/g, '').slice(0, 100);
}

function updateEbaySearchTitle(items = []) {
  if (embedded) return;
  const query = String(state.q || '').trim();
  const listingName = String(items[0]?.title || '').trim();
  const resultLabel = [query, listingName].filter(Boolean).join(' · ');
  document.title = resultLabel ? `${resultLabel} | eBay Parçalar · Baytemür` : 'eBay Parçalar · Baytemür';
}

function highlightExactPartNumber(element, value, partNumber) {
  const normalized = String(partNumber || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!normalized) {
    element.textContent = value;
    return;
  }
  const flexible = [...normalized].map(character => character.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\s._/-]*');
  const matcher = new RegExp(`(^|[^A-Z0-9])(${flexible})(?=$|[^A-Z0-9])`, 'ig');
  let cursor = 0;
  for (const match of String(value || '').matchAll(matcher)) {
    const start = match.index + match[1].length;
    if (start > cursor) element.append(document.createTextNode(value.slice(cursor, start)));
    const mark = node('mark', 'exact-part-highlight', value.slice(start, start + match[2].length));
    element.append(mark);
    cursor = start + match[2].length;
  }
  if (!cursor) element.textContent = value;
  else if (cursor < value.length) element.append(document.createTextNode(value.slice(cursor)));
}

function highlightedPartNumberQuery() {
  const raw = String(state.q || '').trim();
  const compact = raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
  // Whatever was supplied as q is the visual target. This also covers
  // numeric-only OEM numbers such as 2751872 and separator variants.
  return compact.length >= 2 ? compact : '';
}
function money(amount) {
  if (!amount || amount.value == null || String(amount.value).trim() === '' || !Number.isFinite(Number(amount.value))) return translate('price_unknown');
  try { return new Intl.NumberFormat(locale, { style: 'currency', currency: amount.currency }).format(Number(amount.value)); }
  catch { return translate('price_unknown'); }
}
function resetStatistics() {
  for (const id of ['recommendedPrice', 'quickSalePrice', 'medianPrice', 'averagePrice', 'confidenceLevel', 'top3Target', 'pricingPolicy', 'marketState', 'stockCount']) $(id).textContent = '—';
  $('confidenceLevel').className = '';
  $('pricingPolicy').className = '';
  $('marketState').parentElement.className = 'stat stat-market';
  $('priceCount').textContent = '—'; $('averagePriceCount').textContent = '—';
  $('baytemuerRankings').hidden = true;
  $('baytemuerRankings').textContent = '';
}
function stockPricingPolicy(allPrices, stockCount) {
  const prices = (allPrices || []).map(Number).filter(price => Number.isFinite(price) && price >= 0).sort((a, b) => a - b);
  if (!prices.length) return null;
  const stockKnown = Number.isInteger(stockCount) && stockCount >= 0;
  const thirdPrice = prices[Math.min(2, prices.length - 1)];
  // No stock means the part may be needed in the workshop: preserve value.
  // Stock pressure increases once the Recycle count exceeds five.
  const factor = !stockKnown ? 1 : stockCount === 0 ? 1.08 : stockCount <= 5 ? .995 : .97;
  const target = competitiveEnding(thirdPrice * factor);
  const spread = prices.length > 1 && thirdPrice > 0 ? (thirdPrice - prices[0]) / thirdPrice : 0;
  const market = prices.length <= 3 ? 'sparse' : prices.length < 12 ? 'balanced' : spread <= .25 ? 'dense' : 'active';
  const stockLabel = !stockKnown ? translate('stock_unknown') : stockCount === 0 ? translate('stock_none') : translate(stockCount <= 5 ? 'stock_low' : 'stock_high', { count: new Intl.NumberFormat(locale).format(stockCount) });
  return { target, market, stockLabel };
}
function percentile(sorted, ratio) {
  if (!sorted.length) return null;
  const position = (sorted.length - 1) * ratio;
  const lower = Math.floor(position), upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}
function competitiveEnding(value) {
  if (!Number.isFinite(value) || value <= 0) return value;
  const candidate = Math.floor(value) + .95;
  return candidate <= value ? candidate : Math.max(.95, candidate - 1);
}
function marketPriceModel(allPrices) {
  const sourcePrices = (allPrices || []).map(Number).filter(price => Number.isFinite(price) && price >= 0).sort((a, b) => a - b);
  if (!sourcePrices.length) return null;
  const q1 = percentile(sourcePrices, .25), q3 = percentile(sourcePrices, .75);
  const prices = sourcePrices;
  const median = percentile(prices, .5);
  const average = prices.reduce((sum, price) => sum + price, 0) / prices.length;
  const spread = median > 0 ? (percentile(prices, .75) - percentile(prices, .25)) / median : Infinity;
  const confidence = prices.length >= 12 && spread <= .45 ? 'high' : prices.length >= 6 && spread <= .75 ? 'medium' : 'low';
  return {
    recommended: competitiveEnding(percentile(prices, .4)),
    quick: competitiveEnding(percentile(prices, .25)),
    median,
    average,
    confidence,
    used: prices.length,
    excluded: 0,
    listings: sourcePrices.length
  };
}
function updateStatistics(items, shippingKnownCount = 0, shippingUnknownCount = 0, baytemuerListings = [], stockCount = null) {
  const model = marketPriceModel(items);
  if (!model) {
    resetStatistics();
    return;
  }
  $('recommendedPrice').textContent = money({ value: model.recommended, currency: 'EUR' });
  $('quickSalePrice').textContent = money({ value: model.quick, currency: 'EUR' });
  $('medianPrice').textContent = money({ value: model.median, currency: 'EUR' });
  $('averagePrice').textContent = money({ value: model.average, currency: 'EUR' });
  $('averagePriceCount').textContent = translate('price_records', {
    count: new Intl.NumberFormat(locale).format(model.listings),
    known: new Intl.NumberFormat(locale).format(shippingKnownCount),
    unknown: new Intl.NumberFormat(locale).format(shippingUnknownCount)
  });
  $('confidenceLevel').textContent = translate(`confidence_${model.confidence}`);
  $('confidenceLevel').className = `confidence-${model.confidence}`;
  $('priceCount').textContent = translate('seller_prices', { count: new Intl.NumberFormat(locale).format(model.used) });
  const policy = stockPricingPolicy(items, stockCount);
  if (policy) {
    $('top3Target').textContent = money({ value: policy.target, currency: 'EUR' });
    $('pricingPolicy').textContent = translate('shipping_target');
    $('marketState').textContent = translate(`market_${policy.market}`);
    $('stockCount').textContent = policy.stockLabel;
    $('marketState').parentElement.className = `stat stat-market market-${policy.market}`;
  }
  const rankings = Array.isArray(baytemuerListings) ? baytemuerListings : [];
  const rankingElement = $('baytemuerRankings');
  rankingElement.hidden = !rankings.length;
  rankingElement.textContent = rankings.length ? translate('baytemuer_rankings', {
    items: rankings.map(listing => translate('baytemuer_rank_item', {
      rank: new Intl.NumberFormat(locale).format(listing.rank),
      price: money({ value: listing.price, currency: 'EUR' })
    })).join('  |  ')
  }) : '';
}
function card(item) {
  const article = node('article', 'card');
  if (isBaytemuerSeller(item.seller)) article.classList.add('seller-baytemuer');
  const photo = node('button', 'photo');
  photo.type = 'button'; photo.setAttribute('aria-label', translate('open_images'));
  photo.disabled = !item.image;
  photo.addEventListener('click', async () => {
    photo.disabled = true;
    let images = item.images?.length ? item.images : [item.image].filter(Boolean);
    try {
      const response = await fetch('/api/ebay/images?' + new URLSearchParams({ id: item.id }));
      if (!response.ok) throw new Error(translate('image_error'));
      const data = await response.json();
      if (data.images?.length) images = data.images;
    } catch { /* The search image remains available if item details cannot be loaded. */ }
    finally { photo.disabled = false; }
    if (embedded) window.parent.postMessage({ type: 'ebay-gallery', title: item.title, images }, location.origin);
    else openEbayGallery(item.title, images);
  });
  photo.append(node('span', 'no-photo', translate('no_image')));
  if (item.image) {
    const img = node('img');
    img.src = item.image; img.alt = item.title; img.loading = 'lazy'; img.referrerPolicy = 'no-referrer';
    img.addEventListener('error', () => img.remove());
    photo.append(img);
  }
  const title = node('h3');
  const link = node('a', 'listing');
  highlightExactPartNumber(link, item.title, highlightedPartNumberQuery());
  link.href = item.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
  link.title = translate('open_listing');
  title.append(link);
  const details = node('div', 'item-details');
  details.append(title);
  const seller = node('div', 'seller');
  seller.append(node('span', '', translate('seller')));
  if (item.seller) {
    const sellerLink = node('a', 'seller-link', item.seller);
    sellerLink.href = 'https://www.ebay.de/usr/' + encodeURIComponent(item.seller);
    sellerLink.target = '_blank'; sellerLink.rel = 'noopener noreferrer';
    seller.append(sellerLink);
  } else seller.append(node('span', '', translate('unspecified')));
  details.append(seller);
  const feedback = [];
  if (Number.isInteger(item.feedbackScore)) feedback.push(translate('feedback_score', { score: new Intl.NumberFormat(locale).format(item.feedbackScore) }));
  if (item.feedbackPercentage != null && String(item.feedbackPercentage).trim() !== '' && Number.isFinite(Number(item.feedbackPercentage))) {
    feedback.push(translate('positive', { value: new Intl.NumberFormat(locale).format(Number(item.feedbackPercentage)) }));
  }
  if (feedback.length) details.append(node('div', 'seller-feedback', feedback.join(' · ')));
  const pricing = node('div', 'pricing');
  pricing.append(node('div', 'price', money(item.price)));
  const shippingKnown = item.shipping?.value != null && String(item.shipping.value).trim() !== ''
    && Number.isFinite(Number(item.shipping.value)) && Number(item.shipping.value) >= 0 && Boolean(item.shipping.currency);
  pricing.append(node('div', 'shipping', shippingKnown
    ? (Number(item.shipping.value) === 0 ? translate('free_shipping') : translate('shipping', { price: money(item.shipping) }))
    : translate('shipping_unknown')));
  if (shippingKnown && item.price?.currency === item.shipping.currency && item.price.value != null
      && String(item.price.value).trim() !== '' && Number.isFinite(Number(item.price.value)) && Number(item.price.value) >= 0) {
    pricing.append(node('div', 'total-price', translate('total', { price: money({
      value: Number(item.price.value) + Number(item.shipping.value), currency: item.price.currency
    }) })));
  }
  article.append(photo, details, pricing); return article;
}
function message(title, description, retry = false) {
  const box = node('div', 'message' + (retry ? ' error' : ''));
  box.append(node('h3', '', title), node('p', '', description));
  if (retry) {
    const button = node('button', '', translate('retry')); button.type = 'button';
    button.addEventListener('click', () => search()); box.append(button);
  }
  $('status').replaceChildren(box);
}
function readUrl() {
  const params = new URLSearchParams(location.search);
  const sort = params.get('sort');
  const page = Number(params.get('page') || 1);
  state = { q: normalizeEbayQuery(params.get('q')), sort: ['best', 'price', '-price', 'newlyListed'].includes(sort) ? sort : 'price', page: Number.isInteger(page) && page > 0 && page <= 100 ? page : 1, exact: params.get('exact') === 'true' };
  $('query').value = state.q; $('sort').value = state.sort;
  for (const name of ['business', 'used', 'germany']) {
    state[name] = params.get(name) !== 'false';
    $(name + 'Filter').checked = state[name];
  }
  $('exactFilter').checked = state.exact;
}
async function search(updateUrl = false) {
  controller?.abort();
  const current = new AbortController(); controller = current;
  const params = new URLSearchParams(state);
  updateEbaySearchTitle();
  if (embedded) params.set('embed', '1');
  params.set('lang', language);
  if (updateUrl && !embedded) history.pushState(null, '', `${location.pathname}?${params}`);
  $('pagination').hidden = true; $('count').textContent = ''; $('updated').textContent = '';
  resetStatistics();
  $('status').textContent = translate('loading');
  $('results').setAttribute('aria-busy', 'true');
  $('results').replaceChildren(...Array.from({ length: 8 }, () => { const el = node('div', 'skeleton'); el.setAttribute('aria-hidden', 'true'); return el; }));
  try {
    const stockRequest = fetch('/api/recycle/search', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ partNumber: state.q }), signal: current.signal
    }).then(async response => response.ok ? (await response.json()).count : null).catch(() => null);
    const response = await fetch(`/api/ebay/search?${params}`, { signal: current.signal });
    const data = await response.json();
    if (!response.ok) throw new Error(translate('search_error'));
    updateEbaySearchTitle(data.items);
    $('status').replaceChildren();
    $('results').replaceChildren(...data.items.map(card));
    updateStatistics(data.marketPrices || [], data.shippingKnownCount, data.shippingUnknownCount, data.baytemuerListings, await stockRequest);
    $('count').textContent = translate('results_count', { count: new Intl.NumberFormat(locale).format(data.total) });
    const lastQuery = translate('last_query', { time: new Date(data.fetchedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }) });
    $('updated').textContent = lastQuery + (data.cached ? ` · ${translate('cached')}` : '');
    if (!data.items.length) message(translate('no_results_title'), translate('no_results_description'));
    $('pagination').hidden = !data.hasNext && state.page === 1;
    $('previous').disabled = state.page <= 1; $('next').disabled = !data.hasNext;
    $('pageLabel').textContent = translate('page', { page: state.page });
  } catch (error) {
    if (current.signal.aborted) return;
    $('results').replaceChildren();
    message(translate('unavailable_title'), error.message === 'Failed to fetch' ? translate('connection_error') : error.message, true);
  } finally {
    if (controller === current) $('results').setAttribute('aria-busy', 'false');
  }
}
$('searchForm').addEventListener('submit', event => {
  event.preventDefault();
  const query = normalizeEbayQuery($('query').value);
  $('query').value = query;
  state = { q: query, sort: $('sort').value, page: 1, exact: $('exactFilter').checked };
  for (const name of ['business', 'used', 'germany']) state[name] = $(name + 'Filter').checked;
  search(true);
});
function filtersChanged() {
  showInitialState();
  message(translate('filters_changed'), translate('filters_changed_description'));
}
for (const name of ['business', 'used', 'germany', 'exact']) $(name + 'Filter').addEventListener('change', filtersChanged);
$('clearFilters').addEventListener('click', () => {
  for (const name of ['business', 'used', 'germany', 'exact']) $(name + 'Filter').checked = false;
  filtersChanged();
});
$('previous').addEventListener('click', () => { if (state.page > 1) { state.page--; search(true); } });
$('next').addEventListener('click', () => { state.page++; search(true); });
window.addEventListener('popstate', () => { readUrl(); showInitialState(); });
applyLanguage();
readUrl();
if (state.q) search(); else showInitialState();
if (embedded) {
  new ResizeObserver(() => window.parent.postMessage({ type: 'ebay-height', height: document.body.scrollHeight }, location.origin)).observe(document.body);
}

let ebayGalleryImages = [], ebayGalleryIndex = 0;
function renderEbayGallery() {
  $('ebayGalleryImage').src = ebayGalleryImages[ebayGalleryIndex];
  $('ebayGalleryCounter').textContent = `${ebayGalleryIndex + 1} / ${ebayGalleryImages.length}`;
  $('ebayGalleryPrev').disabled = $('ebayGalleryNext').disabled = ebayGalleryImages.length < 2;
}
function openEbayGallery(title, images) {
  if (!images.length) return;
  ebayGalleryImages = images; ebayGalleryIndex = 0;
  $('ebayGalleryTitle').textContent = title;
  renderEbayGallery(); $('ebayGallery').showModal();
}
$('ebayGalleryClose').onclick = () => $('ebayGallery').close();
$('ebayGalleryPrev').onclick = () => { ebayGalleryIndex = (ebayGalleryIndex - 1 + ebayGalleryImages.length) % ebayGalleryImages.length; renderEbayGallery(); };
$('ebayGalleryNext').onclick = () => { ebayGalleryIndex = (ebayGalleryIndex + 1) % ebayGalleryImages.length; renderEbayGallery(); };
$('ebayGallery').addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') $('ebayGalleryPrev').click();
  if (event.key === 'ArrowRight') $('ebayGalleryNext').click();
});
