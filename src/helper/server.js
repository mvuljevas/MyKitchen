import { createServer } from "node:http";
import { access, readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  calculateChoppingSummary,
  calculateLogActivitySummary,
} from "./choppingParser.js";
import { ensureElevatedProcess } from "./elevation.js";
import { getMaxOptimizationPlan, inspectRig } from "./rigProfile.js";
import { inspectSystem, requestElevatedHelper } from "./systemProbe.js";
import { classifyWorkload } from "./workloadClassifier.js";

const host = process.env.SALAD_HELPER_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.SALAD_HELPER_PORT ?? "48173", 10);
const installPath = path.resolve(
  process.env.SALAD_INSTALL_PATH ?? "C:\\ProgramData\\Salad",
);
const maxLogBytes = 64 * 1024;
const maxLogFiles = 5000;
const maxScanDepth = 5;
const historyCacheMs = 2000;
const allowedOrigins = new Set([
  "http://127.0.0.1:5173",
  "http://localhost:5173",
]);

const saladProcessNames = new Set([
  "salad.exe",
  "salad.bowl.service.exe",
  "salad.service.exe",
  "salad-bowl-service.exe",
]);

const workloadProcessHints = [
  "workload",
  "containerd",
  "salad.bowl.service",
  "salad-bowl-service",
];
const sseClients = new Set();
let lastEventSignature = "";
let shutdownHandler = null;
const historyCache = new Map();

if (
  await ensureElevatedProcess({
    argv: [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    label: "SaladChoppingHours elevated helper",
    forceRelaunch: process.env.SALAD_FOREGROUND !== "1",
    relaunchEnv: {
      SALAD_HELPER_HOST: host,
      SALAD_HELPER_PORT: String(port),
      SALAD_INSTALL_PATH: installPath,
    },
  })
) {
  process.stdout.write("Requested elevated SaladChoppingHours helper through Windows UAC.\n");
  process.exit(0);
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
  }

  response.setHeader("Vary", "Origin");
  response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method !== "GET") {
    sendJson(response, 405, { error: "Method not allowed" });
    return;
  }

  try {
    await routeRequest(request, response);
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "Unexpected helper error",
    });
  }
});

server.on("error", (error) => {
  if (error?.code === "EADDRINUSE") {
    process.stdout.write(
      `SaladChoppingHours helper port ${host}:${port} is already in use; reusing the existing listener if it is healthy.\n`,
    );
    process.exit(0);
    return;
  }

  throw error;
});

server.listen(port, host, () => {
  process.stdout.write(
    `SaladChoppingHours helper listening on http://${host}:${port}\n`,
  );
});

