const { useEffect, useMemo, useState } = React;

const API_BASE = "";

const TASK_CATEGORIES = [
  { value: "classification", label: "분류", caption: "CLASSIFICATION", description: "이진분류 알고리즘을 사용하는 태스크" },
  { value: "regression", label: "회귀", caption: "REGRESSION", description: "연속형 값을 예측하는 태스크" },
];

const TARGET_MODES = {
  classification: [
    { value: "single", label: "단일 타겟", caption: "BINARY", description: "고유값 2개인 타겟 1개", taskType: "binary_classification" },
    { value: "multi", label: "멀티 타겟", caption: "MULTI-LABEL", description: "분류 멀티타겟은 추후 확장", disabled: true },
  ],
  regression: [
    { value: "single", label: "단일 타겟", caption: "SINGLE TARGET", description: "수치형 타겟 1개", taskType: "single_regression" },
    { value: "multi", label: "멀티 타겟", caption: "MULTI TARGET", description: "수치형 타겟 2개 이상", taskType: "multi_regression" },
  ],
};

const TASKS = [
  { value: "binary_classification", label: "분류", caption: "CLASSIFICATION", description: "이진분류 데이터셋" },
  { value: "single_regression", label: "회귀", caption: "SINGLE REGRESSION", description: "단일 타겟 회귀" },
  { value: "multi_regression", label: "회귀", caption: "MULTI REGRESSION", description: "멀티 타겟 회귀" },
];

const DEFAULT_CONNECTION = {
  host: "localhost",
  port: 1521,
  service_name: "ORCL",
  sid: "",
  username: "C##SML_DEMO",
  password: "",
  schema: "C##SML_DEMO",
};

const MOCK_DATASETS = [
  { dataset_id: "m1", dataset_name: "고객 거래내역 2024Q4", task_type: "binary_classification", status: "완료", datasource_name: "SML-DEMO", source_table: "CUSTOMER_TXN_2024Q4", row_count: 1284302, column_count: 18 },
  { dataset_id: "m2", dataset_name: "회원 이탈 라벨 셋", task_type: "binary_classification", status: "완료", datasource_name: "CRM-WH", source_table: "CUSTOMER_CHURN_LABEL", row_count: 418720, column_count: 24 },
  { dataset_id: "m3", dataset_name: "매장별 일매출", task_type: "single_regression", status: "완료", datasource_name: "POS-DB", source_table: "STORE_DAILY_SALES", row_count: 88412, column_count: 14 },
];

const DASHBOARD_KPIS = [
  { label: "WORKSPACES", value: 5, of: null, trend: 1, trendLabel: "이번 달", icon: "W", cls: "ws", spark: [11, 13, 12, 15, 17, 16, 19] },
  { label: "MODELS", value: 18, of: null, trend: 3, trendLabel: "vs 지난달", icon: "M", cls: "mdl", spark: [8, 11, 10, 12, 15, 14, 18] },
  { label: "DEVELOPING", value: 9, of: 18, trend: -1, trendLabel: "vs 지난주", icon: "D", cls: "dev", spark: [15, 13, 14, 12, 11, 10, 9] },
  { label: "COMPLETED", value: 9, of: 18, trend: 2, trendLabel: "이번 주", icon: "C", cls: "done", spark: [4, 5, 6, 6, 7, 8, 9] },
];

const PERF_POINTS = {
  cpu: [34, 38, 35, 42, 39, 47, 43, 41, 44, 42, 39, 42],
  gpu: [58, 63, 61, 70, 67, 75, 71, 68, 72, 69, 65, 68],
  net: [10, 13, 9, 15, 12, 18, 14, 13, 16, 12, 11, 12],
};

const SCHEDULE = [
  { day: 1, time: "09:00", label: "이탈 고객 예측 재학습", type: "monthly" },
  { day: 1, time: "09:00", label: "신용평가 모델 재학습", type: "monthly" },
  { day: 6, time: "02:00", label: "부정거래 탐지 재학습", type: "monthly" },
  { day: 14, time: "03:00", label: "고객 세그먼트 갱신", type: "monthly" },
  { day: 19, time: "진행중", label: "설비 RUL 회귀 학습", type: "running" },
  { day: 20, time: "23:00", label: "오늘 야간 학습", type: "manual" },
  { day: 25, time: "09:00", label: "매출 예측 모델 갱신", type: "quarterly" },
];

const ACTIVITIES = [
  { type: "done", who: "김지훈", title: "신용평가 모델 학습 완료", meta: "검증 AUC 0.892", when: "방금 전" },
  { type: "run", who: "시스템", title: "설비 잔존수명 예측 학습 진행 중", meta: "GPU 68.7% / 67%", when: "7분 전" },
  { type: "done", who: "이매니저", title: "이탈 고객 예측 신규 데이터 추가", meta: "1,820행 추가", when: "43분 전" },
  { type: "warn", who: "시스템", title: "데이터 드리프트 경고", meta: "monthly_fee 컬럼 PSI 임계값 초과", when: "1시간 전" },
];

function App() {
  const [page, setPage] = useState("HOME");
  const [range, setRange] = useState("30D");
  const [apiState, setApiState] = useState({ status: "checking", tasks: [], algorithms: [] });
  const [appConnection, setAppConnection] = useState(() => {
    const saved = sessionStorage.getItem("smlAppConnection");
    return saved ? { ...DEFAULT_CONNECTION, ...JSON.parse(saved), password: "" } : DEFAULT_CONNECTION;
  });
  const [dbReady, setDbReady] = useState(false);
  const [datasources, setDatasources] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [connectionOpen, setConnectionOpen] = useState(false);
  const [datasetOpen, setDatasetOpen] = useState(false);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadStatus() {
      try {
        const [health, tasks, algorithms] = await Promise.all([
          fetchJson("/health"),
          fetchJson("/tasks"),
          fetchJson("/models/algorithms?task=binary_classification"),
        ]);
        setApiState({ status: health.status, tasks: tasks.tasks || [], algorithms: algorithms.algorithms || [] });
      } catch (error) {
        setApiState({ status: "offline", tasks: [], algorithms: [], message: error.message });
      }
    }
    loadStatus();
  }, []);

  async function refreshWorkspace(connection = appConnection) {
    const payload = { app_connection: compactConnection(connection) };
    const [sourceResult, datasetResult] = await Promise.all([
      postJson("/datasources/list", payload),
      postJson("/datasets/list", payload),
    ]);
    setDatasources(sourceResult.datasources || []);
    setDatasets(datasetResult.datasets || []);
    setDbReady(true);
  }

  function saveConnection(next) {
    setAppConnection(next);
    const { password, ...safe } = next;
    sessionStorage.setItem("smlAppConnection", JSON.stringify(safe));
  }

  return React.createElement(
    "main",
    { className: page === "DATASET_PROCESS" ? "sml-shell process-mode" : "sml-shell" },
    page !== "DATASET_PROCESS" && React.createElement(AppBar, { active: page, onNavigate: setPage }),
    page === "DATASET_PROCESS" && selectedDataset
      ? React.createElement(DatasetProcessPage, {
          appConnection,
          dataset: selectedDataset,
          onBack: () => setPage("DATASET"),
          onSaved: async (result) => {
            const nextDataset = { ...selectedDataset, ...result };
            setSelectedDataset(nextDataset);
            setMessage("타겟/피처 설정이 저장되었습니다.");
            await refreshWorkspace(appConnection);
          },
        })
      : page === "DATASET"
      ? React.createElement(DatasetPage, {
          dbReady,
          datasources,
          datasets,
          message,
          onOpenConnection: () => setConnectionOpen(true),
          onOpenDataset: () => setDatasetOpen(true),
          onOpenDatasetDetail: (dataset) => {
            setSelectedDataset(dataset);
            setPage("DATASET_PROCESS");
          },
        })
      : React.createElement(DashboardPage, {
          apiState,
          range,
          onRangeChange: setRange,
          onOpenDataset: () => setPage("DATASET"),
        }),
    connectionOpen &&
      React.createElement(ConnectionModal, {
        appConnection,
        datasources,
        onClose: () => setConnectionOpen(false),
        onSaveConnection: saveConnection,
        onReady: async (connection, text) => {
          await refreshWorkspace(connection);
          setMessage(text);
        },
      }),
    datasetOpen &&
      React.createElement(DatasetWizard, {
        appConnection,
        datasources,
        onClose: () => setDatasetOpen(false),
        onOpenConnection: () => setConnectionOpen(true),
        onCreated: async (result) => {
          await refreshWorkspace(appConnection);
          setMessage(`데이터셋이 생성되었습니다: ${result.dataset_name}`);
          setDatasetOpen(false);
        },
      }),
  );
}

function AppBar({ active, onNavigate }) {
  const nav = [
    { key: "HOME", label: "대시보드" },
    { key: "WORKSPACE", label: "워크스페이스" },
    { key: "REPORTING", label: "리포팅" },
    { key: "SERVICE", label: "서비스" },
    { key: "SYSTEM", label: "시스템" },
    { key: "DATASET", label: "데이터셋" },
    { key: "MONITORING", label: "모니터링" },
  ];
  return React.createElement(
    "header",
    { className: "appbar" },
    React.createElement("div", { className: "brand" }, React.createElement("div", { className: "brand-logo" }, "S"), React.createElement("div", { className: "brand-name" }, "SML", React.createElement("span", null, "Automated Smart Machine Learning"))),
    React.createElement("nav", { className: "main-nav" }, nav.map((item) => React.createElement("button", { key: item.key, className: (active === item.key || (active === "DATASET_PROCESS" && item.key === "DATASET")) ? "active" : "", onClick: () => onNavigate(item.key) }, item.label))),
    React.createElement("div", { className: "user-box" }, React.createElement("div", { className: "notify" }, "3"), React.createElement("div", { className: "avatar" }, "JH"), React.createElement("div", { className: "user-name" }, "김지훈", React.createElement("span", null, "administrator")))
  );
}

function DashboardPage({ apiState, range, onRangeChange, onOpenDataset }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      "section",
      { className: "page-head" },
        React.createElement("div", null,
        React.createElement("div", { className: "breadcrumb" }, "홈 / 워크스페이스 / 대시보드"),
        React.createElement("h1", null, "대시보드", React.createElement("span", null, "공통-신용평가 워크스페이스")),
        React.createElement("div", { className: "head-meta" },
          React.createElement(Meta, { label: "최종 동기화", value: "2026-05-20 09:24" }),
          React.createElement(Meta, { label: "활성 작업", value: "3" }),
          React.createElement(Meta, { label: "실패 알림", value: "1", warn: true })
        )
      ),
      React.createElement("div", { className: "head-actions" },
        React.createElement("div", { className: "range-toggle" }, [["TODAY", "오늘"], ["7D", "7일"], ["30D", "30일"], ["90D", "90일"]].map(([key, label]) => React.createElement("button", { key, className: range === key ? "active" : "", onClick: () => onRangeChange(key) }, label))),
        React.createElement("button", { className: "tool-btn", title: "새로고침" }, "새로고침"),
        React.createElement("button", { className: "primary-btn", onClick: onOpenDataset }, "+ 데이터셋 생성")
      )
    ),
    React.createElement(
      "section",
      { className: "dash-page" },
      React.createElement(WelcomeBanner, { apiState, onOpenDataset }),
      React.createElement(KpiRow, { apiState }),
      React.createElement("section", { className: "mid-grid" }, React.createElement(PerformanceCard, { range }), React.createElement(ResourceCard, null)),
      React.createElement("section", { className: "bottom-grid" }, React.createElement(ScheduleCard, null), React.createElement(ActivityCard, { apiState }))
    )
  );
}

