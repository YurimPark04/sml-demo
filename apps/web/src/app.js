const { useEffect, useMemo, useState } = React;

const API_BASE = "";

const KPIS = [
  { label: "WORKSPACES", value: 5, detail: "Active work areas", delta: "+1", tone: "green" },
  { label: "MODELS", value: 18, detail: "Registered models", delta: "+3", tone: "blue" },
  { label: "DEVELOPING", value: 9, detail: "Training or tuning", delta: "-1", tone: "amber" },
  { label: "COMPLETED", value: 9, detail: "Ready for service", delta: "+2", tone: "violet" },
];

const SCHEDULE = [
  { day: 1, time: "09:00", label: "Churn model retraining", type: "monthly" },
  { day: 1, time: "04:00", label: "Revenue regression batch", type: "quarterly" },
  { day: 6, time: "02:00", label: "Fraud detector retraining", type: "monthly" },
  { day: 8, time: "14:00", label: "Manual LTV model v2", type: "manual" },
  { day: 14, time: "03:00", label: "Customer segment refresh", type: "monthly" },
  { day: 19, time: "Running", label: "RUL regression training", type: "running" },
  { day: 20, time: "23:00", label: "Today night training", type: "manual" },
  { day: 22, time: "02:00", label: "Quarterly score model", type: "quarterly" },
  { day: 25, time: "09:00", label: "Sales forecast refresh", type: "monthly" },
  { day: 31, time: "03:00", label: "Yearly integrated train", type: "yearly" },
];

const ACTIVITIES = [
  { type: "done", title: "Credit score model training completed", meta: "Validation AUC 0.892", when: "Just now" },
  { type: "run", title: "RUL regression is running", meta: "GPU 68.7% / ETA 18 min", when: "12 min ago" },
  { type: "warn", title: "Dataset drift warning", meta: "PSI exceeded threshold on monthly_fee", when: "42 min ago" },
  { type: "done", title: "Dataset cleansing version saved", meta: "customer_churn_binary_20260523", when: "Yesterday" },
  { type: "info", title: "Model service deployed", meta: "Churn prediction endpoint v3", when: "May 20" },
];

const PERF_POINTS = {
  cpu: [34, 38, 35, 42, 39, 47, 43, 41, 44, 42, 39, 42],
  gpu: [58, 63, 61, 70, 67, 75, 71, 68, 72, 69, 65, 68],
  net: [10, 13, 9, 15, 12, 18, 14, 13, 16, 12, 11, 12],
};

function App() {
  const [apiState, setApiState] = useState({ status: "checking", tasks: [], algorithms: [] });
  const [range, setRange] = useState("30D");

  useEffect(() => {
    let alive = true;
    async function loadStatus() {
      try {
        const [health, tasks, algorithms] = await Promise.all([
          fetchJson("/health"),
          fetchJson("/tasks"),
          fetchJson("/models/algorithms?task=binary_classification"),
        ]);
        if (alive) {
          setApiState({
            status: health.status,
            tasks: tasks.tasks || [],
            algorithms: algorithms.algorithms || [],
          });
        }
      } catch (error) {
        if (alive) {
          setApiState({ status: "offline", tasks: [], algorithms: [], message: error.message });
        }
      }
    }
    loadStatus();
    return () => {
      alive = false;
    };
  }, []);

  return React.createElement(
    "main",
    { className: "sml-dashboard" },
    React.createElement(AppBar, null),
    React.createElement(PageHead, { range, onRangeChange: setRange }),
    React.createElement(
      "section",
      { className: "dash-page" },
      React.createElement(WelcomeBanner, { apiState }),
      React.createElement(KpiRow, { apiState }),
      React.createElement(
        "section",
        { className: "mid-grid" },
        React.createElement(PerformanceCard, { range }),
        React.createElement(ResourceCard, null)
      ),
      React.createElement(
        "section",
        { className: "bottom-grid" },
        React.createElement(ScheduleCard, null),
        React.createElement(ActivityCard, { apiState })
      )
    )
  );
}

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || "API request failed");
  return payload;
}

function AppBar() {
  const nav = ["HOME", "WORKSPACE", "REPORTING", "SERVICE", "SYSTEM", "DATASET", "MONITORING"];
  return React.createElement(
    "header",
    { className: "appbar" },
    React.createElement(
      "div",
      { className: "brand" },
      React.createElement("div", { className: "brand-logo" }, "S"),
      React.createElement(
        "div",
        { className: "brand-name" },
        "SML",
        React.createElement("span", null, "Automated Smart Machine Learning")
      )
    ),
    React.createElement(
      "nav",
      { className: "main-nav" },
      nav.map((item) =>
        React.createElement("button", { key: item, className: item === "HOME" ? "active" : "" }, item)
      )
    ),
    React.createElement(
      "div",
      { className: "user-box" },
      React.createElement("div", { className: "notify" }, "3"),
      React.createElement("div", { className: "avatar" }, "JH"),
      React.createElement("div", { className: "user-name" }, "Kim Jihun", React.createElement("span", null, "Manager"))
    )
  );
}

