#target photoshop

(function () {
  if (!app.documents.length) {
    alert("请先打开一个 PS/PSB 文件。");
    return;
  }

  var doc = app.activeDocument;
  var startedAt = new Date().getTime();
  var radius = 1.0;
  var threshold = 0;
  var exportFolder = Folder.selectDialog("选择 JPG 导出位置");
  if (!exportFolder) return;

  function elapsedText() {
    var seconds = Math.max(0, Math.round((new Date().getTime() - startedAt) / 1000));
    var minutes = Math.floor(seconds / 60);
    var rest = seconds % 60;
    return minutes ? minutes + "分" + rest + "秒" : seconds + "秒";
  }

  function px(value) {
    try {
      return value.as("px");
    } catch (e) {
      return Number(value);
    }
  }

  function docWidthPx(targetDoc) {
    return px(targetDoc.width);
  }

  function amountForWidth(width) {
    return width > 1000 ? 77 : 44;
  }

  var previewAmount = amountForWidth(docWidthPx(doc));
  var ok = confirm(
    "处理当前文件：\n" + doc.name + "\n\n" +
    "有画板：每个画板单独盖印并锐化。\n" +
    "没有画板：整张文件盖印并锐化。\n\n" +
    "USM：宽度大于 1000px 用 77%，否则用 44%；半径 1.0，阈值 0。\n" +
    "导出：JPG，质量满档。\n\n" +
    "导出到：\n" + exportFolder.fsName + "\n\n" +
    "文件不会自动保存。"
  );
  if (!ok) return;

  $.global.__psbStampUsmRadius = radius;
  $.global.__psbStampUsmThreshold = threshold;
  $.global.__psbStampUsmExportFolder = exportFolder.fsName;
  $.global.__psbStampUsmAction = function () {
    var s2t = stringIDToTypeID;

    function unitValue(desc, key) {
      try {
        return desc.getUnitDoubleValue(s2t(key));
      } catch (e) {
        return 0;
      }
    }

    function layerDescriptorById(id) {
      var ref = new ActionReference();
      ref.putIdentifier(charIDToTypeID("Lyr "), id);
      return executeActionGet(ref);
    }

    function layerName(amount) {
      return "盖印_USM_" + amount + "_1_0_0";
    }

    function safeName(name) {
      var s = String(name || "export").replace(/[\\\/\:\*\?\"\<\>\|]/g, "_");
      s = s.replace(/^\s+|\s+$/g, "");
      return s || "export";
    }

    function uniqueJpgFile(folder, baseName) {
      var file = File(folder.fsName + "/" + safeName(baseName) + ".jpg");
      var n = 2;
      while (file.exists) {
        file = File(folder.fsName + "/" + safeName(baseName) + "_" + n + ".jpg");
        n++;
      }
      return file;
    }

    function amountForWidth(width) {
      return width > 1000 ? 77 : 44;
    }

    function pxValue(value) {
      try {
        return value.as("px");
      } catch (e) {
        return Number(value);
      }
    }

    function layerPosition(layer) {
      try {
        return {
          left: pxValue(layer.bounds[0]),
          top: pxValue(layer.bounds[1])
        };
      } catch (e) {
        return null;
      }
    }

    function restoreLayerPosition(layer, before) {
      if (!layer || !before) return;
      var after = layerPosition(layer);
      if (!after) return;
      var dx = before.left - after.left;
      var dy = before.top - after.top;
      if (dx || dy) layer.translate(dx, dy);
    }

    function readArtboardRect(layerSet) {
      try {
        var desc = layerDescriptorById(layerSet.id);
        if (!desc.hasKey(s2t("artboard"))) return null;
        var artboard = desc.getObjectValue(s2t("artboard"));
        if (!artboard.hasKey(s2t("artboardRect"))) return null;
        var rect = artboard.getObjectValue(s2t("artboardRect"));
        return {
          left: unitValue(rect, "left"),
          top: unitValue(rect, "top"),
          right: unitValue(rect, "right"),
          bottom: unitValue(rect, "bottom")
        };
      } catch (e) {
        return null;
      }
    }

    function collectArtboards(container, out) {
      for (var i = 0; i < container.layerSets.length; i++) {
        var layerSet = container.layerSets[i];
        var rect = readArtboardRect(layerSet);
        if (rect) {
          out.push({
            group: layerSet,
            name: layerSet.name,
            rect: rect
          });
          continue;
        }
        collectArtboards(layerSet, out);
      }
    }

    function selectRect(rect) {
      app.activeDocument.selection.select([
        [rect.left, rect.top],
        [rect.right, rect.top],
        [rect.right, rect.bottom],
        [rect.left, rect.bottom]
      ]);
    }

    function pasteMergedSelection(rect, targetGroup) {
      selectRect(rect);
      app.activeDocument.selection.copy(true);
      var pasted = app.activeDocument.paste();
      app.activeDocument.selection.deselect();

      var amount = amountForWidth(rect.right - rect.left);
      pasted.name = layerName(amount);
      pasted.applyUnSharpMask(amount, $.global.__psbStampUsmRadius, $.global.__psbStampUsmThreshold);

      if (targetGroup) {
        var beforeMove = layerPosition(pasted);
        try {
          pasted.move(targetGroup, ElementPlacement.INSIDE);
          restoreLayerPosition(pasted, beforeMove);
        } catch (moveError) {
          try {
            pasted.move(targetGroup, ElementPlacement.PLACEATBEGINNING);
            restoreLayerPosition(pasted, beforeMove);
          } catch (fallbackError) {}
        }
      }
      return {
        amount: amount,
        layer: pasted
      };
    }

    function removeLayer(layer) {
      if (!layer) return;
      try {
        layer.remove();
      } catch (e) {}
    }

    function exportSelectionAsJpg(rect, baseName) {
      var sourceDoc = app.activeDocument;
      var width = Math.max(1, Math.round(rect.right - rect.left));
      var height = Math.max(1, Math.round(rect.bottom - rect.top));
      var resolution = 72;
      try { resolution = sourceDoc.resolution; } catch (resolutionError) {}

      selectRect(rect);
      sourceDoc.selection.copy(true);
      sourceDoc.selection.deselect();

      var outDoc = app.documents.add(UnitValue(width, "px"), UnitValue(height, "px"), resolution, safeName(baseName), NewDocumentMode.RGB, DocumentFill.WHITE);
      outDoc.paste();
      try { outDoc.flatten(); } catch (flattenError) {}

      var jpgOptions = new JPEGSaveOptions();
      jpgOptions.quality = 12;
      try { jpgOptions.embedColorProfile = true; } catch (profileError) {}
      try { jpgOptions.formatOptions = FormatOptions.STANDARDBASELINE; } catch (formatError) {}
      var outFile = uniqueJpgFile(Folder($.global.__psbStampUsmExportFolder), baseName);
      outDoc.saveAs(outFile, jpgOptions, true, Extension.LOWERCASE);
      outDoc.close(SaveOptions.DONOTSAVECHANGES);
      app.activeDocument = sourceDoc;
      return outFile;
    }

    function pasteWholeDocument() {
      var targetDoc = app.activeDocument;
      var rect = {
        left: 0,
        top: 0,
        right: targetDoc.width.as("px"),
        bottom: targetDoc.height.as("px")
      };
      return pasteMergedSelection(rect, null);
    }

    var artboards = [];
    collectArtboards(app.activeDocument, artboards);

    $.global.__psbStampUsmProcessed = 0;
    $.global.__psbStampUsmFailed = 0;
    $.global.__psbStampUsmAmounts = [];
    $.global.__psbStampUsmFailures = [];
    $.global.__psbStampUsmExported = 0;

    if (artboards.length) {
      for (var j = 0; j < artboards.length; j++) {
        try {
          var stamped = pasteMergedSelection(artboards[j].rect, artboards[j].group);
          var jpg = exportSelectionAsJpg(artboards[j].rect, artboards[j].name);
          removeLayer(stamped.layer);
          $.global.__psbStampUsmProcessed++;
          $.global.__psbStampUsmExported++;
          $.global.__psbStampUsmAmounts.push(artboards[j].name + ": " + stamped.amount + "%");
        } catch (eArtboard) {
          $.global.__psbStampUsmFailed++;
          $.global.__psbStampUsmFailures.push(artboards[j].name + " | " + eArtboard);
        }
      }
    } else {
      try {
        var wholeStamped = pasteWholeDocument();
        var wholeRect = {
          left: 0,
          top: 0,
          right: app.activeDocument.width.as("px"),
          bottom: app.activeDocument.height.as("px")
        };
        exportSelectionAsJpg(wholeRect, app.activeDocument.name.replace(/\.[^\.]+$/, ""));
        removeLayer(wholeStamped.layer);
        $.global.__psbStampUsmProcessed++;
        $.global.__psbStampUsmExported++;
        $.global.__psbStampUsmAmounts.push("当前文件: " + wholeStamped.amount + "%");
      } catch (eDoc) {
        $.global.__psbStampUsmFailed++;
        $.global.__psbStampUsmFailures.push(app.activeDocument.name + " | " + eDoc);
      }
    }
  };

  try {
    doc.suspendHistory("盖印并USM锐化", "__psbStampUsmAction()");
    var details = $.global.__psbStampUsmAmounts && $.global.__psbStampUsmAmounts.length ? "\n\n" + $.global.__psbStampUsmAmounts.slice(0, 10).join("\n") : "";
    var failures = $.global.__psbStampUsmFailures && $.global.__psbStampUsmFailures.length ? "\n\n失败摘要：\n" + $.global.__psbStampUsmFailures.slice(0, 6).join("\n") : "";
    alert(
      "完成。\n\n" +
      "已盖印并锐化：" + ($.global.__psbStampUsmProcessed || 0) + "\n" +
      "已导出 JPG：" + ($.global.__psbStampUsmExported || 0) + "\n" +
      "失败：" + ($.global.__psbStampUsmFailed || 0) + "\n" +
      "耗时：" + elapsedText() +
      details +
      failures +
      "\n\n文件未自动保存，请检查后手动保存。"
    );
  } catch (e) {
    alert("脚本出错: " + e + (e && e.line ? "\n行: " + e.line : ""));
  }
})();
