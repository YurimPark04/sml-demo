"""모델링 파트에서 지원하는 태스크 타입 정의."""

from enum import StrEnum


class ModelingTask(StrEnum):
    """알고리즘 registry와 평가 지표 선택에 사용하는 태스크 값."""

    BINARY_CLASSIFICATION = "binary_classification"
    SINGLE_REGRESSION = "single_regression"
    MULTI_REGRESSION = "multi_regression"

    @property
    def is_regression(self) -> bool:
        return self in {self.SINGLE_REGRESSION, self.MULTI_REGRESSION}
