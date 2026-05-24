"""모델링 패키지에서 사용하는 joblib artifact 입출력 함수."""

from pathlib import Path
from typing import Any

import joblib


def load_dataset_version(path: str | Path) -> dict[str, Any]:
    """데이터셋 파트가 저장한 pkl payload를 읽고 필수 키를 검증한다."""

    payload = joblib.load(path)
    required = {"features", "targets", "version_id"}
    missing = required - payload.keys()
    if missing:
        raise ValueError(f"Dataset version payload is missing keys: {sorted(missing)}")
    return payload


def save_model_artifact(path: str | Path, payload: dict[str, Any]) -> None:
    """학습된 estimator와 평가 메타데이터를 하나의 pkl로 저장한다."""

    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    joblib.dump(payload, target)
