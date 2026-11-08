/* 太守寻非遗 中文站：少量原生 JS。没有 JS 时页面照常可读（片头直接播一次、传承人全部显示、搜索给出分类入口）。
   不联网、不存任何记录。 */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var esc = function (t) {
    return String(t == null ? '' : t).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  var params = (function () {
    var out = {};
    var q = window.location.search.replace(/^\?/, '');
    if (!q) return out;
    q.split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      var k = i < 0 ? kv : kv.slice(0, i);
      var v = i < 0 ? '' : kv.slice(i + 1);
      try { out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { /* 坏参数忽略 */ }
    });
    return out;
  })();

  // 1. 首页片头：点“播放”重播一次（把舞台换成一份新的，CSS 动画就从头开始）
  var play = $('intro-play');
  if (play) {
    play.addEventListener('click', function () {
      var stage = $('intro-stage');
      if (!stage) return;
      var fresh = stage.cloneNode(true);
      stage.parentNode.replaceChild(fresh, stage);
    });
  }

  // 2. 传承人列表：级别页签 + 门类、地区下拉。网址参数 ?level= ?cat= ?prov= 可预设（搜索页的分类入口用）
  var grid = $('people-grid');
  if (grid) {
    var cards = [].slice.call(grid.querySelectorAll('[data-level]'));
    var tabs = [].slice.call(document.querySelectorAll('.tab[data-lv]'));
    var cat = $('f-cat'), prov = $('f-prov'), empty = $('people-empty');
    var st = { lv: params.level || '', cat: params.cat || '', prov: params.prov || '' };
    var has = function (sel, v) { return [].some.call(sel.options, function (o) { return o.value === v; }); };
    if (!tabs.some(function (t) { return t.getAttribute('data-lv') === st.lv; })) st.lv = '';
    if (cat && has(cat, st.cat)) cat.value = st.cat; else st.cat = '';
    if (prov && has(prov, st.prov)) prov.value = st.prov; else st.prov = '';
    var apply = function () {
      var n = 0;
      cards.forEach(function (c) {
        var ok = (!st.lv || c.getAttribute('data-level') === st.lv) &&
                 (!st.cat || c.getAttribute('data-cat') === st.cat) &&
                 (!st.prov || c.getAttribute('data-prov') === st.prov);
        c.hidden = !ok;
        if (ok) n++;
      });
      tabs.forEach(function (t) { t.setAttribute('aria-selected', t.getAttribute('data-lv') === st.lv ? 'true' : 'false'); });
      if (empty) empty.hidden = n > 0;
    };
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { st.lv = t.getAttribute('data-lv'); apply(); });
    });
    if (cat) cat.addEventListener('change', function () { st.cat = cat.value; apply(); });
    if (prov) prov.addEventListener('change', function () { st.prov = prov.value; apply(); });
    apply();
  }

  // 3. 站内搜索：数据由 工具/build_cn_site.py 内嵌在 search.html（window.CN_SEARCH），只在本机查
  var input = $('q'), out = $('search-out'), browse = $('search-browse');
  if (input && out && window.CN_SEARCH) {
    var DATA = window.CN_SEARCH;
    var norm = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ''); };
    var GROUPS = [['传承人', 'Inheritors'], ['记忆', 'Stories'], ['作品', 'Works']];
    var mark = function (text, q) {
      var t = String(text || ''), i = q ? t.toLowerCase().indexOf(q) : -1;
      if (i < 0) return esc(t);
      return esc(t.slice(0, i)) + '<mark>' + esc(t.slice(i, i + q.length)) + '</mark>' + esc(t.slice(i + q.length));
    };
    var run = function () {
      var raw = input.value.trim(), q = norm(raw);
      if (!q) { out.innerHTML = ''; if (browse) browse.hidden = false; return; }
      if (browse) browse.hidden = true;
      var hits = DATA.filter(function (x) { return norm(x.s).indexOf(q) >= 0 || norm(x.t).indexOf(q) >= 0; });
      if (!hits.length) { out.innerHTML = '<p class="empty">没有找到“' + esc(raw) + '”。</p>'; return; }
      var low = raw.toLowerCase();
      out.innerHTML = GROUPS.map(function (g, gi) {
        var list = hits.filter(function (x) { return x.k === g[0]; });
        if (!list.length) return '';
        return '<section' + (gi ? ' class="sec"' : '') + '><div class="sh"><div class="sh-t"><h2>' + g[0] + '</h2><span class="en">' + g[1] + '</span></div>' +
          '<span class="note">' + list.length + ' 条</span></div><div class="body mlist">' +
          list.map(function (x) {
            return '<a class="rrow" href="' + esc(x.h) + '"><span class="num">' + esc(x.no) + '</span><span class="t">' + mark(x.t, low) + '</span><span class="m">' + mark(x.m, low) + '</span></a>';
          }).join('') + '</div></section>';
      }).join('');
    };
    if (params.q) input.value = params.q;
    input.addEventListener('input', run);
    run();
  }
})();
