import { execFile } from "node:child_process";
import { createServer } from "node:http";
import { access, readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { calculateChoppingSummary } from "./choppingParser.js";

const execFileAsync = promisify(execFile);

const host = process.env.SALAD_HELPER_HOST ?? "127.0.0.1";
const port = Number.parseInt(process.env.SALAD_HELPER_PORT ?? "48173", 10);
const installPath = path.resolve(
  process.env.SALAD_INSTALL_PATH ?? "C:\\ProgramData\\Salad",
);
const maxLogBytes = 64 * 1024;
const maxParserLogBytes = 8 * 1024 * 1024;
const maxLogFiles = 500;
const maxScanDepth = 5;
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

  if (url.pathname === "/salad/status") {
    sendJson(response, 200, await getSaladStatus());
    return;
  }

  if (url.pathname === "/salad/logs") {
    sendJson(response, 200, { installPath, logs: await listLogFiles() });
    return;
  }

  if (url.pathname === "/salad/chopping-history") {
    sendJson(response, 200, await getChoppingHistory());
    return;
  }

  const logWindowMatch = url.pathname.match(/^\/salad\/logs\/([^/]+)\/window$/);

  if (logWindowMatch) {
    sendJson(response, 200, await readLogWindow(logWindowMatch[1]));
    return;
  }

  sendJson(response, 404, { error: "Not found" });
}

async function getChoppingHistory() {
  const logs = await listLogFiles();
  const minerLogs = logs.filter((log) => isMinerLog(log.relativePath));
  const logWindows = [];

  for (const log of minerLogs) {
    const relativePath = decodeLogId(log.id);
    const targetPath = path.resolve(installPath, relativePath);

    if (!isPathInside(installPath, targetPath)) {
      continue;
    }

    const entryStats = await stat(targetPath);

    if (entryStats.size > maxParserLogBytes) {
      continue;
    }

    const content = await readFile(targetPath, "utf8");

    logWindows.push({
      relativePath,
      lines: content.split(/\r?\n/),
    });
  }

  return {
    installPath,
    parsedLogs: logWindows.length,
    skippedLogs: minerLogs.length - logWindows.length,
    ...calculateChoppingSummary(logWindows),
  };
}

async function getSaladStatus() {
  const installPathExists = await pathExists(installPath);
  const processes = await listProcesses();
  const detectedProcess = processes.find((processName) =>
    saladProcessNames.has(processName.toLowerCase()),
  );
  const detectedWorkload = processes.find((processName) =>
    workloadProcessHints.some((hint) => processName.toLowerCase().includes(hint)),
  );
  const logs = installPathExists ? await listLogFiles() : [];

  return {
    installPath,
    installPathExists,
    process: {
      label: detectedProcess ? "Active" : "Not detected",
      state: detectedProcess ? "active" : "inactive",
      detected: Boolean(detectedProcess),
      match: detectedProcess ?? null,
    },
    workload: {
      label: detectedWorkload ? "Possible workload" : "Unknown",
      state: detectedWorkload ? "active" : "unknown",
      detected: Boolean(detectedWorkload),
      match: detectedWorkload ?? null,
    },
    lastLogRead: logs[0]?.modifiedAt ?? null,
  };
}

async function listProcesses() {
  if (os.platform() !== "win32") {
    return [];
  }

  try {
    const { stdout } = await execFileAsync("tasklist", ["/FO", "CSV", "/NH"], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });

    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => line.match(/^"([^"]+)"/)?.[1])
      .filter(Boolean);
  } catch {
    return [];
  }
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

function isMinerLog(relativePath) {
  const normalizedPath = relativePath.toLowerCase();
  return (
    normalizedPath.includes(`${path.sep.toLowerCase()}t-rex${path.sep.toLowerCase()}`) ||
    normalizedPath.includes(`${path.sep.toLowerCase()}rigel${path.sep.toLowerCase()}`)
  );
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload, null, 2));
}
