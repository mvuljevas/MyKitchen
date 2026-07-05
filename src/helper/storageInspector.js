import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const logNames = new Set(["logs", "boot-logs"]);
const safeCacheNames = new Set(["_downloads", "cache", "tmp", "temp"]);

export async function inspectSaladStorage(installPath) {
  const rootStats = await statOrNull(installPath);

  if (!rootStats?.isDirectory()) {
    return emptyStorage(installPath, "Salad install path was not found.");
  }

  const entries = await safeReaddir(installPath);
  const categories = [];

  for (const entry of entries) {
    const entryPath = path.join(installPath, entry.name);
    const sizeBytes = entry.isDirectory()
      ? await getDirectorySize(entryPath)
      : entry.isFile()
        ? (await statOrNull(entryPath))?.size ?? 0
        : 0;

    categories.push({
      name: entry.name,
      path: entryPath,
      type: classifyEntry(entry.name, entryPath),
      sizeBytes,
      sizeGb: roundGb(sizeBytes),
      lastModifiedAt: ((await statOrNull(entryPath))?.mtime ?? null)?.toISOString() ?? null,
      protected: logNames.has(entry.name.toLowerCase()),
      purgeModes: getPurgeModes(entry.name, entryPath),
    });
  }

  const files = await listLargestFiles(installPath, 30);
  const candidates = await buildPurgeCandidates(installPath);
  const wslVhd = files.find((file) => file.path.toLowerCase().endsWith("wsl\\ext4.vhdx"));

  return {
    installPath,
    scannedAt: new Date().toISOString(),
    totalBytes: categories.reduce((total, category) => total + category.sizeBytes, 0),
    totalGb: roundGb(categories.reduce((total, category) => total + category.sizeBytes, 0)),
    allocated: {
      path: wslVhd?.path ?? path.join(installPath, "wsl", "ext4.vhdx"),
      sizeBytes: wslVhd?.sizeBytes ?? 0,
      sizeGb: roundGb(wslVhd?.sizeBytes ?? 0),
      explanation:
        "Salad container jobs use WSL storage. The ext4.vhdx file can grow as jobs use space and may not shrink automatically after data is removed inside WSL.",
    },
    categories: categories.sort((left, right) => right.sizeBytes - left.sizeBytes),
    largestFiles: files,
    purge: summarizeCandidates(candidates),
    notes: [
      "Logs are protected by default and are never deleted unless includeLogs=true and confirm=DELETE_LOGS are both provided.",
      "Safe mode only removes re-downloadable cache folders such as workloads/_downloads.",
      "Obsolete mode adds stale re-downloadable workload folders. WSL VHD deletion is only included by all mode with explicit confirmation.",
    ],
  };
}

export async function purgeSaladStorage(installPath, options = {}) {
  const mode = options.mode ?? "safe";
  const dryRun = options.dryRun !== false;
  const includeLogs = options.includeLogs === true;
  const confirm = options.confirm ?? "";
  const logConfirm = options.logConfirm ?? "";
  const candidates = await buildPurgeCandidates(installPath);
  const selected = candidates.filter((candidate) => {
    if (!candidate.modes.includes(mode)) {
      return false;
    }

    if (candidate.protected && !(includeLogs && logConfirm === "DELETE_LOGS")) {
      return false;
    }

    if (candidate.dangerous && confirm !== "DELETE_ALL_SALAD_CACHE") {
      return false;
    }

    return true;
  });
  const results = [];

  for (const candidate of selected) {
    if (dryRun) {
      results.push({
        ...candidate,
        deleted: false,
        dryRun: true,
      });
      continue;
    }

    try {
      await rm(candidate.path, {
        force: true,
        recursive: true,
      });
      results.push({
        ...candidate,
        deleted: true,
        dryRun: false,
      });
    } catch (error) {
      results.push({
        ...candidate,
        deleted: false,
        dryRun: false,
        error: error instanceof Error ? error.message : "Unable to delete candidate",
      });
    }
  }

  return {
    mode,
    dryRun,
    includeLogs,
    deletedBytes: results
      .filter((result) => result.deleted)
      .reduce((total, result) => total + result.sizeBytes, 0),
    selectedBytes: results.reduce((total, result) => total + result.sizeBytes, 0),
    selectedGb: roundGb(results.reduce((total, result) => total + result.sizeBytes, 0)),
    results,
    blocked: candidates.filter((candidate) => !selected.includes(candidate)),
  };
}

async function buildPurgeCandidates(installPath) {
  const candidates = [];
  const workloadsPath = path.join(installPath, "workloads");
  const downloadsPath = path.join(workloadsPath, "_downloads");
  const wslPath = path.join(installPath, "wsl");
  const logsPath = path.join(installPath, "logs");
  const bootLogsPath = path.join(installPath, "boot-logs");

  await addCandidate(candidates, downloadsPath, {
    label: "Downloaded workload archives",
    kind: "cache",
    modes: ["safe", "obsolete", "all"],
    protected: false,
    dangerous: false,
  });

  for (const entry of await safeReaddir(workloadsPath)) {
    if (!entry.isDirectory() || entry.name === "_downloads") {
      continue;
    }

    const entryPath = path.join(workloadsPath, entry.name);
    const entryStats = await statOrNull(entryPath);
    const ageDays = entryStats ? (Date.now() - entryStats.mtime.getTime()) / 86400000 : 0;

    if (ageDays >= 3) {
      await addCandidate(candidates, entryPath, {
        label: `Stale workload package: ${entry.name}`,
        kind: "workload",
        modes: ["obsolete", "all"],
        protected: false,
        dangerous: false,
      });
    }
  }

  await addCandidate(candidates, wslPath, {
    label: "WSL container storage",
    kind: "wsl",
    modes: ["all"],
    protected: false,
    dangerous: true,
  });
  await addCandidate(candidates, logsPath, {
    label: "Salad logs",
    kind: "logs",
    modes: ["all"],
    protected: true,
    dangerous: false,
  });
  await addCandidate(candidates, bootLogsPath, {
    label: "Salad boot logs",
    kind: "logs",
    modes: ["all"],
    protected: true,
    dangerous: false,
  });

  return candidates.sort((left, right) => right.sizeBytes - left.sizeBytes);
}

