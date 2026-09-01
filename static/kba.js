const form = document.querySelector('#kbaSearchForm');
const rowsBody = document.querySelector('#kbaRows');
const tableWrap = document.querySelector('#kbaTableWrap');
const emptyState = document.querySelector('#kbaEmpty');
const meta = document.querySelector('#kbaMeta');
const pagination = document.querySelector('#kbaPagination');
const totalEl = document.querySelector('#kbaTotal');
const vehiclesEl = document.querySelector('#kbaVehicles');
const pageInfoEl = document.querySelector('#kbaPageInfo');
const submitButton = document.querySelector('#kbaSubmit');
const detailDialog = document.querySelector('#kbaDetailDialog');
const detailTitle = document.querySelector('#kbaDetailTitle');
const detailContent = document.querySelector('#kbaDetailContent');
let currentPage = 1;
let currentRows = [];
let currentLanguage = ['tr', 'de', 'en'].includes(localStorage.getItem('lang')) ? localStorage.getItem('lang') : 'tr';

const labels = {
  tr: {
    pageTitle: 'KBA Marka Model Listesi',
    menuParts: 'Parcalar',
    menuVehicles: 'Araclar',
    menuKba: 'KBA Arama',
    connection: 'KBA listesi',
    eyebrow: 'KBA VERITABANI',
    title: 'KBA numarasi bulunan marka modeller',
    reset: 'Temizle',
    generalSearch: 'Genel arama',
    generalPlaceholder: 'Marka, model, KBA, motor kodu, arac no veya VIN',
    brand: 'Marka',
    model: 'Model',
    type: 'Tip',
    engineCode: 'Motor kodu',
    pageSize: 'Sayfa',
    list: 'Listele',
    combinations: 'Kombinasyon',
    vehicleRecords: 'Arac kaydi',
    page: 'Sayfa',
    results: 'SONUCLAR',
    resultTitle: 'Marka / model / KBA listesi',
    enterCriteria: 'Arama kriterlerini girin.',
    readyTitle: 'Liste hazir',
    readyText: 'KBA numarasi bulunan araclari listelemek icin arama yapin.',
    year: 'Baujahr',
    count: 'Kayit',
    sampleVehicle: 'Ornek arac',
    detail: 'DETAY',
    vehicleCount: 'ARAC SAYISI',
    group: 'GRUP',
    vehicleNo: 'ARAC NO',
    brandModel: 'MARKA / MODEL',
    yearReg: 'YIL / TESCIL',
    color: 'RENK',
    copied: 'KBA KOPYALANDI.',
    copyFailed: 'KOPYALAMA YAPILAMADI.',
    loading: 'YUKLENIYOR...',
    detailMissing: 'DETAY BULUNAMADI',
    detailMissingText: 'BU KBA GRUBU ICIN ARAC KAYDI GELMEDI.',
    detailFailed: 'DETAY ALINAMADI',
    queryFailed: 'KBA SORGUSU BASARISIZ'
  },
  de: {
    pageTitle: 'KBA Marken- und Modellliste',
    menuParts: 'Teile',
    menuVehicles: 'Fahrzeuge',
    menuKba: 'KBA-Suche',
    connection: 'KBA-Liste',
    eyebrow: 'KBA-DATENBANK',
    title: 'Marken und Modelle mit KBA-Nummer',
    reset: 'Zurucksetzen',
    generalSearch: 'Allgemeine Suche',
    generalPlaceholder: 'Marke, Modell, KBA, Motorcode, Fahrzeugnummer oder VIN',
    brand: 'Marke',
    model: 'Modell',
    type: 'Typ',
    engineCode: 'Motorcode',
    pageSize: 'Seite',
    list: 'Anzeigen',
    combinations: 'Kombinationen',
    vehicleRecords: 'Fahrzeuge',
    page: 'Seite',
    results: 'ERGEBNISSE',
    resultTitle: 'Marke / Modell / KBA Liste',
    enterCriteria: 'Suchkriterien eingeben.',
    readyTitle: 'Liste bereit',
    readyText: 'Suchen Sie nach Fahrzeugen mit KBA-Nummer.',
    year: 'Baujahr',
    count: 'Anzahl',
    sampleVehicle: 'Beispiel',
    detail: 'DETAIL',
    vehicleCount: 'FAHRZEUGANZAHL',
    group: 'GRUPPE',
    vehicleNo: 'FAHRZEUGNR.',
    brandModel: 'MARKE / MODELL',
    yearReg: 'BAUJAHR / ERSTZUL.',
    color: 'FARBE',
    copied: 'KBA KOPIERT.',
    copyFailed: 'KOPIEREN NICHT MOGLICH.',
    loading: 'LADEN...',
    detailMissing: 'KEINE DETAILS',
    detailMissingText: 'FUR DIESE KBA-GRUPPE WURDEN KEINE FAHRZEUGE GEFUNDEN.',
    detailFailed: 'DETAILS KONNTEN NICHT GELADEN WERDEN',
    queryFailed: 'KBA-ABFRAGE FEHLGESCHLAGEN'
  },
  en: {
    pageTitle: 'KBA Make Model List',
    menuParts: 'Parts',
    menuVehicles: 'Vehicles',
    menuKba: 'KBA Search',
    connection: 'KBA list',
    eyebrow: 'KBA DATABASE',
    title: 'Makes and models with KBA numbers',
    reset: 'Clear',
    generalSearch: 'General search',
    generalPlaceholder: 'Make, model, KBA, engine code, vehicle number or VIN',
    brand: 'Make',
    model: 'Model',
    type: 'Type',
    engineCode: 'Engine code',
    pageSize: 'Page',
    list: 'List',
    combinations: 'Combinations',
    vehicleRecords: 'Vehicle records',
    page: 'Page',
    results: 'RESULTS',
    resultTitle: 'Make / model / KBA list',
    enterCriteria: 'Enter search criteria.',
    readyTitle: 'List ready',
    readyText: 'Search vehicles that have a KBA number.',
    year: 'Year',
    count: 'Count',
    sampleVehicle: 'Sample vehicle',
    detail: 'DETAIL',
    vehicleCount: 'VEHICLE COUNT',
    group: 'GROUP',
    vehicleNo: 'VEHICLE NO',
    brandModel: 'MAKE / MODEL',
    yearReg: 'YEAR / REG.',
    color: 'COLOR',
    copied: 'KBA COPIED.',
    copyFailed: 'COPY FAILED.',
    loading: 'LOADING...',
    detailMissing: 'NO DETAILS FOUND',
    detailMissingText: 'NO VEHICLE RECORDS WERE RETURNED FOR THIS KBA GROUP.',
    detailFailed: 'DETAILS COULD NOT BE LOADED',
    queryFailed: 'KBA QUERY FAILED'
  }
};

