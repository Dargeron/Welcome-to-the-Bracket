// Plays the trailer: timed shots, a halving counter, skip / pause / replay.
(function () {
  var root = document.querySelector('[data-trailer]');
  if (!root) return;
  var shots = Array.prototype.slice.call(root.querySelectorAll('.shot'));
  var bar = root.querySelector('[data-progress]');
  var pauseBtn = root.querySelector('[data-pause]');
  var skipBtn = root.querySelector('[data-skip]');
  var replayBtn = root.querySelector('[data-replay]');
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var i = -1, timer = null, paused = false, started = 0, remaining = 0, countTimer = null;
  var total = shots.reduce(function (s, el) { return s + Number(el.getAttribute('data-dur') || 0); }, 0);
  var elapsedBefore = 0;

  function fmt(n) { return Number(n).toLocaleString('en-US'); }

  function runCount(el) {
    var entrants = Number(el.getAttribute('data-entrants'));
    var final = Number(el.getAttribute('data-final'));
    var num = el.querySelector('[data-count-num]');
    var label = el.querySelector('[data-count-round]');
    var fallen = el.querySelectorAll('.fallen li');
    var r = 0;
    num.textContent = fmt(entrants);
    label.textContent = 'Round 1';
    function step() {
      r++;
      num.textContent = fmt(entrants / Math.pow(2, r));
      label.textContent = r < final ? 'Round ' + (r + 1) : 'End of Round ' + final;
      if (fallen[r - 1]) fallen[r - 1].classList.add('gone');
      if (r < final) countTimer = setTimeout(step, 180 + Math.pow(r / final, 3) * 900);
      else el.classList.add('done');
    }
    countTimer = setTimeout(step, 900);
  }

  function show(n) {
    clearTimeout(timer); clearTimeout(countTimer);
    if (i >= 0 && shots[i]) shots[i].classList.remove('on');
    i = n;
    var el = shots[i];
    if (!el) return;
    el.classList.add('on');
    root.classList.toggle('at-end', el.hasAttribute('data-final-shot'));
    elapsedBefore = shots.slice(0, i).reduce(function (s, x) { return s + Number(x.getAttribute('data-dur') || 0); }, 0);
    if (el.hasAttribute('data-count')) runCount(el);
    var dur = Number(el.getAttribute('data-dur') || 0);
    if (el.hasAttribute('data-final-shot')) { setBar(1); return; }
    remaining = dur; started = Date.now();
    if (!paused) timer = setTimeout(next, dur);
    tick();
  }
  function setBar(f) { if (bar) bar.style.width = (f * 100).toFixed(2) + '%'; }
  function tick() {
    if (i < 0 || !shots[i] || shots[i].hasAttribute('data-final-shot')) return;
    var dur = Number(shots[i].getAttribute('data-dur') || 0);
    var done = paused ? dur - remaining : dur - remaining + (Date.now() - started);
    setBar(Math.min(1, (elapsedBefore + done) / total));
    requestAnimationFrame(tick);
  }
  function next() { if (i < shots.length - 1) show(i + 1); }
  function skip() { paused = false; root.classList.remove('paused'); show(shots.length - 1); }
  function togglePause() {
    if (shots[i] && shots[i].hasAttribute('data-final-shot')) return;
    paused = !paused;
    root.classList.toggle('paused', paused);
    pauseBtn.textContent = paused ? '▶' : '❚❚';
    pauseBtn.setAttribute('aria-label', paused ? 'Play' : 'Pause');
    if (paused) { clearTimeout(timer); remaining -= Date.now() - started; }
    else { started = Date.now(); timer = setTimeout(next, Math.max(0, remaining)); }
  }

  skipBtn && skipBtn.addEventListener('click', skip);
  pauseBtn && pauseBtn.addEventListener('click', togglePause);
  replayBtn && replayBtn.addEventListener('click', function () { paused = false; show(0); });
  root.querySelector('.tr-stage').addEventListener('click', function (ev) {
    if (ev.target.closest('a,button')) return;
    if (shots[i] && !shots[i].hasAttribute('data-final-shot')) next();
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape') skip();
    else if (ev.key === ' ') { ev.preventDefault(); togglePause(); }
    else if (ev.key === 'ArrowRight') next();
  });

  root.classList.add('js');
  if (reduce) { root.classList.add('reduced'); show(shots.length - 1); }
  else show(0);
})();