function Meta({ label, value, warn }) {
  return React.createElement("div", null, React.createElement("span", null, label), React.createElement("strong", { className: warn ? "warn" : "" }, value));
}

function WelcomeBanner({ apiState, onOpenDataset }) {
  const apiOnline = apiState.status === "ok" || apiState.status === "healthy";
  return React.createElement(
    "section",
    { className: "welcome-card" },
    React.createElement("div", { className: "welcome-copy" }, React.createElement("div", { className: "welcome-avatar" }, "JH"), React.createElement("div", null, React.createElement("h2", null, "안녕하세요, 김지훈님", React.createElement("span", null, "administrator")), React.createElement("p", null, "오늘 2개의 학습이 예정되어 있고, 어제 3개 모델이 완료되었습니다. 현재 운영중인 모델은 9개이며 평균 검증 AUC는 0.847입니다."))),
    React.createElement("div", { className: "quick-actions" }, React.createElement("div", { className: apiOnline ? "health ok" : "health bad" }, apiOnline ? "API 정상" : "API 오프라인"), React.createElement("button", { className: "primary-btn", onClick: onOpenDataset }, "+ 데이터셋"), React.createElement("button", null, "최근 프로젝트"))
  );
}

function KpiRow({ apiState }) {
  const items = useMemo(() => DASHBOARD_KPIS, [apiState]);
  return React.createElement("section", { className: "kpi-row dashboard-kpis" }, items.map((item) => React.createElement(KpiCard, { key: item.label, item })));
}

function KpiCard({ item, label, value, detail }) {
  const data = item || { label, value, detail, trend: 0, trendLabel: "", icon: "K", cls: "ws", spark: [1, 2, 3] };
  const trendCls = data.trend >= 0 ? "up" : "dn";
  const trendArrow = data.trend > 0 ? "▲" : data.trend < 0 ? "▼" : "—";
  return React.createElement("article", { className: `kpi-card ${data.cls || ""}` },
    React.createElement("div", { className: "row1" }, React.createElement("span", { className: "label" }, data.label), React.createElement("span", { className: "icon" }, data.icon)),
    React.createElement("div", { className: "val" }, data.value, data.of !== null && data.of !== undefined ? React.createElement("span", { className: "of" }, `/ ${data.of}`) : null),
    React.createElement("div", { className: `trend ${trendCls}` }, trendArrow, " ", Math.abs(data.trend), React.createElement("span", { className: "base" }, data.trendLabel)),
    React.createElement(Sparkline, { values: data.spark || [1, 2, 3] })
  );
}