const l = key => labels[currentLanguage][key] || labels.tr[key] || key;

function applyTheme() {
  document.body.classList.toggle('light-theme', localStorage.getItem('theme') === 'light');
}

function applyChromeLanguage() {
  document.documentElement.lang = currentLanguage;
  document.title = l('pageTitle');
  const setText = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.textContent = value;
  };
  const setPlaceholder = (selector, value) => {
    const element = document.querySelector(selector);
    if (element) element.placeholder = value;
  };
  setText('#kbaPartsMenu', l('menuParts'));
  setText('#kbaVehiclesMenu', l('menuVehicles'));
  setText('#kbaKbaMenu', l('menuKba'));
  setText('#kbaFooterParts', l('menuParts'));
  setText('#kbaFooterVehicles', l('menuVehicles'));
  setText('#kbaFooterKba', l('menuKba'));
  setText('#connectionText', l('connection'));
  setText('.kba-search-panel .eyebrow', l('eyebrow'));
  setText('.kba-search-panel h1', l('title'));
  setText('#kbaReset', l('reset'));
  setText('label.kba-query span', l('generalSearch'));
  setPlaceholder('input[name="q"]', l('generalPlaceholder'));
  document.querySelectorAll('.kba-filter-grid label span').forEach((span, index) => {
    span.textContent = [l('brand'), l('model'), l('type'), 'KBA', l('engineCode'), l('pageSize')][index] || span.textContent;
  });
  setText('#kbaSubmit span:last-child', l('list'));
  document.querySelectorAll('.kba-summary article span').forEach((span, index) => {
    span.textContent = [l('combinations'), l('vehicleRecords'), l('page')][index] || span.textContent;
  });
  setText('.kba-results-panel .eyebrow', l('results'));
  setText('.kba-results-panel h2', l('resultTitle'));
  setText('#kbaMeta', l('enterCriteria'));
  setText('#kbaEmpty h3', l('readyTitle'));
  setText('#kbaEmpty p', l('readyText'));
  document.querySelectorAll('.kba-table thead th').forEach((th, index) => {
    th.textContent = [l('brand'), l('model'), l('type'), 'KBA', l('engineCode'), l('year'), l('count'), l('sampleVehicle'), ''][index] || '';
  });
  setText('#kbaDetailDialog .eyebrow', l('detail'));
  setText('#kbaDetailTitle', l('detail'));
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function display(value) {
  const clean = value === null || value === undefined || value === '' ? '-' : value;
  return esc(String(clean).toLocaleUpperCase('tr-TR'));
}

