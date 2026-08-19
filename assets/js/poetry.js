/* ============================================================
   诗歌页交互：选诗集 → 目录 → 点条目就地展开内容
   支持同时展开多首，点同一首再收起
   ============================================================ */
(function(){
  var POEMS = window.POEMS || {};
  var books = ['chunlian', 'xingyin'];
  var btnsEl = document.getElementById('bookBtns');
  var catEl = document.getElementById('catalog');
  var activeBook = null;
  var openMap = new WeakMap(); /* item 元素 → 展开块（可多开） */
  var allExpanded = [];        /* 所有已展开块，切换诗集时清掉 */

  function esc(s){
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  /* 收起某个条目对应的展开块 */
  function collapseItem(item){
    var box = openMap.get(item);
    if (box && box.parentNode) {
      box.parentNode.removeChild(box);
    }
    openMap.delete(item);
    var i = allExpanded.indexOf(box);
    if (i >= 0) allExpanded.splice(i, 1);
  }

  /* ---- 第一步：诗集按钮 ---- */
  function renderButtons(){
    books.forEach(function(key){
      var b = POEMS[key];
      if (!b) return;
      var btn = document.createElement('button');
      btn.className = 'book-btn';
      btn.textContent = '《' + b.name + '》';
      btn.addEventListener('click', function(){
        selectBook(key, btn);
      });
      btnsEl.appendChild(btn);
    });
  }

  /* 选择诗集：清空展开、高亮按钮、渲染目录 */
  function selectBook(key, btn){
    activeBook = key;
    clearAllOpen();
    document.querySelectorAll('.book-btn').forEach(function(x){ x.classList.remove('on'); });
    if (btn) btn.classList.add('on');
    renderCatalog(key);
  }

  /* 切换诗集时全部清掉已展开块 */
  function clearAllOpen(){
    allExpanded.forEach(function(box){
      if (box.parentNode) box.parentNode.removeChild(box);
    });
    allExpanded = [];
    openMap = new WeakMap();
  }

  /* ---- 第二步：目录（含序跋入口） ---- */
  function renderCatalog(key, targetTitle){
    var b = POEMS[key];
    if (!b) return;
    catEl.hidden = false;
    catEl.innerHTML = '';

    var title = document.createElement('div');
    title.className = 'catalog-title';
    title.textContent = '目 录';
    catEl.appendChild(title);

    /* 序 */
    if (b.intro) {
      var it = document.createElement('button');
      it.className = 'cat-item essay-item';
      it.textContent = b.intro.title;
      it.addEventListener('click', function(){ toggleExpand(it, renderEssayHtml(b.intro)); });
      catEl.appendChild(it);
    }

    /* 分组（按年） */
    b.groups.forEach(function(g){
      if (g.year) {
        var yr = document.createElement('div');
        yr.className = 'cat-year';
        yr.textContent = g.year;
        catEl.appendChild(yr);
      }
      g.poems.forEach(function(p){
        var item = document.createElement('button');
        item.className = 'cat-item';
        item.textContent = p.t;
        item.addEventListener('click', function(){ toggleExpand(item, renderPoemHtml(g, p)); });
        catEl.appendChild(item);
        /* 若这是要跳转的目标诗，自动展开 */
        if (targetTitle && p.t.replace(/\s/g,'') === targetTitle.replace(/\s/g,'')) {
          setTimeout(function(){ toggleExpand(item, renderPoemHtml(g, p)); }, 80);
        }
      });
    });

    /* 跋 */
    if (b.outro) {
      var ot = document.createElement('button');
      ot.className = 'cat-item essay-item';
      ot.textContent = b.outro.title;
      ot.addEventListener('click', function(){ toggleExpand(ot, renderEssayHtml(b.outro)); });
      catEl.appendChild(ot);
    }
  }

  /* ---- 点击条目：就地展开（可多开）/ 再点同一首收起 ---- */
  function toggleExpand(item, html){
    if (openMap.get(item)) {
      collapseItem(item);
      return;
    }
    var box = document.createElement('div');
    box.className = 'expanded';
    box.innerHTML = html;
    item.parentNode.insertBefore(box, item.nextSibling);
    openMap.set(item, box);
    allExpanded.push(box);
    /* 点击题目自动跳到诗：等展开动画结束后滚到内容顶部 */
    setTimeout(function(){
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  }

  /* ---- 序 / 跋 HTML ---- */
  function renderEssayHtml(essay){
    var html = '<div class="essay">';
    html += '<div class="h">' + esc(essay.title) + '</div>';
    essay.paras.forEach(function(para){
      html += '<p class="essay-p">' + esc(para) + '</p>';
    });
    if (essay.date) html += '<div class="sig">' + esc(essay.date) + '</div>';
    html += '</div>';
    return html;
  }

  /* ---- 诗歌正文 HTML ---- */
  function renderPoemHtml(g, p){
    var html = '<div class="poem">';
    html += '<div class="t">' + esc(p.t) + '</div>';
    if (p.note) html += '<div class="note">' + esc(p.note) + '</div>';
    html += '<div class="body">';
    p.body.forEach(function(line){
      html += '<span class="ln">' + esc(line) + '</span>';
    });
    html += '</div>';
    /* 译文（有内容才显示，待补充） */
    if (p.trans && p.trans.length) {
      html += '<div class="extra"><div class="extra-h">译文</div><div class="extra-body">' + esc(p.trans) + '</div></div>';
    }
    /* 注释（有内容才显示，待补充） */
    if (p.notes && p.notes.length) {
      html += '<div class="extra"><div class="extra-h">注释</div><div class="extra-body">' + esc(p.notes) + '</div></div>';
    }
    html += '</div>';
    return html;
  }

  renderButtons();

  /* 支持从首页出处跳转：poetry.html?poem=诗名 → 自动选诗集并展开该诗 */
  function jumpFromQuery(){
    var m = window.location.search.match(/[?&]poem=([^&]+)/);
    if (!m) return;
    var target = decodeURIComponent(m[1]);
    if (!target) return;
    /* 在两本诗集里找这首诗，找到就选对应诗集并展开 */
    var found = null, bookKey = null;
    books.forEach(function(key){
      var b = POEMS[key];
      if (!b || found) return;
      b.groups.forEach(function(g){
        g.poems.forEach(function(p){
          if (p.t.replace(/\s/g,'') === target.replace(/\s/g,'')) {
            found = p; bookKey = key;
          }
        });
      });
    });
    if (found && bookKey) {
      var btns = btnsEl.children;
      for (var i = 0; i < btns.length; i++) {
        if (btns[i].textContent.indexOf(POEMS[bookKey].name) >= 0) {
          selectBook(bookKey, btns[i]);
          break;
        }
      }
      /* 等目录渲染完，展开目标诗 */
      setTimeout(function(){
        var items = catEl.querySelectorAll('.cat-item');
        for (var j = 0; j < items.length; j++) {
          if (items[j].textContent.replace(/\s/g,'') === target.replace(/\s/g,'')) {
            items[j].click();
            break;
          }
        }
      }, 120);
    } else {
      /* 找不到具体诗（可能是《春潋集序》《春潋集跋》等）：
         按书名匹配诗集，选中并滚到目录 */
      var targetName = target.replace(/序|跋/g,'');
      for (var b2 = 0; b2 < books.length; b2++) {
        var book = POEMS[books[b2]];
        if (book && book.name.indexOf(targetName) >= 0) {
          var btn2 = btnsEl.children[b2];
          if (btn2) {
            selectBook(books[b2], btn2);
            setTimeout(function(){
              catEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 100);
          }
          break;
        }
      }
    }
  }
  jumpFromQuery();
})();
