#target photoshop

(function () {
  if (!confirm("清理 PS 缓存？\n\n会清空历史记录、剪贴板和缓存，清完不能撤销。")) {
    return;
  }

  try {
    app.purge(PurgeTarget.ALLCACHES);
    alert("已清理 PS 缓存。\n\n历史记录和剪贴板已清空。");
  } catch (e) {
    alert("清理失败：\n" + e + (e && e.line ? "\n行: " + e.line : ""));
  }
})();
