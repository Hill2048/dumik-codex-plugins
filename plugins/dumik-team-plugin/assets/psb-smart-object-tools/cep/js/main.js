(function () {
  var statusEl = document.getElementById("status");
  var linkButton = document.getElementById("run-link");
  var linkOptionsToggle = document.getElementById("link-options-toggle");
  var linkOptions = document.getElementById("link-options");
  var linkRewriteCompatibleToggle = document.getElementById("link-rewrite-compatible");
  var linkRepairExistingToggle = document.getElementById("link-repair-existing");
  var selectedProxyButton = document.getElementById("run-selected-proxy");
  var collectButton = document.getElementById("run-collect");
  var relinkMissingButton = document.getElementById("run-relink-missing");
  var embedButton = document.getElementById("run-embed");
  var cleanupLinksButton = document.getElementById("run-cleanup-links");
  var textButton = document.getElementById("run-text");
  var cleanMetadataButton = document.getElementById("run-clean-metadata");
  var cleanMetadataOptionsToggle = document.getElementById("clean-metadata-options-toggle");
  var cleanMetadataOptions = document.getElementById("clean-metadata-options");
  var cleanEmbeddedSoToggle = document.getElementById("clean-embedded-so");
  var purgeCacheButton = document.getElementById("run-purge-cache");
  var stampUsmButton = document.getElementById("run-stamp-usm");

  var scripts = {
    link: "link-smart-objects.jsx",
    collect: "collect-linked-smart-objects.jsx",
    relinkMissing: "relink-missing-smart-objects.jsx",
    embed: "embed-linked-smart-objects.jsx",
    cleanupLinks: "cleanup-unused-links.jsx",
    text: "extract-smart-object-text.jsx",
    cleanMetadata: "clean-ps-metadata.jsx",
    purgeCache: "purge-ps-cache.jsx",
    stampUsm: "stamp-usm-sharpen-documents.jsx"
  };

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function setBusy(isBusy) {
    linkButton.disabled = isBusy;
    linkOptionsToggle.classList.toggle("disabled", isBusy);
    linkRewriteCompatibleToggle.disabled = isBusy;
    linkRepairExistingToggle.disabled = isBusy;
    selectedProxyButton.disabled = isBusy;
    collectButton.disabled = isBusy;
    relinkMissingButton.disabled = isBusy;
    embedButton.disabled = isBusy;
    cleanupLinksButton.disabled = isBusy;
    textButton.disabled = isBusy;
    cleanMetadataButton.disabled = isBusy;
    cleanMetadataOptionsToggle.classList.toggle("disabled", isBusy);
    cleanEmbeddedSoToggle.disabled = isBusy;
    purgeCacheButton.disabled = isBusy;
    stampUsmButton.disabled = isBusy;
  }

  function toggleOptions(popover, toggle, disabledButton, event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (disabledButton.disabled) return;
    popover.hidden = !popover.hidden;
    toggle.classList.toggle("open", !popover.hidden);
  }

  function toggleLinkOptions(event) {
    toggleOptions(linkOptions, linkOptionsToggle, linkButton, event);
  }

  function toggleCleanMetadataOptions(event) {
    toggleOptions(cleanMetadataOptions, cleanMetadataOptionsToggle, cleanMetadataButton, event);
  }

  function extensionRoot() {
    if (!window.__adobe_cep__ || !window.__adobe_cep__.getSystemPath) {
      throw new Error("没有检测到 CEP 环境。请在 Photoshop 插件面板里运行。");
    }
    return window.__adobe_cep__.getSystemPath("extension").replace(/\\/g, "/");
  }

  function jsxQuote(value) {
    return '"' + String(value).replace(/\\/g, "/").replace(/"/g, '\\"') + '"';
  }

  function runJsxFile(fileName, label, prefixScript) {
    setBusy(true);
    setStatus("正在执行：" + label);

    try {
      var path = extensionRoot() + "/jsx/" + fileName;
      var script = (prefixScript || "") + "$.evalFile(" + jsxQuote(path) + ")";
      window.__adobe_cep__.evalScript(script, function (result) {
        setBusy(false);
        if (result && /^EvalScript error\./.test(result)) {
          setStatus("执行失败：" + result);
          return;
        }
        setStatus("已触发：" + label + "。请看 Photoshop 弹窗和脚本日志。");
      });
    } catch (error) {
      setBusy(false);
      setStatus("执行失败：" + error.message);
    }
  }

  linkButton.addEventListener("click", function () {
    var rewriteCompatible = linkRewriteCompatibleToggle ? linkRewriteCompatibleToggle.checked : false;
    var repairExisting = linkRepairExistingToggle ? linkRepairExistingToggle.checked : false;
    runJsxFile(
      scripts.link,
      "批量转链接智能对象",
      "$.global.__psbLinkRewriteCompatible = " + (rewriteCompatible ? "true;" : "false;") +
        "$.global.__psbLinkRepairExisting = " + (repairExisting ? "true;" : "false;") +
        "$.global.__psbLinkSelectedProxy = false;"
    );
  });

  linkOptionsToggle.addEventListener("click", toggleLinkOptions);
  linkOptionsToggle.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") toggleLinkOptions(event);
  });

  selectedProxyButton.addEventListener("click", function () {
    runJsxFile(
      scripts.link,
      "选中智能对象转代理",
      "$.global.__psbLinkRewriteCompatible = false;" +
        "$.global.__psbLinkRepairExisting = false;" +
        "$.global.__psbLinkSelectedProxy = true;"
    );
  });

  collectButton.addEventListener("click", function () {
    runJsxFile(scripts.collect, "收集链接对象到主文件目录");
  });

  relinkMissingButton.addEventListener("click", function () {
    runJsxFile(scripts.relinkMissing, "批量重新链接丢失智能对象");
  });

  embedButton.addEventListener("click", function () {
    runJsxFile(scripts.embed, "批量嵌入链接智能对象");
  });

  cleanupLinksButton.addEventListener("click", function () {
    runJsxFile(scripts.cleanupLinks, "清理废弃 links 文件");
  });

  textButton.addEventListener("click", function () {
    runJsxFile(scripts.text, "只提取当前 SO 文字");
  });

  cleanMetadataOptionsToggle.addEventListener("click", toggleCleanMetadataOptions);
  cleanMetadataOptionsToggle.addEventListener("keydown", function (event) {
    if (event.key === "Enter" || event.key === " ") toggleCleanMetadataOptions(event);
  });

  cleanMetadataButton.addEventListener("click", function () {
    var includeEmbedded = cleanEmbeddedSoToggle ? cleanEmbeddedSoToggle.checked : true;
    runJsxFile(
      scripts.cleanMetadata,
      "清理 PS 元数据",
      "$.global.__psbCleanMetadataIncludeEmbedded = " + (includeEmbedded ? "true;" : "false;")
    );
  });

  purgeCacheButton.addEventListener("click", function () {
    runJsxFile(scripts.purgeCache, "清理 PS 缓存");
  });

  stampUsmButton.addEventListener("click", function () {
    runJsxFile(scripts.stampUsm, "锐化并导出 JPG");
  });

  setStatus("准备就绪");
})();
