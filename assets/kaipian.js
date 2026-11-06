/* 按住看开片：一块天青釉面（canvas），按住时裂纹从按下处慢慢生长、分叉，松手停住，可以多次按。
 * 裂纹全由程序随机生成，每次不同；这是示意，不是任何一件真品的照片或复原。
 *
 * 做法：每条裂纹是一个“裂尖”，每帧往前走一小段，方向带一点随机弯曲，偶尔分叉；
 * 走进别的裂纹占过的格子就停下（丁字形交汇），出界或走到寿命也停。没有活着的裂尖时，
 * 从按下处附近已有的裂纹上再长出新的支裂，把釉面一块块分细，像真的开片那样结成网。
 * 每帧只画新长出来的几段线，不重画整张图，中低端手机也不吃力；只有按住时才跑动画循环。
 * 减少动效（prefers-reduced-motion）时直接算完一整张静态开片，不做交互。
 */
(function () {
  'use strict';

  var GLAZE_TOP = '#BCD2CB';
  var GLAZE_MID = '#A9C4BC';
  var GLAZE_LOW = '#97B5AD';
  var CELL = 3;            // 碰撞格子的边长（CSS 像素）
  var SPEED = 44;          // 裂尖生长速度，CSS 像素每秒：慢慢长
  var MAX_TIPS = 40;       // 同时活着的裂尖上限
  var MAX_SEGS = 6000;     // 一块釉面最多记多少段，够画满一整片

  function rand(a, b) { return a + Math.random() * (b - a); }

  function Glaze(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.opts = opts || {};
    this.pressing = false;
    this.raf = 0;
    this.last = 0;
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

  /* 清空裂纹，重画一层干净的釉面 */
  Glaze.prototype.reset = function () {
    this.cols = Math.ceil(this.w / CELL) + 1;
    this.rows = Math.ceil(this.h / CELL) + 1;
    this.grid = new Int32Array(this.cols * this.rows); // 0 表示空，否则是占用它的裂纹编号
    this.tips = [];
    this.segs = [];       // 已有的裂纹段，用来挑地方长支裂：[x, y, 角度]
    this.nextId = 1;
    this.drawGlaze();
  };

  /* 釉面：上浅下深的天青，加几团极淡的明暗，像釉层厚薄不匀；左上一块柔和的反光 */
  Glaze.prototype.drawGlaze = function () {
    var g = this.ctx, w = this.w, h = this.h;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    var lin = g.createLinearGradient(0, 0, w * 0.3, h);
    lin.addColorStop(0, GLAZE_TOP);
    lin.addColorStop(0.55, GLAZE_MID);
    lin.addColorStop(1, GLAZE_LOW);
    g.fillStyle = lin;
    g.fillRect(0, 0, w, h);
    for (var i = 0; i < 10; i++) {
      var x = rand(0, w), y = rand(0, h), r = rand(w * 0.2, w * 0.45);
      var rg = g.createRadialGradient(x, y, 0, x, y, r);
      var light = Math.random() < 0.5;
      rg.addColorStop(0, light ? 'rgba(226, 238, 233, 0.10)' : 'rgba(80, 118, 110, 0.06)');
      rg.addColorStop(1, 'rgba(0, 0, 0, 0)');
      g.fillStyle = rg;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
    var hl = g.createRadialGradient(w * 0.26, h * 0.22, 0, w * 0.26, h * 0.22, Math.max(w, h) * 0.5);
    hl.addColorStop(0, 'rgba(245, 250, 248, 0.30)');
    hl.addColorStop(1, 'rgba(245, 250, 248, 0)');
    g.fillStyle = hl;
    g.fillRect(0, 0, w, h);
  };

  Glaze.prototype.cellAt = function (x, y) {
    var cx = (x / CELL) | 0, cy = (y / CELL) | 0;
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return -1;
    return cy * this.cols + cx;
  };

  Glaze.prototype.addTip = function (x, y, angle, gen, grace) {
    if (this.tips.length >= MAX_TIPS) return;
    this.tips.push({
      id: this.nextId++, x: x, y: y, a: angle, gen: gen,
      bend: rand(-0.6, 0.6),                     // 这条裂纹整体往哪边弯
      life: rand(50, 170) * (gen ? 0.75 : 1),    // 能走多远（CSS 像素）
      grace: grace == null ? 4 : grace,          // 刚长出来的几步不查碰撞，免得一出生就撞上母裂纹
      acc: 0
    });
  };

  /* 按下：从按下处向四面放出三到五条主裂 */
  Glaze.prototype.seed = function (x, y) {
    var n = 3 + ((Math.random() * 3) | 0);
    var base = rand(0, Math.PI * 2);
    for (var i = 0; i < n; i++) this.addTip(x, y, base + (i / n) * Math.PI * 2 + rand(-0.4, 0.4), 0, 5);
    this.origin = { x: x, y: y };
    this.holdT = 0;
  };

  /* 没有活着的裂尖时，在按下处附近的旧裂纹上长一条支裂，方向大致垂直于母裂纹 */
  Glaze.prototype.sprout = function () {
    var segs = this.segs;
    if (!segs.length || !this.origin) return;
    var R = 40 + this.holdT * 26;   // 按得越久，波及得越远
    for (var k = 0; k < 12; k++) {
      var s = segs[(Math.random() * segs.length) | 0];
      var dx = s[0] - this.origin.x, dy = s[1] - this.origin.y;
      if (dx * dx + dy * dy > R * R) continue;
      var a = s[2] + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2 + rand(-0.35, 0.35);
      this.addTip(s[0], s[1], a, 1, 3);
      return;
    }
  };

  /* 走 dist 像素；返回 false 表示这条裂纹停了 */
  Glaze.prototype.stepTip = function (t, dist, out) {
    var STEP = 1.6;
    t.acc += dist;
    while (t.acc >= STEP) {
      t.acc -= STEP;
      t.a += t.bend * 0.012 + rand(-0.035, 0.035);
      if (Math.random() < 0.015) t.a += rand(-0.45, 0.45);   // 偶尔折一下：开片的线是一段段近乎直的
      var nx = t.x + Math.cos(t.a) * STEP;
      var ny = t.y + Math.sin(t.a) * STEP;
      var ci = this.cellAt(nx, ny);
      if (ci < 0) { out.push([t.x, t.y, nx, ny, t.gen]); return false; }   // 出界：画到边上为止
      var occ = this.grid[ci];
      if (t.grace > 0) t.grace--;
      else if (occ && occ !== t.id) { out.push([t.x, t.y, nx, ny, t.gen]); return false; } // 撞上别的裂纹：丁字交汇
      this.grid[ci] = t.id;
      out.push([t.x, t.y, nx, ny, t.gen]);
      if (this.segs.length < MAX_SEGS) this.segs.push([nx, ny, t.a]);
      t.x = nx; t.y = ny;
      t.life -= STEP;
      if (t.life <= 0) {
        // 走到头时有时一分为二，往两边岔开
        if (Math.random() < 0.45) {
          this.addTip(t.x, t.y, t.a + rand(0.5, 1.1), t.gen + 1);
          this.addTip(t.x, t.y, t.a - rand(0.5, 1.1), t.gen + 1);
        }
        return false;
      }
      // 半路偶尔分叉
      if (Math.random() < 0.012) this.addTip(t.x, t.y, t.a + (Math.random() < 0.5 ? 1 : -1) * rand(0.6, 1.3), t.gen + 1);
    }
    return true;
  };

  /* 画一批新长出来的段：先一道极淡的亮边（釉层里折出的光），再一道细细的深线 */
  Glaze.prototype.drawSegs = function (list) {
    if (!list.length) return;
    var g = this.ctx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.lineCap = 'butt';
    g.lineJoin = 'round';
    var pass = [
      { style: 'rgba(236, 244, 240, 0.30)', w: function (gen) { return gen ? 1.6 : 2.2; }, dx: 0.5, dy: 0.6 },
      { style: 'rgba(48, 64, 60, 0.55)', w: function (gen) { return gen ? 0.55 : 0.85; }, dx: 0, dy: 0 }
    ];
    for (var p = 0; p < pass.length; p++) {
      var P = pass[p];
      g.strokeStyle = P.style;
      for (var gen = 0; gen < 2; gen++) {
        g.lineWidth = P.w(gen);
        g.beginPath();
        var ex = NaN, ey = NaN;
        for (var i = 0; i < list.length; i++) {
          var s = list[i];
          if ((s[4] ? 1 : 0) !== gen) continue;
          // 同一条裂纹这一帧里连着的几段连成一笔，半透明的线不会在接头处叠出深点
          if (s[0] !== ex || s[1] !== ey) g.moveTo(s[0] + P.dx, s[1] + P.dy);
          g.lineTo(s[2] + P.dx, s[3] + P.dy);
          ex = s[2]; ey = s[3];
        }
        g.stroke();
      }
    }
  };

  Glaze.prototype.tick = function (dt) {
    var out = [];
    var dist = SPEED * dt;
    var alive = [];
    var tips = this.tips;
    this.tips = [];
    for (var i = 0; i < tips.length; i++) {
      if (this.stepTip(tips[i], dist, out)) alive.push(tips[i]);
    }
    // stepTip 里新分出来的裂尖在 this.tips 里，和还活着的合并
    this.tips = alive.concat(this.tips).slice(0, MAX_TIPS);
    this.holdT += dt;
    if (this.tips.length < 4 && this.segs.length < MAX_SEGS) this.sprout();
    this.drawSegs(out);
  };

  Glaze.prototype.loop = function (now) {
    var self = this;
    var dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    this.tick(dt);
    if (this.pressing) this.raf = requestAnimationFrame(function (t) { self.loop(t); });
    else this.raf = 0;
  };

  Glaze.prototype.start = function (x, y) {
    var self = this;
    if (this.pressing) return;
    this.pressing = true;
    this.seed(x, y);
    this.last = 0;
    if (!this.raf) this.raf = requestAnimationFrame(function (t) { self.loop(t); });
    if (this.opts.onStart) this.opts.onStart();
  };

  Glaze.prototype.move = function (x, y) {
    if (this.pressing && this.origin) { this.origin.x = x; this.origin.y = y; }
  };

  /* 松手：裂纹停在原地。剩下的裂尖丢掉，下次按会从新的地方长 */
  Glaze.prototype.stop = function () {
    this.pressing = false;
    this.tips = [];
  };

  /* 一次算完一整张开片（减少动效时用） */
  Glaze.prototype.renderStatic = function () {
    var seeds = 3;
    for (var s = 0; s < seeds; s++) {
      this.seed(rand(this.w * 0.15, this.w * 0.85), rand(this.h * 0.15, this.h * 0.85));
      this.holdT = 5;
      for (var i = 0; i < 500 && this.segs.length < MAX_SEGS; i++) this.tick(0.05);
      this.tips = [];
    }
  };

  /* 把一块 .kaipian 挂上交互 */
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
    canvas.addEventListener('pointermove', function (e) {
      if (e.pointerId !== pid) return;
      var p = pos(e);
      glaze.move(p.x, p.y);
    });
    function end(e) {
      if (pid === null || (e && e.pointerId !== pid)) return;
      pid = null;
      glaze.stop();
    }
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end); // 手指一滑变成滚动页面时，浏览器会取消按压，裂纹也就停住
    canvas.addEventListener('lostpointercapture', end);
    canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); }); // 手机长按不弹菜单

    // 键盘：聚焦釉面后按住空格或回车，从一处随机的地方长
    var keyDown = false;
    canvas.addEventListener('keydown', function (e) {
      if (e.key !== ' ' && e.key !== 'Enter' && e.key !== 'Spacebar') return;
      e.preventDefault();
      if (keyDown) return;
      keyDown = true;
      glaze.start(rand(glaze.w * 0.2, glaze.w * 0.8), rand(glaze.h * 0.2, glaze.h * 0.8));
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

    // 宽度变了（转屏）就换一块新釉面；高度由 CSS 的宽高比决定
    var timer = 0;
    window.addEventListener('resize', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { if (glaze.resize()) root.classList.remove('is-touched'); }, 200);
    });
    return glaze;
  }

  window.TaishouKaipian = { mount: mount, Glaze: Glaze };
})();
