(function () {
'use strict';
var FAMS = Core.FAMS, GROUPS = Core.GROUPS, ROOFS = Core.ROOFS;
var $ = function (s) { return document.querySelector(s); };
var $$ = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }
function pad(n) { return (n < 10 ? '0' : '') + n; }
function fmt(v, d) { d = d || 0; return (+v).toLocaleString('ko-KR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
function css(name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }
function uid() { return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) { var r = Math.random() * 16 | 0; return (c === 'x' ? r : (r & 3 | 8)).toString(16); }); }
function toast(t) { var e = $('#toast'); e.textContent = t; e.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { e.hidden = true; }, 2600); }
function when(d) { var t = new Date(d), n = new Date(); return t.toDateString() === n.toDateString() ? t.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : t.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' }); }

/* ---------- sample site: 천안 성성동 44-9 ---------- */
var SAMPLE_POLY = [[-0.0,-0.0],[0.06,0.07],[0.52,0.71],[3.17,9.54],[3.8,17.33],[4.17,20.29],[3.32,24.23],[24.72,28.73],[30.63,28.32],[37.35,25.42],[45.09,26.09],[47.78,26.1],[47.83,25.98],[50.2,25.95],[47.52,10.62],[43.07,10.62],[42.39,1.28],[40.76,-0.0]];
var SAMPLE_SEGS = [[[3.32,24.23],[5.81,28.89]],[[5.81,28.89],[13.65,29.83]],[[13.65,29.83],[12.52,31.12]],[[12.52,31.12],[20.19,37.11]],[[30.63,28.32],[32.32,30.4]],[[32.32,30.4],[52.41,37.01]],[[52.41,37.01],[52.43,37.11]],[[52.41,37.01],[50.2,25.95]],[[47.52,10.62],[44.91,-6.89]],[[36.46,-6.89],[36.67,-3.05]],[[36.67,-3.05],[40.75,-0.0]],[[0.06,0.07],[-1.95,-2.09]],[[-1.95,-2.09],[-0.12,-6.89]],[[55.35,36.42],[53.14,25.36]],[[50.48,10.18],[47.94,-6.89]],[[55.35,36.42],[55.5,37.11]],[[58.4,9.0],[56.03,-6.89]],[[63.2,34.85],[61.02,23.98]],[[63.2,34.85],[63.69,37.11]],[[66.14,34.26],[66.76,37.11]],[[66.14,34.26],[63.97,23.46]],[[61.36,8.56],[59.06,-6.89]],[[50.48,10.18],[53.14,25.36]],[[58.4,9.0],[61.02,23.98]],[[61.36,8.56],[63.97,23.46]]];
function sampleSite() { return { name: '성성동 44-9', poly: Core.ccw(SAMPLE_POLY), segs: SAMPLE_SEGS, entry: 3, origin: [465998.954, 460889.367], upm: 1000 }; }
var DEFAULT_PROG = { S: 72, W: 132, R: 39, maxH: 12, setback: 1, yardD: 12, yardW: 16 };

/* =====================================================================
   PROJECT STORE (this browser + optional cloud)
   ===================================================================== */
var LKEY = 'massstudy.projects.v1', CKEY = 'massstudy.current';
function lsGet(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } }
function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
function localAll() { return lsGet(LKEY) || {}; }
function freshData(withSample) {
  return { site: withSample ? sampleSite() : null, prog: Object.assign({}, DEFAULT_PROG), alts: [], picks: [], cur: null, counts: { G: 8, R: 8, S: 8, C: 8, B: 8 }, filter: 'all', onlyPicked: false, colorMode: false, mode: 'one', tab: withSample ? 'gen' : 'site' };
}
function summaryOf(d) { return { site: d.site ? d.site.name : '', area: d.site ? Math.round(Math.abs(Core.area(d.site.poly))) : 0, alts: d.alts.length, picks: d.picks.length }; }

var S = null, META = null, dxf = null, undoStack = {}, redoStack = {}, selPiece = -1, selSet = [];
var saveT = 0, cloudT = 0, saveState = '';
function setSaved(t) { saveState = t; $('#savedState').textContent = t; }
function save() {
  setSaved('저장 중…');
  clearTimeout(saveT);
  saveT = setTimeout(function () {
    META.updated = Date.now();
    var all = localAll();
    all[META.id] = { id: META.id, name: META.name, updated: META.updated, cloud: META.cloud, data: S };
    var ok = lsSet(LKEY, all); lsSet(CKEY, META.id);
    setSaved(ok ? '이 브라우저에 저장됨' : '저장 공간이 꽉 찼어요');
    if (Cloud.user) {
      clearTimeout(cloudT);
      cloudT = setTimeout(cloudSave, 1800);
    }
  }, 350);
}
function cloudSave() {
  if (!Cloud.user) return Promise.resolve();
  setSaved('클라우드 저장 중…');
  return Cloud.save({ id: META.id, name: META.name, data: S, summary: summaryOf(S) }).then(function () {
    META.cloud = true; var all = localAll(); if (all[META.id]) { all[META.id].cloud = true; lsSet(LKEY, all); }
    setSaved('클라우드에 저장됨');
  }, function () { setSaved('클라우드 저장 실패 · 이 브라우저엔 저장됨'); });
}
function openProject(p) {
  S = Object.assign(freshData(false), p.data);
  if (!S.prog) S.prog = Object.assign({}, DEFAULT_PROG);
  if (!S.mode) S.mode = S.alts.length && !S.alts.some(function (x) { return Core.isOne(x.pieces); }) ? 'three' : 'one';
  if (!S.linked) {
    S.alts.forEach(function (x, k) {
      if (!Core.isOne(x.pieces) || x.pieces.some(function (q) { return q.u; })) return;
      if (Core.linkTouching(x.pieces, 'u' + k.toString(36) + 'm')) x.orig = JSON.stringify(x.pieces);
    });
    S.linked = 1;
  }
  META = { id: p.id, name: p.name || '이름 없는 프로젝트', updated: p.updated || Date.now(), cloud: !!p.cloud };
  dxf = null; undoStack = {}; redoStack = {}; selPiece = -1; selSet = []; threeSiteDirty = true; view.fitted = false;
  $('#projName').value = META.name;
  fillProg(); renderFamCounts(); renderSiteInfo(); renderMeta(); renderMode();
  setTab(S.tab || 'gen');
  setMode(S.site && S.site.entry == null ? 'entry' : (S.site ? 'pick' : 'pick'));
  lsSet(CKEY, META.id);
  setSaved(META.cloud ? '클라우드 프로젝트' : '이 브라우저에 저장됨');
}
function newProject(withSample, name) {
  var d = freshData(withSample);
  var p = { id: uid(), name: name || (withSample ? '성성동 44-9 예시' : '새 프로젝트'), updated: Date.now(), data: d };
  openProject(p);
  if (withSample) generate(20261013, true);
  save();
}
$('#projName').addEventListener('change', function () { var v = $('#projName').value.trim() || '이름 없는 프로젝트'; META.name = v; $('#projName').value = v; save(); });

