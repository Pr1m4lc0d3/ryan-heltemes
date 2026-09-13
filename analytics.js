/* Consent gate, then Google Analytics. One file, in that order, because order is
   the whole mechanism: window['ga-disable-<ID>'] has to be set before gtag.js parses.

   It lives here rather than in a second script tag because index.html is at its
   397-line budget and a tag on every page is the wrong place to spend two lines
   anyway. Same measurement ID, still declared once, still in this file only. */

(function () {
  var KEY = 'rh-consent';
  var IDS = ["G-DB93XB8QNY","G-F7WLK0CG8X"];
  var saved = null;
  try { saved = localStorage.getItem(KEY); } catch (e) {}

  function setTags(granted) {
    for (var i = 0; i < IDS.length; i++) { window['ga-disable-' + IDS[i]] = !granted; }
  }
  setTags(saved === 'granted');

  window.dataLayer = window.dataLayer || [];
  function gtag() { dataLayer.push(arguments); }
  window.gtag = window.gtag || gtag;

  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: saved === 'granted' ? 'granted' : 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });

  if (saved) { return; }

  var CSS = [
    '.consent-bar{position:fixed;left:0;right:0;bottom:0;z-index:9999;',
    'background:var(--ground-deep);color:var(--ink);',
    'border-top:var(--rule) solid var(--ground-edge);',
    'padding:var(--space-2) var(--space-3);font-size:var(--step--1);',
    'line-height:var(--leading-body);display:flex;gap:var(--space-3);',
    'align-items:center;justify-content:center;flex-wrap:wrap}',
    '.consent-bar p{margin:0;max-width:var(--measure)}',
    '.consent-bar a{color:inherit;text-decoration:underline;text-underline-offset:2px}',
    '.consent-bar .consent-actions{display:flex;gap:var(--space-1);flex-shrink:0}',
    '.consent-bar button{font:inherit;cursor:pointer;border-radius:var(--radius);',
    'padding:var(--space-1) var(--space-2);border:var(--rule) solid var(--ground-edge);white-space:nowrap}',
    '.consent-bar .consent-yes{background:var(--accent);color:var(--ground);',
    'border-color:var(--accent);font-weight:var(--weight-mid)}',
    '.consent-bar .consent-no{background:transparent;color:var(--ink-soft)}',
    '.consent-bar button:focus-visible{outline:var(--rule-heavy) solid var(--accent);outline-offset:2px}',
    '@media (max-width:640px){.consent-bar{flex-direction:column;align-items:stretch;text-align:left}',
    '.consent-bar .consent-actions{justify-content:stretch}',
    '.consent-bar .consent-actions button{flex:1}}'
  ].join('');

  function decide(value) {
    try { localStorage.setItem(KEY, value); } catch (e) {}
    setTags(value === 'granted');
    gtag('consent', 'update', { analytics_storage: value });
    if (value === 'granted') {
      /* gtag.js already parsed with the tag disabled, so the initial page_view was
         never sent. Send it now rather than losing the whole first visit. */
      for (var i = 0; i < IDS.length; i++) { gtag('config', IDS[i]); }
    }
    var bar = document.querySelector('.consent-bar');
    if (bar) { bar.remove(); }
  }

  function render() {
    var style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    var bar = document.createElement('div');
    bar.className = 'consent-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Cookie choice');
    bar.innerHTML =
      '<p>We count visits with Google Analytics, and only if you say yes. ' +
      'Decline and the tag stays switched off. ' +
      '<a href="/privacy.html">What we collect</a>.</p>' +
      '<div class="consent-actions">' +
      '<button type="button" class="consent-no">Decline</button>' +
      '<button type="button" class="consent-yes">Accept</button>' +
      '</div>';
    document.body.appendChild(bar);
    bar.querySelector('.consent-yes').addEventListener('click', function () { decide('granted'); });
    bar.querySelector('.consent-no').addEventListener('click', function () { decide('denied'); });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', render);
  } else {
    render();
  }
})();

/* Google Analytics 4 — property "ryan-heltemes.com" under the daladim account,
   filed with the other properties there rather than in a second account.
   (No project URLs named here on purpose: the project directory is canonical in
   index.html, and the coherence guard fails any file that re-derives it.)

   THE MEASUREMENT ID LIVES HERE AND NOWHERE ELSE. The site has no build step and
   no partials, so the alternative was pasting the same gtag block into five
   <head>s — five copies of one fact, which drift the first time one is edited.
   Every page loads this file instead, and the loader is injected from here. */

window.dataLayer = window.dataLayer || [];
function gtag() { dataLayer.push(arguments); }

gtag('js', new Date());
gtag('config', 'G-DB93XB8QNY');
// Roll-up property — the same id is on every site, so a visit that crosses
// domains stays ONE session instead of restarting as a new referral.
gtag('config', 'G-F7WLK0CG8X');

var s = document.createElement('script');
s.async = true;
s.src = 'https://www.googletagmanager.com/gtag/js?id=G-DB93XB8QNY';
document.head.appendChild(s);
