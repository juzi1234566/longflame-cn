/* 站点页通用渲染（展示版）：头图上的竖排题跋、故事长页、出处、盖印和两个出口。内容全部来自 stations.js */
(function () {
  'use strict';

  var C = window.TaishouCommon;
  var esc = C.esc;
  var PREFIX = '../';
  var stations = window.TAISHOU.stations;
  var id = document.body.getAttribute('data-station');
  var s = stations.filter(function (x) { return x.id === id; })[0];
  var acts = document.getElementById('acts');
  var titleEl = document.getElementById('st-title');

  if (!s) {
    acts.innerHTML = '<section class="st-missing"><p>这一站还没有内容。</p><a class="exit" href="' + PREFIX + 'index.html">回山河图</a></section>';
    return;
  }

  if (s.accent) document.documentElement.style.setProperty('--accent', s.accent);
  if (s.texture) document.documentElement.style.setProperty('--texture', 'url("' + s.texture + '")');
  var next = stations.filter(function (x) { return x.order === s.order + 1; })[0];
  var ORDER = ['', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

  function lines(arr) {
    return (arr || []).map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('');
  }

  /* 头图上的题跋：从右往左是站名和朱砂小印、悬念，最左下角落款“第几站 · 地方” */
  function title() {
    var meta = ['第' + (ORDER[s.order] || s.order) + '站', s.region].filter(Boolean).join(' · ');
    return '<h1 class="st-name">' + esc(s.name) +
      (s.seal ? '<span class="st-seal" aria-hidden="true">' + esc(s.seal) + '</span>' : '') + '</h1>' +
      (s.hook ? '<p class="st-hook">' + lines(s.hook) + '</p>' : '') +
      '<p class="st-meta">' + esc(meta) + '</p>';
  }

  function storyBlock(b) {
    if (b.type === 'h') return '<h3>' + esc(b.text) + '</h3>';
    if (b.type === 'legend') {
      return '<aside class="legend"><span class="legend-tag">' + esc(b.tag) + '</span><p>' + esc(b.text) + '</p></aside>';
    }
    if (b.type === 'figure') {
      // 册页式插图：月白裱边、细墨线、绢色画心，图下一行小字说明
      var src = PREFIX + 'assets/' + b.src;
      var set = b.small ? ' srcset="' + esc(PREFIX + 'assets/' + b.small) + ' 800w, ' + esc(src) + ' 1600w" sizes="(max-width: 760px) 92vw, 600px"' : '';
      return '<figure class="figure"><div class="figure-mount"><img src="' + esc(src) + '"' + set +
        (b.width ? ' width="' + b.width + '" height="' + b.height + '"' : '') +
        ' alt="' + esc(b.alt || '') + '" loading="lazy" decoding="async"></div>' +
        (b.caption ? '<figcaption>' + esc(b.caption) + '</figcaption>' : '') + '</figure>';
    }
    return '<p>' + esc(b.text) + '</p>';
  }

  function story() {
    var st = s.story;
    var sources = (st.sources || []).map(function (src) {
      return '<li><a href="' + esc(src.url) + '" target="_blank" rel="noopener noreferrer">' + esc(src.label) + '</a></li>';
    }).join('');
    return '<article class="st-story" id="story" aria-labelledby="story-title">' +
      '<h2 class="story-title" id="story-title">' + esc(st.title) + '</h2>' +
      '<div class="story-body">' + st.blocks.map(storyBlock).join('') +
      (sources ? '<footer class="sources"><h3>资料来源</h3><ol>' + sources + '</ol></footer>' : '') +
      '</div></article>';
  }

  function end() {
    var q = s.minglu ? '?q=' + encodeURIComponent(s.minglu) : '';
    var nextBlock = next
      ? '<div class="end-next"><h2>太守的下一站</h2><p class="end-hook">' + lines(next.hook) + '</p>' +
        (next.status === 'open'
          ? '<a class="end-follow" href="' + PREFIX + esc(next.page) + '">跟上去</a>'
          : '<p class="end-pending">' + esc(next.pendingNote || '太守还在路上') + '</p>') +
        '</div>'
      : '';
    return '<section class="st-end" id="end" aria-label="这一站读完了">' +
      '<div class="end-row">' +
      '<div class="end-seal"><div class="stamp" id="stamp">' + C.sealSVG(s.seal, s.name + '站朱印') + '</div>' +
      '<p class="stamp-note" id="stamp-note" role="status"></p></div>' +
      nextBlock +
      '</div>' +
      '<nav class="end-exits" aria-label="读完之后">' +
      '<a class="exit" href="' + PREFIX + 'index.html"><span>回山河图</span></a>' +
      '<a class="exit" href="' + PREFIX + 'minglu.html' + q + '"><span>寻非遗 · 查名录</span></a>' +
      '</nav>' +
      '</section>' +
      '<footer class="foot" id="site-footer"></footer>';
  }

  titleEl.innerHTML = title();
  acts.innerHTML = story() + end();
  C.renderFooter(PREFIX);

  /* 落地：从首页推镜进来是一整片月白，头图在月白里慢慢显出来，再微微退后一点，像镜头停稳 */
  var head = document.getElementById('st-head');
  var img = head.querySelector('.st-head-img');
  function ready() { head.classList.add('is-ready'); }
  if (!img || img.complete) ready();
  else {
    img.addEventListener('load', ready);
    img.addEventListener('error', ready);
    setTimeout(ready, 2500); // 图太慢也先把字显出来
  }

  /* 盖印：读到结尾盖一次；读过的直接显示 */
  var stamp = document.getElementById('stamp');
  var note = document.getElementById('stamp-note');
  var endEl = document.getElementById('end');
  var pressed = false;

  function press(animate) {
    if (pressed) return;
    pressed = true;
    var saved = C.addSeal(s.id);
    stamp.classList.add(animate ? 'pressing' : 'pressed');
    note.textContent = saved
      ? '“' + s.seal + '”字朱印，已盖进文牒。'
      : '印盖下了，但这个浏览器不允许保存，文牒里不会留下。';
  }

  if (C.hasSeal(s.id)) {
    press(false);
  } else if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        io.disconnect();
        press(!C.reducedMotion());
      }
    }, { threshold: 0.45 });
    io.observe(endEl);
  } else {
    press(false);
  }
})();
