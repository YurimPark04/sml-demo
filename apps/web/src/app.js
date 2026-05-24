const { useEffect, useMemo, useState } = React;

const API_BASE = "";

const TASKS = [
  { value: "binary_classification", label: "분류", caption: "CLASSIFICATION" },
  { value: "single_regression", label: "회귀", caption: "REGRESSION" },
  { value: "multi_regression", label: "멀티타겟 회귀", caption: "MULTI REGRESSION" },
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

function App() {
  const [page, setPage] = useState("HOME");
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
    const [sourceResult, datasetResult] = await Promise.all([
      postJson("/datasources/list", { app_connection: compactConnection(connection) }),
      postJson("/datasets/list", { app_connection: compactConnection(connection) }),
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
    { className: "sml-shell" },
    React.createElement(AppBar, { active: page, onNavigate: setPage }),
    page === "DATASET"
      ? React.createElement(DatasetPage, {
          appConnection,
          dbReady,
          datasources,
          datasets,
          message,
          onOpenConnection: () => setConnectionOpen(true),
          onOpenDataset: () => setDatasetOpen(true),
        })
      : React.createElement(DashboardPage, { apiState, onOpenDataset: () => setPage("DATASET") }),
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
        onCreated: async (result) => {
          await refreshWorkspace(appConnection);
          setMessage(`데이터셋이 생성되었습니다: ${result.dataset_name}`);
          setDatasetOpen(false);
        },
      })
  );
}

function AppBar({ active, onNavigate }) {
  const nav = ["HOME", "WORKSPACE", "REPORTING", "SERVICE", "SYSTEM", "DATASET", "MONITORING"];
  return React.createElement(
    "header",
    { className: "appbar" },
    React.createElement("div", { className: "brand" }, React.createElement("div", { className: "brand-logo" }, "S"), React.createElement("div", { className: "brand-name" }, "SML", React.createElement("span", null, "Automated Smart Machine Learning"))),
    React.createElement("nav", { className: "main-nav" }, nav.map((item) => React.createElement("button", { key: item, className: active === item ? "active" : "", onClick: () => onNavigate(item) }, item))),
    React.createElement("div", { className: "user-box" }, React.createElement("div", { className: "notify" }, "3"), React.createElement("div", { className: "avatar" }, "JH"), React.createElement("div", { className: "user-name" }, "Kim Jihun", React.createElement("span", null, "Manager")))
  );
}

function DashboardPage({ apiState, onOpenDataset }) {
  return React.createElement(
    "section",
    { className: "dash-page compact" },
    React.createElement("div", { className: "breadcrumb" }, "HOME / DASHBOARD"),
    React.createElement("section", { className: "welcome-card" },
      React.createElement("div", null, React.createElement("h1", null, "Dashboard"), React.createElement("p", null, "SML 시스템의 학습 현황과 데이터셋 워크플로우를 확인합니다.")),
      React.createElement("button", { className: "primary-btn", onClick: onOpenDataset }, "DATASET 시작")
    ),
    React.createElement("section", { className: "kpi-row" },
      React.createElement(KpiCard, { label: "API", value: apiState.status === "ok" ? "ONLINE" : "OFFLINE", detail: "FastAPI service" }),
      React.createElement(KpiCard, { label: "TASKS", value: apiState.tasks.length || 3, detail: "Supported dataset tasks" }),
      React.createElement(KpiCard, { label: "ALGORITHMS", value: apiState.algorithms.length || 5, detail: "Binary classifiers" })
    )
  );
}

function KpiCard({ label, value, detail }) {
  return React.createElement("article", { className: "kpi-card" }, React.createElement("span", null, label), React.createElement("strong", null, value), React.createElement("p", null, detail));
}

