import { fileURLToPath } from "node:url";
import { ensureElevatedProcess } from "./elevation.js";

if (
  await ensureElevatedProcess({
    argv: [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
    label: "SaladChoppingHours elevated monitor",
    forceRelaunch: process.env.SALAD_FOREGROUND !== "1",
  })
) {
  process.stdout.write("Requested elevated SaladChoppingHours monitor through Windows UAC.\n");
  process.exit(0);
}

const helperBaseUrl = process.env.SALAD_HELPER_URL ?? "http://127.0.0.1:48173";
const pollMs = Number.parseInt(process.env.SALAD_MONITOR_POLL_MS ?? "3000", 10);

let previousSignature = "";

process.stdout.write(`SaladChoppingHours monitor connected to ${helperBaseUrl}\n`);
process.stdout.write("Press Ctrl+C to stop.\n\n");

await poll();
setInterval(poll, pollMs);

async function poll() {
  try {
    const [status, workload, history] = await Promise.all([
      fetchJson("/salad/status"),
      fetchJson("/salad/workload/current"),
      fetchJson("/salad/chopping-history"),
    ]);
    const signature = JSON.stringify({
      process: status.process?.state,
      service: status.service?.state,
      wsl: status.wsl?.saladDistro?.state,
      workload: workload.type,
      lastSignalAt: history.lastSignalAt,
      totalHours: history.totalHours,
      logActivity: history.logActivity?.rolling7DaysHours,
    });

    if (signature !== previousSignature) {
      previousSignature = signature;
      printEvent("process", `${status.process?.label ?? "Unknown process"}; service ${status.service?.label ?? "unknown"}`);
      printEvent("wsl", `salad-enterprise-linux ${status.wsl?.saladDistro?.state ?? "unknown"}`);
      printEvent("job", `${workload.label} (${workload.confidence})`);
      printEvent(
        "parser",
        `${history.totalHours?.toFixed?.(2) ?? "0.00"}h / ${history.signalCount ?? 0} signals / ${history.intervalCount ?? 0} intervals`,
      );
      printEvent(
        "rig",
        `${history.logActivity?.rolling7DaysHours?.toFixed?.(2) ?? "0.00"}h inferred / ${history.logActivity?.eventCount ?? 0} log events / ${history.logActivity?.intervalCount ?? 0} intervals`,
      );
    }
  } catch (error) {
    printEvent("helper", error instanceof Error ? error.message : "Helper unavailable");
  }
}

async function fetchJson(path) {
  const response = await fetch(`${helperBaseUrl}${path}`);

  if (!response.ok) {
    throw new Error(`Helper request failed: ${response.status}`);
  }

  return response.json();
}

function printEvent(source, message) {
  process.stdout.write(`[${new Date().toISOString()}] ${source.padEnd(8)} ${message}\n`);
}
