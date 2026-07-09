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

  var DEFAULT_EXTENSION = ".psb";
  var LINKS_ROOT_FOLDER = "links";
  var LINKS_FOLDER_SUFFIX = "_links";
  var MAX_OPEN_PROXY_BATCH = 4;
  var MIN_VALID_LINKED_FILE_BYTES = 32768;
  var FORCE_MAX_COMPATIBILITY_DURING_RUN = true;
  var SAVE_MAIN_DOCUMENT = false;
  var SKIP_LINKED = true;
  var REWRITE_LINKED_COMPATIBLE = !!$.global.__psbLinkRewriteCompatible;
  var REPAIR_EXISTING_LINKS = !!$.global.__psbLinkRepairExisting;
  var SELECTED_PROXY_ONLY = !!$.global.__psbLinkSelectedProxy;
  var startedAt = new Date().getTime();

  var doc = app.activeDocument;
  var originalRulerUnits = app.preferences.rulerUnits;
  var originalMaximizeCompatibility = null;
  var hasOriginalMaximizeCompatibility = false;
  app.preferences.rulerUnits = Units.PIXELS;

  var logLines = [];
  var convertedCount = 0;
  var skippedCount = 0;
  var skippedSingleFileCount = 0;
  var skippedSimpleChildCount = 0;
  var rewrittenCompatibleCount = 0;
  var renamedLayerCount = 0;
  var wrappedProxyCount = 0;
  var embeddedOuterProxyCount = 0;
  var skippedProxyCount = 0;
  var unlockedLayerCount = 0;
  var failedCount = 0;
  var linkedPsdPsbIndex = null;
  var stoppedByFatalStorageError = false;

  function log(msg) {
    logLines.push(msg);
  }

  function isFatalStorageError(error) {
    var text = String(error || "");
    return /磁盘已满|scratch disk|disk is full|not enough disk|空间不足|不能完成命令，因为磁盘已满/i.test(text);
  }

  function isUnsupportedEditContentsError(error) {
    var text = String(error || "");
    return /编辑内容.*不可用|命令"编辑内容"当前不可用|智能对象没有打开/i.test(text);
  }

  function cleanupFailedLinkedFile(file, reason) {
    try {
      if (file && file.exists) {
        var size = Number(file.length || 0);
        if (size <= MIN_VALID_LINKED_FILE_BYTES) {
          file.remove();
          log("已清理失败占位文件: " + file.fsName + " | " + reason + " | " + size + " bytes");
        }
      }
    } catch (cleanupError) {
      log("清理失败占位文件失败: " + (file && file.fsName ? file.fsName : file) + " | " + cleanupError);
    }
  }

  function assertLinkedFileLooksValid(file) {
    try {
      if (!file || !file.exists) throw new Error("链接文件没有生成");
      var size = Number(file.length || 0);
      if (size <= MIN_VALID_LINKED_FILE_BYTES) {
        throw new Error("链接文件疑似为空: " + size + " bytes");
      }
    } catch (e) {
      cleanupFailedLinkedFile(file, e);
      throw e;
    }
  }

  function saveDocumentAsLinkedFile(targetDoc, targetFile) {
    var oldActive = app.activeDocument;
    var oldDialogs = app.displayDialogs;
    var oldCompatibility = null;
    var changedCompatibility = false;

    try {
      app.activeDocument = targetDoc;
      app.displayDialogs = DialogModes.NO;
      try {
        oldCompatibility = app.preferences.maximizeCompatibility;
        app.preferences.maximizeCompatibility = QueryStateType.ALWAYS;
        changedCompatibility = true;
      } catch (compatError) {}

      var desc = new ActionDescriptor();
      var options = new ActionDescriptor();
      try { options.putBoolean(stringIDToTypeID("maximizeCompatibility"), true); } catch (optionError) {}
      desc.putObject(charIDToTypeID("As  "), charIDToTypeID("Pht8"), options);
      desc.putPath(charIDToTypeID("In  "), targetFile);
      desc.putBoolean(charIDToTypeID("Cpy "), true);
      desc.putBoolean(charIDToTypeID("LwCs"), true);
      executeAction(charIDToTypeID("save"), desc, DialogModes.NO);
      assertLinkedFileLooksValid(targetFile);
      log("已保存链接文件: " + targetFile.fsName + " | " + targetFile.length + " bytes");
    } catch (e) {
      cleanupFailedLinkedFile(targetFile, e);
      throw e;
    } finally {
      if (changedCompatibility) {
        try { app.preferences.maximizeCompatibility = oldCompatibility; } catch (restoreError) {}
      }
      app.displayDialogs = oldDialogs;
      try { app.activeDocument = oldActive; } catch (activeError) {}
    }
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

  function descriptorPath(desc, key) {
    try {
      if (desc.hasKey(key)) return desc.getPath(key).fsName;
    } catch (e) {}
    return "";
  }

  function smartObjectMetaFromDescriptor(desc) {
    var meta = {
      isSmart: false,
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
      meta.isSmart = true;

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
    return executeActionGet(ref).getInteger(stringIDToTypeID("numberOfLayers"));
  }

  function activeDocumentLayerCountSafe(targetDoc) {
    try {
      return layerCount();
    } catch (e) {
      try {
        return targetDoc && targetDoc.layers ? targetDoc.layers.length : 0;
      } catch (fallbackError) {}
    }
    return 0;
  }

  function activeDocumentMaxSidePxSafe(targetDoc) {
    try {
      var width = px(targetDoc.width);
      var height = px(targetDoc.height);
      return Math.max(width, height);
    } catch (e) {}
    return 0;
  }

  function shouldSkipSimpleChildDocument(targetDoc) {
    return activeDocumentLayerCountSafe(targetDoc) < 3 || activeDocumentMaxSidePxSafe(targetDoc) < 500;
  }

  function simpleChildSkipText(targetDoc) {
    return activeDocumentLayerCountSafe(targetDoc) + " 层 / 最大边 " + Math.round(activeDocumentMaxSidePxSafe(targetDoc)) + "px";
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

  function collectSelectedSmartObject(items) {
    try {
      var desc = activeLayerDescriptor();
      if (!desc.hasKey(stringIDToTypeID("smartObject"))) {
        alert("请先选中一个智能对象图层。");
        return false;
      }
      var name = descriptorString(desc, "name", "选中智能对象");
      var id = descriptorInteger(desc, "layerID", null);
      if (id === null) {
        alert("无法读取当前图层 ID。");
        return false;
      }
      items.push({
        id: id,
        name: name,
        path: name,
        meta: smartObjectMetaFromDescriptor(desc)
      });
      return true;
    } catch (e) {
      alert("读取当前选中图层失败：\n" + e);
      return false;
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

  function extensionFromName(name) {
    var m = String(name || "").match(/(\.[^\.\\\/]+)$/);
    var ext = m ? m[1].toLowerCase() : "";
    if (/^\.(psb|psd|psdt|pdf|ai|eps|tif|tiff|jpg|jpeg|png)$/i.test(ext)) return ext;
    return DEFAULT_EXTENSION;
  }

  function outputExtensionForSmartObject(meta) {
    return DEFAULT_EXTENSION;
  }

  function importStyleExtension(name) {
    var m = String(name || "").match(/(\.[^\.\\\/]+)$/);
    var ext = m ? m[1].toLowerCase() : "";
    return /^\.(pdf|ai|eps)$/i.test(ext);
  }

  function singleFileExtension(name) {
    var m = String(name || "").match(/(\.[^\.\\\/]+)$/);
    var ext = m ? m[1].toLowerCase() : "";
    return /^\.(pdf|ai|eps|png|jpg|jpeg|tif|tiff|webp|gif|bmp|svg)$/i.test(ext);
  }

  function shouldSkipSingleFileSmartObject(meta, layerName) {
    if (!meta) return false;
    return singleFileExtension(meta.fileReference) || singleFileExtension(layerName);
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

  function nativePsdPsbExtension(name) {
    var m = String(name || "").match(/(\.[^\.\\\/]+)$/);
    var ext = m ? m[1].toLowerCase() : "";
    return /^\.(psd|psb)$/i.test(ext);
  }

  function basenameFromPath(path) {
    var s = String(path || "").replace(/\\/g, "/");
    var parts = s.split("/");
    var name = parts.length ? parts[parts.length - 1] : s;
    try {
      name = decodeURI(name);
    } catch (e) {}
    return name;
  }

  function normalizeFileName(name) {
    try {
      name = decodeURI(String(name || ""));
    } catch (e) {
      name = String(name || "");
    }
    return name.toLowerCase();
  }

  function stripExtension(name) {
    return String(name || "").replace(/\.[^\.]+$/, "");
  }

  function layerNameFromFile(file) {
    var name = stripExtension(basenameFromPath(file && file.name ? file.name : file));
    if (!name) name = "linked_smart_object";
    if (name.length > 120) name = name.substring(0, 120);
    return name;
  }

  function renameActiveLayerToName(nextName) {
    try {
      if (app.activeDocument.activeLayer.name !== nextName) {
        app.activeDocument.activeLayer.name = nextName;
        renamedLayerCount++;
        return true;
      }
    } catch (e) {
      log("图层改名失败: " + nextName + " | " + e);
    }
    return false;
  }

  function renameActiveLayerToFile(file) {
    return renameActiveLayerToName(layerNameFromFile(file));
  }

  function renameActiveLayerToProxyFile(file) {
    return renameActiveLayerToName(layerNameFromFile(file) + "_proxy");
  }

  function pushIndex(map, file) {
    var key = normalizeFileName(file.name);
    if (!map[key]) map[key] = [];
    map[key].push(file);
  }

  function scanPsdPsbFolder(folder, map, depth) {
    if (!folder || !folder.exists || depth < 0) return;
    var files;
    try {
      files = folder.getFiles();
    } catch (e) {
      return;
    }

    for (var i = 0; i < files.length; i++) {
      var item = files[i];
      if (item instanceof Folder) {
        scanPsdPsbFolder(item, map, depth - 1);
      } else if (item instanceof File && nativePsdPsbExtension(item.name)) {
        pushIndex(map, item);
      }
    }
  }

  function buildLinkedPsdPsbIndex() {
    if (linkedPsdPsbIndex) return linkedPsdPsbIndex;
    linkedPsdPsbIndex = {};

    try {
      var linksRoot = Folder(doc.path.fsName + "/" + LINKS_ROOT_FOLDER);
      scanPsdPsbFolder(linksRoot, linkedPsdPsbIndex, 30);
    } catch (linksError) {}

    try {
      var nearFiles = Folder(doc.path.fsName).getFiles(function (item) {
        return item instanceof File && nativePsdPsbExtension(item.name);
      });
      for (var i = 0; i < nearFiles.length; i++) pushIndex(linkedPsdPsbIndex, nearFiles[i]);
    } catch (nearError) {}

    return linkedPsdPsbIndex;
  }

  function uniqueFileFromList(files) {
    if (!files || files.length !== 1) return null;
    return files[0];
  }

  function resolveLinkedPsdPsbFile(meta) {
    if (!meta) return null;
    var path = meta.linkPath || meta.fileReference || "";
    if (!nativePsdPsbExtension(path)) return null;

    try {
      var direct = File(path);
      if (direct.exists) return direct;
    } catch (directError) {}

    var name = basenameFromPath(path);
    if (!nativePsdPsbExtension(name)) return null;

    var index = buildLinkedPsdPsbIndex();
    return uniqueFileFromList(index[normalizeFileName(name)]);
  }

  function uniqueFile(folder, baseName, index, layerIdValue, extension) {
    var ext = extension || DEFAULT_EXTENSION;
    var stem = safeName(docBaseName()) + "__" + pad(index, 3) + "__" + safeName(baseName) + "__id" + layerIdValue;
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

  function convertActiveEmbeddedToLinked(file) {
    var idplacedLayerConvertToLinked = stringIDToTypeID("placedLayerConvertToLinked");
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    desc.putReference(charIDToTypeID("null"), ref);
    desc.putPath(charIDToTypeID("Usng"), file);
    executeAction(idplacedLayerConvertToLinked, desc, DialogModes.NO);
  }

  function convertSelectedLayersToSmartObject() {
    executeAction(stringIDToTypeID("newPlacedLayer"), new ActionDescriptor(), DialogModes.NO);
  }

  function embedActiveLinkedSmartObjectIfNeeded() {
    var meta = smartObjectMetaFromDescriptor(activeLayerDescriptor());
    if (!meta || !meta.linked) return false;
    executeAction(stringIDToTypeID("placedLayerConvertToEmbedded"), undefined, DialogModes.NO);
    embeddedOuterProxyCount++;
    return true;
  }

  function editSmartObjectContents() {
    executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);
  }

  function selectAllLayers() {
    var desc = new ActionDescriptor();
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    desc.putReference(charIDToTypeID("null"), ref);
    executeAction(stringIDToTypeID("selectAllLayers"), desc, DialogModes.NO);
  }

  function unlockLayerTree(layer) {
    if (!layer) return;
    if (layer.typename === "LayerSet") {
      try {
        if (layer.allLocked) {
          layer.allLocked = false;
          unlockedLayerCount++;
        }
      } catch (groupLockError) {}
      for (var i = 0; i < layer.layers.length; i++) {
        unlockLayerTree(layer.layers[i]);
      }
      return;
    }

    try {
      if (layer.isBackgroundLayer) {
        layer.isBackgroundLayer = false;
        unlockedLayerCount++;
      }
    } catch (backgroundError) {}

    var props = ["allLocked", "pixelsLocked", "positionLocked", "transparentPixelsLocked"];
    for (var j = 0; j < props.length; j++) {
      try {
        if (layer[props[j]]) {
          layer[props[j]] = false;
          unlockedLayerCount++;
        }
      } catch (lockError) {}
    }
  }

  function unlockAllLayers(targetDoc) {
    var before = unlockedLayerCount;
    for (var i = 0; i < targetDoc.layers.length; i++) {
      unlockLayerTree(targetDoc.layers[i]);
    }
    if (unlockedLayerCount > before) {
      log("已临时解锁图层: " + (unlockedLayerCount - before) + " | " + targetDoc.name);
    }
  }

  function makePreviewLayerFromOriginal(originalLayer) {
    var preview = originalLayer.duplicate();
    try {
      preview.move(originalLayer, ElementPlacement.PLACEBEFORE);
    } catch (moveError) {}
    app.activeDocument.activeLayer = preview;
    try {
      preview.rasterize(RasterizeType.ENTIRELAYER);
    } catch (rasterError) {
      executeAction(stringIDToTypeID("rasterizeLayer"), new ActionDescriptor(), DialogModes.NO);
    }
    preview.name = "__PROXY_PREVIEW__";
    originalLayer.visible = false;
    return preview;
  }

  function proxyActiveSmartObjectInternally(linkedFile) {
    var mainDoc = doc;
    var childDoc = null;
    var originalLayer = null;

    try {
      editSmartObjectContents();
      childDoc = app.activeDocument;
      if (childDoc === mainDoc) throw new Error("智能对象没有打开");
      if (shouldSkipSimpleChildDocument(childDoc)) {
        skippedCount++;
        skippedSimpleChildCount++;
        log("跳过轻量智能对象: " + childDoc.name + " | " + simpleChildSkipText(childDoc));
        childDoc.close(SaveOptions.DONOTSAVECHANGES);
        childDoc = null;
        app.activeDocument = mainDoc;
        return;
      }

      saveDocumentAsLinkedFile(childDoc, linkedFile);
      unlockAllLayers(childDoc);
      selectAllLayers();
      convertSelectedLayersToSmartObject();
      convertActiveEmbeddedToLinked(linkedFile);
      originalLayer = childDoc.activeLayer;
      originalLayer.name = "__ORIGINAL_LINK__";

      makePreviewLayerFromOriginal(originalLayer);
      childDoc.close(SaveOptions.SAVECHANGES);
      childDoc = null;
      app.activeDocument = mainDoc;
      embedActiveLinkedSmartObjectIfNeeded();
      renameActiveLayerToProxyFile(linkedFile);
      wrappedProxyCount++;
    } finally {
      try { if (childDoc) childDoc.close(SaveOptions.SAVECHANGES); } catch (closeError) {}
      try { app.activeDocument = mainDoc; } catch (activeError) {}
    }
  }

  function finishProxyChildDocument(task) {
    var childDoc = task.childDoc;
    var originalLayer = null;

    app.activeDocument = childDoc;
    if (shouldSkipSimpleChildDocument(childDoc)) {
      skippedCount++;
      skippedSimpleChildCount++;
      log("跳过轻量智能对象: " + task.item.path + " | " + simpleChildSkipText(childDoc));
      childDoc.close(SaveOptions.DONOTSAVECHANGES);
      task.childDoc = null;
      return;
    }
    saveDocumentAsLinkedFile(childDoc, task.linkedFile);
    unlockAllLayers(childDoc);
    selectAllLayers();
    convertSelectedLayersToSmartObject();
    convertActiveEmbeddedToLinked(task.linkedFile);
    originalLayer = childDoc.activeLayer;
    originalLayer.name = "__ORIGINAL_LINK__";

    makePreviewLayerFromOriginal(originalLayer);
    childDoc.close(SaveOptions.SAVECHANGES);
    task.childDoc = null;

    app.activeDocument = doc;
    selectLayerById(task.item.id);
    embedActiveLinkedSmartObjectIfNeeded();
    renameActiveLayerToProxyFile(task.linkedFile);
    wrappedProxyCount++;
    if (task.countAsConverted !== false) convertedCount++;
    log((task.logPrefix || "已内部代理") + ": " + task.item.path + " -> " + task.linkedFile.fsName);
  }

  function flushProxyBatch(batch) {
    if (!batch.length) return;

    var opened = [];
    for (var i = 0; i < batch.length; i++) {
      var task = batch[i];
      try {
        app.activeDocument = doc;
        selectLayerById(task.item.id);
        editSmartObjectContents();
        task.childDoc = app.activeDocument;
        if (task.childDoc === doc) throw new Error("智能对象没有打开");
        opened.push(task);
      } catch (openError) {
        if (isUnsupportedEditContentsError(openError)) {
          skippedCount++;
          log("跳过不可编辑智能对象: " + task.item.path + " | " + openError);
        } else {
          failedCount++;
          log("打开智能对象失败: " + task.item.path + " -> " + task.linkedFile.fsName + " | " + openError);
        }
        cleanupFailedLinkedFile(task.linkedFile, openError);
        if (isFatalStorageError(openError)) {
          stoppedByFatalStorageError = true;
          throw new Error("磁盘空间不足，已停止批量转链接，避免继续生成坏文件。请先清理 Photoshop 暂存盘/系统盘后重试。");
        }
        try { app.activeDocument = doc; } catch (activeError) {}
      }
    }

    for (var j = 0; j < opened.length; j++) {
      var openedTask = opened[j];
      try {
        finishProxyChildDocument(openedTask);
      } catch (convertError) {
        failedCount++;
        log("失败: " + openedTask.item.path + " -> " + openedTask.linkedFile.fsName + " | " + convertError);
        cleanupFailedLinkedFile(openedTask.linkedFile, convertError);
        if (isFatalStorageError(convertError)) {
          stoppedByFatalStorageError = true;
          throw new Error("磁盘空间不足，已停止批量转链接，避免继续生成坏文件。请先清理 Photoshop 暂存盘/系统盘后重试。");
        }
      } finally {
        try { if (openedTask.childDoc) openedTask.childDoc.close(SaveOptions.SAVECHANGES); } catch (closeError) {}
        try { app.activeDocument = doc; } catch (activeError2) {}
      }
    }

    batch.length = 0;
  }

  function findOpenDocumentByFile(file) {
    try {
      var target = File(file.fsName);
      for (var i = 0; i < app.documents.length; i++) {
        try {
          if (File(app.documents[i].fullName).fsName === target.fsName) return app.documents[i];
        } catch (docError) {}
      }
    } catch (e) {}
    return null;
  }

  function saveLinkedFileWithMaxCompatibility(file) {
    var mainDoc = doc;
    var oldDialogs = app.displayDialogs;
    var openedByScript = false;
    var linkedDoc = null;

    try {
      app.displayDialogs = DialogModes.NO;
      linkedDoc = findOpenDocumentByFile(file);
      if (!linkedDoc) {
        linkedDoc = app.open(file);
        openedByScript = true;
      }
      app.activeDocument = linkedDoc;
      linkedDoc.save();
      if (openedByScript) linkedDoc.close(SaveOptions.DONOTSAVECHANGES);
      linkedDoc = null;
      app.activeDocument = mainDoc;
    } finally {
      try { if (openedByScript && linkedDoc) linkedDoc.close(SaveOptions.DONOTSAVECHANGES); } catch (closeError) {}
      app.displayDialogs = oldDialogs;
      try { app.activeDocument = mainDoc; } catch (activeError) {}
    }
  }

  function chooseOutputFolder() {
    try {
      if (!doc.path) {
        alert("请先保存主 PSB，再运行脚本。\n\n链接文件会统一放到主文件旁边的 links\\主文件名_links 文件夹。");
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

  function forceMaxCompatibility() {
    if (!FORCE_MAX_COMPATIBILITY_DURING_RUN) return;
    try {
      originalMaximizeCompatibility = app.preferences.maximizeCompatibility;
      hasOriginalMaximizeCompatibility = true;
      app.preferences.maximizeCompatibility = QueryStateType.ALWAYS;
      log("运行期间已开启最大兼容性保存。");
    } catch (e) {
      log("开启最大兼容性保存失败，继续执行: " + e);
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
      f.writeln("耗时: " + elapsedText());
      f.writeln("输出目录: " + folder.fsName);
      f.writeln("");
      f.writeln("新转兼容: " + convertedCount);
      f.writeln("已有重存: " + rewrittenCompatibleCount);
      f.writeln("内部代理: " + wrappedProxyCount);
      f.writeln("外层嵌入: " + embeddedOuterProxyCount);
      f.writeln("图层改名: " + renamedLayerCount);
      f.writeln("代理跳过: " + skippedProxyCount);
      f.writeln("轻量跳过: " + skippedSimpleChildCount);
      f.writeln("解锁图层: " + unlockedLayerCount);
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
    log("脚本启动");
    var outputFolder = chooseOutputFolder();
    if (!outputFolder) return;
    forceMaxCompatibility();

    var items = [];
    if (SELECTED_PROXY_ONLY) {
      if (!collectSelectedSmartObject(items)) return;
    } else {
      collectSmartObjects(items);
    }

    if (!items.length) {
      alert("当前文档没有找到智能对象。");
      return;
    }

    var embeddedCount = 0;
    var linkedRewriteCount = 0;
    for (var i = 0; i < items.length; i++) {
      if ((!items[i].meta || !items[i].meta.linked) && !shouldSkipSingleFileSmartObject(items[i].meta, items[i].name) && !isProxySmartObject(items[i].meta, items[i].name)) embeddedCount++;
      if ((REWRITE_LINKED_COMPATIBLE || REPAIR_EXISTING_LINKS || SELECTED_PROXY_ONLY) && items[i].meta && items[i].meta.linked && !isProxySmartObject(items[i].meta, items[i].name) && resolveLinkedPsdPsbFile(items[i].meta)) linkedRewriteCount++;
    }

    var ok = confirm(
      (SELECTED_PROXY_ONLY ? "选中智能对象：1 个\n" : "找到智能对象：" + items.length + " 个\n") +
      "其中内嵌待转换：" + embeddedCount + " 个\n\n" +
      ((REWRITE_LINKED_COMPATIBLE || REPAIR_EXISTING_LINKS || SELECTED_PROXY_ONLY) ? "已有链接可处理：" + linkedRewriteCount + " 个\n\n" : "") +
      "新转链接会按 " + MAX_OPEN_PROXY_BATCH + " 个一批处理。\n\n" +
      "链接文件夹：\n" + outputFolder.fsName + "\n\n" +
      "脚本会修改当前文档，但不会自动保存主文档。\n请确认你正在副本文件上测试。"
    );
    if (!ok) return;

    function convertAllEmbeddedToLinked() {
      var proxyBatch = [];
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
        if (isProxySmartObject(freshMeta, item.name)) {
          skippedCount++;
          skippedProxyCount++;
          log("跳过代理对象: " + item.path + " | " + (freshMeta.linkPath || freshMeta.fileReference));
          continue;
        }
        if (REWRITE_LINKED_COMPATIBLE || REPAIR_EXISTING_LINKS || SELECTED_PROXY_ONLY) {
          var linkedFile = resolveLinkedPsdPsbFile(freshMeta);
          if (linkedFile) {
            if (REPAIR_EXISTING_LINKS || SELECTED_PROXY_ONLY) {
              var repairFile = uniqueFile(outputFolder, item.name, j + 1, item.id, DEFAULT_EXTENSION);
              proxyBatch.push({
                item: item,
                linkedFile: repairFile,
                childDoc: null,
                countAsConverted: false,
                logPrefix: "已内部代理修复"
              });
              if (proxyBatch.length >= MAX_OPEN_PROXY_BATCH) flushProxyBatch(proxyBatch);
            } else {
              try {
                saveLinkedFileWithMaxCompatibility(linkedFile);
                rewrittenCompatibleCount++;
                log("已重存兼容: " + item.path + " | " + linkedFile.fsName);
              } catch (rewriteError) {
                failedCount++;
                log("重存兼容失败: " + item.path + " | " + linkedFile.fsName + " | " + rewriteError);
              }
            }
            continue;
          }
        }
        skippedCount++;
        log("跳过已链接: " + item.path + " | " + freshMeta.fileReference);
        continue;
      }
      if (shouldSkipSingleFileSmartObject(freshMeta, item.name)) {
        skippedCount++;
        skippedSingleFileCount++;
        log("跳过单文件智能对象: " + item.path + " | " + (freshMeta.fileReference || item.name));
        continue;
      }
      if (isProxySmartObject(freshMeta, item.name)) {
        skippedCount++;
        skippedProxyCount++;
        log("跳过代理对象: " + item.path + " | " + (freshMeta.fileReference || item.name));
        continue;
      }

      var outFile = uniqueFile(outputFolder, item.name, j + 1, item.id, DEFAULT_EXTENSION);
      proxyBatch.push({ item: item, linkedFile: outFile, childDoc: null });
      if (proxyBatch.length >= MAX_OPEN_PROXY_BATCH) flushProxyBatch(proxyBatch);
    }
      flushProxyBatch(proxyBatch);
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

    var logFile = shouldWriteLog() ? writeLog(outputFolder) : null;
    alert(
      "完成。\n\n" +
      "新转兼容：" + convertedCount + "\n" +
      "已有重存：" + rewrittenCompatibleCount + "\n" +
      "内部代理：" + wrappedProxyCount + "\n" +
      "外层嵌入：" + embeddedOuterProxyCount + "\n" +
      "图层改名：" + renamedLayerCount + "\n" +
      "解锁图层：" + unlockedLayerCount + "\n" +
      "已跳过：" + skippedCount + "\n" +
      "单文件跳过：" + skippedSingleFileCount + "\n" +
      "代理跳过：" + skippedProxyCount + "\n" +
      "轻量跳过：" + skippedSimpleChildCount + "\n" +
      "失败：" + failedCount + "\n" +
      "耗时：" + elapsedText() + "\n\n" +
      "主文档没有自动保存，确认没问题后你再手动保存。\n" +
      (logFile ? "\n日志：" + logFile.fsName : "")
    );
  } catch (e) {
    failedCount++;
    log("脚本中止: " + e + (e && e.line ? " | 行: " + e.line : ""));
    var errorLogFile = null;
    try {
      if (outputFolder && shouldWriteLog()) errorLogFile = writeLog(outputFolder);
    } catch (logError) {}
    alert(
      (stoppedByFatalStorageError ? "已停止：磁盘空间不足。\n\n" : "脚本出错: " + e + (e && e.line ? "\n行: " + e.line : "") + "\n\n") +
      "已停止继续处理，避免生成更多坏的 PSB/PSD。\n" +
      "建议先清理 Photoshop 暂存盘/系统盘，再重新运行。\n" +
      (errorLogFile ? "\n日志：" + errorLogFile.fsName : "")
    );
  } finally {
    restoreMaxCompatibility();
    app.preferences.rulerUnits = originalRulerUnits;
  }
})();