function Sparkline({ values }) {
  const width = 160;
  const height = 26;
  const max = Math.max(...values);
  const min = Math.min(...values);
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - ((value - min) / Math.max(1, max - min)) * (height - 4) - 2;
    return [x, y];
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${width},${height} L0,${height} Z`;
  return React.createElement("svg", { className: "spark", viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none" }, React.createElement("path", { className: "area", d: area }), React.createElement("path", { d: line }));
}

function PerformanceCard({ range }) {
  return React.createElement("article", { className: "panel perf-panel" },
    React.createElement("div", { className: "panel-head" }, React.createElement("h2", null, "시스템 성능 모니터링", React.createElement("span", null, `${range} / 1분 단위`), React.createElement("em", null, "LIVE")), React.createElement("div", { className: "chip-row" }, ["CPU", "GPU", "네트워크"].map((label) => React.createElement("button", { key: label }, label)))),
    React.createElement("div", { className: "perf-stats" },
      React.createElement(PerfStat, { type: "cpu", label: "CPU 사용률", value: "42.3", unit: "%", detail: "8 cores / 평균 38.5%" }),
      React.createElement(PerfStat, { type: "gpu", label: "GPU 사용률", value: "68.7", unit: "%", detail: "RTX A6000 x 1 / 학습중" }),
      React.createElement(PerfStat, { type: "net", label: "네트워크 I/O", value: "12.4", unit: "MB/s", detail: "In 8.1 / Out 4.3" })
    ),
    React.createElement(PerformanceSvg, null)
  );
}

function PerfStat({ type, label, value, unit, detail }) {
  return React.createElement("div", { className: `perf-stat ${type}` }, React.createElement("span", null, label), React.createElement("strong", null, value, React.createElement("small", null, unit)), React.createElement("p", null, detail));
}

function PerformanceSvg() {
  const width = 800;
  const height = 220;
  const lines = Object.entries(PERF_POINTS).map(([key, values]) => ({ key, d: toPath(values, width, height) }));
  return React.createElement("svg", { className: "perf-svg", viewBox: `0 0 ${width} ${height}`, preserveAspectRatio: "none" }, [0, 1, 2, 3, 4].map((i) => React.createElement("line", { key: `g${i}`, x1: 0, x2: width, y1: 20 + i * 42, y2: 20 + i * 42, className: "grid-line" })), lines.map((line) => React.createElement("path", { key: line.key, d: line.d, className: `line-${line.key}` })));
}

function ResourceCard() {
  return React.createElement("article", { className: "panel resource-panel" }, React.createElement("div", { className: "panel-head" }, React.createElement("h2", null, "리소스 사용량", React.createElement("span", null, "실시간"))), React.createElement(ResourceRow, { icon: "D", label: "디스크 여유", value: "295.75", unit: "GB / 1.5TB", percent: 80.3, status: "80% 초과", warn: true }), React.createElement(ResourceRow, { icon: "M", label: "메모리 여유", value: "10.08", unit: "GB / 64GB", percent: 84.2, status: "80% 초과", warn: true }), React.createElement(ResourceRow, { icon: "G", label: "GPU 메모리", value: "14.2", unit: "GB / 48GB", percent: 29.6, status: "정상", warn: false }));
}

function ResourceRow({ icon, label, value, unit, percent, status, warn }) {
  return React.createElement("div", { className: "resource-row" }, React.createElement("div", { className: "resource-top" }, React.createElement("span", { className: "res-icon" }, icon), React.createElement("b", null, label), React.createElement("strong", null, value, React.createElement("small", null, unit))), React.createElement("div", { className: "res-bar" }, React.createElement("span", { style: { width: `${percent}%` } })), React.createElement("div", { className: "resource-foot" }, React.createElement("span", null, `${percent}% 사용중`), React.createElement("em", { className: warn ? "warn-tag" : "ok-tag" }, status)));
}

function ScheduleCard() {
  const days = Array.from({ length: 35 }, (_, index) => index - 3);
  return React.createElement("article", { className: "panel schedule-panel" }, React.createElement("div", { className: "panel-head" }, React.createElement("h2", null, "학습 스케줄", React.createElement("span", null, "자동/수동 작업 · 이번 달 12건")), React.createElement("button", { className: "primary-btn" }, "+ 스케줄 등록")), React.createElement("div", { className: "month-nav" }, React.createElement("button", null, "오늘"), React.createElement("strong", null, "2026년 5월"), React.createElement("span", null, "2026-05-17 ~ 2026-05-23")), React.createElement("div", { className: "calendar" }, ["일", "월", "화", "수", "목", "금", "토"].map((day) => React.createElement("b", { key: day }, day)), days.map((day, index) => React.createElement(CalendarDay, { key: index, day }))));
}

function CalendarDay({ day }) {
  const valid = day >= 1 && day <= 31;
  const events = valid ? SCHEDULE.filter((event) => event.day === day) : [];
  return React.createElement("div", { className: `cal-day ${!valid ? "muted" : ""} ${day === 20 ? "today" : ""}` }, React.createElement("span", { className: "day-num" }, valid ? day : ""), events.slice(0, 2).map((event) => React.createElement("div", { key: `${event.label}-${event.time}`, className: `event ${event.type}` }, React.createElement("b", null, event.time), event.label)));
}

function ActivityCard({ apiState }) {
  return React.createElement("article", { className: "panel activity-panel" }, React.createElement("div", { className: "panel-head" }, React.createElement("h2", null, "최근 활동", React.createElement("span", null, "이번 주 · 8건")), React.createElement("button", null, "전체 보기")), React.createElement("div", { className: "ml-summary" }, React.createElement("strong", null, "ML Engine"), React.createElement("span", null, `상태: ${apiState.status}`), React.createElement("span", null, `태스크: ${apiState.tasks.join(", ") || "로딩중"}`)), React.createElement("div", { className: "activity-list" }, ACTIVITIES.map((item) => React.createElement(ActivityItem, { key: item.title, item }))));
}

function ActivityItem({ item }) {
  return React.createElement("div", { className: `activity ${item.type}` }, React.createElement("span", { className: "activity-dot" }), React.createElement("div", null, React.createElement("strong", null, item.title), React.createElement("p", null, item.who, " · ", item.meta)), React.createElement("time", null, item.when));
}

function DatasetPage({ dbReady, datasources, datasets, message, onOpenConnection, onOpenDataset, onOpenDatasetDetail }) {
  const cards = datasets.length ? datasets : MOCK_DATASETS;
  const counts = countFilters(cards);
  return React.createElement("section", { className: "dataset-layout" },
    React.createElement("aside", { className: "dataset-filter" }, React.createElement("div", { className: "filter-head" }, React.createElement("strong", null, "필터"), React.createElement("button", null, "초기화")), React.createElement("input", { placeholder: "이름 검색..." }), React.createElement(FilterBlock, { title: "유형", items: [{ label: "정형 (TABULAR)", count: counts.tabular }, { label: "시계열 (TIME-SERIES)", count: counts.series }] }), React.createElement(FilterBlock, { title: "상태", items: [{ label: "완료", count: counts.done }, { label: "준비중", count: counts.ready }, { label: "오류", count: counts.error }] }), React.createElement(FilterBlock, { title: "데이터 소스", items: datasources.slice(0, 6).map((item) => ({ label: item.datasource_name, count: 1 })) }), React.createElement("label", null, "기간", React.createElement("select", null, React.createElement("option", null, "최근 30일"))), React.createElement("label", null, "생성자", React.createElement("select", null, React.createElement("option", null, "모든 사용자")))),
    React.createElement("main", { className: "dataset-main" }, React.createElement("div", { className: "breadcrumb" }, "WORKSPACE / DATASETS"), React.createElement("div", { className: "dataset-title-row" }, React.createElement("div", null, React.createElement("h1", null, "데이터셋"), React.createElement("p", null, "학습에 사용할 데이터셋을 관리합니다. 생성된 데이터셋 메타데이터는 Oracle SML 테이블에 저장됩니다.")), React.createElement("div", { className: "dataset-actions" }, React.createElement("button", { onClick: onOpenConnection }, "데이터소스 연결"), React.createElement("button", { className: "primary-btn", onClick: onOpenDataset }, "+ 신규 데이터셋"))), message && React.createElement("div", { className: "notice" }, message), !dbReady && React.createElement("div", { className: "notice warn" }, "먼저 데이터소스 연결에서 Oracle 메타 테이블을 생성하고 데이터소스를 등록하세요."), React.createElement("div", { className: "dataset-toolbar" }, React.createElement("span", null, React.createElement("b", null, cards.length), " / ", datasets.length ? "Oracle 저장 데이터셋" : "샘플 카드"), React.createElement("button", null, "유형 : 정형, 시계열"), React.createElement("button", null, "상태 : 완료"), React.createElement("div", { className: "toolbar-right" }, React.createElement("button", null, "정렬 : 최신순"), React.createElement("button", { className: "active" }, "그리드"), React.createElement("button", null, "리스트"))), React.createElement("section", { className: "dataset-grid" }, cards.map((item) => React.createElement(DatasetCard, { key: item.dataset_id, item, onOpen: onOpenDatasetDetail }))))
  );
}

function FilterBlock({ title, items }) {
  return React.createElement("section", { className: "filter-block" }, React.createElement("h3", null, title), items.map((item) => React.createElement("label", { key: item.label }, React.createElement("input", { type: "checkbox", defaultChecked: item.count > 0 }), React.createElement("span", null, item.label), React.createElement("em", null, item.count || 0))));
}

function DatasetCard({ item, onOpen }) {
  const tabular = item.task_type !== "time_series";
  const status = item.status === "LOADED" || item.status === "완료" ? "완료" : item.status || "준비중";
  return React.createElement("article", { className: "dataset-card clickable", role: "button", tabIndex: 0, onClick: () => onOpen(item), onKeyDown: (event) => event.key === "Enter" && onOpen(item) }, React.createElement("div", { className: "card-top" }, React.createElement("span", { className: tabular ? "tag blue" : "tag violet" }, tabular ? "TABULAR" : "TIME-SERIES"), React.createElement("b", { className: status === "오류" ? "bad" : "ok" }, status)), React.createElement("h2", null, item.dataset_name), React.createElement("span", { className: "source-chip" }, item.datasource_name || "ORACLE"), React.createElement("div", { className: "card-meta" }, React.createElement("span", null, item.project_name || "프로젝트 미지정"), React.createElement("span", null, taskSummary(item)), React.createElement("span", null, item.algorithm_name || "-")), React.createElement("div", { className: "card-meta" }, React.createElement("span", null, item.source_table || item.source_mode), React.createElement("span", null, `${formatNum(item.row_count || 0)} rows`), React.createElement("span", null, `${item.column_count || 0} cols`)), React.createElement("footer", null, React.createElement("span", null, taskLabel(item.task_type)), React.createElement("time", null, "프로세스 열기")));
}

function ConnectionModal({ appConnection, datasources, onClose, onSaveConnection, onReady }) {
  const [form, setForm] = useState(appConnection);
  const [sourceName, setSourceName] = useState("SML-DEMO");
  const [description, setDescription] = useState("Oracle demo datasource");
  const [status, setStatus] = useState("");
  const connection = compactConnection(form);

  async function initStore() {
    setStatus("Oracle 메타 테이블 생성 중...");
    await postJson("/system/database/init", { app_connection: connection });
    onSaveConnection(form);
    await onReady(form, "Oracle SML 메타 테이블이 준비되었습니다.");
    setStatus("메타 테이블 준비 완료");
  }

  async function createDemoTable() {
    setStatus("데모 원천 테이블 생성 중...");
    const result = await postJson("/system/database/demo-data", { app_connection: connection });
    setStatus(`${result.table} 테이블 준비 완료 (${formatNum(result.rows)} rows)`);
  }

  async function register() {
    setStatus("데이터소스 등록 중...");
    await postJson("/datasources/register", { app_connection: connection, datasource: { datasource_name: sourceName, host: form.host, port: Number(form.port), service_name: form.service_name || undefined, sid: form.sid || undefined, username: form.username, password: form.password, schema: form.schema, description } });
    onSaveConnection(form);
    await onReady(form, "데이터소스가 Oracle SML_DATASOURCE에 저장되었습니다.");
    setStatus("등록 완료");
  }

  return React.createElement(Modal, { wide: true, onClose }, React.createElement("div", { className: "modal-title" }, React.createElement("span", null, "DATASETS / DATASOURCES"), React.createElement("h2", null, "데이터소스 연결 관리"), React.createElement("p", null, "SML 시스템이 사용할 Oracle 메타 테이블과 원천 데이터소스를 등록합니다.")), React.createElement("div", { className: "modal-grid two" }, React.createElement(FormInput, { label: "DB IP / Host", value: form.host, onChange: (host) => setForm({ ...form, host }) }), React.createElement(FormInput, { label: "Port", value: form.port, onChange: (port) => setForm({ ...form, port }) }), React.createElement(FormInput, { label: "Service", value: form.service_name, onChange: (service_name) => setForm({ ...form, service_name }) }), React.createElement(FormInput, { label: "SID", value: form.sid, onChange: (sid) => setForm({ ...form, sid }) }), React.createElement(FormInput, { label: "사용자 ID", value: form.username, onChange: (username) => setForm({ ...form, username }) }), React.createElement(FormInput, { label: "비밀번호", type: "password", value: form.password, onChange: (password) => setForm({ ...form, password }) }), React.createElement(FormInput, { label: "Schema", value: form.schema, onChange: (schema) => setForm({ ...form, schema }) }), React.createElement(FormInput, { label: "데이터소스 이름", value: sourceName, onChange: setSourceName }), React.createElement("label", { className: "field full" }, "설명", React.createElement("textarea", { value: description, onChange: (event) => setDescription(event.target.value) }))), status && React.createElement("div", { className: "notice" }, status), React.createElement("div", { className: "table-box" }, React.createElement("div", { className: "table-head" }, React.createElement("b", null, "등록된 데이터소스"), React.createElement("span", null, `총 ${datasources.length}개`)), React.createElement("div", { className: "source-table" }, datasources.map((item) => React.createElement("div", { key: item.datasource_id }, React.createElement("b", null, item.datasource_name), React.createElement("span", null, item.db_kind), React.createElement("span", null, `${item.host}:${item.port}`), React.createElement("span", null, item.schema))))), React.createElement("div", { className: "modal-actions" }, React.createElement("button", { onClick: initStore }, "연결 및 테이블 생성"), React.createElement("button", { onClick: createDemoTable }, "데모 원천 테이블 생성"), React.createElement("button", { onClick: register }, "+ 데이터소스 등록"), React.createElement("button", { onClick: onClose }, "닫기")));
}

function DatasetWizard({ appConnection, datasources, onClose, onOpenConnection, onCreated }) {
  const [step, setStep] = useState(0);
  const [projectName, setProjectName] = useState("SML 데모 프로젝트");
  const [taskCategory, setTaskCategory] = useState("classification");
  const [targetMode, setTargetMode] = useState("single");
  const task = resolveTaskType(taskCategory, targetMode);
  const [algorithms, setAlgorithms] = useState([]);
  const [algorithm, setAlgorithm] = useState("");
  const [datasetName, setDatasetName] = useState("신규 데이터셋");
  const [sourceMode, setSourceMode] = useState("TABLE");
  const [datasourceId, setDatasourceId] = useState(datasources[0]?.datasource_id || "");
  const [schema, setSchema] = useState(datasources[0]?.schema || appConnection.schema);
  const [tables, setTables] = useState([]);
  const [table, setTable] = useState("");
  const [query, setQuery] = useState("SELECT * FROM CUSTOMER_TXN_2024Q4");
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function loadAlgorithms() {
      const result = await fetchJson(`/models/algorithms?task=${task}`);
      setAlgorithms(result.algorithms || []);
      setAlgorithm((result.algorithms || [])[0] || "");
    }
    if (task) loadAlgorithms().catch((error) => setStatus(error.message));
  }, [task]);

  function updateTaskCategory(nextCategory) {
    setTaskCategory(nextCategory);
    setTargetMode("single");
  }

  async function loadTables() {
    if (!datasourceId) return;
    setStatus("테이블 조회 중...");
    const result = await postJson("/datasources/tables", { app_connection: compactConnection(appConnection), datasource_id: Number(datasourceId), schema });
    setTables(result.tables || []);
    setTable((result.tables || [])[0]?.table || "");
    setStatus(`${result.tables?.length || 0}개 테이블을 조회했습니다.`);
  }

  async function createDataset() {
    setStatus("데이터셋 생성 및 메타데이터 저장 중...");
    const result = await postJson("/datasets/create", { app_connection: compactConnection(appConnection), dataset: { project_name: projectName, dataset_name: datasetName, task_category: taskCategory, target_mode: targetMode, task_type: task, algorithm_name: algorithm, library_name: "scikit-learn", datasource_id: Number(datasourceId), source_mode: sourceMode, source_schema: schema, source_table: sourceMode === "TABLE" ? table : undefined, source_query: sourceMode === "SQL" ? query : undefined, preview_rows: 1000 } });
    onCreated(result);
  }

  const canNext = step === 0 ? projectName && datasetName : step === 1 ? task && algorithm : step === 2 ? datasourceId : sourceMode === "TABLE" ? table : query.trim().toLowerCase().startsWith("select");
  return React.createElement(Modal, { wide: true, onClose },
    React.createElement("div", { className: "modal-title" }, React.createElement("span", null, "DATASETS / NEW"), React.createElement("h2", null, "신규 데이터셋 만들기"), React.createElement("p", null, "데이터셋 생성부터 알고리즘 선택, 데이터소스 연결, 데이터셋 로드까지 단계별로 진행합니다.")),
    React.createElement(WizardSteps, { step }),
    step === 0 && React.createElement(WizardBasicStep, { projectName, setProjectName, datasetName, setDatasetName }),
    step === 1 && React.createElement(WizardTaskStep, { taskCategory, setTaskCategory: updateTaskCategory, targetMode, setTargetMode, task, algorithms, algorithm, setAlgorithm }),
    step === 2 && React.createElement(WizardSourceStep, { datasources, datasourceId, setDatasourceId, schema, setSchema, sourceMode, setSourceMode, onOpenConnection }),
    step === 3 && React.createElement(WizardLoadStep, { sourceMode, schema, table, setTable, tables, loadTables, query, setQuery, status }),
    status && React.createElement("div", { className: "notice" }, status),
    React.createElement("div", { className: "wizard-summary" }, React.createElement("b", null, "선택 요약"), React.createElement("span", null, projectName), React.createElement("span", null, datasetName), React.createElement("span", null, `${categoryLabel(taskCategory)} / ${targetModeLabel(targetMode)}`), React.createElement("span", null, algorithm || "-"), React.createElement("span", null, sourceMode === "TABLE" ? table || "테이블 미선택" : "SQL Query")),
    React.createElement("div", { className: "modal-actions" }, React.createElement("button", { onClick: onClose }, "취소"), React.createElement("button", { onClick: () => setStep(Math.max(0, step - 1)), disabled: step === 0 }, "이전"), step < 3 ? React.createElement("button", { className: "primary-btn", onClick: () => setStep(step + 1), disabled: !canNext }, "다음") : React.createElement("button", { className: "primary-btn", onClick: createDataset, disabled: !canNext }, "+ 생성"))
  );
}

function WizardSteps({ step }) {
  const labels = ["데이터셋 생성", "알고리즘 태스크 선택", "데이터 소스 연결", "데이터셋 로드"];
  return React.createElement("div", { className: "wizard-steps" }, labels.map((label, index) => React.createElement("div", { key: label, className: index === step ? "active" : index < step ? "done" : "" }, React.createElement("b", null, index + 1), React.createElement("span", null, label))));
}

function WizardBasicStep({ projectName, setProjectName, datasetName, setDatasetName }) {
  return React.createElement("section", { className: "wizard-page" },
    React.createElement("h3", null, "데이터셋 생성"),
    React.createElement("p", null, "프로젝트와 데이터셋 기본 정보를 먼저 생성합니다. 이 값은 Oracle SML_DATASET에 저장됩니다."),
    React.createElement("div", { className: "modal-grid two" },
      React.createElement(FormInput, { label: "프로젝트 이름", value: projectName, onChange: setProjectName }),
      React.createElement(FormInput, { label: "데이터셋 이름", value: datasetName, onChange: setDatasetName })
    )
  );
}

function WizardTaskStep({ taskCategory, setTaskCategory, targetMode, setTargetMode, task, algorithms, algorithm, setAlgorithm }) {
  const targetOptions = TARGET_MODES[taskCategory] || [];
  return React.createElement("section", { className: "wizard-page task-page" },
    React.createElement("div", { className: "process-section-head" }, React.createElement("h3", null, "알고리즘 태스크 선택"), React.createElement("span", null, "태스크 선택에 따라 타겟 유형과 알고리즘 목록이 바뀝니다.")),
    React.createElement("div", { className: "choice-row two" }, TASK_CATEGORIES.map((item) => React.createElement("button", { key: item.value, className: taskCategory === item.value ? "choice active" : "choice", onClick: () => setTaskCategory(item.value) }, React.createElement("b", null, item.label), React.createElement("span", null, item.caption), React.createElement("p", null, item.description)))),
    React.createElement("div", { className: "dynamic-subsection" },
      React.createElement("strong", null, `${categoryLabel(taskCategory)} 타겟 유형`),
      React.createElement("div", { className: "choice-row two" }, targetOptions.map((item) => React.createElement("button", { key: item.value, disabled: item.disabled, className: targetMode === item.value && !item.disabled ? "choice active" : "choice", onClick: () => !item.disabled && setTargetMode(item.value) }, React.createElement("b", null, item.label), React.createElement("span", null, item.caption), React.createElement("p", null, item.description))))
    ),
    React.createElement("div", { className: "dynamic-subsection" },
      React.createElement("strong", null, `${taskLabel(task)} 알고리즘`),
      React.createElement("div", { className: "choice-row algos" }, algorithms.map((item) => React.createElement("button", { key: item, className: algorithm === item ? "choice small active" : "choice small", onClick: () => setAlgorithm(item) }, item)))
    )
  );
}

function WizardSourceStep({ datasources, datasourceId, setDatasourceId, schema, setSchema, sourceMode, setSourceMode, onOpenConnection }) {
  return React.createElement("section", { className: "wizard-page" }, React.createElement("h3", null, "데이터 소스 연결"), React.createElement("div", { className: "choice-row two" }, React.createElement("button", { className: sourceMode === "TABLE" ? "choice active" : "choice", onClick: () => setSourceMode("TABLE") }, React.createElement("b", null, "TABLE"), React.createElement("span", null, "테이블 직접 선택")), React.createElement("button", { className: sourceMode === "SQL" ? "choice active" : "choice", onClick: () => setSourceMode("SQL") }, React.createElement("b", null, "SQL"), React.createElement("span", null, "사용자 쿼리"))), React.createElement("div", { className: "modal-grid two" }, React.createElement("label", { className: "field" }, "데이터소스", React.createElement("select", { value: datasourceId, onChange: (event) => setDatasourceId(event.target.value) }, datasources.map((item) => React.createElement("option", { key: item.datasource_id, value: item.datasource_id }, `${item.datasource_name} (${item.schema})`)))), React.createElement(FormInput, { label: "Schema", value: schema, onChange: setSchema })), React.createElement("button", { onClick: onOpenConnection }, "+ 데이터소스 추가/관리"));
}

function WizardLoadStep({ sourceMode, schema, table, setTable, tables, loadTables, query, setQuery, status }) {
  return React.createElement("section", { className: "wizard-page" }, React.createElement("h3", null, "데이터셋 로드"), sourceMode === "TABLE" ? React.createElement(React.Fragment, null, React.createElement("button", { onClick: loadTables }, "테이블 조회"), React.createElement("div", { className: "table-box" }, React.createElement("div", { className: "table-head" }, React.createElement("b", null, `TABLES (${schema})`), React.createElement("span", null, `${tables.length}개`)), React.createElement("div", { className: "table-list" }, tables.slice(0, 12).map((item) => React.createElement("button", { key: item.table, className: table === item.table ? "active" : "", onClick: () => setTable(item.table) }, item.table, React.createElement("span", null, `${formatNum(item.estimated_rows || 0)} rows`)))))) : React.createElement("label", { className: "field" }, "SQL 쿼리", React.createElement("textarea", { value: query, onChange: (event) => setQuery(event.target.value) })), status && React.createElement("p", { className: "hint" }, status));
}

function DatasetProcessPage({ appConnection, dataset, onBack, onSaved }) {
  const [activeStep, setActiveStep] = useState(0);
  const [workingDataset, setWorkingDataset] = useState(dataset);
  const [metadata, setMetadata] = useState(dataset.metadata || {});
  const [status, setStatus] = useState("");
  const columns = metadata.columns?.length ? metadata.columns : makeFallbackColumns(workingDataset);
  const previewRows = metadata.preview?.length ? metadata.preview : makeFallbackPreview(columns, workingDataset);
  const [targets, setTargets] = useState(() => dataset.target_columns?.length ? dataset.target_columns : recommendTargets(dataset, columns));
  const [pkColumns, setPkColumns] = useState(() => dataset.pk_columns || []);
  const [unusedColumns, setUnusedColumns] = useState(() => dataset.unused_columns || []);
  const [edaFeature, setEdaFeature] = useState("");
  const features = columns.map((column) => column.name).filter((name) => !targets.includes(name) && !pkColumns.includes(name) && !unusedColumns.includes(name));
  const edaColumns = columns.filter((column) => features.includes(column.name));
  const targetProfile = buildTargetProfile(previewRows, targets[0], workingDataset);
  const stepLabels = ["타겟 설정", "피처 설정", "EDA", "데이터 클렌징", "데이터 인코딩", "데이터 스케일링", "유의성 검증", "버전 저장"];

  useEffect(() => {
    async function loadProcessData() {
      if (!Number.isFinite(Number(dataset.dataset_id))) return;
      try {
        setStatus("데이터셋 미리보기 200행을 불러오는 중...");
        const result = await postJson("/datasets/process-data", {
          app_connection: compactConnection(appConnection),
          dataset_id: Number(dataset.dataset_id),
          preview_rows: 200,
        });
        setWorkingDataset(result.dataset || dataset);
        setMetadata(result.metadata || result.dataset?.metadata || {});
        setStatus("");
      } catch (error) {
        setStatus(`저장된 메타데이터로 표시 중: ${error.message}`);
      }
    }
    loadProcessData();
  }, [dataset.dataset_id]);

  useEffect(() => {
    if (!edaColumns.length) return;
    if (!edaFeature || !edaColumns.some((column) => column.name === edaFeature)) {
      setEdaFeature(edaColumns[0].name);
    }
  }, [features.join("|"), metadata.columns?.length]);

  function toggleSingleTarget(name) {
    setTargets(targets.includes(name) ? [] : [name]);
    setPkColumns((current) => current.filter((item) => item !== name));
    setUnusedColumns((current) => current.filter((item) => item !== name));
  }

  function toggleList(setter, name) {
    if (targets.includes(name)) return;
    setter((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  async function saveSelection(nextStep) {
    if (!targets.length) {
      setStatus("타겟 컬럼을 먼저 선택하세요.");
      return;
    }
    const payload = {
      app_connection: compactConnection(appConnection),
      dataset_id: Number(workingDataset.dataset_id),
      target_columns: targets,
      feature_columns: features,
      pk_columns: pkColumns,
      unused_columns: unusedColumns,
      target_profile: targetProfile,
    };
    if (!Number.isFinite(payload.dataset_id)) {
      setStatus("샘플 카드는 DB 저장 없이 화면 동작만 확인할 수 있습니다.");
      if (typeof nextStep === "number") setActiveStep(nextStep);
      return;
    }
    setStatus("타겟/피처 설정 저장 중...");
    const result = await postJson("/datasets/selection/save", payload);
    setWorkingDataset({ ...workingDataset, ...result });
    await onSaved(result);
    setStatus("저장 완료");
    if (typeof nextStep === "number") setActiveStep(nextStep);
  }

  function goNext() {
    if (activeStep === 0) return saveSelection(1);
    if (activeStep === 1) return saveSelection(2);
    if (activeStep < stepLabels.length - 1) return setActiveStep(activeStep + 1);
    return undefined;
  }

  const content = activeStep === 0
    ? React.createElement(TargetColumnStep, { dataset: workingDataset, columns, previewRows, targets, onToggleTarget: toggleSingleTarget, targetProfile })
    : activeStep === 1
    ? React.createElement(FeatureColumnStep, { columns, previewRows, targets, pkColumns, unusedColumns, features, onTogglePk: (name) => toggleList(setPkColumns, name), onToggleUnused: (name) => toggleList(setUnusedColumns, name) })
    : activeStep === 2
    ? React.createElement(EdaStep, { dataset: workingDataset, columns: edaColumns, previewRows, targets, selectedFeature: edaFeature, onSelectFeature: setEdaFeature })
    : React.createElement(ProcessPlaceholderStep, { label: stepLabels[activeStep], detail: "다음 구현 단계입니다. 현재 저장된 타겟/피처/선택 테이블을 기준으로 이어집니다." });

  return React.createElement("section", { className: "process-page" },
    React.createElement("aside", { className: "process-side" },
      React.createElement("div", { className: "process-brand" }, React.createElement("b", null, "D"), React.createElement("strong", null, "DICubeML"), React.createElement("span", null, "workspace")),
      ["대시보드", "데이터소스", "데이터셋", "모델 학습", "실험", "배포", "모니터링", "설정"].map((item) => React.createElement("button", { key: item, className: item === "데이터셋" ? "active" : "", onClick: item === "데이터셋" ? onBack : undefined }, item))
    ),
    React.createElement("main", { className: "process-work" },
      React.createElement(ProcessHeader, { dataset: workingDataset, onBack }),
      React.createElement(ProcessStepBar, { activeStep, setActiveStep }),
      status && React.createElement("div", { className: "notice" }, status),
      content,
      React.createElement("footer", { className: "process-footer" },
        React.createElement("span", null, `단계 ${activeStep + 1} / ${stepLabels.length} · ${stepLabels[activeStep]}`),
        React.createElement("div", null,
          React.createElement("button", { onClick: () => saveSelection() }, "임시저장"),
          React.createElement("button", { onClick: activeStep === 0 ? onBack : () => setActiveStep(activeStep - 1) }, "← 이전"),
          React.createElement("button", { className: "primary-btn", onClick: goNext }, activeStep === 0 ? "다음 → 피처 설정" : activeStep === 1 ? "저장 후 → EDA" : activeStep === 2 ? "다음 → 데이터 클렌징" : "다음")
        )
      )
    )
  );
}

function ProcessHeader({ dataset, onBack }) {
  return React.createElement(React.Fragment, null,
    React.createElement("header", { className: "process-topbar" },
      React.createElement("div", null,
        React.createElement("div", { className: "breadcrumb" }, `DATASETS / ${dataset.dataset_name || "DATASET"}`),
        React.createElement("h1", null, dataset.dataset_name || "데이터셋", React.createElement("span", null, taskLabel(dataset.task_type)), React.createElement("span", null, dataset.algorithm_name || "scikit-learn"), React.createElement("span", { className: "draft" }, "v0.3-draft"))
      ),
      React.createElement("div", { className: "process-actions" }, React.createElement("button", null, "이력"), React.createElement("button", null, "새로고침"), React.createElement("button", null, "저장"), React.createElement("button", { className: "dark-btn" }, "▷ 학습으로 보내기"), React.createElement("button", { onClick: onBack }, "목록"))
    ),
    React.createElement("section", { className: "dataset-facts" },
      React.createElement(Fact, { label: "데이터소스", value: `${dataset.datasource_name || "ORACLE"} · ${dataset.source_mode || "TABLE"}` }),
      React.createElement(Fact, { label: "대상 테이블", value: dataset.source_table || dataset.source_query || "-" }),
      React.createElement(Fact, { label: "총 행 수", value: formatNum(dataset.row_count || 0) }),
      React.createElement(Fact, { label: "컬럼 수", value: formatNum(dataset.column_count || 0) }),
      React.createElement(Fact, { label: "용량", value: "120 MB" }),
      React.createElement(Fact, { label: "작성자", value: "김지훈" })
    )
  );
}

function Fact({ label, value }) {
  return React.createElement("div", null, React.createElement("span", null, label), React.createElement("strong", null, value));
}

function ProcessStepBar({ activeStep, setActiveStep }) {
  const steps = [
    ["타겟 설정", "01 · TARGET"],
    ["피처 설정", "02 · FEATURES"],
    ["EDA", "03 · EDA"],
    ["데이터 클렌징", "04 · CLEANSING"],
    ["데이터 인코딩", "05 · ENCODING"],
    ["데이터 스케일링", "06 · SCALING"],
    ["유의성 검증", "07 · VALIDATION"],
    ["버전 저장", "08 · VERSION"],
  ];
  return React.createElement("nav", { className: "process-stepbar" }, steps.map((step, index) => React.createElement("button", { key: step[0], className: activeStep === index ? "active" : index < activeStep ? "done" : "", onClick: () => index <= 2 && setActiveStep(index), disabled: index > 2 }, React.createElement("b", null, index + 1), React.createElement("span", null, step[0]), React.createElement("em", null, step[1]))));
}

function TargetColumnStep({ dataset, columns, previewRows, targets, onToggleTarget, targetProfile }) {
  const selected = targets[0];
  return React.createElement("section", { className: "target-page-grid" },
    React.createElement("div", { className: "target-left" },
      React.createElement("div", { className: "section-title" }, React.createElement("h2", null, "① 타겟 컬럼 선택"), React.createElement("p", null, dataset.task_type === "binary_classification" ? "예측 대상이 되는 컬럼 1개를 선택하세요. 분류 작업은 이진값이어야 합니다." : "예측 대상이 되는 타겟 컬럼을 선택하세요.")),
      React.createElement("div", { className: "target-tools" }, React.createElement("input", { placeholder: "⌕ 컬럼 검색..." }), React.createElement("button", null, "타입: 전체")),
      React.createElement("div", { className: "target-column-table" },
        React.createElement("div", { className: "target-row head" }, React.createElement("span", null, ""), React.createElement("b", null, "COLUMN"), React.createElement("b", null, "TYPE"), React.createElement("b", null, "NULL"), React.createElement("b", null, "UNIQ"), React.createElement("b", null, "SAMPLE")),
        columns.map((column) => React.createElement("button", { key: column.name, className: selected === column.name ? "target-row active" : "target-row", onClick: () => onToggleTarget(column.name) }, React.createElement("span", { className: "radio-dot" }), React.createElement("b", null, column.name, selected === column.name && React.createElement("em", null, "TARGET")), React.createElement("span", null, columnKind(column)), React.createElement("span", null, formatPercent(column.missing_ratio)), React.createElement("span", null, formatNum(column.unique_count || 0)), React.createElement("span", null, sampleValue(previewRows, column.name))))
      ),
      selected && React.createElement(TargetBalanceCard, { profile: targetProfile, column: selected })
    ),
    React.createElement("div", { className: "target-right" },
      React.createElement("div", { className: "section-title row" }, React.createElement("div", null, React.createElement("h2", null, "② 데이터 미리보기 (Top 200)"), React.createElement("p", null, "데이터소스에서 가져온 원본 데이터의 상위 200건을 보여줍니다. 타겟 컬럼은 강조됩니다.")), React.createElement("div", null, React.createElement("button", null, "샘플 갱신"), React.createElement("button", null, "CSV"))),
      React.createElement(ProcessPreviewTable, { rows: previewRows, columns, highlightColumns: targets })
    )
  );
}

function TargetBalanceCard({ profile, column }) {
  return React.createElement("section", { className: "balance-card" },
    React.createElement("div", null, React.createElement("span", { className: "dot" }), React.createElement("b", null, "선택된 타겟")),
    React.createElement("h3", null, column, React.createElement("span", null, "BOOL"), React.createElement("small", null, `클래스 ${profile.items.length}개 · 결측 ${profile.missingRatio}`)),
    profile.items.map((item) => React.createElement("div", { className: "balance-row", key: item.label }, React.createElement("span", null, item.label), React.createElement("div", null, React.createElement("i", { style: { width: `${item.percent}%` } })), React.createElement("b", null, `${item.percent}%`), React.createElement("em", null, formatNum(item.count)))),
    profile.warning && React.createElement("p", null, `△ 클래스 불균형 감지 (${profile.ratioText}) · 인코딩 단계에서 SMOTE / class_weight 권장`)
  );
}

function FeatureColumnStep({ columns, previewRows, targets, pkColumns, unusedColumns, features, onTogglePk, onToggleUnused }) {
  return React.createElement("section", { className: "target-page-grid feature-step" },
    React.createElement("div", { className: "target-left" },
      React.createElement("div", { className: "section-title" }, React.createElement("h2", null, "② 피처 설정"), React.createElement("p", null, "PK성 컬럼과 학습 미사용 컬럼을 선택하세요. 타겟, PK, 미사용 컬럼은 실제 피처 데이터셋에서 제외됩니다.")),
      React.createElement("div", { className: "feature-pills" }, React.createElement("span", null, `TARGET ${targets.join(", ") || "-"}`), React.createElement("span", null, `FEATURES ${features.length}`), React.createElement("span", null, `PK ${pkColumns.length}`), React.createElement("span", null, `UNUSED ${unusedColumns.length}`)),
      React.createElement(FeatureSelectBox, { title: "PK성 컬럼", description: "식별자, 고객번호, 거래ID처럼 학습 피처에서 제외할 키 컬럼", columns, selected: pkColumns, disabled: targets, onToggle: onTogglePk }),
      React.createElement(FeatureSelectBox, { title: "미사용 컬럼", description: "누수 위험, 의미 없는 컬럼, 운영상 제외할 컬럼", columns, selected: unusedColumns, disabled: targets, onToggle: onToggleUnused })
    ),
    React.createElement("div", { className: "target-right" },
      React.createElement("div", { className: "section-title row" }, React.createElement("div", null, React.createElement("h2", null, "사용 피처 미리보기"), React.createElement("p", null, "저장 시 아래 컬럼만 다음 EDA/전처리 단계로 전달됩니다."))),
      React.createElement(ProcessPreviewTable, { rows: previewRows, columns: columns.filter((column) => features.includes(column.name)), highlightColumns: [] })
    )
  );
}

function FeatureSelectBox({ title, description, columns, selected, disabled, onToggle }) {
  return React.createElement("section", { className: "feature-box" }, React.createElement("h3", null, title), React.createElement("p", null, description), React.createElement("div", { className: "feature-column-list" }, columns.map((column) => {
    const blocked = disabled.includes(column.name);
    return React.createElement("button", { key: column.name, className: selected.includes(column.name) ? "active" : "", disabled: blocked, onClick: () => onToggle(column.name) }, React.createElement("span", null, column.name), React.createElement("em", null, blocked ? "TARGET" : columnKind(column)));
  })));
}

function EdaStep({ dataset, columns, previewRows, targets, selectedFeature, onSelectFeature }) {
  const groups = splitEdaColumns(columns);
  const feature = columns.find((column) => column.name === selectedFeature) || groups.continuous[0] || groups.categorical[0] || columns[0];
  const target = targets[0];
  const regression = isRegressionTask(dataset);
  if (!feature) return React.createElement("section", { className: "eda-page" }, React.createElement("div", { className: "empty-preview" }, "EDA에 사용할 피처가 없습니다. 이전 단계에서 PK/미사용 컬럼을 확인하세요."));
  const kind = columnKind(feature);
  const numeric = kind === "INT" || kind === "FLOAT";
  const stats = buildFeatureStats(previewRows, feature.name);

  return React.createElement("section", { className: "eda-page" },
    React.createElement("aside", { className: "eda-sidebar" },
      React.createElement("div", { className: "section-title" }, React.createElement("h2", null, "입력 Feature"), React.createElement("p", null, "클릭하여 분포 · 통계를 확인하세요.")),
      React.createElement("input", { className: "eda-search", placeholder: "⌕ 피처 검색..." }),
      regression && target && React.createElement("div", { className: "eda-target-chip" }, React.createElement("span", null, "TARGET (회귀)"), React.createElement("b", null, target), React.createElement("small", null, "예측 대상")),
      React.createElement(EdaFeatureGroup, { title: "연속형 (CONTINUOUS)", items: groups.continuous, selected: feature.name, rows: previewRows, onSelect: onSelectFeature }),
      React.createElement(EdaFeatureGroup, { title: "범주형 (CATEGORICAL)", items: groups.categorical, selected: feature.name, rows: previewRows, onSelect: onSelectFeature }),
      React.createElement("div", { className: "eda-summary-box" }, React.createElement("b", null, `전체 피처 ${columns.length}개`), React.createElement("span", null, `연속형 ${groups.continuous.length} · 범주형 ${groups.categorical.length}`), React.createElement("span", null, `결측 포함 ${columns.filter((column) => Number(column.missing_ratio || 0) > 0).length}`))
    ),
    React.createElement("main", { className: "eda-main" },
      React.createElement(EdaFeatureHeader, { feature, stats, numeric, regression }),
      numeric
        ? React.createElement(NumericEdaContent, { dataset, feature, target, stats, rows: previewRows, columns, regression })
        : React.createElement(CategoricalEdaContent, { dataset, feature, target, stats, rows: previewRows, columns, regression })
    )
  );
}

function EdaFeatureGroup({ title, items, selected, rows, onSelect }) {
  return React.createElement("section", { className: "eda-feature-group" },
    React.createElement("h3", null, title, React.createElement("span", null, items.length)),
    items.map((column) => React.createElement("button", { key: column.name, className: selected === column.name ? "active" : "", onClick: () => onSelect(column.name) },
      React.createElement("span", null, columnKind(column)),
      React.createElement("b", null, column.name),
      React.createElement("em", null, formatPercent(column.missing_ratio || missingRatio(rows, column.name)))
    ))
  );
}

function EdaFeatureHeader({ feature, stats, numeric, regression }) {
  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "eda-feature-head" },
      React.createElement("div", null,
        React.createElement("span", { className: "type-chip" }, columnKind(feature)),
        React.createElement("span", { className: "type-chip muted" }, numeric ? "연속형" : "범주형"),
        React.createElement("strong", null, feature.name),
        React.createElement("em", null, edaFeatureLabel(feature))
      ),
      React.createElement("button", null, regression ? "상관 랭킹 #1 / 4" : numeric ? "분리도 랭킹 #1 / 4" : "정보량 랭킹 #2 / 4")
    ),
    React.createElement("div", { className: "eda-stat-grid" },
      React.createElement(EdaStat, { label: numeric ? "MIN" : "고유값", value: numeric ? formatMetric(stats.min) : formatNum(stats.unique) }),
      React.createElement(EdaStat, { label: numeric ? "MAX" : "최빈값", value: numeric ? formatMetric(stats.max) : stats.mode, sub: !numeric ? `${stats.modePercent}%` : "" }),
      React.createElement(EdaStat, { label: numeric ? "MEAN" : "최빈도", value: numeric ? formatMetric(stats.mean) : formatNum(stats.modeCount), sub: !numeric ? "rows" : "" }),
      React.createElement(EdaStat, { label: "결측", value: `${stats.missingPercent}%` }),
      React.createElement(EdaStat, { label: numeric ? "MEDIAN" : "엔트로피", value: numeric ? formatMetric(stats.median) : stats.entropy.toFixed(2), sub: numeric ? "" : "shannon" }),
      React.createElement(EdaStat, { label: numeric ? "STD" : "총건수", value: numeric ? formatMetric(stats.std) : formatNum(stats.total) })
    )
  );
}

function EdaStat({ label, value, sub }) {
  return React.createElement("div", null, React.createElement("span", null, label), React.createElement("strong", null, value), sub && React.createElement("small", null, sub));
}

function NumericEdaContent({ dataset, feature, target, stats, rows, columns, regression }) {
  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "eda-panel-grid two" },
      React.createElement("article", { className: "eda-panel" }, React.createElement("div", { className: "eda-panel-head" }, React.createElement("h3", null, "박스플롯"), React.createElement("span", null, `이상치 ${formatNum(stats.outliers)} · IQR ${formatMetric(stats.iqr)}`)), React.createElement(BoxplotVisual, { stats })),
      React.createElement("article", { className: "eda-panel" }, React.createElement("div", { className: "eda-panel-head" }, React.createElement("h3", null, "Bin 바 차트"), React.createElement("button", null, "bins=20")), React.createElement(HistogramVisual, { values: stats.values }))
    ),
    regression
      ? React.createElement("div", { className: "eda-panel-grid two special" },
          React.createElement("article", { className: "eda-panel" }, React.createElement("div", { className: "eda-special-label" }, "REGRESSION 특화", React.createElement("span", null, "선택 피처-타겟 관계 시각화")), React.createElement("h3", null, "산점도 + 회귀선"), React.createElement(ScatterPlot, { rows, xName: feature.name, yName: target })),
          React.createElement("article", { className: "eda-panel" }, React.createElement("h3", null, "타겟 상관 지표 + 전체 랭킹"), React.createElement(CorrelationRanking, { columns, rows, target }))
        )
      : React.createElement("div", { className: "eda-panel-grid two special" },
          React.createElement("article", { className: "eda-panel" }, React.createElement("div", { className: "eda-special-label" }, "CLASSIFICATION 특화", React.createElement("span", null, "선택 피처 × 타겟 클래스 분포")), React.createElement("h3", null, "클래스별 겹친 히스토그램"), React.createElement(ClassHistogram, { values: stats.values })),
          React.createElement("article", { className: "eda-panel" }, React.createElement("h3", null, "타겟 분리도 + 전체 랭킹"), React.createElement(SeparabilityRanking, { columns, rows, target, categorical: false }))
        )
  );
}

function CategoricalEdaContent({ dataset, feature, target, stats, rows, columns, regression }) {
  const counts = categoryCounts(rows, feature.name).slice(0, 12);
  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "eda-warning" }, "△ 카테고리 빈도 불균형 · 카테고리별 표본 수와 타겟 차이를 함께 해석하세요.", React.createElement("b", null, `max/min · ${Math.max(1, Math.round((counts[0]?.count || 1) / Math.max(1, counts[counts.length - 1]?.count || 1)))}.0×`)),
    React.createElement("article", { className: "eda-panel" }, React.createElement("div", { className: "eda-panel-head" }, React.createElement("h3", null, "코드값별 막대 그래프"), React.createElement("div", null, React.createElement("button", { className: "dark-btn" }, "빈도"), React.createElement("button", null, "비율"))), React.createElement(CategoryBars, { counts })),
    regression
      ? React.createElement("div", { className: "eda-panel-grid two special" },
          React.createElement("article", { className: "eda-panel" }, React.createElement("div", { className: "eda-special-label" }, "REGRESSION 특화", React.createElement("span", null, "카테고리별 타겟 분포")), React.createElement("h3", null, "카테고리별 박스플롯"), React.createElement(CategoryBoxplot, { counts })),
          React.createElement("article", { className: "eda-panel" }, React.createElement("h3", null, "ANOVA · 설명력 + 전체 랭킹"), React.createElement(AnovaRanking, { columns, selected: feature.name }))
        )
      : React.createElement("div", { className: "eda-panel-grid two special" },
          React.createElement("article", { className: "eda-panel" }, React.createElement("div", { className: "eda-special-label" }, "CLASSIFICATION 특화", React.createElement("span", null, "선택 피처 × 타겟 클래스 분포")), React.createElement("h3", null, "카테고리 × 타겟 스택 바"), React.createElement(StackedTargetBars, { counts })),
          React.createElement("article", { className: "eda-panel" }, React.createElement("h3", null, "독립성 · 정보량 + 전체 랭킹"), React.createElement(SeparabilityRanking, { columns, rows, target, categorical: true, selected: feature.name }))
        )
  );
}

function BoxplotVisual({ stats }) {
  const q1 = clampPercent(28);
  const q3 = clampPercent(54);
  const median = clampPercent(42);
  return React.createElement("div", { className: "boxplot-visual" },
    React.createElement("span", { className: "whisker left" }),
    React.createElement("span", { className: "whisker right" }),
    React.createElement("span", { className: "box", style: { left: `${q1}%`, width: `${q3 - q1}%` } }),
    React.createElement("span", { className: "median", style: { left: `${median}%` } }),
    React.createElement("span", { className: "mean", style: { left: "48%" } }),
    React.createElement("span", { className: "outlier", style: { left: "82%" } }),
    React.createElement("span", { className: "outlier", style: { left: "93%" } }),
    React.createElement("small", { style: { left: "5%" } }, formatMetric(stats.min)),
    React.createElement("small", { style: { left: "40%" } }, formatMetric(stats.median)),
    React.createElement("small", { style: { left: "91%" } }, formatMetric(stats.max))
  );
}

function HistogramVisual({ values }) {
  const bars = makeBars(values, 20);
  const max = Math.max(...bars, 1);
  return React.createElement("div", { className: "hist-bars" }, bars.map((value, index) => React.createElement("i", { key: index, className: index === 7 ? "active" : "", style: { height: `${18 + (value / max) * 82}%` } })));
}

function ClassHistogram({ values }) {
  const bars = makeBars(values, 14);
  const max = Math.max(...bars, 1);
  return React.createElement("div", { className: "class-hist" }, bars.map((value, index) => React.createElement("span", { key: index },
    React.createElement("i", { className: "positive", style: { height: `${20 + ((value + index) / (max + 14)) * 70}%` } }),
    React.createElement("i", { className: "negative", style: { height: `${18 + ((max - value + 4) / (max + 4)) * 62}%` } })
  )), React.createElement("div", { className: "chart-legend" }, React.createElement("b", null, "양성"), React.createElement("b", null, "음성")));
}

function CategoryBars({ counts }) {
  const max = Math.max(...counts.map((item) => item.count), 1);
  const total = counts.reduce((sum, item) => sum + item.count, 0) || 1;
  return React.createElement("div", { className: "category-bars" }, counts.map((item, index) => React.createElement("div", { key: item.label },
    React.createElement("span", null, categoryCode(item.label, index)),
    React.createElement("b", null, item.label),
    React.createElement("i", { className: index === 0 ? "active" : "", style: { width: `${Math.max(6, (item.count / max) * 100)}%` } }),
    React.createElement("em", null, formatNum(item.count)),
    React.createElement("small", null, `${((item.count / total) * 100).toFixed(1)}%`)
  )));
}

function StackedTargetBars({ counts }) {
  return React.createElement("div", { className: "stacked-bars" }, counts.slice(0, 8).map((item, index) => {
    const positive = 12 + ((index * 13) % 56);
    return React.createElement("div", { key: item.label }, React.createElement("b", null, item.label), React.createElement("span", null, React.createElement("i", { style: { width: `${positive}%` } }), React.createElement("em", { style: { width: `${100 - positive}%` } })), React.createElement("small", null, `양성 ${positive}%`));
  }));
}

function CategoryBoxplot({ counts }) {
  return React.createElement("div", { className: "category-boxplot" }, counts.slice(0, 5).map((item, index) => React.createElement("div", { key: item.label }, React.createElement("b", null, item.label), React.createElement("span", null, React.createElement("i", { style: { left: `${12 + index * 5}%`, width: `${30 + index * 6}%` } }), React.createElement("em", { style: { left: `${30 + index * 8}%` } })), React.createElement("small", null, `n=${formatNum(item.count)}`))));
}

function ScatterPlot({ rows, xName, yName }) {
  const xValues = numericValues(rows, xName);
  const yValues = numericValues(rows, yName);
  const points = xValues.slice(0, 80).map((value, index) => ({ x: normalizeValue(value, xValues), y: normalizeValue(yValues[index] ?? value, yValues.length ? yValues : xValues) }));
  return React.createElement("div", { className: "scatter-plot" }, React.createElement("i", { className: "trend-line" }), points.map((point, index) => React.createElement("span", { key: index, style: { left: `${point.x}%`, bottom: `${point.y}%` } })), React.createElement("small", null, "관측치"), React.createElement("b", null, "OLS 회귀선"));
}

function CorrelationRanking({ columns, rows, target }) {
  const items = columns.slice(0, 4).map((column, index) => ({ name: column.name, score: (0.812 - index * 0.14).toFixed(3) }));
  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "corr-cards" }, React.createElement(EdaStat, { label: "피어슨 R", value: items[0]?.score || "0.000", sub: "선형 상관" }), React.createElement(EdaStat, { label: "스피어만 ρ", value: "0.794", sub: "순위 상관" })),
    React.createElement("div", { className: "heat-row" }, items.map((item) => React.createElement("span", { key: item.name }, React.createElement("b", null, item.score), React.createElement("small", null, item.name), React.createElement("em", null, `↔ ${target || "target"}`)))),
    React.createElement(RankingList, { items })
  );
}

function SeparabilityRanking({ columns, categorical }) {
  const items = columns.slice(0, 4).map((column, index) => ({ name: column.name, score: (categorical ? 0.131 - index * 0.029 : 0.834 - index * 0.053).toFixed(3) }));
  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "corr-cards" }, React.createElement(EdaStat, { label: categorical ? "카이제곱 χ²" : "KS 통계량", value: categorical ? "4128.2" : "0.524", sub: categorical ? "df=16 · p < 0.001" : "두 클래스 누적분포 최대차" }), React.createElement(EdaStat, { label: categorical ? "INFORMATION GAIN" : "AUC (단변량)", value: categorical ? "0.087" : items[0]?.score || "0.000", sub: categorical ? "엔트로피 감소량" : "단일 피처 ROC-AUC" })),
    React.createElement(RankingList, { items })
  );
}

function AnovaRanking({ columns, selected }) {
  const items = columns.slice(0, 4).map((column, index) => ({ name: column.name, score: (0.262 - index * 0.071).toFixed(3) }));
  return React.createElement(React.Fragment, null,
    React.createElement("div", { className: "corr-cards" }, React.createElement(EdaStat, { label: "F-STATISTIC", value: "1842.4", sub: "df=(2, 482k) · p < 0.001" }), React.createElement(EdaStat, { label: "η² (ETA-SQUARED)", value: items.find((item) => item.name === selected)?.score || "0.041", sub: "설명 분산 비율" })),
    React.createElement(RankingList, { items })
  );
}

function RankingList({ items }) {
  const max = Math.max(...items.map((item) => Number(item.score)), 0.001);
  return React.createElement("div", { className: "ranking-list" }, items.map((item, index) => React.createElement("div", { key: item.name, className: index === 0 ? "active" : "" }, React.createElement("span", null, `#${index + 1}`), React.createElement("b", null, item.name), React.createElement("i", { style: { width: `${Math.max(8, (Number(item.score) / max) * 100)}%` } }), React.createElement("em", null, item.score))));
}

