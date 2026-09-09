for (const href of ['/sales-report-detail.css', '/sales-report-all-users.css']) {
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = href;
  document.head.appendChild(style);
}

const $ = id => document.getElementById(id);
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const num = new Intl.NumberFormat('de-DE');
const staffNames = { FER: 'Feras J. Alterek' };
const colors = ['#2558bd', '#ed382c', '#d7921f', '#258b66', '#7e57c2', '#607d8b', '#c04775', '#5f7b2d'];
let reportData = { rows: [], month: 0 };
let fullCurrentData = null;
let previousYearData = null;
let selectedPerson = '';
let selectedUnit = '';
const chartInstances = {};

const esc = value => String(value ?? '').replace(/[&<>'"]/g, char => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
}[char]));

function staffName(code, row = null) {
  return row?.name || staffNames[code] || code;
}

ReportDrilldown.configure({
  getRows: () => reportData.rows || [],
  getStaffName: code => staffName(code)
});

const now = new Date();
for (let year = now.getFullYear(); year >= 2020; year--) $('year').add(new Option(year, year));
for (let month = 1; month <= 12; month++) {
  $('month').add(new Option(new Intl.DateTimeFormat('de-DE', { month: 'long' }).format(new Date(2020, month - 1, 1)), month));
}
$('reportYear').textContent = now.getFullYear();

function aggregate(rows, keyFn) {
  const map = new Map();
  for (const row of rows) {
    const key = keyFn(row);
    const value = map.get(key) || { total: 0, count: 0 };
    value.total += Number(row.amount) || 0;
    value.count++;
    map.set(key, value);
  }
  if (/\.code\b/.test(String(keyFn))) {
    for (const code of Object.keys(staffNames)) {
      if (!map.has(code)) map.set(code, { total: 0, count: Number.MIN_VALUE });
    }
  }
  return map;
}

function activeRows(rows) {
  return (rows || []).filter(row => !row.cancelled);
}

function filterRows(rows, person = selectedPerson, unit = selectedUnit) {
  return (rows || []).filter(row => (!person || row.code === person) && (!unit || String(row.unit || '0') === unit));
}

function totalAmount(rows) {
  return (rows || []).reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
}

function changeInfo(current, previous) {
  const difference = current - previous;
  const percent = previous ? (difference / Math.abs(previous)) * 100 : current ? 100 : 0;
  return { difference, percent };
}

function changeBadge(current, previous, compact = false) {
  const change = changeInfo(current, previous);
  const cls = change.difference > 0 ? 'up' : change.difference < 0 ? 'down' : 'flat';
  const sign = change.difference > 0 ? '+' : '';
  const text = previous
    ? `${sign}${change.percent.toFixed(1)}%`
    : current ? '+100.0%' : '0.0%';
  return `<span class="change-badge ${cls}" title="Onceki yil: ${esc(euro.format(previous))}">${text}${compact ? '' : ` · ${esc(euro.format(change.difference))}`}</span>`;
}

function destroyChart(id) {
  if (chartInstances[id]) {
    chartInstances[id].destroy();
    delete chartInstances[id];
  }
}

function hasChartJs() {
  return typeof window.Chart === 'function';
}

function chartDefaults() {
  return {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    plugins: {
      legend: { labels: { boxWidth: 12, usePointStyle: true } },
      tooltip: {
        callbacks: {
          label(context) {
            const parsed = context.parsed || {};
            const value = parsed.x ?? parsed.y ?? context.raw ?? 0;
            return `${context.dataset.label}: ${euro.format(value)}`;
          }
        }
      }
    }
  };
}

function prepareChartCanvas(container, id) {
  destroyChart(id);
  container.classList.remove('bar-chart', 'columns', 'donut');
  container.classList.add('chart-canvas-wrap');
  if (id === 'donut') container.classList.add('donut-chart-wrap');
  container.innerHTML = `<canvas id="${id}Canvas"></canvas>`;
  return document.getElementById(`${id}Canvas`);
}

function openReportPeriod(key, monthSelected, personCode = '') {
  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.dataset.reportPeriod = key;
  trigger.dataset.periodLevel = monthSelected ? 'day' : 'month';
  if (personCode) trigger.dataset.periodPerson = personCode;
  trigger.hidden = true;
  document.body.appendChild(trigger);
  trigger.click();
  trigger.remove();
}

function comparableKey(key) {
  return String(key).length === 10 ? String(key).slice(5) : String(key).slice(5);
}

