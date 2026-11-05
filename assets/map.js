/*
 * 山河图：分层图片的长卷。美术全部来自 map-config.js 配置的图片，这里只管交互。
 * 没有国界、省界、轮廓、海岸线；站点位置只是画面上的位置。
 */
(function () {
  'use strict';

  var C = window.TaishouCommon;
  var DATA = window.TAISHOU;
  var CONFIG = window.TAISHOU_MAP;
  var INTRO_KEY = 'taishou.intro.seen';
  var IMAGE_WAIT_MS = 4000; // 图再慢也不让人一直等在空白的绢上
  var reduced = C.reducedMotion();
  var GLINT = typeof CONFIG.glint === 'number' ? CONFIG.glint : 1; // 河面碎光浓度，见 map-config.js

  var stations = DATA.stations.slice().sort(function (a, b) { return a.order - b.order; });
  var openStations = stations.filter(function (s) { return s.status === 'open'; });
  var current = openStations[openStations.length - 1];

  var $ = function (id) { return document.getElementById(id); };
  var camera = $('camera'), scroller = $('scroller'), world = $('world');
  var planes = { back: $('plane-back'), front: $('plane-front') };

  var VW = 0, VH = 0, W = 0, WH = 0, WT = 0; // 视口宽高；长卷（中山）宽高；长卷顶边在屏幕上的位置（裁掉的部分为负）
  var parallaxLayers = [], worldLayers = [];

  function rng(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 低配判断：省流量或内存不大于 2GB
  function lowEnd() {
    var conn = navigator.connection;
    return !!((conn && conn.saveData) || (navigator.deviceMemory && navigator.deviceMemory <= 2));
  }
  function useSmall() { return window.innerWidth < 768 || lowEnd(); }

  /* ---------- 尺寸 ---------- */
  function measure() {
    VW = window.innerWidth; VH = window.innerHeight;
    // 高度铺满；超宽屏时放大，保证还能左右走
    WH = Math.max(VH, (VW * (CONFIG.minScroll || 1.2)) / CONFIG.worldAspect);
    W = WH * CONFIG.worldAspect;
    world.style.width = W + 'px';
    world.style.height = WH + 'px';
    // 长卷比屏幕高时：先裁顶上的天空，最多裁到 maxTopCrop（长卷高度的比例），再多的从底下裁。
    // 没配 maxTopCrop 就全裁天空、底边对齐。画的下半截是空雾时配上它，宽屏横屏时村子不会被挤到屏幕顶上
    var cropK = VH <= 480 && CONFIG.maxTopCropShort != null ? CONFIG.maxTopCropShort : CONFIG.maxTopCrop; // 横屏手机矮，多裁一点天空，村子和题字不碰页脚
    var extra = WH - VH, capTop = cropK == null ? Infinity : cropK * WH;
    WT = -Math.min(extra, capTop);
    world.style.marginTop = WT + 'px';
  }

  function layoutLayer(l) {
    var el = l.el, cfg = l.cfg;
    if (cfg.anchor === 'current') {
      var size = (cfg.size || 1) * WH;
      el.style.width = el.style.height = size + 'px';
      el.style.left = (current.map.x / 100 * W - size / 2) + 'px';
      el.style.top = (current.map.y / 100 * WH - size / 2) + 'px';
      return;
    }
    if (cfg.plane === 'world') {
      el.style.width = W + 'px'; el.style.height = WH + 'px';
      return;
    }
    var h = WH, w = h * cfg.aspect;
    if (reduced) { w = W; }                         // 减少动态：所有层同速，不做视差
    else if (w < VW * 1.02) { w = VW * 1.02; h = w / cfg.aspect; }
    el.style.width = w + 'px'; el.style.height = h + 'px';
    el.style.top = (WT + WH - h) + 'px'; // 和长卷底边对齐（长卷底下被裁时一起裁）
    // 图从头走到尾时，长卷也正好从头走到尾；首屏这一刻，各层在亮站处严丝合缝
    var maxS = Math.max(0, W - VW), maxX = Math.max(0, w - VW);
    var s0 = clamp(focusLeft(current), 0, maxS);
    var c = current.map.x / 100 * W - s0;
    l.s0 = s0; l.maxS = maxS; l.maxX = maxX;
    l.x0 = clamp(current.map.x / 100 * w - c, 0, maxX);
  }

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- 图层 ---------- */
  function loadLayers() {
    var small = useSmall(), skipOptional = lowEnd();
    var anchorNode = $('route');
    water.loadMask();
    var waits = [];
    CONFIG.layers.forEach(function (cfg) {
      if (cfg.optional && skipOptional) return;
      var src = (small && cfg.small) || cfg.image;
      if (!src) return;
      var img = new Image();
      img.alt = '';
      img.decoding = 'async';
      img.draggable = false;
      img.className = 'layer-img';
      if (cfg.blend) img.style.mixBlendMode = cfg.blend;
      var el = img;
      if (cfg.drift && !reduced) {
        el = document.createElement('div');
        el.className = 'drift';
        el.appendChild(img);
      }
      el.classList.add('layer', 'layer--' + cfg.id);
      if (cfg.plane === 'world') world.insertBefore(el, anchorNode);
      else planes[cfg.plane].appendChild(el);
      var entry = { cfg: cfg, el: el, f: 1 };
      layoutLayer(entry);
      (cfg.plane === 'world' ? worldLayers : parallaxLayers).push(entry);

      var wait = new Promise(function (resolve) {
        img.onload = function () {
          var show = function () {
            img.classList.add('loaded'); resolve();
            if (cfg.id === 'river') water.image(img); // 没有水面蒙版时，波光从河流图里取位置
          };
          if (img.decode) img.decode().then(show, show); else show();
        };
        // 这一层坏了就不显示，其他层和站点照常工作
        img.onerror = function () { el.remove(); resolve(); if (cfg.id === 'river') water.fallback(); };
      });
      if (!cfg.optional) waits.push(wait);
      img.src = src;
    });
    return Promise.all(waits);
  }

  /* ---------- 路线、暗点、站点 ---------- */
  function px(s) { return [s.map.x / 100 * W, s.map.y / 100 * WH]; }

  function buildRoute() {
    var svg = $('route');
    svg.setAttribute('width', W); svg.setAttribute('height', WH);
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + WH);
    if ((CONFIG.route || {}).hidden) { svg.innerHTML = ''; water.setRoute([], 0, []); return; } // 只开一站时不画路线
    var placed = stations.filter(function (s) { return s.map; });
    var pts = placed.map(px);
    function toPx(p) { return [p[0] / 100 * W, p[1] / 100 * WH]; }
    function smooth(p) { // 穿过每个点的平滑曲线
      var out = '';
      for (var k = 0; k < p.length - 1; k++) {
        var p0 = p[k - 1] || p[k], p1 = p[k], p2 = p[k + 1], p3 = p[k + 2] || p2;
        out += ' C' + (p1[0] + (p2[0] - p0[0]) / 6).toFixed(1) + ' ' + (p1[1] + (p2[1] - p0[1]) / 6).toFixed(1) +
          ' ' + (p2[0] - (p3[0] - p1[0]) / 6).toFixed(1) + ' ' + (p2[1] - (p3[1] - p1[1]) / 6).toFixed(1) +
          ' ' + p2[0].toFixed(1) + ' ' + p2[1].toFixed(1);
      }
      return out;
    }
    var d = '';
    for (var i = 0; i < pts.length; i++) {
      if (!i) { d = 'M' + pts[0][0] + ' ' + pts[0][1]; continue; }
      var a = pts[i - 1], b = pts[i];
      // 配了 via 就沿这些点走（比如沿河），否则拐一个弯
      if (placed[i].via) { d += smooth([a].concat(placed[i].via.map(toPx), [b])); continue; }
      var dx = b[0] - a[0], dy = b[1] - a[1];
      var bend = i % 2 ? 1 : -1;
      // 两个控制点把路线拐一个弯，像山路
      d += ' C' + (a[0] + dx * 0.32 - dy * 0.1) + ' ' + (a[1] + dy * 0.1 + bend * Math.abs(dx) * 0.17) +
           ' ' + (a[0] + dx * 0.7 + dy * 0.1) + ' ' + (a[1] + dy * 0.85 - bend * Math.abs(dx) * 0.13) +
           ' ' + b[0] + ' ' + b[1];
    }
    svg.innerHTML = '<path d="' + d + '"/>';

    // 沿路径点一串小墨点：大小、间距、浓淡都带一点随机，偶尔缺一点，像笔尖蘸墨点下去
    var path = svg.firstChild, L = 0;
    try { L = path.getTotalLength(); } catch (e) { L = 0; }
    var RC = CONFIG.route || {}, RS = RC.size || 1, RG = RC.gap || 1; // 点的大小、间距倍数，按画面在 map-config.js 调
    var k = WH / 900, r = rng(77), s = 1.5 * k, dots = [], html = '';
    while (L && s < L) {
      var p = path.getPointAtLength(s);
      var near = 0.82 + 0.36 * clamp((p.y / WH - 0.46) / 0.36, 0, 1); // 近处的点稍大稍疏
      var dot = { x: p.x, y: p.y, s: s, r: (0.6 + r() * 0.32) * k * near * RS, o: 0.55 + r() * 0.45 };
      if (r() > 0.05) dots.push(dot);
      s += (5.8 + r() * 2.4) * k * near * RG;
    }
    dots.forEach(function (q) {
      html += '<circle cx="' + q.x.toFixed(1) + '" cy="' + q.y.toFixed(1) + '" r="' + q.r.toFixed(2) + '"/>';
    });
    svg.insertAdjacentHTML('beforeend', html);
    water.setRoute(dots, L, Array.prototype.slice.call(svg.querySelectorAll('circle')));
  }

  /* ---------- 河面波光（WebGL） ---------- */
  // 每个像素按“流向图”把细碎的横向碎光往下游推。两套相位交替淡入淡出，碎光一边漂一边生灭；
  // 疏密再由一层更大、更慢的图案控制，也顺着河往下走，所以河面是一片一片亮着往下游流，不会整层一起明暗。
  // 碎光只长在河流图的亮水面上，越亮越密；离镜头越近，碎光越大。窑火下方那段水面带一点暖色倒影。
  // 不支持 WebGL、精度不够，或者 GPU 上下文丢失时，返回 null 或调用 onLost，由 2D 光点接手。
  var GL_VS = 'attribute vec2 aPos;varying vec2 vUv;' +
    'void main(){vUv=vec2(aPos.x*.5+.5,.5-aPos.y*.5);gl_Position=vec4(aPos,0.,1.);}';
  var GL_FS = [
    'precision highp float;',
    'varying vec2 vUv;',
    'uniform sampler2D uRiver,uFlow;',
    'uniform float uT1,uT2,uFade,uGain;',   // 两套周期的计数，各自在 128 个周期处回绕，回绕那一刻画面不跳
    'uniform vec4 uBox,uTex;',   // 画布、纹理在长卷上的范围：x,y,宽,高（单位：长卷高度=1）
    'uniform vec3 uWarm;',       // 窑火倒影：x,y,强度
    // 不用 sin 的哈希，手机 GPU 上也稳定
    'vec2 h2(vec2 p){vec3 q=fract(vec3(p.xyx)*vec3(.1031,.1030,.0973));q+=dot(q,q.yzx+33.33);return fract((q.xx+q.yz)*q.zy)*2.-1.;}',
    'float gn(vec2 p){vec2 i=floor(p),f=fract(p),u=f*f*(3.-2.*f);',
    ' return mix(mix(dot(h2(i),f),dot(h2(i+vec2(1,0)),f-vec2(1,0)),u.x),mix(dot(h2(i+vec2(0,1)),f-vec2(0,1)),dot(h2(i+vec2(1,1)),f-vec2(1,1)),u.x),u.y);}',
    // 碎光：横向拉长的细斑。水面是斜着看的，反光都是扁的
    'float glint(vec2 q,vec2 o,float th){vec2 s=(q+o)*vec2(.17,.9);',
    ' float n=gn(s)*.72+gn(s*vec2(2.1,1.7)+o.yx)*.28;',
    ' float g=smoothstep(.07+th,.30+th,n);return g*g*(3.-2.*g);}',
    // 疏密：大片、慢，决定哪一段水正亮着
    'float dens(vec2 q,vec2 o){float n=gn((q+o)*vec2(.0105,.032))*.75+gn((q+o.yx)*vec2(.024,.07))*.25;return smoothstep(-.28,.26,n);}',
    // 水面上的柔光：比碎光宽、淡，让亮水面有一层在动的光泽
    'float sheen(vec2 q,vec2 o){return smoothstep(.0,.55,gn((q+o)*vec2(.021,.085)));}',
    'void main(){',
    ' vec2 P=uBox.xy+vUv*uBox.zw;',
    ' vec2 t=(P-uTex.xy)/uTex.zw;',
    ' if(t.x<0.||t.y<0.||t.x>1.||t.y>1.){gl_FragColor=vec4(0.);return;}',
    ' vec4 rv=texture2D(uRiver,t);',   // r：是不是水，g：水有多亮
    ' float m=rv.r,br=rv.g;',
    ' if(m<.01){gl_FragColor=vec4(0.);return;}',
    ' float th=(1.-br)*.09;',          // 暗水面上碎光更少
    ' vec2 dir=texture2D(uFlow,t).rg*2.-1.;',
    // 近大远小只作用在纵向：横向坐标要是也跟着 y 缩放，图案会被剪切成一道道斜线。
    // 纵向用 1/near 的积分，近处的碎光更高更疏，远处更扁更密
    ' float near=.55+.9*clamp((P.y-.38)/.48,0.,1.);',
    ' float Fy=P.y<.38?(P.y-.38)/.55:(P.y>.86?log(1.45/.55)/1.875+(P.y-.86)/1.45:log(near/.55)/1.875);',
    ' vec2 q=vec2(P.x*1000.,Fy*900.);',
    // 碎光：周期 2.8 秒，每个周期顺流漂 14 个单位（约每秒 5 像素）。漂得短、慢，拐弯处不会被拉成弧线
    ' float T=uT1,f0=fract(T),f1=fract(T+.5),w0=1.-abs(2.*f0-1.),w1=1.-w0;',
    ' vec2 d=dir*14.;',
    ' float g=(w0*glint(q-d*f0,vec2(13.7,-4.1)+mod(floor(T),128.)*vec2(31.3,17.9),th)+w1*glint(q-d*f1,vec2(-7.3,9.9)+mod(floor(T+.5),128.)*vec2(23.1,41.7),th))/sqrt(w0*w0+w1*w1);',
    // 疏密和柔光：周期 20 秒，漂得更远，一段段地往下游亮过去
    ' float U2=uT2,e0=fract(U2),e1=fract(U2+.5),v0=1.-abs(2.*e0-1.),v1=1.-v0;',
    ' vec2 D=dir*70.;',
    ' vec2 o0=mod(floor(U2),128.)*vec2(57.1,13.3),o1=mod(floor(U2+.5),128.)*vec2(19.7,71.9)+vec2(400.,200.);',
    ' float de=v0*dens(q-D*e0,o0)+v1*dens(q-D*e1,o1);',
    ' float sh=v0*sheen(q-D*e0,o0)+v1*sheen(q-D*e1,o1);',
    ' float a=m*(g*(.06+.94*de*de)*mix(.40,1.,br)*1.5+sh*de*mix(.03,.11,br))*uGain*uFade;',
    ' vec2 dw=(P-uWarm.xy)/vec2(.13,.055);',
    ' float wm=uWarm.z*exp(-dot(dw,dw));',
    ' vec3 c=mix(vec3(1.,.975,.93),vec3(1.,.70,.42),wm);',
    ' a=min(a,.95);',
    ' gl_FragColor=vec4(c*a,a);',
    '}'
  ].join('\n');

  function makeGLWater(cv, onLost) {
    if (!cv || !window.WebGLRenderingContext) return null;
    var opts = { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    var gl = null;
    try { gl = cv.getContext('webgl', opts) || cv.getContext('experimental-webgl', opts); } catch (e) { gl = null; }
    if (!gl) return null;
    var hp = gl.getShaderPrecisionFormat && gl.getShaderPrecisionFormat(gl.FRAGMENT_SHADER, gl.HIGH_FLOAT);
    if (!hp || hp.precision < 16) return null;  // 没有高精度，噪声会出条纹，不如用 2D

    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var vs = sh(gl.VERTEX_SHADER, GL_VS), fs = sh(gl.FRAGMENT_SHADER, GL_FS);
    if (!vs || !fs) return null;
    var prog = gl.createProgram();
    gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
    gl.useProgram(prog);
    var buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    var U = {};
    ['uRiver', 'uFlow', 'uT1', 'uT2', 'uFade', 'uGain', 'uBox', 'uTex', 'uWarm'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    gl.uniform1i(U.uRiver, 0); gl.uniform1i(U.uFlow, 1);
    var maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
    var maxVp = (gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [4096])[0];
    var alive = true, dpr = 1, t0 = 0;

    function tex(unit, source, w, h, data) {
      var t = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0 + unit);
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
      if (data) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
      else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    cv.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      if (!alive) return;
      alive = false;
      cv.style.display = 'none';
      if (onLost) onLost();
    });

    return {
      // img：水面蒙版（r 是水、g 是亮度），或者退而求其次的河流图（kind 为 'river'，用透明通道和亮度换算）
      // box：河的范围 [x0,y0,x1,y1]，0 到 1；dirAt(x,y) 给出该处下游方向（长卷高度=1）
      init: function (img, kind, box, A, dirAt) {
        try {
          var nw = img.naturalWidth, nh = img.naturalHeight;
          var sx = box[0] * nw, sy = box[1] * nh, sw = (box[2] - box[0]) * nw, sh2 = (box[3] - box[1]) * nh;
          var tw = Math.min(maxTex, useSmall() ? 1600 : 2400, Math.ceil(sw));
          var th = Math.max(2, Math.round(tw * sh2 / sw));
          var c = document.createElement('canvas'); c.width = tw; c.height = th;
          var cg = c.getContext('2d', { willReadFrequently: kind === 'river' });
          cg.drawImage(img, sx, sy, sw, sh2, 0, 0, tw, th);
          if (kind === 'river') {
            var id = cg.getImageData(0, 0, tw, th), q = id.data;
            for (var n = 0; n < q.length; n += 4) {
              var lum = (q[n] + q[n + 1] + q[n + 2]) / 765, al = q[n + 3] / 255;
              q[n] = al * 255; q[n + 1] = clamp((lum - 0.3) / 0.56, 0, 1) * 255; q[n + 2] = 0; q[n + 3] = 255;
            }
            cg.putImageData(id, 0, 0);
          }
          tex(0, c);
          // 流向图：小尺寸就够，方向本来就是平滑的。线性插值时不会出硬边
          var fw = 320, fh = Math.max(8, Math.round(fw * (box[3] - box[1]) / ((box[2] - box[0]) * A)));
          var dx = new Float32Array(fw * fh), dy = new Float32Array(fw * fh), i, j;
          for (j = 0; j < fh; j++) for (i = 0; i < fw; i++) {
            var d = dirAt((box[0] + (i + 0.5) / fw * (box[2] - box[0])) * A, box[1] + (j + 0.5) / fh * (box[3] - box[1]));
            dx[j * fw + i] = d[0]; dy[j * fw + i] = d[1];
          }
          // 糊开：拐弯、两段河道挨着的地方方向变化要缓，否则漂动会把碎光拉成细弧线。
          // 横竖各做三遍半径 4 格的方框模糊，约等于 7 格的高斯
          var blur1 = function (src, horiz) {
            var out = new Float32Array(fw * fh), R = 4, n = 2 * R + 1;
            for (var j2 = 0; j2 < fh; j2++) for (var i2 = 0; i2 < fw; i2++) {
              var acc = 0;
              for (var o = -R; o <= R; o++) {
                var ii2 = horiz ? clamp(i2 + o, 0, fw - 1) : i2, jj2 = horiz ? j2 : clamp(j2 + o, 0, fh - 1);
                acc += src[jj2 * fw + ii2];
              }
              out[j2 * fw + i2] = acc / n;
            }
            return out;
          };
          for (var pass = 0; pass < 3; pass++) {
            dx = blur1(blur1(dx, true), false); dy = blur1(blur1(dy, true), false);
          }
          var px8 = new Uint8Array(fw * fh * 4);
          for (i = 0; i < fw * fh; i++) {
            var l = Math.hypot(dx[i], dy[i]) || 1, s = Math.pow(Math.min(1, l * 1.1), 2); // 方向打架的地方慢下来
            px8[i * 4] = Math.round((dx[i] / l * s * 0.5 + 0.5) * 255);
            px8[i * 4 + 1] = Math.round((dy[i] / l * s * 0.5 + 0.5) * 255);
            px8[i * 4 + 2] = 0; px8[i * 4 + 3] = 255;
          }
          tex(1, null, fw, fh, px8);
          gl.uniform4f(U.uTex, box[0] * A, box[1], (box[2] - box[0]) * A, box[3] - box[1]);
          gl.uniform3f(U.uWarm, current.map.x / 100 * A, current.map.y / 100 + 0.045, 0.3); // 窑火在水里的一点暖色
          gl.uniform1f(U.uGain, GLINT);
          gl.enable(gl.BLEND);
          gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
          return !gl.getError();
        } catch (e) { return false; } // 跨域、读不到像素等，交给 2D
      },
      layout: function (bx, by, bw, bh) {
        if (!alive) return;
        dpr = Math.min(window.devicePixelRatio || 1, useSmall() ? 1.5 : 2);
        dpr = Math.min(dpr, maxVp / bw, maxVp / bh, 4096 / bw);
        cv.width = Math.max(1, Math.round(bw * dpr)); cv.height = Math.max(1, Math.round(bh * dpr));
        cv.style.left = bx + 'px'; cv.style.top = by + 'px';
        cv.style.width = bw + 'px'; cv.style.height = bh + 'px';
        gl.viewport(0, 0, cv.width, cv.height);
        gl.uniform4f(U.uBox, bx / WH, by / WH, bw / WH, bh / WH);
      },
      // x0、x1：画布里看得见的那一段（CSS 像素）。只画这一段，省电
      draw: function (now, x0, x1) {
        if (!alive) return;
        if (!t0) t0 = now;
        var a = Math.max(0, Math.floor(x0 * dpr)), b = Math.min(cv.width, Math.ceil(x1 * dpr));
        gl.enable(gl.SCISSOR_TEST);
        gl.scissor(0, 0, cv.width, cv.height);
        gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
        if (b <= a) return;
        gl.scissor(a, 0, b - a, cv.height);
        gl.uniform1f(U.uT1, (now / 2800) % 128);   // 碎光 2.8 秒一个周期
        gl.uniform1f(U.uT2, (now / 20000) % 128);  // 疏密 20 秒一个周期
        var f = clamp((now - t0) / 3000, 0, 1);
        gl.uniform1f(U.uFade, reduced ? 1 : f * f * (3 - 2 * f));
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      },
      alive: function () { return alive; }
    };
  }

  /* ---------- 河面波光，路上的太守 ---------- */
  // 只盖住河谷的 canvas，放在长卷里，滑动时和河锁在一起，不会错位。
  // 有 WebGL 时，河面碎光交给上面的 makeGLWater；这张 2D canvas 只画太守在路上的暖光。
  // 没有 WebGL 时退回 2D 光点：位置取水面蒙版（越亮的水越容易闪），每一点只亮一两秒，顺着河道中线往下游漂一小段；
  // 再叠两道很慢的、往下游走的明暗起伏，所以整条河是一段一段地亮过去，不是整层一起呼吸。
  // 减少动态时只画一帧，静止。
  var water = (function () {
    var cv = $('water');
    var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
    var TAU = Math.PI * 2, A = CONFIG.worldAspect;
    var segs = [];                    // 河道中线折线段，单位：长卷高度 = 1
    var cand = null, nCand = 0, total = 0, cell = 0;
    var mask = null, MW = 0, MH = 0;  // 河面亮度，路线用来避开亮水面
    var bbox = null;                  // 河的范围，归一化
    var parts = [], sprite = null, ember = null;
    var dots = [], circles = [], routeL = 0;
    var bx = 0, by = 0, bw = 0, bh = 0, dpr = 1;
    var raf = 0, last = 0, ready = false, moteStart = 0;
    var viewLeft = 0;
    var glw = null;                   // WebGL 水面；没有就用 2D 光点
    var ROUTE_OP = (CONFIG.route && CONFIG.route.opacity) || 0.6; // 路线小点的浓度上限
    var maskKind = '';
    var glCanvas = $('water-gl');

    // 河道中线：上游到下游，累计里程
    (CONFIG.flow || []).forEach(function (line) {
      for (var i = 0; i < line.length - 1; i++) {
        var ax = line[i][0] / 100 * A, ay = line[i][1] / 100, bx2 = line[i + 1][0] / 100 * A, by2 = line[i + 1][1] / 100;
        var dx = bx2 - ax, dy = by2 - ay, len = Math.hypot(dx, dy) || 1e-6;
        segs.push({ ax: ax, ay: ay, dx: dx, dy: dy, len: len, s0: segs.length ? segs[segs.length - 1].s0 + segs[segs.length - 1].len : 0 });
      }
    });
    function nearest(x, y) {
      var best = null, bd = 1e9, bt = 0;
      for (var i = 0; i < segs.length; i++) {
        var g = segs[i], t = clamp(((x - g.ax) * g.dx + (y - g.ay) * g.dy) / (g.len * g.len), 0, 1);
        var ex = g.ax + g.dx * t - x, ey = g.ay + g.dy * t - y, dd = ex * ex + ey * ey;
        if (dd < bd) { bd = dd; best = g; bt = t; }
      }
      if (!best) return [1, 0, x];
      return [best.dx / best.len, best.dy / best.len, best.s0 + bt * best.len];
    }

    function makeSprites() {
      // 横向的细光斑：中心实，边缘很快化开。水面是斜着看的，反光都是扁的
      sprite = document.createElement('canvas'); sprite.width = 64; sprite.height = 16;
      var g = sprite.getContext('2d');
      g.setTransform(4, 0, 0, 1, 0, 0);
      var gr = g.createRadialGradient(8, 8, 0, 8, 8, 8);
      gr.addColorStop(0, 'rgba(255,249,236,1)'); gr.addColorStop(0.28, 'rgba(255,244,226,.8)');
      gr.addColorStop(0.6, 'rgba(255,236,212,.18)'); gr.addColorStop(1, 'rgba(255,236,212,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 16, 16);
      ember = document.createElement('canvas'); ember.width = ember.height = 32;
      g = ember.getContext('2d');
      gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
      gr.addColorStop(0, 'rgba(255,214,160,1)'); gr.addColorStop(0.18, 'rgba(255,176,104,.55)');
      gr.addColorStop(0.5, 'rgba(236,120,60,.12)'); gr.addColorStop(1, 'rgba(236,120,60,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    }

    // 波光的位置优先取水面蒙版（map-config.js 的 water），没有或加载失败就取河流图
    var riverImg = null, maskState = CONFIG.water ? 'loading' : 'failed', riverFailed = false;
    function loadMask() {
      if (maskState !== 'loading' || !ctx) return;
      var img = new Image();
      img.decoding = 'async';
      img.onload = function () { maskState = 'ok'; if (!ready) fromImage(img, 'mask'); };
      img.onerror = function () {
        maskState = 'failed';
        if (ready) return;
        var hasRiver = CONFIG.layers.some(function (l) { return l.id === 'river'; });
        if (riverImg) fromImage(riverImg, 'river'); else if (riverFailed || !hasRiver) fallback();
      };
      img.src = (useSmall() && CONFIG.water.small) || CONFIG.water.image;
    }

    // 取候选点。file:// 打开时浏览器不让读像素，就退回沿中线撒点
    function fromImage(img, kind) {
      maskKind = kind;
      MW = useSmall() ? 760 : 1088; MH = Math.round(MW / A);
      var data = null;
      try {
        var c = document.createElement('canvas'); c.width = MW; c.height = MH;
        var g = c.getContext('2d', { willReadFrequently: true });
        g.drawImage(img, 0, 0, MW, MH);
        data = g.getImageData(0, 0, MW, MH).data;
      } catch (e) { data = null; }
      if (!data) return fallback();
      mask = new Float32Array(MW * MH);
      var xs = [], ys = [], ws = [], x0 = 1, x1 = 0, y0 = 1, y1 = 0;
      for (var j = 0; j < MH; j++) {
        for (var i = 0; i < MW; i++) {
          var n = j * MW + i, a, lum;
          if (kind === 'mask') { a = data[n * 4] / 255; lum = data[n * 4 + 1] / 255; }
          else { a = data[n * 4 + 3] / 255; lum = (data[n * 4] + data[n * 4 + 1] + data[n * 4 + 2]) / 765; }
          if (a < 0.03) continue;
          mask[n] = a * lum;
          var u = (i + 0.5) / MW, v = (j + 0.5) / MH;
          if (u < x0) x0 = u; if (u > x1) x1 = u; if (v < y0) y0 = v; if (v > y1) y1 = v; // 暗水面也要盖住
          var w = Math.pow(a, 1.6) * lum * lum;
          if (w < 0.03) continue;
          xs.push(u * A); ys.push(v); ws.push(w);
        }
      }
      if (!xs.length) return fallback();
      cell = 1 / MH;
      bbox = [x0, y0, x1, y1];
      glw = makeGLWater(glCanvas, glLost);
      if (glw && !glw.init(img, kind, bbox, A, nearest)) glw = null;
      if (!glw && glCanvas) glCanvas.style.display = 'none';
      build(xs, ys, ws);
    }
    function fallback() {
      mask = null;
      if (glCanvas) glCanvas.style.display = 'none';
      var xs = [], ys = [], ws = [], r = rng(5), x0 = 1, x1 = 0, y0 = 1, y1 = 0;
      segs.forEach(function (g) {
        for (var t = 0; t < g.len; t += 0.0015) {
          var off = (r() - 0.5) * 0.012;
          var x = g.ax + g.dx * t / g.len - g.dy / g.len * off, y = g.ay + g.dy * t / g.len + g.dx / g.len * off;
          xs.push(x); ys.push(y); ws.push(0.5);
          x0 = Math.min(x0, x / A); x1 = Math.max(x1, x / A); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
        }
      });
      if (!xs.length) return;
      cell = 0.003;
      bbox = [x0, y0, x1, y1];
      build(xs, ys, ws);
    }
    function build(xs, ys, ws) {
      nCand = xs.length;
      cand = { x: new Float32Array(xs), y: new Float32Array(ys), w: new Float32Array(ws), cum: new Float32Array(nCand), tx: new Float32Array(nCand), ty: new Float32Array(nCand), s: new Float32Array(nCand) };
      var acc = 0;
      for (var i = 0; i < nCand; i++) {
        acc += cand.w[i]; cand.cum[i] = acc;
        var f = nearest(cand.x[i], cand.y[i]);
        cand.tx[i] = f[0]; cand.ty[i] = f[1]; cand.s[i] = f[2];
      }
      total = acc;
      makeSprites();
      ready = true;
      layout();
      dimRoute();
      if (!glw) spawnParts();
      if (reduced) draw(performance.now(), true); else start();
    }
    function spawnParts() {
      var now = performance.now();
      var N = Math.round(clamp(W * 0.12, 160, 480) * (lowEnd() ? 0.6 : 1));
      parts = [];
      for (var p = 0; p < N; p++) { parts.push({}); spawn(parts[p], now, true); }
    }
    function glLost() { // GPU 上下文丢了：换回 2D 光点，不黑屏
      glw = null;
      if (ready) { spawnParts(); if (reduced) draw(performance.now(), true); }
    }
    function pick() {
      var t = Math.random() * total, lo = 0, hi = nCand - 1;
      while (lo < hi) { var mid = (lo + hi) >> 1; if (cand.cum[mid] < t) lo = mid + 1; else hi = mid; }
      return lo;
    }
    function spawn(p, now, initial) {
      var k = pick(), r = Math.random();
      p.x = cand.x[k] + (Math.random() - 0.5) * cell; p.y = cand.y[k] + (Math.random() - 0.5) * cell;
      p.tx = cand.tx[k]; p.ty = cand.ty[k]; p.s = cand.s[k];
      p.w = Math.min(1, 0.35 + cand.w[k] * 1.4);
      p.life = 0.7 + r * r * 2.1;                      // 秒。多数一闪即过，少数停得久一点
      p.t0 = now + (initial ? -Math.random() * p.life * 1000 : Math.random() * 600);
      p.sp = 0.002 + Math.random() * 0.005;            // 每秒漂多远，单位长卷高度。慢
      p.len = 1.3 + Math.pow(Math.random(), 2.2) * 3.4;
      p.peak = 0.3 + Math.random() * 0.7;
      p.tw = Math.random() < 0.3 ? 5 + Math.random() * 9 : 0; // 三成会抖一两下
      p.ph = Math.random() * TAU;
    }
    // 两道很慢的明暗起伏，顺着里程往下游走
    function wave(s, t) {
      var a = 0.5 + 0.5 * Math.sin(TAU * (s / 0.21 - t / 8.5));
      var b = 0.5 + 0.5 * Math.sin(TAU * (s / 0.083 - t / 4.7) + 1.9);
      var m = 0.62 * a + 0.38 * b;
      return 0.22 + 0.78 * m * m;
    }

    function layout() {
      if (!ctx || !bbox) return;
      // 河的范围 + 路线的范围，四周留一点
      var x0 = bbox[0], y0 = bbox[1], x1 = bbox[2], y1 = bbox[3];
      dots.forEach(function (q) { x0 = Math.min(x0, q.x / W); x1 = Math.max(x1, q.x / W); y0 = Math.min(y0, q.y / WH); y1 = Math.max(y1, q.y / WH); });
      var pad = 0.012;
      bx = Math.max(0, Math.floor((x0 - pad / A) * W)); by = Math.max(0, Math.floor((y0 - pad) * WH));
      bw = Math.min(W, Math.ceil((x1 + pad / A) * W)) - bx; bh = Math.min(WH, Math.ceil((y1 + pad) * WH)) - by;
      dpr = Math.min(window.devicePixelRatio || 1, useSmall() ? 1.25 : 1.5);
      cv.width = Math.round(bw * dpr); cv.height = Math.round(bh * dpr);
      cv.style.left = bx + 'px'; cv.style.top = by + 'px';
      cv.style.width = bw + 'px'; cv.style.height = bh + 'px';
      if (glw) glw.layout(bx, by, bw, bh);
      if (reduced && ready) draw(performance.now(), true);
    }

    function maskAt(x, y) { // 世界坐标 px。河流图只有高光，取周围 3×3 里最亮的；水面蒙版本身是软边，取一点就够
      if (!mask) return 0;
      var i = Math.round(x / W * MW), j = Math.round(y / WH * MH), m = 0, R = maskKind === 'mask' ? 0 : 1;
      for (var dj = -R; dj <= R; dj++) for (var di = -R; di <= R; di++) {
        var ii = i + di, jj = j + dj;
        if (ii >= 0 && jj >= 0 && ii < MW && jj < MH) m = Math.max(m, mask[jj * MW + ii]);
      }
      return m;
    }
    function dimRoute() {
      dots.forEach(function (q, n) {
        var t = clamp((maskAt(q.x, q.y) - 0.1) / 0.3, 0, 1);
        q.dim = 1 - 0.86 * t * t * (3 - 2 * t);   // 压在亮水面上的点几乎隐去
        if (circles[n]) circles[n].setAttribute('fill-opacity', (ROUTE_OP * q.o * q.dim).toFixed(3));
      });
    }
    function setRoute(d, L, els) {
      dots = d; routeL = L; circles = els;
      dots.forEach(function (q, n) { q.dim = 1; if (circles[n]) circles[n].setAttribute('fill-opacity', (ROUTE_OP * q.o).toFixed(3)); });
      if (ready) { layout(); dimRoute(); }
    }

    function draw(now, still) {
      if (!ctx || !ready) return;
      var t = now / 1000, k = WH / 900;
      var wx0 = 0, wx1 = bw;
      if (!still) { wx0 = clamp(viewLeft - bx - VW * 0.15, 0, bw); wx1 = clamp(viewLeft - bx + VW * 1.15, 0, bw); }
      if (glw) glw.draw(now, wx0, wx1);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(wx0, 0, wx1 - wx0, bh);
      if (wx1 <= wx0) return;
      ctx.globalCompositeOperation = 'lighter';
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i], age = (now - p.t0) / 1000;
        if (age < 0) continue;
        if (age >= p.life) { if (!still) spawn(p, now, false); continue; }
        var X = p.x + p.tx * p.sp * age, Y = p.y + p.ty * p.sp * age;
        var px = X * WH - bx, py = Y * WH - by;
        if (px < wx0 - 8 || px > wx1 + 8) continue;
        var e = Math.sin(Math.PI * age / p.life); e = e * e * e;
        var a = p.peak * e * p.w * wave(p.s + p.sp * age, t) * GLINT;
        if (p.tw) a *= 0.62 + 0.38 * Math.sin(t * p.tw + p.ph);
        if (a < 0.015) continue;
        var near = 0.5 + 0.9 * clamp((Y - 0.38) / 0.48, 0, 1);
        var lw = p.len * near * k, lh = clamp(lw * 0.3, 0.55, 1.3) * k;
        ctx.globalAlpha = Math.min(1, a);
        ctx.drawImage(sprite, px - lw, py - lh, lw * 2, lh * 2);
      }
      ctx.globalCompositeOperation = 'source-over';
      if (!still && moteStart && dots.length) drawMote(now, k);
      ctx.globalAlpha = 1;
    }

    // 太守在路上：一点很淡的暖光沿路线慢慢走，身后几颗点被带亮，再慢慢暗回去。走完歇一会儿再走
    function drawMote(now, k) {
      var speed = 34 * k, rest = 6, trail = 90 * k;
      var period = routeL / speed + rest;
      var pos = (((now - moteStart) / 1000) % period) * speed;
      if (pos > routeL + trail) return;
      var fade = clamp(pos / (70 * k), 0, 1) * clamp((routeL - pos) / (90 * k), 0, 1);
      for (var i = 0; i < dots.length; i++) {
        var q = dots[i], b = pos - q.s;
        if (b < 0) break;
        if (b > trail) continue;
        var f = 1 - b / trail;
        var a = 0.5 * f * f * q.dim * clamp(pos / (70 * k), 0, 1);
        if (a < 0.01) continue;
        ctx.globalAlpha = a;
        ctx.fillStyle = '#FFB27A';
        ctx.beginPath(); ctx.arc(q.x - bx, q.y - by, q.r * 1.12, 0, TAU); ctx.fill();
      }
      if (pos > routeL || fade <= 0) return;
      // 头：在两颗点之间插值
      var j = 1;
      while (j < dots.length && dots[j].s < pos) j++;
      var q0 = dots[j - 1], q1 = dots[Math.min(j, dots.length - 1)];
      var u = q1.s > q0.s ? clamp((pos - q0.s) / (q1.s - q0.s), 0, 1) : 0;
      var hx = q0.x + (q1.x - q0.x) * u - bx, hy = q0.y + (q1.y - q0.y) * u - by;
      var dim = q0.dim + (q1.dim - q0.dim) * u;
      var size = 9 * k;
      ctx.globalAlpha = 0.42 * fade * (0.45 + 0.55 * dim);
      ctx.drawImage(ember, hx - size, hy - size, size * 2, size * 2);
    }

    function frame(now) {
      raf = requestAnimationFrame(frame);
      // WebGL 在桌面跑满帧，碎光漂得顺；手机和 2D 光点约 30 帧，省电
      if (now - last < (glw && !useSmall() ? 0 : 31)) return;
      last = now;
      if (leaving) return;
      draw(now, false);
    }
    function start() { if (!raf && ctx) raf = requestAnimationFrame(frame); }

    return {
      loadMask: loadMask,
      image: function (img) { riverImg = img; if (ctx && !ready && maskState === 'failed') fromImage(img, 'river'); },
      fallback: function () { riverFailed = true; if (ctx && !ready && maskState === 'failed') fallback(); },
      layout: layout,
      setRoute: setRoute,
      walk: function () { if (!reduced && !moteStart) moteStart = performance.now(); },
      view: function (sl) { viewLeft = sl; }
    };
  })();

  function buildLamps(introMs) {
    // 画里只该有河谷人家的几点灯，位置在 map-config.js 里按画面摆，不随机撒
    var r = rng(404), html = '';
    (CONFIG.lamps || []).forEach(function (p) {
      html += '<i style="left:' + p[0] + '%;top:' + p[1] +
        '%;--d:' + Math.round((0.35 + r() * 0.5) * introMs) + 'ms;animation-duration:' + (5 + r() * 6).toFixed(1) + 's"></i>';
    });
    $('lamps').innerHTML = html;
  }

  // 站点：一方小朱印，旁边一列竖排小字（悬念在右，站名和印在左、挨着画里的位置），像写在画上的题跋。
  // 开放的站：朱底白字，点了推镜进站。下一站：白底淡朱字，点了只提示“还在路上”。没有发光圆点
  function buildSites() {
    var box = $('sites');
    var taishou = DATA.taishou || {};
    stations.forEach(function (s) {
      if (!s.map) return;
      var isOpen = s.status === 'open', isCurrent = s === current;
      var el;
      if (isOpen) {
        el = document.createElement('a');
        el.href = s.page;
        el.setAttribute('draggable', 'false');
      } else {
        el = document.createElement('button');
        el.type = 'button';
      }
      el.className = 'site ' + (isOpen ? 'site--open' : 'site--next') + (isCurrent ? ' is-current' : '') + (s.tagSide === 'left' ? ' site--left' : '');
      el.dataset.id = s.id;
      el.style.left = s.map.x + '%';
      el.style.top = s.map.y + '%';
      el.setAttribute('aria-label', s.ariaLabel);
      // 太守当前位置：填了形象图才显示，没有就什么都不画（形象还没设计，不用代码画）
      var hasImage = isCurrent && taishou.mapImage;
      var pinInner = hasImage ? '<img class="taishou-marker-img" src="' + C.esc(taishou.mapImage) + '" alt="" draggable="false">' : '';
      el.innerHTML = '<span class="pin' + (isCurrent ? ' taishou-marker' : '') + (hasImage ? ' has-image' : '') + '">' + pinInner + '</span>' +
        '<span class="tag" aria-hidden="true">' +
        '<span class="tag-hook">' + (s.hook || []).map(function (line) { return '<span>' + C.esc(line) + '</span>'; }).join('') + '</span>' +
        '<span class="tag-name">' + C.esc(s.name) + '<span class="tag-seal">' + C.esc(s.seal || s.name.charAt(0)) + '</span>' +
        (isOpen ? '' : '<small>' + C.esc(s.mapTag || '') + '</small>') + '</span>' +
        '</span>';
      el.addEventListener('click', function (ev) {
        ev.preventDefault();
        if (didDrag) return;
        if (isOpen) enterStation(el);
        else showToast(s.pendingNote);
      });
      el.addEventListener('focus', function () {
        if (!el.matches(':focus-visible')) return;
        scroller.scrollTo({ left: focusLeft(s), behavior: reduced ? 'auto' : 'smooth' });
      });
      box.appendChild(el);
    });
  }

  function focusLeft(s) { return s.map.x / 100 * W - VW * (VW < 700 ? 0.3 : 0.42); }

  /* ---------- 视差 ---------- */
  var ticking = false;
  function sync() {
    ticking = false;
    var sl = scroller.scrollLeft;
    water.view(sl);
    for (var i = 0; i < parallaxLayers.length; i++) {
      var l = parallaxLayers[i];
      var x = sl <= l.s0
        ? (l.s0 > 0 ? sl / l.s0 * l.x0 : 0)
        : l.x0 + (l.maxS > l.s0 ? (sl - l.s0) / (l.maxS - l.s0) * (l.maxX - l.x0) : 0);
      l.el.style.transform = 'translate3d(' + (-x).toFixed(1) + 'px,0,0)';
    }
  }
  var hintGone = false, startLeft = 0;
  scroller.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; requestAnimationFrame(sync); }
    if (!hintGone && Math.abs(scroller.scrollLeft - startLeft) > 60) { hintGone = true; $('hint').classList.add('gone'); }
  }, { passive: true });

  /* ---------- 拖动（鼠标）与滚轮。触屏走原生横向滑动 ---------- */
  var didDrag = false, drag = null, inertia = 0;
  scroller.addEventListener('pointerdown', function (e) {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    didDrag = false;
    cancelAnimationFrame(inertia);
    drag = { x: e.clientX, left: scroller.scrollLeft, id: e.pointerId, vx: 0, lastX: e.clientX, lastT: performance.now() };
  });
  window.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id) return;
    var dx = e.clientX - drag.x;
    if (!didDrag && Math.abs(dx) > 5) { didDrag = true; scroller.classList.add('dragging'); }
    if (!didDrag) return;
    scroller.scrollLeft = drag.left - dx;
    var now = performance.now(), dt = Math.max(1, now - drag.lastT);
    drag.vx = (e.clientX - drag.lastX) / dt;
    drag.lastX = e.clientX; drag.lastT = now;
  });
  function endDrag() {
    if (!drag) return;
    var v = drag.vx * 16, wasDrag = didDrag;
    drag = null;
    scroller.classList.remove('dragging');
    if (wasDrag) setTimeout(function () { didDrag = false; }, 60);
    if (wasDrag && !reduced && Math.abs(v) > 1) {
      (function glide() {
        scroller.scrollLeft -= v;
        v *= 0.94;
        if (Math.abs(v) > 0.4) inertia = requestAnimationFrame(glide);
      })();
    }
  }
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  scroller.addEventListener('dragstart', function (e) { e.preventDefault(); });
  scroller.addEventListener('wheel', function (e) {
    if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
    e.preventDefault();
    scroller.scrollLeft += e.deltaY;
  }, { passive: false });

  /* ---------- 提示 ---------- */
  var toastTimer = 0;
  function showToast(text) {
    var t = $('toast');
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2400);
  }

  /* ---------- 推镜进站 ---------- */
  var leaving = false;
  function enterStation(el) {
    if (leaving) return;
    leaving = true;
    var href = el.getAttribute('href');
    if (reduced) { window.location.href = href; return; }
    var pin = el.querySelector('.pin').getBoundingClientRect();
    var ox = pin.left + pin.width / 2, oy = pin.top + pin.height / 2;
    camera.style.setProperty('--ox', ox + 'px');
    camera.style.setProperty('--oy', oy + 'px');
    // 推进的同时把站点带到画面中央
    camera.style.setProperty('--tx', (VW / 2 - ox) + 'px');
    camera.style.setProperty('--ty', (VH / 2 - oy) + 'px');
    el.classList.add('target');
    document.body.classList.add('leaving');
    camera.classList.add('pushing');
    $('curtain').classList.add('down');
    setTimeout(function () { window.location.href = href; }, 1180);
  }
  // 推镜进站自己有一层幕布，不再叠浏览器的跨页过渡（叠上去偶尔会被浏览器中途作废，控制台报错）
  window.addEventListener('pageswap', function (e) {
    if (leaving && e.viewTransition) { try { e.viewTransition.skipTransition(); } catch (err) { /* 不支持就算了 */ } }
  });
  // 从站点页按返回键时，浏览器可能恢复离开前的画面，这里还原
  window.addEventListener('pageshow', function (e) {
    if (!e.persisted && !leaving) return;
    leaving = false;
    camera.classList.remove('pushing');
    document.body.classList.remove('leaving');
    $('curtain').classList.remove('down');
    Array.prototype.forEach.call(document.querySelectorAll('.site.target'), function (n) { n.classList.remove('target'); });
  });

  /* ---------- 文牒 ---------- */
  var dialog = $('wendie');
  function openWendie() {
    C.renderWendie($('wendie-body'), '');
    if (dialog.showModal) { if (!dialog.open) dialog.showModal(); } else dialog.setAttribute('open', '');
  }
  function closeWendie() {
    if (dialog.close) dialog.close(); else dialog.removeAttribute('open');
    if (window.location.hash === '#wendie') {
      try { history.replaceState(null, '', window.location.pathname + window.location.search); } catch (e) { /* file 协议下可能不允许 */ }
    }
  }
  $('open-wendie').addEventListener('click', openWendie);
  $('close-wendie').addEventListener('click', closeWendie);
  dialog.addEventListener('click', function (e) { if (e.target === dialog) closeWendie(); });

  /* ---------- 开场 ---------- */
  var introDone = false, introRaf = 0, introTimer = 0;
  function finishIntro() {
    if (introDone) return;
    introDone = true;
    cancelAnimationFrame(introRaf);
    clearTimeout(introTimer);
    $('lamps').classList.remove('waiting', 'waking');
    document.body.classList.remove('is-intro');
    var intro = $('intro');
    intro.classList.add('ending');
    setTimeout(function () { intro.style.display = 'none'; }, reduced ? 0 : 750);
    C.store.set(INTRO_KEY, '1');
    setTimeout(water.walk, reduced ? 0 : 1200); // 路线显出来以后，太守再上路
    if (window.location.hash === '#wendie') openWendie();
  }

  // 一张素绢盖在画上，从窑火那一点起，像墨落在绢上一样，带着不规则的毛边慢慢化开；化开的边缘微微发暗，像洇湿的墨痕。
  // 用很小的画布算（屏幕的 1/8），放大后边缘自然是软的；每帧只算几万个点，手机也不吃力
  function playIntro(ms) {
    var veil = $('intro-veil'), intro = $('intro');
    var g = veil.getContext && veil.getContext('2d');
    if (!g) { introTimer = setTimeout(finishIntro, ms); return; }
    var D = 8, cw = Math.ceil(VW / D), ch = Math.ceil(VH / D);
    veil.width = cw; veil.height = ch;
    var p = px(current);
    var cx = (p[0] - scroller.scrollLeft) / D, cy = (p[1] + WT) / D;
    var maxR = Math.hypot(Math.max(cx, cw - cx), Math.max(cy, ch - cy)) || 1;
    // 毛边：几层值噪声叠起来
    var r = rng(31), field = new Float32Array(cw * ch);
    var grid = function (n) { var a = new Float32Array((n + 2) * (n + 2)); for (var i = 0; i < a.length; i++) a[i] = r(); return a; };
    var octs = [[6, 0.55], [14, 0.3], [30, 0.15]].map(function (o) { return { n: o[0], w: o[1], g: grid(o[0]) }; });
    var sc = Math.max(cw, ch);
    for (var j = 0; j < ch; j++) for (var i = 0; i < cw; i++) {
      var nz = 0;
      for (var k = 0; k < octs.length; k++) {
        var o = octs[k], u = i / sc * o.n, v = j / sc * o.n, x0 = Math.floor(u), y0 = Math.floor(v), N = o.n + 2;
        var fx = u - x0, fy = v - y0;
        fx = fx * fx * (3 - 2 * fx); fy = fy * fy * (3 - 2 * fy);
        var ga = o.g[y0 * N + x0], gb = o.g[y0 * N + x0 + 1], gc = o.g[(y0 + 1) * N + x0], gd = o.g[(y0 + 1) * N + x0 + 1];
        nz += o.w * (ga + (gb - ga) * fx + (gc - ga) * fy + (ga - gb - gc + gd) * fx * fy);
      }
      var dd = Math.hypot((i - cx) * 0.8, j - cy) / maxR; // 横向化得快一点，像顺着绢丝洇开
      field[j * cw + i] = dd * 0.74 + nz * 0.3;
    }
    var img = g.createImageData(cw, ch), q = img.data;
    var P = [213, 223, 218], K = [62, 74, 72];               // 素绢（和画的底色同值）、墨痕
    var start = performance.now();
    var ease = function (x) { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
    (function frame(now) {
      var t = clamp((now - start) / ms, 0, 1);
      var th = -0.12 + ease(t) * 1.25, band = 0.11;
      for (var n = 0, m = 0; n < field.length; n++, m += 4) {
        var a = ease((field[n] - th) / band);              // 0 已化开，1 还是素绢
        var e = a * (1 - a) * 4 * 0.1 * (1 - t * 0.6);    // 化开的边缘略带墨色
        q[m] = P[0] + (K[0] - P[0]) * e; q[m + 1] = P[1] + (K[1] - P[1]) * e; q[m + 2] = P[2] + (K[2] - P[2]) * e;
        q[m + 3] = Math.round(255 * Math.min(1, a + e * 0.6));
      }
      g.putImageData(img, 0, 0);
      intro.style.background = 'transparent'; // 绢由画布接手，下面的画才能一点点透出来
      if (t < 1) introRaf = requestAnimationFrame(frame);
    })(start);
    introTimer = setTimeout(finishIntro, ms);
  }

  function makeGrain() {
    var c = document.createElement('canvas');
    c.width = c.height = 220;
    var ctx = c.getContext('2d'), img = ctx.createImageData(220, 220), r = rng(9);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = r() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v > 128 ? 230 : 0;
      img.data[i + 3] = r() * 12;
    }
    ctx.putImageData(img, 0, 0);
    try { $('grain').style.backgroundImage = 'url(' + c.toDataURL('image/png') + ')'; } catch (e) { /* 只是质感，没有也行 */ }
  }

  /* ---------- 组装 ---------- */
  // 长卷几乎不能滑时（宽屏），不提示“拖动看山河”
  function hintCheck() { if (W - VW < VW * 0.15) $('hint').classList.add('gone'); }

  function relayout() {
    var center = (scroller.scrollLeft + VW / 2) / W;
    measure();
    hintCheck();
    parallaxLayers.concat(worldLayers).forEach(layoutLayer);
    buildRoute();
    scroller.scrollLeft = center * W - VW / 2;
    sync();
  }

  function init() {
    C.renderFooter('');
    // 题跋：两列竖排小字，末尾钤一方“太守”小印当落款
    var lines = DATA.site.motto;
    $('motto').innerHTML = lines.map(function (s, i) {
      return '<span>' + C.esc(s) + (i === lines.length - 1 ? '<span class="colophon-seal" aria-hidden="true">太守</span>' : '') + '</span>';
    }).join('');

    var seen = C.store.get(INTRO_KEY);
    var goWendie = window.location.hash === '#wendie';
    var introMs = reduced || goWendie ? 0 : (seen ? 1600 : 2800); // 第一次 2.8 秒，看过的 1.6 秒；随时可跳过

    measure();
    hintCheck();
    buildLamps(introMs || 1);
    buildRoute();
    buildSites();
    makeGrain();

    startLeft = focusLeft(current);
    scroller.scrollLeft = startLeft;

    $('intro').addEventListener('click', finishIntro);
    window.addEventListener('keydown', function (e) {
      if (!introDone && (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ' || e.key === 'Tab')) finishIntro();
    });

    var ready = loadLayers();
    sync();

    if (introMs === 0) {
      finishIntro();
      $('intro').style.display = 'none';
    } else {
      $('lamps').classList.add('waiting');
      var fired = false;
      var once = function () {
        if (fired) return;
        fired = true;
        if (!introDone) playIntro(introMs);
      };
      ready.then(once);
      setTimeout(once, IMAGE_WAIT_MS);
    }

    var resizeTimer = 0, lastW = VW, lastH = VH;
    window.addEventListener('resize', function () {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(function () {
        // 手机地址栏伸缩只差一点高度，不值得重排
        if (window.innerWidth === lastW && Math.abs(window.innerHeight - lastH) < 80) return;
        lastW = window.innerWidth; lastH = window.innerHeight;
        relayout();
      }, 160);
    });
  }

  init();
})();