function ProcessPlaceholderStep({ label, detail }) {
  return React.createElement("section", { className: "process-placeholder-step" }, React.createElement("h2", null, label), React.createElement("p", null, detail), React.createElement("div", null, "이전 단계에서 저장한 `SML_DS_{DATASET_ID}_SELECTED` 테이블을 기준으로 계속 확장합니다."));
}

function ProcessPreviewTable({ rows, columns, highlightColumns }) {
  const names = columns.map((column) => column.name);
  return React.createElement("div", { className: "process-preview-table" }, React.createElement("table", null,
    React.createElement("thead", null, React.createElement("tr", null, React.createElement("th", null, "#"), names.map((name) => React.createElement("th", { key: name, className: highlightColumns.includes(name) ? "target-col" : "" }, name)))),
    React.createElement("tbody", null, rows.slice(0, 200).map((row, index) => React.createElement("tr", { key: index }, React.createElement("td", null, index + 1), names.map((name) => React.createElement("td", { key: name, className: highlightColumns.includes(name) ? "target-col" : "" }, String(row[name] ?? ""))))))
  ));
}

function DatasetProcessModal({ dataset, onClose }) {
  const metadata = dataset.metadata || {};
  const columns = metadata.columns?.length ? metadata.columns : makeFallbackColumns(dataset);
  const preview = metadata.preview || [];
  const [step, setStep] = useState(0);
  const [targets, setTargets] = useState(() => dataset.target_columns?.length ? dataset.target_columns : recommendTargets(dataset, columns));
  const [features, setFeatures] = useState(() => dataset.feature_columns?.length ? dataset.feature_columns : columns.map((column) => column.name).filter((name) => !targets.includes(name)));
  const steps = ["데이터셋 로드", "타겟/피처 선택", "EDA", "데이터 전처리", "유의성 검증", "버전 저장"];

  function toggleTarget(name) {
    const multi = dataset.task_type === "multi_regression";
    const next = targets.includes(name) ? targets.filter((item) => item !== name) : multi ? [...targets, name].slice(0, 2) : [name];
    setTargets(next);
    setFeatures(columns.map((column) => column.name).filter((columnName) => !next.includes(columnName)));
  }

  function toggleFeature(name) {
    setFeatures((current) => current.includes(name) ? current.filter((item) => item !== name) : [...current, name]);
  }

  return React.createElement(Modal, { wide: true, onClose },
    React.createElement("div", { className: "modal-title" }, React.createElement("span", null, "DATASETS / PROCESS"), React.createElement("h2", null, dataset.dataset_name), React.createElement("p", null, "생성된 데이터셋 카드에서 이어지는 데이터셋 프로세스 화면입니다.")),
    React.createElement("section", { className: "process-hero" },
      React.createElement("div", null, React.createElement("b", null, dataset.project_name || "PROJECT"), React.createElement("strong", null, dataset.source_table || dataset.source_mode || "SOURCE"), React.createElement("span", null, taskSummary(dataset))),
      React.createElement("div", null, React.createElement("b", null, "ROWS"), React.createElement("strong", null, formatNum(dataset.row_count || metadata.shape?.rows || 0))),
      React.createElement("div", null, React.createElement("b", null, "COLS"), React.createElement("strong", null, formatNum(dataset.column_count || metadata.shape?.columns || columns.length))),
      React.createElement("div", null, React.createElement("b", null, "ALGORITHM"), React.createElement("strong", null, dataset.algorithm_name || "-"))
    ),
    React.createElement("div", { className: "process-flow" }, steps.map((label, index) => React.createElement("button", { key: label, className: index === step ? "active" : index < step ? "done" : "", onClick: () => setStep(index) }, React.createElement("b", null, index + 1), React.createElement("span", null, label)))),
    step === 0 && React.createElement(DatasetLoadPanel, { dataset, columns, preview, metadata }),
    step === 1 && React.createElement(TargetFeaturePanel, { dataset, columns, targets, features, onToggleTarget: toggleTarget, onToggleFeature: toggleFeature }),
    step === 2 && React.createElement(EdaPanel, { dataset, columns, targets }),
    step === 3 && React.createElement(PreprocessPanel, null),
    step === 4 && React.createElement(SignificancePanel, { dataset, targets, columns }),
    step === 5 && React.createElement(VersionPanel, { dataset, targets, features }),
    React.createElement("div", { className: "modal-actions" }, React.createElement("button", { onClick: onClose }, "닫기"), React.createElement("button", { onClick: () => setStep(Math.max(0, step - 1)), disabled: step === 0 }, "이전"), React.createElement("button", { className: "primary-btn", onClick: () => setStep(Math.min(steps.length - 1, step + 1)), disabled: step === steps.length - 1 }, "다음"))
  );
}

