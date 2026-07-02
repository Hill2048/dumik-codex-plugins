#target photoshop

/*
  relink-missing-smart-objects.jsx

  批量重新链接“丢失”的链接智能对象：
  - 只处理当前文档中 linkMissing=true 的智能对象。
  - 选择一个搜索文件夹，脚本递归扫描。
  - 按原 fileReference 的文件名精确匹配。
  - 如果同名文件有多个，跳过，避免误链。
  - 不自动保存主文档。
*/

(function () {
  if (!app.documents.length) {
    alert("请先打开一个 PS/PSB 文件。");
    return;
  }

  var doc = app.activeDocument;
  var logLines = [];
  var relinkedCount = 0;
  var skippedCount = 0;
  var failedCount = 0;

  function log(msg) {
    logLines.push(msg);
  }

  function runAsOneHistory(name, fn) {
    app.activeDocument.suspendHistory(name, "(" + fn.toString() + ")()");
  }

  function safeName(name) {
    var s = String(name || "document").replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
    s = s.replace(/^\s+|\s+$/g, "").replace(/\s+/g, "_");
    return s || "document";
  }

  function docBaseName() {
    return String(doc.name || "未命名").replace(/\.[^\.]+$/, "");
  }

  function safeDocName() {
    try {
      return app.activeDocument.name;
    } catch (e) {
      return "[无法读取文件名]";
    }
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
    var meta = {
      linked: false,
      linkMissing: false,
      fileReference: "",
      linkPath: "",
      ok: false,
      error: ""
    };

    try {
      var smartObjectKey = stringIDToTypeID("smartObject");
      if (!desc.hasKey(smartObjectKey)) return meta;

      var so = desc.getObjectValue(smartObjectKey);
      var linkedKey = stringIDToTypeID("linked");
      var linkMissingKey = stringIDToTypeID("linkMissing");
      var fileReferenceKey = stringIDToTypeID("fileReference");
      var linkKey = stringIDToTypeID("link");

      if (so.hasKey(linkedKey)) meta.linked = so.getBoolean(linkedKey);
      if (so.hasKey(linkMissingKey)) meta.linkMissing = so.getBoolean(linkMissingKey);
      if (so.hasKey(fileReferenceKey)) meta.fileReference = so.getString(fileReferenceKey);
      meta.linkPath = descriptorPath(so, linkKey);
      meta.ok = true;
    } catch (e) {
      meta.error = String(e);
    }

    return meta;
  }

  function layerCount() {
    var ref = new ActionReference();
    ref.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("numberOfLayers"));
    ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    var desc = executeActionGet(ref);
    return desc.getInteger(stringIDToTypeID("numberOfLayers"));
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

  function collectSmartObjects(items) {
    var count = layerCount();
    for (var i = 1; i <= count; i++) {
      try {
        var desc = layerDescriptorByIndex(i);
        if (descriptorLayerSection(desc) === "layerSectionEnd") continue;
        if (!desc.hasKey(stringIDToTypeID("smartObject"))) continue;

        var name = descriptorString(desc, "name", "Layer " + i);
        var id = descriptorInteger(desc, "layerID", null);
        if (id === null) {
          log("跳过，无法读取 layerID: " + name);
          continue;
        }

        items.push({
          id: id,
          name: name,
          path: name,
          meta: smartObjectMetaFromDescriptor(desc)
        });
      } catch (e) {
        log("收集第 " + i + " 层失败: " + e);
      }
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

  function relinkSelectedSmartObject(file) {
    var desc = new ActionDescriptor();
    desc.putPath(charIDToTypeID("null"), file);
    executeAction(stringIDToTypeID("placedLayerRelinkToFile"), desc, DialogModes.NO);
  }

  function basenameFromPath(path) {
    var s = String(path || "");
    try {
      s = decodeURI(s);
    } catch (e) {}
    s = s.replace(/\\/g, "/");
    var parts = s.split("/");
    return parts.length ? parts[parts.length - 1] : s;
  }

  function expectedFileName(item) {
    var meta = item.meta || {};
    var name = basenameFromPath(meta.fileReference);
    if (!name && meta.linkPath) name = basenameFromPath(meta.linkPath);
    if (!name && item.name) name = basenameFromPath(item.name);
    return name;
  }

  function normalizeFileKey(name) {
    var s = String(name || "");
    try {
      s = decodeURI(s);
    } catch (e) {}
    return s.toLowerCase();
  }

  function stemOf(name) {
    return String(name || "").replace(/\.[^\.]+$/, "");
  }

  function scanFolder(folder, index) {
    var files = folder.getFiles();
    for (var i = 0; i < files.length; i++) {
      var entry = files[i];
      if (entry instanceof Folder) {
        scanFolder(entry, index);
      } else if (entry instanceof File) {
        var key = normalizeFileKey(entry.name);
        if (!index[key]) index[key] = [];
        index[key].push(entry);
      }
    }
  }

  function stemCandidates(index, expected) {
    var targetStem = normalizeFileKey(stemOf(expected));
    var matches = [];
    for (var key in index) {
      if (index.hasOwnProperty(key) && stemOf(key) === targetStem) {
        for (var i = 0; i < index[key].length; i++) matches.push(index[key][i]);
      }
    }
    return matches;
  }

  function failureSummary(maxLines) {
    var out = [];
    for (var i = 0; i < logLines.length; i++) {
      if (/失败|跳过，同名候选多个/.test(logLines[i])) {
        out.push(logLines[i]);
      }
      if (out.length >= maxLines) break;
    }
    return out.join("\n");
  }

  function timestamp() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : String(n); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function logFolder() {
    try {
      return doc.path || Folder.desktop;
    } catch (e) {
      return Folder.desktop;
    }
  }

  function writeLog() {
    try {
      var f = File(logFolder().fsName + "/" + safeName(docBaseName()) + "_重新链接丢失对象日志_" + timestamp() + ".txt");
      f.encoding = "UTF-8";
      f.open("w");
      f.writeln("批量重新链接丢失智能对象日志");
      f.writeln("文件: " + safeDocName());
      f.writeln("时间: " + new Date());
      f.writeln("");
      f.writeln("重链: " + relinkedCount);
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
    var items = [];
    collectSmartObjects(items);

    var missing = [];
    for (var i = 0; i < items.length; i++) {
      if (items[i].meta && items[i].meta.linked && items[i].meta.linkMissing) {
        missing.push(items[i]);
      }
    }

    if (!missing.length) {
      alert("当前文档没有找到丢失的链接智能对象。");
      return;
    }

    var searchFolder = Folder.selectDialog("选择用于查找丢失链接文件的文件夹");
    if (!searchFolder) return;

    var ok = confirm("找到丢失链接智能对象：" + missing.length + " 个\n\n将在这个文件夹内递归查找同名文件：\n" + searchFolder.fsName + "\n\n只按文件名精确匹配；同名多个会跳过。\n脚本不会自动保存主 PSB。");
    if (!ok) return;

    log("搜索目录: " + searchFolder.fsName);
    var fileIndex = {};
    scanFolder(searchFolder, fileIndex);
    log("已扫描文件名数量: " + countKeys(fileIndex));

    function relinkAllMissingSmartObjects() {
      for (var j = 0; j < missing.length; j++) {
      var item = missing[j];
      var expected = expectedFileName(item);
      if (!expected) {
        failedCount++;
        log("失败，无法读取原文件名: " + item.path + " | " + item.meta.fileReference);
        continue;
      }

      var matches = fileIndex[normalizeFileKey(expected)] || [];
      if (matches.length === 0) {
        failedCount++;
        log("失败，未找到同名文件: " + item.path + " | " + expected);
        var loose = stemCandidates(fileIndex, expected);
        if (loose.length) {
          log("  找到同名不同扩展候选，未自动重链:");
          for (var looseIndex = 0; looseIndex < loose.length; looseIndex++) log("  候选: " + loose[looseIndex].fsName);
        }
        continue;
      }
      if (matches.length > 1) {
        skippedCount++;
        log("跳过，同名候选多个: " + item.path + " | " + expected + " | 数量 " + matches.length);
        for (var m = 0; m < matches.length; m++) log("  候选: " + matches[m].fsName);
        continue;
      }

      try {
        selectLayerById(item.id);
        relinkSelectedSmartObject(matches[0]);
        relinkedCount++;
        log("已重链: " + item.path + " | " + expected + " -> " + matches[0].fsName);
      } catch (eRelink) {
        failedCount++;
        log("重链失败: " + item.path + " | " + expected + " | " + eRelink);
      }
    }
    }

    runAsOneHistory("批量重新链接丢失智能对象", relinkAllMissingSmartObjects);

    var logFile = writeLog();
    var summary = failureSummary(6);
    alert("完成。\n\n已重链：" + relinkedCount + "\n已跳过：" + skippedCount + "\n失败：" + failedCount + "\n\n主文档未自动保存，请检查后手动保存。" + (summary ? "\n\n失败摘要：\n" + summary : "") + (logFile ? "\n\n日志：" + logFile.fsName : ""));
  } catch (e) {
    alert("脚本出错: " + e + (e && e.line ? "\n行: " + e.line : ""));
  }

  function countKeys(obj) {
    var n = 0;
    for (var k in obj) {
      if (obj.hasOwnProperty(k)) n++;
    }
    return n;
  }
})();