/* ---------- tabs ---------- */
function setTab(t) {
  S.tab = t;
  $$('[data-tab]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.tab === t ? 'true' : 'false'); });
  $$('.view').forEach(function (v) { v.hidden = v.dataset.view !== t; });
  if (t === 'site') { if (!view.fitted) fitPlan(); drawPlan(); }
  if (t === 'gen') renderCards();
  if (t === 'edit') { initThree(); openEdit(); }
  if (t === 'sheet') renderSheet();
}
$$('[data-tab]').forEach(function (b) { b.addEventListener('click', function () { setTab(b.dataset.tab); save(); }); });
function renderMeta() { document.title = META.name + ' · MassStudy'; }
function altById(id) { for (var i = 0; i < S.alts.length; i++) if (S.alts[i].id === id) return S.alts[i]; return null; }
function code(a) { return a.fam + pad(a.num); }
function isPicked(a) { return S.picks.indexOf(a.id) >= 0; }
function sortedAlts() {
  var order = {}; FAMS.forEach(function (f, i) { order[f.k] = i; });
  return S.alts.slice().sort(function (a, b) { return order[a.fam] - order[b.fam] || a.num - b.num; });
}
function check(a) { return Core.check(a, S.site, S.prog); }
function nextNum(fam) { var m = 0; S.alts.forEach(function (b) { if (b.fam === fam) m = Math.max(m, b.num); }); return m + 1; }
function colorOf() { return S.colorMode ? function (p) { return GROUPS[p.g].color; } : null; }
function thumb(cv, pieces) {
  Axon.draw(cv, pieces, S.site, S.prog, { bg: css('--raise'), site: css('--site'), yard: css('--yard'), colorOf: colorOf(), frame: Axon.siteFrame(S.site, S.prog.maxH) });
}

/* =====================================================================
   1. SITE
   ===================================================================== */
var plan = $('#plan'), pctx = plan.getContext('2d');
var view = { s: 8, tx: 0, ty: 0, fitted: false }, mode = 'pick', drawPts = [], hoverPoly = null;
function planOrigin() { return S.site ? S.site.origin : dxf.base; }
function planUpm() { return dxf ? dxf.upm : (S.site ? S.site.upm : 1000); }
function dxfLocal() {
  if (!dxf) return null;
  var o = planOrigin(), u = dxf.upm, ox = (o[0] - dxf.base[0]) / u, oy = (o[1] - dxf.base[1]) / u, key = ox + ',' + oy + ',' + u;
  if (dxf._cache && dxf._cache.key === key) return dxf._cache;
  var segs = dxf.raw.segs.map(function (s) { return [(s[0] - dxf.base[0]) / u - ox, (s[1] - dxf.base[1]) / u - oy, (s[2] - dxf.base[0]) / u - ox, (s[3] - dxf.base[1]) / u - oy]; });
  var polys = dxf.raw.polys.map(function (P) { return P.map(function (q) { return [(q[0] - dxf.base[0]) / u - ox, (q[1] - dxf.base[1]) / u - oy]; }); })
    .filter(function (P) { var a = Math.abs(Core.area(P)); return a > 20 && a < 200000; });
  dxf._cache = { key: key, segs: segs, polys: polys };
  return dxf._cache;
}
function fitPlan() {
  var r = plan.getBoundingClientRect(), b;
  if (!r.width) return;
  if (S.site && S.site.poly.length) { b = Core.bbox(S.site.poly); var m = Math.max(b[2] - b[0], b[3] - b[1]) * 0.35 + 8; b = [b[0] - m, b[1] - m, b[2] + m, b[3] + m]; }
  else if (dxf) { var L = dxfLocal(), pts = []; L.segs.forEach(function (s) { pts.push([s[0], s[1]], [s[2], s[3]]); }); b = Core.bbox(pts); }
  else b = [-10, -10, 60, 40];
  view.fitted = true;
  view.s = Math.min(r.width / (b[2] - b[0] || 1), r.height / (b[3] - b[1] || 1)) * 0.92;
  view.tx = r.width / 2 - (b[0] + b[2]) / 2 * view.s;
  view.ty = r.height / 2 + (b[1] + b[3]) / 2 * view.s;
}
function w2s(p) { return [view.tx + p[0] * view.s, view.ty - p[1] * view.s]; }
function s2w(x, y) { return [(x - view.tx) / view.s, (view.ty - y) / view.s]; }
function sizePlan() {
  var r = plan.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  if (!r.width) return false;
  plan.width = r.width * d; plan.height = r.height * d; pctx.setTransform(d, 0, 0, d, 0, 0);
  return true;
}
function poly(c, P, close) { c.beginPath(); P.forEach(function (p, i) { var q = w2s(p); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); if (close) c.closePath(); }
function drawPlan() {
  if (!S || S.tab !== 'site' || !sizePlan()) return;
  var r = plan.getBoundingClientRect(), c = pctx;
  c.fillStyle = css('--stage'); c.fillRect(0, 0, r.width, r.height);
  c.lineWidth = 1; c.strokeStyle = css('--ctx'); c.beginPath();
  var L = dxfLocal();
  if (L) L.segs.forEach(function (s) { var a = w2s([s[0], s[1]]), b = w2s([s[2], s[3]]); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); });
  else if (S.site) S.site.segs.forEach(function (s) { var a = w2s(s[0]), b = w2s(s[1]); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); });
  c.stroke();
  if (hoverPoly && mode === 'pick') { poly(c, hoverPoly, true); c.fillStyle = 'rgba(142,195,227,.35)'; c.fill(); c.strokeStyle = css('--accent'); c.lineWidth = 1.5; c.stroke(); }
  if (S.site && S.site.poly.length) {
    poly(c, S.site.poly, true); c.fillStyle = 'rgba(142,195,227,.22)'; c.fill(); c.strokeStyle = css('--site'); c.lineWidth = 2; c.stroke();
    var Y = Core.yardPoly(S.site, S.prog);
    if (Y) { c.setLineDash([5, 4]); poly(c, Y, true); c.strokeStyle = css('--yard'); c.lineWidth = 1.2; c.stroke(); c.setLineDash([]); }
    if (S.site.entry != null) {
      var P = S.site.poly, a = P[S.site.entry], b = P[(S.site.entry + 1) % P.length];
      poly(c, [a, b], false); c.strokeStyle = css('--yard'); c.lineWidth = 4; c.stroke();
      var m = w2s([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      c.fillStyle = css('--yard'); c.font = '500 12px ' + css('--f-body'); c.fillText('진입', m[0] + 8, m[1] - 8);
    }
    if (mode === 'entry') { c.fillStyle = css('--site'); S.site.poly.forEach(function (p) { var q = w2s(p); c.fillRect(q[0] - 2, q[1] - 2, 4, 4); }); }
  } else if (!dxf) {
    c.fillStyle = css('--muted'); c.font = '14px ' + css('--f-body'); c.textAlign = 'center';
    c.fillText('왼쪽에서 DXF나 3DM 파일을 올리거나, 예시 대지를 불러오세요.', r.width / 2, r.height / 2); c.textAlign = 'left';
  }
  if (mode === 'draw' && drawPts.length) {
    poly(c, drawPts, false); c.strokeStyle = css('--accent'); c.lineWidth = 2; c.stroke();
    c.fillStyle = css('--accent'); drawPts.forEach(function (p) { var q = w2s(p); c.beginPath(); c.arc(q[0], q[1], 3.5, 0, 7); c.fill(); });
  }
  var sx = 20, sy = r.height - 22, len = 10 * view.s;
  c.strokeStyle = css('--ink'); c.lineWidth = 1.5; c.beginPath(); c.moveTo(sx, sy); c.lineTo(sx + len, sy); c.moveTo(sx, sy - 4); c.lineTo(sx, sy + 4); c.moveTo(sx + len, sy - 4); c.lineTo(sx + len, sy + 4); c.stroke();
  c.fillStyle = css('--ink'); c.font = '11px ' + css('--f-mono'); c.fillText('10 m', sx + len + 6, sy + 4);
}
var HINTS = {
  pick: '도면에서 대지 경계(닫힌 선) 안쪽을 클릭하세요.',
  draw: '대지 꼭짓점을 차례로 찍고 닫기를 누르세요. 선 끝점에 붙어요.',
  entry: '차가 들어오는 쪽 대지 경계 변을 클릭하세요.'
};
function setMode(m) {
  mode = m; drawPts = []; hoverPoly = null;
  $$('[data-mode]').forEach(function (b) { b.classList.toggle('on', b.dataset.mode === m); });
  $('#drawRow').hidden = m !== 'draw';
  $('#modeHint').textContent = HINTS[m];
  var box = $('#planPills'); box.innerHTML = '';
  box.appendChild(el('span', 'pill', HINTS[m])); box.appendChild(el('span', 'pill', '휠: 확대 · 드래그: 이동'));
  drawPlan();
}
$$('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { setMode(b.dataset.mode); }); });
function renderSiteInfo() {
  var d = $('#siteInfo'); d.innerHTML = '';
  function kv(k, v) { d.appendChild(el('dt', null, k)); d.appendChild(el('dd', null, v)); }
  if (!S.site) { kv('대지', dxf ? '경계를 골라 주세요' : '없음'); return; }
  kv('이름', S.site.name); kv('대지 면적', fmt(Math.abs(Core.area(S.site.poly)), 1) + '㎡'); kv('꼭짓점', S.site.poly.length + '개');
  if (S.site.entry != null) { var P = S.site.poly, a = P[S.site.entry], b = P[(S.site.entry + 1) % P.length]; kv('진입 변', fmt(Math.hypot(b[0] - a[0], b[1] - a[1]), 1) + 'm'); }
  else kv('진입 변', '아직 안 정함');
}
function setSite(localPoly) {
  var b = Core.bbox(localPoly), o = planOrigin(), upm = planUpm();
  var origin = [o[0] + b[0] * upm, o[1] + b[1] * upm];
  var P = Core.ccw(localPoly.map(function (p) { return [p[0] - b[0], p[1] - b[1]]; }));
  var L = dxfLocal();
  var src = L ? L.segs.map(function (s) { return [[s[0], s[1]], [s[2], s[3]]]; }) : (S.site ? S.site.segs : []);
  var bw = b[2] - b[0], bh = b[3] - b[1], w = Math.max(bw, bh) * 0.6 + 20, segs = [];
  src.forEach(function (s) {
    var a = [s[0][0] - b[0], s[0][1] - b[1]], c = [s[1][0] - b[0], s[1][1] - b[1]];
    if (Math.max(a[0], c[0]) < -w || Math.min(a[0], c[0]) > bw + w || Math.max(a[1], c[1]) < -w || Math.min(a[1], c[1]) > bh + w) return;
    segs.push([[+a[0].toFixed(3), +a[1].toFixed(3)], [+c[0].toFixed(3), +c[1].toFixed(3)]]);
  });
  S.site = { name: (dxf && dxf.name) || (S.site && S.site.name) || META.name, poly: P.map(function (p) { return [+p[0].toFixed(3), +p[1].toFixed(3)]; }), segs: segs.slice(0, 6000), entry: null, origin: origin, upm: upm };
  if (dxf) dxf._cache = null;
  var kept = S.alts.filter(isPicked).length;
  S.alts = S.alts.filter(isPicked); S.cur = null; undoStack = {}; redoStack = {};
  var gm = $('#genMsg'); gm.hidden = false; gm.className = 'msg';
  gm.textContent = '대지가 바뀌었어요. 진입 변을 정한 뒤 대안 만들기를 눌러 주세요.' + (kept ? ' 고른 안 ' + kept + '개는 남겨 뒀는데 새 대지에 안 맞을 수 있어요.' : '');
  siteChanged(); fitPlan(); setMode('entry');
}
function siteChanged() { renderSiteInfo(); drawPlan(); threeSiteDirty = true; save(); }

var drag = null;
plan.addEventListener('pointerdown', function (e) { plan.setPointerCapture(e.pointerId); drag = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty, moved: false }; });
plan.addEventListener('pointermove', function (e) {
  var r = plan.getBoundingClientRect();
  if (drag) {
    if (Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 4) drag.moved = true;
    if (drag.moved) { view.tx = drag.tx + e.clientX - drag.x; view.ty = drag.ty + e.clientY - drag.y; drawPlan(); }
    return;
  }
  if (mode === 'pick') { var h = polyAt(s2w(e.clientX - r.left, e.clientY - r.top)); if (h !== hoverPoly) { hoverPoly = h; drawPlan(); } }
});
plan.addEventListener('pointerup', function (e) {
  var d = drag; drag = null;
  if (!d || d.moved) return;
  var r = plan.getBoundingClientRect(), w = s2w(e.clientX - r.left, e.clientY - r.top);
  if (mode === 'pick') { var P = polyAt(w); if (P) setSite(P); }
  else if (mode === 'draw') { drawPts.push(snap(w)); drawPlan(); }
  else if (mode === 'entry' && S.site) {
    var best = -1, bd = 24 / view.s, Pp = S.site.poly;
    for (var i = 0; i < Pp.length; i++) { var dd = Core.distSeg(w, Pp[i], Pp[(i + 1) % Pp.length]); if (dd < bd) { bd = dd; best = i; } }
    if (best >= 0) { S.site.entry = best; siteChanged(); toast('진입 변을 정했어요. 대안 탭에서 대안을 만들어 보세요.'); }
  }
});
plan.addEventListener('wheel', function (e) {
  e.preventDefault();
  var r = plan.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, w = s2w(x, y), k = Math.exp(-e.deltaY * 0.0015);
  view.s *= k; view.tx = x - w[0] * view.s; view.ty = y + w[1] * view.s; drawPlan();
}, { passive: false });
function polyAt(w) {
  var L = dxfLocal(), cands = L ? L.polys : (S.site ? [S.site.poly] : []), best = null, ba = Infinity;
  cands.forEach(function (P) { if (Core.inPoly(w, P)) { var a = Math.abs(Core.area(P)); if (a < ba) { ba = a; best = P; } } });
  return best;
}
function snap(w) {
  var L = dxfLocal(), best = w, bd = 10 / view.s, pts = [];
  if (L) L.segs.forEach(function (s) { pts.push([s[0], s[1]], [s[2], s[3]]); });
  else if (S.site) { S.site.segs.forEach(function (s) { pts.push(s[0], s[1]); }); S.site.poly.forEach(function (p) { pts.push(p); }); }
  pts.forEach(function (p) { var d = Math.hypot(p[0] - w[0], p[1] - w[1]); if (d < bd) { bd = d; best = p; } });
  return [best[0], best[1]];
}
$('#drawDone').addEventListener('click', function () { if (drawPts.length >= 3) setSite(drawPts.slice()); });
$('#drawUndo').addEventListener('click', function () { drawPts.pop(); drawPlan(); });

function readPlanFile(file) {
  var is3dm = /\.3dm$/i.test(file.name), fr = new FileReader();
  $('#modeHint').textContent = '도면을 읽는 중…';
  fr.onload = function () {
    var p = is3dm ? Import3dm.read(fr.result) : Promise.resolve().then(function () { return Core.parseDXF(fr.result); });
    p.then(function (raw) {
      if (!raw || !raw.segs.length) throw new Error(is3dm ? '3dm에서 선을 찾지 못했어요.' : 'DXF에서 선을 찾지 못했어요. ASCII DXF로 다시 저장해 보세요.');
      var xs = [], ys = [];
      raw.segs.forEach(function (s) { xs.push(s[0], s[2]); ys.push(s[1], s[3]); });
      var minx = Math.min.apply(null, xs), miny = Math.min.apply(null, ys), ext = Math.max(Math.max.apply(null, xs) - minx, Math.max.apply(null, ys) - miny);
      var sel = $('#units').value, guess = raw.upm ? { upm: raw.upm, guessed: false } : Core.unitsPerMeter(raw.units, ext);
      dxf = { raw: raw, base: [minx, miny], upm: sel === 'auto' ? guess.upm : +sel, name: file.name.replace(/\.(dxf|3dm)$/i, '') };
      S.site = null;
      fitPlan(); setMode('pick'); renderSiteInfo(); drawPlan();
      $('#modeHint').textContent = '선 ' + raw.segs.length + '개, 닫힌 선 ' + raw.polys.length + '개를 읽었어요. ' + (guess.guessed ? '단위는 ' + (dxf.upm === 1000 ? 'mm' : 'm') + '로 짐작했어요. ' : '') + HINTS.pick;
    }).catch(function (err) { $('#modeHint').textContent = err.message + (is3dm ? ' 라이노에서 DXF로 내보내 올려도 돼요.' : ''); });
  };
  if (is3dm) fr.readAsArrayBuffer(file); else fr.readAsText(file);
}
$('#planFile').addEventListener('change', function (e) { if (e.target.files[0]) readPlanFile(e.target.files[0]); e.target.value = ''; });
var drop = $('#drop');
['dragenter', 'dragover'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
['dragleave', 'drop'].forEach(function (t) { drop.addEventListener(t, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
drop.addEventListener('drop', function (e) { var f = e.dataTransfer.files[0]; if (f) readPlanFile(f); });
$('#units').addEventListener('change', function () {
  if (!dxf) return;
  var v = $('#units').value;
  dxf.upm = v === 'auto' ? (dxf.raw.upm || Core.unitsPerMeter(dxf.raw.units, 1e9).upm) : +v; dxf._cache = null;
  fitPlan(); drawPlan();
});
$('#loadSample').addEventListener('click', function () { dxf = null; S.site = sampleSite(); S.alts = S.alts.filter(isPicked); view.fitted = false; fitPlan(); setMode('pick'); siteChanged(); toast('예시 대지(성성동 44-9)를 불러왔어요.'); });

['maxH', 'setback', 'yardD', 'yardW', 'S', 'W', 'R'].forEach(function (k) {
  var inp = $('#p-' + k);
  inp.addEventListener('change', function () {
    var v = parseFloat(inp.value);
    if (!(v >= 0)) { inp.value = S.prog[k]; return; }
    S.prog[k] = v; progSum(); threeSiteDirty = true; drawPlan(); save();
  });
});
function fillProg() { ['maxH', 'setback', 'yardD', 'yardW', 'S', 'W', 'R'].forEach(function (k) { $('#p-' + k).value = S.prog[k]; }); progSum(); }
function progSum() { $('#progSum').textContent = '합계 ' + fmt(S.prog.S + S.prog.W + S.prog.R) + '㎡. 숫자를 바꾼 뒤엔 대안을 새로 만들어 주세요.'; if (S && $('#moveAllRow')) renderMode(); }

/* =====================================================================
   2. GENERATE
   ===================================================================== */
function renderMode() {
  $$('[data-setmode]').forEach(function (b) { var on = b.dataset.setmode === S.mode; b.classList.toggle('on', on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); });
  var t = S.prog.S + S.prog.W + S.prog.R;
  $$('.modeNote').forEach(function (e) { e.textContent = S.mode === 'one' ? '합계 ' + fmt(t) + '㎡을 하나로 이어진 매스로 만들어요. 형태만 바꿔 가며 스터디해요.' : 'Storage · Work · Rest를 각각 따로 된 덩어리로 배치해요.'; });
  $('#moveAllRow').hidden = S.mode !== 'one';
}
$$('[data-setmode]').forEach(function (b) { b.addEventListener('click', function () {
  if (S.mode === b.dataset.setmode) return;
  S.mode = b.dataset.setmode; renderMode(); save();
  var gm = $('#genMsg'); gm.hidden = false; gm.className = 'msg'; gm.textContent = (S.mode === 'one' ? '한 덩어리' : '세 덩어리') + ' 모드로 바꿨어요. 대안 만들기를 누르면 이 방식으로 새로 만들어요.';
}); });
function renderFamCounts() {
  var box = $('#famCounts'); box.innerHTML = '';
  FAMS.forEach(function (f) {
    var row = el('div', 'field'), lab = el('label', null, f.k + '  ' + f.ko), inp = el('input');
    lab.htmlFor = 'cnt-' + f.k; inp.id = 'cnt-' + f.k; inp.type = 'number'; inp.min = 0; inp.max = 30; inp.value = S.counts[f.k];
    inp.addEventListener('change', function () { S.counts[f.k] = Math.max(0, Math.min(30, parseInt(inp.value, 10) || 0)); inp.value = S.counts[f.k]; save(); });
    row.appendChild(lab); row.appendChild(inp); box.appendChild(row);
  });
}
function generate(seed, quiet) {
  var gm = $('#genMsg');
  if (!S.site) { gm.hidden = false; gm.className = 'msg bad'; gm.textContent = '먼저 대지 탭에서 대지를 정해 주세요.'; return; }
  var keep = S.alts.filter(isPicked), start = {};
  S.alts.forEach(function (a) { start[a.fam] = Math.max(start[a.fam] || 0, a.num); });
  keep.forEach(function (a) { start[a.fam] = Math.max(start[a.fam] || 0, a.num); });
  var r = Core.generate(S.site, S.prog, FAMS.map(function (f) { return { k: f.k, n: S.counts[f.k] }; }), seed || (Date.now() % 1e9), start, S.mode);
  r.alts.forEach(function (a) { a.id = uid(); });
  S.alts = keep.concat(r.alts);
  if (!altById(S.cur)) S.cur = S.alts.length ? sortedAlts()[0].id : null;
  if (r.fails) { gm.hidden = false; gm.className = 'msg bad'; gm.textContent = r.fails + '개는 조건을 맞춰 놓지 못했어요. 진입 마당이나 이격을 줄이면 더 나와요.'; }
  else if (!quiet) { gm.hidden = false; gm.className = 'msg'; gm.textContent = r.alts.length + '개를 새로 만들었어요.'; }
  renderCards(); save();
}
$('#genBtn').addEventListener('click', function () {
  var b = $('#genBtn'); b.disabled = true; b.textContent = '만드는 중…';
  setTimeout(function () { generate(); b.disabled = false; b.textContent = '대안 만들기'; }, 20);
});
$('#onlyPicked').addEventListener('click', function () { S.onlyPicked = !S.onlyPicked; renderCards(); save(); });
$('#colorMode2').addEventListener('click', function () { S.colorMode = !S.colorMode; renderCards(); save(); });
function renderFilter() {
  var box = $('#famFilter'); box.innerHTML = '';
  [{ k: 'all', ko: '전체' }].concat(FAMS).forEach(function (f) {
    var n = f.k === 'all' ? S.alts.length : S.alts.filter(function (a) { return a.fam === f.k; }).length;
    var b = el('button', 'chip', (f.k === 'all' ? '' : f.k + ' ') + f.ko + ' ' + n);
    b.setAttribute('aria-pressed', S.filter === f.k ? 'true' : 'false');
    b.addEventListener('click', function () { S.filter = f.k; renderCards(); save(); });
    box.appendChild(b);
  });
}
function renderCards() {
  if (!S || S.tab !== 'gen') return;
  var box = $('#cards'); box.innerHTML = '';
  [['#onlyPicked', S.onlyPicked], ['#colorMode2', S.colorMode]].forEach(function (x) { $(x[0]).classList.toggle('on', x[1]); $(x[0]).setAttribute('aria-pressed', x[1] ? 'true' : 'false'); });
  if (!S.site) { $('#famFilter').innerHTML = ''; box.appendChild(el('div', 'empty', '먼저 대지 탭에서 대지를 정해 주세요.')); return; }
  renderFilter();
  var list = sortedAlts().filter(function (a) { return (S.filter === 'all' || a.fam === S.filter) && (!S.onlyPicked || isPicked(a)); });
  if (!list.length) box.appendChild(el('div', 'empty', S.alts.length ? '조건에 맞는 대안이 없어요.' : '왼쪽에서 대안 만들기를 눌러 시작하세요.'));
  var nOk = 0;
  list.forEach(function (a) {
    var ck = check(a), good = ck.ok && ck.areaOk; if (good) nOk++;
    var card = el('div', 'card' + (isPicked(a) ? ' picked' : ''));
    var cv = el('canvas'); cv.title = '편집하기'; cv.setAttribute('role', 'button'); cv.tabIndex = 0; cv.setAttribute('aria-label', code(a) + ' 편집');
    function go() { S.cur = a.id; selPiece = -1; selSet = []; setTab('edit'); save(); }
    cv.addEventListener('click', go); cv.addEventListener('keydown', function (e) { if (e.key === 'Enter') go(); });
    var cap = el('div', 'cap');
    var dot = el('span', 'dot' + (good ? '' : ' bad')); dot.title = good ? '조건 통과' : '조건 확인 필요';
    cap.appendChild(dot); cap.appendChild(el('span', 'code', code(a))); cap.appendChild(el('span', 'nm', a.name));
    var st = el('button', 'star', '★'); st.setAttribute('aria-pressed', isPicked(a) ? 'true' : 'false'); st.setAttribute('aria-label', code(a) + ' 고르기');
    st.addEventListener('click', function () { togglePick(a); card.classList.toggle('picked', isPicked(a)); st.setAttribute('aria-pressed', isPicked(a) ? 'true' : 'false'); renderGenInfo(list.length, nOk); });
    cap.appendChild(st); card.appendChild(cv); card.appendChild(cap); box.appendChild(card);
    requestAnimationFrame(function () { thumb(cv, a.pieces); });
  });
  renderGenInfo(list.length, nOk);
}
function renderGenInfo(n, ok) {
  var g = $('#genInfo'); g.innerHTML = '';
  [['보이는 대안', n + '개'], ['조건 통과', ok + '개'], ['고른 안', S.picks.length + '개']].forEach(function (kv) { g.appendChild(el('dt', null, kv[0])); g.appendChild(el('dd', null, kv[1])); });
}
function togglePick(a) { var i = S.picks.indexOf(a.id); if (i >= 0) S.picks.splice(i, 1); else S.picks.push(a.id); save(); }

/* =====================================================================
   3. EDIT
   ===================================================================== */
var three = null, threeSiteDirty = true;
function T(p) { return new THREE.Vector3(p[0], p[2], -p[1]); }
function pieceGeom(p) {
  var pos = [];
  Core.faces(p).forEach(function (f) { Export.triangulate(f, Axon.newell(f)).forEach(function (t) { t.forEach(function (q) { pos.push(q[0], q[2], -q[1]); }); }); });
  var g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  return g;
}
function initThree() {
  if (three) return;
  if (!window.THREE || !THREE.OrbitControls) { $('#editPills').innerHTML = ''; $('#editPills').appendChild(el('span', 'pill', '3D 화면을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.')); return; }
  var box = $('#three');
  var renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  box.appendChild(renderer.domElement);
  var scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(32, 1, 0.5, 3000);
  var controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true; controls.dampingFactor = 0.12; controls.maxPolarAngle = Math.PI / 2 - 0.02;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 0.78));
  var sun = new THREE.DirectionalLight(0xffffff, 0.55); sun.position.set(-45, 62, 65); scene.add(sun);
  var siteG = new THREE.Group(), massG = new THREE.Group(); scene.add(siteG); scene.add(massG);
  three = { renderer: renderer, scene: scene, camera: camera, controls: controls, siteG: siteG, massG: massG, meshes: [] };
  function resize() { var r = box.getBoundingClientRect(); if (!r.width) return; renderer.setSize(r.width, r.height); camera.aspect = r.width / r.height; camera.updateProjectionMatrix(); }
  new ResizeObserver(resize).observe(box); resize();
  (function loop() { requestAnimationFrame(loop); if (S.tab !== 'edit') return; controls.update(); renderer.render(scene, camera); })();
  bindDrag();
  ['덩어리 끌기: 이동', '빈 곳 끌기: 돌려 보기', '오른쪽 끌기: 화면 이동', '휠: 확대'].forEach(function (t) { $('#editPills').appendChild(el('span', 'pill', t)); });
}
function disposeGroup(g) { while (g.children.length) { var c = g.children.pop(); if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); } }
function buildSite() {
  if (!three || !S.site) return;
  var g = three.siteG; disposeGroup(g);
  var shp = new THREE.Shape(S.site.poly.map(function (p) { return new THREE.Vector2(p[0], p[1]); }));
  var m = new THREE.Mesh(new THREE.ShapeGeometry(shp), new THREE.MeshBasicMaterial({ color: new THREE.Color(css('--raise')), transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.y = -0.02; g.add(m);
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(S.site.poly.concat([S.site.poly[0]]).map(function (p) { return T([p[0], p[1], 0.01]); })), new THREE.LineBasicMaterial({ color: new THREE.Color(css('--site')) })));
  var sp = []; S.site.segs.forEach(function (s) { sp.push(T([s[0][0], s[0][1], 0]), T([s[1][0], s[1][1], 0])); });
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sp), new THREE.LineBasicMaterial({ color: new THREE.Color(css('--ctx')) })));
  var Y = Core.yardPoly(S.site, S.prog);
  if (Y) { var yl = new THREE.Line(new THREE.BufferGeometry().setFromPoints(Y.concat([Y[0]]).map(function (p) { return T([p[0], p[1], 0.03]); })), new THREE.LineDashedMaterial({ color: new THREE.Color(css('--yard')), dashSize: 0.8, gapSize: 0.5 })); yl.computeLineDistances(); g.add(yl); }
  three.renderer.setClearColor(new THREE.Color(css('--stage')));
  threeSiteDirty = false;
  setView('axo');
}
function setView(v) {
  if (!three || !S.site) return;
  var b = Core.bbox(S.site.poly), cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, rr = Math.hypot(b[2] - b[0], b[3] - b[1]) / 2 + 4;
  var tgt = T([cx, cy, 2]); three.controls.target.copy(tgt);
  var dist = rr / Math.tan(16 * Math.PI / 180) * 0.95, D = Axon.D;
  if (v === 'top') three.camera.position.copy(tgt).add(new THREE.Vector3(0, dist, 0.01));
  else three.camera.position.copy(tgt).add(new THREE.Vector3(D[0], D[2], -D[1]).multiplyScalar(dist));
  three.camera.updateProjectionMatrix();
}
$('#viewAxo').addEventListener('click', function () { setView('axo'); });
$('#viewTop').addEventListener('click', function () { setView('top'); });
$('#colorMode').addEventListener('click', function () { S.colorMode = !S.colorMode; refreshEdit(); save(); });

function curAlt() { return altById(S.cur); }
function buildMasses() {
  if (!three) return;
  var a = curAlt(), g = three.massG; disposeGroup(g); three.meshes = [];
  if (!a) return;
  var ck = check(a), selC = new THREE.Color(css('--sel')), badC = new THREE.Color(css('--bad'));
  var bodies = {}, order = [];
  Union.solids(a.pieces).forEach(function (f) {
    var key = f.group ? 'U' + f.group : 'P' + f.pi;
    if (!bodies[key]) { bodies[key] = { pi: f.pi, group: f.group, faces: [] }; order.push(key); }
    bodies[key].faces.push(f);
  });
  order.forEach(function (key) {
    var B = bodies[key], p = a.pieces[B.pi], pos = [], lines = [];
    var members = B.group ? a.pieces.map(function (q, k) { return q.u === B.group ? k : -1; }).filter(function (k) { return k >= 0; }) : [B.pi];
    B.faces.forEach(function (f) {
      Export.triangulate(f.v, f.n).forEach(function (t) { t.forEach(function (q) { pos.push(q[0], q[2], -q[1]); }); });
      f.v.forEach(function (q, i) { if (!f.edges[i]) return; var r = f.v[(i + 1) % f.v.length]; lines.push(q[0], q[2], -q[1], r[0], r[2], -r[1]); });
    });
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.computeVertexNormals();
    var col = S.colorMode ? GROUPS[p.g].color : Axon.FOAM;
    var mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(col), side: THREE.DoubleSide, transparent: p.g === 'roof', opacity: p.g === 'roof' ? 0.75 : 1, flatShading: true });
    var isSel = members.some(function (k) { return k === selPiece || selSet.indexOf(k) >= 0; });
    var bad = members.some(function (k) { return ck.bad[k]; });
    if (isSel) mat.emissive = new THREE.Color(0x4a3000);
    var m = new THREE.Mesh(geo, mat); m.userData.idx = B.pi; m.userData.group = B.group || null; g.add(m); three.meshes.push(m);
    var lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: isSel ? selC : bad ? badC : new THREE.Color(Axon.EDGE) })));
  });
}
function bindDrag() {
  var dom = three.renderer.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(), hit = new THREE.Vector3(), st = null;
  function setNdc(e) { var r = dom.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); ray.setFromCamera(ndc, three.camera); }
  dom.addEventListener('pointerdown', function (e) {
    if (e.button !== 0) return;
    setNdc(e);
    var hits = ray.intersectObjects(three.meshes, false);
    if (!hits.length) { st = { empty: true, x: e.clientX, y: e.clientY }; return; }
    var i = hits[0].object.userData.idx, grp = hits[0].object.userData.group, a = curAlt(), p = a.pieces[i];
    var gm = grp ? a.pieces.map(function (q, k) { return q.u === grp ? k : -1; }).filter(function (k) { return k >= 0; }) : [i];
    if (e.shiftKey || e.ctrlKey || e.metaKey) {
      if (selSet.length === 0 && selPiece >= 0) selSet = [selPiece];
      if (selSet.indexOf(i) >= 0) selSet = selSet.filter(function (k) { return gm.indexOf(k) < 0; });
      else gm.forEach(function (k) { if (selSet.indexOf(k) < 0) selSet.push(k); });
      selPiece = selSet.length ? selSet[selSet.length - 1] : -1;
      e.stopImmediatePropagation(); e.preventDefault(); refreshEdit(); return;
    }
    if (selSet.indexOf(i) < 0) selSet = gm.slice();
    selPiece = i;
    plane.set(new THREE.Vector3(0, 1, 0), -p.z);
    if (!ray.ray.intersectPlane(plane, hit)) return;
    pushUndo(a);
    var group = selSet.length > 1 ? selSet.slice() : (S.mode === 'one' && $('#moveAll').checked ? a.pieces.map(function (_, k) { return k; }) : null);
    st = { i: i, sx: hit.x, sz: hit.z, px: p.x, py: p.y, moved: false, all: !!group, start: a.pieces.map(function (q, k) { return !group || group.indexOf(k) >= 0 ? [q.x, q.y] : null; }) };
    three.controls.enabled = false; dom.setPointerCapture(e.pointerId);
    e.stopImmediatePropagation(); e.preventDefault();
    refreshEdit();
  }, true);
  dom.addEventListener('pointermove', function (e) {
    if (!st || st.empty) return;
    setNdc(e);
    if (!ray.ray.intersectPlane(plane, hit)) return;
    var ps = curAlt().pieces, p = ps[st.i];
    var dx = Math.round((hit.x - st.sx) * 4) / 4, dy = Math.round(-(hit.z - st.sz) * 4) / 4;
    if (st.px + dx === p.x && st.py + dy === p.y) return;
    if (st.all) ps.forEach(function (q, k) { if (st.start[k]) { q.x = st.start[k][0] + dx; q.y = st.start[k][1] + dy; } });
    else { p.x = st.px + dx; p.y = st.py + dy; }
    st.moved = true; schedule();
  });
  function up(e) {
    if (!st) return;
    if (st.empty) { if (Math.abs(e.clientX - st.x) + Math.abs(e.clientY - st.y) < 4) { selPiece = -1; selSet = []; refreshEdit(); } }
    else { three.controls.enabled = true; if (!st.moved) undoStack[S.cur].pop(); else save(); }
    st = null;
  }
  dom.addEventListener('pointerup', up); dom.addEventListener('pointercancel', up);
}
var raf = 0;
function schedule() { if (raf) return; raf = requestAnimationFrame(function () { raf = 0; refreshEdit(); }); }
function pushUndo(a) { (undoStack[a.id] = undoStack[a.id] || []).push(JSON.stringify(a.pieces)); if (undoStack[a.id].length > 80) undoStack[a.id].shift(); redoStack[a.id] = []; }
function editMsg(t, bad) { var m = $('#editMsg'); m.hidden = !t; m.className = 'msg' + (bad ? ' bad' : ''); m.textContent = t || ''; }

