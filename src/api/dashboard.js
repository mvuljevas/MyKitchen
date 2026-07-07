import {
  emptyChoppingSummary,
  emptyDashboard,
  emptyLogActivitySummary,
  emptyRig,
  emptyStorage,
  emptyStatus,
} from "../data/emptyDashboard.js";

const helperBaseUrl = import.meta.env.VITE_HELPER_URL ?? "http://127.0.0.1:48173";

export async function loadDashboardData() {
  try {
    // Always fetch the full 365-day history. The client slices the array for
    // Week / Month / Year views, and uses hourlyHistory for the Day view.
    // This means switching chart ranges requires no additional network requests.
    const historyPath = `/salad/chopping-history`;
    const [health, status, logs, history, workload, report, rig, storage, suite] =
      await Promise.all([
        fetchJson("/health", { timeoutMs: 4000 }),
        fetchOptionalJson("/salad/status", { timeoutMs: 4000 }),
        fetchOptionalJson("/salad/logs", { timeoutMs: 5000 }),
        fetchJson(historyPath, { timeoutMs: 10000 }),
        fetchOptionalJson("/salad/workload/current", { timeoutMs: 5000 }),
        fetchOptionalJson("/salad/report", { timeoutMs: 5000 }),
        fetchOptionalJson("/salad/rig/config", { timeoutMs: 6000 }),
        fetchOptionalJson("/salad/storage", { timeoutMs: 6000 }),
        fetchOptionalJson("/suite/status", { timeoutMs: 3000 }),
      ]);

    const choppingSummary = normalizeChoppingSummary(history);

    return {
      ...emptyDashboard,
      source: "helper",
      helperOnline: health.ok === true,
      status: normalizeStatus(status),
      workload: workload ?? emptyDashboard.workload,
      choppingHistory: history.history ?? [],
      hourlyHistory: history.hourlyHistory ?? [],
      choppingSummary,
      logActivity: normalizeLogActivity(history.logActivity),
      rig: normalizeRig(rig),
      storage: normalizeStorage(storage),
      suite: suite ?? emptyDashboard.suite,
      report,
      recentEvents: buildRecentEvents(normalizeStatus(status), logs?.logs ?? [], choppingSummary),
      logs: logs?.logs ?? [],
    };
  } catch (error) {
    return {
      ...emptyDashboard,
      error: error instanceof Error ? error.message : "Helper unavailable",
    };
  }
}

export function subscribeToEvents(onEvent) {
  const eventSource = new EventSource(`${helperBaseUrl}/salad/events`);
  eventSource.addEventListener("observation", (event) => {
    onEvent(JSON.parse(event.data));
  });

  eventSource.onerror = () => {
    onEvent({
      observedAt: new Date().toISOString(),
      source: "helper",
      message: "Live stream disconnected",
    });
  };

  return () => eventSource.close();
}

export async function requestElevatedHelper() {
  return fetchJson("/salad/elevate");
}

export async function requestSuiteShutdown() {
  return fetchJson("/suite/shutdown");
}

export async function requestStoragePurge({
  mode,
  dryRun = true,
}) {
  const params = new URLSearchParams({
    mode,
    dryRun: String(dryRun),
  });

  return fetchJson(`/salad/storage/purge?${params.toString()}`);
}

async function fetchJson(path, { timeoutMs = 8000 } = {}) {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${helperBaseUrl}${path}`, {
      headers: {
        Accept: "application/json",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Helper request failed: ${response.status}`);
    }

    return await response.json();
  } finally {
    window.clearTimeout(timeout);
  }
}

async function fetchOptionalJson(path, options) {
  try {
    return await fetchJson(path, options);
  } catch {
    return null;
  }
}

function normalizeLogActivity(logActivity) {
  return {
    ...emptyLogActivitySummary,
    ...(logActivity ?? {}),
    intervals: logActivity?.intervals ?? emptyLogActivitySummary.intervals,
    history: logActivity?.history ?? emptyLogActivitySummary.history,
  };
}