function DatasetPage({ dbReady, datasources, datasets, message, onOpenConnection, onOpenDataset }) {
  const cards = datasets.length ? datasets : MOCK_DATASETS;
  const counts = countFilters(cards);
  return React.createElement(
    "section",
    { className: "dataset-layout" },
    React.createElement("aside", { className: "dataset-filter" },
      React.createElement("div", { className: "filter-head" }, React.createElement("strong", null, "필터"), React.createElement("button", null, "초기화")),
      React.createElement("input", { placeholder: "이름 검색..." }),
      React.createElement(FilterBlock, { title: "유형", items: [{ label: "정형 (TABULAR)", count: counts.tabular }, { label: "시계열 (TIME-SERIES)", count: counts.series }] }),
      React.createElement(FilterBlock, { title: "상태", items: [{ label: "완료", count: counts.done }, { label: "준비중", count: counts.ready }, { label: "오류", count: counts.error }] }),
      React.createElement(FilterBlock, { title: "데이터 소스", items: datasources.slice(0, 6).map((item) => ({ label: item.datasource_name, count: 1 })) }),
      React.createElement("label", null, "기간", React.createElement("select", null, React.createElement("option", null, "최근 30일"))),
      React.createElement("label", null, "생성자", React.createElement("select", null, React.createElement("option", null, "모든 사용자")))
    ),
    React.createElement("main", { className: "dataset-main" },
      React.createElement("div", { className: "breadcrumb" }, "WORKSPACE / DATASETS"),
      React.createElement("div", { className: "dataset-title-row" },
        React.createElement("div", null, React.createElement("h1", null, "데이터셋"), React.createElement("p", null, "학습에 사용할 데이터셋을 관리합니다. 생성된 데이터셋 메타데이터는 Oracle SML 테이블에 저장됩니다.")),
        React.createElement("div", { className: "dataset-actions" },
          React.createElement("button", { onClick: onOpenConnection }, "데이터소스 연결"),
          React.createElement("button", { className: "primary-btn", onClick: onOpenDataset, disabled: !dbReady || datasources.length === 0 }, "+ 신규 데이터셋")
        )
      ),
      message && React.createElement("div", { className: "notice" }, message),
      !dbReady && React.createElement("div", { className: "notice warn" }, "먼저 데이터소스 연결에서 Oracle 메타 테이블을 생성하고 데이터소스를 등록하세요."),
      React.createElement("div", { className: "dataset-toolbar" },
        React.createElement("span", null, React.createElement("b", null, cards.length), " / ", datasets.length ? "Oracle 저장 데이터셋" : "샘플 카드"),
        React.createElement("button", null, "유형 : 정형, 시계열"),
        React.createElement("button", null, "상태 : 완료"),
        React.createElement("div", { className: "toolbar-right" }, React.createElement("button", null, "정렬 : 최신순"), React.createElement("button", { className: "active" }, "그리드"), React.createElement("button", null, "리스트"))
      ),
      React.createElement("section", { className: "dataset-grid" }, cards.map((item) => React.createElement(DatasetCard, { key: item.dataset_id, item })))
    )
  );
}

function FilterBlock({ title, items }) {
  return React.createElement("section", { className: "filter-block" }, React.createElement("h3", null, title), items.map((item) => React.createElement("label", { key: item.label }, React.createElement("input", { type: "checkbox", defaultChecked: item.count > 0 }), React.createElement("span", null, item.label), React.createElement("em", null, item.count || 0))));
}

