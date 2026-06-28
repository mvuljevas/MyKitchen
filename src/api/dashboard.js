import { sampleDashboard } from "../data/sampleDashboard.js";

const helperBaseUrl = import.meta.env.VITE_HELPER_URL ?? "http://127.0.0.1:48173";

export async function loadDashboardData() {
  try {
    const [health, status, logs, history] = await Promise.all([
      fetchJson("/health"),
      fetchJson("/salad/status"),
      fetchJson("/salad/logs"),
      fetchJson("/salad/chopping-history"),
    ]);

    return {
      ...sampleDashboard,
      source: "helper",
      helperOnline: health.ok === true,
      status: normalizeStatus(status),
      choppingHistory: history.history?.length
        ? history.history
        : sampleDashboard.choppingHistory,
      choppingSummary: history,
      recentEvents: buildRecentEvents(status, logs.logs ?? [], history),
      logs: logs.logs ?? [],
    };
  } catch (error) {
    return {
      ...sampleDashboard,
      error: error instanceof Error ? error.message : "Helper unavailable",
    };
  }
}

async function fetchJson(path) {
  const response = await fetch(`${helperBaseUrl}${path}`, {
    headers: {
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Helper request failed: ${response.status}`);
  }

  return response.json();
}

function normalizeStatus(status) {
  return {
    installPath: status.installPath ?? sampleDashboard.status.installPath,
    installPathExists: status.installPathExists ?? false,
    process: status.process ?? {
      label: "Unknown",
      state: "unknown",
      detected: false,
    },
    workload: status.workload ?? {
      label: "Unknown",
      state: "unknown",
      detected: false,
    },
    lastLogRead: status.lastLogRead ?? "No logs read",
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
