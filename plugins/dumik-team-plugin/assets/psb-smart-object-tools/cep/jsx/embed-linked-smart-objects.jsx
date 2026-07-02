#target photoshop

/*
  embed-linked-smart-objects.jsx

  批量把当前文档里的“链接智能对象”转回“嵌入智能对象”。
  - 只处理当前打开文档。
  - 递归扫描图层组。
  - 已经是内嵌智能对象的跳过。
  - 不自动保存主文档。
*/

(function () {
  if (!app.documents.length) {
    alert("请先打开一个 PS/PSB 文件。");
    return;
  }

  var doc = app.activeDocument;
  var logLines = [];
  var embeddedCount = 0;
  var skippedCount = 0;
  var failedCount = 0;

  function log(msg) {
    logLines.push(msg);
  }

  function runAsOneHistory(name, fn) {
    app.activeDocument.suspendHistory(name, "(" + fn.toString() + ")()");
  }

  function safeDocName() {
    try {
      return app.activeDocument.name;
    } catch (e) {
      return "[无法读取文件名]";
    }
  }

  function docBaseName() {
    return String(doc.name || "未命名").replace(/\.[^\.]+$/, "");
  }

  function safeFileName(name) {
    var s = String(name || "document").replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
    s = s.replace(/^\s+|\s+$/g, "").replace(/\s+/g, "_");
    return s || "document";
  }

  function smartObjectMetaFromDescriptor(desc) {
    var meta = {
      linked: false,
      fileReference: "",
      ok: false,
      error: ""
    };

    try {
      var smartObjectKey = stringIDToTypeID("smartObject");
      if (!desc.hasKey(smartObjectKey)) return meta;

      var so = desc.getObjectValue(smartObjectKey);
      var linkedKey = stringIDToTypeID("linked");
      var fileReferenceKey = stringIDToTypeID("fileReference");

      if (so.hasKey(linkedKey)) meta.linked = so.getBoolean(linkedKey);
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

  function embedSelectedLinkedSmartObject() {
    executeAction(stringIDToTypeID("placedLayerConvertToEmbedded"), undefined, DialogModes.NO);
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
      var f = File(logFolder().fsName + "/" + safeFileName(docBaseName()) + "_嵌入链接对象日志_" + timestamp() + ".txt");
      f.encoding = "UTF-8";
      f.open("w");
      f.writeln("批量嵌入链接智能对象日志");
      f.writeln("文件: " + safeDocName());
      f.writeln("时间: " + new Date());
      f.writeln("");
      f.writeln("嵌入: " + embeddedCount);
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

  try {
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

    var ok = confirm("找到智能对象：" + items.length + " 个\n其中链接智能对象：" + linkedCount + " 个\n\n将批量转为嵌入智能对象。\n脚本不会自动保存主 PSB。");
    if (!ok) return;

    function embedAllLinkedSmartObjects() {
      for (var j = 0; j < items.length; j++) {
      var item = items[j];
      if (!item.meta || !item.meta.linked) {
        skippedCount++;
        log("跳过内嵌: " + item.path);
        continue;
      }

      try {
        selectLayerById(item.id);
        embedSelectedLinkedSmartObject();
        embeddedCount++;
        log("已嵌入: " + item.path + " | " + item.meta.fileReference);
      } catch (eEmbed) {
        failedCount++;
        log("嵌入失败: " + item.path + " | " + eEmbed);
      }
    }
    }

    runAsOneHistory("批量嵌入链接智能对象", embedAllLinkedSmartObjects);

    var logFile = shouldWriteLog() ? writeLog() : null;
    alert("完成。\n\n已嵌入：" + embeddedCount + "\n已跳过：" + skippedCount + "\n失败：" + failedCount + "\n\n主文档未自动保存，请检查后手动保存。" + (logFile ? "\n\n日志：" + logFile.fsName : ""));
  } catch (e) {
    alert("脚本出错: " + e + (e && e.line ? "\n行: " + e.line : ""));
  }
})();
