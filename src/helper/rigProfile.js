import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";
import { inspectSystem } from "./systemProbe.js";

const execFileAsync = promisify(execFile);

export async function inspectRig() {
  const [system, computer, gpus, powerPlan, nvidia] = await Promise.all([
    inspectSystem(),
    readComputerInfo(),
    readGpuControllers(),
    readPowerPlan(),
    readNvidiaSmi(),
  ]);

  const profile = {
    inspectedAt: new Date().toISOString(),
    machine: system.machine,
    windows: computer.windows,
    cpu: computer.cpu,
    memory: computer.memory,
    virtualization: {
      hypervisorPresent: computer.hypervisorPresent,
      wslAvailable: system.wsl.available,
      saladDistro: system.wsl.saladDistro,
      wslProcesses: system.wsl.processes.length,
    },
    gpus: mergeGpuDetails(gpus, nvidia),
    power: powerPlan,
    salad: summarizeSalad(system),
    elevation: system.elevation,
  };

  return {
    ...profile,
    optimization: buildOptimizationPlan(profile),
  };
}

export async function getMaxOptimizationPlan() {
  const rig = await inspectRig();

  return {
    generatedAt: new Date().toISOString(),
    mode: "advisory",
    safety:
      "This plan does not apply system changes automatically. Review each action before changing Windows, NVIDIA, WSL, or Salad settings.",
    rig,
    actions: rig.optimization.actions,
  };
}

export async function applyOptimizationAction(actionId) {
  if (actionId !== "windows-power-plan") {
    return {
      applied: false,
      actionId,
      message: "This optimization action is advisory only for now.",
    };
  }

  if (os.platform() !== "win32") {
    return {
      applied: false,
      actionId,
      message: "Windows power plan optimization is only available on Windows.",
    };
  }

  await execFileAsync("powercfg.exe", ["/setactive", "SCHEME_MIN"], {
    windowsHide: true,
  });

  return {
    applied: true,
    actionId,
    message: "Windows High Performance power plan has been activated.",
  };
}

