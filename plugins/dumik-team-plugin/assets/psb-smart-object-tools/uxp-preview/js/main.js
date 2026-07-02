const photoshop = require("photoshop");
const uxp = require("uxp");

const { app, core, action } = photoshop;
const fs = uxp.storage.localFileSystem;
const batchPlay = action.batchPlay;

const ui = {
  link: document.getElementById("run-link"),
  collect: document.getElementById("run-collect"),
  relinkMissing: document.getElementById("run-relink-missing"),
  embed: document.getElementById("run-embed"),
  text: document.getElementById("run-text"),
  status: document.getElementById("status")
};

function setBusy(value) {
  ui.link.disabled = value;
  ui.collect.disabled = value;
  ui.relinkMissing.disabled = value;
  ui.embed.disabled = value;
  ui.text.disabled = value;
}

function setStatus(message) {
  ui.status.textContent = message || "";
}

function messageOf(error) {
  return error && error.message ? error.message : String(error);
}

async function runModal(name, fn) {
  setBusy(true);
  setStatus(name);
  try {
    await core.executeAsModal(fn, { commandName: name });
    setStatus("");
  } catch (error) {
    await showAlert("执行失败", messageOf(error));
    setStatus(messageOf(error));
  } finally {
    setBusy(false);
  }
}

async function showAlert(title, message) {
  try {
    await app.showAlert(`${title}\n\n${message}`);
  } catch (error) {
    console.log(title, message);
  }
}

async function confirmRun(title, message) {
  await showAlert(title, message);
  return true;
}

async function bp(commands) {
  return batchPlay(commands, {
    synchronousExecution: false,
    modalBehavior: "execute"
  });
}