function DatasetLoadPanel({ dataset, columns, preview, metadata }) {
  return React.createElement("section", { className: "process-panel" },
    React.createElement("div", { className: "process-section-head" }, React.createElement("h3", null, "데이터셋 로드"), React.createElement("span", null, "미리보기(head)와 컬럼 메타데이터")),
    React.createElement("div", { className: "metadata-grid" }, columns.slice(0, 12).map((column) => React.createElement("article", { key: column.name }, React.createElement("b", null, column.name), React.createElement("span", null, column.dtype || column.data_type || "-"), React.createElement("em", null, `missing ${formatPercent(column.missing_ratio)}`), React.createElement("small", null, `unique ${formatNum(column.unique_count || 0)}`)))),
    React.createElement(PreviewTable, { rows: preview, columns }),
    React.createElement("div", { className: "process-note" }, `Oracle SML_DATASET #${dataset.dataset_id || "-"} · 저장 shape ${formatNum(metadata.shape?.rows || dataset.row_count || 0)} x ${formatNum(metadata.shape?.columns || dataset.column_count || columns.length)}`)
  );
}

function TargetFeaturePanel({ dataset, columns, targets, features, onToggleTarget, onToggleFeature }) {
  return React.createElement(
    "section",
    { className: "process-panel split" },
    React.createElement(
      "div",
      null,
      React.createElement("div", { className: "process-section-head" }, React.createElement("h3", null, "타겟 선택"), React.createElement("span", null, targetRuleText(dataset.task_type))),
      React.createElement("div", { className: "column-picker" }, columns.map((column) => React.createElement("button", { key: column.name, className: targets.includes(column.name) ? "selected" : "", onClick: () => onToggleTarget(column.name) }, React.createElement("b", null, column.name), React.createElement("span", null, `${column.dtype || "-"} · unique ${formatNum(column.unique_count || 0)}`))))
    ),
    React.createElement(
      "div",
      null,
      React.createElement("div", { className: "process-section-head" }, React.createElement("h3", null, "피처 선택"), React.createElement("span", null, `${features.length}개 선택`)),
      React.createElement("div", { className: "column-picker" }, columns.filter((column) => !targets.includes(column.name)).map((column) => React.createElement("button", { key: column.name, className: features.includes(column.name) ? "selected feature" : "", onClick: () => onToggleFeature(column.name) }, React.createElement("b", null, column.name), React.createElement("span", null, column.dtype || "-"))))
    )
  );
}

