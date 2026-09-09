const form = document.querySelector('#searchForm');
const body = document.querySelector('#resultsBody');
const empty = document.querySelector('#emptyState');
const tableWrap = document.querySelector('#tableWrap');
const resultsCard = document.querySelector('#resultsCard');
const essInlineResults = document.querySelector('#essInlineResults');
const recycleInlineResults = document.querySelector('#recycleInlineResults');
const essInlineQuery = document.querySelector('#essInlineQuery');
const recycleInlineQuery = document.querySelector('#recycleInlineQuery');
const count = document.querySelector('#resultCount');
const meta = document.querySelector('#resultMeta');
const toggleAllPricesButton = document.querySelector('#toggleAllPrices');
const dialog = document.querySelector('#detailDialog');
const gallery = document.querySelector('#galleryDialog');
const settingsDialog = document.querySelector('#settingsDialog');
const settingsBtn = document.querySelector('#settingsBtn');
const closeSettings = document.querySelector('#closeSettings');

let galleryRows = [], galleryIndex = 0, galleryPartId = 0, galleryTransitionToken = 0, galleryTouchX = null;
let galleryZoom = 1, galleryPanX = 0, galleryPanY = 0, galleryPanStart = null, galleryPointerMoved = false;
let currentRows = [];
let resultPage = 1, resultSort = 'newest', resultDirection = 'desc';
let restoringHistory = false;
let recycleLocalLookupToken = 0;
let recycleLocalLookupActive = false;
let recycleDirectLookupToken = 0;
let recycleDirectLookupActive = false;
const searchStateKey = 'baytemuer-search-state';
const wmkatAlternativesCache = new Map();
let wmkatAbortController = null;
let wmkatElapsedTimer = null;
let wmkatSearchStartedAt = 0;
let wmkatCancelled = false;
let activeAppView = ['parts', 'vehicles', 'labels'].includes(new URLSearchParams(location.search).get('view'))
  ? new URLSearchParams(location.search).get('view')
  : (localStorage.getItem('baytemuer-active-view') || 'parts');
const unitSelect = document.querySelector('#unitSelect');
const currentUnit = () => unitSelect.value || '';
const isEuUnit = () => /^eu\s/i.test(String(currentUnit()).trim());
const currentResultQuery = () => {
  const partNumber = String(form.elements.part_number?.value || '').trim();
  if (partNumber) return partNumber;
  return ['designation', 'brand', 'model', 'article']
    .map(name => String(form.elements[name]?.value || '').trim())
    .filter(Boolean)
    .join(' · ');
};
const advancedToggle = document.querySelector('#advancedFiltersToggle');
const advancedFilters = document.querySelector('#advancedFilters');
const mobileSearchPanelToggle = document.querySelector('#mobileSearchPanelToggle');
const desktopSearchPanelToggle = document.querySelector('#desktopSearchPanelToggle');
const searchPanelReopen = document.querySelector('#searchPanelReopen');

function setMobileSearchPanel(open) {
  const interfaceLanguage = localStorage.getItem('lang') || 'tr';
  document.querySelector('#searchPanelCard').classList.toggle('mobile-panel-open', open);
  document.querySelector('#searchPanelCard').classList.toggle('search-panel-collapsed', !open);
  document.querySelector('.search-layout').classList.toggle('search-sidebar-collapsed', !open);
  mobileSearchPanelToggle.setAttribute('aria-expanded', String(open));
  desktopSearchPanelToggle.setAttribute('aria-expanded', String(open));
  searchPanelReopen.classList.toggle('visible', !open);
  localStorage.setItem('baytemuer-search-panel-open', open ? '1' : '0');
  const labels = {
    tr: open ? 'Arama panelini kapat' : 'Arama panelini aç',
    de: open ? 'Suchbereich schließen' : 'Suchbereich öffnen',
    en: open ? 'Close search panel' : 'Open search panel'
  };
  mobileSearchPanelToggle.textContent = labels[interfaceLanguage];
  const desktopLabels = {
    tr: open ? 'Filtreleri kapat' : 'Filtreleri aç',
    de: open ? 'Filter schließen' : 'Filter öffnen',
    en: open ? 'Hide filters' : 'Show filters'
  };
  const toggleText = desktopSearchPanelToggle.querySelector('.search-toggle-text');
  const toggleArrow = desktopSearchPanelToggle.querySelector('.search-toggle-icon');
  if (toggleText) toggleText.textContent = desktopLabels[interfaceLanguage];
  if (toggleArrow) toggleArrow.classList.toggle('opening', !open);
  const reopenLabels = { tr: 'Filtreleri göster', de: 'Filter anzeigen', en: 'Show filters' };
  searchPanelReopen.querySelector('b').textContent = reopenLabels[interfaceLanguage];
  desktopSearchPanelToggle.title = desktopLabels[interfaceLanguage];
}
mobileSearchPanelToggle.addEventListener('click', () => setMobileSearchPanel(mobileSearchPanelToggle.getAttribute('aria-expanded') !== 'true'));
desktopSearchPanelToggle.addEventListener('click', () => setMobileSearchPanel(desktopSearchPanelToggle.getAttribute('aria-expanded') !== 'true'));
searchPanelReopen.addEventListener('click', () => setMobileSearchPanel(true));
setMobileSearchPanel(localStorage.getItem('baytemuer-search-panel-open') !== '0');

function setAdvancedOpen(open) {
  advancedFilters.hidden = !open;
  advancedToggle.setAttribute('aria-expanded', String(open));
}
advancedToggle.addEventListener('click', () => setAdvancedOpen(advancedFilters.hidden));

function getSearchState() {
  const values = Object.fromEntries(new FormData(form).entries());
  values.in_stock = form.elements.in_stock.checked ? '1' : '0';
  return { values, unit: currentUnit(), page: resultPage, sort: resultSort, dir: resultDirection, searched: !resultsCard.classList.contains('hidden'), view: activeAppView };
}

function saveSearchState(push = false) {
  const state = getSearchState();
  sessionStorage.setItem(searchStateKey, JSON.stringify(state));
  const query = new URLSearchParams(state.values);
  query.set('unit', state.unit); query.set('page', state.page); query.set('sort', state.sort); query.set('dir', state.dir); query.set('searched', state.searched ? '1' : '0');
  query.set('view', activeAppView);
  history[push ? 'pushState' : 'replaceState'](state, '', `${location.pathname}?${query}`);
}

function applySearchState(state) {
  if (!state) return false;
  Object.entries(state.values || {}).forEach(([name, value]) => {
    const field = form.elements[name];
    if (!field) return;
    if (field.type === 'checkbox') field.checked = value === '1' || value === true;
    else field.value = value;
  });
  unitSelect.value = state.unit || '';
  resultPage = Number(state.page) || 1; resultSort = state.sort || 'newest'; resultDirection = state.dir || 'desc';
  setAdvancedOpen(['type','additional','engine','gearbox','displacement','location','ebay'].some(name => form.elements[name]?.value));
  return Boolean(state.searched);
}

