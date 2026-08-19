/* ============================================================
   周新旭 · 个人作品集  —  首页
   Hero：横幅照片（右缘渐变融粉）→ 粉色矩形卡片 · 随机佳句轮播
   ============================================================ */
(function(){
  /* 佳句：优先用 quotes.js 的 SITE_QUOTES；万一没加载成功，
     用内置兜底，保证卡片永远有内容显示 */
  var FALLBACK = [
    { text: "思绪悠悠，似春水波远万里；三秋一念，若清潋随风归梦。", attr: "《春潋集序》" },
    { text: "人皆道远赴人间惊鸿宴，我自言本是天上逍遥仙。", attr: "《寒风行》" },
    { text: "何苦断肠槐荫梦，满庭芳里复鲜衣。", attr: "《逸心园歌兼词》" },
    { text: "巽风江上，梦归春水清潋。", attr: "《念奴娇·忆梦》" },
    { text: "天露濯缨，涛声涤志，风起灵心畅。", attr: "《念奴娇·过湘江》" },
    { text: "平书仄题，题不尽高洁心志；山阻石拦，拦不住傲气凌霜。", attr: "《春潋集跋》" }
  ];
  var quotes = (window.SITE_QUOTES && window.SITE_QUOTES.length) ? window.SITE_QUOTES : FALLBACK;

  var FADE_MS = 450;      /* 渐隐/渐显时长 */
  var INTERVAL_MS = 5000; /* 自动轮播间隔 */

  var qEl = document.getElementById('q');
  var aEl = document.getElementById('qa');
  var cur = -1;
  var timer = null;
  var switching = false;

  function pick(){
    if (!quotes.length) return -1;
    if (quotes.length === 1) return 0;
    var idx;
    do { idx = Math.floor(Math.random() * quotes.length); }
    while (idx === cur);
    return idx;
  }

  /* 直接设置文字（不依赖任何过渡状态）；出处渲染成可点击链接 */
  function setText(idx){
    if (idx < 0) return false;
    cur = idx;
    qEl.textContent = quotes[idx].text;
    var attr = quotes[idx].attr || '';
    /* 出处形如《诗名》→ 提取诗名，生成跳转 poetry.html?poem=诗名 的链接 */
    var m = attr.match(/《([^》]+)》/);
    if (m && m[1]) {
      aEl.innerHTML = '<a href="poetry.html?poem=' + encodeURIComponent(m[1]) + '">' + attr + '</a>';
    } else {
      aEl.textContent = attr;
    }
    return true;
  }

  /* 渐隐 → 换句 → 渐显（全程用 class，不用内联样式，保证过渡生效） */
  var fadeTimer = null;
  function show(idx){
    if (idx < 0) return;
    /* 若正在切换中，先取消旧的淡出计时，直接进入新一轮 */
    if (fadeTimer) { clearTimeout(fadeTimer); fadeTimer = null; }
    switching = true;
    qEl.classList.add('hide');
    aEl.classList.add('hide');
    fadeTimer = setTimeout(function(){
      setText(idx);
      qEl.classList.remove('hide');
      aEl.classList.remove('hide');
      switching = false;
      fadeTimer = null;
    }, FADE_MS);
  }

  /* 手动刷新：渐隐 → 换句 → 渐显，并重置自动计时 */
  function manualRefresh(){
    refresh.classList.add('spin');
    setTimeout(function(){ refresh.classList.remove('spin'); }, 500);
    show(pick());
    schedule(); /* 手动刷新后自动计时重新开始 */
  }

  /* 自动轮播（可被手动刷新重置） */
  function schedule(){
    if (timer) clearTimeout(timer);
    timer = setTimeout(function(){
      show(pick());
      schedule();
    }, INTERVAL_MS);
  }

  var refresh = document.getElementById('refresh');
  if (refresh) {
    refresh.addEventListener('click', manualRefresh);
  }

  /* 启动：初始显示。若 DOM 未就绪（极少见），延迟重试，保证必显示 */
  function boot(){
    if (qEl && aEl) {
      if (setText(pick())) {
        schedule();
        return;
      }
    }
    setTimeout(boot, 200);
  }
  boot();
})();
