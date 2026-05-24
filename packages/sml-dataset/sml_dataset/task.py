"""데이터셋 파트에서 지원하는 태스크 타입 정의."""

from enum import StrEnum


class TaskType(StrEnum):
    """데이터셋 검증, EDA, 전처리 흐름을 분기하는 기준 값."""

    BINARY_CLASSIFICATION = "binary_classification"
    SINGLE_REGRESSION = "single_regression"
    MULTI_REGRESSION = "multi_regression"

    @property
    def is_regression(self) -> bool:
        return self in {self.SINGLE_REGRESSION, self.MULTI_REGRESSION}