export function buildOptimizationPlan(profile) {
  const actions = [];
  const primaryGpu = profile.gpus.find((gpu) => gpu.vendor === "nvidia") ?? profile.gpus[0];
  const dedicatedGpu = profile.gpus.find((gpu) => gpu.type === "dedicated");

  if (profile.power?.name?.toLowerCase() !== "high performance") {
    actions.push({
      id: "windows-power-plan",
      title: "Use a performance power plan while Chopping",
      status: "recommended",
      impact: "high",
      detail: `Current plan is ${profile.power?.name ?? "unknown"}. A performance plan can reduce CPU/GPU throttling on laptops.`,
      apply: {
        automatic: false,
        reason: "Changing system power policy should be explicit.",
      },
    });
  }

  if (primaryGpu?.vendor === "nvidia") {
    actions.push({
      id: "nvidia-prefer-dgpu",
      title: "Prefer the NVIDIA GPU for Salad workloads",
      status: "recommended",
      impact: "high",
      detail: `${primaryGpu.name} detected with ${primaryGpu.memoryMb ?? "unknown"} MB VRAM. Configure Windows Graphics/NVIDIA settings so Salad and workload binaries use the dGPU.`,
      apply: {
        automatic: false,
        reason: "Per-app GPU preference depends on installed Salad binary paths.",
      },
    });
  }

  if (dedicatedGpu && profile.gpus.some((gpu) => gpu.type === "integrated")) {
    actions.push({
      id: "avoid-igpu-workload",
      title: "Keep compute workloads off the integrated GPU",
      status: "recommended",
      impact: "medium",
      detail:
        "Integrated GPU is useful for display, but Salad compute should target the dedicated GPU when available.",
      apply: {
        automatic: false,
        reason: "The helper should not disable display hardware.",
      },
    });
  }

  if (!profile.virtualization.hypervisorPresent || !profile.virtualization.wslAvailable) {
    actions.push({
      id: "enable-wsl-virtualization",
      title: "Enable virtualization and WSL for container jobs",
      status: "blocked",
      impact: "high",
      detail:
        "Salad container workloads require virtualization/WSL readiness. Enable BIOS virtualization, Virtual Machine Platform, and WSL if missing.",
      apply: {
        automatic: false,
        reason: "This may require reboot and elevated Windows feature changes.",
      },
    });
  } else if (!profile.virtualization.saladDistro?.running) {
    actions.push({
      id: "wsl-runtime-ready",
      title: "WSL is installed but the Salad runtime is idle",
      status: "info",
      impact: "medium",
      detail:
        "salad-enterprise-linux is available but currently stopped. It should run when Salad receives WSL/container work.",
      apply: {
        automatic: false,
        reason: "Starting Salad workloads should remain under Salad control.",
      },
    });
  }

  if (profile.memory.totalGb >= 32) {
    actions.push({
      id: "memory-capacity",
      title: "Memory capacity is strong for container workloads",
      status: "ready",
      impact: "medium",
      detail: `${profile.memory.installedGb ?? profile.memory.totalGb} GB installed RAM detected (${profile.memory.totalGb} GB usable by Windows). This is suitable for heavier WSL/container assignments.`,
      apply: {
        automatic: false,
        reason: "No change needed.",
      },
    });
  }

  if (!profile.elevation?.isAdmin) {
    actions.push({
      id: "elevated-helper",
      title: "Run the suite elevated on Windows",
      status: "optional",
      impact: "medium",
      detail:
        "Current process is not elevated. Start the local suite through UAC so UI, helper, and monitor share the same administrator context.",
      apply: {
        automatic: false,
        reason: "UAC prompt must be user-triggered.",
      },
    });
  }

  return {
    score: calculateReadinessScore(profile, actions),
    summary: summarizeOptimization(profile, actions),
    actions,
  };
}

async function readComputerInfo() {
  if (os.platform() !== "win32") {
    return {
      windows: {
        name: os.type(),
        version: os.release(),
        architecture: os.arch(),
        manufacturer: "unknown",
        model: "unknown",
      },
      cpu: {
        name: os.cpus()[0]?.model ?? "unknown",
        cores: os.cpus().length,
        logicalProcessors: os.cpus().length,
        maxClockMhz: null,
      },
      memory: {
        totalBytes: os.totalmem(),
        totalGb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      },
      hypervisorPresent: false,
    };
  }

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        [
          "$cs = Get-CimInstance Win32_ComputerSystem;",
          "$os = Get-CimInstance Win32_OperatingSystem;",
          "$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1;",
          "$installedMemory = (Get-CimInstance Win32_PhysicalMemory | Measure-Object Capacity -Sum).Sum;",
          "[pscustomobject]@{",
          "OsName=$os.Caption;",
          "OsVersion=$os.Version;",
          "OsArchitecture=$os.OSArchitecture;",
          "Manufacturer=$cs.Manufacturer;",
          "Model=$cs.Model;",
          "TotalPhysicalMemory=$cs.TotalPhysicalMemory;",
          "InstalledPhysicalMemory=$installedMemory;",
          "LogicalProcessors=$cs.NumberOfLogicalProcessors;",
          "HyperVisorPresent=$cs.HypervisorPresent;",
          "Processor=$cpu",
          "} | ConvertTo-Json -Depth 5 -Compress",
        ].join(" "),
      ],
      { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
    );
    const info = JSON.parse(stdout);
    const processor = info.Processor ?? {};
    const totalBytes = Number(info.TotalPhysicalMemory ?? os.totalmem());

    return {
      windows: {
        name: info.OsName ?? "Windows",
        version: info.OsVersion ?? null,
        architecture: info.OsArchitecture ?? os.arch(),
        manufacturer: info.Manufacturer ?? "unknown",
        model: info.Model ?? "unknown",
      },
      cpu: {
        name: processor.Name ?? os.cpus()[0]?.model ?? "unknown",
        cores: processor.NumberOfCores ?? null,
        logicalProcessors: info.LogicalProcessors ?? os.cpus().length,
        maxClockMhz: processor.MaxClockSpeed ?? null,
      },
      memory: {
        totalBytes,
        totalGb: Math.round(totalBytes / 1024 / 1024 / 1024),
        installedBytes: Number(info.InstalledPhysicalMemory ?? totalBytes),
        installedGb: Math.round(Number(info.InstalledPhysicalMemory ?? totalBytes) / 1024 / 1024 / 1024),
      },
      hypervisorPresent: Boolean(info.HyperVisorPresent),
    };
  } catch {
    return {
      windows: {
        name: "Windows",
        version: os.release(),
        architecture: os.arch(),
        manufacturer: "unknown",
        model: "unknown",
      },
      cpu: {
        name: os.cpus()[0]?.model ?? "unknown",
        cores: null,
        logicalProcessors: os.cpus().length,
        maxClockMhz: null,
      },
      memory: {
        totalBytes: os.totalmem(),
        totalGb: Math.round(os.totalmem() / 1024 / 1024 / 1024),
      },
      hypervisorPresent: false,
    };
  }
}

