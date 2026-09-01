'use strict';

const value = (name) => String(process.env[name] || '').trim();

function loadConfig() {
  return {
    loginUrl: value('RECYCLE_LOGIN_URL') || 'https://recycle.baytemuer.de/',
    username: value('RECYCLE_USERNAME'),
    password: value('RECYCLE_PASSWORD'),
    timeoutMs: Math.min(Math.max(Number(value('RECYCLE_TIMEOUT_MS')) || 30000, 5000), 120000)
  };
}

module.exports = { loadConfig };