function DatasetCard({ item }) {
  const tabular = item.task_type !== "time_series";
  const status = item.status === "LOADED" || item.status === "완료" ? "완료" : item.status || "준비중";
  return React.createElement(
    "article",
    { className: "dataset-card" },
    React.createElement("div", { className: "card-top" }, React.createElement("span", { className: tabular ? "tag blue" : "tag violet" }, tabular ? "TABULAR" : "TIME-SERIES"), React.createElement("b", { className: status === "오류" ? "bad" : "ok" }, status)),
    React.createElement("h2", null, item.dataset_name),
    React.createElement("span", { className: "source-chip" }, item.datasource_name || "ORACLE"),
    React.createElement("div", { className: "card-meta" }, React.createElement("span", null, item.source_table || item.source_mode), React.createElement("span", null, `${formatNum(item.row_count || 0)} rows`), React.createElement("span", null, `${item.column_count || 0} cols`)),
    React.createElement("footer", null, React.createElement("span", null, taskLabel(item.task_type)), React.createElement("time", null, formatDate(item.created_at)))
  );
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

  async function register() {
    setStatus("데이터소스 등록 중...");
    await postJson("/datasources/register", {
      app_connection: connection,
      datasource: {
        datasource_name: sourceName,
        host: form.host,
        port: Number(form.port),
        service_name: form.service_name || undefined,
        sid: form.sid || undefined,
        username: form.username,
        password: form.password,
        schema: form.schema,
        description,
      },
    });
    onSaveConnection(form);
    await onReady(form, "데이터소스가 Oracle SML_DATASOURCE에 저장되었습니다.");
    setStatus("등록 완료");
  }

  async function createDemoTable() {
    setStatus("데모 원천 테이블 생성 중...");
    const result = await postJson("/system/database/demo-data", { app_connection: connection });
    setStatus(`${result.table} 테이블 준비 완료 (${formatNum(result.rows)} rows)`);
  }

  return React.createElement(Modal, { wide: true, onClose },
    React.createElement("div", { className: "modal-title" }, React.createElement("span", null, "DATASETS / DATASOURCES"), React.createElement("h2", null, "데이터소스 연결 관리"), React.createElement("p", null, "SML 시스템이 사용할 Oracle 메타 테이블과 원천 데이터소스를 등록합니다.")),
    React.createElement("div", { className: "modal-grid two" },
      React.createElement(FormInput, { label: "DB IP / Host", value: form.host, onChange: (host) => setForm({ ...form, host }) }),
      React.createElement(FormInput, { label: "Port", value: form.port, onChange: (port) => setForm({ ...form, port }) }),
      React.createElement(FormInput, { label: "Service", value: form.service_name, onChange: (service_name) => setForm({ ...form, service_name }) }),
      React.createElement(FormInput, { label: "SID", value: form.sid, onChange: (sid) => setForm({ ...form, sid }) }),
      React.createElement(FormInput, { label: "사용자 ID", value: form.username, onChange: (username) => setForm({ ...form, username }) }),
      React.createElement(FormInput, { label: "비밀번호", type: "password", value: form.password, onChange: (password) => setForm({ ...form, password }) }),
      React.createElement(FormInput, { label: "Schema", value: form.schema, onChange: (schema) => setForm({ ...form, schema }) }),
      React.createElement(FormInput, { label: "데이터소스 이름", value: sourceName, onChange: setSourceName }),
      React.createElement("label", { className: "field full" }, "설명", React.createElement("textarea", { value: description, onChange: (event) => setDescription(event.target.value) }))
    ),
    status && React.createElement("div", { className: "notice" }, status),
    React.createElement("div", { className: "table-box" },
      React.createElement("div", { className: "table-head" }, React.createElement("b", null, "등록된 데이터소스"), React.createElement("span", null, `총 ${datasources.length}개`)),
      React.createElement("div", { className: "source-table" }, datasources.map((item) => React.createElement("div", { key: item.datasource_id }, React.createElement("b", null, item.datasource_name), React.createElement("span", null, item.db_kind), React.createElement("span", null, `${item.host}:${item.port}`), React.createElement("span", null, item.schema))))
    ),
    React.createElement("div", { className: "modal-actions" }, React.createElement("button", { onClick: initStore }, "연결 및 테이블 생성"), React.createElement("button", { onClick: createDemoTable }, "데모 원천 테이블 생성"), React.createElement("button", { onClick: register }, "+ 데이터소스 등록"), React.createElement("button", { onClick: onClose }, "닫기"))
  );
}