function ensureComparisonPanel() {
  let panel = $('comparisonPanel');
  if (panel) return panel;
  panel = document.createElement('section');
  panel.id = 'comparisonPanel';
  panel.className = 'comparison-panel';
  const cards = document.querySelector('.cards');
  cards.insertAdjacentElement('afterend', panel);
  return panel;
}

function renderComparisonPanel(currentRows, previousRows) {
  const currentTotal = totalAmount(currentRows);
  const previousTotal = totalAmount(previousRows);
  const currentCount = currentRows.length;
  const previousCount = previousRows.length;
  const currentAverage = currentCount ? currentTotal / currentCount : 0;
  const previousAverage = previousCount ? previousTotal / previousCount : 0;
  const year = Number($('year').value);
  ensureComparisonPanel().innerHTML = `
    <article><small>${year - 1} toplam</small><strong>${euro.format(previousTotal)}</strong>${changeBadge(currentTotal, previousTotal)}</article>
    <article><small>Fatura degisimi</small><strong>${num.format(currentCount)} / ${num.format(previousCount)}</strong>${changeBadge(currentCount, previousCount, true)}</article>
    <article><small>Ortalama degisimi</small><strong>${euro.format(currentAverage)}</strong>${changeBadge(currentAverage, previousAverage)}</article>`;
}

function populatePersonFilter(currentRows, previousRows) {
  const select = $('personFilter');
  if (!select) return;
  const sourceRows = filterRows([...(currentRows || []), ...(previousRows || [])], '', selectedUnit);
  const codes = [...new Set(sourceRows.map(row => row.code).filter(Boolean))].sort();
  const oldValue = select.value || selectedPerson;
  const personOptions = codes.map(code => (
    `<option value="${esc(code)}">${esc(staffName(code))} - ${esc(code)}</option>`
  )).join('');
  select.innerHTML = '<option value="">Tüm kullanıcılar</option>' + personOptions;
  select.value = codes.includes(oldValue) ? oldValue : '';
  selectedPerson = select.value;
}

function populateUnitFilter(currentRows, previousRows) {
  const select = $('unitFilter');
  if (!select) return;
  const sourceRows = filterRows([...(currentRows || []), ...(previousRows || [])], selectedPerson, '');
  const names = Object.assign({}, fullCurrentData?.units || {}, previousYearData?.units || {});
  for (const row of sourceRows) if (row.unit) names[row.unit] = row.unit_name || names[row.unit] || `Birim ${row.unit}`;
  const codes = [...new Set(sourceRows.map(row => String(row.unit || '0')).filter(Boolean))].sort((left, right) => Number(left) - Number(right));
  const oldValue = select.value || selectedUnit;
  select.innerHTML = '<option value="">Tüm bölümler</option>' + codes.map(code => (
    `<option value="${esc(code)}">${esc(names[code] || `Birim ${code}`)}</option>`
  )).join('');
  select.value = codes.includes(oldValue) ? oldValue : '';
  selectedUnit = select.value;
}

function renderStatusBreakdown(data, rows) {
  const active = rows.filter(row => !row.cancelled);
  const cancelled = rows.filter(row => row.cancelled);
  $('activeInvoiceSummary').textContent = `${num.format(active.length)} fatura`;
  $('activeInvoiceAmount').textContent = euro.format(totalAmount(active));
  $('cancelledInvoiceSummary').textContent = `${num.format(cancelled.length)} fatura`;
  $('cancelledInvoiceAmount').textContent = euro.format(totalAmount(cancelled));
}

