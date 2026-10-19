/* ---------- core: geometry, generator, checks, DXF (no DOM) ---------- */
var Core = (function () {
  var FAMS = [
    { k: 'G', ko: '박공' },
    { k: 'R', ko: '특수 지붕' },
    { k: 'S', ko: '쌓기·띄우기' },
    { k: 'C', ko: '마당 감싸기' },
    { k: 'B', ko: '바·분산 배치' }
  ];
  var GROUPS = {
    S: { ko: 'Storage', en: 'Storage', color: '#E0A215' },
    W: { ko: 'Work', en: 'Work', color: '#2C5C8F' },
    R: { ko: 'Rest', en: 'Rest', color: '#C0596E' },
    M: { ko: '매스', en: 'Mass', color: '#8EC3E3' },
    roof: { ko: '지붕판', en: 'Roof', color: '#B9C2C7' }
  };
  var ROOFS = [
    { k: 'flat', ko: '평지붕' }, { k: 'gable', ko: '박공' }, { k: 'shed', ko: '외쪽' },
    { k: 'butterfly', ko: '나비' }, { k: 'aframe', ko: 'A형' }, { k: 'vault', ko: '볼트' }
  ];
  var SUBS = { G: [1, 2, 3, 4, 6], R: [1, 2, 3, 4, 5, 6], S: [1, 2, 3, 4, 6], C: [1, 2, 3], B: [1, 2, 3, 4, 6] };
  var SUBS1 = { G: [1, 2, 3, 4, 5], R: [1, 2, 3, 4, 5, 6], S: [1, 2, 3, 4, 5], C: [1, 2, 3, 4], B: [1, 2, 3, 4] };
  function isOne(ps) { for (var i = 0; i < ps.length; i++) if (ps[i].g === 'M') return true; return false; }

  function mulberry(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---- polygon helpers ---- */
  function area(P) {
    var s = 0;
    for (var i = 0; i < P.length; i++) { var a = P[i], b = P[(i + 1) % P.length]; s += a[0] * b[1] - b[0] * a[1]; }
    return s / 2;
  }
  function ccw(P) { return area(P) < 0 ? P.slice().reverse() : P.slice(); }
  function inPoly(p, P) {
    var c = false;
    for (var i = 0, j = P.length - 1; i < P.length; j = i++) {
      var a = P[i], b = P[j];
      if ((a[1] > p[1]) !== (b[1] > p[1]) && p[0] < (b[0] - a[0]) * (p[1] - a[1]) / (b[1] - a[1]) + a[0]) c = !c;
    }
    return c;
  }
  function distSeg(p, a, b) {
    var dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy;
    var t = L ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)) : 0;
    var x = a[0] + t * dx - p[0], y = a[1] + t * dy - p[1];
    return Math.sqrt(x * x + y * y);
  }
  function distToEdges(p, P) {
    var m = Infinity;
    for (var i = 0; i < P.length; i++) m = Math.min(m, distSeg(p, P[i], P[(i + 1) % P.length]));
    return m;
  }
  /* minimum penetration of two convex polygons (0 when separated) */
  function penetration(A, B) {
    var best = Infinity, polys = [A, B];
    for (var k = 0; k < 2; k++) {
      var P = polys[k];
      for (var i = 0; i < P.length; i++) {
        var a = P[i], b = P[(i + 1) % P.length];
        var nx = a[1] - b[1], ny = b[0] - a[0], l = Math.hypot(nx, ny);
        if (l < 1e-9) continue;
        nx /= l; ny /= l;
        var mA = Infinity, MA = -Infinity, mB = Infinity, MB = -Infinity, j, v;
        for (j = 0; j < A.length; j++) { v = A[j][0] * nx + A[j][1] * ny; mA = Math.min(mA, v); MA = Math.max(MA, v); }
        for (j = 0; j < B.length; j++) { v = B[j][0] * nx + B[j][1] * ny; mB = Math.min(mB, v); MB = Math.max(MB, v); }
        var o = Math.min(MA, MB) - Math.max(mA, mB);
        if (o <= 0) return 0;
        best = Math.min(best, o);
      }
    }
    return best;
  }
  function polyDist(A, B) {
    if (penetration(A, B) > 0) return 0;
    var m = Infinity, i, j;
    for (i = 0; i < A.length; i++) for (j = 0; j < B.length; j++) m = Math.min(m, distSeg(A[i], B[j], B[(j + 1) % B.length]));
    for (i = 0; i < B.length; i++) for (j = 0; j < A.length; j++) m = Math.min(m, distSeg(B[i], A[j], A[(j + 1) % A.length]));
    return m;
  }

  /* ---- pieces ---- */
  // piece: {g, x, y, l, d, a(deg), z, h, r}
  function profile(p) {
    var w = p.d / 2, h = p.h;
    if (p.g === 'roof') return [[-w, 0], [w, 0], [w, h], [-w, h]];
    switch (p.r) {
      case 'gable': var e = Math.max(h * 0.55, h - p.d * 0.42); return [[-w, 0], [w, 0], [w, e], [0, h], [-w, e]];
      case 'shed': return [[-w, 0], [w, 0], [w, h * 0.62], [-w, h]];
      case 'butterfly': return [[-w, 0], [w, 0], [w, h], [0, h * 0.72], [-w, h]];
      case 'aframe': return [[-w, 0], [w, 0], [0, h]];
      case 'vault':
        var ev = Math.max(h * 0.45, h - w), rise = h - ev, out = [[-w, 0], [w, 0]];
        for (var k = 0; k <= 12; k++) { var t = k / 12 * Math.PI; out.push([w * Math.cos(t), ev + rise * Math.sin(t)]); }
        return out;
      default: return [[-w, 0], [w, 0], [w, h], [-w, h]];
    }
  }
  function faces(p) {
    var pr = profile(p);
    if (area(pr) < 0) pr = pr.reverse();
    var c = Math.cos(p.a * Math.PI / 180), s = Math.sin(p.a * Math.PI / 180), H = p.l / 2;
    function P(t, uv) { return [p.x + c * t - s * uv[0], p.y + s * t + c * uv[0], p.z + uv[1]]; }
    var F = [pr.map(function (q) { return P(H, q); }), pr.slice().reverse().map(function (q) { return P(-H, q); })];
    for (var i = 0; i < pr.length; i++) {
      var a = pr[i], b = pr[(i + 1) % pr.length];
      var q = [P(-H, a), P(-H, b), P(H, b), P(H, a)];
      if (p.r === 'vault' && p.g !== 'roof' && i >= 2 && i < pr.length - 1) q.smooth = true;
      F.push(q);
    }
    return F;
  }
  function foot(p) {
    var c = Math.cos(p.a * Math.PI / 180), s = Math.sin(p.a * Math.PI / 180), L = p.l / 2, D = p.d / 2;
    return [[-L, -D], [L, -D], [L, D], [-L, D]].map(function (q) { return [p.x + c * q[0] - s * q[1], p.y + s * q[0] + c * q[1]]; });
  }
  function top(p) { return p.z + p.h; }

  /* ---- site helpers ---- */
  function longestEdgeAngle(P) {
    var best = 0, ang = 0;
    for (var i = 0; i < P.length; i++) {
      var a = P[i], b = P[(i + 1) % P.length], l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (l > best) { best = l; ang = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; }
    }
    return ang;
  }
  function yardPoly(site, prog) {
    if (site.entry == null || site.entry < 0) return null;
    var P = site.poly, a = P[site.entry], b = P[(site.entry + 1) % P.length];
    var ex = b[0] - a[0], ey = b[1] - a[1], L = Math.hypot(ex, ey);
    if (L < 0.5) return null;
    ex /= L; ey /= L;
    var nx = -ey, ny = ex; // inward for a ccw polygon
    var mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2, hl = Math.min(L, prog.yardW) / 2, D = prog.yardD;
    return [[mx - ex * hl, my - ey * hl], [mx + ex * hl, my + ey * hl], [mx + ex * hl + nx * D, my + ey * hl + ny * D], [mx - ex * hl + nx * D, my - ey * hl + ny * D]];
  }

  /* ---- checks ---- */
  var TOL = 0.05;
  function check(alt, site, prog) {
    var ps = alt.pieces, areas = { S: 0, W: 0, R: 0, M: 0 }, hmax = 0, i, j, one = isOne(ps);
    var res = { inside: true, overlap: false, yard: true, height: true, areaOk: true, near: null, bad: {} };
    var feet = ps.map(foot), Y = yardPoly(site, prog);
    for (i = 0; i < ps.length; i++) {
      var p = ps[i];
      if (areas[p.g] != null) areas[p.g] += p.l * p.d;
      hmax = Math.max(hmax, top(p));
      var f = feet[i], ok = true;
      for (j = 0; j < 4; j++) if (!inPoly(f[j], site.poly) || distToEdges(f[j], site.poly) < prog.setback - 1e-6) ok = false;
      for (j = 0; ok && j < site.poly.length; j++) if (inPoly(site.poly[j], f) && distToEdges(site.poly[j], f) > 1e-6) ok = false;
      if (!ok) { res.inside = false; res.bad[i] = 1; }
      if (Y && p.z < 4.5 && penetration(f, Y) > TOL) { res.yard = false; res.bad[i] = 1; }
      if (top(p) > prog.maxH + 1e-6) { res.height = false; res.bad[i] = 1; }
      for (j = 0; j < i; j++) {
        var q = ps[j];
        if (p.z < top(q) - TOL && q.z < top(p) - TOL && penetration(f, feet[j]) > TOL) { res.overlap = true; res.bad[i] = 1; res.bad[j] = 1; }
      }
    }
    res.areas = areas; res.hmax = hmax;
    res.total = prog.S + prog.W + prog.R;
    if (one) { if (Math.abs(areas.M - res.total) > res.total * 0.05) res.areaOk = false; }
    else ['S', 'W', 'R'].forEach(function (g) { if (Math.abs(areas[g] - prog[g]) > prog[g] * 0.05) res.areaOk = false; });
    res.one = one;
    res.connected = one ? connected(ps, feet) : true;
    if (Y) {
      var d = Infinity;
      for (i = 0; i < ps.length; i++) if (one ? ps[i].g !== 'roof' : ps[i].g === 'S') d = Math.min(d, polyDist(feet[i], Y));
      res.near = d === Infinity ? null : d;
    }
    res.ok = res.inside && !res.overlap && res.yard && res.height && res.connected;
    return res;
  }

  /* pieces (roof plates aside) form one body: each touches another, side by side or stacked */
  function connected(ps, feet) {
    var idx = []; ps.forEach(function (p, i) { if (p.g !== 'roof') idx.push(i); });
    if (idx.length < 2) return true;
    var seen = {}, stack = [idx[0]]; seen[idx[0]] = 1; var n = 1;
    while (stack.length) {
      var i = stack.pop(), p = ps[i];
      idx.forEach(function (j) {
        if (seen[j]) return;
        var q = ps[j];
        if (p.z > top(q) + 0.06 || q.z > top(p) + 0.06) return;
        if (polyDist(feet[i], feet[j]) > 0.06) return;
        if (p.z >= top(q) - 0.06 || q.z >= top(p) - 0.06) { if (penetration(feet[i], feet[j]) < 0.5) return; }
        seen[j] = 1; n++; stack.push(j);
      });
    }
    return n === idx.length;
  }

  /* ---- one-body templates: total floor area in a single connected mass ---- */
  function makeOne(fam, prog, rnd, sub) {
    var u = T(rnd), r = u.r, pick = u.pick, TA = prog.S + prog.W + prog.R;
    function M(l, d, roof, h, x, y, a, z) { return bar('M', x || 0, y || 0, l, d, a || 0, z || 0, h, roof); }
    function H(roof) { return roof === 'gable' ? r(6.2, 8.5) : roof === 'aframe' ? r(8, 10.5) : roof === 'shed' ? r(5.2, 7) : roof === 'butterfly' ? r(5.5, 7) : roof === 'vault' ? r(5.8, 7.5) : r(4, 5.4); }
    function mix() { return pick(['flat', 'flat', 'gable', 'shed']); }
    var ps, name, d, d1, d2, a1, a2, l1, l2, b1, b2, b3, i, n, c, rf, k;
    switch (fam + (sub || pick(SUBS1[fam]))) {
      case 'G1': name = '긴 박공'; d = r(7.5, 10); ps = [M(TA / d, d, 'gable', H('gable'))]; break;
      case 'G2':
        name = '꺾인 박공'; a1 = TA * r(0.5, 0.62); d1 = r(7, 9); d2 = r(6.5, 8.5); l1 = a1 / d1; l2 = (TA - a1) / d2;
        b1 = M(l1, d1, 'gable', H('gable')); b2 = M(l2, d2, 'gable', b1.h * r(0.85, 1.05), l1 / 2 - d2 / 2, d1 / 2 + l2 / 2, 90);
        ps = [b1, b2]; break;
      case 'G3':
        name = '높낮이 박공'; d = r(7, 9); a1 = TA * r(0.45, 0.6); l1 = a1 / d; l2 = (TA - a1) / d;
        ps = [M(l1, d, 'gable', r(8, 10)), M(l2, d * r(0.8, 1), 'gable', r(5, 6.3), l1 / 2 + l2 / 2, 0)];
        ps[1].l = (TA - a1) / ps[1].d; ps[1].x = l1 / 2 + ps[1].l / 2; break;
      case 'G4':
        name = '겹 박공'; d1 = r(6, 8); d2 = r(6, 8); a1 = TA * r(0.45, 0.55); l1 = a1 / d1; l2 = (TA - a1) / d2;
        k = Math.max(0, Math.min(l1, l2) / 2 - 2.5);
        ps = [M(l1, d1, 'gable', H('gable')), M(l2, d2, 'gable', H('gable'), r(-k, k), (d1 + d2) / 2)]; break;
      case 'G5':
        name = '세 겹 박공'; ps = []; var xx = 0, st = r(0.5, 2.5);
        for (i = 0; i < 3; i++) { d = r(6, 7.5); var li = TA / 3 / d; ps.push(M(li, d, 'gable', r(6, 8.5), xx + d / 2, (i % 2 ? 1 : -1) * st, 90)); xx += d; }
        break;
      case 'R1':
        if (rnd() < 0.5) { name = '외쪽 지붕'; d = r(8, 10); ps = [M(TA / d, d, 'shed', r(6, 8))]; }
        else { name = '마주 보는 외쪽'; d = r(7, 9); l1 = TA / 2 / d; ps = [M(l1, d, 'shed', r(6, 7.5), 0, 0, 90), M(l1, d, 'shed', r(6, 7.5), d, 0, 270)]; }
        break;
      case 'R2': name = '나비 지붕'; d = r(8, 11); ps = [M(TA / d, d, 'butterfly', H('butterfly'))]; break;
      case 'R3':
        if (rnd() < 0.5) { name = '볼트 지붕'; d = r(9, 11); ps = [M(TA / d, d, 'vault', H('vault'))]; }
        else { name = '쌍 볼트'; d = r(7, 8.5); l1 = TA / 2 / d; ps = [M(l1, d, 'vault', H('vault')), M(l1, d, 'vault', H('vault'), r(-2, 2), d)]; }
        break;
      case 'R4':
        name = '톱날 지붕'; n = pick([4, 5]); c = r(4, 5); l1 = TA / (n * c); var hs = r(5.5, 7); ps = [];
        for (i = 0; i < n; i++) ps.push(M(l1, c, 'shed', hs, 0, i * c));
        break;
      case 'R5': name = 'A형 지붕'; d = r(9, 11.5); ps = [M(TA / d, d, 'aframe', H('aframe'))]; break;
      case 'R6':
        name = '큰 지붕 아래'; d = r(8, 10); l1 = TA / d; b1 = M(l1, d, 'flat', r(3.8, 4.5));
        ps = [b1, bar('roof', 0, 0, l1 + r(2, 4), d + r(2, 3.5), 0, b1.h + r(1, 2), 0.35, 'flat')]; break;
      case 'S1':
        name = '2층 얹기'; a1 = TA * r(0.55, 0.65); d1 = r(8, 10); l1 = a1 / d1; b1 = M(l1, d1, 'flat', r(3.6, 4.2));
        d2 = r(6, 8); l2 = (TA - a1) / d2; b2 = M(l2, d2, pick(['flat', 'gable', 'shed']), 0, r(-l1 / 4, l1 / 4), r(-1, 1), pick([0, 0, 90]), b1.h);
        b2.h = b2.r === 'gable' ? r(4.2, 5.5) : r(3.2, 4.2); ps = [b1, b2]; break;
      case 'S2':
        name = '필로티'; c = r(4, 5.5); var zr = r(3.4, 4.2); d = r(8, 10); l1 = (TA - c * c) / d;
        b2 = M(l1, d, pick(['flat', 'shed', 'gable']), 0, 0, 0, 0, zr); b2.h = b2.r === 'gable' ? r(4.5, 6) : r(3.6, 4.5);
        b1 = M(c, c, 'flat', zr, r(-1, 1) * (l1 / 2 - c / 2) * 0.6, r(-1, 1) * (d / 2 - c / 2) * 0.5);
        ps = [b1, b2]; break;
      case 'S3':
        name = '계단식 쌓기'; d = r(8, 10); var fr = [0.45, 0.33, 0.22], z = 0, hl = r(3.4, 3.8); ps = [];
        l1 = TA * fr[0] / d;
        fr.forEach(function (f) { var li = TA * f / d; ps.push(M(li, d, 'flat', hl, l1 / 2 - li / 2, 0, 0, z)); z += hl; });
        break;
      case 'S4':
        name = '비틀어 쌓기'; a1 = TA * r(0.55, 0.65); d1 = r(8, 10); l1 = a1 / d1; b1 = M(l1, d1, 'flat', r(3.8, 4.4));
        d2 = r(6, 7.5); l2 = (TA - a1) / d2; b2 = M(l2, d2, pick(['flat', 'shed']), r(3.2, 4.2), r(-1.5, 1.5), r(-1, 1), pick([1, -1]) * r(20, 45), b1.h);
        ps = [b1, b2]; break;
      case 'S5':
        name = '캔틸레버'; a1 = TA * r(0.55, 0.65); d1 = r(7, 9); l1 = a1 / d1; b1 = M(l1, d1, 'flat', r(3.8, 4.4));
        d2 = d1 * r(0.75, 1); l2 = (TA - a1) / d2; var ov = r(2.5, 5);
        if (l2 - ov < 3) return null;
        b2 = M(l2, d2, pick(['flat', 'shed', 'gable']), 0, l1 / 2 + ov - l2 / 2, (d1 - d2) / 2 * pick([-1, 1]), 0, b1.h);
        b2.h = b2.r === 'gable' ? r(4.2, 5.5) : r(3.2, 4.2); ps = [b1, b2]; break;
      case 'C1':
        name = 'ㄱ자'; a1 = TA * r(0.5, 0.6); d1 = r(6, 7.5); d2 = r(6, 7.5); l1 = a1 / d1; l2 = (TA - a1) / d2; rf = mix();
        ps = [M(l1, d1, rf, H(rf)), M(l2, d2, rf, H(rf), l1 / 2 - d2 / 2, d1 / 2 + l2 / 2, 90)]; break;
      case 'C2': case 'C4':
        name = sub === 4 ? '비대칭 ㄷ자' : 'ㄷ자'; var a0 = TA * r(0.36, 0.46), d0 = r(6, 7.5), l0 = a0 / d0, dw = r(5.5, 6.5), rest = TA - a0;
        var s1 = sub === 4 ? r(0.3, 0.4) : 0.5, lw1 = rest * s1 / dw, lw2 = rest * (1 - s1) / dw; rf = mix();
        if (l0 - 2 * dw < 5) return null;
        ps = [M(l0, d0, rf, H(rf)), M(lw1, dw, rf, H(rf), -l0 / 2 + dw / 2, d0 / 2 + lw1 / 2, 90), M(lw2, dw, rf, H(rf), l0 / 2 - dw / 2, d0 / 2 + lw2 / 2, 90)];
        break;
      case 'C3':
        name = 'ㅁ자 중정'; d = r(4.5, 5.5); k = r(0.7, 1); var Lx = (TA / (2 * d) + 2 * d) / (1 + k), Ly = Lx * k;
        if (Lx - 2 * d < 4 || Ly - 2 * d < 4) return null;
        rf = pick(['flat', 'flat', 'shed']); var hc = H(rf);
        ps = [M(Lx, d, rf, hc, 0, -(Ly / 2 - d / 2)), M(Lx, d, rf, hc * r(0.9, 1.25), 0, Ly / 2 - d / 2), M(Ly - 2 * d, d, rf, hc, -(Lx / 2 - d / 2), 0, 90), M(Ly - 2 * d, d, rf, hc, Lx / 2 - d / 2, 0, 90)];
        break;
      case 'B1': name = '긴 바'; d = r(5.5, 7); rf = mix(); ps = [M(TA / d, d, rf, H(rf))]; break;
      case 'B2':
        name = 'Z자 바'; d = r(5.5, 7); rf = mix(); var hz = H(rf); l1 = TA * 0.34 / d; l2 = TA * 0.32 / d; var l3 = TA * 0.34 / d;
        ps = [M(l1, d, rf, hz), M(l2, d, rf, hz, l1 / 2 - d / 2, d / 2 + l2 / 2, 90), M(l3, d, rf, hz, l1 / 2 - d + l3 / 2, d + l2)];
        break;
      case 'B3':
        name = 'T자 바'; d1 = r(6, 7.5); a1 = TA * r(0.6, 0.7); l1 = a1 / d1; d2 = r(5.5, 7); l2 = (TA - a1) / d2; rf = mix();
        ps = [M(l1, d1, rf, H(rf)), M(l2, d2, rf, H(rf), r(-l1 / 4, l1 / 4), d1 / 2 + l2 / 2, 90)]; break;
      case 'B4':
        name = '엇갈린 바'; d1 = r(5.5, 7); d2 = r(5.5, 7); a1 = TA * r(0.45, 0.55); l1 = a1 / d1; l2 = (TA - a1) / d2; rf = mix();
        var sh = Math.min(l1, l2) * r(0.35, 0.6);
        if (Math.min(l1, l2) - sh < 3) return null;
        ps = [M(l1, d1, rf, H(rf)), M(l2, d2, rf, H(rf), sh * pick([1, -1]) + (l2 - l1) / 2 * 0, (d1 + d2) / 2)]; break;
    }
    if (!ps) return null;
    return { name: name, pieces: ps };
  }

  /* ---- templates ---- */
  function T(rnd) {
    var U = {
      r: function (a, b) { return a + (b - a) * rnd(); },
      pick: function (arr) { return arr[Math.floor(rnd() * arr.length)]; },
      shuffle: function (arr) { arr = arr.slice(); for (var i = arr.length - 1; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t; } return arr; }
    };
    return U;
  }
  function bar(g, x, y, l, d, a, z, h, r) { return { g: g, x: x, y: y, l: l, d: d, a: a || 0, z: z || 0, h: h, r: r || 'flat' }; }

  function makeTemplate(fam, prog, rnd, sub, mode) {
    if (mode === 'one') return finish(makeOne(fam, prog, rnd, sub), prog);
    var u = T(rnd), r = u.r, pick = u.pick;
    var A = { S: prog.S, W: prog.W, R: prog.R };
    var dep = { S: function () { return r(6, 8.5); }, W: function () { return r(7, 10); }, R: function () { return r(4.5, 6.5); } };
    var hg = {
      gable: { S: function () { return r(5, 6.5); }, W: function () { return r(6.5, 9); }, R: function () { return r(4.2, 5.5); } },
      flat: { S: function () { return r(3.6, 4.8); }, W: function () { return r(4.2, 6); }, R: function () { return r(3.2, 4); } }
    };
    function mk(g, d, r_, h) { d = d || dep[g](); return bar(g, 0, 0, A[g] / d, d, 0, 0, h || (r_ === 'gable' || r_ === 'aframe' ? hg.gable[g]() : hg.flat[g]()), r_); }
    function mixRoof() { return pick(['flat', 'flat', 'gable', 'shed']); }
    function inline(ps, gap) { var x = 0; ps.forEach(function (p, i) { var len = p.a % 180 === 0 ? p.l : p.d; p.x = x + len / 2; x += len + (typeof gap === 'function' ? gap() : gap); }); return ps; }
    function rows(ps, gap) { var y = 0; ps.forEach(function (p) { var w = p.a % 180 === 0 ? p.d : p.l; p.y = y + w / 2; y += w + (typeof gap === 'function' ? gap() : gap); }); return ps; }
    function sOnEnd(order) { var i = order.indexOf('S'); if (i === 1) { order[1] = order[0]; order[0] = 'S'; } return order; }
    var ps, name, n, i, W, S, R, c, gap;

    switch (fam + (sub || pick(SUBS[fam])).toString()) {
      /* ----- G 박공 ----- */
      case 'G1':
        name = '한 줄 박공';
        ps = sOnEnd(u.shuffle(['S', 'W', 'R'])).map(function (g) { return mk(g, null, 'gable'); });
        gap = pick([0, 0, 1.5, 3]);
        inline(ps, gap); ps.forEach(function (p) { p.y = r(-1.5, 1.5); });
        if (rnd() < 0.5) { name = '높낮이 박공'; ps.forEach(function (p) { p.h = p.g === 'W' ? r(8.5, 10.5) : p.g === 'S' ? r(5, 6) : r(4, 4.8); }); }
        break;
      case 'G2':
        name = '나란한 박공';
        ps = u.shuffle(['S', 'W', 'R']).map(function (g) { return mk(g, null, 'gable'); });
        rows(ps, function () { return r(1.5, 4.5); }); ps.forEach(function (p) { p.x = r(-4, 4); });
        break;
      case 'G3':
        name = 'ㄱ자 박공';
        W = mk('W', null, 'gable'); S = mk('S', null, 'gable'); R = mk('R', null, 'gable');
        S.a = 90; S.x = W.l / 2 + S.d / 2; S.y = -W.d / 2 + S.l / 2;
        R.x = -W.l / 2 + R.l / 2; R.y = W.d / 2 + r(2, 4) + R.d / 2;
        ps = [W, S, R];
        break;
      case 'G4':
        name = '쪼갠 박공';
        n = pick([2, 3]); c = r(5, 6.5); ps = [];
        var hw = r(6, 8);
        for (i = 0; i < n; i++) ps.push(bar('W', i * c, 0, A.W / n / c, c, 90, 0, hw + (i % 2) * r(0, 1.5), 'gable'));
        var wl = A.W / n / c;
        S = mk('S', null, 'gable'); S.a = 90; S.x = (n - 1) * c + c / 2 + pick([0, 1.5]) + S.d / 2; S.y = (S.l - wl) / 2 * pick([-1, 1]);
        R = mk('R', null, 'gable'); R.x = -c / 2 - r(1.5, 3.5) - R.l / 2; R.y = (R.d - wl) / 2 * pick([-1, 1]);
        ps.push(S, R);
        break;

      case 'G6':
        name = '엇갈린 박공';
        var dW = r(6.5, 8.5);
        ps = [mk('S', null, 'gable'), bar('W', 0, 0, A.W / 2 / dW, dW, 0, 0, hg.gable.W(), 'gable'), bar('W', 0, 0, A.W / 2 / dW, dW, 0, 0, hg.gable.W(), 'gable'), mk('R', null, 'gable')];
        if (rnd() < 0.5) ps.reverse();
        ps.forEach(function (p) { p.a = 90; });
        inline(ps, pick([0, 1, 2]));
        var off = r(1.5, 3.2);
        ps.forEach(function (p, i) { p.y = (i % 2 ? 1 : -1) * off; });
        break;

      /* ----- R 특수 지붕 ----- */
      case 'R6':
        name = '볼트 지붕';
        ps = sOnEnd(u.shuffle(['S', 'W', 'R'])).map(function (g) { var p = mk(g, g === 'W' ? r(8, 10) : g === 'S' ? r(6.5, 8) : r(5, 6.5), 'vault'); p.h = g === 'W' ? r(6, 7.5) : g === 'S' ? r(5, 6) : r(4.2, 5); return p; });
        if (rnd() < 0.5) { ps.forEach(function (p) { p.a = 90; }); inline(ps, pick([1.5, 3])); }
        else { rows(ps, function () { return r(2, 4); }); ps.forEach(function (p) { p.x = r(-3, 3); }); }
        break;
      case 'R1':
        name = '외쪽 지붕';
        ps = u.shuffle(['S', 'W', 'R']).map(function (g) { var p = mk(g, null, 'shed'); p.h = p.g === 'W' ? r(6, 8) : p.g === 'S' ? r(4.8, 6) : r(4, 5); p.a = pick([0, 180]); return p; });
        if (rnd() < 0.5) { inline(ps, pick([0, 1.5, 3])); ps.forEach(function (p) { p.y = r(-1.5, 1.5); }); }
        else { rows(ps, function () { return r(1.5, 4); }); ps.forEach(function (p) { p.x = r(-3, 3); }); }
        break;
      case 'R2':
        name = '나비 지붕';
        W = mk('W', null, 'butterfly'); W.h = r(6, 8);
        S = mk('S', null, 'shed'); S.h = r(5, 6.2); S.a = 90; S.x = W.l / 2 + r(0, 2) + S.d / 2; S.y = -W.d / 2 + S.l / 2;
        R = mk('R', null, pick(['shed', 'butterfly'])); R.h = r(4, 5); R.x = -W.l / 2 + R.l / 2; R.y = W.d / 2 + r(2, 4) + R.d / 2;
        ps = [W, S, R];
        break;
      case 'R3':
        name = 'A형 지붕';
        ps = sOnEnd(u.shuffle(['S', 'W', 'R'])).map(function (g) { var p = mk(g, g === 'W' ? r(8, 10) : null, 'aframe'); p.h = g === 'W' ? r(8, 10.5) : g === 'S' ? r(6, 7.5) : r(5, 6); return p; });
        if (rnd() < 0.5) { inline(ps, pick([1.5, 3])); } else { rows(ps, function () { return r(2, 4); }); ps.forEach(function (p) { p.x = r(-3, 3); }); }
        break;
      case 'R4':
        name = '큰 지붕 아래';
        ps = sOnEnd(u.shuffle(['S', 'W', 'R'])).map(function (g) { var p = mk(g, null, 'flat'); p.h = r(3.6, 4.5); return p; });
        var dd = r(7, 9); ps.forEach(function (p) { p.d = p.g === 'R' ? r(5, dd) : dd; p.l = A[p.g] / p.d; });
        inline(ps, function () { return r(2, 4); });
        var x0 = Infinity, x1 = -Infinity, dm = 0, hm = 0;
        ps.forEach(function (p) { x0 = Math.min(x0, p.x - p.l / 2); x1 = Math.max(x1, p.x + p.l / 2); dm = Math.max(dm, p.d); hm = Math.max(hm, p.h); });
        ps.push(bar('roof', (x0 + x1) / 2, 0, x1 - x0 + 2, dm + 2.4, 0, hm + r(0.8, 1.8), 0.35, 'flat'));
        break;
      case 'R5':
        name = '톱날 지붕';
        n = pick([3, 4]); c = r(4, 5.2); ps = [];
        var len = A.W / n / c, hs = r(5.5, 7);
        for (i = 0; i < n; i++) ps.push(bar('W', 0, i * c, len, c, 0, 0, hs, 'shed'));
        S = mk('S', null, 'shed'); S.h = r(4.5, 5.5); S.a = 90; S.x = len / 2 + r(0, 2) + S.d / 2; S.y = S.l / 2 - c / 2;
        R = mk('R', null, 'flat'); R.x = -len / 2 - r(2, 4) - R.l / 2; R.y = (n - 1) * c + c / 2 - R.d / 2;
        ps.push(S, R);
        break;

      /* ----- S 쌓기·띄우기 ----- */
      case 'S1':
        name = '얹기';
        W = mk('W', null, 'flat'); W.h = r(4.2, 5);
        S = mk('S', W.d, 'flat'); S.h = r(4, 4.8); S.x = W.l / 2 + pick([0, 2]) + S.l / 2;
        R = mk('R', null, pick(['flat', 'gable', 'shed'])); R.z = W.h; R.h = r(3.2, 4.2);
        R.a = pick([0, 90, 15, -20]); R.x = r(-W.l / 3, W.l / 3); R.y = r(-1, 1);
        ps = [W, S, R];
        break;
      case 'S2':
        name = '띄우기';
        W = mk('W', null, pick(['flat', 'shed'])); W.z = r(3.4, 4.2); W.h = r(4, 5);
        S = bar('S', 0, 0, A.S / W.d, W.d, 0, 0, W.z, 'flat');
        S.x = (S.l - W.l) / 2 * pick([-1, 1]);
        R = mk('R', null, pick(['gable', 'flat'])); R.a = pick([0, 90]);
        R.x = (W.l / 2 + r(2, 4) + (R.a ? R.d : R.l) / 2) * (S.x > 0 ? -1 : 1); R.y = r(-2, 2);
        ps = [W, S, R];
        break;
      case 'S3':
        name = '계단식 쌓기';
        var d3 = r(7, 9);
        var W1 = bar('W', 0, 0, A.W / 2 / d3, d3, 0, 0, r(3.8, 4.4), 'flat');
        var W2 = bar('W', W1.l * r(0.3, 0.5), 0, W1.l, d3, 0, W1.h, r(3.6, 4.2), 'flat');
        R = bar('R', W2.x + W2.l * r(0.25, 0.45), 0, A.R / d3, d3, 0, W2.z + W2.h, r(3, 3.4), pick(['flat', 'shed', 'gable']));
        if (top(R) > prog.maxH) R.h = prog.maxH - R.z - 0.2;
        S = mk('S', null, 'flat'); S.x = -W1.l / 2 - pick([0, 2]) - S.l / 2; S.y = (S.d - d3) / 2 * pick([-1, 1]);
        ps = [W1, W2, R, S];
        break;
      case 'S4':
        name = '비틀어 쌓기';
        W = mk('W', null, 'flat'); W.h = r(4.4, 5.4);
        R = mk('R', null, pick(['flat', 'shed'])); R.z = W.h; R.h = r(3.2, 4); R.a = pick([1, -1]) * r(25, 50); R.x = r(-W.l / 4, W.l / 4);
        S = mk('S', null, mixRoof()); S.a = 90; S.x = W.l / 2 + r(2, 4) + S.d / 2; S.y = r(-2, 2);
        ps = [W, R, S];
        break;

      case 'S6':
        name = '캔틸레버';
        W = mk('W', r(7, 9), 'flat'); W.h = r(4, 5);
        var dR = W.d * r(0.65, 1);
        R = bar('R', 0, (W.d - dR) / 2 * pick([-1, 1]), A.R / dR, dR, 0, W.h, r(3.2, 4), pick(['flat', 'shed', 'gable']));
        R.x = W.l / 2 + r(2, 3.5) - R.l / 2;
        S = mk('S', null, mixRoof()); S.a = 90; S.x = -W.l / 2 - pick([0, 2]) - S.d / 2; S.y = (S.l - W.d) / 2 * pick([-1, 1]);
        ps = [W, R, S];
        break;

      /* ----- C 마당 감싸기 ----- */
      case 'C1':
        name = 'ㄷ자 마당';
        W = mk('W', r(6, 8), mixRoof()); S = mk('S', r(5.5, 7), mixRoof()); R = mk('R', r(4.5, 6), mixRoof());
        gap = rnd() < 0.5 ? 0 : r(1.5, 3);
        if (gap) name = '띄워 감싼 마당';
        S.a = 90; R.a = 90;
        S.x = -W.l / 2 + S.d / 2; S.y = W.d / 2 + gap + S.l / 2;
        R.x = W.l / 2 - R.d / 2; R.y = W.d / 2 + gap + R.l / 2;
        if (W.l - S.d - R.d < 4) return null;
        ps = [W, S, R];
        break;
      case 'C2':
        name = 'ㄱ자 마당';
        W = mk('W', r(6, 8), mixRoof()); S = mk('S', r(5.5, 7), mixRoof()); R = mk('R', null, mixRoof());
        S.a = 90; S.x = -W.l / 2 + S.d / 2; S.y = W.d / 2 + S.l / 2;
        c = r(6, 9);
        R.a = pick([0, 90]); R.x = W.l / 2 - (R.a ? R.d : R.l) / 2; R.y = W.d / 2 + c + (R.a ? R.l : R.d) / 2;
        ps = [W, S, R];
        break;
      case 'C3':
        name = '바람개비 마당';
        c = r(7, 10);
        W = mk('W', r(6, 7.5), mixRoof()); S = mk('S', r(5.5, 7), mixRoof()); R = mk('R', r(4.5, 6), mixRoof());
        W.x = W.l / 2 - c / 2; W.y = -c / 2 - W.d / 2;
        S.a = 90; S.x = -c / 2 - S.d / 2; S.y = -c / 2 + S.l / 2 - W.d - 0.001;
        S.y = c / 2 - S.l / 2;
        R.x = -c / 2 + R.l / 2 - S.d; R.y = c / 2 + R.d / 2;
        R.a = 0;
        ps = [W, S, R];
        if (rnd() < 0.5) { R.a = 90; R.x = c / 2 + R.d / 2; R.y = c / 2 - R.l / 2 + r(0, 3); }
        break;

      /* ----- B 바·분산 ----- */
      case 'B1':
        name = '평행 바';
        ps = u.shuffle(['S', 'W', 'R']).map(function (g) { return mk(g, g === 'W' ? r(6, 7.5) : g === 'S' ? r(5.5, 7) : r(4.5, 5.5), mixRoof()); });
        rows(ps, function () { return r(3.5, 7); }); ps.forEach(function (p) { p.x = r(-5, 5); });
        break;
      case 'B2':
        name = '흩어진 바';
        ps = ['S', 'W', 'R'].map(function (g) { var p = mk(g, null, mixRoof()); p.a = pick([0, 90, 15, -15, 30, -30, 45]); p.x = r(-14, 14); p.y = r(-9, 9); return p; });
        for (i = 0; i < ps.length; i++) for (var j = 0; j < i; j++) {
          var e1 = Object.assign({}, ps[i], { l: ps[i].l + 3, d: ps[i].d + 3 });
          if (penetration(foot(e1), foot(ps[j])) > 0) return null;
        }
        break;
      case 'B3':
        name = '긴 바와 두 덩어리';
        W = mk('W', r(5, 6.2), pick(['gable', 'flat', 'shed'])); W.h = W.r === 'gable' ? r(6, 7.5) : r(4.5, 5.5);
        S = mk('S', r(7, 8.5), mixRoof()); R = mk('R', r(5.5, 6.5), mixRoof());
        var side = pick([1, -1]);
        S.x = -W.l / 2 + S.l / 2 + r(0, 3); S.y = side * (W.d / 2 + r(2.5, 4.5) + S.d / 2);
        R.x = W.l / 2 - R.l / 2 - r(0, 3); R.y = (rnd() < 0.5 ? side : -side) * (W.d / 2 + r(2.5, 4.5) + R.d / 2);
        ps = [W, S, R];
        break;
      case 'B6':
        name = '작은 동 흩기';
        var dB = r(5.5, 7);
        var W1b = bar('W', 0, 0, A.W / 2 / dB, dB, 0, 0, 0, mixRoof()), W2b = bar('W', 0, 0, A.W / 2 / dB, dB, 0, 0, 0, mixRoof());
        S = mk('S', dB, mixRoof()); R = mk('R', r(4.5, 5.5), mixRoof());
        [W1b, W2b, S, R].forEach(function (p) { p.h = p.r === 'gable' ? (p.g === 'R' ? r(4.2, 5) : r(5.5, 7)) : (p.g === 'R' ? r(3.2, 4) : r(4, 5.2)); });
        var gx = r(3, 5), gy = r(3, 5);
        var row1 = rnd() < 0.5 ? [W1b, S] : [S, W1b], row2 = rnd() < 0.5 ? [W2b, R] : [R, W2b];
        inline(row1, gx); inline(row2, gx);
        var sh = r(-3, 3);
        row1.forEach(function (p) { p.y = 0; });
        row2.forEach(function (p) { p.x += sh; p.y = dB / 2 + gy + p.d / 2; });
        ps = row1.concat(row2);
        break;
      case 'B4':
        name = '엇갈린 바';
        ps = u.shuffle(['S', 'W', 'R']).map(function (g) { return mk(g, g === 'W' ? r(6, 7.5) : g === 'S' ? r(5.5, 7) : r(4.5, 5.5), mixRoof()); });
        var y = 0, x = 0, st = r(4, 7) * pick([1, -1]);
        ps.forEach(function (p) { p.y = y + p.d / 2; y += p.d + r(0, 2); p.x = x; x += st; });
        break;
    }
    return finish(ps ? { name: name, pieces: ps } : null, prog);
  }
  function finish(t, prog) {
    if (!t) return null;
    var ps = t.pieces;
    for (var i = 0; i < ps.length; i++) for (var k = 0; k < i; k++) {
      var p1 = ps[i], p2 = ps[k];
      if (p1.z < top(p2) - TOL && p2.z < top(p1) - TOL && penetration(foot(p1), foot(p2)) > TOL) return null;
    }
    ps.forEach(function (p) { if (top(p) > prog.maxH) p.h = Math.max(2.5, prog.maxH - p.z - 0.1); });
    return t;
  }

  function transform(ps, ang, tx, ty, mirror) {
    var c = Math.cos(ang * Math.PI / 180), s = Math.sin(ang * Math.PI / 180);
    return ps.map(function (p) {
      var x = p.x, y = mirror ? -p.y : p.y, a = mirror ? -p.a : p.a;
      return Object.assign({}, p, { x: tx + c * x - s * y, y: ty + s * x + c * y, a: ((a + ang) % 360 + 360) % 360 });
    });
  }
  function centerOf(ps) {
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    ps.forEach(function (p) { foot(p).forEach(function (q) { x0 = Math.min(x0, q[0]); x1 = Math.max(x1, q[0]); y0 = Math.min(y0, q[1]); y1 = Math.max(y1, q[1]); }); });
    return [(x0 + x1) / 2, (y0 + y1) / 2];
  }
  function bbox(P) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    P.forEach(function (q) { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[0]); b[3] = Math.max(b[3], q[1]); });
    return b;
  }

  function placeOne(fam, site, prog, rnd, sub, mode) {
    var bb = bbox(site.poly), base = longestEdgeAngle(site.poly), Y = yardPoly(site, prog);
    for (var t = 0; t < 40; t++) {
      var tpl = makeTemplate(fam, prog, rnd, t < 24 ? sub : 0, mode);
      if (!tpl) continue;
      var c = centerOf(tpl.pieces);
      var local = tpl.pieces.map(function (p) { return Object.assign({}, p, { x: p.x - c[0], y: p.y - c[1] }); });
      var best = null, found = 0;
      for (var k = 0; k < 260 && found < 18; k++) {
        var tx = bb[0] + rnd() * (bb[2] - bb[0]), ty = bb[1] + rnd() * (bb[3] - bb[1]);
        if (!inPoly([tx, ty], site.poly)) continue;
        var ang = base + (rnd() < 0.5 ? 0 : 90) + (fam === 'B' ? [0, 0, 8, -8][Math.floor(rnd() * 4)] : 0);
        var ps = transform(local, ang, tx, ty, rnd() < 0.5);
        var ck = check({ pieces: ps }, site, prog);
        if (!ck.ok) continue;
        found++;
        var score = (ck.near == null ? 0 : ck.near) + rnd() * 3;
        if (!best || score < best.score) best = { score: score, ps: ps, name: tpl.name };
      }
      if (best) return { name: best.name, pieces: best.ps.map(round) };
    }
    return null;
  }
  function round(p) {
    var q = {};
    for (var k in p) q[k] = typeof p[k] === 'number' ? Math.round(p[k] * 1000) / 1000 : p[k];
    return q;
  }

  function generate(site, prog, plan, seed, startIdx, mode) {
    var subs = mode === 'one' ? SUBS1 : SUBS;
    var rnd = mulberry(seed), out = [], fails = 0;
    plan.forEach(function (f) {
      for (var i = 0; i < f.n; i++) {
        var r = placeOne(f.k, site, prog, rnd, subs[f.k][i % subs[f.k].length], mode);
        if (!r) { fails++; continue; }
        var idx = (startIdx[f.k] || 0) + 1; startIdx[f.k] = idx;
        if (mode === 'one') linkTouching(r.pieces, 'u' + seed.toString(36) + f.k + i);
        out.push({ id: f.k + '-' + seed.toString(36) + '-' + i, fam: f.k, num: idx, name: r.name, pieces: r.pieces, orig: JSON.stringify(r.pieces) });
      }
    });
    return { alts: out, fails: fails };
  }

  /* give every set of touching body pieces a shared union id so they draw as one mass */
  function linkTouching(ps, base) {
    var body = []; ps.forEach(function (p, i) { if (p.g !== 'roof') body.push(i); });
    var feet = ps.map(foot), comp = {}, n = 0;
    body.forEach(function (i) {
      if (comp[i] != null) return;
      var stack = [i]; comp[i] = n;
      while (stack.length) {
        var a = stack.pop();
        body.forEach(function (j) {
          if (comp[j] != null) return;
          var p = ps[a], q = ps[j];
          if (p.z > top(q) + 0.06 || q.z > top(p) + 0.06) return;
          if (polyDist(feet[a], feet[j]) > 0.06) return;
          if ((p.z >= top(q) - 0.06 || q.z >= top(p) - 0.06) && penetration(feet[a], feet[j]) < 0.5) return;
          comp[j] = n; stack.push(j);
        });
      }
      n++;
    });
    var size = {}; body.forEach(function (i) { size[comp[i]] = (size[comp[i]] || 0) + 1; });
    var changed = false;
    body.forEach(function (i) { if (size[comp[i]] > 1) { var id = base + '_' + comp[i]; if (ps[i].u !== id) { ps[i].u = id; changed = true; } } });
    return changed;
  }

  /* ---- merge: replace several pieces with one box of the same total floor area ---- */
  function mergePieces(ps) {
    var body = ps.filter(function (p) { return p.g !== 'roof'; });
    if (!body.length) body = ps;
    var big = body.slice().sort(function (a, b) { return b.l * b.d - a.l * a.d; })[0];
    var area = 0, zmin = Infinity, top_ = -Infinity, gA = {};
    body.forEach(function (p) { var a = p.l * p.d; area += a; zmin = Math.min(zmin, p.z); top_ = Math.max(top_, p.z + p.h); gA[p.g] = (gA[p.g] || 0) + a; });
    var g = Object.keys(gA).sort(function (a, b) { return gA[b] - gA[a]; })[0];
    var ang = big.a * Math.PI / 180, c = Math.cos(ang), s = Math.sin(ang);
    var u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    ps.forEach(function (p) { foot(p).forEach(function (q) { var u = q[0] * c + q[1] * s, v = -q[0] * s + q[1] * c; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }); });
    var lu = Math.max(1, u1 - u0), lv = Math.max(1, v1 - v0), aspect = lu / lv;
    var d = Math.sqrt(area / aspect), l = area / d;
    var cu = (u0 + u1) / 2, cv = (v0 + v1) / 2;
    var h = big.r === 'flat' ? Math.max(2.5, top_ - zmin) : Math.max(big.h, Math.min(top_ - zmin, big.h * 1.4));
    return round({ g: g, x: cu * c - cv * s, y: cu * s + cv * c, l: l, d: d, a: big.a, z: zmin, h: h, r: big.r });
  }
  /* ---- snap: slide pieces toward the first one until they touch ---- */
  function snapTogether(ps) {
    if (ps.length < 2) return ps;
    var out = [Object.assign({}, ps[0])];
    var ax = ps[0].x, ay = ps[0].y;
    function clash(q) {
      for (var i = 0; i < out.length; i++) { var o = out[i]; if (q.z < top(o) - TOL && o.z < top(q) - TOL && penetration(foot(q), foot(o)) > TOL) return true; }
      return false;
    }
    function gap(q) {
      var m = Infinity;
      for (var i = 0; i < out.length; i++) { var o = out[i]; if (q.z < top(o) + 0.06 && o.z < top(q) + 0.06) m = Math.min(m, polyDist(foot(q), foot(o))); }
      return m;
    }
    ps.slice(1).sort(function (a, b) { return Math.hypot(a.x - ax, a.y - ay) - Math.hypot(b.x - ax, b.y - ay); }).forEach(function (p) {
      var q = Object.assign({}, p), dx = ax - p.x, dy = ay - p.y;
      if (gap(q) <= 0.06 || clash(q)) { out.push(q); return; }
      var lo = 0, hi = 1, best = 0;
      for (var k = 0; k < 30; k++) {
        var t = (lo + hi) / 2; q.x = p.x + dx * t; q.y = p.y + dy * t;
        if (clash(q)) hi = t; else { best = t; lo = t; }
      }
      q.x = p.x + dx * best; q.y = p.y + dy * best;
      out.push(round(q));
    });
    return out;
  }

  /* ---- variations of an existing alternative ---- */
  function vary(alt, site, prog, seed, n) {
    var rnd = mulberry(seed), out = [], tries = 0;
    while (out.length < n && tries++ < 400) {
      var k = 0.5 + tries / 200;
      var c = [0, 0]; alt.pieces.forEach(function (p) { c[0] += p.x / alt.pieces.length; c[1] += p.y / alt.pieces.length; });
      var rot = (rnd() - 0.5) * 16 * k, cr = Math.cos(rot * Math.PI / 180), sr = Math.sin(rot * Math.PI / 180);
      var one = isOne(alt.pieces), sc = 1, dh = (rnd() - 0.5) * 1.6 * k;
      var shx = (rnd() - 0.5) * 4 * k, shy = (rnd() - 0.5) * 4 * k;
      var ps = alt.pieces.map(function (p) {
        var dx = p.x - c[0], dy = p.y - c[1];
        if (one) {
          var q1 = Object.assign({}, p, {
            x: c[0] + (cr * dx - sr * dy) * sc + shx, y: c[1] + (sr * dx + cr * dy) / sc + shy,
            a: ((p.a + rot) % 360 + 360) % 360
          });
          if (p.g !== 'roof') q1.h = Math.max(2.5, Math.min(prog.maxH - q1.z, p.h + dh));
          return round(q1);
        }
        var q = Object.assign({}, p, {
          x: c[0] + cr * dx - sr * dy + (rnd() - 0.5) * 3 * k,
          y: c[1] + sr * dx + cr * dy + (rnd() - 0.5) * 3 * k,
          a: ((p.a + rot + (rnd() < 0.3 ? (rnd() - 0.5) * 20 * k : 0)) % 360 + 360) % 360
        });
        if (p.g !== 'roof') {
          q.h = Math.max(2.5, Math.min(prog.maxH - q.z, p.h + (rnd() - 0.5) * 1.6 * k));
          var ratio = 1 + (rnd() - 0.5) * 0.3 * k; q.l = p.l * ratio; q.d = p.d / ratio;
        }
        return round(q);
      });
      var ck = check({ pieces: ps }, site, prog);
      if (ck.ok) out.push(ps);
    }
    return out;
  }

  /* ---- DXF ---- */
  function parseDXF(text) {
    var L = text.split(/\r\n|\r|\n/), pairs = [];
    for (var i = 0; i + 1 < L.length; i += 2) pairs.push([parseInt(L[i], 10), L[i + 1].trim()]);
    var units = 0, section = null, ents = [], cur = null, inBlock = false;
    for (i = 0; i < pairs.length; i++) {
      var c = pairs[i][0], v = pairs[i][1];
      if (c === 0 && v === 'SECTION') { section = pairs[i + 1] ? pairs[i + 1][1] : null; continue; }
      if (c === 0 && v === 'ENDSEC') { section = null; cur = null; continue; }
      if (section === 'HEADER' && c === 9 && v === '$INSUNITS') { units = parseInt(pairs[i + 1][1], 10) || 0; continue; }
      if (section === 'ENTITIES') {
        if (c === 0) { cur = { type: v, d: [] }; ents.push(cur); }
        else if (cur) cur.d.push([c, v]);
      }
    }
    var segs = [], polys = [];
    function g(e, code) { for (var k = 0; k < e.d.length; k++) if (e.d[k][0] === code) return parseFloat(e.d[k][1]); return 0; }
    function paper(e) { for (var k = 0; k < e.d.length; k++) if (e.d[k][0] === 67 && e.d[k][1] === '1') return true; return false; }
    function arcPts(cx, cy, r, a0, a1) {
      if (a1 < a0) a1 += 360;
      var n = Math.max(6, Math.ceil((a1 - a0) / 10)), pts = [];
      for (var k = 0; k <= n; k++) { var a = (a0 + (a1 - a0) * k / n) * Math.PI / 180; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
      return pts;
    }
    function addPath(pts, closed) {
      for (var k = 0; k + 1 < pts.length; k++) segs.push([pts[k][0], pts[k][1], pts[k + 1][0], pts[k + 1][1]]);
      if (closed && pts.length > 2) segs.push([pts[pts.length - 1][0], pts[pts.length - 1][1], pts[0][0], pts[0][1]]);
      if (pts.length > 2) {
        var f = pts[0], l = pts[pts.length - 1];
        var isClosed = closed || Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6;
        if (isClosed) polys.push(Math.hypot(f[0] - l[0], f[1] - l[1]) < 1e-6 ? pts.slice(0, -1) : pts);
      }
    }
    for (i = 0; i < ents.length; i++) {
      var e = ents[i];
      if (paper(e)) continue;
      if (e.type === 'LINE') segs.push([g(e, 10), g(e, 20), g(e, 11), g(e, 21)]);
      else if (e.type === 'LWPOLYLINE') {
        var pts = [], x = null, flags = 0;
        e.d.forEach(function (p) {
          if (p[0] === 70) flags = parseInt(p[1], 10);
          else if (p[0] === 10) x = parseFloat(p[1]);
          else if (p[0] === 20 && x !== null) { pts.push([x, parseFloat(p[1])]); x = null; }
        });
        addPath(pts, flags & 1);
      } else if (e.type === 'POLYLINE') {
        var fl = parseInt((e.d.find(function (p) { return p[0] === 70; }) || [0, '0'])[1], 10), vs = [];
        for (var j = i + 1; j < ents.length && ents[j].type !== 'SEQEND'; j++) {
          if (ents[j].type === 'VERTEX') {
            var vf = g(ents[j], 70);
            if (!(vf & 16)) vs.push([g(ents[j], 10), g(ents[j], 20)]);
          }
        }
        i = j;
        if (!(fl & 64) && !(fl & 16)) addPath(vs, fl & 1);
      } else if (e.type === 'ARC') {
        addPath(arcPts(g(e, 10), g(e, 20), g(e, 40), g(e, 50), g(e, 51)), false);
      } else if (e.type === 'CIRCLE') {
        var cp = arcPts(g(e, 10), g(e, 20), g(e, 40), 0, 360); cp.pop(); addPath(cp, true);
      }
    }
    return { units: units, segs: segs, polys: polys };
  }
  function unitsPerMeter(code, ext) {
    var m = { 1: 39.3701, 2: 3.28084, 4: 1000, 5: 100, 6: 1, 14: 10 };
    if (m[code]) return { upm: m[code], guessed: false };
    return { upm: ext > 3000 ? 1000 : 1, guessed: true };
  }

  return {
    FAMS: FAMS, GROUPS: GROUPS, ROOFS: ROOFS, area: area, ccw: ccw, inPoly: inPoly, distSeg: distSeg, faces: faces, foot: foot, top: top,
    yardPoly: yardPoly, check: check, generate: generate, mergePieces: mergePieces, snapTogether: snapTogether, linkTouching: linkTouching, touching: function (ps) { return connected(ps, ps.map(foot)); }, vary: vary, SUBS: SUBS, SUBS1: SUBS1, isOne: isOne, parseDXF: parseDXF, unitsPerMeter: unitsPerMeter, bbox: bbox, mulberry: mulberry
  };
})();
if (typeof module !== 'undefined') module.exports = Core;
