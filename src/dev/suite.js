import { execFile } from "node:child_process";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { createServer } from "vite";
import { ensureElevatedProcess } from "../helper/elevation.js";

const execFileAsync = promisify(execFile);
const appUrl = "http://127.0.0.1:5173/";
let vite = null;

await main();

async function main() {
  if (
    await ensureElevatedProcess({
      argv: [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
      label: "SaladChoppingHours elevated suite",
      forceRelaunch: process.env.SALAD_FOREGROUND !== "1",
    })
  ) {
    process.stdout.write("Requested elevated SaladChoppingHours suite through Windows UAC.\n");
    const started = await waitForUrl(appUrl, 20000);

    if (started) {
      process.stdout.write("SaladChoppingHours suite is running in the background.\n");
    } else {
      process.stdout.write(
        "Could not confirm the elevated suite started. Run with SALAD_FOREGROUND=1 for diagnostics.\n",
      );
    }
    return;
  }

  process.stdout.write("Starting SaladChoppingHours local suite...\n");
  process.stdout.write("Helper: http://127.0.0.1:48173/health\n");

  let existingHelper = await isUrlHealthy("http://127.0.0.1:48173/health");
  let existingUi = await isUrlHealthy(appUrl);

  if (!existingHelper) {
    await releaseLocalPort(48173);
    existingHelper = await isUrlHealthy("http://127.0.0.1:48173/health");
  }

  if (!existingUi) {
    await releaseLocalPort(5173);
    existingUi = await isUrlHealthy(appUrl);
  }

  if (existingHelper && existingUi) {
    process.stdout.write("Existing SaladChoppingHours suite detected; opening dashboard.\n");
    await openBrowser(appUrl);
    return;
  }

  let helperServer = null;

  if (existingHelper) {
    process.stdout.write("Existing SaladChoppingHours helper detected; reusing it.\n");
  } else {
    helperServer = await import("../helper/server.js");
  }

  try {
    vite = await createServer({
      server: {
        host: "127.0.0.1",
        port: 5173,
        strictPort: true,
      },
    });

    await vite.listen();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown Vite error";
    process.stdout.write(`Could not start Vite: ${message}\n`);
    process.stdout.write("Try Settings > Stop managed suite, or rerun after stale processes close.\n");
    process.exit(1);
  }
  vite.printUrls();
  await openBrowser(appUrl);
  helperServer?.setSuiteShutdownHandler(stopSuite);

  if (!process.argv.includes("--no-monitor")) {
    await import("../helper/monitor.js");
  }

  process.stdout.write("\nPress Ctrl+C to stop the suite.\n");

  process.on("SIGINT", stopSuite);
  process.on("SIGTERM", stopSuite);
}

async function stopSuite() {
  process.stdout.write("\nStopping SaladChoppingHours local suite...\n");
  await vite?.close();
  process.exit(0);
}

async function isUrlHealthy(url) {
  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(1000),
    });

    return response.ok;
  } catch {
    return false;
  }
}

async function waitForUrl(url, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    if (await isUrlHealthy(url)) {
      return true;
    }

    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }

  return false;
}

async function releaseLocalPort(port) {
  if (os.platform() !== "win32") {
    return;
  }

  const pids = await findListeningPids(port);

  for (const pid of pids) {
    if (pid === process.pid || pid === 0) {
      continue;
    }

    process.stdout.write(`Stopping stale listener on port ${port} (PID ${pid}).\n`);

    try {
      await execFileAsync("taskkill.exe", ["/PID", String(pid), "/F"], {
        windowsHide: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      process.stdout.write(`Could not stop PID ${pid}: ${message}\n`);
    }
  }

  if (pids.length > 0) {
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }
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

async function openBrowser(url) {
  if (process.env.SALAD_OPEN_BROWSER === "0") {
    return;
  }

  try {
    if (os.platform() === "win32") {
      await execFileAsync("cmd.exe", ["/c", "start", "", url], { windowsHide: true });
      return;
    }

    if (os.platform() === "darwin") {
      await execFileAsync("open", [url]);
      return;
    }

    await execFileAsync("xdg-open", [url]);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    process.stdout.write(`Could not open browser automatically: ${message}\n`);
    process.stdout.write(`Open ${url} manually.\n`);
  }
}
