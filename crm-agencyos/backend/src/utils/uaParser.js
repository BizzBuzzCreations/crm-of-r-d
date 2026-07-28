'use strict';
const { UAParser } = require('ua-parser-js');

function parseUserAgent(uaString) {
  if (!uaString) return { deviceType: 'unknown', browser: '', os: '' };
  const { browser, os, device } = new UAParser(uaString).getResult();
  return {
    // ua-parser-js only sets device.type for mobile/tablet/etc — a bare
    // desktop UA has no device.type at all, so absence means desktop.
    deviceType: device.type === 'mobile' ? 'mobile' : device.type === 'tablet' ? 'tablet' : 'desktop',
    browser: browser.name || 'Unknown',
    os: os.name || 'Unknown',
  };
}

module.exports = { parseUserAgent };