function safeName(name) {
  const value = String(name || "smart_object")
    .replace(/[\\/:*?"<>|]/g, "_")
    .replace(/^\s+|\s+$/g, "")
    .replace(/\s+/g, "_");
  return (value || "smart_object").slice(0, 80);
}

function stripExtension(name) {
  return String(name || "未命名").replace(/\.[^.]+$/, "");
}

function pad(number, width) {
  let value = String(number);
  while (value.length < width) value = `0${value}`;
  return value;
}

function normalizePath(path) {
  return String(path || "").replace(/\\/g, "/");
}

function parentPath(path) {
  const normalized = normalizePath(path);
  const index = normalized.lastIndexOf("/");
  return index >= 0 ? normalized.slice(0, index) : "";
}

function fileNameFromPath(path) {
  const normalized = normalizePath(path);
  const parts = normalized.split("/");
  return parts[parts.length - 1] || "";
}

function nativePathToUrl(path) {
  const normalized = normalizePath(path);
  const withSlash = /^[a-zA-Z]:\//.test(normalized) ? `/${normalized}` : normalized;
  return `file://${encodeURI(withSlash)}`;
}

async function getEntry(path) {
  return fs.getEntryWithUrl(nativePathToUrl(path));
}

async function exists(path) {
  try {
    await getEntry(path);
    return true;
  } catch (error) {
    return false;
  }
}

async function ensureFolder(path) {
  try {
    return await getEntry(path);
  } catch (error) {
    return fs.createEntryWithUrl(nativePathToUrl(path), {
      type: uxp.storage.types.folder
    });
  }
}

async function createFile(path) {
  return fs.createEntryWithUrl(nativePathToUrl(path), {
    type: uxp.storage.types.file,
    overwrite: false
  });
}

async function documentDescriptor() {
  const [desc] = await bp([
    {
      _obj: "get",
      _target: [{ _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
  return desc || {};
}

function activeDocumentName() {
  const doc = app.activeDocument;
  return doc && (doc.title || doc.name) ? (doc.title || doc.name) : "未命名.psb";
}

async function activeDocumentPath() {
  const doc = app.activeDocument;
  const desc = await documentDescriptor();
  const fileRef = desc.fileReference || desc.file || desc._path;
  const candidates = [
    fileRef && fileRef._path,
    typeof fileRef === "string" ? fileRef : null,
    doc && doc.fullName && doc.fullName.nativePath,
    doc && doc.file && doc.file.nativePath,
    doc && doc.path
  ];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") {
      if (/\.(psd|psb|psdt)$/i.test(candidate)) return candidate;
      return `${candidate.replace(/[\\/]$/, "")}/${activeDocumentName()}`;
    }
  }

  throw new Error("请先保存主 PSB。");
}

async function layerCount() {
  const [desc] = await bp([
    {
      _obj: "get",
      _target: [
        { _property: "numberOfLayers" },
        { _ref: "document", _enum: "ordinal", _value: "targetEnum" }
      ],
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
  return desc && desc.numberOfLayers ? desc.numberOfLayers : 0;
}

async function layerDescriptor(index) {
  const [desc] = await bp([
    {
      _obj: "get",
      _target: [{ _ref: "layer", _index: index }],
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
  return desc || null;
}

function smartMeta(desc) {
  const so = desc.smartObject || {};
  return {
    linked: Boolean(so.linked),
    linkMissing: Boolean(so.linkMissing),
    fileReference: so.fileReference || "",
    linkPath: so.link && so.link._path ? so.link._path : ""
  };
}

async function smartObjectLayers() {
  const count = await layerCount();
  const items = [];
  for (let index = 1; index <= count; index += 1) {
    try {
      const desc = await layerDescriptor(index);
      if (!desc || !desc.smartObject || desc.layerSection === "layerSectionEnd") continue;
      items.push({
        id: desc.layerID,
        index,
        name: desc.name || `Layer ${index}`,
        meta: smartMeta(desc)
      });
    } catch (error) {
      console.log(`scan layer ${index} failed`, error);
    }
  }
  return items;
}

async function selectLayer(id) {
  await bp([
    {
      _obj: "select",
      _target: [{ _ref: "layer", _id: id }],
      makeVisible: false,
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function relinkSelected(fileEntry) {
  const token = fs.createSessionToken(fileEntry);
  await bp([
    {
      _obj: "placedLayerRelinkToFile",
      null: { _path: token, _kind: "local" },
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function convertSelectedToLinked(fileEntry) {
  const token = fs.createSessionToken(fileEntry);
  await bp([
    {
      _obj: "placedLayerConvertToLinked",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      using: { _path: token, _kind: "local" },
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function convertSelectedToEmbedded() {
  await bp([
    {
      _obj: "placedLayerConvertToEmbedded",
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function duplicateSelectedLayer() {
  await bp([
    {
      _obj: "duplicate",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function convertSelectedToLayers() {
  await bp([
    {
      _obj: "placedLayerConvertToLayers",
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function selectedIsSmartObject() {
  const [desc] = await bp([
    {
      _obj: "get",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
  return Boolean(desc && desc.smartObject);
}

async function uniqueFile(folderPath, docBase, layerName, index, layerId, extension) {
  const ext = extension || ".psb";
  const stem = `${safeName(docBase)}__${pad(index, 3)}__${safeName(layerName)}__id${layerId}`;
  let target = `${folderPath}/${stem}${ext}`;
  let n = 2;
  while (await exists(target)) {
    target = `${folderPath}/${stem}_${n}${ext}`;
    n += 1;
  }
  return createFile(target);
}

async function linksFolder() {
  const docPath = await activeDocumentPath();
  const docBase = stripExtension(activeDocumentName());
  const folderPath = `${parentPath(docPath)}/${safeName(docBase)}_links`;
  await ensureFolder(folderPath);
  return folderPath;
}

function sourcePath(meta) {
  return meta.linkPath || (meta.fileReference && normalizePath(meta.fileReference)) || "";
}

function extensionOf(path) {
  const name = fileNameFromPath(path);
  const match = name.match(/(\.[^.]+)$/);
  return match ? match[1] : ".psb";
}

async function copyFile(sourceEntry, targetEntry) {
  const bytes = await sourceEntry.read({ format: uxp.storage.formats.binary });
  await targetEntry.write(bytes, { format: uxp.storage.formats.binary });
}

async function walkFolder(folder, index) {
  const entries = await folder.getEntries();
  for (const entry of entries) {
    if (entry.isFolder) {
      await walkFolder(entry, index);
    } else if (entry.isFile) {
      const key = entry.name.toLowerCase();
      if (!index[key]) index[key] = [];
      index[key].push(entry);
    }
  }
}

function expectedName(item) {
  return fileNameFromPath(item.meta.fileReference || item.meta.linkPath || item.name);
}

async function runLink() {
  await runModal("转链接", async () => {
    const folderPath = await linksFolder();
    const docBase = stripExtension(activeDocumentName());
    const layers = await smartObjectLayers();
    const todo = layers.filter((item) => !item.meta.linked);
    if (!todo.length) throw new Error("没有内嵌智能对象。");
    if (!(await confirmRun("转链接", `将 ${todo.length} 个对象导出到 _links。`))) return;

    let ok = 0;
    for (let i = 0; i < todo.length; i += 1) {
      const item = todo[i];
      await selectLayer(item.id);
      const target = await uniqueFile(folderPath, docBase, item.name, i + 1, item.id, ".psb");
      await convertSelectedToLinked(target);
      ok += 1;
    }
    await showAlert("完成", `已转链接：${ok}`);
  });
}

async function runCollect() {
  await runModal("收集链接", async () => {
    const folderPath = await linksFolder();
    const docBase = stripExtension(activeDocumentName());
    const layers = await smartObjectLayers();
    const todo = layers.filter((item) => item.meta.linked && !item.meta.linkMissing);
    if (!todo.length) throw new Error("没有可收集的链接对象。");
    if (!(await confirmRun("收集链接", `将 ${todo.length} 个源文件拷到 _links 并重链。`))) return;

    let ok = 0;
    let fail = 0;
    for (let i = 0; i < todo.length; i += 1) {
      const item = todo[i];
      try {
        const srcPath = sourcePath(item.meta);
        if (!srcPath) throw new Error("读不到源路径");
        const source = await getEntry(srcPath);
        if (normalizePath(source.nativePath || "").indexOf(normalizePath(folderPath) + "/") === 0) continue;
        const target = await uniqueFile(folderPath, docBase, item.name, i + 1, item.id, extensionOf(srcPath));
        await copyFile(source, target);
        await selectLayer(item.id);
        await relinkSelected(target);
        ok += 1;
      } catch (error) {
        fail += 1;
        console.log("collect failed", item.name, error);
      }
    }
    await showAlert("完成", `已收集：${ok}\n失败：${fail}`);
  });
}

async function runRelinkMissing() {
  const folder = await fs.getFolder();
  if (!folder) return;

  await runModal("找回丢失链接", async () => {
    const layers = await smartObjectLayers();
    const missing = layers.filter((item) => item.meta.linked && item.meta.linkMissing);
    if (!missing.length) throw new Error("没有丢失链接。");
    if (!(await confirmRun("找回丢失链接", `将在所选文件夹里按文件名匹配 ${missing.length} 个对象。`))) return;

    const index = {};
    await walkFolder(folder, index);
    let ok = 0;
    let fail = 0;
    let skipped = 0;
    for (const item of missing) {
      const name = expectedName(item);
      const matches = index[String(name).toLowerCase()] || [];
      if (matches.length !== 1) {
        if (matches.length > 1) skipped += 1;
        else fail += 1;
        continue;
      }
      try {
        await selectLayer(item.id);
        await relinkSelected(matches[0]);
        ok += 1;
      } catch (error) {
        fail += 1;
      }
    }
    await showAlert("完成", `已重链：${ok}\n跳过：${skipped}\n失败：${fail}`);
  });
}

async function runEmbed() {
  await runModal("嵌回文件", async () => {
    const layers = await smartObjectLayers();
    const todo = layers.filter((item) => item.meta.linked);
    if (!todo.length) throw new Error("没有链接智能对象。");
    if (!(await confirmRun("嵌回文件", `将 ${todo.length} 个链接 SO 变成内嵌。`))) return;

    let ok = 0;
    for (const item of todo) {
      await selectLayer(item.id);
      await convertSelectedToEmbedded();
      ok += 1;
    }
    await showAlert("完成", `已嵌回：${ok}`);
  });
}

async function runExtractText() {
  await runModal("提取文字", async () => {
    if (!(await selectedIsSmartObject())) throw new Error("请先选中一个智能对象。");
    if (!(await confirmRun("提取文字", "UXP 版先展开当前 SO。完整卖点分组还在迁移。"))) return;
    await duplicateSelectedLayer();
    await convertSelectedToLayers();
    await showAlert("完成", "已复制并展开当前 SO。");
  });
}

ui.link.addEventListener("click", runLink);
ui.collect.addEventListener("click", runCollect);
ui.relinkMissing.addEventListener("click", runRelinkMissing);
ui.embed.addEventListener("click", runEmbed);
ui.text.addEventListener("click", runExtractText);