// Multi-language Translation dictionary
const translations = {
  tr: {
    subtitle: "Parça Arama Sistemi",
    working_unit: "Çalışılan birim",
    loading: "Yükleniyor…",
    checking_server: "Sunucu kontrol ediliyor",
    inventory: "ENVANTER",
    reset: "Temizle",
    other_filters: "Diğer arama seçenekleri",
    menu_parts: "Parçalar", menu_vehicles: "Araçlar", menu_kba: "KBA Arama", vehicle_search: "ARAÇ ARAMA", vehicle_query: "Araç kayıtlarını sorgula",
    detail_label: "DETAY", vehicle_number: "Araç numarası", vehicle_brand: "Marka", vehicle_model: "Model", vehicle_type: "Tip",
    vehicle_engine: "Motor kodu", vehicle_engine_short: "Motor", vehicle_gearbox: "Şanzıman kodu", vehicle_engine_gearbox: "Motor / Şanzıman", vehicle_kba: "KBA numarası", vehicle_status: "Durum", get_vehicles: "Araçları getir",
    vehicle_found: "Bulunan kayıtlar", vehicle_row_hint: "Bir satıra tıklayarak detayları görüntüleyin", vehicle_ready: "Araç sorgusuna hazır",
    vehicle_ready_hint: "Filtreleri doldurun veya bütün araçları listeleyin.", vehicle_brand_model: "Marka / Model", vehicle_year_reg: "Yıl / Tescil",
    vehicle_purchase_date: "Satın alma tarihi", vehicle_document: "Araç ruhsatı", vehicle_vin: "Şasi numarası", vehicle_plate: "Plaka", vehicle_weight: "Ağırlık",
    vehicle_holders: "Sahip sayısı",
    copy_value: "Değeri kopyala", copied: "Kopyalandı",
    vehicle_data: "Araç bilgileri", vehicle_overview: "Araç özeti", priority_data: "Öncelikli bilgiler",
    seller_information: "Satıcı bilgileri", seller_type: "Müşteri türü", seller_name: "Ad / Firma", seller_address: "Adres",
    seller_phone: "Telefon", seller_fax: "Faks", seller_birth_date: "Doğum tarihi", seller_nationality: "Uyruk", seller_document: "Kimlik numarası",
    show_more: "Daha fazlası", show_less: "Daha az göster",
    status_all: "Tüm durumlar", status_new: "Yeni kabul", status_saved: "Kaydedildi", status_sold: "Satıldı", status_dismantle: "Parçalanacak", status_scrapped: "Hurdaya ayrıldı",
    filter_part_number: "Parça numarası",
    filter_designation: "Parça adı",
    filter_article: "Artikel numarası",
    filter_brand: "Araç markası",
    filter_model: "Model",
    filter_type: "Araç tipi",
    filter_additional: "Ek açıklama",
    filter_engine: "Motor kodu",
    filter_gearbox: "Şanzıman kodu",
    filter_displacement: "Motor hacmi",
    filter_location: "Depo konumu",
    filter_ebay: "Ebay artikel no",
    filter_limit: "Sayfa başına kayıt",
    show_only_instock: "Yalnızca stokta bulunanları göster",
    start_search: "Aramayı Başlat",
    results: "SONUÇLAR",
    found_parts: "Bulunan parçalar",
    enter_search_criteria: "Arama kriterlerinizi girin",
    ready_to_search: "Aramaya hazır",
    fill_filters_press_search: "Filtreleri doldurun ve “Aramayı Başlat” düğmesine basın.",
    col_image: "Görsel",
    col_part: "Parça",
    col_vehicle: "Araç",
    col_technical: "Teknik bilgi",
    col_stock: "Stok",
    col_price: "Fiyat",
    show_price: "Fiyatı göster",
    hide_price: "Fiyatı gizle",
    show_all_prices: "Tüm fiyatları göster",
    hide_all_prices: "Tüm fiyatları gizle",
    ebay_show_results: "eBay sonuçlarını göster",
    ebay_hide_results: "eBay sonuçlarını gizle",
    ebay_open_separate: "Ayrı sayfada aç ↗",
    ebay_exact_part: "Tam parça numarası eşleşmesi",
    col_article_ebay: "Artikel / Ebay",
    part_detail: "PARÇA DETAYI",
    part_images: "Parça görselleri",
    all_parts_of_vehicle: "Aracın Tüm Parçalarını Göster",
    no_results: "Sonuç bulunamadı",
    loosen_filters: "Filtrelerden birini gevşeterek yeniden deneyin.",
    search_failed: "Arama başarısız: ",
    no_image: "Görsel yok",
    images_count: "görsel",
    detail: "Detay", print_label: "Etiket bas", print_label_pdf: "Etiket bas / PDF",
    prev: "‹ Önceki",
    next: "Sonraki ›",
    stock_pcs: "adet",
    purchase_price: "Alış",
    location_empty: "Lagerort yok",
    toast_images_error: "Görseller alınamadı",
    toast_search_error: "Arama başarısız: ",
    // Settings translations
    settings_title: "AYARLAR",
    settings_subtitle: "Sistem Ayarları",
    settings_theme: "Arayüz Teması",
    theme_dark: "Koyu",
    theme_light: "Açık",
    settings_lang: "Dil Seçimi",
    // Database Labels
    'Fahrzeug-ID': 'Geb. numarası',
    'Artikelnummer': 'Artikel numarası',
    'ArtikelNr': 'Artikel Nr.',
    'Bezeichnung': 'Parça adı',
    'Zusatztext': 'Ek açıklama',
    'Marke': 'Marka',
    'Modellcode': 'Model',
    'Typ': 'Tip',
    'Motorcode': 'Motor kodu',
    'Getriebecode': 'Şanzıman kodu',
    'Getriebeart': 'Şanzıman türü',
    'Hubraum': 'Motor hacmi',
    'Kilometer': 'Kilometre',
    'Baujahr': 'Üretim yılı',
    'Erstzulassung': 'İlk tescil',
    'Kraftstoff': 'Yakıt',
    'Farbe': 'Renk',
    'KBA_Nummer': 'KBA numarası',
    'Zylinder': 'Silindir',
    'Lagerort': 'Depo konumu',
    'Lagerplatz': 'Depo yeri',
    'Lagermenge': 'Stok',
    'Mindestmenge': 'Min. miktar',
    'MaxMenge': 'Maks. miktar',
    'VK_Brutto': 'Satış (brüt)',
    'Verkaufspreis': 'Satış fiyatı',
    'Einkaufspreis': 'Alış fiyatı',
    'Ebayartikelnummer': 'Ebay artikel no',
    'Zustand': 'Durum',
    'Bemerkung': 'Not',
    'Pfand': 'Depozito',
    'Euro_Norm': 'Euro norm',
    'Reserviert': 'Rezerve',
    'Letzte_Buchung': 'Son hareket',
    'EbayMarkiertVonAbteilung': 'Çalışılan birim',
    'FahrzeugNummer': 'Araç Numarası',
    // Placeholders
    placeholder_part_number: "Parça numarası",
    placeholder_designation: "Örn. Turbolader",
    placeholder_article: "202205030122",
    placeholder_brand: "HYUNDAI",
    placeholder_model: "IX35",
    placeholder_type: "2.0 TDI",
    placeholder_additional: "Parça kodu / açıklama",
    placeholder_engine: "D4HA",
    placeholder_gearbox: "Kod",
    placeholder_displacement: "2000",
    placeholder_location: "B4 Oben",
    placeholder_ebay: "117295913344", placeholder_vehicle_number: "Örn. 202607051", placeholder_vehicle_vin: "VIN / şasi numarası", placeholder_vehicle_brand: "Örn. SEAT", placeholder_vehicle_model: "Örn. AROSA", placeholder_vehicle_type: "Örn. 1.0", placeholder_vehicle_engine: "Motor kodu", placeholder_vehicle_kba: "KBA numarası"
  },
  de: {
    subtitle: "Teilesuchsystem",
    working_unit: "Arbeitsbereich",
    loading: "Laden…",
    checking_server: "Serververbindung wird geprüft",
    inventory: "INVENTAR",
    reset: "Zurücksetzen",
    other_filters: "Weitere Suchoptionen",
    menu_parts: "Teile", menu_vehicles: "Fahrzeuge", menu_kba: "KBA-Suche", vehicle_search: "FAHRZEUGSUCHE", vehicle_query: "Fahrzeugdaten abfragen",
    detail_label: "DETAIL", vehicle_number: "Fahrzeugnummer", vehicle_brand: "Marke", vehicle_model: "Modell", vehicle_type: "Typ",
    vehicle_engine: "Motorcode", vehicle_engine_short: "Motor", vehicle_gearbox: "Getriebecode", vehicle_engine_gearbox: "Motor / Getriebe", vehicle_kba: "KBA-Nummer", vehicle_status: "Status", get_vehicles: "Fahrzeuge anzeigen",
    vehicle_found: "Gefundene Datensätze", vehicle_row_hint: "Klicken Sie auf eine Zeile, um Details anzuzeigen", vehicle_ready: "Bereit zur Fahrzeugsuche",
    vehicle_ready_hint: "Filter ausfüllen oder alle Fahrzeuge auflisten.", vehicle_brand_model: "Marke / Modell", vehicle_year_reg: "Baujahr / Erstzulassung",
    vehicle_purchase_date: "Kaufdatum", vehicle_document: "FZG-Brief", vehicle_vin: "Fahrgestellnummer", vehicle_plate: "Kennzeichen", vehicle_weight: "Gewicht",
    vehicle_holders: "Anzahl Halter",
    copy_value: "Wert kopieren", copied: "Kopiert",
    vehicle_data: "Fahrzeugdaten", vehicle_overview: "Fahrzeugübersicht", priority_data: "Wichtige Daten",
    seller_information: "Verkäuferdaten", seller_type: "Kundenart", seller_name: "Name / Firma", seller_address: "Adresse",
    seller_phone: "Telefon", seller_fax: "Fax", seller_birth_date: "Geburtsdatum", seller_nationality: "Staatsangehörigkeit", seller_document: "Ausweisnummer",
    show_more: "Mehr anzeigen", show_less: "Weniger anzeigen",
    status_all: "Alle Status", status_new: "Neuannahme", status_saved: "Gespeichert", status_sold: "Verkauft", status_dismantle: "Zum Schlachten", status_scrapped: "Verschrottet",
    filter_part_number: "Teilenummer",
    filter_designation: "Teilename",
    filter_article: "Artikelnummer",
    filter_brand: "Fahrzeugmarke",
    filter_model: "Modell",
    filter_type: "Fahrzeugtyp",
    filter_additional: "Zusatztext",
    filter_engine: "Motorcode",
    filter_gearbox: "Getriebecode",
    filter_displacement: "Hubraum",
    filter_location: "Lagerort",
    filter_ebay: "Ebay-Artikelnummer",
    filter_limit: "Einträge pro Seite",
    show_only_instock: "Nur im Lager befindliche anzeigen",
    start_search: "Suche Starten",
    results: "ERGEBNISSE",
    found_parts: "Gefundene Teile",
    enter_search_criteria: "Geben Sie Ihre Suchkriterien ein",
    ready_to_search: "Bereit zur Suche",
    fill_filters_press_search: "Füllen Sie die Filter aus und klicken Sie auf \"Suche Starten\".",
    col_image: "Bild",
    col_part: "Teil",
    col_vehicle: "Fahrzeug",
    col_technical: "Technische Info",
    col_stock: "Bestand",
    col_price: "Preis",
    show_price: "Preis anzeigen",
    hide_price: "Preis ausblenden",
    show_all_prices: "Alle Preise anzeigen",
    hide_all_prices: "Alle Preise ausblenden",
    ebay_show_results: "eBay-Ergebnisse anzeigen",
    ebay_hide_results: "eBay-Ergebnisse ausblenden",
    ebay_open_separate: "Auf eigener Seite öffnen ↗",
    ebay_exact_part: "Exakte Teilenummer",
    col_article_ebay: "Artikel / Ebay",
    part_detail: "TEILE-DETAIL",
    part_images: "Teilebilder",
    all_parts_of_vehicle: "Alle Teile dieses Fahrzeugs anzeigen",
    no_results: "Keine Ergebnisse gefunden",
    loosen_filters: "Lockern Sie einen der Filter und versuchen Sie es erneut.",
    search_failed: "Suche fehlgeschlagen: ",
    no_image: "Kein Bild",
    images_count: "Bilder",
    detail: "Detail", print_label: "Etikett drucken", print_label_pdf: "Etikett / PDF drucken",
    prev: "‹ Vorherige",
    next: "Nächste ›",
    stock_pcs: "Stk",
    purchase_price: "Einkauf",
    location_empty: "Kein Lagerort",
    toast_images_error: "Bilder konnten nicht geladen werden",
    toast_search_error: "Suche fehlgeschlagen: ",
    // Settings translations
    settings_title: "EINSTELLUNGEN",
    settings_subtitle: "Systemeinstellungen",
    settings_theme: "Benutzeroberfläche",
    theme_dark: "Dunkel",
    theme_light: "Hell",
    settings_lang: "Sprachauswahl",
    // Database Labels
    'Fahrzeug-ID': 'Fahrzeug-ID',
    'Artikelnummer': 'Artikelnummer',
    'ArtikelNr': 'Artikel Nr.',
    'Bezeichnung': 'Bezeichnung',
    'Zusatztext': 'Zusatztext',
    'Marke': 'Marke',
    'Modellcode': 'Modell',
    'Typ': 'Typ',
    'Motorcode': 'Motorcode',
    'Getriebecode': 'Getriebecode',
    'Getriebeart': 'Getriebeart',
    'Hubraum': 'Hubraum',
    'Kilometer': 'Kilometerstand',
    'Baujahr': 'Baujahr',
    'Erstzulassung': 'Erstzulassung',
    'Kraftstoff': 'Kraftstoff',
    'Farbe': 'Farbe',
    'KBA_Nummer': 'KBA-Nummer',
    'Zylinder': 'Zylinder',
    'Lagerort': 'Lagerort',
    'Lagerplatz': 'Lagerplatz',
    'Lagermenge': 'Lagermenge',
    'Mindestmenge': 'Mindestmenge',
    'MaxMenge': 'MaxMenge',
    'VK_Brutto': 'VK Brutto',
    'Verkaufspreis': 'Verkaufspreis',
    'Einkaufspreis': 'Einkaufspreis',
    'Ebayartikelnummer': 'Ebay-Artikelnummer',
    'Zustand': 'Zustand',
    'Bemerkung': 'Bemerkung',
    'Pfand': 'Pfand',
    'Euro_Norm': 'Euro-Norm',
    'Reserviert': 'Reserviert',
    'Letzte_Buchung': 'Letzte Buchung',
    'EbayMarkiertVonAbteilung': 'Arbeitsbereich',
    'FahrzeugNummer': 'Fahrzeugnummer',
    // Placeholders
    placeholder_part_number: "Teilenummer",
    placeholder_designation: "z.B. Turbolader",
    placeholder_article: "202205030122",
    placeholder_brand: "HYUNDAI",
    placeholder_model: "IX35",
    placeholder_type: "2.0 TDI",
    placeholder_additional: "Teilecode / Beschreibung",
    placeholder_engine: "D4HA",
    placeholder_gearbox: "Code",
    placeholder_displacement: "2000",
    placeholder_location: "B4 Oben",
    placeholder_ebay: "117295913344", placeholder_vehicle_number: "z.B. 202607051", placeholder_vehicle_vin: "FIN / Fahrgestellnummer", placeholder_vehicle_brand: "z.B. SEAT", placeholder_vehicle_model: "z.B. AROSA", placeholder_vehicle_type: "z.B. 1.0", placeholder_vehicle_engine: "Motorcode", placeholder_vehicle_kba: "KBA-Nummer"
  },
  en: {
    subtitle: "Part Search System",
    working_unit: "Working unit",
    loading: "Loading…",
    checking_server: "Checking server connection",
    inventory: "INVENTORY",
    reset: "Clear",
    other_filters: "More search options",
    menu_parts: "Parts", menu_vehicles: "Vehicles", menu_kba: "KBA Search", vehicle_search: "VEHICLE SEARCH", vehicle_query: "Query vehicle records",
    detail_label: "DETAIL", vehicle_number: "Vehicle number", vehicle_brand: "Brand", vehicle_model: "Model", vehicle_type: "Type",
    vehicle_engine: "Engine code", vehicle_engine_short: "Engine", vehicle_gearbox: "Gearbox code", vehicle_engine_gearbox: "Engine / Gearbox", vehicle_kba: "KBA number", vehicle_status: "Status", get_vehicles: "Show vehicles",
    vehicle_found: "Records found", vehicle_row_hint: "Click a row to view its details", vehicle_ready: "Ready to search vehicles",
    vehicle_ready_hint: "Fill in filters or list all vehicles.", vehicle_brand_model: "Brand / Model", vehicle_year_reg: "Year / Registration",
    vehicle_purchase_date: "Purchase date", vehicle_document: "Vehicle document", vehicle_vin: "VIN", vehicle_plate: "License plate", vehicle_weight: "Weight",
    vehicle_holders: "Number of owners",
    copy_value: "Copy value", copied: "Copied",
    vehicle_data: "Vehicle data", vehicle_overview: "Vehicle overview", priority_data: "Priority information",
    seller_information: "Seller information", seller_type: "Customer type", seller_name: "Name / Company", seller_address: "Address",
    seller_phone: "Phone", seller_fax: "Fax", seller_birth_date: "Date of birth", seller_nationality: "Nationality", seller_document: "ID number",
    show_more: "Show more", show_less: "Show less",
    status_all: "All statuses", status_new: "New intake", status_saved: "Saved", status_sold: "Sold", status_dismantle: "For dismantling", status_scrapped: "Scrapped",
    filter_part_number: "Part number",
    filter_designation: "Part designation",
    filter_article: "Article number",
    filter_brand: "Vehicle brand",
    filter_model: "Model",
    filter_type: "Vehicle type",
    filter_additional: "Additional text",
    filter_engine: "Engine code",
    filter_gearbox: "Gearbox code",
    filter_displacement: "Displacement",
    filter_location: "Storage location",
    filter_ebay: "Ebay item no",
    filter_limit: "Items per page",
    show_only_instock: "Show only in-stock items",
    start_search: "Start Search",
    results: "RESULTS",
    found_parts: "Found parts",
    enter_search_criteria: "Enter your search criteria",
    ready_to_search: "Ready to search",
    fill_filters_press_search: "Fill the filters and click \"Start Search\".",
    col_image: "Image",
    col_part: "Part",
    col_vehicle: "Vehicle",
    col_technical: "Technical info",
    col_stock: "Stock",
    col_price: "Price",
    show_price: "Show price",
    hide_price: "Hide price",
    show_all_prices: "Show all prices",
    hide_all_prices: "Hide all prices",
    ebay_show_results: "Show eBay results",
    ebay_hide_results: "Hide eBay results",
    ebay_open_separate: "Open on separate page ↗",
    ebay_exact_part: "Exact part number match",
    col_article_ebay: "Article / Ebay",
    part_detail: "PART DETAIL",
    part_images: "Part images",
    all_parts_of_vehicle: "Show All Parts of This Vehicle",
    no_results: "No results found",
    loosen_filters: "Try loosening one of the filters.",
    search_failed: "Search failed: ",
    no_image: "No image",
    images_count: "images",
    detail: "Detail", print_label: "Print label", print_label_pdf: "Print label / PDF",
    prev: "‹ Previous",
    next: "Next ›",
    stock_pcs: "pcs",
    purchase_price: "Purchase",
    location_empty: "No location",
    toast_images_error: "Could not fetch images",
    toast_search_error: "Search failed: ",
    // Settings translations
    settings_title: "SETTINGS",
    settings_subtitle: "System Settings",
    settings_theme: "Interface Theme",
    theme_dark: "Dark",
    theme_light: "Light",
    settings_lang: "Language Selection",
    // Database Labels
    'Fahrzeug-ID': 'Part ID',
    'Artikelnummer': 'Article number',
    'ArtikelNr': 'Article Nr.',
    'Bezeichnung': 'Designation',
    'Zusatztext': 'Additional text',
    'Marke': 'Brand',
    'Modellcode': 'Model',
    'Typ': 'Type',
    'Motorcode': 'Engine code',
    'Getriebecode': 'Gearbox code',
    'Getriebeart': 'Gearbox type',
    'Hubraum': 'Displacement',
    'Kilometer': 'Mileage',
    'Baujahr': 'Year built',
    'Erstzulassung': 'First registration',
    'Kraftstoff': 'Fuel type',
    'Farbe': 'Color',
    'KBA_Nummer': 'KBA number',
    'Zylinder': 'Cylinders',
    'Lagerort': 'Storage location',
    'Lagerplatz': 'Shelf location',
    'Lagermenge': 'Stock quantity',
    'Mindestmenge': 'Min. quantity',
    'MaxMenge': 'Max quantity',
    'VK_Brutto': 'Sales Price (brut)',
    'Verkaufspreis': 'Selling price',
    'Einkaufspreis': 'Purchase price',
    'Ebayartikelnummer': 'Ebay article number',
    'Zustand': 'Condition',
    'Bemerkung': 'Note',
    'Pfand': 'Deposit',
    'Euro_Norm': 'Euro norm',
    'Reserviert': 'Reserved',
    'Letzte_Buchung': 'Last entry',
    'EbayMarkiertVonAbteilung': 'Working unit',
    'FahrzeugNummer': 'Vehicle Number',
    // Placeholders
    placeholder_part_number: "Part number",
    placeholder_designation: "e.g. Turbolader",
    placeholder_article: "202205030122",
    placeholder_brand: "HYUNDAI",
    placeholder_model: "IX35",
    placeholder_type: "2.0 TDI",
    placeholder_additional: "Part code / description",
    placeholder_engine: "D4HA",
    placeholder_gearbox: "Code",
    placeholder_displacement: "2000",
    placeholder_location: "B4 Oben",
    placeholder_ebay: "117295913344", placeholder_vehicle_number: "e.g. 202607051", placeholder_vehicle_vin: "VIN / chassis number", placeholder_vehicle_brand: "e.g. SEAT", placeholder_vehicle_model: "e.g. AROSA", placeholder_vehicle_type: "e.g. 1.0", placeholder_vehicle_engine: "Engine code", placeholder_vehicle_kba: "KBA number"
  }
};

