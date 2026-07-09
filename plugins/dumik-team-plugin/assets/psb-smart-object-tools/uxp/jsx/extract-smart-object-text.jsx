#target photoshop

/*
  只提取智能对象文字_v3_卖点分组.jsx

  输出结构：
  XXX卖点
    文案组
    画面组

  做什么：
  - 选中一个 Photoshop 智能对象运行。
  - 原智能对象会被移动到“画面组”。
  - 脚本复制临时副本，只提取文字层到“文案组”。
  - 再打开原智能对象，把里面原文字隐藏，避免叠字。
*/

(function () {
  if (!app.documents.length) {
    alert("请先打开一个 PS/PSB 文件。");
    return;
  }

  var MAX_DEPTH = 12;
  var HIDE_ORIGINAL_TEXT = true;
  var doc = app.activeDocument;
  var originalRulerUnits = app.preferences.rulerUnits;
  var startedAt = new Date().getTime();
  app.preferences.rulerUnits = Units.PIXELS;

  var logLines = [];
  var tempPrefix = "__TEMP_文字提取__";

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

  function fail(msg) {
    log("失败: " + msg);
    writeLog();
    alert(msg + "\n\n耗时：" + elapsedText() + "\n日志已写出。");
  }

  function isSmartObject(layer) {
    try {
      return layer && layer.typename === "ArtLayer" && layer.kind === LayerKind.SMARTOBJECT;
    } catch (e) {
      return false;
    }
  }

  function isTextLayer(layer) {
    try {
      return layer && layer.typename === "ArtLayer" && layer.kind === LayerKind.TEXT;
    } catch (e) {
      return false;
    }
  }

  function safeName(layer) {
    try {
      return layer.name;
    } catch (e) {
      return "[无法读取名称]";
    }
  }

  function sanitizeName(name) {
    var s = String(name || "智能对象");
    s = s.replace(/^\s+|\s+$/g, "");
    s = s.replace(/\.(psb|psd|png|jpg|jpeg|tif|tiff)$/i, "");
    s = s.replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
    if (!s) s = "智能对象";
    if (!/卖点$/.test(s)) s += "卖点";
    return s;
  }

  function activeLayerDescriptor() {
    var ref = new ActionReference();
    ref.putEnumerated(charIDToTypeID("Lyr "), charIDToTypeID("Ordn"), charIDToTypeID("Trgt"));
    return executeActionGet(ref);
  }

  function smartObjectMeta(layer) {
    var meta = {
      fileReference: "",
      isVectorExternal: false
    };

    try {
      app.activeDocument.activeLayer = layer;
      var desc = activeLayerDescriptor();
      var smartObjectKey = stringIDToTypeID("smartObject");
      if (!desc.hasKey(smartObjectKey)) return meta;

      var so = desc.getObjectValue(smartObjectKey);
      var fileReferenceKey = stringIDToTypeID("fileReference");
      if (so.hasKey(fileReferenceKey)) {
        meta.fileReference = so.getString(fileReferenceKey);
      }
      meta.isVectorExternal = /\.(ai|ait|eps|pdf|svg)$/i.test(String(meta.fileReference).toLowerCase());
    } catch (e) {}

    return meta;
  }

  function convertActiveSmartObjectToLayers() {
    executeAction(stringIDToTypeID("placedLayerConvertToLayers"), new ActionDescriptor(), DialogModes.NO);
    return app.activeDocument.activeLayer;
  }

  function duplicateSelectedLayer() {
    var dup = app.activeDocument.activeLayer.duplicate();
    dup.name = tempPrefix + safeName(dup);
    app.activeDocument.activeLayer = dup;
    return dup;
  }

  function expandSmartObjectsInside(container, depth) {
    if (!container || !container.layers || depth >= MAX_DEPTH) return;

    var i = 0;
    while (i < container.layers.length) {
      var layer = container.layers[i];

      if (isSmartObject(layer)) {
        var meta = smartObjectMeta(layer);
        if (meta.isVectorExternal) {
          log(indent(depth) + "跳过 AI/矢量 SO: " + safeName(layer) + " | " + meta.fileReference);
          i++;
          continue;
        }

        app.activeDocument.activeLayer = layer;
        try {
          var converted = convertActiveSmartObjectToLayers();
          converted.name = tempPrefix + "展开_" + safeName(layer);
          log(indent(depth) + "展开临时 SO: " + safeName(converted));
          if (converted.typename === "LayerSet") {
            expandSmartObjectsInside(converted, depth + 1);
          }
          i = 0;
          continue;
        } catch (e) {
          log(indent(depth) + "跳过无法展开 SO: " + safeName(layer) + " | " + e);
          i++;
          continue;
        }
      }

      if (layer.typename === "LayerSet") {
        expandSmartObjectsInside(layer, depth + 1);
      }

      i++;
    }
  }

  function collectTextLayers(container, arr) {
    if (!container || !container.layers) return;
    for (var i = 0; i < container.layers.length; i++) {
      var layer = container.layers[i];
      if (isTextLayer(layer)) {
        arr.push(layer);
      } else if (layer.typename === "LayerSet") {
        collectTextLayers(layer, arr);
      }
    }
  }

  function createSellingPointGroups(originalName) {
    var parent = doc.layerSets.add();
    parent.name = sanitizeName(originalName);

    var imageGroup = parent.layerSets.add();
    imageGroup.name = "画面组";

    var copyGroup = parent.layerSets.add();
    copyGroup.name = "文案组";

    try {
      copyGroup.move(imageGroup, ElementPlacement.PLACEBEFORE);
    } catch (e) {}

    return {
      parent: parent,
      copyGroup: copyGroup,
      imageGroup: imageGroup
    };
  }

  function moveOriginalToImageGroup(original, imageGroup) {
    try {
      original.move(imageGroup, ElementPlacement.INSIDE);
      log("原智能对象已放入画面组: " + safeName(original));
      return true;
    } catch (e) {
      log("原智能对象移动到画面组失败: " + safeName(original) + " | " + e);
      return false;
    }
  }

  function moveTextLayersToGroup(textLayers, group) {
    var moved = 0;
    for (var i = textLayers.length - 1; i >= 0; i--) {
      try {
        textLayers[i].move(group, ElementPlacement.INSIDE);
        moved++;
      } catch (e) {
        log("移动文字失败: " + safeName(textLayers[i]) + " | " + e);
      }
    }
    return moved;
  }

  function removeLayer(layer) {
    try {
      layer.remove();
    } catch (e) {
      log("删除临时层失败: " + safeName(layer) + " | " + e);
    }
  }

  function hideTextInContainer(container, depth) {
    if (!container || !container.layers || depth >= MAX_DEPTH) return 0;

    var count = 0;
    for (var i = 0; i < container.layers.length; i++) {
      var layer = container.layers[i];

      if (isTextLayer(layer)) {
        try {
          layer.visible = false;
          count++;
          log(indent(depth) + "隐藏原文字: " + safeName(layer));
        } catch (eText) {
          log(indent(depth) + "隐藏文字失败: " + safeName(layer) + " | " + eText);
        }
      } else if (layer.typename === "LayerSet") {
        count += hideTextInContainer(layer, depth + 1);
      } else if (isSmartObject(layer)) {
        count += hideTextInSmartObject(layer, depth + 1);
      }
    }

    return count;
  }

  function hideTextInSmartObject(layer, depth) {
    if (depth >= MAX_DEPTH) return 0;

    var parentDoc = app.activeDocument;
    var meta = smartObjectMeta(layer);
    if (meta.isVectorExternal) {
      log(indent(depth) + "跳过 AI/矢量 SO 原文字隐藏: " + safeName(layer) + " | " + meta.fileReference);
      return 0;
    }

    try {
      parentDoc.activeLayer = layer;
      executeAction(stringIDToTypeID("placedLayerEditContents"), new ActionDescriptor(), DialogModes.NO);

      if (app.activeDocument === parentDoc) {
        log(indent(depth) + "跳过外部 SO 原文字隐藏: " + safeName(layer) + " | 未打开为 Photoshop 文档");
        return 0;
      }

      var soDoc = app.activeDocument;
      var count = hideTextInContainer(soDoc, depth + 1);

      if (count > 0) {
        soDoc.save();
        log(indent(depth) + "保存 SO，隐藏文字数: " + count + " | " + soDoc.name);
      }

      soDoc.close(SaveOptions.SAVECHANGES);
      try {
        app.activeDocument = parentDoc;
      } catch (setDocError) {}

      return count;
    } catch (e) {
      log(indent(depth) + "隐藏原 SO 文字失败: " + safeName(layer) + " | " + e);
      try {
        if (app.activeDocument !== parentDoc) {
          app.activeDocument.close(SaveOptions.DONOTSAVECHANGES);
        }
      } catch (closeError) {}
      try {
        app.activeDocument = parentDoc;
      } catch (setDocError2) {}
      return 0;
    }
  }

  function indent(depth) {
    var s = "";
    for (var i = 0; i < depth; i++) s += "  ";
    return s;
  }

  function timestamp() {
    var d = new Date();
    function pad(n) { return n < 10 ? "0" + n : String(n); }
    return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + "_" + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds());
  }

  function writeLog() {
    try {
      var folder;
      try {
        folder = doc.saved ? doc.path : Folder.desktop;
      } catch (e) {
        folder = Folder.desktop;
      }
      var f = File(folder.fsName + "/只提取智能对象文字_v3_日志_" + timestamp() + ".txt");
      f.encoding = "UTF-8";
      f.open("w");
      f.writeln("只提取智能对象文字 v3 日志");
      f.writeln("时间: " + new Date());
      f.writeln("耗时: " + elapsedText());
      f.writeln("");
      for (var i = 0; i < logLines.length; i++) f.writeln(logLines[i]);
      f.close();
    } catch (e2) {}
  }

  try {
    log("脚本启动");
    var original = doc.activeLayer;
    var originalName = safeName(original);

    if (!isSmartObject(original)) {
      fail("请先选中一个智能对象图层。");
      return;
    }

    var ok = confirm("提取文字，并整理成卖点组：\n\n" + sanitizeName(originalName) +
      "\n  文案组\n  画面组\n\n原智能对象会放入画面组，原 SO 内文字会关眼睛。");
    if (!ok) return;

    var moved = 0;
    var hidden = 0;
    var groups = null;
    var noTextFound = false;

    function extractTextAsOneStep() {
      var temp = duplicateSelectedLayer();
      log("已复制临时 SO: " + safeName(temp));

      var root = null;
      try {
        root = convertActiveSmartObjectToLayers();
        root.name = tempPrefix + "根_" + originalName;
        log("已展开临时根 SO: " + safeName(root));
      } catch (eRoot) {
        removeLayer(temp);
        throw new Error("临时 SO 展开失败: " + eRoot);
      }

      if (root && root.typename === "LayerSet") {
        expandSmartObjectsInside(root, 1);
      }

      var textLayers = [];
      collectTextLayers(root, textLayers);
      log("发现文字层: " + textLayers.length);

      if (!textLayers.length) {
        removeLayer(root);
        noTextFound = true;
        return;
      }

      groups = createSellingPointGroups(originalName);
      moved = moveTextLayersToGroup(textLayers, groups.copyGroup);
      log("已移出文字层到文案组: " + moved);

      removeLayer(root);

      moveOriginalToImageGroup(original, groups.imageGroup);

      if (HIDE_ORIGINAL_TEXT) {
        app.activeDocument = doc;
        doc.activeLayer = original;
        hidden = hideTextInSmartObject(original, 0);
        log("原 SO 隐藏文字层总数: " + hidden);
      }
    }

    try {
      runAsOneHistory("只提取当前 SO 文字", extractTextAsOneStep);
    } catch (historyError) {
      fail(String(historyError));
      return;
    }

    if (noTextFound) {
      writeLog();
      alert("没找到可提取的文字层。\n\n耗时：" + elapsedText() + "\n原智能对象没有被修改。");
      return;
    }

    writeLog();
    alert("完成。\n\n结构已整理为：\n" + groups.parent.name + "\n  文案组\n  画面组\n\n已提取文字层: " + moved + "\n已隐藏原 SO 文字层: " + hidden + "\n耗时：" + elapsedText());
  } catch (e) {
    fail("脚本出错: " + e + (e && e.number ? " | 错误号: " + e.number : "") + (e && e.line ? " | 行: " + e.line : ""));
  } finally {
    app.preferences.rulerUnits = originalRulerUnits;
  }
})();
