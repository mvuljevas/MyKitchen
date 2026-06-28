import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { loadDashboardData } from "./api/dashboard.js";
import { sampleDashboard, starChefTargetHours } from "./data/sampleDashboard.js";
import "./styles.css";

function App() {
  const [dashboard, setDashboard] = useState(sampleDashboard);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { choppingHistory, choppingSummary, recentEvents, status, source, logs, error } =
    dashboard;
  const weeklyHours = choppingHistory.reduce((total, item) => total + item.hours, 0);
  const progress = Math.min((weeklyHours / starChefTargetHours) * 100, 100);
  const remainingHours = Math.max(starChefTargetHours - weeklyHours, 0);

  async function refreshDashboard() {
    setIsRefreshing(true);
    setDashboard(await loadDashboardData());
    setIsRefreshing(false);
  }

  useEffect(() => {
    refreshDashboard();
  }, []);

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SaladChoppingHours</p>
          <h1>Chopping visibility dashboard</h1>
        </div>
        <button className="primary-button" type="button" onClick={refreshDashboard}>
          {isRefreshing ? "Scanning" : "Scan logs"}
        </button>
      </header>

      <section className="connection-panel" aria-label="Salad installation">
        <div>
          <p className="section-label">Installation folder</p>
          <p className="path-value">{status.installPath}</p>
          {error ? <p className="helper-note">{error}</p> : null}
        </div>
        <div className="connection-actions">
          <span className={source === "helper" ? "source-pill live" : "source-pill"}>
            {source === "helper" ? "Helper connected" : "Sample data"}
          </span>
          <button className="ghost-button" type="button" onClick={refreshDashboard}>
            Refresh status
          </button>
        </div>
      </section>

      <section className="metric-grid" aria-label="Current Salad status">
        <StatusCard
          label="Salad process"
          value={status.process.label}
          detail={status.process.match}
          tone={status.process.detected ? "positive" : "neutral"}
        />
        <StatusCard
          label="Workload"
          value={status.workload.label}
          detail={status.workload.match}
          tone={status.workload.detected ? "positive" : "neutral"}
        />
        <StatusCard
          label="Log files"
          value={String(logs.length)}
          detail={formatLastLogRead(status.lastLogRead)}
        />
        <StatusCard
          label="Star Chef gap"
          value={`${remainingHours.toFixed(1)}h`}
          detail={`${weeklyHours.toFixed(1)}h of ${starChefTargetHours}h tracked`}
        />
      </section>

      <section className="dashboard-grid">
        <section className="chart-panel" aria-labelledby="history-heading">
          <div className="panel-heading">
            <div>
              <p className="section-label">Historical Chopping hours</p>
              <h2 id="history-heading">Last 7 days</h2>
            </div>
            <span className="target-pill">{progress.toFixed(0)}% target</span>
          </div>
          <ChoppingChart data={choppingHistory} />
        </section>

        <aside className="summary-panel" aria-labelledby="summary-heading">
          <p className="section-label">Weekly summary</p>
          <h2 id="summary-heading">{weeklyHours.toFixed(1)}h tracked</h2>
          <div className="progress-track" aria-label="Star Chef progress">
            <span style={{ width: `${progress}%` }} />
          </div>
          <p className="summary-copy">
            {source === "helper"
              ? `${choppingSummary.signalCount} mining signals parsed across ${choppingSummary.intervalCount} Chopping intervals.`
              : "Start the local helper to inspect Salad status and log metadata from this dashboard."}
          </p>
        </aside>
      </section>

      <section className="events-panel" aria-labelledby="events-heading">
        <div className="panel-heading">
          <div>
            <p className="section-label">Recent signals</p>
            <h2 id="events-heading">Log and status timeline</h2>
          </div>
        </div>
        <ol className="event-list">
          {recentEvents.map((event) => (
            <li key={`${event.time}-${event.source}`}>
              <time>{event.time}</time>
              <strong>{event.source}</strong>
              <span>{event.message}</span>
            </li>
          ))}
        </ol>
      </section>
    </main>
  );
}

function StatusCard({ label, value, detail, tone = "neutral" }) {
  return (
    <article className="metric-card">
      <p>{label}</p>
      <strong className={tone === "positive" ? "positive" : undefined}>{value}</strong>
      {detail ? <span>{detail}</span> : null}
    </article>
  );
}

function formatLastLogRead(value) {
  if (!value) {
    return "No logs found";
  }

  if (value === "Sample data") {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function ChoppingChart({ data }) {
  const maxHours = 24;

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
          <div className="chart-column" key={item.date}>
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

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