function PageHead({ range, onRangeChange }) {
  return React.createElement(
    "section",
    { className: "page-head" },
    React.createElement(
      "div",
      null,
      React.createElement(
        "div",
        { className: "breadcrumb" },
        React.createElement("span", null, "HOME"),
        React.createElement("b", null, "/"),
        React.createElement("span", null, "Dashboard")
      ),
      React.createElement("h1", null, "Dashboard", React.createElement("span", null, "Common Credit Scoring Workspace")),
      React.createElement(
        "div",
        { className: "head-meta" },
        React.createElement(Meta, { label: "Last sync", value: "2026-05-24 13:10" }),
        React.createElement(Meta, { label: "Active jobs", value: "3" }),
        React.createElement(Meta, { label: "Failed alerts", value: "1", warn: true })
      )
    ),
    React.createElement(
      "div",
      { className: "head-actions" },
      React.createElement(
        "div",
        { className: "range-toggle" },
        ["TODAY", "7D", "30D", "90D"].map((item) =>
          React.createElement(
            "button",
            { key: item, className: range === item ? "active" : "", onClick: () => onRangeChange(item) },
            item
          )
        )
      ),
      React.createElement("button", { className: "tool-btn", title: "Refresh" }, "↻"),
      React.createElement("button", { className: "tool-btn", title: "Download" }, "↓"),
      React.createElement("button", { className: "accent-btn" }, "+ Add Schedule")
    )
  );
}

function Meta({ label, value, warn }) {
  return React.createElement("div", null, React.createElement("span", null, label), React.createElement("strong", { className: warn ? "warn" : "" }, value));
}

function WelcomeBanner({ apiState }) {
  return React.createElement(
    "section",
    { className: "welcome-card" },
    React.createElement(
      "div",
      { className: "welcome-copy" },
      React.createElement("div", { className: "welcome-avatar" }, "JH"),
      React.createElement(
        "div",
        null,
        React.createElement("h2", null, "Hello, Kim Jihun", React.createElement("span", null, "administrator")),
        React.createElement(
          "p",
          null,
          "Today 2 training jobs are scheduled. 3 models completed yesterday, 9 models are in service, and the average validation AUC is 0.847."
        )
      )
    ),
    React.createElement(
      "div",
      { className: "quick-actions" },
      React.createElement("div", { className: apiState.status === "ok" ? "health ok" : "health bad" }, apiState.status === "ok" ? "API ONLINE" : "API OFFLINE"),
      React.createElement("button", null, "+ New Model"),
      React.createElement("button", { className: "ghost" }, "Recent Projects")
    )
  );
}

function KpiRow({ apiState }) {
  const dynamic = useMemo(
    () => [
      ...KPIS,
      { label: "TASKS", value: apiState.tasks.length || 3, detail: "Supported ML tasks", delta: "live", tone: "cyan" },
      { label: "ALGORITHMS", value: apiState.algorithms.length || 5, detail: "Binary classifiers", delta: "API", tone: "rose" },
    ],
    [apiState]
  );
  return React.createElement(
    "section",
    { className: "kpi-row" },
    dynamic.map((item) => React.createElement(KpiCard, { key: item.label, item }))
  );
}

function KpiCard({ item }) {
  return React.createElement(
    "article",
    { className: `kpi-card ${item.tone}` },
    React.createElement("div", { className: "kpi-top" }, React.createElement("span", null, item.label), React.createElement("b", null, item.delta)),
    React.createElement("div", { className: "kpi-value" }, item.value),
    React.createElement("div", { className: "kpi-detail" }, item.detail)
  );
}

function PerformanceCard({ range }) {
  return React.createElement(
    "article",
    { className: "panel perf-panel" },
    React.createElement(
      "div",
      { className: "panel-head" },
      React.createElement("h2", null, "System Performance Monitoring", React.createElement("span", null, `${range} · 1 min interval`), React.createElement("em", null, "LIVE")),
      React.createElement("div", { className: "chip-row" }, ["CPU", "GPU", "Network"].map((label) => React.createElement("button", { key: label }, label)))
    ),
    React.createElement(
      "div",
      { className: "perf-stats" },
      React.createElement(PerfStat, { type: "cpu", label: "CPU Usage", value: "42.3", unit: "%", detail: "8 cores · avg 38.5%" }),
      React.createElement(PerfStat, { type: "gpu", label: "GPU Usage", value: "68.7", unit: "%", detail: "RTX A6000 x 1 / training" }),
      React.createElement(PerfStat, { type: "net", label: "Network I/O", value: "12.4", unit: "MB/s", detail: "In 8.1 · Out 4.3" })
    ),
    React.createElement(PerformanceSvg, null)
  );
}

function PerfStat({ type, label, value, unit, detail }) {
  return React.createElement(
    "div",
    { className: `perf-stat ${type}` },
    React.createElement("span", null, label),
    React.createElement("strong", null, value, React.createElement("small", null, unit)),
    React.createElement("p", null, detail)
  );
}

