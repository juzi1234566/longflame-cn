/*
 * 山河图图层配置。换美术只需替换 assets/map/ 下的文件，或改这里的路径和 aspect。
 * 站点坐标在 stations.js 的 map 字段，单位是百分比，相对“中山”这张图。
 *
 * image   大图路径（桌面）
 * small   小图路径（手机、省流量、低内存设备）。留空就用 image
 * aspect  图片宽 / 高。必须和图片实际比例一致，否则站点会错位
 *         视差不用单独设置：图越宽，滑动时走得越快。比中山窄的显得远，宽的显得近
 * plane   back 在站点后面；world 和站点锁在一起；front 盖在站点前面
 * optional 低内存或省流量时跳过；这些层加载失败也不影响使用
 * drift    云气缓慢漂动，减少动态设置下自动停止
 * anchor   'current' 表示跟着“太守当前所在站”走，图片中心对准站点，换站不用换图
 * size     anchor 层的边长，相对画面高度的倍数
 * blend    CSS 混合模式，一般不用。光效不要用 screen：中山顶上是透明的，黑底会把后面的远山盖黑。光效图必须带透明通道
 *
 * 三层山由同一张母图拆出，宽度差就是视差。首屏在亮站处完全对齐，走远才慢慢错开，
 * 所以 aspect 不要差太多：差大了，错位时会露出后层被填补的地方。
 * route   路线小点的 size（大小倍数）、gap（间距倍数）、opacity（浓度上限），按画面调。
 *         hidden: true 时不画路线（只有一站开放时，一串点只会让画面变满）
 * lamps   河谷里的几点远灯，只是装饰。[x, y] 百分比，同站点坐标。宁少勿滥
 * flow    河道中线，从上游到下游，几段折线，百分比同站点坐标。只用来定波光往哪边漂。
 *         波光的位置和亮度取 water 蒙版（越亮的水越密），换河流图不用改代码；
 *         换了母图、河道走向变了，才要重描这里
 *
 * water   水面蒙版，只给河面波光用，不显示。红色通道 = 这里是不是水（软边），绿色通道 = 水有多亮，
 *         和中山同一个比例、铺满整张长卷。由 工具/build_layers_dongfang.py 从母图生成。没有它就退回用河流图的透明通道
 * glint   河面碎光的浓度（1 为原来的强度）。画面很淡，碎光要更淡，只是若有若无的一点
 *
 * 顺序就是从后到前的叠放顺序。
 */
window.TAISHOU_MAP = {
  // 高端东方长卷（样图 B 淡青绿细金线）：母图 品牌素材/地图母图/高端东方_B_x4.png，由 工具/build_layers_dongfang.py 拆出
  worldAspect: 1.5,    // 必须等于 mid 的 aspect
  minScroll: 1.05,     // 长卷至少比屏幕宽这么多倍；超宽屏时放大长卷、裁掉顶部天空
  maxTopCrop: 0.2,     // 长卷比屏幕高时，顶上最多裁掉两成天空，再多就裁底下的空雾（宽屏、横屏手机）
  maxTopCropShort: 0.3, // 屏幕高度不超过 480（横屏手机）时用这个上限
  water: { image: 'assets/map/water.webp', small: 'assets/map/water-small.webp' },
  glint: 0.42,         // 碎光很淡，只在河道里若有若无
  lamps: [],           // 留白的画，不点远灯
  route: { hidden: true, size: 1.6, gap: 2.2, opacity: 0.45 }, // 只开了一站，先不画路线；第二站开放时去掉 hidden
  flow: [[[72.27, 53.71], [65.1, 54.1], [60.55, 54.49], [56.64, 55.27], [54.04, 57.23], [51.43, 59.18], [49.48, 61.52], [47.2, 64.45], [44.92, 67.38], [42.97, 70.8], [41.67, 75.2]], [[100.0, 68.36], [91.15, 67.97], [81.38, 67.77], [71.61, 67.58], [62.5, 68.16], [54.69, 68.95], [46.88, 69.92]]],
  layers: [
    { id: 'far',    name: '远山', image: 'assets/map/far.webp',    small: 'assets/map/far-small.webp',    aspect: 1.4625, plane: 'back' },
    { id: 'mid',    name: '中景', image: 'assets/map/mid.webp',    small: 'assets/map/mid-small.webp',    aspect: 1.5,    plane: 'world' },
    { id: 'light',  name: '窑火', image: 'assets/map/light.webp',  small: 'assets/map/light-small.webp',  aspect: 1,      plane: 'world', anchor: 'current', size: 0.16, optional: true },
    { id: 'clouds', name: '云气', image: 'assets/map/clouds.webp', small: 'assets/map/clouds-small.webp', aspect: 3,      plane: 'front', drift: true, optional: true },
    { id: 'near',   name: '近景', image: 'assets/map/near.webp',   small: 'assets/map/near-small.webp',   aspect: 1.5375, plane: 'front' }
  ]
};
