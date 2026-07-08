const minerNames = ["t-rex", "trex", "rigel", "xmrig", "teamredminer", "lolminer"];
const containerHints = ["containerd", "runc", "docker", "wslhost", "job", "workload"];
const bandwidthHints = ["bandwidth", "traffic", "network", "packet"];

export function classifyWorkload({ logs = [], system = {}, lastSignalAt = null, lastSignalSource = null }) {
  const recentMinerLog = logs.find((log) => isMinerPath(log.relativePath));
  const windowsProcesses = system.windowsProcesses ?? [];
  const activeMinerProcess = windowsProcesses.find((process) =>
    minerNames.some((name) => process.name.toLowerCase().includes(name)),
  );
  const signalIsLive = isRecentSignal(lastSignalAt);
  const lastSignalIsMiner = lastSignalSource ? isMinerPath(lastSignalSource) : false;

  if (activeMinerProcess || (recentMinerLog && signalIsLive && lastSignalIsMiner)) {
    const minerFamily = recentMinerLog
      ? extractLogFamily(recentMinerLog.relativePath)
      : activeMinerProcess.name;

    return {
      type: "mining",
      label: `Mining / PoW (${minerFamily})`,
      source: activeMinerProcess ? "process" : "miner-log",
      confidence: activeMinerProcess || lastSignalAt ? "confirmed" : "inferred",
      since: activeMinerProcess?.startedAt ?? null,
      lastSignalAt,
      evidence: activeMinerProcess?.name ?? sanitizeEvidence(recentMinerLog.relativePath),
    };
  }

  if (recentMinerLog) {
    return {
      type: "historical-mining",
      label: `Last mining / PoW (${extractLogFamily(recentMinerLog.relativePath)})`,
      source: "miner-log",
      confidence: lastSignalAt ? "inferred" : "low-confidence",
      since: null,
      lastSignalAt,
      evidence: sanitizeEvidence(recentMinerLog.relativePath),
    };
  }

  const wslProcesses = system.wsl?.processes ?? [];
  const containerProcess = wslProcesses.find((process) =>
    containerHints.some((hint) => process.name.toLowerCase().includes(hint)),
  );

  if (system.wsl?.saladDistro?.running || containerProcess) {
    return {
      type: "container",
      label: "Container workload",
      source: "wsl",
      confidence: containerProcess ? "confirmed" : "inferred",
      since: null,
      lastSignalAt,
      evidence: containerProcess?.name ?? system.wsl?.saladDistro?.name ?? null,
    };
  }

  const bandwidthLog = logs.find((log) =>
    bandwidthHints.some((hint) => log.relativePath.toLowerCase().includes(hint)),
  );

  if (bandwidthLog) {
    return {
      type: "bandwidth",
      label: "Bandwidth workload",
      source: "log-path",
      confidence: "low-confidence",
      since: null,
      lastSignalAt,
      evidence: sanitizeEvidence(bandwidthLog.relativePath),
    };
  }

  return {
    type: "unknown",
    label: "Unknown workload",
    source: "process",
    confidence: "low-confidence",
    since: null,
    lastSignalAt,
    evidence: null,
  };
}

function isRecentSignal(value) {
  if (!value) {
    return false;
  }

  return Date.now() - new Date(value).getTime() <= 5 * 60 * 1000;
}

export function isMinerPath(relativePath = "") {
  const normalizedPath = relativePath.toLowerCase();
  return minerNames.some((name) => normalizedPath.includes(name));
}

function extractLogFamily(relativePath) {
  return relativePath.split(/[\\/]/).find((part) => isMinerPath(part)) ?? "miner";
}

function sanitizeEvidence(value) {
  return value.replace(/[A-Za-z0-9]{24,}/g, "[redacted]");
}
