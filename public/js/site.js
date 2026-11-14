// Fake Fanatic site script: waitlist forms, "Join the waitlist" buttons, UTM + referral tracking.
(function () {
  'use strict';

  // ---------- Remember where this visitor came from (first page of the visit wins) ----------
  var store = {
    get: function (k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch (e) { return null; } },
    set: function (k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  var params = new URLSearchParams(location.search);
  if (!store.get('ff_attr')) {
    store.set('ff_attr', {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      landing_path: location.pathname
    });
  }
  // ?ref=CODE works too, as well as /r/CODE links
  var refParam = (params.get('ref') || '').toUpperCase();
  if (/^[A-Z0-9]{4,12}$/.test(refParam)) setRefCookie(refParam);

  function setRefCookie(code) {
    document.cookie = 'ff_ref=' + code + '; path=/; max-age=2592000; SameSite=Lax' + (location.protocol === 'https:' ? '; Secure' : '');
  }
  function readRefCookie() {
    var m = document.cookie.match(/(?:^|;\s*)ff_ref=([A-Z0-9]{4,12})/);
    return m ? m[1] : '';
  }

  // ---------- "Join the waitlist" buttons scroll to the nearest form ----------
  function nearestForm(fromEl) {
    var forms = Array.prototype.slice.call(document.querySelectorAll('[data-signup], .joined'));
    if (!forms.length) return null;
    var y = fromEl.getBoundingClientRect().top;
    // The sticky nav button is "at the top of the screen", so measure from there.
    forms.sort(function (a, b) {
      return Math.abs(a.getBoundingClientRect().top - y) - Math.abs(b.getBoundingClientRect().top - y);
    });
    return forms[0];
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-join]');
    if (!btn) return;
    var form = nearestForm(btn);
    if (!form) return; // no form on this page: follow the link to the home page form
    e.preventDefault();
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    form.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
    var input = form.querySelector('input[type=email], input[readonly]');
    if (input) setTimeout(function () { input.focus({ preventScroll: true }); }, reduce ? 0 : 450);
  });

  // ---------- Waitlist forms ----------
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  Array.prototype.forEach.call(document.querySelectorAll('[data-signup]'), function (form) {
    var input = form.querySelector('input[type=email]');
    var button = form.querySelector('button[type=submit]');
    var msg = form.querySelector('.signup__msg');
    var label = button.innerHTML;

    function showError(text) {
      msg.textContent = text;
      msg.classList.add('is-error');
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      msg.textContent = '';
      msg.classList.remove('is-error');
      input.removeAttribute('aria-invalid');

      var email = input.value.trim();
      if (!EMAIL_RE.test(email)) return showError('That email doesn\'t look right. Try again?');

      var attr = store.get('ff_attr') || {};
      var body = {
        email: email,
        referred_by: readRefCookie(),
        utm_source: attr.utm_source || '',
        utm_medium: attr.utm_medium || '',
        utm_campaign: attr.utm_campaign || '',
        landing_path: attr.landing_path || location.pathname,
        weekly_updates: form.querySelector('input[name=weekly_updates]').checked,
        company: form.querySelector('input[name=company]').value // honeypot: humans leave it empty
      };

      button.disabled = true;
      button.textContent = 'Joining…';

      fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (res.ok && data.ok) return showSuccess(form, body.weekly_updates);
            if (res.status === 429) throw new Error('Easy, superfan. Too many tries. Give it a few minutes.');
            throw new Error(data.error || 'Something went wrong on our end. Please try again in a minute.');
          });
        })
        .catch(function (err) {
          button.disabled = false;
          button.innerHTML = label;
          showError(err && err.message && err.message !== 'Failed to fetch'
            ? err.message
            : 'We couldn\'t reach the server. Check your connection and try again.');
        });
    });
  });

  function el(tag, attrs, text) {
    var n = document.createElement(tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (text) n.textContent = text;
    return n;
  }

  function showSuccess(form, weekly) {
    var card = el('div', { class: 'joined', tabindex: '-1' });
    card.appendChild(el('h3', { class: 'joined__h' }, 'WELCOME TO THE TEAM.'));
    card.appendChild(el('p', {}, 'You\'re registered. Keep an eye on your inbox for the launch email.'));
    if (weekly) card.appendChild(el('p', { class: 'joined__note' }, 'You\'ll also get our weekly Fake Fanatic updates.'));
    form.replaceWith(card);
    card.focus();
  }
})();
