import { execFile } from "node:child_process";
import crypto from "node:crypto";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { inspectElevation, relaunchElevatedNode } from "./elevation.js";

const execFileAsync = promisify(execFile);
const saladWslDistro = "salad-enterprise-linux";

export async function inspectSystem() {
  const localId = getMachineId();
  const [windowsProcesses, wsl, elevation] = await Promise.all([
    listWindowsProcesses(),
    inspectWsl(),
    inspectElevation(),
  ]);

  return {
    machine: {
      id: localId,
      localId,
      saladId: null,
      idSource: "local-fallback",
      hostname: os.hostname(),
      platform: os.platform(),
    },
    elevation,
    windowsProcesses,
    wsl,
  };
}

export async function requestElevatedHelper() {
  await relaunchElevatedNode({
    argv: [fileURLToPath(new URL("./server.js", import.meta.url))],
    label: "MyKitchen elevated helper",
    relaunchEnv: {
      SALAD_HELPER_HOST: process.env.SALAD_HELPER_HOST ?? "127.0.0.1",
      SALAD_HELPER_PORT: process.env.SALAD_HELPER_PORT ?? "48173",
      SALAD_INSTALL_PATH: process.env.SALAD_INSTALL_PATH ?? "C:\\ProgramData\\Salad",
    },
  });

  return { requested: true };
}

async function listWindowsProcesses() {
  if (os.platform() !== "win32") {
    return [];
  }

  const cimProcesses = await listProcessesWithCim();
  if (cimProcesses.length > 0) {
    return cimProcesses;
  }

  return listProcessesWithTasklist();
}

async function listProcessesWithCim() {
  try {
    const { stdout } = await execFileAsync(
      "powershell.exe",
      [
        "-NoProfile",
        "-Command",
        "Get-CimInstance Win32_Process | Select-Object ProcessId,Name,ExecutablePath,CommandLine,CreationDate | ConvertTo-Json -Depth 3 -Compress",
      ],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
    );

    const parsed = JSON.parse(stdout || "[]");
    return asArray(parsed)
      .filter((process) => process?.Name)
      .map((process) => ({
        pid: process.ProcessId,
        name: process.Name,
        executablePath: process.ExecutablePath ?? null,
        commandLine: redactCommandLine(process.CommandLine ?? null),
        startedAt: normalizeCimDate(process.CreationDate),
        source: "cim",
      }));
  } catch {
    return [];
  }
}

async function listProcessesWithTasklist() {
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
      .filter(Boolean)
      .map((name) => ({
        pid: null,
        name,
        executablePath: null,
        commandLine: null,
        startedAt: null,
        source: "tasklist",
      }));
  } catch {
    return [];
  }
}

async function inspectWsl() {
  if (os.platform() !== "win32") {
    return { available: false, distros: [], saladDistro: null, processes: [] };
  }

  const distros = await listWslDistros();
  const saladDistroState =
    distros.find((distro) => distro.name.toLowerCase() === saladWslDistro)?.state ??
    "Not installed";
  const processes =
    saladDistroState.toLowerCase() === "running"
      ? await listWslProcesses(saladWslDistro)
      : [];

  return {
    available: distros.length > 0,
    distros,
    saladDistro: {
      name: saladWslDistro,
      state: saladDistroState,
      running: saladDistroState.toLowerCase() === "running",
    },
    processes,
  };
}

async function listWslDistros() {
  try {
    const { stdout } = await execFileAsync("wsl.exe", ["--list", "--verbose"], {
      windowsHide: true,
      encoding: "utf16le",
    });

    return stdout
      .replace(/\0/g, "")
      .split(/\r?\n/)
      .map((line) => line.replace(/^\s*\*\s*/, "").trim())
      .filter((line) => line && !line.toLowerCase().startsWith("name"))
      .map((line) => {
        const parts = line.split(/\s{2,}/).filter(Boolean);
        return {
          name: parts[0],
          state: parts[1] ?? "Unknown",
          version: parts[2] ?? null,
        };
      });
  } catch {
    return [];
  }
}

async function listWslProcesses(distroName) {
  try {
    const { stdout } = await execFileAsync(
      "wsl.exe",
      ["-d", distroName, "--", "ps", "-eo", "pid,comm,args"],
      { windowsHide: true, maxBuffer: 1024 * 1024 },
    );

    return stdout
      .split(/\r?\n/)
      .slice(1)
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const match = line.match(/^(\d+)\s+(\S+)\s+(.*)$/);
        return {
          pid: match ? Number(match[1]) : null,
          name: match?.[2] ?? line,
          commandLine: redactCommandLine(match?.[3] ?? null),
        };
      });
  } catch {
    return [];
  }
}

function getMachineId() {
  return crypto.createHash("sha256").update(os.hostname()).digest("hex").slice(0, 12);
}

function redactCommandLine(value) {
  if (!value) {
    return null;
  }

  return value
    .replace(/([?&]token=)[^&\s]+/gi, "$1[redacted]")
    .replace(/(-u\s+)[^\s]+/gi, "$1[redacted]")
    .replace(/(--user\s+)[^\s]+/gi, "$1[redacted]");
}

function normalizeCimDate(value) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? null : timestamp.toISOString();
}

function asArray(value) {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}