function EdaPanel({ dataset, columns, targets }) {
  const numeric = columns.filter((column) => String(column.dtype || "").includes("int") || String(column.dtype || "").includes("float") || String(column.dtype || "").includes("number")).length;
  const categorical = Math.max(0, columns.length - numeric);
  return React.createElement("section", { className: "process-panel" },
    React.createElement("div", { className: "process-section-head" }, React.createElement("h3", null, "EDA"), React.createElement("span", null, "태스크별 통계량/분포/결측치/이상치")),
    React.createElement("div", { className: "eda-cards" }, React.createElement("article", null, React.createElement("b", null, "컬럼 유형"), React.createElement("strong", null, `${numeric} numeric / ${categorical} categorical`)), React.createElement("article", null, React.createElement("b", null, "타겟 분포"), React.createElement("strong", null, targets.join(", ") || "미선택")), React.createElement("article", null, React.createElement("b", null, "추천 차트"), React.createElement("strong", null, dataset.task_type === "binary_classification" ? "클래스 비율, Boxplot, 상관 heatmap" : "타겟 histogram, scatter, 상관 heatmap"))),
    React.createElement("div", { className: "chart-placeholder" }, "EDA 차트 영역")
  );
}

function PreprocessPanel() {
  return React.createElement("section", { className: "process-panel" },
    React.createElement("div", { className: "process-section-head" }, React.createElement("h3", null, "데이터 전처리"), React.createElement("span", null, "결측치/이상치/인코딩/스케일링/중복 제거")),
    React.createElement("div", { className: "preprocess-grid" }, ["결측치 처리: 평균/중앙값/최빈값/삭제", "이상치 처리: IQR/Winsorize/None", "인코딩: One-Hot/Label", "스케일링: Robust/Standard/MinMax/None", "중복 데이터 제거: ON", "전처리 리포트 저장"].map((item) => React.createElement("label", { key: item }, React.createElement("input", { type: "checkbox", defaultChecked: true }), React.createElement("span", null, item))))
  );
}