function closePerson() {
  $('personModal').classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function renderPeriodColumns(container, points, previousMap, monthSelected, personCode = '') {
  destroyChart(personCode ? 'personTrend' : 'trendChart');
  container.classList.remove('chart-canvas-wrap');
  container.classList.add('columns');
  const max = Math.max(1, ...points.map(([, value]) => value.total));
  container.innerHTML = points.map(([key, value]) => {
    const previous = previousMap.get(comparableKey(key))?.total || 0;
    const attrs = personCode ? ` data-period-person="${esc(personCode)}"` : '';
    return `<button class="column period-column" style="height:${Math.max(2, value.total / max * 100)}%" data-value="${esc(euro.format(value.total))} · Onceki yil ${esc(euro.format(previous))}" data-report-period="${key}" data-period-level="${monthSelected ? 'day' : 'month'}"${attrs}><span>${monthSelected ? key.slice(8) : key.slice(5)}</span>${changeBadge(value.total, previous, true)}</button>`;
  }).join('');
}

function fallbackPeopleChart(container, people, previousByPerson) {
  destroyChart('peopleChart');
  container.className = 'bar-chart';
  const max = Math.max(1, ...people.map(person => person.total));
  container.innerHTML = people.map(person => {
    const previous = previousByPerson.get(person.code)?.total || 0;
    return `<button class="bar-row person-link" data-person="${esc(person.code)}"><span class="bar-name"><b>${esc(person.name)}</b><small>${esc(person.code)}</small></span><span class="bar-track"><span class="bar-fill" style="width:${Math.max(0, person.total / max * 100)}%"></span></span><span class="bar-value">${euro.format(person.total)}${changeBadge(person.total, previous, true)}</span></button>`;
  }).join('') || 'Kayit yok';
}

function renderPeopleChart(people, previousByPerson) {
  return fallbackPeopleChart($('peopleChart'), people, previousByPerson);
}

function renderPeriodChart(container, points, previousMap, monthSelected, personCode = '') {
  if (!hasChartJs()) return renderPeriodColumns(container, points, previousMap, monthSelected, personCode);
  const chartId = personCode ? 'personTrend' : 'trendChart';
  const canvas = prepareChartCanvas(container, chartId);
  chartInstances[chartId] = new window.Chart(canvas, {
    type: 'bar',
    data: {
      labels: points.map(([key]) => monthSelected ? key.slice(8) : key.slice(5)),
      datasets: [
        { label: String($('year').value), data: points.map(([, value]) => value.total), backgroundColor: '#ed382c', borderRadius: 6 },
        { label: String(Number($('year').value) - 1), data: points.map(([key]) => previousMap.get(comparableKey(key))?.total || 0), backgroundColor: '#2558bd', borderRadius: 6 }
      ]
    },
    options: {
      ...chartDefaults(),
      onClick(event, elements) {
        const point = elements[0];
        if (point) openReportPeriod(points[point.index][0], monthSelected, personCode);
      },
      scales: {
        y: { ticks: { callback: value => euro.format(value) } }
      }
    }
  });
}

function fallbackDonut(people, total) {
  const donut = $('donut');
  destroyChart('donut');
  donut.className = 'donut';
  let cursor = 0;
  const stops = people.map((person, index) => {
    const start = cursor;
    cursor += total ? person.total / total * 100 : 0;
    return `${colors[index % colors.length]} ${start}% ${cursor}%`;
  });
  donut.style.background = `conic-gradient(${stops.join(',') || '#ddd 0 100%'})`;
}

function renderDonutChart(people, total) {
  const donut = $('donut');
  if (!hasChartJs()) return fallbackDonut(people, total);
  const canvas = prepareChartCanvas(donut, 'donut');
  chartInstances.donut = new window.Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: people.map(person => `${person.name} - ${person.code}`),
      datasets: [{ data: people.map(person => person.total), backgroundColor: people.map((_, index) => colors[index % colors.length]), borderWidth: 0 }]
    },
    options: {
      ...chartDefaults(),
      cutout: '62%',
      plugins: { ...chartDefaults().plugins, legend: { display: false } }
    }
  });
}