// State Variables
let currentLanguage = localStorage.getItem('lang') || 'tr';
let currentTheme = localStorage.getItem('theme') || 'dark';

// Translation Helper
const t = key => translations[currentLanguage][key] || key;

// Theme Controller
function applyTheme() {
  if (currentTheme === 'light') {
    document.body.classList.add('light-theme');
  } else {
    document.body.classList.remove('light-theme');
  }
}

// i18n Renderer
function applyLanguage() {
  document.documentElement.lang = currentLanguage === 'de' ? 'de' : currentLanguage === 'en' ? 'en' : 'tr';
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (translations[currentLanguage][key]) {
      el.innerHTML = translations[currentLanguage][key];
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    if (translations[currentLanguage][key]) {
      el.setAttribute('placeholder', translations[currentLanguage][key]);
    }
  });
  const quickReset=document.querySelector('#quickResetButton');
  if(quickReset){
    const label=currentLanguage==='de'?'Filter zurücksetzen':currentLanguage==='en'?'Clear filters':'Filtreleri temizle';
    quickReset.title=label;
    quickReset.setAttribute('aria-label',label);
  }
  syncToggleAllPricesButton();
  window.EbayResults?.setLanguage(currentLanguage);
  if (typeof mobileSearchPanelToggle !== 'undefined' && mobileSearchPanelToggle) {
    setMobileSearchPanel(mobileSearchPanelToggle.getAttribute('aria-expanded') === 'true');
  }
}

// Settings Sync UI
function syncSettingsUI() {
  // Theme option buttons active classes
  document.querySelector('#themeDarkBtn').classList.toggle('active', currentTheme === 'dark');
  document.querySelector('#themeLightBtn').classList.toggle('active', currentTheme === 'light');
  
  // Flags active classes
  document.querySelectorAll('.flag-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLanguage);
  });
}

// Open Settings Dialogue
settingsBtn.addEventListener('click', () => {
  syncSettingsUI();
  settingsDialog.showModal();
});

// Close Settings Dialogue
closeSettings.addEventListener('click', () => settingsDialog.close());
settingsDialog.addEventListener('click', e => {
  if (e.target === settingsDialog) settingsDialog.close();
});

// Theme Select Click Handlers
document.querySelectorAll('.theme-option-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    currentTheme = this.dataset.theme;
    localStorage.setItem('theme', currentTheme);
    applyTheme();
    syncSettingsUI();
  });
});

// Language Flags Click Handlers
document.querySelectorAll('.flag-btn').forEach(btn => {
  btn.addEventListener('click', function() {
    currentLanguage = this.dataset.lang;
    localStorage.setItem('lang', currentLanguage);
    applyLanguage();
    window.dispatchEvent(new CustomEvent('app-language-change', { detail: { language: currentLanguage } }));
    syncSettingsUI();
    if (currentRows.length > 0) {
      runSearch(); // Reload results using language formatting
    }
  });
});

// Init layout preferences
applyTheme();
applyLanguage();

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const money = value => value == null ? '—' : new Intl.NumberFormat(currentLanguage === 'en' ? 'en-US' : 'de-DE',{style:'currency',currency:'EUR'}).format(Number(value));
const text = value => value == null || value === '' ? '—' : esc(value);
const formatDate = value => value ? new Intl.DateTimeFormat(currentLanguage === 'en' ? 'en-US' : 'de-DE').format(new Date(value)) : '—';

