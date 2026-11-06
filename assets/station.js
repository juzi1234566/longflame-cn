/* 站点页通用渲染（展示版）：头图上的竖排题跋、故事长页（含按住看开片、按住看窑变）、出处、匠人（有数据才显示）、答三题、盖印和两个出口。内容全部来自 stations.js */
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
    if (b.type === 'crackle') {
      // 按住看开片：一块天青釉面，交互见 assets/kaipian.js。说明写明“示意，非实物”
      return '<figure class="kaipian" id="kaipian">' +
        (b.hint ? '<p class="kaipian-hint" id="kaipian-hint">' + esc(b.hint) + '<span class="kaipian-key">（或聚焦后按住空格）</span></p>' : '') +
        '<div class="kaipian-mount"><canvas class="kaipian-canvas" tabindex="0" role="img" aria-describedby="kaipian-cap"' +
        ' aria-label="一块天青色的釉面示意。按住釉面，或聚焦后按住空格、回车，裂纹会从按下处慢慢生长，松手就停"></canvas></div>' +
        '<figcaption id="kaipian-cap"><span class="kaipian-cap">' + (b.caption || '').replace(/。(?=.)/g, '。|').split('|').map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</span>' +
        '<button type="button" class="kaipian-again">换一片釉</button></figcaption></figure>';
    }
    if (b.type === 'yaobian') {
      // 按住看窑变：一块天蓝釉面，按住时紫红从按下处慢慢晕开，交互见 assets/yaobian.js。
      // 版式和开片共用 .kaipian 那一套（册页裱法、提示、说明、再来一次），只换釉色和文字
      return '<figure class="kaipian yaobian" id="yaobian">' +
        (b.hint ? '<p class="kaipian-hint">' + esc(b.hint) + '<span class="kaipian-key">（或聚焦后按住空格）</span></p>' : '') +
        '<div class="kaipian-mount"><canvas class="kaipian-canvas" tabindex="0" role="img" aria-describedby="yaobian-cap"' +
        ' aria-label="一块天蓝色的釉面示意。按住釉面，或聚焦后按住空格、回车，紫红会从按下处慢慢晕开，松手就停；每一窑晕出来的颜色都不一样"></canvas></div>' +
        '<figcaption id="yaobian-cap"><span class="kaipian-cap">' + (b.caption || '').replace(/。(?=.)/g, '。|').split('|').map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</span>' +
        '<button type="button" class="kaipian-again">再烧一窑</button></figcaption></figure>';
    }
    if (b.type === 'figure') {
      // 册页式插图：月白裱边、细墨线、绢色画心，图下一行小字说明
      var src = PREFIX + 'assets/' + b.src;
      var set = b.small ? ' srcset="' + esc(PREFIX + 'assets/' + b.small) + ' 800w, ' + esc(src) + ' 1600w" sizes="(max-width: 760px) 92vw, 600px"' : '';
      return '<figure class="figure"><div class="figure-mount"><img src="' + esc(src) + '"' + set +
        (b.width ? ' width="' + b.width + '" height="' + b.height + '"' : '') +
        ' alt="' + esc(b.alt || '') + '" loading="lazy" decoding="async"></div>' +
        // 说明按句号分成几段，每段不在中间断行（窄屏上只在句子之间换行）
        (b.caption ? '<figcaption>' + b.caption.replace(/。(?=.)/g, '。|').split('|').map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '</figcaption>' : '') + '</figure>';
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

  /* 答三题：题目和答案都出自 story 原文（stations.js 的 quiz）。答对三题才盖印；答错可以重答，给一句提示 */
  var NUM = ['其一', '其二', '其三', '其四', '其五'];
  function quiz() {
    var qz = s.quiz;
    if (!qz || !qz.questions || !qz.questions.length) return '';
    return '<section class="st-quiz" id="quiz" aria-labelledby="quiz-title">' +
      '<h2 class="quiz-title" id="quiz-title">' + esc(qz.title || '答三题') + '</h2>' +
      '<div class="quiz-body">' +
      (qz.lead ? '<p class="quiz-lead">' + esc(qz.lead) + '</p>' : '') +
      '<ol class="quiz-list">' + qz.questions.map(function (q, i) {
        return '<li class="quiz-q" data-q="' + i + '">' +
          '<p class="quiz-ask" id="quiz-ask-' + i + '"><span class="quiz-num">' + (NUM[i] || (i + 1)) + '</span>' + esc(q.q) + '</p>' +
          '<div class="quiz-opts" role="group" aria-labelledby="quiz-ask-' + i + '">' + q.options.map(function (o, j) {
            return '<button type="button" class="quiz-opt" data-o="' + j + '">' + esc(o) + '</button>';
          }).join('') + '</div>' +
          '<p class="quiz-say" aria-live="polite"></p>' +
          '</li>';
      }).join('') + '</ol></div></section>';
  }

  var craft = window.TaishouCraftsman ? window.TaishouCraftsman.html(s.craftsman, PREFIX) : '';
  titleEl.innerHTML = title();
  acts.innerHTML = story() + craft + quiz() + end();
  C.renderFooter(PREFIX);

  var kp = document.getElementById('kaipian');
  if (kp && window.TaishouKaipian) window.TaishouKaipian.mount(kp, C.reducedMotion());
  var yb = document.getElementById('yaobian');
  if (yb && window.TaishouYaobian) window.TaishouYaobian.mount(yb, C.reducedMotion());

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

  /* 盖印：有 quiz 的站答对三题盖一次，没有 quiz 的站读到结尾盖一次；盖过的直接显示 */
  var stamp = document.getElementById('stamp');
  var note = document.getElementById('stamp-note');
  var endEl = document.getElementById('end');
  var pressed = false;

  function press(animate) {
    if (pressed) return;
    pressed = true;
    var saved = C.addSeal(s.id);
    stamp.classList.add(animate ? 'pressing' : 'pressed');
    if (saved) {
      note.innerHTML = '“' + esc(s.seal) + '”字朱印，已盖进文牒。<a class="stamp-go" href="' + PREFIX + 'index.html#wendie">看文牒</a>';
    } else {
      note.textContent = '印盖下了，但这个浏览器不允许保存，文牒里不会留下。';
    }
    // 手机轻轻一震（支持的设备才有，减少动效时不震）
    if (animate && navigator.vibrate) { try { navigator.vibrate(12); } catch (e) { /* 不支持就算了 */ } }
  }

  var quizEl = document.getElementById('quiz');
  if (quizEl) {
    var qs = s.quiz.questions;
    var right = {};
    if (C.hasSeal(s.id)) {
      // 以前已经盖过（答过题，或者在“读完就盖印”的旧版里盖的），题目显示成答过的样子
      qs.forEach(function (q, i) { right[i] = true; markRight(i, q.answer, false); });
      press(false);
    } else {
      note.textContent = '答对三题，盖下这一站的印。';
    }
    quizEl.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.quiz-opt') : null;
      if (!btn || btn.disabled) return;
      var li = btn.closest('.quiz-q');
      var i = +li.getAttribute('data-q'), j = +btn.getAttribute('data-o');
      if (right[i]) return;
      var say = li.querySelector('.quiz-say');
      if (j === qs[i].answer) {
        right[i] = true;
        markRight(i, j, true);
        var done = qs.every(function (q, k) { return right[k]; });
        if (done) {
          press(!C.reducedMotion());
          // 印就在题目下方，把它带进视野
          var r = endEl.getBoundingClientRect();
          if (r.top > window.innerHeight * 0.7) endEl.scrollIntoView({ behavior: C.reducedMotion() ? 'auto' : 'smooth', block: 'center' });
        }
      } else {
        btn.classList.add('is-wrong');
        btn.setAttribute('aria-pressed', 'false');
        say.textContent = '不太对。' + (qs[i].hint || '再读读上面的故事。');
      }
    });
  }

  function markRight(i, j, animate) {
    var li = quizEl.querySelector('.quiz-q[data-q="' + i + '"]');
    li.classList.add('is-right');
    if (animate) li.classList.add('just-right');
    Array.prototype.forEach.call(li.querySelectorAll('.quiz-opt'), function (b, k) {
      b.classList.remove('is-wrong');
      if (k === j) { b.classList.add('is-answer'); b.setAttribute('aria-pressed', 'true'); }
      else b.disabled = true;
    });
    li.querySelector('.quiz-say').textContent = '答对了。原文：' + (s.quiz.questions[i].basis || '');
  }

  if (quizEl) {
    // 答题决定盖不盖印，不再看读没读到结尾
  } else if (C.hasSeal(s.id)) {
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
