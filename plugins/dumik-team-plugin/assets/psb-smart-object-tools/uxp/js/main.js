const photoshop = require("photoshop");
const uxp = require("uxp");

const { app, core, action } = photoshop;
const fs = uxp.storage.localFileSystem;
const batchPlay = action.batchPlay;
const MAX_OPEN_PROXY_BATCH = 4;

const ui = {
  link: document.getElementById("run-link"),
  collect: document.getElementById("run-collect"),
  relinkMissing: document.getElementById("run-relink-missing"),
  embed: document.getElementById("run-embed"),
  text: document.getElementById("run-text"),
  cleanMeta: document.getElementById("run-clean-meta"),
  cleanupLinks: document.getElementById("run-cleanup-links"),
  stampUsm: document.getElementById("run-stamp-usm"),
  status: document.getElementById("status")
};

function setBusy(value) {
  ui.link.disabled = value;
  ui.collect.disabled = value;
  ui.relinkMissing.disabled = value;
  ui.embed.disabled = value;
  ui.text.disabled = value;
  ui.cleanMeta.disabled = value;
  ui.cleanupLinks.disabled = value;
  ui.stampUsm.disabled = value;
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

function numberValue(value) {
  if (typeof value === "number") return value;
  if (value && typeof value._value === "number") return value._value;
  return Number(value || 0);
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

async function readHeader(fileEntry, count) {
  try {
    const bytes = await fileEntry.read({ format: uxp.storage.formats.binary });
    const slice = bytes.slice ? bytes.slice(0, count || 16) : bytes;
    return Array.from(slice).map((n) => String.fromCharCode(n)).join("");
  } catch (error) {
    return "";
  }
}

async function duplicateActiveDocument(name) {
  await bp([
    {
      _obj: "duplicate",
      _target: [{ _ref: "document", _enum: "ordinal", _value: "targetEnum" }],
      name,
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function cropDocument(rect) {
  await bp([
    {
      _obj: "crop",
      to: {
        _obj: "rectangle",
        top: { _unit: "pixelsUnit", _value: rect.top },
        left: { _unit: "pixelsUnit", _value: rect.left },
        bottom: { _unit: "pixelsUnit", _value: rect.bottom },
        right: { _unit: "pixelsUnit", _value: rect.right }
      },
      angle: { _unit: "angleUnit", _value: 0 },
      delete: true,
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function flattenDocument() {
  await bp([
    {
      _obj: "flattenImage",
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function applyUnsharpMask(amount) {
  await bp([
    {
      _obj: "unsharpMask",
      amount: { _unit: "percentUnit", _value: amount },
      radius: { _unit: "pixelsUnit", _value: 1 },
      threshold: 0,
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function saveActiveDocumentAsJpg(fileEntry) {
  const token = fs.createSessionToken(fileEntry);
  await bp([
    {
      _obj: "save",
      as: {
        _obj: "JPEG",
        extendedQuality: 12,
        matteColor: { _enum: "matteColor", _value: "none" }
      },
      in: { _path: token, _kind: "local" },
      documentID: app.activeDocument && app.activeDocument.id,
      copy: true,
      lowerCase: true,
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function saveActiveDocumentAsPsb(fileEntry) {
  const token = fs.createSessionToken(fileEntry);
  await bp([
    {
      _obj: "save",
      as: {
        _obj: "photoshop35Format",
        maximizeCompatibility: true
      },
      in: { _path: token, _kind: "local" },
      documentID: app.activeDocument && app.activeDocument.id,
      copy: true,
      lowerCase: true,
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function openFileEntry(fileEntry) {
  const token = fs.createSessionToken(fileEntry);
  await bp([
    {
      _obj: "open",
      null: { _path: token, _kind: "local" },
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
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

function artboardRectFromDescriptor(desc) {
  const artboard = desc && desc.artboard;
  const rect = artboard && artboard.artboardRect;
  if (!rect) return null;
  const out = {
    left: numberValue(rect.left),
    top: numberValue(rect.top),
    right: numberValue(rect.right),
    bottom: numberValue(rect.bottom)
  };
  if (out.right <= out.left || out.bottom <= out.top) return null;
  return out;
}

async function artboardLayers() {
  const count = await layerCount();
  const items = [];
  for (let index = 1; index <= count; index += 1) {
    try {
      const desc = await layerDescriptor(index);
      const rect = artboardRectFromDescriptor(desc);
      if (!rect) continue;
      items.push({
        id: desc.layerID,
        index,
        name: desc.name || `Artboard ${index}`,
        rect
      });
    } catch (error) {
      console.log(`scan artboard ${index} failed`, error);
    }
  }
  return items;
}

async function documentRect() {
  const desc = await documentDescriptor();
  const width = numberValue(desc.width || (app.activeDocument && app.activeDocument.width));
  const height = numberValue(desc.height || (app.activeDocument && app.activeDocument.height));
  return {
    left: 0,
    top: 0,
    right: Math.max(1, Math.round(width)),
    bottom: Math.max(1, Math.round(height))
  };
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

async function activeLayerDescriptor() {
  const [desc] = await bp([
    {
      _obj: "get",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
  return desc || {};
}

async function renameSelectedLayer(name) {
  await bp([
    {
      _obj: "set",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      to: {
        _obj: "layer",
        name
      },
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function hideLayer(id) {
  await bp([
    {
      _obj: "hide",
      _target: [{ _ref: "layer", _id: id }],
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function selectAllLayers() {
  await bp([
    {
      _obj: "selectAllLayers",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function convertSelectedLayersToSmartObject() {
  await bp([
    {
      _obj: "newPlacedLayer",
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function editSmartObjectContents() {
  await bp([
    {
      _obj: "placedLayerEditContents",
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function closeActiveDocument(saveChanges) {
  await bp([
    {
      _obj: "close",
      saving: {
        _enum: "yesNo",
        _value: saveChanges ? "yes" : "no"
      },
      _options: { dialogOptions: "dontDisplay" }
    }
  ]);
}

async function rasterizeSelectedLayer() {
  await bp([
    {
      _obj: "rasterizeLayer",
      _target: [{ _ref: "layer", _enum: "ordinal", _value: "targetEnum" }],
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

function isProxyName(name) {
  return /(^|[_\-\s])proxy(\.psb)?$/i.test(String(name || "").replace(/\.[^.\\/]+$/, ""));
}

function isProxySmartObject(item) {
  const meta = item && item.meta ? item.meta : {};
  return isProxyName(item && item.name) || isProxyName(meta.fileReference) || isProxyName(meta.linkPath);
}

function singleFileSmartObject(item) {
  const meta = item && item.meta ? item.meta : {};
  const text = `${meta.fileReference || ""} ${item && item.name ? item.name : ""}`;
  return /\.(pdf|ai|eps|png|jpg|jpeg|tif|tiff|webp|gif|bmp|svg)\b/i.test(text);
}

function layerNameFromFile(fileEntry) {
  return stripExtension(fileEntry && fileEntry.name ? fileEntry.name : "linked_smart_object").slice(0, 120);
}

async function embedSelectedLinkedSmartObjectIfNeeded() {
  const desc = await activeLayerDescriptor();
  const meta = smartMeta(desc);
  if (!meta.linked) return false;
  await convertSelectedToEmbedded();
  return true;
}

async function makeProxyPreviewFromOriginal(originalId) {
  await duplicateSelectedLayer();
  await rasterizeSelectedLayer();
  await renameSelectedLayer("__PROXY_PREVIEW__");
  await hideLayer(originalId);
}

async function proxySelectedSmartObjectInternally(linkedFileEntry, mainLayerId) {
  await editSmartObjectContents();
  try {
    await selectAllLayers();
    await convertSelectedLayersToSmartObject();
    await convertSelectedToLinked(linkedFileEntry);
    const original = await activeLayerDescriptor();
    const originalId = original.layerID;
    await renameSelectedLayer("__ORIGINAL_LINK__");
    await makeProxyPreviewFromOriginal(originalId);
    await closeActiveDocument(true);
  } catch (error) {
    try {
      await closeActiveDocument(false);
    } catch (closeError) {
      console.log("close failed", closeError);
    }
    throw error;
  }

  await selectLayer(mainLayerId);
  await embedSelectedLinkedSmartObjectIfNeeded();
  await renameSelectedLayer(`${layerNameFromFile(linkedFileEntry)}_proxy`);
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
  const folderPath = `${parentPath(docPath)}/links/${safeName(docBase)}_links`;
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

function importStyleExtension(name) {
  return /\.(pdf|ai|eps)$/i.test(String(name || ""));
}

async function fileNeedsPsbRepair(entry) {
  const ext = extensionOf(entry.name || "").toLowerCase();
  if (!/\.(psb|psd|psdt|pdf|ai|eps)$/i.test(ext)) return false;
  if (importStyleExtension(entry.name)) return true;
  const header = await readHeader(entry, 16);
  if (header.slice(0, 4) === "8BPS") return false;
  if (header.slice(0, 4) === "%PDF") return true;
  if (header.slice(0, 4) === "%!PS") return true;
  return /\.(psb|psd|psdt)$/i.test(ext);
}

async function repairedPsbFor(entry) {
  if (!(await fileNeedsPsbRepair(entry))) return entry;
  const parent = await parentEntryOf(entry);
  const base = `${safeName(stripExtension(entry.name))}__fixed`;
  const fixed = await createUniqueChildFile(parent, base, ".psb");
  await openFileEntry(entry);
  try {
    await saveActiveDocumentAsPsb(fixed);
    await closeActiveDocument(false);
  } catch (error) {
    try {
      await closeActiveDocument(false);
    } catch (closeError) {
      console.log("close repaired source failed", closeError);
    }
    throw error;
  }
  return fixed;
}

async function createUniqueChildFile(folderEntry, baseName, extension) {
  const cleanBase = safeName(stripExtension(baseName || "export"));
  const ext = extension || ".jpg";
  const entries = await folderEntry.getEntries();
  const names = {};
  for (const entry of entries) names[String(entry.name).toLowerCase()] = true;

  let name = `${cleanBase}${ext}`;
  let n = 2;
  while (names[name.toLowerCase()]) {
    name = `${cleanBase}_${n}${ext}`;
    n += 1;
  }
  return folderEntry.createFile(name, { overwrite: false });
}

async function parentEntryOf(entry) {
  if (entry && typeof entry.getParent === "function") return entry.getParent();
  if (entry && entry.parent) return entry.parent;
  const native = entry && entry.nativePath ? entry.nativePath : "";
  if (!native) throw new Error("读不到文件父目录");
  return getEntry(parentPath(native));
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

function timestamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function pathKey(path) {
  return normalizePath(path).toLowerCase();
}

async function scanFiles(folder, out) {
  const entries = await folder.getEntries();
  for (const entry of entries) {
    if (entry.isFolder) {
      if (!/^_unused_links_/i.test(entry.name)) await scanFiles(entry, out);
    } else if (entry.isFile) {
      out.push(entry);
    }
  }
}

async function collectUsedLinksFromActiveDocument(used) {
  const layers = await smartObjectLayers();
  for (const item of layers) {
    if (item.meta.linked && !item.meta.linkMissing) {
      const src = sourcePath(item.meta);
      if (src) used[pathKey(src)] = true;
    }
    if (isProxySmartObject(item)) {
      await selectLayer(item.id);
      await editSmartObjectContents();
      try {
        await collectUsedLinksFromActiveDocument(used);
        await closeActiveDocument(false);
      } catch (error) {
        try {
          await closeActiveDocument(false);
        } catch (closeError) {
          console.log("close proxy failed", closeError);
        }
        throw error;
      }
    }
  }
}

function textFromDescriptor(desc) {
  const key = desc && desc.textKey;
  if (!key) return "";
  return key.textKey || key.textStyleRange && key.textStyleRange.text || key.engineData || "";
}

async function textLayersInActiveDocument() {
  const count = await layerCount();
  const out = [];
  for (let index = 1; index <= count; index += 1) {
    try {
      const desc = await layerDescriptor(index);
      const text = textFromDescriptor(desc);
      if (!text) continue;
      out.push({
        name: desc.name || `Text ${index}`,
        text: String(text)
      });
    } catch (error) {
      console.log("read text layer failed", index, error);
    }
  }
  return out;
}

async function collectOneLinkedItem(item, folderPath, docBase, index) {
  const srcPath = sourcePath(item.meta);
  if (!srcPath) throw new Error("读不到源路径");
  let source = await getEntry(srcPath);
  source = await repairedPsbFor(source);
  if (normalizePath(source.nativePath || "").indexOf(normalizePath(folderPath) + "/") === 0) {
    return "skipped";
  }
  const target = await uniqueFile(folderPath, docBase, item.name, index + 1, item.id, extensionOf(srcPath));
  await copyFile(source, target);
  await selectLayer(item.id);
  await relinkSelected(target);
  return "ok";
}

async function collectProxyInternalLinks(item, folderPath, docBase, indexBase) {
  await selectLayer(item.id);
  await editSmartObjectContents();
  let ok = 0;
  let skipped = 0;
  let fail = 0;
  try {
    const children = await smartObjectLayers();
    for (let i = 0; i < children.length; i += 1) {
      const child = children[i];
      if (!child.meta.linked || child.meta.linkMissing) continue;
      try {
        const result = await collectOneLinkedItem(child, folderPath, docBase, indexBase + i);
        if (result === "skipped") skipped += 1;
        else ok += 1;
      } catch (error) {
        fail += 1;
        console.log("collect proxy child failed", child.name, error);
      }
    }
    await closeActiveDocument(true);
  } catch (error) {
    try {
      await closeActiveDocument(false);
    } catch (closeError) {
      console.log("close proxy failed", closeError);
    }
    throw error;
  }
  return { ok, skipped, fail };
}

function uniqueMatch(index, name) {
  const matches = index[String(name || "").toLowerCase()] || [];
  if (matches.length === 1) return { entry: matches[0], skipped: false };
  return { entry: null, skipped: matches.length > 1 };
}

async function relinkProxyInternalMissing(item, index) {
  await selectLayer(item.id);
  await editSmartObjectContents();
  let ok = 0;
  let skipped = 0;
  let fail = 0;
  try {
    const children = await smartObjectLayers();
    for (const child of children) {
      if (!child.meta.linked || !child.meta.linkMissing) continue;
      const match = uniqueMatch(index, expectedName(child));
      if (!match.entry) {
        if (match.skipped) skipped += 1;
        else fail += 1;
        continue;
      }
      try {
            await selectLayer(child.id);
            await relinkSelected(await repairedPsbFor(match.entry));
            ok += 1;
      } catch (error) {
        fail += 1;
        console.log("relink proxy child failed", child.name, error);
      }
    }
    await closeActiveDocument(true);
  } catch (error) {
    try {
      await closeActiveDocument(false);
    } catch (closeError) {
      console.log("close proxy failed", closeError);
    }
    throw error;
  }
  return { ok, skipped, fail };
}

async function runLink() {
  await runModal("转链接", async () => {
    const folderPath = await linksFolder();
    const docBase = stripExtension(activeDocumentName());
    const layers = await smartObjectLayers();
    const todo = layers.filter((item) => !item.meta.linked && !isProxySmartObject(item) && !singleFileSmartObject(item));
    if (!todo.length) throw new Error("没有内嵌智能对象。");
    if (!(await confirmRun("转链接", `将 ${todo.length} 个对象转成内部代理结构，链接文件放到 links。`))) return;

    let ok = 0;
    let fail = 0;
    for (let i = 0; i < todo.length; i += 1) {
      const item = todo[i];
      try {
        await selectLayer(item.id);
        const target = await uniqueFile(folderPath, docBase, item.name, i + 1, item.id, ".psb");
        await proxySelectedSmartObjectInternally(target, item.id);
        ok += 1;
      } catch (error) {
        fail += 1;
        console.log("link proxy failed", item.name, error);
      }
    }
    await showAlert("完成", `已转代理链接：${ok}\n失败：${fail}`);
  });
}

async function runCollect() {
  await runModal("收集链接", async () => {
    const folderPath = await linksFolder();
    const docBase = stripExtension(activeDocumentName());
    const layers = await smartObjectLayers();
    const todo = layers.filter((item) => (item.meta.linked && !item.meta.linkMissing) || isProxySmartObject(item));
    if (!todo.length) throw new Error("没有可收集的链接对象。");
    if (!(await confirmRun("收集链接", `将 ${todo.length} 个对象的源文件拷到 links 并重链。代理内部也会处理。`))) return;

    let ok = 0;
    let skipped = 0;
    let fail = 0;
    for (let i = 0; i < todo.length; i += 1) {
      const item = todo[i];
      try {
        if (isProxySmartObject(item)) {
          const result = await collectProxyInternalLinks(item, folderPath, docBase, i * 1000);
          ok += result.ok;
          skipped += result.skipped;
          fail += result.fail;
        } else {
          const result = await collectOneLinkedItem(item, folderPath, docBase, i);
          if (result === "skipped") skipped += 1;
          else ok += 1;
        }
      } catch (error) {
        fail += 1;
        console.log("collect failed", item.name, error);
      }
    }
    await showAlert("完成", `已收集：${ok}\n已跳过：${skipped}\n失败：${fail}`);
  });
}

async function runRelinkMissing() {
  const folder = await fs.getFolder();
  if (!folder) return;

  await runModal("找回丢失链接", async () => {
    const layers = await smartObjectLayers();
    const missing = layers.filter((item) => (item.meta.linked && item.meta.linkMissing) || isProxySmartObject(item));
    if (!missing.length) throw new Error("没有丢失链接。");
    if (!(await confirmRun("找回丢失链接", `将在所选文件夹里按文件名匹配 ${missing.length} 个对象。代理内部也会处理。`))) return;

    const index = {};
    await walkFolder(folder, index);
    let ok = 0;
    let fail = 0;
    let skipped = 0;
    for (const item of missing) {
      if (isProxySmartObject(item)) {
        try {
          const result = await relinkProxyInternalMissing(item, index);
          ok += result.ok;
          skipped += result.skipped;
          fail += result.fail;
        } catch (error) {
          fail += 1;
          console.log("relink proxy failed", item.name, error);
        }
        continue;
      }
      const name = expectedName(item);
      const match = uniqueMatch(index, name);
      if (!match.entry) {
        if (match.skipped) skipped += 1;
        else fail += 1;
        continue;
      }
      try {
        await selectLayer(item.id);
        await relinkSelected(await repairedPsbFor(match.entry));
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
    const todo = layers.filter((item) => item.meta.linked && !isProxySmartObject(item));
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

async function runCleanupLinks() {
  await runModal("清废链接", async () => {
    const folderPath = await linksFolder();
    const linksEntry = await getEntry(folderPath);
    const files = [];
    await scanFiles(linksEntry, files);
    if (!files.length) throw new Error("links 文件夹里没有文件。");

    const used = {};
    await collectUsedLinksFromActiveDocument(used);

    const unused = files.filter((entry) => {
      const native = entry.nativePath || entry.name;
      return !used[pathKey(native)];
    });
    if (!unused.length) {
      await showAlert("完成", "没有发现废弃 links 文件。");
      return;
    }

    const trash = await ensureFolder(`${folderPath}/_unused_links_${timestamp()}`);
    let moved = 0;
    let fail = 0;
    for (const entry of unused) {
      try {
        if (typeof entry.moveTo !== "function") throw new Error("当前 UXP 文件对象不支持 moveTo");
        await entry.moveTo(trash, { overwrite: false });
        moved += 1;
      } catch (error) {
        fail += 1;
        console.log("move unused failed", entry.name, error);
      }
    }
    await showAlert("完成", `已移动：${moved}\n失败：${fail}`);
  });
}

function sharpenAmountForRect(rect) {
  return Math.round(rect.right - rect.left) > 1000 ? 77 : 44;
}

async function exportSharpenedRect(rect, name, outputFolder) {
  const amount = sharpenAmountForRect(rect);
  const outFile = await createUniqueChildFile(outputFolder, name, ".jpg");
  const tempName = `${safeName(name)}_USM_tmp`;

  await duplicateActiveDocument(tempName);
  try {
    await cropDocument(rect);
    try {
      await flattenDocument();
    } catch (flattenError) {
      console.log("flatten failed", flattenError);
    }
    await applyUnsharpMask(amount);
    await saveActiveDocumentAsJpg(outFile);
    await closeActiveDocument(false);
  } catch (error) {
    try {
      await closeActiveDocument(false);
    } catch (closeError) {
      console.log("close temp failed", closeError);
    }
    throw error;
  }

  return { amount, file: outFile };
}

async function runStampUsm() {
  const outputFolder = await fs.getFolder();
  if (!outputFolder) return;

  await runModal("锐化导出", async () => {
    const artboards = await artboardLayers();
    const jobs = artboards.length
      ? artboards.map((item) => ({ name: item.name, rect: item.rect }))
      : [{ name: stripExtension(activeDocumentName()), rect: await documentRect() }];

    let ok = 0;
    let fail = 0;
    const amounts = [];
    for (const job of jobs) {
      try {
        const result = await exportSharpenedRect(job.rect, job.name, outputFolder);
        ok += 1;
        amounts.push(`${job.name}: ${result.amount}%`);
      } catch (error) {
        fail += 1;
        console.log("stamp usm failed", job.name, error);
      }
    }

    await showAlert("完成", `已导出：${ok}\n失败：${fail}\n${amounts.slice(0, 8).join("\n")}`);
  });
}

async function deleteDocumentMetadata() {
  const props = ["documentAncestors", "metadata"];
  let removed = 0;
  for (const prop of props) {
    try {
      await bp([
        {
          _obj: "delete",
          _target: [
            { _property: prop },
            { _ref: "document", _enum: "ordinal", _value: "targetEnum" }
          ],
          _options: { dialogOptions: "dontDisplay" }
        }
      ]);
      removed += 1;
    } catch (error) {
      console.log("delete metadata property failed", prop, error);
    }
  }
  return removed;
}

async function cleanMetadataDeep() {
  let cleaned = await deleteDocumentMetadata();
  let failed = 0;
  const layers = await smartObjectLayers();
  for (const item of layers) {
    if (item.meta.linked || item.meta.linkMissing || isProxySmartObject(item)) continue;
    try {
      await selectLayer(item.id);
      await editSmartObjectContents();
      try {
        cleaned += await deleteDocumentMetadata();
        await closeActiveDocument(true);
      } catch (innerError) {
        try {
          await closeActiveDocument(false);
        } catch (closeError) {
          console.log("close metadata child failed", closeError);
        }
        throw innerError;
      }
    } catch (error) {
      failed += 1;
      console.log("clean child metadata failed", item.name, error);
    }
  }
  return { cleaned, failed };
}

async function runCleanMeta() {
  await runModal("清元数据", async () => {
    const result = await cleanMetadataDeep();
    await showAlert("完成", `已清理元数据项：${result.cleaned}\n内部失败：${result.failed}\n文件不会自动保存。`);
  });
}

async function runExtractText() {
  const outputFolder = await fs.getFolder();
  if (!outputFolder) return;

  await runModal("提取文字", async () => {
    if (!(await selectedIsSmartObject())) throw new Error("请先选中一个智能对象。");
    const selected = await activeLayerDescriptor();
    const layerName = selected.name || "smart_object";
    await editSmartObjectContents();
    let texts = [];
    try {
      texts = await textLayersInActiveDocument();
      await closeActiveDocument(false);
    } catch (error) {
      try {
        await closeActiveDocument(false);
      } catch (closeError) {
        console.log("close text source failed", closeError);
      }
      throw error;
    }

    const outFile = await createUniqueChildFile(outputFolder, `${layerName}_文字`, ".txt");
    const body = texts.map((item, index) => `# ${index + 1}. ${item.name}\n${item.text}`).join("\n\n");
    await outFile.write(body || "未找到文字图层", { format: uxp.storage.formats.utf8 });
    await showAlert("完成", `文字层：${texts.length}\n文件：${outFile.name}`);
  });
}

ui.link.addEventListener("click", runLink);
ui.collect.addEventListener("click", runCollect);
ui.relinkMissing.addEventListener("click", runRelinkMissing);
ui.embed.addEventListener("click", runEmbed);
ui.text.addEventListener("click", runExtractText);
ui.cleanMeta.addEventListener("click", runCleanMeta);
ui.cleanupLinks.addEventListener("click", runCleanupLinks);
ui.stampUsm.addEventListener("click", runStampUsm);
