const form = document.getElementById('autoInvoiceSearchForm');
const input = document.getElementById('autoInvoiceQuery');
const results = document.getElementById('autoInvoiceResults');
const errorBox = document.getElementById('autoInvoiceError');
const source = document.getElementById('autoInvoiceSource');
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
const number = new Intl.NumberFormat('de-DE');

document.getElementById('reportYear').textContent = new Date().getFullYear();

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function present(value) {
  return value !== null && value !== undefined && value !== '';
}

function dateValue(value) {
  if (!present(value)) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleDateString('de-DE');
}

function money(value) {
  return present(value) && Number.isFinite(Number(value)) ? euro.format(Number(value)) : '-';
}

function text(value) {
  return present(value) ? esc(value) : '-';
}

function field(label, value) {
  return `<article class="auto-field"><small>${esc(label)}</small><b>${value}</b></article>`;
}

function renderCard(row) {
  const buyer = [row.salutation, row.first_name, row.last_name].filter(Boolean).join(' ');
  const address = [row.street, [row.postal_code, row.city].filter(Boolean).join(' ')].filter(Boolean).join(', ');
  const vehicleTitle = [row.brand, row.model, row.vehicle_type].filter(Boolean).join(' ');
  const payment = [row.payment_text, row.deposit ? `Anzahlung: ${money(row.deposit)}` : '', row.remaining_payment ? `Restzahlung: ${money(row.remaining_payment)}` : ''].filter(Boolean).join('\n');
  return `<article class="auto-card">
    <div class="auto-card-head">
      <div><small>Araç satış faturası</small><h2>${text(row.invoice_number)}</h2></div>
      <div><strong>${money(row.price)}</strong><span>${dateValue(row.sale_date)}</span></div>
    </div>
    <div class="auto-grid">
      ${field('Alıcı', text(buyer))}
      ${field('Adres', text(address))}
      ${field('Müşteri no', text(row.customer_number))}
      ${field('Satış ID', text(row.sale_id))}
      ${field('Araç', text(vehicleTitle))}
      ${field('Araç no', text(row.vehicle_number))}
      ${field('VIN', text(row.vin))}
      ${field('Plaka', text(row.license_plate))}
      ${field('İlk tescil', dateValue(row.first_registration))}
      ${field('Kilometre', present(row.mileage) ? number.format(row.mileage) : '-')}
      ${field('Renk', text(row.color))}
      ${field('KBA', text(row.kba))}
      ${field('Motor', text(row.engine_code))}
      ${field('Şanzıman', text(row.gearbox_code))}
      ${field('Teslim tarihi', dateValue(row.delivery_date))}
      ${field('KDV', present(row.vat_rate) ? `%${esc(row.vat_rate)}` : '-')}
    </div>
    ${payment || row.sale_text ? `<section class="auto-section"><h3>Satış / ödeme metni</h3><div class="auto-text">${esc([payment, row.sale_text].filter(Boolean).join('\n\n'))}</div></section>` : ''}
  </article>`;
}

function setError(message) {
  errorBox.textContent = message || '';
  errorBox.classList.toggle('hidden', !message);
}

async function search(query) {
  setError('');
  results.classList.add('hidden');
  results.innerHTML = '';
  form.querySelector('button').disabled = true;
  try {
    const response = await fetch(`/api/auto-invoices?q=${encodeURIComponent(query)}`, {
      headers: { Accept: 'application/json' }
    });
    const type = response.headers.get('content-type') || '';
    if (!type.includes('application/json')) throw new Error('Oturum süresi dolmuş olabilir. Lütfen sayfayı yenileyip tekrar giriş yapın.');
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Araç faturası aranamadı.');
    source.textContent = data.source || '';
    const rows = data.rows || [];
    results.innerHTML = rows.length ? rows.map(renderCard).join('') : '<div class="auto-empty">Eşleşen araç satış faturası bulunamadı.</div>';
    results.classList.remove('hidden');
  } catch (error) {
    setError(error.message);
  } finally {
    form.querySelector('button').disabled = false;
  }
}

form.addEventListener('submit', event => {
  event.preventDefault();
  const query = input.value.trim();
  if (query) search(query);
});

const initialQuery = new URLSearchParams(location.search).get('q');
if (initialQuery) {
  input.value = initialQuery;
  search(initialQuery);
}