const brandSlug=value=>{const key=String(value||'').trim().toUpperCase().replace('Ë','E');const aliases={'VW':'volkswagen','VW...':'volkswagen','VOLKSWAGEN':'volkswagen','MERCEDES BENZ':'mercedes','MERCEDES-BENZ':'mercedes','MERCEDES':'mercedes','MERCCEDES BENZ':'mercedes','DAIMLER':'mercedes','DAIMLER-BENZ':'mercedes','DAIMLERCHRYSLER':'mercedes','CITROEN':'citroen','CITRO-N':'citroen','CITROËN':'citroen','ALFA ROMEO':'alfa-romeo','LAND ROVER':'land-rover','RANGE ROVER':'land-rover','BMW /ALPINA':'alpina','CHEVROLET (USA)':'chevrolet','FORD (USA)':'ford','FORD USA':'ford','DEAWOO':'daewoo','GM DAEWOO':'daewoo','HYNDAI':'hyundai','PEGEOT':'peugeot','PEUGEUT':'peugeot','KIA MOTOR':'kia','KIA ASIA MOTOR':'kia','JEEP / DAIMLERCHRYSLER':'jeep','TATA (TELCO)':'tata','SUBARU/ SUZUKI':'subaru','MARUTI':'maruti'};return aliases[key]||key.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')};
const brandLogo=value=>value&&value!=='-'?`<img class="brand-logo" src="/brands/${brandSlug(value)}.svg" alt="${esc(value)} logosu" onerror="this.style.display='none'">`:'';
const ebayLink=value=>value?`<a class="ebay-icon-link" href="https://www.ebay.de/itm/${encodeURIComponent(String(value).trim())}" target="_blank" rel="noopener noreferrer" title="eBay ${esc(value)}" aria-label="eBay ${esc(value)}"><span class="ebay-logo" aria-hidden="true"><i>e</i><i>b</i><i>a</i><i>y</i></span></a>`:'—';
const priceRevealButton = (value, extraClass = '') => {
  const numericValue = Number(value);
  const label = value == null || value === '' ? money(null) : Number.isFinite(numericValue) ? money(numericValue) : String(value);
  return `<button type="button" class="price result-sale-price price-reveal ${extraClass}" data-price-hidden="true" aria-pressed="false" aria-label="${esc(t('show_price'))}"><span class="price-mask" aria-hidden="true"></span><span class="price-value">${esc(label)}</span></button>`;
};
function setPriceHidden(button, hidden) {
  button.dataset.priceHidden = hidden ? 'true' : 'false';
  button.setAttribute('aria-pressed', String(!hidden));
  button.setAttribute('aria-label', hidden ? t('show_price') : t('hide_price'));
}
function visiblePriceButtons() {
  return [...resultsCard.querySelectorAll('.price-reveal')].filter(button => button.offsetParent !== null);
}
function syncToggleAllPricesButton() {
  if (!toggleAllPricesButton) return;
  const buttons = visiblePriceButtons();
  const hasPrices = buttons.length > 0;
  const allVisible = hasPrices && buttons.every(button => button.dataset.priceHidden === 'false');
  toggleAllPricesButton.classList.toggle('hidden', !hasPrices);
  toggleAllPricesButton.dataset.pricesVisible = allVisible ? 'true' : 'false';
  toggleAllPricesButton.textContent = t(allVisible ? 'hide_all_prices' : 'show_all_prices');
  toggleAllPricesButton.setAttribute('aria-pressed', String(allVisible));
}
const ebaySearchUrl=partNumber=>{
  const value=normalizePartSearchValue(partNumber);
  if(!value)return '';
  const params=new URLSearchParams({_nkw:value,_sacat:'0',_from:'R40',_fsrp:'1',LH_PrefLoc:'1',LH_SellerType:'2',rt:'nc',LH_ItemCondition:'4'});
  return `https://www.ebay.de/sch/i.html?${params.toString()}`;
};
const ebaySearchFallback=partNumber=>{
  const url=ebaySearchUrl(partNumber);
  if(!url)return '';
  const value=normalizePartSearchValue(partNumber);
  const label=currentLanguage==='de'?'Bei eBay suchen':currentLanguage==='en'?'Search on eBay':"eBay'de ara";
  const hint=currentLanguage==='de'?`Kein lokales Ergebnis. Suchbegriff: ${value}`:currentLanguage==='en'?`No local result. Search term: ${value}`:`Yerel sonuc yok. Aranan parca: ${value}`;
  return `<section class="empty-ebay-fallback"><a class="ebay-icon-link empty-ebay-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer" title="${esc(label)} ${esc(value)}" aria-label="${esc(label)} ${esc(value)}"><span class="ebay-logo" aria-hidden="true"><i>e</i><i>b</i><i>a</i><i>y</i></span></a><small>${esc(label)} · ${esc(value)}</small><a class="ebay-screenshot-preview" href="/tmp/ebay-${esc(value)}.png" target="_blank" rel="noopener noreferrer"><img src="/tmp/ebay-${esc(value)}.png" alt="eBay ${esc(value)} screenshot" loading="lazy" onerror="this.closest('.ebay-screenshot-preview').remove()"></a></section>`;
};
const locationBadge=value=>{if(value==null||value==='')return `<span class="location-badge empty-location">${t('location_empty')}</span>`;let hash=0;for(const char of String(value))hash=(hash*31+char.charCodeAt(0))>>>0;const hue=hash%360;return `<span class="location-badge" style="--location-hue:${hue}">${esc(value)}</span>`};
const carIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" width="13" height="13" style="vertical-align: -1px; margin-right: 4px;"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"></path><circle cx="7" cy="17" r="2"></circle><path d="M9 17h6"></path><circle cx="17" cy="17" r="2"></circle></svg>`;

const normalizePartSearchValue=value=>String(value||'').toUpperCase().replace(/Ä/g,'A').replace(/Ö/g,'O').replace(/Ü/g,'U').replace(/ß/g,'SS').replace(/İ/g,'I').replace(/İ/g,'I').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9]/g,'');
const normalizeRecyclePartSearchValue=value=>String(value||'').toUpperCase().replace(/Ä/g,'A').replace(/Ö/g,'O').replace(/Ü/g,'U').replace(/ß/g,'SS').replace(/İ/g,'I').replace(/İ/g,'I').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Z0-9*]/g,'');

function stockQuantity(value) {
  const numeric = Number(String(value ?? 0).replace(',', '.').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(numeric) ? numeric : 0;
}

function stockState(value) {
  const quantity = stockQuantity(value);
  if (quantity <= 0) return 'empty';
  if (quantity <= 2) return 'low';
  return 'ok';
}

function stockStatusText(value) {
  const quantity = stockQuantity(value);
  if (currentLanguage === 'de') return quantity <= 0 ? 'Kein Bestand' : quantity <= 2 ? 'Niedriger Bestand' : 'Bestand verfugbar';
  if (currentLanguage === 'en') return quantity <= 0 ? 'Out of stock' : quantity <= 2 ? 'Low stock' : 'In stock';
  return quantity <= 0 ? 'Stok yok' : quantity <= 2 ? 'Dusuk stok' : 'Stok var';
}

function stockHtml(value) {
  return `<div class="stock stock-${stockState(value)}" title="${esc(stockStatusText(value))}">${text(value)} ${t('stock_pcs')}</div>`;
}

async function health() {
  const el = document.querySelector('.connection');
  try { 
    el.classList.remove('ok','bad'); 
    const r = await fetch('/api/health?unit='+encodeURIComponent(currentUnit())); 
    const data = await r.json(); 
    if (!r.ok) throw new Error(data.error); 
    el.classList.add('ok'); 
    document.querySelector('#connectionText').textContent = `${data.server} · ${data.database}`; 
    el.setAttribute('title', `${data.server} · ${data.database}`);
  }
  catch (e) { 
    console.error('Health check error:', e);
    el.classList.add('bad'); 
    document.querySelector('#connectionText').setAttribute('data-i18n', 'checking_server');
    document.querySelector('#connectionText').textContent = 'MSSQL'; 
    el.setAttribute('title', 'MSSQL Disconnected');
  }
}

function render(data, fallbackPartNumber='') {
  currentRows = data.rows;
  empty.classList.remove('compact-no-results');
  count.textContent = new Intl.NumberFormat(currentLanguage === 'en' ? 'en-US' : 'tr-TR').format(data.count);
  meta.textContent = `${data.page} / ${data.pages} · ${data.shown} / ${data.count}`;
  
  if (!data.rows.length) { 
    tableWrap.classList.add('hidden'); 
    essInlineResults.hidden = true;
    empty.classList.remove('hidden'); 
    empty.innerHTML=`<div>⌕</div><h3>${t('no_results')}</h3><p>${t('loosen_filters')}</p>`;
    syncToggleAllPricesButton();
    return; 
  }
  
  empty.classList.add('hidden'); 
  essInlineQuery.textContent = currentResultQuery() || fallbackPartNumber;
  essInlineResults.hidden = false;
  tableWrap.classList.remove('hidden');
  
  body.innerHTML = data.rows.map((r,i) => `${data.wmkatGrouped && (i===0 || data.rows[i-1].WmkatReference!==r.WmkatReference || data.rows[i-1].WmkatGroup!==r.WmkatGroup) ? `<tr class="wmkat-reference-heading"><td colspan="7"><span>WMKAT Referenznummer</span><strong>${esc(r.WmkatReference)}</strong><small>${esc(r.WmkatGroup)} · ${data.rows.filter(item=>item.WmkatReference===r.WmkatReference&&item.WmkatGroup===r.WmkatGroup).length} stoklu ürün</small></td></tr>` : ''}<tr>
    <td>${r.MainPictureID ? `<button class="image-button" data-gallery="${i}" aria-label="Görselleri aç"><img class="part-thumb" src="/api/parts/${r['Fahrzeug-ID']}/images/${r.MainPictureID}?unit=${encodeURIComponent(currentUnit())}" alt="${esc(r.Bezeichnung||'Parça')}" loading="lazy"><span>${r.ImageCount||1} ${t('images_count')}</span></button>` : `<div class="no-image baytemur-placeholder" title="${t('no_image')}"><img src="/baytemur-placeholder.png" alt="Baytemür"><span>${t('no_image')}</span></div>`}</td>
    <td><div class="part-name">${text(r.Bezeichnung)}</div><div class="sub">${text(r.Zusatztext)}</div><div class="sub result-article-number">${t('Artikelnummer')}: <strong>${text(r.Artikelnummer || r.ArtikelNr)}</strong></div>${r.WmkatReference ? `<div class="wmkat-match"><b>WMKAT</b> ${esc(r.WmkatGroup)} · <strong>${esc(r.WmkatReference)}</strong></div>` : ''}</td>
    <td class="result-vehicle-cell">
      <div class="result-vehicle-identity">${brandLogo(r.Marke)}<div><strong>${text(r.Marke)}</strong><span>${text(r.Modellcode)}</span></div></div>
      <div class="sub">${text(r.Typ)} · ${text(r.Baujahr)}</div>
      ${r.FahrzeugNummer ? `<button class="vehicle-badge result-vehicle-number" data-vehicle="${esc(r.FahrzeugNummer)}" title="${t('all_parts_of_vehicle')}">${esc(r.FahrzeugNummer)}</button>` : ''}
    </td>
    <td class="result-technical"><div class="result-tech-line"><span>Motor</span><strong>${text(r.Motorcode)}</strong></div><div class="result-tech-line"><span>Getriebe</span><strong>${text(r.Getriebecode)}</strong></div><div class="result-tech-line"><span>${t('Hubraum')}</span><strong>${r.Hubraum == null || r.Hubraum === '' ? '—' : `${esc(r.Hubraum)} cm³`}</strong></div><div class="result-tech-line"><span>${t('Kilometer')}</span><strong>${r.Kilometer == null || r.Kilometer === '' ? '—' : `${vehicleKilometers(r.Kilometer)} km`}</strong></div>${r.KBA_Nummer ? `<div class="result-tech-line"><span>KBA</span><strong>${formatKba(r.KBA_Nummer)}</strong></div>` : ''}</td>
    <td class="result-storage">${stockHtml(r.Lagermenge)}<div class="location-row">${locationBadge(r.Lagerort)}${r.Lagerplatz ? `<span class="location-place">${esc(r.Lagerplatz)}</span>` : ''}</div></td>
    <td>${priceRevealButton(r.VK_Brutto ?? r.Verkaufspreis)}</td>
    <td><div class="result-row-actions"><button class="part-label-button icon-action-button" data-label-index="${i}" type="button" title="${t('print_label')}" aria-label="${t('print_label')}"><span class="action-icon" aria-hidden="true">▣</span><span class="action-tooltip">${t('print_label')}</span></button><button class="detail-button icon-action-button" data-index="${i}" title="${t('detail')}" aria-label="${t('detail')}"><span class="action-icon" aria-hidden="true">◉</span><span class="action-tooltip">${t('detail')}</span></button>${r.Ebayartikelnummer ? `<a class="icon-action-button result-ebay-action" href="https://www.ebay.de/itm/${encodeURIComponent(String(r.Ebayartikelnummer).trim())}" target="_blank" rel="noopener noreferrer" title="eBay ${esc(r.Ebayartikelnummer)}" aria-label="eBay ${esc(r.Ebayartikelnummer)}"><span class="ebay-logo" aria-hidden="true"><i>e</i><i>b</i><i>a</i><i>y</i></span><span class="action-tooltip">eBay</span></a>` : ''}</div></td></tr>`).join('');
  body.querySelectorAll('button.detail-button[data-index]').forEach(button=>{
    const row=button.closest('tr');
    const index=button.dataset.index;
    if(!row)return;
    row.dataset.resultIndex=index;
    const partCell=row.children[1];
    if(partCell&&!partCell.querySelector('.result-recycle-slot')){
      partCell.insertAdjacentHTML('beforeend',`<div class="result-recycle-slot" data-recycle-index="${index}"></div>`);
    }
  });

  renderPagination(data);
  document.querySelectorAll('th.sortable').forEach(th=>{th.classList.toggle('active-sort',th.dataset.sort===data.sort);th.dataset.direction=th.dataset.sort===data.sort?data.dir:''});
  syncToggleAllPricesButton();
}

function renderPagination(data){
  const nav=document.querySelector('#pagination');
  if(data.pages<=1){
    nav.classList.add('hidden');
    nav.innerHTML='';
    return;
  }
  const start=Math.max(1,data.page-2),end=Math.min(data.pages,data.page+2);
  let html=`<button data-page="${data.page-1}" ${data.page===1?'disabled':''}>${t('prev')}</button>`;
  if(start>1)html+=`<button data-page="1">1</button>${start>2?'<span>…</span>':''}`;
  for(let page=start;page<=end;page++)html+=`<button data-page="${page}" class="${page===data.page?'active':''}">${page}</button>`;
  if(end<data.pages)html+=`${end<data.pages-1?'<span>…</span>':''}<button data-page="${data.pages}">${data.pages}</button>`;
  html+=`<button data-page="${data.page+1}" ${data.page===data.pages?'disabled':''}>${t('next')}</button>`;
  nav.innerHTML=html;
  nav.classList.remove('hidden');
}

async function runSearch(event, addToHistory = true) {
  const ebayRun = window.EbayResults.clear();
  event?.preventDefault(); 
  if(recycleLocalLookupActive||recycleDirectLookupActive)fetch('/api/recycle/cancel',{method:'POST'}).catch(()=>{});
  recycleLocalLookupToken++;
  recycleDirectLookupToken++;
  recycleLocalLookupActive=false;
  recycleDirectLookupActive=false;
  clearRecycleResults();
  essInlineResults.hidden = true;
  if(event?.type==='submit') {
    resultPage=1;
    document.querySelector('#hiddenVehicleInput').value = '';
  } 
  
  const button=form.querySelector('.primary'); 
  button.disabled=true; 
  button.innerHTML=t('loading');

  const partNumberInput=form.elements.part_number;
  const recyclePartNumber=normalizeRecyclePartSearchValue(partNumberInput.value);
  const normalizedPartNumber=normalizePartSearchValue(partNumberInput.value);
  if(partNumberInput.value&&!recyclePartNumber.includes('*')&&normalizedPartNumber!==partNumberInput.value.trim())partNumberInput.value=normalizedPartNumber;
  
  const params = new URLSearchParams(new FormData(form)); 
  if(normalizedPartNumber)params.set('part_number',normalizedPartNumber);
  params.set('in_stock',form.elements.in_stock.checked?'1':'0'); 
  params.set('unit',currentUnit());
  params.set('page',resultPage);
  params.set('sort',resultSort);
  params.set('dir',resultDirection);
  const ebayQuery = normalizedPartNumber || ['designation','brand','model'].map(name => String(form.elements[name]?.value || '').trim()).filter(Boolean).join(' ');
  
  try { 
    const response=await fetch('/api/search?'+params); 
    const data=await response.json(); 
    if(!response.ok) throw new Error(data.error); 
    document.querySelector('.search-layout').classList.add('has-results'); 
    resultsCard.classList.remove('hidden'); 
    const requestedPartNumber=normalizePartSearchValue(form.elements.part_number.value);
    const requestedRecyclePartNumber=recyclePartNumber||requestedPartNumber;
    render(data, requestedPartNumber);
    if(data.count===0&&shouldRunExternalPartSearch()){
      await runWmkatAlternatives(requestedRecyclePartNumber,data);
    }else{
      setWmkatStatus('');
      if(data.rows?.length)enrichFoundResultsWithRecycle(requestedRecyclePartNumber,data);
    }
    window.EbayResults.load(ebayQuery, ebayRun, Boolean(String(form.elements.part_number?.value || '').trim()));
    if (!restoringHistory) saveSearchState(addToHistory);
  }
  catch(error){ 
    showToast(t('toast_search_error')+error.message); 
  }
  finally { 
    button.disabled=false; 
    button.innerHTML=`<span>⌕</span> ${t('start_search')}`; 
  }
}

function shouldRunExternalPartSearch(){
  if(!normalizePartSearchValue(form.elements.part_number.value))return false;
  for(const [key,value] of new FormData(form).entries()){
    if(['part_number','in_stock','limit'].includes(key))continue;
    if(String(value||'').trim())return false;
  }
  return true;
}

function setWmkatStatus(message,state='loading'){
  const status=document.querySelector('#wmkatStatus');
  status.textContent=message;
  status.className=message?`wmkat-status ${state}`:'wmkat-status hidden';
}

function formatWmkatElapsed(){
  const seconds=Math.max(0,Math.floor((Date.now()-wmkatSearchStartedAt)/1000));
  return `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
}

function showWmkatOverlay(partNumber){
  const overlay=document.querySelector('#wmkatOverlay');
  wmkatCancelled=false;
  wmkatSearchStartedAt=Date.now();
  document.querySelector('#wmkatOverlayQuery').textContent=`${currentLanguage==='de'?'Gesuchte Nummer':currentLanguage==='en'?'Searched number':'Aranan numara'}: ${partNumber}`;
  document.querySelector('#wmkatOverlayTitle').textContent=currentLanguage==='de'?'Alternative Teile werden gesucht':currentLanguage==='en'?'Searching alternative parts':'Alternatif parçalar aranıyor';
  document.querySelector('#recycleRemoteStage').className='active';
  document.querySelector('#wmkatRemoteStage').className='';
  document.querySelector('#wmkatStockStage').className='';
  const euSelected=isEuUnit();
  document.querySelector('#wmkatEuStage').className=euSelected?'':'hidden';
  document.querySelector('.wmkat-search-stages .done span').textContent=currentLanguage==='de'?'Kein Ergebnis im lokalen System':currentLanguage==='en'?'No result in the local system':'Yerel sistemde sonuç bulunamadı';
  document.querySelector('#recycleRemoteStage span').textContent=currentLanguage==='de'?'Produkt wird in Recycle gesucht':currentLanguage==='en'?'Searching product in Recycle':'Ürün Recycle içinde aranıyor';
  document.querySelector('#wmkatRemoteStage span').textContent=currentLanguage==='de'?'WMKAT-Referenzen werden gesucht':currentLanguage==='en'?'WMKAT references will be searched':'WMKAT referansları aranacak';
  document.querySelector('#wmkatStockStage span').textContent=currentLanguage==='de'?'WMKAT-Referenzen werden in Recycle gesucht':currentLanguage==='en'?'WMKAT references will be searched in Recycle':'WMKAT referansları Recycle içinde aranacak';
  document.querySelector('#wmkatEuStage span').textContent=currentLanguage==='de'?'Referenzen werden im lokalen EU-Teile-Bestand gesucht':currentLanguage==='en'?'References will be searched in local EU Parts stock':'Referanslar EU Teile yerel stokta aranacak';
  document.querySelector('#wmkatElapsed').textContent='00:00';
  document.querySelector('#wmkatCancelButton').textContent=currentLanguage==='de'?'Suche abbrechen':currentLanguage==='en'?'Cancel search':'Aramayı iptal et';
  overlay.classList.remove('hidden');
  clearInterval(wmkatElapsedTimer);
  wmkatElapsedTimer=setInterval(()=>{document.querySelector('#wmkatElapsed').textContent=formatWmkatElapsed()},1000);
}

function finishRecycleStage(message,failed=false){
  const recycle=document.querySelector('#recycleRemoteStage');
  recycle.className=failed?'':'done';
  recycle.querySelector('i').textContent=failed?'!':'✓';
  recycle.querySelector('span').textContent=message;
  document.querySelector('#wmkatRemoteStage').className='active';
}

function showLocalStockStage(referenceCount){
  const remote=document.querySelector('#wmkatRemoteStage');
  remote.className='done';
  remote.querySelector('i').textContent='✓';
  remote.querySelector('span').textContent=currentLanguage==='de'?`${referenceCount} WMKAT-Referenzen gefunden`:currentLanguage==='en'?`${referenceCount} WMKAT references found`:`${referenceCount} WMKAT referansı bulundu`;
  document.querySelector('#wmkatStockStage').className='active';
  document.querySelector('#wmkatStockStage span').textContent=currentLanguage==='de'?`${referenceCount} Referenzen werden in Recycle gesucht`:currentLanguage==='en'?`Searching ${referenceCount} references in Recycle`:`${referenceCount} referans Recycle içinde aranıyor`;
}

function showEuLocalStage(recycleCount){
  const recycleStage=document.querySelector('#wmkatStockStage');
  recycleStage.className='done';
  recycleStage.querySelector('i').textContent='✓';
  recycleStage.querySelector('span').textContent=currentLanguage==='de'?`${recycleCount} Recycle-Produkte über Referenzen gefunden`:currentLanguage==='en'?`${recycleCount} Recycle products found via references`:`Referanslardan ${recycleCount} Recycle ürünü bulundu`;
  const euStage=document.querySelector('#wmkatEuStage');
  euStage.className='active';
  euStage.querySelector('span').textContent=currentLanguage==='de'?'Referenzen werden im lokalen EU-Teile-Bestand gesucht':currentLanguage==='en'?'Searching references in local EU Parts stock':'Referanslar EU Teile yerel stokta aranıyor';
}

function hideWmkatOverlay(){
  clearInterval(wmkatElapsedTimer);
  wmkatElapsedTimer=null;
  document.querySelector('#wmkatOverlay').classList.add('hidden');
}

