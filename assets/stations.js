/*
 * 太守寻非遗：全站内容数据。
 * 加一站：在 stations 里加一条，再复制 stations/ruyao.html 改三处（data-station、title、头图）。头图做法见 工具/build_station_head.py。
 * 结构不绑定陶瓷：story 是段落（p）、小标题（h）、传说（legend）、插图（figure，图路径相对 assets/），texture、accent 都可选，戏曲、织绣、民俗都能用。
 * 第一版站点页只做展示：头图、题跋、故事长页、出处。不放实拍、匠人、作品、价格和购买，也不留这些的占位。
 *
 * status：
 *   open  已开放，山河图上点亮，可进入。最后一个 open 站就是“太守此刻”所在
 *   next  下一站，山河图上暗显，点击只提示“太守还在路上”
 */
window.TAISHOU = {
  site: {
    name: '太守寻非遗',
    // 首页竖排题跋。数字按中国非物质文化遗产网核过：国家级代表性项目 1557 项。竖排里阿拉伯数字会横躺，所以写成汉字
    motto: ['国家级非遗，', '一千五百五十七项。', '太守，才刚刚上路。'],
    contact: '',  // 空着时页脚不显示这一项
    icp: ''       // 空着时页脚不显示这一项。拿到真号才填，不要填假号
  },

  // 太守形象。卡通 IP 还没设计，全部留空。
  // 图路径相对站点根目录，例如 'assets/taishou-map.png'
  taishou: {
    alt: '太守',
    mapImage: '',     // 山河图上“太守当前位置”的形象。空着时不显示任何形象，只有站点的小朱印（样式见 map.css 的 .taishou-marker）
    wendieImage: ''   // 文牒里的形象。空着时形象位不显示
  },

  stations: [
    {
      id: 'ruyao',
      order: 1,
      status: 'open',
      name: '汝窑',
      region: '河南',
      page: 'stations/ruyao.html',
      seal: '汝',
      accent: '#3F6F66',              // 站点页里“传说”小签的颜色，取天青的深调，只用这一处
      texture: 'crackle.svg',         // 站点页“传说”那段底下极淡的底纹，相对 assets/，可留空
      minglu: '汝瓷',                 // 站点页尾“寻非遗 · 查名录”带的搜索词，名录里搜得到“汝瓷烧制技艺”。可留空

      // 山河图上的写意位置：百分比，相对中山图（assets/map/mid）的宽和高。不对应真实地理
      map: { x: 36.6, y: 64.14 }, // 对准高端东方长卷里窑口那点火光（原图 562,657 / 1536×1024）
      mapTag: '太守此刻在河南',
      hook: ['皇帝要的那抹青色，', '后来为什么失传了？'],
      ariaLabel: '第一站：汝窑，太守此刻在河南。皇帝要的那抹青色，后来为什么失传了？进入这一站。',

      story: {
        title: '那抹青色',
        blocks: [
          { type: 'p', text: '北宋后期，宫里嫌定窑白瓷有“芒”，用着不顺手，就命河南汝州烧青瓷。南宋人叶寘在《坦斋笔衡》里记下这件事，还落了一句评语：汝窑为魁。' },
          { type: 'p', text: '后人把它的釉色叫天青：不艳，偏淡。釉面布满细碎的裂纹，叫开片。胎和釉冷却时收缩不一样，釉面就裂了。这本是烧造留下的痕迹，到了汝窑身上，成了认它的记号。' },
          // 插图：工笔示意，不是任何一件真品，也不是 2017 年拍卖的那件。放在讲天青和开片这段后面，不要挪到拍卖那段旁边
          { type: 'figure', src: 'stations/ruyao-bixi.webp', small: 'stations/ruyao-bixi-small.webp', width: 1600, height: 1067, alt: '一幅绢本工笔画：一只天青色的笔洗，釉面有细碎开片', caption: '工笔示意图，非馆藏实物' },
          { type: 'legend', tag: '传说', text: '相传宋徽宗梦见雨后云开，写下“雨过天青云破处”，命工匠照这个颜色烧。这只是传说，史籍里找不到印证。明人谢肇淛的《五杂俎》里，类似的句子说的还是更早的柴窑。' },
          { type: 'h', text: '后来为什么失传' },
          { type: 'p', text: '给宫里烧瓷的日子很短，前后大约二十年。最晚到 1127 年靖康之变，北宋都城陷落，这份差事就断了。到了南宋，周煇在《清波杂志》里已经写：汝窑“近尤难得”。同一段还留下一个细节：釉里有玛瑙。' },
          { type: 'p', text: '后世常说它失传。具体断在哪一步，史料说不全。传世的汝窑极少。2017 年 10 月 3 日，香港苏富比拍出一件北宋汝窑笔洗，含佣金约 2.94 亿港元，是当时中国瓷器的拍卖纪录。' },
          { type: 'p', text: '考古勘定的汝窑窑址在河南宝丰清凉寺。今天河南还有人在烧汝瓷，汝瓷烧制技艺已列入国家级非遗。太守到河南，就是来找这些人。' }
        ],
        sources: [
          { label: '《环球人物》2016 年报道（人民网）', url: 'https://paper.people.com.cn/hqrw/html/2016-03/06/content_1669004.htm' },
          { label: 'The Art Newspaper：2017 年拍卖', url: 'https://www.theartnewspaper.com/news/record-breaking-chinese-brush-washer-points-to-strong-demand-for-song-ceramics-in-hong-kong' },
          { label: '中国非物质文化遗产网：汝瓷烧制技艺', url: 'https://www.ihchina.cn/ccr_detail/3284.html' }
        ]
      }
    },

    {
      id: 'junyao',
      order: 2,
      status: 'next',
      name: '钧窑',
      region: '',
      page: '',
      seal: '钧',
      map: { x: 56.51, y: 51.0 }, // 河上游、中远岸雾里那组小屋旁（原图约 868,522）
      tagSide: 'left',             // 题跋写在印的左边：右边留给首页的大字，手机上也不会被屏幕右沿切掉
      // 路线从上一站到这一站经过的点（百分比，同 map）：出窑场，沿岛北的水道往上游走到中远岸。换母图要重描。
      // 现在 map-config.js 的 route.hidden 为 true，路线不画；第二站开放时再用
      via: [[39.84, 62.11], [44.27, 60.16], [49.48, 58.59], [53.39, 57.03], [55.34, 54.3]],
      mapTag: '下一站',
      hook: ['这一窑，', '开门之前，', '谁也不知道结果。'],
      pendingNote: '太守还在路上',
      ariaLabel: '下一站：钧窑。这一窑，开门之前，谁也不知道结果。太守还在路上，暂未开放。'
    }
  ]
};
