(() => {
  'use strict';

  const SCALE = 4;
  const STORAGE_KEY = 'baytemuer-label-template-v1';
  const fields = [
    ['website', 'Web sitesi', 'www.baytemuer.de'],
    ['designation', 'Parça adı', 'Lenksäule'],
    ['part_number', 'Parça numarası (Zusatztext)', '24769'],
    ['additional', 'Ek açıklama (Zusatztext)', 'OPel Corsa C (X01)'],
    ['article', 'Artikel numarası', '24769'],
    ['brand', 'Marka', 'OPEL'],
    ['model', 'Model', 'CORSA C'],
    ['type', 'Araç tipi', '1.0 43 kW 58 PS'],
    ['vehicle', 'Araç numarası', '202607040'],
    ['engine', 'Motor kodu', 'Z10XE'],
    ['gearbox', 'Şanzıman kodu', 'F13'],
    ['displacement', 'Silindir hacmi', '998 cm³'],
    ['year', 'Baujahr', '09.2002'],
    ['stock', 'Adet', '1 adet'],
    ['location', 'Depo', 'B4 / Oben'],
    ['price', 'Fiyat', '49,00 €'],
    ['ebay', 'Ebay artikel no', '1800024769'],
    ['qr', 'QR kod', '24769'],
    ['custom', 'Sabit metin', 'Özel metin']
  ].map(([type, label, sample]) => ({ type, label, sample }));
  const tokenFields = [
    ['value', 'Seçili alan'], ['article', 'Artikel no'], ['part_number', 'Parça no'], ['designation', 'Parça adı'],
    ['brand', 'Marka'], ['model', 'Model'], ['type', 'Araç tipi'], ['vehicle', 'Araç no'], ['engine', 'Motor'],
    ['gearbox', 'Şanzıman'], ['displacement', 'Silindir hacmi'], ['year', 'Baujahr'], ['stock', 'Adet'],
    ['location', 'Depo'], ['price', 'Fiyat'], ['ebay', 'Ebay no']
  ];
  const labelI18n = {
    tr: {
      menu:'Etiket şablonunu düzenle', templateLabel:'Etiket şablonu', eyebrow:'ETİKET TASARIMI', title:'Parça etiketi şablonu', intro:'Alanları etikete sürükleyin, ölçüleri ayarlayın ve şablonu saklayın.', width:'Genişlik', height:'Yükseklik', reset:'Varsayılana dön', test:'Test etiketi / PDF', save:'Şablonu sakla', available:'Kullanılabilir alanlar', availableHint:'Eklemek için tıklayın veya sürükleyin.', scale:'Gerçek oran · mm', canvasHint:'Alanları taşıyın; seçmek için üzerine tıklayın.', selected:'Seçili alan', none:'Alan seçilmedi', empty:'Düzenlemek için etiketten bir alan seçin. Birden fazla alan için Ctrl veya Shift tuşunu basılı tutun.', text:'Başlık / sabit metin', textHint:'Birden fazla bilgiyi aynı satırda birleştirebilirsiniz.', addData:'Veri alanı ekle', font:'Yazı boyutu', bold:'Kalın', left:'Sol', center:'Orta', right:'Sağ', align:'Etikete hizala', hcenter:'Yatay orta', top:'Üst', vcenter:'Dikey orta', bottom:'Alt', distribute:'Eşit aralıkla dağıt', horizontal:'Yatay dağıt', vertical:'Dikey dağıt', distributeHint:'En az 3 alan seçin; dıştaki alanlar sabit kalır.', remove:'Alanı kaldır', allPrint:'Tüm etiketleri bas / PDF', fields:['Web sitesi','Parça adı','Parça numarası (Zusatztext)','Ek açıklama (Zusatztext)','Artikel numarası','Marka','Model','Araç tipi','Araç numarası','Motor kodu','Şanzıman kodu','Silindir hacmi','Baujahr','Adet','Depo','Fiyat','Ebay artikel no','QR kod','Sabit metin'], tokens:['Seçili alan','Artikel no','Parça no','Parça adı','Marka','Model','Araç tipi','Araç no','Motor','Şanzıman','Silindir hacmi','Baujahr','Adet','Depo','Fiyat','Ebay no']
    },
    de: {
      menu:'Etikettenvorlage bearbeiten', templateLabel:'Etikettenvorlage', eyebrow:'ETIKETTENDESIGN', title:'Vorlage für Teileetiketten', intro:'Felder auf das Etikett ziehen, Maße einstellen und Vorlage speichern.', width:'Breite', height:'Höhe', reset:'Standard wiederherstellen', test:'Testetikett / PDF', save:'Vorlage speichern', available:'Verfügbare Felder', availableHint:'Zum Hinzufügen klicken oder ziehen.', scale:'Originalmaßstab · mm', canvasHint:'Felder verschieben; zum Auswählen anklicken.', selected:'Ausgewähltes Feld', none:'Kein Feld ausgewählt', empty:'Feld auf dem Etikett auswählen. Für mehrere Felder Strg oder Umschalt gedrückt halten.', text:'Überschrift / fester Text', textHint:'Mehrere Angaben können in einer Zeile kombiniert werden.', addData:'Datenfeld einfügen', font:'Schriftgröße', bold:'Fett', left:'Links', center:'Mitte', right:'Rechts', align:'Am Etikett ausrichten', hcenter:'Horizontal mittig', top:'Oben', vcenter:'Vertikal mittig', bottom:'Unten', distribute:'Gleichmäßig verteilen', horizontal:'Horizontal verteilen', vertical:'Vertikal verteilen', distributeHint:'Mindestens 3 Felder auswählen; äußere Felder bleiben stehen.', remove:'Feld entfernen', allPrint:'Alle Etiketten / PDF', fields:['Webseite','Teilename','Teilenummer (Zusatztext)','Zusatztext','Artikelnummer','Marke','Modell','Fahrzeugtyp','Fahrzeugnummer','Motorcode','Getriebecode','Hubraum','Baujahr','Menge','Lager','Preis','Ebay-Artikelnummer','QR-Code','Fester Text'], tokens:['Ausgewähltes Feld','Artikel-Nr.','Teilenummer','Teilename','Marke','Modell','Fahrzeugtyp','Fahrzeug-Nr.','Motor','Getriebe','Hubraum','Baujahr','Menge','Lager','Preis','Ebay-Nr.']
    },
    en: {
      menu:'Edit label template', templateLabel:'Label template', eyebrow:'LABEL DESIGN', title:'Part label template', intro:'Drag fields onto the label, set the dimensions and save the template.', width:'Width', height:'Height', reset:'Restore default', test:'Test label / PDF', save:'Save template', available:'Available fields', availableHint:'Click or drag to add.', scale:'Actual scale · mm', canvasHint:'Move fields; click to select.', selected:'Selected field', none:'No field selected', empty:'Select a field on the label. Hold Ctrl or Shift to select multiple fields.', text:'Heading / fixed text', textHint:'You can combine several values on the same line.', addData:'Insert data field', font:'Font size', bold:'Bold', left:'Left', center:'Center', right:'Right', align:'Align to label', hcenter:'Horizontal center', top:'Top', vcenter:'Vertical center', bottom:'Bottom', distribute:'Distribute evenly', horizontal:'Distribute horizontally', vertical:'Distribute vertically', distributeHint:'Select at least 3 fields; outer fields stay fixed.', remove:'Remove field', allPrint:'Print all labels / PDF', fields:['Website','Part name','Part number (Zusatztext)','Additional text (Zusatztext)','Article number','Brand','Model','Vehicle type','Vehicle number','Engine code','Gearbox code','Displacement','Year','Quantity','Storage','Price','Ebay article no','QR code','Fixed text'], tokens:['Selected field','Article no','Part no','Part name','Brand','Model','Vehicle type','Vehicle no','Engine','Gearbox','Displacement','Year','Quantity','Storage','Price','Ebay no']
    }
  };

  const language = () => ['tr','de','en'].includes(localStorage.getItem('lang')) ? localStorage.getItem('lang') : 'tr';
  const ui = () => labelI18n[language()];

  const defaultTemplate = () => ({
    width: 80,
    height: 60,
    elements: [
      element('website', 2, 2, 55, 4, 8, true),
      element('designation', 2, 7, 62, 5, 9),
      element('part_number', 2, 13, 75, 9, 22, false, 'left', 'Teilenr.: {{value}}'),
      element('brand', 2, 22, 75, 4, 9, true, 'left', '{{value}} {{model}}'),
      element('type', 2, 27, 75, 4, 9, true),
      element('vehicle', 2, 32, 75, 4, 9, true, 'left', 'Fzgnr.: {{value}}'),
      element('qr', 3, 37, 21, 21, 8),
      element('year', 26, 38, 35, 4, 8, false, 'left', 'BJ: {{value}}'),
      element('ebay', 26, 53, 45, 4, 8)
    ]
  });

  let template = defaultTemplate();
  let selectedId = null;
  let selectedIds = new Set();
  let initialized = false;
  let dragState = null;

  const $ = id => document.getElementById(id);
  const canvas = $('labelCanvas');
  const widthInput = $('labelWidth');
  const heightInput = $('labelHeight');

  function uid() {
    return `le-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function element(type, x, y, w = 35, h = 6, fontSize = 10, bold = false, align = 'left', text = '') {
    return { id: uid(), type, x, y, w, h, fontSize, bold, align, text };
  }

  function field(type) {
    return fields.find(item => item.type === type) || fields[fields.length - 1];
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(number(value, min), min), Math.max(min, max));
  }

  function normalizeElement(item) {
    const base = element(fields.some(entry => entry.type === item?.type) ? item.type : 'custom', 0, 0);
    const merged = { ...base, ...item, id: item?.id || uid() };
    merged.w = clamp(merged.w, 3, template.width);
    merged.h = clamp(merged.h, 3, template.height);
    merged.x = clamp(merged.x, 0, template.width - merged.w);
    merged.y = clamp(merged.y, 0, template.height - merged.h);
    merged.fontSize = clamp(merged.fontSize, 5, 72);
    merged.align = ['left', 'center', 'right'].includes(merged.align) ? merged.align : 'left';
    return merged;
  }

  function applyTemplate(saved) {
    if (!saved || !Array.isArray(saved.elements)) return false;
    template.width = clamp(saved.width, 20, 210);
    template.height = clamp(saved.height, 15, 297);
    template.elements = saved.elements.map(normalizeElement);
    return true;
  }

  function loadTemplate() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      applyTemplate(saved);
    } catch (_) {
      localStorage.removeItem(STORAGE_KEY);
    }
  }

  function renderPalette() {
    const labels = ui();
    $('labelFieldPalette').innerHTML = fields.map((item, index) => `
      <button type="button" class="label-field-chip" draggable="true" data-field-type="${item.type}">
        <span>${escapeHtml(labels.fields[index] || item.label)}</span><b>+</b>
      </button>`).join('');
    $('labelTokenPalette').innerHTML = tokenFields.map(([token, label], index) => `<button type="button" data-label-token="${token}" title="{{${token}}}">${escapeHtml(labels.tokens[index] || label)}<code>{{${token}}}</code></button>`).join('');
  }

  function setLabelText(inputId, text) {
    const label = $(inputId)?.closest('label');
    if (label?.firstChild) label.firstChild.nodeValue = text;
  }

  function translateDesigner() {
    const l = ui();
    const set = (selector, value) => { const node = document.querySelector(selector); if (node) node.textContent = value; };
    set('#labelsMenuBtn', l.menu); set('.settings-label-row > label', l.templateLabel); set('.label-designer-head .eyebrow', l.eyebrow); set('.label-designer-head h2', l.title); set('.label-designer-head p', l.intro);
    setLabelText('labelWidth', `${l.width} `); setLabelText('labelHeight', `${l.height} `);
    set('#resetLabelTemplate', l.reset); set('#testLabelPrint', l.test); set('#saveLabelTemplate', l.save); set('#printAllLabels', l.allPrint);
    set('.label-palette-panel h3', l.available); set('.label-palette-panel > p', l.availableHint); set('.label-ruler-label', l.scale); set('.label-workbench > small', l.canvasHint);
    set('.label-inspector > h3', l.selected); set('#labelInspectorEmpty', l.empty); setLabelText('labelCustomText', l.text); set('.label-token-help', l.textHint); set('.label-token-picker > span', l.addData); setLabelText('labelFontSize', l.font);
    set('#labelBold', l.bold);
    const format = { left:l.left, center:l.center, right:l.right }; document.querySelectorAll('[data-label-align]').forEach(button => { button.textContent = format[button.dataset.labelAlign]; });
    set('.label-position-tools > span', l.align);
    const positions = { left:l.left, hcenter:l.hcenter, right:l.right, top:l.top, vcenter:l.vcenter, bottom:l.bottom }; document.querySelectorAll('[data-label-position]').forEach(button => { button.textContent = positions[button.dataset.labelPosition]; });
    set('.label-distribute-tools > span', l.distribute); set('[data-label-distribute="horizontal"]', l.horizontal); set('[data-label-distribute="vertical"]', l.vertical); set('.label-distribute-tools small', l.distributeHint); set('#removeLabelElement', l.remove);
    renderPalette();
    renderInspector();
  }

  function previewValue(item) {
    const definition = field(item.type);
    const samples = Object.fromEntries(fields.map(entry => [entry.type, entry.sample]));
    if (item.type === 'custom') return replaceNamedTokens(item.text || definition.sample, samples);
    return formatFieldText(item.text, definition.sample, samples);
  }

  function replaceNamedTokens(pattern, values = {}) {
    return String(pattern || '').replace(/\{\{\s*([a-z_]+)\s*\}\}/gi, (match, key) => {
      const normalized = key.toLowerCase();
      return Object.prototype.hasOwnProperty.call(values, normalized) ? String(values[normalized] || '—') : match;
    });
  }

  function formatFieldText(pattern, value, replacements = {}) {
    const rawPattern = String(pattern || '').trim();
    if (!rawPattern) return String(value || '—');
    const hasValueToken = /(?:\{\{\s*value\s*\}\}|\{\s*value\s*\}|\[\s*value\s*\])/i.test(rawPattern);
    let output = replaceNamedTokens(rawPattern
      .replace(/(?:\{\{\s*value\s*\}\}|\{\s*value\s*\}|\[\s*value\s*\])/gi, String(value || '—'))
    , replacements);
    if (!hasValueToken) output = `${output} ${value || '—'}`;
    return output.trim();
  }

  function renderCanvas() {
    widthInput.value = template.width;
    heightInput.value = template.height;
    canvas.style.width = `${template.width * SCALE}px`;
    canvas.style.height = `${template.height * SCALE}px`;
    canvas.setAttribute('aria-label', `${template.width} × ${template.height} mm etiket tasarım alanı`);
    canvas.innerHTML = template.elements.map(item => {
      const style = `left:${item.x * SCALE}px;top:${item.y * SCALE}px;width:${item.w * SCALE}px;height:${item.h * SCALE}px;font-size:${item.fontSize * 1.333}px;font-weight:${item.bold ? 800 : 400};text-align:${item.align}`;
      const content = item.type === 'qr'
        ? `<img draggable="false" src="/api/qr?text=${encodeURIComponent(previewValue(item))}" alt="QR kod önizlemesi">`
        : `<span>${escapeHtml(previewValue(item))}</span>`;
      return `<div class="label-design-element${selectedIds.has(item.id) ? ' selected' : ''}" data-element-id="${item.id}" style="${style}" title="${escapeHtml(field(item.type).label)}">${content}</div>`;
    }).join('');
    renderInspector();
  }

  function selected() {
    return template.elements.find(item => item.id === selectedId);
  }

  function renderInspector() {
    const item = selected();
    const selectedText = language() === 'de' ? `${selectedIds.size} Feld${selectedIds.size === 1 ? '' : 'er'} ausgewählt` : language() === 'en' ? `${selectedIds.size} field${selectedIds.size === 1 ? '' : 's'} selected` : `${selectedIds.size} alan seçildi`;
    $('labelSelectionInfo').textContent = selectedIds.size ? selectedText : ui().none;
    $('labelInspectorEmpty').classList.toggle('hidden', Boolean(item));
    $('labelInspectorControls').classList.toggle('hidden', !item);
    if (!item) return;
    $('labelCustomText').value = item.text || '';
    $('labelCustomText').placeholder = item.type === 'custom' ? 'Görüntülenecek metin' : '{{value}} ile alan değerini kullanın';
    $('labelX').value = item.x;
    $('labelY').value = item.y;
    $('labelElementWidth').value = item.w;
    $('labelElementHeight').value = item.h;
    $('labelFontSize').value = item.fontSize;
    $('labelBold').classList.toggle('active', item.bold);
    document.querySelectorAll('[data-label-align]').forEach(button => button.classList.toggle('active', button.dataset.labelAlign === item.align));
  }

  function addField(type, x = 3, y = 3) {
    const isQr = type === 'qr';
    const item = element(type, x, y, isQr ? 21 : 38, isQr ? 21 : 6, type === 'article' ? 18 : 10, type === 'article');
    item.w = Math.min(item.w, template.width);
    item.h = Math.min(item.h, template.height);
    item.x = clamp(item.x, 0, template.width - item.w);
    item.y = clamp(item.y, 0, template.height - item.h);
    if (type === 'custom') item.text = 'Özel metin';
    template.elements.push(item);
    selectedId = item.id;
    selectedIds = new Set([item.id]);
    renderCanvas();
  }

  function updateSelected(property, value) {
    const item = selected();
    if (!item) return;
    if (['bold', 'align', 'fontSize'].includes(property) && selectedIds.size > 1) {
      template.elements.filter(entry => selectedIds.has(entry.id)).forEach(entry => {
        entry[property] = property === 'fontSize' ? clamp(value, 5, 72) : value;
      });
      renderCanvas();
      return;
    }
    if (property === 'x') item.x = clamp(value, 0, template.width - item.w);
    else if (property === 'y') item.y = clamp(value, 0, template.height - item.h);
    else if (property === 'w') {
      item.w = clamp(value, 3, template.width - item.x);
      item.x = clamp(item.x, 0, template.width - item.w);
    } else if (property === 'h') {
      item.h = clamp(value, 3, template.height - item.y);
      item.y = clamp(item.y, 0, template.height - item.h);
    } else if (property === 'fontSize') item.fontSize = clamp(value, 5, 72);
    else item[property] = value;
    renderCanvas();
  }

  function bindEvents() {
    const palette = $('labelFieldPalette');
    palette.addEventListener('click', event => {
      const button = event.target.closest('[data-field-type]');
      if (button) addField(button.dataset.fieldType, 3 + (template.elements.length % 5) * 2, 3 + (template.elements.length % 6) * 4);
    });
    palette.addEventListener('dragstart', event => {
      const button = event.target.closest('[data-field-type]');
      if (!button) return;
      event.dataTransfer.setData('text/label-field', button.dataset.fieldType);
      event.dataTransfer.effectAllowed = 'copy';
    });
    canvas.addEventListener('dragover', event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; });
    canvas.addEventListener('drop', event => {
      event.preventDefault();
      const type = event.dataTransfer.getData('text/label-field');
      if (!type) return;
      const rect = canvas.getBoundingClientRect();
      addField(type, (event.clientX - rect.left) / SCALE, (event.clientY - rect.top) / SCALE);
    });
    canvas.addEventListener('pointerdown', event => {
      const node = event.target.closest('[data-element-id]');
      if (!node) { selectedId = null; selectedIds.clear(); renderCanvas(); return; }
      event.preventDefault();
      const clickedId = node.dataset.elementId;
      if (event.ctrlKey || event.metaKey || event.shiftKey) {
        if (selectedIds.has(clickedId)) selectedIds.delete(clickedId); else selectedIds.add(clickedId);
        selectedId = selectedIds.has(clickedId) ? clickedId : [...selectedIds].at(-1) || null;
        renderCanvas();
        return;
      }
      if (!selectedIds.has(clickedId)) selectedIds = new Set([clickedId]);
      selectedId = clickedId;
      const item = selected();
      dragState = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, positions: template.elements.filter(entry => selectedIds.has(entry.id)).map(entry => ({ id: entry.id, x: entry.x, y: entry.y })) };
      node.setPointerCapture?.(event.pointerId);
      renderCanvas();
    });
    canvas.addEventListener('pointermove', event => {
      if (!dragState || dragState.pointerId !== event.pointerId) return;
      const moving = template.elements.filter(entry => selectedIds.has(entry.id));
      if (!moving.length) return;
      const rawDx = (event.clientX - dragState.startX) / SCALE;
      const rawDy = (event.clientY - dragState.startY) / SCALE;
      const minX = Math.min(...dragState.positions.map(pos => pos.x));
      const minY = Math.min(...dragState.positions.map(pos => pos.y));
      const maxX = Math.max(...moving.map(entry => dragState.positions.find(pos => pos.id === entry.id).x + entry.w));
      const maxY = Math.max(...moving.map(entry => dragState.positions.find(pos => pos.id === entry.id).y + entry.h));
      const dx = clamp(rawDx, -minX, template.width - maxX);
      const dy = clamp(rawDy, -minY, template.height - maxY);
      moving.forEach(item => {
        const start = dragState.positions.find(pos => pos.id === item.id);
        item.x = start.x + dx; item.y = start.y + dy;
        const itemNode = canvas.querySelector(`[data-element-id="${item.id}"]`);
        if (itemNode) { itemNode.style.left = `${item.x * SCALE}px`; itemNode.style.top = `${item.y * SCALE}px`; }
      });
      const item = selected();
      $('labelX').value = Math.round(item.x * 10) / 10;
      $('labelY').value = Math.round(item.y * 10) / 10;
    });
    const stopDrag = () => { dragState = null; };
    canvas.addEventListener('pointerup', stopDrag);
    canvas.addEventListener('pointercancel', stopDrag);

    [['labelCustomText', 'text'], ['labelX', 'x'], ['labelY', 'y'], ['labelElementWidth', 'w'], ['labelElementHeight', 'h'], ['labelFontSize', 'fontSize']]
      .forEach(([id, property]) => $(id).addEventListener(id === 'labelCustomText' ? 'input' : 'change', event => updateSelected(property, event.target.value)));
    $('labelBold').addEventListener('click', () => { const item = selected(); if (item) updateSelected('bold', !item.bold); });
    $('labelTokenPalette').addEventListener('click', event => {
      const button = event.target.closest('[data-label-token]');
      if (!button || !selected()) return;
      const input = $('labelCustomText');
      const token = `{{${button.dataset.labelToken}}}`;
      const start = input.selectionStart ?? input.value.length;
      const end = input.selectionEnd ?? start;
      const spacer = start > 0 && !/\s$/.test(input.value.slice(0, start)) ? ' ' : '';
      const nextValue = `${input.value.slice(0, start)}${spacer}${token}${input.value.slice(end)}`;
      updateSelected('text', nextValue);
      requestAnimationFrame(() => {
        input.focus();
        const cursor = start + spacer.length + token.length;
        input.setSelectionRange(cursor, cursor);
      });
    });
    document.querySelectorAll('[data-label-align]').forEach(button => button.addEventListener('click', () => updateSelected('align', button.dataset.labelAlign)));
    document.querySelectorAll('[data-label-position]').forEach(button => button.addEventListener('click', () => alignSelected(button.dataset.labelPosition)));
    document.querySelectorAll('[data-label-distribute]').forEach(button => button.addEventListener('click', () => distributeSelected(button.dataset.labelDistribute)));
    $('removeLabelElement').addEventListener('click', removeSelected);
    canvas.addEventListener('keydown', event => {
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) { event.preventDefault(); removeSelected(); }
    });
    [widthInput, heightInput].forEach(input => input.addEventListener('change', resizeTemplate));
    $('saveLabelTemplate').addEventListener('click', saveTemplate);
    $('resetLabelTemplate').addEventListener('click', () => {
      if (!confirm('Etiket tasarımı varsayılan düzene döndürülsün mü?')) return;
      template = defaultTemplate();
      selectedId = null;
      selectedIds.clear();
      renderCanvas();
      toast('Varsayılan etiket düzeni yüklendi. Kaydettiğinizde aktif olur.');
    });
    $('testLabelPrint').addEventListener('click', printTestLabel);
  }

  function removeSelected() {
    if (!selectedIds.size) return;
    template.elements = template.elements.filter(item => !selectedIds.has(item.id));
    selectedId = null;
    selectedIds.clear();
    renderCanvas();
  }

  function alignSelected(position) {
    const items = template.elements.filter(item => selectedIds.has(item.id));
    if (!items.length) return;
    if (items.length > 1) {
      const left = Math.min(...items.map(item => item.x));
      const right = Math.max(...items.map(item => item.x + item.w));
      const top = Math.min(...items.map(item => item.y));
      const bottom = Math.max(...items.map(item => item.y + item.h));
      const centerX = (left + right) / 2;
      const centerY = (top + bottom) / 2;
      items.forEach(item => {
        if (position === 'left') item.x = left;
        if (position === 'hcenter') item.x = centerX - item.w / 2;
        if (position === 'right') item.x = right - item.w;
        if (position === 'top') item.y = top;
        if (position === 'vcenter') item.y = centerY - item.h / 2;
        if (position === 'bottom') item.y = bottom - item.h;
        item.x = Math.round(clamp(item.x, 0, template.width - item.w) * 10) / 10;
        item.y = Math.round(clamp(item.y, 0, template.height - item.h) * 10) / 10;
      });
      renderCanvas();
      return;
    }
    const item = items[0];
    if (position === 'left') item.x = 0;
    if (position === 'hcenter') item.x = (template.width - item.w) / 2;
    if (position === 'right') item.x = template.width - item.w;
    if (position === 'top') item.y = 0;
    if (position === 'vcenter') item.y = (template.height - item.h) / 2;
    if (position === 'bottom') item.y = template.height - item.h;
    item.x = Math.round(clamp(item.x, 0, template.width - item.w) * 10) / 10;
    item.y = Math.round(clamp(item.y, 0, template.height - item.h) * 10) / 10;
    renderCanvas();
  }

  function distributeSelected(direction) {
    const items = template.elements.filter(item => selectedIds.has(item.id));
    if (items.length < 3) {
      toast('Eşit aralıkla dağıtmak için en az 3 alan seçin.');
      return;
    }
    const horizontal = direction === 'horizontal';
    const sorted = [...items].sort((a, b) => (horizontal ? a.x - b.x : a.y - b.y));
    const positionKey = horizontal ? 'x' : 'y';
    const sizeKey = horizontal ? 'w' : 'h';
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    const start = first[positionKey];
    const end = last[positionKey] + last[sizeKey];
    const totalSize = sorted.reduce((sum, item) => sum + item[sizeKey], 0);
    const gap = (end - start - totalSize) / (sorted.length - 1);
    let cursor = start;
    sorted.forEach((item, index) => {
      if (index > 0 && index < sorted.length - 1) item[positionKey] = Math.round(cursor * 10) / 10;
      cursor = item[positionKey] + item[sizeKey] + gap;
    });
    renderCanvas();
  }

  function resizeTemplate() {
    template.width = clamp(widthInput.value, 20, 210);
    template.height = clamp(heightInput.value, 15, 297);
    template.elements = template.elements.map(normalizeElement);
    renderCanvas();
  }

  async function saveTemplate() {
    const button = $('saveLabelTemplate');
    button.disabled = true;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
    try {
      const response = await fetch('/api/label-template', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(template) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Template could not be saved');
      applyTemplate(result.template);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
      renderCanvas();
      toast(`Etiket şablonu ${template.width} × ${template.height} mm olarak sistemde saklandı.`);
    } catch (error) {
      toast(`Şablon sunucuda saklanamadı: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  }

  async function savedTemplate() {
    try {
      const response = await fetch('/api/label-template', { cache: 'no-store' });
      if (response.ok) {
        const result = await response.json();
        if (result.template?.elements?.length) return result.template;
      }
    } catch (_) {}
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (saved?.elements?.length) return saved;
    } catch (_) {}
    return defaultTemplate();
  }

  async function loadSystemTemplate() {
    loadTemplate();
    const localTemplate = localStorage.getItem(STORAGE_KEY);
    try {
      const response = await fetch('/api/label-template', { cache: 'no-store' });
      if (!response.ok) throw new Error('Template could not be loaded');
      const result = await response.json();
      if (result.template?.elements?.length) {
        applyTemplate(result.template);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
        return;
      }
      if (!localTemplate) return;
      const source = localTemplate;
      const migration = await fetch('/api/label-template', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: source });
      if (!migration.ok) throw new Error('Local template could not be migrated');
      const migrated = await migration.json();
      applyTemplate(migrated.template);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(template));
    } catch (error) {
      console.error('Label template sync failed:', error);
    }
  }

  function toast(message) {
    if (typeof showToast === 'function') showToast(message);
    else alert(message);
  }

  function rowValue(item, row) {
    const firstValue = (...values) => values.find(value => value !== null && value !== undefined && String(value).trim() !== '') ?? '';
    const map = {
      website: 'www.baytemuer.de',
      designation: row.Bezeichnung,
      part_number: row.Zusatztext,
      additional: row.Zusatztext,
      article: firstValue(row.Artikelnummer, row.ArtikelNr),
      brand: row.Marke,
      model: row.Modellcode,
      type: row.Typ,
      vehicle: firstValue(row.FahrzeugNummer, row['Fahrzeug-ID']),
      engine: row.Motorcode,
      gearbox: row.Getriebecode,
      displacement: row.Hubraum ? `${row.Hubraum} cm³` : '',
      year: row.Baujahr,
      stock: row.Lagermenge !== null && row.Lagermenge !== undefined ? `${row.Lagermenge} adet` : '',
      location: [row.Lagerort, row.Lagerplatz].filter(Boolean).join(' / '),
      price: formatPrice(row.VK_Brutto ?? row.Verkaufspreis),
      ebay: row.Ebayartikelnummer,
      qr: firstValue(row.Artikelnummer, row.ArtikelNr),
      custom: item.text
    };
    if (item.type === 'custom') return String(replaceNamedTokens(item.text || '—', map));
    let value = map[item.type] ?? '';
    if (item.text) value = formatFieldText(item.text, value, map);
    return String(value || '—');
  }

  function formatPrice(value) {
    const parsed = Number(String(value ?? '').replace(',', '.'));
    return Number.isFinite(parsed) ? `${new Intl.NumberFormat('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(parsed)} €` : '';
  }

  async function fetchAllMatchingParts() {
    const form = document.getElementById('searchForm');
    const params = new URLSearchParams(new FormData(form));
    const stock = form.querySelector('[name="in_stock"]');
    params.set('in_stock', stock?.checked ? '1' : '0');
    params.set('unit', document.getElementById('unitSelect')?.value || '');
    params.set('limit', '500');
    params.set('page', '1');
    const firstResponse = await fetch(`/api/search?${params}`);
    if (!firstResponse.ok) throw new Error(`Arama sonuçları alınamadı (${firstResponse.status})`);
    const first = await firstResponse.json();
    const rows = [...(first.rows || [])];
    const pages = Math.max(1, number(first.pages, Math.ceil(number(first.count) / 500)));
    if (number(first.count) > 1000 && !confirm(`${first.count} etiket hazırlanacak. Devam edilsin mi?`)) return null;
    for (let page = 2; page <= pages; page += 1) {
      params.set('page', String(page));
      const response = await fetch(`/api/search?${params}`);
      if (!response.ok) throw new Error(`Etiketlerin ${page}. sayfası alınamadı`);
      const data = await response.json();
      rows.push(...(data.rows || []));
    }
    return rows;
  }

  async function printAllLabels() {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast('Yazdırma penceresi engellendi. Tarayıcıda açılır pencerelere izin verin.'); return; }
    printWindow.document.write('<!doctype html><title>Etiketler hazırlanıyor</title><p style="font-family:Arial;padding:24px">Etiketler hazırlanıyor…</p>');
    const button = $('printAllLabels');
    button.disabled = true;
    button.textContent = 'Etiketler hazırlanıyor…';
    try {
      const rows = await fetchAllMatchingParts();
      if (rows === null) { printWindow.close(); return; }
      if (!rows.length) {
        printWindow.close();
        toast('Bu arama filtreleriyle yazdırılacak parça bulunamadı.');
        return;
      }
      const html = buildPrintDocument(rows, await savedTemplate());
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      printWindow.close();
      toast(error.message || 'Etiketler hazırlanamadı.');
    } finally {
      button.disabled = false;
      button.textContent = ui().allPrint;
    }
  }

  function printTestLabel() {
    openPrintWindow([{
      Bezeichnung: 'Lenksäule', Zusatztext: '24769', Artikelnummer: '1800024769', Marke: 'OPEL', Modellcode: 'Corsa C (X01)',
      Typ: '1.0 43 kW 58 PS', FahrzeugNummer: '202607040', Motorcode: 'Z10XE', Getriebecode: 'F13', Hubraum: 998,
      Baujahr: '09.2002', Lagermenge: 1, Lagerort: 'B4', Lagerplatz: 'Oben', VK_Brutto: 49, Ebayartikelnummer: '1800024769'
    }], template, 'Test etiketi');
  }

  function openPrintWindow(rows, design, title = 'Parça etiketi') {
    const printWindow = window.open('', '_blank');
    if (!printWindow) { toast('Yazdırma penceresi engellendi. Tarayıcıda açılır pencerelere izin verin.'); return; }
    printWindow.document.open();
    printWindow.document.write(buildPrintDocument(rows, design, title));
    printWindow.document.close();
  }

  function buildPrintDocument(rows, design = template, title = 'Parça etiketleri') {
    const labels = rows.map(row => `<section class="print-label">${design.elements.map(item => {
      const style = `left:${item.x}mm;top:${item.y}mm;width:${item.w}mm;height:${item.h}mm;font-size:${item.fontSize}pt;font-weight:${item.bold ? 800 : 400};text-align:${item.align}`;
      const value = rowValue(item, row);
      return item.type === 'qr'
        ? `<div class="print-element qr" style="${style}"><img src="${location.origin}/api/qr?text=${encodeURIComponent(value)}" alt=""></div>`
        : `<div class="print-element" style="${style}">${escapeHtml(value)}</div>`;
    }).join('')}</section>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)} · ${rows.length}</title><style>
      @page{size:${design.width}mm ${design.height}mm;margin:0}
      *{box-sizing:border-box}html,body{margin:0;padding:0;background:#fff;color:#000;font-family:"Roboto","Helvetica","Arial",sans-serif}
      .print-label{position:relative;width:${design.width}mm;height:${design.height}mm;overflow:hidden;break-after:page;page-break-after:always;background:#fff}
      .print-label:last-child{break-after:auto;page-break-after:auto}.print-element{position:absolute;overflow:hidden;line-height:1.08;white-space:normal;overflow-wrap:anywhere}
      .print-element.qr img{display:block;width:100%;height:100%;object-fit:contain;object-position:left top}
    </style></head><body>${labels}<script>
      Promise.all(Array.from(document.images).map(img => img.complete ? Promise.resolve() : new Promise(resolve => {img.onload=img.onerror=resolve}))).then(() => setTimeout(() => window.print(), 250));
    <\/script></body></html>`;
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]);
  }

  window.initLabelDesigner = async () => {
    if (initialized) { renderCanvas(); return; }
    await loadSystemTemplate();
    renderPalette();
    bindEvents();
    renderCanvas();
    translateDesigner();
    initialized = true;
  };
  window.printPartLabel = async row => openPrintWindow([row], await savedTemplate(), `Etiket · ${row.Zusatztext || row.Artikelnummer || 'Parça'}`);
  window.addEventListener('app-language-change', () => { translateDesigner(); if (initialized) renderCanvas(); });
  translateDesigner();
})();