function openEdit() {
  if (!S.site || !S.alts.length) { $('#eCode').textContent = '—'; $('#eName').textContent = S.site ? '대안이 아직 없어요' : '대지를 먼저 정해 주세요'; $('#checks').innerHTML = ''; $('#pieces').innerHTML = ''; if (three) disposeGroup(three.massG); return; }
  if (!curAlt()) S.cur = sortedAlts()[0].id;
  if (threeSiteDirty) buildSite();
  editMsg('');
  refreshEdit();
}
function refreshEdit() {
  var a = curAlt(); if (!a) return;
  if (selPiece >= a.pieces.length) selPiece = -1;
  selSet = selSet.filter(function (k) { return k < a.pieces.length; });
  $('#eCode').textContent = code(a); $('#eName').textContent = a.name;
  var pk = $('#ePick'); pk.setAttribute('aria-pressed', isPicked(a) ? 'true' : 'false'); pk.classList.toggle('on', isPicked(a)); pk.textContent = isPicked(a) ? '★ 고른 안' : '☆ 고르기';
  $('#eFam').value = a.fam;
  $('#colorMode').classList.toggle('on', S.colorMode); $('#colorMode').setAttribute('aria-pressed', S.colorMode ? 'true' : 'false');
  var ck = check(a), box = $('#checks'); box.innerHTML = '';
  function row(k, v, ok) { box.appendChild(el('span', null, k)); box.appendChild(el('span', 'v', v)); box.appendChild(el('span', ok == null ? '' : ok ? 'ok' : 'no', ok == null ? '' : ok ? '✓' : '✕')); }
  if (ck.one) {
    row('연면적 합계', fmt(ck.areas.M, 1) + ' / ' + fmt(ck.total) + '㎡', Math.abs(ck.areas.M - ck.total) <= ck.total * 0.05);
    row('한 덩어리', ck.connected ? '이어짐' : '떨어진 덩어리 있음', ck.connected);
  } else ['S', 'W', 'R'].forEach(function (g) { row(GROUPS[g].ko, fmt(ck.areas[g], 1) + ' / ' + fmt(S.prog[g]) + '㎡', Math.abs(ck.areas[g] - S.prog[g]) <= S.prog[g] * 0.05); });
  row('최고 높이', fmt(ck.hmax, 1) + ' / ' + fmt(S.prog.maxH, 1) + 'm', ck.height);
  row('대지 안 · 이격', ck.inside ? '들어감' : '벗어남', ck.inside);
  row('겹침', ck.overlap ? '있음' : '없음', !ck.overlap);
  if (S.site.entry != null) { row('진입 마당', ck.yard ? '비어 있음' : '막힘', ck.yard); if (ck.one) row('마당까지', ck.near == null ? '—' : fmt(ck.near, 1) + 'm', null); else row('창고까지', ck.near == null ? '—' : fmt(ck.near, 1) + 'm', ck.near == null ? null : ck.near <= 3); }
  var pl = $('#pieces'); pl.innerHTML = '';
  var shownU = {};
  a.pieces.forEach(function (p, i) {
    var members = p.u ? a.pieces.map(function (q, k) { return q.u === p.u ? k : -1; }).filter(function (k) { return k >= 0; }) : [i];
    if (p.u && members.length > 1) { if (shownU[p.u]) return; shownU[p.u] = 1; }
    var grouped = members.length > 1;
    var on = members.some(function (k) { return k === selPiece || selSet.indexOf(k) >= 0; });
    var it = el('button', 'pc' + (on ? ' sel' : ''));
    var sw = el('span', 'sw'); sw.style.background = GROUPS[p.g].color; it.appendChild(sw);
    var rk = ROOFS.filter(function (r) { return r.k === p.r; })[0];
    if (grouped) {
      var gA = 0, gH = 0; members.forEach(function (k) { var q = a.pieces[k]; gA += q.l * q.d; gH = Math.max(gH, q.z + q.h); });
      it.appendChild(el('span', null, GROUPS[p.g].ko + ' · 이어진 덩어리 (' + members.length + '개 합침)'));
      it.appendChild(el('span', 'v', fmt(gA, 1) + '㎡ · H' + fmt(gH, 1)));
    } else {
      it.appendChild(el('span', null, GROUPS[p.g].ko + (p.g === 'roof' ? '' : ' · ' + (rk ? rk.ko : ''))));
      it.appendChild(el('span', 'v', p.g === 'roof' ? fmt(p.l, 1) + '×' + fmt(p.d, 1) : fmt(p.l * p.d, 1) + '㎡ · H' + fmt(p.z + p.h, 1)));
    }
    it.addEventListener('click', function (ev) {
      if (ev.shiftKey || ev.ctrlKey || ev.metaKey) {
        if (selSet.length === 0 && selPiece >= 0) selSet = [selPiece];
        if (on) selSet = selSet.filter(function (k) { return members.indexOf(k) < 0; });
        else members.forEach(function (k) { if (selSet.indexOf(k) < 0) selSet.push(k); });
        selPiece = selSet.length ? selSet[selSet.length - 1] : -1;
      } else if (on && selSet.length <= members.length) { selPiece = -1; selSet = []; }
      else { selPiece = members[members.length - 1]; selSet = members.slice(); }
      refreshEdit();
    });
    pl.appendChild(it);
  });
  var multi = selSet.length > 1;
  $('#multiTools').hidden = !multi;
  if (multi) {
    var tA = 0; selSet.forEach(function (k) { var q = a.pieces[k]; if (q.g !== 'roof') tA += q.l * q.d; });
    var merged = selSet.every(function (k) { return a.pieces[k].u && a.pieces[k].u === a.pieces[selSet[0]].u; });
    $('#multiInfo').textContent = (merged ? '합친 덩어리 · ' : '') + selSet.length + '개 골랐어요 · 바닥면적 합계 ' + fmt(tA, 1) + '㎡';
    $('#unmergeSel').hidden = !selSet.some(function (k) { return a.pieces[k].u; });
  }
  var has = selPiece >= 0 && !multi;
  $('#pieceTools').hidden = !has;
  if (has) {
    var p = a.pieces[selPiece];
    $$('#insp input[data-k]').forEach(function (inp) { if (document.activeElement !== inp) inp.value = +(+p[inp.dataset.k]).toFixed(2); });
    if (document.activeElement !== $('#iArea')) $('#iArea').value = +(p.l * p.d).toFixed(1);
    $('#eRoof').value = p.r; $('#eGroup').value = p.g;
  }
  $('#undo').disabled = !(undoStack[a.id] && undoStack[a.id].length);
  $('#redo').disabled = !(redoStack[a.id] && redoStack[a.id].length);
  buildMasses();
}
function fillSelects() {
  var f = $('#eFam'); FAMS.forEach(function (x) { var o = el('option', null, x.k + ' ' + x.ko); o.value = x.k; f.appendChild(o); });
  var r = $('#eRoof'); ROOFS.forEach(function (x) { var o = el('option', null, x.ko); o.value = x.k; r.appendChild(o); });
  var g = $('#eGroup'); ['M', 'S', 'W', 'R', 'roof'].forEach(function (k) { var o = el('option', null, GROUPS[k].ko); o.value = k; g.appendChild(o); });
}
function setFam(a, fam) { if (a.fam === fam) return; a.num = nextNum(fam); a.fam = fam; save(); }
$('#eFam').addEventListener('change', function () { var a = curAlt(); if (a) { setFam(a, $('#eFam').value); refreshEdit(); } });
$('#ePick').addEventListener('click', function () { var a = curAlt(); if (a) { togglePick(a); refreshEdit(); } });
function step(dir) {
  var L = sortedAlts(); if (!L.length) return;
  var i = L.findIndex(function (a) { return a.id === S.cur; });
  S.cur = L[(i + dir + L.length) % L.length].id; selPiece = -1; selSet = []; editMsg(''); refreshEdit(); save();
}
$('#prevAlt').addEventListener('click', function () { step(-1); });
$('#nextAlt').addEventListener('click', function () { step(1); });
function addAlt(base, pieces, name) {
  if (S.mode === 'one' && !pieces.some(function (q) { return q.u; })) Core.linkTouching(pieces, 'u' + Date.now().toString(36));
  var n = { id: uid(), fam: base.fam, num: nextNum(base.fam), name: name, pieces: pieces, orig: JSON.stringify(pieces) };
  S.alts.push(n); return n;
}
$('#varyBtn').addEventListener('click', function () {
  var a = curAlt(); if (!a) return;
  var vs = Core.vary(a, S.site, S.prog, (Date.now() % 1e9), 5);
  if (!vs.length) { editMsg('조건을 지키는 변형을 찾지 못했어요. 덩어리를 조금 옮긴 뒤 다시 해 보세요.', true); return; }
  var base = a.name.replace(/ 변형$/, '');
  var made = vs.map(function (ps) { return addAlt(a, ps, base + ' 변형'); });
  editMsg(made.map(code).join(', ') + '를 만들었어요. ▶로 넘겨 보세요.');
  save(); refreshEdit();
});
$('#dupAlt').addEventListener('click', function () { var a = curAlt(); if (!a) return; var n = addAlt(a, JSON.parse(JSON.stringify(a.pieces)), a.name); S.cur = n.id; selPiece = -1; selSet = []; editMsg(code(n) + '로 복제했어요.'); save(); refreshEdit(); });
$('#delAlt').addEventListener('click', function () {
  var a = curAlt(); if (!a) return;
  ask(code(a) + ' 안을 지울까요? 되돌릴 수 없어요.', '지우기').then(function (ok) {
    if (!ok) return;
    var L = sortedAlts(), i = L.findIndex(function (x) { return x.id === a.id; });
    S.alts = S.alts.filter(function (x) { return x.id !== a.id; }); S.picks = S.picks.filter(function (x) { return x !== a.id; });
    var nx = L[i + 1] || L[i - 1]; S.cur = nx && nx.id !== a.id ? nx.id : null; selPiece = -1; selSet = []; save(); openEdit();
  });
});
$('#mergeSel').addEventListener('click', function () {
  var a = curAlt(); if (!a || selSet.length < 2) return;
  var ids = {}; selSet.forEach(function (k) { if (a.pieces[k].u) ids[a.pieces[k].u] = 1; });
  var idx = a.pieces.map(function (q, k) { return selSet.indexOf(k) >= 0 || (q.u && ids[q.u]) ? k : -1; }).filter(function (k) { return k >= 0; });
  var body = idx.map(function (k) { return a.pieces[k]; }).filter(function (q) { return q.g !== 'roof'; });
  if (body.length < 2) { editMsg('합칠 덩어리를 두 개 이상 골라 주세요.', true); return; }
  if (!Core.touching(body)) { editMsg('맞닿지 않은 덩어리가 있어요. 먼저 서로 붙이기를 누른 다음 합쳐 주세요.', true); return; }
  pushUndo(a);
  var id = 'u' + Date.now().toString(36);
  idx.forEach(function (k) { if (a.pieces[k].g !== 'roof') a.pieces[k].u = id; });
  selSet = idx; selPiece = idx[idx.length - 1];
  editMsg(body.length + '개 덩어리의 맞닿은 면을 합쳤어요. 이제 한 덩어리처럼 보이고 같이 움직여요.');
  refreshEdit(); save();
});
$('#unmergeSel').addEventListener('click', function () {
  var a = curAlt(); if (!a) return;
  var ids = {}; selSet.forEach(function (k) { if (a.pieces[k] && a.pieces[k].u) ids[a.pieces[k].u] = 1; });
  if (!Object.keys(ids).length) { editMsg('고른 덩어리 중에 합친 게 없어요.', true); return; }
  pushUndo(a);
  a.pieces.forEach(function (q) { if (q.u && ids[q.u]) delete q.u; });
  editMsg('합친 걸 풀었어요. 이제 덩어리를 하나씩 고칠 수 있어요.');
  refreshEdit(); save();
});
$('#snapSel').addEventListener('click', function () {
  var a = curAlt(); if (!a || selSet.length < 2) return;
  pushUndo(a);
  var order = [selPiece].concat(selSet.filter(function (k) { return k !== selPiece; }));
  var snapped = Core.snapTogether(order.map(function (k) { return a.pieces[k]; }));
  order.forEach(function (k, j) { a.pieces[k] = snapped[j]; });
  editMsg('마지막으로 고른 덩어리 쪽으로 나머지를 붙였어요.');
  refreshEdit(); save();
});
$('#clearSel').addEventListener('click', function () { selPiece = -1; selSet = []; refreshEdit(); });
$('#selAll').addEventListener('click', function () { var a = curAlt(); if (!a) return; selSet = a.pieces.map(function (_, k) { return k; }); selPiece = selSet.length - 1; refreshEdit(); });
function rotAll(deg) {
  var a = curAlt(); if (!a) return;
  pushUndo(a);
  var c = [0, 0]; a.pieces.forEach(function (p) { c[0] += p.x / a.pieces.length; c[1] += p.y / a.pieces.length; });
  var cr = Math.cos(deg * Math.PI / 180), sr = Math.sin(deg * Math.PI / 180);
  a.pieces.forEach(function (p) { var dx = p.x - c[0], dy = p.y - c[1]; p.x = Math.round((c[0] + cr * dx - sr * dy) * 1000) / 1000; p.y = Math.round((c[1] + sr * dx + cr * dy) * 1000) / 1000; p.a = ((p.a + deg) % 360 + 360) % 360; });
  refreshEdit(); save();
}
$('#rotAllL').addEventListener('click', function () { rotAll(15); });
$('#rotAllR').addEventListener('click', function () { rotAll(-15); });
function act(kind) {
  var a = curAlt(); if (!a || selPiece < 0) return;
  var p = a.pieces[selPiece];
  pushUndo(a);
  switch (kind) {
    case 'rot-': p.a = (p.a - 15 + 360) % 360; break;
    case 'rot+': p.a = (p.a + 15) % 360; break;
    case 'rot5-': p.a = (p.a - 5 + 360) % 360; break;
    case 'rot5+': p.a = (p.a + 5) % 360; break;
    case 'dup': a.pieces.push(Object.assign({}, p, { x: p.x + 2, y: p.y - 2 })); selPiece = a.pieces.length - 1; break;
    case 'del': a.pieces.splice(selPiece, 1); selPiece = -1; selSet = []; break;
    case 'left': case 'right': case 'up': case 'down':
      var mv = { left: [-0.5, 0], right: [0.5, 0], up: [0, 0.5], down: [0, -0.5] }[kind];
      (S.mode === 'one' && $('#moveAll').checked ? a.pieces : [p]).forEach(function (q) { q.x += mv[0]; q.y += mv[1]; });
      break;
  }
  refreshEdit(); save();
}
$$('#pieceTools [data-act]').forEach(function (b) { b.addEventListener('click', function () { act(b.dataset.act); }); });
$$('#insp input[data-k]').forEach(function (inp) {
  inp.addEventListener('change', function () {
    var a = curAlt(); if (!a || selPiece < 0) return;
    var p = a.pieces[selPiece], k = inp.dataset.k, v = parseFloat(inp.value);
    if (!isFinite(v)) { refreshEdit(); return; }
    pushUndo(a);
    var area = p.l * p.d, lock = $('#lockArea').checked && p.g !== 'roof';
    if (k === 'l') { p.l = Math.max(1, v); if (lock) p.d = area / p.l; }
    else if (k === 'd') { p.d = Math.max(1, v); if (lock) p.l = area / p.d; }
    else if (k === 'h') p.h = Math.max(0.2, v);
    else if (k === 'z') p.z = Math.max(0, v);
    else if (k === 'a') p.a = ((v % 360) + 360) % 360;
    else p[k] = v;
    ['l', 'd', 'h', 'z', 'x', 'y', 'a'].forEach(function (q) { p[q] = Math.round(p[q] * 1000) / 1000; });
    refreshEdit(); save();
  });
});
$('#iArea').addEventListener('change', function () {
  var a = curAlt(); if (!a || selPiece < 0) return;
  var p = a.pieces[selPiece], v = parseFloat($('#iArea').value);
  if (!(v > 0)) { refreshEdit(); return; }
  pushUndo(a);
  var k = Math.sqrt(v / (p.l * p.d)); p.l = Math.round(p.l * k * 1000) / 1000; p.d = Math.round(p.d * k * 1000) / 1000;
  refreshEdit(); save();
});
$('#eRoof').addEventListener('change', function () { var a = curAlt(); if (!a || selPiece < 0) return; pushUndo(a); a.pieces[selPiece].r = $('#eRoof').value; refreshEdit(); save(); });
$('#eGroup').addEventListener('change', function () { var a = curAlt(); if (!a || selPiece < 0) return; pushUndo(a); a.pieces[selPiece].g = $('#eGroup').value; refreshEdit(); save(); });
function undo() { var a = curAlt(), st = a && undoStack[a.id]; if (st && st.length) { (redoStack[a.id] = redoStack[a.id] || []).push(JSON.stringify(a.pieces)); a.pieces = JSON.parse(st.pop()); selPiece = -1; selSet = []; refreshEdit(); save(); } }
function redo() { var a = curAlt(), st = a && redoStack[a.id]; if (st && st.length) { (undoStack[a.id] = undoStack[a.id] || []).push(JSON.stringify(a.pieces)); a.pieces = JSON.parse(st.pop()); selPiece = -1; selSet = []; refreshEdit(); save(); } }
$('#undo').addEventListener('click', undo); $('#redo').addEventListener('click', redo);
$('#resetAlt').addEventListener('click', function () { var a = curAlt(); if (!a || !a.orig) return; pushUndo(a); a.pieces = JSON.parse(a.orig); selPiece = -1; selSet = []; refreshEdit(); save(); });
document.addEventListener('keydown', function (e) {
  if (!S || S.tab !== 'edit' || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName) || !$('#dlgConfirm').hidden) return;
  var k = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key];
  if (k && selPiece < 0 && S.mode === 'one' && $('#moveAll').checked && !e.shiftKey) { e.preventDefault(); selPiece = 0; act(k); selPiece = -1; selSet = []; refreshEdit(); }
  else if (k && selPiece >= 0) { e.preventDefault(); if (e.shiftKey) act(k === 'left' || k === 'down' ? 'rot5-' : 'rot5+'); else act(k); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selSet.length > 1) { e.preventDefault(); var a0 = curAlt(); pushUndo(a0); a0.pieces = a0.pieces.filter(function (_, k) { return selSet.indexOf(k) < 0; }); selPiece = -1; selSet = []; refreshEdit(); save(); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && selPiece >= 0) { e.preventDefault(); act('del'); }
  else if (e.key === 'Escape') { selPiece = -1; selSet = []; refreshEdit(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); $('#selAll').click(); }
});

