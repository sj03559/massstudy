/* Axonometric projection shared by the app thumbnails, the landing page and the exports. */
var Axon = (function () {
  var AZ = 235 * Math.PI / 180, EL = 30 * Math.PI / 180;
  var D = [Math.cos(AZ) * Math.cos(EL), Math.sin(AZ) * Math.cos(EL), Math.sin(EL)];
  var R = [-Math.sin(AZ), Math.cos(AZ), 0];
  var U = [-Math.cos(AZ) * Math.sin(EL), -Math.sin(AZ) * Math.sin(EL), Math.cos(EL)];
  var LIGHT = [-0.45, -0.65, 0.62], LL = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2]);
  var FOAM = '#8EC3E3', EDGE = '#3E6E8E';

  function proj(p) { return [p[0] * R[0] + p[1] * R[1], p[0] * U[0] + p[1] * U[1] + p[2] * U[2]]; }
  function depth(p) { return p[0] * D[0] + p[1] * D[1] + p[2] * D[2]; }
  function newell(f) {
    var nx = 0, ny = 0, nz = 0;
    for (var i = 0; i < f.length; i++) { var a = f[i], b = f[(i + 1) % f.length]; nx += (a[1] - b[1]) * (a[2] + b[2]); ny += (a[2] - b[2]) * (a[0] + b[0]); nz += (a[0] - b[0]) * (a[1] + b[1]); }
    var l = Math.hypot(nx, ny, nz) || 1; return [nx / l, ny / l, nz / l];
  }
  function hexRgb(h) { h = h.replace('#', ''); return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
  function shadeRgb(hex, n) {
    var c = hexRgb(hex), k = 0.62 + 0.38 * Math.max(0, (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / LL);
    if (n[2] > 0.9) k = 1;
    return c.map(function (v) { return Math.min(1, v * k + (1 - k) * 0.08); });
  }
  function toHex(c) { return '#' + c.map(function (v) { var s = Math.round(v * 255).toString(16); return s.length < 2 ? '0' + s : s; }).join(''); }

  /* visible faces, sorted back to front; each {pts:[[x,y]...], rgb:[r,g,b], fill:'#hex'} */
  function faces(pieces, colorOf) {
    var out = [];
    Union.solids(pieces).forEach(function (f) {
      var n = f.n, p = pieces[f.pi];
      if (n[0] * D[0] + n[1] * D[1] + n[2] * D[2] <= 1e-6) return;
      var d = 0; f.v.forEach(function (q) { d += depth(q); });
      var rgb = shadeRgb(colorOf ? colorOf(p) : FOAM, n);
      var all = f.edges.every(Boolean);
      out.push({ d: d / f.v.length, pts: f.v.map(proj), rgb: rgb, fill: toHex(rgb), roof: p.g === 'roof', smooth: !!f.smooth, edges: f.edges, all: all });
    });
    out.sort(function (a, b) { return a.d - b.d; });
    return out;
  }
  function bboxOf(F) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    F.forEach(function (f) { f.pts.forEach(function (q) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); }); });
    return b;
  }
  function siteFrame(site, maxH) {
    var pts = [];
    site.poly.forEach(function (p) { pts.push(proj([p[0], p[1], 0]), proj([p[0], p[1], maxH])); });
    return Core.bbox(pts);
  }
  /* draw onto a canvas: opts {bg, site, yard, edge, colorOf, frame, pad, lineWidth} */
  function draw(cv, pieces, site, prog, opts) {
    opts = opts || {};
    var d = window.devicePixelRatio || 1, r = cv.getBoundingClientRect();
    var W = opts.w || r.width || 210, H = opts.h || r.height || 158;
    if (!opts.keepSize) { cv.width = Math.round(W * d); cv.height = Math.round(H * d); }
    var c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
    if (opts.bg) { c.fillStyle = opts.bg; c.fillRect(0, 0, W, H); } else c.clearRect(0, 0, W, H);
    var b = opts.frame || siteFrame(site, prog.maxH), pad = opts.pad == null ? 8 : opts.pad;
    var s = Math.min((W - 2 * pad) / (b[2] - b[0]), (H - 1.5 * pad) / (b[3] - b[1]));
    var ox = W / 2 - (b[0] + b[2]) / 2 * s, oy = H / 2 + (b[1] + b[3]) / 2 * s;
    function P(q) { return [ox + q[0] * s, oy - q[1] * s]; }
    function path(pts) { c.beginPath(); pts.forEach(function (q, i) { q = P(q); if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); }
    if (opts.before) opts.before(c, P);
    if (site && opts.site !== false) {
      path(site.poly.map(function (p) { return proj([p[0], p[1], 0]); }));
      if (opts.siteFill) { c.fillStyle = opts.siteFill; c.fill(); }
      c.strokeStyle = opts.site || '#7F8D95'; c.lineWidth = 0.8; c.stroke();
      var Y = prog && Core.yardPoly(site, prog);
      if (Y && opts.yard !== false) { path(Y.map(function (p) { return proj([p[0], p[1], 0]); })); c.setLineDash([3, 3]); c.strokeStyle = opts.yard || '#C98A2B'; c.lineWidth = 0.7; c.stroke(); c.setLineDash([]); }
    }
    c.lineJoin = 'round';
    (opts.faces || faces(pieces, opts.colorOf)).forEach(function (f) {
      path(f.pts);
      c.globalAlpha = f.roof ? 0.8 : 1;
      c.fillStyle = f.fill; c.fill(); c.lineWidth = opts.lineWidth || 0.6;
      if (f.all) { c.strokeStyle = opts.edge || EDGE; c.stroke(); }
      else {
        c.strokeStyle = f.fill; c.stroke();
        c.strokeStyle = opts.edge || EDGE; c.beginPath();
        f.pts.forEach(function (q, i) { if (!f.edges[i]) return; var a = P(q), b = P(f.pts[(i + 1) % f.pts.length]); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); });
        c.stroke();
      }
      c.globalAlpha = 1;
    });
    return { s: s, ox: ox, oy: oy };
  }
  return { proj: proj, depth: depth, newell: newell, faces: faces, bboxOf: bboxOf, siteFrame: siteFrame, draw: draw, FOAM: FOAM, EDGE: EDGE, D: D };
})();
