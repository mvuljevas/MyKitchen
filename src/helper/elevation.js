import { execFile } from "node:child_process";
import os from "node:os";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

export async function inspectElevation() {
  if (os.platform() !== "win32") {
    return { isAdmin: false, level: "unknown", needsElevation: false };
  }

  try {
    const { stdout } = await execFileAsync("whoami", ["/groups"], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });
    const normalizedOutput = stdout.toLowerCase();

    const isAdmin =
      normalizedOutput.includes("s-1-5-32-544") && !normalizedOutput.includes("deny only");
    const level = normalizedOutput.includes("s-1-16-12288")
      ? "high"
      : normalizedOutput.includes("s-1-16-8192")
        ? "medium"
        : "unknown";

    return {
      isAdmin,
      level,
      needsElevation: !isAdmin,
    };
  } catch {
    return { isAdmin: false, level: "unknown", needsElevation: true };
  }
}

export async function ensureElevatedProcess({
  argv,
  label,
  relaunchEnv = {},
  forceRelaunch = false,
}) {
  if (os.platform() !== "win32" || process.env.SALAD_ELEVATED_RELAUNCH === "1") {
    return false;
  }

  const elevation = await inspectElevation();

  if (elevation.isAdmin && !forceRelaunch) {
    return false;
  }

  await relaunchElevatedNode({ argv, label, relaunchEnv });
  return true;
}

export async function relaunchElevatedNode({ argv, label, relaunchEnv = {} }) {
  const cwd = process.cwd();
  const envAssignments = {
    ...relaunchEnv,
    SALAD_ELEVATED_RELAUNCH: "1",
  };
  const envScript = Object.entries(envAssignments)
    .map(([key, value]) => `$env:${key} = '${escapePowerShellSingleQuoted(String(value))}'`)
    .join("; ");
  const nodeCommand = [
    `& '${escapePowerShellSingleQuoted(process.execPath)}'`,
    ...argv.map((arg) => `'${escapePowerShellSingleQuoted(arg)}'`),
  ].join(" ");
  const command = [
    `$Host.UI.RawUI.WindowTitle = '${escapePowerShellSingleQuoted(label)}'`,
    envScript,
    nodeCommand,
  ]
    .filter(Boolean)
    .join("; ");
  const windowStyle = process.env.SALAD_ELEVATED_WINDOW ?? "Hidden";
  const shellArgs = ["-NoProfile", "-Command", command];

  await execFileAsync(
    "powershell.exe",
    [
      "-NoProfile",
      "-Command",
      [
        "Start-Process",
        "-Verb RunAs",
        `-WorkingDirectory '${escapePowerShellSingleQuoted(cwd)}'`,
        "-FilePath powershell.exe",
        `-WindowStyle ${windowStyle}`,
        "-ArgumentList",
        formatArgumentList(shellArgs),
      ].join(" "),
    ],
    { windowsHide: true },
  );
}

function formatArgumentList(args) {
  return args.map((arg) => `'${escapePowerShellSingleQuoted(arg)}'`).join(",");
}

function escapePowerShellSingleQuoted(value) {
  return value.replaceAll("'", "''");
}
