/* 太守寻非遗 中文站：站内搜索（只有 search.html 加载）。没有 JS 时其余页面照常可读。
   不联网、不存任何记录：数据由 工具/build_cn_site.py 内嵌在 search.html（window.CN_SEARCH），只在本机查。 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var q0 = '';
  window.location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
    var i = kv.indexOf('=');
    if (i < 0 || kv.slice(0, i) !== 'q') return;
    try { q0 = decodeURIComponent(kv.slice(i + 1).replace(/\+/g, ' ')); } catch (e) { /* 坏参数忽略 */ }
  });

  var input = $('q'), out = $('search-out');
  if (!input || !out || !window.CN_SEARCH) return;
  var DATA = window.CN_SEARCH;
  var GROUPS = ['节目', '传承人'];
  var norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); };
  var mark = function (text, q) {
    var t = String(text || ''), i = q ? t.toLowerCase().indexOf(q) : -1;
    if (i < 0) return esc(t);
    return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
  };
  var run = function () {
    var raw = input.value.trim(), q = norm(raw);
    if (!q) { out.innerHTML = ''; return; }
    var hits = DATA.filter(function (x) { return norm(x.s).indexOf(q) >= 0 || norm(x.t).indexOf(q) >= 0; });
    if (!hits.length) { out.innerHTML = '<p class="empty">没有找到“' + esc(raw) + '”。</p>'; return; }
    var low = raw.toLowerCase();
    out.innerHTML = GROUPS.map(function (g) {
      var list = hits.filter(function (x) { return x.k === g; });
      if (!list.length) return '';
      return '<h2>' + g + '<small>' + list.length + ' 条</small></h2>' +
        list.map(function (x) {
          return '<a class="rrow" href="' + esc(x.h) + '"><span class="num">' + esc(x.no) + '</span><span class="t">' + mark(x.t, low) + '</span><span class="m">' + mark(x.m, low) + '</span></a>';
        }).join('');
    }).join('');
  };
  if (q0) input.value = q0;
  input.addEventListener('input', run);
  var form = input.form;
  if (form) form.addEventListener('submit', function (e) { e.preventDefault(); run(); });
  run();
})();
