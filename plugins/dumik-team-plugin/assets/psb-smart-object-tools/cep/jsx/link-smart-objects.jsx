#target photoshop

/*
  批量转为链接智能对象_v1.jsx

  用法：
  1. Photoshop 打开一个 PS/PSB 副本文件。
  2. 文件 > 脚本 > 浏览... 运行本脚本。
  3. 选择外部智能对象保存目录。
  4. 脚本会把当前文档里的“内嵌智能对象”逐个转为“链接智能对象”。

  说明：
  - 只处理当前打开的主文档，不自动打开文件夹里的所有 PSB。
  - 会递归扫描当前文档的图层组。
  - 已经是链接智能对象的图层会跳过。
  - 外部对象统一保存为 .psb，避免 2GB 限制。
  - 转链接会改当前文档，但脚本不会自动保存主文档。
*/

(function () {
  if (!app.documents.length) {
    alert("请先打开一个 PS/PSB 文件。");
    return;
  }

  var EXTENSION = ".psb";
  var LINKS_FOLDER_SUFFIX = "_links";
  var DISABLE_MAX_COMPATIBILITY_DURING_RUN = true;
  var SAVE_MAIN_DOCUMENT = false;
  var SKIP_LINKED = true;

  var doc = app.activeDocument;
  var originalRulerUnits = app.preferences.rulerUnits;
  var originalMaximizeCompatibility = null;
  var hasOriginalMaximizeCompatibility = false;
  app.preferences.rulerUnits = Units.PIXELS;

  var logLines = [];
  var convertedCount = 0;
  var skippedCount = 0;
  var failedCount = 0;

  function log(msg) {
    logLines.push(msg);
  }

  function runAsOneHistory(name, fn) {
    app.activeDocument.suspendHistory(name, "(" + fn.toString() + ")()");
  }

  function px(v) {
    try {
      return v.as("px");
    } catch (e) {
      return Number(v);
    }
  }

  function docBaseName() {
    var name = String(doc.name || "未命名");
    return name.replace(/\.[^\.]+$/, "");
  }

  function safeName(name) {
    name = String(name || "smart_object");
    name = name.replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
    name = name.replace(/^\s+|\s+$/g, "");
    name = name.replace(/\s+/g, "_");
    if (!name) name = "smart_object";
    if (name.length > 80) name = name.substring(0, 80);
    return name;
  }

  function safeDocName() {
    try {
      return app.activeDocument.name;
    } catch (e) {
      return "[无法读取文件名]";
    }
  }

  function activeLayerDescriptor() {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    return executeActionGet(ref);
  }

  function smartObjectMetaFromDescriptor(desc) {
    var meta = {
      isSmart: false,
      linked: false,
      linkMissing: false,
      fileReference: "",
      ok: false,
      error: ""
    };

    try {
      var smartObjectKey = stringIDToTypeID("smartObject");
      if (!desc.hasKey(smartObjectKey)) return meta;

      var so = desc.getObjectValue(smartObjectKey);
      meta.isSmart = true;

      var linkedKey = stringIDToTypeID("linked");
      var linkMissingKey = stringIDToTypeID("linkMissing");
      var fileReferenceKey = stringIDToTypeID("fileReference");

      if (so.hasKey(linkedKey)) meta.linked = so.getBoolean(linkedKey);
      if (so.hasKey(linkMissingKey)) meta.linkMissing = so.getBoolean(linkMissingKey);
      if (so.hasKey(fileReferenceKey)) meta.fileReference = so.getString(fileReferenceKey);
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

  function uniqueFile(folder, baseName, index, layerIdValue) {
    var stem = safeName(docBaseName()) + "__" + pad(index, 3) + "__" + safeName(baseName) + "__id" + layerIdValue;
    var file = File(folder.fsName + "/" + stem + EXTENSION);
    var n = 2;
    while (file.exists) {
      file = File(folder.fsName + "/" + stem + "_" + n + EXTENSION);
      n++;
    }
    return file;
  }

  function pad(n, width) {
    var s = String(n);
    while (s.length < width) s = "0" + s;
    return s;
  }

  function convertActiveEmbeddedToLinked(file) {
    var idplacedLayerConvertToLinked = stringIDToTypeID("placedLayerConvertToLinked");
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    desc.putReference(charIDToTypeID("null"), ref);
    desc.putPath(charIDToTypeID("Usng"), file);
    executeAction(idplacedLayerConvertToLinked, desc, DialogModes.NO);
  }

  function chooseOutputFolder() {
    try {
      if (!doc.path) {
        alert("请先保存主 PSB，再运行脚本。\n\n链接文件会统一放到主文件旁边的“主文件名_links”文件夹。");
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

  function disableMaxCompatibility() {
    if (!DISABLE_MAX_COMPATIBILITY_DURING_RUN) return;
    try {
      originalMaximizeCompatibility = app.preferences.maximizeCompatibility;
      hasOriginalMaximizeCompatibility = true;
      app.preferences.maximizeCompatibility = QueryStateType.NEVER;
      log("运行期间已关闭最大兼容性保存。");
    } catch (e) {
      log("关闭最大兼容性保存失败，继续执行: " + e);
    }
  }

  function restoreMaxCompatibility() {
    if (!hasOriginalMaximizeCompatibility) return;
    try {
      app.preferences.maximizeCompatibility = originalMaximizeCompatibility;
      log("已恢复原来的最大兼容性保存设置。");
    } catch (e) {
      log("恢复最大兼容性保存设置失败: " + e);
    }
  }

  function timestamp() {
    var d = new Date();
    function p(n) { return n < 10 ? "0" + n : String(n); }
    return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + "_" + p(d.getHours()) + p(d.getMinutes()) + p(d.getSeconds());
  }

  function logPath(folder) {
    return File(folder.fsName + "/" + safeName(docBaseName()) + "_转链接日志_" + timestamp() + ".txt");
  }

  function writeLog(folder) {
    try {
      var f = logPath(folder);
      f.encoding = "UTF-8";
      f.open("w");
      f.writeln("批量转为链接智能对象 v1 日志");
      f.writeln("文件: " + safeDocName());
      f.writeln("时间: " + new Date());
      f.writeln("输出目录: " + folder.fsName);
      f.writeln("");
      f.writeln("转换: " + convertedCount);
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
    log("脚本启动");
    var outputFolder = chooseOutputFolder();
    if (!outputFolder) return;
    disableMaxCompatibility();

    var items = [];
    collectSmartObjects(items);

    if (!items.length) {
      alert("当前文档没有找到智能对象。");
      return;
    }

    var embeddedCount = 0;
    for (var i = 0; i < items.length; i++) {
      if (!items[i].meta || !items[i].meta.linked) embeddedCount++;
    }

    var ok = confirm(
      "找到智能对象：" + items.length + " 个\n" +
      "其中内嵌待转换：" + embeddedCount + " 个\n\n" +
      "链接文件夹：\n" + outputFolder.fsName + "\n\n" +
      "脚本会修改当前文档，但不会自动保存主文档。\n请确认你正在副本文件上测试。"
    );
    if (!ok) return;

    function convertAllEmbeddedToLinked() {
      for (var j = 0; j < items.length; j++) {
      var item = items[j];
      try {
        selectLayerById(item.id);
      } catch (selectError) {
        failedCount++;
        log("失败: 无法选中 | " + item.path + " | " + selectError);
        continue;
      }

      var freshMeta = smartObjectMetaFromDescriptor(activeLayerDescriptor());
      if (SKIP_LINKED && freshMeta.linked) {
        skippedCount++;
        log("跳过已链接: " + item.path + " | " + freshMeta.fileReference);
        continue;
      }

      var outFile = uniqueFile(outputFolder, item.name, j + 1, item.id);
      try {
        convertActiveEmbeddedToLinked(outFile);
        convertedCount++;
        log("已转换: " + item.path + " -> " + outFile.fsName);
      } catch (convertError) {
        failedCount++;
        log("失败: " + item.path + " -> " + outFile.fsName + " | " + convertError);
      }
    }
    }

    runAsOneHistory("批量转链接智能对象", convertAllEmbeddedToLinked);

    if (SAVE_MAIN_DOCUMENT) {
      try {
        doc.save();
        log("主文档已保存。");
      } catch (saveError) {
        log("主文档保存失败: " + saveError);
      }
    } else {
      log("主文档未自动保存，请检查后手动保存。");
    }

    var logFile = writeLog(outputFolder);
    alert(
      "完成。\n\n" +
      "已转换：" + convertedCount + "\n" +
      "已跳过：" + skippedCount + "\n" +
      "失败：" + failedCount + "\n\n" +
      "主文档没有自动保存，确认没问题后你再手动保存。\n" +
      (logFile ? "\n日志：" + logFile.fsName : "")
    );
  } catch (e) {
    alert("脚本出错: " + e + (e && e.line ? "\n行: " + e.line : ""));
  } finally {
    restoreMaxCompatibility();
    app.preferences.rulerUnits = originalRulerUnits;
  }
})();