function SignificancePanel({ dataset, targets, columns }) {
  return React.createElement("section", { className: "process-panel" },
    React.createElement("div", { className: "process-section-head" }, React.createElement("h3", null, "유의성 검증"), React.createElement("span", null, "태스크별 검정 방법론")),
    React.createElement("div", { className: "eda-cards" }, React.createElement("article", null, React.createElement("b", null, "분류"), React.createElement("strong", null, "Chi-square, ANOVA, Mutual Information")), React.createElement("article", null, React.createElement("b", null, "회귀"), React.createElement("strong", null, "Pearson/Spearman, F-test, VIF")), React.createElement("article", null, React.createElement("b", null, "현재 타겟"), React.createElement("strong", null, targets.join(", ") || "미선택"))),
    React.createElement("div", { className: "validation-list" }, columns.slice(0, 8).map((column, index) => React.createElement("div", { key: column.name }, React.createElement("b", null, column.name), React.createElement("span", null, index % 3 === 0 ? "강한 관련" : index % 3 === 1 ? "검토 필요" : "낮음"), React.createElement("em", null, (0.91 - index * 0.07).toFixed(2)))))
  );
}

function VersionPanel({ dataset, targets, features }) {
  return React.createElement("section", { className: "process-panel" },
    React.createElement("div", { className: "process-section-head" }, React.createElement("h3", null, "버전 저장"), React.createElement("span", null, "데이터셋 + 타겟 프로파일 + 검증 결과")),
    React.createElement("div", { className: "version-card" }, React.createElement("b", null, `${slugify(dataset.dataset_name)}_v001.pkl`), React.createElement("span", null, `targets ${targets.length} · features ${features.length}`), React.createElement("p", null, "모델 프로젝트에서 이 버전을 참조할 수 있도록 저장하는 단계입니다."), React.createElement("button", { className: "primary-btn" }, "+ 버전 저장"))
  );
}

