"""데이터셋 자동화 단계들을 순서대로 실행하는 오케스트레이션 모듈."""

from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any

import pandas as pd

from sml_dataset.config import PipelineConfig
from sml_dataset.connectors import create_connector
from sml_dataset.eda import run_eda
from sml_dataset.io import write_json
from sml_dataset.metadata import build_metadata
from sml_dataset.preprocessing import preprocess_dataset
from sml_dataset.significance import run_significance_tests
from sml_dataset.target_validation import validate_targets
from sml_dataset.versioning import DatasetVersionInfo, save_dataset_version


@dataclass
class DatasetBundle:
    """파이프라인 실행 후 API, 노트북, 모델링에서 재사용할 결과 묶음."""

    raw: pd.DataFrame
    features: pd.DataFrame
    targets: pd.DataFrame
    metadata: dict[str, Any]
    eda: dict[str, Any]
    significance: dict[str, Any]
    preprocessing_report: dict[str, Any]
    version_info: DatasetVersionInfo


class DatasetPipeline:
    """로드부터 pkl 버전 저장까지 데이터셋 파트를 한 번에 실행한다."""

    def __init__(self, config: PipelineConfig) -> None:
        self.config = config

    def run(self) -> DatasetBundle:
        """설정 기반으로 데이터셋 파트 전체 프로세스를 실행한다."""

        connector = create_connector(self.config.data_source.type, self.config.data_source.options)
        raw = connector.load()

        # 사용자 화면에 보여줄 preview/metadata를 먼저 만들고, 이후 타겟 규칙을 검증한다.
        metadata = build_metadata(raw)
        validate_targets(raw, self.config.task, self.config.targets)
        eda = run_eda(raw, self.config.task, self.config.targets)
        significance = run_significance_tests(raw, self.config.task, self.config.targets)
        preprocess_result = preprocess_dataset(raw, self.config.targets, self.config.preprocessing)

        version_info = save_dataset_version(
            name=self.config.versioning.name,
            artifact_dir=self.config.versioning.artifact_dir,
            features=preprocess_result.features,
            targets=preprocess_result.targets,
            metadata=metadata,
            preprocessing_report=preprocess_result.report,
            preprocessor=preprocess_result.preprocessor,
        )

        self._write_reports(metadata, eda, significance, preprocess_result.report, version_info)

        return DatasetBundle(
            raw=raw,
            features=preprocess_result.features,
            targets=preprocess_result.targets,
            metadata=metadata,
            eda=eda,
            significance=significance,
            preprocessing_report=preprocess_result.report,
            version_info=version_info,
        )

    def _write_reports(
        self,
        metadata: dict[str, Any],
        eda: dict[str, Any],
        significance: dict[str, Any],
        preprocessing_report: dict[str, Any],
        version_info: DatasetVersionInfo,
    ) -> None:
        """노트북/프론트/API에서 확인하기 쉬운 JSON 리포트를 단계별로 저장한다."""

        base_name = self.config.versioning.name
        write_json(Path("artifacts/metadata") / f"{base_name}.json", metadata)
        write_json(Path("artifacts/eda") / f"{base_name}.json", eda)
        write_json(Path("artifacts/significance") / f"{base_name}.json", significance)
        write_json(
            Path("artifacts/preprocessing") / f"{base_name}.json",
            {
                "preprocessing": preprocessing_report,
                "version": asdict(version_info),
            },
        )
