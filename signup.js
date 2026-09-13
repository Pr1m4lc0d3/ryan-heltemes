/* Notify-list form states.

   The form posts straight to Kit, which means a full page navigation to Kit's own
   hosted confirmation. Two things were lost that way: the reader left the site, and
   the conversion never reached GA because no page of ours ever loaded again.

   This intercepts the submit and posts to the same Kit form over fetch, so the reader
   stays put, sees a working state and an error state, and the signup is counted. With
   JavaScript off the original form action still works exactly as before.

   Styles live here rather than in bookshelf.css because that file is at 240 of its
   300-line budget and this is not worth spending it on. */
(function () {
  'use strict';

  var form = document.querySelector('form.signup[action*="app.kit.com"]');
  if (!form) { return; }

  var input = form.querySelector('input[type="email"]');
  var button = form.querySelector('button[type="submit"]');
  if (!input || !button) { return; }

  var formId = (form.getAttribute('action').match(/forms\/(\d+)\//) || [])[1];
  if (!formId) { return; }

  var style = document.createElement('style');
  style.textContent =
    '.signup-msg{margin:var(--space-2) 0 0;font-size:var(--step--1);line-height:var(--leading-body);min-height:1.2em}' +
    '.signup-msg.is-ok{color:var(--accent)}' +
    '.signup-msg.is-error{color:var(--alert)}' +
    '.signup input[aria-invalid="true"]{outline:var(--rule-heavy) solid var(--alert);outline-offset:1px}';
  document.head.appendChild(style);

  var msg = document.createElement('p');
  msg.className = 'signup-msg';
  msg.setAttribute('role', 'status');
  msg.setAttribute('aria-live', 'polite');
  var fine = form.querySelector('.signup-fine');
  if (fine) { form.insertBefore(msg, fine); } else { form.appendChild(msg); }

  var label = button.textContent;

  function say(text, kind) {
    msg.textContent = text;
    msg.className = 'signup-msg' + (kind ? ' is-' + kind : '');
  }

  form.addEventListener('submit', function (event) {
    var email = input.value.trim();
    if (!email || email.indexOf('@') < 1 || email.lastIndexOf('.') < email.indexOf('@')) {
      event.preventDefault();
      input.setAttribute('aria-invalid', 'true');
      say('That does not look like an email address.', 'error');
      input.focus();
      return;
    }
    input.removeAttribute('aria-invalid');

    event.preventDefault();
    button.disabled = true;
    button.textContent = 'Sending…';
    say('');

    var data = new FormData();
    data.append('email_address', email);

    fetch('https://app.kit.com/forms/' + formId + '/subscriptions', {
      method: 'POST',
      body: data,
      headers: { Accept: 'application/json' }
    })
      .then(function (r) { return r.json(); })
      .then(function (out) {
        if (out && (out.status === 'success' || out.subscription)) {
          form.reset();
          say('You are on the list. Check your inbox to confirm.', 'ok');
          if (typeof window.gtag === 'function') {
            window.gtag('event', 'signup_complete', { method: 'kit', form_id: formId });
          }
        } else {
          say('That did not go through. Please try again.', 'error');
        }
      })
      .catch(function () {
        say('Could not reach the list just now. Please try again in a moment.', 'error');
      })
      .then(function () {
        button.disabled = false;
        button.textContent = label;
      });
  });
})();
