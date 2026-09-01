'use strict';

const REQUIRED_CREDENTIAL_KEYS = [
  'WMKAT_CUSTOMER_NUMBER',
  'WMKAT_USERNAME',
  'WMKAT_PASSWORD'
];

function value(name) {
  return String(process.env[name] || '').trim();
}

function selector(name, fallback) {
  return value(name) || fallback;
}

function loadConfig() {
  const missingCredentials = REQUIRED_CREDENTIAL_KEYS.filter((name) => !value(name));

  return {
    loginUrl: value('WMKAT_LOGIN_URL') || 'https://plus.wmkat.de/login/default',
    searchUrl: value('WMKAT_SEARCH_URL'),
    credentials: {
      customerNumber: value('WMKAT_CUSTOMER_NUMBER'),
      username: value('WMKAT_USERNAME'),
      password: value('WMKAT_PASSWORD')
    },
    selectors: {
      customerNumber: selector('WMKAT_CUSTOMER_SELECTOR', '#login-input--customernumber'),
      username: selector('WMKAT_USERNAME_SELECTOR', '#login-input--username'),
      password: selector('WMKAT_PASSWORD_SELECTOR', 'input[name="password"]'),
      loginSubmit: selector('WMKAT_LOGIN_SUBMIT_SELECTOR', 'button[type="submit"]'),
      loggedInMarker: selector('WMKAT_LOGGED_IN_SELECTOR', 'input#directSearchQuery'),
      searchInput: selector('WMKAT_SEARCH_INPUT_SELECTOR', 'input#directSearchQuery'),
      searchSubmit: selector('WMKAT_SEARCH_SUBMIT_SELECTOR', "button:has(svg.icon-search), button:has(svg[class*='icon-search'])"),
      noResults: selector('WMKAT_NO_RESULTS_SELECTOR', "svg.icon-no-results, svg[class*='icon-no-results']"),
      detailsButton: selector('WMKAT_DETAILS_SELECTOR', "button:has(svg.icon-details), button:has(svg[class*='icon-details'])"),
      referenceTab: selector('WMKAT_REFERENCE_TAB_SELECTOR', "div[accesskey='tab-1-references'].tab"),
      selectedReferenceTab: selector('WMKAT_SELECTED_REFERENCE_TAB_SELECTOR', "div[accesskey='tab-1-references'].tab.is-selected"),
      referencesContainer: selector('WMKAT_REFERENCES_CONTAINER_SELECTOR', 'div.article-references'),
      closeModal: selector('WMKAT_CLOSE_MODAL_SELECTOR', "button:has(svg.icon-close), button:has(svg[class*='icon-close'])")
    },
    timeoutMs: Math.min(Math.max(Number(value('WMKAT_TIMEOUT_MS')) || 30000, 5000), 120000),
    missingCredentials
  };
}

function validateRemoteUrl(rawUrl, label) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch (_) {
    throw new Error(`${label} geçerli bir URL değil.`);
  }
  if (parsed.protocol !== 'https:') {
    throw new Error(`${label} HTTPS kullanmalıdır.`);
  }
  return parsed.toString();
}

module.exports = { loadConfig, validateRemoteUrl };
