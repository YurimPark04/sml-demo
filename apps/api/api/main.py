"""FastAPI 엔트리포인트.

데이터셋 파트와 모델링 파트를 HTTP API로 노출하고,
데모용 React 화면도 같은 서버에서 정적 파일로 서빙한다.
"""

from dataclasses import asdict
from pathlib import Path
import sys
from typing import Any

MONOREPO_ROOT = Path(__file__).resolve().parents[3]
SML_DATASET_PACKAGE = MONOREPO_ROOT / "packages" / "sml-dataset"
if str(SML_DATASET_PACKAGE) not in sys.path:
    sys.path.insert(0, str(SML_DATASET_PACKAGE))
SML_MODELING_PACKAGE = MONOREPO_ROOT / "packages" / "sml-modeling"
if str(SML_MODELING_PACKAGE) not in sys.path:
    sys.path.insert(0, str(SML_MODELING_PACKAGE))

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .schemas import (
    AppDatabaseRequest,
    DatasetRequest,
    DatasetCreateRequest,
    DatasetProcessDataRequest,
    DatasetSelectionSaveRequest,
    DatasourceRegisterRequest,
    DatasourceTablesRequest,
    ModelTrainingRequest,
    OracleColumnsRequest,
    OracleConnectionRequest,
    OracleTablesRequest,
    PipelineSummary,
    PreviewRequest,
)
from .store import (
    create_demo_source_data,
    create_dataset_from_datasource,
    get_dataset_process_data,
    initialize_metadata_store,
    list_datasets,
    list_datasource_tables,
    list_datasources,
    register_datasource,
    save_dataset_selection,
)
from sml_modeling.registry import algorithm_hyperparameters, available_algorithms
from sml_modeling.task import ModelingTask
from sml_modeling.training import results_as_dicts, train_algorithms
from sml_dataset.config import DataSourceConfig, PipelineConfig, VersioningConfig
from sml_dataset.connectors import create_connector
from sml_dataset.connectors.oracle import (
    list_oracle_columns,
    list_oracle_schemas,
    list_oracle_tables,
    test_oracle_connection,
)
from sml_dataset.eda import run_eda
from sml_dataset.metadata import build_metadata
from sml_dataset.preprocessing import preprocess_dataset
from sml_dataset.significance import run_significance_tests
from sml_dataset.target_validation import validate_targets
from sml_dataset.task import TaskType
from sml_dataset.versioning import save_dataset_version

