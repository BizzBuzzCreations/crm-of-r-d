/*!
 * rndCRM Website Intelligence tracking snippet.
 * Usage: <script src="https://<your-crm-domain>/wit.js" data-tracking-id="wit_xxxxx" async></script>
 *
 * Tracks pageviews, session duration, scroll depth, and (opt-in) form
 * funnels. Never sends PII beyond what YOU explicitly wire through
 * wit.getIds() into your own lead-creation call — this script itself never
 * reads form field VALUES, only field names and blur/submit timing.
 */
(function () {
  'use strict';

  var scriptEl = document.currentScript;
  if (!scriptEl) return;
  var trackingId = scriptEl.getAttribute('data-tracking-id');
  if (!trackingId) { console.warn('[wit] missing data-tracking-id on the wit.js <script> tag'); return; }

  var API_BASE = (function () {
    try { return new URL(scriptEl.src).origin; } catch (e) { return ''; }
  })();

  var SESSION_TIMEOUT_MS = 30 * 60 * 1000;
  var PING_INTERVAL_MS = 20 * 1000;

  // ── Visitor / session identity (localStorage — survives tabs & reloads) ──
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
  }
  function getVisitorId() {
    var id = localStorage.getItem('wit_visitor_id');
    if (!id) { id = uid('v'); localStorage.setItem('wit_visitor_id', id); }
    return id;
  }
  function getSession() {
    var now = Date.now();
    var lastActive = Number(localStorage.getItem('wit_session_last_active') || 0);
    var sessionId = localStorage.getItem('wit_session_id');
    var isNewSession = !sessionId || (now - lastActive) > SESSION_TIMEOUT_MS;
    if (isNewSession) {
      sessionId = uid('s');
      localStorage.setItem('wit_session_id', sessionId);
    }
    localStorage.setItem('wit_session_last_active', String(now));
    return { sessionId: sessionId, isNewSession: isNewSession };
  }

  var visitorId = getVisitorId();
  var session = getSession();

  function parseUtm() {
    var params = new URLSearchParams(location.search);
    return {
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
      term: params.get('utm_term') || '',
      content: params.get('utm_content') || '',
    };
  }

  function send(path, body, useBeacon) {
    var payload = JSON.stringify(body);
    var url = API_BASE + '/api/wit/' + path;
    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(function () {});
    }
  }

  // ── Pageview (initial load + SPA client-side navigation) ───────────
  // React Router / Vue Router / any history-API-based router never
  // triggers a real page load on navigation, so a single fire-once
  // pageview call would only ever see a visitor's FIRST page — every
  // session would wrongly look like a 1-page bounce. Patching
  // pushState/replaceState + listening for popstate is the standard
  // router-agnostic way to detect these transitions (same approach
  // GA/Plausible use), with no framework-specific integration required.
  var pageEnteredAt = Date.now();
  var maxScrollDepth = 0;
  var currentPath = location.pathname;
  var firstPageview = true;

  function currentScrollDepth() {
    var doc = document.documentElement;
    var scrollTop = window.pageYOffset || doc.scrollTop;
    var docHeight = Math.max(doc.scrollHeight, document.body.scrollHeight) - doc.clientHeight;
    if (docHeight <= 0) return 100;
    return Math.min(100, Math.round(((scrollTop + doc.clientHeight) / (docHeight + doc.clientHeight)) * 100));
  }

  var scrollThrottle = null;
  window.addEventListener('scroll', function () {
    if (scrollThrottle) return;
    scrollThrottle = setTimeout(function () {
      maxScrollDepth = Math.max(maxScrollDepth, currentScrollDepth());
      scrollThrottle = null;
    }, 250);
  }, { passive: true });

  function sendPageEnd(path) {
    send('pageend', {
      trackingId: trackingId, sessionId: session.sessionId, path: path,
      duration: Math.round((Date.now() - pageEnteredAt) / 1000), maxScrollDepth: maxScrollDepth,
    }, true);
  }

  function sendPageview() {
    send('pageview', {
      trackingId: trackingId, visitorId: visitorId, sessionId: session.sessionId,
      isNewSession: firstPageview && session.isNewSession,
      url: location.href, path: location.pathname, title: document.title,
      referrer: firstPageview ? document.referrer : '', utm: firstPageview ? parseUtm() : {},
    });
    firstPageview = false;
  }

  sendPageview();

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') sendPageEnd(currentPath);
  });
  window.addEventListener('pagehide', function () { sendPageEnd(currentPath); });

  function onLocationChange() {
    if (location.pathname === currentPath) return; // pushState/replaceState with no real path change (scroll restoration, query-only updates, etc.)
    sendPageEnd(currentPath);
    currentPath = location.pathname;
    pageEnteredAt = Date.now();
    maxScrollDepth = 0;
    sendPageview();
  }

  var _pushState = history.pushState;
  history.pushState = function () {
    _pushState.apply(history, arguments);
    onLocationChange();
  };
  var _replaceState = history.replaceState;
  history.replaceState = function () {
    _replaceState.apply(history, arguments);
    onLocationChange();
  };
  window.addEventListener('popstate', onLocationChange);

  // ── Heartbeat (keeps "Active Visitors" accurate between pageviews) ──
  var pingTimer = setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    localStorage.setItem('wit_session_last_active', String(Date.now()));
    send('ping', { trackingId: trackingId, visitorId: visitorId, sessionId: session.sessionId });
  }, PING_INTERVAL_MS);
  window.addEventListener('pagehide', function () { clearInterval(pingTimer); });

  // ── Form funnel tracking (opt-in: <form data-wit-form="quote-request">) ──
  function trackForm(form) {
    var formId = form.getAttribute('data-wit-form');
    if (!formId || form.__witTracked) return;
    form.__witTracked = true;

    var base = { trackingId: trackingId, sessionId: session.sessionId, visitorId: visitorId, formId: formId, url: location.href, path: location.pathname };
    var started = false;

    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            send('form-event', Object.assign({ type: 'view' }, base));
            io.disconnect();
          }
        });
      }, { threshold: 0.5 });
      io.observe(form);
    }

    form.addEventListener('focusin', function () {
      if (started) return;
      started = true;
      send('form-event', Object.assign({ type: 'start' }, base));
    });

    var fields = Array.prototype.slice.call(form.querySelectorAll('input[name], select[name], textarea[name]'));
    fields.forEach(function (field, i) {
      field.addEventListener('blur', function () {
        send('form-event', Object.assign({ type: 'field_blur', fieldName: field.name, fieldOrder: i }, base));
      });
    });

    form.addEventListener('submit', function () {
      send('form-event', Object.assign({ type: 'submit' }, base));
    });

    // Low-friction integration: if the form does a plain HTML POST (no JS
    // handler at all), the visitor/session IDs still travel along as
    // hidden fields so a server-side handler can read them from the body.
    if (!form.querySelector('input[name="wit_visitor_id"]')) {
      var vInput = document.createElement('input');
      vInput.type = 'hidden'; vInput.name = 'wit_visitor_id'; vInput.value = visitorId;
      form.appendChild(vInput);
      var sInput = document.createElement('input');
      sInput.type = 'hidden'; sInput.name = 'wit_session_id'; sInput.value = session.sessionId;
      form.appendChild(sInput);
    }
  }

  function scanForms() {
    var forms = document.querySelectorAll('form[data-wit-form]');
    for (var i = 0; i < forms.length; i++) trackForm(forms[i]);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scanForms);
  } else {
    scanForms();
  }
  // Forms injected later (SPA/dynamic pages) — cheap periodic re-scan.
  setInterval(scanForms, 3000);

  // ── Public API for the site's own lead-submission code ─────────────
  window.wit = {
    getIds: function () { return { visitorId: visitorId, sessionId: session.sessionId }; },
  };
})();
