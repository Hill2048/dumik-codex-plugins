#target photoshop

(function () {
  if (!app.documents.length) {
    alert("请先打开一个 PS/PSB 文件。");
    return;
  }

  var rootDoc = app.activeDocument;
  var processedDocs = 0;
  var cleanedDocs = 0;
  var removedItems = 0;
  var removedBytes = 0;
  var smartObjectsOpened = 0;
  var linkedSkipped = 0;
  var proxySkipped = 0;
  var formatSkipped = 0;
  var simpleSkipped = 0;
  var unopenableSkipped = 0;
  var failedCount = 0;
  var failures = [];
  var MAX_DEPTH = 20;
  var MIN_LAYERS_TO_CLEAN = 5;
  var includeEmbeddedSmartObjects = $.global.__psbCleanMetadataIncludeEmbedded !== false;

  function fail(message) {
    failedCount++;
    failures.push(message);
  }

  function isEditContentsUnavailable(error) {
    var msg = String(error || "");
    return msg.indexOf("编辑内容") >= 0 ||
      msg.indexOf("placedLayerEditContents") >= 0 ||
      msg.indexOf("当前不可用") >= 0 ||
      msg.indexOf("not currently available") >= 0 ||
      msg.indexOf("智能对象没有打开") >= 0;
  }

  function closeUnexpectedChild(parentDoc) {
    try {
      if (app.documents.length && app.activeDocument !== parentDoc) {
        app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
      }
    } catch (closeError) {}
  }

  function loadXmpLibrary() {
    if (ExternalObject.AdobeXMPScript === undefined) {
      ExternalObject.AdobeXMPScript = new ExternalObject("lib:AdobeXMPScript");
    }
  }

  function byteLength(value) {
    var s = String(value || "");
    var bytes = 0;
    for (var i = 0; i < s.length; i++) {
      var code = s.charCodeAt(i);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xD800 && code <= 0xDBFF) {
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    }
    return bytes;
  }

  function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return "0 KB";
    if (bytes >= 1024 * 1024) return (bytes / 1024 / 1024).toFixed(2) + " MB";
    return Math.max(1, Math.round(bytes / 1024)) + " KB";
  }

  function extensionFromName(name) {
    var s = String(name || "");
    var dot = s.lastIndexOf(".");
    if (dot < 0) return "";
    return s.substring(dot + 1).toLowerCase();
  }

  function isPsdOrPsbName(name) {
    var ext = extensionFromName(name);
    return ext === "psd" || ext === "psb";
  }

  function isProxyName(name) {
    return /(^|[_\-\s])proxy(\.psb)?$/i.test(String(name || "").replace(/\.[^\.\\\/]+$/, ""));
  }

  function isProxySmartObject(meta, layerName) {
    if (isProxyName(layerName)) return true;
    if (meta && isProxyName(meta.fileReference)) return true;
    return false;
  }

  function documentName(doc) {
    try {
      if (doc.fullName) return doc.fullName.fsName || doc.fullName.name || doc.name;
    } catch (e) {}
    return doc.name;
  }

  function safeLayerCount(doc) {
    try {
      app.activeDocument = doc;
      return layerCount(doc);
    } catch (e) {
      return 0;
    }
  }

  function cleanDocumentMetadata(doc) {
    processedDocs++;
    try {
      loadXmpLibrary();
      var namespace = "http://ns.adobe.com/photoshop/1.0/";
      var property = "DocumentAncestors";
      var beforeRaw = doc.xmpMetadata.rawData;
      var beforeBytes = byteLength(beforeRaw);
      var xmp = new XMPMeta(beforeRaw);
      var count = 0;
      try { count = xmp.countArrayItems(namespace, property); } catch (countError) {}
      xmp.deleteProperty(namespace, property);
      var afterRaw = xmp.serialize();
      doc.xmpMetadata.rawData = afterRaw;
      var delta = beforeBytes - byteLength(afterRaw);
      if (count > 0) {
        cleanedDocs++;
        removedItems += count;
        if (delta > 0) removedBytes += delta;
      }
    } catch (e) {
      fail(doc.name + " | 元数据清理失败: " + e);
    }
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
    return fallback || "";
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

  function layerCount(doc) {
    var ref = new ActionReference();
    ref.putProperty(charIDToTypeID("Prpr"), stringIDToTypeID("numberOfLayers"));
    ref.putEnumerated(charIDToTypeID("Dcmn"), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    return executeActionGet(ref).getInteger(stringIDToTypeID("numberOfLayers"));
  }

  function smartObjectMetaFromDescriptor(desc) {
    var meta = {
      linked: false,
      missing: false,
      fileReference: ""
    };
    try {
      var smartObjectKey = stringIDToTypeID("smartObject");
      if (!desc.hasKey(smartObjectKey)) return meta;
      var so = desc.getObjectValue(smartObjectKey);
      try {
        if (so.hasKey(stringIDToTypeID("linked"))) meta.linked = so.getBoolean(stringIDToTypeID("linked"));
      } catch (linkedError) {}
      try {
        if (so.hasKey(stringIDToTypeID("link"))) meta.linked = true;
      } catch (linkError) {}
      try {
        if (so.hasKey(stringIDToTypeID("linkMissing"))) meta.missing = so.getBoolean(stringIDToTypeID("linkMissing"));
      } catch (missingError) {}
      try {
        if (so.hasKey(stringIDToTypeID("fileReference"))) meta.fileReference = so.getString(stringIDToTypeID("fileReference"));
      } catch (fileReferenceError) {}
    } catch (e) {}
    return meta;
  }

  function collectSmartObjectLayers(out) {
    var count = layerCount(app.activeDocument);
    for (var i = 1; i <= count; i++) {
      try {
        var desc = layerDescriptorByIndex(i);
        if (descriptorLayerSection(desc) === "layerSectionEnd") continue;
        if (!desc.hasKey(stringIDToTypeID("smartObject"))) continue;
        out.push({
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

  function cleanDocumentTree(doc, depth) {
    if (depth > MAX_DEPTH) {
      fail(doc.name + " | 嵌套超过 " + MAX_DEPTH + " 层，已停止");
      return false;
    }

    app.activeDocument = doc;

    if (!isPsdOrPsbName(documentName(doc))) {
      formatSkipped++;
      return false;
    }

    if (safeLayerCount(doc) < MIN_LAYERS_TO_CLEAN) {
      simpleSkipped++;
      return false;
    }

    cleanDocumentMetadata(doc);

    if (!includeEmbeddedSmartObjects) return true;

    var smartObjects = [];
    collectSmartObjectLayers(smartObjects);

    for (var i = 0; i < smartObjects.length; i++) {
      var item = smartObjects[i];
      app.activeDocument = doc;
      if (!item.id) {
        fail(doc.name + " | 无法读取图层 ID: " + item.name);
        continue;
      }

      if (item.meta.linked || item.meta.missing) {
        linkedSkipped++;
        continue;
      }

      if (isProxySmartObject(item.meta, item.name)) {
        proxySkipped++;
        continue;
      }

      if (!isPsdOrPsbName(item.meta.fileReference || item.name)) {
        formatSkipped++;
        continue;
      }

      var childDoc = null;
      try {
        selectLayerById(item.id);
      } catch (selectError) {
        unopenableSkipped++;
        continue;
      }

      try {
        editSmartObjectContents();
        childDoc = app.activeDocument;
        if (childDoc === doc) throw new Error("智能对象没有打开");
      } catch (openError) {
        closeUnexpectedChild(doc);
        if (isEditContentsUnavailable(openError)) {
          unopenableSkipped++;
        } else {
          fail(doc.name + " | " + item.name + " | 智能对象打开失败: " + openError);
        }
        try { app.activeDocument = doc; } catch (activeError) {}
        continue;
      }

      try {
        smartObjectsOpened++;
        var childChanged = cleanDocumentTree(childDoc, depth + 1);
        app.activeDocument = childDoc;
        childDoc.close(childChanged ? SaveOptions.SAVECHANGES : SaveOptions.DONOTSAVECHANGES);
      } catch (cleanError) {
        fail(doc.name + " | " + item.name + " | 智能对象清理失败: " + cleanError);
        closeUnexpectedChild(doc);
      } finally {
        try { app.activeDocument = doc; } catch (activeError) {}
      }
    }

    return true;
  }

  var ok = confirm(
    "清理当前文件的 PS 元数据垃圾。\n\n" +
    "会清理：" + (includeEmbeddedSmartObjects ? "当前文件 + 内嵌智能对象里的 DocumentAncestors。\n" : "仅当前主文件的 DocumentAncestors。\n") +
    "会跳过：链接 SO、非 PSD/PSB、少于 5 层的文件。\n\n" +
    "主文件不会自动保存，清理后请手动保存。"
  );
  if (!ok) return;

  var oldDialogs = app.displayDialogs;
  try {
    app.displayDialogs = DialogModes.NO;
    cleanDocumentTree(rootDoc, 0);
    app.activeDocument = rootDoc;
  } catch (e) {
    fail("脚本出错: " + e + (e && e.line ? " 行 " + e.line : ""));
  } finally {
    app.displayDialogs = oldDialogs;
    try { app.activeDocument = rootDoc; } catch (restoreError) {}
  }

  var failureText = failures.length ? "\n\n失败摘要：\n" + failures.slice(0, 8).join("\n") : "";
  if (failures.length > 8) failureText += "\n...";

  alert(
    "完成。\n\n" +
    "检查文件：" + processedDocs + "\n" +
    "清到垃圾：" + cleanedDocs + "\n" +
    "删除记录：" + removedItems + "\n" +
    "估算减少：" + formatBytes(removedBytes) + "\n" +
    "打开内嵌 SO：" + smartObjectsOpened + "\n" +
    "跳过链接 SO：" + linkedSkipped + "\n" +
    "跳过代理 SO：" + proxySkipped + "\n" +
    "跳过非PSD/PSB：" + formatSkipped + "\n" +
    "跳过少层文件：" + simpleSkipped + "\n" +
    "跳过打不开 SO：" + unopenableSkipped + "\n" +
    "失败：" + failedCount + "\n\n" +
    "主文件未自动保存，请检查后手动保存。" +
    failureText
  );
})();
