/* 寻非遗：国家级非遗名录页。数据由 工具/fetch_minglu.py 生成，只读本站的 JSON，不请求外部
   配图索引 minglu-images.json 由 工具/fetch_minglu_images.py 生成：只用开放许可的图片，图片都在本站 */
(function () {
  'use strict';

  var CATS = ['民间文学', '传统音乐', '传统舞蹈', '传统戏剧', '曲艺', '传统体育、游艺与杂技', '传统美术', '传统技艺', '传统医药', '民俗'];
  var NONE = '未标注地区';
  var PAGE = 60;            // 每组先渲染这么多条，余下点“再看”
  var OPEN_ALL_UNDER = 120; // 结果不多时所有组自动展开

  var $ = function (id) { return document.getElementById(id); };
  var els = {
    total: $('ml-total'), fetched: $('ml-fetched'), source: $('ml-source-link'),
    q: $('ml-q'), prov: $('ml-prov'), cats: $('ml-cats'),
    result: $('ml-result'), groups: $('ml-groups'), empty: $('ml-empty')
  };

  var esc = (window.TaishouCommon && window.TaishouCommon.esc) || function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  var data = [], order = [], state = { q: '', cat: '', prov: '' };
  var imgs = {};      // 项目编号 -> 配图；只给 applies 里列出的子项显示
  var openSet = {};   // 用户点开的组，筛选变化后保持
  var shown = {};     // 每组已渲染到第几条
  var current = {};   // 当前筛选结果，按组

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); }

  function hl(text, q) {
    if (!q) return esc(text);
    var t = String(text), i = norm(t).indexOf(q);
    // 名称里一般没有空格，norm 前后下标一致；对不上就不高亮
    if (i < 0 || t.toLowerCase().indexOf(q) !== i) return esc(t);
    return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
  }

  function readURL() {
    try {
      var p = new URLSearchParams(location.search);
      state.q = p.get('q') || '';
      state.cat = CATS.indexOf(p.get('cat')) >= 0 ? p.get('cat') : '';
      state.prov = p.get('prov') || '';
    } catch (e) { /* 老浏览器：忽略 */ }
  }

  function writeURL() {
    try {
      var p = new URLSearchParams();
      if (state.q) p.set('q', state.q);
      if (state.cat) p.set('cat', state.cat);
      if (state.prov) p.set('prov', state.prov);
      var s = p.toString();
      history.replaceState(null, '', location.pathname + (s ? '?' + s : '') + location.hash);
    } catch (e) { /* 不影响查找 */ }
  }

  function matches(it, q, useCat, useProv) {
    if (useCat && state.cat && it.cat !== state.cat) return false;
    if (useProv && state.prov && (it.provName || NONE) !== state.prov) return false;
    if (q && it._k.indexOf(q) < 0) return false;
    return true;
  }

  function renderCats() {
    var q = norm(state.q);
    var count = {}, all = 0;
    data.forEach(function (it) {
      if (!matches(it, q, false, true)) return;
      all++; count[it.cat] = (count[it.cat] || 0) + 1;
    });
    var html = '<button type="button" class="ml-cat" data-cat="" aria-pressed="' + (!state.cat) + '">全部<small>' + all + '</small></button>';
    CATS.forEach(function (c) {
      html += '<button type="button" class="ml-cat" data-cat="' + esc(c) + '" aria-pressed="' + (state.cat === c) + '">' + esc(c) + '<small>' + (count[c] || 0) + '</small></button>';
    });
    els.cats.innerHTML = html;
    // 手机上门类是一条横滑带：让选中的那个露出来（只滚带子，不动整页）
    var on = els.cats.querySelector('[aria-pressed="true"]');
    if (on && els.cats.scrollWidth > els.cats.clientWidth) {
      var left = on.offsetLeft - els.cats.offsetLeft, right = left + on.offsetWidth;
      if (left < els.cats.scrollLeft || right > els.cats.scrollLeft + els.cats.clientWidth) els.cats.scrollLeft = Math.max(0, left - 24);
    }
  }

  function imgOf(it) {
    var m = imgs[it.num];
    return m && m.applies && m.applies.indexOf(it.id) >= 0 ? m : null;
  }

  // 只放 https 链接；别的不出链接
  function safeURL(u) { return /^https:\/\/[^\s"'<>]+$/.test(u || '') ? u : ''; }
  function link(text, u) {
    var h = safeURL(u);
    return h ? '<a href="' + esc(h) + '" target="_blank" rel="noopener">' + esc(text) + '</a>' : esc(text);
  }

  // 详情：大图 + 图说 + 署名（图：作者 / 许可 / 来源）
  function figHTML(it, m) {
    var notes = [];
    notes.push(m.via === 'met' || m.via === 'cma' ? '图说依据馆方藏品记录' : '图说依据原图说明');
    // 配图是项目级的，图里的器物、场景不一定出自这一行的申报地区
    notes.push(m.multiRegion ? '项目配图，不代表某一申报地区' : '项目配图，不一定出自所列申报地区');
    notes.push('本站已缩放' + (m.shareAlike ? '，按 ' + esc(m.license) + ' 同样许可共享' : ''));
    return '<figure class="ml-fig" id="ml-fig-' + esc(it.id) + '" hidden>' +
      '<div class="ml-fig-img"><img data-src="' + esc(m.large) + '" width="' + (+m.w || 800) + '" height="' + (+m.h || 600) + '" alt="' + esc(m.caption) + '"></div>' +
      '<figcaption><p class="ml-cap">' + esc(m.caption) + '</p>' +
        '<p class="ml-credit">图：' + esc(m.author) + ' / ' + link(m.licenseShort || m.license, m.licenseUrl) + ' / ' + link(m.sourceName, m.sourceUrl) + '</p>' +
        '<p class="ml-fnote">' + notes.join('；') + '</p></figcaption>' +
      '</figure>';
  }

  function itemHTML(it, q) {
    var meta = esc(it.cat) + ' · ' + (it.year || '') + ' ' + esc(it.batch) + ' · ' +
      (it.ext ? '<span class="ml-ext">扩展项目</span>' : '新增项目');
    var m = imgOf(it);
    var thumb = m
      ? '<button type="button" class="ml-thumb" aria-expanded="false" aria-controls="ml-fig-' + esc(it.id) + '" aria-label="' + esc('看图：' + it.name) + '">' +
          '<img src="' + esc(m.thumb) + '" width="240" height="180" alt="" loading="lazy" decoding="async"></button>'
      : '<span class="ml-thumb ml-thumb--none" aria-hidden="true"></span>';
    return '<li class="ml-item' + (m ? ' ml-item--img' : '') + '">' +
      '<span class="ml-num">' + esc(it.num) + '</span>' +
      '<h3 class="ml-name">' + hl(it.name, q) + '<span class="ml-meta">' + meta + '</span></h3>' +
      '<span class="ml-region">' + hl(it.region, q) + '</span>' + thumb +
      '<a class="ml-link" href="' + esc(it.url) + '" target="_blank" rel="noopener" aria-label="' +
        esc(it.name + '（' + it.region + '）在中国非物质文化遗产网的出处') + '">出处</a>' +
      (m ? figHTML(it, m) : '') +
      '</li>';
  }

  function fillGroup(details, key, more) {
    var list = current[key] || [];
    var q = norm(state.q);
    var from = more ? shown[key] : 0;
    var to = Math.min(list.length, from + PAGE);
    var ul = details.querySelector('.ml-list');
    if (!more || !ul) {
      var old = details.querySelector('.ml-list, .ml-more');
      while (old) { old.remove(); old = details.querySelector('.ml-list, .ml-more'); }
      ul = document.createElement('ul');
      ul.className = 'ml-list';
      details.appendChild(ul);
    }
    var html = '';
    for (var i = from; i < to; i++) html += itemHTML(list[i], q);
    ul.insertAdjacentHTML('beforeend', html);
    shown[key] = to;
    var btnWrap = details.querySelector('.ml-more');
    if (to < list.length) {
      if (!btnWrap) {
        btnWrap = document.createElement('div');
        btnWrap.className = 'ml-more';
        btnWrap.innerHTML = '<button type="button"></button>';
        details.appendChild(btnWrap);
      }
      btnWrap.firstChild.textContent = '再看 ' + Math.min(PAGE, list.length - to) + ' 条（还有 ' + (list.length - to) + ' 条）';
    } else if (btnWrap) btnWrap.remove();
    details.dataset.filled = '1';
  }

  function render() {
    var q = norm(state.q);
    current = {};
    var total = 0, nums = {};
    data.forEach(function (it) {
      if (!matches(it, q, true, true)) return;
      var k = it.provName || NONE;
      (current[k] = current[k] || []).push(it);
      total++; nums[it.num] = 1;
    });
    var keys = order.filter(function (k) { return current[k]; });
    var filtered = !!(state.q || state.cat || state.prov);
    var openAll = !!state.prov || (filtered && total <= OPEN_ALL_UNDER);

    var html = '';
    keys.forEach(function (k) {
      var n = current[k].length;
      var open = openAll || openSet[k];
      html += '<details class="ml-group" data-key="' + esc(k) + '"' + (open ? ' open' : '') + '>' +
        '<summary><span class="ml-gname">' + esc(k) + '</span><span class="ml-gcount">' + n + ' 子项</span><span class="ml-gmark" aria-hidden="true"></span></summary>' +
        '</details>';
    });
    els.groups.innerHTML = html;
    shown = {};
    Array.prototype.forEach.call(els.groups.querySelectorAll('.ml-group[open]'), function (d) { fillGroup(d, d.dataset.key); });

    var projects = Object.keys(nums).length;
    els.result.textContent = total
      ? (filtered ? '找到 ' : '全部 ') + total + ' 子项（' + projects + ' 项），按地方分 ' + keys.length + ' 组' + (openAll || !filtered ? '' : '，点地方展开')
      : '';
    els.empty.hidden = total > 0;
    renderCats();
    writeURL();
  }

  function bind() {
    var timer;
    els.q.value = state.q;
    els.q.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { state.q = els.q.value.trim(); render(); }, 180);
    });
    els.q.addEventListener('keydown', function (e) { if (e.key === 'Enter') { clearTimeout(timer); state.q = els.q.value.trim(); render(); els.q.blur(); } });
    els.prov.addEventListener('change', function () { state.prov = els.prov.value; render(); });
    els.cats.addEventListener('click', function (e) {
      var b = e.target.closest('.ml-cat');
      if (!b) return;
      state.cat = b.dataset.cat || '';
      render();
    });
    els.groups.addEventListener('toggle', function (e) {
      var d = e.target;
      if (!d.classList || !d.classList.contains('ml-group')) return;
      if (d.open && !d.dataset.filled) fillGroup(d, d.dataset.key);
    }, true);
    els.groups.addEventListener('click', function (e) {
      // 只记住用户亲手点开的组；筛选时自动展开的不算
      var s = e.target.closest('.ml-group > summary');
      if (s) {
        var g = s.parentNode;
        if (g.open) delete openSet[g.dataset.key]; else openSet[g.dataset.key] = 1;
        return;
      }
      var t = e.target.closest('.ml-thumb[aria-controls]');
      if (t) {
        var fig = document.getElementById(t.getAttribute('aria-controls'));
        if (!fig) return;
        var open = t.getAttribute('aria-expanded') !== 'true';
        var img = fig.querySelector('img[data-src]');
        if (open && img) { img.src = img.getAttribute('data-src'); img.removeAttribute('data-src'); }
        fig.hidden = !open;
        t.setAttribute('aria-expanded', String(open));
        return;
      }
      var b = e.target.closest('.ml-more button');
      if (!b) return;
      var d = b.closest('.ml-group');
      fillGroup(d, d.dataset.key, true);
    });
  }

  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
    return m ? m[1] + ' 年 ' + (+m[2]) + ' 月 ' + (+m[3]) + ' 日' : '';
  }

  function init(list, meta) {
    data = list;
    data.forEach(function (it) { it._k = norm(it.name + '|' + it.region + '|' + it.num); });
    var provs = meta.provinces || {};
    order = [];
    Object.keys(provs).forEach(function (code) { var n = provs[code]; if (n && order.indexOf(n) < 0) order.push(n); });
    data.forEach(function (it) { var k = it.provName || NONE; if (order.indexOf(k) < 0 && k !== NONE) order.push(k); });
    order.push(NONE);

    var present = {};
    data.forEach(function (it) { present[it.provName || NONE] = (present[it.provName || NONE] || 0) + 1; });
    els.prov.insertAdjacentHTML('beforeend', order.filter(function (k) { return present[k]; }).map(function (k) {
      return '<option value="' + esc(k) + '">' + esc(k) + '</option>';
    }).join(''));
    if (state.prov && !present[state.prov]) state.prov = '';
    els.prov.value = state.prov;

    els.total.innerHTML = '共 <b>' + meta.projects + '</b> 项　<b>' + meta.subitems + '</b> 子项';
    var d = fmtDate(meta.fetchedAt);
    if (d) els.fetched.textContent = '，' + d + '抓取';
    bind();
    render();
  }

  readURL();
  var getJSON = function (u) { return fetch(u, { cache: 'no-cache' }).then(function (r) { if (!r.ok) throw new Error(u); return r.json(); }); };
  // 配图索引缺了也照常显示名录，只是没有图
  var getImages = getJSON('assets/minglu-images.json').then(function (r) { return (r && r.images) || {}; }, function () { return {}; });
  Promise.all([getJSON('assets/minglu.json'), getJSON('assets/minglu-meta.json'), getImages])
    .then(function (r) { imgs = r[2]; init(r[0], r[1]); })
    .catch(function () {
      els.total.textContent = '名录没有载入成功';
      els.empty.hidden = false;
      els.empty.textContent = '名录数据没有载入成功。请通过网站地址打开本页，或稍后再试。';
    });
})();