async function readGpuControllers() {
  if (os.platform() !== "win32") {
    return [];
  }

  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion,VideoProcessor,PNPDeviceID | ConvertTo-Json -Depth 4 -Compress",
      ],
      { windowsHide: true, maxBuffer: 2 * 1024 * 1024 },
    );

    return asArray(JSON.parse(stdout || "[]")).map((gpu) => ({
      name: gpu.Name ?? "Unknown GPU",
      vendor: detectGpuVendor(gpu.Name ?? gpu.VideoProcessor),
      type: detectGpuType(gpu.Name ?? gpu.VideoProcessor),
      memoryMb: gpu.AdapterRAM ? Math.round(Number(gpu.AdapterRAM) / 1024 / 1024) : null,
      driverVersion: gpu.DriverVersion ?? null,
      videoProcessor: gpu.VideoProcessor ?? null,
      pnpDeviceId: redactDeviceId(gpu.PNPDeviceID ?? null),
    }));
  } catch {
    return [];
  }
}

async function readPowerPlan() {
  if (os.platform() !== "win32") {
    return { guid: null, name: "unknown", source: "unsupported" };
  }

  try {
    const { stdout } = await execFileAsync("powercfg.exe", ["/getactivescheme"], {
      windowsHide: true,
    });
    const match = stdout.match(/GUID:\s+([a-f0-9-]+)\s+\(([^)]+)\)/i);

    return {
      guid: match?.[1] ?? null,
      name: match?.[2] ?? stdout.trim(),
      source: "powercfg",
    };
  } catch {
    return { guid: null, name: "unknown", source: "powercfg" };
  }
}

async function readNvidiaSmi() {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      [
        "--query-gpu=name,driver_version,memory.total,power.limit,power.default_limit,temperature.gpu,utilization.gpu",
        "--format=csv,noheader,nounits",
      ],
      { windowsHide: true },
    );

    return stdout
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const [name, driverVersion, memoryTotal, powerLimit, defaultPowerLimit, temperature, utilization] =
          line.split(",").map((part) => part.trim());

        return {
          name,
          driverVersion,
          memoryMb: parseMaybeNumber(memoryTotal),
          powerLimitW: parseMaybeNumber(powerLimit),
          defaultPowerLimitW: parseMaybeNumber(defaultPowerLimit),
          temperatureC: parseMaybeNumber(temperature),
          utilizationPercent: parseMaybeNumber(utilization),
        };
      });
  } catch {
    return [];
  }
}

