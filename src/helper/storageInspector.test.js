import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { inspectSaladStorage, purgeSaladStorage } from "./storageInspector.js";

test("inspectSaladStorage reports WSL allocation and cleanup candidates", async () => {
  const root = await createFixture();

  try {
    const storage = await inspectSaladStorage(root);

    assert.equal(storage.allocated.path, path.join(root, "wsl", "ext4.vhdx"));
    assert.equal(storage.allocated.sizeBytes, 13);
    assert.equal(storage.purge.safeBytes, 7);
    assert.equal(storage.purge.obsoleteBytes, 12);
    assert.equal(
      storage.categories.some((category) => category.name === "logs" && category.protected),
      true,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("purgeSaladStorage keeps logs protected unless log deletion is explicitly confirmed", async () => {
  const root = await createFixture();

  try {
    const dryRun = await purgeSaladStorage(root, {
      mode: "all",
      dryRun: true,
      includeLogs: true,
      confirm: "DELETE_ALL_SALAD_CACHE",
    });

    assert.equal(
      dryRun.results.some((candidate) => candidate.kind === "logs"),
      false,
    );

    const withLogConfirm = await purgeSaladStorage(root, {
      mode: "all",
      dryRun: true,
      includeLogs: true,
      confirm: "DELETE_ALL_SALAD_CACHE",
      logConfirm: "DELETE_LOGS",
    });

    assert.equal(
      withLogConfirm.results.some((candidate) => candidate.kind === "logs"),
      true,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("safe purge deletes only re-downloadable cache folders", async () => {
  const root = await createFixture();

  try {
    const result = await purgeSaladStorage(root, {
      mode: "safe",
      dryRun: false,
    });

    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].kind, "cache");
    await assert.rejects(stat(path.join(root, "workloads", "_downloads")));
    await assert.doesNotReject(stat(path.join(root, "logs", "SaladBowl.log")));
    await assert.doesNotReject(stat(path.join(root, "wsl", "ext4.vhdx")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

async function createFixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "salad-storage-"));
  await mkdir(path.join(root, "workloads", "_downloads"), { recursive: true });
  await mkdir(path.join(root, "workloads", "old-miner"), { recursive: true });
  await mkdir(path.join(root, "logs"), { recursive: true });
  await mkdir(path.join(root, "boot-logs"), { recursive: true });
  await mkdir(path.join(root, "wsl"), { recursive: true });

  await writeFile(path.join(root, "workloads", "_downloads", "archive.zip"), "cache!!");
  await writeFile(path.join(root, "workloads", "old-miner", "miner.exe"), "stale");
  await writeFile(path.join(root, "logs", "SaladBowl.log"), "log");
  await writeFile(path.join(root, "boot-logs", "boot.log"), "boot");
  await writeFile(path.join(root, "wsl", "ext4.vhdx"), "vhdx-content!");

  const oldDate = new Date(Date.now() - 5 * 86400000);
  await utimes(path.join(root, "workloads", "old-miner"), oldDate, oldDate);

  return root;
}