/* =====================================================================
   4. SHEET + EXPORT
   ===================================================================== */
function pickedGroups() {
  var picked = sortedAlts().filter(isPicked), groups = [];
  FAMS.forEach(function (f) {
    var items = picked.filter(function (a) { return a.fam === f.k; });
    if (items.length) groups.push({ f: f, items: items.map(function (a, i) { return { a: a, code: f.k + pad(i + 1) }; }) });
  });
  return groups;
}
function renderSheet() {
  if (!S || S.tab !== 'sheet') return;
  var box = $('#sheet'); box.innerHTML = '';
  var d = $('#sheetInfo'); d.innerHTML = '';
  if (!S.site) { box.appendChild(el('div', 'empty', '먼저 대지 탭에서 대지를 정해 주세요.')); return; }
  var groups = pickedGroups();
  if (!groups.length) box.appendChild(el('div', 'empty', '대안 탭에서 ★로 마음에 드는 안을 고르면 여기 형태별로 모여요.'));
  groups.forEach(function (gr) {
    var row = el('div', 'famrow'), h = el('h4', null, gr.f.k + ' ' + gr.f.ko);
    h.appendChild(el('span', null, gr.items.length + '안'));
    var mini = el('div', 'mini');
    gr.items.forEach(function (it) {
      var card = el('div', 'card'), cv = el('canvas');
      cv.addEventListener('click', function () { S.cur = it.a.id; selPiece = -1; selSet = []; setTab('edit'); });
      var cap = el('div', 'cap');
      cap.appendChild(el('span', 'code', it.code));
      var sel = el('select'); sel.setAttribute('aria-label', it.code + ' 분류 바꾸기');
      FAMS.forEach(function (f) { var o = el('option', null, f.k + ' ' + f.ko); o.value = f.k; sel.appendChild(o); });
      sel.value = it.a.fam;
      sel.addEventListener('change', function () { setFam(it.a, sel.value); renderSheet(); });
      cap.appendChild(sel);
      var x = el('button', 'star', '★'); x.setAttribute('aria-pressed', 'true'); x.setAttribute('aria-label', it.code + ' 고르기 취소');
      x.addEventListener('click', function () { togglePick(it.a); renderSheet(); });
      cap.appendChild(x);
      card.appendChild(cv); card.appendChild(cap); mini.appendChild(card);
      requestAnimationFrame(function () { thumb(cv, it.a.pieces); });
    });
    row.appendChild(h); row.appendChild(mini); box.appendChild(row);
  });
  FAMS.forEach(function (f) { var g = groups.filter(function (x) { return x.f.k === f.k; })[0]; d.appendChild(el('dt', null, f.k + ' ' + f.ko)); d.appendChild(el('dd', null, (g ? g.items.length : 0) + '안')); });
}
function exMsg(t, bad) { var m = $('#exMsg'); m.hidden = false; m.className = 'msg' + (bad ? ' bad' : ''); m.textContent = t; }
var dlP = null;
function download(name, blob) {
  if (window.claude && window.claude.use) {
    if (!dlP) dlP = window.claude.use('downloads').catch(function () { return null; });
    dlP.then(function (dl) {
      if (!dl) { exMsg('이 화면에서는 파일 저장을 쓸 수 없어요.', true); return; }
      dl.save({ filename: name, data: blob }).catch(function (e) {
        if (e && e.code === 'declined') exMsg('저장을 취소했어요.');
        else if (e && e.code === 'rate_limited') exMsg('저장 창이 이미 열려 있어요. 잠시 뒤 다시 눌러 주세요.', true);
        else exMsg('저장하지 못했어요. (' + (e && e.code || '알 수 없음') + ')', true);
      });
    });
    return;
  }
  downloadLink(name, blob);
}
function downloadLink(name, blob) {
  var url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
}
function fname(kind, ext) {
  var d = new Date(), stamp = d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate());
  var nm = (META.name || '').replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '');
  return 'MassStudy_' + (nm ? nm + '_' : '') + stamp + '_' + kind + '.' + ext;
}
function needPicks() { if (!S.site) { exMsg('먼저 대지를 정해 주세요.', true); return null; } var g = pickedGroups(); if (!g.length) { exMsg('먼저 ★로 고른 안이 있어야 해요.', true); return null; } return g; }
$('#exAi').addEventListener('click', function () { var g = needPicks(); if (!g) return; download(fname('sheet', 'ai'), Export.ai(g)); exMsg('일러스트 파일을 저장했어요. 글자가 안 보이면 Noto Sans KR을 설치해 주세요.'); });
$('#exSvg').addEventListener('click', function () { var g = needPicks(); if (!g) return; download(fname('sheet', 'svg'), new Blob([Export.svg(g)], { type: 'image/svg+xml' })); exMsg('SVG를 저장했어요.'); });
$('#exPng').addEventListener('click', function () { var g = needPicks(); if (!g) return; exMsg('이미지를 만드는 중…'); Export.png(g).then(function (b) { download(fname('sheet', 'png'), b); exMsg('PNG를 저장했어요.'); }); });
$('#exObj').addEventListener('click', function () {
  if (!S.site) { exMsg('먼저 대지를 정해 주세요.', true); return; }
  var g = pickedGroups(), list = [];
  if (g.length) g.forEach(function (x) { x.items.forEach(function (it) { list.push(it); }); });
  else sortedAlts().forEach(function (a) { list.push({ a: a, code: code(a) }); });
  if (!list.length) { exMsg('내보낼 대안이 없어요.', true); return; }
  download(fname('obj', 'zip'), Export.zip([{ name: 'mass_study.obj', data: Export.obj(list, S.site) }]));
  exMsg((g.length ? '고른 안 ' : '전체 ') + list.length + '개를 OBJ로 저장했어요. 압축을 풀고 라이노에서 Import 하세요.');
});
$('#exJson').addEventListener('click', function () { download(fname('project', 'json'), new Blob([JSON.stringify({ app: 'MassStudy', v: 2, name: META.name, data: S })], { type: 'application/json' })); exMsg('프로젝트 파일을 저장했어요.'); });
$('#imJson').addEventListener('change', function (e) {
  var f = e.target.files[0]; e.target.value = ''; if (!f) return;
  var fr = new FileReader();
  fr.onload = function () {
    try {
      var o = JSON.parse(fr.result), d = o.data || o;
      if (!d.site || !d.site.poly || !Array.isArray(d.alts)) throw 0;
      openProject({ id: uid(), name: o.name || f.name.replace(/\.json$/i, ''), data: d }); save();
      toast('새 프로젝트로 불러왔어요. 대안 ' + d.alts.length + '개.');
    } catch (err) { exMsg('이 파일은 MassStudy 프로젝트가 아니에요.', true); }
  };
  fr.readAsText(f);
});

