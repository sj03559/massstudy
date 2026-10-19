/* Boolean union of touching pieces (BSP CSG, after csg.js by Evan Wallace, MIT) + feature-edge detection,
   so merged pieces read as one mass: shared faces disappear and seams on flat faces are not drawn. */
var Union = (function () {
  var EPS = 1e-5;
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function lerp(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  function newell(vs) {
    var n = [0, 0, 0];
    for (var i = 0; i < vs.length; i++) { var a = vs[i], b = vs[(i + 1) % vs.length]; n[0] += (a[1] - b[1]) * (a[2] + b[2]); n[1] += (a[2] - b[2]) * (a[0] + b[0]); n[2] += (a[0] - b[0]) * (a[1] + b[1]); }
    var l = Math.hypot(n[0], n[1], n[2]) || 1; return [n[0] / l, n[1] / l, n[2] / l];
  }

  function Plane(n, w) { this.n = n; this.w = w; }
  Plane.of = function (vs) { var n = newell(vs), c = [0, 0, 0]; vs.forEach(function (v) { c[0] += v[0]; c[1] += v[1]; c[2] += v[2]; }); c = [c[0] / vs.length, c[1] / vs.length, c[2] / vs.length]; return new Plane(n, dot(n, c)); };
  Plane.prototype.clone = function () { return new Plane(this.n.slice(), this.w); };
  Plane.prototype.flip = function () { this.n = [-this.n[0], -this.n[1], -this.n[2]]; this.w = -this.w; };
  Plane.prototype.split = function (poly, cf, cb, f, b) {
    var C = 0, F = 1, B = 2, SP = 3, pt = 0, types = [], self = this;
    poly.v.forEach(function (v) { var t = dot(self.n, v) - self.w, ty = t < -EPS ? B : t > EPS ? F : C; pt |= ty; types.push(ty); });
    if (pt === C) (dot(this.n, poly.plane.n) > 0 ? cf : cb).push(poly);
    else if (pt === F) f.push(poly);
    else if (pt === B) b.push(poly);
    else {
      var fv = [], bv = [];
      for (var i = 0; i < poly.v.length; i++) {
        var j = (i + 1) % poly.v.length, ti = types[i], tj = types[j], vi = poly.v[i], vj = poly.v[j];
        if (ti !== B) fv.push(vi);
        if (ti !== F) bv.push(vi);
        if ((ti | tj) === SP) { var t = (this.w - dot(this.n, vi)) / dot(this.n, sub(vj, vi)), v = lerp(vi, vj, t); fv.push(v); bv.push(v); }
      }
      if (fv.length >= 3) f.push(new Poly(fv, poly.shared, poly.plane));
      if (bv.length >= 3) b.push(new Poly(bv, poly.shared, poly.plane));
    }
  };
  function Poly(v, shared, plane) { this.v = v; this.shared = shared; this.plane = plane ? plane.clone() : Plane.of(v); }
  Poly.prototype.clone = function () { return new Poly(this.v.map(function (p) { return p.slice(); }), this.shared, this.plane); };
  Poly.prototype.flip = function () { this.v.reverse(); this.plane.flip(); };

  function Node(polys) { this.plane = null; this.front = null; this.back = null; this.polys = []; if (polys) this.build(polys); }
  Node.prototype.invert = function () {
    this.polys.forEach(function (p) { p.flip(); });
    this.plane.flip();
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();
    var t = this.front; this.front = this.back; this.back = t;
  };
  Node.prototype.clip = function (polys) {
    if (!this.plane) return polys.slice();
    var f = [], b = [], self = this;
    polys.forEach(function (p) { self.plane.split(p, f, b, f, b); });
    if (this.front) f = this.front.clip(f);
    b = this.back ? this.back.clip(b) : [];
    return f.concat(b);
  };
  Node.prototype.clipTo = function (bsp) { this.polys = bsp.clip(this.polys); if (this.front) this.front.clipTo(bsp); if (this.back) this.back.clipTo(bsp); };
  Node.prototype.all = function () { var p = this.polys.slice(); if (this.front) p = p.concat(this.front.all()); if (this.back) p = p.concat(this.back.all()); return p; };
  Node.prototype.build = function (polys) {
    if (!polys.length) return;
    if (!this.plane) this.plane = polys[0].plane.clone();
    var f = [], b = [], self = this;
    polys.forEach(function (p) { self.plane.split(p, self.polys, self.polys, f, b); });
    if (f.length) { if (!this.front) this.front = new Node(); this.front.build(f); }
    if (b.length) { if (!this.back) this.back = new Node(); this.back.build(b); }
  };
  function union(A, B) {
    var a = new Node(A.map(function (p) { return p.clone(); })), b = new Node(B.map(function (p) { return p.clone(); }));
    a.clipTo(b); b.clipTo(a); b.invert(); b.clipTo(a); b.invert();
    a.build(b.all());
    return a.all();
  }

  /* in-plane point test for a polygon */
  function inside(q, poly) {
    var n = poly.plane.n, ax = Math.abs(n[0]) > Math.abs(n[1]) ? (Math.abs(n[0]) > Math.abs(n[2]) ? 0 : 2) : (Math.abs(n[1]) > Math.abs(n[2]) ? 1 : 2);
    var i0 = ax === 0 ? 1 : 0, i1 = ax === 2 ? 1 : 2, c = false, V = poly.v;
    for (var i = 0, j = V.length - 1; i < V.length; j = i++) {
      var a = V[i], b = V[j];
      if ((a[i1] > q[i1]) !== (b[i1] > q[i1]) && q[i0] < (b[i0] - a[i0]) * (q[i1] - a[i1]) / (b[i1] - a[i1]) + a[i0]) c = !c;
    }
    return c;
  }
  /* an edge is a seam (not drawn) when, just across it, another polygon continues the same plane */
  function featureEdges(polys) {
    return polys.map(function (P) {
      if (P.shared && P.shared.smooth) return P.v.map(function () { return false; });
      var n = P.plane.n;
      return P.v.map(function (a, i) {
        var b = P.v[(i + 1) % P.v.length], e = sub(b, a), L = Math.hypot(e[0], e[1], e[2]);
        if (L < 1e-6) return false;
        var d = cross(e, n), dl = Math.hypot(d[0], d[1], d[2]) || 1, m = lerp(a, b, 0.5), q = [m[0] + d[0] / dl * 0.02, m[1] + d[1] / dl * 0.02, m[2] + d[2] / dl * 0.02];
        for (var k = 0; k < polys.length; k++) {
          var Q = polys[k];
          if (Q === P || dot(Q.plane.n, n) < 0.9999 || Math.abs(dot(Q.plane.n, q) - Q.plane.w) > 1e-3) continue;
          if (inside(q, Q)) return false;
        }
        return true;
      });
    });
  }

  var cache = new Map();
  /* pieces with the same p.u become one body. Returns [{v:[[x,y,z]..], n, edges:[bool], pi, smooth}] for every piece set. */
  function solids(pieces) {
    var key = JSON.stringify(pieces.map(function (p) { return [p.u || '', p.x, p.y, p.l, p.d, p.a, p.z, p.h, p.r, p.g]; }));
    if (cache.has(key)) return cache.get(key);
    var out = [], groups = {};
    pieces.forEach(function (p, i) { if (p.u && p.g !== 'roof') (groups[p.u] = groups[p.u] || []).push(i); });
    var done = {};
    pieces.forEach(function (p, i) {
      var gi = p.u && groups[p.u] && groups[p.u].length > 1 ? groups[p.u] : null;
      if (!gi) {
        Core.faces(p).forEach(function (f) { out.push({ v: f, n: newell(f), edges: f.map(function () { return !f.smooth; }), pi: i, smooth: !!f.smooth }); });
        return;
      }
      if (done[p.u]) return; done[p.u] = 1;
      var acc = null;
      gi.forEach(function (k) {
        var ps = Core.faces(pieces[k]).map(function (f) { return new Poly(f.map(function (q) { return q.slice(); }), { pi: k, smooth: !!f.smooth }); });
        acc = acc ? union(acc, ps) : ps;
      });
      var fe = featureEdges(acc);
      acc.forEach(function (P, k) { out.push({ v: P.v, n: P.plane.n, edges: fe[k], pi: P.shared.pi, smooth: P.shared.smooth, group: p.u }); });
    });
    if (cache.size > 400) cache.clear();
    cache.set(key, out);
    return out;
  }
  return { solids: solids, union: union, newell: newell };
})();
if (typeof module !== 'undefined') module.exports = Union;
