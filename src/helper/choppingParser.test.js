import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateChoppingSummary,
  calculateLogActivitySummary,
} from "./choppingParser.js";

test("calculates one continuous mining interval", () => {
  const summary = calculateChoppingSummary(
    [
      {
        relativePath: "logs\\T-Rex\\fixture.log",
        lines: [
          "2026-06-27 10:00:00.000 -03:00 [INF] Mining at pool",
          "2026-06-27 10:00:30.000 -03:00 [INF] Mining at pool",
          "2026-06-27 10:01:00.000 -03:00 [INF] Mining at pool",
        ],
      },
    ],
    new Date("2026-06-28T12:00:00-03:00"),
  );

  assert.equal(summary.signalCount, 3);
  assert.equal(summary.sourceLogCount, 1);
  assert.equal(summary.intervalCount, 1);
  assert.equal(summary.history.find((day) => day.isoDate === "2026-06-27").hours, 0.03);
  assert.equal(summary.confidence, "confirmed");
  assert.equal(summary.last24Hours, 0);
  assert.equal(summary.starChefEstimate.targetHours, 50);
});

test("ignores readable logs that do not contain activity signals", () => {
  const summary = calculateChoppingSummary(
    [
      {
        relativePath: "logs\\SaladBowl\\service.log",
        lines: [
          "2026-06-27 09:59:00.000 -03:00 [INF] Service heartbeat",
          "2026-06-27 09:59:30.000 -03:00 [INF] No workload assigned",
        ],
      },
      {
        relativePath: "logs\\T-Rex\\fixture.log",
        lines: ["2026-06-27 10:00:00.000 -03:00 [INF] Mining at pool"],
      },
    ],
    new Date("2026-06-28T12:00:00-03:00"),
  );

  assert.equal(summary.signalCount, 1);
  assert.equal(summary.sourceLogCount, 1);
  assert.equal(summary.intervalCount, 1);
});

test("splits intervals when mining signals have a large gap", () => {
  const summary = calculateChoppingSummary(
    [
      {
        relativePath: "logs\\Rigel\\fixture.log",
        lines: [
          "2026-06-27 10:00:00.000 -03:00 [INF] Mining at pool",
          "2026-06-27 10:00:30.000 -03:00 [INF] Mining at pool",
          "2026-06-27 10:10:00.000 -03:00 [INF] Mining at pool",
        ],
      },
    ],
    new Date("2026-06-28T12:00:00-03:00"),
  );

  assert.equal(summary.intervalCount, 2);
  assert.equal(summary.intervals.every((interval) => interval.confidence === "confirmed"), true);
});

test("splits daily totals across midnight", () => {
  const summary = calculateChoppingSummary(
    [
      {
        relativePath: "logs\\T-Rex\\midnight.log",
        lines: [
          "2026-06-26 23:59:30.000 -03:00 [INF] Mining at pool",
          "2026-06-27 00:00:00.000 -03:00 [INF] Mining at pool",
          "2026-06-27 00:00:30.000 -03:00 [INF] Mining at pool",
        ],
      },
    ],
    new Date("2026-06-28T12:00:00-03:00"),
  );

  assert.equal(summary.history.find((day) => day.isoDate === "2026-06-26").hours, 0.01);
  assert.equal(summary.history.find((day) => day.isoDate === "2026-06-27").hours, 0.02);
});

test("deduplicates duplicate mining timestamps", () => {
  const summary = calculateChoppingSummary(
    [
      {
        relativePath: "logs\\T-Rex\\duplicate-a.log",
        lines: ["2026-06-27 10:00:00.000 -03:00 [INF] Mining at pool"],
      },
      {
        relativePath: "logs\\T-Rex\\duplicate-b.log",
        lines: ["2026-06-27 10:00:00.000 -03:00 [INF] Mining at pool"],
      },
    ],
    new Date("2026-06-28T12:00:00-03:00"),
  );

  assert.equal(summary.signalCount, 1);
  assert.equal(summary.intervalCount, 1);
});

test("infers rig activity from all log modification timestamps", () => {
  const summary = calculateLogActivitySummary(
    [
      {
        relativePath: "logs\\ndm\\first.log",
        modifiedAt: "2026-06-27T10:00:00.000-03:00",
      },
      {
        relativePath: "logs\\systeminformation\\second.log",
        modifiedAt: "2026-06-27T10:05:00.000-03:00",
      },
      {
        relativePath: "logs\\ndm\\third.log",
        modifiedAt: "2026-06-27T11:00:00.000-03:00",
      },
    ],
    new Date("2026-06-28T12:00:00-03:00"),
  );

  assert.equal(summary.confidence, "inferred");
  assert.equal(summary.eventCount, 3);
  assert.equal(summary.sourceLogCount, 3);
  assert.equal(summary.intervalCount, 2);
  assert.equal(summary.rolling7DaysHours, 0.12);
});

test("calculates chopping summary from container workloads", () => {
  const summary = calculateChoppingSummary(
    [
      {
        relativePath: "logs\\SaladBowl\\service.log",
        lines: [
          "2026-06-27 10:00:00.000 -03:00 [INF] Workload Instance States:",
          "  \tcf9f8eb7: Running(Ready, Started) - StartedAt 2026-06-27T10:00:00 for 0s",
          "2026-06-27 10:00:30.000 -03:00 [INF] Workload Instance States:",
          "  \tcf9f8eb7: Running(Ready, Started) - StartedAt 2026-06-27T10:00:00 for 30s",
        ],
      },
    ],
    new Date("2026-06-28T12:00:00-03:00"),
  );

  assert.equal(summary.signalCount, 2);
  assert.equal(summary.intervalCount, 1);
  assert.equal(summary.history.find((day) => day.isoDate === "2026-06-27").hours, 0.09);
});
