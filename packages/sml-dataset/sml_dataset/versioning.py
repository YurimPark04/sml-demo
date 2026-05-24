"""전처리된 데이터셋을 재사용 가능한 pkl 버전으로 저장한다."""

from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import joblib
import pandas as pd


@dataclass(frozen=True)
class DatasetVersionInfo:
    """저장된 데이터셋 artifact를 추적하기 위한 최소 메타정보."""

    version_id: str
    path: str
    created_at: str
    rows: int
    feature_columns: int
    target_columns: int


def save_dataset_version(
    name: str,
    artifact_dir: Path,
    features: pd.DataFrame,
    targets: pd.DataFrame,
    metadata: dict[str, Any],
    preprocessing_report: dict[str, Any],
    preprocessor: Any,
) -> DatasetVersionInfo:
    """features/targets/preprocessor를 하나의 joblib payload로 저장한다."""

    artifact_dir.mkdir(parents=True, exist_ok=True)
    created_at = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    version_id = f"{name}_{created_at}"
    path = artifact_dir / f"{version_id}.pkl"
    payload = {
        # 모델링 파트는 이 payload의 features/targets/version_id를 직접 읽는다.
        "version_id": version_id,
        "created_at": created_at,
        "features": features,
        "targets": targets,
        "metadata": metadata,
        "preprocessing_report": preprocessing_report,
        "preprocessor": preprocessor,
    }
    joblib.dump(payload, path)
    info = DatasetVersionInfo(
        version_id=version_id,
        path=str(path),
        created_at=created_at,
        rows=int(len(features)),
        feature_columns=int(features.shape[1]),
        target_columns=int(targets.shape[1]),
    )
    # 사람이 빠르게 조회할 수 있는 가벼운 meta 파일도 함께 저장한다.
    joblib.dump(asdict(info), artifact_dir / f"{version_id}.meta.pkl")
    return info