function DatasetWizard({ appConnection, datasources, onClose, onCreated }) {
  const [task, setTask] = useState("binary_classification");
  const [algorithms, setAlgorithms] = useState([]);
  const [algorithm, setAlgorithm] = useState("");
  const [datasetName, setDatasetName] = useState("신규 데이터셋");
  const [datasourceId, setDatasourceId] = useState(datasources[0]?.datasource_id || "");
  const [schema, setSchema] = useState(datasources[0]?.schema || appConnection.schema);
  const [tables, setTables] = useState([]);
  const [table, setTable] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    async function loadAlgorithms() {
      const result = await fetchJson(`/models/algorithms?task=${task}`);
      setAlgorithms(result.algorithms || []);
      setAlgorithm((result.algorithms || [])[0] || "");
    }
    loadAlgorithms().catch((error) => setStatus(error.message));
  }, [task]);

  async function loadTables() {
    setStatus("테이블 조회 중...");
    const result = await postJson("/datasources/tables", { app_connection: compactConnection(appConnection), datasource_id: Number(datasourceId), schema });
    setTables(result.tables || []);
    setTable((result.tables || [])[0]?.table || "");
    setStatus(`${result.tables?.length || 0}개 테이블을 조회했습니다.`);
  }

  async function createDataset() {
    setStatus("데이터셋 생성 및 메타데이터 저장 중...");
    const result = await postJson("/datasets/create", {
      app_connection: compactConnection(appConnection),
      dataset: {
        dataset_name: datasetName,
        task_type: task,
        algorithm_name: algorithm,
        library_name: "scikit-learn",
        datasource_id: Number(datasourceId),
        source_mode: "TABLE",
        source_schema: schema,
        source_table: table,
        preview_rows: 1000,
      },
    });
    onCreated(result);
  }

  return React.createElement(Modal, { wide: true, onClose },
    React.createElement("div", { className: "modal-title" }, React.createElement("span", null, "DATASETS / NEW"), React.createElement("h2", null, "신규 데이터셋 만들기")),
    React.createElement("section", { className: "wizard-section" }, React.createElement("h3", null, "1 작업 유형 선택"), React.createElement("div", { className: "choice-row" }, TASKS.map((item) => React.createElement("button", { key: item.value, className: task === item.value ? "choice active" : "choice", onClick: () => setTask(item.value) }, React.createElement("b", null, item.label), React.createElement("span", null, item.caption))))),
    React.createElement("section", { className: "wizard-section" }, React.createElement("h3", null, "2 알고리즘 선택"), React.createElement("div", { className: "choice-row" }, algorithms.map((item) => React.createElement("button", { key: item, className: algorithm === item ? "choice small active" : "choice small", onClick: () => setAlgorithm(item) }, item)))),
    React.createElement("section", { className: "wizard-section" }, React.createElement("h3", null, "3 데이터 소스 연결"), React.createElement("div", { className: "modal-grid two" },
      React.createElement(FormInput, { label: "데이터셋 이름", value: datasetName, onChange: setDatasetName }),
      React.createElement("label", { className: "field" }, "데이터소스", React.createElement("select", { value: datasourceId, onChange: (event) => setDatasourceId(event.target.value) }, datasources.map((item) => React.createElement("option", { key: item.datasource_id, value: item.datasource_id }, `${item.datasource_name} (${item.schema})`)))),
      React.createElement(FormInput, { label: "Schema", value: schema, onChange: setSchema }),
      React.createElement("label", { className: "field" }, "테이블", React.createElement("select", { value: table, onChange: (event) => setTable(event.target.value) }, tables.map((item) => React.createElement("option", { key: item.table, value: item.table }, `${item.table} / ${formatNum(item.estimated_rows || 0)} rows`))))
    ), React.createElement("button", { onClick: loadTables }, "테이블 조회")),
    status && React.createElement("div", { className: "notice" }, status),
    React.createElement("div", { className: "table-box" }, React.createElement("div", { className: "table-head" }, React.createElement("b", null, `TABLES (${schema})`), React.createElement("span", null, `${tables.length}개`)), React.createElement("div", { className: "table-list" }, tables.slice(0, 8).map((item) => React.createElement("button", { key: item.table, className: table === item.table ? "active" : "", onClick: () => setTable(item.table) }, item.table, React.createElement("span", null, `${formatNum(item.estimated_rows || 0)} rows`))))),
    React.createElement("div", { className: "modal-actions" }, React.createElement("button", { onClick: onClose }, "취소"), React.createElement("button", { className: "primary-btn", onClick: createDataset, disabled: !datasourceId || !table || !algorithm }, "+ 생성"))
  );
}

function Modal({ children, onClose, wide }) {
  return React.createElement("div", { className: "modal-backdrop" }, React.createElement("section", { className: wide ? "modal wide" : "modal" }, React.createElement("button", { className: "modal-close", onClick: onClose }, "×"), children));
}

function FormInput({ label, value, onChange, type = "text" }) {
  return React.createElement("label", { className: "field" }, label, React.createElement("input", { type, value: value || "", onChange: (event) => onChange(event.target.value) }));
}

async function fetchJson(path) {
  const response = await fetch(`${API_BASE}${path}`);
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.detail || "API request failed");
  return payload;
}

async function postJson(path, body) {
  const response = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
  if (task === "multi_regression") return "멀티타겟";
  return task || "-";
}

function formatNum(value) {
  return Number(value || 0).toLocaleString();
}

function formatDate(value) {
  if (!value) return "오늘";
  return String(value).slice(5, 10);
}

ReactDOM.createRoot(document.getElementById("root")).render(React.createElement(App));
