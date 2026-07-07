import { mkdir, mkdtemp, rm, stat, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { inspectSaladStorage, purgeSaladStorage } from "./storageInspector.js";

test("inspectSaladStorage reports WSL allocation without making it a cleanup candidate", async () => {
  const root = await createFixture();

  try {
    const storage = await inspectSaladStorage(root);

    assert.equal(storage.allocated.path, path.join(root, "wsl", "ext4.vhdx"));
    assert.equal(storage.allocated.sizeBytes, 13);
    assert.equal(storage.purge.safeBytes, 7);
    assert.equal(storage.purge.jobCacheBytes, 16);
    assert.equal(storage.workloadStorage.downloadsBytes, 7);
    assert.equal(storage.workloadStorage.obsoleteBytes, 14);
    assert.equal(storage.workloadStorage.obsoletePackageCount, 1);
    assert.equal(
      storage.categories.some((category) => category.name === "logs" && category.protected),
      true,
    );
    assert.equal(
      storage.purge.candidates.some((candidate) => candidate.kind === "wsl"),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("purgeSaladStorage never selects logs, WSL, or config files", async () => {
  const root = await createFixture();

  try {
    const dryRun = await purgeSaladStorage(root, {
      mode: "all",
      dryRun: true,
    });

    assert.equal(
      dryRun.results.some((candidate) => candidate.kind === "logs"),
      false,
    );
    assert.equal(
      dryRun.results.some((candidate) => candidate.path.includes(`${path.sep}wsl${path.sep}`)),
      false,
    );
    assert.equal(
      dryRun.results.some((candidate) => candidate.path.includes(`${path.sep}config${path.sep}`)),
      false,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("safe purge deletes only downloaded job cache", async () => {
  const root = await createFixture();

  try {
    const result = await purgeSaladStorage(root, {
      mode: "safe",
      dryRun: false,
    });

    assert.equal(result.results.length, 1);
    assert.equal(result.results[0].kind, "job-cache");
    await assert.rejects(stat(path.join(root, "workloads", "_downloads")));
    await assert.doesNotReject(stat(path.join(root, "workloads", "old-miner", "cache")));
    await assert.doesNotReject(stat(path.join(root, "workloads", "old-miner", "miner.exe")));
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
  await mkdir(path.join(root, "workloads", "old-miner", "cache"), { recursive: true });
  await mkdir(path.join(root, "logs"), { recursive: true });
  await mkdir(path.join(root, "boot-logs"), { recursive: true });
  await mkdir(path.join(root, "config"), { recursive: true });
  await mkdir(path.join(root, "wsl"), { recursive: true });

  await writeFile(path.join(root, "workloads", "_downloads", "archive.zip"), "cache!!");
  await writeFile(path.join(root, "workloads", "old-miner", "miner.exe"), "stale");
  await writeFile(path.join(root, "workloads", "old-miner", "cache", "job.tmp"), "job-cache");
  await writeFile(path.join(root, "logs", "SaladBowl.log"), "log");
  await writeFile(path.join(root, "boot-logs", "boot.log"), "boot");
  await writeFile(path.join(root, "config", "rig.json"), "rig");
  await writeFile(path.join(root, "wsl", "ext4.vhdx"), "vhdx-content!");

  const oldDate = new Date(Date.now() - 5 * 86400000);
  await utimes(path.join(root, "workloads", "old-miner"), oldDate, oldDate);

  return root;
}
