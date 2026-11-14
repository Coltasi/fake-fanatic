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
            if (res.ok && data.ok) return showSuccess(form, data);
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

  function showSuccess(form, data) {
    var link = data.referral_link || location.origin + '/';
    var shareText = 'I just joined the Fake Fanatic waitlist. It\'s an app for surviving sports small talk. Join me: ';
    var id = 'ref-' + Math.random().toString(36).slice(2, 7);

    var card = el('div', { class: 'joined', tabindex: '-1' });
    card.appendChild(el('h3', { class: 'joined__h' }, 'WELCOME TO THE TEAM.'));
    card.appendChild(el('p', {}, 'We\'ll email you at launch. Bring a friend and move up the list.'));
    // Place in line (data.position) is hidden while the list is small; show it again later if wanted.

    var lab = el('label', { for: id, class: 'sr-only' }, 'Your referral link');
    var row = el('div', { class: 'joined__link' });
    var field = el('input', { id: id, type: 'text', readonly: '', value: link });
    var copy = el('button', { type: 'button', class: 'btn btn--orange joined__copy' }, 'Copy');
    copy.addEventListener('click', function () {
      var done = function () { copy.textContent = 'Copied!'; setTimeout(function () { copy.textContent = 'Copy'; }, 2000); };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(link).then(done, function () { field.select(); });
      } else { field.select(); try { document.execCommand('copy'); done(); } catch (e) {} }
    });
    field.addEventListener('focus', function () { field.select(); });
    row.appendChild(field); row.appendChild(copy);
    card.appendChild(lab); card.appendChild(row);

    var share = el('ul', { class: 'joined__share', 'aria-label': 'Share your link' });
    var enc = encodeURIComponent(shareText + link);
    [
      ['Text', 'sms:?&body=' + enc],
      ['WhatsApp', 'https://wa.me/?text=' + enc],
      ['X', 'https://x.com/intent/post?text=' + enc]
    ].forEach(function (s) {
      var li = el('li');
      var a = el('a', { href: s[1], target: '_blank', rel: 'noopener' }, s[0]);
      li.appendChild(a); share.appendChild(li);
    });
    card.appendChild(share);

    form.replaceWith(card);
    card.focus();
  }
})();
