"""선택된 target 컬럼이 태스크 요구사항을 만족하는지 검증한다."""

import pandas as pd

from sml_dataset.task import TaskType


def validate_targets(df: pd.DataFrame, task: TaskType, targets: list[str]) -> None:
    """검증 실패 시 API/CLI에서 그대로 보여줄 수 있는 ValueError를 발생시킨다."""

    missing = [target for target in targets if target not in df.columns]
    if missing:
        raise ValueError(f"Target columns do not exist: {missing}")

    if task == TaskType.BINARY_CLASSIFICATION:
        # 이진분류는 정확히 하나의 target과 두 개의 고유값을 요구한다.
        if len(targets) != 1:
            raise ValueError("Binary classification requires exactly one target.")
        unique_values = df[targets[0]].dropna().unique()
        if len(unique_values) != 2:
            raise ValueError(
                "Binary classification target must have exactly 2 unique values. "
                f"Found {len(unique_values)} values in '{targets[0]}'."
            )
        return

    if task == TaskType.SINGLE_REGRESSION:
        # 회귀 target은 모델 학습을 위해 숫자형이어야 한다.
        if len(targets) != 1:
            raise ValueError("Single regression requires exactly one target.")
    elif task == TaskType.MULTI_REGRESSION:
        if len(targets) < 2:
            raise ValueError("Multi regression requires at least two targets.")

    non_numeric = [target for target in targets if not pd.api.types.is_numeric_dtype(df[target])]
    if non_numeric:
        raise ValueError(f"Regression targets must be numeric: {non_numeric}")