/* =====================================================================
   DIALOGS: confirm, projects, login
   ===================================================================== */
function openDlg(id) { $(id).hidden = false; var f = $(id).querySelector('input, button'); if (f) f.focus(); }
function closeDlg(id) { $(id).hidden = true; }
$$('.dlg').forEach(function (d) {
  d.addEventListener('click', function (e) { if (e.target === d || e.target.hasAttribute('data-close')) { if (d.id !== 'dlgConfirm') closeDlg('#' + d.id); } });
});
document.addEventListener('keydown', function (e) { if (e.key === 'Escape') ['#dlgProjects', '#dlgLogin'].forEach(function (id) { if (!$(id).hidden) closeDlg(id); }); });
function ask(text, yes) {
  return new Promise(function (res) {
    $('#confirmText').textContent = text; $('#confirmYes').textContent = yes || '확인';
    openDlg('#dlgConfirm'); $('#confirmNo').focus();
    function done(v) { closeDlg('#dlgConfirm'); $('#confirmYes').onclick = $('#confirmNo').onclick = null; res(v); }
    $('#confirmYes').onclick = function () { done(true); }; $('#confirmNo').onclick = function () { done(false); };
  });
}

function renderProjects() {
  var box = $('#plist'), note = $('#cloudNote'); box.innerHTML = '';
  if (!Cloud.enabled) note.textContent = '프로젝트는 이 브라우저에 저장돼요. 다른 컴퓨터로 옮길 땐 정리 탭의 프로젝트 파일 저장을 쓰세요.';
  else if (!Cloud.user) note.textContent = '지금은 이 브라우저에만 저장돼요. 로그인하면 계정에 저장돼서 어디서든 이어서 작업할 수 있어요.';
  else note.textContent = Cloud.user.email + ' 계정에 저장돼요.';
  var local = localAll(), items = {};
  Object.keys(local).forEach(function (k) { var p = local[k]; items[k] = { id: k, name: p.name, updated: p.updated, local: true, cloud: !!p.cloud, data: p.data }; });
  function draw() {
    box.innerHTML = '';
    var list = Object.keys(items).map(function (k) { return items[k]; }).sort(function (a, b) { return b.updated - a.updated; });
    if (!list.length) box.appendChild(el('p', 'hint', '아직 프로젝트가 없어요.'));
    list.forEach(function (p) {
      var it = el('div', 'pitem' + (p.id === META.id ? ' cur' : ''));
      var cv = el('canvas'); it.appendChild(cv);
      var mid = el('div'); mid.style.minWidth = '0';
      var t = el('div', 't', p.name);
      if (p.cloud) t.appendChild(el('span', 'tag', '클라우드'));
      if (p.pub) t.appendChild(el('span', 'tag', '공유 중'));
      mid.appendChild(t);
      var sm = p.data ? summaryOf(p.data) : (p.summary || {});
      mid.appendChild(el('div', 's', when(p.updated) + ' · 대안 ' + (sm.alts || 0) + ' · 고른 안 ' + (sm.picks || 0)));
      it.appendChild(mid);
      var acts = el('div', 'acts');
      if (p.id !== META.id) { var o = el('button', 'btn sm', '열기'); o.addEventListener('click', function () { openFrom(p); }); acts.appendChild(o); }
      else acts.appendChild(el('span', 'hint', '지금 여는 중'));
      var c = el('button', 'btn sm', '복제'); c.addEventListener('click', function () { getData(p).then(function (d) { openProject({ id: uid(), name: p.name + ' 사본', data: JSON.parse(JSON.stringify(d)) }); save(); closeDlg('#dlgProjects'); toast('사본을 만들었어요.'); }); }); acts.appendChild(c);
      if (p.cloud && Cloud.user) {
        var sh = el('button', 'btn sm', p.pub ? '공유 끄기' : '공유 링크');
        sh.addEventListener('click', function () {
          Cloud.setPublic(p.id, !p.pub).then(function () {
            p.pub = !p.pub; draw();
            if (p.pub) { var link = location.origin + location.pathname + '?p=' + p.id; copy(link); toast('공유 링크를 복사했어요. 받은 사람은 사본으로 열어요.'); }
            else toast('공유를 껐어요.');
          }, function () { toast('공유 설정을 바꾸지 못했어요.'); });
        });
        acts.appendChild(sh);
      }
      var del = el('button', 'btn sm danger', '삭제');
      del.addEventListener('click', function () {
        ask('"' + p.name + '"을(를) 지울까요?' + (p.cloud ? ' 계정에서도 지워져요.' : '') + ' 되돌릴 수 없어요.', '지우기').then(function (ok) {
          if (!ok) return;
          var all = localAll(); delete all[p.id]; lsSet(LKEY, all);
          var cp = p.cloud && Cloud.user ? Cloud.remove(p.id) : Promise.resolve();
          cp.catch(function () { toast('계정에서 지우지 못했어요.'); }).then(function () {
            delete items[p.id];
            if (p.id === META.id) { var rest = Object.keys(items).map(function (k) { return items[k]; }).sort(function (a, b) { return b.updated - a.updated; }); if (rest.length) openFrom(rest[0], true); else newProject(false); }
            draw();
          });
        });
      });
      acts.appendChild(del);
      it.appendChild(acts); box.appendChild(it);
      if (p.data && p.data.site) requestAnimationFrame(function () {
        var d = p.data, a = d.alts.filter(function (x) { return d.picks.indexOf(x.id) >= 0; })[0] || d.alts[0];
        Axon.draw(cv, a ? a.pieces : [], d.site, d.prog, { w: 64, h: 48, bg: css('--raise'), site: css('--site'), yard: false, pad: 3, lineWidth: 0.4 });
      });
    });
  }
  draw();
  if (Cloud.user) Cloud.list().then(function (rows) {
    rows.forEach(function (r) {
      var u = new Date(r.updated_at).getTime(), ex = items[r.id];
      if (ex) { ex.cloud = true; ex.pub = r.is_public; if (u > ex.updated + 2000) { ex.updated = u; ex.data = null; ex.summary = r.summary; ex.name = r.name; } }
      else items[r.id] = { id: r.id, name: r.name, updated: u, cloud: true, pub: r.is_public, summary: r.summary };
    });
    draw();
  }, function () { note.textContent = '계정의 프로젝트 목록을 불러오지 못했어요. 이 브라우저에 있는 것만 보여요.'; });
}
function getData(p) { return p.data ? Promise.resolve(p.data) : Cloud.get(p.id).then(function (r) { if (!r) throw new Error('없음'); return r.data; }); }
function openFrom(p, quiet) {
  getData(p).then(function (d) {
    openProject({ id: p.id, name: p.name, updated: p.updated, cloud: p.cloud, data: d }); save();
    closeDlg('#dlgProjects'); if (!quiet) toast('"' + p.name + '"을(를) 열었어요.');
  }, function () { toast('프로젝트를 불러오지 못했어요.'); });
}
function copy(t) { try { navigator.clipboard.writeText(t).catch(function () {}); } catch (e) {} }
$('#openProjects').addEventListener('click', function () { renderProjects(); openDlg('#dlgProjects'); });
$('#newProject').addEventListener('click', function () { newProject(false); closeDlg('#dlgProjects'); toast('새 프로젝트를 만들었어요. 대지부터 정해 주세요.'); });

