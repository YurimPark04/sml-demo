"""YAML 설정 파일 하나로 데이터셋 파이프라인을 실행하는 CLI."""

import argparse
import sys
from dataclasses import asdict
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parents[1]
SML_DATASET_PACKAGE = ROOT_DIR / "packages" / "sml-dataset"
if str(SML_DATASET_PACKAGE) not in sys.path:
    sys.path.insert(0, str(SML_DATASET_PACKAGE))

from sml_dataset.config import PipelineConfig
from sml_dataset.pipeline import DatasetPipeline


def main() -> None:
    """설정을 읽고 DatasetPipeline 실행 결과를 콘솔에 요약 출력한다."""

    parser = argparse.ArgumentParser(description="Run the TOBE SML dataset pipeline demo.")
    parser.add_argument("--config", required=True, help="Path to a YAML pipeline config.")
    args = parser.parse_args()

    config = PipelineConfig.from_yaml(args.config)
    bundle = DatasetPipeline(config).run()

    print("Dataset pipeline completed.")
    print(f"Task: {config.task.value}")
    print(f"Raw shape: {bundle.raw.shape}")
    print(f"Feature shape: {bundle.features.shape}")
    print(f"Target shape: {bundle.targets.shape}")
    print(f"Version: {asdict(bundle.version_info)}")


if __name__ == "__main__":
    main()
