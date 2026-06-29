export const starChefTargetHours = 50;

export const emptyStatus = {
  installPath: "Helper offline",
  installPathExists: null,
  machine: {
    id: "unavailable",
    hostname: "This PC",
    platform: "unknown",
  },
  elevation: {
    isAdmin: false,
    level: "unknown",
    needsElevation: false,
  },
  wsl: {
    saladDistro: {
      name: "salad-enterprise-linux",
      state: "Unknown",
      running: false,
    },
  },
  process: {
    label: "Unknown",
    state: "unknown",
    detected: false,
  },
  service: {
    label: "Unknown",
    state: "unknown",
    detected: false,
  },
  workload: {
    type: "unknown",
    label: "Unknown",
    state: "unknown",
    detected: false,
    confidence: "low-confidence",
    source: "none",
  },
  lastLogRead: null,
};

export const emptyChoppingSummary = {
  source: "none",
  confidence: "low-confidence",
  signalCount: 0,
  sourceLogCount: 0,
  intervalCount: 0,
  totalHours: 0,
  last24Hours: 0,
  rolling7DaysHours: 0,
  lastSignalAt: null,
  coverage: {
    logCount: 0,
    parsedLogCount: 0,
    scannedLogCount: 0,
    signalLogCount: 0,
    unreadableLogCount: 0,
    readErrorSamples: [],
    newestLogAt: null,
    oldestLogAt: null,
    retentionNote: "Start the local helper to read Salad logs.",
  },
  starChefEstimate: {
    targetHours: starChefTargetHours,
    progress: 0,
    remainingHours: starChefTargetHours,
    window: "rolling-7-days-estimate",
    note: "Salad does not publish the exact Star Chef qualification window.",
  },
  intervals: [],
  history: [],
};

export const emptyLogActivitySummary = {
  source: "none",
  confidence: "low-confidence",
  eventCount: 0,
  sourceLogCount: 0,
  intervalCount: 0,
  totalHours: 0,
  last24Hours: 0,
  rolling7DaysHours: 0,
  lastSignalAt: null,
  intervals: [],
  history: [],
  note:
    "Start the local helper to infer local rig/app activity from Salad log metadata.",
};

export const emptyDashboard = {
  source: "offline",
  helperOnline: false,
  status: emptyStatus,
  choppingHistory: [],
  choppingSummary: emptyChoppingSummary,
  logActivity: emptyLogActivitySummary,
  workload: emptyStatus.workload,
  report: null,
  recentEvents: [],
  logs: [],
};