async function addCandidate(candidates, targetPath, metadata) {
  const targetStats = await statOrNull(targetPath);

  if (!targetStats) {
    return;
  }

  const sizeBytes = targetStats.isDirectory()
    ? await getDirectorySize(targetPath)
    : targetStats.size;

  candidates.push({
    path: targetPath,
    sizeBytes,
    sizeGb: roundGb(sizeBytes),
    lastModifiedAt: targetStats.mtime.toISOString(),
    ...metadata,
  });
}

function summarizeCandidates(candidates) {
  return {
    safeBytes: sumMode(candidates, "safe"),
    safeGb: roundGb(sumMode(candidates, "safe")),
    obsoleteBytes: sumMode(candidates, "obsolete"),
    obsoleteGb: roundGb(sumMode(candidates, "obsolete")),
    allBytes: sumMode(candidates, "all"),
    allGb: roundGb(sumMode(candidates, "all")),
    candidates,
  };
}

function sumMode(candidates, mode) {
  return candidates
    .filter((candidate) => candidate.modes.includes(mode) && !candidate.protected)
    .reduce((total, candidate) => total + candidate.sizeBytes, 0);
}

function classifyEntry(name, targetPath) {
  const normalizedName = name.toLowerCase();
  const normalizedPath = targetPath.toLowerCase();

  if (normalizedName === "wsl" || normalizedPath.endsWith("ext4.vhdx")) {
    return "wsl-storage";
  }

  if (logNames.has(normalizedName)) {
    return "logs";
  }

  if (normalizedName === "workloads") {
    return "workloads";
  }

  if (safeCacheNames.has(normalizedName)) {
    return "cache";
  }

  return "config";
}

function getPurgeModes(name, targetPath) {
  const normalizedName = name.toLowerCase();
  const normalizedPath = targetPath.toLowerCase();

  if (normalizedPath.includes("\\workloads\\_downloads")) {
    return ["safe", "obsolete", "all"];
  }

  if (normalizedName === "wsl") {
    return ["all"];
  }

  if (logNames.has(normalizedName)) {
    return ["all-with-log-confirmation"];
  }

  return [];
}

async function listLargestFiles(root, limit) {
  const files = [];
  await collectFiles(root, files);
  return files.sort((left, right) => right.sizeBytes - left.sizeBytes).slice(0, limit);
}

async function collectFiles(currentPath, files) {
  for (const entry of await safeReaddir(currentPath)) {
    const entryPath = path.join(currentPath, entry.name);

    if (entry.isDirectory()) {
      await collectFiles(entryPath, files);
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const entryStats = await statOrNull(entryPath);

    if (!entryStats) {
      continue;
    }

    files.push({
      name: entry.name,
      path: entryPath,
      sizeBytes: entryStats.size,
      sizeGb: roundGb(entryStats.size),
      lastModifiedAt: entryStats.mtime.toISOString(),
      protected: isLogPath(entryPath),
    });
  }
}

async function getDirectorySize(directoryPath) {
  let size = 0;

  for (const entry of await safeReaddir(directoryPath)) {
    const entryPath = path.join(directoryPath, entry.name);

    if (entry.isDirectory()) {
      size += await getDirectorySize(entryPath);
      continue;
    }

    if (entry.isFile()) {
      size += (await statOrNull(entryPath))?.size ?? 0;
    }
  }

  return size;
}

async function safeReaddir(targetPath) {
  try {
    return await readdir(targetPath, { withFileTypes: true });
  } catch {
    return [];
  }
}

async function statOrNull(targetPath) {
  try {
    return await stat(targetPath);
  } catch {
    return null;
  }
}

function isLogPath(targetPath) {
  const normalized = targetPath.toLowerCase();
  return normalized.includes("\\logs\\") || normalized.includes("\\boot-logs\\");
}

function emptyStorage(installPath, note) {
  return {
    installPath,
    scannedAt: new Date().toISOString(),
    totalBytes: 0,
    totalGb: 0,
    allocated: {
      path: path.join(installPath, "wsl", "ext4.vhdx"),
      sizeBytes: 0,
      sizeGb: 0,
      explanation: note,
    },
    categories: [],
    largestFiles: [],
    purge: {
      safeBytes: 0,
      safeGb: 0,
      obsoleteBytes: 0,
      obsoleteGb: 0,
      allBytes: 0,
      allGb: 0,
      candidates: [],
    },
    notes: [note],
  };
}

function roundGb(value) {
  return Math.round((value / 1024 / 1024 / 1024) * 1000) / 1000;
}
