"""JSON 리포트 저장 유틸리티."""

import json
from pathlib import Path
from typing import Any


def write_json(path: str | Path, payload: dict[str, Any]) -> None:
    """상위 디렉터리를 만든 뒤 dict payload를 UTF-8 JSON으로 저장한다."""

    target = Path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    with target.open("w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2, default=str)
