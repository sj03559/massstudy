(function () {
  'use strict';
  var POLY = [[-0.0,-0.0],[0.06,0.07],[0.52,0.71],[3.17,9.54],[3.8,17.33],[4.17,20.29],[3.32,24.23],[24.72,28.73],[30.63,28.32],[37.35,25.42],[45.09,26.09],[47.78,26.1],[47.83,25.98],[50.2,25.95],[47.52,10.62],[43.07,10.62],[42.39,1.28],[40.76,-0.0]];
  var SEGS = [[[3.32,24.23],[5.81,28.89]],[[5.81,28.89],[13.65,29.83]],[[13.65,29.83],[12.52,31.12]],[[12.52,31.12],[20.19,37.11]],[[30.63,28.32],[32.32,30.4]],[[32.32,30.4],[52.41,37.01]],[[52.41,37.01],[50.2,25.95]],[[47.52,10.62],[44.91,-6.89]],[[36.46,-6.89],[36.67,-3.05]],[[36.67,-3.05],[40.75,-0.0]],[[0.06,0.07],[-1.95,-2.09]],[[-1.95,-2.09],[-0.12,-6.89]],[[55.35,36.42],[53.14,25.36]],[[50.48,10.18],[47.94,-6.89]],[[58.4,9.0],[56.03,-6.89]],[[63.2,34.85],[61.02,23.98]],[[66.14,34.26],[63.97,23.46]],[[61.36,8.56],[59.06,-6.89]],[[50.48,10.18],[53.14,25.36]],[[58.4,9.0],[61.02,23.98]],[[61.36,8.56],[63.97,23.46]]];
  var site = { poly: Core.ccw(POLY), entry: 3 };
  var prog = { S: 72, W: 132, R: 39, maxH: 12, setback: 1, yardD: 12, yardW: 16 };
  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // one alternative per arrangement type, plus a few extra per family for the gallery
  var plan = Core.FAMS.map(function (f) { return { k: f.k, n: Core.SUBS[f.k].length }; });
  var gen = Core.generate(site, prog, plan, 4407, {}).alts;
  var heroList = [], byFam = {};
  gen.forEach(function (a) { (byFam[a.fam] = byFam[a.fam] || []).push(a); });
  // interleave families for the hero
  for (var i = 0; i < 6; i++) Core.FAMS.forEach(function (f) { if (byFam[f.k] && byFam[f.k][i]) heroList.push(byFam[f.k][i]); });

  /* ---------- hero ---------- */
  var cv = document.getElementById('heroCanvas'), cap = document.getElementById('heroCode');
  var frame = (function () { var b = Axon.siteFrame(site, prog.maxH), w = b[2] - b[0], h = b[3] - b[1]; return [b[0] - w * 0.12, b[1] - h * 0.1, b[2] + w * 0.12, b[3] + h * 0.05]; })();
  var idx = 0, t0 = 0, cur = heroList[0];
  function grown(a, k) { return a.pieces.map(function (p) { var q = Object.assign({}, p); q.h = Math.max(0.05, p.h * k); q.z = p.z * k; return q; }); }
  function drawHero(k) {
    if (!cur) return;
    var ink = css('--mat-ink');
    Axon.draw(cv, grown(cur, k), site, prog, {
      frame: frame, pad: 6, site: 'rgba(238,243,236,.85)', yard: css('--ruler'), lineWidth: 0.8,
      siteFill: 'rgba(238,243,236,.06)',
      before: function (c, P) {
        c.strokeStyle = 'rgba(238,243,236,.28)'; c.lineWidth = 0.8; c.beginPath();
        SEGS.forEach(function (s) { var a = P(Axon.proj([s[0][0], s[0][1], 0])), b = P(Axon.proj([s[1][0], s[1][1], 0])); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); });
        c.stroke();
      }
    });
    var f = Core.FAMS.filter(function (x) { return x.k === cur.fam; })[0];
    cap.innerHTML = '';
    var b = document.createElement('b'); b.textContent = cur.fam + pad(cur.num); cap.appendChild(b);
    cap.appendChild(document.createTextNode(' ' + f.ko + ' · ' + cur.name));
  }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function tick(ts) {
    if (!t0) t0 = ts;
    var e = ts - t0, grow = Math.min(1, e / 700);
    drawHero(ease(grow));
    if (e > 3200) { idx = (idx + 1) % heroList.length; cur = heroList[idx]; t0 = ts; }
    if (!document.hidden) requestAnimationFrame(tick); else paused = true;
  }
  var paused = false;
  document.addEventListener('visibilitychange', function () { if (!document.hidden && paused && !reduce) { paused = false; t0 = 0; requestAnimationFrame(tick); } });
  drawHero(1);
  if (!reduce && heroList.length) requestAnimationFrame(tick);

  /* ---------- forms gallery ---------- */
  var TXT = {
    G: '한 줄 · 나란한 · ㄱ자 · 쪼갠 · 엇갈린 박공',
    R: '외쪽 · 나비 · A형 · 큰 지붕 · 톱날 · 볼트',
    S: '얹기 · 띄우기 · 계단식 · 비틀기 · 캔틸레버',
    C: 'ㄷ자 · ㄱ자 · 바람개비 · 띄워 감싼 마당',
    B: '평행 · 흩어진 · 긴 바 · 엇갈린 · 작은 동'
  };
  var grid = document.getElementById('formsGrid'), cards = [];
  Core.FAMS.forEach(function (f) {
    var list = byFam[f.k] || [];
    var card = document.createElement('article'); card.className = 'form';
    var c = document.createElement('canvas'); c.setAttribute('role', 'img'); c.setAttribute('aria-label', f.ko + ' 예시 매스');
    var meta = document.createElement('div'); meta.className = 'meta';
    var k = document.createElement('span'); k.className = 'k'; k.textContent = f.k + ' · ' + list.length + '가지 배치';
    var h = document.createElement('h3'); h.textContent = f.ko;
    var p = document.createElement('p'); p.textContent = TXT[f.k];
    meta.appendChild(k); meta.appendChild(h); meta.appendChild(p);
    card.appendChild(c); card.appendChild(meta); grid.appendChild(card);
    var item = { c: c, list: list, i: 0 };
    cards.push(item);
    card.addEventListener('mouseenter', function () { item.timer = setInterval(function () { item.i = (item.i + 1) % item.list.length; drawCard(item); }, 900); item.i = (item.i + 1) % item.list.length; drawCard(item); });
    card.addEventListener('mouseleave', function () { clearInterval(item.timer); });
  });
  function drawCard(it) {
    var a = it.list[it.i]; if (!a) return;
    Axon.draw(it.c, a.pieces, site, prog, { bg: css('--card'), site: css('--muted'), yard: false, pad: 10, lineWidth: 0.7 });
  }
  function drawCards() { cards.forEach(drawCard); }
  drawCards();
  var rt = 0;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(function () { drawCards(); drawHero(1); }, 120); });
  function retheme() { drawCards(); drawHero(1); }
  try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme); } catch (e) {}
  new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
})();
