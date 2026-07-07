/**
 * stop.js — stop a running MyKitchen suite.
 *
 * Strategy (in order):
 *   1. Try the graceful /suite/shutdown HTTP endpoint on the helper.
 *   2. If the endpoint is unavailable or the handler is not registered,
 *      fall back to killing any process listening on the UI (5173) and
 *      helper (48173) ports via taskkill on Windows.
 *
 * Usage:
 *   node src/dev/stop.js        → called directly (has UAC elevation)
 *   npm run suite:stop
 *
 * Exported:
 *   stop()                      → call from restart.js (already elevated)
 */

import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { ensureElevatedProcess } from "../helper/elevation.js";

const execFileAsync = promisify(execFile);

const helperUrl = "http://127.0.0.1:48173";
const suitePorts = [5173, 48173];

// Only run main() when this file is the entry point, not when it is imported
// by restart.js.
if (
  process.argv[1] &&
  fileURLToPath(import.meta.url).replace(/\\/g, "/") ===
    process.argv[1].replace(/\\/g, "/")
) {
  await main();
}

async function main() {
  // The suite runs elevated on Windows; stop must also be elevated to kill it.
  if (
    await ensureElevatedProcess({
      argv: [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
      label: "MyKitchen suite stop",
      forceRelaunch: process.env.SALAD_FOREGROUND !== "1",
    })
  ) {
    process.stdout.write("Requested elevated MyKitchen suite stop through Windows UAC.\n");
    return;
  }

  await stop();
}

/**
 * Stop the running suite. Can be called from restart.js when already elevated.
 */
export async function stop() {
  process.stdout.write("Stopping MyKitchen suite...\n");

  const stopped = await tryGracefulShutdown();

  if (stopped) {
    process.stdout.write("Suite stopped gracefully via helper endpoint.\n");
  } else {
    process.stdout.write(
      "Graceful shutdown not available; releasing ports by PID.\n",
    );
    await stopByPort();
  }

  process.stdout.write("Done.\n");
}

/**
 * Ask the helper to invoke its registered shutdownHandler.
 * Returns true if the helper confirmed it is stopping.
 */
async function tryGracefulShutdown() {
  try {
    const response = await fetch(`${helperUrl}/suite/shutdown`, {
      signal: AbortSignal.timeout(4000),
    });

    if (!response.ok) {
      return false;
    }

    const body = await response.json();

    if (!body.stopping) {
      process.stdout.write(
        `Helper responded but no shutdown handler is registered: ${body.message}\n`,
      );
      return false;
    }

    // Give the suite a moment to close Vite and exit cleanly.
    await sleep(1500);
    return true;
  } catch {
    return false;
  }
}

/** Kill every process listening on the known suite ports. */
async function stopByPort() {
  for (const port of suitePorts) {
    const pids = await findListeningPids(port);

    if (pids.length === 0) {
      process.stdout.write(`Port ${port}: nothing listening.\n`);
      continue;
    }

    for (const pid of pids) {
      if (pid === process.pid || pid === 0) {
        continue;
      }

      process.stdout.write(`Port ${port}: killing PID ${pid}...\n`);

      try {
        await execFileAsync("taskkill.exe", ["/PID", String(pid), "/F", "/T"], {
          windowsHide: true,
        });
        process.stdout.write(`  PID ${pid} stopped.\n`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        process.stdout.write(`  Could not kill PID ${pid}: ${message}\n`);
      }
    }
  }

  // Short wait so the OS releases the ports before a restart attempt.
  await sleep(600);
}

async function findListeningPids(port) {
  try {
    const { stdout } = await execFileAsync("netstat.exe", ["-ano", "-p", "tcp"], {
      windowsHide: true,
      maxBuffer: 1024 * 1024,
    });

    return [
      ...new Set(
        stdout
          .split(/\r?\n/)
          .map((line) => line.trim())
          .filter((line) => line.includes(`:${port}`) && /\bLISTENING\b/i.test(line))
          .map((line) => Number(line.split(/\s+/).at(-1)))
          .filter(Number.isFinite),
      ),
    ];
  } catch {
    return [];
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
