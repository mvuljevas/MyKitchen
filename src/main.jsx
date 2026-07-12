import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import SimpleBar from "simplebar-react";
import {
  loadDashboardData,
  requestElevatedHelper,
  requestStoragePurge,
  requestSuiteShutdown,
  subscribeToEvents,
  applySaladControlAction,
} from "./api/dashboard.js";
import { emptyDashboard, starChefTargetHours } from "./data/emptyDashboard.js";
import "simplebar-react/dist/simplebar.min.css";
import "./styles.css";

const tabs = ["Overview", "Rig", "Live Monitor", "Coverage", "Machines", "Docs", "Settings"];
const refreshIntervalMs = 15000;
const chartRanges = [
  { label: "Day", days: 1 },
  { label: "Week", days: 7 },
  { label: "Month", days: 30 },
  { label: "Year", days: 365 },
];
const chartModes = ["Area", "Bars"];

function App() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [activeTab, setActiveTab] = useState("Overview");
  const [historyDays, setHistoryDays] = useState(7);
  const [chartMode, setChartMode] = useState("Area");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [storageResult, setStorageResult] = useState(null);
  const [storageAction, setStorageAction] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(null);
  const [weekStartDay, setWeekStartDay] = useState(() => {
    return localStorage.getItem("mykitchen_week_start_day") || "Friday";
  });
  const [dateRange, setDateRange] = useState(() => {
    return {
      type: "current-week",
      start: null,
      end: null,
    };
  });
  const refreshInFlightRef = useRef(false);

  const handleSetWeekStartDay = (day) => {
    localStorage.setItem("mykitchen_week_start_day", day);
    setWeekStartDay(day);
    setDateRange({
      type: "current-week",
      start: null,
      end: null,
    });
  };
  // Keep historyDays accessible inside the stable interval callback without
  // recreating the interval every time the range changes.
  const historyDaysRef = useRef(historyDays);
  historyDaysRef.current = historyDays;

  const {
    choppingHistory,
    hourlyHistory,
    choppingSummary,
    logActivity,
    rig,
    storage,
    status,
    workload,
    source,
    logs,
    error,
  } = dashboard;
  const starChef = choppingSummary.starChefEstimate;
  const coverage = choppingSummary.coverage ?? {};
  const machineLabel = formatMachineLabel(status.machine);

  // Slice the full 365-day array client-side so range switching is instant.
  // Day view uses hourly buckets (24 points) from the same payload.
  const visibleHistory = useMemo(() => {
    if (historyDays === 1) {
      return hourlyHistory;
    }
    return choppingHistory.slice(-historyDays);
  }, [choppingHistory, hourlyHistory, historyDays]);

  // Stable callback — never recreated, reads historyDays through the ref.
  const refreshDashboard = useCallback(async ({ background = false } = {}) => {
    if (refreshInFlightRef.current) {
      return;
    }

    refreshInFlightRef.current = true;
    if (!background) {
      setIsRefreshing(true);
    }

    try {
      setDashboard(await loadDashboardData({ days: historyDaysRef.current }));
      setLastRefreshedAt(new Date());
    } finally {
      refreshInFlightRef.current = false;
      setIsRefreshing(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function elevateHelper() {
    await requestElevatedHelper();
    setLiveEvents((events) => [
      ...events,
      {
        observedAt: new Date().toISOString(),
        source: "settings",
        level: "info",
        message: "Requested elevated helper through Windows UAC.",
      },
    ]);
  }

  async function stopSuite() {
    await requestSuiteShutdown();
    setLiveEvents((events) => [
      ...events,
      {
        observedAt: new Date().toISOString(),
        source: "settings",
        level: "info",
        message: "Requested managed suite shutdown.",
      },
    ]);
  }

  async function purgeStorage({ dryRun }) {
    const result = await requestStoragePurge({
      mode: "job-cache",
      dryRun,
    });
    setStorageResult(result);
    setStorageAction(null);
    await refreshDashboard();
  }

  async function handleSaladControl(action) {
    try {
      const res = await applySaladControlAction(action);
      setLiveEvents((events) => [
        ...events,
        {
          observedAt: new Date().toISOString(),
          source: "control",
          level: "info",
          message: `Salad control action: ${action} succeeded.`,
        },
      ]);
      await refreshDashboard();
    } catch (err) {
      setLiveEvents((events) => [
        ...events,
        {
          observedAt: new Date().toISOString(),
          source: "control",
          level: "error",
          message: `Salad control action: ${action} failed: ${err.message}`,
        },
      ]);
      alert(`Action failed: ${err.message}`);
    }
  }

  // Run once on mount: initial load + stable interval.
  // refreshDashboard is now stable (no deps), so this effect never re-runs
  // and the interval is never recreated unnecessarily.
  useEffect(() => {
    refreshDashboard();
    const refreshTimer = window.setInterval(() => {
      refreshDashboard({ background: true });
    }, refreshIntervalMs);

    return () => {
      // Clear the interval and release the in-flight guard so a pending
      // request from a previous render can't permanently block future ones.
      window.clearInterval(refreshTimer);
      refreshInFlightRef.current = false;
    };
  // refreshDashboard is intentionally stable — omit from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (source !== "helper") {
      return undefined;
    }

    return subscribeToEvents((event) => {
      setLiveEvents((events) => [...events, event].slice(-160));
    });
  }, [source]);

  const terminalEvents = useMemo(() => {
    if (liveEvents.length > 0) {
      return liveEvents;
    }

    return dashboard.recentEvents.map((event) => ({
      observedAt: event.time,
      source: event.source,
      message: event.message,
    }));
  }, [dashboard.recentEvents, liveEvents]);

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="MyKitchen navigation">
        <div className="brand-lockup">
          <img alt="" className="brand-mark" src="/mykitchen-logo.svg" />
          <div>
            <p className="eyebrow">MyKitchen</p>
            <h1>MyKitchen</h1>
          </div>
        </div>
        <nav className="sidebar-nav" aria-label="Dashboard sections">
          {tabs.map((tab) => (
            <button
              className={activeTab === tab ? "nav-item active" : "nav-item"}
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
            >
              <span>{tab}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <StatusBadge tone={source === "helper" ? "confirmed" : "warning"}>
            {source === "helper" ? "Helper connected" : "Helper offline"}
          </StatusBadge>
          <span>{machineLabel}</span>
        </div>
      </aside>

      <SimpleBar className="app-scroll">
        <main className="content-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Dashboard</p>
          <h1>Chopping cockpit</h1>
        </div>
        <div className="header-actions">
          <StatusBadge tone={source === "helper" ? "confirmed" : "warning"}>
            {source === "helper" ? "Helper connected" : "Helper offline"}
          </StatusBadge>
          <span className="refresh-indicator">
            {isRefreshing ? "Refreshing" : `Auto ${refreshIntervalMs / 1000}s`}
            {lastRefreshedAt ? ` · ${formatTerminalTime(lastRefreshedAt)}` : ""}
          </span>
        </div>
      </header>

      {source === "helper" && (
        <div className="quick-controls-bar" style={{ display: "flex", gap: "10px", margin: "-10px 0 20px 0", flexWrap: "wrap", background: "rgb(5 8 18 / 30%)", padding: "10px", borderRadius: "8px", border: "1px solid rgb(148 163 184 / 8%)" }}>
          <button
            className="secondary-button compact"
            type="button"
            onClick={() => handleSaladControl("start-salad")}
            style={{ margin: 0, fontSize: "12px", padding: "6px 12px" }}
          >
            🚀 Launch Salad
          </button>
          
          <button
            className="secondary-button compact"
            type="button"
            onClick={() => refreshDashboard(true)}
            style={{ margin: 0, fontSize: "12px", padding: "6px 12px" }}
          >
            🔄 Sync Data
          </button>

          {status.service?.detected ? (
            <button
              className="danger-button compact"
              type="button"
              onClick={() => handleSaladControl("stop-service")}
              style={{ margin: 0, fontSize: "12px", padding: "6px 12px" }}
            >
              🛑 Stop Service
            </button>
          ) : (
            <button
              className="primary-button compact"
              type="button"
              onClick={() => handleSaladControl("start-service")}
              style={{ margin: 0, fontSize: "12px", padding: "6px 12px" }}
            >
              🟢 Start Service
            </button>
          )}

          <button
            className="secondary-button compact"
            type="button"
            onClick={() => handleSaladControl("restart-service")}
            style={{ margin: 0, fontSize: "12px", padding: "6px 12px" }}
          >
            🔁 Restart Service
          </button>
          
          <button
            className="danger-button compact"
            type="button"
            onClick={() => stopSuite()}
            disabled={!dashboard.suite?.managed}
            style={{ margin: 0, fontSize: "12px", padding: "6px 12px" }}
          >
            🔌 Stop Suite
          </button>

          <button
            className="danger-button compact"
            type="button"
            onClick={() => {
              if (window.confirm("Are you sure you want to reboot the system? This will restart the rig immediately.")) {
                handleSaladControl("reboot-rig");
              }
            }}
            style={{ margin: 0, fontSize: "12px", padding: "6px 12px", marginLeft: "auto" }}
          >
            🖥️ Reboot Rig
          </button>
        </div>
      )}

      {error ? <p className="notice error">{error}</p> : null}

      {activeTab === "Overview" ? (
        <Overview
          coverage={coverage}
          chartMode={chartMode}
          history={visibleHistory}
          historyDays={historyDays}
          lastRefreshedAt={lastRefreshedAt}
          machineLabel={machineLabel}
          onChartModeChange={setChartMode}
          onRangeChange={setHistoryDays}
          starChef={starChef}
          status={status}
          summary={choppingSummary}
          logActivity={logActivity}
          workload={workload}
          weekStartDay={weekStartDay}
          dateRange={dateRange}
          onSetDateRange={setDateRange}
        />
      ) : null}

      {activeTab === "Rig" ? (
        <Rig
          rig={rig}
        />
      ) : null}

      {activeTab === "Live Monitor" ? (
        <LiveMonitor events={terminalEvents} source={source} />
      ) : null}

      {activeTab === "Coverage" ? (
        <Coverage
          coverage={coverage}
          logs={logs}
          logActivity={logActivity}
          summary={choppingSummary}
        />
      ) : null}

      {activeTab === "Machines" ? (
        <Machines report={dashboard.report} status={status} />
      ) : null}

      {activeTab === "Docs" ? <Docs storage={storage} /> : null}

      {activeTab === "Settings" ? (
        <Settings
          status={status}
          suite={dashboard.suite}
          storage={storage}
          storageResult={storageResult}
          onElevate={elevateHelper}
          onEstimateStorage={() => purgeStorage({ dryRun: true })}
          onOpenPurgeDialog={() => setStorageAction("job-cache")}
          onStopSuite={stopSuite}
          weekStartDay={weekStartDay}
          onSetWeekStartDay={handleSetWeekStartDay}
        />
      ) : null}

      <StorageCleanupDialog
        action={storageAction}
        onCancel={() => setStorageAction(null)}
        onConfirm={() => purgeStorage({ dryRun: false })}
        storage={storage}
      />
        </main>
      </SimpleBar>
    </div>
  );
}

function Overview({
  chartMode,
  coverage,
  history,
  historyDays,
  lastRefreshedAt,
  logActivity,
  machineLabel,
  onChartModeChange,
  onRangeChange,
  starChef,
  status,
  summary,
  workload,
  weekStartDay,
  dateRange,
  onSetDateRange,
}) {
  const activeRange = resolvePresetRange(dateRange.type, weekStartDay, dateRange.start, dateRange.end);
  const rangeHours = calculateHoursInRange(summary.intervals, activeRange.start, activeRange.end);
  const rangeProgress = Math.min(Math.round((rangeHours / 50) * 100), 100);
  const rangeRemaining = Math.max(50 - rangeHours, 0);
  const progressWidth = `${rangeProgress}%`;
  
  const chartActiveRange = chartRanges.find((range) => range.days === historyDays) ?? chartRanges[1];

  return (
    <>
      <section className="hero-chart-row" aria-label="Priority Chopping and interactive history row">
        <section className="hero-panel" aria-labelledby="priority-heading">
          <div className="hero-panel-top">
            <div>
              <p className="section-label">Current work</p>
              <h2 id="priority-heading">{formatWorkloadLabel(workload)}</h2>
            </div>
            <StatusBadge tone={workload.confidence === "confirmed" ? "confirmed" : "warning"}>
              {workload.confidence}
            </StatusBadge>
          </div>
          <p className="hero-metric">{rangeHours.toFixed(2)}h</p>
          
          <div className="hero-panel-datepicker-row">
            <p className="hero-caption" style={{ margin: 0 }}>
              Confirmed hours:
            </p>
            <DatePickerPopover
              weekStartDay={weekStartDay}
              dateRange={dateRange}
              onChange={onSetDateRange}
            />
          </div>

          <div className="progress-track priority" aria-label="Estimated Star Chef progress" style={{ marginTop: "8px" }}>
            <span style={{ width: progressWidth }} />
          </div>
          <div className="hero-foot">
            <span>{rangeProgress}% Star Chef estimate</span>
            <span>{rangeRemaining.toFixed(1)}h to {starChefTargetHours}h</span>
          </div>
        </section>

        <section className="panel chart-panel priority-chart" aria-labelledby="history-heading" style={{ margin: 0 }}>
          <div className="panel-heading">
            <div>
              <p className="section-label">Interactive graph</p>
              <h2 id="history-heading">{chartActiveRange.label} Chopping history</h2>
            </div>
            <div className="chart-controls" aria-label="Chart controls">
              <div className="segmented-control">
                {chartModes.map((mode) => (
                  <button
                    className={chartMode === mode ? "segment active" : "segment"}
                    key={mode}
                    type="button"
                    onClick={() => onChartModeChange(mode)}
                  >
                    {mode}
                  </button>
                ))}
              </div>
              <div className="segmented-control">
                {chartRanges.map((range) => (
                  <button
                    className={historyDays === range.days ? "segment active" : "segment"}
                    key={range.days}
                    type="button"
                    onClick={() => onRangeChange(range.days)}
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <ChoppingChart data={history} mode={chartMode} />
        </section>
      </section>

      <section className="metric-grid">
        <MetricCard
          label="Last 24 hours"
          value={`${summary.last24Hours.toFixed(2)}h`}
          detail="Live 24h parser window"
        />

        <MetricCard
          label="Rolling window"
          value={`${summary.rolling7DaysHours.toFixed(1)}h`}
          detail={`${summary.signalCount} signals · ${summary.intervalCount} intervals`}
        />

        <MetricCard
          label="Salad process"
          value={status.process.label}
          detail={status.service?.label ?? "Service status unknown"}
        />

        <MetricCard
          label="Last update"
          value={lastRefreshedAt ? formatTerminalTime(lastRefreshedAt) : "Pending"}
          detail={machineLabel}
        />
      </section>

      <section className="bottom-grid">
        <ServerTimeComparison weekStartDay={weekStartDay} />

        <aside className="panel side-panel" aria-labelledby="truth-heading">
          <p className="section-label">Fidelity</p>
          <h2 id="truth-heading">Source-labelled truth</h2>
          <p className="body-copy">{starChef.note}</p>
          <p className="body-copy">
            Rig log activity is shown separately because log writes prove local
            Salad activity, while Star Chef progress uses confirmed Chopping
            signals.
          </p>
          <dl className="definition-list">
            <div>
              <dt>Machine</dt>
              <dd>{machineLabel}</dd>
            </div>
            <div>
              <dt>Logs scanned</dt>
              <dd>
                {coverage.scannedLogCount ?? coverage.parsedLogCount ?? 0} of{" "}
                {coverage.logCount ?? 0}
              </dd>
            </div>
            <div>
              <dt>Last signal</dt>
              <dd>{formatDateTime(summary.lastSignalAt)}</dd>
            </div>
            <div>
              <dt>Salad process</dt>
              <dd>{status.process.label}</dd>
            </div>
            <div>
              <dt>Rig app activity</dt>
              <dd>{logActivity.rolling7DaysHours.toFixed(1)}h, not earnings credit</dd>
            </div>
          </dl>
        </aside>
      </section>
    </>
  );
}

function WorkSignal({ detail, label, value }) {
  return (
    <article className="work-signal">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}

function LiveMonitor({ events, source }) {
  const terminalRef = useRef(null);

  useEffect(() => {
    terminalRef.current?.scrollTo?.({
      top: terminalRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [events]);

  return (
    <section className="panel terminal-panel">
      <div className="panel-heading">
        <div>
          <p className="section-label">Live monitor</p>
          <h2>Terminal stream</h2>
        </div>
        <StatusBadge tone={source === "helper" ? "confirmed" : "warning"}>
          {source === "helper" ? "Streaming" : "Waiting for helper"}
        </StatusBadge>
      </div>
      <SimpleBar className="terminal" scrollableNodeProps={{ ref: terminalRef }}>
        {events.length === 0 ? (
          <TerminalLine
            event={{
              observedAt: new Date().toISOString(),
              source: "system",
              message: "No events yet. Start the helper or refresh the dashboard.",
            }}
          />
        ) : (
          events.map((event, index) => (
            <TerminalLine event={event} key={`${event.observedAt}-${index}`} />
          ))
        )}
      </SimpleBar>
    </section>
  );
}

function Rig({ rig }) {
  const primaryGpu = rig.gpus.find((gpu) => gpu.vendor === "nvidia") ?? rig.gpus[0];

  return (
    <>
      <section className="metric-grid" aria-label="Rig readiness">
        <MetricCard
          label="Readiness score"
          value={`${rig.optimization.score}/100`}
          detail={rig.optimization.summary}
          tone={rig.optimization.score >= 80 ? "positive" : "neutral"}
        />
        <MetricCard
          label="CPU"
          value={`${rig.cpu.logicalProcessors ?? "?"} threads`}
          detail={rig.cpu.name}
          tone="neutral"
        />
        <MetricCard
          label="Memory"
          value={`${rig.memory.installedGb || rig.memory.totalGb} GB`}
          detail={`${rig.memory.totalGb} GB usable by Windows`}
          tone={(rig.memory.installedGb || rig.memory.totalGb) >= 32 ? "positive" : "neutral"}
        />
        <MetricCard
          label="Primary GPU"
          value={primaryGpu?.name ?? "Unknown"}
          detail={primaryGpu?.memoryMb ? `${primaryGpu.memoryMb} MB VRAM` : "No telemetry"}
          tone={primaryGpu?.vendor === "nvidia" ? "positive" : "neutral"}
        />
      </section>

      <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="section-label">Rig configuration</p>
              <h2>Windows, Salad, WSL, and GPU</h2>
            </div>
            <StatusBadge tone={rig.salad.serviceDetected ? "confirmed" : "warning"}>
              {rig.salad.serviceDetected ? "Bowl service active" : "Service not detected"}
            </StatusBadge>
          </div>

          <dl className="definition-list split">
            <div>
              <dt>Machine</dt>
              <dd>
                {rig.windows.manufacturer} {rig.windows.model}
              </dd>
            </div>
            <div>
              <dt>Windows</dt>
              <dd>
                {rig.windows.name} · {rig.windows.architecture}
              </dd>
            </div>
            <div>
              <dt>Power plan</dt>
              <dd>{rig.power.name}</dd>
            </div>
            <div>
              <dt>Virtualization</dt>
              <dd>
                {rig.virtualization.hypervisorPresent ? "Hypervisor present" : "Hypervisor not detected"}
              </dd>
            </div>
            <div>
              <dt>Salad WSL</dt>
              <dd>
                {rig.virtualization.saladDistro?.name ?? "salad-enterprise-linux"} ·{" "}
                {rig.virtualization.saladDistro?.state ?? "unknown"}
              </dd>
            </div>
            <div>
              <dt>Salad processes</dt>
              <dd>
                {rig.salad.processCount} Salad · {rig.salad.workloadProcessCount} workload
              </dd>
            </div>
          </dl>

          <div className="gpu-list">
            {rig.gpus.map((gpu) => (
              <article className="gpu-row" key={`${gpu.name}-${gpu.driverVersion}`}>
                <div>
                  <strong>{gpu.name}</strong>
                  <span>
                    {gpu.vendor} · {gpu.type} · driver {gpu.driverVersion ?? "unknown"}
                  </span>
                </div>
                <div>
                  <strong>{gpu.memoryMb ? `${gpu.memoryMb} MB` : "Unknown"}</strong>
                  <span>
                    {gpu.telemetry
                      ? `${gpu.telemetry.temperatureC ?? "?"}C · ${gpu.telemetry.utilizationPercent ?? "?"}% util · ${gpu.telemetry.defaultPowerLimitW ?? "?"}W default`
                      : "No live telemetry"}
                  </span>
                </div>
              </article>
            ))}
          </div>
      </section>
    </>
  );
}

function TerminalLine({ event }) {
  const type = event.source ?? inferEventType(event);

  return (
    <div className={`terminal-line ${type}`}>
      <time>{formatTerminalTime(event.observedAt)}</time>
      <span className="terminal-type">{type}</span>
      <span>{formatEventMessage(event)}</span>
    </div>
  );
}

function Coverage({ coverage, logs, logActivity, summary }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="section-label">Coverage</p>
          <h2>Local evidence and retention</h2>
        </div>
        <StatusBadge tone={summary.confidence}>{summary.confidence}</StatusBadge>
      </div>
      <div className="metric-grid compact">
        <MetricCard label="Logs found" value={String(coverage.logCount ?? logs.length)} />
        <MetricCard
          label="Logs scanned"
          value={String(coverage.scannedLogCount ?? coverage.parsedLogCount ?? 0)}
          detail="Readable logs included in parser pass"
        />
        <MetricCard
          label="Logs with signals"
          value={String(coverage.signalLogCount ?? summary.sourceLogCount ?? 0)}
          detail={`${summary.signalCount} activity signals`}
        />
        <MetricCard
          label="Unreadable logs"
          value={String(coverage.unreadableLogCount ?? 0)}
          detail="Usually permissions or file locks"
        />
      </div>
      <div className="metric-grid compact">
        <MetricCard label="Newest log" value={formatDateTime(coverage.newestLogAt)} />
        <MetricCard label="Oldest log" value={formatDateTime(coverage.oldestLogAt)} />
        <MetricCard label="Intervals" value={String(summary.intervalCount)} />
        <MetricCard label="Confidence" value={summary.confidence} />
        <MetricCard
          label="Rig activity intervals"
          value={String(logActivity.intervalCount)}
          detail={logActivity.confidence}
        />
        <MetricCard
          label="Rig activity 7 days"
          value={`${logActivity.rolling7DaysHours.toFixed(1)}h`}
          detail="Inferred, not Star Chef credit"
        />
      </div>
      <p className="body-copy">{coverage.retentionNote}</p>
      <p className="body-copy">{logActivity.note}</p>
      {coverage.readErrorSamples?.length > 0 ? (
        <SimpleBar className="log-errors">
          <h3>Unreadable log samples</h3>
          <ul>
            {coverage.readErrorSamples.map((error) => (
              <li key={error.relativePath}>
                <strong>{error.relativePath}</strong>
                <span>{error.error}</span>
              </li>
            ))}
          </ul>
        </SimpleBar>
      ) : null}
    </section>
  );
}

function Machines({ report, status }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="section-label">Machines</p>
          <h2>Local report</h2>
        </div>
      </div>
      <div className="metric-grid compact">
        <MetricCard label="Current machine" value={status.machine?.hostname ?? "This PC"} />
        <MetricCard
          label="Salad RIG ID"
          value={status.machine?.saladId ?? "Not exposed locally"}
          detail={
            status.machine?.saladId
              ? "Read from Salad evidence"
              : `Local fallback ${status.machine?.localId ?? status.machine?.id ?? "unknown"}`
          }
        />
        <MetricCard label="Report export" value={report ? "Available" : "Unavailable"} />
        <MetricCard label="Multi-PC total" value="Not enabled" detail="Import is a later block" />
      </div>
    </section>
  );
}

function Docs({ storage }) {
  return (
    <section className="panel docs-panel">
      <div className="panel-heading">
        <div>
          <p className="section-label">Docs</p>
          <h2>Salad storage behavior</h2>
        </div>
        <StatusBadge tone={storage.allocated.sizeGb > 20 ? "warning" : "confirmed"}>
          Local finding
        </StatusBadge>
      </div>

      <div className="doc-grid">
        <article className="doc-block">
          <p className="section-label">This rig</p>
          <h3>Observed disk allocation</h3>
          <p>
            Salad is using about <strong>{storage.totalGb.toFixed(2)} GB</strong> on this
            machine. Almost all of it is allocated in{" "}
            <code>{storage.allocated.path}</code>, currently about{" "}
            <strong>{storage.allocated.sizeGb.toFixed(2)} GB</strong>.
          </p>
          <p>
            Download cleanup is currently estimated at{" "}
            <strong>{storage.purge.safeGb.toFixed(3)} GB</strong>. Total explicit
            job-cache cleanup is estimated at{" "}
            <strong>{storage.purge.jobCacheGb.toFixed(3)} GB</strong>.
          </p>
          <p>
            Workload storage is split into{" "}
            <strong>{storage.workloadStorage.downloadsGb.toFixed(3)} GB</strong> of
            downloads/cache,{" "}
            <strong>{storage.workloadStorage.currentGb.toFixed(3)} GB</strong> of
            recent workload packages, and{" "}
            <strong>{storage.workloadStorage.obsoleteGb.toFixed(3)} GB</strong> of
            obsolete workload packages.
          </p>
        </article>

        <article className="doc-block">
          <p className="section-label">Why it happens</p>
          <h3>WSL VHDX grows with container work</h3>
          <p>
            Salad container jobs require WSL and virtualization. Microsoft
            documents that WSL 2 stores each Linux distribution inside an
            `ext4.vhdx` virtual disk that expands as storage is needed. That
            means deleting files inside the Linux environment does not always
            make Windows immediately recover the same amount of host disk space.
          </p>
          <p>
            Salad also documents that some workloads require enough free storage
            and that many container workloads may need around 100 GB available.
          </p>
        </article>

        <article className="doc-block danger-doc">
          <p className="section-label">Cleanup boundary</p>
          <h3>What does MyKitchen purge?</h3>
          <p>
            MyKitchen cleanup is intentionally narrow. It purges explicit job
            cache folders under <code>workloads</code>, such as downloaded job
            archives and named cache/temp folders.
          </p>
          <p>
            It does not delete logs, boot logs, WSL runtime storage, rig
            configuration, or workload package folders just because they are
            old. Those files can be needed for Salad to keep working or for
            MyKitchen to validate local activity.
          </p>
          <p>
            Log deletion is not part of storage cleanup. If log deletion is ever
            added, it should live behind a separate, explicit feature because
            <strong> no se puede revertir</strong>.
          </p>
        </article>

        <article className="doc-block">
          <p className="section-label">Sources</p>
          <h3>Original references</h3>
          <ul className="source-list">
            <li>
              <a
                href="https://support.salad.com/troubleshooting/container-jobs/container-workloads-troubleshooting/"
                rel="noreferrer"
                target="_blank"
              >
                Salad container troubleshooting
              </a>
              <span>Container jobs, WSL update, virtualization, free disk space.</span>
            </li>
            <li>
              <a
                href="https://support.salad.com/guides/using-salad/chopping-power/"
                rel="noreferrer"
                target="_blank"
              >
                Salad Chopping Power
              </a>
              <span>WSL/virtualization readiness and storage as job availability signals.</span>
            </li>
            <li>
              <a
                href="https://learn.microsoft.com/windows/wsl/disk-space"
                rel="noreferrer"
                target="_blank"
              >
                Microsoft WSL disk space
              </a>
              <span>WSL 2 `ext4.vhdx` behavior, disk location, and resizing.</span>
            </li>
          </ul>
        </article>
      </div>
    </section>
  );
}

function Settings({
  status,
  storage,
  storageResult,
  suite,
  onElevate,
  onEstimateStorage,
  onOpenPurgeDialog,
  onStopSuite,
  weekStartDay,
  onSetWeekStartDay,
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="section-label">Settings</p>
          <h2>Helper permissions</h2>
        </div>
        <StatusBadge tone={status.elevation?.isAdmin ? "confirmed" : "warning"}>
          {status.elevation?.level ?? "unknown"}
        </StatusBadge>
      </div>
      <p className="body-copy">
        On Windows, the local suite and helper are expected to run elevated so
        Salad process paths, WSL details, service metadata, and hardware state
        stay visible. If this session is not elevated, request UAC relaunch.
      </p>
      <div className="metric-grid compact">
        <MetricCard
          label="Managed suite"
          value={suite.managed ? "Active" : "Unavailable"}
          detail={suite.pid ? `PID ${suite.pid}` : "No shutdown handler registered"}
          tone={suite.managed ? "positive" : "neutral"}
        />
        <MetricCard
          label="Elevated relaunch"
          value={suite.elevatedRelaunch ? "Yes" : "No"}
          detail="Hidden process managed by the app"
          tone={suite.elevatedRelaunch ? "positive" : "neutral"}
        />
      </div>
      <button className="primary-button" type="button" onClick={onElevate}>
        Relaunch helper as administrator
      </button>
      <button
        className="secondary-button"
        type="button"
        onClick={onStopSuite}
        disabled={!suite.managed}
      >
        Stop managed suite
      </button>
      <section className="settings-section">
        <p className="section-label">Storage</p>
        <h2>Salad disk usage and cleanup</h2>
        <div className="metric-grid compact">
          <MetricCard
            label="Total Salad storage"
            value={`${storage.totalGb.toFixed(1)} GB`}
            detail={storage.installPath}
          />
          <MetricCard
            label="Allocated WSL space"
            value={`${storage.allocated.sizeGb.toFixed(1)} GB`}
            detail="Container job disk image"
            tone={storage.allocated.sizeGb > 20 ? "warning" : "neutral"}
          />
          <MetricCard
            label="Safe cleanup"
            value={`${storage.purge.safeGb.toFixed(2)} GB`}
            detail="Downloaded job cache"
          />
          <MetricCard
            label="Job cache"
            value={`${storage.purge.jobCacheGb.toFixed(2)} GB`}
            detail="Downloads and explicit cache folders"
          />
          <MetricCard
            label="Recent workloads"
            value={`${storage.workloadStorage.currentGb.toFixed(2)} GB`}
            detail={`${storage.workloadStorage.packageCount - storage.workloadStorage.obsoletePackageCount} recent package(s)`}
          />
          <MetricCard
            label="Obsolete workloads"
            value={`${storage.workloadStorage.obsoleteGb.toFixed(2)} GB`}
            detail={`${storage.workloadStorage.obsoletePackageCount} stale package(s)`}
          />
        </div>
        <p className="body-copy">{storage.allocated.explanation}</p>
        <p className="body-copy">
          Allocated path: <code>{storage.allocated.path}</code>
        </p>
        <p className="notice">
          Cleanup is limited to job cache under <code>{storage.workloadStorage.path}</code>.
          It does not delete logs, WSL runtime storage, rig configuration, or workload package
          folders just because they are old.
        </p>
        <div className="storage-actions">
          <button className="secondary-button" type="button" onClick={onEstimateStorage}>
            Estimate job cache
          </button>
          <button className="danger-button" type="button" onClick={onOpenPurgeDialog}>
            Purge job cache
          </button>
        </div>
        {storageResult ? (
          <p className="notice">
            {storageResult.message ??
              `${storageResult.dryRun ? "Estimated" : "Selected"} ${storageResult.selectedGb ?? 0} GB across ${storageResult.results?.length ?? 0} candidate(s).`}
          </p>
        ) : null}
        <SimpleBar className="storage-list">
          {storage.categories.map((category) => (
            <article className="storage-row" key={category.path}>
              <div>
                <strong>{category.name}</strong>
                <span>
                  {category.type} · {category.protected ? "protected" : "cleanup-aware"}
                </span>
              </div>
              <strong>{category.sizeGb.toFixed(3)} GB</strong>
            </article>
          ))}
        </SimpleBar>
      <section className="settings-section" style={{ borderTop: "1px solid rgb(148 163 184 / 12%)", paddingTop: "20px", marginTop: "20px" }}>
        <p className="section-label">Salad Week Calendar</p>
        <h2>Week configuration</h2>
        <p className="body-copy">
          Configure the start day for the weekly Star Chef qualification window. Salad status updates typically roll out on Thursdays or Fridays.
        </p>
        <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "12px" }}>
          <label htmlFor="week-start-select" style={{ fontSize: "13px", fontWeight: "700", color: "#9ba8b8" }}>
            Week starts on:
          </label>
          <select
            id="week-start-select"
            value={weekStartDay}
            onChange={(e) => onSetWeekStartDay(e.target.value)}
            style={{
              background: "#0f172a",
              border: "1px solid rgb(148 163 184 / 20%)",
              color: "#fbfff8",
              borderRadius: "4px",
              padding: "6px 12px",
              fontSize: "13px",
              fontWeight: "700",
            }}
          >
            {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => (
              <option key={day} value={day}>
                {day}
              </option>
            ))}
          </select>
        </div>
      </section>
      </section>
    </section>
  );
}

function StorageCleanupDialog({ action, onCancel, onConfirm, storage }) {
  if (!action) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
      role="presentation"
    >
      <section
        aria-labelledby="storage-cleanup-title"
        aria-modal="true"
        className="w-full max-w-xl rounded-lg border border-amber-400/30 bg-slate-950 p-6 text-slate-100 shadow-2xl shadow-black/50"
        role="dialog"
      >
        <p className="mb-2 text-xs font-black uppercase tracking-normal text-lime-300">
          Storage cleanup
        </p>
        <h2 id="storage-cleanup-title" className="mb-3 text-2xl font-black text-white">
          Purge job cache only?
        </h2>
        <p className="mb-4 leading-7 text-slate-300">
          This removes explicit job cache folders under{" "}
          <code className="rounded bg-slate-900 px-1.5 py-0.5 text-lime-200">
            {storage.workloadStorage.path}
          </code>
          . Logs, boot logs, WSL runtime storage, rig configuration, and workload package folders
          are excluded.
        </p>
        <div className="mb-5 grid gap-3 rounded-lg border border-slate-700 bg-slate-900/80 p-4 sm:grid-cols-2">
          <div>
            <span className="block text-sm font-bold text-slate-400">Estimated cache</span>
            <strong className="mt-1 block text-2xl text-lime-300">
              {storage.purge.jobCacheGb.toFixed(2)} GB
            </strong>
          </div>
          <div>
            <span className="block text-sm font-bold text-slate-400">Candidates</span>
            <strong className="mt-1 block text-2xl text-white">
              {storage.purge.candidates.length}
            </strong>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-3">
          <button
            className="rounded-md border border-slate-600 bg-slate-800 px-4 py-2 font-black text-slate-100 hover:bg-slate-700"
            type="button"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-lime-300 px-4 py-2 font-black text-slate-950 hover:bg-lime-200"
            type="button"
            onClick={onConfirm}
          >
            Purge job cache
          </button>
        </div>
      </section>
    </div>
  );
}

function MetricCard({ label, value, detail, tone = "neutral" }) {
  return (
    <article className={`metric-card ${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      {detail ? <span>{detail}</span> : null}
    </article>
  );
}

function StatusBadge({ children, tone = "neutral" }) {
  return <span className={`status-badge ${tone}`}>{children}</span>;
}

function ChoppingChart({ data, mode }) {
  if (data.length === 0) {
    return <p className="empty-state">No local log history is available yet.</p>;
  }

  const chartData = data.map((item) => ({
    ...item,
    label: item.date,
    hours: Number(item.hours.toFixed(2)),
  }));

  return (
    <div className="chart" role="img" aria-label="Interactive Chopping hours chart">
      {/* Use an explicit pixel height so ResponsiveContainer always gets a
          non-zero measurement regardless of the parent's min-height rule. */}
      <ResponsiveContainer height="100%" width="100%">
        {mode === "Bars" ? (
          <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
            <XAxis dataKey="label" stroke="#7d8b9f" tickLine={false} tickMargin={10} />
            <YAxis stroke="#7d8b9f" tickFormatter={(value) => `${value}h`} tickLine={false} tickMargin={10} />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(158, 240, 178, 0.08)" }} />
            <Bar dataKey="hours" fill="#8cf5a1" radius={[6, 6, 0, 0]} />
          </BarChart>
        ) : (
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 5 }}>
            <CartesianGrid stroke="rgba(148, 163, 184, 0.14)" vertical={false} />
            <XAxis dataKey="label" stroke="#7d8b9f" tickLine={false} tickMargin={10} />
            <YAxis stroke="#7d8b9f" tickFormatter={(value) => `${value}h`} tickLine={false} tickMargin={10} />
            <Tooltip content={<ChartTooltip />} />
            <Area
              activeDot={{ r: 5, stroke: "#fbfff8", strokeWidth: 2 }}
              dataKey="hours"
              fill="rgba(74, 222, 128, 0.18)"
              stroke="#8cf5a1"
              strokeWidth={3}
              type="monotone"
            />
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({ active, label, payload }) {
  if (!active || !payload?.length) {
    return null;
  }

  return (
    <div className="chart-tooltip">
      <strong>{label}</strong>
      <span>{Number(payload[0].value).toFixed(2)}h confirmed</span>
    </div>
  );
}

function formatDateTime(value) {
  if (!value) {
    return "Unknown";
  }

  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(timestamp);
}

function formatTerminalTime(value) {
  const timestamp = new Date(value);

  if (Number.isNaN(timestamp.getTime())) {
    return "--:--:--";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);
}

function inferEventType(event) {
  if (event.parser) {
    return "parser";
  }

  if (event.workload) {
    return "job";
  }

  return "system";
}

function formatEventMessage(event) {
  if (event.message) {
    return event.message;
  }

  if (event.parser) {
    return `${event.parser.totalHours.toFixed(2)}h confirmed · ${event.parser.signalCount} signals · ${event.logActivity?.rolling7DaysHours?.toFixed?.(2) ?? "0.00"}h rig activity · ${event.workload?.label ?? "unknown workload"}`;
  }

  return "Observation received";
}

function formatWorkloadLabel(workload) {
  if (workload.type === "mining" || workload.type === "historical-mining") {
    const family = workload.label.match(/\(([^)]+)\)/)?.[1] ?? "GPU";
    return `Mining\u00a0(${family})`;
  }

  if (workload.type === "container") {
    return "Container job";
  }

  if (workload.type === "bandwidth") {
    return "Bandwidth job";
  }

  return workload.label ?? "Unknown";
}

function formatMachineLabel(machine) {
  const hostname = machine?.hostname ?? "This PC";
  const saladId = machine?.saladId;

  if (saladId) {
    return `${hostname} · Salad ${saladId}`;
  }

  return `${hostname} · local fallback ${machine?.localId ?? machine?.id ?? "unknown"}`;
}

function describeWorkload(workload) {
  if (workload.type === "mining" || workload.type === "historical-mining") {
    return `GPU proof-of-work workload · ${workload.confidence}`;
  }

  if (workload.type === "container") {
    return `WSL/container compute workload · ${workload.confidence}`;
  }

  if (workload.type === "bandwidth") {
    return `Network bandwidth sharing · ${workload.confidence}`;
  }

  return `${workload.source} · ${workload.confidence}`;
}

function extractEstimatedEarnings(summary) {
  const candidates = [
    summary.estimatedEarningsUsd,
    summary.estimatedEarnedUsd,
    summary.earningsUsd,
    summary.rewardsUsd,
    summary.saladBowl?.estimatedEarningsUsd,
    summary.saladBowl?.earningsUsd,
    summary.saladBowl?.balanceUsd,
  ];
  const amount = candidates.find((value) => Number.isFinite(Number(value)));

  if (amount === undefined) {
    return {
      value: "Not available",
      detail: "No earnings field is exposed by the current helper payload.",
    };
  }

  return {
    value: new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(Number(amount)),
    detail: "Extracted from SaladBowl payload.",
  };
}

// Helper functions for date operations and week ranges
function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addHours(date, hours) {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
}

function getSaladWeekRange(now, startDayName) {
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetDayIndex = daysOfWeek.indexOf(startDayName);
  
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  
  let currentDayIndex = start.getDay();
  let diff = currentDayIndex - targetDayIndex;
  if (diff < 0) {
    diff += 7;
  }
  start.setDate(start.getDate() - diff);
  
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  
  return { start, end };
}

function resolvePresetRange(type, weekStartDay, customStart, customEnd) {
  const now = new Date();
  
  if (type === "current-week") {
    return getSaladWeekRange(now, weekStartDay);
  }
  
  if (type === "previous-week") {
    const current = getSaladWeekRange(now, weekStartDay);
    const start = addDays(current.start, -7);
    const end = addDays(current.end, -7);
    return { start, end };
  }
  
  if (type === "last-7-days") {
    const end = new Date(now);
    const start = addDays(end, -6);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }
  
  return { start: customStart ? new Date(customStart) : new Date(), end: customEnd ? new Date(customEnd) : new Date() };
}

function calculateHoursInRange(intervals = [], start, end) {
  let totalMs = 0;
  const startMs = start.getTime();
  const endMs = end.getTime();
  
  for (const interval of intervals) {
    const intStart = new Date(interval.start).getTime();
    const intEnd = new Date(interval.end).getTime();
    
    const overlapStart = Math.max(intStart, startMs);
    const overlapEnd = Math.min(intEnd, endMs);
    
    if (overlapEnd > overlapStart) {
      totalMs += (overlapEnd - overlapStart);
    }
  }
  
  return totalMs / 3600000;
}

function getNextResetTime(weekStartDayName) {
  const daysOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetDayIndex = daysOfWeek.indexOf(weekStartDayName);
  
  const now = new Date();
  const nextReset = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0, 0, 0, 0
  ));
  
  let currentDayIndex = nextReset.getUTCDay();
  let diff = targetDayIndex - currentDayIndex;
  if (diff <= 0) {
    diff += 7;
  }
  nextReset.setUTCDate(nextReset.getUTCDate() + diff);
  return nextReset;
}

// DatePickerPopover Component
function DatePickerPopover({ weekStartDay, dateRange, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [tempStart, setTempStart] = useState(dateRange.start);
  const [tempEnd, setTempEnd] = useState(dateRange.end);
  
  useEffect(() => {
    function handleClickOutside(event) {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (dateRange.type === "custom") {
      setTempStart(dateRange.start);
      setTempEnd(dateRange.end);
    } else {
      const resolved = resolvePresetRange(dateRange.type, weekStartDay);
      setTempStart(resolved.start);
      setTempEnd(resolved.end);
    }
  }, [dateRange, weekStartDay]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay();
  
  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };
  
  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };
  
  const selectPreset = (type) => {
    const resolved = resolvePresetRange(type, weekStartDay);
    onChange({ type, start: resolved.start, end: resolved.end });
    setIsOpen(false);
  };
  
  const handleDayClick = (dayNum) => {
    const clickedDate = new Date(year, month, dayNum);
    
    if (!tempStart || (tempStart && tempEnd)) {
      setTempStart(clickedDate);
      setTempEnd(null);
    } else if (tempStart && !tempEnd) {
      if (clickedDate >= tempStart) {
        setTempEnd(clickedDate);
      } else {
        setTempStart(clickedDate);
        setTempEnd(null);
      }
    }
  };
  
  const handleApply = () => {
    if (tempStart && tempEnd) {
      const finalEnd = new Date(tempEnd);
      finalEnd.setHours(23, 59, 59, 999);
      onChange({ type: "custom", start: tempStart, end: finalEnd });
      setIsOpen(false);
    }
  };

  const getDayClass = (dayNum) => {
    const date = new Date(year, month, dayNum);
    date.setHours(0, 0, 0, 0);
    const dateMs = date.getTime();
    
    const startMs = tempStart ? new Date(tempStart).setHours(0, 0, 0, 0) : null;
    const endMs = tempEnd ? new Date(tempEnd).setHours(0, 0, 0, 0) : null;
    
    let classes = "calendar-day";
    if (startMs && dateMs === startMs) {
      classes += " selected";
    } else if (endMs && dateMs === endMs) {
      classes += " selected";
    } else if (startMs && endMs && dateMs > startMs && dateMs < endMs) {
      classes += " in-range";
    }
    return classes;
  };
  
  const formatRangeLabel = () => {
    const { type, start, end } = dateRange;
    
    let label = "Current Salad Week";
    if (type === "previous-week") label = "Previous Salad Week";
    if (type === "last-7-days") label = "Last 7 Days";
    if (type === "custom") label = "Custom Range";
    
    if (!start || !end) {
      const resolved = resolvePresetRange(type, weekStartDay);
      return `${label} (${formatShortDate(resolved.start)} - ${formatShortDate(resolved.end)})`;
    }
    
    return `${label} (${formatShortDate(start)} - ${formatShortDate(end)})`;
  };
  
  const formatShortDate = (d) => {
    return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric" }).format(new Date(d));
  };
  
  const weekdays = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
  const calendarDays = [];
  
  for (let i = 0; i < firstDayIndex; i++) {
    calendarDays.push(<div key={`empty-${i}`} className="calendar-day-empty" />);
  }
  
  for (let d = 1; d <= daysInMonth; d++) {
    calendarDays.push(
      <button
        key={`day-${d}`}
        type="button"
        className={getDayClass(d)}
        onClick={() => handleDayClick(d)}
      >
        {d}
      </button>
    );
  }

  return (
    <div className="datepicker-container" ref={containerRef}>
      <button
        type="button"
        className="datepicker-trigger"
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>📅 {formatRangeLabel()}</span>
        <span style={{ fontSize: "10px", marginLeft: "4px" }}>▼</span>
      </button>
      
      {isOpen && (
        <div className="datepicker-popover">
          <div className="datepicker-presets">
            <button
              type="button"
              className={`preset-button ${dateRange.type === "current-week" ? "active" : ""}`}
              onClick={() => selectPreset("current-week")}
            >
              Current Salad Week
            </button>
            <button
              type="button"
              className={`preset-button ${dateRange.type === "previous-week" ? "active" : ""}`}
              onClick={() => selectPreset("previous-week")}
            >
              Previous Salad Week
            </button>
            <button
              type="button"
              className={`preset-button ${dateRange.type === "last-7-days" ? "active" : ""}`}
              onClick={() => selectPreset("last-7-days")}
            >
              Last 7 Days
            </button>
            <button
              type="button"
              className={`preset-button ${dateRange.type === "custom" ? "active" : ""}`}
              onClick={() => {
                setTempStart(dateRange.start || new Date());
                setTempEnd(null);
              }}
            >
              Custom Range
            </button>
          </div>
          
          <div className="datepicker-calendar-panel">
            <div className="calendar-header">
              <button type="button" className="calendar-nav-btn" onClick={handlePrevMonth}>
                ◀
              </button>
              <span className="calendar-month-title">
                {currentMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
              </span>
              <button type="button" className="calendar-nav-btn" onClick={handleNextMonth}>
                ▶
              </button>
            </div>
            
            <div className="calendar-grid">
              {weekdays.map((wd) => (
                <div key={wd} className="calendar-weekday">
                  {wd}
                </div>
              ))}
              {calendarDays}
            </div>
            
            <div className="datepicker-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="primary-button"
                disabled={!tempStart || !tempEnd}
                onClick={handleApply}
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ServerTimeComparison Component
function ServerTimeComparison({ weekStartDay }) {
  const [times, setTimes] = useState({
    utc: new Date(),
    local: new Date(),
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimes({
        utc: new Date(),
        local: new Date(),
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatClockTime = (d, isUtc) => {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: isUtc ? "UTC" : undefined,
      hour12: false,
    }).format(d);
  };

  const formatClockDate = (d, isUtc) => {
    return new Intl.DateTimeFormat(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone: isUtc ? "UTC" : undefined,
    }).format(d);
  };

  const getResetCountdown = () => {
    const nextReset = getNextResetTime(weekStartDay);
    const now = new Date();
    const diffMs = nextReset.getTime() - now.getTime();
    if (diffMs <= 0) return "Resetting...";

    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0 || days > 0) parts.push(`${hours}h`);
    parts.push(`${minutes}m`);

    return parts.join(" ");
  };

  const localOffset = -new Date().getTimezoneOffset() / 60;
  const offsetLabel = `UTC${localOffset >= 0 ? "+" : ""}${localOffset}`;

  // Calculate day difference for date rollover detection
  const utcDayStart = Date.UTC(times.utc.getUTCFullYear(), times.utc.getUTCMonth(), times.utc.getUTCDate());
  const localDayStart = Date.UTC(times.local.getFullYear(), times.local.getMonth(), times.local.getDate());
  const dayDiff = Math.round((utcDayStart - localDayStart) / (1000 * 60 * 60 * 24));

  return (
    <section className="panel server-time-card" aria-label="Server time comparison">
      <div>
        <p className="section-label">Server Alignment</p>
        <h2 style={{ fontSize: "18px", marginTop: "4px" }}>Salad Clock Comparison</h2>
      </div>
      
      <div className="clocks-container">
        <div className="clock-widget">
          <span className="clock-label">Salad Server (UTC)</span>
          <div className="clock-time">{formatClockTime(times.utc, true)}</div>
          <span className="clock-date" style={{ fontSize: "11px", color: dayDiff !== 0 ? "#fca5a5" : "#9ef0b2", fontWeight: "900", display: "inline-flex", alignItems: "center", gap: "6px", marginTop: "6px", textTransform: "uppercase" }}>
            {formatClockDate(times.utc, true)}
            {dayDiff !== 0 && (
              <span className="status-badge warning" style={{ fontSize: "9px", padding: "1px 6px", margin: 0, whiteSpace: "nowrap", border: "1px solid rgb(249 115 22 / 30%)" }}>
                {dayDiff > 0 ? `+${dayDiff}d` : `${dayDiff}d`} Rollover
              </span>
            )}
          </span>
          <span className="clock-offset" style={{ marginTop: "6px", display: "block" }}>Coordinated Universal Time</span>
        </div>
        <div className="clock-widget">
          <span className="clock-label">Local Rig Time</span>
          <div className="clock-time">{formatClockTime(times.local, false)}</div>
          <span className="clock-date" style={{ fontSize: "11px", color: "#9ef0b2", fontWeight: "900", display: "inline-block", marginTop: "6px", textTransform: "uppercase" }}>
            {formatClockDate(times.local, false)}
          </span>
          <span className="clock-offset" style={{ marginTop: "6px", display: "block" }}>Active timezone ({offsetLabel})</span>
        </div>
      </div>

      <div className="reset-countdown">
        <span>Estimated Star Chef reset ({weekStartDay}):</span>
        <span style={{ color: "#9ef0b2", fontWeight: "900" }}>{getResetCountdown()}</span>
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
