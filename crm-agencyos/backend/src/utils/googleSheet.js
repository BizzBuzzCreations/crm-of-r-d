'use strict';
// Fetches a Google Sheet as CSV without OAuth — works for any sheet shared
// as "Anyone with the link can view" (or published to web). No Google API
// credentials needed; this app has no OAuth infra to build on, and this
// covers the common case without it.
const https = require('https');

function parseGoogleSheetUrl(url) {
  const idMatch = String(url || '').match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch) return null;
  const gidMatch = String(url).match(/[?#&]gid=(\d+)/);
  return { id: idMatch[1], gid: gidMatch ? gidMatch[1] : '0' };
}

function fetchText(url, redirectsLeft = 5) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirectsLeft > 0) {
        res.resume();
        resolve(fetchText(new URL(res.headers.location, url).toString(), redirectsLeft - 1));
        return;
      }
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
        if (data.length > 5_000_000) req.destroy(new Error('Response too large (5MB limit)'));
      });
      res.on('end', () => resolve({ statusCode: res.statusCode, contentType: res.headers['content-type'] || '', body: data }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.setTimeout(10000, () => req.destroy(new Error('Request timed out')));
  });
}

async function fetchGoogleSheetCsv(sheetUrl) {
  const parsed = parseGoogleSheetUrl(sheetUrl);
  if (!parsed) throw new Error("That doesn't look like a Google Sheets URL");

  const exportUrl = `https://docs.google.com/spreadsheets/d/${parsed.id}/export?format=csv&gid=${parsed.gid}`;
  const res = await fetchText(exportUrl);

  if (res.statusCode !== 200 || !res.contentType.includes('csv')) {
    throw new Error('Could not read this sheet — make sure sharing is set to "Anyone with the link can view"');
  }
  return res.body;
}

module.exports = { fetchGoogleSheetCsv };
