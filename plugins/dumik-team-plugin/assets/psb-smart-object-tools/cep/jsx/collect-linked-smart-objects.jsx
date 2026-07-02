#target photoshop

/*
  collect-linked-smart-objects.jsx

  批量收集当前文档里的链接智能对象源文件：
  - 复制源文件到主 PSB 同级的“主文件名_links”文件夹。
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
  var doc = app.activeDocument;
  var logLines = [];
  var collectedCount = 0;
  var skippedCount = 0;
  var failedCount = 0;

  function log(msg) {
    logLines.push(msg);
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
    var ext = extensionOf(file).toLowerCase();
    var header = fileHeader(file, 8);
    if (ext === ".psb" || ext === ".psd" || ext === ".psdt") {
      return header.substring(0, 4) !== "8BPS";
    }
    if (header.substring(0, 4) === "%PDF") return true;
    if (header.substring(0, 4) === "%!PS") return true;
    if (/^\.(pdf|ai|eps)$/i.test(ext)) return true;
    return false;
  }

  function outputFolder() {
    try {
      if (!doc.path) {
        alert("请先保存主 PSB，再运行脚本。\n\n链接文件会收集到主文件旁边的“主文件名_links”文件夹。");
        return null;
      }
      var folder = Folder(doc.path.fsName + "/" + safeName(docBaseName()) + LINKS_FOLDER_SUFFIX);
      if (!folder.exists) folder.create();
      return folder;
    } catch (e) {
      alert("创建“主文件名_links”文件夹失败：\n" + e);
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
      f.writeln("目标目录: " + folder.fsName);
      f.writeln("");
      f.writeln("收集并重链: " + collectedCount);
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
    if (!folder) return;

    var items = [];
    collectSmartObjects(items);

    var linkedCount = 0;
    for (var i = 0; i < items.length; i++) {
      if (items[i].meta && items[i].meta.linked) linkedCount++;
    }

    if (!items.length || !linkedCount) {
      alert("当前文档没有找到链接智能对象。");
      return;
    }

    var ok = confirm("找到智能对象：" + items.length + " 个\n其中链接智能对象：" + linkedCount + " 个\n\n将源文件复制到：\n" + folder.fsName + "\n\n并把图层重新链接到复制后的文件。\n脚本不会自动保存主 PSB。");
    if (!ok) return;

    function collectAndRelinkAll() {
      for (var j = 0; j < items.length; j++) {
      var item = items[j];
      if (!item.meta || !item.meta.linked) {
        skippedCount++;
        log("跳过内嵌: " + item.path);
        continue;
      }
      if (item.meta.linkMissing) {
        failedCount++;
        log("失败，链接缺失: " + item.path + " | " + item.meta.fileReference);
        continue;
      }
      if (!item.meta.linkPath) {
        failedCount++;
        log("失败，无法读取源路径: " + item.path + " | " + item.meta.fileReference);
        continue;
      }

      var source = File(item.meta.linkPath);
      if (!source.exists) {
        failedCount++;
        log("失败，源文件不存在: " + item.path + " | " + item.meta.linkPath);
        continue;
      }
      if (relinkWouldShowImportDialog(source)) {
        skippedCount++;
        log("跳过，文件会触发导入窗口，请手动收集/重链: " + item.path + " | " + source.fsName);
        continue;
      }
      if (isInsideFolder(source, folder)) {
        skippedCount++;
        log("跳过，已经在目标目录: " + item.path + " | " + source.fsName);
        continue;
      }

      var target = uniqueFile(folder, source, item.name, j + 1, item.id);
      try {
        source.copy(target);
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
    }

    runAsOneHistory("收集链接对象并重链", collectAndRelinkAll);

    var logFile = writeLog(folder);
    alert("完成。\n\n已收集并重链：" + collectedCount + "\n已跳过：" + skippedCount + "\n失败：" + failedCount + "\n\n主文档未自动保存，请检查后手动保存。" + (logFile ? "\n\n日志：" + logFile.fsName : ""));
  } catch (e) {
    alert("脚本出错: " + e + (e && e.line ? "\n行: " + e.line : ""));
  }
})();
