(function () {
  const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });
  const number = new Intl.NumberFormat('de-DE');
  const escapeHtml = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  let getRows = () => [];
  let getStaffName = code => code;

  function aggregate(rows, keyFn) {
    const result = new Map();
    for (const row of rows) {
      const key = keyFn(row);
      const value = result.get(key) || { total: 0, count: 0 };
      value.total += Number(row.amount) || 0;
      value.count += 1;
      result.set(key, value);
    }
    return result;
  }

  function ensureModal() {
    let modal = document.getElementById('reportDrilldownModal');
    if (modal) return modal;
    modal = document.createElement('div');
    modal.id = 'reportDrilldownModal';
    modal.className = 'modal report-drilldown hidden';
    modal.innerHTML = '<div class="modal-backdrop" data-close-drilldown></div><section class="modal-panel"><button class="modal-close" data-close-drilldown aria-label="Kapat">&times;</button><div id="drilldownContent"></div></section>';
    document.body.appendChild(modal);
    return modal;
  }

  function scopedRows(person) {
    const rows = getRows() || [];
    return person ? rows.filter(row => row.code === person) : rows;
  }

  function heading(title, rows, person) {
    const activeRows = rows.filter(row => !row.cancelled);
    const total = activeRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0);
    return `<div class="drill-heading"><div><small>${person ? `${escapeHtml(getStaffName(person))} · ${escapeHtml(person)}` : 'TÜM PERSONEL'}</small><h2>${escapeHtml(title)}</h2></div><div class="drill-summary"><span><small>Aktif fatura</small><b>${number.format(activeRows.length)}</b></span><span><small>Aktif satış toplamı</small><b>${euro.format(total)}</b></span><span><small>Aktif ortalama</small><b>${euro.format(activeRows.length ? total / activeRows.length : 0)}</b></span></div></div>`;
  }

  const present = value => value !== null && value !== undefined && value !== '';
  const money = value => present(value) ? euro.format(Number(value) || 0) : '—';
  const dateTime = value => present(value) ? new Date(value).toLocaleDateString('de-DE') : '—';
  const textValue = value => present(value) ? escapeHtml(value) : '—';
  const yesNo = value => Number(value) ? 'Evet' : 'Hayır';

  function detailGrid(items) {
    return `<div class="invoice-detail-grid">${items.filter(([, value]) => present(value)).map(([label, value]) => `<article><small>${escapeHtml(label)}</small><b>${value}</b></article>`).join('')}</div>`;
  }

  function referenceInvoiceHtml(invoiceDocument, invoice, soldItems, day, person, returnMode) {
    const customerName = [invoice.Salutation, invoice.FirstName, invoice.Name1, invoice.Name2].filter(Boolean).join(' ');
    const customerAddress = [invoice.Street, [invoice.Country, invoice.PostalCode, invoice.City].filter(Boolean).join(' ')].filter(Boolean);
    const vehicleLine = [invoice.VehicleMakeType, invoice.LicensePlate, invoice.Vin && `VIN: ${invoice.Vin}`].filter(Boolean).join(' | ');
    const back = returnMode === 'day'
      ? `<button class="drill-back" data-back-day="${escapeHtml(day || String(invoice.InvoiceDate || invoice.OrderDate || '').slice(0,10))}" data-back-person="${escapeHtml(person || '')}">← Günün faturalarına dön</button>`
      : returnMode === 'search'
        ? '<button class="drill-back" data-back-invoice-search>← Fatura aramaya dön</button>'
        : `<button class="drill-back" data-close-drilldown>← ${returnMode === 'person' ? 'Kişi detayına dön' : 'Rapor ekranına dön'}</button>`;
    const itemRows = soldItems.map((item, index) => `<tr><td>${number.format(item.position || index + 1)}</td><td>${escapeHtml(item.article || '')}</td><td><b>${escapeHtml(item.description || '—')}</b>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}</td><td>${number.format(item.quantity || 0)}</td><td>${money(item.unit_price)}</td><td>${money(item.total)}</td></tr>`).join('');
    const paymentText = invoice.PaymentNote || invoice.PaymentTerms || (invoice.PaymentDueDate ? `Ödeme tarihi: ${dateTime(invoice.PaymentDueDate)}` : '');
    return `${back}<article class="reference-invoice"><header class="reference-invoice-head"><div><h1>BAYTEMÜR GmbH</h1><b>Autocenter · Autoteile · Zertifizierter Autorecycling-Meisterwerkstatt</b></div><img src="/baytemur-logo.svg" alt="Baytemür"></header><div class="reference-address-row"><section class="reference-customer"><small>Baytemür GmbH · Am Kämpchen 106-107 · 46238 Bottrop</small><address><b>${textValue(customerName)}</b>${customerAddress.map(line => `<span>${escapeHtml(line)}</span>`).join('')}</address></section><section class="reference-seller"><b>Baytemür GmbH</b><span>Am Kämpchen 106-107</span><span>46238 Bottrop</span><br><span>Tel.: 02041 77330-0</span><span>Fax: 02041 77330-99</span></section></div><div class="reference-meta"><div></div><dl><dt>Lieferdatum:</dt><dd>${dateTime(invoice.DeliveryDate)}</dd><dt>Kundennummer:</dt><dd>${textValue(invoice.CustomerNumber)}</dd><dt>Datum:</dt><dd>${dateTime(invoice.InvoiceDate || invoice.OrderDate)}</dd><dt>Bearbeiter:</dt><dd>${escapeHtml(person ? `${getStaffName(person)} · ${person}` : '—')}</dd></dl></div><h2 class="reference-number">Rechnung - Nr. <strong>${escapeHtml(invoiceDocument)}</strong><span class="invoice-status ${Number(invoice.Cancelled) ? 'cancelled' : ''}">${Number(invoice.Cancelled) ? 'İPTAL' : 'AKTİF'}</span></h2>${vehicleLine ? `<p class="reference-vehicle">${escapeHtml(vehicleLine)}</p>` : ''}<div class="reference-items"><table><thead><tr><th>Pos.</th><th>Art.-Nr.</th><th>Beschreibung</th><th>Menge</th><th>E-Preis</th><th>Gesamt</th></tr></thead><tbody>${itemRows || '<tr><td colspan="6">Bu faturaya bağlı ürün/hizmet kalemi bulunamadı.</td></tr>'}</tbody></table></div><div class="reference-totals"><dl><dt>Nettobetrag</dt><dd>${money(invoice.NetAmount)}</dd><dt>zzgl. ${present(invoice.VatRate) ? escapeHtml(invoice.VatRate) : '—'}% MwSt.</dt><dd>${money(invoice.VatAmount)}</dd><dt>Rechnungsbetrag</dt><dd>${money(invoice.GrossAmount)}</dd></dl></div>${paymentText ? `<p class="reference-payment">${escapeHtml(paymentText)}</p>` : ''}<section class="reference-terms">${textValue(invoice.Description || invoice.Note || 'Vielen Dank für Ihren Auftrag!')}</section><footer class="reference-footer"><div><b>Bank: Sparkasse Bottrop</b><span>IBAN: DE77 4245 122 0000 7000 458</span><span>BIC: WELADED1BOT</span></div><div><span>E-Mail: info@baytemuer.de</span><span>Internet: www.baytemuer.de</span></div><div><span>Ust.-ID Nr.: DE 814 382 483</span><span>Steuer-Nr.: 308 5801 0832</span></div><div><span>Amtsgericht Gelsenkirchen</span><span>HRB 8167</span><span>Geschäftsführer: Ergin Baytemür</span></div></footer></article>`;
  }

  async function showInvoice(invoiceDocument, day, person, returnMode = 'day') {
    const modal = ensureModal();
    modal.dataset.invoiceReturn = returnMode;
    modal.dataset.invoiceDay = day || '';
    modal.dataset.invoicePerson = person || '';
    document.getElementById('drilldownContent').classList.add('electronic-invoice-view');
    document.getElementById('drilldownContent').innerHTML = '<div class="invoice-loading">Fatura ayrıntıları yükleniyor…</div>';
    try {
      const response = await fetch(`/api/sales-report/invoice/${encodeURIComponent(invoiceDocument)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Fatura ayrıntısı alınamadı.');
      const invoice = data.invoice || {};
      const customerName = [invoice.Salutation, invoice.FirstName, invoice.Name1, invoice.Name2].filter(Boolean).join(' ');
      const address = [invoice.Street, [invoice.Country, invoice.PostalCode, invoice.City].filter(Boolean).join(' ')].filter(Boolean).join(', ');
      const vehicle = [invoice.VehicleMake, invoice.VehicleMakeType].filter(Boolean).join(' · ');
      const services = [
        ['Bölge', invoice.AreaAmount, null, null], ['Yardım', invoice.AssistanceAmount, null, null],
        ['Kilometre', invoice.KmAmount, invoice.KmQuantity, 'km'], ['Kurtarma', invoice.RecoveryAmount, invoice.RecoveryHours, 'saat'],
        ['Ek personel', invoice.ExtraStaffAmount, invoice.ExtraStaffHours, 'saat'], ['Diğer', invoice.OtherAmount, invoice.OtherQuantity, invoice.OtherText],
        ['Ek ücret', invoice.SurchargeAmount, invoice.SurchargeQuantity, invoice.SurchargeText], ['Muhafaza', invoice.StorageAmount, invoice.StorageDays, 'gün'],
        ['Yedek parça', invoice.PartAmount, invoice.PartQuantity, invoice.PartText], ['Şehir içi', invoice.CityAmount, invoice.CityQuantity, 'adet'],
        ['Çekici', invoice.TowingAmount, invoice.TowingKm, 'km'], ['Telefon', invoice.TelephoneAmount, null, null], ['Yakıt', invoice.FuelAmount, null, null]
      ].filter(([, amount, quantity, note]) => Number(amount) || Number(quantity) || present(note));
      const soldItems = data.items || [];
      const itemsHtml = soldItems.length ? `<section class="person-section invoice-items"><h3>Satılan ürün ve hizmetler <span>${number.format(soldItems.length)} kalem</span></h3><div class="table-wrap"><table><thead><tr><th>Pos.</th><th>Tür</th><th>Artikel no.</th><th>Açıklama</th><th>Adet</th><th>Birim fiyat</th><th>İndirim</th><th>Toplam</th></tr></thead><tbody>${soldItems.map(item => `<tr><td>${number.format(item.position || 0)}</td><td><span class="item-type">${escapeHtml(item.type || 'Kalem')}</span></td><td>${escapeHtml(item.article || '—')}${item.ebay ? `<small>eBay: ${escapeHtml(item.ebay)}</small>` : ''}</td><td><b>${escapeHtml(item.description || '—')}</b>${item.note ? `<small>${escapeHtml(item.note)}</small>` : ''}${item.vehicle ? `<small>Araç: ${escapeHtml(item.vehicle)}</small>` : ''}</td><td>${number.format(item.quantity || 0)}</td><td>${money(item.unit_price)}</td><td>${present(item.discount) ? money(item.discount) : '—'}</td><td><strong>${money(item.total)}</strong></td></tr>`).join('')}</tbody><tfoot><tr><td colspan="7">Kalemler toplamı</td><td>${money(soldItems.reduce((sum, item) => sum + (Number(item.total) || 0), 0))}</td></tr></tfoot></table></div></section>` : '<section class="person-section invoice-items-empty"><h3>Satılan ürün ve hizmetler</h3><p>Bu faturaya bağlı ürün/hizmet kalemi bulunamadı.</p></section>';
      document.getElementById('drilldownContent').innerHTML = referenceInvoiceHtml(invoiceDocument, invoice, soldItems, day, person, returnMode);
      return;
      document.getElementById('drilldownContent').innerHTML = `<button class="drill-back" data-back-day="${escapeHtml(day)}" data-back-person="${escapeHtml(person || '')}">← Günün faturalarına dön</button><div class="invoice-title"><div><small>FATURA / BELGE</small><h2>${escapeHtml(invoiceDocument)}</h2><p>${textValue(invoice.OrderType)} · ${dateTime(invoice.InvoiceDate || invoice.OrderDate)}</p></div><span class="invoice-status ${Number(invoice.Cancelled) ? 'cancelled' : ''}">${Number(invoice.Cancelled) ? 'İPTAL' : 'AKTİF'}</span></div>${detailGrid([['Brüt toplam', money(invoice.GrossAmount)], ['Net toplam', money(invoice.NetAmount)], ['KDV', `${money(invoice.VatAmount)}${present(invoice.VatRate) ? ` · %${escapeHtml(invoice.VatRate)}` : ''}`], ['Açık bakiye', money(invoice.OpenAmount)], ['İndirim', present(invoice.DiscountRate) ? `%${escapeHtml(invoice.DiscountRate)} · ${money(invoice.DiscountAmount)}` : money(invoice.DiscountAmount)], ['Avans', money(invoice.DepositAmount)]])}<div class="invoice-sections"><section class="person-section"><h3>Müşteri ve iletişim</h3>${detailGrid([['Müşteri no', textValue(invoice.CustomerNumber)], ['Müşteri türü', textValue(invoice.CustomerType)], ['Ad / firma', textValue(customerName)], ['Adres', textValue(address)], ['Telefon', textValue(invoice.Phone)], ['Faks', textValue(invoice.Fax)]])}</section><section class="person-section"><h3>Araç bilgileri</h3>${detailGrid([['Marka / tip', textValue(vehicle)], ['Plaka', textValue(invoice.LicensePlate)], ['Şasi no', textValue(invoice.Vin)], ['KBA', textValue(invoice.Kba)], ['İlk tescil', dateTime(invoice.FirstRegistration)], ['Kilometre', present(invoice.Mileage) ? number.format(invoice.Mileage) : '—'], ['Motor', [invoice.Displacement && `${number.format(invoice.Displacement)} cc`, invoice.Kw && `${invoice.Kw} kW`, invoice.Ps && `${invoice.Ps} PS`].filter(Boolean).join(' · ') || '—'], ['Renk', textValue(invoice.Color)]])}</section><section class="person-section"><h3>Ödeme ve durum</h3>${detailGrid([['Sipariş tarihi', dateTime(invoice.OrderDate)], ['Fatura tarihi', dateTime(invoice.InvoiceDate)], ['Teslim tarihi', dateTime(invoice.DeliveryDate)], ['Ödeme tarihi', dateTime(invoice.PaymentDate)], ['Vade', dateTime(invoice.PaymentDueDate)], ['Ödeme koşulu', textValue(invoice.PaymentTerms)], ['Nakit satış', yesNo(invoice.CashSale || invoice.CashPayment)], ['Çek', yesNo(invoice.ChequePayment)], ['Teslim edildi', yesNo(invoice.Delivered)], ['Ödeme notu', textValue(invoice.PaymentNote)]])}</section>${services.length ? `<section class="person-section invoice-services"><h3>Hizmetler ve fatura bileşenleri</h3><div class="service-list">${services.map(([label, amount, quantity, note]) => `<article><div><b>${escapeHtml(label)}</b><small>${[quantity && number.format(quantity), note].filter(Boolean).map(escapeHtml).join(' · ') || 'Hizmet'}</small></div><strong>${money(amount)}</strong></article>`).join('')}</div></section>` : ''}<section class="person-section invoice-notes"><h3>Açıklamalar</h3>${detailGrid([['Fatura açıklaması', textValue(invoice.Description)], ['Not', textValue(invoice.Note)], ['Dahili not', textValue(invoice.InternalNote)], ['Taşıma türü', textValue(invoice.TransportType)], ['Başlangıç / hedef', [invoice.OperationLocation, invoice.Destination].filter(Boolean).map(escapeHtml).join(' → ') || '—']])}</section></div>`;
      const invoiceSections = document.querySelector('#drilldownContent .invoice-sections');
      if (invoiceSections) {
        invoiceSections.insertAdjacentHTML('afterbegin', itemsHtml);
        const vehicleHeading = [...invoiceSections.querySelectorAll('.person-section > h3')].find(heading => heading.textContent.trim() === 'Araç bilgileri');
        if (vehicleHeading) invoiceSections.appendChild(vehicleHeading.closest('.person-section'));
      }
    } catch (error) {
      if (returnMode === 'search') return showInvoiceSearch(error.message);
      document.getElementById('drilldownContent').innerHTML = `<button class="drill-back" data-back-day="${escapeHtml(day)}" data-back-person="${escapeHtml(person || '')}">← Geri dön</button><div class="error">${escapeHtml(error.message)}</div>`;
    }
  }

  function showDay(day, person) {
    document.getElementById('drilldownContent')?.classList.remove('electronic-invoice-view');
    const rows = scopedRows(person).filter(row => String(row.date).slice(0, 10) === day).sort((a, b) => String(a.document || '').localeCompare(String(b.document || '')));
    const title = new Date(`${day}T12:00:00`).toLocaleDateString('tr-TR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' });
    const modal = ensureModal();
    const activeRows = rows.filter(row => !row.cancelled);
    const cancelledRows = rows.filter(row => row.cancelled);
    const invoiceSection = (sectionRows, cancelled) => `<section class="person-section invoice-status-section ${cancelled ? 'cancelled-list' : 'active-list'}"><div class="section-head"><h3>${cancelled ? 'İptal faturalar' : 'Aktif faturalar'} <span class="status-count">${number.format(sectionRows.length)}</span></h3><span>${cancelled ? 'İptal edilmiş belgeler' : 'Detay için faturaya tıklayın'}</span></div><div class="table-wrap drill-table"><table><thead><tr><th>Durum</th><th>Fatura tarihi</th><th>Fatura / belge no.</th><th>Personel</th><th>Tutar</th></tr></thead><tbody>${sectionRows.map(row => `<tr class="invoice-row" data-invoice-document="${escapeHtml(row.document || '')}" data-invoice-day="${day}" data-invoice-person="${escapeHtml(person || '')}"><td><span class="invoice-list-status ${cancelled ? 'cancelled' : 'active'}">${cancelled ? 'İPTAL' : 'AKTİF'}</span></td><td>${new Date(row.date).toLocaleDateString('de-DE')}</td><td><b>${escapeHtml(row.document || '—')}</b></td><td>${escapeHtml(getStaffName(row.code))} <small>${escapeHtml(row.code)}</small></td><td>${euro.format(row.amount)}</td></tr>`).join('') || `<tr><td colspan="5">${cancelled ? 'İptal edilmiş fatura bulunmuyor.' : 'Aktif fatura bulunmuyor.'}</td></tr>`}</tbody><tfoot>${sectionRows.length ? `<tr><td colspan="4">${cancelled ? 'İptal toplamı' : 'Aktif toplam'}</td><td>${euro.format(sectionRows.reduce((sum, row) => sum + (Number(row.amount) || 0), 0))}</td></tr>` : ''}</tfoot></table></div></section>`;
    document.getElementById('drilldownContent').innerHTML = `<button class="drill-back" data-back-month="${day.slice(0,7)}" data-back-person="${escapeHtml(person || '')}">← Ayın günlerine dön</button>${heading(title, rows, person)}<div class="invoice-list-summary"><span class="active"><b>${number.format(activeRows.length)}</b> aktif</span><span class="cancelled"><b>${number.format(cancelledRows.length)}</b> iptal</span></div>${invoiceSection(activeRows, false)}${invoiceSection(cancelledRows, true)}`;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  function showMonth(month, person) {
    document.getElementById('drilldownContent')?.classList.remove('electronic-invoice-view');
    const rows = scopedRows(person).filter(row => String(row.date).slice(0, 7) === month);
    const activeRows = rows.filter(row => !row.cancelled);
    const cancelledRows = rows.filter(row => row.cancelled);
    const days = [...aggregate(activeRows, row => String(row.date).slice(0, 10)).entries()].sort();
    const max = Math.max(1, ...days.map(([, value]) => value.total));
    const monthTitle = new Date(`${month}-01T12:00:00`).toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
    const modal = ensureModal();
    document.getElementById('drilldownContent').innerHTML = `${heading(monthTitle, rows, person)}<div class="invoice-list-summary"><span class="active"><b>${number.format(activeRows.length)}</b> aktif</span><span class="cancelled"><b>${number.format(cancelledRows.length)}</b> iptal</span></div><section class="person-section"><div class="section-head"><h3>Günlük satış grafiği</h3><span>Aktif faturalar toplamı · Faturalar için güne tıklayın</span></div><div class="columns drill-columns">${days.map(([day, value]) => `<button class="column period-column" style="height:${Math.max(3, value.total / max * 100)}%" data-drill-day="${day}" data-drill-person="${escapeHtml(person || '')}" data-value="${escapeHtml(euro.format(value.total))} · ${number.format(value.count)} aktif fatura"><span>${day.slice(8)}</span></button>`).join('')}</div></section><section class="person-section"><div class="section-head"><h3>Günlük toplamlar</h3><span>${number.format(days.length)} aktif satış günü</span></div><div class="table-wrap"><table><thead><tr><th>Tarih</th><th>Aktif fatura</th><th>Toplam</th><th>Ortalama</th></tr></thead><tbody>${days.slice().reverse().map(([day, value]) => `<tr class="drill-day-row" data-drill-day="${day}" data-drill-person="${escapeHtml(person || '')}"><td>${new Date(`${day}T12:00:00`).toLocaleDateString('de-DE')}</td><td>${number.format(value.count)}</td><td>${euro.format(value.total)}</td><td>${euro.format(value.total / value.count)}</td></tr>`).join('') || '<tr><td colspan="4">Aktif fatura yok.</td></tr>'}</tbody></table></div></section>`;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  }

  let lastInvoiceSearch = '';
  function showInvoiceSearch(message = '') {
    const modal = ensureModal();
    modal.dataset.invoiceReturn = 'search';
    const content = document.getElementById('drilldownContent');
    content.classList.remove('electronic-invoice-view');
    content.innerHTML = `<section class="invoice-search-view"><div class="invoice-search-heading"><small>RAPORLAR · FATURA ARAMA</small><h2>Fatura veya belge numarasıyla ara</h2><p>Yıl, ay ve gün filtresinden bağımsız olarak doğrudan fatura detayına ulaşın.</p></div><form id="invoiceSearchForm"><label>Fatura / belge numarası<input id="invoiceSearchInput" value="${escapeHtml(lastInvoiceSearch)}" autocomplete="off" placeholder="Örn. 5119573" required></label><button type="submit">Faturayı getir</button></form>${message ? `<div class="error">${escapeHtml(message)}</div>` : ''}<div class="invoice-search-help"><b>Arama sonucu</b><span>Bulunan fatura, referans PDF düzeninde elektronik fatura olarak açılır.</span></div></section>`;
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
    setTimeout(() => document.getElementById('invoiceSearchInput')?.focus(), 0);
  }

  document.addEventListener('click', event => {
    if (event.target.closest('[data-close-drilldown]')) {
      const modal = ensureModal();
      if (document.getElementById('drilldownContent')?.classList.contains('electronic-invoice-view')) {
        const mode = modal.dataset.invoiceReturn;
        if (mode === 'day') return showDay(modal.dataset.invoiceDay, modal.dataset.invoicePerson || '');
        if (mode === 'search') return showInvoiceSearch();
      }
      modal.classList.add('hidden');
      if (!document.querySelector('.modal:not(.hidden)')) document.body.classList.remove('modal-open');
      return;
    }
    if (event.target.closest('#invoiceSearchOpen')) return showInvoiceSearch();
    if (event.target.closest('[data-back-invoice-search]')) return showInvoiceSearch();
    const day = event.target.closest('[data-drill-day]');
    if (day) return showDay(day.dataset.drillDay, day.dataset.drillPerson || '');
    const back = event.target.closest('[data-back-day]');
    if (back) return showDay(back.dataset.backDay, back.dataset.backPerson || '');
    const monthBack = event.target.closest('[data-back-month]');
    if (monthBack) return showMonth(monthBack.dataset.backMonth, monthBack.dataset.backPerson || '');
    const invoice = event.target.closest('[data-invoice-document]');
    if (invoice && invoice.dataset.invoiceDocument) {
      const mode = invoice.closest('#reportDrilldownModal') ? 'day' : invoice.closest('#personModal') ? 'person' : 'report';
      return showInvoice(invoice.dataset.invoiceDocument, invoice.dataset.invoiceDay, invoice.dataset.invoicePerson || '', mode);
    }
    const period = event.target.closest('[data-report-period]');
    if (!period) return;
    const person = period.dataset.periodPerson || '';
    if (period.dataset.periodLevel === 'month') showMonth(period.dataset.reportPeriod, person);
    else showDay(period.dataset.reportPeriod, person);
  });

  document.addEventListener('submit', event => {
    if (event.target.id !== 'invoiceSearchForm') return;
    event.preventDefault();
    lastInvoiceSearch = document.getElementById('invoiceSearchInput')?.value.trim() || '';
    if (lastInvoiceSearch) showInvoice(lastInvoiceSearch, '', '', 'search');
  });

  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      const modal = document.getElementById('reportDrilldownModal');
      if (modal && !modal.classList.contains('hidden')) modal.querySelector('[data-close-drilldown]').click();
    }
  });

  const yearSelect = document.getElementById('year');
  const monthSelect = document.getElementById('month');
  const daySelect = document.getElementById('day');
  function syncDayOptions() {
    if (!yearSelect || !monthSelect || !daySelect) return;
    const previous = Number(daySelect.value) || 0;
    const month = Number(monthSelect.value) || 0;
    daySelect.disabled = !month;
    const dayCount = month ? new Date(Number(yearSelect.value), month, 0).getDate() : 0;
    daySelect.innerHTML = '<option value="0">Tüm günler</option>' + Array.from({ length: dayCount }, (_, index) => `<option value="${index + 1}">${index + 1}</option>`).join('');
    daySelect.value = previous <= dayCount ? String(previous) : '0';
  }
  yearSelect?.addEventListener('change', syncDayOptions);
  monthSelect?.addEventListener('change', syncDayOptions);
  syncDayOptions();

  window.ReportDrilldown = {
    configure(options) {
      getRows = options.getRows;
      getStaffName = options.getStaffName || getStaffName;
    },
    renderStatusColumns(rows, monthSelected, person) {
      const level = monthSelected ? 'day' : 'month';
      const keyOf = row => String(row.date).slice(0, monthSelected ? 10 : 7);
      const active = aggregate(rows.filter(row => !row.cancelled), keyOf);
      const cancelled = aggregate(rows.filter(row => row.cancelled), keyOf);
      const keys = [...new Set([...active.keys(), ...cancelled.keys()])].sort();
      const activeMax = Math.max(1, ...keys.map(key => Math.abs(active.get(key)?.total || 0)));
      const activeGrandTotal = [...active.values()].reduce((sum, value) => sum + Math.abs(value.total), 0);
      return keys.map(key => {
        const activeValue = active.get(key) || { total: 0, count: 0 };
        const cancelledValue = cancelled.get(key) || { total: 0, count: 0 };
        const attrs = `data-report-period="${key}" data-period-level="${level}"${person ? ` data-period-person="${escapeHtml(person)}"` : ''}`;
        const activeShare = activeGrandTotal ? Math.abs(activeValue.total) / activeGrandTotal * 100 : 0;
        const cancelledShare = activeGrandTotal ? Math.abs(cancelledValue.total) / activeGrandTotal * 100 : 0;
        return `<div class="status-column-group"><div class="status-bars"><button class="status-column active" style="height:${Math.abs(activeValue.total) / activeMax * 100}%" ${attrs} data-value="Aktif · ${number.format(activeValue.count)} fatura · ${escapeHtml(euro.format(activeValue.total))} · Aktif toplamın %${activeShare.toFixed(1)}'i"></button><button class="status-column cancelled" style="height:${Math.abs(cancelledValue.total) / activeMax * 100}%" ${attrs} data-value="İptal · ${number.format(cancelledValue.count)} fatura · ${escapeHtml(euro.format(cancelledValue.total))} · Aktif toplamın %${cancelledShare.toFixed(1)}'i"></button></div><span>${monthSelected ? key.slice(8) : key.slice(5)}</span></div>`;
      }).join('');
    }
  };
})();
