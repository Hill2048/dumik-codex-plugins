#target photoshop

/*
  collect-linked-smart-objects.jsx

  批量收集当前文档里的链接智能对象源文件：
  - 复制源文件到主 PSB 同级的 links\主文件名_links 文件夹。
  - 重新链接图层到复制后的文件。
  - 已经在目标文件夹里的链接跳过。
  - 不自动保存主文档。
*/

(function () {
  if (!app.documents.length) {
    alert("请先打开一个 PS/PSB 文件。");
    return;
  }

  var LINKS_FOLDER_SUFFIX = "_links";
  var LINKS_ROOT_FOLDER = "links";
  var MAX_OPEN_PROXY_BATCH = 4;
  var doc = app.activeDocument;
  var logLines = [];
  var collectedCount = 0;
  var repairedCount = 0;
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

  function runAsOneHistory(name, fn) {
    app.activeDocument.suspendHistory(name, "(" + fn.toString() + ")()");
  }

  function docBaseName() {
    return String(doc.name || "未命名").replace(/\.[^\.]+$/, "");
  }

  function safeName(name) {
    var s = String(name || "smart_object").replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
    s = s.replace(/^\s+|\s+$/g, "").replace(/\s+/g, "_");
    if (!s) s = "smart_object";
    if (s.length > 80) s = s.substring(0, 80);
    return s;
  }

  function safeDocName() {
    try {
      return app.activeDocument.name;
    } catch (e) {
      return "[无法读取文件名]";
    }
  }

  function isProxyName(name) {
    return /(^|[_\-\s])proxy(\.psb)?$/i.test(String(name || "").replace(/\.[^\.\\\/]+$/, ""));
  }

  function isProxySmartObject(meta, layerName) {
    if (isProxyName(layerName)) return true;
    if (meta && isProxyName(meta.fileReference)) return true;
    if (meta && isProxyName(meta.linkPath)) return true;
    return false;
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
      if (!meta.linkPath && meta.fileReference && File(meta.fileReference).exists) {
        meta.linkPath = File(meta.fileReference).fsName;
      }
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

  function editSmartObjectContents() {
    executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
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
    var ext = extensionOf(file).toLowerCase();
    var header = fileHeader(file, 16);
    if (ext === ".psb" || ext === ".psd" || ext === ".psdt") {
      if (header.substring(0, 4) === "8BPS") return "";
      if (header.substring(0, 4) === "%PDF") return "pdf";
      if (header.substring(0, 4) === "%!PS") return "eps";
      var imageKind = imageKindFromHeader(header);
      if (imageKind) return imageKind;
      return "unknown";
    }
    if (header.substring(0, 4) === "%PDF") return "pdf";
    if (header.substring(0, 4) === "%!PS") return "eps";
    if (/^\.(pdf|ai)$/i.test(ext)) return "pdf";
    if (/^\.(eps)$/i.test(ext)) return "eps";
    return "";
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
      app.preferences.maximizeCompatibility = QueryStateType.ALWAYS;
      changedCompatibility = true;
    } catch (e) {}

    try {
      var desc = new ActionDescriptor();
      var options = new ActionDescriptor();
      try { options.putBoolean(stringIDToTypeID("maximizeCompatibility"), true); } catch (optionError) {}
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

  function outputFolder() {
    try {
      if (!doc.path) {
        alert("请先保存主 PSB，再运行脚本。\n\n链接文件会收集到主文件旁边的 links\\主文件名_links 文件夹。");
        return null;
      }
      var root = Folder(doc.path.fsName + "/" + LINKS_ROOT_FOLDER);
      if (!root.exists) root.create();
      var folder = Folder(root.fsName + "/" + safeName(docBaseName()) + LINKS_FOLDER_SUFFIX);
      if (!folder.exists) folder.create();
      return folder;
    } catch (e) {
      alert("创建 links\\主文件名_links 文件夹失败：\n" + e);
      return null;
    }
  }

  function extensionOf(file) {
    var name = String(file.name || "");
    var m = name.match(/(\.[^\.]+)$/);
    return m ? m[1] : ".psb";
  }

  function uniqueFile(folder, sourceFile, layerNameValue, index, layerIdValue) {
    var ext = extensionOf(sourceFile);
    return uniqueFileWithExtension(folder, ext, layerNameValue, index, layerIdValue);
  }

  function uniqueFileWithExtension(folder, ext, layerNameValue, index, layerIdValue) {
    var stem = safeName(docBaseName()) + "__" + pad(index, 3) + "__" + safeName(layerNameValue) + "__id" + layerIdValue;
    var file = File(folder.fsName + "/" + stem + ext);
    var n = 2;
    while (file.exists) {
      file = File(folder.fsName + "/" + stem + "_" + n + ext);
      n++;
    }
    return file;
  }

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = "0" + s;
    return s;
  }

  function sameFile(a, b) {
    try {
      return File(a).fsName.toLowerCase() === File(b).fsName.toLowerCase();
    } catch (e) {
      return false;
    }
  }

  function isInsideFolder(file, folder) {
    try {
      var filePath = File(file).fsName.toLowerCase();
      var folderPath = Folder(folder).fsName.toLowerCase();
      return filePath.indexOf(folderPath + "\\") === 0 || filePath.indexOf(folderPath + "/") === 0;
    } catch (e) {
      return false;
    }
  }

  function timestamp() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : String(n); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function writeLog(folder) {
    try {
      var f = File(folder.fsName + "/" + safeName(docBaseName()) + "_收集链接对象日志_" + timestamp() + ".txt");
      f.encoding = "UTF-8";
      f.open("w");
      f.writeln("批量收集链接智能对象日志");
      f.writeln("文件: " + safeDocName());
      f.writeln("时间: " + new Date());
      f.writeln("耗时: " + elapsedText());
      f.writeln("目标目录: " + folder.fsName);
      f.writeln("");
      f.writeln("收集并重链: " + collectedCount);
      f.writeln("自动修复: " + repairedCount);
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

  function shouldWriteLog() {
    return failedCount > 0;
  }

  function collectOneLinkedItem(item, folder, index) {
    if (item.meta.linkMissing) {
      failedCount++;
      log("失败，链接缺失: " + item.path + " | " + item.meta.fileReference);
      return;
    }
    if (!item.meta.linkPath) {
      failedCount++;
      log("失败，无法读取源路径: " + item.path + " | " + item.meta.fileReference);
      return;
    }

    var source = File(item.meta.linkPath);
    if (!source.exists) {
      failedCount++;
      log("失败，源文件不存在: " + item.path + " | " + item.meta.linkPath);
      return;
    }
    if (isInsideFolder(source, folder)) {
      skippedCount++;
      log("跳过，已经在目标目录: " + item.path + " | " + source.fsName);
      return;
    }

    var needsRepair = relinkWouldShowImportDialog(source);
    var target = needsRepair ? uniqueFileWithExtension(folder, ".psb", item.name, index + 1, item.id) : uniqueFile(folder, source, item.name, index + 1, item.id);
    try {
      if (needsRepair) {
        log("检测到非原生 PSB，自动包一层修复: " + source.fsName);
        repairImportFileToPsb(source, target);
        repairedCount++;
      } else {
        source.copy(target);
      }
      if (!target.exists) throw new Error("复制后目标文件不存在");
      selectLayerById(item.id);
      relinkSelectedSmartObject(target);
      collectedCount++;
      log("已收集并重链: " + item.path + " | " + source.fsName + " -> " + target.fsName);
    } catch (eCollect) {
      failedCount++;
      try {
        if (target.exists && !sameFile(source, target)) target.remove();
      } catch (cleanupError) {}
      log("收集失败: " + item.path + " | " + eCollect);
    }
  }

  function collectProxyInternalLinks(item, folder) {
    var parentDoc = app.activeDocument;
    var childDoc = null;
    try {
      selectLayerById(item.id);
      editSmartObjectContents();
      childDoc = app.activeDocument;
      if (childDoc === parentDoc) throw new Error("代理智能对象没有打开");

      var childItems = [];
      collectSmartObjects(childItems);
      for (var i = 0; i < childItems.length; i++) {
        var child = childItems[i];
        child.path = item.path + " / " + child.name;
        if (child.meta && child.meta.linked) {
          collectOneLinkedItem(child, folder, i);
        }
      }
      childDoc.close(SaveOptions.SAVECHANGES);
      childDoc = null;
      app.activeDocument = parentDoc;
    } catch (eProxy) {
      failedCount++;
      log("代理内部收集失败: " + item.path + " | " + eProxy);
    } finally {
      try { if (childDoc) childDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {}
      try { app.activeDocument = parentDoc; } catch (activeError) {}
    }
  }

  function flushProxyCollectBatch(batch, folder) {
    if (!batch.length) return;

    var parentDoc = app.activeDocument;
    var opened = [];
    for (var i = 0; i < batch.length; i++) {
      var item = batch[i];
      try {
        app.activeDocument = parentDoc;
        selectLayerById(item.id);
        editSmartObjectContents();
        var childDoc = app.activeDocument;
        if (childDoc === parentDoc) throw new Error("代理智能对象没有打开");
        opened.push({ item: item, childDoc: childDoc });
      } catch (openError) {
        failedCount++;
        log("代理内部打开失败: " + item.path + " | " + openError);
        try { app.activeDocument = parentDoc; } catch (activeError) {}
      }
    }

    for (var j = 0; j < opened.length; j++) {
      var task = opened[j];
      try {
        app.activeDocument = task.childDoc;
        var childItems = [];
        collectSmartObjects(childItems);
        for (var k = 0; k < childItems.length; k++) {
          var child = childItems[k];
          child.path = task.item.path + " / " + child.name;
          if (child.meta && child.meta.linked) {
            collectOneLinkedItem(child, folder, k);
          }
        }
        task.childDoc.close(SaveOptions.SAVECHANGES);
        task.childDoc = null;
      } catch (eProxy) {
        failedCount++;
        log("代理内部收集失败: " + task.item.path + " | " + eProxy);
      } finally {
        try { if (task.childDoc) task.childDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {}
        try { app.activeDocument = parentDoc; } catch (activeError2) {}
      }
    }

    batch.length = 0;
  }

  try {
    var folder = outputFolder();
    if (!folder) return;

    var items = [];
    collectSmartObjects(items);

    var linkedCount = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].meta && items[i].meta.linked && !isProxySmartObject(items[i].meta, items[i].name)) linkedCount++;
      else if (isProxySmartObject(items[i].meta, items[i].name)) linkedCount++;
    }

    if (!items.length || !linkedCount) {
      alert("当前文档没有找到链接智能对象。");
      return;
    }

    var ok = confirm("找到智能对象：" + items.length + " 个\n其中链接智能对象：" + linkedCount + " 个\n\n代理内部会按 " + MAX_OPEN_PROXY_BATCH + " 个一批处理。\n\n将源文件复制到：\n" + folder.fsName + "\n\n并把图层重新链接到复制后的文件。\n脚本不会自动保存主 PSB。");
    if (!ok) return;

    function collectAndRelinkAll() {
      var proxyBatch = [];
      for (var j = 0; j < items.length; j++) {
      var item = items[j];
      if (isProxySmartObject(item.meta, item.name)) {
        proxyBatch.push(item);
        if (proxyBatch.length >= MAX_OPEN_PROXY_BATCH) flushProxyCollectBatch(proxyBatch, folder);
        continue;
      }
      if (!item.meta || !item.meta.linked) {
        skippedCount++;
        log("跳过内嵌: " + item.path);
        continue;
      }
      collectOneLinkedItem(item, folder, j);
    }
      flushProxyCollectBatch(proxyBatch, folder);
    }

    runAsOneHistory("收集链接对象并重链", collectAndRelinkAll);

    var logFile = shouldWriteLog() ? writeLog(folder) : null;
    alert("完成。\n\n已收集并重链：" + collectedCount + "\n自动修复：" + repairedCount + "\n已跳过：" + skippedCount + "\n失败：" + failedCount + "\n耗时：" + elapsedText() + "\n\n主文档未自动保存，请检查后手动保存。" + (logFile ? "\n\n日志：" + logFile.fsName : ""));
  } catch (e) {
    alert("脚本出错: " + e + (e && e.line ? "\n行: " + e.line : ""));
  }
})();
