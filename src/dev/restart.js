/**
 * restart.js — stop a running MyKitchen suite and immediately start a new one.
 *
 * Equivalent to suite:stop then suite in sequence, but in a single command
 * so only one UAC prompt is shown on Windows.
 *
 * Usage:
 *   node src/dev/restart.js
 *   npm run suite:restart
 */

import { fileURLToPath } from "node:url";
import { ensureElevatedProcess } from "../helper/elevation.js";
import { stop } from "./stop.js";

await main();

async function main() {
  // Restart must run in the same elevated context as the suite.
  if (
    await ensureElevatedProcess({
      argv: [fileURLToPath(import.meta.url), ...process.argv.slice(2)],
      label: "MyKitchen suite restart",
      forceRelaunch: process.env.SALAD_FOREGROUND !== "1",
    })
  ) {
    process.stdout.write("Requested elevated MyKitchen suite restart through Windows UAC.\n");
    return;
  }

  // Stop phase — reuse the exported stop() from stop.js, already elevated.
  await stop();

  process.stdout.write("Starting MyKitchen suite...\n");

  // Start phase — importing suite.js runs its top-level main() which
  // bootstraps Vite, the helper, and the monitor.
  await import("./suite.js");
}
