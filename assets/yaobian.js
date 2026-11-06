/* 按住看窑变（钧窑专属）：一块天青带乳光的釉面（canvas），按住时紫红从按下处慢慢晕开，
 * 边缘不齐，往下走得比往上远（釉在窑里是往下流的），松手就停；可以多次按，每一处晕出来的红、紫都不一样。
 * “再烧一窑”换一块新釉面，颜色和纹理重新随机：开窑之前谁也说不准。
 * 全部由程序随机生成，是示意，不是任何一件真品的照片或复原。页面上的说明写明“此为示意，非实物”。
 *
 * 做法：
 *   底釉、细纹、光泽各画一次，存在离屏画布里，不每帧重画；
 *   紫红是一张低分辨率的“浓度图”（每格 0 到 1），按住时从按下处向外长，长到哪由几层随机噪声扭曲，
 *   所以前沿像墨在绢上洇开；每帧把浓度图写进一张小图，平滑放大盖在底釉上，再盖一层细纹和光泽。
 *   只有按住、或者松手后边缘还在慢慢收住时才跑动画循环。
 *   减少动效（prefers-reduced-motion）时直接画一张晕好的静态图，不做交互。
 */
(function () {
  'use strict';

  // 天青到天蓝，带乳光：上浅下深（釉往下流，下半截积得厚）
  var GLAZE = [[178, 199, 202], [152, 179, 188], [128, 155, 170]];
  // 几种窑变的红紫：[淡的边, 浓的心]。每次按下随机挑一种，再在格子之间混一点，同一块釉上红紫不匀
  // 淡的边偏紫灰：红薄的地方透出底下的天青，看上去是一圈蓝紫
  var PALETTES = [
    [[150, 108, 138], [134, 40, 62]],   // 海棠红
    [[136, 108, 150], [104, 40, 82]],   // 玫瑰紫
    [[126, 104, 140], [82, 36, 66]],    // 茄皮紫
    [[146, 100, 136], [118, 34, 60]]    // 紫红
  ];
  var FILL_SECONDS = 14;  // 按住不放，大约这么久晕满整块：慢慢来

  function rand(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function smooth(t) { return t * t * (3 - 2 * t); }
  function mix(a, b, t) { return a + (b - a) * t; }

  /* 值噪声：格点上放随机数，中间平滑插值；几层叠起来（fbm）就是一团一团的不规则明暗 */
  function makeNoise() {
    var P = 256, table = new Float32Array(P * P);
    for (var i = 0; i < table.length; i++) table[i] = Math.random();
    function at(ix, iy) { return table[((iy & 255) * P) + (ix & 255)]; }
    function noise(x, y) {
      var ix = Math.floor(x), iy = Math.floor(y), fx = smooth(x - ix), fy = smooth(y - iy);
      return mix(mix(at(ix, iy), at(ix + 1, iy), fx), mix(at(ix, iy + 1), at(ix + 1, iy + 1), fx), fy);
    }
    return function fbm(x, y, oct) {
      var v = 0, amp = 0.5, f = 1, sum = 0;
      for (var o = 0; o < (oct || 4); o++) { v += noise(x * f + o * 17.3, y * f - o * 9.1) * amp; sum += amp; amp *= 0.5; f *= 2.03; }
      return v / sum;
    };
  }

  function Glaze(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.pressing = false;
    this.raf = 0;
    this.last = 0;
    this.settle = 0;
    this.resize();
  }

  Glaze.prototype.resize = function () {
    var c = this.canvas;
    var w = Math.max(1, Math.round(c.clientWidth));
    var h = Math.max(1, Math.round(c.clientHeight));
    if (w === this.w && h === this.h) return false;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = w; this.h = h; this.dpr = dpr;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    this.reset();
    return true;
  };

  function layer(w, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, w); c.height = Math.max(1, h);
    return c;
  }

  /* 换一窑：重新随机噪声、底釉、细纹，清空紫红 */
  Glaze.prototype.reset = function () {
    var w = this.w, h = this.h;
    var fbm = makeNoise();
    // 浓度图：大约每 2 个 CSS 像素一格，最多 300 格宽
    var gw = this.gw = Math.max(40, Math.min(300, Math.round(w / 2)));
    var gh = this.gh = Math.max(27, Math.round(gw * h / w));
    var n = gw * gh;
    this.F = new Float32Array(n);    // 紫红有多浓
    this.warp = new Float32Array(n);   // 扭曲晕开前沿的大团噪声：整团的形状
    this.fringe = new Float32Array(n); // 中等大小的噪声：前沿的毛边，像墨洇进绢丝
    this.grain = new Float32Array(n);  // 浓淡不匀的小团噪声
    this.thick = new Float32Array(n);  // 釉厚的地方红得深，薄的地方淡
    this.streak = new Float32Array(n); // 竖向的细流纹：釉往下流，红里透出一丝丝蓝
    var sx = 4 / gw;
    for (var y = 0; y < gh; y++) {
      for (var x = 0; x < gw; x++) {
        var i = y * gw + x;
        this.warp[i] = fbm(x * sx * 0.8, y * sx * 0.8, 4);
        this.fringe[i] = fbm(x * sx * 2.6 + 13, y * sx * 2.6 + 57, 4);
        this.grain[i] = fbm(x * sx * 4 + 40, y * sx * 4 - 20, 3);
        this.thick[i] = fbm(x * sx * 1.5 - 33, y * sx * 1.2 + 71, 4);
        var wx = (fbm(y * sx * 1.3 + 5, x * sx * 0.3 + 2, 2) - 0.5) * 2.4;   // 流纹不是笔直的，左右轻轻摆
        this.streak[i] = fbm(x * sx * 5 + wx + 90, y * sx * 0.5, 3);
      }
    }
    this.L = new Float32Array(n * 3);  // 每一格淡处的颜色、浓处的颜色：几团颜色不同的红叠在一起时按比例慢慢混，不留硬边
    this.D = new Float32Array(n * 3);
    this.palIdx = (Math.random() * PALETTES.length) | 0; // 这一窑偏哪种红
    this.red = layer(gw, gh);
    this.redCtx = this.red.getContext('2d');
    this.redImg = this.redCtx.createImageData(gw, gh);
    this.base = this.drawBase(fbm);
    this.top = this.drawTop();
    this.paint();
  };

  /* 底釉：上浅下深的天青，加大团的厚薄不匀和细碎的乳光斑，画在一张离屏画布上 */
  Glaze.prototype.drawBase = function (fbm) {
    var w = this.w, h = this.h, dpr = this.dpr;
    var c = layer(Math.round(w * dpr), Math.round(h * dpr)), g = c.getContext('2d');
    var lw = Math.max(40, Math.round(w / 2)), lh = Math.max(27, Math.round(lw * h / w));
    var low = layer(lw, lh), lg = low.getContext('2d'), img = lg.createImageData(lw, lh), d = img.data;
    for (var y = 0; y < lh; y++) {
      var ty = y / (lh - 1);
      for (var x = 0; x < lw; x++) {
        var nx = x / lw * 3, ny = y / lh * 2;
        var m = fbm(nx + 7, ny + 3, 5);                  // 釉厚薄
        var s = fbm(nx * 9 + 30, ny * 1.2 + 11, 3);       // 竖向流动的痕
        var t = clamp(ty * 0.85 + (m - 0.5) * 0.7 + (s - 0.5) * 0.18, 0, 1);
        var a = t < 0.5 ? GLAZE[0] : GLAZE[1], b = t < 0.5 ? GLAZE[1] : GLAZE[2], k = t < 0.5 ? t * 2 : (t - 0.5) * 2;
        var milk = clamp((fbm(nx * 2.2 - 5, ny * 2.2 + 8, 4) - 0.55) * 2.2, 0, 1) * 0.35; // 一团团泛白的乳光
        var o = (y * lw + x) * 4;
        d[o] = mix(mix(a[0], b[0], k), 214, milk);
        d[o + 1] = mix(mix(a[1], b[1], k), 224, milk);
        d[o + 2] = mix(mix(a[2], b[2], k), 228, milk);
        d[o + 3] = 255;
      }
    }
    lg.putImageData(img, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(low, 0, 0, c.width, c.height);
    return c;
  };

  /* 盖在最上面的一层：细小的星点、极淡的竖向丝纹、左上一块柔和的光、四周略暗（釉在边上积得厚） */
  Glaze.prototype.drawTop = function () {
    var w = this.w, h = this.h, dpr = this.dpr;
    var c = layer(Math.round(w * dpr), Math.round(h * dpr)), g = c.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    var i, n = Math.round(w * h / 900);
    for (i = 0; i < n; i++) {
      g.fillStyle = Math.random() < 0.75 ? 'rgba(236, 242, 244, ' + rand(0.05, 0.18).toFixed(2) + ')' : 'rgba(40, 46, 70, ' + rand(0.04, 0.1).toFixed(2) + ')';
      g.beginPath(); g.arc(rand(0, w), rand(0, h), rand(0.3, 0.9), 0, Math.PI * 2); g.fill();
    }
    g.lineWidth = 0.7;
    for (var x = rand(0, 10); x < w; x += rand(6, 18)) {
      g.strokeStyle = 'rgba(230, 238, 242, ' + rand(0.015, 0.045).toFixed(3) + ')';
      g.beginPath();
      var y0 = rand(-h * 0.2, h * 0.5), len = rand(h * 0.3, h * 1.1), ph = rand(0, 6), amp = rand(0.5, 2.2);
      g.moveTo(x, y0);
      for (var y = y0; y < y0 + len; y += 6) g.lineTo(x + Math.sin(y / 23 + ph) * amp, y);
      g.stroke();
    }
    var hl = g.createRadialGradient(w * 0.28, h * 0.2, 0, w * 0.28, h * 0.2, Math.max(w, h) * 0.55);
    hl.addColorStop(0, 'rgba(248, 251, 252, 0.26)');
    hl.addColorStop(1, 'rgba(248, 251, 252, 0)');
    g.fillStyle = hl; g.fillRect(0, 0, w, h);
    var vg = g.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.35, w * 0.5, h * 0.5, Math.max(w, h) * 0.75);
    vg.addColorStop(0, 'rgba(30, 40, 58, 0)');
    vg.addColorStop(1, 'rgba(30, 40, 58, 0.16)');
    g.fillStyle = vg; g.fillRect(0, 0, w, h);
    return c;
  };

  /* 按下：在这里起一团紫红。速度、浓淡、偏红偏紫、往下流多少都随机 */
  Glaze.prototype.seed = function (x, y) {
    var gw = this.gw;
    var p = Math.random() < 0.6 ? this.palIdx : (Math.random() * PALETTES.length) | 0;
    this.active = {
      x: x / this.w * gw, y: y / this.h * this.gh, t: 0,
      speed: gw * 1.15 / FILL_SECONDS * rand(0.8, 1.15),
      strength: rand(0.78, 1),
      down: rand(0.5, 0.72),     // 往下的距离打这个折扣：往下晕得更远
      pal: p,
      alt: PALETTES[(p + 1 + ((Math.random() * (PALETTES.length - 1)) | 0)) % PALETTES.length], // 同一团里掺一点另一种红
      hue: Math.random()
    };
  };

  /* 长一帧：只算活动的那一团，前沿由噪声扭曲；浓度只增不减，先前按出的红留着 */
  Glaze.prototype.grow = function (dt) {
    var b = this.active, F = this.F, gw = this.gw, gh = this.gh;
    var moved = 0;
    if (b && this.pressing) b.t += dt;
    if (!b) return 0;
    var R = 1.5 + b.speed * Math.pow(b.t, 0.9);
    var soft = 2 + R * 0.16;
    var ease = Math.min(1, dt * 2.4);
    // 只算可能晕到的那一块（噪声最多把距离缩到约三分之一，往下还要再除以 down）
    var reach = 3.2 * R + 16;
    var x0 = Math.max(0, Math.floor(b.x - reach)), x1 = Math.min(gw - 1, Math.ceil(b.x + reach));
    var y0 = Math.max(0, Math.floor(b.y - reach / 1.25)), y1 = Math.min(gh - 1, Math.ceil(b.y + reach / b.down));
    for (var y = y0; y <= y1; y++) {
      var dy = y - b.y;
      dy *= dy > 0 ? b.down : 1.25;
      for (var x = x0; x <= x1; x++) {
        var i = y * gw + x, dx = x - b.x;
        // 离按下处的距离，被几层噪声扭曲：整团不圆、前沿有毛边、顺着流纹往下伸出一缕缕
        var d = Math.sqrt(dx * dx + dy * dy) * (0.5 + this.warp[i] * 1.0) +
          (this.fringe[i] - 0.5) * (4 + R * 0.5) + (this.streak[i] - 0.5) * (3 + R * 0.16) * (dy > 0 ? 1.3 : 0.5);
        var tg = clamp((R - d) / soft, 0, 1);
        // 前沿外面一圈极淡的紫晕：红还没到，釉已经泛紫
        var halo = smooth(clamp((R * 1.3 + 4 - d) / (R * 0.5 + 6), 0, 1)) * 0.22;
        if (!tg && !halo) continue;
        var v = Math.max(smooth(tg) * b.strength * (0.62 + 0.38 * this.thick[i]), halo);
        if (v <= F[i]) continue;
        var nv = F[i] + (v - F[i]) * ease;
        var share = (nv - F[i]) / (nv + 1e-3);
        var hm = clamp(b.hue + (this.warp[i] - 0.5) * 0.9, 0, 1) * 0.55, pa = PALETTES[b.pal], pb = b.alt;
        for (var c = 0; c < 3; c++) {
          this.L[i * 3 + c] = mix(this.L[i * 3 + c], mix(pa[0][c], pb[0][c], hm), F[i] ? share : 1);
          this.D[i * 3 + c] = mix(this.D[i * 3 + c], mix(pa[1][c], pb[1][c], hm), F[i] ? share : 1);
        }
        moved = Math.max(moved, nv - F[i]);
        F[i] = nv;
      }
    }
    return moved;
  };

  /* 把浓度图写进小图：淡处偏淡红、浓处偏深紫红，盖在天青上时边缘自然透出一圈紫灰；竖向细流纹处红薄一点 */
  Glaze.prototype.paint = function () {
    var F = this.F, L = this.L, D = this.D, d = this.redImg.data, n = this.gw * this.gh;
    for (var i = 0; i < n; i++) {
      var f = F[i], o = i * 4;
      if (f < 0.004) { d[o + 3] = 0; continue; }
      var st = smooth(clamp((this.streak[i] - 0.3) / 0.4, 0, 1));            // 流纹：低处红薄，透出一丝蓝
      var k = smooth(clamp((f * (0.55 + 0.75 * this.thick[i]) - 0.1) / 0.8, 0, 1)) * (0.84 + 0.16 * st);
      var g2 = (this.grain[i] - 0.5) * 14;                                    // 一点点颗粒，红不是平涂的
      for (var c = 0; c < 3; c++) d[o + c] = mix(L[i * 3 + c], D[i * 3 + c], k) + g2;
      d[o + 3] = Math.round(255 * clamp(Math.pow(f, 0.75) * (0.8 + 0.17 * st), 0, 1));
    }
    this.redCtx.putImageData(this.redImg, 0, 0);
    var g = this.ctx;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(this.base, 0, 0);
    g.drawImage(this.red, 0, 0, this.canvas.width, this.canvas.height);
    g.drawImage(this.top, 0, 0);
  };

  Glaze.prototype.loop = function (now) {
    var self = this;
    var dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    var moved = this.grow(dt);
    this.paint();
    // 松手后让边缘再收一会儿，收住了就停
    if (!this.pressing) this.settle += dt;
    if (this.pressing || (moved > 0.002 && this.settle < 1.5)) this.raf = requestAnimationFrame(function (t) { self.loop(t); });
    else { this.raf = 0; this.active = null; }
  };

  Glaze.prototype.start = function (x, y) {
    var self = this;
    if (this.pressing) return;
    this.pressing = true;
    this.settle = 0;
    this.seed(x, y);
    this.last = 0;
    if (!this.raf) this.raf = requestAnimationFrame(function (t) { self.loop(t); });
    if (this.opts.onStart) this.opts.onStart();
  };

  Glaze.prototype.stop = function () { this.pressing = false; };

  /* 一次画完一张晕好的（减少动效时用） */
  Glaze.prototype.renderStatic = function () {
    var spots = [[0.38, 0.4, 4.2], [0.7, 0.62, 2.4]];
    for (var s = 0; s < spots.length; s++) {
      this.seed(this.w * spots[s][0], this.h * spots[s][1]);
      this.pressing = true;
      for (var i = 0; i < spots[s][2] * 20; i++) this.grow(0.05);
      this.pressing = false;
      for (var j = 0; j < 40; j++) this.grow(0.05);
    }
    this.active = null;
    this.paint();
  };

  function mount(root, reduced) {
    var canvas = root.querySelector('canvas');
    if (!canvas || !canvas.getContext) return null;
    var glaze = new Glaze(canvas, {
      onStart: function () { root.classList.add('is-touched'); }
    });
    var again = root.querySelector('.kaipian-again');

    if (reduced) {
      root.classList.add('is-static');
      glaze.renderStatic();
      return glaze;
    }

    function pos(e) {
      var r = canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    var pid = null;
    canvas.addEventListener('pointerdown', function (e) {
      if (e.button !== undefined && e.button > 0) return;
      pid = e.pointerId;
      try { canvas.setPointerCapture(pid); } catch (err) { /* 有的浏览器不支持 */ }
      var p = pos(e);
      glaze.start(p.x, p.y);
    });
    function end(e) {
      if (pid === null || (e && e.pointerId !== pid)) return;
      pid = null;
      glaze.stop();
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end); // 手指一滑变成滚动页面时，浏览器会取消按压，晕染也就停住
    canvas.addEventListener('lostpointercapture', end);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); }); // 手机长按不弹菜单

    // 键盘：聚焦釉面后按住空格或回车，从一处随机的地方晕开
    var keyDown = false;
    canvas.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Spacebar') return;
      e.preventDefault();
      if (keyDown) return;
      keyDown = true;
      glaze.start(rand(glaze.w * 0.2, glaze.w * 0.8), rand(glaze.h * 0.2, glaze.h * 0.7));
    });
    canvas.addEventListener('keyup', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Spacebar') return;
      keyDown = false;
      glaze.stop();
    });
    canvas.addEventListener('blur', function () { keyDown = false; glaze.stop(); });

    if (again) again.addEventListener('click', function () {
      glaze.stop();
      glaze.reset();
      root.classList.remove('is-touched');
    });

    var timer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { if (glaze.resize()) root.classList.remove('is-touched'); }, 200);
    });
    return glaze;
  }

  window.TaishouYaobian = { mount: mount, Glaze: Glaze };
})();
