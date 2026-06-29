import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  loadDashboardData,
  requestElevatedHelper,
  requestRigOptimizationPlan,
  requestSuiteShutdown,
  subscribeToEvents,
} from "./api/dashboard.js";
import { emptyDashboard, starChefTargetHours } from "./data/emptyDashboard.js";
import "./styles.css";

const tabs = ["Overview", "Rig", "Live Monitor", "Coverage", "Machines", "Settings"];

function App() {
  const [dashboard, setDashboard] = useState(emptyDashboard);
  const [activeTab, setActiveTab] = useState("Overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [liveEvents, setLiveEvents] = useState([]);
  const {
    choppingHistory,
    choppingSummary,
    logActivity,
    rig,
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

      {activeTab === "Settings" ? (
        <Settings
          status={status}
          suite={dashboard.suite}
          onElevate={elevateHelper}
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
          label="Rig log activity"
          value={`${logActivity.rolling7DaysHours.toFixed(1)}h`}
          detail="Inferred from all Salad log timestamps"
          tone="neutral"
        />
        <MetricCard
          label="Current workload"
          value={workload.label}
          detail={`${workload.source} · ${workload.confidence}`}
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

function Rig({ isOptimizing, onOptimize, plan, rig }) {
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
          value={`${rig.memory.totalGb} GB`}
          detail="Physical RAM detected"
          tone={rig.memory.totalGb >= 32 ? "positive" : "neutral"}
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
          <OptimizationActions actions={(plan?.actions ?? rig.optimization.actions)} />
        </aside>
      </section>
    </>
  );
}

function OptimizationActions({ actions }) {
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
          <StatusBadge tone={action.status === "ready" ? "confirmed" : action.status}>
            {action.impact}
          </StatusBadge>
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

function Settings({ status, suite, onElevate, onStopSuite }) {
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

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
