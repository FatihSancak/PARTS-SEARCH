'use strict';

(() => {
  const cookieName = 'baytemur_orders_view';
  const logos = { ebay: 'ebay.svg', ovoko: 'ovoko.svg', teilehaber: 'teilehaber.svg', autoteilemarkt: 'autoteilemarkt.svg', partsbit: 'partsbit.svg', opisto: 'opisto.svg' };
  let orders = [];

  const readCookie = () => document.cookie.split('; ').find(item => item.startsWith(`${cookieName}=`))?.split('=').slice(1).join('=');
  const currentView = () => readCookie() === 'cards' ? 'cards' : 'list';
  const setView = (view) => {
    document.cookie = `${cookieName}=${view}; Max-Age=31536000; Path=/; SameSite=Lax`;
    const root = document.querySelector('#orders');
    if (root) root.dataset.view = view;
    document.querySelectorAll('.order-view button').forEach(button => button.classList.toggle('active', button.dataset.view === view));
    document.querySelectorAll('.order').forEach(card => { const badge = card.querySelector('.marketplace-overlay'); const target = card.querySelector('.order-article'); if (badge && target) target.prepend(badge); });
  };
  const orderCode = (card) => [...card.querySelectorAll('.meta span')].map(item => item.textContent).find(value => value.includes(':'))?.split(':').slice(1).join(':').trim() || '';
  const marketplace = (source) => Object.keys(logos).find(key => String(source || '').toLowerCase().replace(/[\s-]/g, '').includes(key));
  const brandSlug = (value) => {
    const key = String(value || '').trim().toUpperCase().replace('Ë', 'E');
    const aliases = { VW: 'volkswagen', VOLKSWAGEN: 'volkswagen', 'MERCEDES BENZ': 'mercedes', 'MERCEDES-BENZ': 'mercedes', MERCEDES: 'mercedes', CITROEN: 'citroen', 'ALFA ROMEO': 'alfa-romeo', 'LAND ROVER': 'land-rover', 'RANGE ROVER': 'land-rover', 'KIA MOTOR': 'kia', HYNDAI: 'hyundai', PEGEOT: 'peugeot' };
    return aliases[key] || key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  };
  const brandBadge = (brand, className) => {
    if (!brand) return null;
    const badge = document.createElement('span');
    badge.className = className;
    badge.title = brand;
    const image = new Image();
    image.src = `/brands/${brandSlug(brand)}.svg`;
    image.alt = `${brand} logosu`;
    image.onerror = () => badge.remove();
    badge.append(image);
    return badge;
  };

  const ensureToolbar = () => {
    if (document.querySelector('.order-view')) return;
    const toolbar = document.createElement('div');
    toolbar.className = 'order-view';
    toolbar.innerHTML = '<span>Görünüm</span><button type="button" data-view="list">Liste</button><button type="button" data-view="cards">Kutular</button>';
    toolbar.querySelectorAll('button').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
    document.querySelector('#status')?.after(toolbar);
    setView(currentView());
  };

  const decorate = () => {
    ensureToolbar();
    document.querySelectorAll('.order').forEach(card => {
      const existingBadge = card.querySelector('.photo .marketplace-overlay');
      const articleLine = card.querySelector('.order-article');
      if (existingBadge && articleLine) articleLine.prepend(existingBadge);
      const sourceElement = card.querySelector('.source');
      const order = orders.find(item => item.orderCode === orderCode(card)) || { source: sourceElement?.dataset.marketplace || sourceElement?.querySelector('img')?.alt || sourceElement?.textContent || '' };
      if (card.dataset.marketplaceReady) {
        const key = card.dataset.marketplace;
        const target = card.querySelector('.order-article');
        if (key && target && !card.querySelector('.marketplace-overlay')) {
          const badge = document.createElement('span');
          badge.className = `marketplace-badge marketplace-overlay marketplace-${key}`;
          const image = new Image();
          image.src = `/marketplace-logos/${logos[key]}`;
          image.alt = key;
          badge.append(image);
          target.prepend(badge);
        }
        return;
      }
      card.dataset.marketplaceReady = 'true';
      const locationBadge = [...card.querySelectorAll('.order-article span')].find(item => /^(?:Depo konumu|Lagerort|Storage location):/i.test(item.textContent));
      if (locationBadge) { const value = locationBadge.textContent.replace(/^[^:]+:\s*/, '').replace(/\s*·\s*Bottrop\s*$/i, ''); const pin = new Image(); pin.className = 'location-pin'; pin.src = '/location-pin.png'; pin.alt = ''; locationBadge.classList.add('location-badge'); locationBadge.replaceChildren(pin, document.createTextNode(value)); }
      const source = card.querySelector('.source');
      const key = marketplace(order.source);
      if (key) card.dataset.marketplace = key;
      if (source && key) {
        const badge = document.createElement('span');
        badge.className = `marketplace-badge marketplace-overlay marketplace-${key}`;
        const image = new Image();
        image.src = `/marketplace-logos/${logos[key]}`;
        image.alt = order.source;
        badge.append(image);
        source.replaceWith(badge);
        card.querySelector('.order-article')?.prepend(badge);
      }
      const brand = card.dataset.brand;
      if (brand && !card.querySelector('.order-brand-overlay')) {
        const overlay = brandBadge(brand, 'order-brand-overlay');
        if (overlay) card.querySelector('.photo')?.append(overlay);
      }
      if (brand && !card.querySelector('.order-brand-inline')) {
        const inline = brandBadge(brand, 'order-brand-inline');
        if (inline) {
          card.querySelector('.details h2')?.append(inline);
        }
      }
      const article = card.querySelector('.order-article');
      if (article && order.productUrl && article.firstChild?.nodeType === Node.TEXT_NODE) {
        const link = document.createElement('a');
        link.className = 'article-link';
        link.href = order.productUrl;
        link.target = '_blank';
        link.rel = 'noopener';
        link.textContent = article.firstChild.textContent;
        article.replaceChild(link, article.firstChild);
      }
    });
  };

  const overlayStyle = document.createElement('style');
  overlayStyle.textContent = `.photo{position:relative}.photo .marketplace-overlay{position:absolute!important;right:8px!important;bottom:8px!important;z-index:2;min-width:0!important;min-height:0!important;padding:4px 6px!important;border-radius:6px!important;background:rgba(255,255,255,.94)!important;border:1px solid rgba(0,0,0,.12)!important;box-shadow:0 1px 4px rgba(0,0,0,.2)}.photo .marketplace-overlay img{width:77px!important;height:15px!important;max-width:77px!important;max-height:15px!important;object-fit:contain}.photo .marketplace-overlay.marketplace-ovoko img{width:61px!important}.location-badge{font-size:12px!important;color:#36506e!important}.order-brand-overlay{position:absolute;top:7px;right:7px;z-index:3;display:inline-grid;place-items:center;width:38px;height:38px;padding:5px;border:1px solid rgba(0,0,0,.12);border-radius:7px;background:rgba(255,255,255,.94);box-shadow:0 1px 4px rgba(0,0,0,.18)}.order-brand-overlay img{width:100%;height:100%;object-fit:contain}.order-brand-inline{display:none;vertical-align:middle;margin-left:6px;padding:3px 5px;border:1px solid #d7e2e3;border-radius:6px;background:#fff}.order-brand-inline img{display:block;width:27px;height:18px;object-fit:contain}.orders[data-view="list"] .order-brand-overlay{display:inline-grid}.orders[data-view="list"] .order-brand-inline{display:none}`;
  document.head.append(overlayStyle);
  const channelLineStyle = document.createElement('style');
  channelLineStyle.textContent = `.order-article .marketplace-overlay{position:static!important;display:inline-flex!important;vertical-align:middle;margin:0 7px 0 0!important;padding:3px 6px!important}.order-article .marketplace-overlay img{width:72px!important;height:14px!important;object-fit:contain}`;
  document.head.append(channelLineStyle);
  const pinStyle = document.createElement('style');
  pinStyle.textContent = `.location-badge{display:inline-flex!important;align-items:center;gap:4px}.location-pin{width:13px;height:13px;object-fit:contain;flex:0 0 auto}.photo img{object-fit:contain!important}.og-stage{position:relative!important;display:block!important;overflow:hidden!important;background:#111}.og-stage img{position:absolute!important;top:0!important;right:48px!important;bottom:0!important;left:48px!important;width:calc(100% - 96px)!important;height:100%!important;min-width:0!important;min-height:0!important;max-width:none!important;max-height:none!important;object-fit:contain!important;object-position:center!important}.og-stage button[data-step]{position:absolute!important;top:0!important;bottom:0!important;z-index:2!important;width:48px!important}.og-stage button[data-step="-1"]{left:0!important}.og-stage button[data-step="1"]{right:0!important}`;
  document.head.append(pinStyle);
  const style = document.createElement('style');
  style.textContent = `.order-view{display:flex;align-items:center;gap:6px;margin:10px 0 16px;color:#60757d;font-size:12px;font-weight:700}.order-view button{height:29px;border:1px solid #cbdadb;border-radius:6px;background:#fff;color:#47616b;padding:0 9px;cursor:pointer;font-size:12px}.order-view button.active{background:#146c60;color:#fff;border-color:#146c60}.article-link{color:#172d36;text-decoration:none}.article-link:hover{color:#146c60;text-decoration:underline}.orders[data-view="list"]{display:grid;gap:0;border:0;border-radius:0;overflow:visible}.orders[data-view="list"] .order{grid-template-columns:256px minmax(0,1fr) 150px;gap:16px;min-height:235px;padding:8px 0 16px;border:0;border-bottom:1px solid #d8e1e2;border-radius:0;box-shadow:none}.orders[data-view="list"] .photo{width:256px;height:224px;border:0;border-radius:9px;background:#f3f3f3}.orders[data-view="list"] .details{align-self:start;padding-top:1px}.orders[data-view="list"] .details h2{font-size:17px;line-height:1.32;margin:5px 0 10px}.orders[data-view="list"] .price{align-self:start;text-align:left;padding-top:44px;font-size:22px;color:#111}.orders[data-view="list"] .price small,.orders[data-view="cards"] .price small{display:none}.orders[data-view="cards"]{grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.orders[data-view="cards"] .order{display:flex;flex-direction:column;gap:0;padding:0;border:0;border-radius:9px;overflow:hidden;box-shadow:none}.orders[data-view="cards"] .photo{width:100%;height:216px;border:0;border-radius:9px 9px 0 0;background:#f3f3f3}.orders[data-view="cards"] .details{padding:12px 7px 0;flex:1}.orders[data-view="cards"] .details h2{font-size:15px;line-height:1.35;margin:7px 0 8px}.orders[data-view="cards"] .price{width:100%;text-align:left;font-size:21px;color:#111;padding:9px 7px 12px}@media(max-width:850px){.orders[data-view="cards"]{grid-template-columns:repeat(2,minmax(0,1fr))}.orders[data-view="list"] .order{grid-template-columns:160px minmax(0,1fr)}.orders[data-view="list"] .photo{width:160px;height:140px}.orders[data-view="list"] .price{grid-column:2;padding-top:0}}@media(max-width:560px){.orders[data-view="cards"]{grid-template-columns:1fr}.orders[data-view="list"] .order{grid-template-columns:104px minmax(0,1fr);min-height:0}.orders[data-view="list"] .photo{width:104px;height:92px}.orders[data-view="list"] .details h2{font-size:14px}.orders[data-view="list"] .price{font-size:17px}}`;
  document.head.append(style);

  const start = () => {
    const root = document.querySelector('#orders');
    if (!root) return;
    new MutationObserver(decorate).observe(root, { childList: true, subtree: true });
    ensureToolbar();
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
