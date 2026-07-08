#target photoshop

(function () {
  if (!app.documents.length) {
    alert("请先打开一个 PS/PSB 文件。");
    return;
  }

  var LINKS_ROOT_FOLDER = "links";
  var LINKS_FOLDER_SUFFIX = "_links";
  var doc = app.activeDocument;
  var used = {};
  var logLines = [];
  var movedCount = 0;
  var skippedCount = 0;
  var failedCount = 0;
  var startedAt = new Date().getTime();

  function log(msg) {
    logLines.push(msg);
  }

  function elapsedText() {
    var seconds = Math.max(0, Math.round((new Date().getTime() - startedAt) / 1000));
    var minutes = Math.floor(seconds / 60);
    var rest = seconds % 60;
    return minutes ? minutes + "分" + rest + "秒" : seconds + "秒";
  }

  function safeName(name) {
    var s = String(name || "document").replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
    s = s.replace(/^\s+|\s+$/g, "").replace(/\s+/g, "_");
    return s || "document";
  }

  function docBaseName() {
    return String(doc.name || "未命名").replace(/\.[^\.]+$/, "");
  }

  function timestamp() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : String(n); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function outputFolder() {
    try {
      if (!doc.path) {
        alert("请先保存主 PSB，再运行脚本。");
        return null;
      }
      return Folder(doc.path.fsName + "/" + LINKS_ROOT_FOLDER + "/" + safeName(docBaseName()) + LINKS_FOLDER_SUFFIX);
    } catch (e) {
      alert("读取 links 文件夹失败：\n" + e);
      return null;
    }
  }

  function fileKey(file) {
    try {
      return File(file).fsName.toLowerCase();
    } catch (e) {
      return String(file || "").toLowerCase();
    }
  }

  function markUsed(path) {
    if (!path) return;
    try {
      var f = File(path);
      if (f.exists) used[fileKey(f)] = true;
    } catch (e) {}
  }

  function descriptorPath(desc, key) {
    try {
      if (!desc.hasKey(key)) return "";
      var type = desc.getType(key);
      if (type === DescValueType.ALIASTYPE) return desc.getPath(key).fsName;
      if (type === DescValueType.STRINGTYPE) return desc.getString(key);
    } catch (e) {}
    return "";
  }

  function smartObjectMetaFromDescriptor(desc) {
    var meta = { linked: false, linkMissing: false, fileReference: "", linkPath: "" };
    try {
      var smartObjectKey = stringIDToTypeID("smartObject");
      if (!desc.hasKey(smartObjectKey)) return meta;
      var so = desc.getObjectValue(smartObjectKey);
      if (so.hasKey(stringIDToTypeID("linked"))) meta.linked = so.getBoolean(stringIDToTypeID("linked"));
      if (so.hasKey(stringIDToTypeID("linkMissing"))) meta.linkMissing = so.getBoolean(stringIDToTypeID("linkMissing"));
      if (so.hasKey(stringIDToTypeID("fileReference"))) meta.fileReference = so.getString(stringIDToTypeID("fileReference"));
      meta.linkPath = descriptorPath(so, stringIDToTypeID("link"));
    } catch (e) {}
    return meta;
  }

  function layerCount() {
    var ref = new ActionReference();
    ref.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("numberOfLayers"));
    ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    return executeActionGet(ref).getInteger(stringIDToTypeID("numberOfLayers"));
  }

  function layerDescriptorByIndex(index) {
    var ref = new ActionReference();
    ref.putIndex(charIDToTypeID("Lyr "), index);
    return executeActionGet(ref);
  }

  function descriptorString(desc, keyName, fallback) {
    try {
      var key = stringIDToTypeID(keyName);
      if (desc.hasKey(key)) return desc.getString(key);
    } catch (e) {}
    return fallback;
  }

  function descriptorInteger(desc, keyName, fallback) {
    try {
      var key = stringIDToTypeID(keyName);
      if (desc.hasKey(key)) return desc.getInteger(key);
    } catch (e) {}
    return fallback;
  }

  function descriptorLayerSection(desc) {
    try {
      var key = stringIDToTypeID("layerSection");
      if (!desc.hasKey(key)) return "";
      return typeIDToStringID(desc.getEnumerationValue(key));
    } catch (e) {
      return "";
    }
  }

  function isProxyName(name) {
    return /(^|[_\-\s])proxy(\.psb)?$/i.test(String(name || "").replace(/\.[^\.\\\/]+$/, ""));
  }

  function collectSmartObjects(items) {
    var count = layerCount();
    for (var i = 1; i <= count; i++) {
      try {
        var desc = layerDescriptorByIndex(i);
        if (descriptorLayerSection(desc) === "layerSectionEnd") continue;
        if (!desc.hasKey(stringIDToTypeID("smartObject"))) continue;
        items.push({
          id: descriptorInteger(desc, "layerID", null),
          name: descriptorString(desc, "name", "智能对象 " + i),
          meta: smartObjectMetaFromDescriptor(desc)
        });
      } catch (e) {}
    }
  }

  function selectLayerById(id) {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putIdentifier(charIDToTypeID("Lyr "), id);
    desc.putReference(charIDToTypeID("null"), ref);
    desc.putBoolean(charIDToTypeID("MkVs"), false);
    executeAction(charIDToTypeID("slct"), desc, DialogModes.NO);
  }

  function editSmartObjectContents() {
    executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
  }

  function collectUsedLinksInDocument(targetDoc, depth) {
    if (depth > 3) return;
    app.activeDocument = targetDoc;
    var items = [];
    collectSmartObjects(items);
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      if (item.meta && item.meta.linked && !item.meta.linkMissing) {
        markUsed(item.meta.linkPath);
      }
      if (item.id && isProxyName(item.name)) {
        var childDoc = null;
        try {
          app.activeDocument = targetDoc;
          selectLayerById(item.id);
          editSmartObjectContents();
          childDoc = app.activeDocument;
          if (childDoc !== targetDoc) {
            collectUsedLinksInDocument(childDoc, depth + 1);
            childDoc.close(SaveOptions.DONOTSAVECHANGES);
            childDoc = null;
          }
        } catch (e) {
          log("跳过代理内部扫描: " + item.name + " | " + e);
          try { if (childDoc) childDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {}
        }
      }
    }
    app.activeDocument = targetDoc;
  }

  function shouldIgnoreFile(file) {
    var name = String(file.name || "");
    if (/\.txt$/i.test(name)) return true;
    if (/^_unused_links_/i.test(name)) return true;
    return false;
  }

  function scanFiles(folder, out) {
    if (!folder || !folder.exists) return;
    var files = folder.getFiles();
    for (var i = 0; i < files.length; i++) {
      var item = files[i];
      if (item instanceof Folder) {
        if (!/^_unused_links_/i.test(item.name)) scanFiles(item, out);
      } else if (item instanceof File) {
        out.push(item);
      }
    }
  }

  function uniqueMoveTarget(folder, file) {
    var target = File(folder.fsName + "/" + file.name);
    var stem = String(file.name || "file").replace(/\.[^\.]+$/, "");
    var extMatch = String(file.name || "").match(/(\.[^\.]+)$/);
    var ext = extMatch ? extMatch[1] : "";
    var n = 2;
    while (target.exists) {
      target = File(folder.fsName + "/" + stem + "_" + n + ext);
      n++;
    }
    return target;
  }

  function writeLog(folder) {
    try {
      var f = File(folder.fsName + "/" + safeName(docBaseName()) + "_清理废弃links日志_" + timestamp() + ".txt");
      f.encoding = "UTF-8";
      f.open("w");
      f.writeln("清理废弃 links 日志");
      f.writeln("文件: " + doc.name);
      f.writeln("时间: " + new Date());
      f.writeln("耗时: " + elapsedText());
      f.writeln("");
      f.writeln("移动: " + movedCount);
      f.writeln("跳过: " + skippedCount);
      f.writeln("失败: " + failedCount);
      f.writeln("");
      for (var i = 0; i < logLines.length; i++) f.writeln(logLines[i]);
      f.close();
      return f;
    } catch (e) {
      return null;
    }
  }

  try {
    var folder = outputFolder();
    if (!folder || !folder.exists) {
      alert("没有找到 links\\" + safeName(docBaseName()) + LINKS_FOLDER_SUFFIX + " 文件夹。");
      return;
    }

    collectUsedLinksInDocument(doc, 0);
    var allFiles = [];
    scanFiles(folder, allFiles);

    var unused = [];
    for (var i = 0; i < allFiles.length; i++) {
      var f = allFiles[i];
      if (shouldIgnoreFile(f)) {
        skippedCount++;
        continue;
      }
      if (!used[fileKey(f)]) unused.push(f);
    }

    if (!unused.length) {
      alert("没有发现废弃 links 文件。");
      return;
    }

    var ok = confirm("发现可能废弃的 links 文件：" + unused.length + " 个\n\n会移动到 _unused_links_时间 文件夹，不会直接删除。\n继续吗？");
    if (!ok) return;

    var trash = Folder(folder.fsName + "/_unused_links_" + timestamp());
    if (!trash.exists) trash.create();

    for (var j = 0; j < unused.length; j++) {
      try {
        var target = uniqueMoveTarget(trash, unused[j]);
        if (!unused[j].copy(target)) throw new Error("复制失败");
        if (!unused[j].remove()) throw new Error("删除原文件失败");
        movedCount++;
        log("已移动: " + unused[j].fsName + " -> " + target.fsName);
      } catch (moveError) {
        failedCount++;
        log("移动失败: " + unused[j].fsName + " | " + moveError);
      }
    }

    var logFile = (failedCount > 0) ? writeLog(folder) : null;
    alert("完成。\n\n已移动：" + movedCount + "\n已跳过：" + skippedCount + "\n失败：" + failedCount + "\n耗时：" + elapsedText() + "\n\n位置：\n" + trash.fsName + (logFile ? "\n\n日志：" + logFile.fsName : ""));
  } catch (e) {
    alert("脚本出错: " + e + (e && e.line ? "\n行: " + e.line : ""));
  } finally {
    try { app.activeDocument = doc; } catch (activeError) {}
  }
})();
