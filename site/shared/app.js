// Random pages, search, and small UI helpers. No dependencies.
(function () {
  var body = document.body;
  var ROOT = body.getAttribute('data-root') || '';
  var EXPLICIT = body.hasAttribute('data-explicit');

  function href(p) {
    if (EXPLICIT) {
      var q = '';
      var k = p.indexOf('?');
      if (k >= 0) { q = p.slice(k); p = p.slice(0, k); }
      if (p === '' || p.slice(-1) === '/') p += 'index.html';
      p += q;
    }
    return ROOT + p;
  }

  var indexPromise = null;
  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(ROOT + 'data/index.json').then(function (r) { return r.json(); });
    }
    return indexPromise;
  }

  function params() {
    var out = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      if (!kv) return;
      var p = kv.split('=');
      out[decodeURIComponent(p[0])] = decodeURIComponent((p[1] || '').replace(/\+/g, ' '));
    });
    return out;
  }

  // --- random -------------------------------------------------------------------
  var msg = document.querySelector('[data-random-msg]');
  if (msg) {
    var P = params();
    loadIndex().then(function (items) {
      var type = P.type || 'encounter';
      var pool = items.filter(function (it) {
        if (it.k !== type) return false;
        if (P.round && String(it.r) !== String(P.round)) return false;
        return true;
      });
      if (!pool.length) {
        msg.textContent = P.round ? 'Round ' + P.round + ' is unwritten.' : 'Nothing here yet.';
        var empty = document.querySelector('[data-random-empty]');
        if (empty) empty.hidden = false;
        return;
      }
      var pick = pool[Math.floor(Math.random() * pool.length)];
      msg.textContent = pick.t;
      location.replace(href(pick.u));
    }).catch(function () { msg.textContent = 'Could not load the index.'; });
  }

  // --- search -------------------------------------------------------------------
  var results = document.querySelector('[data-search-results]');
  var form = document.querySelector('[data-search-form]');
  if (results && form) {
    var input = form.querySelector('input');
    var labels = { encounter: 'Encounter', character: 'Character', round: 'Round', deprecated: 'Deprecated', page: 'Page' };
    function esc(s) { return String(s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function run(q) {
      q = (q || '').trim().toLowerCase();
      if (!q) { results.innerHTML = ''; return; }
      loadIndex().then(function (items) {
        var words = q.split(/\s+/);
        var scored = items.map(function (it) {
          var hay = [it.t, (it.c || []).join(' '), (it.a || []).join(' '), it.s, it.x].join(' ').toLowerCase();
          var title = (it.t || '').toLowerCase();
          var score = 0;
          for (var w = 0; w < words.length; w++) {
            if (hay.indexOf(words[w]) < 0) return null;
            score += title.indexOf(words[w]) >= 0 ? 3 : 1;
          }
          return { it: it, score: score };
        }).filter(Boolean).sort(function (a, b) { return b.score - a.score; });
        if (!scored.length) { results.innerHTML = '<p class="muted">Nothing on record matches “' + esc(q) + '”. That only means nobody has written it yet.</p>'; return; }
        results.innerHTML = '<ul class="search-list">' + scored.slice(0, 60).map(function (s) {
          var it = s.it;
          return '<li><span class="chip chip-kind">' + labels[it.k] + '</span> <a href="' + href(it.u) + '">' + esc(it.t) + '</a>' +
            (it.c ? ' <span class="muted">' + esc(it.c.join(' · ')) + '</span>' : '') +
            (it.s ? ' <span class="muted">' + esc(it.s) + '</span>' : '') +
            (it.x ? '<div class="fine muted">' + esc(it.x) + '</div>' : '') + '</li>';
        }).join('') + '</ul>';
      });
    }
    var q0 = params().q || '';
    input.value = q0;
    run(q0);
    input.addEventListener('input', function () { run(input.value); });
    form.addEventListener('submit', function (ev) { ev.preventDefault(); run(input.value); history.replaceState(null, '', '?q=' + encodeURIComponent(input.value)); });
  }

  // --- explicit-index mode: forms that GET a directory need index.html -----------
  if (EXPLICIT) {
    Array.prototype.forEach.call(document.querySelectorAll('form[action]'), function (f) {
      var a = f.getAttribute('action');
      if (a && a.slice(-1) === '/' && a.indexOf('://') < 0) f.setAttribute('action', a + 'index.html');
    });
  }
})();
