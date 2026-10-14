/* Reads plan curves from a Rhino .3dm file with rhino3dm.js (loaded on first use). */
var Import3dm = (function () {
  var SRC = 'https://cdn.jsdelivr.net/npm/rhino3dm@8.4.0/rhino3dm.min.js';
  var ready = null;
  function load() {
    if (ready) return ready;
    ready = new Promise(function (res, rej) {
      if (window.rhino3dm) return res();
      var s = document.createElement('script'); s.src = SRC; s.async = true;
      s.onload = res; s.onerror = function () { ready = null; rej(new Error('rhino3dm.js를 불러오지 못했어요.')); };
      document.head.appendChild(s);
    }).then(function () { return window.rhino3dm(); });
    return ready;
  }
  function ev(x) { return x && x.value !== undefined ? x.value : x; }
  var UPM = { 1: 1e6, 2: 1000, 3: 100, 4: 1, 8: 39.3701, 9: 3.28084 };

  function curvePts(g, out) {
    try {
      if (typeof g.segmentCount === 'number' && g.segmentCurve) {
        var all = [];
        for (var i = 0; i < g.segmentCount; i++) { var seg = curvePts(g.segmentCurve(i), []); if (all.length && seg.length) seg.shift(); all = all.concat(seg); }
        return all;
      }
      if (typeof g.pointCount === 'number' && g.point) {
        var p = []; for (var k = 0; k < g.pointCount; k++) { var q = g.point(k); p.push([q[0], q[1]]); } return p;
      }
      if (g.line && g.line.from) return [[g.line.from[0], g.line.from[1]], [g.line.to[0], g.line.to[1]]];
      if (g.degree === 1 && g.points) {
        var cp = g.points(), r = [];
        for (var m = 0; m < cp.count; m++) { var c = cp.get(m), w = c[3] || 1; r.push([c[0] / w, c[1] / w]); }
        return r;
      }
      var d = g.domain, n = 32, s = [];
      for (var j = 0; j <= n; j++) { var t = d[0] + (d[1] - d[0]) * j / n, pt = g.pointAt(t); s.push([pt[0], pt[1]]); }
      return s;
    } catch (e) { return out || []; }
  }

  function read(buffer) {
    return load().then(function (rhino) {
      var doc = rhino.File3dm.fromByteArray(new Uint8Array(buffer));
      if (!doc) throw new Error('3dm 파일을 읽지 못했어요.');
      var upm = null;
      try { upm = UPM[ev(doc.settings().modelUnitSystem)] || null; } catch (e) {}
      var objs = doc.objects(), segs = [], polys = [];
      for (var i = 0; i < objs.count; i++) {
        var o = objs.get(i), g = o.geometry();
        if (!g || typeof g.pointAt !== 'function' || !g.domain) continue;
        var pts = curvePts(g);
        if (pts.length < 2) continue;
        for (var k = 0; k + 1 < pts.length; k++) segs.push([pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]]);
        var closed = false;
        try { closed = g.isClosed; } catch (e) {}
        var f = pts[0], l = pts[pts.length - 1];
        if (closed || Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6) {
          if (Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6) pts = pts.slice(0, -1);
          if (pts.length > 2) polys.push(pts);
        }
      }
      return { upm: upm, segs: segs, polys: polys };
    });
  }
  return { read: read, load: load };
})();