function PerformanceSvg() {
  const width = 800;
  const height = 220;
  const lines = Object.entries(PERF_POINTS).map(([key, values]) => ({ key, d: toPath(values, width, height) }));
  return React.createElement(
    "svg",
    { className: "perf-svg", viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none" },
    [0, 1, 2, 3, 4].map((i) =>
      React.createElement("line", { key: `g${i}`, x1: 0, x2: width, y1: 20 + i * 42, y2: 20 + i * 42, className: "grid-line" })
    ),
    lines.map((line) => React.createElement("path", { key: line.key, d: line.d, className: `line-${line.key}` }))
  );
}

function toPath(values, width, height) {
  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const y = height - (value / 100) * (height - 24) - 10;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

function ResourceCard() {
  return React.createElement(
    "article",
    { className: "panel resource-panel" },
    React.createElement("div", { className: "panel-head" }, React.createElement("h2", null, "Resource Usage", React.createElement("span", null, "Realtime"))),
    React.createElement(ResourceRow, { icon: "D", label: "Disk Free", value: "295.75", unit: "GB / 1.5TB", percent: 80.3, status: "Over 80%", warn: true }),
    React.createElement(ResourceRow, { icon: "M", label: "Memory Free", value: "10.08", unit: "GB / 64GB", percent: 84.2, status: "Over 80%", warn: true }),
    React.createElement(ResourceRow, { icon: "G", label: "GPU Memory", value: "14.2", unit: "GB / 48GB", percent: 29.6, status: "Normal", warn: false })
  );
}

function ResourceRow({ icon, label, value, unit, percent, status, warn }) {
  return React.createElement(
    "div",
    { className: "resource-row" },
    React.createElement("div", { className: "resource-top" }, React.createElement("span", { className: "res-icon" }, icon), React.createElement("b", null, label), React.createElement("strong", null, value, React.createElement("small", null, unit))),
    React.createElement("div", { className: "res-bar" }, React.createElement("span", { style: { width: `${percent}%` } })),
    React.createElement("div", { className: "resource-foot" }, React.createElement("span", null, `${percent}% used`), React.createElement("em", { className: warn ? "warn-tag" : "ok-tag" }, status))
  );
}

function ScheduleCard() {
  const days = Array.from({ length: 35 }, (_, index) => index - 3);
  return React.createElement(
    "article",
    { className: "panel schedule-panel" },
    React.createElement(
      "div",
      { className: "panel-head" },
      React.createElement("h2", null, "Training Schedule", React.createElement("span", null, "Auto/manual jobs · 12 this month")),
      React.createElement("button", { className: "accent-small" }, "+ Add Schedule")
    ),
    React.createElement(
      "div",
      { className: "month-nav" },
      React.createElement("button", null, "Today"),
      React.createElement("strong", null, "May 2026"),
      React.createElement("span", null, "May 17 - 23, 2026")
    ),
    React.createElement(
      "div",
      { className: "calendar" },
      ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => React.createElement("b", { key: day }, day)),
      days.map((day, index) => React.createElement(CalendarDay, { key: index, day }))
    ),
    React.createElement(
      "div",
      { className: "legend" },
      ["monthly", "quarterly", "yearly", "manual", "running"].map((type) => React.createElement("span", { key: type, className: type }, type))
    )
  );
}

function CalendarDay({ day }) {
  const valid = day >= 1 && day <= 31;
  const events = valid ? SCHEDULE.filter((event) => event.day === day) : [];
  return React.createElement(
    "div",
    { className: `cal-day ${!valid ? "muted" : ""} ${day === 20 ? "today" : ""}` },
    React.createElement("span", { className: "day-num" }, valid ? day : ""),
    events.slice(0, 2).map((event) =>
      React.createElement("div", { key: `${event.label}-${event.time}`, className: `event ${event.type}` }, React.createElement("b", null, event.time), event.label)
    ),
    events.length > 2 && React.createElement("em", null, `+${events.length - 2}`)
  );
}

function ActivityCard({ apiState }) {
  return React.createElement(
    "article",
    { className: "panel activity-panel" },
    React.createElement("div", { className: "panel-head" }, React.createElement("h2", null, "Recent Activity", React.createElement("span", null, "This week · 8 events")), React.createElement("button", null, "View all →")),
    React.createElement(
      "div",
      { className: "ml-summary" },
      React.createElement("strong", null, "ML Engine"),
      React.createElement("span", null, `Status: ${apiState.status}`),
      React.createElement("span", null, `Tasks: ${apiState.tasks.join(", ") || "loading"}`)
    ),
    React.createElement(
      "div",
      { className: "activity-list" },
      ACTIVITIES.map((item) => React.createElement(ActivityItem, { key: item.title, item }))
    )
  );
}

function ActivityItem({ item }) {
  return React.createElement(
    "div",
    { className: `activity ${item.type}` },
    React.createElement("span", { className: "activity-dot" }),
    React.createElement("div", null, React.createElement("strong", null, item.title), React.createElement("p", null, item.meta)),
    React.createElement("time", null, item.when)
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
