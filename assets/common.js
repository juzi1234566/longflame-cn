/* 全站公用：安全存储、印章、页脚、文牒 */
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
        '<p class="wendie-note">读到一站的结尾，就会盖下那一站的印。</p>' +
        (first ? '<a class="wendie-go" href="' + prefix + esc(first.page) + '">去太守此刻所在的一站</a>' : '');
      return;
    }
    root.innerHTML = avatar + '<ul class="wendie-seals">' + got.map(function (s) {
      return '<li>' + sealSVG(s.seal, s.name + '站朱印') +
        '<span class="wendie-name">第' + s.order + '站 · ' + esc(s.name) + '</span>' +
        (s.page ? '<a href="' + prefix + esc(s.page) + '">再读一遍</a>' : '') + '</li>';
    }).join('') + '</ul>' +
      '<p class="wendie-note">共 ' + got.length + ' 枚。印只存在这台设备的这个浏览器里。</p>';
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
    reducedMotion: function () {
      return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    }
  };
})();
