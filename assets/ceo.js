/* 太守寻非遗 中文站 CEO 版（评审版 B）：手机菜单、滚动淡入、美食地图、门类馆按地区筛选、站内搜索。
   手写文件。没有 JS 时页面照常可读（菜单用 details，清单和分页都是静态的）。
   不联网、不存任何记录：数据都是生成脚本放在页面或同目录 js 里的，只在本机查。 */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var ARROW = '<span class="arrow">→</span>';
  var numSpan = function (n) { return '<span class="num">' + esc(n) + '</span>'; };
  var batchOf = function (year, batch) { return (year ? numSpan(year) + ' ' : '') + esc(batch); };

  /* ---------- 滚动淡入 ---------- */
  (function () {
    var els = document.querySelectorAll('.rv');
    if (!els.length) return;
    if (!('IntersectionObserver' in window)) { for (var i = 0; i < els.length; i++) els[i].classList.add('in'); return; }
    var io = new IntersectionObserver(function (list) {
      list.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.04 });
    for (var j = 0; j < els.length; j++) io.observe(els[j]);
  })();

  /* ---------- 专题页：滚动时标明当前阅读场景 ---------- */
  (function () {
    var nav = document.querySelector('.topic-jump');
    if (!nav || !('IntersectionObserver' in window)) return;
    var links = nav.querySelectorAll('a[data-topic-target]');
    var scenes = [];
    for (var i = 0; i < links.length; i++) {
      var target = document.getElementById(links[i].getAttribute('data-topic-target'));
      if (target) scenes.push({ node: target, link: links[i] });
    }
    if (!scenes.length) return;
    var activate = function (link) {
      for (var j = 0; j < scenes.length; j++) scenes[j].link.removeAttribute('aria-current');
      link.setAttribute('aria-current', 'location');
    };
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) { if (entry.isIntersecting) {
        for (var k = 0; k < scenes.length; k++) if (scenes[k].node === entry.target) activate(scenes[k].link);
      }});
    }, { rootMargin: '-24% 0px -63% 0px', threshold: 0 });
    for (var m = 0; m < scenes.length; m++) io.observe(scenes[m].node);
  })();

  /* ---------- 手机菜单：按 Esc 或点别处收起 ---------- */
  (function () {
    var m = document.querySelector('.nav-m');
    if (!m) return;
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && m.open) { m.open = false; m.querySelector('summary').focus(); }
    });
    document.addEventListener('click', function (e) { if (m.open && !m.contains(e.target)) m.open = false; });
  })();

  /* ---------- 美食地图：方块示意图 ---------- */
  (function () {
    var box = $('tiles'), panel = $('panel');
    if (!box || !panel || !window.FOOD) return;
    var PROVS = window.FOOD.provs;
    var tiles = [].slice.call(document.querySelectorAll('.tile, .tile-x'));
    var grid = [].slice.call(box.querySelectorAll('.tile'));
    var chips = [].slice.call(document.querySelectorAll('.chip'));
    var cat = '', current = null;
    var itemsOf = function (prov) {
      var list = (PROVS[prov] || { items: [] }).items;
      return cat ? list.filter(function (x) { return x.c === cat; }) : list;
    };
    var paintTiles = function () {
      tiles.forEach(function (t) {
        var n = itemsOf(t.dataset.prov).length;
        var num = t.querySelector('.num');
        if (num) num.textContent = n ? n : '';
        if (t.classList.contains('tile')) {
          t.classList.toggle('empty', !n);
          t.setAttribute('aria-label', t.dataset.short + (n ? '，收录 ' + n + ' 条' : '，暂未收录'));
        }
      });
    };
    var paintPanel = function () {
      if (!current) { panel.innerHTML = '<p class="panel-hint">点一个方块，看这个省份的非遗美食。</p>'; return; }
      var list = itemsOf(current), short = (PROVS[current] || {}).s || current;
      var group = document.querySelector('.ms-group[data-prov="' + current + '"]');
      var h = '<div class="panel-head"><h2>' + esc(current) + '</h2><p>' + (list.length ? numSpan(list.length) + ' 子项' : '') + '</p>' +
        (group && list.length ? '<a href="#' + group.id + '">在完整清单里看 ↓</a>' : '') + '</div>';
      if (!list.length) { panel.innerHTML = h + '<p class="panel-empty">暂未收录</p>'; return; }
      panel.innerHTML = h + '<ul>' + list.map(function (x) {
        var meta = '<p class="r">' + esc(x.r) + '</p><p class="m">' + esc(x.c) + ' · ' + batchOf(x.y, x.b) + ' · ' + (x.e ? '扩展项目' : '新增项目') + '</p>' +
          '<a class="src" href="' + esc(x.u) + '" target="_blank" rel="noopener" aria-label="' + esc(x.n + '（' + x.r + '）在中国非物质文化遗产网的页面') + '">官方页 ' + ARROW + '</a>';
        if (x.p) return '<li class="p-item has-photo"><div><h3>' + esc(x.n) + '</h3><div class="ms-photo-row"><figure><div class="ph r11"><img src="' + esc(x.p) + '" alt="' + esc(x.n) + '（AI 演绎）" width="480" height="480" loading="lazy"></div><figcaption>AI 演绎</figcaption></figure><div class="ms-meta">' + meta + '</div></div></div></li>';
        var fig = x.g ? '<figure><div class="ph r43"><img src="' + esc(x.g[0]) + '" alt="' + esc(x.g[1]) + '" width="240" height="180" loading="lazy"></div><figcaption>' + x.g[2] + '</figcaption></figure>' : '';
        return '<li class="p-item' + (x.g ? ' has-fig' : '') + '"><div><h3>' + esc(x.n) + '</h3><p class="r">' + esc(x.r) + '</p>' +
          '<p class="m">' + esc(x.c) + ' · ' + batchOf(x.y, x.b) + ' · ' + (x.e ? '扩展项目' : '新增项目') + '</p>' +
          '<a class="src" href="' + esc(x.u) + '" target="_blank" rel="noopener" aria-label="' + esc(x.n + '（' + x.r + '）在中国非物质文化遗产网的页面') + '">官方页 ' + ARROW + '</a></div>' + fig + '</li>';
      }).join('') + '</ul>';
      void short;
    };
    var select = function (prov, fromHash) {
      current = prov;
      tiles.forEach(function (t) { t.setAttribute('aria-pressed', t.dataset.prov === prov ? 'true' : 'false'); });
      paintPanel();
      if (!fromHash && prov && window.history && history.replaceState) {
        try { history.replaceState(null, '', '#' + encodeURIComponent((PROVS[prov] || {}).s || prov)); } catch (e) { /* 本地文件打开时可能不让改地址，忽略 */ }
      }
    };
    var paintList = function () {
      [].forEach.call(document.querySelectorAll('.ms-group'), function (g) {
        var n = 0;
        [].forEach.call(g.querySelectorAll('.ms-card'), function (c) {
          var show = !cat || c.dataset.cat === cat;
          c.hidden = !show; if (show) n++;
        });
        g.hidden = !n;
        var cnt = g.querySelector('.ms-n'); if (cnt) cnt.textContent = n;
      });
      [].forEach.call(document.querySelectorAll('.ms-index li'), function (li) {
        var a = li.querySelector('a'), g = a && document.querySelector(a.getAttribute('href'));
        li.hidden = !!(g && g.hidden);
        var s = li.querySelector('small'), c = g && g.querySelector('.ms-n');
        if (s && c) s.textContent = c.textContent;
      });
    };
    tiles.forEach(function (t) { t.addEventListener('click', function () { select(t.dataset.prov); }); });
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        cat = c.dataset.cat || '';
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
        paintTiles(); paintPanel(); paintList();
      });
    });
    /* 方向键在方块之间移动：按方位找最近的一个 */
    box.addEventListener('keydown', function (e) {
      var d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[e.key];
      var t = e.target.closest && e.target.closest('.tile');
      if (!d || !t) return;
      var r = +t.dataset.r, c = +t.dataset.c, best = null, bestScore = 1e9;
      grid.forEach(function (o) {
        var dr = +o.dataset.r - r, dc = +o.dataset.c - c;
        var along = d[0] ? dr * d[0] : dc * d[1], across = Math.abs(d[0] ? dc : dr);
        if (along <= 0) return;
        var score = along + across * 2.5;
        if (score < bestScore) { bestScore = score; best = o; }
      });
      if (best) { e.preventDefault(); best.focus(); }
    });
    /* 地址里带 #省名（简称或全称都行）就直接展开那个省 */
    var fromHash = function () {
      var h = '';
      try { h = decodeURIComponent(window.location.hash.replace(/^#/, '')); } catch (e) { return; }
      if (!h) return;
      for (var k in PROVS) if (k === h || PROVS[k].s === h) { select(k, true); return; }
    };
    window.addEventListener('hashchange', fromHash);
    fromHash();
  })();

  /* ---------- 门类馆：按地区筛选项目档案库 ---------- */
  (function () {
    var sel = $('arch-prov'), list = $('arch-list');
    if (!sel || !list) return;
    var hall = sel.dataset.hall, pager = $('arch-pager'), result = $('arch-result'), range = $('arch-range');
    var original = list.innerHTML, loading = false;
    var load = function (done) {
      if (window.YJ && window.YJ[hall]) return done();
      if (loading) return; loading = true;
      var s = document.createElement('script');
      s.src = 'd' + hall + '.js';
      s.onload = function () { loading = false; done(); };
      s.onerror = function () { loading = false; result.hidden = false; result.textContent = '数据没有载入，请刷新后再试。'; };
      document.head.appendChild(s);
    };
    var render = function () {
      var prov = sel.value;
      if (!prov) {
        list.innerHTML = original; result.hidden = true; result.innerHTML = '';
        if (pager) pager.hidden = false; if (range) range.hidden = false;
        return;
      }
      var subs = 0, html = '';
      var rows = window.YJ[hall].filter(function (p) { return p.e.some(function (e) { return e[2] === prov; }); });
      rows.forEach(function (p) {
        var es = p.e.filter(function (e) { return e[2] === prov; });
        subs += es.length;
        var subHtml = es.map(function (e) {
          return '<li>' + (e[0] !== p.t ? '<b>' + esc(e[0]) + '</b>' : '') + '<span class="r">' + esc(e[1]) + '</span><span class="m">' + batchOf(e[3], e[4]) + ' · ' + (e[5] ? '扩展项目' : '新增项目') + '</span>' +
            '<a class="src" href="' + esc(e[6]) + '" target="_blank" rel="noopener" aria-label="' + esc(e[0] + '（' + e[1] + '）在中国非物质文化遗产网的页面') + '">官方页 ' + ARROW + '</a></li>';
        }).join('');
        var fig = p.g ? '<figure class="pj-fig"><div class="ph r11"><img src="../' + esc(p.g[0]) + '" alt="' + esc(p.t) + ' ' + esc(p.g[1]) + '" width="240" height="240" loading="lazy"></div></figure>' : '';
        var detail = fig ? '<div class="pj-detail">' + fig + '<ul class="pj-subs">' + subHtml + '</ul></div>' : '<ul class="pj-subs">' + subHtml + '</ul>';
        html += '<li class="pj' + (p.g ? ' has-fig' : '') + '"><span class="pj-num">' + esc(p.n) + '</span><div class="pj-b"><h3>' + esc(p.t) + '</h3>' + detail + '</div></li>';
      });
      list.innerHTML = html;
      result.hidden = false;
      result.innerHTML = esc(prov) + '：' + numSpan(rows.length) + ' 项、' + numSpan(subs) + ' 子项<button type="button" id="arch-clear">看全部地区</button>';
      $('arch-clear').addEventListener('click', function () { sel.value = ''; render(); sel.focus(); });
      if (pager) pager.hidden = true; if (range) range.hidden = true;
    };
    sel.addEventListener('change', function () { if (sel.value) load(render); else render(); });
    if (sel.value) load(render);   /* 浏览器后退时会记住下拉框的值 */
  })();

  /* ---------- 站内搜索（只有 search.html 有数据） ---------- */
  (function () {
    var input = $('q'), out = $('search-out');
    if (!input || !out || !window.CN_SEARCH) return;
    var DATA = window.CN_SEARCH, GROUPS = ['节目', '传承人', '门类馆', '名录项目'], MAX = 60;
    var q0 = '';
    window.location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i < 0 || kv.slice(0, i) !== 'q') return;
      try { q0 = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { /* 坏参数忽略 */ }
    });
    var norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); };
    var mark = function (text, q) {
      var t = String(text || ''), i = q ? t.toLowerCase().indexOf(q) : -1;
      if (i < 0) return esc(t);
      return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
    };
    var run = function () {
      var raw = input.value.trim(), q = norm(raw);
      if (!q) { out.innerHTML = ''; return; }
      var hits = DATA.filter(function (x) { return norm(x.t).indexOf(q) >= 0 || norm(x.s).indexOf(q) >= 0 || norm(x.m).indexOf(q) >= 0; });
      if (!hits.length) { out.innerHTML = '<p class="empty">没有找到“' + esc(raw) + '”</p>'; return; }
      var low = raw.toLowerCase();
      out.innerHTML = GROUPS.map(function (g) {
        var list = hits.filter(function (x) { return x.k === g; });
        if (!list.length) return '';
        return '<h2>' + g + '<small>' + list.length + ' 条</small></h2>' +
          list.slice(0, MAX).map(function (x) {
            return '<a class="rrow" href="' + esc(x.h) + '"><span class="num">' + esc(x.no) + '</span><span class="t">' + mark(x.t, low) + '</span><span class="m">' + mark(x.m, low) + '</span></a>';
          }).join('') + (list.length > MAX ? '<p class="more-n">只列出前 ' + MAX + ' 条，再多打几个字可以缩小范围。</p>' : '');
      }).join('');
    };
    if (q0) input.value = q0;
    input.addEventListener('input', run);
    if (input.form) input.form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
    run();
  })();

  (function () {
    var btn = document.querySelector('[data-random-hall]');
    if (!btn) return;
    btn.addEventListener('click', function () {
      var links = [].slice.call(document.querySelectorAll('.yj-card'));
      if (!links.length) return;
      window.location.href = links[Math.floor(Math.random() * links.length)].getAttribute('href');
    });
  })();

  (function () {
    var box = $('home-food');
    if (!box || !window.HOME_FOOD) return;
    var data = window.HOME_FOOD;
    var shot = box.querySelector('.food-shot');
    var name = $('home-food-name'), num = $('home-food-num'), link = $('home-food-link');
    var btns = [].slice.call(document.querySelectorAll('.mini-tiles button[data-prov]'));
    var show = function (prov) {
      var d = data[prov];
      if (!d) return;
      btns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-prov') === prov)); });
      shot.innerHTML = d.photo
        ? '<img id="home-food-img" src="' + esc(d.photo) + '" alt="' + esc(d.s + ' · ' + d.name) + '（AI 演绎示意）" width="480" height="480"><figcaption>AI 演绎示意</figcaption>'
        : '<span class="food-empty">该省暂无示意图片</span><figcaption>暂未收录</figcaption>';
      name.textContent = d.s + ' · ' + d.name;
      num.textContent = '编号 ' + (d.num || '—') + ' · ' + d.n + ' 项子项目';
      link.href = 'meishi.html#' + d.h;
    };
    btns.forEach(function (b) { b.addEventListener('click', function () { show(b.getAttribute('data-prov')); }); });
    show('上海市');
  })();
})();