function PreviewTable({ rows, columns }) {
  const displayColumns = columns.slice(0, 6).map((column) => column.name);
  if (!rows.length) return React.createElement("div", { className: "empty-preview" }, "저장된 preview가 없습니다. 데이터셋 생성 시 metadata가 저장되면 head()가 표시됩니다.");
  return React.createElement("div", { className: "preview-table" }, React.createElement("table", null, React.createElement("thead", null, React.createElement("tr", null, displayColumns.map((name) => React.createElement("th", { key: name }, name)))), React.createElement("tbody", null, rows.slice(0, 5).map((row, index) => React.createElement("tr", { key: index }, displayColumns.map((name) => React.createElement("td", { key: name }, String(row[name] ?? ""))))))));
}

function Modal({ children, onClose, wide }) {
  return React.createElement("div", { className: "modal-backdrop" }, React.createElement("section", { className: wide ? "modal wide" : "modal" }, React.createElement("button", { className: "modal-close", onClick: onClose }, "×"), children));
}

function FormInput({ label, value, onChange, type = "text" }) {
  return React.createElement("label", { className: "field" }, label, React.createElement("input", { type, value: value || "", onChange: (event) => onChange(event.target.value) }));
}

function toPath(values, width, height) {
  return values.map((value, index) => {
    const x = (index / (values.length - 1)) * width;
    const y = height - (value / 100) * (height - 24) - 10;
    return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || "API request failed");
  return payload;
}

async function postJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || "API request failed");
  return payload;
}

function compactConnection(connection) {
  const next = { ...connection, port: Number(connection.port || 1521) };
  Object.keys(next).forEach((key) => {
    if (next[key] === "" || next[key] === null || next[key] === undefined) delete next[key];
  });
  return next;
}

function countFilters(items) {
  return {
    tabular: items.filter((item) => item.task_type !== "time_series").length,
    series: items.filter((item) => item.task_type === "time_series").length,
    done: items.filter((item) => item.status === "LOADED" || item.status === "완료").length,
    ready: items.filter((item) => item.status === "DRAFT" || item.status === "준비중").length,
    error: items.filter((item) => item.status === "ERROR" || item.status === "오류").length,
  };
}

function taskLabel(task) {
  if (task === "binary_classification") return "분류";
  if (task === "single_regression") return "회귀";
  if (task === "multi_regression") return "멀티타겟 회귀";
  return task || "-";
}

function resolveTaskType(category, mode) {
  const option = (TARGET_MODES[category] || []).find((item) => item.value === mode && !item.disabled);
  return option?.taskType || "binary_classification";
}

function categoryLabel(category) {
  if (category === "classification") return "분류";
  if (category === "regression") return "회귀";
  return category || "";
}

function targetModeLabel(mode) {
  if (mode === "single") return "단일 타겟";
  if (mode === "multi") return "멀티 타겟";
  return mode || "";
}

function taskSummary(item) {
  return [categoryLabel(item.task_category) || taskLabel(item.task_type), targetModeLabel(item.target_mode)].filter(Boolean).join(" · ");
}

function formatNum(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value) {
  if (!value) return "오늘";
  return String(value).slice(5, 10);
}

function formatPercent(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "0.0%";
  return `${(Number(value) * 100).toFixed(1)}%`;
}

function makeFallbackColumns(dataset) {
  const names = dataset.task_type === "binary_classification"
    ? ["CUSTOMER_ID", "AGE", "TENURE_MONTHS", "MONTHLY_FEE", "TOTAL_AMOUNT", "TXN_COUNT", "REGION", "PRODUCT_TYPE", "CHURN"]
    : ["ID", "X1", "X2", "X3", "CATEGORY", "TARGET"];
  return names.map((name, index) => ({
    name,
    dtype: index % 3 === 0 ? "int64" : index % 3 === 1 ? "float64" : "object",
    missing_ratio: index === 3 ? 0.018 : 0,
    unique_count: name === "CHURN" ? 2 : index * 12 + 4,
  }));
}

function recommendTargets(dataset, columns) {
  if (dataset.task_type === "binary_classification") {
    const binary = columns.find((column) => Number(column.unique_count) === 2);
    return [binary?.name || columns[columns.length - 1]?.name].filter(Boolean);
  }
  if (dataset.task_type === "multi_regression") {
    return columns.slice(-2).map((column) => column.name);
  }
  return [columns[columns.length - 1]?.name].filter(Boolean);
}

function targetRuleText(task) {
  if (task === "binary_classification") return "이진분류 타겟은 고유값 2개 컬럼이어야 합니다.";
  if (task === "multi_regression") return "멀티타겟 회귀는 타겟 2개를 선택합니다.";
  return "단일 회귀는 수치형 타겟 1개를 선택합니다.";
}

function slugify(value) {
  return String(value || "dataset").trim().toLowerCase().replace(/[^a-z0-9가-힣]+/gi, "_").replace(/^_+|_+$/g, "") || "dataset";
}

function columnKind(column) {
  const dtype = String(column.dtype || column.data_type || "").toLowerCase();
  if (dtype.includes("bool")) return "BOOL";
  if (dtype.includes("date") || dtype.includes("time")) return "DATE";
  if (dtype.includes("int")) return "INT";
  if (dtype.includes("float") || dtype.includes("number") || dtype.includes("decimal")) return "FLOAT";
  return "CAT";
}

function sampleValue(rows, name) {
  const value = rows.find((row) => row[name] !== null && row[name] !== undefined)?.[name];
  if (value === null || value === undefined) return "-";
  return String(value).slice(0, 16);
}

function makeFallbackPreview(columns, dataset) {
  const targetName = dataset.task_type === "binary_classification" ? "CHURN" : columns[columns.length - 1]?.name;
  return Array.from({ length: 32 }, (_, index) => {
    const row = {};
    columns.forEach((column, colIndex) => {
      if (column.name === targetName) row[column.name] = index % 4 === 0 ? "true" : "false";
      else if (column.name.includes("ID")) row[column.name] = 1000234 + index;
      else if (columnKind(column) === "CAT") row[column.name] = ["서울", "부산", "대구", "인천"][index % 4];
      else row[column.name] = (index + 1) * (colIndex + 3);
    });
    return row;
  });
}

function buildTargetProfile(rows, target, dataset) {
  if (!target) return { items: [], missingRatio: "0%", warning: false, ratioText: "-" };
  const counts = new Map();
  let missing = 0;
  rows.forEach((row) => {
    const value = row[target];
    if (value === null || value === undefined || value === "") {
      missing += 1;
      return;
    }
    const key = String(value);
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  let items = Array.from(counts.entries()).map(([label, count]) => ({ label, count }));
  if (!items.length && dataset.task_type === "binary_classification") {
    items = [{ label: "false (정상)", count: 78 }, { label: "true (이탈)", count: 22 }];
  }
  const total = items.reduce((sum, item) => sum + item.count, 0) || 1;
  items = items.sort((a, b) => b.count - a.count).map((item) => ({ ...item, percent: Math.round((item.count / total) * 100) }));
  const max = Math.max(...items.map((item) => item.count), 1);
  const min = Math.max(Math.min(...items.map((item) => item.count)), 1);
  return {
    items,
    missingRatio: `${Math.round((missing / Math.max(rows.length, 1)) * 100)}%`,
    warning: items.length === 2 && max / min >= 3,
    ratioText: `${Math.round(max / min)}:${1}`,
  };
}

function isRegressionTask(dataset) {
  return String(dataset.task_type || dataset.task_category || "").includes("regression");
}

function splitEdaColumns(columns) {
  return {
    continuous: columns.filter((column) => ["INT", "FLOAT"].includes(columnKind(column))),
    categorical: columns.filter((column) => !["INT", "FLOAT"].includes(columnKind(column))),
  };
}

function edaFeatureLabel(column) {
  const name = String(column.name || "").toLowerCase();
  if (name.includes("amount") || name.includes("amt")) return "총 거래금액";
  if (name.includes("age")) return "연령";
  if (name.includes("region")) return "거주 지역";
  if (name.includes("price")) return "거래가격";
  return column.description || "";
}

function buildFeatureStats(rows, name) {
  const total = Math.max(rows.length, 1);
  const values = numericValues(rows, name);
  const counts = categoryCounts(rows, name);
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = percentile(sorted, 0.25);
  const q3 = percentile(sorted, 0.75);
  const iqr = q3 - q1;
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(values.length, 1);
  const variance = values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / Math.max(values.length, 1);
  const missing = rows.filter((row) => row[name] === null || row[name] === undefined || row[name] === "").length;
  const modeCount = counts[0]?.count || 0;
  return {
    values,
    min: sorted[0] ?? 0,
    max: sorted[sorted.length - 1] ?? 0,
    mean,
    median: percentile(sorted, 0.5),
    std: Math.sqrt(variance),
    q1,
    q3,
    iqr,
    outliers: values.filter((value) => value < q1 - 1.5 * iqr || value > q3 + 1.5 * iqr).length,
    missingPercent: ((missing / total) * 100).toFixed(1),
    unique: counts.length || new Set(values).size,
    mode: counts[0]?.label || "-",
    modeCount,
    modePercent: ((modeCount / total) * 100).toFixed(1),
    entropy: entropy(counts, total),
    total,
  };
}

function numericValues(rows, name) {
  return rows.map((row) => Number(String(row[name] ?? "").replace(/,/g, ""))).filter((value) => Number.isFinite(value));
}

function categoryCounts(rows, name) {
  const map = new Map();
  rows.forEach((row) => {
    const raw = row[name];
    if (raw === null || raw === undefined || raw === "") return;
    const key = String(raw);
    map.set(key, (map.get(key) || 0) + 1);
  });
  return Array.from(map.entries()).map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

function missingRatio(rows, name) {
  if (!rows.length) return 0;
  return rows.filter((row) => row[name] === null || row[name] === undefined || row[name] === "").length / rows.length;
}

function percentile(sorted, ratio) {
  if (!sorted.length) return 0;
  const index = (sorted.length - 1) * ratio;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function entropy(counts, total) {
  return counts.reduce((sum, item) => {
    const p = item.count / Math.max(total, 1);
    return p ? sum - p * Math.log2(p) : sum;
  }, 0);
}

function formatMetric(value) {
  const number = Number(value || 0);
  if (Math.abs(number) >= 1000000) return `${(number / 1000000).toFixed(number >= 10000000 ? 0 : 1)}M`;
  if (Math.abs(number) >= 1000) return `${(number / 1000).toFixed(number >= 10000 ? 0 : 1)}k`;
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(1);
}

function makeBars(values, count) {
  if (!values.length) return Array.from({ length: count }, (_, index) => 2 + ((index * 7) % 18));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = Math.max((max - min) / count, 1);
  const bars = Array.from({ length: count }, () => 0);
  values.forEach((value) => {
    const index = Math.min(count - 1, Math.max(0, Math.floor((value - min) / width)));
    bars[index] += 1;
  });
  return bars;
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, value));
}

function normalizeValue(value, values) {
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 1);
  return clampPercent(((value - min) / Math.max(max - min, 1)) * 88 + 6);
}

function categoryCode(value, index) {
  const text = String(value || "ETC").replace(/[^A-Za-z0-9가-힣]/g, "");
  if (/^[A-Za-z]/.test(text)) return text.slice(0, 3).toUpperCase();
  return ["SEL", "BSN", "INC", "DAE", "DJN", "GWJ", "ULS", "SUW", "GYG", "JJU", "ETC"][index] || `C${index + 1}`;
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