app = FastAPI(
    title="TOBE SML Dataset API",
    description="Dataset automation API for preview, metadata, EDA, preprocessing, significance tests, and pkl versioning.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = MONOREPO_ROOT / "apps" / "web"
if FRONTEND_DIR.exists():
    # 별도 프론트 서버 없이도 /app에서 데모 화면을 바로 볼 수 있게 한다.
    app.mount("/static", StaticFiles(directory=FRONTEND_DIR), name="static")


@app.get("/app", include_in_schema=False)
def frontend_app() -> FileResponse:
    return FileResponse(FRONTEND_DIR / "index.html")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/tasks")
def tasks() -> dict[str, list[str]]:
    return {"tasks": [task.value for task in TaskType]}


@app.post("/system/database/init")
def initialize_database(request: AppDatabaseRequest) -> dict[str, Any]:
    """Create SML metadata tables in the configured Oracle database."""

    try:
        return initialize_metadata_store(_request_dict(request.app_connection))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/system/database/demo-data")
def initialize_demo_data(request: AppDatabaseRequest) -> dict[str, Any]:
    """Create a demo Oracle source table for the dataset workflow."""

    try:
        return create_demo_source_data(_request_dict(request.app_connection))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasources/oracle/test")
def test_oracle_datasource(request: OracleConnectionRequest) -> dict[str, Any]:
    """Check whether the API can connect to an Oracle datasource."""

    try:
        return test_oracle_connection(_request_dict(request))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasources/oracle/schemas")
def oracle_datasource_schemas(request: OracleConnectionRequest) -> dict[str, Any]:
    """Return Oracle schemas visible to the connected account."""

    try:
        return list_oracle_schemas(_request_dict(request))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasources/oracle/tables")
def oracle_datasource_tables(request: OracleTablesRequest) -> dict[str, Any]:
    """Return Oracle tables for a schema."""

    try:
        payload = _request_dict(request)
        return list_oracle_tables(payload, schema=request.schema_name)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasources/oracle/columns")
def oracle_datasource_columns(request: OracleColumnsRequest) -> dict[str, Any]:
    """Return Oracle column metadata for a table."""

    try:
        payload = _request_dict(request)
        return list_oracle_columns(payload, schema=request.schema_name, table=request.table)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasources/register")
def register_datasource_api(request: DatasourceRegisterRequest) -> dict[str, Any]:
    """Persist a datasource in SML_DATASOURCE."""

    try:
        return register_datasource(
            _request_dict(request.app_connection),
            request.datasource,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasources/list")
def list_datasources_api(request: AppDatabaseRequest) -> dict[str, Any]:
    """Return datasources registered in SML_DATASOURCE."""

    try:
        return list_datasources(_request_dict(request.app_connection))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasources/tables")
def list_datasource_tables_api(request: DatasourceTablesRequest) -> dict[str, Any]:
    """List source tables using a datasource stored in SML_DATASOURCE."""

    try:
        return list_datasource_tables(
            _request_dict(request.app_connection),
            datasource_id=request.datasource_id,
            schema=request.schema_name,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasets/create")
def create_dataset_api(request: DatasetCreateRequest) -> dict[str, Any]:
    """Create a loaded dataset record from a stored datasource."""

    try:
        return create_dataset_from_datasource(
            _request_dict(request.app_connection),
            request.dataset,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasets/list")
def list_datasets_api(request: AppDatabaseRequest) -> dict[str, Any]:
    """Return dataset cards saved in SML_DATASET."""

    try:
        return list_datasets(_request_dict(request.app_connection))
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasets/process-data")
def dataset_process_data_api(request: DatasetProcessDataRequest) -> dict[str, Any]:
    """Return data needed by the target/feature selection page."""

    try:
        return get_dataset_process_data(
            _request_dict(request.app_connection),
            dataset_id=request.dataset_id,
            preview_rows=request.preview_rows,
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasets/selection/save")
def save_dataset_selection_api(request: DatasetSelectionSaveRequest) -> dict[str, Any]:
    """Persist target, feature, PK, and unused column selections."""

    try:
        return save_dataset_selection(
            _request_dict(request.app_connection),
            _request_dict(request),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasets/preview")
def preview_dataset(request: PreviewRequest) -> dict[str, Any]:
    """DB/CSV에서 데이터를 읽고 head와 컬럼 메타데이터를 반환한다."""

    try:
        df = _load_dataframe(request.data_source.type, request.data_source.options)
        return build_metadata(df, preview_rows=request.preview_rows)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasets/validate-targets")
def validate_dataset_targets(request: DatasetRequest) -> dict[str, Any]:
    """사용자가 선택한 target이 태스크 규칙을 만족하는지 검증한다."""

    try:
        df = _load_dataframe(request.data_source.type, request.data_source.options)
        validate_targets(df, request.task, request.targets)
        return {
            "valid": True,
            "task": request.task.value,
            "targets": request.targets,
            "target_preview": df[request.targets].head().to_dict(orient="records"),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasets/eda")
def eda_dataset(request: DatasetRequest) -> dict[str, Any]:
    """EDA 요약과 차트 spec을 반환한다."""

    try:
        df = _load_dataframe(request.data_source.type, request.data_source.options)
        validate_targets(df, request.task, request.targets)
        return run_eda(df, request.task, request.targets)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasets/significance")
def significance_dataset(request: DatasetRequest) -> dict[str, Any]:
    """태스크별 유의성 검증 결과를 반환한다."""

    try:
        df = _load_dataframe(request.data_source.type, request.data_source.options)
        validate_targets(df, request.task, request.targets)
        return run_significance_tests(df, request.task, request.targets)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasets/preprocess")
def preprocess_dataset_api(request: DatasetRequest) -> dict[str, Any]:
    """전처리 결과 preview와 리포트를 반환한다. pkl 저장은 하지 않는다."""

    try:
        df = _load_dataframe(request.data_source.type, request.data_source.options)
        validate_targets(df, request.task, request.targets)
        result = preprocess_dataset(df, request.targets, request.preprocessing)
        return {
            "report": result.report,
            "feature_shape": result.features.shape,
            "target_shape": result.targets.shape,
            "feature_preview": result.features.head().to_dict(orient="records"),
            "target_preview": result.targets.head().to_dict(orient="records"),
        }
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/datasets/version")
def version_dataset(request: DatasetRequest) -> dict[str, Any]:
    """전처리된 dataset bundle을 pkl 버전으로 저장한다."""

    try:
        df = _load_dataframe(request.data_source.type, request.data_source.options)
        metadata = build_metadata(df)
        validate_targets(df, request.task, request.targets)
        result = preprocess_dataset(df, request.targets, request.preprocessing)
        version_info = save_dataset_version(
            name=request.versioning.name,
            artifact_dir=Path(request.versioning.artifact_dir),
            features=result.features,
            targets=result.targets,
            metadata=metadata,
            preprocessing_report=result.report,
            preprocessor=result.preprocessor,
        )
        return asdict(version_info)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/pipelines/run", response_model=PipelineSummary)
def run_pipeline(request: DatasetRequest) -> PipelineSummary:
    """데이터셋 파트 전체 프로세스를 한 번에 실행한다."""

    try:
        from sml_dataset.pipeline import DatasetPipeline

        config = PipelineConfig(
            task=request.task,
            data_source=DataSourceConfig(
                type=request.data_source.type,
                options=request.data_source.options,
            ),
            targets=request.targets,
            preprocessing=request.preprocessing,
            versioning=VersioningConfig(
                artifact_dir=Path(request.versioning.artifact_dir),
                name=request.versioning.name,
            ),
        )
        bundle = DatasetPipeline(config).run()
        return PipelineSummary(
            task=request.task,
            raw_shape=bundle.raw.shape,
            feature_shape=bundle.features.shape,
            target_shape=bundle.targets.shape,
            version=asdict(bundle.version_info),
        )
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


def _load_dataframe(source_type: str, options: dict[str, Any]):
    """API 요청의 data_source 설정으로 DataFrame을 로드한다."""

    connector = create_connector(source_type, options)
    return connector.load()


def _request_dict(request: Any) -> dict[str, Any]:
    """Return a Pydantic request model as a plain dict without empty optional values."""

    if hasattr(request, "model_dump"):
        return request.model_dump(exclude_none=True, by_alias=True)
    return request.dict(exclude_none=True, by_alias=True)


@app.get("/models/algorithms")
def model_algorithms(task: ModelingTask) -> dict[str, Any]:
    """태스크별 사용 가능한 모델 알고리즘 목록을 반환한다."""

    return {"task": task.value, "algorithms": available_algorithms(task)}


@app.get("/models/hyperparameters")
def model_hyperparameters(task: ModelingTask, algorithm: str | None = None) -> dict[str, Any]:
    """태스크/알고리즘별 기본 하이퍼파라미터 schema를 반환한다."""

    return {"task": task.value, "hyperparameters": algorithm_hyperparameters(task, algorithm)}


@app.post("/models/train")
def train_models(request: ModelTrainingRequest) -> dict[str, Any]:
    """저장된 데이터셋 pkl을 입력으로 모델을 학습하고 artifact를 저장한다."""

    try:
        results = train_algorithms(
            dataset_path=request.dataset_path,
            task=request.task,
            algorithms=request.algorithms,
            hyperparameters=request.hyperparameters,
            artifact_dir=request.artifact_dir,
            test_size=request.test_size,
        )
        return {"results": results_as_dicts(results)}
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
