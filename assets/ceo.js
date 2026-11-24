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

  /* ---------- 互动探索：一盏灯，照见一门手艺 ---------- */
  (function () {
    var game = $('lantern-game'), facts = window.LANTERN_FACTS;
    if (!game || !facts || !facts.length) return;
    var stage = game.querySelector('.lantern-stage'), card = $('lantern-card'), carrier = game.querySelector('.lantern-carrier');
    var count = $('lantern-count'), finish = $('lantern-finish'), hint = $('lantern-hint'), meter = $('lantern-meter'), guide = $('lantern-guide');
    var found = {}, total = facts.length;
    var setLight = function (event) {
      var box = stage.getBoundingClientRect();
      var x = Math.max(0, Math.min(100, (event.clientX - box.left) / box.width * 100));
      var y = Math.max(0, Math.min(100, (event.clientY - box.top) / box.height * 100));
      stage.style.setProperty('--light-x', x + '%');
      stage.style.setProperty('--light-y', y + '%');
      stage.style.setProperty('--token-x', x + '%');
      stage.style.setProperty('--token-y', y + '%');
      if (carrier) carrier.classList.add('moving');
    };
    var render = function (id) {
      var item = null;
      for (var i = 0; i < facts.length; i++) if (facts[i].id === id) { item = facts[i]; break; }
      if (!item) return;
      var fresh = !found[id];
      found[id] = true;
      var n = Object.keys(found).length;
      card.innerHTML = '<p class="label">' + esc(item.eyebrow) + '</p><h2>' + esc(item.title) + '</h2><p>' + esc(item.text) + '</p><a href="' + esc(item.link) + '">' + esc(item.action) + ' ' + ARROW + '</a>';
      count.textContent = n;
      var spot = game.querySelector('[data-lantern-id="' + id + '"]');
      var progress = game.querySelector('[data-lantern-progress="' + id + '"]');
      if (spot) { spot.classList.add('found'); spot.setAttribute('aria-pressed', 'true'); }
      if (progress) { progress.classList.add('found'); var reviewButton = progress.querySelector('button'); if (reviewButton) reviewButton.disabled = false; }
      if (meter) meter.style.width = (n / total * 100) + '%';
      if (fresh) {
        stage.classList.remove('discovered');
        window.setTimeout(function () { stage.classList.add('discovered'); }, 10);
        window.setTimeout(function () { stage.classList.remove('discovered'); }, 820);
        var token = document.createElement('span');
        token.className = 'lantern-token-fly'; token.textContent = item.glyph || '灯';
        stage.appendChild(token);
        window.setTimeout(function () { if (token.parentNode) token.parentNode.removeChild(token); }, 950);
      }
      if (hint) hint.textContent = n === total ? '四处线索已点亮。' : '已点亮 ' + n + ' 条线索，再找找其余的微光。';
      if (finish) finish.hidden = n !== total;
    };
    stage.addEventListener('pointermove', setLight);
    stage.addEventListener('pointerdown', setLight);
    var spots = game.querySelectorAll('[data-lantern-id]');
    for (var i = 0; i < spots.length; i++) {
      spots[i].addEventListener('click', function (event) { setLight(event); render(this.getAttribute('data-lantern-id')); });
      spots[i].addEventListener('focus', function () { render(this.getAttribute('data-lantern-id')); });
    }
    var review = game.querySelectorAll('[data-lantern-review]');
    for (var r = 0; r < review.length; r++) review[r].addEventListener('click', function () { render(this.getAttribute('data-lantern-review')); });
    if (guide) guide.addEventListener('click', function () {
      var remaining = facts.filter(function (item) { return !found[item.id]; });
      if (!remaining.length) { if (hint) hint.textContent = '所有微光都已回应。可以重走一遍，或进入专题继续阅读。'; return; }
      var next = remaining[Math.floor(Math.random() * remaining.length)];
      var target = game.querySelector('[data-lantern-id="' + next.id + '"]');
      if (target) {
        target.classList.remove('guided');
        window.setTimeout(function () { target.classList.add('guided'); }, 10);
        window.setTimeout(function () { target.classList.remove('guided'); }, 1800);
      }
      if (hint) hint.textContent = '有一处微光比刚才更亮了一点。';
    });
    var reset = $('lantern-reset');
    var resetGame = function () {
      found = {}; count.textContent = '0';
      if (meter) meter.style.width = '0%';
      card.innerHTML = '<p>灯光落下之前，这里只有一片等待辨认的风土。</p>';
      if (hint) hint.textContent = '移动或轻触画面，寻找四处微光。';
      if (finish) finish.hidden = true;
      for (var j = 0; j < spots.length; j++) { spots[j].classList.remove('found'); spots[j].setAttribute('aria-pressed', 'false'); }
      var progress = game.querySelectorAll('[data-lantern-progress]');
      for (var k = 0; k < progress.length; k++) { progress[k].classList.remove('found'); var reviewButton = progress[k].querySelector('button'); if (reviewButton) reviewButton.disabled = true; }
      stage.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    if (reset) reset.addEventListener('click', resetGame);
    var again = $('lantern-again');
    if (again) again.addEventListener('click', resetGame);
  })();

  /* ---------- 美食地图互动游戏：山河食旅 ---------- */
  (function () {
    var game = $('food-journey'), stops = window.FOOD_JOURNEY;
    if (!game || !stops || !stops.length) return;
    var mapStops = game.querySelectorAll('[data-journey-stop]'), runes = game.querySelectorAll('[data-journey-rune]');
    var place = $('journey-place'), name = $('journey-name'), tone = $('journey-tone'), stamp = $('journey-stamp');
    var day = $('journey-day'), bag = $('journey-bag'), start = $('journey-start'), status = $('journey-status'), feast = $('journey-feast'), ending = $('journey-ending'), travel = $('journey-travel'), events = $('journey-events');
    var resources = { leaf: $('res-leaf'), spring: $('res-spring'), fire: $('res-fire'), craft: $('res-craft') };
    var key = 'longflame-food-journey-v2', state = { current: 0, done: {}, visits: {}, resources: { leaf: 0, spring: 0, fire: 0, craft: 0 }, ending: false }, pattern = [], input = [], phase = 'idle', timers = [];
    try {
      var saved = JSON.parse(localStorage.getItem(key) || 'null');
      if (saved && typeof saved.current === 'number' && saved.done && saved.visits && saved.resources) state = saved;
    } catch (e) {}
    var save = function () { try { localStorage.setItem(key, JSON.stringify(state)); } catch (e) {} };
    var clearTimers = function () { while (timers.length) window.clearTimeout(timers.pop()); };
    var current = function () { return stops[Math.min(state.current, stops.length - 1)]; };
    var setRunes = function (disabled) {
      var s = current();
      for (var i = 0; i < runes.length; i++) { runes[i].querySelector('span').textContent = s.runes[i]; runes[i].disabled = !!disabled; runes[i].classList.remove('pulse', 'good', 'wrong'); }
    };
    var eventMarkup = function (s) {
      if (state.visits[s.id] !== undefined) return '<p class="journey-event-done">已完成走访：' + esc(s.events[state.visits[s.id]][0]) + '</p>';
      return s.events.map(function (item, index) { return '<button type="button" data-journey-event="' + index + '"><b>' + esc(item[0]) + '</b><span>' + esc(item[1]) + '</span><i>收下 ' + item[3] + ' 份' + esc(item[2] === 'leaf' ? '茶芽' : item[2] === 'spring' ? '山泉' : '火候') + '</i></button>'; }).join('');
    };
    var render = function () {
      var s = current(), doneCount = Object.keys(state.done).length;
      place.textContent = '第' + (state.current + 1) + '站 · ' + s.province + s.city;
      name.textContent = s.name; tone.textContent = s.tone; stamp.textContent = s.tag; day.textContent = ('0' + (state.current + 1)).slice(-2);
      for (var i = 0; i < mapStops.length; i++) {
        var button = mapStops[i], id = button.getAttribute('data-journey-stop');
        button.classList.toggle('unlocked', i <= state.current); button.classList.toggle('active', i === state.current); button.classList.toggle('done', !!state.done[id]);
        button.setAttribute('aria-current', i === state.current ? 'step' : 'false');
      }
      for (var keyName in resources) resources[keyName].textContent = state.resources[keyName] || 0;
      bag.innerHTML = stops.filter(function (item) { return state.done[item.id]; }).map(function (item) { return '<li>' + esc(item.city) + '</li>'; }).join('');
      feast.disabled = doneCount !== stops.length; ending.hidden = !state.ending;
      events.innerHTML = eventMarkup(s);
      start.disabled = state.ending || !!state.done[s.id] || state.visits[s.id] === undefined;
      start.textContent = state.ending ? '茶席已成' : (state.done[s.id] ? '本地茶笺已收齐' : '前往识香工坊');
      travel.hidden = !state.done[s.id] || state.current >= stops.length - 1 || state.ending;
      phase = 'idle'; input = []; setRunes(true);
      status.textContent = state.ending ? '四张茶笺已备齐。回到地图继续下一条路线吧。' : (state.done[s.id] ? '这一站的茶笺已收入行囊，准备向下一站启程。' : state.visits[s.id] === undefined ? '先选择一种走访方式，准备这一站的茶事。' : '走访完成。前往工坊，复现这一站的茶事节奏。');
    };
    var pulse = function (index, delay) {
      timers.push(window.setTimeout(function () { var rune = runes[index]; rune.classList.add('pulse'); timers.push(window.setTimeout(function () { rune.classList.remove('pulse'); }, 420)); }, delay));
    };
    var begin = function () {
      if (state.ending || state.done[current().id] || state.visits[current().id] === undefined) return;
      clearTimers(); input = []; phase = 'watch'; setRunes(true);
      pattern = [0, 1, 2].sort(function () { return Math.random() - .5; });
      status.textContent = '灯语正在闪现，请记住它的顺序。';
      for (var i = 0; i < pattern.length; i++) pulse(pattern[i], 430 + i * 820);
      timers.push(window.setTimeout(function () { phase = 'play'; setRunes(false); status.textContent = '轮到你了：按刚才的节奏，依次触碰三枚线索。'; }, 430 + pattern.length * 820));
    };
    var complete = function () {
      var s = current(); state.done[s.id] = true; state.resources.craft += 1;
      save(); render();
      status.textContent = state.current < stops.length - 1 ? '茶笺与技艺印记已收入行囊，现在可以启程前往下一站。' : '四张茶笺齐备，现在可以筹办江南茶席。';
    };
    for (var i = 0; i < runes.length; i++) runes[i].addEventListener('click', function () {
      if (phase !== 'play') return;
      var index = +this.getAttribute('data-journey-rune');
      if (index === pattern[input.length]) {
        input.push(index); this.classList.add('good');
        if (input.length === pattern.length) { phase = 'idle'; timers.push(window.setTimeout(complete, 420)); }
      } else {
        this.classList.add('wrong'); input = []; status.textContent = '灯语散开了，再听一遍它的节奏。';
        phase = 'idle'; timers.push(window.setTimeout(function () { setRunes(true); }, 420));
      }
    });
    for (var j = 0; j < mapStops.length; j++) mapStops[j].addEventListener('click', function () {
      var index = stops.map(function (item) { return item.id; }).indexOf(this.getAttribute('data-journey-stop'));
      if (index >= 0 && index <= state.current) { clearTimers(); state.current = index; save(); render(); }
    });
    events.addEventListener('click', function (event) {
      var target = event.target.closest('[data-journey-event]'); if (!target || state.visits[current().id] !== undefined) return;
      var choice = +target.getAttribute('data-journey-event'), item = current().events[choice];
      state.visits[current().id] = choice; state.resources[item[2]] += item[3]; save(); render();
      status.textContent = '走访已完成。你收下了旅途素材，可以进入识香工坊。';
    });
    start.addEventListener('click', begin);
    travel.addEventListener('click', function () { if (state.done[current().id] && state.current < stops.length - 1) { state.current += 1; save(); render(); } });
    $('journey-reset').addEventListener('click', function () { clearTimers(); state = { current: 0, done: {}, visits: {}, resources: { leaf: 0, spring: 0, fire: 0, craft: 0 }, ending: false }; save(); render(); });
    feast.addEventListener('click', function () { if (!feast.disabled) { state.ending = true; save(); render(); ending.scrollIntoView({ behavior: 'smooth', block: 'center' }); } });
    render();
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
    var search = $('food-q'), clearSearch = $('food-search-clear'), searchStatus = $('food-search-status');
    var region = $('food-region'), category = $('food-category'), batch = $('food-batch'), resetFilters = $('food-filter-reset');
    var favoritesToggle = $('favorites-toggle'), favoritesCount = $('favorites-count');
    var detailDialog = $('food-dialog'), detailBody = $('food-dialog-body'), detailClose = $('food-dialog-close');
    var favoritesDialog = $('favorites-dialog'), favoritesBody = $('favorites-dialog-body'), favoritesClose = $('favorites-dialog-close');
    var compareDialog = $('compare-dialog'), compareBody = $('compare-dialog-body'), compareClose = $('compare-dialog-close');
    var todayBox = $('food-today'), randomBox = $('food-random'), randomButton = $('food-random-button');
    var routeSelect = $('route-provinces'), routeCount = $('route-count'), routeButton = $('route-generate'), routeResult = $('route-result'), routeChosen = [];
    var flavor = '', query = '', selectedRegion = '', selectedCategory = '', selectedBatch = '', current = null;
    var favoriteKey = 'taishou-food-favorites-v1', favorites = {}, byId = {}, compared = [];
    var allItems = [];
    Object.keys(PROVS).forEach(function (prov) {
      (PROVS[prov].items || []).forEach(function (item) { byId[String(item.id)] = item; allItems.push(item); });
    });
    try { favorites = JSON.parse(window.localStorage.getItem(favoriteKey) || '{}') || {}; } catch (e) { favorites = {}; }
    var saveFavorites = function () { try { window.localStorage.setItem(favoriteKey, JSON.stringify(favorites)); } catch (e) { /* 不可用时仍可在本次浏览中收藏 */ } };
    var isFavorite = function (id) { return !!favorites[String(id)]; };
    var matches = function (x) {
      var text = (x.n + ' ' + x.r + ' ' + x.f + ' ' + x.c).toLowerCase();
      return (!flavor || x.f === flavor) && (!query || text.indexOf(query) >= 0) &&
        (!selectedRegion || x.p0 === selectedRegion) && (!selectedCategory || x.c === selectedCategory) &&
        (!selectedBatch || x.b === selectedBatch);
    };
    var itemsOf = function (prov) {
      var list = (PROVS[prov] || { items: [] }).items;
      return list.filter(matches);
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
      var h = '<div class="panel-head"><div><p class="panel-eyebrow">风味落点 · ' + esc(short) + '</p><h2>' + esc(current) + '</h2></div><p>' + (list.length ? numSpan(list.length) + ' 子项' : '') + '</p>' +
        (group && list.length ? '<a href="#' + group.id + '">看完整清单 ↓</a>' : '') + '</div>';
      if (!list.length) { panel.innerHTML = h + '<p class="panel-empty">当前筛选下暂未收录；可切换到“全部风味”继续探索。</p>'; return; }
      var picks = list.slice(0, 3);
      panel.innerHTML = h + '<ul class="map-food-cards">' + picks.map(function (x) {
        var photo = x.p ? '<img src="' + esc(x.p) + '" alt="' + esc(x.n) + '（AI 演绎）" width="480" height="480" loading="lazy">' : (x.g ? '<img src="' + esc(x.g[0]) + '" alt="' + esc(x.g[1]) + '" width="240" height="180" loading="lazy">' : '<span>暂无配图</span>');
        var isCompared = compared.indexOf(String(x.id)) >= 0;
        return '<li><div class="map-food-img ph r11">' + photo + '</div><div><p class="map-food-type">' + esc(x.f) + '</p><h3>' + esc(x.n) + '</h3><p class="r">' + esc(x.r) + '</p><p class="map-card-actions"><button type="button" class="food-detail" data-food-id="' + esc(x.id) + '">查看详情</button><button type="button" class="food-favorite" data-food-id="' + esc(x.id) + '" aria-pressed="' + (isFavorite(x.id) ? 'true' : 'false') + '">' + (isFavorite(x.id) ? '已收藏' : '收藏') + '</button><button type="button" class="food-compare" data-food-id="' + esc(x.id) + '" aria-pressed="' + (isCompared ? 'true' : 'false') + '">对比</button></p><a class="src" href="' + esc(x.u) + '" target="_blank" rel="noopener">官方资料 ' + ARROW + '</a></div></li>';
      }).join('') + '</ul>' + (list.length > picks.length ? '<p class="panel-more">本省还有 ' + numSpan(list.length - picks.length) + ' 项，可在完整清单中继续浏览。</p>' : '');
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
      var resultTotal = 0;
      [].forEach.call(document.querySelectorAll('.ms-group'), function (g) {
        var n = 0;
        [].forEach.call(g.querySelectorAll('.ms-card'), function (c) {
          var show = (!flavor || c.dataset.flavor === flavor) && (!query || (c.dataset.search || '').toLowerCase().indexOf(query) >= 0) &&
            (!selectedRegion || c.dataset.province === selectedRegion) && (!selectedCategory || c.dataset.category === selectedCategory) &&
            (!selectedBatch || c.dataset.batch === selectedBatch);
          c.hidden = !show; if (show) { n++; resultTotal++; }
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
      if (searchStatus) {
        var parts = [];
        if (query) parts.push('“' + (search ? search.value.trim() : query) + '”');
        if (flavor) parts.push(flavor);
        if (selectedRegion) parts.push(selectedRegion);
        if (selectedCategory) parts.push(selectedCategory);
        if (selectedBatch) parts.push(selectedBatch);
        searchStatus.hidden = !parts.length;
        searchStatus.textContent = parts.length ? '筛选 “' + parts.join(' · ') + '”：找到 ' + resultTotal + ' 项' : '';
      }
    };
    var syncFavoriteButtons = function () {
      [].forEach.call(document.querySelectorAll('.food-favorite[data-food-id]'), function (button) {
        var active = isFavorite(button.dataset.foodId);
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        button.textContent = active ? '已收藏' : '收藏';
      });
      if (favoritesCount) favoritesCount.textContent = Object.keys(favorites).length;
    };
    var syncCompareButtons = function () {
      [].forEach.call(document.querySelectorAll('.food-compare[data-food-id]'), function (button) {
        var active = compared.indexOf(String(button.dataset.foodId)) >= 0;
        button.setAttribute('aria-pressed', active ? 'true' : 'false');
        button.textContent = active ? '已选入对比' : '对比';
      });
    };
    var refresh = function () {
      if (resetFilters) resetFilters.hidden = !(query || flavor || selectedRegion || selectedCategory || selectedBatch);
      paintTiles(); paintPanel(); paintList(); syncFavoriteButtons(); syncCompareButtons();
    };
    var toggleFavorite = function (id) {
      id = String(id);
      if (isFavorite(id)) delete favorites[id]; else favorites[id] = 1;
      saveFavorites(); syncFavoriteButtons(); paintPanel();
      if (favoritesDialog && favoritesDialog.open) renderFavorites();
    };
    var imageFor = function (x) {
      if (x.p) return '<figure><div class="ph r11"><img src="' + esc(x.p) + '" alt="' + esc(x.n) + '（AI 演绎）" width="480" height="480"></div><figcaption>AI 演绎</figcaption></figure>';
      if (x.g) return '<figure><div class="ph r43"><img src="' + esc(x.g[0]) + '" alt="' + esc(x.g[1]) + '" width="480" height="360"></div><figcaption>' + esc(x.g[2]) + '</figcaption></figure>';
      return '<div class="food-dialog-no-image">暂无配图</div>';
    };
    var showDetails = function (id) {
      var x = byId[String(id)];
      if (!x || !detailDialog || !detailBody) return;
      detailBody.innerHTML = '<p class="food-dialog-eyebrow">非遗美食档案 · ' + esc(x.f) + '</p><h2 id="food-dialog-title">' + esc(x.n) + '</h2>' +
        '<div class="food-dialog-grid">' + imageFor(x) + '<div><dl class="food-dialog-info"><div><dt>申报地区</dt><dd>' + esc(x.r) + '</dd></div><div><dt>名录门类</dt><dd>' + esc(x.c) + '</dd></div><div><dt>入选批次</dt><dd>' + esc(x.b) + (x.y ? ' · ' + esc(x.y) + '年' : '') + '</dd></div><div><dt>项目类型</dt><dd>' + (x.e ? '扩展项目' : '新增项目') + '</dd></div></dl>' +
        '<div class="food-dialog-actions"><button type="button" class="food-favorite" data-food-id="' + esc(x.id) + '" aria-pressed="' + (isFavorite(x.id) ? 'true' : 'false') + '">' + (isFavorite(x.id) ? '已收藏' : '收藏') + '</button><a href="' + esc(x.u) + '" target="_blank" rel="noopener">查看官方资料 ' + ARROW + '</a></div></div></div>';
      if (typeof detailDialog.showModal === 'function') detailDialog.showModal(); else detailDialog.setAttribute('open', 'open');
      syncFavoriteButtons();
    };
    var brief = function (x) { return '<h3>' + esc(x.n) + '</h3><p>' + esc(x.p0) + ' · ' + esc(x.f) + '</p>'; };
    var showQuick = function (box, x, lead) {
      if (!box || !x) return;
      box.innerHTML = '<p class="quick-lead">' + esc(lead) + '</p>' + brief(x) + '<button type="button" class="food-detail" data-food-id="' + esc(x.id) + '">去看看 ' + ARROW + '</button>';
    };
    var showCompare = function () {
      if (compared.length < 2 || !compareBody) return;
      var picks = compared.map(function (id) { return byId[id]; }).filter(Boolean);
      var rows = [['地区', 'p0'], ['申报地区', 'r'], ['风味', 'f'], ['官方门类', 'c'], ['入选批次', 'b']];
      compareBody.innerHTML = '<p class="food-dialog-eyebrow">并排阅读</p><h2 id="compare-dialog-title">两项美食的档案对比</h2><div class="compare-table"><div class="compare-head"><span></span>' + picks.map(function (x) { return '<strong>' + esc(x.n) + '</strong>'; }).join('') + '</div>' + rows.map(function (row) { return '<div><b>' + row[0] + '</b>' + picks.map(function (x) { return '<span>' + esc(x[row[1]]) + '</span>'; }).join('') + '</div>'; }).join('') + '</div>';
      if (typeof compareDialog.showModal === 'function') compareDialog.showModal(); else compareDialog.setAttribute('open', 'open');
    };
    var toggleCompare = function (id) {
      id = String(id); var pos = compared.indexOf(id);
      if (pos >= 0) { compared.splice(pos, 1); syncCompareButtons(); paintPanel(); return; }
      if (compared.length >= 2) { compared.shift(); }
      compared.push(id); syncCompareButtons(); paintPanel();
      if (compared.length === 2) showCompare();
    };
    var renderFavorites = function () {
      if (!favoritesBody) return;
      var picks = allItems.filter(function (x) { return isFavorite(x.id); });
      favoritesBody.innerHTML = '<p class="food-dialog-eyebrow">浏览器本地保存</p><h2 id="favorites-dialog-title">我的收藏</h2>' +
        (picks.length ? '<ul class="favorites-list">' + picks.map(function (x) { return '<li><div><h3>' + esc(x.n) + '</h3><p>' + esc(x.p0) + ' · ' + esc(x.r) + ' · ' + esc(x.f) + '</p></div><div><button type="button" class="food-detail" data-food-id="' + esc(x.id) + '">详情</button><button type="button" class="food-favorite" data-food-id="' + esc(x.id) + '" aria-pressed="true">已收藏</button></div></li>'; }).join('') + '</ul>' : '<p class="favorites-empty">还没有收藏。看到感兴趣的项目，点“收藏”就会保存在这台设备上。</p>');
      syncFavoriteButtons();
    };
    tiles.forEach(function (t) { t.addEventListener('click', function () { select(t.dataset.prov); }); });
    chips.forEach(function (c) {
      c.addEventListener('click', function () {
        flavor = c.dataset.flavor || '';
        chips.forEach(function (x) { x.setAttribute('aria-pressed', x === c ? 'true' : 'false'); });
        refresh();
      });
    });
    if (search) {
      var updateSearch = function () {
        query = search.value.trim().toLowerCase();
        if (clearSearch) clearSearch.hidden = !query;
        refresh();
      };
      search.addEventListener('input', updateSearch);
      if (search.form) search.form.addEventListener('submit', function (e) { e.preventDefault(); updateSearch(); });
      if (clearSearch) clearSearch.addEventListener('click', function () { search.value = ''; updateSearch(); search.focus(); });
    }
    [region, category, batch].forEach(function (filter) { if (filter) filter.addEventListener('change', function () {
      selectedRegion = region ? region.value : ''; selectedCategory = category ? category.value : ''; selectedBatch = batch ? batch.value : ''; refresh();
    }); });
    if (resetFilters) resetFilters.addEventListener('click', function () {
      flavor = ''; query = ''; selectedRegion = ''; selectedCategory = ''; selectedBatch = '';
      if (search) search.value = ''; if (region) region.value = ''; if (category) category.value = ''; if (batch) batch.value = '';
      chips.forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.flavor ? 'false' : 'true'); });
      if (clearSearch) clearSearch.hidden = true; refresh();
    });
    if (favoritesToggle) favoritesToggle.addEventListener('click', function () { renderFavorites(); if (favoritesDialog && typeof favoritesDialog.showModal === 'function') favoritesDialog.showModal(); else if (favoritesDialog) favoritesDialog.setAttribute('open', 'open'); });
    if (detailClose) detailClose.addEventListener('click', function () { detailDialog.close ? detailDialog.close() : detailDialog.removeAttribute('open'); });
    if (favoritesClose) favoritesClose.addEventListener('click', function () { favoritesDialog.close ? favoritesDialog.close() : favoritesDialog.removeAttribute('open'); });
    if (compareClose) compareClose.addEventListener('click', function () { compareDialog.close ? compareDialog.close() : compareDialog.removeAttribute('open'); });
    if (randomButton) randomButton.addEventListener('click', function () { showQuick(randomBox, allItems[Math.floor(Math.random() * allItems.length)], '一口打开陌生的风土。'); });
    if (todayBox && allItems.length) {
      var now = new Date(), day = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) / 86400000;
      showQuick(todayBox, allItems[Math.abs(day) % allItems.length], '每天一项，今天从这里出发。');
    }
    if (routeSelect) [].forEach.call(routeSelect.querySelectorAll('[data-route-prov]'), function (button) { button.addEventListener('click', function () {
      var prov = button.dataset.routeProv, at = routeChosen.indexOf(prov);
      if (at >= 0) routeChosen.splice(at, 1); else if (routeChosen.length < 4) routeChosen.push(prov); else { if (routeResult) routeResult.innerHTML = '<p>最多选择 4 个地区。</p>'; return; }
      [].forEach.call(routeSelect.querySelectorAll('[data-route-prov]'), function (x) { x.setAttribute('aria-pressed', routeChosen.indexOf(x.dataset.routeProv) >= 0 ? 'true' : 'false'); });
      if (routeCount) routeCount.textContent = routeChosen.length;
    }); });
    if (routeButton) routeButton.addEventListener('click', function () {
      var chosen = routeChosen.slice();
      if (chosen.length < 2 || chosen.length > 4) { routeResult.innerHTML = '<p>请选择 2—4 个地区。</p>'; return; }
      var names = chosen.map(function (p) { return (PROVS[p] || {}).s || p; });
      var items = chosen.map(function (p) { return (PROVS[p] || { items: [] }).items.filter(matches)[0]; }).filter(Boolean);
      routeResult.innerHTML = '<p class="route-title">' + esc(names.join(' · ')) + ' 漫游线</p><ol>' + items.map(function (x) { return '<li><button type="button" class="food-detail" data-food-id="' + esc(x.id) + '">' + esc(x.n) + '</button></li>'; }).join('') + '</ol>';
    });
    [].forEach.call(document.querySelectorAll('[data-story-flavor]'), function (button) { button.addEventListener('click', function () {
      flavor = button.dataset.storyFlavor; chips.forEach(function (x) { x.setAttribute('aria-pressed', x.dataset.flavor === flavor ? 'true' : 'false'); }); refresh(); box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }); });
    document.addEventListener('click', function (e) {
      var target = e.target.closest && e.target.closest('[data-food-id]');
      if (!target) return;
      if (target.classList.contains('food-detail')) { showDetails(target.dataset.foodId); }
      if (target.classList.contains('food-favorite')) { toggleFavorite(target.dataset.foodId); }
      if (target.classList.contains('food-compare')) { toggleCompare(target.dataset.foodId); }
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
    if (!current && panel.dataset.default && PROVS[panel.dataset.default]) select(panel.dataset.default, true);
    refresh();
    /* 中国省级地图：本地 GeoJSON 转为可点击的 SVG，避免依赖第三方脚本。 */
    var renderChinaMap = function (geo) {
      if (!geo || !geo.features || !box) return;
      var minLon = 73.5, maxLon = 135.1, minLat = 18, maxLat = 54.5, w = 720, h = 510, ox = 10, oy = 10;
      var alias = { '台湾省': '台湾', '香港特别行政区': '香港', '澳门特别行政区': '澳门' };
      var project = function (p) { return [ox + (p[0] - minLon) / (maxLon - minLon) * w, oy + (maxLat - p[1]) / (maxLat - minLat) * h]; };
      var ring = function (points) { return points.map(function (p, i) { var q = project(p); return (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join('') + 'Z'; };
      var shape = function (g) {
        var parts = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
        return parts.map(function (poly) { return poly.map(ring).join(''); }).join('');
      };
      var center = function (g) {
        var points = [], take = function (x) { if (typeof x[0] === 'number') points.push(x); else x.forEach(take); }; take(g.coordinates);
        var sum = points.reduce(function (a, p) { a[0] += p[0]; a[1] += p[1]; return a; }, [0, 0]); return project([sum[0] / points.length, sum[1] / points.length]);
      };
      var markup = '';
      geo.features.forEach(function (feature) {
        var prov = alias[feature.properties.name] || feature.properties.name;
        if (!PROVS[prov]) return;
        var c = center(feature.geometry), short = PROVS[prov].s || prov;
        markup += '<path class="tile' + ((PROVS[prov].items || []).length ? '' : ' empty') + '" d="' + shape(feature.geometry) + '" fill-rule="evenodd" data-prov="' + esc(prov) + '" data-short="' + esc(short) + '" data-r="' + c[1].toFixed(1) + '" data-c="' + c[0].toFixed(1) + '" role="button" tabindex="0" aria-pressed="false"><title>' + esc(short) + '</title></path>';
        markup += '<text class="map-province-label" x="' + c[0].toFixed(1) + '" y="' + c[1].toFixed(1) + '" text-anchor="middle">' + esc(short) + '</text>';
      });
      box.innerHTML = markup;
      tiles = [].slice.call(box.querySelectorAll('.tile')); grid = tiles;
      tiles.forEach(function (t) { t.addEventListener('click', function () { select(t.dataset.prov); }); });
      paintTiles();
      if (current) select(current, true);
    };
    if (window.fetch) fetch('assets/china-provinces.geojson').then(function (r) { return r.ok ? r.json() : null; }).then(renderChinaMap).catch(function () {
      box.innerHTML = '<text x="370" y="270" text-anchor="middle" class="map-loading">地图暂未载入，请刷新后重试。</text>';
    });
  })();

  /* ---------- 门类馆：按地区、关键词、排序浏览项目档案库 ---------- */
  (function () {
    var sel = $('arch-prov'), list = $('arch-list'), query = $('arch-q'), sort = $('arch-sort');
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
    var card = function (p, entries) {
      var places = [], seen = {};
      entries.forEach(function (e) { if (!seen[e[2]]) { seen[e[2]] = true; places.push(e[2]); } });
      var placeText = places.slice(0, 3).join(' · ') + (places.length > 3 ? ' 等 ' + places.length + ' 地' : '');
      var subHtml = entries.map(function (e) {
        return '<li>' + (e[0] !== p.t ? '<b>' + esc(e[0]) + '</b>' : '') + '<span class="r">' + esc(e[1]) + '</span><span class="m">' + batchOf(e[3], e[4]) + ' · ' + (e[5] ? '扩展项目' : '新增项目') + '</span>' +
          '<a class="src" href="' + esc(e[6]) + '" target="_blank" rel="noopener" aria-label="' + esc(e[0] + '（' + e[1] + '）在中国非物质文化遗产网的页面') + '">官方页 ' + ARROW + '</a></li>';
      }).join('');
      var fig = p.g ? '<figure class="pj-fig"><div class="ph r11"><img src="../' + esc(p.g[0]) + '" alt="' + esc(p.t) + ' ' + esc(p.g[1]) + '" width="480" height="480" loading="lazy"></div></figure>' : '<div class="pj-empty" aria-hidden="true"><span>' + esc(p.n) + '</span></div>';
      return '<li class="pj"><article class="pj-card">' + fig + '<div class="pj-b"><div class="pj-top"><span class="pj-num">' + esc(p.n) + '</span><span class="pj-count">' + numSpan(entries.length) + ' 项子项目</span></div><h3>' + esc(p.t) + '</h3><p class="pj-places">' + esc(placeText) + '</p><details class="pj-detail"><summary>展开档案明细<span>' + numSpan(entries.length) + ' 条</span></summary><ul class="pj-subs">' + subHtml + '</ul></details></div></article></li>';
    };
    var reset = function () {
      list.innerHTML = original; result.hidden = true; result.innerHTML = '';
      if (pager) pager.hidden = false; if (range) range.hidden = false;
    };
    var render = function () {
      var prov = sel.value, q = (query ? query.value : '').trim().toLowerCase(), order = sort ? sort.value : '';
      if (!prov && !q && !order) {
        reset();
        return;
      }
      if (!window.YJ || !window.YJ[hall]) return;
      var subs = 0;
      var rows = window.YJ[hall].filter(function (p) {
        var text = (p.t + ' ' + p.e.map(function (e) { return e[0] + ' ' + e[1] + ' ' + e[2]; }).join(' ')).toLowerCase();
        return (!prov || p.e.some(function (e) { return e[2] === prov; })) && (!q || text.indexOf(q) !== -1);
      });
      if (order === 'entries') rows.sort(function (a, b) { return b.e.length - a.e.length || a.t.localeCompare(b.t, 'zh-Hans-CN'); });
      if (order === 'name') rows.sort(function (a, b) { return a.t.localeCompare(b.t, 'zh-Hans-CN'); });
      var html = rows.map(function (p) {
        var es = prov ? p.e.filter(function (e) { return e[2] === prov; }) : p.e;
        subs += es.length;
        return card(p, es);
      }).join('');
      list.innerHTML = html || '<li class="arch-empty">未找到匹配的项目，请换一个关键词或地区。</li>';
      result.hidden = false;
      result.innerHTML = (prov ? esc(prov) + ' · ' : '') + '找到 ' + numSpan(rows.length) + ' 项、' + numSpan(subs) + ' 子项目<button type="button" id="arch-clear">清除筛选</button>';
      $('arch-clear').addEventListener('click', function () { sel.value = ''; if (query) query.value = ''; if (sort) sort.value = ''; reset(); if (query) query.focus(); });
      if (pager) pager.hidden = true; if (range) range.hidden = true;
    };
    var requestRender = function () { load(render); };
    sel.addEventListener('change', requestRender);
    if (sort) sort.addEventListener('change', requestRender);
    if (query) query.addEventListener('input', requestRender);
    if (sel.value || (query && query.value) || (sort && sort.value)) requestRender();
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

  /* ---------- 十大雅集：雅集拾笺 ---------- */
  (function () {
    var root = $('yaji-draw'), data = window.YAJI_DRAW_CARDS;
    if (!root || !data || !data.length) return;
    var box = $('yaji-draw-cards'), result = $('yaji-draw-result'), refresh = $('yaji-draw-refresh'), count = $('yaji-draw-count');
    var store = 'longflame-yaji-collection-v1', seen = [], choices = [], opened = false;
    try { seen = JSON.parse(window.localStorage.getItem(store) || '[]'); } catch (e) { seen = []; }
    if (!Array.isArray(seen)) seen = [];
    var save = function () { try { window.localStorage.setItem(store, JSON.stringify(seen)); } catch (e) {} };
    var paintCount = function () { if (count) count.textContent = seen.length; };
    var shuffle = function (arr) {
      var copy = arr.slice();
      for (var i = copy.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp; }
      return copy;
    };
    var cardFace = function (item, index) {
      return '<button type="button" class="yaji-draw-card" data-yaji-card="' + esc(item.id) + '" aria-label="翻开第 ' + (index + 1) + ' 张雅集笺">'
        + '<span class="yaji-draw-card-inner"><span class="yaji-draw-card-back"><i>雅</i><b>拾笺</b><em>' + (index + 1) + '</em></span>'
        + '<span class="yaji-draw-card-front"><img src="' + esc(item.cover) + '" alt="" width="800" height="600"><i>' + esc(item.cat) + '</i><b>' + esc(item.name) + '</b></span></span></button>';
    };
    var resetResult = function () {
      result.innerHTML = '<p class="label">等待翻笺</p><h3 class="hv">哪一门手艺，先与你相见？</h3><p>每次会呈现三张不同门类笺。选择后可将它留在本机的雅集册中。</p>';
    };
    var deal = function () {
      choices = shuffle(data).slice(0, Math.min(3, data.length)); opened = false;
      box.innerHTML = choices.map(cardFace).join(''); resetResult();
      [].forEach.call(box.querySelectorAll('[data-yaji-card]'), function (button) { button.addEventListener('click', function () { reveal(button.dataset.yajiCard, button); }); });
    };
    var reveal = function (id, button) {
      if (opened) return;
      var item = data.filter(function (x) { return String(x.id) === String(id); })[0];
      if (!item) return;
      opened = true; button.classList.add('is-open');
      [].forEach.call(box.querySelectorAll('[data-yaji-card]'), function (x) { if (x !== button) x.classList.add('is-rest'); x.disabled = true; });
      var fresh = seen.indexOf(item.id) < 0;
      result.innerHTML = '<p class="label">' + (fresh ? '新入一笺' : '已在雅集册中') + '</p><h3 class="hv">' + esc(item.name) + '</h3><p class="yaji-draw-kind">' + esc(item.cat) + ' · ' + numSpan(item.count) + ' 项 / ' + numSpan(item.subitems) + ' 子项</p><p>从“' + esc((item.examples || []).join('、')) + '”等项目，进入这间门类馆的档案脉络。</p><div class="yaji-draw-actions"><button type="button" data-yaji-keep="' + esc(item.id) + '"' + (fresh ? '' : ' disabled') + '>' + (fresh ? '入藏此笺' : '已入藏') + '</button><a href="' + esc(item.href) + '">走入此馆</a></div>';
      var keep = result.querySelector('[data-yaji-keep]');
      if (keep) keep.addEventListener('click', function () { if (seen.indexOf(item.id) >= 0) return; seen.push(item.id); save(); paintCount(); keep.disabled = true; keep.textContent = '已入藏'; result.querySelector('.label').textContent = '已收入雅集册'; });
    };
    if (refresh) refresh.addEventListener('click', deal);
    paintCount(); deal();
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
