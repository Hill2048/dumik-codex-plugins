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
  var MAX_SEARCH_DEPTH = 30;
  var logLines = [];
  var relinkedCount = 0;
  var repairedCount = 0;
  var reusedFixedCount = 0;
  var skippedCount = 0;
  var failedCount = 0;
  var repairCache = {};
  var importKindCache = {};
  var successLogCount = 0;

  function log(msg) {
    logLines.push(msg);
  }

  function logSuccess(msg) {
    if (successLogCount < 20) {
      log(msg);
    } else if (successLogCount === 20) {
      log("已省略后续成功重链记录。");
    }
    successLogCount++;
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

  function extensionOf(file) {
    var m = String(file && file.name || "").match(/(\.[^\.]+)$/);
    return m ? m[1].toLowerCase() : "";
  }

  function fileHeader(file, count) {
    try {
      file.encoding = "BINARY";
      if (!file.open("r")) return "";
      var s = file.read(count || 8);
      file.close();
      return s || "";
    } catch (e) {
      try { file.close(); } catch (closeError) {}
      return "";
    }
  }

  function relinkWouldShowImportDialog(file) {
    return importKind(file) !== "";
  }

  function imageKindFromHeader(header) {
    if (header.substring(0, 3) === "\xFF\xD8\xFF") return "jpeg";
    if (header.substring(0, 8) === "\x89PNG\r\n\x1A\n") return "png";
    if (header.substring(0, 4) === "GIF8") return "gif";
    if (header.substring(0, 4) === "II*\x00" || header.substring(0, 4) === "MM\x00*") return "tiff";
    if (header.substring(0, 4) === "RIFF" && header.substring(8, 12) === "WEBP") return "webp";
    return "";
  }

  function importKind(file) {
    var cacheKey = "";
    try {
      cacheKey = String(file.fsName || file.name).toLowerCase();
      if (importKindCache.hasOwnProperty(cacheKey)) return importKindCache[cacheKey];
    } catch (cacheError) {}

    var ext = extensionOf(file);
    var header = fileHeader(file, 16);
    var kind = "";
    if (ext === ".psb" || ext === ".psd" || ext === ".psdt") {
      if (header.substring(0, 4) === "8BPS") kind = "";
      else if (header.substring(0, 4) === "%PDF") kind = "pdf";
      else if (header.substring(0, 4) === "%!PS") kind = "eps";
      else {
      var imageKind = imageKindFromHeader(header);
        kind = imageKind || "unknown";
      }
    } else if (header.substring(0, 4) === "%PDF") {
      kind = "pdf";
    } else if (header.substring(0, 4) === "%!PS") {
      kind = "eps";
    } else if (/^\.(pdf|ai)$/i.test(ext)) {
      kind = "pdf";
    } else if (/^\.(eps)$/i.test(ext)) {
      kind = "eps";
    }

    if (cacheKey) importKindCache[cacheKey] = kind;
    return kind;
  }

  function uniqueFixedPsb(source) {
    var stem = String(source.name || "fixed").replace(/\.[^\.]+$/, "");
    var file = File(source.parent.fsName + "/" + safeName(stem) + "__fixed.psb");
    var n = 2;
    while (file.exists) {
      file = File(source.parent.fsName + "/" + safeName(stem) + "__fixed_" + n + ".psb");
      n++;
    }
    return file;
  }

  function existingFixedPsb(source) {
    var stem = safeName(String(source.name || "fixed").replace(/\.[^\.]+$/, ""));
    var file = File(source.parent.fsName + "/" + stem + "__fixed.psb");
    if (file.exists && importKind(file) === "") return file;

    for (var n = 2; n <= 200; n++) {
      file = File(source.parent.fsName + "/" + stem + "__fixed_" + n + ".psb");
      if (file.exists && importKind(file) === "") return file;
      if (!file.exists) break;
    }
    return null;
  }

  function uniqueTempImportFile(source, kind) {
    var folder = Folder(Folder.temp.fsName + "/psb-smart-object-import-fix");
    if (!folder.exists) folder.create();
    var extMap = {
      eps: ".eps",
      pdf: ".pdf",
      jpeg: ".jpg",
      png: ".png",
      tiff: ".tif",
      gif: ".gif",
      webp: ".webp"
    };
    var ext = extMap[kind] || ".psb";
    var stem = safeName(String(source.name || "import").replace(/\.[^\.]+$/, "")) + "_" + timestamp();
    return File(folder.fsName + "/" + stem + ext);
  }

  function pdfOpenOptions() {
    var opts = new PDFOpenOptions();
    try { opts.antiAlias = true; } catch (e) {}
    try { opts.resolution = 300; } catch (e) {}
    try { opts.mode = OpenDocumentMode.RGB; } catch (e) {}
    try { opts.bitsPerChannel = BitsPerChannelType.EIGHT; } catch (e) {}
    try { opts.page = 1; } catch (e) {}
    try { opts.cropPage = CropToType.BOUNDINGBOX; } catch (e) {}
    return opts;
  }

  function epsOpenOptions() {
    var opts = new EPSOpenOptions();
    try { opts.antiAlias = true; } catch (e) {}
    try { opts.resolution = 300; } catch (e) {}
    try { opts.mode = OpenDocumentMode.RGB; } catch (e) {}
    try { opts.bitsPerChannel = BitsPerChannelType.EIGHT; } catch (e) {}
    return opts;
  }

  function saveActiveDocumentAsPsb(target) {
    var oldCompatibility = null;
    var changedCompatibility = false;

    try {
      oldCompatibility = app.preferences.maximizeCompatibility;
      app.preferences.maximizeCompatibility = QueryStateType.NEVER;
      changedCompatibility = true;
    } catch (e) {}

    try {
      var desc = new ActionDescriptor();
      var options = new ActionDescriptor();
      try { options.putBoolean(stringIDToTypeID("maximizeCompatibility"), false); } catch (optionError) {}
      desc.putObject(charIDToTypeID("As  "), charIDToTypeID("Pht8"), options);
      desc.putPath(charIDToTypeID("In  "), target);
      desc.putBoolean(charIDToTypeID("LwCs"), true);
      executeAction(charIDToTypeID("save"), desc, DialogModes.NO);
    } finally {
      if (changedCompatibility) {
        try { app.preferences.maximizeCompatibility = oldCompatibility; } catch (restoreError) {}
      }
    }
  }

  function openImportFile(file, kind) {
    if (kind === "eps") return app.open(file, epsOpenOptions());
    if (kind === "pdf") return app.open(file, pdfOpenOptions());
    return app.open(file);
  }

  function repairImportFileToPsb(source, target) {
    var kind = importKind(source);
    if (!kind || kind === "unknown") throw new Error("不支持自动修复的文件内容");

    var oldDialogs = app.displayDialogs;
    var mainDoc = doc;
    var temp = uniqueTempImportFile(source, kind);
    var opened = null;

    try {
      if (!source.copy(temp)) throw new Error("创建临时导入文件失败");
      app.displayDialogs = DialogModes.NO;
      opened = openImportFile(temp, kind);
      saveActiveDocumentAsPsb(target);
      opened.close(SaveOptions.DONOTSAVECHANGES);
      opened = null;
      target = File(target.fsName);
      if (!target.exists) throw new Error("修复后 PSB 文件不存在");
      app.activeDocument = mainDoc;
      return target;
    } finally {
      try { if (opened) opened.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {}
      try { if (temp.exists) temp.remove(); } catch (removeError) {}
      app.displayDialogs = oldDialogs;
      try { app.activeDocument = mainDoc; } catch (activeError) {}
    }
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

  function pushIndex(map, key, file) {
    key = normalizeFileKey(key);
    if (!key) return;
    if (!map[key]) map[key] = [];
    map[key].push(file);
  }

  function wantedKey(set, key) {
    key = normalizeFileKey(key);
    return !!(key && set && set[key]);
  }

  function idFromName(name) {
    var m = String(name || "").match(/__id(\d+)/i);
    return m ? m[1] : "";
  }

  function generatedCoreName(name) {
    var stem = stemOf(name);
    stem = stem.replace(/^.*__\d{3}__/, "");
    stem = stem.replace(/__id\d+(?:_\d+)?$/i, "");
    return stem;
  }

  function addFileToIndex(file, index, targets) {
    var name = file.name;
    var exact = normalizeFileKey(name);
    var stem = normalizeFileKey(stemOf(name));
    var core = normalizeFileKey(generatedCoreName(name));
    var id = idFromName(name);

    if (!targets || wantedKey(targets.exact, exact)) pushIndex(index.exact, name, file);
    if (!targets || wantedKey(targets.stem, stem)) pushIndex(index.stem, stemOf(name), file);
    if (!targets || wantedKey(targets.core, core)) pushIndex(index.core, generatedCoreName(name), file);
    if (id && (!targets || wantedKey(targets.id, id))) pushIndex(index.id, id, file);
  }

  function scanFolder(folder, index, targets) {
    var queue = [{ folder: folder, depth: 0 }];
    var q = 0;
    while (q < queue.length) {
      var current = queue[q++];
      if (current.depth > MAX_SEARCH_DEPTH) {
        index.stats.tooDeep++;
        log("跳过过深目录: " + current.folder.fsName);
        continue;
      }

      var files = [];
      try {
        files = current.folder.getFiles();
      } catch (e) {
        index.stats.folderErrors++;
        log("扫描目录失败: " + current.folder.fsName + " | " + e);
        continue;
      }

      index.stats.folders++;
      for (var i = 0; i < files.length; i++) {
        var entry = files[i];
        if (entry instanceof Folder) {
          queue.push({ folder: entry, depth: current.depth + 1 });
        } else if (entry instanceof File) {
          index.stats.files++;
          addFileToIndex(entry, index, targets);
        }
      }
    }
  }

  function markTarget(set, key) {
    key = normalizeFileKey(key);
    if (key) set[key] = true;
  }

  function targetKeysForMissing(missingItems) {
    var targets = { exact: {}, stem: {}, core: {}, id: {} };
    for (var i = 0; i < missingItems.length; i++) {
      var item = missingItems[i];
      var expected = expectedFileName(item);
      if (expected) {
        markTarget(targets.exact, expected);
        markTarget(targets.stem, stemOf(expected));
        markTarget(targets.core, generatedCoreName(expected));
      }
      if (item && item.id) markTarget(targets.id, String(item.id));
      if (item && item.name) markTarget(targets.core, generatedCoreName(item.name));
    }
    return targets;
  }

  function stemCandidates(index, expected) {
    var targetStem = normalizeFileKey(stemOf(expected));
    return index.stem[targetStem] || [];
  }

  function uniqueByPath(files) {
    var seen = {};
    var out = [];
    for (var i = 0; i < files.length; i++) {
      var key = "";
      try {
        key = files[i].fsName.toLowerCase();
      } catch (e) {
        key = String(files[i]);
      }
      if (seen[key]) continue;
      seen[key] = true;
      out.push(files[i]);
    }
    return out;
  }

  function candidatePaths(files) {
    var out = [];
    for (var i = 0; i < files.length; i++) out.push("  候选: " + files[i].fsName);
    return out;
  }

  function relinkCandidates(index, item, expected) {
    var groups = [];
    groups.push({ reason: "精确文件名", files: index.exact[normalizeFileKey(expected)] || [] });
    groups.push({ reason: "同名 stem", files: stemCandidates(index, expected) });
    groups.push({ reason: "当前 layer id", files: index.id[String(item.id)] || [] });
    groups.push({ reason: "导出文件核心名", files: index.core[normalizeFileKey(generatedCoreName(expected))] || [] });
    groups.push({ reason: "图层名核心名", files: index.core[normalizeFileKey(generatedCoreName(item.name))] || [] });

    for (var i = 0; i < groups.length; i++) {
      var files = uniqueByPath(groups[i].files);
      if (files.length === 1) return { files: files, reason: groups[i].reason };
      if (files.length > 1) return { files: files, reason: groups[i].reason, ambiguous: true };
    }
    return { files: [], reason: "" };
  }

  function cacheKeyForFile(file) {
    try {
      return String(file.fsName || file.name).toLowerCase();
    } catch (e) {
      return String(file);
    }
  }

  function repairedPsbFor(source) {
    var key = cacheKeyForFile(source);
    if (repairCache[key] && repairCache[key].exists) return repairCache[key];

    var fixed = existingFixedPsb(source);
    if (fixed) {
      repairCache[key] = fixed;
      reusedFixedCount++;
      return fixed;
    }

    fixed = repairImportFileToPsb(source, uniqueFixedPsb(source));
    repairCache[key] = fixed;
    repairedCount++;
    return fixed;
  }

  function prepareRelinkTasks(missingItems, fileIndex) {
    var tasks = [];

    for (var j = 0; j < missingItems.length; j++) {
      var item = missingItems[j];
      var expected = expectedFileName(item);
      if (!expected) {
        failedCount++;
        log("失败，无法读取原文件名: " + item.path + " | " + item.meta.fileReference);
        continue;
      }

      var resolved = relinkCandidates(fileIndex, item, expected);
      var matches = resolved.files;
      if (matches.length === 0) {
        failedCount++;
        log("失败，未找到同名文件: " + item.path + " | " + expected);
        var loose = stemCandidates(fileIndex, expected);
        if (loose.length) {
          log("  找到同名不同扩展候选，未自动重链:");
          var looseLines = candidatePaths(loose);
          for (var looseIndex = 0; looseIndex < looseLines.length; looseIndex++) log(looseLines[looseIndex]);
        }
        continue;
      }

      if (matches.length > 1 || resolved.ambiguous) {
        skippedCount++;
        log("跳过，候选多个: " + item.path + " | " + expected + " | 规则 " + resolved.reason + " | 数量 " + matches.length);
        var lines = candidatePaths(matches);
        for (var m = 0; m < lines.length; m++) log(lines[m]);
        continue;
      }

      try {
        var target = matches[0];
        if (relinkWouldShowImportDialog(target)) {
          log("检测到非原生 PSB，准备修复: " + target.fsName);
          target = repairedPsbFor(target);
          logSuccess("可用真 PSB: " + target.fsName);
        }

        tasks.push({
          item: item,
          expected: expected,
          target: target,
          reason: resolved.reason
        });
      } catch (ePrepare) {
        failedCount++;
        log("准备重链失败: " + item.path + " | " + expected + " | " + ePrepare);
      }
    }

    return tasks;
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

  function shouldWriteLog() {
    if (failedCount > 0) return true;
    for (var i = 0; i < logLines.length; i++) {
      if (/失败|候选多个|扫描目录失败|跳过过深目录|不支持自动修复/.test(logLines[i])) return true;
    }
    return false;
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
      f.writeln("自动修复: " + repairedCount);
      f.writeln("复用修复: " + reusedFixedCount);
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
    var fileIndex = {
      exact: {},
      stem: {},
      core: {},
      id: {},
      stats: { folders: 0, files: 0, tooDeep: 0, folderErrors: 0 }
    };
    var targetKeys = targetKeysForMissing(missing);
    scanFolder(searchFolder, fileIndex, targetKeys);
    log("已扫描目录: " + fileIndex.stats.folders + " | 文件: " + fileIndex.stats.files + " | 最大深度: " + MAX_SEARCH_DEPTH);

    var relinkTasks = prepareRelinkTasks(missing, fileIndex);

    function relinkAllMissingSmartObjects() {
      for (var j = 0; j < relinkTasks.length; j++) {
      var task = relinkTasks[j];
      try {
        selectLayerById(task.item.id);
        relinkSelectedSmartObject(task.target);
        relinkedCount++;
        logSuccess("已重链: " + task.item.path + " | " + task.expected + " -> " + task.target.fsName + " | 规则: " + task.reason);
      } catch (eRelink) {
        failedCount++;
        log("重链失败: " + task.item.path + " | " + task.expected + " | " + eRelink);
      }
    }
    }

    runAsOneHistory("批量重新链接丢失智能对象", relinkAllMissingSmartObjects);

    var logFile = shouldWriteLog() ? writeLog() : null;
    var summary = failureSummary(6);
    alert("完成。\n\n已重链：" + relinkedCount + "\n自动修复：" + repairedCount + "\n复用修复：" + reusedFixedCount + "\n已跳过：" + skippedCount + "\n失败：" + failedCount + "\n\n主文档未自动保存，请检查后手动保存。" + (summary ? "\n\n失败摘要：\n" + summary : "") + (logFile ? "\n\n日志：" + logFile.fsName : ""));
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