/* login */
function renderAccount() {
  var b = $('#account');
  b.hidden = !Cloud.enabled;
  if (!Cloud.enabled) return;
  b.textContent = Cloud.user ? Cloud.user.email.split('@')[0] : '로그인 · 회원가입';
  b.classList.toggle('primary', !Cloud.user);
  $('#loginForm').hidden = !!Cloud.user; $('#loggedIn').hidden = !Cloud.user; $('#resetForm').hidden = true;
  if (Cloud.user) $('#who').textContent = Cloud.user.email + '로 로그인했어요. 프로젝트가 자동으로 계정에 저장돼요.';
}
$('#account').addEventListener('click', function () { renderAccount(); openDlg('#dlgLogin'); });
var authMode = 'in';
function setAuth(m) {
  authMode = m;
  $$('[data-auth]').forEach(function (b) { b.setAttribute('aria-selected', b.dataset.auth === m ? 'true' : 'false'); });
  $('#pw2Row').hidden = m !== 'up'; $('#pw2').required = m === 'up';
  $('#pw').autocomplete = m === 'up' ? 'new-password' : 'current-password';
  $('#authSubmit').textContent = m === 'up' ? '회원가입' : '로그인';
  $('#authHint').textContent = m === 'up' ? '이메일과 비밀번호로 가입해요. 가입 확인 메일의 링크를 누르면 바로 쓸 수 있어요.' : '로그인하면 프로젝트가 계정에 저장돼서 다른 컴퓨터에서도 이어서 작업할 수 있어요.';
  $('#loginMsg').hidden = true;
}
$$('[data-auth]').forEach(function (b) { b.addEventListener('click', function () { setAuth(b.dataset.auth); }); });
function loginMsg(t, bad) { var m = $('#loginMsg'); m.hidden = false; m.className = 'msg' + (bad ? ' bad' : ''); m.textContent = t; }
var AUTH_ERR = {
  'Invalid login credentials': '이메일이나 비밀번호가 맞지 않아요.',
  'Email not confirmed': '가입 확인 메일의 링크를 먼저 눌러 주세요.',
  'User already registered': '이미 가입한 이메일이에요. 로그인 탭에서 들어와 주세요.'
};
function authErr(err) { var m = err && err.message || ''; return AUTH_ERR[m] || ('잠시 뒤 다시 해 주세요.' + (m ? ' (' + m + ')' : '')); }
$('#loginF').addEventListener('submit', function (e) {
  e.preventDefault();
  var em = $('#email').value.trim(), pw = $('#pw').value, b = $('#authSubmit');
  if (authMode === 'up' && pw !== $('#pw2').value) { loginMsg('비밀번호 두 칸이 서로 달라요.', true); return; }
  b.disabled = true;
  var p = authMode === 'up' ? Cloud.signUp(em, pw).then(function (d) {
    if (d && d.session) loginMsg('가입했어요! 바로 로그인됐어요.');
    else loginMsg(em + '로 가입 확인 메일을 보냈어요. 메일의 링크를 누르면 가입이 끝나요.');
  }) : Cloud.signInPw(em, pw).then(function () { closeDlg('#dlgLogin'); });
  p.catch(function (err) { loginMsg(authErr(err), true); }).then(function () { b.disabled = false; });
});
$('#magicLink').addEventListener('click', function () {
  var em = $('#email').value.trim();
  if (!em) { loginMsg('이메일을 먼저 적어 주세요.', true); $('#email').focus(); return; }
  Cloud.signIn(em).then(function () { loginMsg(em + '로 로그인 링크를 보냈어요. 메일의 링크를 누르면 이 화면으로 돌아와요.'); }, function (err) { loginMsg(authErr(err), true); });
});
$('#forgotPw').addEventListener('click', function () {
  var em = $('#email').value.trim();
  if (!em) { loginMsg('가입한 이메일을 먼저 적어 주세요.', true); $('#email').focus(); return; }
  Cloud.resetPw(em).then(function () { loginMsg(em + '로 비밀번호 재설정 메일을 보냈어요.'); }, function (err) { loginMsg(authErr(err), true); });
});
Cloud.onRecovery(function () { renderAccount(); $('#loginForm').hidden = true; $('#loggedIn').hidden = true; $('#resetForm').hidden = false; openDlg('#dlgLogin'); });
$('#resetF').addEventListener('submit', function (e) {
  e.preventDefault();
  var m = $('#resetMsg');
  Cloud.updatePw($('#newPw').value).then(function () { m.hidden = false; m.className = 'msg'; m.textContent = '비밀번호를 바꿨어요.'; setTimeout(function () { $('#resetForm').hidden = true; renderAccount(); }, 1200); },
    function (err) { m.hidden = false; m.className = 'msg bad'; m.textContent = authErr(err); });
});
$('#logout').addEventListener('click', function () { Cloud.signOut().then(function () { closeDlg('#dlgLogin'); toast('로그아웃했어요. 이 브라우저의 프로젝트는 그대로 있어요.'); }); });
Cloud.onUser(function (u) { renderAccount(); if (u && META) { cloudSave(); toast(u.email + '로 로그인했어요.'); } });