function openPerson(code) {
  const rows = activeRows(reportData.rows).filter(row => row.code === code).sort((a, b) => new Date(b.date) - new Date(a.date));
  const previousRows = activeRows(reportData.previousRows || []).filter(row => row.code === code);
  const total = totalAmount(rows);
  const previousTotal = totalAmount(previousRows);
  const daily = aggregate(rows, row => String(row.date).slice(0, 10));
  const previousPeriod = aggregate(previousRows, row => comparableKey(String(row.date).slice(0, reportData.month ? 10 : 7)));
  const best = [...daily.entries()].sort((a, b) => b[1].total - a[1].total)[0];
  $('personCode').textContent = code;
  $('personTitle').textContent = staffName(code);
  $('personTotal').innerHTML = `${euro.format(total)} ${changeBadge(total, previousTotal)}`;
  $('personCount').textContent = num.format(rows.length);
  $('personAverage').textContent = euro.format(rows.length ? total / rows.length : 0);
  $('personBestDay').textContent = best ? `${new Date(best[0]).toLocaleDateString('de-DE')} · ${euro.format(best[1].total)}` : '—';
  const period = reportData.month ? daily : aggregate(rows, row => String(row.date).slice(0, 7));
  const points = [...period.entries()].sort();
  $('personTrendTitle').textContent = reportData.month ? 'Gunluk satis dagilimi · onceki yil karsilastirmali' : 'Aylik satis dagilimi · onceki yil karsilastirmali';
  renderPeriodChart($('personTrend'), points, previousPeriod, Boolean(reportData.month), code);
  $('personResultCount').textContent = `${num.format(rows.length)} islem · Fatura detayina ulasmak icin satira tiklayin`;
  $('personTransactions').innerHTML = rows.map(row => `<tr class="invoice-row" data-invoice-document="${esc(row.document || '')}" data-invoice-day="${String(row.date).slice(0, 10)}" data-invoice-person="${esc(code)}"><td>${new Date(row.date).toLocaleDateString('de-DE')}</td><td><b>${esc(row.document || '—')}</b></td><td>${euro.format(row.amount)}</td></tr>`).join('');
  $('personModal').classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function renderPersonCancellations(code, allRows) {
  document.querySelector('#personModal .person-cancellations')?.remove();
  const rows = (allRows || []).filter(row => row.code === code && row.cancelled).sort((a, b) => new Date(b.date) - new Date(a.date));
  const monthly = aggregate(rows, row => String(row.date).slice(0, 7));
  const months = [...monthly.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  const total = totalAmount(rows);
  const section = document.createElement('section');
  section.className = 'person-section person-cancellations';
  section.innerHTML = `<div class="section-head"><div><h3>Iptal faturalar</h3><small>Aktif satis toplamlarina dahil edilmez</small></div><div class="cancelled-person-summary"><span><b>${num.format(rows.length)}</b> iptal fatura</span><span><b>${euro.format(total)}</b> iptal tutari</span></div></div><div class="person-cancel-grid"><div><h4>Aylik iptal ozeti</h4><div class="table-wrap"><table><thead><tr><th>Ay</th><th>Iptal adedi</th><th>Iptal tutari</th></tr></thead><tbody>${months.map(([month, value]) => `<tr><td>${new Date(`${month}-01T12:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</td><td>${num.format(value.count)}</td><td>${euro.format(value.total)}</td></tr>`).join('') || '<tr><td colspan="3">Iptal faturasi yok.</td></tr>'}</tbody><tfoot><tr><td>TOPLAM</td><td>${num.format(rows.length)}</td><td>${euro.format(total)}</td></tr></tfoot></table></div></div><div><h4>Iptal fatura dokumu</h4><div class="table-wrap cancelled-documents"><table><thead><tr><th>Tarih</th><th>Belge no.</th><th>Tutar</th></tr></thead><tbody>${rows.map(row => `<tr class="invoice-row" data-invoice-document="${esc(row.document || '')}" data-invoice-day="${String(row.date).slice(0, 10)}" data-invoice-person="${esc(code)}"><td>${new Date(row.date).toLocaleDateString('de-DE')}</td><td><b>${esc(row.document || '—')}</b></td><td>${euro.format(row.amount)}</td></tr>`).join('') || '<tr><td colspan="3">Iptal faturasi yok.</td></tr>'}</tbody></table></div></div></div>`;
  document.querySelector('#personModal .modal-panel').appendChild(section);
}

document.addEventListener('click', event => {
  const person = event.target.closest('[data-person]');
  if (person) {
    openPerson(person.dataset.person);
    renderPersonCancellations(person.dataset.person, filterRows(fullCurrentData?.rows || []));
  }
  const unit = event.target.closest('[data-unit]');
  if (unit && $('unitFilter')) {
    selectedUnit = unit.dataset.unit || '';
    $('unitFilter').value = selectedUnit;
    applyCurrentFilters();
  }
  if (event.target.closest('[data-close-person]')) closePerson();
});
document.addEventListener('keydown', event => { if (event.key === 'Escape') closePerson(); });

function render(data) {
  reportData = data;
  const rows = data.rows || [];
  const previousRows = data.previousRows || [];
  for (const row of [...rows, ...previousRows]) {
    if (row.code && row.name) staffNames[row.code] = row.name;
  }
  const total = totalAmount(rows);
  const daily = aggregate(rows, row => String(row.date).slice(0, 10));
  const people = [...aggregate(rows, row => row.code).entries()]
    .map(([code, value]) => ({ code, name: staffName(code), ...value }))
    .filter(person => !selectedPerson || person.code === selectedPerson)
    .sort((a, b) => b.total - a.total);
  $('source').textContent = `Kaynak: ${data.source} · ${data.fields.person}${selectedUnit ? ` · Bölüm: ${selectedUnit}` : ''}${selectedPerson ? ` · Kullanıcı: ${selectedPerson}` : ''}`;
  $('total').innerHTML = `${euro.format(total)} ${changeBadge(total, totalAmount(previousRows))}`;
  $('count').innerHTML = `${num.format(rows.length)} ${changeBadge(rows.length, previousRows.length, true)}`;
  $('average').textContent = euro.format(rows.length ? total / rows.length : 0);
  const best = [...daily.entries()].sort((a, b) => b[1].total - a[1].total)[0];
  $('bestDay').textContent = best ? `${new Date(best[0]).toLocaleDateString('de-DE')} · ${euro.format(best[1].total)}` : '—';
  renderComparisonPanel(rows, previousRows);

  const previousByPerson = aggregate(previousRows, row => row.code);
  renderPeopleChart(people, previousByPerson);

  const period = data.month ? daily : aggregate(rows, row => String(row.date).slice(0, 7));
  const previousPeriod = aggregate(previousRows, row => comparableKey(String(row.date).slice(0, data.month ? 10 : 7)));
  const points = [...period.entries()].sort();
  $('trendTitle').textContent = data.month ? 'Gunluk satislar · onceki yil karsilastirmali' : 'Aylik satis egilimi · onceki yil karsilastirmali';
  renderPeriodChart($('trendChart'), points, previousPeriod, Boolean(data.month));

  renderDonutChart(people, total);
  $('legend').innerHTML = people.slice(0, 8).map((person, index) => `<div><i style="background:${colors[index % colors.length]}"></i><span>${esc(person.code)} · ${total ? (person.total / total * 100).toFixed(1) : 0}%</span></div>`).join('');
  $('legend').innerHTML = people.slice(0, 8).map((person, index) => `<div><i style="background:${colors[index % colors.length]}"></i><span>${esc(person.name)} - ${total ? (person.total / total * 100).toFixed(1) : 0}%</span></div>`).join('');
  $('content').classList.remove('hidden');
}

function applyCurrentFilters() {
  if (!fullCurrentData || !previousYearData) return;
  populatePersonFilter(fullCurrentData.rows || [], previousYearData.rows || []);
  populateUnitFilter(fullCurrentData.rows || [], previousYearData.rows || []);
  const currentAllFiltered = filterRows(fullCurrentData.rows || []);
  const previousAllFiltered = filterRows(previousYearData.rows || []);
  const currentActive = activeRows(currentAllFiltered);
  const previousActive = activeRows(previousAllFiltered);
  render({ ...fullCurrentData, rows: currentActive, previousRows: previousActive });
  reportData = { ...fullCurrentData, rows: currentAllFiltered, previousRows: previousAllFiltered };
  renderStatusBreakdown(fullCurrentData, currentAllFiltered);
}

async function load() {
  const button = $('load');
  button.disabled = true;
  $('error').classList.add('hidden');
  try {
    const year = Number($('year').value);
    const query = `month=${$('month').value}&day=${$('day').value}`;
    const [currentResponse, previousResponse] = await Promise.all([
      fetch(`/api/sales-report?year=${year}&${query}`),
      fetch(`/api/sales-report?year=${year - 1}&${query}`)
    ]);
    const current = await currentResponse.json();
    const previous = await previousResponse.json();
    if (!currentResponse.ok) throw new Error(current.error);
    if (!previousResponse.ok) throw new Error(previous.error);
    Object.assign(staffNames, current.staff || {}, previous.staff || {});
    fullCurrentData = current;
    previousYearData = previous;
    populatePersonFilter(current.rows || [], previous.rows || []);
    populateUnitFilter(current.rows || [], previous.rows || []);
    applyCurrentFilters();
  } catch (error) {
    $('content').classList.add('hidden');
    $('error').textContent = `Rapor alinamadi: ${error.message}`;
    $('error').classList.remove('hidden');
  } finally {
    button.disabled = false;
  }
}

$('load').onclick = load;
$('personFilter')?.addEventListener('change', event => {
  selectedPerson = event.target.value;
  applyCurrentFilters();
});
$('unitFilter')?.addEventListener('change', event => {
  selectedUnit = event.target.value;
  applyCurrentFilters();
});
load();