function number(value) {
  const locale = currentLanguage === 'en' ? 'en-US' : currentLanguage === 'de' ? 'de-DE' : 'tr-TR';
  return new Intl.NumberFormat(locale).format(Number(value) || 0);
}

function brandSlug(value) {
  return String(value || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function brandLogo(value) {
  const slug = brandSlug(value);
  if (!slug) return '<span class="kba-logo-fallback">?</span>';
  const fallback = esc(String(value || '?').charAt(0).toLocaleUpperCase('tr-TR'));
  return `<span class="kba-brand-logo"><img src="/brands/${esc(slug)}.svg" alt="" onerror="this.remove();this.parentElement.textContent='${fallback}'"></span>`;
}

function formatKba(value) {
  if (!value) return '-';
  const raw = String(value).trim().toLocaleUpperCase('tr-TR');
  const compact = raw.replace(/\s+/g, '');
  return compact.length === 7 ? `${compact.slice(0, 4)} ${compact.slice(4)}` : raw;
}

function yearRange(from, to) {
  if (!from && !to) return '-';
  if (String(from || '') === String(to || '')) return from || to;
  return `${from || '-'} - ${to || '-'}`;
}

function date(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat('de-DE').format(parsed);
}

function kilometers(value) {
  if (value === null || value === undefined || value === '') return '-';
  const numeric = Number(String(value).replace(/[^0-9-]/g, ''));
  return Number.isFinite(numeric) ? number(numeric) : display(value);
}

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    meta.textContent = l('copied');
  } catch (_) {
    meta.textContent = l('copyFailed');
  }
}

function renderPagination(data) {
  if (data.pages <= 1) {
    pagination.classList.add('hidden');
    pagination.innerHTML = '';
    return;
  }
  const start = Math.max(1, data.page - 2);
  const end = Math.min(data.pages, data.page + 2);
  let html = `<span class="kba-page-status">${display(l('page'))} ${number(data.page)} / ${number(data.pages)}</span>`;
  html += `<button data-page="${data.page - 1}" ${data.page === 1 ? 'disabled' : ''}>&lt;</button>`;
  for (let page = start; page <= end; page++) {
    html += `<button data-page="${page}" class="${page === data.page ? 'active' : ''}" aria-current="${page === data.page ? 'page' : 'false'}">${page}</button>`;
  }
  html += `<button data-page="${data.page + 1}" ${data.page === data.pages ? 'disabled' : ''}>&gt;</button>`;
  pagination.innerHTML = html;
  pagination.classList.remove('hidden');
}

function render(data) {
  currentRows = data.rows;
  totalEl.textContent = number(data.total);
  vehiclesEl.textContent = number(data.vehicles);
  pageInfoEl.textContent = `${number(data.page)} / ${number(data.pages)}`;
  meta.textContent = `${number(data.total)} ${l('combinations').toLocaleUpperCase('tr-TR')}, ${number(data.vehicles)} ${l('vehicleRecords').toLocaleUpperCase('tr-TR')}`;
  emptyState.classList.toggle('hidden', data.rows.length > 0);
  tableWrap.classList.toggle('hidden', data.rows.length === 0);
  rowsBody.innerHTML = data.rows.map((row, index) => {
    const kba = formatKba(row.KBA_Nummer);
    return `<tr>
      <td class="kba-brand-cell">${brandLogo(row.Marke)}<strong>${display(row.Marke)}</strong></td>
      <td><strong>${display(row.Modell)}</strong></td>
      <td>${display(row.Typ)}</td>
      <td><button class="kba-copy" type="button" data-copy="${esc(kba)}">${display(kba)}</button></td>
      <td>${display(row.Motorcode)}</td>
      <td>${display(yearRange(row.BaujahrVon, row.BaujahrBis))}</td>
      <td>${number(row.FahrzeugAnzahl)}</td>
      <td>${display(row.BeispielFahrzeug)}</td>
      <td><button class="detail-button kba-detail-button" type="button" data-detail-index="${index}">${display(l('detail'))}</button></td>
    </tr>`;
  }).join('');
  renderPagination(data);
}