async function routeRequest(request, response) {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);

  if (url.pathname === "/health") {
    sendJson(response, 200, {
      ok: true,
      service: "salad-chopping-hours-helper",
      installPath,
    });
    return;
  }

  if (url.pathname === "/") {
    sendJson(response, 200, {
      ok: true,
      service: "salad-chopping-hours-helper",
      installPath,
      endpoints: [
        "/health",
        "/salad/status",
        "/salad/logs",
        "/salad/chopping-history?days=7",
        "/salad/workload/current",
        "/salad/rig/config",
        "/salad/rig/optimize",
        "/salad/events",
        "/salad/report",
        "/salad/elevate",
        "/suite/status",
        "/suite/shutdown",
      ],
    });
    return;
  }

  if (url.pathname === "/suite/status") {
    sendJson(response, 200, {
      managed: Boolean(shutdownHandler),
      pid: process.pid,
      elevatedRelaunch: process.env.SALAD_ELEVATED_RELAUNCH === "1",
    });
    return;
  }

  if (url.pathname === "/suite/shutdown") {
    sendJson(response, 200, {
      stopping: Boolean(shutdownHandler),
      message: shutdownHandler
        ? "Stopping managed SaladChoppingHours suite."
        : "No managed suite shutdown handler is registered.",
    });

    if (shutdownHandler) {
      setTimeout(() => {
        shutdownHandler();
      }, 100);
    }
    return;
  }

  if (url.pathname === "/salad/status") {
    sendJson(response, 200, await getSaladStatus());
    return;
  }

  if (url.pathname === "/salad/workload/current") {
    sendJson(response, 200, await getCurrentWorkload());
    return;
  }

  if (url.pathname === "/salad/rig/config") {
    sendJson(response, 200, await inspectRig());
    return;
  }

  if (url.pathname === "/salad/rig/optimize") {
    sendJson(response, 200, await getMaxOptimizationPlan());
    return;
  }

  if (url.pathname === "/salad/logs") {
    sendJson(response, 200, { installPath, logs: await listLogFiles() });
    return;
  }

  if (url.pathname === "/salad/chopping-history") {
    const days = Number.parseInt(url.searchParams.get("days") ?? "7", 10);
    sendJson(response, 200, await getChoppingHistory({ days }));
    return;
  }

  if (url.pathname === "/salad/report") {
    sendJson(response, 200, await getMachineReport());
    return;
  }

  if (url.pathname === "/salad/elevate") {
    sendJson(response, 200, await requestElevatedHelper());
    return;
  }

  if (url.pathname === "/salad/events") {
    await handleEvents(response);
    return;
  }

  const logWindowMatch = url.pathname.match(/^\/salad\/logs\/([^/]+)\/window$/);

  if (logWindowMatch) {
    sendJson(response, 200, await readLogWindow(logWindowMatch[1]));
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

async function getMachineReport() {
  const [status, history, workload, logs, system] = await Promise.all([
    getSaladStatus(),
    getChoppingHistory({ days: 7 }),
    getCurrentWorkload(),
    listLogFiles(),
    inspectSystem(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    machine: system.machine,
    status,
    workload,
    choppingHistory: history,
    logs: {
      count: logs.length,
      newest: logs[0]?.modifiedAt ?? null,
      oldest: logs.at(-1)?.modifiedAt ?? null,
    },
  };
}

async function getCurrentWorkload() {
  const [logs, history, system] = await Promise.all([
    listLogFiles(),
    getChoppingHistory({ days: 7, includeSystem: false }),
    inspectSystem(),
  ]);

  return classifyWorkload({
    logs,
    system,
    lastSignalAt: history.lastSignalAt,
  });
}

async function getChoppingHistory({ days = 7 } = {}) {
  const cacheKey = String(days);
  const cached = historyCache.get(cacheKey);

  if (cached && Date.now() - cached.startedAt <= historyCacheMs) {
    return cached.promise;
  }

  const promise = calculateChoppingHistoryFromLogs({ days }).finally(() => {
    const latest = historyCache.get(cacheKey);

    if (latest?.promise === promise && Date.now() - latest.startedAt > historyCacheMs) {
      historyCache.delete(cacheKey);
    }
  });

  historyCache.set(cacheKey, {
    startedAt: Date.now(),
    promise,
  });

  return promise;
}

async function calculateChoppingHistoryFromLogs({ days }) {
  const logs = await listLogFiles();
  const logWindows = [];
  const readErrors = [];

  for (const log of logs) {
    const relativePath = decodeLogId(log.id);
    const targetPath = path.resolve(installPath, relativePath);

    if (!isPathInside(installPath, targetPath)) {
      readErrors.push({
        relativePath,
        error: "Log path is not allowed",
      });
      continue;
    }

    try {
      const content = await readFile(targetPath, "utf8");

      logWindows.push({
        relativePath,
        lines: content.split(/\r?\n/),
      });
    } catch (error) {
      readErrors.push({
        relativePath,
        error: error instanceof Error ? error.message : "Unable to read log",
      });
    }
  }

  const summary = calculateChoppingSummary(logWindows, new Date(), days);
  const logActivity = calculateLogActivitySummary(logs, new Date(), days);

  return {
    machineId: (await inspectSystem()).machine.id,
    installPath,
    days,
    parsedLogs: logWindows.length,
    skippedLogs: readErrors.length,
    readErrors,
    coverage: buildCoverage(logs, logWindows, summary, readErrors),
    logActivity,
    ...summary,
  };
}

async function getSaladStatus() {
  const installPathExists = await pathExists(installPath);
  const system = await inspectSystem();
  const processes = system.windowsProcesses.map((process) => process.name);
  const detectedProcess = processes.find((processName) =>
    saladProcessNames.has(processName.toLowerCase()),
  );
  const detectedService = processes.find(
    (processName) => processName.toLowerCase() === "salad.bowl.service.exe",
  );
  const detectedWorkload = processes.find((processName) =>
    workloadProcessHints.some((hint) => processName.toLowerCase().includes(hint)),
  );
  const logs = installPathExists ? await listLogFiles() : [];
  const history = installPathExists
    ? await getChoppingHistory({ days: 7, includeSystem: false })
    : null;
  const workload = classifyWorkload({
    logs,
    system,
    lastSignalAt: history?.lastSignalAt ?? null,
  });

  return {
    installPath,
    installPathExists,
    machine: system.machine,
    elevation: system.elevation,
    wsl: system.wsl,
    process: {
      label: detectedProcess ? "Active" : "Not detected",
      state: detectedProcess ? "active" : "inactive",
      detected: Boolean(detectedProcess),
      match: detectedProcess ?? null,
    },
    service: {
      label: detectedService ? "Bowl service active" : "Bowl service not detected",
      state: detectedService ? "active" : "inactive",
      detected: Boolean(detectedService),
      match: detectedService ?? null,
    },
    workload: {
      ...workload,
      label: detectedWorkload ? workload.label : workload.label,
      state: detectedWorkload ? "active" : "unknown",
      detected: Boolean(detectedWorkload),
      match: detectedWorkload ?? null,
    },
    lastLogRead: logs[0]?.modifiedAt ?? null,
  };
}

async function listLogFiles() {
  if (!(await pathExists(installPath))) {
    return [];
  }

  const files = [];
  await collectLogFiles(installPath, installPath, files, 0);

  return files
    .sort((left, right) => new Date(right.modifiedAt) - new Date(left.modifiedAt))
    .slice(0, maxLogFiles);
}

async function collectLogFiles(root, currentPath, files, depth) {
  if (depth > maxScanDepth) {
    return;
  }

  let entries = [];

  try {
    entries = await readdir(currentPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const entryPath = path.join(currentPath, entry.name);

    if (!isPathInside(root, entryPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      await collectLogFiles(root, entryPath, files, depth + 1);
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".log")) {
      continue;
    }

    const entryStats = await stat(entryPath);
    const relativePath = path.relative(root, entryPath);

    files.push({
      id: encodeLogId(relativePath),
      name: entry.name,
      relativePath,
      size: entryStats.size,
      modifiedAt: entryStats.mtime.toISOString(),
    });
  }
}

async function readLogWindow(id) {
  const relativePath = decodeLogId(id);
  const targetPath = path.resolve(installPath, relativePath);

  if (!isPathInside(installPath, targetPath) || !relativePath.endsWith(".log")) {
    return {
      id,
      lines: [],
      truncated: false,
      error: "Log path is not allowed",
    };
  }

  const availableLogs = await listLogFiles();

  if (!availableLogs.some((log) => log.id === id)) {
    return {
      id,
      lines: [],
      truncated: false,
      error: "Log file was not found in the allowlisted log scan",
    };
  }

  const entryStats = await stat(targetPath);
  const content = await readFile(targetPath);
  const windowBuffer = content.subarray(Math.max(0, content.length - maxLogBytes));
  const lines = windowBuffer.toString("utf8").split(/\r?\n/).slice(-200);

  return {
    id,
    relativePath,
    size: entryStats.size,
    modifiedAt: entryStats.mtime.toISOString(),
    truncated: content.length > maxLogBytes,
    lines,
  };
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function isPathInside(root, targetPath) {
  const relativePath = path.relative(path.resolve(root), path.resolve(targetPath));
  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));
}

function encodeLogId(relativePath) {
  return Buffer.from(relativePath, "utf8").toString("base64url");
}

function decodeLogId(id) {
  return Buffer.from(id, "base64url").toString("utf8");
}

function buildCoverage(logs, logWindows, summary, readErrors) {
  return {
    logCount: logs.length,
    parsedLogCount: logWindows.length,
    scannedLogCount: logWindows.length,
    signalLogCount: summary.sourceLogCount,
    unreadableLogCount: readErrors.length,
    readErrorSamples: readErrors.slice(0, 5),
    newestLogAt: logs[0]?.modifiedAt ?? null,
    oldestLogAt: logs.at(-1)?.modifiedAt ?? null,
    retentionNote:
      "All discovered .log files are scanned when readable. Chopping hours are calculated only from logs that contain recognized activity signals.",
  };
}

async function handleEvents(response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
  });

  sseClients.add(response);
  response.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);

  response.on("close", () => {
    sseClients.delete(response);
  });
}

async function publishObservationEvent() {
  if (sseClients.size === 0) {
    return;
  }

  const [status, workload, history] = await Promise.all([
    getSaladStatus(),
    getCurrentWorkload(),
    getChoppingHistory({ days: 7 }),
  ]);
  const payload = {
    observedAt: new Date().toISOString(),
    process: status.process,
    service: status.service,
    wsl: status.wsl?.saladDistro,
    workload,
    parser: {
      totalHours: history.totalHours,
      signalCount: history.signalCount,
      intervalCount: history.intervalCount,
      lastSignalAt: history.lastSignalAt,
    },
    logActivity: history.logActivity,
  };
  const signature = JSON.stringify(payload);

  if (signature === lastEventSignature) {
    return;
  }

  lastEventSignature = signature;

  for (const client of sseClients) {
    client.write(`event: observation\ndata: ${JSON.stringify(payload)}\n\n`);
  }
}

setInterval(() => {
  publishObservationEvent().catch(() => {});
}, 3000);

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}

export function setSuiteShutdownHandler(handler) {
  shutdownHandler = handler;
}
