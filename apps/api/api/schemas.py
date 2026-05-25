"""FastAPI request/response 모델 정의."""

from pathlib import Path
import sys
from typing import Any, Literal

MONOREPO_ROOT = Path(__file__).resolve().parents[3]
SML_DATASET_PACKAGE = MONOREPO_ROOT / "packages" / "sml-dataset"
if str(SML_DATASET_PACKAGE) not in sys.path:
    sys.path.insert(0, str(SML_DATASET_PACKAGE))
SML_MODELING_PACKAGE = MONOREPO_ROOT / "packages" / "sml-modeling"
if str(SML_MODELING_PACKAGE) not in sys.path:
    sys.path.insert(0, str(SML_MODELING_PACKAGE))

from pydantic import BaseModel, Field

from sml_modeling.task import ModelingTask
from sml_dataset.task import TaskType


class ApiDataSource(BaseModel):
    """API가 지원하는 데이터 원천 타입과 커넥터 옵션."""

    type: Literal["sqlite", "csv", "oracle"]
    options: dict[str, Any] = Field(
        examples=[
            {
                "database": "data/demo_sml.db",
                "query": "SELECT * FROM customer_churn",
            }
        ]
    )


class OracleConnectionRequest(BaseModel):
    """Oracle connection settings used for datasource test and metadata APIs."""

    host: str = Field(examples=["10.20.40.7"])
    port: int = 1521
    service_name: str | None = Field(default=None, examples=["ORCLPDB1"])
    sid: str | None = None
    username: str = Field(examples=["ml_reader"])
    password: str | None = Field(default=None, repr=False)
    password_env: str | None = Field(default=None, examples=["SML_ORACLE_PASSWORD"])
    schema_name: str | None = Field(default=None, alias="schema", examples=["SML_OWNER"])
    thick_mode: bool = False
    client_lib_dir: str | None = None


class OracleTablesRequest(OracleConnectionRequest):
    """Request body for listing tables in an Oracle schema."""

    schema_name: str = Field(alias="schema", examples=["SML_OWNER"])


class OracleColumnsRequest(OracleTablesRequest):
    """Request body for listing Oracle table columns."""

    table: str = Field(examples=["CUSTOMER_TXN_2024Q4"])


class AppDatabaseRequest(BaseModel):
    """Request body that points the SML app to its Oracle metadata database."""

    app_connection: OracleConnectionRequest


class DatasourceRegisterRequest(AppDatabaseRequest):
    """Register a datasource in the SML metadata database."""

    datasource: dict[str, Any] = Field(
        examples=[
            {
                "datasource_name": "SML-DEMO",
                "host": "localhost",
                "port": 1521,
                "service_name": "ORCL",
                "username": "C##SML_DEMO",
                "password": "password",
                "schema": "C##SML_DEMO",
                "description": "Oracle demo datasource",
            }
        ]
    )


class DatasourceTablesRequest(AppDatabaseRequest):
    """List tables from a datasource stored in SML_DATASOURCE."""

    datasource_id: int
    schema_name: str | None = Field(default=None, alias="schema")


class DatasetCreateRequest(AppDatabaseRequest):
    """Create a dataset record by loading metadata from an Oracle datasource."""

    dataset: dict[str, Any] = Field(
        examples=[
            {
                "dataset_name": "고객 거래내역 2024Q4",
                "task_type": "binary_classification",
                "algorithm_name": "random_forest",
                "datasource_id": 1,
                "source_mode": "TABLE",
                "source_schema": "C##SML_DEMO",
                "source_table": "CUSTOMER_TXN_2024Q4",
                "preview_rows": 1000,
            }
        ]
    )


class DatasetProcessDataRequest(AppDatabaseRequest):
    """Load dataset process-page metadata and preview rows from a saved dataset."""

    dataset_id: int
    preview_rows: int = 200


class DatasetSelectionSaveRequest(AppDatabaseRequest):
    """Persist target, feature, PK, and unused column selections."""

    dataset_id: int
    target_columns: list[str] = Field(default_factory=list)
    feature_columns: list[str] = Field(default_factory=list)
    pk_columns: list[str] = Field(default_factory=list)
    unused_columns: list[str] = Field(default_factory=list)
    target_profile: dict[str, Any] = Field(default_factory=dict)


class VersioningRequest(BaseModel):
    """데이터셋 pkl 저장 위치와 artifact 이름 prefix."""

    artifact_dir: str = "artifacts/datasets"
    name: str = "dataset"


class DatasetRequest(BaseModel):
    """데이터셋 파트 대부분의 endpoint가 공유하는 요청 body."""

    task: TaskType
    data_source: ApiDataSource
    targets: list[str] = Field(default_factory=list)
    preprocessing: dict[str, Any] = Field(default_factory=dict)
    versioning: VersioningRequest = Field(default_factory=VersioningRequest)


class PreviewRequest(BaseModel):
    """target 선택 전 metadata preview에 필요한 최소 요청 body."""

    task: TaskType
    data_source: ApiDataSource
    preview_rows: int = 5


class PipelineSummary(BaseModel):
    """전체 데이터셋 파이프라인 실행 결과 요약."""

    task: TaskType
    raw_shape: tuple[int, int]
    feature_shape: tuple[int, int]
    target_shape: tuple[int, int]
    version: dict[str, Any]


class ModelTrainingRequest(BaseModel):
    """저장된 데이터셋 pkl을 이용해 모델 학습을 요청하는 body."""

    dataset_path: str = Field(examples=["artifacts/datasets/customer_churn_binary_YYYYMMDDTHHMMSSZ.pkl"])
    task: ModelingTask
    algorithms: list[str] | None = None
    hyperparameters: dict[str, dict[str, Any]] | None = Field(
        default=None,
        examples=[{"random_forest": {"max_depth": 5, "max_features": "sqrt"}}],
    )
    artifact_dir: str = "artifacts/models"
    test_size: float = 0.2


def versioning_to_dict(versioning: VersioningRequest) -> dict[str, Any]:
    """Pydantic 모델을 내부 dataclass 생성에 맞는 dict로 변환한다."""

    return {
        "artifact_dir": Path(versioning.artifact_dir),
        "name": versioning.name,
    }