function normalizeChoppingSummary(history) {
  return {
    ...emptyChoppingSummary,
    ...history,
    coverage: {
      ...emptyChoppingSummary.coverage,
      ...(history.coverage ?? {}),
    },
    starChefEstimate: {
      ...emptyChoppingSummary.starChefEstimate,
      ...(history.starChefEstimate ?? {}),
    },
    intervals: history.intervals ?? emptyChoppingSummary.intervals,
    history: history.history ?? emptyChoppingSummary.history,
  };
}

function normalizeRig(rig) {
  return {
    ...emptyRig,
    ...(rig ?? {}),
    windows: {
      ...emptyRig.windows,
      ...(rig?.windows ?? {}),
    },
    cpu: {
      ...emptyRig.cpu,
      ...(rig?.cpu ?? {}),
    },
    memory: {
      ...emptyRig.memory,
      ...(rig?.memory ?? {}),
    },
    virtualization: {
      ...emptyRig.virtualization,
      ...(rig?.virtualization ?? {}),
    },
    power: {
      ...emptyRig.power,
      ...(rig?.power ?? {}),
    },
    salad: {
      ...emptyRig.salad,
      ...(rig?.salad ?? {}),
    },
    elevation: {
      ...emptyRig.elevation,
      ...(rig?.elevation ?? {}),
    },
    optimization: {
      ...emptyRig.optimization,
      ...(rig?.optimization ?? {}),
      actions: rig?.optimization?.actions ?? emptyRig.optimization.actions,
    },
    gpus: rig?.gpus ?? emptyRig.gpus,
  };
}

function normalizeStorage(storage) {
  return {
    ...emptyStorage,
    ...(storage ?? {}),
    allocated: {
      ...emptyStorage.allocated,
      ...(storage?.allocated ?? {}),
    },
    purge: {
      ...emptyStorage.purge,
      ...(storage?.purge ?? {}),
      candidates: storage?.purge?.candidates ?? emptyStorage.purge.candidates,
    },
    categories: storage?.categories ?? emptyStorage.categories,
    largestFiles: storage?.largestFiles ?? emptyStorage.largestFiles,
    workloadStorage: {
      ...emptyStorage.workloadStorage,
      ...(storage?.workloadStorage ?? {}),
    },
    notes: storage?.notes ?? emptyStorage.notes,
  };
}

function normalizeStatus(status) {
  return {
    installPath: status?.installPath ?? emptyStatus.installPath,
    installPathExists: status?.installPathExists ?? false,
    process: status?.process ?? {
      label: "Unknown",
      state: "unknown",
      detected: false,
    },
    workload: status?.workload ?? {
      label: "Unknown",
      state: "unknown",
      detected: false,
    },
    service: status?.service ?? {
      label: "Unknown",
      state: "unknown",
      detected: false,
    },
    machine: status?.machine ?? emptyStatus.machine,
    elevation: status?.elevation ?? emptyStatus.elevation,
    wsl: status?.wsl ?? emptyStatus.wsl,
    lastLogRead: status?.lastLogRead ?? "No logs read",
  };
}

function buildRecentEvents(status, logs, history) {
  const events = [
    {
      time: "Now",
      source: "process",
      message: status.process?.detected
        ? "Salad process detected locally."
        : "No known Salad process detected locally.",
    },
    {
      time: "Now",
      source: "workload",
      message: status.workload?.detected
        ? "Known workload process detected locally."
        : "Workload status is not confirmed yet.",
    },
  ];

  if (logs.length > 0) {
    events.push({
      time: formatEventTime(logs[0].modifiedAt),
      source: "logs",
      message: `${logs.length} Salad log file${logs.length === 1 ? "" : "s"} found for bounded reads.`,
    });
  } else {
    events.push({
      time: "Now",
      source: "logs",
      message: "No Salad log files found in the configured installation folder.",
    });
  }

  if (history?.source === "logs") {
    events.push({
      time: formatEventTime(history.lastSignalAt),
      source: "chopping",
      message: `${history.totalHours.toFixed(1)} Chopping hours calculated from ${history.signalCount} mining signals.`,
    });
  }

  return events;
}

function formatEventTime(value) {
  if (!value) {
    return "Unknown";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
