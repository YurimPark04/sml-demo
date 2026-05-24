"""YAML 설정 파일을 파이프라인에서 쓰기 좋은 객체로 변환하는 모듈."""

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

from sml_dataset.task import TaskType


@dataclass(frozen=True)
class DataSourceConfig:
    """DB, CSV 등 원천 데이터 접근에 필요한 커넥터 설정."""

    type: str
    options: dict[str, Any]


@dataclass(frozen=True)
class VersioningConfig:
    """전처리 완료 데이터셋을 저장할 위치와 버전명 prefix."""

    artifact_dir: Path = Path("artifacts/datasets")
    name: str = "dataset"


@dataclass(frozen=True)
class PipelineConfig:
    """데이터셋 파이프라인 전체 실행에 필요한 단일 설정 객체."""

    task: TaskType
    data_source: DataSourceConfig
    targets: list[str]
    preprocessing: dict[str, Any] = field(default_factory=dict)
    versioning: VersioningConfig = field(default_factory=VersioningConfig)

    @classmethod
    def from_yaml(cls, path: str | Path) -> "PipelineConfig":
        """사용자가 작성한 YAML 설정을 타입이 있는 설정 객체로 변환한다."""

        with Path(path).open("r", encoding="utf-8") as f:
            raw = yaml.safe_load(f)

        source = raw["data_source"].copy()
        source_type = source.pop("type")
        versioning = raw.get("versioning", {})
        return cls(
            task=TaskType(raw["task"]),
            data_source=DataSourceConfig(type=source_type, options=source),
            targets=list(raw["targets"]),
            preprocessing=raw.get("preprocessing", {}),
            versioning=VersioningConfig(
                artifact_dir=Path(versioning.get("artifact_dir", "artifacts/datasets")),
                name=versioning.get("name", "dataset"),
            ),
        )
