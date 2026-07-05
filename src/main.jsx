import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  applyRigOptimizationAction,
  loadDashboardData,
  requestElevatedHelper,
  requestRigOptimizationPlan,
  requestStoragePurge,
  requestSuiteShutdown,
  subscribeToEvents,
} from "./api/dashboard.js";
import { emptyDashboard, starChefTargetHours } from "./data/emptyDashboard.js";
import "./styles.css";

const tabs = ["Overview", "Rig", "Live Monitor", "Coverage", "Machines", "Docs", "Settings"];

function App() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [activeTab, setActiveTab] = useState("Overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [storageResult, setStorageResult] = useState(null);
  const [liveEvents, setLiveEvents] = useState([]);
  const {
    choppingHistory,
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
  const machineLabel = `${status.machine?.hostname ?? "This PC"} · ${status.machine?.id ?? "unknown"}`;

  async function refreshDashboard() {
    setIsRefreshing(true);
    setDashboard(await loadDashboardData());
    setIsRefreshing(false);
  }

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

  async function optimizeRig() {
    setIsOptimizing(true);
    const plan = await requestRigOptimizationPlan();
    setDashboard((currentDashboard) => ({
      ...currentDashboard,
      optimizationPlan: plan,
      rig: plan.rig ?? currentDashboard.rig,
    }));
    setLiveEvents((events) => [
      ...events,
      {
        observedAt: new Date().toISOString(),
        source: "rig",
        level: "info",
        message: "Generated maximum availability optimization plan.",
      },
    ]);
    setIsOptimizing(false);
  }

  async function applyOptimization(actionId) {
    const result = await applyRigOptimizationAction(actionId);
    setLiveEvents((events) => [
      ...events,
      {
        observedAt: new Date().toISOString(),
        source: "rig",
        level: result.applied ? "info" : "warning",
        message: result.message,
      },
    ]);
    await refreshDashboard();
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

  async function purgeStorage(mode) {
    const dryRun = !window.confirm(
      `Apply ${mode} cleanup now?\n\nCancel will run an estimate only. OK will delete selected cache candidates.`,
    );
    let includeLogs = false;
    let confirm = "";
    let logConfirm = "";

    if (mode === "all") {
      confirm = window.prompt(
        'Danger zone. Type DELETE_ALL_SALAD_CACHE to allow full cache/WSL storage purge. This can force Salad to rebuild or re-download workloads.',
        "",
      );

      if (confirm !== "DELETE_ALL_SALAD_CACHE") {
        setStorageResult({ message: "Full purge cancelled." });
        return;
      }

      includeLogs = window.confirm(
        'Logs are protected. Delete logs too?\n\nWARNING: no se puede revertir. This may remove evidence needed for Chopping-hour validation.',
      );

      if (includeLogs) {
        logConfirm = window.prompt(
          'Type DELETE_LOGS to confirm log deletion. WARNING: no se puede revertir.',
          "",
        );

        if (logConfirm !== "DELETE_LOGS") {
          includeLogs = false;
          logConfirm = "";
        }
      }
    }

    const result = await requestStoragePurge({
      mode,
      dryRun,
      includeLogs,
      confirm,
      logConfirm,
    });
    setStorageResult(result);
    await refreshDashboard();
  }

  useEffect(() => {
    refreshDashboard();
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
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">SaladChoppingHours</p>
          <h1>Local Chopping observability</h1>
          <p className="hero-copy">
            Salad documents Star Chef as 3000 minutes per week, but does not publish
            the exact qualification date window. This dashboard shows local 24h,
            rolling 7-day, and estimated Star Chef progress separately.
          </p>
        </div>
        <div className="header-actions">
          <StatusBadge tone={source === "helper" ? "confirmed" : "warning"}>
            {source === "helper" ? "Helper connected" : "Helper offline"}
          </StatusBadge>
          <button className="primary-button" type="button" onClick={refreshDashboard}>
            {isRefreshing ? "Refreshing..." : "Refresh data"}
          </button>
        </div>
      </header>

      <nav className="tabs" aria-label="Dashboard sections">
        {tabs.map((tab) => (
          <button
            className={activeTab === tab ? "tab active" : "tab"}
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </nav>

      {error ? <p className="notice error">{error}</p> : null}

      {activeTab === "Overview" ? (
        <Overview
          coverage={coverage}
          history={choppingHistory}
          machineLabel={machineLabel}
          starChef={starChef}
          status={status}
          summary={choppingSummary}
          logActivity={logActivity}
          workload={workload}
        />
      ) : null}

      {activeTab === "Rig" ? (
        <Rig
          isOptimizing={isOptimizing}
          onApplyOptimization={applyOptimization}
          onOptimize={optimizeRig}
          plan={dashboard.optimizationPlan}
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
          onPurgeStorage={purgeStorage}
          onStopSuite={stopSuite}
        />
      ) : null}
    </main>
  );
}

function Overview({
  coverage,
  history,
  logActivity,
  machineLabel,
  starChef,
  status,
  summary,
  workload,
}) {
  return (
    <>
      <section className="metric-grid" aria-label="Current Salad status">
        <MetricCard
          label="Last 24 hours"
          value={`${summary.last24Hours.toFixed(1)}h`}
          detail="Rolling local log estimate"
          tone="accent"
        />
        <MetricCard
          label="Rolling 7 days"
          value={`${summary.rolling7DaysHours.toFixed(1)}h`}
          detail={`${summary.signalCount} signals · ${summary.intervalCount} intervals`}
          tone="accent"
        />
        <MetricCard
          label="Star Chef estimate"
          value={`${starChef.progress}%`}
          detail={`${starChef.remainingHours.toFixed(1)}h remaining to ${starChefTargetHours}h`}
          tone={starChef.progress >= 100 ? "positive" : "neutral"}
        />
        <MetricCard
          label="Salad app activity"
          value={`${logActivity.rolling7DaysHours.toFixed(1)}h`}
          detail="App/log activity, not earnings credit"
          tone="neutral"
        />
        <MetricCard
          label="Current workload"
          value={formatWorkloadLabel(workload)}
          detail={describeWorkload(workload)}
          tone={workload.confidence === "confirmed" ? "positive" : "neutral"}
        />
      </section>

      <section className="dashboard-grid">
        <section className="panel chart-panel" aria-labelledby="history-heading">
          <div className="panel-heading">
            <div>
              <p className="section-label">Daily local history</p>
              <h2 id="history-heading">Last 7 calendar days</h2>
            </div>
            <StatusBadge tone={summary.confidence}>{summary.confidence}</StatusBadge>
          </div>
          <ChoppingChart data={history} />
        </section>

        <aside className="panel side-panel" aria-labelledby="truth-heading">
          <p className="section-label">What this number means</p>
          <h2 id="truth-heading">Source-labelled estimate</h2>
          <div className="progress-track" aria-label="Estimated Star Chef progress">
            <span style={{ width: `${Math.min(starChef.progress, 100)}%` }} />
          </div>
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
          </dl>
        </aside>
      </section>
    </>
  );
}

function LiveMonitor({ events, source }) {
  const terminalRef = useRef(null);

  useEffect(() => {
    terminalRef.current?.scrollTo({
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
      <div className="terminal" ref={terminalRef}>
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
      </div>
    </section>
  );
}

function Rig({ isOptimizing, onApplyOptimization, onOptimize, plan, rig }) {
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

      <section className="dashboard-grid">
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

        <aside className="panel side-panel">
          <p className="section-label">Max optimization</p>
          <h2>Availability plan</h2>
          <p className="body-copy">
            Generate a hardware-aware plan for maximum Salad job availability. This
            does not change Windows, NVIDIA, WSL, or Salad settings automatically.
          </p>
          <button className="primary-button" type="button" onClick={onOptimize}>
            {isOptimizing ? "Analyzing..." : "Generate max plan"}
          </button>
          <OptimizationActions
            actions={(plan?.actions ?? rig.optimization.actions)}
            onApply={onApplyOptimization}
          />
        </aside>
      </section>
    </>
  );
}

function OptimizationActions({ actions, onApply }) {
  if (actions.length === 0) {
    return <p className="empty-state">No optimization actions are available yet.</p>;
  }

  return (
    <div className="action-list">
      {actions.map((action) => (
        <article className={`action-item ${action.status}`} key={action.id}>
          <div>
            <strong>{action.title}</strong>
            <span>{action.detail}</span>
          </div>
          {action.id === "windows-power-plan" ? (
            <button className="secondary-button" type="button" onClick={() => onApply(action.id)}>
              Apply
            </button>
          ) : (
            <StatusBadge tone={action.status === "ready" ? "confirmed" : action.status}>
              {action.impact}
            </StatusBadge>
          )}
        </article>
      ))}
    </div>
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
        <div className="log-errors">
          <h3>Unreadable log samples</h3>
          <ul>
            {coverage.readErrorSamples.map((error) => (
              <li key={error.relativePath}>
                <strong>{error.relativePath}</strong>
                <span>{error.error}</span>
              </li>
            ))}
          </ul>
        </div>
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
        <MetricCard label="Machine ID" value={status.machine?.id ?? "unknown"} />
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
            Safe cleanup is currently estimated at{" "}
            <strong>{storage.purge.safeGb.toFixed(3)} GB</strong>. Obsolete
            re-downloadable workload cleanup is estimated at{" "}
            <strong>{storage.purge.obsoleteGb.toFixed(3)} GB</strong>.
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
          <p className="section-label">Purge all cache</p>
          <h3>What happens if everything allocated by Salad is removed?</h3>
          <p>
            A full cache purge can remove downloaded workload archives, stale
            workload packages, and the Salad WSL storage folder. If those files
            are truly cache/runtime remnants, Salad should be able to recreate
            the runtime and download another workload when it receives one.
          </p>
          <p>
            The tradeoff is operational: the next job may take longer to start,
            Salad may need to rebuild WSL/container state, and deleting while a
            job is running can interrupt work or corrupt runtime state. Full
            purge should be done only when Salad and `salad-enterprise-linux`
            are stopped.
          </p>
          <p>
            Logs are different: they are evidence for local activity and
            Chopping-hour validation. This app never includes logs in normal
            cleanup; deleting logs requires a separate confirmation because
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
  onPurgeStorage,
  onStopSuite,
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
            detail="Download/cache candidates"
          />
          <MetricCard
            label="Obsolete cleanup"
            value={`${storage.purge.obsoleteGb.toFixed(2)} GB`}
            detail="Stale re-downloadable workloads"
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
        <div className="storage-actions">
          <button className="primary-button" type="button" onClick={() => onPurgeStorage("safe")}>
            Safe cleanup
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={() => onPurgeStorage("obsolete")}
          >
            Delete obsolete
          </button>
          <button className="danger-button" type="button" onClick={() => onPurgeStorage("all")}>
            Delete all cache / WSL runtime
          </button>
        </div>
        {storageResult ? (
          <p className="notice">
            {storageResult.message ??
              `${storageResult.dryRun ? "Estimated" : "Selected"} ${storageResult.selectedGb ?? 0} GB across ${storageResult.results?.length ?? 0} candidate(s).`}
          </p>
        ) : null}
        <div className="storage-list">
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
        </div>
      </section>
    </section>
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

function ChoppingChart({ data }) {
  const maxHours = 24;

  if (data.length === 0) {
    return <p className="empty-state">No local log history is available yet.</p>;
  }

  return (
    <div className="chart" role="img" aria-label="Bar chart of Chopping hours by day">
      <div className="chart-scale" aria-hidden="true">
        <span>24h</span>
        <span>12h</span>
        <span>0h</span>
      </div>
      {data.map((item) => {
        const height = Math.min(Math.max((item.hours / maxHours) * 100, 2), 100);

        return (
          <div className="chart-column" key={item.isoDate ?? item.date}>
            <div className="bar-track">
              <span className="bar" style={{ height: `${height}%` }}>
                <span>{item.hours.toFixed(1)}h</span>
              </span>
            </div>
            <strong>{item.day}</strong>
            <small>{item.date}</small>
          </div>
        );
      })}
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

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