/* ---------- theme + resize ---------- */
function retheme() { drawPlan(); if (S.tab === 'gen') renderCards(); if (S.tab === 'sheet') renderSheet(); if (three && S.site) { buildSite(); refreshEdit(); } }
try { window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', retheme); } catch (e) {}
new MutationObserver(retheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
var rT = 0;
window.addEventListener('resize', function () { clearTimeout(rT); rT = setTimeout(function () { if (S.tab === 'site') drawPlan(); if (S.tab === 'gen') renderCards(); if (S.tab === 'sheet') renderSheet(); }, 150); });
window.addEventListener('beforeunload', function () { if (saveT) { clearTimeout(saveT); var all = localAll(); all[META.id] = { id: META.id, name: META.name, updated: Date.now(), cloud: META.cloud, data: S }; lsSet(LKEY, all); } });

/* ---------- boot ---------- */
fillSelects();
var params = new URLSearchParams(location.search), shared = params.get('p'), start = params.get('start');
var all = localAll(), curId = lsGet(CKEY);
if (start === 'new') newProject(false);
else if (start === 'sample') newProject(true);
else if (curId && all[curId]) openProject(all[curId]);
else if (Object.keys(all).length) openProject(all[Object.keys(all)[0]]);
else newProject(true);
if (start) history.replaceState(null, '', location.pathname);
renderAccount();
Cloud.init().then(function (on) {
  renderAccount();
  if (shared) {
    history.replaceState(null, '', location.pathname);
    if (!on) { toast('공유 링크를 열려면 사이트에 클라우드 저장이 켜져 있어야 해요.'); return; }
    Cloud.get(shared).then(function (r) {
      if (!r) { toast('공유가 꺼졌거나 없는 프로젝트예요.'); return; }
      openProject({ id: uid(), name: r.name + ' (공유본)', data: r.data }); save();
      toast('공유받은 프로젝트를 사본으로 열었어요. 고쳐도 원본은 그대로예요.');
    }, function () { toast('공유 프로젝트를 불러오지 못했어요.'); });
  }
});
window.__ms = { S: function () { return S; }, pickedGroups: pickedGroups, togglePick: togglePick };
})();
