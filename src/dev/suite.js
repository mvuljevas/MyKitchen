import { createServer } from "vite";
import "../helper/server.js";

process.stdout.write("Starting SaladChoppingHours local suite...\n");
process.stdout.write("Helper: http://127.0.0.1:48173/health\n");

const vite = await createServer({
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
  },
});

await vite.listen();
vite.printUrls();

if (!process.argv.includes("--no-monitor")) {
  await import("../helper/monitor.js");
}

process.stdout.write("\nPress Ctrl+C to stop the suite.\n");

process.on("SIGINT", stopSuite);
process.on("SIGTERM", stopSuite);

async function stopSuite() {
  process.stdout.write("\nStopping SaladChoppingHours local suite...\n");
  await vite.close();
  process.exit(0);
}