async function cancelWmkatSearch(){
  wmkatCancelled=true;
  wmkatAbortController?.abort();
  hideWmkatOverlay();
  setWmkatStatus(currentLanguage==='de'?'WMKAT-Suche abgebrochen':currentLanguage==='en'?'WMKAT search cancelled':'WMKAT araması iptal edildi','empty');
  fetch('/api/wmkat/cancel',{method:'POST'}).catch(()=>{});
  fetch('/api/recycle/cancel',{method:'POST'}).catch(()=>{});
}

document.querySelector('#wmkatCancelButton').addEventListener('click',cancelWmkatSearch);

function clearRecycleResults(){
  const container=document.querySelector('#recycleResults');
  container.classList.add('hidden');
  container.innerHTML='';
  recycleInlineResults.hidden=true;
  syncToggleAllPricesButton();
}

function renderRecycleResults(result,options={}){
  const container=document.querySelector('#recycleResults');
  empty.classList.remove('compact-no-results');
  if(!options.keepTable){
    currentRows=[];
    count.textContent=result.count;
  meta.textContent=currentLanguage==='de'?'Recycle-Ergebnisse':currentLanguage==='en'?'Recycle results':'Recycle sonuçları';
  }
  empty.classList.add('hidden');
  if(!options.keepTable){
    tableWrap.classList.add('hidden');
    essInlineResults.hidden=true;
    document.querySelector('#pagination').classList.add('hidden');
  }
  container.innerHTML=result.results.map((item,index)=>`<article class="recycle-result-card">
    ${item.hasImages&&item.partPk?`<button class="recycle-image-button is-loading" type="button" data-recycle-image-part="${esc(item.partPk)}" data-recycle-image-title="${esc(item.productName||item.title)}" aria-label="${t('part_images')}"><img alt="${esc(item.productName||item.title)}" loading="lazy" hidden><span class="recycle-image-placeholder" aria-hidden="true">⌕</span><small>${t('images_count')}</small></button>`:`<div class="recycle-image-button no-recycle-image" title="${t('no_image')}"><img src="/baytemur-placeholder.png" alt="Baytemür"><small>${t('no_image')}</small></div>`}
    <div class="recycle-result-main">
      <div class="recycle-result-top"><span class="recycle-source-badge">Recycle</span><span class="recycle-code">#${esc(item.code||index+1)}</span><span class="recycle-state">${esc(item.status)}</span></div>
      <h3>${esc(item.productName||item.title)}</h3>
      ${item.matchedReferences?.length?`<div class="recycle-reference-matches"><b>WMKAT</b>${item.matchedReferences.map(match=>`<span>${esc(match.reference)}${match.group?` · ${esc(match.group)}`:''}</span>`).join('')}</div>`:''}
      ${item.oeNumbers?`<div class="recycle-oe"><b>OE</b><span>${esc(item.oeNumbers)}</span></div>`:''}
      <div class="recycle-result-grid">
        ${item.vehicle?`<div><small>${currentLanguage==='de'?'Fahrzeug':currentLanguage==='en'?'Vehicle':'Araç'}</small><strong>${esc(item.vehicle)}</strong></div>`:''}
        ${item.motorCode?`<div><small>Motorcode</small><strong>${esc(item.motorCode)}</strong></div>`:''}
        ${item.gearboxCode?`<div><small>Getriebecode</small><strong>${esc(item.gearboxCode)}</strong></div>`:''}
        ${item.storage?`<div><small>${currentLanguage==='de'?'Lager':currentLanguage==='en'?'Storage':'Depo'}</small><strong>${esc(item.storage)}</strong></div>`:''}
      </div>
    </div>
    <div class="recycle-result-side">
      ${item.netPrice?`<small>Netto</small>${priceRevealButton(item.netPrice,'recycle-net-price')}`:''}
      ${item.price?priceRevealButton(item.price,'recycle-price'):''}
      <a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${currentLanguage==='de'?'Produkt öffnen':currentLanguage==='en'?'Open product':'Ürünü aç'} ↗</a>
    </div>
  </article>`).join('');
  container.classList.remove('hidden');
  recycleInlineQuery.textContent=currentResultQuery();
  recycleInlineResults.hidden=false;
  hydrateRecycleImages(container);
  syncToggleAllPricesButton();
}

function hydrateRecycleImages(container){
  const buttons=[...container.querySelectorAll('[data-recycle-image-part]')];
  if(!buttons.length)return;
  const load=async button=>{
    if(button.dataset.imageRequested)return;
    button.dataset.imageRequested='1';
    try{
      const response=await fetch(`/api/recycle/parts/${encodeURIComponent(button.dataset.recycleImagePart)}/images`);
      const data=await response.json();
      if(!response.ok)throw new Error(data.error||'Recycle image error');
      if(!data.images?.length)throw new Error('No image');
      const image=button.querySelector('img');
      let usedFullImage=false;
      image.onload=()=>{
        image.hidden=false;
        button.classList.remove('is-loading');
        button.classList.add('has-image');
        button.querySelector('small').textContent=`${data.count} ${t('images_count')}`;
      };
      image.onerror=()=>{
        if(!usedFullImage&&data.images[0]){
          usedFullImage=true;
          image.src=data.images[0];
          return;
        }
        image.hidden=true;
        button.classList.remove('is-loading','has-image');
        button.classList.add('no-recycle-image');
        button.querySelector('small').textContent=t('no_image');
      };
      image.src=data.thumbnail||data.images[0];
      button.addEventListener('click',()=>{
        if(button.classList.contains('has-image'))window.openExternalGallery?.(button.dataset.recycleImageTitle,data.images);
      });
    }catch(_){
      button.classList.remove('is-loading');
      button.classList.add('no-recycle-image');
      button.querySelector('small').textContent=t('no_image');
    }
  };
  // Always show the first available Recycle photo immediately. Remaining
  // thumbnails stay lazy-loaded to keep searches responsive.
  load(buttons[0]);
  const remaining=buttons.slice(1);
  if(!remaining.length)return;
  if(!('IntersectionObserver' in window)){remaining.forEach(load);return;}
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
    if(!entry.isIntersecting)return;
    observer.unobserve(entry.target);
    load(entry.target);
  }),{rootMargin:'240px'});
  remaining.forEach(button=>observer.observe(button));
}

function recycleCandidatesForRow(row){
  const output=[];
  const add=value=>{
    const raw=String(value||'').trim();
    if(!raw||raw==='-'||raw.length<4||raw.length>80)return;
    const compact=raw.replace(/[^A-Za-z0-9]/g,'').toUpperCase();
    if(compact.length<4||compact.length>40)return;
    if(!output.some(item=>item.replace(/[^A-Za-z0-9]/g,'').toUpperCase()===compact))output.push(raw);
  };
  add(row.Artikelnummer);
  add(row.ArtikelNr);
  return output.slice(0,5);
}

