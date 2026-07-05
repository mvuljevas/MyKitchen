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

export const emptyRig = {
  inspectedAt: null,
  machine: emptyStatus.machine,
  windows: {
    name: "unknown",
    version: null,
    architecture: "unknown",
    manufacturer: "unknown",
    model: "unknown",
  },
  cpu: {
    name: "unknown",
    cores: null,
    logicalProcessors: null,
    maxClockMhz: null,
  },
  memory: {
    totalBytes: 0,
    totalGb: 0,
    installedBytes: 0,
    installedGb: 0,
  },
  virtualization: {
    hypervisorPresent: false,
    wslAvailable: false,
    saladDistro: emptyStatus.wsl.saladDistro,
    wslProcesses: 0,
  },
  gpus: [],
  power: {
    guid: null,
    name: "unknown",
    source: "unknown",
  },
  salad: {
    appDetected: false,
    serviceDetected: false,
    processCount: 0,
    workloadProcessCount: 0,
    processes: [],
    workloadProcesses: [],
  },
  elevation: emptyStatus.elevation,
  optimization: {
    score: 0,
    summary: "Start the helper to inspect this rig.",
    actions: [],
  },
};

export const emptyStorage = {
  installPath: "Helper offline",
  scannedAt: null,
  totalBytes: 0,
  totalGb: 0,
  allocated: {
    path: "Unknown",
    sizeBytes: 0,
    sizeGb: 0,
    explanation: "Start the helper to inspect Salad storage.",
  },
  categories: [],
  largestFiles: [],
  workloadStorage: {
    path: "Unknown",
    downloadsBytes: 0,
    downloadsGb: 0,
    currentBytes: 0,
    currentGb: 0,
    obsoleteBytes: 0,
    obsoleteGb: 0,
    packageCount: 0,
    obsoletePackageCount: 0,
    rule: "Start the helper to inspect Salad workload storage.",
  },
  purge: {
    safeBytes: 0,
    safeGb: 0,
    obsoleteBytes: 0,
    obsoleteGb: 0,
    allBytes: 0,
    allGb: 0,
    candidates: [],
  },
  notes: [],
};

export const emptyDashboard = {
  source: "offline",
  helperOnline: false,
  status: emptyStatus,
  choppingHistory: [],
  choppingSummary: emptyChoppingSummary,
  logActivity: emptyLogActivitySummary,
  rig: emptyRig,
  storage: emptyStorage,
  optimizationPlan: null,
  suite: {
    managed: false,
    pid: null,
    elevatedRelaunch: false,
  },
  workload: emptyStatus.workload,
  report: null,
  recentEvents: [],
  logs: [],
};
