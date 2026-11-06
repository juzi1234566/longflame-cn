/* 匠人一章：大幅照片、竖排姓名和称号、一段口述引语、几件作品（编号、名称、这一件的烧制痕迹）。
 * 数据来自 stations.js 里站点的 craftsman 字段；没有 name 时返回空字符串，页面上不留任何占位。
 * 匠人必须是真人实拍、本人同意，原话要本人确认过才放。不编造任何人物、原话、作品。
 *
 * photo.placeholder 只给本地演示页 _demo/craftsman.html 用：画一块标着“示例”的灰色色块代替照片，正式数据不要用。
 */
(function () {
  'use strict';

  function esc(text) {
    return String(text == null ? '' : text).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function photo(p, prefix, cls, sizes) {
    if (!p) return '';
    if (p.placeholder) {
      return '<div class="' + cls + ' craft-ph" role="img" aria-label="' + esc(p.alt || '示例照片') + '"' +
        (p.width ? ' style="aspect-ratio: ' + p.width + ' / ' + p.height + '"' : '') +
        '><span>' + esc(p.placeholder) + '</span></div>';
    }
    if (!p.src) return '';
    return '<img class="' + cls + '" src="' + esc(prefix + 'assets/' + p.src) + '"' +
      (p.width ? ' width="' + p.width + '" height="' + p.height + '"' : '') +
      (sizes ? ' sizes="' + sizes + '"' : '') +
      ' alt="' + esc(p.alt || '') + '" loading="lazy" decoding="async">';
  }

  function lines(text) {
    return String(text || '').split('\n').map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('');
  }

  function html(c, prefix) {
    if (!c || !c.name) return '';
    prefix = prefix || '';
    var works = (c.works || []).filter(function (w) { return w && w.name; });
    return '<section class="st-craft" id="craftsman" aria-labelledby="craft-title">' +
      '<h2 class="craft-chapter" id="craft-title">匠人</h2>' +
      '<div class="craft-hero">' +
        '<figure class="craft-photo">' + photo(c.photo, prefix, 'craft-img') +
          (c.photo && c.photo.credit ? '<figcaption>' + esc(c.photo.credit) + '</figcaption>' : '') +
        '</figure>' +
        '<div class="craft-name">' +
          '<p class="craft-who">' + esc(c.name) + '</p>' +
          (c.title ? '<p class="craft-title">' + esc(c.title) + '</p>' : '') +
        '</div>' +
      '</div>' +
      (c.quote
        ? '<blockquote class="craft-quote"><p>' + lines(c.quote) + '</p>' +
          (c.quoteNote ? '<footer>' + esc(c.quoteNote) + '</footer>' : '') + '</blockquote>'
        : '') +
      (works.length
        ? '<div class="craft-works"><h3>作品</h3><ol>' + works.map(function (w) {
            return '<li class="craft-work">' + photo(w.photo, prefix, 'craft-work-img') +
              '<p class="craft-no">' + (w.no ? '编号 ' + esc(w.no) : '') + '</p>' +
              '<p class="craft-work-name">' + esc(w.name) + '</p>' +
              (w.marks ? '<p class="craft-marks"><span>烧制痕迹</span>' + esc(w.marks) + '</p>' : '') +
              '</li>';
          }).join('') + '</ol></div>'
        : '') +
      '</section>';
  }

  window.TaishouCraftsman = { html: html };
})();
