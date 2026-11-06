/* 全站公用：安全存储、印章、页脚、文牒、文牒分享图 */
(function () {
  'use strict';

  var SEAL_KEY = 'taishou.seals';

  // 所有存储读写都包 try/catch：隐私模式或被禁用时页面照常显示
  var store = {
    get: function (key) {
      try { return window.localStorage.getItem(key); } catch (e) { return null; }
    },
    set: function (key, value) {
      try { window.localStorage.setItem(key, value); return true; } catch (e) { return false; }
    }
  };

  function readSeals() {
    var raw = store.get(SEAL_KEY);
    if (!raw) return {};
    try {
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch (e) { return {}; }
  }

  function hasSeal(id) { return Object.prototype.hasOwnProperty.call(readSeals(), id); }

  function addSeal(id) {
    var seals = readSeals();
    if (!seals[id]) seals[id] = new Date().toISOString();
    return store.set(SEAL_KEY, JSON.stringify(seals));
  }

  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // 白文朱印：朱底留白字，边缘和印面用噪声做出钤印的残破感
  var sealCount = 0;
  function sealSVG(char, label) {
    var id = 'seal-rough-' + (++sealCount);
    return '<svg class="seal-svg" viewBox="0 0 200 200" role="img" aria-label="' + esc(label || (char + '字朱印')) + '">' +
      '<defs><filter id="' + id + '" x="-5%" y="-5%" width="110%" height="110%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="' + (char.charCodeAt(0) % 97) + '" result="n"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="n" scale="7" result="d"/>' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.55" numOctaves="2" seed="7" result="g"/>' +
      '<feColorMatrix in="g" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 2.25" result="m"/>' +
      '<feComposite in="d" in2="m" operator="in"/>' +
      '</filter>' +
      '<mask id="' + id + '-m"><rect width="200" height="200" fill="#fff"/>' +
      '<text x="100" y="146" text-anchor="middle" font-size="136" fill="#000" ' +
      'font-family="\'Kaiti SC\',STKaiti,KaiTi,\'Songti SC\',STSong,SimSun,serif" font-weight="700">' + esc(char) + '</text></mask>' +
      '</defs>' +
      '<g filter="url(#' + id + ')"><rect x="14" y="14" width="172" height="172" rx="9" fill="#A9392A" mask="url(#' + id + '-m)"/></g>' +
      '</svg>';
  }

  function renderFooter(prefix) {
    var el = document.getElementById('site-footer');
    if (!el) return;
    var site = window.TAISHOU.site;
    // 联系方式和 ICP 备案号空着时不显示（不放占位字样）；填了真的才出现。备案号不要填假号
    el.innerHTML =
      (site.contact ? '<span>联系方式：' + esc(site.contact) + '</span>' : '') +
      (site.icp ? '<span>' + esc(site.icp) + '</span>' : '') +
      '<a href="' + prefix + 'privacy.html">隐私政策</a>';
  }

  function renderWendie(root, prefix) {
    var stations = window.TAISHOU.stations;
    var seals = readSeals();
    var got = stations.filter(function (s) { return seals[s.id]; });
    // 太守形象位：stations.js 的 taishou.wendieImage 空着时不输出任何东西
    var taishou = window.TAISHOU.taishou || {};
    var avatar = taishou.wendieImage
      ? '<img class="wendie-avatar" src="' + prefix + esc(taishou.wendieImage) + '" alt="' + esc(taishou.alt || '太守') + '">'
      : '';
    if (!got.length) {
      var first = stations.filter(function (s) { return s.status === 'open'; })[0];
      root.innerHTML = avatar +
        '<p class="wendie-empty">文牒上还没有印。</p>' +
        '<p class="wendie-note">读完一站，答对三道小题，就会盖下那一站的印。</p>' +
        (first ? '<a class="wendie-go" href="' + prefix + esc(first.page) + '">从第一站读起</a>' : '');
      return;
    }
    root.innerHTML = avatar + '<ul class="wendie-seals">' + got.map(function (s) {
      return '<li>' + sealSVG(s.seal, s.name + '站朱印') +
        '<span class="wendie-name">第' + s.order + '站 · ' + esc(s.name) + '</span>' +
        (s.page ? '<a href="' + prefix + esc(s.page) + '">再读一遍</a>' : '') + '</li>';
    }).join('') + '</ul>' +
      '<p class="wendie-note">共 ' + got.length + ' 枚。印只存在这台设备的这个浏览器里。</p>' +
      '<div class="wendie-share">' +
        '<button type="button" class="wendie-share-btn">生成分享图</button>' +
        '<div class="wendie-share-out" hidden></div>' +
      '</div>';
    var btn = root.querySelector('.wendie-share-btn');
    var out = root.querySelector('.wendie-share-out');
    btn.addEventListener('click', function () {
      btn.disabled = true;
      btn.textContent = '正在画……';
      drawShare(got).then(function (canvas) {
        return new Promise(function (resolve) {
          if (canvas.toBlob) canvas.toBlob(function (b) { resolve(b ? URL.createObjectURL(b) : canvas.toDataURL('image/png')); }, 'image/png');
          else resolve(canvas.toDataURL('image/png'));
        });
      }).then(function (url) {
        out.hidden = false;
        out.innerHTML = '<img class="wendie-share-img" src="' + url + '" alt="文牒分享图：月白底，竖排宋体，盖着已得的朱印，落款太守寻非遗 longflame.cn">' +
          '<p class="wendie-note">手机上长按图片保存；电脑上点下面保存。</p>' +
          '<a class="wendie-go wendie-save" href="' + url + '" download="太守寻非遗-文牒.png">保存图片</a>';
        btn.textContent = '重新生成';
        btn.disabled = false;
      }, function () {
        btn.textContent = '这个浏览器画不了分享图';
      });
    });
  }

  /* ---------- 文牒分享图 ----------
   * 竖幅 1080×1600：月白底，细墨线框，竖排宋体，已盖的朱印一枚枚排开，落款“太守寻非遗 longflame.cn”。
   * 全在本机用 canvas 画，不上传、不联网。先不放二维码 */
  var SHARE_W = 1080, SHARE_H = 1600;
  var SONG = '"Taishou Song", "Songti SC", STSong, SimSun, serif';
  var SEAL_FONT = '"Kaiti SC", STKaiti, KaiTi, "Taishou Song", "Songti SC", SimSun, serif';
  var NUM_CN = ['〇', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  function cnNum(n) {
    if (n <= 10) return NUM_CN[n];
    if (n < 20) return '十' + NUM_CN[n - 10];
    return NUM_CN[Math.floor(n / 10)] + '十' + (n % 10 ? NUM_CN[n % 10] : '');
  }

  // 竖排一列：从 (x, y) 往下逐字写，x 是这一列的中线；“·”画成一个小方点
  function vtext(g, str, x, y, size, gap) {
    var chars = Array.from ? Array.from(str) : str.split('');
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      var cy = y + i * size * (1 + gap) + size / 2;
      if (ch === '·') { g.fillRect(x - size * 0.06, cy - size * 0.06, size * 0.12, size * 0.12); continue; }
      g.fillText(ch, x, cy);
    }
    return y + chars.length * size * (1 + gap);
  }

  // 一枚白文朱印：朱底，字镂空，印面和边沿随机残一点，像钤出来的
  function drawSeal(g, ch, cx, cy, size, rot) {
    var c = document.createElement('canvas');
    c.width = c.height = size;
    var s = c.getContext('2d');
    var pad = size * 0.04;
    var r = size * 0.05, x0 = pad, y0 = pad, w = size - pad * 2;
    s.fillStyle = '#A9392A';
    s.beginPath();
    s.moveTo(x0 + r, y0); s.arcTo(x0 + w, y0, x0 + w, y0 + w, r); s.arcTo(x0 + w, y0 + w, x0, y0 + w, r);
    s.arcTo(x0, y0 + w, x0, y0, r); s.arcTo(x0, y0, x0 + w, y0, r); s.closePath(); s.fill();
    s.globalCompositeOperation = 'destination-out';
    // 和页面上的朱印一样优先用楷体，没有楷体的手机退回自带宋体；描一道边把笔画加粗，像刻出来的白文
    s.font = 'bold ' + Math.round(size * 0.68) + 'px ' + SEAL_FONT;
    s.textAlign = 'center'; s.textBaseline = 'middle';
    s.lineWidth = size * 0.022;
    s.lineJoin = 'round';
    s.fillText(ch, size / 2, size * 0.53);
    s.strokeText(ch, size / 2, size * 0.53);
    for (var i = 0; i < size * 0.22; i++) {
      s.beginPath(); s.arc(Math.random() * size, Math.random() * size, Math.random() * size * 0.006 + 0.5, 0, Math.PI * 2); s.fill();
    }
    for (var k = 0; k < 26; k++) {
      var t = Math.random(), side = (Math.random() * 4) | 0;
      var ex = side < 2 ? pad + t * w : (side === 2 ? pad : pad + w);
      var ey = side < 2 ? (side === 0 ? pad : pad + w) : pad + t * w;
      s.beginPath(); s.arc(ex, ey, Math.random() * size * 0.018 + 1, 0, Math.PI * 2); s.fill();
    }
    g.save();
    g.translate(cx, cy);
    g.rotate(rot);
    g.globalAlpha = 0.94;
    g.drawImage(c, -size / 2, -size / 2);
    g.restore();
  }

  function drawShare(got) {
    var fontReady = document.fonts && document.fonts.load
      ? Promise.all([document.fonts.load('64px "Taishou Song"', '文牒太守'), document.fonts.ready]).catch(function () {})
      : Promise.resolve();
    return fontReady.then(function () {
      var c = document.createElement('canvas');
      c.width = SHARE_W; c.height = SHARE_H;
      var g = c.getContext('2d');
      if (!g) throw new Error('no canvas');
      // 月白素绢底，四周略暗一点
      g.fillStyle = '#D5DFDA';
      g.fillRect(0, 0, SHARE_W, SHARE_H);
      var v = g.createRadialGradient(SHARE_W / 2, SHARE_H * 0.45, SHARE_H * 0.2, SHARE_W / 2, SHARE_H * 0.45, SHARE_H * 0.8);
      v.addColorStop(0, 'rgba(222, 230, 226, 0.6)');
      v.addColorStop(1, 'rgba(190, 204, 198, 0.5)');
      g.fillStyle = v;
      g.fillRect(0, 0, SHARE_W, SHARE_H);
      // 绢丝：极淡的横竖细纹
      g.fillStyle = 'rgba(38, 48, 46, 0.018)';
      for (var y = 0; y < SHARE_H; y += 4) g.fillRect(0, y, SHARE_W, 1);
      for (var x = 0; x < SHARE_W; x += 5) g.fillRect(x, 0, 1, SHARE_H);
      // 细墨线框
      g.strokeStyle = 'rgba(38, 48, 46, 0.35)';
      g.lineWidth = 2;
      g.strokeRect(60, 60, SHARE_W - 120, SHARE_H - 120);
      g.strokeStyle = 'rgba(38, 48, 46, 0.16)';
      g.lineWidth = 1;
      g.strokeRect(74, 74, SHARE_W - 148, SHARE_H - 148);

      // 右起第一列：大字“文牒”；第二列：小字
      g.fillStyle = '#26302E';
      g.font = '96px ' + SONG;
      vtext(g, '文牒', SHARE_W - 190, 170, 96, 0.5);
      g.fillStyle = '#55625F';
      g.font = '34px ' + SONG;
      vtext(g, '太守寻非遗·一路所得', SHARE_W - 300, 186, 34, 0.42);

      // 印：排在画面中部，从右往左、从上往下，每枚左边竖写“第几站·名字”
      var n = got.length;
      var size = n === 1 ? 340 : (n <= 4 ? 220 : 130);
      var cols = n === 1 ? 1 : (n <= 4 ? 2 : 3);
      var fs = n === 1 ? 36 : (n <= 4 ? 28 : 24);
      var cellW = size + fs + 70, cellH = size + 110;
      var maxRows = Math.floor(760 / cellH);                    // 印区在 300 到 1060 之间，排不下的就不画了，免得压到落款
      // 一枚时放在画面正中偏左；多枚时右边缘贴着第二列小字的左边（x=730），从上往下排
      var right = n === 1 ? 693 : 730, top = n === 1 ? 630 : 300;
      for (var i = 0; i < n && Math.floor(i / cols) < maxRows; i++) {
        var s = got[i];
        var col = i % cols, row = Math.floor(i / cols);
        var cx = right - col * cellW - size / 2;
        var cy = top + row * cellH + size / 2;
        drawSeal(g, s.seal, cx, cy, size, -0.05 + (i % 3) * 0.03);
        g.fillStyle = '#55625F';
        g.font = fs + 'px ' + SONG;
        vtext(g, '第' + cnNum(s.order) + '站·' + s.name, cx - size / 2 - fs / 2 - 22, cy - size / 2 + 6, fs, 0.36);
      }

      // 落款：左下竖写“太守寻非遗”，底边写网址和印数
      g.fillStyle = '#26302E';
      g.font = '44px ' + SONG;
      vtext(g, '太守寻非遗', 170, SHARE_H - 500, 44, 0.32);
      g.fillStyle = '#55625F';
      g.font = '30px ' + SONG;
      g.textBaseline = 'alphabetic';
      g.textAlign = 'left';
      g.fillText('longflame.cn', 120, SHARE_H - 120);
      g.textAlign = 'right';
      g.fillText('共盖印' + cnNum(n) + '枚', SHARE_W - 120, SHARE_H - 120);
      return c;
    });
  }

  window.TaishouCommon = {
    store: store,
    readSeals: readSeals,
    hasSeal: hasSeal,
    addSeal: addSeal,
    esc: esc,
    sealSVG: sealSVG,
    renderFooter: renderFooter,
    renderWendie: renderWendie,
    drawShare: drawShare,
    reducedMotion: function () {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  };
})();
