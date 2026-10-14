/* Sheet layout + exporters: SVG, Illustrator (.ai = PDF with embedded Noto Sans KR), PNG, OBJ, ZIP. */
var Export = (function () {
  var W = 2383.94, H = 1683.78; // A1 landscape, pt
  var INK = [0.102, 0.133, 0.157], RULE = [0.788, 0.816, 0.827], EDGE = [0.243, 0.431, 0.557];

  /* groups: [{f:{k,ko}, items:[{a, code}]}] -> layout in pt, y down */
  function layout(groups) {
    var ML = 50, MR = 50, MT = 50, MB = 40, LABW = 190, COLS = 10;
    var rows = [];
    groups.forEach(function (g) {
      for (var i = 0; i < g.items.length; i += COLS) rows.push({ title: i === 0 ? g.f.k + ' ' + g.f.ko : null, items: g.items.slice(i, i + COLS) });
    });
    var cw = (W - ML - MR - LABW) / COLS, rh = Math.min((H - MT - MB) / Math.max(1, rows.length), 420), dw = cw - 14, dh = rh - 46;
    var mw = 0, mh = 0;
    rows.forEach(function (r) { r.items.forEach(function (it) {
      it.F = Axon.faces(it.a.pieces); it.b = Axon.bboxOf(it.F);
      mw = Math.max(mw, it.b[2] - it.b[0]); mh = Math.max(mh, it.b[3] - it.b[1]);
    }); });
    var sc = Math.min(dw / (mw || 1), dh / (mh || 1));
    var out = { rules: [], titles: [], codes: [], polys: [] };
    rows.forEach(function (r, ri) {
      var y0 = MT + ri * rh;
      if (r.title) { out.rules.push([ML, y0, W - MR, y0]); out.titles.push({ x: ML, y: y0 + 34, t: r.title, size: 20 }); }
      r.items.forEach(function (it, ci) {
        var x0 = ML + LABW + ci * cw, b = it.b;
        var cx = x0 + cw / 2 - (b[0] + b[2]) / 2 * sc, cy = y0 + 40 + (rh - 46) / 2 + (b[1] + b[3]) / 2 * sc;
        out.codes.push({ x: x0 + 10, y: y0 + 30, t: it.code, size: 15, id: it.code });
        it.F.forEach(function (f) {
          out.polys.push({ id: it.code, pts: f.pts.map(function (q) { return [cx + q[0] * sc, cy - q[1] * sc]; }), rgb: f.rgb, fill: f.fill, smooth: f.smooth });
        });
      });
    });
    return out;
  }
  function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

  function svg(groups) {
    var L = layout(groups), o = [];
    o.push('<?xml version="1.0" encoding="UTF-8"?>');
    o.push('<svg xmlns="http://www.w3.org/2000/svg" width="841mm" height="594mm" viewBox="0 0 ' + W + ' ' + H + '">');
    o.push('<rect width="' + W + '" height="' + H + '" fill="#FFFFFF"/>');
    var TF = 'font-family="\'Noto Sans KR\', \'NotoSansKR-Regular\', sans-serif"';
    L.rules.forEach(function (r) { o.push('<line x1="' + r[0] + '" y1="' + r[1].toFixed(2) + '" x2="' + r[2] + '" y2="' + r[3].toFixed(2) + '" stroke="#C9D0D3" stroke-width="0.8"/>'); });
    L.titles.forEach(function (t) { o.push('<text x="' + t.x + '" y="' + t.y.toFixed(2) + '" ' + TF + ' font-size="' + t.size + '" fill="#1A2228">' + esc(t.t) + '</text>'); });
    var cur = null;
    L.codes.forEach(function (c) {
      o.push('<g id="' + c.id + '">');
      o.push('<text x="' + c.x.toFixed(2) + '" y="' + c.y.toFixed(2) + '" ' + TF + ' font-size="' + c.size + '" fill="#1A2228">' + esc(c.t) + '</text>');
      L.polys.forEach(function (p) { if (p.id === c.id) o.push('<polygon points="' + p.pts.map(function (q) { return q[0].toFixed(2) + ',' + q[1].toFixed(2); }).join(' ') + '" fill="' + p.fill + '" stroke="' + (p.smooth ? p.fill : '#3E6E8E') + '" stroke-width="0.4" stroke-linejoin="round"/>'); });
      o.push('</g>');
    });
    o.push('</svg>');
    return o.join('\n');
  }

  /* ---------- PDF (saved as .ai) with an embedded TrueType subset, text stays editable ---------- */
  function b64bytes(s) { var bin = atob(s), u = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; }
  function n(v) { return (Math.round(v * 100) / 100).toString(); }
  function textHex(t) {
    var h = '';
    for (var i = 0; i < t.length; i++) { var m = FONT_KR.map[t[i]]; var g = m ? m[0] : 0; h += ('0000' + g.toString(16)).slice(-4); }
    return h;
  }
  function ai(groups) {
    var L = layout(groups), c = [];
    function col(rgb, op) { return rgb.map(function (v) { return n(v); }).join(' ') + ' ' + op; }
    c.push('1 1 1 rg 0 0 ' + n(W) + ' ' + n(H) + ' re f');
    c.push(col(RULE, 'RG') + ' 0.8 w');
    L.rules.forEach(function (r) { c.push(n(r[0]) + ' ' + n(H - r[1]) + ' m ' + n(r[2]) + ' ' + n(H - r[3]) + ' l S'); });
    c.push('1 j 0.4 w ' + col(EDGE, 'RG'));
    L.polys.forEach(function (p) {
      var s = col(p.rgb, 'rg') + ' ' + (p.smooth ? col(p.rgb, 'RG') : col(EDGE, 'RG')) + ' ';
      p.pts.forEach(function (q, i) { s += n(q[0]) + ' ' + n(H - q[1]) + (i ? ' l ' : ' m '); });
      c.push(s + 'h B');
    });
    c.push(col(INK, 'rg'));
    L.titles.concat(L.codes).forEach(function (t) { c.push('BT /F1 ' + t.size + ' Tf ' + n(t.x) + ' ' + n(H - t.y) + ' Td <' + textHex(t.t) + '> Tj ET'); });
    var content = c.join('\n');

    var used = {}, ws = [];
    Object.keys(FONT_KR.map).forEach(function (ch) { var m = FONT_KR.map[ch]; used[m[0]] = m[1]; });
    Object.keys(used).map(Number).sort(function (a, b) { return a - b; }).forEach(function (g) { ws.push(g + ' [' + used[g] + ']'); });
    var cmapLines = [];
    Object.keys(FONT_KR.map).forEach(function (ch) { cmapLines.push('<' + ('0000' + FONT_KR.map[ch][0].toString(16)).slice(-4) + '> <' + ('0000' + ch.charCodeAt(0).toString(16)).slice(-4) + '>'); });
    var tounicode = '/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /Adobe-Identity-UCS def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n' +
      cmapLines.length + ' beginbfchar\n' + cmapLines.join('\n') + '\nendbfchar\nendcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
    var ttf = b64bytes(FONT_KR.ttf), fname = FONT_KR.name, bb = FONT_KR.bbox;

    var enc = new TextEncoder(), parts = [], offs = [], len = 0;
    function push(x) { var u = typeof x === 'string' ? enc.encode(x) : x; parts.push(u); len += u.length; }
    function obj(i, body) { offs[i] = len; push(i + ' 0 obj\n' + body + '\nendobj\n'); }
    function streamObj(i, dict, bytes) { offs[i] = len; push(i + ' 0 obj\n<< ' + dict + ' /Length ' + bytes.length + ' >>\nstream\n'); push(bytes); push('\nendstream\nendobj\n'); }
    push('%PDF-1.6\n'); push(new Uint8Array([37, 226, 227, 207, 211, 10]));
    obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
    obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
    obj(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + n(W) + ' ' + n(H) + '] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>');
    streamObj(4, '', enc.encode(content));
    obj(5, '<< /Type /Font /Subtype /Type0 /BaseFont /' + fname + ' /Encoding /Identity-H /DescendantFonts [6 0 R] /ToUnicode 9 0 R >>');
    obj(6, '<< /Type /Font /Subtype /CIDFontType2 /BaseFont /' + fname + ' /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor 7 0 R /DW 1000 /W [' + ws.join(' ') + '] /CIDToGIDMap /Identity >>');
    obj(7, '<< /Type /FontDescriptor /FontName /' + fname + ' /Flags 4 /FontBBox [' + bb.join(' ') + '] /ItalicAngle 0 /Ascent ' + FONT_KR.asc + ' /Descent ' + FONT_KR.desc + ' /CapHeight ' + FONT_KR.cap + ' /StemV 80 /FontFile2 8 0 R >>');
    streamObj(8, '/Length1 ' + ttf.length, ttf);
    streamObj(9, '', enc.encode(tounicode));
    var xref = len, x = 'xref\n0 10\n0000000000 65535 f \n';
    for (var i = 1; i <= 9; i++) x += ('0000000000' + offs[i]).slice(-10) + ' 00000 n \n';
    push(x + 'trailer\n<< /Size 10 /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
    return new Blob(parts, { type: 'application/pdf' });
  }

  /* ---------- PNG (A1 at ~150 dpi) ---------- */
  function png(groups, scale) {
    scale = scale || 2.08;
    var L = layout(groups), cv = document.createElement('canvas');
    cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
    var c = cv.getContext('2d'); c.scale(scale, scale);
    c.fillStyle = '#FFFFFF'; c.fillRect(0, 0, W, H);
    c.strokeStyle = '#C9D0D3'; c.lineWidth = 0.8;
    L.rules.forEach(function (r) { c.beginPath(); c.moveTo(r[0], r[1]); c.lineTo(r[2], r[3]); c.stroke(); });
    c.lineJoin = 'round'; c.lineWidth = 0.4; c.strokeStyle = '#3E6E8E';
    L.polys.forEach(function (p) { c.beginPath(); p.pts.forEach(function (q, i) { if (i) c.lineTo(q[0], q[1]); else c.moveTo(q[0], q[1]); }); c.closePath(); c.fillStyle = p.fill; c.fill(); c.strokeStyle = p.smooth ? p.fill : '#3E6E8E'; c.stroke(); });
    c.fillStyle = '#1A2228';
    L.titles.concat(L.codes).forEach(function (t) { c.font = t.size + 'px "Noto Sans KR", sans-serif'; c.fillText(t.t, t.x, t.y); });
    return new Promise(function (res) { cv.toBlob(function (b) { res(b); }, 'image/png'); });
  }

  /* ---------- OBJ ---------- */
  function triangulate(f, nrm) {
    if (f.length === 3) return [f];
    var ax = Math.abs(nrm[0]) > Math.abs(nrm[1]) ? (Math.abs(nrm[0]) > Math.abs(nrm[2]) ? 0 : 2) : (Math.abs(nrm[1]) > Math.abs(nrm[2]) ? 1 : 2);
    var pts = f.map(function (p) { return ax === 0 ? [p[1], p[2]] : ax === 1 ? [p[2], p[0]] : [p[0], p[1]]; });
    var sg = nrm[ax] >= 0 ? 1 : -1;
    function cr(o, a, b) { return ((pts[a][0] - pts[o][0]) * (pts[b][1] - pts[o][1]) - (pts[a][1] - pts[o][1]) * (pts[b][0] - pts[o][0])) * sg; }
    function inside(p, a, b, c) { return cr(a, b, p) >= -1e-9 && cr(b, c, p) >= -1e-9 && cr(c, a, p) >= -1e-9; }
    var idx = f.map(function (_, i) { return i; }), out = [], guard = 0;
    while (idx.length > 3 && guard++ < 200) {
      var cut = false;
      for (var k = 0; k < idx.length; k++) {
        var a = idx[(k - 1 + idx.length) % idx.length], b = idx[k], c = idx[(k + 1) % idx.length];
        if (cr(a, b, c) <= 1e-12) continue;
        var bad = false;
        for (var j = 0; j < idx.length; j++) { var q = idx[j]; if (q !== a && q !== b && q !== c && inside(q, a, b, c)) { bad = true; break; } }
        if (bad) continue;
        out.push([f[a], f[b], f[c]]); idx.splice(k, 1); cut = true; break;
      }
      if (!cut) break;
    }
    if (idx.length === 3) out.push([f[idx[0]], f[idx[1]], f[idx[2]]]);
    return out;
  }
  var GN = { S: 'Storage', W: 'Work', R: 'Rest', roof: 'Roof' };
  function obj(list, site) {
    var b = Core.bbox(site.poly), sx = (b[2] - b[0]) + 15, sy = (b[3] - b[1]) + 15, o = site.origin || [0, 0], u = site.upm || 1000;
    var L = ['# MassStudy · ' + (site.name || ''), '# units: drawing units (1 m = ' + u + ')', ''], vi = 0;
    function V(x, y, z) { L.push('v ' + (o[0] + x * u).toFixed(2) + ' ' + (o[1] + y * u).toFixed(2) + ' ' + (z * u).toFixed(2)); return ++vi; }
    list.forEach(function (it, i) {
      var dx = (i % 5) * sx, dy = -Math.floor(i / 5) * sy;
      it.a.pieces.forEach(function (p, k) {
        L.push('g ' + it.code + '_' + GN[p.g] + '_' + (k + 1));
        Core.faces(p).forEach(function (f) {
          triangulate(f, Axon.newell(f)).forEach(function (t) { L.push('f ' + t.map(function (q) { return V(q[0] + dx, q[1] + dy, q[2]); }).join(' ')); });
        });
      });
      L.push('g ' + it.code + '_Site');
      var ids = site.poly.map(function (p) { return V(p[0] + dx, p[1] + dy, 0); });
      L.push('l ' + ids.join(' ') + ' ' + ids[0]);
    });
    return L.join('\n');
  }

  /* ---------- ZIP (store) ---------- */
  var CRC = (function () { var t = []; for (var k = 0; k < 256; k++) { var c = k; for (var j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[k] = c >>> 0; } return t; })();
  function crc32(b) { var c = 0xFFFFFFFF; for (var i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
  function zip(files) { // files: [{name, data: Uint8Array|string}]
    var enc = new TextEncoder(), parts = [], central = [], off = 0;
    files.forEach(function (f) {
      var nb = enc.encode(f.name), data = typeof f.data === 'string' ? enc.encode(f.data) : f.data, crc = crc32(data);
      var lh = new DataView(new ArrayBuffer(30));
      lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(12, 0x21, true);
      lh.setUint32(14, crc, true); lh.setUint32(18, data.length, true); lh.setUint32(22, data.length, true); lh.setUint16(26, nb.length, true);
      var ch = new DataView(new ArrayBuffer(46));
      ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(14, 0x21, true);
      ch.setUint32(16, crc, true); ch.setUint32(20, data.length, true); ch.setUint32(24, data.length, true); ch.setUint16(28, nb.length, true); ch.setUint32(42, off, true);
      parts.push(new Uint8Array(lh.buffer), nb, data); central.push(new Uint8Array(ch.buffer), nb);
      off += 30 + nb.length + data.length;
    });
    var cdSize = central.reduce(function (s, u) { return s + u.length; }, 0);
    var end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, cdSize, true); end.setUint32(16, off, true);
    return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), { type: 'application/zip' });
  }
  return { svg: svg, ai: ai, png: png, obj: obj, zip: zip, triangulate: triangulate };
})();