function mergeGpuDetails(gpus, nvidiaDetails) {
  return gpus.map((gpu) => {
    const nvidia = nvidiaDetails.find((detail) =>
      gpu.name.toLowerCase().includes(detail.name.toLowerCase()),
    );

    return {
      ...gpu,
      memoryMb: nvidia?.memoryMb ?? gpu.memoryMb,
      driverVersion: nvidia?.driverVersion ?? gpu.driverVersion,
      telemetry: nvidia
        ? {
            powerLimitW: nvidia.powerLimitW,
            defaultPowerLimitW: nvidia.defaultPowerLimitW,
            temperatureC: nvidia.temperatureC,
            utilizationPercent: nvidia.utilizationPercent,
          }
        : null,
    };
  });
}

function summarizeSalad(system) {
  const processNames = system.windowsProcesses.map((process) => process.name.toLowerCase());
  const saladProcesses = system.windowsProcesses.filter((process) =>
    process.name.toLowerCase().includes("salad"),
  );
  const workloadProcesses = system.windowsProcesses.filter((process) =>
    ["t-rex", "trex", "rigel", "xmrig", "containerd", "wslhost", "vmmem"].some((hint) =>
      process.name.toLowerCase().includes(hint),
    ),
  );

  return {
    appDetected: processNames.some((name) => name.includes("salad")),
    serviceDetected: processNames.includes("salad.bowl.service.exe"),
    processCount: saladProcesses.length,
    workloadProcessCount: workloadProcesses.length,
    processes: saladProcesses.slice(0, 8).map((process) => ({
      name: process.name,
      pid: process.pid,
      startedAt: process.startedAt,
      source: process.source,
    })),
    workloadProcesses: workloadProcesses.slice(0, 8).map((process) => ({
      name: process.name,
      pid: process.pid,
      startedAt: process.startedAt,
      source: process.source,
    })),
  };
}

function calculateReadinessScore(profile, actions) {
  let score = 40;

  if (profile.gpus.some((gpu) => gpu.vendor === "nvidia" && gpu.memoryMb >= 6000)) {
    score += 20;
  }

  if (profile.memory.totalGb >= 32) {
    score += 15;
  }

  if (profile.virtualization.hypervisorPresent && profile.virtualization.wslAvailable) {
    score += 15;
  }

  if (profile.salad.serviceDetected) {
    score += 10;
  }

  if (actions.some((action) => action.status === "blocked")) {
    score -= 20;
  }

  return Math.max(0, Math.min(100, score));
}

function summarizeOptimization(profile, actions) {
  const blocked = actions.filter((action) => action.status === "blocked").length;
  const recommended = actions.filter((action) => action.status === "recommended").length;

  if (blocked > 0) {
    return `${blocked} blocker${blocked === 1 ? "" : "s"} found before this rig is fully job-ready.`;
  }

  if (recommended > 0) {
    return `${recommended} optimization${recommended === 1 ? "" : "s"} recommended for maximum Salad availability.`;
  }

  return `${profile.machine.hostname} looks ready for maximum local Salad availability.`;
}

function detectGpuVendor(value = "") {
  const normalized = value.toLowerCase();

  if (normalized.includes("nvidia")) {
    return "nvidia";
  }

  if (normalized.includes("amd") || normalized.includes("radeon")) {
    return "amd";
  }

  if (normalized.includes("intel")) {
    return "intel";
  }

  return "unknown";
}

function detectGpuType(value = "") {
  const normalized = value.toLowerCase();

  if (normalized.includes("rtx") || normalized.includes("geforce") || normalized.includes("radeon rx")) {
    return "dedicated";
  }

  if (normalized.includes("radeon") || normalized.includes("intel")) {
    return "integrated";
  }

  return "unknown";
}

function parseMaybeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function redactDeviceId(value) {
  if (!value) {
    return null;
  }

  return value.split("\\").slice(0, 2).join("\\");
}

function asArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