function renderInlineRecycleMatch(index,match){
  const slot=document.querySelector(`[data-recycle-index="${index}"]`);
  if(!slot)return;
  const products=Array.isArray(match.results)?match.results.filter(item=>item&&item.url):[];
  if(!products.length)return;
  slot.innerHTML=`<div class="recycle-inline-list">${products.map((item,productIndex)=>{
    const label=item.code||item.matchedReference||`Recycle ${productIndex+1}`;
    return `<div class="recycle-inline-match"><b>up2date</b><a href="${esc(item.url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a></div>`;
  }).join('')}${match.count>products.length?`<small class="recycle-inline-more">+${match.count-products.length} daha</small>`:''}</div>`;
}

async function enrichFoundResultsWithRecycle(partNumber,data){
  const directToken=++recycleDirectLookupToken;
  const query=normalizeRecyclePartSearchValue(partNumber);
  recycleDirectLookupActive=Boolean(normalizePartSearchValue(query)&&shouldRunExternalPartSearch());
  try{
    if(recycleDirectLookupActive){
      setWmkatStatus(currentLanguage==='de'?'Lokale Treffer gefunden - Recycle wird gesucht...':currentLanguage==='en'?'Local result(s) found - searching Recycle...':'ESS sonucu bulundu - Recycle aranıyor...');
      const response=await fetch('/api/recycle/search',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({partNumber:query})
      });
      const result=await response.json();
      if(directToken!==recycleDirectLookupToken)return;
      if(!response.ok)throw new Error(result.error||'Recycle search error');
      if(result.results?.length){
        renderRecycleResults(result,{keepTable:true});
        setWmkatStatus(currentLanguage==='de'?`Lokale Treffer + ${result.count} Recycle-Produkt(e)`:currentLanguage==='en'?`Local result(s) + ${result.count} Recycle product(s)`:`ESS sonucu + ${result.count} Recycle ürünü`,'success');
      }else{
        setWmkatStatus(currentLanguage==='de'?'Lokale Treffer gefunden - kein Produkt in Recycle':currentLanguage==='en'?'Local result(s) found - no product in Recycle':'ESS sonucu bulundu - Recycle içinde ürün bulunamadı','empty');
      }
    }
  }catch(error){
    if(directToken!==recycleDirectLookupToken)return;
    console.error('Recycle direct result enrichment:',error);
    setWmkatStatus(currentLanguage==='de'?'Lokale Treffer gefunden - Recycle nicht verfügbar':currentLanguage==='en'?'Local result(s) found - Recycle unavailable':'ESS sonucu bulundu - Recycle kullanılamıyor','empty');
  }finally{
    if(directToken===recycleDirectLookupToken)recycleDirectLookupActive=false;
  }
  if(directToken===recycleDirectLookupToken)enrichLocalResultsWithRecycle(data);
}

async function enrichLocalResultsWithRecycle(data){
  const token=++recycleLocalLookupToken;
  const items=(data.rows||[]).map((row,index)=>({
    index,
    references:recycleCandidatesForRow(row)
  })).filter(item=>item.references.length);
  if(!items.length)return;
  recycleLocalLookupActive=true;
  document.querySelectorAll('.result-recycle-slot').forEach(slot=>{slot.innerHTML='<span class="recycle-inline-loading">Recycle...</span>';});
  try{
    const response=await fetch('/api/recycle/search-local-items',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({items})
    });
    const result=await response.json();
    if(token!==recycleLocalLookupToken)return;
    document.querySelectorAll('.result-recycle-slot').forEach(slot=>{slot.innerHTML='';});
    if(!response.ok)throw new Error(result.error||'Recycle local search error');
    for(const match of result.matches||[])renderInlineRecycleMatch(match.index,match);
    if(result.matchedRows){
      setWmkatStatus(currentLanguage==='de'?`${result.matchedRows} lokale Treffer mit Recycle-Link`:currentLanguage==='en'?`${result.matchedRows} local result(s) with Recycle link`:`${result.matchedRows} yerel sonuca Recycle linki eklendi`,'success');
    }
  }catch(error){
    if(token!==recycleLocalLookupToken)return;
    document.querySelectorAll('.result-recycle-slot').forEach(slot=>{slot.innerHTML='';});
    console.error('Recycle local result enrichment:',error);
  }finally{
    if(token===recycleLocalLookupToken)recycleLocalLookupActive=false;
  }
}

async function runWmkatAlternatives(partNumber,originalData){
  setWmkatStatus(currentLanguage==='de'?'Teil nicht gefunden · alternative Quellen werden durchsucht…':currentLanguage==='en'?'Part not found · searching alternative sources…':'Parça bulunamadı · alternatif kaynaklarda aranıyor…');
  showWmkatOverlay(partNumber);
  wmkatAbortController=new AbortController();
  try{
    const cacheKey=`${currentUnit()}\u0000${normalizeRecyclePartSearchValue(partNumber)}`;
    let result=wmkatAlternativesCache.get(cacheKey);
    if(!result){
      let recycle=null;
      try{
        const recycleResponse=await fetch('/api/recycle/search',{
          method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({partNumber}),signal:wmkatAbortController.signal
        });
        recycle=await recycleResponse.json();
        if(!recycleResponse.ok)throw new Error(recycle.error||'Recycle error');
      }catch(error){
        if(error.name==='AbortError')throw error;
        recycle=null;
        finishRecycleStage(currentLanguage==='de'?'Recycle nicht verfügbar · WMKAT wird fortgesetzt':currentLanguage==='en'?'Recycle unavailable · continuing with WMKAT':'Recycle kullanılamıyor · WMKAT ile devam ediliyor',true);
      }
      if(recycle?.results?.length){
        renderRecycleResults(recycle);
        setWmkatStatus(currentLanguage==='de'?`${recycle.count} Produkt(e) in Recycle gefunden`:currentLanguage==='en'?`${recycle.count} product(s) found in Recycle`:`Recycle içinde ${recycle.count} ürün bulundu`,'success');
        return;
      }
      if(recycle){
        finishRecycleStage(currentLanguage==='de'?'Kein Produkt in Recycle gefunden':currentLanguage==='en'?'No product found in Recycle':'Recycle içinde ürün bulunamadı');
      }
      const response=await fetch('/api/wmkat/search',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body:JSON.stringify({partNumber}),
        signal:wmkatAbortController.signal
      });
      const wmkat=await response.json();
      if(!response.ok)throw new Error(wmkat.error||'WMKAT error');
      showLocalStockStage(wmkat.count);
      if(!wmkat.references.length){
        result={recycleReferenceResults:{results:[],count:0,searchedReferences:0},euLocalResults:{rows:[],searchedReferences:0},wmkatReferenceCount:0};
      }else{
        const localResponse=await fetch('/api/recycle/search-references',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({references:wmkat.references}),
          signal:wmkatAbortController.signal
        });
        const local=await localResponse.json();
        if(!localResponse.ok)throw new Error(local.error||'Recycle reference search error');
        let euLocal={rows:[],searchedReferences:0};
        if(isEuUnit()){
          showEuLocalStage(local.count);
          const euResponse=await fetch('/api/wmkat/local-stock',{
            method:'POST',
            headers:{'Content-Type':'application/json'},
            body:JSON.stringify({references:wmkat.references,unit:currentUnit()}),
            signal:wmkatAbortController.signal
          });
          euLocal=await euResponse.json();
          if(!euResponse.ok)throw new Error(euLocal.error||'EU local stock error');
        }
        result={recycleReferenceResults:local,euLocalResults:euLocal,wmkatReferenceCount:wmkat.count};
      }
      wmkatAlternativesCache.set(cacheKey,result);
    }
    const referenceResults=result.recycleReferenceResults;
    const euRows=result.euLocalResults?.rows||[];
    const hasRecycle=Boolean(referenceResults?.results?.length);
    const hasEuLocal=euRows.length>0;
    if(!hasRecycle&&!hasEuLocal){
      const message=currentLanguage==='de'
        ?`${referenceResults?.searchedReferences||0} Referenzen geprüft · kein Produkt gefunden${isEuUnit()?' (Recycle + EU Teile)':''}`
        :currentLanguage==='en'
          ?`${referenceResults?.searchedReferences||0} references checked · no product found${isEuUnit()?' (Recycle + EU Parts)':''}`
          :`${referenceResults?.searchedReferences||0} referans kontrol edildi · ürün bulunamadı${isEuUnit()?' (Recycle + EU Teile)':''}`;
      setWmkatStatus(message,'empty');
      empty.classList.add('compact-no-results');
      return;
    }
    if(hasEuLocal){
      render({rows:euRows,count:euRows.length,shown:euRows.length,page:1,pages:1,page_size:euRows.length,sort:'stock',dir:'desc',wmkatGrouped:true});
    }
    if(hasRecycle)renderRecycleResults(referenceResults,{keepTable:hasEuLocal});
    count.textContent=(referenceResults?.count||0)+euRows.length;
    const message=currentLanguage==='de'
      ?`${result.wmkatReferenceCount} WMKAT-Referenzen · ${referenceResults.count} Recycle-Produkte${isEuUnit()?` · ${euRows.length} lokale EU-Teile`:''}`
      :currentLanguage==='en'
        ?`${result.wmkatReferenceCount} WMKAT references · ${referenceResults.count} Recycle products${isEuUnit()?` · ${euRows.length} local EU Parts`:''}`
        :`${result.wmkatReferenceCount} WMKAT referansı · ${referenceResults.count} Recycle ürünü${isEuUnit()?` · ${euRows.length} yerel EU Teile ürünü`:''}`;
    setWmkatStatus(message,'success');
  }catch(error){
    if(error.name==='AbortError'||wmkatCancelled)return;
    setWmkatStatus(currentLanguage==='de'?'WMKAT-Suche fehlgeschlagen':currentLanguage==='en'?'WMKAT search failed':'WMKAT araması başarısız','error');
    console.error('WMKAT alternative search:',error);
    if(!originalData.rows.length){
      empty.classList.add('compact-no-results');
      showToast(`WMKAT: ${error.message}`);
    }
  }finally{
    wmkatAbortController=null;
    if(!wmkatCancelled)hideWmkatOverlay();
  }
}

function showDetail(row){
  document.querySelector('#detailTitle').textContent=`${row.Bezeichnung||t('Bezeichnung')} · ${row.Artikelnummer||''}`;
  
  const partKeys=['Fahrzeug-ID','Artikelnummer','ArtikelNr','Bezeichnung','Zusatztext','Ebayartikelnummer','Lagerort','Lagerplatz','Lagermenge','Mindestmenge','MaxMenge','VK_Brutto','Verkaufspreis','Einkaufspreis','Zustand','Bemerkung','Pfand','Reserviert','Letzte_Buchung','EbayMarkiertVonAbteilung','FahrzeugNummer'];
  const vehicleKeys=['Marke','Typ','Baujahr','Erstzulassung','Motorcode','Getriebecode','Getriebeart','Hubraum','Kilometer','Kraftstoff','Farbe','KBA_Nummer','Zylinder','Euro_Norm'];
  
  const item=key=>{
    let value=row[key];
    if(['VK_Brutto','Verkaufspreis','Einkaufspreis'].includes(key))value=money(value);
    if(['Erstzulassung','Letzte_Buchung'].includes(key))value=formatDate(value);
    
    let display;
    if (key === 'Marke') {
      display = `<span class="detail-brand-stacked">${brandLogo(row.Marke)}<span class="detail-brand-copy"><b>${text(value)}</b><span>${text(row.Modellcode)}</span></span></span>`;
    } else if (key === 'Lagerort') {
      display = locationBadge(value);
    } else if (key === 'FahrzeugNummer' && value) {
      display = `<button class="vehicle-badge detail-vehicle-number" data-vehicle="${esc(value)}" title="${t('all_parts_of_vehicle')}">${esc(value)}</button>`;
    } else if (key === 'Ebayartikelnummer' && value) {
      display = ebayLink(value);
    } else if (key === 'KBA_Nummer') {
      display = formatKba(value);
    } else {
      display = text(value);
    }

    const classes = [
      'detail-item',
      key==='Marke'?'detail-brand-item detail-brand-feature':'',
      key==='Lagerort'?'detail-storage-item':'',
      ['Motorcode','Getriebecode','Getriebeart'].includes(key)?'detail-plain-item':''
    ].filter(Boolean).join(' ');
    return `<div class="${classes}"><small>${t(key)}</small><strong>${display}</strong></div>`;
  };
  
  const section=(title,icon,keys,collapsible=false)=>`<section class="detail-section ${collapsible?'collapsible-detail-section':''}">${collapsible?`<button type="button" class="part-vehicle-toggle" aria-expanded="false"><span class="detail-toggle-icon">${icon}</span><b>${title}</b><span class="detail-toggle-plus">+</span></button>`:`<h3><span>${icon}</span>${title}</h3>`}<div class="detail-section-grid ${collapsible?'part-vehicle-content':''}" ${collapsible?'hidden':''}>${keys.map(item).join('')}</div></section>`;
  
  document.querySelector('#detailContent').innerHTML=
    `<div class="detail-label-action"><button type="button" class="part-label-button detail-label-button"><span class="action-icon" aria-hidden="true">▣</span><span>${t('print_label_pdf')}</span></button></div>` +
    section(t('part_detail'), '⚙', partKeys) + 
    section(t('col_vehicle'), '◆', vehicleKeys, true);
  document.querySelector('#detailContent .detail-label-button').addEventListener('click', () => window.printPartLabel?.(row));
    
  dialog.showModal();
}

async function renderGallery(direction=0){
  const item=galleryRows[galleryIndex],image=document.querySelector('#galleryImage');
  const nextSrc=item.externalUrl || `/api/parts/${galleryPartId}/images/${item.Picture_ID}?unit=${encodeURIComponent(currentUnit())}`;
  const token=++galleryTransitionToken;
  resetGalleryZoom();
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  image.getAnimations().forEach(animation=>animation.cancel());

  if(direction && image.src && !reducedMotion){
    try {
      const exitAnimation=image.animate([
        {opacity:1},
        {opacity:0}
      ],{duration:190,easing:'cubic-bezier(.4,0,1,1)'});
      await exitAnimation.finished;
      exitAnimation.cancel();
    } catch(_) {}
    if(token!==galleryTransitionToken)return;
  }

  image.getAnimations().forEach(animation=>animation.cancel());
  image.style.opacity='1';

  if(!image.src.endsWith(nextSrc)){
    image.src=nextSrc;
    await new Promise(resolve=>{
      if(image.complete)resolve();
      else { image.onload=resolve; image.onerror=resolve; }
    });
    if(token!==galleryTransitionToken)return;
  }

  if(direction && !reducedMotion){
    const entrance=image.animate([
      {opacity:0},
      {opacity:1}
    ],{duration:390,easing:'cubic-bezier(.16,1,.3,1)'});
    entrance.finished.then(()=>{if(token===galleryTransitionToken){entrance.cancel();image.style.opacity='1';applyGalleryZoom();}}).catch(()=>{});
  } else {
    image.style.opacity='1';
  }
  applyGalleryZoom();

  document.querySelector('#galleryCounter').textContent=`${galleryIndex+1} / ${galleryRows.length}`;
  document.querySelectorAll('.gallery-thumb').forEach((el,i)=>{
    el.classList.toggle('active',i===galleryIndex);
    if(i===galleryIndex) el.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});
  });
  document.querySelector('#galleryPrev').disabled=galleryRows.length<2;
  document.querySelector('#galleryNext').disabled=galleryRows.length<2;

  if(galleryRows.length>1){
    [-1,1].forEach(step=>{
      const nearby=galleryRows[(galleryIndex+step+galleryRows.length)%galleryRows.length];
      const preload=new Image();
      preload.src=nearby.externalUrl || `/api/parts/${galleryPartId}/images/${nearby.Picture_ID}?unit=${encodeURIComponent(currentUnit())}`;
    });
  }
}

function applyGalleryZoom() {
  const image = document.querySelector('#galleryImage');
  image.style.transform = `translate(${galleryPanX}px, ${galleryPanY}px) scale(${galleryZoom})`;
  document.querySelector('#galleryZoomReset').textContent = `${Math.round(galleryZoom * 100)}%`;
  document.querySelector('#galleryViewport').classList.toggle('zoomed', galleryZoom > 1);
}

function setGalleryZoom(nextZoom) {
  galleryZoom = Math.min(5, Math.max(1, Math.round(nextZoom * 10) / 10));
  if (galleryZoom === 1) { galleryPanX = 0; galleryPanY = 0; }
  applyGalleryZoom();
}

function setGalleryZoomAt(nextZoom, clientX, clientY) {
  const viewport = document.querySelector('#galleryViewport');
  const rect = viewport.getBoundingClientRect();
  const previousZoom = galleryZoom;
  const boundedZoom = Math.min(5, Math.max(1, Math.round(nextZoom * 10) / 10));

  if (boundedZoom > 1 && previousZoom > 0) {
    const pointX = clientX - rect.left - rect.width / 2;
    const pointY = clientY - rect.top - rect.height / 2;
    const ratio = boundedZoom / previousZoom;
    galleryPanX = pointX - (pointX - galleryPanX) * ratio;
    galleryPanY = pointY - (pointY - galleryPanY) * ratio;
  }

  galleryZoom = boundedZoom;
  if (galleryZoom === 1) { galleryPanX = 0; galleryPanY = 0; }
  applyGalleryZoom();
}

function resetGalleryZoom() {
  galleryZoom = 1; galleryPanX = 0; galleryPanY = 0; galleryPanStart = null;
  if (document.querySelector('#galleryZoomReset')) applyGalleryZoom();
}

window.openExternalGallery = (title, images) => {
  galleryRows = images.map(externalUrl => ({ externalUrl }));
  galleryIndex = 0;
  galleryPartId = 0;
  document.querySelector('#galleryTitle').textContent = title;
  document.querySelector('#galleryThumbs').innerHTML = galleryRows.map((item, i) => `<button class="gallery-thumb ${i === 0 ? 'active' : ''}" data-gallery-index="${i}"><img src="${esc(item.externalUrl)}" alt="Görsel ${i + 1}" loading="lazy"></button>`).join('');
  renderGallery();
  if (!gallery.open) gallery.showModal();
};

async function openGallery(row){
  try{
    galleryPartId=row['Fahrzeug-ID'];
    const unit=encodeURIComponent(currentUnit());
    galleryRows=await fetch(`/api/parts/${galleryPartId}/images?unit=${unit}`).then(r=>{
      if(!r.ok) throw new Error(t('toast_images_error'));
      return r.json();
    });
    galleryIndex=0;
    if(!galleryRows.length) return;
    document.querySelector('#galleryTitle').textContent=`${row.Bezeichnung||t('Bezeichnung')} · ${row.Artikelnummer||''}`;
    document.querySelector('#galleryThumbs').innerHTML=galleryRows.map((item,i)=>`<button class="gallery-thumb ${i===0?'active':''}" data-gallery-index="${i}"><img src="/api/parts/${galleryPartId}/images/${item.Picture_ID}?unit=${unit}" alt="Görsel ${i+1}" loading="lazy"></button>`).join('');
    renderGallery();
    gallery.showModal();
  } catch(error){
    showToast(error.message);
  }
}

// Vehicle search trigger logic
function searchVehicleParts(vehicleNum) {
  form.reset();
  // Keep the selected working unit; vehicle parts must remain scoped to it.
  document.querySelector('#hiddenVehicleInput').value = vehicleNum; // Exact FahrzeugNummer match
  resultPage = 1;
  runSearch();
  window.scrollTo({top: resultsCard.offsetTop-82, behavior: 'smooth'});
}

// Event Delegation for Vehicle Badges (Results + Dialog Detail)
document.addEventListener('click', event => {
  const badge = event.target.closest('.vehicle-badge');
  if (badge) {
    const vehicleNum = badge.dataset.vehicle;
    if (dialog.open) dialog.close();
    searchVehicleParts(vehicleNum);
  }
});

resultsCard.addEventListener('click',e=>{
  const priceButton=e.target.closest('.price-reveal');
  if(priceButton){
    e.preventDefault();
    e.stopPropagation();
    setPriceHidden(priceButton, priceButton.dataset.priceHidden === 'false');
    syncToggleAllPricesButton();
    return;
  }
  const imageButton=e.target.closest('.image-button');
  if(imageButton) return openGallery(currentRows[Number(imageButton.dataset.gallery)]);
  const labelButton=e.target.closest('[data-label-index]');
  if(labelButton) return window.printPartLabel?.(currentRows[Number(labelButton.dataset.labelIndex)]);
  const b=e.target.closest('.detail-button');
  if(b) return showDetail(currentRows[Number(b.dataset.index)]);
});

toggleAllPricesButton?.addEventListener('click', () => {
  const buttons = visiblePriceButtons();
  const showAll = toggleAllPricesButton.dataset.pricesVisible !== 'true';
  buttons.forEach(button => setPriceHidden(button, !showAll));
  syncToggleAllPricesButton();
});

document.querySelector('#closeDialog').onclick=()=>dialog.close(); 
dialog.addEventListener('click',e=>{
  if(e.target===dialog) dialog.close();
  const toggle=e.target.closest('.part-vehicle-toggle');
  if(toggle){
    const content=toggle.closest('.collapsible-detail-section').querySelector('.part-vehicle-content');
    const opening=content.hidden;
    content.hidden=!opening;
    toggle.setAttribute('aria-expanded',String(opening));
  }
});

document.querySelector('#closeGallery').onclick=()=>gallery.close();
document.querySelector('#galleryZoomIn').onclick=()=>setGalleryZoom(galleryZoom + .25);
document.querySelector('#galleryZoomOut').onclick=()=>setGalleryZoom(galleryZoom - .25);
document.querySelector('#galleryZoomReset').onclick=resetGalleryZoom;
const galleryViewport=document.querySelector('#galleryViewport');
galleryViewport.addEventListener('wheel',event=>{event.preventDefault();setGalleryZoom(galleryZoom+(event.deltaY<0?.25:-.25));},{passive:false});
galleryViewport.addEventListener('pointerdown',event=>{galleryPointerMoved=false;if(galleryZoom<=1)return;event.preventDefault();galleryPanStart={x:event.clientX,y:event.clientY,panX:galleryPanX,panY:galleryPanY,id:event.pointerId};galleryViewport.setPointerCapture?.(event.pointerId)});
galleryViewport.addEventListener('pointermove',event=>{if(!galleryPanStart||galleryPanStart.id!==event.pointerId)return;const dx=event.clientX-galleryPanStart.x,dy=event.clientY-galleryPanStart.y;if(Math.abs(dx)>3||Math.abs(dy)>3)galleryPointerMoved=true;galleryPanX=galleryPanStart.panX+dx;galleryPanY=galleryPanStart.panY+dy;applyGalleryZoom()});
galleryViewport.addEventListener('pointerup',()=>{galleryPanStart=null});
galleryViewport.addEventListener('pointercancel',()=>{galleryPanStart=null});
galleryViewport.addEventListener('click',event=>{
  if(galleryPointerMoved){galleryPointerMoved=false;return;}
  setGalleryZoomAt(galleryZoom+(event.shiftKey?-.5:.5),event.clientX,event.clientY);
});
gallery.addEventListener('click',e=>{
  if(e.target===gallery) gallery.close();
  const thumb=e.target.closest('.gallery-thumb');
  if(thumb){
    const nextIndex=Number(thumb.dataset.galleryIndex);
    const direction=nextIndex===galleryIndex?0:(nextIndex>galleryIndex?1:-1);
    galleryIndex=nextIndex;
    renderGallery(direction);
  }
});

document.querySelector('#galleryPrev').onclick=()=>{
  galleryIndex=(galleryIndex-1+galleryRows.length)%galleryRows.length;
  renderGallery(-1);
};

document.querySelector('#galleryNext').onclick=()=>{
  galleryIndex=(galleryIndex+1)%galleryRows.length;
  renderGallery(1);
};

document.querySelector('.gallery-stage').addEventListener('touchstart',event=>{
  galleryTouchX=event.changedTouches[0].clientX;
},{passive:true});
document.querySelector('.gallery-stage').addEventListener('touchend',event=>{
  if(galleryTouchX===null)return;
  const distance=event.changedTouches[0].clientX-galleryTouchX;
  galleryTouchX=null;
  if(Math.abs(distance)<45||galleryRows.length<2)return;
  document.querySelector(distance<0?'#galleryNext':'#galleryPrev').click();
},{passive:true});

document.addEventListener('keydown',e=>{
  if(!gallery.open) return;
  if(e.key==='ArrowLeft') document.querySelector('#galleryPrev').click();
  if(e.key==='ArrowRight') document.querySelector('#galleryNext').click();
});

// Reset Form Handler
document.querySelector('#resetButton').onclick=()=>{
  if(recycleLocalLookupActive||recycleDirectLookupActive)fetch('/api/recycle/cancel',{method:'POST'}).catch(()=>{});
  recycleLocalLookupToken++;
  recycleDirectLookupToken++;
  recycleLocalLookupActive=false;
  recycleDirectLookupActive=false;
  form.reset();
  document.querySelector('#hiddenVehicleInput').value = '';
  count.textContent='—';
  meta.textContent=t('enter_search_criteria');
  body.innerHTML='';
  document.querySelector('.search-layout').classList.remove('has-results');
  resultsCard.classList.add('hidden');
  tableWrap.classList.add('hidden');
  essInlineResults.hidden=true;
  empty.classList.remove('hidden');
  empty.classList.remove('compact-no-results');
  syncToggleAllPricesButton();
  setAdvancedOpen(false);
  empty.innerHTML=`<div>⌕</div><h3>${t('ready_to_search')}</h3><p>${t('fill_filters_press_search')}</p>`;
  setWmkatStatus('');
  clearRecycleResults();
  form.elements.part_number.focus();
  if (!restoringHistory) saveSearchState(true);
};

document.querySelector('#quickResetButton').addEventListener('click',()=>document.querySelector('#resetButton').click());

document.querySelector('#pagination').addEventListener('click',event=>{
  const button=event.target.closest('button[data-page]');
  if(!button||button.disabled) return;
  resultPage=Number(button.dataset.page);
  runSearch();
  window.scrollTo({top:resultsCard.offsetTop-82,behavior:'smooth'});
});

document.querySelector('thead').addEventListener('click',event=>{
  const th=event.target.closest('th.sortable');
  if(!th) return;
  if(resultSort===th.dataset.sort) resultDirection=resultDirection==='asc'?'desc':'asc';
  else {
    resultSort=th.dataset.sort;
    resultDirection='asc';
  }
  resultPage=1;
  runSearch();
});

document.addEventListener('keydown',e=>{
  if(e.key==='F2'){
    e.preventDefault();
    document.querySelector('#resetButton').click();
  }
}); 

form.addEventListener('submit',runSearch);

function showToast(message){
  const toast=document.querySelector('#toast');
  toast.textContent=message;
  toast.classList.add('show');
  setTimeout(()=>toast.classList.remove('show'),4000);
}

function setupAutocomplete(field){
  const input=form.elements[field]; 
  if(!input) return;
  input.removeAttribute('list');
  const wrap=document.createElement('div');
  wrap.className='autocomplete';
  input.parentNode.insertBefore(wrap,input);
  wrap.appendChild(input);
  const menu=document.createElement('div');
  menu.className='autocomplete-menu';
  wrap.appendChild(menu);
  let timer,controller,active=-1,values=[];
  
  const close=()=>{
    menu.classList.remove('open');
    menu.innerHTML='';
    active=-1;
  };
  
  const choose=index=>{
    if(index<0||!values[index]) return;
    input.value=values[index];
    close();
    input.dispatchEvent(new Event('change',{bubbles:true}));
  };
  
  const draw=()=>{
    menu.innerHTML=values.length?values.map((value,i)=>`<button type="button" class="autocomplete-option ${i===active?'active':''}" data-index="${i}">${field==='brand'?brandLogo(value):''}<span>${esc(value)}</span></button>`).join(''):`<div class="autocomplete-empty">${t('no_results')}</div>`;
    menu.classList.add('open');
  };
  
  const load=()=>{
    clearTimeout(timer);
    timer=setTimeout(async()=>{
      controller?.abort();
      controller=new AbortController();
      try{
        const q=encodeURIComponent(input.value.trim());
        const response=await fetch(`/api/suggestions?field=${field}&q=${q}&unit=${encodeURIComponent(currentUnit())}`,{signal:controller.signal});
        if(!response.ok) throw new Error();
        values=await response.json();
        active=-1;
        draw();
      } catch(error){
        if(error.name!=='AbortError') close();
      }
    },180);
  };
  
  input.addEventListener('input',load);
  input.addEventListener('focus',load);
  
  input.addEventListener('keydown',event=>{
    if(!menu.classList.contains('open')) return;
    if(event.key==='ArrowDown'){
      event.preventDefault();
      active=Math.min(active+1,values.length-1);
      draw();
    } else if(event.key==='ArrowUp'){
      event.preventDefault();
      active=Math.max(active-1,0);
      draw();
    } else if(event.key==='Enter'&&active>=0){
      event.preventDefault();
      choose(active);
    } else if(event.key==='Escape') close();
  });
  
  menu.addEventListener('mousedown',event=>{
    event.preventDefault();
    const option=event.target.closest('.autocomplete-option');
    if(option) choose(Number(option.dataset.index));
  });
  
  document.addEventListener('mousedown',event=>{
    if(!wrap.contains(event.target)) close();
  });
}

async function loadUnits(){
  try {
    const units=await fetch('/api/units').then(r=>r.json());
    unitSelect.innerHTML=`<option value="">${t('working_unit')}</option>`+units.map(unit=>`<option value="${esc(unit.id)}">${esc(unit.id)} · ${new Intl.NumberFormat(currentLanguage==='en'?'en-US':'tr-TR').format(unit.count)}</option>`).join('');
    await health();
  } catch(error){
    unitSelect.innerHTML=`<option value="">${t('working_unit')}</option>`;
    health();
  }
}

unitSelect.addEventListener('change',()=>{
  document.querySelector('#resetButton').click();
  health();
});

async function initializeSearchState() {
  await loadUnits();
  let saved = history.state;
  if (!saved) {
    try { saved = JSON.parse(sessionStorage.getItem(searchStateKey)); } catch (_) { saved = null; }
  }
  if (saved && applySearchState(saved)) {
    restoringHistory = true;
    await runSearch(null, false);
    restoringHistory = false;
  } else {
    saveSearchState(false);
  }
}

window.addEventListener('popstate', async event => {
  const historyView = event.state?.view || new URLSearchParams(location.search).get('view') || 'parts';
  showAppView(historyView, false);
  restoringHistory = true;
  if (event.state) {
    const shouldSearch = applySearchState(event.state);
    if (shouldSearch) await runSearch(null, false);
    else document.querySelector('#resetButton').click();
  } else {
    form.reset();
    resultsCard.classList.add('hidden');
    document.querySelector('.search-layout').classList.remove('has-results');
  }
  restoringHistory = false;
});

form.addEventListener('input', () => sessionStorage.setItem(searchStateKey, JSON.stringify(getSearchState())));
initializeSearchState();
['designation','brand','model','type','engine','location'].forEach(setupAutocomplete);

// Brand click always returns to the part search screen.
document.querySelector('#brandHome').onclick = () => {
  showAppView('parts');
  document.querySelector('#resetButton').click();
};

// Salt okunur araç arama ekranı
const partsView = document.querySelector('.search-layout');
const vehiclesView = document.querySelector('#vehiclesView');
const labelsView = document.querySelector('#labelsView');
const partsMenuBtn = document.querySelector('#partsMenuBtn');
const labelsMenuBtn = document.querySelector('#labelsMenuBtn');
const vehiclesMenuBtn = document.querySelector('#vehiclesMenuBtn');
const kbaMenuBtn = document.querySelector('#kbaMenuBtn');
const vehicleForm = document.querySelector('#vehicleSearchForm');
const vehicleBody = document.querySelector('#vehicleResultsBody');
const vehicleTableWrap = document.querySelector('#vehicleTableWrap');
const vehicleEmpty = document.querySelector('#vehicleEmpty');
const vehicleDialog = document.querySelector('#vehicleDetailDialog');
let vehicleRows = [];
let vehiclePage = 1;

function setupVehicleAutocomplete(field) {
  const input = vehicleForm.elements[field];
  if (!input) return;
  const wrap = document.createElement('div');
  wrap.className = 'autocomplete vehicle-autocomplete';
  input.parentNode.insertBefore(wrap, input);
  wrap.appendChild(input);
  const menu = document.createElement('div');
  menu.className = 'autocomplete-menu';
  wrap.appendChild(menu);
  let timer, controller, active = -1, values = [];

  const close = () => { menu.classList.remove('open'); menu.innerHTML = ''; active = -1; };
  const choose = index => {
    if (index < 0 || !values[index]) return;
    input.value = values[index];
    close();
    input.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const draw = () => {
    menu.innerHTML = values.length
      ? values.map((value, index) => `<button type="button" class="autocomplete-option ${index === active ? 'active' : ''}" data-index="${index}">${field === 'brand' ? brandLogo(value) : ''}<span>${esc(value)}</span></button>`).join('')
      : `<div class="autocomplete-empty">${t('no_results')}</div>`;
    menu.classList.add('open');
  };
  const load = () => {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      controller?.abort();
      controller = new AbortController();
      const params = new URLSearchParams(new FormData(vehicleForm));
      params.delete(field);
      params.set('field', field);
      params.set('q', input.value.trim());
      try {
        const response = await fetch(`/api/vehicle-suggestions?${params}`, { signal: controller.signal });
        if (!response.ok) throw new Error();
        values = await response.json();
        active = -1;
        draw();
      } catch (error) {
        if (error.name !== 'AbortError') close();
      }
    }, 180);
  };
  input.addEventListener('input', load);
  input.addEventListener('focus', load);
  input.addEventListener('keydown', event => {
    if (!menu.classList.contains('open')) return;
    if (event.key === 'ArrowDown') { event.preventDefault(); active = Math.min(active + 1, values.length - 1); draw(); }
    else if (event.key === 'ArrowUp') { event.preventDefault(); active = Math.max(active - 1, 0); draw(); }
    else if (event.key === 'Enter' && active >= 0) { event.preventDefault(); choose(active); }
    else if (event.key === 'Escape') close();
  });
  menu.addEventListener('mousedown', event => {
    event.preventDefault();
    const option = event.target.closest('.autocomplete-option');
    if (option) choose(Number(option.dataset.index));
  });
  document.addEventListener('mousedown', event => { if (!wrap.contains(event.target)) close(); });
}

function showAppView(view, updateUrl = true) {
  activeAppView = ['parts', 'vehicles', 'labels'].includes(view) ? view : 'parts';
  localStorage.setItem('baytemuer-active-view', activeAppView);
  const vehiclesActive = activeAppView === 'vehicles';
  const labelsActive = activeAppView === 'labels';
  const partsActive = !vehiclesActive && !labelsActive;
  partsView.classList.toggle('hidden', !partsActive);
  vehiclesView.classList.toggle('hidden', !vehiclesActive);
  labelsView.classList.toggle('hidden', !labelsActive);
  partsMenuBtn.classList.toggle('active', partsActive);
  vehiclesMenuBtn.classList.toggle('active', vehiclesActive);
  labelsMenuBtn.classList.toggle('active', labelsActive);
  if (vehiclesActive && !vehicleRows.length) runVehicleSearch();
  if (labelsActive) window.initLabelDesigner?.();
  if (updateUrl) {
    const query = new URLSearchParams(location.search);
    query.set('view', activeAppView);
    history.replaceState({ ...(history.state || {}), view: activeAppView }, '', `${location.pathname}?${query}`);
  }
}

partsMenuBtn.addEventListener('click', () => showAppView('parts'));
vehiclesMenuBtn.addEventListener('click', () => showAppView('vehicles'));
kbaMenuBtn.addEventListener('click', () => { window.location.href = '/kba'; });
labelsMenuBtn.addEventListener('click', () => {
  if (settingsDialog.open) settingsDialog.close();
  showAppView('labels');
});
showAppView(activeAppView, false);
document.querySelector('#footerYear').textContent = new Date().getFullYear();

function vehicleValue(value) {
  return value === null || value === undefined || value === '' ? '—' : esc(value);
}

function vehicleDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? vehicleValue(value) : new Intl.DateTimeFormat(currentLanguage === 'de' ? 'de-DE' : currentLanguage === 'en' ? 'en-GB' : 'tr-TR').format(date);
}

function vehicleKilometers(value) {
  if (value === null || value === undefined || value === '') return '—';
  const numeric = Number(String(value).replace(/[^0-9-]/g, ''));
  if (!Number.isFinite(numeric)) return vehicleValue(value);
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(numeric);
}

function formatKba(value) {
  if (value === null || value === undefined || value === '') return '—';
  const compact = String(value).replace(/\s+/g, '');
  return compact.length === 7 ? `${compact.slice(0, 4)} ${compact.slice(4)}` : compact;
}

function copyableKba(value) {
  const formatted = formatKba(value);
  if (formatted === '—') return formatted;
  return `<span class="vehicle-inline-copy"><strong class="vehicle-data-value">${formatted}</strong><button type="button" class="copy-button" data-copy="${formatted}" title="${t('copy_value')}" aria-label="${t('copy_value')}">⧉</button></span>`;
}

function vehicleStatus(row) {
  const labels = {
    tr: { 1: 'Yeni kabul', 2: 'Kaydedildi', 3: 'Satıldı', 4: 'Parçalanacak', 5: 'Hurdaya ayrıldı' },
    de: { 1: 'Neuannahme', 2: 'Gespeichert', 3: 'Verkauft', 4: 'Zum Schlachten', 5: 'Verschrottet' },
    en: { 1: 'New intake', 2: 'Saved', 3: 'Sold', 4: 'For dismantling', 5: 'Scrapped' }
  };
  return labels[currentLanguage]?.[Number(row.StatusCode)] || vehicleValue(row.Status);
}

function copyableVehicleValue(value, displayValue = value) {
  const raw = value === null || value === undefined ? '' : String(value);
  return `<div class="copy-value"><span>${vehicleValue(displayValue)}</span><button type="button" class="copy-button" data-copy="${esc(raw)}" title="${t('copy_value')}" aria-label="${t('copy_value')}">⧉</button></div>`;
}

async function copyVehicleText(value) {
  try {
    if (navigator.clipboard && window.isSecureContext) await navigator.clipboard.writeText(value);
    else {
      const textarea = document.createElement('textarea');
      textarea.value = value;
      textarea.style.position = 'fixed'; textarea.style.opacity = '0';
      document.body.appendChild(textarea); textarea.select();
      document.execCommand('copy'); textarea.remove();
    }
    showToast(t('copied'));
    return true;
  } catch (_) {
    showToast(t('copy_value'));
    return false;
  }
}

function renderVehiclePagination(data) {
  const nav = document.querySelector('#vehiclePagination');
  if (data.pages <= 1) { nav.classList.add('hidden'); nav.innerHTML = ''; return; }
  const start = Math.max(1, data.page - 2), end = Math.min(data.pages, data.page + 2);
  let html = `<button data-vehicle-page="${data.page - 1}" ${data.page === 1 ? 'disabled' : ''}>‹</button>`;
  for (let page = start; page <= end; page++) html += `<button data-vehicle-page="${page}" class="${page === data.page ? 'active' : ''}">${page}</button>`;
  html += `<button data-vehicle-page="${data.page + 1}" ${data.page === data.pages ? 'disabled' : ''}>›</button>`;
  nav.innerHTML = html;
  nav.classList.remove('hidden');
}

async function runVehicleSearch(event) {
  event?.preventDefault();
  if (event?.type === 'submit') vehiclePage = 1;
  const button = vehicleForm.querySelector('.primary');
  button.disabled = true;
  const oldHtml = button.innerHTML;
  button.textContent = t('loading');
  const params = new URLSearchParams(new FormData(vehicleForm));
  params.set('page', vehiclePage);
  try {
    const response = await fetch(`/api/vehicles?${params}`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Araçlar alınamadı');
    vehicleRows = data.rows;
    document.querySelector('#vehicleCount').textContent = new Intl.NumberFormat().format(data.total);
    vehicleEmpty.classList.toggle('hidden', vehicleRows.length > 0);
    vehicleTableWrap.classList.toggle('hidden', vehicleRows.length === 0);
    vehicleBody.innerHTML = vehicleRows.map((row, index) => `<tr data-vehicle-index="${index}">
      <td><strong class="part-name">${vehicleValue(row.FahrzeugNummer)}</strong></td>
      <td class="vehicle-list-brand">${brandLogo(row.Marke)}<strong>${vehicleValue(row.Marke)}</strong><span>${vehicleValue(row.Modellcode)}</span></td>
      <td class="sub">${vehicleValue(row.VIN)}</td><td>${vehicleValue(row.Typ)}</td><td><div class="vehicle-code-tags">${row.Motorcode ? `<span class="tag engine-code-tag vehicle-code-tooltip" data-tooltip="${esc(t('vehicle_engine'))}">${esc(row.Motorcode)}</span>` : ''}${row.Getriebecode ? `<span class="tag gearbox-code-tag vehicle-code-tooltip" data-tooltip="${esc(t('vehicle_gearbox'))}">${esc(row.Getriebecode)}</span>` : ''}${row.KBA_Nummer ? `<span class="tag kba-code-tag vehicle-code-tooltip" data-tooltip="${esc(t('vehicle_kba'))}">${formatKba(row.KBA_Nummer)}</span>` : ''}</div></td>
      <td>${vehicleValue(row.Baujahr)}<div class="sub">${vehicleDate(row.Erstzulassung)}</div></td>
      <td>${vehicleKilometers(row.Kilometer)}</td><td>${vehicleStatus(row)}</td>
      <td><button class="detail-button" type="button"><span class="action-icon" aria-hidden="true">◉</span><span>${t('detail')}</span></button></td></tr>`).join('');
    renderVehiclePagination(data);
  } catch (error) {
    showToast(`Araç sorgusu başarısız: ${error.message}`);
  } finally {
    button.disabled = false;
    button.innerHTML = oldHtml;
  }
}

function showVehicleDetail(row) {
  const fields = [
    ['KBA_Nummer', 'KBA', true], ['Gekauft', t('vehicle_purchase_date'), true], ['FZGBrief', t('vehicle_document'), true],
    ['VIN', t('vehicle_vin'), true], ['letztKennzeichen', t('vehicle_plate'), true], ['Baujahr', t('Baujahr'), true],
    ['Erstzulassung', t('Erstzulassung'), true], ['Gewicht', t('vehicle_weight'), true],
    ['AnzahlHalter', t('vehicle_holders'), true],
    ['FahrzeugNummer', t('vehicle_number')], ['Marke', t('vehicle_brand')], ['Modellcode', t('vehicle_model')], ['Typ', t('vehicle_type')],
    ['Status', t('vehicle_status')], ['Kilometer', t('Kilometer')], ['Motorcode', t('Motorcode')], ['Getriebecode', t('Getriebecode')],
    ['Getriebeart', t('Getriebeart')], ['Hubraum', t('Hubraum')], ['Kraftstoff', t('Kraftstoff')],
    ['Farbe', t('Farbe')], ['Zylinder', t('Zylinder')], ['Euro_Norm', t('Euro_Norm')], ['VW_Nr', 'VWN-Nr.'],
    ['Transporteur', 'Transporteur'], ['Annahmestelle', 'Annahmestelle']
  ];
  const rows = fields.map(([key, label, copyable], index) => {
    const display = ['Erstzulassung', 'Gekauft'].includes(key) ? vehicleDate(row[key]) : key === 'KBA_Nummer' ? copyableKba(row[key]) : key === 'Kilometer' ? vehicleKilometers(row[key]) : key === 'Status' ? vehicleStatus(row) : key === 'Gewicht' && row[key] ? `${row[key]} kg` : vehicleValue(row[key]);
    const separateCopy = copyable && key !== 'KBA_Nummer';
    const copyValue = key === 'Gewicht' ? row[key] : display;
    const valueWithCopy = separateCopy ? `<span class="vehicle-inline-copy"><strong class="vehicle-data-value">${display}</strong><button type="button" class="copy-button" data-copy="${esc(display === '—' ? '' : copyValue)}" title="${t('copy_value')}" aria-label="${t('copy_value')}">⧉</button></span>` : `<strong class="vehicle-data-value">${display}</strong>`;
    return `<div class="vehicle-data-row ${index < 9 ? 'priority-row' : ''}"><span class="vehicle-data-label">${label}</span>${valueWithCopy}</div>`;
  });
  document.querySelector('#vehicleDetailContent').innerHTML = `
    <section class="vehicle-hero-card">
      <div class="vehicle-hero-icon" aria-hidden="true"><span class="vehicle-logo-fallback">${esc(String(row.Marke || '?').charAt(0))}</span><img src="/brands/${brandSlug(row.Marke)}.svg" alt="" onerror="this.style.display='none';this.previousElementSibling.style.opacity='1'"></div>
      <div class="vehicle-hero-copy">
        <h3 class="vehicle-hero-brand">${vehicleValue(row.Marke)}</h3>
        <div class="vehicle-hero-model">${vehicleValue(row.Modellcode)} <span>${vehicleValue(row.Typ)}</span></div>
        <div class="vehicle-hero-meta"><button type="button" class="vehicle-number-chip vehicle-parts-link" data-vehicle-number="${esc(row.FahrzeugNummer || '')}" title="${t('all_parts_of_vehicle')}">◆ ${vehicleValue(row.FahrzeugNummer)}</button><span>${vehicleValue(row.Baujahr)}</span><span>${vehicleValue(row.Motorcode)}</span><span>${row.Hubraum ? `${vehicleValue(row.Hubraum)} cm³` : '—'}</span><span>${vehicleStatus(row)}</span></div>
      </div>
    </section>
    <section class="vehicle-data-panel">
      <div class="vehicle-panel-title"><span class="vehicle-panel-icon">▤</span><h3>${t('vehicle_data')}</h3><small>${t('priority_data')}</small></div>
      <div class="vehicle-data-list">
        ${rows.slice(0, 9).join('')}
        <button type="button" class="vehicle-more-toggle" aria-expanded="false"><span class="more-toggle-plus">+</span><span>${t('show_more')}</span></button>
        <div class="vehicle-extra-data" hidden>${rows.slice(9).join('')}</div>
      </div>
    </section>`;
  vehicleDialog.showModal();
}

vehicleForm.addEventListener('submit', runVehicleSearch);
['number','vin','brand','model','type','engine','kba'].forEach(setupVehicleAutocomplete);
vehicleBody.addEventListener('click', event => {
  if (event.target.closest('.copy-button')) return;
  const row = event.target.closest('tr[data-vehicle-index]');
  if (row) showVehicleDetail(vehicleRows[Number(row.dataset.vehicleIndex)]);
});
document.querySelector('#vehiclePagination').addEventListener('click', event => {
  const button = event.target.closest('button[data-vehicle-page]');
  if (!button || button.disabled) return;
  vehiclePage = Number(button.dataset.vehiclePage);
  runVehicleSearch();
  window.scrollTo({ top: vehiclesView.offsetTop, behavior: 'smooth' });
});
document.querySelector('#closeVehicleDetail').addEventListener('click', () => vehicleDialog.close());
vehicleDialog.addEventListener('click', event => {
  if (event.target === vehicleDialog) vehicleDialog.close();
  const moreToggle = event.target.closest('.vehicle-more-toggle');
  if (moreToggle) {
    const extraData = vehicleDialog.querySelector('.vehicle-extra-data');
    const opening = extraData.hidden;
    extraData.hidden = !opening;
    moreToggle.setAttribute('aria-expanded', String(opening));
    moreToggle.querySelector('span:last-child').textContent = t(opening ? 'show_less' : 'show_more');
    return;
  }
  const sellerToggle = event.target.closest('.seller-toggle');
  if (sellerToggle) {
    const sellerDetails = vehicleDialog.querySelector('.seller-details');
    const opening = sellerDetails.hidden;
    sellerDetails.hidden = !opening;
    sellerToggle.setAttribute('aria-expanded', String(opening));
    return;
  }
  const vehicleLink = event.target.closest('.vehicle-parts-link');
  if (vehicleLink) {
    vehicleDialog.close();
    showAppView('parts');
    searchVehicleParts(vehicleLink.dataset.vehicleNumber);
  }
});

document.addEventListener('click', async event => {
  const button = event.target.closest('.copy-button');
  if (!button) return;
  event.preventDefault(); event.stopPropagation();
  if (await copyVehicleText(button.dataset.copy || '')) {
    button.classList.add('copied');
    setTimeout(() => button.classList.remove('copied'), 1200);
  }
});
