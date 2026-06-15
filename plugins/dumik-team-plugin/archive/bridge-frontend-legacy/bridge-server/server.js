/**
 * DUMIK 详情页批量协作 · 本地桥服务（最小骨架）
 *
 * 职责：
 *  1) 托管 BatchRefiner 构建产物（静态前端）。
 *  2) 把项目图片以 URL 暴露给前端（resultImages.src 的相对路径在这里解析）。
 *  3) watch  <项目>/bridge/run-state.json 和 <项目>/输出/确认图/，变化即 WebSocket 推前端。
 *  4) 收前端 POST 的选片，写 <项目>/bridge/selection.json，供 Agent 读取。
 *  5) 持有 Agent 端 API Key（仅服务端，前端拿不到）。本骨架不直接生图，生成由 Agent 负责。
 *
 * 合同字段见 assets/批量协作-文件合同.md。
 *
 * 运行：
 *   PROJECT_DIR="F:\\path\\to\\project\\<项目名>" FRONTEND_DIST="F:\\path\\to\\BatchRefiner\\dist" node server.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const express = require('express');
const chokidar = require('chokidar');
const { WebSocketServer } = require('ws');

// ---- 配置（用环境变量覆盖）---------------------------------------------
const PORT = Number(process.env.PORT || 4399);
const PROJECT_DIR = process.env.PROJECT_DIR || process.cwd();
const FRONTEND_DIST = process.env.FRONTEND_DIST || ''; // BatchRefiner 构建产物目录；空则只跑 API
// Agent 端图片接口 Key：只读进内存，绝不下发前端、绝不写日志。
const AGENT_API_KEY = process.env.AGENT_API_KEY || '';

const BRIDGE_DIR = path.join(PROJECT_DIR, 'bridge');
const RUN_STATE_PATH = path.join(BRIDGE_DIR, 'run-state.json');
const SELECTION_PATH = path.join(BRIDGE_DIR, 'selection.json');
const CONFIRM_DIR = path.join(PROJECT_DIR, '输出', '确认图');
const LOCAL_ORIGIN_RE = /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])(?::\d+)?$/;

fs.mkdirSync(BRIDGE_DIR, { recursive: true });

// ---- 工具 --------------------------------------------------------------
function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

function writeJsonAtomic(file, obj) {
  const tmp = `${file}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), 'utf8');
  fs.renameSync(tmp, file); // 原子替换，避免前端读到半截
}

// 把 run-state 里图片的相对路径转成前端可读的 /files URL
function decorateRunState(state) {
  if (!state || !Array.isArray(state.tasks)) return state;
  const toUrl = (rel) =>
    rel && !/^https?:|^data:/.test(rel) ? `/files/${encodeURI(rel.replace(/\\/g, '/'))}` : rel;
  for (const task of state.tasks) {
    if (task.sourceImage) task.sourceImage = toUrl(task.sourceImage);
    if (Array.isArray(task.referenceImages)) task.referenceImages = task.referenceImages.map(toUrl);
    if (Array.isArray(task.resultImages)) {
      for (const r of task.resultImages) if (r.src) r.src = toUrl(r.src);
    }
  }
  return state;
}

// ---- HTTP --------------------------------------------------------------
const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && LOCAL_ORIGIN_RE.test(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
  }
  next();
});

app.use(express.json({ limit: '4mb' }));

// 项目图片静态服务（resultImages.src 相对路径在此解析）
app.use('/files', express.static(PROJECT_DIR));

// 拉当前 run-state（首连兜底）
app.get('/api/run-state', (_req, res) => {
  const state = decorateRunState(readJsonSafe(RUN_STATE_PATH));
  res.json(state || { schemaVersion: 1, tasks: [], pipeline: { stage: 'planning' }, stats: {} });
});

// 收选片：合并写入 selection.json，供 Agent 读
app.post('/api/selection', (req, res) => {
  const incoming = req.body || {};
  const current = readJsonSafe(SELECTION_PATH) || { schemaVersion: 1 };
  const merged = { ...current, ...incoming, submittedAt: Date.now() };
  writeJsonAtomic(SELECTION_PATH, merged);
  broadcast({ type: 'selection-saved', submittedAt: merged.submittedAt });
  res.json({ ok: true });
});

// 托管前端
if (FRONTEND_DIST) {
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (_req, res) => res.sendFile(path.join(FRONTEND_DIST, 'index.html')));
}

const server = http.createServer(app);

// ---- WebSocket ---------------------------------------------------------
const wss = new WebSocketServer({ server, path: '/ws' });

function broadcast(msg) {
  const data = JSON.stringify(msg);
  for (const client of wss.clients) {
    if (client.readyState === 1) client.send(data);
  }
}

function pushRunState() {
  const state = decorateRunState(readJsonSafe(RUN_STATE_PATH));
  if (state) broadcast({ type: 'run-state', state });
}

wss.on('connection', (ws) => {
  // 首连推全量
  const state = decorateRunState(readJsonSafe(RUN_STATE_PATH));
  ws.send(JSON.stringify({ type: 'run-state', state: state || null }));
});

// ---- watch -------------------------------------------------------------
chokidar
  .watch([RUN_STATE_PATH, CONFIRM_DIR], { ignoreInitial: true, awaitWriteFinish: { stabilityThreshold: 200 } })
  .on('add', pushRunState)
  .on('change', pushRunState)
  .on('unlink', pushRunState);

// ---- 启动 --------------------------------------------------------------
server.listen(PORT, () => {
  console.log(`[bridge] http://localhost:${PORT}`);
  console.log(`[bridge] PROJECT_DIR = ${PROJECT_DIR}`);
  console.log(`[bridge] FRONTEND_DIST = ${FRONTEND_DIST || '(未设置，仅 API)'}`);
  console.log(`[bridge] AGENT_API_KEY = ${AGENT_API_KEY ? '已加载（不下发前端）' : '(未设置)'}`);
});
