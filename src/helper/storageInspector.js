import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

const logNames = new Set(["logs", "boot-logs"]);
const protectedNames = new Set([...logNames, "config", "settings"]);
const jobCacheNames = new Set(["_downloads", "cache", "tmp", "temp"]);

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
      protected: protectedNames.has(entry.name.toLowerCase()),
      purgeModes: getPurgeModes(entry.name, entryPath),
    });
  }

  const files = await listLargestFiles(installPath, 30);
  const workloadStorage = await inspectWorkloadStorage(installPath);
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
    workloadStorage,
    purge: summarizeCandidates(candidates),
    notes: [
      "Cleanup only targets explicit job cache folders under workloads.",
      "Logs, boot logs, WSL storage, configuration, and rig-specific files are never purge candidates.",
      "Package folders are not deleted just because they are old; only named cache/download/temp folders are eligible.",
    ],
  };
}

async function inspectWorkloadStorage(installPath) {
  const workloadsPath = path.join(installPath, "workloads");
  const downloadsPath = path.join(workloadsPath, "_downloads");
  const downloadsBytes = await getPathSize(downloadsPath);
  let currentBytes = 0;
  let obsoleteBytes = 0;
  let packageCount = 0;
  let obsoletePackageCount = 0;

  for (const entry of await safeReaddir(workloadsPath)) {
    if (!entry.isDirectory() || entry.name === "_downloads") {
      continue;
    }

    const entryPath = path.join(workloadsPath, entry.name);
    const entryStats = await statOrNull(entryPath);
    const sizeBytes = await getPathSize(entryPath);
    const ageDays = entryStats ? (Date.now() - entryStats.mtime.getTime()) / 86400000 : 0;
    packageCount += 1;

    if (ageDays >= 3) {
      obsoleteBytes += sizeBytes;
      obsoletePackageCount += 1;
    } else {
      currentBytes += sizeBytes;
    }
  }

  return {
    path: workloadsPath,
    downloadsBytes,
    downloadsGb: roundGb(downloadsBytes),
    currentBytes,
    currentGb: roundGb(currentBytes),
    obsoleteBytes,
    obsoleteGb: roundGb(obsoleteBytes),
    packageCount,
    obsoletePackageCount,
    rule: "Workload package folders older than 3 days are treated as obsolete re-downloadable candidates.",
  };
}

export async function purgeSaladStorage(installPath, options = {}) {
  const mode = normalizePurgeMode(options.mode ?? "safe");
  const dryRun = options.dryRun !== false;
  const candidates = await buildPurgeCandidates(installPath);
  const selected = candidates.filter((candidate) => {
    if (!candidate.modes.includes(mode)) {
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

  await addCandidate(candidates, downloadsPath, {
    label: "Downloaded workload archives",
    kind: "job-cache",
    modes: ["safe", "job-cache"],
    protected: false,
  });

  await collectNestedJobCacheCandidates(workloadsPath, candidates, workloadsPath);

  return candidates.sort((left, right) => right.sizeBytes - left.sizeBytes);
}

async function collectNestedJobCacheCandidates(currentPath, candidates, workloadsPath) {
  for (const entry of await safeReaddir(currentPath)) {
    if (!entry.isDirectory()) {
      continue;
    }

    const entryPath = path.join(currentPath, entry.name);
    const normalizedName = entry.name.toLowerCase();

    if (normalizedName === "_downloads") {
      continue;
    }

    if (jobCacheNames.has(normalizedName)) {
      await addCandidate(candidates, entryPath, {
        label: `Job cache: ${path.relative(workloadsPath, entryPath)}`,
        kind: "job-cache",
        modes: ["job-cache"],
        protected: false,
      });
      continue;
    }

    await collectNestedJobCacheCandidates(entryPath, candidates, workloadsPath);
  }
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

async function getPathSize(targetPath) {
  const targetStats = await statOrNull(targetPath);

  if (!targetStats) {
    return 0;
  }

  return targetStats.isDirectory() ? getDirectorySize(targetPath) : targetStats.size;
}

function summarizeCandidates(candidates) {
  const jobCacheBytes = sumMode(candidates, "job-cache");

  return {
    safeBytes: sumMode(candidates, "safe"),
    safeGb: roundGb(sumMode(candidates, "safe")),
    jobCacheBytes,
    jobCacheGb: roundGb(jobCacheBytes),
    obsoleteBytes: jobCacheBytes,
    obsoleteGb: roundGb(jobCacheBytes),
    allBytes: jobCacheBytes,
    allGb: roundGb(jobCacheBytes),
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

  if (protectedNames.has(normalizedName)) {
    return "protected-config";
  }

  if (normalizedName === "workloads") {
    return "workloads";
  }

  if (jobCacheNames.has(normalizedName)) {
    return "cache";
  }

  return "config";
}

function getPurgeModes(name, targetPath) {
  const normalizedName = name.toLowerCase();
  const normalizedPath = targetPath.toLowerCase();

  if (normalizedPath.includes("\\workloads\\_downloads")) {
    return ["safe", "job-cache"];
  }

  if (normalizedPath.includes("\\workloads\\") && jobCacheNames.has(normalizedName)) {
    return ["job-cache"];
  }

  return [];
}

function normalizePurgeMode(mode) {
  if (mode === "obsolete" || mode === "all") {
    return "job-cache";
  }

  return mode;
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
    workloadStorage: {
      path: path.join(installPath, "workloads"),
      downloadsBytes: 0,
      downloadsGb: 0,
      currentBytes: 0,
      currentGb: 0,
      jobCacheBytes: 0,
      jobCacheGb: 0,
      obsoleteBytes: 0,
      obsoleteGb: 0,
      packageCount: 0,
      obsoletePackageCount: 0,
      rule: "Start the helper to inspect Salad workload storage.",
    },
    purge: {
      safeBytes: 0,
      safeGb: 0,
      jobCacheBytes: 0,
      jobCacheGb: 0,
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