async function showKbaDetails(row) {
  detailTitle.textContent = `${formatKba(row.KBA_Nummer)} - ${row.Marke || '-'} ${row.Modell || ''}`.toLocaleUpperCase('tr-TR');
  detailContent.innerHTML = `<div class="kba-detail-loading">${display(l('loading'))}</div>`;
  detailDialog.showModal();
  const params = new URLSearchParams({
    kba: formatKba(row.KBA_Nummer),
    brand: row.Marke || '',
    model: row.Modell || '',
    type: row.Typ || ''
  });
  try {
    const response = await fetch(`/api/kba/details?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Detay alinamadi');
    detailContent.innerHTML = data.rows.length ? `
      <div class="kba-detail-summary">
        <article><span>KBA</span><strong>${display(formatKba(row.KBA_Nummer))}</strong></article>
        <article><span>${display(l('vehicleCount'))}</span><strong>${number(data.total)}</strong></article>
        <article><span>${display(l('group'))}</span><strong>${display(row.Marke)} ${display(row.Modell)}</strong></article>
      </div>
      <div class="table-wrap kba-detail-table-wrap">
        <table class="kba-detail-table">
          <thead><tr>
            <th>${display(l('vehicleNo'))}</th><th>${display(l('brandModel'))}</th><th>${display(l('type'))}</th><th>VIN</th><th>${display(l('engineCode'))}</th><th>${display(l('yearReg'))}</th><th>KM</th><th>${display(l('color'))}</th>
          </tr></thead>
          <tbody>${data.rows.map(vehicle => `<tr>
            <td><strong>${display(vehicle.FahrzeugNummer)}</strong></td>
            <td class="kba-brand-cell">${brandLogo(vehicle.Marke)}<div><strong>${display(vehicle.Marke)}</strong><span>${display(vehicle.Modellcode)}</span></div></td>
            <td>${display(vehicle.Typ)}</td>
            <td>${display(vehicle.VIN)}</td>
            <td><div class="kba-code-stack"><span>${display(vehicle.Motorcode)}</span><small>${display(vehicle.Getriebecode)}</small></div></td>
            <td>${display(vehicle.Baujahr)}<div class="sub">${display(date(vehicle.Erstzulassung))}</div></td>
            <td>${kilometers(vehicle.Kilometer)}</td>
            <td>${display(vehicle.Farbe)}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>` : `<div class="empty"><h3>${display(l('detailMissing'))}</h3><p>${display(l('detailMissingText'))}</p></div>`;
  } catch (error) {
    detailContent.innerHTML = `<div class="empty"><h3>${display(l('detailFailed'))}</h3><p>${esc(error.message)}</p></div>`;
  }
}

async function loadKba(event) {
  event?.preventDefault();
  if (event?.type === 'submit') currentPage = 1;
  submitButton.disabled = true;
  const oldHtml = submitButton.innerHTML;
  submitButton.textContent = l('loading');
  const params = new URLSearchParams(new FormData(form));
  params.set('page', currentPage);
  try {
    const response = await fetch(`/api/kba?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'KBA listesi alinamadi');
    render(data);
    history.replaceState(null, '', `/kba?${params}`);
  } catch (error) {
    meta.textContent = `${l('queryFailed')}: ${error.message}`;
    emptyState.classList.remove('hidden');
    tableWrap.classList.add('hidden');
  } finally {
    submitButton.disabled = false;
    submitButton.innerHTML = oldHtml;
  }
}

form.addEventListener('submit', loadKba);
form.elements.kba.addEventListener('input', () => {
  const start = form.elements.kba.selectionStart;
  const end = form.elements.kba.selectionEnd;
  form.elements.kba.value = form.elements.kba.value.toLocaleUpperCase('tr-TR');
  form.elements.kba.setSelectionRange(start, end);
});
document.querySelector('#kbaReset').addEventListener('click', () => {
  form.reset();
  currentPage = 1;
  loadKba();
});
pagination.addEventListener('click', event => {
  const button = event.target.closest('button[data-page]');
  if (!button || button.disabled) return;
  currentPage = Number(button.dataset.page);
  loadKba();
  window.scrollTo({ top: 0, behavior: 'smooth' });
});
rowsBody.addEventListener('click', event => {
  const copyButton = event.target.closest('.kba-copy');
  if (copyButton) {
    copyText(copyButton.dataset.copy || '');
    return;
  }
  const detailButton = event.target.closest('button[data-detail-index]');
  if (detailButton) showKbaDetails(currentRows[Number(detailButton.dataset.detailIndex)]);
});
document.querySelector('#kbaDetailClose').addEventListener('click', () => detailDialog.close());
detailDialog.addEventListener('click', event => {
  if (event.target === detailDialog) detailDialog.close();
});

const initialParams = new URLSearchParams(location.search);
for (const [name, value] of initialParams.entries()) {
  const field = form.elements[name];
  if (field) field.value = value;
}
currentPage = Math.max(1, Number(initialParams.get('page')) || 1);
document.querySelector('#kbaFooterYear').textContent = new Date().getFullYear();
applyTheme();
applyChromeLanguage();
window.addEventListener('storage', event => {
  if (event.key === 'theme') applyTheme();
  if (event.key === 'lang') {
    currentLanguage = ['tr', 'de', 'en'].includes(event.newValue) ? event.newValue : 'tr';
    applyChromeLanguage();
    if (currentRows.length) loadKba();
  }
});
loadKba();
